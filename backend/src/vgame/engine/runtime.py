"""Run one level: cases in parallel (max 3), deadlines, grading, stars, report (§7.4, §8).

Event order: run.started, then per case its step pairs and case.graded, then run.scored and
run.finished; or a single run.failed. Gold appears only in run.finished (D4). Hidden/trap
questions never appear in any event.
"""

import asyncio
import logging
import time
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import RECURSION_LIMIT, CaseContext, CaseState, CompiledLevelGraph
from vgame.engine.constants import CASE_DEADLINE_S, MAX_CONCURRENT_CASES, RUN_DEADLINE_S
from vgame.engine.index import IndexNotBuiltError, IndexStaleError
from vgame.engine.llm import case_deadline, seconds_until_pacific_midnight
from vgame.engine.retrieval import RerankerUnavailableError
from vgame.engine.types import (
    BlockType,
    BudgetExceededError,
    CaseGrade,
    CaseInfo,
    CaseStatus,
    CaseTrace,
    EngineError,
    EventSink,
    IndexHandle,
    LLMNotConfiguredError,
    PublicCase,
    RunFailedEvent,
    RunReport,
    StarResult,
    Usage,
)

logger = logging.getLogger(__name__)

INTERNAL_ERROR_VI = "Máy chủ gặp lỗi khi chạy lượt này. Bạn thử chạy lại nhé."
CANCELLED_VI = "Lượt chạy bị dừng giữa chừng. Bạn thử chạy lại nhé."
VIETNAM_UTC_OFFSET = timedelta(hours=7)  # no daylight saving time
_RETRIEVERS: frozenset[BlockType] = frozenset({"vector_search", "bm25_search"})


class Evaluator(Protocol):
    """``grading.LevelEvaluator``; a Protocol so runtime tests can use a gold-free double."""

    def grade_case(self, trace: CaseTrace) -> CaseGrade: ...

    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult: ...

    def report(
        self,
        traces: Sequence[CaseTrace],
        grades: Sequence[CaseGrade],
        retrievers: Mapping[str, tuple[BlockType, IndexHandle]],
    ) -> RunReport: ...


def precheck(compiled: CompiledLevelGraph, deps: EngineDeps) -> tuple[str, str] | None:
    """(code, message_vi) when the run cannot start; checked before any event."""
    if compiled.blocks & _RETRIEVERS and deps.store is None:
        return "index_missing", IndexNotBuiltError.message_vi
    if "rerank" in compiled.blocks and deps.reranker is None:
        return "rerank_unavailable", RerankerUnavailableError.message_vi
    if "llm" in compiled.blocks and deps.llm is None:
        return "llm_not_configured", LLMNotConfiguredError.message_vi
    return None


def _failed(run_id: str, code: str, message_vi: str) -> RunFailedEvent:
    return {"type": "run.failed", "run": run_id, "code": code, "message_vi": message_vi}


@dataclass
class _Run:
    run_id: str
    compiled: CompiledLevelGraph
    emit: EventSink
    deadline: float
    budget: RunBudget
    daily_cap_hit: bool = False


async def _run_case(run: _Run, case: PublicCase) -> CaseTrace:
    loop = asyncio.get_running_loop()
    now = loop.time()
    if now >= run.deadline:
        return CaseTrace(case, "timeout", (), None, Usage(), 0)
    if run.daily_cap_hit:
        return CaseTrace(case, "skipped_budget", (), None, Usage(), 0)

    ctx = CaseContext(run.run_id, run.emit, min(now + CASE_DEADLINE_S, run.deadline))
    # Each case runs in its own task (own context): the LLM model chain reads this to skip a
    # model whose next free slot is past the deadline. loop.time() == time.monotonic().
    case_deadline.set(ctx.deadline)
    started = time.perf_counter()
    status: CaseStatus = "ok"
    answer = None
    state: CaseState = {"case": case, "ports": {}, "answer": None}
    try:
        async with asyncio.timeout_at(ctx.deadline):
            final = await run.compiled.graph.ainvoke(
                state,
                {"configurable": {"case_ctx": ctx}, "recursion_limit": RECURSION_LIMIT},
            )
        answer = final["answer"]
        if any(s.status == "refusal" for s in ctx.steps):
            status = "refusal"
    except TimeoutError:
        status = "timeout"
    except BudgetExceededError as exc:
        status = "skipped_budget"
        run.daily_cap_hit = run.daily_cap_hit or exc.scope == "daily"
    except EngineError as exc:
        status = exc.step_status
    steps = tuple(ctx.steps)
    usage = run.budget.case_usage(case.id)  # every committed call, also of a failed step
    ms = round((time.perf_counter() - started) * 1000)
    return CaseTrace(case, status, steps, answer, usage, ms)


