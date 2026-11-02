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
def test_articles_carry_the_range_the_strip_has_to_be_read_against(level_id: str) -> None:
    """A chunk's ``dieu`` is the article its FIRST token sits in, so a fixed-size cut that runs
    from Điều 11 into Điều 12 is filed under 11 -- which is the whole lesson of L2. Drawing
    "the strip of Điều 12" therefore means every chunk overlapping its range, and the range
    has to come from here: the chunk list alone cannot answer it.
    """
    data = _committed(level_id)
    for doc_id, articles in data["articles"].items():
        assert articles, f"{doc_id} has no articles"
        text_len = len(data["corpus"][doc_id])
        for dieu, start, end in articles:
            assert 0 <= start < end <= text_len, f"{doc_id} Điều {dieu}: {start}-{end}"
        # Contiguous and in order: a gap would silently drop chunks out of every strip.
        assert [a[1] for a in articles] == sorted(a[1] for a in articles)


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_a_fixed_size_cut_spanning_two_articles_is_in_both_strips(level_id: str) -> None:
    """The gate on the overlap rule, not on the label. With `dieu` alone L2's Điều 12 comes
    back empty at co_dinh-512-0 -- the cut covering it starts in Điều 11."""
    data = _committed(level_id)
    doc_id, articles = next(iter(data["articles"].items()))
    spanning = [
        c
        for c in data["strips"]["co_dinh-1024-0"]
        if c[0] == doc_id and any(c[3] < end and start < c[4] for _, start, end in articles[1:])
    ]
    assert spanning, "no chunk overlaps a later article, so the overlap rule is untested here"


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


# One step of the 4-decimal rounding. A score is a float32 dot product, and BLAS builds differ
# by a few ulps (macOS Accelerate vs the CI runners' OpenBLAS): a value sitting on a rounding
# boundary (0.80794990 rounds to 0.8079 on one, 0.808 on the other) must not fail the gate.
SCORE_STEP = 1e-4


def _score_rows(data: dict[str, Any]) -> dict[str, dict[str, list[list[Any]]]]:
    ranks: dict[str, dict[str, list[list[Any]]]] = data["ranks"]
    return ranks


def _without_ranks(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if k != "ranks"}


def _same_up_to_scores(written: dict[str, Any], committed: dict[str, Any]) -> list[str]:
    """Where the two differ, other than a score within one rounding step. Ranks, chunk ids
    and spans must match exactly: only the last field of a rank row is a score."""
    issues: list[str] = []
    if _without_ranks(written) != _without_ranks(committed):
        issues.append("a field other than the ranks differs")
    a, b = _score_rows(written), _score_rows(committed)
    if a.keys() != b.keys():
        return [*issues, "the variants differ"]
    for variant, cases in a.items():
        if cases.keys() != b[variant].keys():
            issues.append(f"{variant}: the cases differ")
            continue
        for case_id, rows in cases.items():
            theirs = b[variant][case_id]
            if [r[:-1] for r in rows] != [r[:-1] for r in theirs]:
                issues.append(f"{variant}/{case_id}: ranked chunks differ")
            elif any(
                abs(r[-1] - t[-1]) > SCORE_STEP + 1e-12 for r, t in zip(rows, theirs, strict=True)
            ):
                issues.append(f"{variant}/{case_id}: a score moved by more than {SCORE_STEP}")
    return issues


@pytest.mark.parametrize("level_id", LEVEL_IDS)
def test_committed_files_are_what_the_export_writes_today(level_id: str) -> None:
    written = viz_level(level_id, _shipped(), CONTENT_DIR)
    assert _same_up_to_scores(written, _committed(level_id)) == []


def test_the_comparison_still_catches_a_moved_rank_or_score() -> None:
    committed = _committed(LEVEL_IDS[0])
    variant, cases = next(iter(_score_rows(committed).items()))
    case_id, rows = next((k, v) for k, v in cases.items() if len(v) >= 2)

    def edited(rows_now: list[list[Any]]) -> dict[str, Any]:
        copy: dict[str, Any] = json.loads(json.dumps(committed))
        copy["ranks"][variant][case_id] = rows_now
        return copy

    # The chunks trade places, the scores stay where they were: only the rank check sees it.
    swapped = [[*rows[1][:-1], rows[0][-1]], [*rows[0][:-1], rows[1][-1]], *rows[2:]]
    assert _same_up_to_scores(edited(swapped), committed) != []
    off = [[*rows[0][:-1], rows[0][-1] + 3 * SCORE_STEP], *rows[1:]]
    assert _same_up_to_scores(edited(off), committed) != []
    one_step = [[*rows[0][:-1], round(rows[0][-1] + SCORE_STEP, 4)], *rows[1:]]
    assert _same_up_to_scores(edited(one_step), committed) == []


def test_main_writes_one_file_per_level(tmp_path: Path) -> None:
    assert main(["--out", str(tmp_path)]) == 0
    assert {p.stem for p in tmp_path.glob("*.json")} == set(LEVEL_IDS)
