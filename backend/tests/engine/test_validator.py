import json
from importlib import resources
from typing import Any

import pytest

from tests.engine.engine_fixtures import (
    L1,
    L1_REFERENCE,
    L1_STARTER,
    L2,
    L3,
    L3_REFERENCE,
    LEVELS,
    Graph,
    node,
    plus,
    raw,
    with_params,
    without,
)
from vgame.engine.levels import LevelSpec
from vgame.engine.types import ValidationIssue
from vgame.engine.validator import validate


def check(g: Graph | bytes, level: LevelSpec = L1) -> tuple[Any, list[ValidationIssue]]:
    return validate(g if isinstance(g, bytes) else raw(g), level)


def codes(issues: list[ValidationIssue]) -> set[str]:
    return {i["code"] for i in issues}


def errors(issues: list[ValidationIssue]) -> set[str]:
    return {i["code"] for i in issues if i["severity"] == "error"}


# --- Every shipped graph is valid (critic fix: G07 must not block starters) ----------------


def _level_graphs(level: LevelSpec) -> list[tuple[str, Graph]]:
    out = [("starter", level.starter_graph), ("reference", level.reference_graph)]
    out += [(n.id, n.graph) for n in level.naive_graphs]
    return [(f"{level.id}:{name}", g.model_dump(mode="json", by_alias=True)) for name, g in out]


@pytest.mark.parametrize(
    ("name", "g", "level"),
    [(name, g, lv) for lv in LEVELS.values() for name, g in _level_graphs(lv)],
    ids=lambda v: v if isinstance(v, str) else "",
)
def test_every_level_graph_is_valid(name: str, g: Graph, level: LevelSpec) -> None:
    graph, issues = check(g, level)
    assert graph is not None, (name, issues)
    assert not errors(issues)


def test_shipped_level_files_are_valid() -> None:
    """engine/levels/*.json (written by the integrator) once they exist."""
    folder = resources.files("vgame.engine").joinpath("levels")
    files = [f for f in folder.iterdir() if f.name.endswith(".json")] if folder.is_dir() else []
    for f in files:
        level = LevelSpec.model_validate_json(f.read_text("utf-8"))
        for name, g in _level_graphs(level):
            graph, issues = check(g, level)
            assert graph is not None, (name, issues)


# --- Step 1-2: payload ---------------------------------------------------------------------


def test_p01_oversized_payload_stops_early() -> None:
    graph, issues = check(with_params(L1_STARTER, "llm", system_prompt="x" * 1_000_000))
    assert graph is None
    assert [i["code"] for i in issues] == ["P01"]


@pytest.mark.parametrize(
    "payload",
    [b"\xff\xfe not utf-8", b"{not json", b"[" * 30_000 + b"]" * 30_000],
    ids=["utf8", "json", "deep-nesting"],
)
def test_p02_unreadable_payload(payload: bytes) -> None:
    graph, issues = check(payload)
    assert graph is None
    assert codes(issues) == {"P02"}


def test_p02_deep_nesting_that_json_accepts_but_recursion_does_not() -> None:
    # json.loads takes depth 600; the forbidden-char walk and NFC pass recurse deeper.
    graph, issues = check(b"[" * 600 + b"]" * 600)
    assert graph is None
    assert codes(issues) == {"P02"}


@pytest.mark.parametrize("bad", ["\x00", "‮", "⁦", "\x1b"])
def test_p02_control_and_bidi_characters_rejected(bad: str) -> None:
    graph, issues = check(with_params(L1_STARTER, "llm", system_prompt="hi" + bad))
    assert graph is None
    assert "P02" in codes(issues)


@pytest.mark.parametrize(
    "payload",
    [
        {"schema": 1, "nodes": []},
        {"schema": 2, "nodes": [], "edges": []},
        plus(L1_STARTER, [node("zz", "SECRET_MARKER_type")], []),
        plus(L1_STARTER, [{"id": "BAD ID SECRET_MARKER", "type": "input"}], []),
        L1_STARTER | {"extra": "SECRET_MARKER"},
    ],
    ids=["no-edges", "schema-2", "unknown-block", "bad-id", "extra-field"],
)
def test_p03_wrong_shape_never_echoes_payload(payload: Graph) -> None:
    graph, issues = check(payload)
    assert graph is None
    assert codes(issues) == {"P03"}
    assert "SECRET_MARKER" not in json.dumps(issues, ensure_ascii=False)


