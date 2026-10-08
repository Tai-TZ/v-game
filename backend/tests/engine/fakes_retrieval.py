"""Deterministic, offline retrieval doubles shared by every builder's tests (§5.4)."""

import hashlib
from collections.abc import Sequence

import numpy as np

from vgame.engine.index import normalise_rows
from vgame.engine.retrieval import bm25_tokens
from vgame.engine.types import Vectors

DIM = 256


class HashingEmbedder:
    """Bag of hashed ``\\w+`` tokens, 256 dims, L2-normalised. No network, no model."""

    model_id = "test/hashing-256"

    def _embed(self, texts: Sequence[str]) -> Vectors:
        rows = np.zeros((len(texts), DIM), dtype=np.float32)
        for i, text in enumerate(texts):
            for token in bm25_tokens(text):
                bucket = int.from_bytes(hashlib.blake2b(token.encode(), digest_size=4).digest())
                rows[i, bucket % DIM] += 1.0
        return normalise_rows(rows)

    def embed_passages(self, texts: Sequence[str]) -> Vectors:
        return self._embed(texts)

    def embed_queries(self, texts: Sequence[str]) -> Vectors:
        return self._embed(texts)


class OverlapReranker:
    """Score = number of distinct tokens shared with the question (digits included)."""

    model_id = "test/overlap"

    def __init__(self) -> None:
        self.calls = 0

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        self.calls += 1
        words = set(bm25_tokens(query))
        return [float(len(words & set(bm25_tokens(t)))) for t in texts]
