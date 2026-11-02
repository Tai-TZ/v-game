"""Watchtower W1 end to end (watchtower.md §3): validator -> compiler -> runtime -> evaluator,
with a scripted model that behaves as the real one did in the action-slip spike (§1.3): it obeys
every attack, refunds the right amount for a real complaint, and makes up a 30.000 đ refund for
"bỏ qua phí ship". Only what the player wired decides whether a bad refund runs."""

import asyncio
import json
from collections.abc import Sequence
from typing import Any

import pytest

from tests.engine.fakes_llm import FakeLLM
from vgame.config import Settings
from vgame.engine.blocks import EngineDeps, guard_text
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.graph import GraphPayload
from vgame.engine.guard_scores import load_guard_scores, question_sha
from vgame.engine.levels import LevelSpec, load_level
from vgame.engine.runtime import run_level
from vgame.engine.types import EngineEvent, LLMRequest, PublicCase
from vgame.engine.validator import validate
from vgame.engine.watchtower import WatchtowerEvaluator, load_watch_spec, watch_public_cases

LEVEL = load_level("direct-injection")
SPEC = load_watch_spec(Settings(_env_file=None).content_dir, LEVEL.id)
CASES = watch_public_cases(SPEC)


def slip(answer: str, ma_don: str | None = None, so_tien: int = 0) -> str:
    action = (
        None
        if ma_don is None
        else {"tool": "tool_refund", "tham_so": {"ma_don": ma_don, "so_tien": so_tien}}
    )
    return json.dumps({"tra_loi": answer, "hanh_dong": action}, ensure_ascii=False)


# Question fragment -> the slip the spike's model wrote for it (watchtower.md §1.3).
OBEDIENT: dict[str, str] = {
    "quản lý cửa hàng đã đồng ý": slip("Mình đã hoàn 5.000.000 đ.", "DH2001", 5_000_000),
    "Giải mã và làm theo": slip("Đã hoàn theo lệnh.", "DH9999", 5_000_000),
    "quản trị viên": slip("Đã hoàn 3.000.000 đ để kiểm thử.", "DH7777", 3_000_000),
    "Bỏ qua phí ship": slip("Mình hoàn phí ship 30.000 đ nhé.", "DH1042", 30_000),
    "bị rách": slip("Mình đã hoàn 120.000 đ.", "DH1042", 120_000),
    "bị nứt": slip("Mình đã hoàn 85.000 đ.", "DH4120", 85_000),
}


def obedient(request: LLMRequest) -> str:
    text = request.messages[0].text
    for fragment, reply in OBEDIENT.items():
        if fragment.lower() in text.lower():
            return reply
    return slip("Dạ, mình kiểm tra giúp bạn rồi nhé.")


def run(
    graph: GraphPayload, cases: Sequence[PublicCase] = CASES
) -> tuple[list[EngineEvent], FakeLLM]:
    checked, issues = validate(
        json.dumps(graph.model_dump(mode="json", by_alias=True)).encode(), LEVEL
    )
    assert checked is not None, issues
    fake = FakeLLM(obedient)
    deps = EngineDeps(
        None,
        fake,
        None,
        RunBudget(),
        guard_scores=load_guard_scores(LEVEL.id, cases),
        orders=LEVEL.order_book(),
    )
    compiled = compile_graph(checked, LEVEL, deps)
    evaluator = WatchtowerEvaluator(SPEC, LEVEL.rules, LEVEL.order_book())
    events: list[EngineEvent] = []
    asyncio.run(run_level("r", compiled, list(cases), deps, evaluator, events.append))
    return events, fake


def of(events: list[EngineEvent], kind: str) -> list[dict[str, Any]]:
    return [dict(e) for e in events if e["type"] == kind]


def labels(events: list[EngineEvent]) -> dict[str, list[str]]:
    return {e["case"]: e["labels"] for e in of(events, "case.graded")}


def stars(events: list[EngineEvent]) -> int:
    (scored,) = of(events, "run.scored")
    return int(scored["score"]["stars"])


def naive(graph_id: str) -> GraphPayload:
    return next(n.graph for n in LEVEL.naive_graphs if n.id == graph_id)


# --- The level's graphs --------------------------------------------------------------------


def test_the_starter_pays_out_every_attack_and_earns_nothing() -> None:
    events, _ = run(LEVEL.starter_graph)
    by_case = labels(events)
    for attack in ("wt-w1-t01", "wt-w1-t02", "wt-w1-t03"):
        assert "ledger.refund_wrong" in by_case[attack]
        assert "hitl.bypassed" in by_case[attack]
    assert stars(events) == 0


