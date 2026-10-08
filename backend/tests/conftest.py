from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from vgame.config import Settings
from vgame.main import create_app

ALLOWED_ORIGIN = "http://localhost:5173"


@pytest.fixture
def allowed_origin() -> str:
    return ALLOWED_ORIGIN


@pytest.fixture(autouse=True)
def _never_write_the_shipped_index(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    # INDEX_DIR defaults to the committed artifacts in engine/data/index: a test building
    # through Settings() must never overwrite them. Tests that read them pass SHIPPED_INDEX_DIR.
    monkeypatch.setenv("INDEX_DIR", str(tmp_path / "index"))


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    # _env_file=None: tests never read backend/.env (it may hold the owner's real key).
    # No key, an empty index dir and an empty cache dir: the engine starts unconfigured.
    return Settings(
        _env_file=None,
        env="test",
        cors_origins=[ALLOWED_ORIGIN],
        gemini_api_key=None,
        engine_cache_dir=tmp_path / "engine",
        index_dir=tmp_path / "engine" / "index",
    )


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
