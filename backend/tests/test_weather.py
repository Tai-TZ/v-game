"""GET /api/weather. No test touches the network: every fetch goes to MockTransport."""

import asyncio
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from fastapi.testclient import TestClient

from vgame.api.routes import weather
from vgame.api.routes.weather import WMO_GROUP, WeatherService
from vgame.config import Settings
from vgame.main import create_app

HANOI = (21.0285, 105.8542)
# Shape of the live reply to the exact request below (2026-10-08), changed to code 63 (rain).
UPSTREAM_CURRENT: dict[str, object] = {
    "time": "2026-10-08T07:00",
    "interval": 900,
    "temperature_2m": 27.36,
    "weather_code": 63,
}
UPSTREAM = {
    "latitude": 21.05448,
    "longitude": 105.898476,
    "utc_offset_seconds": 0,
    "timezone": "GMT",
    "current": UPSTREAM_CURRENT,
}


def reply_with(**current: object) -> Callable[[httpx.Request], httpx.Response]:
    """Upstream reply with some `current` fields overridden."""
    body = {**UPSTREAM, "current": {**UPSTREAM_CURRENT, **current}}
    return lambda _: httpx.Response(200, json=body)


class Clock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 8, 7, 0, tzinfo=UTC)  # 14:00 in Hanoi

    def __call__(self) -> datetime:
        return self.t


