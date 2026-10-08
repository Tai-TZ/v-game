"""Process-wide engine services, built once at startup and shared by the level and run routes."""

import asyncio
import logging
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from fastapi import Request

from vgame.config import Settings
from vgame.engine.budget import DailyCap
from vgame.engine.grading import GradingSpec, load_grading_spec
from vgame.engine.index import IndexNotBuiltError, IndexStore
from vgame.engine.llm import build_llm_client
from vgame.engine.replay import ReplayStore
from vgame.engine.retrieval import FastReranker, RerankerUnavailableError
from vgame.engine.run_store import RunStore
from vgame.engine.types import LLMClient, LLMNotConfiguredError, Reranker

logger = logging.getLogger(__name__)


@dataclass
class EngineServices:
    """``store``/``llm``/``reranker`` are None when not set up; the app still starts and
    POST /api/runs answers 503 with a Vietnamese message instead."""

    content_dir: Path
    store: IndexStore | None
    llm: LLMClient | None
    reranker: Reranker | None
    runs: RunStore
    replay: ReplayStore | None = None
    tasks: dict[str, asyncio.Task[None]] = field(default_factory=dict)

    def spec(self, level_id: str) -> GradingSpec:
        return _spec(self.content_dir, level_id)

    async def aclose(self) -> None:
        for task in list(self.tasks.values()):
            task.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)
        if self.replay is not None:
            self.replay.close()


# ponytail: golden files read lazily and cached for the process; restart to pick up edits.
@cache
def _spec(content_dir: Path, level_id: str) -> GradingSpec:
    return load_grading_spec(content_dir, level_id)


def build_engine(settings: Settings) -> EngineServices:
    """Never raises for missing setup (no index, no models, no key): logs and degrades."""
    cache_dir = settings.engine_cache_dir
    store: IndexStore | None = None
    try:
        store = IndexStore.load(cache_dir / "index")
    except IndexNotBuiltError:
        logger.warning("engine index not built; run `uv run vgame-build-index`")

    reranker: Reranker | None = None
    if store is not None:  # vgame-build-index downloads the reranker with the index
        try:
            reranker = FastReranker(settings.rerank_model, cache_dir / "models")
        except RerankerUnavailableError:
            logger.warning("reranker %s not available locally", settings.rerank_model)

    llm: LLMClient | None = None
    replay: ReplayStore | None = None
    if settings.gemini_api_key is not None:
        cache_dir.mkdir(parents=True, exist_ok=True)
        replay = ReplayStore(cache_dir / "replay.sqlite3")
        try:
            llm = build_llm_client(
                settings, daily_cap=DailyCap(settings.daily_llm_call_cap), store=replay
            )
        except LLMNotConfiguredError:
            logger.warning("GEMINI_API_KEY is blank; runs will answer 503")
    else:
        logger.warning("GEMINI_API_KEY is not set; runs will answer 503")

    return EngineServices(
        content_dir=settings.content_dir,
        store=store,
        llm=llm,
        reranker=reranker,
        runs=RunStore(max_concurrent_runs=settings.max_concurrent_runs),
        replay=replay,
    )


def get_engine(request: Request) -> EngineServices:
    engine: EngineServices = request.app.state.engine
    return engine
