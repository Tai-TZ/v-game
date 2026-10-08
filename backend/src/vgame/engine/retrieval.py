"""Retrievers over an ``IndexHandle`` (engine-v0.2.md §5.4) and the real model adapters.

Every function is deterministic for a given index and model; ties are broken by chunk order
(vector, BM25, rerank) or ``chunk_id`` (fusion). ``top_k=None`` ranks the whole handle.
"""

import re
import unicodedata
from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np
from numpy.typing import ArrayLike

from vgame.engine.chunking import bm25_text
from vgame.engine.constants import SUMMARY_MAX_CHARS
from vgame.engine.index import IndexStore, normalise_rows
from vgame.engine.types import (
    Chunk,
    DocHit,
    DocList,
    EngineError,
    IndexHandle,
    Reranker,
    RetrievedFact,
    RetrievedItem,
    Vectors,
)

_WORD_RE = re.compile(r"\w+")


class RerankerUnavailableError(EngineError):
    message_vi = (
        "Máy chủ chưa có mô hình xếp hạng lại nên chưa chạy được khối Xếp hạng lại. "
        "Chủ máy chủ cần chạy vgame-build-index."
    )


def bm25_tokens(text: str) -> list[str]:
    """NFC, lower case, ``\\w+`` (digits kept, accents kept: E9)."""
    return _WORD_RE.findall(unicodedata.normalize("NFC", text).lower())


def _ranked(
    chunks: Sequence[Chunk], scores: ArrayLike, top_k: int | None, keep: Callable[[float], bool]
) -> list[DocHit]:
    """Stable descending order (ties keep chunk order), filtered by ``keep``, cut at top_k."""
    values = np.asarray(scores, dtype=np.float64)
    order: list[int] = np.argsort(-values, kind="stable").tolist()
    hits = [DocHit(chunks[i], float(values[i])) for i in order if keep(float(values[i]))]
    return hits if top_k is None else hits[:top_k]


def vector_search(
    store: IndexStore,
    handle: IndexHandle,
    question: str,
    *,
    top_k: int | None,
    score_threshold: float = 0.0,
) -> DocList:
    """Exact cosine KNN (rows are normalised, so cosine = dot product)."""
    chunks = store.chunks(handle)
    scores = store.vectors(handle) @ store.query_vector(question)
    hits = _ranked(chunks, scores, top_k, lambda s: s >= score_threshold)
    return DocList("vector_search", tuple(hits))


def bm25_search(
    store: IndexStore, handle: IndexHandle, question: str, *, top_k: int | None
) -> DocList:
    chunks = store.chunks(handle)
    if not chunks:
        return DocList("bm25_search", ())
    scores = store.bm25(handle).get_scores(bm25_tokens(question))
    return DocList("bm25_search", tuple(_ranked(chunks, scores, top_k, lambda s: s > 0)))


def _sorted_by_score(scores: dict[str, float], by_id: dict[str, Chunk], top_k: int) -> DocList:
    order = sorted(scores, key=lambda cid: (-scores[cid], cid))[:top_k]
    return DocList("fusion", tuple(DocHit(by_id[cid], scores[cid]) for cid in order))


def fuse_rrf(lists: Sequence[DocList], *, k: int, top_k: int) -> DocList:
    """Reciprocal rank fusion: sum of 1 / (k + rank) over every list."""
    scores: dict[str, float] = {}
    by_id: dict[str, Chunk] = {}
    for docs in lists:
        for rank, hit in enumerate(docs.hits, start=1):
            scores[hit.chunk.chunk_id] = scores.get(hit.chunk.chunk_id, 0.0) + 1.0 / (k + rank)
            by_id[hit.chunk.chunk_id] = hit.chunk
    return _sorted_by_score(scores, by_id, top_k)


def _min_max(docs: DocList) -> dict[str, float]:
    if not docs.hits:
        return {}
    values = [h.score for h in docs.hits]
    low, span = min(values), max(values) - min(values)
    return {h.chunk.chunk_id: (h.score - low) / span if span else 1.0 for h in docs.hits}


def fuse_alpha(vector: DocList, bm25: DocList, *, alpha: float, top_k: int) -> DocList:
    """alpha * minmax(vector) + (1 - alpha) * minmax(bm25); a missing side counts 0."""
    v, b = _min_max(vector), _min_max(bm25)
    by_id = {h.chunk.chunk_id: h.chunk for h in (*vector.hits, *bm25.hits)}
    scores = {cid: alpha * v.get(cid, 0.0) + (1 - alpha) * b.get(cid, 0.0) for cid in by_id}
    return _sorted_by_score(scores, by_id, top_k)


# ponytail: unbounded dict, fine for ~50 fixed questions x a few thousand chunks; LRU once
# players can type free questions. Keyed by the scored text, not the 32-bit id.
_RERANK_CACHE: dict[tuple[str, str, str], float] = {}


def rerank(
    store: IndexStore, reranker: Reranker, question: str, docs: DocList, *, top_n: int
) -> DocList:
    """Scores ``bm25_text`` (article headings + chunk text): a mid-article chunk's text lacks
    "Điều N", so scoring bare text could never rescue a number lookup (L3 N8)."""
    keys = [
        (reranker.model_id, question, bm25_text(store.document(h.chunk.doc_id), h.chunk))
        for h in docs.hits
    ]
    missing = list(dict.fromkeys(k for k in keys if k not in _RERANK_CACHE))
    if missing:
        fresh = reranker.score(question, [text for _, _, text in missing])
        _RERANK_CACHE.update(zip(missing, fresh, strict=True))
    scores = [_RERANK_CACHE[k] for k in keys]
    chunks = [h.chunk for h in docs.hits]
    return DocList("rerank", tuple(_ranked(chunks, scores, top_n, lambda _: True)))


