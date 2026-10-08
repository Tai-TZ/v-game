"""Precomputed index variants: chunks, passage vectors, question vectors (engine-v0.2.md §5.3).

Artifacts in ``<index_dir>``: ``manifest.json``, ``documents.json``, ``<variant.key>.json`` (chunks)
+ ``<variant.key>.npy`` (float32, L2-normalised rows), ``queries.json`` (sha256 of the NFC
question -> row) + ``queries.npy``. No pickle anywhere.
"""

import argparse
import hashlib
import json
import sys
import unicodedata
from collections.abc import Mapping, Sequence
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
from vgame.engine.types import Chunk, Embedder, EngineError, IndexHandle, Vectors

_VARIANTS_BY_KEY = {v.key: v for v in ALL_VARIANTS}


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


def question_key(question: str) -> str:
    return hashlib.sha256(unicodedata.normalize("NFC", question).encode()).hexdigest()


def _corpus_sha256(documents: Mapping[str, Document]) -> str:
    digest = hashlib.sha256()
    for doc_id in sorted(documents):
        digest.update(f"{doc_id}|{documents[doc_id].in_force}|{documents[doc_id].text}\0".encode())
    return digest.hexdigest()


def _fastembed_version() -> str:
    try:
        return version("fastembed")
    except PackageNotFoundError:  # pragma: no cover - fastembed is a pinned dependency
        return "unknown"


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


class IndexStore:
    """All built variants in RAM. Views per ``IndexHandle`` filter the level corpus (E7) and
    ``only_in_force`` (E6), so every retriever on a handle sees the same rows."""

    # ponytail: whole index in RAM (a few MB), file artifacts; pgvector past ~100k chunks.

    def __init__(
        self,
        documents: Mapping[str, Document],
        chunks: Mapping[str, tuple[Chunk, ...]],
        vectors: Mapping[str, Vectors],
        query_rows: Mapping[str, int],
        query_vectors: Vectors,
        manifest: dict[str, object],
    ) -> None:
        self._documents = dict(documents)
        self._chunks = dict(chunks)
        self._vectors = dict(vectors)
        self._query_rows = dict(query_rows)
        self._query_vectors = query_vectors
        self.manifest = manifest
        self._views: dict[IndexHandle, tuple[tuple[Chunk, ...], Vectors]] = {}
        self._bm25: dict[IndexHandle, Any] = {}

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
            "embed_model": embedder.model_id,
            "fastembed_version": _fastembed_version(),
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
        for key, chunks in self._chunks.items():
            _write_json(index_dir / f"{key}.json", [asdict(c) for c in chunks])
            np.save(index_dir / f"{key}.npy", self._vectors[key], allow_pickle=False)
        _write_json(index_dir / "queries.json", self._query_rows)
        np.save(index_dir / "queries.npy", self._query_vectors, allow_pickle=False)
        _write_json(manifest_path, self.manifest)

    @classmethod
    def load(cls, index_dir: Path) -> "IndexStore":
        try:
            manifest = json.loads((index_dir / "manifest.json").read_text(encoding="utf-8"))
            if manifest.get("tokenizer_id") != TOKENIZER_ID:
                raise ValueError("index built with another tokenizer")
            documents = {
                d["doc_id"]: _document_from_json(d)
                for d in json.loads((index_dir / "documents.json").read_text(encoding="utf-8"))
            }
            chunks: dict[str, tuple[Chunk, ...]] = {}
            vectors: dict[str, Vectors] = {}
            for key in manifest["variants"]:
                if key not in _VARIANTS_BY_KEY:
                    raise ValueError(f"unknown variant {key!r}")
                raw = json.loads((index_dir / f"{key}.json").read_text(encoding="utf-8"))
                chunks[key] = tuple(_chunk_from_json(c) for c in raw)
                vectors[key] = np.load(index_dir / f"{key}.npy", allow_pickle=False)
                if vectors[key].dtype != np.float32 or vectors[key].shape[0] != len(chunks[key]):
                    raise ValueError(f"{key}: vectors do not match chunks")
            query_rows = json.loads((index_dir / "queries.json").read_text(encoding="utf-8"))
            query_vectors = np.load(index_dir / "queries.npy", allow_pickle=False)
            if query_vectors.shape[0] != len(query_rows):
                raise ValueError("query vectors do not match questions")
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise IndexNotBuiltError(f"index at {index_dir} missing or invalid: {exc}") from exc
        return cls(documents, chunks, vectors, query_rows, query_vectors, manifest)

    def embedded(self, model_id: str) -> tuple[dict[str, Vectors], dict[str, Vectors]]:
        """(dense text -> passage row, question key -> query row) if this index was built with
        ``model_id`` and the installed fastembed; empty otherwise (rebuilds then embed all)."""
        manifest = self.manifest
        if (manifest.get("embed_model"), manifest.get("fastembed_version")) != (
            model_id,
            _fastembed_version(),
        ):
            return {}, {}
        passages = {
            embed_text(self._documents[c.doc_id], c): self._vectors[key][i]
            for key, chunks in self._chunks.items()
            for i, c in enumerate(chunks)
        }
        queries = {k: self._query_vectors[row] for k, row in self._query_rows.items()}
        return passages, queries

    def check_fresh(self, documents: Mapping[str, Document], questions: Sequence[str]) -> None:
        """Raises IndexStaleError when the corpus or a golden question changed since the build:
        chunk offsets (gold mapping) and precomputed question vectors would no longer match."""
        if self.manifest.get("corpus_sha256") != _corpus_sha256(documents):
            raise IndexStaleError("corpus changed since the index build")
        missing = sum(question_key(q) not in self._query_rows for q in questions)
        if missing:
            raise IndexStaleError(f"{missing} golden questions not in the index")

    def document(self, doc_id: str) -> Document:
        return self._documents[doc_id]

    def _view(self, handle: IndexHandle) -> tuple[tuple[Chunk, ...], Vectors]:
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
            view = tuple(self._chunks[key][i] for i in rows), self._vectors[key][rows]
            self._views[handle] = view
        return view

    def chunks(self, handle: IndexHandle) -> tuple[Chunk, ...]:
        return self._view(handle)[0]

    def vectors(self, handle: IndexHandle) -> Vectors:
        return self._view(handle)[1]

    def bm25(self, handle: IndexHandle) -> BM25Okapi:
        """Okapi BM25 over ``bm25_text`` of the handle's chunks (needs >= 1 chunk)."""
        model = self._bm25.get(handle)
        if model is None:
            from vgame.engine.retrieval import bm25_tokens  # retrieval imports this module

            chunks = self.chunks(handle)
            model = BM25Okapi([bm25_tokens(bm25_text(self.document(c.doc_id), c)) for c in chunks])
            self._bm25[handle] = model
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


