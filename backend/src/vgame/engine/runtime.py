"""Run one level: cases in parallel (max 3), deadlines, grading, stars, report (§7.4, §8).

Event order: run.started, then per case its step pairs and case.graded, then run.scored and
run.finished; or a single run.failed. Gold appears only in run.finished (D4). Hidden/trap
questions never appear in any event.
"""

import asyncio
import logging
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

from vgame.engine.blocks import EngineDeps
from vgame.engine.compiler import RECURSION_LIMIT, CaseContext, CaseState, CompiledLevelGraph
from vgame.engine.constants import CASE_DEADLINE_S, MAX_CONCURRENT_CASES, RUN_DEADLINE_S
from vgame.engine.index import IndexNotBuiltError
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
LLM_UNAVAILABLE_VI = (
    "Dịch vụ AI đang quá tải hoặc hết lượt hôm nay, lượt này không tính. Hãy thử lại sau."
)
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
    daily_cap_hit: bool = False


async def _run_case(run: _Run, case: PublicCase) -> CaseTrace:
    loop = asyncio.get_running_loop()
    now = loop.time()
    if now >= run.deadline:
        return CaseTrace(case, "timeout", (), None, Usage(), 0)
    if run.daily_cap_hit:
        return CaseTrace(case, "skipped_budget", (), None, Usage(), 0)

    ctx = CaseContext(run.run_id, run.emit, min(now + CASE_DEADLINE_S, run.deadline))
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
    except EngineError:
        status = "llm_error"
    steps = tuple(ctx.steps)
    usage = sum((s.usage for s in steps), Usage())
    ms = round((time.perf_counter() - started) * 1000)
    return CaseTrace(case, status, steps, answer, usage, ms)


def _llm_unavailable(traces: Sequence[CaseTrace], daily_cap_hit: bool) -> bool:
    """No LLM call answered in any case and at least one case failed on the provider side:
    a provider outage, not a 0-star attempt."""
    answered = any(
        s.block == "llm" and s.status in ("ok", "refusal") for t in traces for s in t.steps
    )
    failed = any(
        t.status in ("llm_error", "timeout") or (t.status == "skipped_budget" and daily_cap_hit)
        for t in traces
    )
    return not answered and failed


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
    run = _Run(run_id, compiled, emit, loop.time() + RUN_DEADLINE_S)
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
        if "llm" in compiled.blocks and _llm_unavailable(ordered, run.daily_cap_hit):
            emit(_failed(run_id, "llm_unavailable", LLM_UNAVAILABLE_VI))
            return
        score = evaluator.score(ordered, ordered_grades)
        emit({"type": "run.scored", "run": run_id, "score": score})
        report = evaluator.report(ordered, ordered_grades, compiled.retrievers)
        emit({"type": "run.finished", "run": run_id, "report": report})
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
