"""Stars (scenario §10) and diagnosis template rendering."""

import pytest

from vgame.engine.scoring import compute_stars, render
from vgame.engine.types import CaseGrade, LevelRules

RULES: LevelRules = {
    "s1_min_normal": 2,
    "s1_required": ["v1"],
    "token_budget": 1000,
    "s3_forbidden_labels": ["cite_unknown"],
    "info_cases": ["t2"],
    "stale_fails": None,
    "max_dieu": 84,
    "diagnosis": {},
}
ROLES = {"v1": "visible", "h1": "hidden", "h2": "hidden", "t1": "trap", "t2": "trap"}


def grades(passed: set[str], labels: dict[str, tuple[str, ...]] | None = None) -> list[CaseGrade]:
    labels = labels or {}
    return [CaseGrade(c, c in passed, c != "t2", {}, labels.get(c, ())) for c in ROLES]


@pytest.mark.parametrize(
    ("passed", "tokens", "labels", "expected"),
    [
        ({"v1", "h1", "h2", "t1"}, 900, {}, (True, True, True)),
        ({"v1", "h1", "t1"}, 900, {}, (True, True, True)),  # 2/3 normal is enough
        ({"h1", "h2", "t1"}, 900, {}, (False, False, False)),  # required v1 missing
        ({"v1", "t1"}, 900, {}, (False, False, False)),  # s2/s3 never without s1
        ({"v1", "h1", "t1"}, 1001, {}, (True, False, True)),  # over budget
        ({"v1", "h1"}, 900, {}, (True, True, False)),  # counted trap t1 failed
        ({"v1", "h1", "t1"}, 900, {"h2": ("cite_unknown",)}, (True, True, False)),
        ({"v1", "h1", "t1"}, 1000, {"t2": ("abstained",)}, (True, True, True)),  # t2 is info
    ],
)
def test_stars(
    passed: set[str],
    tokens: int,
    labels: dict[str, tuple[str, ...]],
    expected: tuple[bool, bool, bool],
) -> None:
    result = compute_stars(RULES, ROLES, grades(passed, labels), tokens)
    assert (result["s1"], result["s2"], result["s3"]) == expected
    assert result["stars"] == sum(expected)
    assert result["normal_total"] == 3
    assert result["traps_total"] == 1  # t2 is an info case
    assert (result["tokens"], result["budget"]) == (tokens, 1000)


def test_render_replaces_known_names_only_and_never_formats() -> None:
    template = "Câu #{n} {0} {__class__} {missing} {n.__class__}"
    out = render(template, {"n": "3", "missing_not": "x"})
    assert out == "Câu #3 {0} {__class__} {missing} {n.__class__}"


def test_render_does_not_expand_braces_inside_values() -> None:
    assert render("{cite} {n}", {"cite": "{n}", "n": "1"}) == "{n} 1"
