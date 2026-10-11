import pytest
from pydantic import ValidationError

from vgame.config import Settings


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ENV", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    settings = Settings(_env_file=None)

    assert settings.env == "development"
    assert settings.cors_origins == ["http://localhost:5173"]
    assert settings.docs_enabled


def test_reads_env_and_comma_separated_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("CORS_ORIGINS", "https://game.example, https://staging.example ,")

    settings = Settings(_env_file=None)

    assert settings.env == "production"
    assert settings.cors_origins == ["https://game.example", "https://staging.example"]
    assert not settings.docs_enabled


@pytest.mark.parametrize(
    ("name", "value"),
    [("ENV", "staging"), ("CORS_ORIGINS", "*"), ("CORS_ORIGINS", "https://a.example,*")],
)
def test_rejects_invalid_values(monkeypatch: pytest.MonkeyPatch, name: str, value: str) -> None:
    monkeypatch.setenv(name, value)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_rejects_a_quota_the_cap_cannot_serve() -> None:
    # daily-shift §3.1 hands the class 90 % of the cap, out of which every learner gets P and
    # the shared reserve R is set aside. One learner plus R must therefore fit in that share;
    # otherwise /api/quota promises calls the provider ceiling will refuse (e.g. the 13/17
    # defaults, which are sized for a cap of 500, left on a much smaller cap).
    with pytest.raises(ValidationError, match="DAILY_LLM_CALL_CAP"):
        Settings(_env_file=None, daily_llm_call_cap=20)


def test_accepts_the_deployed_and_default_quota_shapes() -> None:
    assert Settings(_env_file=None).quota_learner_calls == 13  # cap 500: 13 + 17 <= 450
    render = Settings(
        _env_file=None, daily_llm_call_cap=200, quota_learner_calls=4, quota_reserve_calls=17
    )
    assert render.quota_learner_calls == 4  # cap 200: 4 + 17 <= 180
