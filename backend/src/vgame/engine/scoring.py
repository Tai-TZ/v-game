"""Stars and diagnosis rendering (scenario §10, §11; engine-v0.2.md §10). Gold-free, pure."""

import re
from collections.abc import Mapping, Sequence

from vgame.engine.types import CaseGrade, LevelRules, StarResult

PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")


def compute_stars(
    rules: LevelRules, roles: Mapping[str, str], grades: Sequence[CaseGrade], tokens: int
) -> StarResult:
    """``roles``: case id -> role of every case in the run. Normal = visible + hidden; counted
    traps = traps not in ``info_cases``. Stars 2 and 3 only count with star 1."""
    passed = {g.case_id: g.passed for g in grades}
    normal = [c for c, role in roles.items() if role in ("visible", "hidden")]
    traps = [c for c, role in roles.items() if role == "trap" and c not in rules["info_cases"]]
    normal_passed = sum(passed.get(c, False) for c in normal)
    traps_passed = sum(passed.get(c, False) for c in traps)
    forbidden = set(rules["s3_forbidden_labels"])

    s1 = normal_passed >= rules["s1_min_normal"] and all(
        passed.get(c, False) for c in rules["s1_required"]
    )
    s2 = s1 and tokens <= rules["token_budget"]
    s3 = (
        s1
        and traps_passed == len(traps)
        and not any(forbidden.intersection(g.labels) for g in grades)
    )
    return {
        "stars": int(s1) + int(s2) + int(s3),
        "s1": s1,
        "s2": s2,
        "s3": s3,
        "normal_passed": normal_passed,
        "normal_total": len(normal),
        "traps_passed": traps_passed,
        "traps_total": len(traps),
        "tokens": tokens,
        "budget": rules["token_budget"],
    }


def render(template: str, variables: Mapping[str, str]) -> str:
    """Replace ``{name}`` from ``variables``; unknown names stay as written. Never
    ``str.format``: templates and values are data, so ``{0}``/``{__class__}`` are harmless."""
    return PLACEHOLDER_RE.sub(lambda m: variables.get(m.group(1), m.group(0)), template)
