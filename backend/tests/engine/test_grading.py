"""Evaluator: golden spec, normalisation, per-case criteria, labels, gold reveal, diagnosis.

Runs on the real corpus and golden files with the offline HashingEmbedder (no network)."""

from typing import cast

import pytest

from tests.engine.fakes_retrieval import HashingEmbedder
from vgame.config import Settings
from vgame.engine.chunking import chunk_document
from vgame.engine.constants import ALL_VARIANTS, IndexVariant
from vgame.engine.corpus import find_quote, load_documents
from vgame.engine.grading import (
    GradingSpec,
    LevelEvaluator,
    load_grading_spec,
    normalize,
    public_cases,
)
from vgame.engine.index import IndexStore, golden_questions
from vgame.engine.prompt import parse_citations
from vgame.engine.retrieval import retrieved_fact, vector_search
from vgame.engine.scoring import render
from vgame.engine.types import (
    Answer,
    BlockType,
    CaseStatus,
    CaseTrace,
    Chunk,
    DocHit,
    DocList,
    IndexHandle,
    LevelRules,
    PackFact,
    PublicCase,
    Retriever,
    StepRecord,
    Usage,
)

CONTENT = Settings(_env_file=None).content_dir
TD = IndexVariant("theo_dieu", 512, 10)
CD = IndexVariant("co_dinh", 128, 0)
SPECS = {
    lv: load_grading_spec(CONTENT, lv)
    for lv in ("grounded-citation", "chunk-tuning", "article-number-lookup")
}
L1, L2, L3 = SPECS["grounded-citation"], SPECS["chunk-tuning"], SPECS["article-number-lookup"]

# Templates copied from scenario §11 (E owns the real level files).
DIAG: dict[str, str] = {
    "ret.gold_missing": "Câu #{n} cần một đoạn trong Điều {dieu}. Thùng có {pack_tokens} token.",
    "ret.gold_rank:vector_search": "Câu #{n} hạng {rank} ở Vòm Sao, Móc kéo chỉ kéo {k} sao.",
    "ret.gold_rank:fusion": "Sau phễu, hạng {r_fu}. Kính lúp đưa nó lên {r_rr}, mất {ms} ms.",
    "llm.cite_missing": "Câu #{n} nói đúng ý. Thùng có {m} đoạn, không đoạn nào mang mã.",
    "llm.cite_unknown": "Câu #{n} trích {cite}, nhưng thùng chỉ có {dieu_list}.",
    "ret.boundary_split": "Câu #{n} bị cắt đôi: nửa đầu ở đoạn {a}, nửa sau ở đoạn {b}.",
    "ctx.gold_dropped": "Đoạn đúng của câu #{n} hạng {rank}, nhưng thùng đầy.",
    "ret.stale_doc": "Có {m} câu mang giấy 2019 vào thùng.",
    "trap.failed": "Có ca bẫy hỏi về một điều không hề có. Quy chế dừng ở Điều {max_dieu}.",
    "regression": "Ca của Hà trượt: {flag}.",
    "budget.exceeded": "Run này tốn {tokens} token, ngân sách là {budget}, {avg_docs} đoạn/câu.",
}


def rules(**over: object) -> LevelRules:
    base: LevelRules = {
        "s1_min_normal": 6,
        "s1_required": [],
        "token_budget": 22000,
        "s3_forbidden_labels": [],
        "info_cases": [],
        "stale_fails": None,
        "max_dieu": 84,
        "diagnosis": DIAG,
    }
    return cast(LevelRules, {**base, **over})


L2_RULES = rules(stale_fails={"roles": ["trap"], "vai": ["van-ban-cu", "da-bai-bo"]})


@pytest.fixture(scope="module")
def store() -> IndexStore:
    docs = load_documents(CONTENT)
    return IndexStore.build(docs, HashingEmbedder(), golden_questions(CONTENT), variants=[TD, CD])


def handle(spec: GradingSpec, variant: IndexVariant = TD) -> IndexHandle:
    return IndexHandle(variant, frozenset(spec.corpus), only_in_force=False)


def gold_chunk(store: IndexStore, spec: GradingSpec, case_id: str, i: int = 0) -> Chunk:
    """The chunk of the TD variant holding gold quote ``i`` whole."""
    gold = next(c for c in spec.cases if c.id == case_id).gold[i]
    start, end = find_quote(store.document(gold.doc_id), gold.quote)
    return next(
        c
        for c in store.chunks(handle(spec))
        if c.doc_id == gold.doc_id and c.start <= start and end <= c.end
    )


