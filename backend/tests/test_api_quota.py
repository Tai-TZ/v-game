"""Wave B engine prerequisites (roadmap-v0.4 §5 B0, §5.1): the sample scope of POST /api/runs,
GET /api/quota and the reserve refund. Offline: Oracle LLM, fake models."""

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_oracle import LEVEL_IDS, oracle_llm, spec
from tests.test_api_runs import JSON, L1, engine, post_run, read_events, reference
from vgame.api.engine import EngineServices
from vgame.config import Settings
from vgame.engine.budget import DailyCap
from vgame.engine.llm import ReplayingLLM
from vgame.engine.replay import ReplayStore
from vgame.engine.types import LLMClient
from vgame.main import create_app

VISIBLE = [c.id for c in spec(L1).cases if c.role == "visible"]


@pytest.fixture
def make_client(settings: Settings) -> Iterator[Callable[[EngineServices], TestClient]]:
    clients: list[TestClient] = []

    def make(services: EngineServices) -> TestClient:
        client = TestClient(create_app(settings, engine=services))
        clients.append(client.__enter__())
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)


def services(llm: LLMClient | None = None, *, reserve: int = 17) -> EngineServices:
    built = engine(llm or oracle_llm())
    built.reserve = DailyCap(reserve)
    return built


def mau_run(client: TestClient, body: str | None = None, **headers: str) -> str:
    response = client.post(
        f"/api/runs?level={L1}&scope=mau", content=body or reference(), headers=JSON | headers
    )
    assert response.status_code == 202, response.text
    run_id: str = response.json()["run_id"]
    read_events(client, run_id)  # waits for the end of the run
    return run_id


def refund(client: TestClient, run_id: str) -> Any:
    return client.post("/api/quota/refund", json={"run_id": run_id})


# --- scope=mau -------------------------------------------------------------------------------


