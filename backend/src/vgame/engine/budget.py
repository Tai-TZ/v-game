"""LLM call caps: per-case RunBudget (the real runtime cap, critic fix) and server DailyCap."""

from collections import Counter
from collections.abc import Callable
from datetime import UTC, date, datetime

from vgame.engine.constants import MAX_LLM_CALLS_PER_CASE
from vgame.engine.types import BudgetExceededError, Usage


def _utc_today() -> date:
    return datetime.now(UTC).date()


class RunBudget:
    """One per run. ``reserve`` before every LLM call; a reserved call counts even if it fails
    (it may already have reached the provider). ``commit`` adds the provider usage."""

    def __init__(self, max_calls_per_case: int = MAX_LLM_CALLS_PER_CASE) -> None:
        self._max = max_calls_per_case
        self._calls: Counter[str] = Counter()
        self._usage = Usage()
        self.committed = 0  # reserved - committed = calls cancelled or failed mid-flight

    def reserve(self, case_id: str) -> None:
        if self._calls[case_id] >= self._max:
            raise BudgetExceededError("case")
        self._calls[case_id] += 1

    def commit(self, case_id: str, usage: Usage) -> None:
        self._usage = self._usage + usage
        self.committed += 1

    @property
    def reserved(self) -> int:
        return self._calls.total()

    @property
    def usage(self) -> Usage:
        return self._usage


class DailyCap:
    """Server-wide cap on real (non-replayed) provider calls per UTC day.

    Event-loop only (no lock): reserve() has no await, so it is atomic under asyncio.
    """

    # ponytail: in-memory counter per UTC day, lost on restart and per process;
    # upgrade to Redis INCR with a TTL when there is more than one worker.

    def __init__(self, cap: int, today: Callable[[], date] = _utc_today) -> None:
        self._cap = cap
        self._today = today
        self._day = today()
        self._count = 0

    def reserve(self) -> None:
        day = self._today()
        if day != self._day:
            self._day, self._count = day, 0
        if self._count >= self._cap:
            raise BudgetExceededError("daily")
        self._count += 1
