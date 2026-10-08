"""LLM clients: Gemini adapter over a model chain (google-genai), replay wrapper, factory
(engine-v0.2.md §5.7, §14 status 2026-10-08).

Profile -> Gemini ``thinking_level``, the same for every model of the chain (2026-10-08:
ai.google.dev lists low/medium/high for 3.5-flash-lite and 3.5-flash, and a real call with MEDIUM
worked on 3.1-flash-lite and 3.5-flash; gemini-2.5-flash answers 400 "Thinking level is not
supported for this model", so it stays out of the default chain). Every Library level locks
``can_bang`` (MEDIUM); probe LOW/HIGH on the chain before a level unlocks another profile:

    nhe -> LOW, can_bang -> MEDIUM, sau -> HIGH

``max_output_tokens`` = PROFILE_MAX_TOKENS (thinking counts toward it). No temperature.
Usage: input = prompt_token_count (already includes cached tokens), output =
candidates_token_count + thoughts_token_count. Never log prompts, responses, headers or the key.

Model chain: GEMINI_MODEL, then GEMINI_FALLBACK_MODELS. A per-model requests-per-minute limiter
(shared by every case and run of the process) keeps bursts under the key's quota. A 429
(RESOURCE_EXHAUSTED) or 503 puts that model in cooldown (the provider's RetryInfo delay; a
per-day quota until the next Pacific midnight) and the same request goes to the next model,
within the case deadline. A call is only sent if its model can finish before the case deadline
(MIN_CALL_S), and its server timeout is what is left of the case. DailyCap still counts every
network attempt.
"""

import asyncio
import logging
import re
import time
from collections import deque
from collections.abc import Awaitable, Callable, Mapping, Sequence
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta
from typing import Any, Final

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from vgame.config import Settings
from vgame.engine.budget import DailyCap
from vgame.engine.constants import CASE_DEADLINE_S, Profile
from vgame.engine.prompt import FRAME_VERSION
from vgame.engine.replay import ReplayStore, replay_key
from vgame.engine.types import (
    LLMCallError,
    LLMClient,
    LLMNotConfiguredError,
    LLMRequest,
    LLMResponse,
    StopReason,
    Usage,
)

logger = logging.getLogger(__name__)

GEMINI_THINKING: Final[dict[Profile, genai_types.ThinkingLevel]] = {
    "nhe": genai_types.ThinkingLevel.LOW,
    "can_bang": genai_types.ThinkingLevel.MEDIUM,
    "sau": genai_types.ThinkingLevel.HIGH,
}
# Owner's free-tier requests per minute (2026-10-08). Only requests are limited: 250K tokens per
# minute stays above 15 RPM x ~3.6k input tokens per call (packer fixed at 3,000 in every level,
# plus frame and cards) = ~54k. Override with GEMINI_RPM.
DEFAULT_RPM: Final[dict[str, int]] = {
    "gemini-3.8-flash": 5,
    "gemini-3.5-flash-lite": 15,
    "gemini-3.1-flash-lite": 15,
    "gemini-3.5-flash": 5,
    "gemini-3.7-flash": 5,
    "gemini-2.5-flash": 5,
}
UNKNOWN_MODEL_RPM: Final = 5  # the lowest tier of the table
# Provider windows are 60 s; 2 s of margin for arrival jitter and fixed-minute counters.
RPM_WINDOW_S: Final = 62.0
RETRY_DELAY_S: Final = 1.0
# 500/502: retried once on the same model. 429/503: the model sits out, the next one answers.
# 504 (provider deadline) and 4xx: raised, a later attempt would not fit or not help.
RETRYABLE_STATUS: Final = frozenset({500, 502})
FALLBACK_STATUS: Final = frozenset({429, 503})
DEFAULT_COOLDOWN_S: Final = 60.0  # 429/503 without a RetryInfo delay
# Latest start before the case deadline, per model (about its slowest measured call): a call
# that cannot finish is never sent, it would only cost a DailyCap slot and the model's quota.
# 3.5-flash-lite: p95 ~3.5 s (spike 3.0b); 3.1-flash-lite: LLM step p50 8.7 s, max 18.3 s
# (calibration 2026-10-08). Unmeasured models get the slow value.
MIN_CALL_S: Final[dict[str, float]] = {"gemini-3.5-flash-lite": 4.0, "gemini-3.1-flash-lite": 15.0}
UNMEASURED_MIN_CALL_S: Final = 15.0
_DELAY_RE: Final = re.compile(r"(\d+(?:\.\d+)?)s")

