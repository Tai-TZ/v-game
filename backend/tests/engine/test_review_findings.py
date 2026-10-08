"""Correctness-review findings (2026-10-07). Each test fails until its bug is fixed."""

from dataclasses import replace

import pytest

from tests.engine import test_grading as tg
from tests.engine.engine_fixtures import L1, L1_REFERENCE, node, plus, raw
from tests.engine.fakes_retrieval import HashingEmbedder
from vgame.engine.corpus import find_quote, load_documents
from vgame.engine.grading import LevelEvaluator, public_cases
from vgame.engine.index import IndexStore, golden_questions
from vgame.engine.types import CaseTrace, IndexHandle, Usage
from vgame.engine.validator import validate

CD, GL1, GL2, rules, trace = tg.CD, tg.L1, tg.L2, tg.rules, tg.trace


@pytest.fixture(scope="module")
def store() -> IndexStore:
    docs = load_documents(tg.CONTENT)
    questions = golden_questions(tg.CONTENT)
    return IndexStore.build(docs, HashingEmbedder(), questions, variants=[tg.TD, CD])


def test_a_chunk_holding_only_the_quotes_final_period_is_not_a_gold_citation(
    store: IndexStore,
) -> None:
    # Golden grading.answer: cited id must belong to "tập đoạn chứa một quote của gold".
    # At co_dinh/128/0 one chunk of lib-l2-h05 overlaps its quote by a single ".".
    # The sliver also holds h05's whole second quote (khoản 3), which makes it a genuine gold
    # citation, so grade against a spec whose h05 keeps only the first quote.
    case = next(c for c in GL2.cases if c.id == "lib-l2-h05")
    case = replace(case, gold=case.gold[:1])
    spec = replace(GL2, cases=tuple(case if c.id == case.id else c for c in GL2.cases))
    doc = store.document(case.gold[0].doc_id)
    start, end = find_quote(doc, case.gold[0].quote)
    sliver = next(
        c
        for c in store.chunks(IndexHandle(CD, frozenset(GL2.corpus), False))
        if c.doc_id == doc.doc_id
        and c.start < end
        and start < c.end
        and min(end, c.end) - max(start, c.start) == 1
    )
    t = trace(spec, "lib-l2-h05", f"Trả lời [{sliver.chunk_id}].", included=[sliver])
    ev = LevelEvaluator(spec, rules(), store)
    assert ev.grade_case(t).criteria["cited"] is False
    report = ev.report([t], [ev.grade_case(t)], {})
    assert report["gold"]["lib-l2-h05"]["flags"] == ["ret.gold_missing"]
    assert sliver.chunk_id not in report["gold"]["lib-l2-h05"]["gold_chunks"]


def test_a_case_that_never_ran_is_not_diagnosed_as_a_retrieval_miss(store: IndexStore) -> None:
    ev = LevelEvaluator(GL1, rules(), store)
    case = next(c for c in public_cases(GL1) if c.id == "lib-l1-v01")
    t = CaseTrace(case, "timeout", (), None, Usage(), 0)  # run deadline hit before it started
    report = ev.report([t], [ev.grade_case(t)], {})
    assert [d["flag"] for d in report["diagnosis"]] != ["ret.gold_missing"]


def test_an_extra_chunker_cannot_bypass_the_locked_chunker_in_l1() -> None:
    # L1 §5: chunker locked, "mọi tham số chunker (mở ở L2)".
    g = plus(L1_REFERENCE, [node("ix2", "chunker", strategy="co_dinh", chunk_size=1024)], [])
    g["edges"] = [e for e in g["edges"] if e != ["ix.index", "vs.index"]]
    g["edges"].append(["ix2.index", "vs.index"])
    graph, issues = validate(raw(g), L1)
    assert graph is None
    assert any(i["code"] == "G06" for i in issues)
