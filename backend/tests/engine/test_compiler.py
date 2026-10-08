import asyncio
from collections import Counter

import pytest

from tests.engine.engine_fixtures import (
    L1,
    L1_REFERENCE,
    L2,
    L2_REFERENCE,
    L3,
    L3_REFERENCE,
    Graph,
    cases,
    node,
    plus,
    small_store,
)
from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_retrieval import OverlapReranker
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import (
    RECURSION_LIMIT,
    CaseContext,
    CompiledLevelGraph,
    compile_graph,
    merge_once,
)
from vgame.engine.constants import IndexVariant
from vgame.engine.graph import GraphPayload
from vgame.engine.levels import LevelSpec
from vgame.engine.types import EngineEvent, IndexHandle, PublicCase

START, END = "__start__", "__end__"
HANDLE_2024 = IndexHandle(IndexVariant("theo_dieu", 512, 10), frozenset({"qcdt-2024"}), False)


def deps(*, store: bool = False) -> EngineDeps:
    return EngineDeps(
        small_store() if store else None, FakeLLM("Trả lời."), OverlapReranker(), RunBudget()
    )


def compiled(g: Graph, level: LevelSpec, *, store: bool = False) -> CompiledLevelGraph:
    return compile_graph(GraphPayload.model_validate(g), level, deps(store=store))


def lg_edges(
    c: CompiledLevelGraph,
) -> tuple[set[tuple[str, str]], set[tuple[tuple[str, ...], str]]]:
    return set(c.graph.builder.edges), set(c.graph.builder.waiting_edges)


def test_golden_l1_reference() -> None:
    c = compiled(L1_REFERENCE, L1)
    assert c.level_id == "grounded-citation"
    assert c.nodes == ("q", "vs", "pk", "llm", "out")
    assert lg_edges(c) == (
        {(START, "q"), ("q", "vs"), ("pk", "llm"), ("llm", "out"), ("out", END)},
        {(("q", "vs"), "pk")},
    )
    assert c.handles == {"ix": HANDLE_2024}
    assert c.retrievers == {"vs": ("vector_search", HANDLE_2024)}
    assert c.blocks == {"input", "vector_search", "context_packer", "llm", "output"}


def test_golden_l3_reference() -> None:
    c = compiled(L3_REFERENCE, L3)
    assert c.nodes == ("q", "vs", "bm", "fu", "rr", "pk", "llm", "out")
    assert lg_edges(c) == (
        {(START, "q"), ("q", "vs"), ("q", "bm"), ("pk", "llm"), ("llm", "out"), ("out", END)},
        {(("bm", "vs"), "fu"), (("fu", "q"), "rr"), (("q", "rr"), "pk")},
    )
    assert c.retrievers == {
        "vs": ("vector_search", HANDLE_2024),
        "bm": ("bm25_search", HANDLE_2024),
        "fu": ("fusion", HANDLE_2024),
        "rr": ("rerank", HANDLE_2024),
    }


def test_level_corpus_and_only_in_force_go_into_the_handle() -> None:
    c = compiled(L2_REFERENCE, L2)
    assert c.handles["ix"].docs == {"qcdt-2024", "qcdt-2019"}
    assert c.handles["ix"].only_in_force


def test_dangling_nodes_are_not_compiled() -> None:
    g = plus(
        L1_REFERENCE,
        [node("vs2", "vector_search")],
        [("q.query", "vs2.query"), ("ix.index", "vs2.index")],
    )
    assert "vs2" not in compiled(g, L1).nodes


def test_ingestion_needs_the_store() -> None:
    assert compiled(L1_REFERENCE, L1).ingestion == []
    info = compiled(L1_REFERENCE, L1, store=True).ingestion
    assert info == [
        {
            "node": "ix",
            "variant": "theo_dieu-512-10",
            "chunks": 84,
            "avg_tokens": info[0]["avg_tokens"],
        }
    ]
    assert info[0]["avg_tokens"] > 0


def test_merge_once_rejects_a_second_write() -> None:
    assert merge_once({"a.x": HANDLE_2024}, {"b.y": HANDLE_2024}).keys() == {"a.x", "b.y"}
    with pytest.raises(ValueError, match="written twice"):
        merge_once({"a.x": HANDLE_2024}, {"a.x": HANDLE_2024})


def test_output_runs_once_on_uneven_branches() -> None:
    """Critic fix (high): q->rr is one hop, q->vs->fu->rr is three; rr, pk, out run once."""
    c = compiled(L3_REFERENCE, L3, store=True)
    events: list[EngineEvent] = []

    async def run_case(case: PublicCase) -> None:
        ctx = CaseContext("run", events.append, deadline=float("inf"))
        final = await c.graph.ainvoke(
            {"case": case, "ports": {}, "answer": None},
            {"configurable": {"case_ctx": ctx}, "recursion_limit": RECURSION_LIMIT},
        )
        assert final["answer"] is not None
        assert final["answer"].text == "Trả lời."
        assert [s.status for s in ctx.steps] == ["ok"] * 8

    for case in cases(3):
        asyncio.run(run_case(case))
    started = Counter((e["case"], e["node"]) for e in events if e["type"] == "step.started")
    assert set(started.values()) == {1}
    assert len(started) == 3 * 8
