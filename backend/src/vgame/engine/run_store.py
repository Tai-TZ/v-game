"""In-memory run registry + event log with SSE replay by ``Last-Event-ID`` (§5.9, §8).

ponytail: runs and events live in this process's RAM (last 200 runs, lost on restart, one
process only); upgrade to Postgres ``run``/``run_event`` tables + Redis pub/sub (Part 2) when
there is more than one worker or progress must survive a restart.
"""

import asyncio
from collections import OrderedDict
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from uuid import uuid4

from vgame.engine.types import EngineError, EngineEvent

_TERMINAL = frozenset({"run.finished", "run.failed"})


class RunBusyError(EngineError):
    message_vi = "Máy chủ miễn phí chạy một lượt mỗi lúc và đang bận."


class IdempotencyConflictError(EngineError):
    message_vi = "Idempotency-Key này đã dùng cho một đồ thị khác."


@dataclass
class _RunLog:
    level_id: str
    idem: tuple[str, str] | None
    events: list[EngineEvent] = field(default_factory=list)
    finished: bool = False
    changed: asyncio.Event = field(default_factory=asyncio.Event)


class RunStore:
    """Event-loop only (no locks): no method awaits between reading and writing state."""

    def __init__(self, *, max_concurrent_runs: int, keep_last: int = 200) -> None:
        self._max_active = max_concurrent_runs
        self._keep_last = keep_last
        self._runs: OrderedDict[str, _RunLog] = OrderedDict()
        self._by_idem: dict[tuple[str, str], tuple[str, str]] = {}  # -> (run_id, graph hash)

    def start(
        self, level_id: str, idempotency_key: str | None, graph_hash: str = ""
    ) -> tuple[str, bool]:
        """(run_id, is_new). The same (level, key, graph) returns the existing run, not a new
        one; the same (level, key) with another graph raises IdempotencyConflictError.
        Raises RunBusyError when ``max_concurrent_runs`` runs are still going."""
        idem = (level_id, idempotency_key) if idempotency_key else None
        if idem is not None and idem in self._by_idem:
            run_id, known = self._by_idem[idem]
            if known != graph_hash:
                raise IdempotencyConflictError("idempotency key reused for another graph")
            return run_id, False
        if sum(not r.finished for r in self._runs.values()) >= self._max_active:
            raise RunBusyError("too many concurrent runs")
        run_id = uuid4().hex  # unguessable: without login the id is the right to view
        self._runs[run_id] = _RunLog(level_id, idem)
        if idem is not None:
            self._by_idem[idem] = (run_id, graph_hash)
        self._evict()
        return run_id, True

    def __contains__(self, run_id: object) -> bool:
        return run_id in self._runs

    def append(self, run_id: str, event: EngineEvent) -> int:
        """Store the event and wake subscribers; returns its SSE id (1-based)."""
        run = self._runs[run_id]
        if run.finished:
            raise ValueError(f"run {run_id} already finished")
        run.events.append(event)
        run.finished = event["type"] in _TERMINAL
        run.changed.set()
        run.changed = asyncio.Event()
        return len(run.events)

    def subscribe(
        self, run_id: str, last_event_id: int | None
    ) -> AsyncIterator[tuple[int, EngineEvent]]:
        """Replays events with seq > last_event_id, then follows live until the run ends.
        Raises KeyError right away for an unknown (or evicted) run."""
        return self._follow(self._runs[run_id], max(last_event_id or 0, 0))

    @staticmethod
    async def _follow(run: _RunLog, seq: int) -> AsyncIterator[tuple[int, EngineEvent]]:
        while True:
            while seq < len(run.events):
                seq += 1
                yield seq, run.events[seq - 1]
            if run.finished:
                return
            await run.changed.wait()

    def _evict(self) -> None:
        excess = len(self._runs) - self._keep_last
        for run_id in [r for r, log in self._runs.items() if log.finished][: max(excess, 0)]:
            log = self._runs.pop(run_id)
            if log.idem is not None:
                self._by_idem.pop(log.idem, None)
