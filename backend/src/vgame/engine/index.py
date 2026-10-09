"""Precomputed index variants: chunks, passage vectors, question vectors and rerank scores
(engine-v0.2.md §5.3; §14 2026-10-08 "bản miễn phí": no ML model on the server).

Artifacts in ``<index_dir>`` (format 2; shipped in ``engine/data/index``, written by
``vgame-build-index``): ``manifest.json``, ``documents.json``, ``<variant.key>.json`` (chunks),
``passages.json`` (sha256 of each distinct dense text, row order) + ``passages.npy`` (float32,
L2-normalised; a text shared by several variants is stored once), ``queries.json`` (sha256 of the
NFC question -> row) + ``queries.npy``, ``rerank.json`` (model, scoring regime, question keys,
text keys) + ``rerank.npy`` (float32 cross-encoder scores; NaN = a pair no level can rerank).
No pickle.
"""

import argparse
import hashlib
import json
import platform
import sys
import time
import unicodedata
from collections.abc import Callable, Mapping, Sequence
from dataclasses import asdict
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any

import numpy as np
from rank_bm25 import BM25Okapi  # type: ignore[import-untyped]

from vgame.config import Settings
from vgame.engine.chunking import bm25_text, chunk_document, embed_text
from vgame.engine.constants import ALL_VARIANTS, TOKENIZER_ID, IndexVariant
from vgame.engine.corpus import Article, Clause, Document, load_documents
from vgame.engine.levels import load_level
from vgame.engine.types import Chunk, Embedder, EngineError, IndexHandle, Reranker, Vectors

_VARIANTS_BY_KEY = {v.key: v for v in ALL_VARIANTS}
# BM25 models kept (least recently used dropped): a server reaches 96 handles (24 variants x
# 2 corpora x only_in_force) and all 96 held ~60 MB; a rebuild takes ~6 ms (~60 ms at 0.1 CPU).
BM25_CACHE_SIZE = 4
FORMAT = 2  # 1: one float32 matrix per variant (gitignored cache, live reranker)
MODELS_MISSING_VI = (
    "vgame-build-index cần nhóm phụ thuộc models (fastembed). "
    "Chạy `uv sync` (nhóm dev đã gồm models) rồi chạy lại."
)

# NFC golden question -> doc_ids of the level corpus it can rerank over.
RerankQuestions = Mapping[str, frozenset[str]]


class IndexNotBuiltError(EngineError):
    message_vi = "Chưa dựng index. Chủ máy chủ cần chạy vgame-build-index."
    step_status = "index_error"


class IndexStaleError(EngineError):
    """The index was built from another corpus or golden question set (checked at startup)."""

    message_vi = (
        "Index đã cũ so với kho quy chế hoặc bộ câu hỏi. "
        "Chủ máy chủ cần chạy lại vgame-build-index."
    )
    step_status = "index_error"


class RerankScoreMissingError(EngineError):
    """A (question, passage) pair the build did not score. The startup check proves full
    coverage, so this is a bug, never a silent fallback to another score (E5)."""

    message_vi = (
        "Bảng điểm xếp hạng lại chưa có câu hỏi hoặc đoạn này. "
        "Chủ máy chủ cần chạy lại vgame-build-index."
    )
    step_status = "index_error"


def question_key(question: str) -> str:
    return hashlib.sha256(unicodedata.normalize("NFC", question).encode()).hexdigest()


def text_key(text: str) -> str:
    """sha256 of the exact text (a passage's dense or BM25 field)."""
    return hashlib.sha256(text.encode()).hexdigest()


def _corpus_sha256(documents: Mapping[str, Document]) -> str:
    digest = hashlib.sha256()
    for doc_id in sorted(documents):
        digest.update(f"{doc_id}|{documents[doc_id].in_force}|{documents[doc_id].text}\0".encode())
    return digest.hexdigest()


def _package_version(name: str) -> str:
    try:
        return version(name)
    except PackageNotFoundError:  # the server installs without the "models" group
        return "unknown"