# loop.time() deadline of the running case; set by the runtime in each case task.
case_deadline: ContextVar[float | None] = ContextVar("case_deadline", default=None)

_FINISH: Final[dict[genai_types.FinishReason, StopReason]] = {
    genai_types.FinishReason.STOP: "end",
    genai_types.FinishReason.MAX_TOKENS: "max_tokens",
    genai_types.FinishReason.SAFETY: "refusal",
    genai_types.FinishReason.PROHIBITED_CONTENT: "refusal",
    genai_types.FinishReason.BLOCKLIST: "refusal",
    genai_types.FinishReason.SPII: "refusal",
    genai_types.FinishReason.RECITATION: "refusal",
}


def _to_response(resp: genai_types.GenerateContentResponse, model: str) -> LLMResponse:
    """``model`` is the chain id that served the call (replay key, quotas), not model_version."""
    meta = resp.usage_metadata
    usage = (
        Usage(
            meta.prompt_token_count or 0,
            (meta.candidates_token_count or 0) + (meta.thoughts_token_count or 0),
        )
        if meta
        else Usage()
    )
    stop: StopReason
    text = ""
    if resp.prompt_feedback is not None and resp.prompt_feedback.block_reason is not None:
        stop = "refusal"
    elif not resp.candidates:
        stop = "error"
    else:
        cand = resp.candidates[0]
        stop = _FINISH.get(cand.finish_reason, "error") if cand.finish_reason else "error"
        parts = cand.content.parts if cand.content and cand.content.parts else []
        # Answer text only: thought summaries (never requested) are skipped defensively.
        text = "".join(p.text for p in parts if p.text and not p.thought)
    return LLMResponse(text=text, stop_reason=stop, usage=usage, model=model)


def _pacific_offset(utc: datetime) -> timedelta:
    """UTC offset of US Pacific time: daylight time from the second Sunday of March 02:00 PST
    to the first Sunday of November 02:00 PDT (US rule since 2007). zoneinfo would need the
    tzdata package on Windows."""
    march = datetime(utc.year, 3, 8, 10, tzinfo=UTC)  # 02:00 PST
    november = datetime(utc.year, 11, 1, 9, tzinfo=UTC)  # 02:00 PDT
    start = march + timedelta(days=(6 - march.weekday()) % 7)
    end = november + timedelta(days=(6 - november.weekday()) % 7)
    return timedelta(hours=-7 if start <= utc < end else -8)


def seconds_until_pacific_midnight(now: datetime) -> float:
    """Gemini per-day quotas reset at midnight Pacific time."""
    wall = now + _pacific_offset(now)  # Pacific wall clock, still labelled UTC
    midnight = datetime(wall.year, wall.month, wall.day, tzinfo=UTC) + timedelta(days=1)
    # Offset at that midnight (DST switches at 02:00, so the PST guess lands on the right side).
    instant = midnight - _pacific_offset(midnight + timedelta(hours=8))
    return (instant - now).total_seconds()


def _cooldown_s(exc: genai_errors.APIError, now: datetime) -> float:
    """How long a model sits out after a 429/503. Reads only the structured google.rpc details
    (QuotaFailure, RetryInfo) of the error body; nothing from it is logged."""
    error: Any = exc.details.get("error") if isinstance(exc.details, dict) else None
    details: Any = error.get("details") if isinstance(error, dict) else None
    delay = DEFAULT_COOLDOWN_S
    for item in details if isinstance(details, list) else []:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("@type", ""))
        if kind.endswith("QuotaFailure"):
            violations = item.get("violations")
            for v in violations if isinstance(violations, list) else []:
                if isinstance(v, dict) and "PerDay" in str(v.get("quotaId", "")):
                    return seconds_until_pacific_midnight(now)
        elif kind.endswith("RetryInfo") and (
            match := _DELAY_RE.fullmatch(str(item.get("retryDelay", "")))
        ):
            delay = float(match.group(1))
    return delay


