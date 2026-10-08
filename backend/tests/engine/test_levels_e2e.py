"""End-to-end over the shipped level files: validator -> compiler -> runtime -> evaluator.

Offline doubles, or the shipped index: e5 vectors and the jina rerank table that
``vgame-build-index`` computed with the real models (no model loaded, no Gemini call: Oracle).
"""

import asyncio
import json
from importlib import resources
from typing import Any

import pytest

from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_oracle import (
    LEVEL_IDS,
    OracleReranker,
    hashing_store,
    oracle_llm,
    oracle_store,
    spec,
)
from tests.engine.fakes_retrieval import OverlapReranker
from vgame.config import SHIPPED_INDEX_DIR
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.grading import LevelEvaluator, public_cases
from vgame.engine.graph import GraphPayload
from vgame.engine.index import IndexStore
from vgame.engine.levels import Expectation, LevelSpec, load_level
from vgame.engine.runtime import run_level
from vgame.engine.types import EngineEvent, LLMClient, Reranker
from vgame.engine.validator import validate

LEVELS = [load_level(level_id) for level_id in LEVEL_IDS]
# Template keys of engine-v0.2.md §10; each level copies only its own §11 lines.
DIAGNOSIS_KEYS = {
    "ret.gold_missing",
    "ret.gold_rank:vector_search",
    "ret.gold_rank:bm25_search",
    "ret.gold_rank:fusion",
    "ret.boundary_split",
    "ctx.gold_dropped",
    "ret.stale_doc",
    "llm.cite_missing",
    "llm.cite_unknown",
    "trap.failed",
    "regression",
    "budget.exceeded",
    "budget.exceeded:no_rerank",  # L3: the line for a graph without rerank
}


def run_graph(
    level: LevelSpec,
    graph: GraphPayload,
    store: IndexStore,
    reranker: Reranker,
    llm: LLMClient | None = None,
) -> list[EngineEvent]:
    validated, issues = validate(graph.model_dump_json(by_alias=True).encode(), level)
    assert validated is not None, issues
    deps = EngineDeps(store, llm or oracle_llm(), reranker, RunBudget())
    events: list[EngineEvent] = []
    cases = public_cases(spec(level.id))
    evaluator = LevelEvaluator(spec(level.id), level.rules, store)
    compiled = compile_graph(validated, level, deps)
    asyncio.run(run_level("e2e", compiled, cases, deps, evaluator, events.append))
    assert events[-1]["type"] == "run.finished", events[-1]
    return events


def flagged(flag: str, events: list[EngineEvent]) -> set[str]:
    """Cases showing ``flag`` (engine-v0.2.md §9.1 ``expect.flag``); "run" for run-level."""
    out: set[str] = set()
    for e in events:
        if e["type"] == "case.graded":
            if flag in e["labels"] or (flag == "fail" and not e["passed"]):
                out.add(e["case"])
        elif e["type"] == "step.finished" and flag == "pack.dropped":
            if any(f["kind"] == "pack" and f["dropped"] for f in e["facts"]):
                out.add(e["case"])
        elif e["type"] == "run.scored" and flag == "budget.exceeded":
            if e["score"]["tokens"] > e["score"]["budget"]:
                out.add("run")
        elif e["type"] == "run.finished":
            out |= {c for c, g in e["report"]["gold"].items() if flag in g["flags"]}
    return out


def assert_expectation(expect: Expectation, events: list[EngineEvent]) -> None:
    got = flagged(expect.flag, events)
    if expect.cases is None:
        assert got, f"{expect.flag} on no case"
    else:
        assert set(expect.cases) <= got, f"{expect.flag}: missing on {set(expect.cases) - got}"


def expectations(*, real: bool) -> list[Any]:
    return [
        pytest.param(level, naive.graph, naive.expect, id=f"{level.id}-{naive.id}")
        for level in LEVELS
        for naive in level.naive_graphs
        if any(x.mechanism == "T" and x.needs_real_models == real for x in naive.expect)
    ]


# --- Level files ---------------------------------------------------------------------------


def test_every_level_file_is_shipped_and_loads() -> None:
    folder = resources.files("vgame.engine").joinpath("levels")
    names = sorted(f.name for f in folder.iterdir() if f.name.endswith(".json"))
    assert names == sorted(f"{level_id}.json" for level_id in LEVEL_IDS)


@pytest.mark.parametrize("level", LEVELS, ids=LEVEL_IDS)
def test_level_matches_its_golden_file(level: LevelSpec) -> None:
    golden = spec(level.id)
    assert tuple(level.corpus) == golden.corpus
    case_ids = {c.id for c in golden.cases}
    assert set(level.rules["s1_required"]) <= case_ids
    assert set(level.rules["info_cases"]) <= case_ids
    for naive in level.naive_graphs:
        for x in naive.expect:
            assert set(x.cases or ()) <= case_ids, (naive.id, x)
    assert set(level.rules["diagnosis"]) <= DIAGNOSIS_KEYS
    assert "budget.exceeded" in level.rules["diagnosis"]
    assert len(level.stars_vi) == 3