def chunk_of(store: IndexStore, spec: GradingSpec, dieu: int, doc_id: str = "qcdt-2024") -> Chunk:
    return next(c for c in store.chunks(handle(spec)) if c.doc_id == doc_id and c.dieu == dieu)


Node = tuple[str, Retriever, list[Chunk]]


def trace(
    spec: GradingSpec,
    case_id: str,
    text: str | None,
    *,
    included: list[Chunk] | tuple[Chunk, ...] = (),
    dropped: list[Chunk] | tuple[Chunk, ...] = (),
    nodes: list[Node] | tuple[Node, ...] = (),
    status: CaseStatus = "ok",
    tokens: int = 100,
) -> CaseTrace:
    # Review cases (daily shift) never run in a level; grade them like a trap.
    case = next(
        PublicCase(c.id, "trap" if c.role == "review" else c.role, c.vai, c.question)
        for c in spec.cases
        if c.id == case_id
    )
    steps = [
        StepRecord(
            node,
            block,
            "ok",
            7,
            Usage(),
            (retrieved_fact(DocList(block, tuple(DocHit(c, 0.5) for c in out))),),
        )
        for node, block, out in nodes
    ]
    docs = sum(c.tokens for c in included)
    pack: PackFact = {
        "kind": "pack",
        "included": [c.chunk_id for c in included],
        "dropped": [c.chunk_id for c in dropped],
        "tokens": {"docs": docs, "query": 10, "total": docs + 10, "budget": 3000},
    }
    steps.append(StepRecord("pk", "context_packer", "ok", 1, Usage(), (pack,)))
    answer = None
    if text is not None:
        answer = Answer(text, parse_citations(text), "end", Usage(tokens, 0), False)
    return CaseTrace(case, status, tuple(steps), answer, Usage(tokens, 0), 10)


# --- Spec and normalisation ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Điểm 2,5 nhé", "điểm 2.5 nhé"),  # decimal comma between digits -> dot
        ("2.5", "2.5"),  # a dot between digits is kept
        ("20%, đúng.", "20% đúng "),  # % kept, other punctuation -> space
        ("Hai  tuần!\n(cố vấn)", "hai tuần cố vấn "),
        ("Bậc 3/6", "bậc 3 6"),
        ("a, b", "a b"),  # comma not between digits is punctuation
        ("học phí", "học phí"),  # decomposed input -> NFC
        ("Phòng ĐT", "phòng đt"),
    ],
)
def test_normalize(raw: str, expected: str) -> None:
    assert normalize(raw) == expected


def test_specs_load_in_golden_order_and_public_cases_drop_review() -> None:
    assert L1.corpus == ("qcdt-2024",)
    assert L2.corpus == ("qcdt-2024", "qcdt-2019")
    assert "không có khoản" in L3.refusal_markers
    assert L1.equivalents["hai tuần"] == ("2 tuần", "14 ngày", "mười bốn ngày")
    for spec, counts in ((L1, (3, 5, 2)), (L2, (3, 7, 3)), (L3, (3, 7, 3))):
        cases = public_cases(spec)
        assert [c.id for c in cases] == [c.id for c in spec.cases if c.role != "review"]
        assert tuple(sum(c.role == r for c in cases) for r in ("visible", "hidden", "trap")) == (
            counts
        )
    with pytest.raises(ValueError, match="no golden file"):
        load_grading_spec(CONTENT, "khong-co")


def test_chunk_ids_are_unique_across_all_24_variants() -> None:
    """The evaluator resolves cited ids without knowing their variant (grading._chunks_by_id)."""
    ids = [
        c.chunk_id
        for d in load_documents(CONTENT).values()
        for v in ALL_VARIANTS
        for c in chunk_document(d, v)
    ]
    assert len(ids) == len(set(ids))


# --- grade_case: answer cases (L1 v01) ----------------------------------------------------

GOOD = "Nộp đơn cho phòng đào tạo trước hai tuần, kèm ý kiến cố vấn học tập [{gold}]."


