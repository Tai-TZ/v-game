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
