import asyncio
import json
from collections import Counter
from collections.abc import Sequence
from typing import Any

import pytest

from tests.engine.engine_fixtures import (
    L1,
    L1_REFERENCE,
    L1_STARTER,
    L3,
    L3_REFERENCE,
    Graph,
    RecordingEvaluator,
    cases,
    small_store,
)
from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_retrieval import OverlapReranker
from vgame.engine import runtime
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.constants import SUMMARY_MAX_CHARS
from vgame.engine.grading import LevelEvaluator
from vgame.engine.graph import GraphPayload
from vgame.engine.levels import LevelSpec
from vgame.engine.types import (
    BudgetExceededError,
    EngineEvent,
    LLMCallError,
    LLMClient,
    LLMRequest,
    LLMResponse,
    PublicCase,
    Usage,
)

_DEFAULT = object()


def _evaluator_fits_the_protocol(evaluator: LevelEvaluator) -> runtime.Evaluator:
    return evaluator  # mypy checks that grading.LevelEvaluator satisfies runtime.Evaluator


def make_deps(
    *,
    llm: Any = _DEFAULT,
    store: bool = False,
    reranker: Any = _DEFAULT,
    budget: RunBudget | None = None,
) -> EngineDeps:
    return EngineDeps(
        small_store() if store else None,
        FakeLLM("Trả lời [abc].") if llm is _DEFAULT else llm,
        OverlapReranker() if reranker is _DEFAULT else reranker,
        budget or RunBudget(),
    )


async def _run(
    g: Graph,
    level: LevelSpec,
    cs: Sequence[PublicCase],
    deps: EngineDeps,
    evaluator: RecordingEvaluator,
    events: list[EngineEvent],
) -> None:
    compiled = compile_graph(GraphPayload.model_validate(g), level, deps)
    await runtime.run_level("r1", compiled, cs, deps, evaluator, events.append)


def run(
    g: Graph,
    level: LevelSpec = L1,
    cs: Sequence[PublicCase] | None = None,
    *,
    evaluator: RecordingEvaluator | None = None,
    **deps: Any,
) -> list[EngineEvent]:
    events: list[EngineEvent] = []
    asyncio.run(
        _run(g, level, cs or cases(1), make_deps(**deps), evaluator or RecordingEvaluator(), events)
    )
    assert_invariants(events)
    return events


def assert_invariants(events: list[EngineEvent]) -> None:
    """Steps pair up per (case, node), summaries are short, one terminal event at the end."""
    open_steps: Counter[tuple[str, str]] = Counter()
    graded: set[str] = set()
    for e in events:
        if e["type"] == "step.started":
            assert e["case"] not in graded
            open_steps[(e["case"], e["node"])] += 1
        elif e["type"] == "step.finished":
            open_steps[(e["case"], e["node"])] -= 1
            assert len(e["summary"]) <= SUMMARY_MAX_CHARS
        elif e["type"] == "case.graded":
            graded.add(e["case"])
    assert set(open_steps.values()) <= {0}
    terminal = [e for e in events if e["type"] in ("run.finished", "run.failed")]
    assert len(terminal) == 1
    assert terminal[0] is events[-1]


def steps(events: list[EngineEvent], case: str) -> list[tuple[str, str]]:
    return [
        (e["node"], e["status"])
        for e in events
        if e["type"] == "step.finished" and e["case"] == case
    ]


def graded(events: list[EngineEvent]) -> dict[str, str]:
    return {e["case"]: e["status"] for e in events if e["type"] == "case.graded"}


# --- Happy paths ---------------------------------------------------------------------------


def test_golden_event_sequence_for_one_case() -> None:
    events = run(L1_STARTER)
    shape = [(e["type"], e.get("node")) for e in events]
    assert shape == [
        ("run.started", None),
        ("step.started", "q"),
        ("step.finished", "q"),
        ("step.started", "pk"),
        ("step.finished", "pk"),
        ("step.started", "llm"),
        ("step.finished", "llm"),
        ("step.started", "out"),
        ("step.finished", "out"),
        ("case.graded", None),
        ("run.scored", None),
        ("run.finished", None),
    ]
    started = events[0]
    assert started["type"] == "run.started"
    assert started["level"] == "grounded-citation"
    finished = [e for e in events if e["type"] == "step.finished"]
    assert [e["summary"] for e in finished if e["node"] in ("q", "out")] == [
        "Nhận câu hỏi.",
        "Đã ghi câu trả lời.",
    ]


