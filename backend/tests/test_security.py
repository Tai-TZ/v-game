import pytest
from fastapi.testclient import TestClient

from vgame.config import Settings
from vgame.main import create_app

EXPECTED_HEADERS = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "cross-origin-resource-policy": "same-site",
}


@pytest.mark.parametrize("path", ["/api/health", "/api/zones", "/api/zones/nope", "/missing"])
def test_security_headers_on_every_response(client: TestClient, path: str) -> None:
    response = client.get(path)

    for name, value in EXPECTED_HEADERS.items():
        assert response.headers.get(name) == value, name


def test_cors_echoes_allowed_origin(client: TestClient, allowed_origin: str) -> None:
    response = client.get("/api/zones", headers={"Origin": allowed_origin})

    assert response.headers["access-control-allow-origin"] == allowed_origin
    assert "access-control-allow-credentials" not in response.headers
    assert "Origin" in response.headers["vary"]


def test_cors_ignores_disallowed_origin(client: TestClient) -> None:
    response = client.get("/api/zones", headers={"Origin": "https://evil.example"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize(("method", "expected_status"), [("GET", 200), ("POST", 400)])
def test_cors_preflight_allows_only_get(
    client: TestClient, allowed_origin: str, method: str, expected_status: int
) -> None:
    response = client.options(
        "/api/zones",
        headers={"Origin": allowed_origin, "Access-Control-Request-Method": method},
    )

    assert response.status_code == expected_status


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_docs_disabled_in_production(path: str) -> None:
    with TestClient(create_app(Settings(env="production"))) as client:
        assert client.get(path).status_code == 404


def test_docs_served_in_development_without_csp() -> None:
    with TestClient(create_app(Settings(env="development"))) as client:
        response = client.get("/docs")

    assert response.status_code == 200
    assert "content-security-policy" not in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"


def test_unhandled_error_hides_details() -> None:
    app = create_app(Settings(env="production"))

    async def boom() -> None:
        raise RuntimeError("secret internal detail")

    app.add_api_route("/api/boom", boom)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/boom")

    assert response.status_code == 500
    assert response.json() == {"detail": "Lỗi máy chủ, vui lòng thử lại sau."}
    assert "secret internal detail" not in response.text
    assert "Traceback" not in response.text
    # ServerErrorMiddleware sits outside user middleware, so the handler must add these itself.
    for name, value in EXPECTED_HEADERS.items():
        assert response.headers.get(name) == value, name