# --- Facts and summaries (gold-free, deterministic; blocks.py may use them) ------------------


def retrieved_fact(docs: DocList) -> RetrievedFact:
    items: list[RetrievedItem] = [
        {
            "chunk_id": h.chunk.chunk_id,
            "rank": rank,
            "score": round(h.score, 4),
            "doc_id": h.chunk.doc_id,
            "dieu": h.chunk.dieu,
            "khoan": list(h.chunk.khoan),
            "hieu_luc": h.chunk.hieu_luc,
        }
        for rank, h in enumerate(docs.hits, start=1)
    ]
    return {"kind": "retrieved", "items": items}


def vi_number(value: float, decimals: int = 0) -> str:
    """Vietnamese number style: ``1.420``, ``0,83``."""
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def _with_items(head: str, items: Sequence[str]) -> str:
    """``head`` + as many ``items`` as fit in SUMMARY_MAX_CHARS, then ``…``."""
    out = head
    for i, item in enumerate(items):
        sep = ": " if i == 0 else ", "
        if len(out) + len(sep) + len(item) + 1 > SUMMARY_MAX_CHARS:
            return out + "…"
        out += sep + item
    return out


def summarize_docs(docs: DocList, *, n_in: int = 0, method: str = "rrf") -> str:
    """Step summary for vector_search, bm25_search, fusion and rerank (§6.2).

    ``n_in``: number of input lists (fusion) or input chunks (rerank)."""
    n = len(docs.hits)
    if docs.origin == "fusion":
        head = f"Gộp {n_in} danh sách ({'RRF' if method == 'rrf' else 'alpha'}) còn {n} đoạn"
        return _with_items(head, [f"Điều {h.chunk.dieu}" for h in docs.hits])
    decimals = 1 if docs.origin == "bm25_search" else 2
    items = [f"Điều {h.chunk.dieu} ({vi_number(h.score, decimals)})" for h in docs.hits]
    if docs.origin == "rerank":
        return _with_items(f"Xếp lại {n_in} đoạn, giữ {n}", items)
    return _with_items(f"Lấy {n} đoạn", items) if n else "Không lấy được đoạn nào."


# --- Real models (fastembed, CPU ONNX). Imported lazily: tests never load them. ---------------

# fastembed defaults to 256 per batch; through e5-large with 512-token chunks that held ~16 GB.
# ponytail: fixed small batch, a few GB peak; raise only with a measured RAM budget.
MODEL_BATCH_SIZE = 8
# The reranker runs in the API process, up to MAX_CONCURRENT_CASES at once per run, and ONNX's
# CPU arena keeps the peak of those concurrent runs for good: batch 8 at jina's 1024 tokens left a
# legal L3 graph at ~15 GB committed. Attention memory and time grow with batch x length^2, so
# batches are small and pairs stop at 512 tokens, e5's limit (dense search never sees more of a
# chunk either). Measured 2026-10-08, 3 concurrent: ~3.2 GB committed even for the heaviest legal
# L3 graph; rerank p50 ~2.3 s (L3 reference) / ~5.5 s (heaviest graph), engine-spike-report §3.3.
# The arena stays on: with the peak bounded, turning it off only cost ~20 % more time.
RERANK_BATCH_SIZE = 2
RERANK_MAX_TOKENS = 512


class FastEmbedder:
    """multilingual-e5 via fastembed; adds the e5 ``query: ``/``passage: `` prefixes."""

    def __init__(self, model_id: str, cache_dir: Path) -> None:
        from fastembed import TextEmbedding

        self._model_id = model_id
        self._model = TextEmbedding(model_id, cache_dir=str(cache_dir))

    @property
    def model_id(self) -> str:
        return self._model_id

    def _embed(self, texts: Sequence[str]) -> Vectors:
        vectors = self._model.embed(list(texts), batch_size=MODEL_BATCH_SIZE)
        return normalise_rows(np.asarray(list(vectors), dtype=np.float32))

    def embed_passages(self, texts: Sequence[str]) -> Vectors:
        return self._embed([f"passage: {t}" for t in texts])

    def embed_queries(self, texts: Sequence[str]) -> Vectors:
        return self._embed([f"query: {t}" for t in texts])


class FastReranker:
    """Cross-encoder via fastembed. No silent fallback (E5): a missing model is an error."""

    def __init__(self, model_id: str, cache_dir: Path, *, local_files_only: bool = True) -> None:
        from fastembed.rerank.cross_encoder import TextCrossEncoder

        self._model_id = model_id
        try:
            self._model = TextCrossEncoder(
                model_id, cache_dir=str(cache_dir), local_files_only=local_files_only
            )
            # Pairs (question, passage): longest_first trims the passage. ponytail: reaches into
            # fastembed's loaded tokenizer (pinned); the slow tests load the real model.
            tokenizer = self._model.model.tokenizer  # type: ignore[attr-defined]
            tokenizer.enable_truncation(max_length=RERANK_MAX_TOKENS)
        except Exception as exc:  # fastembed raises several types for a missing/corrupt model
            raise RerankerUnavailableError(
                f"reranker {model_id} unavailable: {type(exc).__name__}"
            ) from exc

    @property
    def model_id(self) -> str:
        return self._model_id

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        scores = self._model.rerank(query, list(texts), batch_size=RERANK_BATCH_SIZE)
        return [float(s) for s in scores]