@pytest.mark.parametrize(
    ("text", "failed", "labels"),
    [
        (GOOD, set(), set()),
        ("Gửi phòng ĐT trước 2 tuần, hỏi cố vấn [{gold}].", set(), set()),  # equivalents
        (
            "Theo Điều 12, nộp cho phòng đào tạo trước hai tuần, có cố vấn học tập [{gold}].",
            set(),
            set(),
        ),  # Điều 12 is in the pack
        (GOOD.replace(" [{gold}]", ""), {"cited"}, {"cite_missing"}),
        (GOOD.replace("{gold}", "{other}"), {"cited"}, set()),  # real chunk, not gold
        (GOOD.replace("{gold}", "deadbeef"), {"cited", "no_fabrication"}, {"cite_unknown"}),
        ("Theo Điều 99, " + GOOD, {"no_fabrication"}, {"cite_unknown"}),
        (
            "Điều 47 quy định nộp đơn cho phòng đào tạo trước hai tuần, cố vấn học tập [{gold}].",
            {"no_fabrication", "no_forbidden"},
            {"cite_unknown"},
        ),
        (GOOD + " Gửi email nữa.", {"no_forbidden"}, set()),
        ("Nộp cho phòng đào tạo [{gold}].", {"points"}, set()),
    ],
)
def test_grade_answer_case(
    store: IndexStore, text: str, failed: set[str], labels: set[str]
) -> None:
    gold, other = gold_chunk(store, L1, "lib-l1-v01"), chunk_of(store, L1, 18)
    text = text.replace("{gold}", gold.chunk_id).replace("{other}", other.chunk_id)
    grade = LevelEvaluator(L1, rules(), store).grade_case(
        trace(L1, "lib-l1-v01", text, included=[gold, other])
    )
    assert set(grade.criteria) == {"points", "cited", "no_fabrication", "no_forbidden"}
    assert {k for k, ok in grade.criteria.items() if not ok} == failed
    assert grade.passed == (not failed)
    assert set(grade.labels) == labels
    assert gold.chunk_id not in repr(grade)  # nothing gold-bearing in the in-run verdict


def test_cited_id_must_be_in_pack(store: IndexStore) -> None:
    gold = gold_chunk(store, L1, "lib-l1-v01")
    text = GOOD.replace("{gold}", gold.chunk_id)
    grade = LevelEvaluator(L1, rules(), store).grade_case(trace(L1, "lib-l1-v01", text))
    assert not grade.criteria["cited"]
    assert "cite_unknown" in grade.labels


@pytest.mark.parametrize("status", ["timeout", "llm_error", "skipped_budget", "cancelled"])
def test_unfinished_case_fails_with_status_label(store: IndexStore, status: CaseStatus) -> None:
    gold = gold_chunk(store, L1, "lib-l1-v01")
    grade = LevelEvaluator(L1, rules(), store).grade_case(
        trace(
            L1, "lib-l1-v01", GOOD.replace("{gold}", gold.chunk_id), included=[gold], status=status
        )
    )
    assert not grade.passed
    assert grade.labels == (status,)


# --- grade_case: abstain cases ------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "failed", "labels"),
    [
        ("Quy chế hiện hành không có thông tin này.", set(), {"abstained", "cite_missing"}),
        (
            "Theo Điều 99, sinh viên được học vượt tối đa 3 môn.",
            {"refusal", "no_fabrication", "no_forbidden"},  # forbidden: "theo Điều 99"
            {"cite_unknown", "cite_missing"},
        ),
        ("Học vượt được tối đa 3 môn.", {"refusal"}, {"cite_missing"}),
        # A correct refusal that names the missing article passes (engine-v0.2.md §14.9) ...
        ("Quy chế không có Điều 99 quy định về học vượt.", set(), {"abstained", "cite_missing"}),
        # ... while the same claim stated as fact is still a fabrication (cite_unknown).
        (
            "Điều 99 quy định sinh viên được học vượt tối đa 3 môn.",
            {"refusal", "no_fabrication"},
            {"cite_unknown", "cite_missing"},
        ),
        # A refusal marker in one clause does not excuse a claim in the next one.
        (
            "Quy chế không quy định học vượt; Điều 99 quy định sinh viên được học vượt 3 môn.",
            {"no_fabrication"},
            {"abstained", "cite_unknown", "cite_missing"},
        ),
        (
            "Quy chế không có thông tin này, nhưng Điều 99 quy định được học vượt 3 môn.",
            {"no_fabrication"},
            {"abstained", "cite_unknown", "cite_missing"},
        ),
    ],
)
def test_grade_abstain_case(
    store: IndexStore, text: str, failed: set[str], labels: set[str]
) -> None:
    grade = LevelEvaluator(L1, rules(), store).grade_case(trace(L1, "lib-l1-t01", text))
    assert set(grade.criteria) == {"refusal", "no_fabrication", "no_forbidden"}
    assert {k for k, ok in grade.criteria.items() if not ok} == failed
    assert set(grade.labels) == labels


