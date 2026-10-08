"""Gemini adapter against a fake SDK client (no network), replay wrapper, factory, fakes."""

import asyncio
import logging
from collections.abc import Sequence
from datetime import UTC, datetime

import pytest
from google.genai import errors as genai_errors
from google.genai import types as gt
from pydantic import SecretStr

from tests.engine.fakes_llm import (
    ABSTAIN_TEXT,
    FakeClock,
    FakeLLM,
    FakeModels,
    Oracle,
    OracleCase,
    install_fake_genai,
    quota_error,
)
from vgame.config import Settings
from vgame.engine import llm
from vgame.engine.budget import DailyCap
from vgame.engine.constants import count_tokens
from vgame.engine.prompt import FRAME_VERSION, build_request, parse_citations, render_docs
from vgame.engine.replay import ReplayStore, replay_key
from vgame.engine.types import (
    BudgetExceededError,
    Chunk,
    LLMCallError,
    LLMMessage,
    LLMNotConfiguredError,
    LLMRequest,
    LLMResponse,
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


@pytest.fixture
def fake_sdk(monkeypatch: pytest.MonkeyPatch) -> FakeModels:
    monkeypatch.setattr(llm, "RETRY_DELAY_S", 0.0)
    return install_fake_genai(monkeypatch)


def gemini(cap: int = 100, models: Sequence[str] = ("gemini-3.8-flash",)) -> llm.GeminiClient:
    return llm.GeminiClient(api_key=FAKE_KEY, models=models, daily_cap=DailyCap(cap))


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
    assert created == {"api_key": FAKE_KEY}  # the timeout is per request (case deadline)
    assert config.http_options is not None
    assert config.http_options.timeout == 20_000  # milliseconds, no case deadline set
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
    # The chain id that served the call (replay key, quotas), not the provider's model_version.
    assert (resp.stop_reason, resp.model, resp.replayed) == ("end", "gemini-3.8-flash", False)


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


@pytest.mark.parametrize("status", [500, 502])
def test_retries_once_on_500_502_on_the_same_model(fake_sdk: FakeModels, status: int) -> None:
    fake_sdk.outcomes += [genai_errors.ServerError(status, {"error": {"message": "x"}}), response()]
    cap = DailyCap(10)
    client = llm.GeminiClient(api_key=FAKE_KEY, models=["m", "m2"], daily_cap=cap)
    assert asyncio.run(client.complete(REQ)).stop_reason == "end"
    assert fake_sdk.models == ["m", "m"]
    assert cap._count == 2  # both network attempts count against the daily cap


def test_second_500_raises(fake_sdk: FakeModels) -> None:
    fake_sdk.outcomes += [genai_errors.ServerError(500, {}), genai_errors.ServerError(500, {})]
    with pytest.raises(LLMCallError) as exc:
        asyncio.run(gemini(models=["m", "m2"]).complete(REQ))
    assert (exc.value.status, exc.value.retryable) == (500, True)
    assert fake_sdk.models == ["m", "m"]


@pytest.mark.parametrize("status", [429, 503, 504])
def test_single_model_raises_after_one_attempt_on_429_503_504(
    fake_sdk: FakeModels, status: int
) -> None:
    fake_sdk.outcomes += [quota_error(status), response()]
    cap = DailyCap(10)
    with pytest.raises(LLMCallError) as exc:
        asyncio.run(llm.GeminiClient(api_key=FAKE_KEY, models=["m"], daily_cap=cap).complete(REQ))
    assert (exc.value.status, exc.value.retryable) == (status, status != 504)
    assert len(fake_sdk.calls) == 1
    assert cap._count == 1


def test_no_retry_on_400_and_error_never_leaks_key_or_body(
    fake_sdk: FakeModels, caplog: pytest.LogCaptureFixture
) -> None:
    body = {"error": {"message": "API key " + FAKE_KEY + " not valid", "status": "INVALID"}}
    fake_sdk.outcomes.append(genai_errors.ClientError(400, body))
    with caplog.at_level(logging.DEBUG), pytest.raises(LLMCallError) as exc:
        asyncio.run(gemini(models=["m", "m2"]).complete(REQ))
    assert len(fake_sdk.calls) == 1  # a bad request fails on every model: no fallback
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
        asyncio.run(gemini(cap=0, models=["m", "m2"]).complete(REQ))
    assert fake_sdk.calls == []


# --- Model chain: limiter, fallback, cooldown ------------------------------------------------


def chain(
    clock: FakeClock,
    models: Sequence[str] = ("a", "b"),
    *,
    rpm: dict[str, int] | None = None,
    cap: int = 100,
    utc: datetime = datetime(2026, 10, 8, 20, 0, tzinfo=UTC),
) -> llm.GeminiClient:
    return llm.GeminiClient(
        api_key=FAKE_KEY,
        models=models,
        daily_cap=DailyCap(cap),
        rpm=rpm or {"a": 15, "b": 15},
        clock=clock,
        utcnow=lambda: utc,
        sleep=clock.sleep,
    )


async def complete(client: llm.GeminiClient, clock: FakeClock, budget_s: float = 20.0) -> str:
    """One call with the case deadline the runtime would set ``budget_s`` from now."""
    token = llm.case_deadline.set(clock.now + budget_s)
    try:
        return (await client.complete(REQ)).model
    finally:
        llm.case_deadline.reset(token)


def test_rate_limiter_keeps_every_window_within_rpm() -> None:
    w = llm.RPM_WINDOW_S
    assert w >= 61  # margin over the provider's 60 s: arrival jitter, fixed-minute counters
    limiter = llm.RateLimiter({"a": 2})
    assert [limiter.reserve("a", 0.0, latest=1000) for _ in range(5)] == [0, 0, w, w, 2 * w]
    assert limiter.reserve("a", 0.0, latest=2 * w - 1) is None  # next slot (2w) is too late
    assert limiter.reserve("a", 0.0, latest=1000) == 2 * w  # the refusal booked nothing
    assert limiter.reserve("a", 250.0, latest=1000) == 250  # the window has moved on
    assert limiter.reserve("b", 0.0, latest=0) == 0  # per model; unknown models get 5 RPM
    assert llm.UNKNOWN_MODEL_RPM == 5


def test_limiter_spaces_calls_on_one_model(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    client = chain(clock, ["a"], rpm={"a": 1})
    fake_sdk.outcomes += [response(), response()]

    async def scenario() -> None:
        assert await complete(client, clock, budget_s=100) == "a"
        assert await complete(client, clock, budget_s=100) == "a"

    asyncio.run(scenario())
    assert clock.slept == [llm.RPM_WINDOW_S]  # the second call waited for the 1-RPM slot
    # Each request's server timeout is what is left of its case, not a fixed 20 s.
    timeouts = [call["config"].http_options.timeout for call in fake_sdk.calls]
    assert timeouts == [100_000, round((100 - llm.RPM_WINDOW_S) * 1000)]


def test_busy_model_hands_the_call_to_the_next_one_without_waiting(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    client = chain(clock, rpm={"a": 1, "b": 15})
    fake_sdk.outcomes += [response(), response()]

    async def scenario() -> list[str]:
        return [await complete(client, clock), await complete(client, clock)]

    assert asyncio.run(scenario()) == ["a", "b"]  # the next slot of a is past the deadline
    assert clock.slept == []


FAST, SLOW = "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"


def test_a_call_that_cannot_finish_before_the_deadline_is_never_sent(fake_sdk: FakeModels) -> None:
    # It would only cost a DailyCap slot and the model's quota, then time out anyway.
    clock = FakeClock()
    client = chain(clock, [FAST, SLOW], rpm={FAST: 15, SLOW: 15})
    with pytest.raises(TimeoutError):  # the case ends as "timeout", not llm_error
        asyncio.run(complete(client, clock, budget_s=llm.MIN_CALL_S[FAST] - 0.5))
    assert fake_sdk.calls == []
    assert client._daily_cap._count == 0


def test_each_model_needs_its_own_time_before_the_deadline(fake_sdk: FakeModels) -> None:
    # The fallback is ~5x slower (LLM step p50 8.7 s, max 18.3 s): no call with 10 s left.
    assert llm.MIN_CALL_S[FAST] <= 4 < 15 <= llm.MIN_CALL_S[SLOW]
    clock = FakeClock()
    client = chain(clock, [FAST, SLOW], rpm={FAST: 1, SLOW: 15})
    fake_sdk.outcomes += [response(), response()]

    async def scenario() -> None:
        assert await complete(client, clock) == FAST  # uses the primary's only slot
        with pytest.raises(TimeoutError):
            await complete(client, clock, budget_s=10.0)
        assert await complete(client, clock, budget_s=16.0) == SLOW

    asyncio.run(scenario())
    assert fake_sdk.models == [FAST, SLOW]


def test_concurrent_cases_share_the_limiter(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    client = chain(clock, ["a", "b"], rpm={"a": 2, "b": 2})
    fake_sdk.outcomes += [response() for _ in range(5)]

    async def scenario() -> list[str]:
        return list(await asyncio.gather(*(complete(client, clock) for _ in range(5))))

    with pytest.raises(LLMCallError) as exc:  # the 5th finds no slot before its deadline
        asyncio.run(scenario())
    assert exc.value.status == 429
    assert sorted(fake_sdk.models) == ["a", "a", "b", "b"]


def test_429_falls_back_to_the_next_model_and_honours_the_retry_delay(
    fake_sdk: FakeModels,
) -> None:
    clock = FakeClock()
    client = chain(clock)
    fake_sdk.outcomes += [quota_error(429, retry_s="30.5s"), response(), response(), response()]

    async def scenario() -> list[str]:
        served = [await complete(client, clock)]  # a: 429, b answers the same call
        clock.now += 30
        served.append(await complete(client, clock))  # a still cooling down
        clock.now += 1
        served.append(await complete(client, clock))  # a is back
        return served

    assert asyncio.run(scenario()) == ["b", "b", "a"]
    assert fake_sdk.models == ["a", "b", "b", "a"]
    assert fake_sdk.calls[0]["contents"] == fake_sdk.calls[1]["contents"]


def test_a_model_that_cools_down_during_the_wait_for_its_slot_is_skipped(
    fake_sdk: FakeModels,
) -> None:
    clock = FakeClock()
    gate, landed = asyncio.Event(), asyncio.Event()

    async def sleep_until_the_429_landed(seconds: float) -> None:
        await clock.sleep(seconds)
        await landed.wait()

    client = llm.GeminiClient(
        api_key=FAKE_KEY,
        models=["a", "b"],
        daily_cap=DailyCap(10),
        rpm={"a": 1, "b": 15},
        clock=clock,
        sleep=sleep_until_the_429_landed,
    )
    outcomes: list[gt.GenerateContentResponse | Exception] = [
        quota_error(429, retry_s="300s"),
        response(),
        response(),
    ]

    async def generate_content(**kwargs: object) -> gt.GenerateContentResponse:
        fake_sdk.calls.append(dict(kwargs))
        if len(fake_sdk.calls) == 1:
            await gate.wait()  # the first call's 429 lands while the second one waits
        else:
            landed.set()  # the first call already fell back to b
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    fake_sdk.generate_content = generate_content  # type: ignore[method-assign]

    async def scenario() -> list[str]:
        first = asyncio.create_task(complete(client, clock, budget_s=100))
        await asyncio.sleep(0)  # first books a's only slot and waits for the network
        second = asyncio.create_task(complete(client, clock, budget_s=100))
        await asyncio.sleep(0)  # second books a's next slot and sleeps until it
        gate.set()
        return [await first, await second]

    assert asyncio.run(scenario()) == ["b", "b"]
    assert fake_sdk.models == ["a", "b", "b"]  # second never sent to the cooling model


def test_503_falls_back_with_the_default_cooldown(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    client = chain(clock)
    fake_sdk.outcomes += [quota_error(503), response(), response(), response()]

    async def scenario() -> list[str]:
        served = [await complete(client, clock)]
        clock.now += llm.DEFAULT_COOLDOWN_S - 1
        served.append(await complete(client, clock))
        clock.now += 2
        served.append(await complete(client, clock))
        return served

    assert asyncio.run(scenario()) == ["b", "b", "a"]


@pytest.mark.parametrize(
    ("utc", "hours"),
    [
        (datetime(2026, 10, 8, 20, 0, tzinfo=UTC), 11),  # PDT: midnight = 07:00 UTC
        (datetime(2026, 12, 1, 20, 0, tzinfo=UTC), 12),  # PST: midnight = 08:00 UTC
        (datetime(2026, 10, 9, 6, 30, tzinfo=UTC), 0.5),  # 23:30 PDT
    ],
)
def test_per_day_quota_exhausts_the_model_until_pacific_midnight(
    fake_sdk: FakeModels, utc: datetime, hours: float
) -> None:
    clock = FakeClock()
    client = chain(clock, utc=utc)
    fake_sdk.outcomes += [quota_error(429, retry_s="20s", per_day=True)] + [response()] * 3

    async def scenario() -> list[str]:
        served = [await complete(client, clock)]
        clock.now += hours * 3600 - 1
        served.append(await complete(client, clock))
        clock.now += 2
        served.append(await complete(client, clock))
        return served

    assert asyncio.run(scenario()) == ["b", "b", "a"]


def test_pacific_midnight_follows_us_daylight_saving() -> None:
    def until(utc: datetime) -> float:
        return llm.seconds_until_pacific_midnight(utc) / 3600

    assert until(datetime(2026, 3, 8, 7, 0, tzinfo=UTC)) == 1  # 23:00 PST, DST starts at 02:00
    assert until(datetime(2026, 3, 9, 6, 0, tzinfo=UTC)) == 1  # 23:00 PDT
    assert until(datetime(2026, 11, 1, 6, 0, tzinfo=UTC)) == 1  # 23:00 PDT, DST ends at 02:00
    assert until(datetime(2026, 11, 2, 7, 0, tzinfo=UTC)) == 1  # 23:00 PST


def test_every_model_cooling_down_fails_without_a_network_call(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    client = chain(clock)
    fake_sdk.outcomes += [quota_error(429, per_day=True), quota_error(429, retry_s="40s")]

    async def scenario() -> None:
        with pytest.raises(LLMCallError) as first:
            await complete(client, clock)
        assert first.value.status == 429
        with pytest.raises(LLMCallError) as second:
            await complete(client, clock)
        assert second.value.status == 429

    asyncio.run(scenario())
    assert fake_sdk.models == ["a", "b"]  # the second call never reached the network


def test_chain_errors_never_leak_the_body(
    fake_sdk: FakeModels, caplog: pytest.LogCaptureFixture
) -> None:
    clock = FakeClock()
    secret = "quota for key " + FAKE_KEY
    fake_sdk.outcomes += [quota_error(429, retry_s="5s", message=secret), quota_error(503)]
    with caplog.at_level(logging.DEBUG), pytest.raises(LLMCallError) as exc:
        asyncio.run(complete(chain(clock), clock))
    for text in (str(exc.value), exc.value.message_vi, caplog.text):
        assert FAKE_KEY not in text
        assert "quota for key" not in text
    assert "model=a status=429" in caplog.text


def test_daily_cap_still_applies_across_the_chain(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    fake_sdk.outcomes += [quota_error(429), response()]
    with pytest.raises(BudgetExceededError):
        asyncio.run(complete(chain(clock, cap=1), clock))
    assert fake_sdk.models == ["a"]


# --- Replay -----------------------------------------------------------------------------------


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


def test_replay_is_keyed_by_the_model_that_served(fake_sdk: FakeModels) -> None:
    clock = FakeClock()
    store = ReplayStore(":memory:")
    client = llm.ReplayingLLM(chain(clock), store, models=["a", "b"])
    fake_sdk.outcomes += [quota_error(429), response()]

    async def scenario() -> tuple[str, str, bool]:
        first = await client.complete(REQ)
        clock.now += 3600  # a is back, but the stored answer of b is reused
        again = await client.complete(REQ)
        return first.model, again.model, again.replayed

    assert asyncio.run(scenario()) == ("b", "b", True)
    assert fake_sdk.models == ["a", "b"]
    assert store.get(replay_key("gemini", "b", REQ, FRAME_VERSION)) is not None
    assert store.get(replay_key("gemini", "a", REQ, FRAME_VERSION)) is None


def test_replay_prefers_the_earliest_model_in_the_chain() -> None:
    store = ReplayStore(":memory:")
    for model, text in (("b", "từ b"), ("a", "từ a")):
        store.put(
            replay_key("fake", model, REQ, FRAME_VERSION),
            LLMResponse(text, "end", Usage(1, 1), model),
        )
    inner = FakeLLM("mạng")
    hit = asyncio.run(llm.ReplayingLLM(inner, store, models=["a", "b"]).complete(REQ))
    assert (hit.text, hit.model, hit.replayed) == ("từ a", "a", True)
    assert inner.requests == []


# --- Factory ----------------------------------------------------------------------------------


@pytest.mark.parametrize("key", [None, "", "   "])
def test_factory_without_key_raises_vietnamese_not_configured(key: str | None) -> None:
    settings = Settings(_env_file=None, gemini_api_key=None if key is None else SecretStr(key))
    with pytest.raises(LLMNotConfiguredError) as exc:
        llm.build_llm_client(settings, daily_cap=DailyCap(1), store=ReplayStore(":memory:"))
    assert "Chưa cấu hình LLM" in exc.value.message_vi


def test_factory_builds_the_chain_primary_first(fake_sdk: FakeModels) -> None:
    settings = Settings(
        _env_file=None,
        gemini_api_key=SecretStr(FAKE_KEY),
        gemini_model="gemini-x",
        gemini_fallback_models=["gemini-y", "gemini-x", "gemini-z"],
        gemini_rpm={"gemini-y": 3},
    )
    client = llm.build_llm_client(settings, daily_cap=DailyCap(1), store=ReplayStore(":memory:"))
    assert isinstance(client, llm.ReplayingLLM)
    assert (client.provider, client.model) == ("gemini", "gemini-x")
    assert client.models == ("gemini-x", "gemini-y", "gemini-z")
    inner = client.inner
    assert isinstance(inner, llm.GeminiClient)
    assert inner.models == client.models
    assert inner.rpm["gemini-y"] == 3  # override
    assert inner.rpm["gemini-3.5-flash-lite"] == 15  # defaults kept
    assert len(fake_sdk.created) == 1  # one SDK client (one connection pool) for the chain


def test_default_rpm_matches_the_owner_quota_table() -> None:
    assert llm.DEFAULT_RPM == {
        "gemini-3.8-flash": 5,
        "gemini-3.5-flash-lite": 15,
        "gemini-3.1-flash-lite": 15,
        "gemini-3.5-flash": 5,
        "gemini-3.7-flash": 5,
        "gemini-2.5-flash": 5,
    }


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
