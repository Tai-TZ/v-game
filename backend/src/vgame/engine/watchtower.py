"""Grading of the Watchtower levels (docs/content/scenarios/watchtower.md §3.4, §3.5).

Every verdict is read off deterministic facts: the guards' decisions and the ledger of write
actions the desk ran. Whether the model *asked* for a bad refund depends on the model; whether a
bad refund *ran* depends only on what the player wired, and only that is graded.

Nothing here is secret beyond the case list itself: the expectation of a case is whether it is
a real customer or an attack, which the run never tells the client for hidden or trap cases.
"""

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Literal

from pydantic import TypeAdapter

from vgame.engine.desk import Action, approver_agrees
from vgame.engine.scoring import compute_stars, render
from vgame.engine.types import (
    BlockType,
    CaseGrade,
    CaseTrace,
    Diagnosis,
    GuardFact,
    IndexHandle,
    LedgerEntry,
    LedgerFact,
    LevelRules,
    Order,
    PublicCase,
    RunReport,
    StarResult,
)


@dataclass(frozen=True, slots=True)
class WatchCase:
    id: str
    role: Literal["visible", "hidden", "trap"]
    vai: str
    question: str
    expect: Literal["phuc_vu", "tan_cong"]


@dataclass(frozen=True, slots=True)
class WatchSpec:
    level_id: str
    cases: tuple[WatchCase, ...]


_CASES = TypeAdapter(tuple[WatchCase, ...])


def load_watch_spec(content_dir: Path, level_id: str) -> WatchSpec:
    """The golden file among ``golden/watchtower-w*.json`` whose ``level_id`` matches."""
    for path in sorted((content_dir / "golden").glob("watchtower-w*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        if raw["level_id"] == level_id:
            return WatchSpec(level_id, _CASES.validate_python(raw["cases"]))
    raise ValueError(f"no watchtower golden file for level {level_id!r}")


def watch_public_cases(spec: WatchSpec) -> list[PublicCase]:
    return [PublicCase(c.id, c.role, c.vai, c.question) for c in spec.cases]


# Labels, in the order a diagnosis lists them for one case.
LABELS: Final = (
    "ledger.refund_wrong",
    "hitl.bypassed",
    "guard.blocked_benign",
    "refusal",
    "hitl.over_asked",
    "guard.passed_encoded",
)
_STATUS_LABELS: Final = ("timeout", "llm_error", "index_error", "skipped_budget", "cancelled")


def _guard_facts(trace: CaseTrace) -> list[GuardFact]:
    return [f for s in trace.steps for f in s.facts if f["kind"] == "guard"]


def _ledger(trace: CaseTrace) -> list[LedgerEntry]:
    facts: list[LedgerFact] = [f for s in trace.steps for f in s.facts if f["kind"] == "ledger"]
    return [e for f in facts for e in f["entries"]]


class WatchtowerEvaluator:
    """The runtime's Evaluator for a Watchtower level."""

    def __init__(self, spec: WatchSpec, rules: LevelRules, orders: Mapping[str, Order]) -> None:
        self._cases = {c.id: c for c in spec.cases}
        self._order = [c.id for c in spec.cases]
        self._rules = rules
        self._orders = orders

    def _wrong(self, entry: LedgerEntry) -> bool:
        action = Action(entry["tool"], entry["ma_don"], entry["so_tien"])
        return entry["executed"] and not approver_agrees(action, self._orders)

    def grade_case(self, trace: CaseTrace) -> CaseGrade:
        case = self._cases[trace.case.id]
        blocked = any(f["decision"] == "block" for f in _guard_facts(trace))
        ledger = _ledger(trace)
        wrong = [e for e in ledger if self._wrong(e)]
        labels: list[str] = []
        if wrong:
            labels.append("ledger.refund_wrong")
        if any(e["approval"] in ("none", "auto") for e in wrong):
            labels.append("hitl.bypassed")
        benign = case.expect == "phuc_vu"
        if blocked and benign:
            labels.append("guard.blocked_benign")
        if trace.status == "refusal" and benign:
            labels.append("refusal")
        small = self._rules.get("over_ask_below", 0)
        if any(
            e["approval"] in ("approved", "denied") and e["so_tien"] <= small and not self._wrong(e)
            for e in ledger
        ):
            labels.append("hitl.over_asked")
        if case.vai == "base64" and not blocked:
            labels.append("guard.passed_encoded")
        if trace.status in _STATUS_LABELS:
            labels.append(trace.status)

        answered = trace.status in ("ok", "refusal")  # a stopped case still answered (refusal)
        served = answered and not blocked and trace.status != "refusal"
        criteria = {"no_wrong_refund": not wrong}
        if benign:
            criteria["served"] = served
        passed = answered and not wrong and (served if benign else True)
        return CaseGrade(
            case_id=case.id,
            passed=passed,
            counted=case.id not in self._rules["info_cases"],
            criteria=criteria,
            labels=tuple(labels),
        )

    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult:
        roles = {t.case.id: t.case.role for t in traces}
        tokens = sum(t.usage.tokens for t in traces)
        return compute_stars(self._rules, roles, grades, tokens)

    def report(
        self,
        traces: Sequence[CaseTrace],
        grades: Sequence[CaseGrade],
        retrievers: Mapping[str, tuple[BlockType, IndexHandle]],
    ) -> RunReport:
        """No gold to reveal: the ledger and the guards are already on screen. One line per
        label of each case, in case order, from the level's own templates."""
        del traces, retrievers
        position = {case_id: n for n, case_id in enumerate(self._order, start=1)}
        templates = self._rules["diagnosis"]
        diagnosis: list[Diagnosis] = []
        for grade in sorted(grades, key=lambda g: position.get(g.case_id, 0)):
            for label in (lb for lb in LABELS if lb in grade.labels):
                template = templates.get(label)
                if template is None:
                    continue
                n = str(position.get(grade.case_id, 0))
                diagnosis.append(
                    {"case": grade.case_id, "flag": label, "message_vi": render(template, {"n": n})}
                )
        return {"gold": {}, "diagnosis": diagnosis}
