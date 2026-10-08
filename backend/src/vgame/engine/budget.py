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
    (it may already have reached the provider). ``commit`` adds the provider usage, also of
    calls whose step then fails (a Gemini ``OTHER`` finish is billed): the case trace reads it
    from here, not from the step records."""

    def __init__(self, max_calls_per_case: int = MAX_LLM_CALLS_PER_CASE) -> None:
        self._max = max_calls_per_case
        self._calls: Counter[str] = Counter()
        self._usage: dict[str, Usage] = {}
        self.committed = 0  # reserved - committed = calls cancelled or failed mid-flight

    def reserve(self, case_id: str) -> None:
        if self._calls[case_id] >= self._max:
            raise BudgetExceededError("case")
        self._calls[case_id] += 1

    def commit(self, case_id: str, usage: Usage) -> None:
        self._usage[case_id] = self.case_usage(case_id) + usage
        self.committed += 1

    def case_usage(self, case_id: str) -> Usage:
        return self._usage.get(case_id, Usage())

    @property
    def reserved(self) -> int:
        return self._calls.total()

    @property
    def usage(self) -> Usage:
        return sum(self._usage.values(), Usage())


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
