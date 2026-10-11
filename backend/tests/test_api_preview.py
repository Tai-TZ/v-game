"""Deterministic retrieval preview (vom-sao-v0.1 §4 phase 2): the dome redraws when a knob
turns, without an LLM call and without spending a thing. Offline: the Oracle index store."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.engine.fakes_oracle import spec
from tests.test_api_runs import JSON, L1, engine, reference
from vgame.config import Settings
from vgame.main import create_app

L3 = "article-number-lookup"
VISIBLE = [c.id for c in spec(L1).cases if c.role == "visible"]
HIDDEN = next(c.id for c in spec(L1).cases if c.role == "hidden")


@pytest.fixture
def client(settings: Settings) -> Any:
    with TestClient(create_app(settings, engine=engine())) as made:
        yield made


def preview(client: TestClient, case: str, body: str | None = None, level: str = L1) -> Any:
    return client.post(
        f"/api/preview/retrieval?level={level}&case={case}",
        content=body or reference(level),
        headers=JSON,
    )


def test_preview_ranks_the_passages_without_calling_the_model(client: TestClient) -> None:
    response = preview(client, VISIBLE[0])
    assert response.status_code == 200
    nodes = response.json()["nodes"]
    # The L1 reference graph has one retriever, "vs".
    assert list(nodes) == ["vs"]
    items = nodes["vs"]["items"]
    assert [i["rank"] for i in items] == list(range(1, len(items) + 1))
    assert all(0.0 <= i["score"] <= 1.0 for i in items)
    assert all(
        {"chunk_id", "rank", "score", "doc_id", "dieu", "khoan", "hieu_luc"} <= set(i)
        for i in items
    )


def test_turning_the_hook_down_returns_fewer_passages(client: TestClient) -> None:
    import json

    graph = json.loads(reference())
    for node in graph["nodes"]:
        if node["id"] == "vs":
            node["params"]["top_k"] = 1
    one = preview(client, VISIBLE[0], json.dumps(graph))
    assert one.status_code == 200
    assert len(one.json()["nodes"]["vs"]["items"]) == 1
    assert len(preview(client, VISIBLE[0]).json()["nodes"]["vs"]["items"]) == 3


def test_a_hidden_case_is_never_previewed(client: TestClient) -> None:
    # Previewing a hidden case would hand the player a way to tune against the hidden set.
    response = preview(client, HIDDEN)
    assert response.status_code == 404
    assert "câu mẫu" in response.json()["detail"]


def test_an_unknown_case_is_a_404(client: TestClient) -> None:
    assert preview(client, "lib-l1-zz99").status_code == 404


def test_an_invalid_graph_is_a_422_with_its_issues(client: TestClient) -> None:
    response = preview(client, VISIBLE[0], '{"schema": 1, "nodes": [], "edges": []}')
    assert response.status_code == 422
    assert response.json()["issues"]


def test_preview_spends_no_quota(client: TestClient) -> None:
    before = client.get("/api/quota").json()
    preview(client, VISIBLE[0])
    assert client.get("/api/quota").json() == before
