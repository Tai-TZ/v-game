"""Static visualisation data in frontend/public/viz (roadmap-v0.4 N21, B6).

The CI gate that the committed files are what the export writes from today's corpus and index,
that no hidden or trap case leaves a score behind, and that the files stay under their cap.

A failure after a change to the corpus, the index or a level means: rerun
``uv run vgame-export-static-viz`` and commit the files.
"""

import json
from functools import cache
from pathlib import Path
from typing import Any

import pytest

from tests.engine.fakes_oracle import CONTENT_DIR, LEVEL_IDS, spec
from vgame.config import SHIPPED_INDEX_DIR
from vgame.engine.constants import ALL_VARIANTS
from vgame.engine.index import IndexStore
from vgame.engine.levels import load_level
from vgame.engine.static_viz import BYTE_CAP, OUT_DIR, main, viz_level


@cache
def _shipped() -> IndexStore:
    return IndexStore.load(SHIPPED_INDEX_DIR)


def _committed(level_id: str) -> dict[str, Any]:
    raw: dict[str, Any] = json.loads((OUT_DIR / f"{level_id}.json").read_text(encoding="utf-8"))
    return raw


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_committed_file_matches_the_shipped_corpus_and_level(level_id: str) -> None:
    data = _committed(level_id)
    assert data["corpus_sha256"] == _shipped().manifest["corpus_sha256"]
    assert data["level_version"] == load_level(level_id).version


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_every_variant_the_engine_knows_has_a_strip(level_id: str) -> None:
    assert set(_committed(level_id)["strips"]) == {v.key for v in ALL_VARIANTS}


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_no_hidden_or_trap_case_appears_anywhere_in_the_file(level_id: str) -> None:
    """The one rule N21 exists under: never a score for a question the player cannot see.

    Checked against the whole serialised file, not against the shape the writer meant to use --
    a new field added in the wrong place is exactly the mistake a key-by-key check misses.
    """
    secret = [c.id for c in spec(level_id).cases if c.role != "visible"]
    assert secret, f"{level_id} has no secret case, so this gate proves nothing"
    blob = json.dumps(_committed(level_id), ensure_ascii=False)
    for case_id in secret:
        assert case_id not in blob


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_the_sample_questions_are_the_only_ones_ranked(level_id: str) -> None:
    visible = {c.id for c in spec(level_id).cases if c.role == "visible"}
    for ranked in _committed(level_id)["ranks"].values():
        assert set(ranked) == visible


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_the_file_stays_under_its_cap(level_id: str) -> None:
    size = (OUT_DIR / f"{level_id}.json").stat().st_size
    assert size <= BYTE_CAP, f"{level_id}: {size} bytes over the {BYTE_CAP} cap"


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_committed_files_are_what_the_export_writes_today(level_id: str) -> None:
    assert viz_level(level_id, _shipped(), CONTENT_DIR) == _committed(level_id)


def test_main_writes_one_file_per_level(tmp_path: Path) -> None:
    assert main(["--out", str(tmp_path)]) == 0
    assert {p.stem for p in tmp_path.glob("*.json")} == set(LEVEL_IDS)
