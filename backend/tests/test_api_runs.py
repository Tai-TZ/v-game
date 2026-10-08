"""HTTP API of the engine: blocks, levels, runs and SSE. Offline: Oracle LLM, fake models."""

import json
import logging
import os
import subprocess
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from tests.engine.fakes_llm import FakeLLM
from tests.engine.fakes_oracle import (
    CONTENT_DIR,
    LEVEL_IDS,
    OracleReranker,
    oracle_llm,
    oracle_store,
    spec,
)
from tests.engine.fakes_retrieval import HashingEmbedder, OverlapReranker
from vgame.api.engine import EngineServices
from vgame.api.routes import runs
from vgame.config import Settings
from vgame.engine.constants import IndexVariant
from vgame.engine.corpus import load_documents
from vgame.engine.index import (
    IndexStore,
    build_rerank_table,
    golden_questions,
    rerank_questions,
)
from vgame.engine.levels import load_level
from vgame.engine.replay import SEED_PATH
from vgame.engine.run_store import RunStore
from vgame.engine.types import LLMClient
from vgame.main import create_app

Event = tuple[int, str, dict[str, Any]]
L1 = "grounded-citation"
JSON = {"Content-Type": "application/json"}


def engine(
    llm: LLMClient | None = None, *, max_runs: int = 2, store: bool = True
) -> EngineServices:
    return EngineServices(
        content_dir=CONTENT_DIR,
        store=oracle_store() if store else None,
        llm=llm,
        reranker=OracleReranker(),
        runs=RunStore(max_concurrent_runs=max_runs),
    )


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


@pytest.fixture
def api(make_client: Callable[[EngineServices], TestClient]) -> TestClient:
    return make_client(engine(oracle_llm()))


def reference(level_id: str = L1) -> str:
    return load_level(level_id).reference_graph.model_dump_json(by_alias=True)


def post_run(client: TestClient, body: str, level: str = L1, **headers: str) -> Any:
    return client.post(f"/api/runs?level={level}", content=body, headers=JSON | headers)


def read_events(client: TestClient, run_id: str, last_event_id: int | None = None) -> list[Event]:
    headers = {} if last_event_id is None else {"Last-Event-ID": str(last_event_id)}
    with client.stream("GET", f"/api/runs/{run_id}/events", headers=headers) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        text = "".join(response.iter_text())
    return parse_events(text)


def parse_events(text: str) -> list[Event]:
    events: list[Event] = []
    for block in filter(None, text.split("\n\n")):
        if block.startswith(":"):  # heartbeat comment
            continue
        fields = dict(line.split(": ", 1) for line in block.split("\n"))
        events.append((int(fields["id"]), fields["event"], json.loads(fields["data"])))
    return events


# --- Blocks and levels ---------------------------------------------------------------------


def test_blocks_lists_the_ten_library_blocks(api: TestClient) -> None:
    response = api.get("/api/blocks")
    assert response.status_code == 200
    blocks = response.json()["blocks"]
    assert len(blocks) == 10
    llm = next(b for b in blocks if b["type"] == "llm")
    assert llm["inputs"]["context"]["type"] == "Context"
    assert "temperature" not in json.dumps(llm["params"])


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_public_level_has_starter_and_visible_cases_only(api: TestClient, level_id: str) -> None:
    response = api.get(f"/api/levels/{level_id}")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=60"
    body = response.json()
    assert body["starter_graph"] == load_level(level_id).starter_graph.model_dump(
        mode="json", by_alias=True
    )
    golden = spec(level_id)
    visible = [c for c in golden.cases if c.role == "visible"]
    assert body["visible_cases"] == [
        {"id": c.id, "vai": c.vai, "question": c.question} for c in visible
    ]
    for case in golden.cases:
        if case.role != "visible":
            assert case.question not in response.text
    assert "reference_graph" not in body
    assert "naive_graphs" not in body


@pytest.mark.parametrize(("path", "code"), [("no-such-level", 404), ("Bad_Id", 422)])
def test_unknown_or_malformed_level(api: TestClient, path: str, code: int) -> None:
    response = api.get(f"/api/levels/{path}")
    assert response.status_code == code
    if code == 404:
        assert response.json() == {"detail": "Không tìm thấy level."}


