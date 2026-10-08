"""Builder D test helpers: the three Library levels as in engine-v0.2.md §9.3-§9.5 (so D can
test before E writes engine/levels/*.json), graph builders and a gold-free evaluator double."""

import copy
import json
from collections.abc import Mapping, Sequence
from functools import cache
from typing import Any

from tests.engine.fakes_retrieval import HashingEmbedder
from vgame.config import Settings
from vgame.engine.constants import IndexVariant
from vgame.engine.corpus import load_documents
from vgame.engine.index import IndexStore
from vgame.engine.levels import LevelSpec
from vgame.engine.types import (
    BlockType,
    CaseGrade,
    CaseTrace,
    IndexHandle,
    LevelRules,
    PublicCase,
    RunReport,
    StarResult,
)

Graph = dict[str, Any]

CARDS = {
    "G1": "Chỉ dùng thông tin trong các đoạn tài liệu được đưa kèm.",
    "G2": "Sau mỗi ý, ghi mã đoạn đã dùng trong ngoặc vuông.",
    "G3": "Nếu các đoạn tài liệu không có câu trả lời, chỉ nói: "
    "«Quy chế hiện hành không có thông tin này.»",
    "G4": "Xưng «mình», gọi người hỏi là «bạn», giọng thân thiện.",
    "G5": "Luôn đưa ra câu trả lời hữu ích nhất có thể, kể cả khi phải suy đoán.",
    "G6": "Trả lời thật đầy đủ, càng chi tiết càng tốt.",
}


def cards(*ids: str) -> str:
    return "\n".join(CARDS[i] for i in ids)


def node(node_id: str, block: str, **params: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"id": node_id, "type": block}
    if params:
        out["params"] = params
    return out


def graph(nodes: list[dict[str, Any]], edges: list[tuple[str, str]]) -> Graph:
    return {"schema": 1, "nodes": nodes, "edges": [list(e) for e in edges]}


def raw(g: Graph) -> bytes:
    return json.dumps(g, ensure_ascii=False).encode()


def with_params(g: Graph, node_id: str, **params: Any) -> Graph:
    g = copy.deepcopy(g)
    for n in g["nodes"]:
        if n["id"] == node_id:
            n["params"] = {**n.get("params", {}), **params}
    return g


def without(g: Graph, *node_ids: str, edges: Sequence[tuple[str, str]] = ()) -> Graph:
    """Drop nodes (and their edges), then add ``edges``."""
    g = copy.deepcopy(g)
    g["nodes"] = [n for n in g["nodes"] if n["id"] not in node_ids]
    g["edges"] = [
        e
        for e in g["edges"]
        if e[0].split(".")[0] not in node_ids and e[1].split(".")[0] not in node_ids
    ] + [list(e) for e in edges]
    return g


def plus(g: Graph, nodes: list[dict[str, Any]], edges: list[tuple[str, str]]) -> Graph:
    g = copy.deepcopy(g)
    g["nodes"] += nodes
    g["edges"] += [list(e) for e in edges]
    return g


# --- L1 grounded-citation ------------------------------------------------------------------

_BASE = [node("q", "input"), node("kb", "corpus")]
_IX = node(
    "ix", "chunker", strategy="theo_dieu", chunk_size=512, overlap_pct=10, only_in_force=False
)
_OUT = node("out", "output")
_RAG_EDGES = [
    ("q.query", "vs.query"),
    ("ix.index", "vs.index"),
    ("vs.docs", "pk.docs"),
    ("q.query", "pk.query"),
    ("pk.context", "llm.context"),
    ("llm.answer", "out.answer"),
]

L1_STARTER = graph(
    [
        *_BASE,
        _IX,
        node("pk", "context_packer", token_budget=3000, on_overflow="cat_duoi", cite_ids=False),
        node("llm", "llm", profile="can_bang", system_prompt=cards("G4", "G5")),
        _OUT,
    ],
    [("q.query", "pk.query"), ("pk.context", "llm.context"), ("llm.answer", "out.answer")],
)
L1_REFERENCE = graph(
    [
        *_BASE,
        _IX,
        node("vs", "vector_search", top_k=3),
        node("pk", "context_packer", token_budget=3000, on_overflow="cat_duoi", cite_ids=True),
        node("llm", "llm", profile="can_bang", system_prompt=cards("G1", "G2", "G3")),
        _OUT,
    ],
    _RAG_EDGES,
)


def _rules(**over: Any) -> LevelRules:
    rules: LevelRules = {
        "s1_min_normal": 6,
        "s1_required": ["lib-l1-v01"],
        "token_budget": 22000,
        "s3_forbidden_labels": ["cite_unknown"],
        "info_cases": [],
        "stale_fails": None,
        "max_dieu": 84,
        "diagnosis": {},
    }
    return {**rules, **over}  # type: ignore[typeddict-item]


_L1_BLOCKS = ["input", "output", "corpus", "chunker", "vector_search", "context_packer", "llm"]
_PACK_LLM_LIMITS = {
    "context_packer.token_budget": {"const": 3000},
    "context_packer.on_overflow": {"const": "cat_duoi"},
    "llm.profile": {"const": "can_bang"},
}


