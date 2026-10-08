"""Gemini adapter against a fake SDK client (no network), replay wrapper, factory, fakes."""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

import pytest
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as gt
from pydantic import SecretStr

from tests.engine.fakes_llm import ABSTAIN_TEXT, FakeLLM, Oracle, OracleCase
from vgame.config import Settings
from vgame.engine import llm
from vgame.engine.budget import DailyCap
from vgame.engine.constants import count_tokens
from vgame.engine.prompt import build_request, parse_citations, render_docs
from vgame.engine.replay import ReplayStore
from vgame.engine.types import (
    BudgetExceededError,
    Chunk,
    LLMCallError,
    LLMMessage,
    LLMNotConfiguredError,
    LLMRequest,
    PackedContext,
    Usage,
)

FAKE_KEY = "test-key-NOT-REAL-123"
REQ = LLMRequest("sau", "khung", (LLMMessage("user", "Câu hỏi: x"),), 16000)


def response(
    text: str = "Đáp [ab12cd34]",
    finish: gt.FinishReason | None = gt.FinishReason.STOP,
    *,
    block: gt.BlockedReason | None = None,
) -> gt.GenerateContentResponse:
    return gt.GenerateContentResponse(
        candidates=[
            gt.Candidate(
                content=gt.Content(
                    role="model",
                    parts=[gt.Part(text="nghĩ thầm", thought=True), gt.Part(text=text)],
                ),
                finish_reason=finish,
            )
        ]
        if block is None
        else None,
        prompt_feedback=gt.GenerateContentResponsePromptFeedback(block_reason=block)
        if block
        else None,
        usage_metadata=gt.GenerateContentResponseUsageMetadata(
            prompt_token_count=1000,
            cached_content_token_count=400,  # already inside prompt_token_count
            candidates_token_count=50,
            thoughts_token_count=200,
            total_token_count=1250,
        ),
        model_version="gemini-3.8-flash-001",
    )


@dataclass
class FakeModels:
    outcomes: list[gt.GenerateContentResponse | Exception]
    calls: list[dict[str, Any]] = field(default_factory=list)
    created: list[dict[str, Any]] = field(default_factory=list)

    async def generate_content(self, **kwargs: Any) -> gt.GenerateContentResponse:
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def fake_sdk(monkeypatch: pytest.MonkeyPatch) -> FakeModels:
    models = FakeModels([])

    class FakeClient:
        def __init__(self, **kwargs: Any) -> None:
            models.created.append(kwargs)
            self.aio = type("Aio", (), {"models": models})()

    monkeypatch.setattr(genai, "Client", FakeClient)
    monkeypatch.setattr(llm, "RETRY_DELAY_S", 0.0)
    return models


def gemini(cap: int = 100) -> llm.GeminiClient:
    return llm.GeminiClient(api_key=FAKE_KEY, model="gemini-3.8-flash", daily_cap=DailyCap(cap))


def test_request_maps_profile_to_thinking_level_without_temperature(fake_sdk: FakeModels) -> None:
    fake_sdk.outcomes.append(response())
    asyncio.run(gemini().complete(REQ))
    (call,) = fake_sdk.calls
    config: gt.GenerateContentConfig = call["config"]
    assert call["model"] == "gemini-3.8-flash"
    assert config.thinking_config is not None
    assert config.thinking_config.thinking_level == gt.ThinkingLevel.HIGH
    assert config.max_output_tokens == 16000
    assert config.system_instruction == "khung"
    assert config.temperature is None
    assert call["contents"][0].parts[0].text == "Câu hỏi: x"
    (created,) = fake_sdk.created
    assert created["api_key"] == FAKE_KEY
    assert created["http_options"].timeout == 20_000  # milliseconds
    assert llm.GEMINI_THINKING == {
        "nhe": gt.ThinkingLevel.LOW,
        "can_bang": gt.ThinkingLevel.MEDIUM,
        "sau": gt.ThinkingLevel.HIGH,
    }


def test_usage_counts_thinking_as_output_and_cache_once(fake_sdk: FakeModels) -> None:
    fake_sdk.outcomes.append(response())
    resp = asyncio.run(gemini().complete(REQ))
    assert resp.usage == Usage(1000, 250)
    assert resp.usage.tokens == 1250
    assert resp.text == "Đáp [ab12cd34]"  # thought part skipped
    assert (resp.stop_reason, resp.model, resp.replayed) == ("end", "gemini-3.8-flash-001", False)


