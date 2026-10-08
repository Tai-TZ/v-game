"""Runs: validate a player graph, run it in the background, stream its events over SSE."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from functools import partial
from typing import Annotated, Final

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from vgame.api.engine import EngineServices, get_engine
from vgame.api.routes.levels import LEVEL_NOT_FOUND
from vgame.content.models import SLUG_PATTERN
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.constants import MAX_PAYLOAD_BYTES
from vgame.engine.grading import LevelEvaluator, public_cases
from vgame.engine.graph import graph_hash
from vgame.engine.index import IndexNotBuiltError, IndexStaleError
from vgame.engine.levels import load_level
from vgame.engine.run_store import IdempotencyConflictError, RunBusyError
from vgame.engine.runtime import CANCELLED_VI, precheck, run_level
from vgame.engine.types import EngineError, EngineEvent, LLMNotConfiguredError, RunFailedEvent
from vgame.engine.validator import validate

logger = logging.getLogger(__name__)

RUN_ID_PATTERN: Final = r"^[0-9a-f]{32}$"
# 16+ chars: a short guessable key must not hand out another player's run.
IDEMPOTENCY_PATTERN: Final = r"^[A-Za-z0-9_-]{16,64}$"
RUN_NOT_FOUND: Final = "Không tìm thấy lượt chạy."
RUN_ALREADY_ENDED: Final = "Lượt chạy này đã kết thúc."
GRAPH_INVALID: Final = "Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại."
JSON_ONLY: Final = "Chỉ nhận đồ thị dạng JSON (Content-Type: application/json)."
# Idle seconds before an SSE comment line: one LLM step can stay silent for up to 20 s, longer
# than some proxies keep an idle stream open.
HEARTBEAT_S: Final = 15.0

router = APIRouter(prefix="/runs", tags=["runs"])


async def _read_capped(request: Request) -> bytes:
    """At most MAX_PAYLOAD_BYTES + 1 bytes: enough for the validator to report P01."""
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_PAYLOAD_BYTES:
            break
    return bytes(body)


def _error(status_code: int, message_vi: str, **extra: object) -> JSONResponse:
    return JSONResponse({"detail": message_vi, **extra}, status_code=status_code)


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        status.HTTP_404_NOT_FOUND: {"description": LEVEL_NOT_FOUND},
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {"description": JSON_ONLY},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Mọi lỗi của đồ thị, gom lại."},
        status.HTTP_409_CONFLICT: {"description": IdempotencyConflictError.message_vi},
        status.HTTP_429_TOO_MANY_REQUESTS: {"description": RunBusyError.message_vi},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Chưa cấu hình LLM hoặc index."},
    },
)
async def create_run(
    request: Request,
    level: Annotated[str, Query(pattern=SLUG_PATTERN)],
    engine: Annotated[EngineServices, Depends(get_engine)],
    idempotency_key: Annotated[str | None, Header(pattern=IDEMPOTENCY_PATTERN)] = None,
) -> JSONResponse:
    """Body: the graph JSON (Part 3 §3.4). Returns ``run_id`` and info-level issues."""
    # JSON only: a cross-site form post cannot burn the LLM budget without a CORS preflight.
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
        return _error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, JSON_ONLY)
    try:
        spec_level = load_level(level)
    except KeyError:
        return _error(status.HTTP_404_NOT_FOUND, LEVEL_NOT_FOUND)

    graph, issues = validate(await _read_capped(request), spec_level)
    if graph is None:
        return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, GRAPH_INVALID, issues=issues)

    if engine.llm is None:
        return _error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            LLMNotConfiguredError.message_vi,
            code="llm_not_configured",
        )
    if engine.store is None:
        if engine.index_stale:
            return _error(
                status.HTTP_503_SERVICE_UNAVAILABLE, IndexStaleError.message_vi, code="index_stale"
            )
        return _error(
            status.HTTP_503_SERVICE_UNAVAILABLE, IndexNotBuiltError.message_vi, code="index_missing"
        )
    deps = EngineDeps(engine.store, engine.llm, engine.reranker, RunBudget())
    try:
        compiled = compile_graph(graph, spec_level, deps)
    except EngineError as exc:  # a chunker variant missing from the built index
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, exc.message_vi, code="index_missing")
    if (failure := precheck(compiled, deps)) is not None:  # e.g. rerank model not downloaded
        return _error(status.HTTP_503_SERVICE_UNAVAILABLE, failure[1], code=failure[0])

    spec = engine.spec(spec_level.id)
    try:
        run_id, is_new = engine.runs.start(spec_level.id, idempotency_key, graph_hash(graph))
    except IdempotencyConflictError as exc:
        return _error(status.HTTP_409_CONFLICT, exc.message_vi)
    except RunBusyError as exc:
        return _error(status.HTTP_429_TOO_MANY_REQUESTS, exc.message_vi)
    if is_new:
        evaluator = LevelEvaluator(spec, spec_level.rules, engine.store)
        task = asyncio.create_task(
            run_level(
                run_id,
                compiled,
                public_cases(spec),
                deps,
                evaluator,
                partial(_emit, engine, run_id),
            )
        )
        engine.tasks[run_id] = task
        task.add_done_callback(lambda t: _finish(engine, run_id, t))
    return JSONResponse(
        {"run_id": run_id, "created": is_new, "issues": issues},
        status_code=status.HTTP_202_ACCEPTED if is_new else status.HTTP_200_OK,
    )


def _emit(engine: EngineServices, run_id: str, event: EngineEvent) -> None:
    engine.runs.append(run_id, event)


def _finish(engine: EngineServices, run_id: str, task: asyncio.Task[None]) -> None:
    """A task cancelled before its first step never emits; close its log so it stops counting
    against the concurrent-run cap and SSE readers are released."""
    engine.tasks.pop(run_id, None)
    if not task.cancelled() and (exc := task.exception()) is not None:
        logger.error("run %s crashed: %s", run_id, type(exc).__name__)
    failed: RunFailedEvent = {
        "type": "run.failed",
        "run": run_id,
        "code": "cancelled",
        "message_vi": CANCELLED_VI,
    }
    with suppress(ValueError):  # already ended with run.finished/run.failed (the normal path)
        engine.runs.append(run_id, failed)


@router.get(
    "/{run_id}/events", responses={status.HTTP_404_NOT_FOUND: {"description": RUN_NOT_FOUND}}
)
async def run_events(
    run_id: Annotated[str, Path(pattern=RUN_ID_PATTERN)],
    engine: Annotated[EngineServices, Depends(get_engine)],
    last_event_id: Annotated[int | None, Header(ge=0)] = None,
) -> StreamingResponse:
    """SSE: ``id: <seq>``, ``event: <type>``, ``data: <json>``. Reconnecting with
    ``Last-Event-ID: n`` replays every event after n, then follows live until the run ends."""
    try:
        events = engine.runs.subscribe(run_id, last_event_id)
    except KeyError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, RUN_NOT_FOUND) from None

    return StreamingResponse(
        _sse(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


async def _sse(events: AsyncIterator[tuple[int, EngineEvent]]) -> AsyncIterator[str]:
    """SSE frames, plus a ``: ping`` comment (ignored by EventSource) after HEARTBEAT_S without
    an event. The pending read survives a ping: cancelling it would close the event generator."""
    pending = asyncio.ensure_future(anext(events))
    try:
        while True:
            done, _ = await asyncio.wait({pending}, timeout=HEARTBEAT_S)
            if not done:
                yield ": ping\n\n"
                continue
            try:
                seq, event = pending.result()
            except StopAsyncIteration:
                return
            data = json.dumps(event, ensure_ascii=False)
            yield f"id: {seq}\nevent: {event['type']}\ndata: {data}\n\n"
            pending = asyncio.ensure_future(anext(events))
    finally:
        pending.cancel()


@router.post(
    "/{run_id}/cancel",
    status_code=status.HTTP_202_ACCEPTED,
    responses={status.HTTP_404_NOT_FOUND: {"description": RUN_NOT_FOUND}},
)
async def cancel_run(
    run_id: Annotated[str, Path(pattern=RUN_ID_PATTERN)],
    engine: Annotated[EngineServices, Depends(get_engine)],
) -> dict[str, bool]:
    task = engine.tasks.get(run_id)
    if task is None:
        detail = RUN_ALREADY_ENDED if run_id in engine.runs else RUN_NOT_FOUND
        code = status.HTTP_409_CONFLICT if run_id in engine.runs else status.HTTP_404_NOT_FOUND
        raise HTTPException(code, detail)
    task.cancel()  # runtime emits step.finished(cancelled) for open steps, then run.failed
    return {"cancelled": True}