# --- Runs and SSE --------------------------------------------------------------------------


def test_reference_run_streams_the_full_event_sequence(api: TestClient) -> None:
    response = post_run(api, reference())
    assert response.status_code == 202
    run_id = response.json()["run_id"]
    events = read_events(api, run_id)

    assert [seq for seq, _, _ in events] == list(range(1, len(events) + 1))
    kinds = [kind for _, kind, _ in events]
    assert kinds[0] == "run.started"
    assert kinds[-2:] == ["run.scored", "run.finished"]
    assert kinds.count("case.graded") == 10
    open_steps: dict[tuple[str, str], int] = {}
    graded: set[str] = set()
    for _, kind, data in events:
        assert (data["type"], data["run"]) == (kind, run_id)
        if kind == "step.started":
            assert data["case"] not in graded
            open_steps[(data["case"], data["node"])] = 1
        elif kind == "step.finished":
            assert open_steps.pop((data["case"], data["node"])) == 1
        elif kind == "case.graded":
            graded.add(data["case"])
            assert "gold" not in data
    assert open_steps == {}
    assert events[-2][2]["score"]["stars"] == 3
    assert set(events[-1][2]["report"]["gold"]) == graded


def test_last_event_id_replays_the_rest(api: TestClient) -> None:
    run_id = post_run(api, reference()).json()["run_id"]
    everything = read_events(api, run_id)
    assert read_events(api, run_id, last_event_id=5) == everything[5:]
    assert read_events(api, run_id, last_event_id=len(everything)) == []


KEY = "player-key-000001"  # 17 chars; keys need 16-64


def test_idempotency_key_returns_the_same_run(api: TestClient) -> None:
    first = post_run(api, reference(), **{"Idempotency-Key": KEY})
    again = post_run(api, reference(), **{"Idempotency-Key": KEY})
    assert first.status_code == 202
    assert again.status_code == 200
    assert again.json()["run_id"] == first.json()["run_id"]
    assert again.json()["created"] is False


def test_idempotency_key_reused_for_another_graph_is_a_409(api: TestClient) -> None:
    graph = json.loads(reference())
    assert post_run(api, json.dumps(graph), **{"Idempotency-Key": KEY}).status_code == 202
    for node in graph["nodes"]:
        if node["id"] == "vs":
            node["params"]["top_k"] = 2
    response = post_run(api, json.dumps(graph), **{"Idempotency-Key": KEY})
    assert response.status_code == 409
    assert response.json() == {"detail": "Idempotency-Key này đã dùng cho một đồ thị khác."}


def test_short_idempotency_key_is_a_422(api: TestClient) -> None:
    response = post_run(api, reference(), **{"Idempotency-Key": "k" * 15})
    assert response.status_code == 422
    assert response.json() == {
        "detail": "Yêu cầu không hợp lệ.",
        "fields": ["header.idempotency-key"],
    }


def test_framework_422_never_echoes_input_or_english(api: TestClient) -> None:
    response = api.get(f"/api/runs/{'0' * 32}/events", headers={"Last-Event-ID": "abc"})
    assert response.status_code == 422
    assert "abc" not in response.text
    assert "Input should" not in response.text
    assert response.json()["detail"] == "Yêu cầu không hợp lệ."


def test_invalid_graph_gets_every_error_in_one_vietnamese_422(api: TestClient) -> None:
    graph = json.loads(reference())
    for node in graph["nodes"]:
        if node["id"] == "vs":
            node["params"]["top_k"] = 99  # outside param_limits
    graph["edges"].append(["llm.answer", "pk.query"])  # wrong port type
    response = post_run(api, json.dumps(graph))

    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại."
    codes = {issue["code"] for issue in body["issues"]}
    assert {"G06", "G02"} <= codes
    assert all(issue["message_vi"] for issue in body["issues"])


@pytest.mark.parametrize(
    "body",
    [
        "{not json",
        "{}",
        '{"schema": 1, "nodes": "{__class__}", "edges": []}',
        "x" * 70_000,
        "[" * 600 + "]" * 600,
    ],
    ids=["not-json", "empty", "wrong-shape", "70kb", "deep-nesting"],
)
def test_malformed_payload_is_a_422_without_echo(api: TestClient, body: str) -> None:
    response = post_run(api, body)
    assert response.status_code == 422
    assert response.json()["issues"][0]["code"] in {"P01", "P02", "P03"}
    assert "__class__" not in response.text