def rerank_regime() -> dict[str, object]:
    """What decides a cross-encoder score besides the model id. Scores from another regime are
    never reused: one table would mix two scorings whose ranks do not compare."""
    from vgame.engine.retrieval import RERANK_MAX_TOKENS  # retrieval imports this module

    return {
        "max_tokens": RERANK_MAX_TOKENS,
        "fastembed_version": _package_version("fastembed"),
        "onnxruntime_version": _package_version("onnxruntime"),
    }


def normalise_rows(rows: Vectors) -> Vectors:
    rows = np.asarray(rows, dtype=np.float32)
    norms = np.linalg.norm(rows, axis=1, keepdims=True)
    return (rows / np.where(norms == 0, 1, norms)).astype(np.float32)


def _document_from_json(raw: dict[str, Any]) -> Document:
    return Document(
        doc_id=raw["doc_id"],
        in_force=bool(raw["in_force"]),
        text=raw["text"],
        articles=tuple(
            Article(
                dieu=a["dieu"],
                title=a["title"],
                start=a["start"],
                end=a["end"],
                clauses=tuple(Clause(**c) for c in a["clauses"]),
            )
            for a in raw["articles"]
        ),
    )


def _chunk_from_json(raw: dict[str, Any]) -> Chunk:
    return Chunk(**{**raw, "khoan": tuple(raw["khoan"])})


# Live jina-v2 cost when no build has timed it (engine-spike-report §3.4): 873 pairs per question
# took 102-195 s on an idle i7-12700H, batch 2, pairs cut at 512 tokens.
RERANK_TIMING_FALLBACK: dict[str, Any] = {
    "ms_per_pair": 120.0,
    "source": "engine-spike-report §3.4: i7-12700H idle, batch 2, pairs <= 512 tokens",
}


class RerankTable:
    """Cross-encoder scores computed offline by ``vgame-build-index`` with the real model: the
    server's ``Reranker``. ``score`` returns the floats the live model returned (float32 holds
    every jina-v2 logit exactly; engine-spike-report §3.4). A lookup takes ~10-20 ms however
    many pairs it scores, so rerank steps report a simulated ``ms_per_pair`` x pairs instead
    (engine-v0.2.md §14, 2026-10-09): what the live model cost on the build machine."""

    def __init__(
        self,
        model_id: str,
        questions: Sequence[str],
        texts: Sequence[str],
        scores: Vectors,
        regime: Mapping[str, object] | None = None,
        timing: Mapping[str, Any] | None = None,
    ) -> None:
        """``questions``: ``question_key`` per row; ``texts``: ``text_key`` per column;
        ``regime``: ``rerank_regime()`` of the build that scored them; ``timing``: what live
        scoring cost then (``ms_per_pair`` + conditions), ``RERANK_TIMING_FALLBACK`` if unknown."""
        if scores.dtype != np.float32 or scores.shape != (len(questions), len(texts)):
            raise ValueError("rerank scores do not match their questions and texts")
        self._model_id = model_id
        self.regime = dict(regime or {})
        self.timing = dict(timing or RERANK_TIMING_FALLBACK)
        self.ms_per_pair = float(self.timing["ms_per_pair"])
        if not 0 < self.ms_per_pair < float("inf"):  # NaN too: fail at load, not in every run
            raise ValueError("rerank timing ms_per_pair invalid")
        self.questions, self.texts, self.scores = list(questions), list(texts), scores
        self._rows = {k: i for i, k in enumerate(self.questions)}
        self._cols = {k: i for i, k in enumerate(self.texts)}

    @property
    def model_id(self) -> str:
        return self._model_id

    def get(self, question: str, text: str) -> float | None:
        row, col = self._rows.get(question_key(question)), self._cols.get(text_key(text))
        if row is None or col is None or np.isnan(self.scores[row, col]):
            return None
        return float(self.scores[row, col])

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        scores: list[float] = []
        for text in texts:
            value = self.get(query, text)
            if value is None:  # the message names no question: hidden ones must stay hidden
                raise RerankScoreMissingError("rerank pair not in the precomputed table")
            scores.append(value)
        return scores