def test_p03_duplicate_ids_and_too_many_nodes() -> None:
    dup = plus(L1_STARTER, [node("pk", "context_packer")], [])
    assert codes(check(dup)[1]) == {"P03"}
    many = plus(L1_STARTER, [node(f"v{i}", "vector_search") for i in range(20)], [])
    assert codes(check(many)[1]) == {"P03"}


def test_strings_are_nfc_normalised_and_player_text_kept_verbatim() -> None:
    prompt = "Điều {__class__} {0} '; DROP TABLE run; --"  # decomposed "Điều"
    graph, issues = check(with_params(L1_STARTER, "llm", system_prompt=prompt))
    assert graph is not None, issues
    kept = graph.node("llm").params["system_prompt"]
    assert kept == "Điều {__class__} {0} '; DROP TABLE run; --"
    assert kept != prompt


# --- Step 3: locked nodes and allowed blocks -----------------------------------------------


def test_locked_nodes_are_reinserted_from_starter() -> None:
    tampered = with_params(L1_REFERENCE, "ix", chunk_size=128, only_in_force=True)
    tampered = without(tampered, "kb")
    graph, issues = check(tampered)
    assert graph is not None, issues
    assert graph.node("ix").params["chunk_size"] == 512
    assert graph.node("ix").params["only_in_force"] is False
    assert graph.node("kb") is not None


def test_g06_block_not_unlocked() -> None:
    g = plus(L1_REFERENCE, [node("bm", "bm25_search")], [("q.query", "bm.query")])
    issues = check(g)[1]
    hit = next(i for i in issues if i["code"] == "G06")
    assert hit["node"] == "bm"
    assert "chưa mở" in hit["message_vi"]


# --- Step 4: params --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("level", "g", "fragment"),
    [
        (L1, with_params(L1_REFERENCE, "vs", top_k=11), "tối đa là 10 ở level này"),
        (L1, with_params(L1_REFERENCE, "vs", top_k=0), "tối thiểu là 1"),
        (L1, with_params(L1_REFERENCE, "vs", score_threshold=0.5), "chưa mở ở level này"),
        (L1, with_params(L1_REFERENCE, "pk", token_budget=4000), "chưa mở ở level này"),
        (L1, with_params(L1_REFERENCE, "llm", profile="sau"), "chưa mở ở level này"),
        (L1, with_params(L1_REFERENCE, "llm", temperature=0.2), "không có tham số"),
        (L1, with_params(L1_REFERENCE, "llm", system_prompt="x" * 2001), "dài 2.001 ký tự"),
        (L1, with_params(L1_REFERENCE, "vs", top_k="3"), "không hợp lệ"),
        (L2, with_params(L1_REFERENCE, "vs", score_threshold=0.07), "bội của 0,05"),
        (L2, with_params(L1_REFERENCE, "ix", chunk_size=300), "chỉ nhận"),
        (L3, with_params(L3_REFERENCE, "fu", k=0), "tối thiểu là 1"),
        (L3, with_params(L3_REFERENCE, "vs", top_k=6), "tối đa là 5 ở level này"),
    ],
)
def test_g06_param_domain_and_level_limits(level: LevelSpec, g: Graph, fragment: str) -> None:
    graph, issues = check(g, level)
    assert graph is None
    g06 = [i for i in issues if i["code"] == "G06"]
    assert g06, issues
    assert any(fragment in i["message_vi"] for i in g06), g06


@pytest.mark.parametrize("step", range(19))
def test_float_multiples_are_not_rejected_by_rounding(step: int) -> None:
    g = with_params(L3_REFERENCE, "vs", score_threshold=round(step * 0.05, 2))
    g = with_params(g, "fu", method="alpha", alpha=round(min(step, 10) * 0.1, 1))
    graph, issues = check(g, L3)
    assert graph is not None, issues


def test_rerank_top_n_against_upstream() -> None:
    too_many = with_params(with_params(L3_REFERENCE, "fu", top_k=3), "rr", top_n=4)
    issues = check(too_many, L3)[1]
    assert any(i["code"] == "G06" and i["node"] == "rr" for i in issues)

    noop = with_params(with_params(L3_REFERENCE, "fu", top_k=3), "rr", top_n=3)
    graph, issues = check(noop, L3)
    assert graph is not None
    assert [i["code"] for i in issues] == ["W_RERANK_NOOP"]
    assert issues[0]["severity"] == "info"


