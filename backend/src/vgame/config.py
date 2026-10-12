"""Runtime settings, read from environment variables (and an optional local ``.env``)."""

from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, PositiveInt, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "test", "production"]

# src/vgame/config.py -> parents[2] is backend/, parents[3] is the repo root.
_BACKEND_DIR = Path(__file__).resolve().parents[2]
# Built by vgame-build-index and committed with the code: the server never loads an ML model
# (engine-v0.2.md §14, 2026-10-08 "bản miễn phí").
SHIPPED_INDEX_DIR = Path(__file__).resolve().parent / "engine" / "data" / "index"


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
    # Index variants, question vectors and rerank scores (vgame-build-index writes here).
    index_dir: Path = SHIPPED_INDEX_DIR
    # Gitignored: model files (vgame-build-index and slow tests only) and the replay cache.
    engine_cache_dir: Path = _BACKEND_DIR / ".cache" / "engine"
    embed_model: str = "intfloat/multilingual-e5-large"
    rerank_model: str = "jinaai/jina-reranker-v2-base-multilingual"
    # ponytail: 1 run x 3 cases = at most 3 parallel provider calls (Render free: 0.1 CPU); raise
    # via MAX_CONCURRENT_RUNS once the key's RPM tier and the server's CPU allow it.
    max_concurrent_runs: int = Field(default=1, ge=1, le=20)
    # Server-wide cap on real (non-replayed) LLM calls per UTC day; protects the owner's key.
    daily_llm_call_cap: int = Field(default=500, ge=0)
    # GET /api/quota (daily-shift §3.1, pilot class of 30 on a cap of 500): the shared reserve R
    # for refunds, and P, each learner's calls per day, which the workbench reads instead of
    # hard-coding it. Both count per UTC day in RAM, like the cap.
    quota_reserve_calls: int = Field(default=17, ge=0)
    quota_learner_calls: int = Field(default=13, ge=0)

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

    @model_validator(mode="after")
    def _quota_fits_the_cap(self) -> "Settings":
        """daily-shift §3.1 gives the class 90 % of the cap, and out of that share every learner
        gets P while the reserve R is set aside, so one learner plus R has to fit inside it.

        Deliberately weak: it catches 13/17 only below a cap of 34. The rest of §3.1 -- the
        40-call projector pool, the daily incident run, the class size -- describes a day with a
        class in a room, which a solo or dev instance does not have, so putting those terms here
        would refuse caps that are perfectly good without one. The deployed numbers are pinned
        where they belong, against the blueprint: tests/test_deploy_config.py re-derives P and R
        from render.yaml's own cap and asserts the full inequality."""
        if self.daily_llm_call_cap == 0:
            # "No live calls today" rather than "no server today": DailyCap(0) already refuses
            # every call, while raising here would take create_app, and the Render health check,
            # down with it. (Dropping GEMINI_API_KEY is the documented kill switch -- deploy.md
            # §2 -- and leaves the same endpoints up; this just keeps cap 0 from being a trap.)
            return self
        share = self.daily_llm_call_cap * 9 // 10
        if self.quota_learner_calls + self.quota_reserve_calls > share:
            raise ValueError(
                f"QUOTA_LEARNER_CALLS ({self.quota_learner_calls}) + QUOTA_RESERVE_CALLS "
                f"({self.quota_reserve_calls}) exceed the class share {share} of "
                f"DAILY_LLM_CALL_CAP ({self.daily_llm_call_cap}); recompute them with the "
                f"formula in docs/content/scenarios/daily-shift.md §3.1"
            )
        return self

    @property
    def docs_enabled(self) -> bool:
        return self.env != "production"
