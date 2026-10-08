"""Gold-aware test doubles for end-to-end runs (builder E). Like ``fakes_llm.Oracle``, these
see gold, so they live in tests only: they model "perfect" retrieval models, which lets a fast
test show that a reference graph earns 3 stars without downloading the real models."""

from collections.abc import Sequence
from functools import cache

from tests.engine.fakes_llm import Oracle, OracleCase
from tests.engine.fakes_retrieval import HashingEmbedder, OverlapReranker
from vgame.config import Settings
from vgame.engine.corpus import load_documents
from vgame.engine.grading import GradingSpec, load_grading_spec
from vgame.engine.index import IndexStore, golden_questions
from vgame.engine.types import Vectors

LEVEL_IDS = ("grounded-citation", "chunk-tuning", "article-number-lookup")
CONTENT_DIR = Settings(_env_file=None).content_dir


@cache
def spec(level_id: str) -> GradingSpec:
    return load_grading_spec(CONTENT_DIR, level_id)


@cache
def _gold_quotes() -> dict[str, tuple[str, ...]]:
    """question -> gold quotes, over the three golden files (a question may repeat, e.g.
    lib-l3-t02 reuses lib-l2-v01 with the same gold)."""
    return {
        c.question: tuple(q.quote for q in c.gold)
        for level_id in LEVEL_IDS
        for c in spec(level_id).cases
    }


def oracle_llm() -> Oracle:
    return Oracle(
        {
            c.question: OracleCase(
                c.answer_points, tuple(q.quote for q in c.gold), c.expect == "abstain"
            )
            for level_id in LEVEL_IDS
            for c in spec(level_id).cases
        }
    )


class OracleEmbedder(HashingEmbedder):
    """Embeds each golden question together with its gold quotes: dense search finds gold."""

    def embed_queries(self, texts: Sequence[str]) -> Vectors:
        gold = _gold_quotes()
        return self._embed([" ".join([t, *gold.get(t, ())]) for t in texts])


class OracleReranker(OverlapReranker):
    """Ranks chunks holding a whole gold quote first, then by token overlap."""

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        quotes = _gold_quotes().get(query, ())
        base = super().score(query, texts)
        return [1000.0 * sum(q in t for q in quotes) + b for t, b in zip(texts, base, strict=True)]


@cache
def hashing_store() -> IndexStore:
    """All 24 variants on the real corpus with the offline HashingEmbedder (~0.3 s)."""
    return IndexStore.build(
        load_documents(CONTENT_DIR), HashingEmbedder(), golden_questions(CONTENT_DIR)
    )


@cache
def oracle_store() -> IndexStore:
    return IndexStore.build(
        load_documents(CONTENT_DIR), OracleEmbedder(), golden_questions(CONTENT_DIR)
    )
