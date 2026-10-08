"""The shipped replay seed (engine-v0.2.md §14, 2026-10-08 "bản miễn phí"): real Gemini answers
for the reference and starter graph of every Library level, so those runs cost no call.

Fails after a change to a reference or starter graph, the prompt frame, the packer, the corpus or
the index until the seed is regenerated (engine-spike-report.md §3.4)."""

import json
import re
from functools import cache

import pytest

from tests.engine.fakes_oracle import LEVEL_IDS
from tests.engine.test_levels_e2e import run_graph
from vgame.config import SHIPPED_INDEX_DIR, Settings
from vgame.engine.index import IndexStore
from vgame.engine.levels import load_level
from vgame.engine.llm import ReplayingLLM
from vgame.engine.replay import SEED_PATH, ReplayStore
from vgame.engine.types import EngineEvent, LLMCallError, LLMRequest, LLMResponse

FIELDS = {"text", "stop_reason", "input_tokens", "output_tokens", "model"}


def _chain() -> list[str]:
    settings = Settings(_env_file=None)
    return [settings.gemini_model, *settings.gemini_fallback_models]


@cache
def _shipped() -> IndexStore:
    return IndexStore.load(SHIPPED_INDEX_DIR)


class NoProvider:
    """The real client's place: records every call that the seed did not answer."""

    provider = "gemini"
    model = "gemini-3.5-flash-lite"

    def __init__(self) -> None:
        self.calls = 0

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self.calls += 1
        raise LLMCallError("not in the seed", status=400)


def test_seed_entries_hold_only_replay_fields() -> None:
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    assert set(seed) == {"version", "entries"}
    assert seed["version"] == 1
    assert seed["entries"]
    for key, entry in seed["entries"].items():
        assert re.fullmatch(r"[0-9a-f]{64}", key)
        assert set(entry) == FIELDS  # no request, key or provider metadata
        assert entry["stop_reason"] in {"end", "max_tokens", "refusal"}
        assert entry["model"] in _chain()
        assert entry["text"]


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_seed_answers_every_reference_and_starter_case(level_id: str) -> None:
    replay = ReplayStore(":memory:")
    assert replay.import_seed(SEED_PATH) > 0
    provider = NoProvider()
    llm = ReplayingLLM(provider, replay, models=_chain())
    level = load_level(level_id)
    store = _shipped()
    assert store.rerank is not None
    for name, graph in (("reference", level.reference_graph), ("starter", level.starter_graph)):
        events = run_graph(level, graph, store, store.rerank, llm)
        facts = [
            f
            for e in events
            if e["type"] == "step.finished"
            for f in e["facts"]
            if f["kind"] == "llm"
        ]
        started = next(e for e in events if e["type"] == "run.started")
        assert len(facts) == len(started["cases"]), name
        assert all(f["replayed"] for f in facts), name
        if name == "reference":
            assert _stars(events) == 3
    assert provider.calls == 0


def _stars(events: list[EngineEvent]) -> int:
    score = next(e for e in events if e["type"] == "run.scored")["score"]
    stars: int = score["stars"]
    return stars
