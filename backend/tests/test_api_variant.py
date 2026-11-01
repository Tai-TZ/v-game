"""The variant case after hint 3 (roadmap-v0.4 B4, N16; L1 §11, daily-shift §2): one review
case run on the player's graph, paid from the class reserve R. Offline: Oracle LLM."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from tests.engine.fakes_oracle import spec
from tests.test_api_quota import services
from tests.test_api_runs import JSON, L1, read_events, reference
from vgame.api.engine import EngineServices

REVIEW = [c.id for c in spec(L1).cases if c.role == "review"]
VISIBLE = [c.id for c in spec(L1).cases if c.role == "visible"]
QUESTION = {c.id: c.question for c in spec(L1).cases}


def variant(client: TestClient, case: str, level: str = L1, **headers: str):  # type: ignore[no-untyped-def]
    return client.post(
        f"/api/runs?level={level}&scope=bien_the&case={case}",
        content=reference(),
        headers=JSON | headers,
    )


def test_runs_one_review_case_with_its_question_and_no_stars(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    built = services(reserve=17)
    client = make_client(built)
    response = variant(client, REVIEW[0])
    assert response.status_code == 202, response.text
    events = read_events(client, response.json()["run_id"])
    kinds = [kind for _, kind, _ in events]
    assert "run.scored" not in kinds
    assert kinds[-1] == "run.finished"
    started, finished = events[0][2], events[-1][2]
    assert started["scope"] == finished["scope"] == "bien_the"
    # The player has to read the variant to fix the graph for it (L1 §11).
    assert started["cases"] == [
        {
            "id": REVIEW[0],
            "role": "review",
            "vai": started["cases"][0]["vai"],
            "question": QUESTION[REVIEW[0]],
        }
    ]
    assert {data["case"] for _, kind, data in events if kind == "case.graded"} == {REVIEW[0]}
    assert built.reserve.used == 1


def test_draws_on_the_reserve_once_per_idempotency_key(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    built = services(reserve=17)
    client = make_client(built)
    key = {"Idempotency-Key": "variant-key-00001"}
    first = variant(client, REVIEW[0], **key)
    read_events(client, first.json()["run_id"])
    again = variant(client, REVIEW[0], **key)
    assert again.status_code == 200
    assert again.json()["run_id"] == first.json()["run_id"]
    assert built.reserve.used == 1


def test_an_empty_reserve_refuses_before_anything_runs(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    built = services(reserve=0)
    client = make_client(built)
    response = variant(client, REVIEW[0])
    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "reserve_empty"
    assert "quỹ" in body["detail"].lower()
    assert built.reserve.used == 0
    # Nothing was started: the single run slot is still free for a star run.
    assert (
        client.post(f"/api/runs?level={L1}", content=reference(), headers=JSON).status_code == 202
    )


@pytest.mark.parametrize(
    "case",
    [
        VISIBLE[0],  # a visible case is not a variant
        "lib-l2-r01",  # another level's review case
        "lib-l1-r99",  # no such case
    ],
)
def test_only_a_review_case_of_this_level_is_a_variant(
    make_client: Callable[[EngineServices], TestClient], case: str
) -> None:
    built = services(reserve=17)
    client = make_client(built)
    response = variant(client, case)
    assert response.status_code == 422
    assert response.json()["code"] == "case_not_variant"
    assert built.reserve.used == 0


def test_a_variant_needs_its_case(make_client: Callable[[EngineServices], TestClient]) -> None:
    client = make_client(services())
    response = client.post(
        f"/api/runs?level={L1}&scope=bien_the", content=reference(), headers=JSON
    )
    assert response.status_code == 422
    assert response.json()["code"] == "case_not_variant"


def test_a_case_without_the_variant_scope_is_refused(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    for scope in ("", "&scope=mau"):
        response = client.post(
            f"/api/runs?level={L1}{scope}&case={REVIEW[0]}", content=reference(), headers=JSON
        )
        assert response.status_code == 422
        assert response.json()["code"] == "case_without_variant"


def test_a_variant_and_a_star_run_never_share_a_key(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(services())
    key = {"Idempotency-Key": "variant-key-00002"}
    first = variant(client, REVIEW[0], **key)
    read_events(client, first.json()["run_id"])
    other = variant(client, REVIEW[1], **key)
    assert other.status_code == 409