def llm_unavailable_vi(daily_cap_hit: bool, now: datetime) -> str:
    """run.failed{llm_unavailable}: says when calls come back, in Vietnam time. Our DailyCap
    resets at 00:00 UTC (7:00); Gemini's per-day quotas at midnight Pacific time."""
    if daily_cap_hit:
        return (
            "Máy chủ đã dùng hết lượt gọi AI miễn phí của hôm nay nên lượt này không tính. "
            "Lượt gọi mở lại lúc 7 giờ sáng (giờ Việt Nam). "
            "Đồ thị khởi đầu, nếu chưa sửa, vẫn chạy được vì đã có kết quả lưu sẵn."
        )
    reset = now + timedelta(seconds=seconds_until_pacific_midnight(now)) + VIETNAM_UTC_OFFSET
    return (
        "Dịch vụ AI miễn phí đang quá tải hoặc đã hết hạn mức của hôm nay nên lượt này không "
        "tính. Bạn thử lại sau khoảng 1 phút; nếu vẫn lỗi thì hạn mức mở lại lúc "
        f"{reset:%H:%M} (giờ Việt Nam)."
    )


def _llm_unavailable(traces: Sequence[CaseTrace], daily_cap_hit: bool) -> bool:
    """The score would not be the player's: a case lost its answer to DailyCap or to the
    provider (llm_error), even if other cases answered (replayed ones answer during an outage;
    a rerun replays them for free). A timeout counts only when no case answered and it hit the
    llm step: a slow graph is the player's, a case that ran out of time in rerank never called
    the AI."""
    if daily_cap_hit or any(t.status == "llm_error" for t in traces):
        return True
    llm_steps = [s for t in traces for s in t.steps if s.block == "llm"]
    answered = any(s.status in ("ok", "refusal") for s in llm_steps)
    return not answered and any(s.status == "timeout" for s in llm_steps)


async def run_level(
    run_id: str,
    compiled: CompiledLevelGraph,
    cases: Sequence[PublicCase],
    deps: EngineDeps,
    evaluator: Evaluator,
    emit: EventSink,
) -> None:
    """Always ends with exactly one run.finished or run.failed."""
    failure = precheck(compiled, deps)
    if failure is not None:
        emit(_failed(run_id, failure[0], failure[1]))
        return

    loop = asyncio.get_running_loop()
    run = _Run(run_id, compiled, emit, loop.time() + RUN_DEADLINE_S, deps.budget)
    traces: dict[str, CaseTrace] = {}
    grades: dict[str, CaseGrade] = {}
    gate = asyncio.Semaphore(MAX_CONCURRENT_CASES)

    async def one(case: PublicCase) -> None:
        async with gate:
            trace = await _run_case(run, case)
        grade = evaluator.grade_case(trace)
        traces[case.id], grades[case.id] = trace, grade
        emit(
            {
                "type": "case.graded",
                "run": run_id,
                "case": case.id,
                "status": trace.status,
                "passed": grade.passed,
                "counted": grade.counted,
                "criteria": dict(grade.criteria),
                "labels": list(grade.labels),
            }
        )

    try:
        infos: list[CaseInfo] = []
        for c in cases:
            info: CaseInfo = {"id": c.id, "role": c.role, "vai": c.vai}
            if c.role == "visible":
                info["question"] = c.question
            infos.append(info)
        emit(
            {
                "type": "run.started",
                "run": run_id,
                "level": compiled.level_id,
                "cases": infos,
                "ingestion": list(compiled.ingestion),
            }
        )
        async with asyncio.TaskGroup() as tg:
            for c in cases:
                tg.create_task(one(c))
        ordered = [traces[c.id] for c in cases]
        ordered_grades = [grades[c.id] for c in cases]
        # A server-side fault (question or variant missing from the index), not the player's.
        if any(t.status == "index_error" for t in ordered):
            emit(_failed(run_id, "index_stale", IndexStaleError.message_vi))
            return
        if "llm" in compiled.blocks and _llm_unavailable(ordered, run.daily_cap_hit):
            message = llm_unavailable_vi(run.daily_cap_hit, datetime.now(UTC))
            emit(_failed(run_id, "llm_unavailable", message))
            return
        score = evaluator.score(ordered, ordered_grades)
        emit({"type": "run.scored", "run": run_id, "score": score})
        report = evaluator.report(ordered, ordered_grades, compiled.retrievers)
        models = Counter(
            f["model"] for t in ordered for s in t.steps for f in s.facts if f["kind"] == "llm"
        )
        emit({"type": "run.finished", "run": run_id, "report": report, "models": dict(models)})
    except asyncio.CancelledError:
        emit(_failed(run_id, "cancelled", CANCELLED_VI))
        raise
    except Exception:
        # EngineError messages are secret-free by contract (types.py), so the trace is safe.
        logger.exception("run %s failed", run_id)
        emit(_failed(run_id, "internal", INTERNAL_ERROR_VI))
    finally:  # reserved - committed = calls lost to cancel/timeout that may still be billed
        logger.info(
            "run %s llm reserved=%d committed=%d",
            run_id,
            deps.budget.reserved,
            deps.budget.committed,
        )