def test_fusion_alpha_needs_one_vector_and_one_bm25_list() -> None:
    g = plus(
        with_params(L3_REFERENCE, "fu", method="alpha"),
        [node("vs2", "vector_search", top_k=3)],
        [("q.query", "vs2.query"), ("ix.index", "vs2.index"), ("vs2.docs", "fu.docs")],
    )
    g = without(g, "bm")
    issues = check(g, L3)[1]
    assert any(i["code"] == "G06" and i["node"] == "fu" for i in issues)


# --- Step 5-10: structure --------------------------------------------------------------------


def test_g02_wrong_port_type_into_output() -> None:
    g = without(L1_REFERENCE, "llm", edges=[("vs.docs", "out.answer")])
    issues = check(g)[1]
    g02 = next(i for i in issues if i["code"] == "G02")
    assert "Augmentation → Generation" in g02["message_vi"]
    assert g02["node"] == "out"


@pytest.mark.parametrize(
    "extra_edge",
    [("vs.nope", "pk.docs"), ("ghost.docs", "pk.docs"), ("vs", "pk.docs"), ("q.query", "pk.query")],
    ids=["bad-port", "bad-node", "no-port", "duplicate"],
)
def test_g02_bad_edges(extra_edge: tuple[str, str]) -> None:
    g = plus(L1_REFERENCE, [], [extra_edge])
    assert "G02" in errors(check(g)[1])


def test_g02_single_port_fan_in_and_fusion_arity() -> None:
    two_queries = plus(L1_REFERENCE, [node("q2", "input")], [("q2.query", "pk.query")])
    issues = check(two_queries)[1]
    assert any(i["code"] == "G02" and i["port"] == "query" for i in issues)
    one_list = without(L3_REFERENCE, "bm")
    assert "G02" in errors(check(one_list, L3)[1])


def test_g05_required_port_missing() -> None:
    issues = check(without(L1_REFERENCE, "pk"))[1]  # llm.context is now empty
    g05 = [i for i in issues if i["code"] == "G05"]
    assert any(i["node"] == "llm" and i["port"] == "context" for i in g05)


def test_g03_cycle() -> None:
    g = plus(L3_REFERENCE, [], [("rr.docs", "fu.docs")])
    assert "G03" in errors(check(g, L3)[1])


def test_g04_two_outputs_and_two_answers() -> None:
    two_outputs = plus(L1_REFERENCE, [node("out2", "output")], [("llm.answer", "out2.answer")])
    assert "G04" in errors(check(two_outputs)[1])
    two_answers = plus(
        L1_REFERENCE,
        [node("llm2", "llm", profile="can_bang")],
        [("pk.context", "llm2.context"), ("llm2.answer", "out.answer")],
    )
    assert "G04" in errors(check(two_answers)[1])


def test_g01_and_g05_are_aggregated() -> None:
    g = without(L1_REFERENCE, edges=[])
    g["edges"] = [e for e in g["edges"] if e != ["llm.answer", "out.answer"]]
    g = with_params(g, "vs", top_k=99)
    issues = check(g)[1]
    assert {"G01", "G05", "G06"} <= errors(issues)


def test_g07_too_many_llm_blocks() -> None:
    llms = [node(f"l{i}", "llm", profile="can_bang") for i in range(8)]
    g = plus(L1_REFERENCE, llms, [("pk.context", f"l{i}.context") for i in range(8)])
    issues = check(g)[1]
    assert "G07" in errors(issues)


def test_i01_dangling_block_is_info_only() -> None:
    g = plus(
        L1_REFERENCE,
        [node("vs2", "vector_search", top_k=2)],
        [("q.query", "vs2.query"), ("ix.index", "vs2.index")],
    )
    graph, issues = check(g)
    assert graph is not None
    assert [(i["code"], i["node"], i["severity"]) for i in issues] == [("I01", "vs2", "info")]


def test_normalised_graph_carries_param_defaults() -> None:
    graph, _ = check(L1_REFERENCE)
    assert graph is not None
    assert graph.node("vs").params == {"top_k": 3, "score_threshold": 0.0}


def test_issue_shape() -> None:
    issue = check(with_params(L1_REFERENCE, "vs", top_k=11))[1][0]
    assert set(issue) == {"code", "severity", "node", "port", "message_vi", "concept_ref"}
    assert issue["concept_ref"] == "N7.top_k"
