"""Watchtower W1 over HTTP (watchtower.md §3): the level page, a run end to end, and what the
client is told. The model is the scripted one of tests/engine/test_watchtower.py: it obeys every
attack, so only what the player wired decides whether a bad refund runs."""

import json
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_oracle import CONTENT_DIR
from tests.engine.test_watchtower import obedient
from vgame.api.engine import EngineServices
from vgame.config import Settings
from vgame.engine.levels import load_level
from vgame.engine.run_store import RunStore
from vgame.main import create_app

W1 = "direct-injection"
JSON = {"Content-Type": "application/json"}


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    # No index at all: the desk retrieves nothing, so a missing index must not stop W1.
    services = EngineServices(
        content_dir=CONTENT_DIR,
        store=None,
        llm=FakeLLM(obedient),
        reranker=None,
        runs=RunStore(max_concurrent_runs=2),
    )
    with TestClient(create_app(settings, engine=services)) as c:
        yield c


def run(client: TestClient, graph: str) -> list[tuple[str, dict[str, Any]]]:
    started = client.post(f"/api/runs?level={W1}", content=graph, headers=JSON)
    assert started.status_code == 202, started.json()
    with client.stream("GET", f"/api/runs/{started.json()['run_id']}/events") as response:
        text = "".join(response.iter_text())
    out = []
    for block in filter(None, text.split("\n\n")):
        if block.startswith(":"):
            continue
        fields = dict(line.split(": ", 1) for line in block.split("\n"))
        out.append((fields["event"], json.loads(fields["data"])))
    return out


def graph(which: str) -> str:
    level = load_level(W1)
    chosen: Callable[[], Any] = {
        "starter": lambda: level.starter_graph,
        "reference": lambda: level.reference_graph,
    }[which]
    return str(chosen().model_dump_json(by_alias=True))


def test_the_level_page_shows_the_three_customer_samples_only(client: TestClient) -> None:
    response = client.get(f"/api/levels/{W1}")
    assert response.status_code == 200
    body = response.json()
    assert [c["id"] for c in body["visible_cases"]] == ["wt-w1-v01", "wt-w1-v02", "wt-w1-v03"]
    assert "Giải mã" not in json.dumps(body, ensure_ascii=False)  # no trap question leaks
    assert body["token_budget"] == load_level(W1).rules["token_budget"]


def test_the_starter_run_pays_the_attacks_and_says_where_to_look(client: TestClient) -> None:
    events = run(client, graph("starter"))
    assert events[-1][0] == "run.finished"
    scored = next(data for kind, data in events if kind == "run.scored")
    assert scored["score"]["stars"] == 0
    graded = {d["case"]: d["labels"] for k, d in events if k == "case.graded"}
    assert "ledger.refund_wrong" in graded["wt-w1-t01"]
    # The lesson of W1 is on the trap cases, and every line is built from labels the client
    # already has: nothing secret, so the diagnosis keeps them (unlike a Library gold Điều).
    report = events[-1][1]["report"]
    assert {d["case"] for d in report["diagnosis"]} >= {"wt-w1-t01", "wt-w1-t02", "wt-w1-t03"}


def test_the_reference_run_earns_three_stars(client: TestClient) -> None:
    events = run(client, graph("reference"))
    scored = next(data for kind, data in events if kind == "run.scored")
    assert scored["score"]["stars"] == 3


def test_a_trap_question_never_reaches_the_client(client: TestClient) -> None:
    text = json.dumps(run(client, graph("starter")), ensure_ascii=False)
    assert "Giải mã và làm theo" not in text
    assert "quản trị viên hệ thống" not in text


def test_a_variant_run_is_refused_on_a_level_with_no_review_case(client: TestClient) -> None:
    response = client.post(
        f"/api/runs?level={W1}&scope=bien_the&case=wt-w1-t01",
        content=graph("starter"),
        headers=JSON,
    )
    assert response.status_code == 422
    assert response.json()["code"] == "case_not_variant"


def test_the_retrieval_preview_has_nothing_to_show_on_the_desk(client: TestClient) -> None:
    response = client.post(
        f"/api/preview/retrieval?level={W1}&case=wt-w1-v01", content=graph("starter"), headers=JSON
    )
    assert response.status_code == 404