class IndexStore:
    """All built variants in RAM. Views per ``IndexHandle`` filter the level corpus (E7) and
    ``only_in_force`` (E6), so every retriever on a handle sees the same rows."""

    # ponytail: whole index in RAM (~12 MB with per-variant copies of the shared passage rows),
    # file artifacts; pgvector past ~100k chunks. Handle views hold row indices, not vectors.

    def __init__(
        self,
        documents: Mapping[str, Document],
        chunks: Mapping[str, tuple[Chunk, ...]],
        vectors: Mapping[str, Vectors],
        query_rows: Mapping[str, int],
        query_vectors: Vectors,
        manifest: dict[str, object],
        rerank: RerankTable | None = None,
    ) -> None:
        self._documents = dict(documents)
        self._chunks = dict(chunks)
        self._vectors = dict(vectors)
        self._query_rows = dict(query_rows)
        self._query_vectors = query_vectors
        self.manifest = manifest
        self.rerank = rerank  # None: not built (graphs with rerank answer rerank_unavailable)
        self._views: dict[IndexHandle, tuple[tuple[Chunk, ...], list[int]]] = {}
        self._bm25: dict[IndexHandle, Any] = {}  # insertion order = least recently used first

    @classmethod
    def build(
        cls,
        documents: Mapping[str, Document],
        embedder: Embedder,
        questions: Sequence[str],
        variants: Sequence[IndexVariant] = ALL_VARIANTS,
        *,
        reuse: "IndexStore | None" = None,
    ) -> "IndexStore":
        """``reuse``: an earlier index whose vectors are kept for texts it already embedded with
        the same model (a question edit then embeds one question, not ~950 passages)."""
        chunks = {
            v.key: tuple(
                c for doc_id in sorted(documents) for c in chunk_document(documents[doc_id], v)
            )
            for v in variants
        }
        # Identical dense texts across variants (e.g. theo_dieu with every overlap) embed once.
        texts = {
            key: [embed_text(documents[c.doc_id], c) for c in variant_chunks]
            for key, variant_chunks in chunks.items()
        }
        unique = list(dict.fromkeys(t for variant_texts in texts.values() for t in variant_texts))
        known, known_q = reuse.embedded(embedder.model_id) if reuse else ({}, {})
        if missing := [t for t in unique if t not in known]:
            fresh = normalise_rows(embedder.embed_passages(missing))
            known.update(zip(missing, fresh, strict=True))
        passage = np.stack([known[t] for t in unique])
        row_of = {t: i for i, t in enumerate(unique)}
        vectors = {key: passage[[row_of[t] for t in ts]] for key, ts in texts.items()}
        ordered = list(dict.fromkeys(unicodedata.normalize("NFC", q) for q in questions))
        query_rows = {question_key(q): i for i, q in enumerate(ordered)}
        if missing_q := [q for q in ordered if question_key(q) not in known_q]:
            fresh_q = normalise_rows(embedder.embed_queries(missing_q))
            known_q.update(zip(map(question_key, missing_q), fresh_q, strict=True))
        query_vectors = np.stack([known_q[question_key(q)] for q in ordered])
        manifest: dict[str, object] = {
            "format": FORMAT,
            "embed_model": embedder.model_id,
            "fastembed_version": _package_version("fastembed"),
            "dim": int(passage.shape[1]),
            "tokenizer_id": TOKENIZER_ID,
            "corpus_sha256": _corpus_sha256(documents),
            "built_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "variants": [v.key for v in variants],
        }
        return cls(documents, chunks, vectors, query_rows, query_vectors, manifest)

    def save(self, index_dir: Path) -> None:
        index_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = index_dir / "manifest.json"
        # The manifest goes last: a crash mid-save leaves no manifest, so load() refuses.
        # ponytail: no atomic directory swap; write to a temp dir + rename if builds overlap.
        manifest_path.unlink(missing_ok=True)
        docs = [asdict(self._documents[d]) for d in sorted(self._documents)]
        _write_json(index_dir / "documents.json", docs)
        rows: dict[str, Vectors] = {}  # text_key(dense text) -> its row, first seen first
        for key, chunks in self._chunks.items():
            _write_json(index_dir / f"{key}.json", [asdict(c) for c in chunks])
            for chunk, row in zip(chunks, self._vectors[key], strict=True):
                rows.setdefault(text_key(embed_text(self._documents[chunk.doc_id], chunk)), row)
        _write_json(index_dir / "passages.json", list(rows))
        passages = np.array(list(rows.values()), dtype=np.float32)
        np.save(index_dir / "passages.npy", passages, allow_pickle=False)
        _write_json(index_dir / "queries.json", self._query_rows)
        np.save(index_dir / "queries.npy", self._query_vectors, allow_pickle=False)
        if self.rerank is None:
            (index_dir / "rerank.json").unlink(missing_ok=True)
            (index_dir / "rerank.npy").unlink(missing_ok=True)
        else:
            table = self.rerank
            meta = {
                "model": table.model_id,
                "regime": table.regime,
                "timing": table.timing,
                "questions": table.questions,
                "texts": table.texts,
            }
            _write_json(index_dir / "rerank.json", meta)
            np.save(index_dir / "rerank.npy", table.scores, allow_pickle=False)
        _write_json(manifest_path, self.manifest)

    @classmethod
    def load(cls, index_dir: Path) -> "IndexStore":
        try:
            manifest = json.loads((index_dir / "manifest.json").read_text(encoding="utf-8"))
            if manifest.get("format") != FORMAT:
                raise ValueError(f"index format {manifest.get('format')!r}, expected {FORMAT}")
            if manifest.get("tokenizer_id") != TOKENIZER_ID:
                raise ValueError("index built with another tokenizer")
            documents = {
                d["doc_id"]: _document_from_json(d)
                for d in json.loads((index_dir / "documents.json").read_text(encoding="utf-8"))
            }
            keys = json.loads((index_dir / "passages.json").read_text(encoding="utf-8"))
            passages = np.load(index_dir / "passages.npy", allow_pickle=False)
            if passages.dtype != np.float32 or passages.ndim != 2 or len(passages) != len(keys):
                raise ValueError("passage vectors do not match their keys")
            row_of = {k: i for i, k in enumerate(keys)}
            chunks: dict[str, tuple[Chunk, ...]] = {}
            vectors: dict[str, Vectors] = {}
            for key in manifest["variants"]:
                if key not in _VARIANTS_BY_KEY:
                    raise ValueError(f"unknown variant {key!r}")
                raw = json.loads((index_dir / f"{key}.json").read_text(encoding="utf-8"))
                chunks[key] = tuple(_chunk_from_json(c) for c in raw)
                # KeyError: a chunk whose dense text has no stored vector.
                rows = [row_of[text_key(embed_text(documents[c.doc_id], c))] for c in chunks[key]]
                vectors[key] = passages[rows]
            query_rows = json.loads((index_dir / "queries.json").read_text(encoding="utf-8"))
            query_vectors = np.load(index_dir / "queries.npy", allow_pickle=False)
            if query_vectors.shape[0] != len(query_rows):
                raise ValueError("query vectors do not match questions")
            rerank = None
            if (index_dir / "rerank.json").is_file():
                meta = json.loads((index_dir / "rerank.json").read_text(encoding="utf-8"))
                scores = np.load(index_dir / "rerank.npy", allow_pickle=False)
                rerank = RerankTable(
                    meta["model"],
                    meta["questions"],
                    meta["texts"],
                    scores,
                    meta.get("regime"),
                    meta.get("timing"),
                )
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise IndexNotBuiltError(f"index at {index_dir} missing or invalid: {exc}") from exc
        return cls(documents, chunks, vectors, query_rows, query_vectors, manifest, rerank)

    def embedded(self, model_id: str) -> tuple[dict[str, Vectors], dict[str, Vectors]]:
        """(dense text -> passage row, question key -> query row) if this index was built with
        ``model_id`` and the installed fastembed; empty otherwise (rebuilds then embed all)."""
        manifest = self.manifest
        if (manifest.get("embed_model"), manifest.get("fastembed_version")) != (
            model_id,
            _package_version("fastembed"),
        ):
            return {}, {}
        passages = {
            embed_text(self._documents[c.doc_id], c): self._vectors[key][i]
            for key, chunks in self._chunks.items()
            for i, c in enumerate(chunks)
        }
        queries = {k: self._query_vectors[row] for k, row in self._query_rows.items()}
        return passages, queries

    def check_fresh(
        self,
        documents: Mapping[str, Document],
        questions: Sequence[str],
        rerank: RerankQuestions | None = None,
    ) -> None:
        """Raises IndexStaleError when the corpus or a golden question changed since the build
        (chunk offsets and question vectors would no longer match), or when the rerank table
        lacks a pair a legal graph can rerank (``rerank_questions``)."""
        if self.manifest.get("corpus_sha256") != _corpus_sha256(documents):
            raise IndexStaleError("corpus changed since the index build")
        missing = sum(question_key(q) not in self._query_rows for q in questions)
        if missing:
            raise IndexStaleError(f"{missing} golden questions not in the index")
        if rerank:
            table = self.rerank
            if table is None:
                raise IndexStaleError("rerank table not built")
            pairs = required_rerank_pairs(self, rerank)
            if missing := sum(table.get(q, t) is None for q, t in pairs):
                raise IndexStaleError(f"{missing} rerank pairs missing from the table")

    def document(self, doc_id: str) -> Document:
        return self._documents[doc_id]

    def _view(self, handle: IndexHandle) -> tuple[tuple[Chunk, ...], list[int]]:
        """The handle's chunks and their rows in the variant matrix (no vector copy kept: all
        96 handles held ~30 MB of copies, never freed)."""
        view = self._views.get(handle)
        if view is None:
            key = handle.variant.key
            if key not in self._chunks:
                raise IndexNotBuiltError(f"variant {key} not built")
            rows = [
                i
                for i, c in enumerate(self._chunks[key])
                if c.doc_id in handle.docs and (c.hieu_luc or not handle.only_in_force)
            ]
            view = tuple(self._chunks[key][i] for i in rows), rows
            self._views[handle] = view
        return view

    def chunks(self, handle: IndexHandle) -> tuple[Chunk, ...]:
        return self._view(handle)[0]

    def vectors(self, handle: IndexHandle) -> Vectors:
        """A fresh copy of the handle's rows (<= ~1.4 MB, freed after the search)."""
        vectors: Vectors = self._vectors[handle.variant.key][self._view(handle)[1]]
        return vectors

    def bm25(self, handle: IndexHandle) -> BM25Okapi:
        """Okapi BM25 over ``bm25_text`` of the handle's chunks (needs >= 1 chunk)."""
        model = self._bm25.pop(handle, None)
        if model is None:
            from vgame.engine.retrieval import bm25_tokens  # retrieval imports this module

            chunks = self.chunks(handle)
            model = BM25Okapi([bm25_tokens(bm25_text(self.document(c.doc_id), c)) for c in chunks])
        self._bm25[handle] = model  # most recently used last
        if len(self._bm25) > BM25_CACHE_SIZE:
            del self._bm25[next(iter(self._bm25))]
        return model

    def query_vector(self, question: str) -> Vectors:
        row = self._query_rows.get(question_key(question))
        if row is None:
            raise IndexNotBuiltError("question not precomputed; rerun vgame-build-index")
        vector: Vectors = self._query_vectors[row]
        return vector