@pytest.mark.parametrize(
    ("finish", "block", "expected"),
    [
        (gt.FinishReason.STOP, None, "end"),
        (gt.FinishReason.MAX_TOKENS, None, "max_tokens"),
        (gt.FinishReason.SAFETY, None, "refusal"),
        (gt.FinishReason.PROHIBITED_CONTENT, None, "refusal"),
        (gt.FinishReason.BLOCKLIST, None, "refusal"),
        (gt.FinishReason.SPII, None, "refusal"),
        (gt.FinishReason.RECITATION, None, "refusal"),
        (gt.FinishReason.OTHER, None, "error"),
        (gt.FinishReason.MALFORMED_FUNCTION_CALL, None, "error"),
        (None, None, "error"),
        (None, gt.BlockedReason.SAFETY, "refusal"),
    ],
)
def test_finish_reason_mapping(
    fake_sdk: FakeModels,
    finish: gt.FinishReason | None,
    block: gt.BlockedReason | None,
    expected: str,
) -> None:
    fake_sdk.outcomes.append(response(finish=finish, block=block))
    assert asyncio.run(gemini().complete(REQ)).stop_reason == expected


def test_retries_once_on_503_then_succeeds(fake_sdk: FakeModels) -> None:
    fake_sdk.outcomes += [genai_errors.ServerError(503, {"error": {"message": "busy"}}), response()]
    cap = DailyCap(10)
    client = llm.GeminiClient(api_key=FAKE_KEY, model="m", daily_cap=cap)
    assert asyncio.run(client.complete(REQ)).stop_reason == "end"
    assert len(fake_sdk.calls) == 2
    assert cap._count == 2  # both network attempts count against the daily cap


def test_second_retryable_failure_raises(fake_sdk: FakeModels) -> None:
    fake_sdk.outcomes += [genai_errors.ServerError(503, {}), genai_errors.ServerError(503, {})]
    with pytest.raises(LLMCallError) as exc:
        asyncio.run(gemini().complete(REQ))
    assert (exc.value.status, exc.value.retryable) == (503, True)
    assert len(fake_sdk.calls) == 2


@pytest.mark.parametrize("status", [429, 504])
def test_rate_limit_and_provider_deadline_raise_after_one_attempt(
    fake_sdk: FakeModels, status: int
) -> None:
    error = genai_errors.ClientError if status < 500 else genai_errors.ServerError
    fake_sdk.outcomes += [error(status, {}), response()]
    cap = DailyCap(10)
    client = llm.GeminiClient(api_key=FAKE_KEY, model="m", daily_cap=cap)
    with pytest.raises(LLMCallError) as exc:
        asyncio.run(client.complete(REQ))
    assert (exc.value.status, exc.value.retryable) == (status, False)
    assert len(fake_sdk.calls) == 1
    assert cap._count == 1


def test_no_retry_on_400_and_error_never_leaks_key_or_body(
    fake_sdk: FakeModels, caplog: pytest.LogCaptureFixture
) -> None:
    body = {"error": {"message": "API key " + FAKE_KEY + " not valid", "status": "INVALID"}}
    fake_sdk.outcomes.append(genai_errors.ClientError(400, body))
    with caplog.at_level(logging.DEBUG), pytest.raises(LLMCallError) as exc:
        asyncio.run(gemini().complete(REQ))
    assert len(fake_sdk.calls) == 1
    err = exc.value
    assert (err.status, err.retryable) == (400, False)
    assert err.__cause__ is None
    assert err.__suppress_context__
    for text in (str(err), err.message_vi, caplog.text):
        assert FAKE_KEY not in text
        assert "not valid" not in text
        assert "Câu hỏi" not in text


def test_daily_cap_blocks_before_any_network_call(fake_sdk: FakeModels) -> None:
    with pytest.raises(BudgetExceededError):
        asyncio.run(gemini(cap=0).complete(REQ))
    assert fake_sdk.calls == []


def test_replaying_llm_hits_skip_inner_and_keep_original_usage() -> None:
    inner = FakeLLM("Đáp [ab12cd34]")
    client = llm.ReplayingLLM(inner, ReplayStore(":memory:"))
    first = asyncio.run(client.complete(REQ))
    second = asyncio.run(client.complete(REQ))
    assert len(inner.requests) == 1
    assert (first.replayed, second.replayed) == (False, True)
    assert second.usage == first.usage
    assert (client.provider, client.model) == ("fake", "fake-llm")


