"""LLM clients: Gemini adapter (google-genai), replay wrapper, factory (engine-v0.2.md §5.7).

Profile -> Gemini 3.x ``thinking_level`` of ONE model (checked on ai.google.dev 2026-10-07:
gemini-3.8-flash supports low/medium/high, not minimal):

    nhe -> LOW, can_bang -> MEDIUM, sau -> HIGH

``max_output_tokens`` = PROFILE_MAX_TOKENS (thinking counts toward it). No temperature.
Usage: input = prompt_token_count (already includes cached tokens), output =
candidates_token_count + thoughts_token_count. Never log prompts, responses, headers or the key.
"""

import asyncio
import logging
from typing import Final

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
RETRY_DELAY_S: Final = 1.0
# Fast 5xx only: a 429 retried after 1 s hits the same limit again, and a 504 (provider
# deadline) will not fit in what is left of the case deadline. Each attempt counts in DailyCap.
RETRYABLE_STATUS: Final = frozenset({500, 502, 503})
_TIMEOUT_MS: Final = int(CASE_DEADLINE_S * 1000)  # HttpOptions.timeout is in milliseconds

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
    return LLMResponse(text=text, stop_reason=stop, usage=usage, model=resp.model_version or model)


class GeminiClient:
    """LLMClient over the official google-genai SDK (async). SDK retries stay off (its default);
    this adapter retries once after RETRY_DELAY_S on 500/502/503 only. No local concurrency
    cap: max_concurrent_runs x MAX_CONCURRENT_CASES bounds it, and a local queue would eat the
    case deadline."""

    def __init__(self, *, api_key: str, model: str, daily_cap: DailyCap) -> None:
        # Key passed explicitly, never via the SDK's environment lookup.
        client = genai.Client(
            api_key=api_key, http_options=genai_types.HttpOptions(timeout=_TIMEOUT_MS)
        )
        self._models = client.aio.models
        self._model = model
        self._daily_cap = daily_cap

    @property
    def provider(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self._model

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
        for attempt in (1, 2):
            self._daily_cap.reserve()  # every real network attempt counts
            try:
                resp = await self._models.generate_content(
                    model=self._model, contents=contents, config=config
                )
            except genai_errors.APIError as exc:
                status = exc.code
                retryable = status in RETRYABLE_STATUS
                logger.warning(
                    "gemini call failed: %s status=%s attempt=%d",
                    type(exc).__name__,
                    status,
                    attempt,
                )
                if retryable and attempt == 1:
                    await asyncio.sleep(RETRY_DELAY_S)
                    continue
                # from None: the SDK error carries the provider response body.
                raise LLMCallError(
                    f"gemini {type(exc).__name__} status={status}",
                    status=status,
                    retryable=retryable,
                ) from None
            except httpx.HTTPError as exc:  # network/timeout; the case deadline is near
                logger.warning("gemini transport error: %s", type(exc).__name__)
                raise LLMCallError(f"gemini {type(exc).__name__}") from None
            return _to_response(resp, self._model)
        raise AssertionError("unreachable")  # pragma: no cover


class ReplayingLLM:
    """Wraps a real client with the replay cache. Hits skip DailyCap (no network call)."""

    def __init__(self, inner: LLMClient, store: ReplayStore) -> None:
        self._inner = inner
        self._store = store

    @property
    def provider(self) -> str:
        return self._inner.provider

    @property
    def model(self) -> str:
        return self._inner.model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        key = replay_key(self._inner.provider, self._inner.model, request, FRAME_VERSION)
        if (hit := self._store.get(key)) is not None:
            return hit
        response = await self._inner.complete(request)
        self._store.put(key, response)
        return response


def build_llm_client(settings: Settings, *, daily_cap: DailyCap, store: ReplayStore) -> LLMClient:
    """Raises LLMNotConfiguredError when GEMINI_API_KEY is unset or blank."""
    key = settings.gemini_api_key.get_secret_value().strip() if settings.gemini_api_key else ""
    if not key:
        raise LLMNotConfiguredError("GEMINI_API_KEY is not set")
    return ReplayingLLM(
        GeminiClient(api_key=key, model=settings.gemini_model, daily_cap=daily_cap), store
    )