@pytest.mark.parametrize(
    ("spec", "case_id", "refusal", "fabrication"),
    [
        (
            L1,
            "lib-l1-r02",
            "Điều 12 không có khoản 9 quy định nội dung này.",
            "Theo khoản 9, sinh viên được bảo lưu ba học kỳ.",
        ),
        (
            L3,
            "lib-l3-t03",
            "Điều 41 không có khoản 6 quy định nội dung này.",
            "Theo khoản 6, sinh viên được phúc khảo hai lần.",
        ),
    ],
)
def test_refusal_naming_the_missing_clause_passes_and_a_fabrication_fails(
    store: IndexStore, spec: GradingSpec, case_id: str, refusal: str, fabrication: str
) -> None:
    ev = LevelEvaluator(spec, rules(), store)
    assert ev.grade_case(trace(spec, case_id, refusal)).passed
    assert not ev.grade_case(trace(spec, case_id, fabrication)).passed


def test_abstain_may_cite_a_real_packed_chunk(store: IndexStore) -> None:
    d41 = chunk_of(store, L3, 41)
    text = f"Theo Điều 41, chỉ có 4 khoản [{d41.chunk_id}]. Điều 41 không có khoản 6."
    grade = LevelEvaluator(L3, rules(), store).grade_case(
        trace(L3, "lib-l3-t03", text, included=[d41])
    )
    assert grade.passed
    assert set(grade.labels) == {"abstained"}


def test_info_case_is_not_counted(store: IndexStore) -> None:
    ev = LevelEvaluator(L3, rules(info_cases=["lib-l3-t03"]), store)
    assert not ev.grade_case(trace(L3, "lib-l3-t03", "Không rõ.")).counted
    assert ev.grade_case(trace(L3, "lib-l3-t01", "Không rõ.")).counted


# --- L2 stale rule ------------------------------------------------------------------------


def test_l2_stale_rule_fails_traps_with_a_2019_chunk_in_the_pack(store: IndexStore) -> None:
    ev = LevelEvaluator(L2, L2_RULES, store)
    gold, old = gold_chunk(store, L2, "lib-l2-t01"), chunk_of(store, L2, 10, "qcdt-2019")
    text = f"Cần nộp đơn trước hai tuần [{gold.chunk_id}]."
    clean = ev.grade_case(trace(L2, "lib-l2-t01", text, included=[gold]))
    stale = ev.grade_case(trace(L2, "lib-l2-t01", text, included=[gold, old]))
    assert clean.passed
    assert clean.criteria["no_stale"]
    assert not stale.passed
    assert not stale.criteria["no_stale"]
    assert "stale_doc" in stale.labels
    # A normal case outside the rule only gets the label.
    v01 = ev.grade_case(trace(L2, "lib-l2-v01", text, included=[gold, old]))
    assert "no_stale" not in v01.criteria
    assert "stale_doc" in v01.labels


# --- report: gold reveal and diagnosis (after the run) ------------------------------------


def run_report(
    ev: LevelEvaluator,
    traces: list[CaseTrace],
    retrievers: dict[str, tuple[BlockType, IndexHandle]],
) -> tuple[dict[str, list[str]], dict[str | None, tuple[str, str]], LevelEvaluator]:
    grades = [ev.grade_case(t) for t in traces]
    report = ev.report(traces, grades, retrievers)
    flags = {case: reveal["flags"] for case, reveal in report["gold"].items()}
    diag = {d["case"]: (d["flag"], d["message_vi"]) for d in report["diagnosis"]}
    return flags, diag, ev


