"""Runtime settings, read from environment variables (and an optional local ``.env``)."""

from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
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
    gemini_model: str = "gemini-3.8-flash"
    # Read-only docs/content (corpus + golden). ponytail: repo checkout only; the Docker image
    # does not ship docs/, so mount it and set CONTENT_DIR until content is packaged.
    content_dir: Path = _BACKEND_DIR.parent / "docs" / "content"
    # Gitignored, derived artifacts: model files, index variants, replay cache.
    engine_cache_dir: Path = _BACKEND_DIR / ".cache" / "engine"
    embed_model: str = "intfloat/multilingual-e5-large"
    rerank_model: str = "jinaai/jina-reranker-v2-base-multilingual"
    # ponytail: 1 run x 3 cases = at most 3 parallel provider calls for the pilot (429s already
    # appeared at 3); raise via MAX_CONCURRENT_RUNS once the key's RPM tier is known.
    max_concurrent_runs: int = Field(default=1, ge=1, le=20)
    # Server-wide cap on real (non-replayed) LLM calls per UTC day; protects the owner's key.
    daily_llm_call_cap: int = Field(default=500, ge=0)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _reject_wildcard(cls, origins: list[str]) -> list[str]:
        if "*" in origins:
            raise ValueError("CORS_ORIGINS must list explicit origins, not '*'")
        return origins

    @property
    def docs_enabled(self) -> bool:
        return self.env != "production"