def test_sample_run_streams_the_three_visible_cases_without_stars(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    response = client.post(f"/api/runs?level={L1}&scope=mau", content=reference(), headers=JSON)
    assert response.status_code == 202
    events = read_events(client, response.json()["run_id"])
    kinds = [kind for _, kind, _ in events]
    assert "run.scored" not in kinds
    assert kinds[-1] == "run.finished"
    started, finished = events[0][2], events[-1][2]
    assert started["scope"] == finished["scope"] == "mau"
    assert [c["id"] for c in started["cases"]] == VISIBLE
    assert {data["case"] for _, kind, data in events if kind == "case.graded"} == set(VISIBLE)
    assert set(finished["report"]["gold"]) == set(VISIBLE)


def test_unknown_scope_is_a_422(make_client: Callable[[EngineServices], TestClient]) -> None:
    client = make_client(services())
    response = client.post(
        f"/api/runs?level={L1}&scope=bien_the", content=reference(), headers=JSON
    )
    assert response.status_code == 422
    assert response.json()["fields"] == ["query.scope"]


def test_one_idempotency_key_cannot_serve_a_sample_and_a_star_run(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    key = {"Idempotency-Key": "player-key-000001"}
    mau_run(client, **key)
    assert post_run(client, reference(), **key).status_code == 409


# --- GET /api/quota --------------------------------------------------------------------------


def test_quota_reports_the_daily_cap_reserve_and_learner_share(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    built = services()
    built.daily_cap.reserve()
    built.daily_cap.reserve()
    client = make_client(built)
    response = client.get("/api/quota")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    resets_at = datetime.fromisoformat(body.pop("resets_at"))
    assert body == {
        "cap": 500,
        "used": 2,
        "remaining": 498,
        "estimate": True,
        "reserve_left": 17,
        "learner_daily": 13,
    }
    # DailyCap and R reset at 00:00 UTC (07:00 in Vietnam).
    now = datetime.now(UTC)
    assert resets_at.utcoffset() == timedelta(0)
    assert (resets_at.hour, resets_at.minute, resets_at.second) == (0, 0, 0)
    assert now < resets_at <= now + timedelta(days=1)


def test_quota_reads_its_numbers_from_settings(settings: Settings) -> None:
    custom = settings.model_copy(
        update={"daily_llm_call_cap": 200, "quota_reserve_calls": 5, "quota_learner_calls": 26}
    )
    with TestClient(create_app(custom)) as client:  # no key, no index: quota still answers
        body = client.get("/api/quota").json()
    assert (body["cap"], body["used"], body["remaining"]) == (200, 0, 200)
    assert (body["reserve_left"], body["learner_daily"]) == (5, 26)


# --- POST /api/quota/refund ------------------------------------------------------------------


def test_refund_takes_the_sample_runs_fresh_calls_from_the_reserve_once(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    run_id = mau_run(client)  # Oracle: 3 fresh (non-replayed) calls, all 3 samples pass

    first = refund(client, run_id)
    assert first.status_code == 200
    assert first.json() == {"run_id": run_id, "refunded": 3, "reserve_left": 14}
    assert client.get("/api/quota").json()["reserve_left"] == 14

    again = refund(client, run_id)
    assert again.status_code == 409
    assert again.json() == {"detail": "Lượt này đã được hoàn rồi.", "code": "already_refunded"}
    assert client.get("/api/quota").json()["reserve_left"] == 14


def test_refund_is_capped_by_the_runs_fresh_calls(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    llm = ReplayingLLM(oracle_llm(), ReplayStore(":memory:"))
    client = make_client(services(llm))
    assert refund(client, mau_run(client)).json()["refunded"] == 3  # stores the 3 answers
    replayed = refund(client, mau_run(client))  # same graph: every answer replayed, 0 calls
    assert replayed.status_code == 200
    assert replayed.json()["refunded"] == 0
    assert replayed.json()["reserve_left"] == 14


def test_refund_takes_at_most_what_the_reserve_has_left(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services(reserve=1))
    run_id = mau_run(client)
    assert refund(client, run_id).json() == {"run_id": run_id, "refunded": 1, "reserve_left": 0}


def test_an_empty_reserve_refuses_without_using_up_the_runs_refund(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    built = services(reserve=0)
    client = make_client(built)
    run_id = mau_run(client)
    empty = refund(client, run_id)
    assert empty.status_code == 409
    assert empty.json()["code"] == "reserve_empty"
    assert "Quỹ hoàn chung" in empty.json()["detail"]
    built.reserve = DailyCap(17)  # e.g. the next UTC day
    assert refund(client, run_id).json()["refunded"] == 3


def test_a_star_run_is_never_refunded(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    run_id = post_run(client, reference()).json()["run_id"]
    read_events(client, run_id)
    response = refund(client, run_id)
    assert response.status_code == 409
    assert response.json()["code"] == "not_sample_run"


def test_a_sample_run_with_a_failed_case_is_not_refunded(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services(FakeLLM("Không rõ.")))  # answers, but no sample passes
    response = refund(client, mau_run(client))
    assert response.status_code == 409
    assert response.json()["code"] == "samples_not_passed"


def test_a_run_still_going_is_not_refunded(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services(FakeLLM("x", delay_s=5)))
    response = client.post(f"/api/runs?level={L1}&scope=mau", content=reference(), headers=JSON)
    run_id = response.json()["run_id"]
    refused = refund(client, run_id)
    assert refused.status_code == 409
    assert refused.json()["code"] == "not_finished"
    client.post(f"/api/runs/{run_id}/cancel")


def test_a_failed_sample_run_is_not_refunded(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services(FakeLLM("x", delay_s=5)))
    response = client.post(f"/api/runs?level={L1}&scope=mau", content=reference(), headers=JSON)
    run_id = response.json()["run_id"]
    client.post(f"/api/runs/{run_id}/cancel")
    read_events(client, run_id)  # ends with run.failed (cancelled)
    assert refund(client, run_id).json()["code"] == "not_finished"


def test_refund_of_an_unknown_run_is_a_404(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    response = refund(make_client(services()), "0" * 32)
    assert response.status_code == 404
    assert response.json() == {"detail": "Không tìm thấy lượt chạy."}


@pytest.mark.parametrize(
    ("body", "content_type"),
    [
        ('{"run_id": "not-a-run"}', "application/json"),
        ('{"run_id": "' + "0" * 32 + '", "calls": 3}', "application/json"),
        ('{"run_id": "' + "0" * 32 + '"}', "text/plain"),  # a cross-site form post
    ],
    ids=["bad-id", "extra-field", "not-json"],
)
def test_malformed_refund_is_a_422(
    make_client: Callable[[EngineServices], TestClient], body: str, content_type: str
) -> None:
    client = make_client(services())
    response = client.post(
        "/api/quota/refund", content=body, headers={"Content-Type": content_type}
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "Yêu cầu không hợp lệ."
    assert "not-a-run" not in response.text


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_every_library_level_has_three_sample_cases(level_id: str) -> None:
    # The refund rule "all 3 samples passed" assumes three visible cases per level.
    assert sum(c.role == "visible" for c in spec(level_id).cases) == 3