@pytest.mark.parametrize("level", LEVELS, ids=LEVEL_IDS)
def test_public_level_hides_solutions_and_gold(level: LevelSpec) -> None:
    golden = spec(level.id)
    text = json.dumps(level.public(public_cases(golden)), ensure_ascii=False)
    for secret in ("reference_graph", "naive_graphs", "diagnosis", "info_cases", "expect"):
        assert secret not in text
    for case in golden.cases:
        if case.role != "visible":
            assert case.question not in text
        for quote in case.gold:
            assert quote.quote not in text


# --- Runs ----------------------------------------------------------------------------------


@pytest.mark.parametrize("level", LEVELS, ids=LEVEL_IDS)
def test_reference_graph_earns_three_stars_with_perfect_models(level: LevelSpec) -> None:
    events = run_graph(level, level.reference_graph, oracle_store(), OracleReranker())
    score = next(e for e in events if e["type"] == "run.scored")["score"]
    assert score["stars"] == 3, score
    report = events[-1]
    assert report["type"] == "run.finished"
    assert report["report"]["diagnosis"] == []


@pytest.mark.parametrize(("level", "graph", "expect"), expectations(real=False))
def test_naive_graph_produces_its_deterministic_flags(
    level: LevelSpec, graph: GraphPayload, expect: list[Expectation]
) -> None:
    events = run_graph(level, graph, hashing_store(), OverlapReranker())
    for x in expect:
        if x.mechanism == "T" and not x.needs_real_models:
            assert_expectation(x, events)


def test_gold_appears_only_in_run_finished() -> None:
    level = LEVELS[0]
    events = run_graph(level, level.reference_graph, oracle_store(), OracleReranker())
    quotes = [q.quote for c in spec(level.id).cases for q in c.gold]
    finished = events[-1]
    assert finished["type"] == "run.finished"
    gold_ids = {cid for g in finished["report"]["gold"].values() for cid in g["gold_chunks"]}
    for e in events[:-1]:
        assert "gold" not in e
        text = json.dumps(e, ensure_ascii=False)
        assert not any(q in text for q in quotes)
        if e["type"] == "case.graded":
            assert not any(cid in text for cid in gold_ids)


# --- Real models, precomputed: the shipped index (what the server runs) ----------------------


@pytest.fixture(scope="module")
def real_models() -> tuple[IndexStore, Reranker]:
    store = IndexStore.load(SHIPPED_INDEX_DIR)
    assert store.rerank is not None
    return store, store.rerank


@pytest.mark.parametrize("level", LEVELS, ids=LEVEL_IDS)
def test_reference_graph_earns_three_stars_with_real_models(
    level: LevelSpec, real_models: tuple[IndexStore, Reranker]
) -> None:
    events = run_graph(level, level.reference_graph, *real_models)
    score = next(e for e in events if e["type"] == "run.scored")["score"]
    assert score["stars"] == 3, (score, events[-1])


@pytest.mark.parametrize(("level", "graph", "expect"), expectations(real=True))
def test_naive_graph_produces_its_model_dependent_flags(
    level: LevelSpec,
    graph: GraphPayload,
    expect: list[Expectation],
    real_models: tuple[IndexStore, Reranker],
) -> None:
    events = run_graph(level, graph, *real_models)
    for x in expect:
        if x.mechanism == "T" and x.needs_real_models:
            assert_expectation(x, events)


def every_graph() -> list[Any]:
    return [
        pytest.param(level, graph, id=f"{level.id}-{name}")
        for level in LEVELS
        for name, graph in (
            ("reference", level.reference_graph),
            *((naive.id, naive.graph) for naive in level.naive_graphs),
        )
    ]


@pytest.mark.parametrize(("level", "graph"), every_graph())
def test_no_diagnosis_shows_an_unfilled_placeholder(
    level: LevelSpec, graph: GraphPayload, real_models: tuple[IndexStore, Reranker]
) -> None:
    # L3 N6 (no rerank node) showed "Kính lúp đưa nó lên {r_rr}, mất {ms} ms." to players.
    # An answer that cites nothing fails every case, so every case gets its diagnosis line.
    report = run_graph(level, graph, *real_models, FakeLLM("Tôi chưa rõ."))[-1]
    assert report["type"] == "run.finished"
    messages = [d["message_vi"] for d in report["report"]["diagnosis"]]
    assert not [m for m in messages if "{" in m or "}" in m]