def _level(**fields: Any) -> LevelSpec:
    return LevelSpec.model_validate(
        {"version": 1, "zone": "library", "prompt_cards": CARDS, "stars_vi": ["1", "2", "3"]}
        | fields
    )


L1 = _level(
    id="grounded-citation",
    corpus=["qcdt-2024"],
    allowed_blocks=_L1_BLOCKS,
    locked_nodes=["q", "kb", "ix", "out"],
    param_limits={
        # L1 locks the chunker; const limits stop a second, unlocked chunker bypassing it.
        "chunker.strategy": {"const": "theo_dieu"},
        "chunker.chunk_size": {"const": 512},
        "chunker.overlap_pct": {"const": 10},
        "chunker.only_in_force": {"const": False},
        "vector_search.top_k": {"ge": 1, "le": 10},
        "vector_search.score_threshold": {"const": 0},
        **_PACK_LLM_LIMITS,
    },
    starter_graph=L1_STARTER,
    reference_graph=L1_REFERENCE,
    naive_graphs=[
        {"id": "N1", "graph": L1_STARTER, "max_stars": 0},
        {
            "id": "N2",
            "graph": with_params(
                with_params(
                    with_params(L1_REFERENCE, "vs", top_k=5), "llm", system_prompt=cards("G4", "G5")
                ),
                "pk",
                cite_ids=False,
            ),
            "max_stars": 0,
        },
        {"id": "N3", "graph": with_params(L1_REFERENCE, "llm", system_prompt=cards("G2"))},
        {
            "id": "N4",
            "graph": with_params(
                with_params(L1_REFERENCE, "vs", top_k=10),
                "llm",
                system_prompt=cards("G1", "G2", "G3", "G6"),
            ),
            "max_stars": 1,
        },
        {"id": "N5", "graph": with_params(L1_REFERENCE, "vs", top_k=1)},
    ],
    rules=_rules(),
)

# --- L2 chunk-tuning -----------------------------------------------------------------------

L2_STARTER = with_params(
    with_params(L1_REFERENCE, "ix", strategy="co_dinh", chunk_size=128, overlap_pct=0),
    "vs",
    score_threshold=0,
)
L2_REFERENCE = with_params(
    L2_STARTER, "ix", strategy="theo_dieu", chunk_size=512, overlap_pct=10, only_in_force=True
)


def _ix_vs(ix: dict[str, Any], top_k: int) -> Graph:
    return with_params(with_params(L2_REFERENCE, "ix", **ix), "vs", top_k=top_k)


L2 = _level(
    id="chunk-tuning",
    corpus=["qcdt-2024", "qcdt-2019"],
    allowed_blocks=_L1_BLOCKS,
    locked_nodes=["q", "kb", "out"],
    param_limits={
        "vector_search.top_k": {"ge": 1, "le": 10},
        "vector_search.score_threshold": {"ge": 0, "le": 0.9, "multiple_of": 0.05},
        **_PACK_LLM_LIMITS,
    },
    starter_graph=L2_STARTER,
    reference_graph=L2_REFERENCE,
    naive_graphs=[
        {"id": "N1", "graph": L2_STARTER, "max_stars": 0},
        {
            "id": "N2",
            "graph": _ix_vs(
                {
                    "strategy": "co_dinh",
                    "chunk_size": 1024,
                    "overlap_pct": 0,
                    "only_in_force": False,
                },
                10,
            ),
            "max_stars": 1,
        },
        {"id": "N3", "graph": _ix_vs({"only_in_force": False}, 3), "max_stars": 2},
        {"id": "N4", "graph": with_params(L2_REFERENCE, "vs", score_threshold=0.8), "max_stars": 0},
        {
            "id": "N5",
            "graph": _ix_vs({"strategy": "co_dinh", "chunk_size": 256, "overlap_pct": 20}, 1),
        },
    ],
    rules=_rules(
        s1_min_normal=8,
        s1_required=["lib-l2-v01"],
        token_budget=30000,
        s3_forbidden_labels=["stale_doc"],
        stale_fails={"roles": ["trap"], "vai": ["van-ban-cu", "da-bai-bo"]},
    ),
)

# --- L3 article-number-lookup --------------------------------------------------------------

L3_STARTER = L2_REFERENCE
L3_REFERENCE = graph(
    [
        *_BASE,
        _IX,
        node("vs", "vector_search", top_k=5),
        node("bm", "bm25_search", top_k=5),
        node("fu", "fusion", method="rrf", k=60, top_k=10),
        node("rr", "rerank", top_n=3),
        node("pk", "context_packer", token_budget=3000, on_overflow="cat_duoi", cite_ids=True),
        node("llm", "llm", profile="can_bang", system_prompt=cards("G1", "G2", "G3")),
        _OUT,
    ],
    [
        ("q.query", "vs.query"),
        ("ix.index", "vs.index"),
        ("q.query", "bm.query"),
        ("ix.index", "bm.index"),
        ("vs.docs", "fu.docs"),
        ("bm.docs", "fu.docs"),
        ("q.query", "rr.query"),
        ("fu.docs", "rr.docs"),
        ("rr.docs", "pk.docs"),
        ("q.query", "pk.query"),
        ("pk.context", "llm.context"),
        ("llm.answer", "out.answer"),
    ],
)
_NO_RR = without(L3_REFERENCE, "rr", edges=[("fu.docs", "pk.docs")])

