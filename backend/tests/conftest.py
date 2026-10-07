from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from vgame.config import Settings
from vgame.main import create_app

ALLOWED_ORIGIN = "http://localhost:5173"


@pytest.fixture
def allowed_origin() -> str:
    return ALLOWED_ORIGIN


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(Settings(env="test", cors_origins=[ALLOWED_ORIGIN]))
    with TestClient(app) as test_client:
        yield test_client
