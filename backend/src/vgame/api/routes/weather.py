"""GET /api/weather: the current weather over the campus.

One place per deployment (Settings.weather_*): the same Hanoi as the theme's `place`, never the
visitor's. The client sends nothing. Time of day is not here: the browser computes it from the
theme's coordinates and its own clock, so it works while this API sleeps.

Fetched server-side (CSP connect-src 'self'; the visitor's IP never reaches Open-Meteo) and cached
in memory: Render free runs one process and wipes it when it sleeps, so a wake costs one call.
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Final, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

Condition = Literal["clear", "partly_cloudy", "cloudy", "fog", "drizzle", "rain", "thunderstorm"]

OPEN_METEO_URL: Final = "https://api.open-meteo.com/v1/forecast"
FRESH_FOR: Final = timedelta(minutes=15)  # Open-Meteo's current values are 15-minutely.
MIN_GAP: Final = timedelta(minutes=2)  # Between upstream attempts, whatever their outcome.
MAX_STALE: Final = timedelta(hours=3)  # Older than this, the weather is unknown (503).
FETCH_TIMEOUT_S: Final = 4.0
WEATHER_UNAVAILABLE: Final = "Chưa lấy được thời tiết, thử lại sau."

# Open-Meteo's WMO table (docs "WMO Weather interpretation codes"), all 29 codes.
# ponytail: no snow group (lowland Hanoi); snow codes show as rain. Add "snow" with a snowy place.
WMO_GROUP: Final[dict[int, Condition]] = {
    0: "clear", 1: "clear",
    2: "partly_cloudy",
    3: "cloudy",
    45: "fog", 48: "fog",
    51: "drizzle", 53: "drizzle", 55: "drizzle", 56: "drizzle", 57: "drizzle",
    61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain", 80: "rain", 81: "rain", 82: "rain",
    71: "rain", 73: "rain", 75: "rain", 77: "rain", 85: "rain", 86: "rain",
    95: "thunderstorm", 96: "thunderstorm", 97: "thunderstorm", 99: "thunderstorm",
}  # fmt: skip


class WeatherResponse(BaseModel):
    condition: Condition
    temperature_c: float
    updated_at: datetime  # when the values are valid (UTC); the client shows it in the theme's zone


# --- Upstream subset: validated at the boundary; anything else is a failed fetch.
class _Current(BaseModel):
    time: datetime  # GMT with no offset, because no timezone is requested ("2026-10-08T16:00")
    temperature_2m: float = Field(ge=-90, le=60)
    weather_code: int

    @field_validator("time")
    @classmethod
    def _to_utc(cls, value: datetime) -> datetime:
        # Convert, never relabel: an offset (someone adds `timezone=`) must not shift the time.
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class _Forecast(BaseModel):
    current: _Current


class WeatherService:
    def __init__(
        self,
        latitude: float,
        longitude: float,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        # 4 decimals (~11 m) is plenty and keeps the URL stable. 2 variables, 1 day = 1 API call.
        self._params = {
            "latitude": f"{latitude:.4f}",
            "longitude": f"{longitude:.4f}",
            "current": "temperature_2m,weather_code",
            "forecast_days": "1",
        }
        self._transport = transport
        self._now = now
        self._lock = asyncio.Lock()
        self._good: tuple[datetime, _Current] | None = None  # (fetched_at, values)
        self._attempted_at: datetime | None = None

    async def current(self) -> tuple[WeatherResponse, bool] | None:
        """(body, stale), or None when there is no value at most MAX_STALE old."""
        # Single flight: while a fetch is in flight, later requests wait for it instead of
        # reading the (still empty) cache.
        if self._due() or self._lock.locked():
            async with self._lock:
                if self._due():
                    await self._refresh()
        if self._good is None or self._age(self._good[0]) > MAX_STALE:
            return None
        fetched_at, cur = self._good
        body = WeatherResponse(
            condition=WMO_GROUP.get(cur.weather_code, "cloudy"),
            temperature_c=round(cur.temperature_2m, 1),
            updated_at=cur.time,
        )
        return body, self._age(fetched_at) > FRESH_FOR

    def _age(self, then: datetime | None) -> timedelta:
        """Time since `then`. Never, or in the future (the clock stepped back): infinitely old."""
        age = timedelta.max if then is None else self._now() - then
        return age if age >= timedelta(0) else timedelta.max

    def _due(self) -> bool:
        return self._age(self._good[0] if self._good else None) > FRESH_FOR and (
            self._age(self._attempted_at) >= MIN_GAP
        )

    async def _refresh(self) -> None:
        # Set before the call: even an unexpected error cannot turn traffic into a retry storm.
        self._attempted_at = attempted_at = self._now()
        try:
            async with (
                asyncio.timeout(FETCH_TIMEOUT_S),
                httpx.AsyncClient(transport=self._transport) as client,
            ):
                response = await client.get(OPEN_METEO_URL, params=self._params)
                response.raise_for_status()
            cur = _Forecast.model_validate_json(response.content).current
        except Exception as exc:  # any failure keeps the last good value (stale-on-error)
            # Type and status only: str(ValidationError) quotes the upstream body.
            status_code = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else ""
            logger.warning(
                "weather: Open-Meteo fetch failed: %s %s", type(exc).__name__, status_code
            )
            return
        if abs(attempted_at - cur.time) > MAX_STALE:  # served as "now", so it must be near now
            logger.warning("weather: Open-Meteo fetch failed: implausible time")
            return
        if cur.weather_code not in WMO_GROUP:
            logger.warning("weather: unknown WMO code %d, shown as cloudy", cur.weather_code)
        self._good = (attempted_at, cur)


def get_weather(request: Request) -> WeatherService:
    weather: WeatherService = request.app.state.weather
    return weather


router = APIRouter(tags=["weather"])


@router.get(
    "/weather",
    response_model=WeatherResponse,
    responses={status.HTTP_503_SERVICE_UNAVAILABLE: {"description": WEATHER_UNAVAILABLE}},
)
async def weather_now(
    response: Response, weather: Annotated[WeatherService, Depends(get_weather)]
) -> WeatherResponse:
    """No parameters: the place is server config. Same body for every visitor."""
    result = await weather.current()
    if result is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            WEATHER_UNAVAILABLE,
            headers={"Retry-After": "120", "Cache-Control": "no-store"},
        )
    body, stale = result
    # Browsers and Vercel's CDN (honours origin Cache-Control on external rewrites) share it.
    response.headers["Cache-Control"] = f"public, max-age={60 if stale else 300}"
    return body