def test_non_json_content_type_is_refused(api: TestClient) -> None:
    response = api.post(
        f"/api/runs?level={L1}", content=reference(), headers={"Content-Type": "text/plain"}
    )
    assert response.status_code == 415


def test_unknown_level_run_is_404(api: TestClient) -> None:
    assert post_run(api, reference(), level="no-such-level").status_code == 404


def test_without_a_key_the_app_starts_and_runs_answer_503(client: TestClient) -> None:
    # `client` builds the real engine from settings with no GEMINI_API_KEY and no index.
    assert client.get("/api/health").status_code == 200
    assert client.get(f"/api/levels/{L1}").status_code == 200
    response = post_run(client, reference())
    assert response.status_code == 503
    assert response.json() == {
        "detail": "Chưa cấu hình LLM nên chưa chạy được ca. Chủ máy chủ cần đặt GEMINI_API_KEY.",
        "code": "llm_not_configured",
    }


def test_without_an_index_runs_answer_503(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(engine(oracle_llm(), store=False))
    response = post_run(client, reference())
    assert response.status_code == 503
    assert response.json()["code"] == "index_missing"
    assert "vgame-build-index" in response.json()["detail"]


def test_concurrent_run_cap_answers_429(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(engine(FakeLLM("x", delay_s=5), max_runs=1))
    assert post_run(client, reference()).status_code == 202
    busy = post_run(client, reference())
    assert busy.status_code == 429
    assert busy.json() == {
        "detail": "Máy chủ miễn phí chạy một lượt mỗi lúc và đang bận. "
        "Bạn thử lại sau khoảng 1 phút nhé."
    }


def test_cancel_ends_the_run_with_run_failed(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    client = make_client(engine(FakeLLM("x", delay_s=5), max_runs=1))
    run_id = post_run(client, reference()).json()["run_id"]
    assert client.post(f"/api/runs/{run_id}/cancel").status_code == 202

    events = read_events(client, run_id)
    assert events[-1][1] == "run.failed"
    assert events[-1][2]["code"] == "cancelled"
    started = sum(kind == "step.started" for _, kind, _ in events)
    assert started == sum(kind == "step.finished" for _, kind, _ in events)
    assert client.post(f"/api/runs/{run_id}/cancel").status_code == 409
    assert post_run(client, reference()).status_code == 202  # the slot was released


@pytest.mark.parametrize(
    ("method", "path", "code"),
    [
        ("GET", "/api/runs/" + "0" * 32 + "/events", 404),
        ("POST", "/api/runs/" + "0" * 32 + "/cancel", 404),
        ("GET", "/api/runs/not-a-run/events", 422),
    ],
)
def test_unknown_run(api: TestClient, method: str, path: str, code: int) -> None:
    assert api.request(method, path).status_code == code


def test_cors_preflight_allows_posting_a_run(api: TestClient, allowed_origin: str) -> None:
    response = api.options(
        "/api/runs",
        headers={
            "Origin": allowed_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,idempotency-key",
        },
    )
    assert response.status_code == 200
    assert "POST" in response.headers["access-control-allow-methods"]
    allowed = response.headers["access-control-allow-headers"].lower()
    assert "content-type" in allowed
    assert "idempotency-key" in allowed


# --- Engine fixes 2026-10-08 -----------------------------------------------------------------


def test_sse_sends_heartbeat_comments_while_a_step_is_running(
    make_client: Callable[[EngineServices], TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(runs, "HEARTBEAT_S", 0.05)
    client = make_client(engine(FakeLLM("x", delay_s=0.3), max_runs=1))
    run_id = post_run(client, reference()).json()["run_id"]
    with client.stream("GET", f"/api/runs/{run_id}/events") as response:
        text = "".join(response.iter_text())
    assert "\n\n: ping\n\n" in text  # an SSE comment: browsers ignore it, proxies see traffic
    assert [kind for _, kind, _ in parse_events(text)][-1] == "run.finished"


def test_stale_index_answers_a_vietnamese_503(
    make_client: Callable[[EngineServices], TestClient],
) -> None:
    services = engine(oracle_llm(), store=False)
    services.index_stale = True
    response = post_run(make_client(services), reference())
    assert response.status_code == 503
    assert response.json()["code"] == "index_stale"
    assert "vgame-build-index" in response.json()["detail"]
    assert "cũ" in response.json()["detail"]


def test_startup_refuses_an_index_built_from_other_content(settings: Settings) -> None:
    # Index of the real corpus, but without the golden questions: a question was rewritten.
    stale = IndexStore.build(
        load_documents(settings.content_dir),
        HashingEmbedder(),
        ["Câu hỏi cũ trước khi sửa golden?"],
        [IndexVariant("theo_dieu", 512, 10)],
    )
    stale.save(settings.engine_cache_dir / "index")
    keyed = settings.model_copy(update={"gemini_api_key": SecretStr("test-not-a-real-key")})
    with TestClient(create_app(keyed)) as client:
        assert client.app.state.engine.store is None  # type: ignore[attr-defined]
        response = post_run(client, reference())
    assert response.status_code == 503
    assert response.json()["code"] == "index_stale"


# --- Free tier 2026-10-08: no ML model in the API process, shipped replay seed --------------


def _index_with_table(settings: Settings, rerank: dict[str, frozenset[str]]) -> None:
    """A fresh one-variant index of the real corpus with a rerank table for ``rerank``."""
    content = settings.content_dir
    store = IndexStore.build(
        load_documents(content),
        HashingEmbedder(),
        golden_questions(content),
        [IndexVariant("theo_dieu", 512, 10)],
    )
    store.rerank = build_rerank_table(store, OverlapReranker(), rerank, log=lambda _: None)
    store.save(settings.index_dir)


def test_engine_uses_the_rerank_table_and_never_imports_model_libraries(
    settings: Settings, tmp_path: Path
) -> None:
    _index_with_table(settings, rerank_questions(settings.content_dir))
    # A fresh interpreter: this test process already imported fastembed (slow test modules).
    code = "\n".join(
        [
            "import sys",
            "from vgame.api.engine import build_engine",
            "from vgame.config import Settings",
            "from vgame.engine.index import RerankTable",
            "engine = build_engine(Settings(_env_file=None))",
            "assert engine.store is not None",
            "assert isinstance(engine.reranker, RerankTable), engine.reranker",
            "loaded = [m for m in ('fastembed', 'onnxruntime') if m in sys.modules]",
            "assert not loaded, loaded",
        ]
    )
    env = {k: v for k, v in os.environ.items() if k != "GEMINI_API_KEY"}
    env |= {"INDEX_DIR": str(settings.index_dir), "ENGINE_CACHE_DIR": str(tmp_path / "cache")}
    result = subprocess.run(  # noqa: S603  # our own interpreter and code, no shell
        [sys.executable, "-c", code], env=env, capture_output=True, text=True, check=False
    )
    assert result.returncode == 0, result.stderr[-3000:]


def test_startup_flags_a_rerank_table_that_misses_a_pair(settings: Settings) -> None:
    questions = rerank_questions(settings.content_dir)
    dropped = sorted(questions)[0]
    _index_with_table(settings, {q: d for q, d in questions.items() if q != dropped})
    keyed = settings.model_copy(update={"gemini_api_key": SecretStr("test-not-a-real-key")})
    with TestClient(create_app(keyed)) as client:
        assert client.app.state.engine.store is None  # type: ignore[attr-defined]
        response = post_run(client, reference("article-number-lookup"), "article-number-lookup")
    assert response.status_code == 503
    assert response.json()["code"] == "index_stale"


def test_startup_imports_the_replay_seed(
    settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    entries = json.loads(SEED_PATH.read_text(encoding="utf-8"))["entries"]
    keyed = settings.model_copy(update={"gemini_api_key": SecretStr("test-not-a-real-key")})
    # uvicorn's default logging shows only WARNING and above of the app's loggers: this line is
    # the owner's only sign in Render's log that the seed loaded.
    with caplog.at_level(logging.WARNING), TestClient(create_app(keyed)) as client:
        replay = client.app.state.engine.replay  # type: ignore[attr-defined]
        assert replay is not None
        assert all(replay.get(key) is not None for key in entries)
    assert f"replay seed: {len(entries)} answers added" in caplog.text