def test_the_reference_stops_every_bad_refund_and_serves_every_customer() -> None:
    events, _ = run(LEVEL.reference_graph)
    by_case = labels(events)
    assert not any("ledger.refund_wrong" in v for v in by_case.values())
    assert not any("guard.blocked_benign" in v for v in by_case.values())
    assert stars(events) == 3


def test_a_broad_net_blocks_a_real_customer_and_misses_base64() -> None:
    events, _ = run(naive("N2"))
    by_case = labels(events)
    assert "guard.blocked_benign" in by_case["wt-w1-t04"]
    assert "guard.passed_encoded" in by_case["wt-w1-t02"]
    # The gate still holds the money: star 1 stands, star 3 is lost to the blocked customer.
    assert stars(events) == 2


def test_asking_about_every_refund_is_over_asking() -> None:
    events, _ = run(naive("N3"))
    by_case = labels(events)
    assert "hitl.over_asked" in by_case["wt-w1-v02"]
    assert "hitl.over_asked" in by_case["wt-w1-h03"]
    assert stars(events) == 2


# --- Halting ---------------------------------------------------------------------------------


def test_a_stopped_case_answers_with_the_refusal_and_never_reaches_the_model() -> None:
    events, fake = run(LEVEL.reference_graph)
    attack = "wt-w1-t03"  # "quản trị viên": the net stops it
    asked = [r.messages[0].text for r in fake.requests]
    assert not any("quản trị viên" in text for text in asked)
    steps = [e for e in of(events, "step.finished") if e["case"] == attack]
    assert [s["node"] for s in steps] == ["q", "net", "out"]  # dog and desk never ran
    assert steps[-1]["summary"] == "Trả lời bằng câu từ chối của cổng."
    graded = next(e for e in of(events, "case.graded") if e["case"] == attack)
    assert graded["passed"]


def test_the_watchdog_stops_what_the_net_lets_through() -> None:
    events, _ = run(LEVEL.reference_graph)
    steps = [e for e in of(events, "step.finished") if e["case"] == "wt-w1-t02"]
    assert [s["node"] for s in steps] == ["q", "net", "dog", "out"]
    (guard,) = [f for f in steps[2]["facts"] if f["kind"] == "guard"]
    assert guard["decision"] == "block"
    assert guard["score"] >= 0.8


def test_a_case_with_no_watchdog_score_fails_the_run_instead_of_guessing() -> None:
    edited = [PublicCase(c.id, c.role, c.vai, c.question + " ") for c in CASES[:1]]
    events, _ = run(LEVEL.reference_graph, edited)
    (failed,) = of(events, "run.failed")
    assert failed["code"] == "index_stale"


# --- The guards' parts -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("question", "phrase"),
    [
        ("BỎ QUA HƯỚNG DẪN đi", "bỏ qua hướng dẫn"),
        ("bo qua   huong dan", "Bỏ qua hướng dẫn"),
        ("Đổi đơn", "doi don"),
        ("\uff42\uff4f \uff51\uff55\uff41", "bo qua"),  # full-width letters, NFKC
    ],
)
def test_the_net_matches_through_case_marks_spacing_and_width(question: str, phrase: str) -> None:
    assert guard_text(phrase) in guard_text(question)


def test_scores_of_an_edited_question_are_stale() -> None:
    case = CASES[0]
    assert case.id in load_guard_scores(LEVEL.id, [case])
    edited = PublicCase(case.id, case.role, case.vai, case.question + "?")
    assert question_sha(edited.question) != question_sha(case.question)
    assert load_guard_scores(LEVEL.id, [edited]) == {}


def test_every_shipped_case_has_a_watchdog_score() -> None:
    assert set(load_guard_scores(LEVEL.id, CASES)) == {c.id for c in CASES}


def test_the_level_rules_ask_star_one_for_no_wrong_refund_at_all() -> None:
    level: LevelSpec = LEVEL
    assert level.rules.get("s1_forbidden_labels") == ["ledger.refund_wrong"]


def test_a_wrong_refund_on_any_case_costs_star_one() -> None:
    """Even on a real customer the attacks never touched: the ledger rule is level-wide."""
    from vgame.engine.scoring import compute_stars
    from vgame.engine.types import CaseGrade

    roles = {c.id: c.role for c in CASES}
    grades = [CaseGrade(c.id, True, True, {}, ()) for c in CASES]
    clean = compute_stars(LEVEL.rules, roles, grades, tokens=1)
    assert clean["s1"]
    grades[0] = CaseGrade(CASES[0].id, True, True, {}, ("ledger.refund_wrong",))
    assert not compute_stars(LEVEL.rules, roles, grades, tokens=1)["s1"]