def test_no_retrieval_reports_gold_missing(store: IndexStore) -> None:
    ev = LevelEvaluator(L1, rules(), store)
    t = trace(L1, "lib-l1-v01", "Em gửi email cho phòng đào tạo nhé.")
    report = ev.report([t], [ev.grade_case(t)], {})
    reveal = report["gold"]["lib-l1-v01"]
    assert reveal == {
        "gold_chunks": [],
        "ranks": {},
        "in_pack": False,
        "flags": ["ret.gold_missing"],
    }
    assert report["diagnosis"] == [
        {
            "case": "lib-l1-v01",
            "flag": "ret.gold_missing",
            "message_vi": "Câu #1 cần một đoạn trong Điều 12. Thùng có 10 token.",
        }
    ]


def test_low_top_k_reports_whole_corpus_rank(store: IndexStore) -> None:
    ev = LevelEvaluator(L1, rules(), store)
    h, other = handle(L1), chunk_of(store, L1, 18)
    gold = gold_chunk(store, L1, "lib-l1-v03")
    full = vector_search(
        store, h, "Cuối khóa muốn ra trường thì tiếng Anh phải tới cỡ nào ạ?", top_k=None
    )
    rank = next(i for i, hit in enumerate(full.hits, 1) if hit.chunk.chunk_id == gold.chunk_id)
    t = trace(
        L1, "lib-l1-v03", "Bậc 3.", included=[other], nodes=[("vs", "vector_search", [other])]
    )
    grades = [ev.grade_case(t)]
    report = ev.report([t], grades, {"vs": ("vector_search", h)})
    reveal = report["gold"]["lib-l1-v03"]
    assert reveal["ranks"] == {"vs": rank}
    assert gold.chunk_id in reveal["gold_chunks"]
    assert reveal["flags"] == ["ret.gold_missing", "ret.gold_rank"]
    assert report["diagnosis"][0] == {
        "case": "lib-l1-v03",
        "flag": "ret.gold_rank:vector_search",
        "message_vi": f"Câu #3 hạng {rank} ở Vòm Sao, Móc kéo chỉ kéo 1 sao.",
    }


@pytest.mark.parametrize(
    ("case_id", "text", "pack", "flag", "message"),
    [
        # Gold reached the packer but the budget cut it.
        (
            "lib-l1-v01",
            "Không rõ.",
            "dropped",
            "ctx.gold_dropped",
            "Đoạn đúng của câu #1 hạng 1, nhưng thùng đầy.",
        ),
        # Gold in the pack, right points, no citation (L1-N2).
        (
            "lib-l1-v01",
            "Phòng đào tạo, hai tuần, cố vấn học tập.",
            "included",
            "llm.cite_missing",
            "Câu #1 nói đúng ý. Thùng có 1 đoạn, không đoạn nào mang mã.",
        ),
        (
            "lib-l1-v01",
            "Theo Điều 99 thì gửi phòng đào tạo.",
            "included",
            "llm.cite_unknown",
            "Câu #1 trích Điều 99, nhưng thùng chỉ có Điều 12.",
        ),
    ],
)
def test_single_flag_diagnosis(
    store: IndexStore, case_id: str, text: str, pack: str, flag: str, message: str
) -> None:
    gold = gold_chunk(store, L1, case_id)
    t = trace(L1, case_id, text, nodes=[("vs", "vector_search", [gold])], **{pack: [gold]})  # type: ignore[arg-type]
    _, diag, _ = run_report(
        LevelEvaluator(L1, rules(), store), [t], {"vs": ("vector_search", handle(L1))}
    )
    assert diag[case_id] == (flag, message)


def test_trap_failure_never_shows_the_question(store: IndexStore) -> None:
    t = trace(L1, "lib-l1-t01", "Học vượt được tối đa 3 môn.")
    _, diag, _ = run_report(LevelEvaluator(L1, rules(), store), [t], {})
    assert diag["lib-l1-t01"] == (
        "trap.failed",
        "Có ca bẫy hỏi về một điều không hề có. Quy chế dừng ở Điều 84.",
    )


def test_empty_pack_reads_as_zero_chunks_in_templates(store: IndexStore) -> None:
    """The L1/L3 templates say "thùng chỉ có {dieu_list}"; an empty pack used to render
    "thùng chỉ có không có đoạn nào"."""
    diag_rules = rules(diagnosis={**DIAG, "trap.failed": "Thùng của ca đó có {dieu_list}."})
    t = trace(L1, "lib-l1-t01", "Học vượt được tối đa 3 môn.")
    _, diag, _ = run_report(LevelEvaluator(L1, diag_rules, store), [t], {})
    assert diag["lib-l1-t01"] == ("trap.failed", "Thùng của ca đó có 0 đoạn.")