L3 = _level(
    id="article-number-lookup",
    corpus=["qcdt-2024"],
    allowed_blocks=[*_L1_BLOCKS, "bm25_search", "fusion", "rerank"],
    locked_nodes=["q", "kb", "out"],
    param_limits={
        "vector_search.top_k": {"ge": 1, "le": 5},
        "vector_search.score_threshold": {"ge": 0, "le": 0.9, "multiple_of": 0.05},
        "bm25_search.top_k": {"ge": 1, "le": 10},
        "fusion.top_k": {"ge": 1, "le": 10},
        "fusion.k": {"ge": 1, "le": 100},
        "fusion.alpha": {"multiple_of": 0.1},
        "rerank.top_n": {"ge": 1, "le": 5},
        **_PACK_LLM_LIMITS,
    },
    starter_graph=L3_STARTER,
    reference_graph=L3_REFERENCE,
    naive_graphs=[
        {"id": "N1", "graph": L3_STARTER, "max_stars": 0},
        {"id": "N2", "graph": with_params(L3_STARTER, "vs", top_k=5), "max_stars": 0},
        {
            "id": "N3",
            "graph": with_params(
                without(L3_REFERENCE, "vs", "fu", "rr", edges=[("bm.docs", "pk.docs")]),
                "bm",
                top_k=10,
            ),
        },
        {
            "id": "N4",
            "graph": with_params(
                without(
                    L3_REFERENCE, "fu", "rr", edges=[("vs.docs", "pk.docs"), ("bm.docs", "pk.docs")]
                ),
                "bm",
                top_k=10,
            ),
            "max_stars": 1,
        },
        {"id": "N5", "graph": _NO_RR, "max_stars": 1},
        {
            "id": "N6",
            "graph": with_params(_NO_RR, "fu", method="alpha", alpha=0.8, top_k=3),
            "max_stars": 0,
        },
        {
            "id": "N7",
            "graph": with_params(
                with_params(L3_REFERENCE, "ix", strategy="co_dinh", chunk_size=128, overlap_pct=0),
                "rr",
                top_n=1,
            ),
        },
        {"id": "N8", "graph": with_params(_NO_RR, "fu", top_k=3)},
    ],
    rules=_rules(
        s1_min_normal=8,
        s1_required=["lib-l3-v01"],
        token_budget=30000,
        s3_forbidden_labels=[],
        info_cases=["lib-l3-t03"],
    ),
)

LEVELS = {lv.id: lv for lv in (L1, L2, L3)}


# --- Evaluator double (no gold) -------------------------------------------------------------


class RecordingEvaluator:
    """Passes a case iff it ended ``ok``; records what the runtime hands over."""

    def __init__(self, *, fail_on: str | None = None) -> None:
        self.traces: list[CaseTrace] = []
        self.fail_on = fail_on

    def grade_case(self, trace: CaseTrace) -> CaseGrade:
        if trace.case.id == self.fail_on:
            raise RuntimeError("evaluator bug")
        self.traces.append(trace)
        ok = trace.status == "ok"
        labels = () if ok else (trace.status,)
        return CaseGrade(trace.case.id, ok, True, {"ok": ok}, labels)

    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult:
        passed = sum(g.passed for g in grades)
        return {
            "stars": int(passed == len(grades)),
            "s1": passed == len(grades),
            "s2": False,
            "s3": False,
            "normal_passed": passed,
            "normal_total": len(grades),
            "traps_passed": 0,
            "traps_total": 0,
            "tokens": sum(t.usage.tokens for t in traces),
            "budget": 1000,
        }

    def report(
        self,
        traces: Sequence[CaseTrace],
        grades: Sequence[CaseGrade],
        retrievers: Mapping[str, tuple[BlockType, IndexHandle]],
    ) -> RunReport:
        return {"gold": {}, "diagnosis": []}


def _question(i: int, hidden: bool) -> str:
    return f"BÍ MẬT {i}: thời gian bảo lưu?" if hidden else f"Câu {i}: thời gian bảo lưu?"


def cases(n: int, *, hidden: Sequence[int] = ()) -> list[PublicCase]:
    return [
        PublicCase(f"c{i}", "hidden" if i in hidden else "visible", "sv", _question(i, i in hidden))
        for i in range(1, n + 1)
    ]


@cache
def small_store() -> IndexStore:
    """Real corpus, one variant (theo_dieu/512/10), offline HashingEmbedder; questions of
    ``cases(n <= 12)`` are pre-embedded."""
    docs = load_documents(Settings(_env_file=None).content_dir)
    questions = [_question(i, h) for i in range(1, 13) for h in (False, True)]
    return IndexStore.build(
        docs, HashingEmbedder(), questions, [IndexVariant("theo_dieu", 512, 10)]
    )