def test_reference_run_with_retrieval_aggregates_usage() -> None:
    evaluator = RecordingEvaluator()
    events = run(L1_REFERENCE, cs=cases(3), store=True, evaluator=evaluator)
    assert graded(events) == {"c1": "ok", "c2": "ok", "c3": "ok"}
    started = events[0]
    assert started["type"] == "run.started"
    assert started["ingestion"][0]["chunks"] == 84
    llm_steps = [e for e in events if e["type"] == "step.finished" and e["block"] == "llm"]
    kinds = {f["kind"] for e in events if e["type"] == "step.finished" for f in e["facts"]}
    assert kinds == {"retrieved", "pack", "llm"}
    for trace in evaluator.traces:
        assert trace.answer is not None
        assert trace.answer.cited_ids == ("abc",)
        assert trace.usage == sum((s.usage for s in trace.steps), Usage())
        assert trace.usage.tokens == trace.usage.input_tokens + trace.usage.output_tokens > 0
    total_in = sum(e["tokens"]["in"] for e in llm_steps)
    assert total_in == sum(t.usage.input_tokens for t in evaluator.traces)
    scored = next(e for e in events if e["type"] == "run.scored")
    assert scored["score"]["tokens"] == sum(t.usage.tokens for t in evaluator.traces)


def test_l3_reference_runs_every_block() -> None:
    events = run(L3_REFERENCE, L3, store=True)
    assert [s for _, s in steps(events, "c1")] == ["ok"] * 8
    summaries = {e["node"]: e["summary"] for e in events if e["type"] == "step.finished"}
    assert summaries["fu"].startswith("Gộp 2 danh sách (RRF)")
    assert summaries["rr"].startswith("Xếp lại ")
    assert summaries["pk"].startswith("Thùng: ")


def test_hidden_questions_never_leave_the_engine() -> None:
    cs = cases(3, hidden=[2])
    events = run(L1_REFERENCE, cs=cs, store=True, llm=FakeLLM(lambda r: r.messages[0].text[-30:]))
    text = json.dumps(events, ensure_ascii=False)
    assert "BÍ MẬT" not in text
    assert "Câu 1: thời gian bảo lưu?" in text  # visible questions are public
    infos = {c["id"]: c for c in events[0]["cases"]}  # type: ignore[typeddict-item]
    assert "question" not in infos["c2"]
    llm_facts = {
        e["case"]: e["facts"][0]
        for e in events
        if e["type"] == "step.finished" and e["block"] == "llm"
    }
    assert "answer" in llm_facts["c1"]
    assert "answer" not in llm_facts["c2"]


# --- Failure paths keep start/finish pairs -------------------------------------------------


def test_case_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(runtime, "CASE_DEADLINE_S", 0.2)
    events = run(L1_STARTER, llm=FakeLLM("x", delay_s=5))
    assert steps(events, "c1") == [("q", "ok"), ("pk", "ok"), ("llm", "timeout")]
    assert graded(events) == {"c1": "timeout"}
    assert events[-1]["type"] == "run.failed"  # no LLM call answered: not a scored attempt
    assert events[-1]["code"] == "llm_unavailable"