class Upstream:
    """MockTransport handler: answers with `reply` and records every request."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.reply: Callable[[httpx.Request], httpx.Response] = lambda _: httpx.Response(
            200, json=UPSTREAM
        )

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self.reply(request)


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def upstream() -> Upstream:
    return Upstream()


@pytest.fixture
def client(settings: Settings, clock: Clock, upstream: Upstream) -> Iterator[TestClient]:
    service = WeatherService(*HANOI, transport=httpx.MockTransport(upstream), now=clock)
    with TestClient(create_app(settings, weather=service)) as test_client:
        yield test_client


def test_wmo_groups_match_the_contract_exactly() -> None:
    # Every code in Open-Meteo's "WMO Weather interpretation codes" table (checked 2026-10-08).
    expected = {
        "clear": {0, 1},
        "partly_cloudy": {2},
        "cloudy": {3},
        "fog": {45, 48},
        "drizzle": {51, 53, 55, 56, 57},
        "rain": {61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86},
        "thunderstorm": {95, 96, 97, 99},
    }
    assert {c: g for g, codes in expected.items() for c in codes} == WMO_GROUP


def test_weather_maps_upstream_and_only_sends_the_configured_place(
    client: TestClient, upstream: Upstream
) -> None:
    response = client.get("/api/weather?latitude=1&longitude=2&timezone=UTC")  # ignored

    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300"
    assert response.json() == {
        "condition": "rain",
        "temperature_c": 27.4,
        "updated_at": "2026-10-08T07:00:00Z",
    }
    (sent,) = upstream.requests
    assert dict(sent.url.params) == {
        "latitude": "21.0285",
        "longitude": "105.8542",
        "current": "temperature_2m,weather_code",
        "forecast_days": "1",
    }


def test_value_is_cached_for_15_minutes(
    client: TestClient, upstream: Upstream, clock: Clock
) -> None:
    client.get("/api/weather")
    clock.t += timedelta(minutes=15)
    client.get("/api/weather")
    assert len(upstream.requests) == 1

    clock.t += timedelta(minutes=1)
    client.get("/api/weather")
    assert len(upstream.requests) == 2


def test_refresh_replaces_the_cached_value(
    client: TestClient, upstream: Upstream, clock: Clock
) -> None:
    client.get("/api/weather")
    clock.t += timedelta(minutes=15)
    assert client.get("/api/weather").headers["cache-control"] == "public, max-age=300"

    upstream.reply = reply_with(time="2026-10-08T07:15", temperature_2m=30.04, weather_code=0)
    clock.t += timedelta(minutes=1)
    response = client.get("/api/weather")

    assert response.headers["cache-control"] == "public, max-age=300"
    assert response.json() == {
        "condition": "clear",
        "temperature_c": 30.0,
        "updated_at": "2026-10-08T07:15:00Z",
    }


def test_unknown_wmo_code_shows_as_cloudy_and_warns(
    client: TestClient, upstream: Upstream, caplog: pytest.LogCaptureFixture
) -> None:
    upstream.reply = reply_with(weather_code=4)

    response = client.get("/api/weather")

    assert response.status_code == 200
    assert response.json()["condition"] == "cloudy"
    assert "unknown WMO code 4" in caplog.text


def test_out_of_range_temperature_is_a_failed_fetch(client: TestClient, upstream: Upstream) -> None:
    upstream.reply = reply_with(temperature_2m=999)
    assert client.get("/api/weather").status_code == 503


def test_after_a_failure_the_next_attempt_is_exactly_2_minutes_later(
    client: TestClient, upstream: Upstream, clock: Clock
) -> None:
    upstream.reply = lambda _: httpx.Response(500)
    assert client.get("/api/weather").status_code == 503

    upstream.reply = reply_with()
    clock.t += timedelta(seconds=119)
    assert client.get("/api/weather").status_code == 503
    assert len(upstream.requests) == 1

    clock.t += timedelta(seconds=1)
    response = client.get("/api/weather")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=300"
    assert len(upstream.requests) == 2


def _timeout(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectTimeout("slow", request=request)


@pytest.mark.parametrize(
    "reply",
    [
        lambda _: httpx.Response(500),
        lambda _: httpx.Response(429),
        lambda _: httpx.Response(200, text="<html>"),
        lambda _: httpx.Response(200, json={**UPSTREAM, "current": {}}),
        _timeout,
    ],
)
def test_failed_refresh_serves_last_good_as_stale_and_backs_off(
    client: TestClient,
    upstream: Upstream,
    clock: Clock,
    reply: Callable[[httpx.Request], httpx.Response],
    caplog: pytest.LogCaptureFixture,
) -> None:
    client.get("/api/weather")
    upstream.reply = reply
    clock.t += timedelta(minutes=16)

    first = client.get("/api/weather")
    second = client.get("/api/weather")  # within MIN_GAP: no new upstream call

    assert first.status_code == second.status_code == 200
    assert first.json()["condition"] == "rain"
    assert first.headers["cache-control"] == "public, max-age=60"
    assert len(upstream.requests) == 2
    assert "<html>" not in caplog.text  # the warning never quotes the upstream body


def test_no_value_yet_answers_503_without_details(client: TestClient, upstream: Upstream) -> None:
    upstream.reply = _timeout

    response = client.get("/api/weather")

    assert response.status_code == 503
    assert response.json() == {"detail": "Chưa lấy được thời tiết, thử lại sau."}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["retry-after"] == "120"
    assert "content-security-policy" in response.headers  # the real app's headers


def test_value_older_than_3_hours_is_not_served(
    client: TestClient, upstream: Upstream, clock: Clock
) -> None:
    client.get("/api/weather")
    upstream.reply = lambda _: httpx.Response(503)

    clock.t += timedelta(hours=3)
    assert client.get("/api/weather").status_code == 200
    clock.t += timedelta(minutes=1)
    assert client.get("/api/weather").status_code == 503


def test_concurrent_requests_share_one_fetch(clock: Clock) -> None:
    calls = 0

    async def slow(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return httpx.Response(200, json=UPSTREAM)

    service = WeatherService(*HANOI, transport=httpx.MockTransport(slow), now=clock)

    async def burst() -> list[object]:
        return list(await asyncio.gather(*(service.current() for _ in range(20))))

    results = asyncio.run(burst())
    assert calls == 1
    assert all(r is not None for r in results)


def test_hung_upstream_is_cut_at_the_timeout(clock: Clock, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(weather, "FETCH_TIMEOUT_S", 0.05)

    async def hang(_: httpx.Request) -> httpx.Response:
        await asyncio.sleep(5)
        return httpx.Response(200, json=UPSTREAM)

    service = WeatherService(*HANOI, transport=httpx.MockTransport(hang), now=clock)
    assert asyncio.run(service.current()) is None