def test_fusion_that_drops_gold_is_blamed(store: IndexStore) -> None:
    h = handle(L3)
    gold, other = gold_chunk(store, L3, "lib-l3-v01"), chunk_of(store, L3, 74)
    t = trace(
        L3,
        "lib-l3-v01",
        "Không rõ.",
        included=[other],
        nodes=[
            ("bm", "bm25_search", [gold, other]),
            ("fu", "fusion", [other]),
            ("vs", "vector_search", [other]),
        ],
    )
    retrievers: dict[str, tuple[BlockType, IndexHandle]] = {
        "bm": ("bm25_search", h),
        "fu": ("fusion", h),
        "vs": ("vector_search", h),
    }
    flags, diag, _ = run_report(LevelEvaluator(L3, rules(), store), [t], retrievers)
    assert "ret.gold_rank" in flags["lib-l3-v01"]
    # No rerank node: its sentence ("Kính lúp đưa nó lên {r_rr}, mất {ms} ms.") is dropped.
    assert diag["lib-l3-v01"] == ("ret.gold_rank:fusion", "Sau phễu, hạng không có mặt.")


def test_boundary_split_on_long_clause_at_128(store: IndexStore) -> None:
    h = handle(L2, CD)
    gold = next(c for c in L2.cases if c.id == "lib-l2-v02").gold[0]
    start, end = find_quote(store.document("qcdt-2024"), gold.quote)
    pieces = [
        c for c in store.chunks(h) if c.doc_id == "qcdt-2024" and c.start < end and start < c.end
    ]
    t = trace(
        L2,
        "lib-l2-v02",
        f"Cần GPA 2,00 [{pieces[0].chunk_id}].",
        included=pieces,
        nodes=[("vs", "vector_search", pieces)],
    )
    flags, diag, ev = run_report(
        LevelEvaluator(L2, L2_RULES, store), [t], {"vs": ("vector_search", h)}
    )
    assert flags["lib-l2-v02"] == ["ret.boundary_split"]
    assert diag["lib-l2-v02"] == (
        "ret.boundary_split",
        f"Câu #2 bị cắt đôi: nửa đầu ở đoạn {pieces[0].chunk_id}, "
        f"nửa sau ở đoạn {pieces[-1].chunk_id}.",
    )
    # Golden grading.answer: gold = chunks that contain a quote, so a piece is not a citation.
    assert not ev.grade_case(t).criteria["cited"]


def test_l2_gold_rank_falls_back_to_gold_missing_template(store: IndexStore) -> None:
    l2_diag = {k: v for k, v in DIAG.items() if not k.startswith("ret.gold_rank")}
    l2_diag["ret.gold_missing"] = "Câu #{n} cần khoản {k1} lẫn khoản {k2}, hạng {rank}, dừng ở {k}."
    ev = LevelEvaluator(L2, rules(diagnosis=l2_diag), store)
    gold2, other = gold_chunk(store, L2, "lib-l2-v01"), chunk_of(store, L2, 18)
    # TD keeps Điều 12 in one chunk: both quotes share it; hand a pack without it.
    assert gold2 == gold_chunk(store, L2, "lib-l2-v01", 1)
    t = trace(
        L2, "lib-l2-v01", "Không rõ.", included=[other], nodes=[("vs", "vector_search", [other])]
    )
    _, diag, _ = run_report(ev, [t], {"vs": ("vector_search", handle(L2))})
    flag, message = diag["lib-l2-v01"]
    assert flag == "ret.gold_rank:vector_search"
    assert message.startswith("Câu #1 cần khoản 2 lẫn khoản 2, hạng ")
    assert message.endswith(", dừng ở 1.")


def test_regression_trap_names_the_underlying_flag_in_words(store: IndexStore) -> None:
    ev = LevelEvaluator(L3, rules(), store)
    t = trace(L3, "lib-l3-t02", "Không rõ.")
    report = ev.report([t], [ev.grade_case(t)], {})
    # The machine key goes in `cause` (the client's "Xem ở" target), never in the sentence.
    assert report["diagnosis"] == [
        {
            "case": "lib-l3-t02",
            "flag": "regression",
            "cause": "ret.gold_missing",
            "message_vi": "Ca của Hà trượt: đoạn đáp án không vào tới thùng.",
        }
    ]


