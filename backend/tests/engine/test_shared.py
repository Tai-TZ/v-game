"""Checks for the shared engine primitives (constants, types, settings)."""

import pytest
from pydantic import SecretStr

from vgame.config import Settings
from vgame.engine.constants import ALL_VARIANTS, FORBIDDEN_CHARS_RE, count_tokens
from vgame.engine.types import BudgetExceededError, Usage


def test_count_tokens_splits_words_and_punctuation() -> None:
    assert count_tokens("Điều 12. Bảo lưu, 2,5 điểm!") == 11
    assert count_tokens("") == 0


def test_variant_grid_has_24_unique_keys() -> None:
    by_key = {v.key: v for v in ALL_VARIANTS}
    assert len(by_key) == 24
    assert "theo_dieu-512-10" in by_key
    assert by_key["co_dinh-1024-20"].overlap_tokens == 204


def test_usage_tokens_is_input_plus_output_only() -> None:
    total = Usage(100, 20) + Usage(5, 1)
    assert total == Usage(105, 21)
    assert total.tokens == 126


def test_budget_error_has_vietnamese_message_per_scope() -> None:
    assert "hôm nay" in BudgetExceededError("daily").message_vi
    assert "Ca này" in BudgetExceededError("case").message_vi


def test_forbidden_chars_catch_nul_and_bidi_but_not_vietnamese() -> None:
    assert FORBIDDEN_CHARS_RE.search("a" + chr(0) + "b")
    assert FORBIDDEN_CHARS_RE.search("abc" + chr(0x202E) + "def")
    assert FORBIDDEN_CHARS_RE.search("Điều 12 khoản 2" + chr(10) + "đơn" + chr(9) + "từ") is None


def test_gemini_key_is_optional_and_never_in_repr(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert Settings(_env_file=None).gemini_api_key is None

    monkeypatch.setenv("GEMINI_API_KEY", "test-not-a-real-key")
    settings = Settings(_env_file=None)
    assert isinstance(settings.gemini_api_key, SecretStr)
    assert "test-not-a-real-key" not in repr(settings)
