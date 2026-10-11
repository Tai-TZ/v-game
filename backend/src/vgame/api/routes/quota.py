"""Quota (roadmap-v0.4 §5.1, daily-shift §3): the server's DailyCap, the shared reserve R and
the learner share P, and the refund of a sample run from R.

ponytail: no login before T2, so anyone can draw R down; the harm is only that refunds run out
early, the hard ceiling stays DailyCap. "First sample run per level / once a day per learner"
is the client's to keep until then.
"""

from collections.abc import Sequence
from datetime import UTC, datetime, time, timedelta
from typing import Annotated, Final

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from vgame.api.engine import EngineServices, get_engine
from vgame.api.routes.runs import RUN_ID_PATTERN, RUN_NOT_FOUND
from vgame.engine.types import EngineEvent

MAX_REFUND: Final = 3
SAMPLE_CASES: Final = 3  # visible cases per Library level (test_api_quota checks)
NO_STORE: Final = {"Cache-Control": "no-store"}
# code -> Vietnamese message of a refused refund (409).
REFUSED_VI: Final = {
    "not_finished": "Chỉ hoàn được lượt đã chạy xong.",
    "not_sample_run": "Chỉ hoàn lượt Thử 3 câu mẫu; lượt chấm sao không được hoàn.",
    "samples_not_passed": "Chỉ hoàn lượt mẫu có cả 3 câu mẫu đạt.",
    "already_refunded": "Lượt này đã được hoàn rồi.",
    "reserve_empty": (
        "Quỹ hoàn chung của lớp hôm nay đã hết: quỹ chia theo thứ tự, ai đạt trước được trước."
    ),
}

router = APIRouter(prefix="/quota", tags=["quota"])


class RefundRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: Annotated[str, Field(pattern=RUN_ID_PATTERN)]


def _next_utc_midnight() -> datetime:
    return datetime.combine(datetime.now(UTC).date() + timedelta(days=1), time(), UTC)


@router.get("")
async def get_quota(engine: Annotated[EngineServices, Depends(get_engine)]) -> JSONResponse:
    """``estimate`` stays true until T1: every counter lives in RAM and resets on restart."""
    cap = engine.daily_cap
    body = {
        "cap": cap.cap,
        "used": cap.used,
        "remaining": cap.remaining,
        "resets_at": _next_utc_midnight().isoformat(),
        "estimate": True,
        "reserve_left": engine.reserve.remaining,
        "learner_daily": engine.learner_daily,
    }
    return JSONResponse(body, headers=NO_STORE)


def _refundable_calls(events: Sequence[EngineEvent]) -> int | str:
    """Fresh (non-replayed) LLM calls of a finished sample run whose cases all passed, capped
    at MAX_REFUND; otherwise the refusal code."""
    if not events or events[-1]["type"] != "run.finished":
        return "not_finished"
    if events[-1].get("scope") != "mau":
        return "not_sample_run"
    graded = [e for e in events if e["type"] == "case.graded"]
    if len(graded) != SAMPLE_CASES or not all(e["passed"] for e in graded):
        return "samples_not_passed"
    fresh = sum(
        not fact["replayed"]
        for e in events
        if e["type"] == "step.finished"
        for fact in e["facts"]
        if fact["kind"] == "llm"
    )
    return min(fresh, MAX_REFUND)


@router.post(
    "/refund",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": RUN_NOT_FOUND},
        status.HTTP_409_CONFLICT: {"description": " / ".join(REFUSED_VI.values())},
    },
)
async def refund(
    body: RefundRequest, engine: Annotated[EngineServices, Depends(get_engine)]
) -> JSONResponse:
    """Refunds a sample run's fresh calls from R, at most 3, once per run. A run that replayed
    every answer is refunded 0."""
    try:
        events = engine.runs.events(body.run_id)
    except KeyError:
        return JSONResponse({"detail": RUN_NOT_FOUND}, status.HTTP_404_NOT_FOUND)
    calls = _refundable_calls(events)
    if isinstance(calls, int) and engine.runs.refunded(body.run_id):
        calls = "already_refunded"
    if isinstance(calls, int) and calls > engine.reserve.remaining:
        # All or nothing: the claim is one-shot, so paying part of it would destroy the rest.
        calls = "reserve_empty"  # the run keeps its refund for when R refills
    if isinstance(calls, str):
        return JSONResponse({"detail": REFUSED_VI[calls], "code": calls}, status.HTTP_409_CONFLICT)
    engine.runs.mark_refunded(body.run_id)
    refunded = engine.reserve.take(calls)
    return JSONResponse(
        {"run_id": body.run_id, "refunded": refunded, "reserve_left": engine.reserve.remaining},
        headers=NO_STORE,
    )