def test_fallback_template_names_the_flag_in_words(store: IndexStore) -> None:
    """A level without a line for the flag (L3 has no llm.cite_unknown) never prints the key."""
    gold = gold_chunk(store, L1, "lib-l1-v01")
    t = trace(L1, "lib-l1-v01", "Theo Điều 99 thì gửi phòng đào tạo.", included=[gold])
    _, diag, _ = run_report(LevelEvaluator(L1, rules(diagnosis={}), store), [t], {})
    assert diag["lib-l1-v01"] == (
        "llm.cite_unknown",
        "Câu #1 chưa đạt: trích nguồn không có trong thùng.",
    )


def test_l2_trap_without_a_flag_says_what_failed(store: IndexStore) -> None:
    """L2 has no trap.failed line: the fallback must not read "chưa đạt: … chưa đạt"."""
    l2_diag = {k: v for k, v in DIAG.items() if k != "trap.failed"}
    gold = gold_chunk(store, L2, "lib-l2-t01")
    # Cited, current pack, no retriever flags: only the answer's content fails.
    t = trace(L2, "lib-l2-t01", f"Không rõ [{gold.chunk_id}].", included=[gold])
    _, diag, _ = run_report(LevelEvaluator(L2, rules(diagnosis=l2_diag), store), [t], {})
    flag, message = diag["lib-l2-t01"]
    assert flag == "trap.failed"
    assert message.endswith(" chưa đạt: nội dung câu trả lời sai hoặc thiếu ý.")


def test_budget_exceeded_is_a_run_level_diagnosis(store: IndexStore) -> None:
    gold = gold_chunk(store, L1, "lib-l1-v01")
    text = GOOD.replace("{gold}", gold.chunk_id)
    traces = [
        trace(L1, "lib-l1-v01", text, included=[gold], tokens=23000),
        trace(L1, "lib-l1-t01", "Quy chế không có thông tin này.", tokens=500),
    ]
    ev = LevelEvaluator(L1, rules(), store)
    grades = [ev.grade_case(t) for t in traces]
    assert ev.score(traces, grades)["tokens"] == 23500
    report = ev.report(traces, grades, {})
    assert report["diagnosis"] == [
        {
            "case": None,
            "flag": "budget.exceeded",
            "message_vi": "Run này tốn 23.500 token, ngân sách là 22.000, 0,5 đoạn/câu.",
        }
    ]
    assert report["gold"]["lib-l1-t01"] == {
        "gold_chunks": [],
        "ranks": {},
        "in_pack": False,
        "flags": [],
    }


def test_budget_line_without_rerank_does_not_talk_about_the_rerank_block(
    store: IndexStore,
) -> None:
    diag = {
        **DIAG,
        "budget.exceeded": "Kính lúp tốn {ms} ms nhưng không tốn token nào.",
        "budget.exceeded:no_rerank": "Mỗi câu mang {avg_docs} đoạn vào thùng.",
    }
    ev = LevelEvaluator(L3, rules(token_budget=100, diagnosis=diag), store)
    gold = gold_chunk(store, L3, "lib-l3-v01")
    plain = trace(L3, "lib-l3-v01", "x", included=[gold], tokens=500)
    rr: list[Node] = [("rr", "rerank", [gold])]
    reranked = trace(L3, "lib-l3-v01", "x", included=[gold], nodes=rr, tokens=500)

    def budget_line(t: CaseTrace) -> str:
        report = ev.report([t], [ev.grade_case(t)], {})
        (line,) = [d for d in report["diagnosis"] if d["flag"] == "budget.exceeded"]
        return line["message_vi"]

    assert budget_line(plain) == "Mỗi câu mang 1,0 đoạn vào thùng."
    assert budget_line(reranked) == "Kính lúp tốn 7 ms nhưng không tốn token nào."


def test_template_values_are_never_formatted(store: IndexStore) -> None:
    template = "Trích {cite}. Lạ: {0} {__class__}."
    ev = LevelEvaluator(L1, rules(diagnosis={"llm.cite_unknown": template}), store)
    t = trace(L1, "lib-l1-v01", "Xem [{n}].")
    _, diag, _ = run_report(ev, [t], {})
    # The player's "{n}" is a value, never rendered again; unknown names drop their sentence.
    assert diag["lib-l1-v01"] == ("llm.cite_unknown", "Trích [{n}].")
    assert render("{x}", {"x": "{n}"}) == "{n}"