def main(
    argv: Sequence[str] | None = None,
    *,
    settings: Settings | None = None,
    embedder: Embedder | None = None,
) -> int:
    """``vgame-build-index``: build every variant into ENGINE_CACHE_DIR/index.

    ``settings``/``embedder`` are for tests only: an injected embedder skips every model
    download (including the reranker's)."""
    parser = argparse.ArgumentParser(
        prog="vgame-build-index",
        description="Download the retrieval models and precompute the Library index variants.",
    )
    parser.add_argument(
        "--variant",
        action="append",
        choices=sorted(_VARIANTS_BY_KEY),
        help="build only this variant (repeatable); default: all 24",
    )
    args = parser.parse_args(argv)
    settings = settings or Settings()
    models_dir = settings.engine_cache_dir / "models"
    index_dir = settings.engine_cache_dir / "index"

    documents = load_documents(settings.content_dir)
    questions = golden_questions(settings.content_dir)
    if not documents or not questions:
        print(f"No corpus or golden questions under {settings.content_dir}", file=sys.stderr)
        return 1
    if embedder is None:
        from vgame.engine.retrieval import FastEmbedder, FastReranker

        models_dir.mkdir(parents=True, exist_ok=True)
        print(f"Loading {settings.embed_model} and {settings.rerank_model} into {models_dir}")
        embedder = FastEmbedder(settings.embed_model, models_dir)
        FastReranker(settings.rerank_model, models_dir, local_files_only=False)  # download only

    variants = [_VARIANTS_BY_KEY[k] for k in args.variant] if args.variant else list(ALL_VARIANTS)
    try:  # vectors already on disk are reused: only new texts and questions are embedded
        reuse: IndexStore | None = IndexStore.load(index_dir)
    except IndexNotBuiltError:
        reuse = None
    store = IndexStore.build(documents, embedder, questions, variants, reuse=reuse)
    store.save(index_dir)
    for variant in variants:
        chunks = store._chunks[variant.key]
        avg = round(sum(c.tokens for c in chunks) / len(chunks)) if chunks else 0
        print(f"{variant.key:<18} {len(chunks):>4} chunks  avg {avg:>4} tokens")
    print(f"{len(store._query_rows)} questions; index written to {index_dir}")
    return 0
