"""Recorded static runs in frontend/public/runs (roadmap-v0.4 B0, B6; frontend-architecture
§8.1): the CI gate that hidden and trap cases carry only the allowed fields, and that the
committed files are what the export writes from today's index, level files and replay seed.

A failure after a change to a starter graph, the seed, the corpus or the index means: rerun
``uv run vgame-export-recorded-runs`` and commit the files."""

import json
from functools import cache
from pathlib import Path
from typing import Any

import pytest

from tests.engine.fakes_oracle import CONTENT_DIR, LEVEL_IDS, spec
from vgame.config import SHIPPED_INDEX_DIR, Settings
from vgame.engine.index import IndexStore
from vgame.engine.levels import load_level
from vgame.engine.recorded import OUT_DIR, RecordError, main, record_level
from vgame.engine.replay import ReplayStore

# frontend-architecture §8.1: a hidden or trap case shows pass/fail per criterion, labels, role
# (in run.started), the pack's total tokens and cite_unknown. Nothing else.
HIDDEN_CASE_KEYS = {
    "type",
    "run",
    "case",
    "status",
    "passed",
    "counted",
    "criteria",
    "labels",
    "reason",
    "cite_unknown",
    "pack_tokens",
}


@cache
def _shipped() -> IndexStore:
    return IndexStore.load(SHIPPED_INDEX_DIR)


def _committed(level_id: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((OUT_DIR / f"{level_id}.json").read_text("utf-8"))
    return data


def _without_ms(value: Any) -> Any:
    """Wall-clock step and case times differ between two exports of the same run."""
    if isinstance(value, dict):
        return {k: _without_ms(v) for k, v in value.items() if k != "ms"}
    if isinstance(value, list):
        return [_without_ms(v) for v in value]
    return value


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_committed_run_matches_the_shipped_index_and_level(level_id: str) -> None:
    run = _committed(level_id)
    assert run["corpus_sha256"] == _shipped().manifest["corpus_sha256"]
    assert (run["level"], run["level_version"]) == (level_id, load_level(level_id).version)
    assert run["graph"] == "starter"
    kinds = [e["type"] for e in run["events"]]
    assert kinds[0] == "run.started"
    assert kinds[-2:] == ["run.scored", "run.finished"]


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_hidden_and_trap_cases_carry_only_the_allowed_fields(level_id: str) -> None:
    run = _committed(level_id)
    events = run["events"]
    roles = {c["id"]: c["role"] for c in events[0]["cases"]}
    secret = {case_id for case_id, role in roles.items() if role != "visible"}
    assert secret
    graded = set()
    for event in events:
        if event.get("case") in secret:
            assert event["type"] == "case.graded", event
            assert set(event) <= HIDDEN_CASE_KEYS, set(event) - HIDDEN_CASE_KEYS
            # Fabricated citations only: an id outside the pack or "Điều N" outside it.
            assert all(c.startswith(("[", "Điều ")) for c in event["cite_unknown"])
            assert bool(event["cite_unknown"]) == ("cite_unknown" in event["labels"])
            graded.add(event["case"])
    assert graded == secret
    report = events[-1]["report"]
    assert set(report["gold"]) == set(roles) - secret
    assert not {d["case"] for d in report["diagnosis"]} & secret
    for case in events[0]["cases"]:
        assert ("question" in case) == (case["role"] == "visible")

    text = json.dumps(run, ensure_ascii=False)
    for case in spec(level_id).cases:
        if case.role in ("hidden", "trap"):
            assert case.question not in text
            assert not [q.quote for q in case.gold if q.quote in text]


def test_committed_runs_are_what_the_export_writes_today(tmp_path: Path) -> None:
    assert main(["--out", str(tmp_path)]) == 0
    for level_id in LEVEL_IDS:
        fresh = json.loads((tmp_path / f"{level_id}.json").read_text("utf-8"))
        assert _without_ms(fresh) == _without_ms(_committed(level_id)), (
            f"{level_id}: rerun `uv run vgame-export-recorded-runs`"
        )


def test_export_refuses_any_call_the_replay_seed_does_not_answer() -> None:
    settings = Settings(_env_file=None)
    models = [settings.gemini_model, *settings.gemini_fallback_models]
    empty = ReplayStore(":memory:")  # no seed: every answer would be a live Gemini call
    with pytest.raises(RecordError, match="replay seed"):
        record_level(LEVEL_IDS[0], _shipped(), empty, models, CONTENT_DIR)