class RateLimiter:
    """Per-model sliding window: at most ``rpm`` call starts in any 60 s. Shared by every case
    and run of the process; event-loop only (no await in ``reserve``, so no lock)."""

    # ponytail: per process, requests only; share it through Redis with the DailyCap once
    # there is more than one worker.

    def __init__(self, rpm: Mapping[str, int]) -> None:
        self.rpm = dict(rpm)
        self._starts: dict[str, deque[float]] = {}

    def reserve(self, model: str, now: float, latest: float) -> float | None:
        """Book the earliest start >= ``now``, or None (nothing booked) if it is after
        ``latest``. Starts are booked in order, so the window only needs the last ``rpm``."""
        rpm = self.rpm.get(model, UNKNOWN_MODEL_RPM)
        starts = self._starts.setdefault(model, deque(maxlen=rpm))
        start = now if len(starts) < rpm else max(now, starts[0] + RPM_WINDOW_S)
        if start > latest:
            return None
        starts.append(start)
        return start


def _utcnow() -> datetime:
    return datetime.now(UTC)


class GeminiClient:
    """LLMClient over the official google-genai SDK (async), one SDK client for the whole chain.
    SDK retries stay off (its default). No concurrency cap of its own: max_concurrent_runs x
    MAX_CONCURRENT_CASES bounds calls in flight, the limiter bounds calls per minute."""

    def __init__(
        self,
        *,
        api_key: str,
        models: Sequence[str],
        daily_cap: DailyCap,
        rpm: Mapping[str, int] = DEFAULT_RPM,
        clock: Callable[[], float] = time.monotonic,  # == loop.time() of asyncio loops
        utcnow: Callable[[], datetime] = _utcnow,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if not models:
            raise ValueError("the Gemini model chain is empty")
        # Key passed explicitly, never via the SDK's environment lookup. No client-wide timeout:
        # each request carries what is left of its case (``_attempt``).
        self._api = genai.Client(api_key=api_key).aio.models
        self.models = tuple(models)
        self._daily_cap = daily_cap
        self._limiter = RateLimiter(rpm)
        self._cooldown: dict[str, float] = {}  # model -> clock() until which it sits out
        self._clock, self._utcnow, self._sleep = clock, utcnow, sleep

    @property
    def provider(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self.models[0]

    @property
    def rpm(self) -> Mapping[str, int]:
        return self._limiter.rpm

    async def complete(self, request: LLMRequest) -> LLMResponse:
        contents: list[genai_types.ContentUnion] = [
            genai_types.Content(role=m.role, parts=[genai_types.Part(text=m.text)])
            for m in request.messages
        ]
        config = genai_types.GenerateContentConfig(
            system_instruction=request.system or None,
            max_output_tokens=request.max_tokens,
            thinking_config=genai_types.ThinkingConfig(
                thinking_level=GEMINI_THINKING[request.profile]
            ),
        )
        deadline = case_deadline.get()
        if deadline is None:
            deadline = self._clock() + CASE_DEADLINE_S
        queue = list(self.models)
        retried = too_late = False
        last: LLMCallError | None = None
        while queue:
            model = queue.pop(0)
            now = self._clock()
            if self._cooldown.get(model, 0.0) > now:
                continue
            latest = deadline - MIN_CALL_S.get(model, UNMEASURED_MIN_CALL_S)
            if latest < now:  # even a free slot could not finish before the deadline
                too_late = True
                continue
            start = self._limiter.reserve(model, now, latest)
            if start is None:  # this model's next free slot is too late: try the next one
                continue
            if start > now:
                await self._sleep(start - now)
                if self._cooldown.get(model, 0.0) > self._clock():  # a 429 landed meanwhile
                    continue
            try:
                return await self._attempt(model, contents, config, deadline)
            except LLMCallError as exc:
                if exc.status in RETRYABLE_STATUS and not retried:
                    retried = True
                    await self._sleep(RETRY_DELAY_S)
                    queue.insert(0, model)
                    continue
                if exc.status not in FALLBACK_STATUS:
                    raise
                last = exc
        if last is not None:
            raise last
        if too_late:  # the step and the case end as "timeout", with no network call
            raise TimeoutError("gemini: no model can answer before the case deadline")
        logger.warning("gemini: every model is cooling down or busy until the case deadline")
        raise LLMCallError("gemini: no model free before the case deadline", status=429)

    async def _attempt(
        self,
        model: str,
        contents: list[genai_types.ContentUnion],
        config: genai_types.GenerateContentConfig,
        deadline: float,
    ) -> LLMResponse:
        """One network request; a 429/503 also puts ``model`` in cooldown. The SDK also sends
        the timeout as X-Server-Timeout, so the provider stops when the case gives up."""
        self._daily_cap.reserve()  # every real network attempt counts
        timeout_ms = max(1000, round((deadline - self._clock()) * 1000))
        config = config.model_copy(
            update={"http_options": genai_types.HttpOptions(timeout=timeout_ms)}
        )
        try:
            resp = await self._api.generate_content(model=model, contents=contents, config=config)
        except genai_errors.APIError as exc:
            status = exc.code
            cooldown = 0.0
            if status in FALLBACK_STATUS:
                cooldown = _cooldown_s(exc, self._utcnow())
                self._cooldown[model] = self._clock() + cooldown
            logger.warning(
                "gemini call failed: %s model=%s status=%s cooldown_s=%.0f",
                type(exc).__name__,
                model,
                status,
                cooldown,
            )
            # from None: the SDK error carries the provider response body.
            raise LLMCallError(
                f"gemini {type(exc).__name__} model={model} status={status}",
                status=status,
                retryable=status in RETRYABLE_STATUS | FALLBACK_STATUS,
            ) from None
        except httpx.HTTPError as exc:  # network/timeout; the case deadline is near
            logger.warning("gemini transport error: %s model=%s", type(exc).__name__, model)
            raise LLMCallError(f"gemini {type(exc).__name__}") from None
        return _to_response(resp, model)


class ReplayingLLM:
    """Wraps a real client with the replay cache. Hits skip DailyCap and the limiter (no network
    call). Keys carry the model that served the answer; lookups try the chain in order."""

    def __init__(self, inner: LLMClient, store: ReplayStore, *, models: Sequence[str] = ()) -> None:
        self.inner = inner
        self._store = store
        self.models = tuple(models) or (inner.model,)

    @property
    def provider(self) -> str:
        return self.inner.provider

    @property
    def model(self) -> str:
        return self.inner.model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        for model in self.models:
            hit = self._store.get(replay_key(self.provider, model, request, FRAME_VERSION))
            if hit is not None:
                return hit
        response = await self.inner.complete(request)
        self._store.put(replay_key(self.provider, response.model, request, FRAME_VERSION), response)
        return response


def build_llm_client(settings: Settings, *, daily_cap: DailyCap, store: ReplayStore) -> LLMClient:
    """Raises LLMNotConfiguredError when GEMINI_API_KEY is unset or blank."""
    key = settings.gemini_api_key.get_secret_value().strip() if settings.gemini_api_key else ""
    if not key:
        raise LLMNotConfiguredError("GEMINI_API_KEY is not set")
    models = list(dict.fromkeys([settings.gemini_model, *settings.gemini_fallback_models]))
    gemini = GeminiClient(
        api_key=key,
        models=models,
        daily_cap=daily_cap,
        rpm={**DEFAULT_RPM, **settings.gemini_rpm},
    )
    return ReplayingLLM(gemini, store, models=models)