def test_replaying_llm_does_not_cache_errors() -> None:
    inner = FakeLLM("", stop_reason="error")
    client = llm.ReplayingLLM(inner, ReplayStore(":memory:"))
    asyncio.run(client.complete(REQ))
    asyncio.run(client.complete(REQ))
    assert len(inner.requests) == 2


@pytest.mark.parametrize("key", [None, "", "   "])
def test_factory_without_key_raises_vietnamese_not_configured(key: str | None) -> None:
    settings = Settings(_env_file=None, gemini_api_key=None if key is None else SecretStr(key))
    with pytest.raises(LLMNotConfiguredError) as exc:
        llm.build_llm_client(settings, daily_cap=DailyCap(1), store=ReplayStore(":memory:"))
    assert "Chưa cấu hình LLM" in exc.value.message_vi


def test_factory_with_key_wraps_gemini_in_replay(fake_sdk: FakeModels) -> None:
    settings = Settings(_env_file=None, gemini_api_key=SecretStr(FAKE_KEY), gemini_model="gemini-x")
    client = llm.build_llm_client(settings, daily_cap=DailyCap(1), store=ReplayStore(":memory:"))
    assert isinstance(client, llm.ReplayingLLM)
    assert (client.provider, client.model) == ("gemini", "gemini-x")


# --- Test doubles ---------------------------------------------------------------------------


def chunk(cid: str, text: str) -> Chunk:
    return Chunk(cid, "qcdt-2024", 12, (2,), True, text, count_tokens(text), 0, len(text))


QUOTE = "Sinh viên nộp đơn bảo lưu cho phòng đào tạo chậm nhất hai tuần."
QUESTION = "Bảo lưu cần làm gì?"
CASES = {
    QUESTION: OracleCase(("hai tuần", "phòng đào tạo"), (QUOTE,), abstain=False),
    "Điều 99 nói gì?": OracleCase((), (), abstain=True),
}


def ask(
    oracle: Oracle, chunks: tuple[Chunk, ...], *, cite_ids: bool, question: str = QUESTION
) -> str:
    ctx = PackedContext(
        question, render_docs(chunks, cite_ids=cite_ids), chunks, (), 0, 0, 3000, cite_ids
    )
    return asyncio.run(
        oracle.complete(build_request(ctx, profile="can_bang", system_prompt=""))
    ).text


def test_oracle_cites_the_block_holding_the_quote() -> None:
    chunks = (chunk("11111111", "Điều 10. Khác"), chunk("ab12cd34", "2. " + QUOTE + " Thêm"))
    answer = ask(Oracle(CASES), chunks, cite_ids=True)
    assert parse_citations(answer) == ("ab12cd34",)
    assert "hai tuần" in answer
    assert "phòng đào tạo" in answer
    assert "Điều" not in answer


def test_oracle_without_ids_answers_uncited_and_fabricates_when_quote_missing() -> None:
    oracle = Oracle(CASES)
    plain = ask(oracle, (chunk("ab12cd34", QUOTE),), cite_ids=False)
    assert parse_citations(plain) == ()
    assert "hai tuần" in plain
    invented = ask(oracle, (chunk("11111111", "Điều 10. Khác"),), cite_ids=True)
    assert invented.startswith("Theo Điều 99, ")
    assert parse_citations(invented) == ()
    assert ask(oracle, (), cite_ids=True).startswith("Theo Điều 99, ")


def test_oracle_abstains_and_fake_usage_uses_engine_tokenizer() -> None:
    oracle = Oracle(CASES)
    assert ask(oracle, (), cite_ids=True, question="Điều 99 nói gì?") == ABSTAIN_TEXT
    req = oracle.requests[-1]
    resp = asyncio.run(FakeLLM("một hai").complete(req))
    assert resp.usage == Usage(count_tokens(req.system + "\n" + req.messages[0].text), 2)


def test_fake_llm_fail_and_stop_reason() -> None:
    with pytest.raises(LLMCallError):
        asyncio.run(FakeLLM("x", fail=LLMCallError("boom", status=503)).complete(REQ))
    assert asyncio.run(FakeLLM("x", stop_reason="refusal").complete(REQ)).stop_reason == "refusal"
