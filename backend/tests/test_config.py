import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from vgame.config import Settings
from vgame.main import create_app


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


@pytest.mark.parametrize("cap", [20, 34, 50, 81])
def test_rejects_the_big_cap_defaults_left_on_a_smaller_cap(cap: int) -> None:
    """§3.1 checks `students * P + 40 + 3 + R <= share`: the projector pool and the daily
    incident run come out of the same share and neither depends on class size. Leaving them out
    let 13/17 through on every cap down to 34 -- the exact case this is here to catch. At cap 50
    the server booted and /api/quota offered L1's 10-call run to a class of 30 out of 45."""
    with pytest.raises(ValidationError, match="DAILY_LLM_CALL_CAP"):
        Settings(_env_file=None, daily_llm_call_cap=cap)


def test_a_zero_cap_still_serves_the_endpoints_that_cost_nothing(settings: Settings) -> None:
    """The point of not raising: uvicorn --factory calls create_app at boot, so a validation
    error there means the Render health check fails and the whole site goes, including the
    endpoints that never touch the key."""
    # Built through the constructor, not model_copy: the validator has to let it through.
    zero = Settings(**(settings.model_dump() | {"daily_llm_call_cap": 0}), _env_file=None)
    with TestClient(create_app(zero)) as client:
        assert client.get("/api/health").status_code == 200
        quota = client.get("/api/quota")
        assert quota.status_code == 200
        assert quota.json()["remaining"] == 0  # no calls today, which is what cap 0 asks for


def test_a_zero_cap_stops_the_calls_not_the_server() -> None:
    """Turning spending off for a day is a legal field value (ge=0) and DailyCap(0) already
    refuses every call. Raising here instead would take create_app down with it, so uvicorn
    --factory never serves and the site loses /api/levels, /api/blocks and the preview too --
    the endpoints that cost nothing and were all that was left to play with."""
    settings = Settings(_env_file=None, daily_llm_call_cap=0)
    assert settings.daily_llm_call_cap == 0


def test_accepts_the_deployed_and_default_quota_shapes() -> None:
    assert Settings(_env_file=None).quota_learner_calls == 13  # cap 500: 13 + 17 <= 450
    render = Settings(
        _env_file=None, daily_llm_call_cap=200, quota_learner_calls=4, quota_reserve_calls=17
    )
    assert render.quota_learner_calls == 4  # cap 200: 4 + 17 <= 180