def test_run_deadline_times_out_running_and_waiting_cases(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(runtime, "RUN_DEADLINE_S", 0.5)
    events = run(L1_STARTER, cs=cases(7), llm=FakeLLM("x", delay_s=0.3))
    status = graded(events)
    assert [status[f"c{i}"] for i in range(1, 8)] == ["ok"] * 3 + ["timeout"] * 4
    assert steps(events, "c4")[-1] == ("llm", "timeout")
    assert steps(events, "c7") == []  # never started: graded without any step
    assert events[-1]["type"] == "run.finished"


def test_case_budget_exhausted() -> None:
    events = run(L1_STARTER, budget=RunBudget(max_calls_per_case=0))
    assert steps(events, "c1")[-1] == ("llm", "budget")
    assert graded(events) == {"c1": "skipped_budget"}
    llm_step = next(e for e in events if e["type"] == "step.finished" and e["node"] == "llm")
    assert llm_step["summary"] == "Ca này đã dùng hết số lời gọi LLM cho phép."


class DailyCapHit:
    provider = "fake"
    model = "fake"

    async def complete(self, request: LLMRequest) -> LLMResponse:
        await asyncio.sleep(0.01)
        raise BudgetExceededError("daily")


def test_daily_cap_skips_cases_that_have_not_started() -> None:
    client: LLMClient = DailyCapHit()
    events = run(L1_STARTER, cs=cases(5), llm=client)
    assert set(graded(events).values()) == {"skipped_budget"}
    assert steps(events, "c1")[-1] == ("llm", "budget")
    assert steps(events, "c4") == []
    assert steps(events, "c5") == []


def test_llm_error() -> None:
    events = run(L1_STARTER, llm=FakeLLM("x", fail=LLMCallError("upstream 500", status=500)))
    assert steps(events, "c1")[-1] == ("llm", "llm_error")
    assert graded(events) == {"c1": "llm_error"}
    assert "500" not in json.dumps(events)  # only the Vietnamese message reaches players


def test_provider_outage_on_every_case_is_not_scored() -> None:
    events = run(
        L1_STARTER, cs=cases(3), llm=FakeLLM("x", fail=LLMCallError("upstream 503", status=503))
    )
    assert set(graded(events).values()) == {"llm_error"}
    assert not [e for e in events if e["type"] == "run.scored"]
    assert events[-1]["type"] == "run.failed"
    assert events[-1]["code"] == "llm_unavailable"
    assert events[-1]["message_vi"] == runtime.LLM_UNAVAILABLE_VI


def test_one_answered_case_keeps_the_run_scored() -> None:
    def flaky(request: LLMRequest) -> str:
        if any("Câu 2:" in m.text for m in request.messages):
            raise LLMCallError("upstream 503", status=503)
        return "Trả lời [abc]."

    events = run(L1_STARTER, cs=cases(2), llm=FakeLLM(flaky))
    assert graded(events) == {"c1": "ok", "c2": "llm_error"}
    assert events[-1]["type"] == "run.finished"


def test_provider_error_finish_is_an_llm_error_not_an_answer() -> None:
    # Gemini finish reasons like OTHER map to stop_reason="error" (returned, not raised).
    events = run(L1_STARTER, llm=FakeLLM("", stop_reason="error"))
    assert steps(events, "c1")[-1] == ("llm", "llm_error")
    assert graded(events) == {"c1": "llm_error"}


def test_refusal_still_reaches_output() -> None:
    evaluator = RecordingEvaluator()
    events = run(L1_STARTER, llm=FakeLLM("Không.", stop_reason="refusal"), evaluator=evaluator)
    assert steps(events, "c1")[-2:] == [("llm", "refusal"), ("out", "ok")]
    assert graded(events) == {"c1": "refusal"}
    assert evaluator.traces[0].answer is not None


def test_cancelling_the_run_finishes_open_steps(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO", logger=runtime.__name__)
    events: list[EngineEvent] = []

    async def scenario() -> None:
        deps = make_deps(llm=FakeLLM("x", delay_s=5))
        task = asyncio.create_task(
            _run(L1_STARTER, L1, cases(2), deps, RecordingEvaluator(), events)
        )
        await asyncio.sleep(0.2)  # both cases are now inside the 5 s LLM call
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(scenario())
    assert_invariants(events)
    assert steps(events, "c1")[-1] == ("llm", "cancelled")
    assert events[-1]["type"] == "run.failed"
    assert events[-1]["code"] == "cancelled"
    assert "run r1 llm reserved=2 committed=0" in caplog.messages  # hidden spend is visible


class Concurrency:
    provider = "fake"
    model = "fake"

    def __init__(self) -> None:
        self.now = self.peak = 0

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self.now += 1
        self.peak = max(self.peak, self.now)
        await asyncio.sleep(0.05)
        self.now -= 1
        return LLMResponse("x", "end", Usage(1, 1), "fake")


def test_at_most_three_cases_run_at_once() -> None:
    client = Concurrency()
    events = run(L1_STARTER, cs=cases(7), llm=client)
    assert client.peak == 3
    assert len(graded(events)) == 7


# --- Pre-checks and internal errors --------------------------------------------------------


@pytest.mark.parametrize(
    ("g", "level", "deps", "code"),
    [
        (L1_STARTER, L1, {"llm": None}, "llm_not_configured"),
        (L1_REFERENCE, L1, {"store": False}, "index_missing"),
        (L3_REFERENCE, L3, {"store": True, "reranker": None}, "rerank_unavailable"),
    ],
)
def test_prechecks_fail_before_any_other_event(
    g: Graph, level: LevelSpec, deps: dict[str, Any], code: str
) -> None:
    events = run(g, level, **deps)
    assert len(events) == 1
    failed = events[0]
    assert failed["type"] == "run.failed"
    assert failed["code"] == code
    assert failed["message_vi"]


def test_internal_error_fails_the_run_generically() -> None:
    events = run(L1_STARTER, cs=cases(3), evaluator=RecordingEvaluator(fail_on="c2"))
    failed = events[-1]
    assert failed["type"] == "run.failed"
    assert failed["code"] == "internal"
    assert "evaluator bug" not in json.dumps(events)