def _write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def golden_questions(content_dir: Path) -> list[str]:
    """Every case question of the three Library golden files (review cases included, E14)."""
    questions: list[str] = []
    for path in sorted((content_dir / "golden").glob("library-l[0-9]*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        questions.extend(case["question"] for case in data["cases"])
    return questions


def rerank_questions(content_dir: Path) -> dict[str, frozenset[str]]:
    """Every question a run can rerank: the public cases (review cases never run) of each level
    whose ``allowed_blocks`` has ``rerank``, mapped to that level's corpus (E7)."""
    from vgame.engine.grading import load_grading_spec, public_cases  # grading imports this

    questions: dict[str, frozenset[str]] = {}
    for path in sorted((content_dir / "golden").glob("library-l[0-9]*.json")):
        level = load_level(json.loads(path.read_text(encoding="utf-8"))["level_id"])
        if "rerank" not in level.allowed_blocks:
            continue
        for case in public_cases(load_grading_spec(content_dir, level.id)):
            question = unicodedata.normalize("NFC", case.question)
            questions[question] = questions.get(question, frozenset()) | frozenset(level.corpus)
    return questions


def required_rerank_pairs(store: IndexStore, rerank: RerankQuestions) -> set[tuple[str, str]]:
    """(question, bm25_text) for every chunk of every built variant inside the question's
    corpus: every pair a legal graph can rerank. The build scores these; startup checks them."""
    texts = {
        (c.doc_id, bm25_text(store.document(c.doc_id), c))
        for chunks in store._chunks.values()
        for c in chunks
    }
    return {(q, text) for q, docs in rerank.items() for doc_id, text in texts if doc_id in docs}


def build_rerank_table(
    store: IndexStore,
    reranker: Reranker,
    rerank: RerankQuestions,
    *,
    reuse: RerankTable | None = None,
    log: Callable[[str], None] = print,
) -> RerankTable:
    """Scores every required pair once, keeping ``reuse`` scores of the same model and
    ``rerank_regime`` (a question edit then scores ~870 pairs, not ~11k). Scores do not depend
    on the batch (measured), so each question's texts go shortest first: less padding. The
    time spent scoring becomes the table's ``timing``; nothing scored keeps ``reuse``'s."""
    by_question: dict[str, set[str]] = {}
    for question, text in required_rerank_pairs(store, rerank):
        by_question.setdefault(question, set()).add(text)
    regime = rerank_regime()
    same = reuse is not None and (reuse.model_id, reuse.regime) == (reranker.model_id, regime)
    old = reuse if same else None
    questions = sorted({question_key(q) for q in by_question})
    texts = sorted({text_key(t) for ts in by_question.values() for t in ts})
    rows, cols = {k: i for i, k in enumerate(questions)}, {k: i for i, k in enumerate(texts)}
    scores = np.full((len(questions), len(texts)), np.nan, dtype=np.float32)
    scored, scoring_s = 0, 0.0
    for n, question in enumerate(sorted(by_question), 1):
        started = time.perf_counter()
        known: dict[str, float] = {}
        for text in by_question[question]:
            if old is not None and (value := old.get(question, text)) is not None:
                known[text] = value
        missing = sorted(by_question[question] - known.keys(), key=lambda t: (len(t), t))
        if missing:
            known.update(zip(missing, reranker.score(question, missing), strict=True))
        row = rows[question_key(question)]
        for text, value in known.items():
            scores[row, cols[text_key(text)]] = value
        took = time.perf_counter() - started
        if missing:
            scored, scoring_s = scored + len(missing), scoring_s + took
        log(f"rerank {n}/{len(by_question)}: {len(known)} pairs, {len(missing)} new, {took:.0f} s")
    # ponytail: one mean per table, from whatever load the build machine had; a few new pairs
    # (a corpus edit) give a noisy mean. Re-time on an idle machine if the L3 numbers look off.
    timing = old.timing if old is not None else None
    if scored:
        timing = {
            "ms_per_pair": scoring_s * 1000 / scored,  # unrounded: a fake model's ~0 must load
            "pairs": scored,
            "cpu": platform.processor() or platform.machine(),
            "measured": datetime.now(UTC).date().isoformat(),
        }
    return RerankTable(reranker.model_id, questions, texts, scores, regime, timing)


def main(
    argv: Sequence[str] | None = None,
    *,
    settings: Settings | None = None,
    embedder: Embedder | None = None,
    reranker: Reranker | None = None,
) -> int:
    """``vgame-build-index``: every variant, the question vectors and the rerank table into
    INDEX_DIR (default: the shipped ``engine/data/index``, committed with the code). Needs the
    ``models`` dependency group; model files go to ENGINE_CACHE_DIR/models.

    ``settings``/``embedder``/``reranker`` are for tests only: injected models skip every
    download."""
    parser = argparse.ArgumentParser(
        prog="vgame-build-index",
        description="Precompute the Library index variants, question vectors and rerank scores.",
    )
    parser.add_argument(
        "--variant",
        action="append",
        choices=sorted(_VARIANTS_BY_KEY),
        help="add this variant to the index in INDEX_DIR (repeatable); default: all 24",
    )
    args = parser.parse_args(argv)
    settings = settings or Settings()
    models_dir = settings.engine_cache_dir / "models"
    index_dir = settings.index_dir

    documents = load_documents(settings.content_dir)
    questions = golden_questions(settings.content_dir)
    if not documents or not questions:
        print(f"No corpus or golden questions under {settings.content_dir}", file=sys.stderr)
        return 1
    if embedder is None or reranker is None:
        try:
            import fastembed  # noqa: F401  # the "models" group; Render installs without it
        except ImportError:
            print(MODELS_MISSING_VI, file=sys.stderr)
            return 1
        from vgame.engine.retrieval import FastEmbedder, FastReranker

        models_dir.mkdir(parents=True, exist_ok=True)
        print(f"Loading {settings.embed_model} and {settings.rerank_model} into {models_dir}")
        embedder = embedder or FastEmbedder(settings.embed_model, models_dir)
        reranker = reranker or FastReranker(
            settings.rerank_model, models_dir, local_files_only=False
        )

    try:  # vectors and scores already on disk are reused: only new texts and pairs are computed
        reuse: IndexStore | None = IndexStore.load(index_dir)
    except IndexNotBuiltError:
        reuse = None
    variants = list(ALL_VARIANTS)
    if args.variant:  # added, never a subset: INDEX_DIR defaults to the shipped index
        keys = set(args.variant) | set(reuse._chunks if reuse else ())
        variants = [v for v in ALL_VARIANTS if v.key in keys]
    started = time.perf_counter()
    store = IndexStore.build(documents, embedder, questions, variants, reuse=reuse)
    print(f"embeddings: {time.perf_counter() - started:.0f} s")
    started = time.perf_counter()
    store.rerank = build_rerank_table(
        store,
        reranker,
        rerank_questions(settings.content_dir),
        reuse=reuse.rerank if reuse else None,
    )
    print(f"rerank table: {time.perf_counter() - started:.0f} s")
    store.save(index_dir)
    for variant in variants:
        chunks = store._chunks[variant.key]
        avg = round(sum(c.tokens for c in chunks) / len(chunks)) if chunks else 0
        print(f"{variant.key:<18} {len(chunks):>4} chunks  avg {avg:>4} tokens")
    sizes = {p.name: p.stat().st_size for p in sorted(index_dir.glob("*")) if p.is_file()}
    for name in ("passages.npy", "queries.npy", "rerank.npy"):
        print(f"{name:<18} {sizes.get(name, 0) / 1e6:6.2f} MB")
    print(
        f"{len(store._query_rows)} questions; index written to {index_dir} "
        f"({sum(sizes.values()) / 1e6:.2f} MB in {len(sizes)} files)"
    )
    return 0
