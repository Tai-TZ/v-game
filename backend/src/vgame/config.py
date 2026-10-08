"""Runtime settings, read from environment variables (and an optional local ``.env``)."""

from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, PositiveInt, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "production"]

# src/vgame/config.py -> parents[2] is backend/, parents[3] is the repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    # Absolute: backend/.env resolves from any cwd. Tests pass _env_file=None so they never
    # read it (it may hold the owner's real key).
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    env: Environment = "development"
    # NoDecode: CORS_ORIGINS is a comma-separated string, not JSON.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # --- Engine (v0.2). The key is optional: without it the app starts and runs fail with
    # a Vietnamese "chưa cấu hình LLM" error. SecretStr keeps it out of repr() and logs.
    gemini_api_key: SecretStr | None = None
    # Primary model. gemini-3.8-flash only answered 429/503/504 for this key; 3.5-flash-lite
    # answered every call (engine-spike-report.md 3.0b). Changing it means re-checking budgets.
    gemini_model: str = "gemini-3.5-flash-lite"
    # Tried in order when a model answers 429/503 or is busy (comma-separated; empty = no
    # fallback). Each must accept the engine's thinking_level: gemini-2.5-flash is left out (400
    # "Thinking level is not supported for this model"), gemini-3.7-flash too (504, then no
    # answer within 20 s). Star 2 is calibrated on the primary only (engine-v0.2.md §14).
    gemini_fallback_models: Annotated[list[str], NoDecode] = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
    ]
    # Requests per minute per model, "model=rpm,..." merged over llm.DEFAULT_RPM.
    gemini_rpm: Annotated[dict[str, PositiveInt], NoDecode] = {}
    # Read-only docs/content (corpus + golden). ponytail: repo checkout only; the Docker image
    # does not ship docs/, so mount it and set CONTENT_DIR until content is packaged.
    content_dir: Path = _BACKEND_DIR.parent / "docs" / "content"
    # Gitignored, derived artifacts: model files, index variants, replay cache.
    engine_cache_dir: Path = _BACKEND_DIR / ".cache" / "engine"
    embed_model: str = "intfloat/multilingual-e5-large"
    rerank_model: str = "jinaai/jina-reranker-v2-base-multilingual"
    # ponytail: 1 run x 3 cases = at most 3 parallel provider calls and CPU reranks for the pilot;
    # raise via MAX_CONCURRENT_RUNS once the key's RPM tier and the server's CPU/RAM allow it.
    max_concurrent_runs: int = Field(default=1, ge=1, le=20)
    # Server-wide cap on real (non-replayed) LLM calls per UTC day; protects the owner's key.
    daily_llm_call_cap: int = Field(default=500, ge=0)
    # --- /api/weather. The campus's place, never the visitor's: must match the theme's `place`.
    weather_latitude: float = Field(default=21.0285, ge=-90, le=90)
    weather_longitude: float = Field(default=105.8542, ge=-180, le=180)

    @field_validator("cors_origins", "gemini_fallback_models", mode="before")
    @classmethod
    def _split_list(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("gemini_rpm", mode="before")
    @classmethod
    def _split_rpm(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        rpm: dict[str, str] = {}
        for item in filter(None, (part.strip() for part in value.split(","))):
            model, sep, limit = (x.strip() for x in item.partition("="))
            if not (model and sep):
                raise ValueError("GEMINI_RPM entries look like model=requests_per_minute")
            rpm[model] = limit
        return rpm

    @field_validator("cors_origins")
    @classmethod
    def _reject_wildcard(cls, origins: list[str]) -> list[str]:
        if "*" in origins:
            raise ValueError("CORS_ORIGINS must list explicit origins, not '*'")
        return origins

    @property
    def docs_enabled(self) -> bool:
        return self.env != "production"
