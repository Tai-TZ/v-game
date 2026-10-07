import pytest
from fastapi.testclient import TestClient

from vgame.content.repository import load_catalog


def test_health(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_zones_returns_summaries_in_content_order(client: TestClient) -> None:
    response = client.get("/api/zones")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=60"
    zones = response.json()["zones"]
    assert [zone["id"] for zone in zones] == ["library", "watchtower", "market"]
    library = zones[0]
    assert library == {
        "id": "library",
        "name": "Thư viện",
        "summary": library["summary"],
        "concepts": library["concepts"],
        "location": "library",
        "status": "open",
        "level_count": 3,
    }
    assert "levels" not in library


def test_zone_detail_includes_ordered_levels(client: TestClient) -> None:
    response = client.get("/api/zones/library")

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=60"
    body = response.json()
    zone = load_catalog().find_zone("library")
    assert zone is not None
    assert body == zone.model_dump()
    assert [level["order"] for level in body["levels"]] == [1, 2, 3]
    assert body["levels"][0]["title"] == "Thôi bịa điều luật"
    assert body["levels"][2]["kind"] == "incident"


def test_unknown_zone_returns_404_with_vietnamese_detail(client: TestClient) -> None:
    response = client.get("/api/zones/unknown-zone")

    assert response.status_code == 404
    assert response.json() == {"detail": "Không tìm thấy khu học."}


@pytest.mark.parametrize(
    "zone_id",
    ["Library", "1library", "a", "lib_rary", "x" * 33, "library%20x"],
)
def test_malformed_zone_id_returns_422(client: TestClient, zone_id: str) -> None:
    response = client.get(f"/api/zones/{zone_id}")

    assert response.status_code == 422
