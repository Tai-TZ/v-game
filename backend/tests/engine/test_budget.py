from datetime import date

import pytest

from vgame.engine.budget import DailyCap, RunBudget
from vgame.engine.types import BudgetExceededError, Usage


def test_run_budget_blocks_the_13th_call_per_case_and_sums_usage() -> None:
    budget = RunBudget()
    for _ in range(12):
        budget.reserve("c1")
        budget.commit("c1", Usage(10, 2))
    with pytest.raises(BudgetExceededError) as exc:
        budget.reserve("c1")
    assert exc.value.scope == "case"
    budget.reserve("c2")  # other cases are independent
    assert budget.usage == Usage(120, 24)
    assert (budget.reserved, budget.committed) == (13, 12)


def test_daily_cap_blocks_then_resets_on_a_new_utc_day() -> None:
    day = [date(2026, 10, 7)]
    cap = DailyCap(2, today=lambda: day[0])
    cap.reserve()
    cap.reserve()
    with pytest.raises(BudgetExceededError) as exc:
        cap.reserve()
    assert exc.value.scope == "daily"
    day[0] = date(2026, 10, 8)
    cap.reserve()


def test_daily_cap_message_says_when_calls_reopen_in_vietnam_time() -> None:
    # DailyCap counts per UTC day: 00:00 UTC is 7:00 in Vietnam (UTC+7, no daylight time).
    message = BudgetExceededError("daily").message_vi
    assert "miễn phí" in message
    assert "7 giờ sáng (giờ Việt Nam)" in message


def test_daily_cap_zero_blocks_everything() -> None:
    with pytest.raises(BudgetExceededError):
        DailyCap(0).reserve()


def test_run_budget_keeps_usage_per_case() -> None:
    budget = RunBudget()
    budget.commit("c1", Usage(10, 2))
    budget.commit("c2", Usage(5, 1))
    budget.commit("c1", Usage(1, 1))
    assert budget.case_usage("c1") == Usage(11, 3)
    assert budget.case_usage("c3") == Usage()
    assert budget.usage == Usage(16, 4)
