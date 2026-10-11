"""Recorded static runs (roadmap-v0.4 B0 for N4/B5; frontend-architecture §8.1).

``vgame-export-recorded-runs`` runs the starter graph of every Library level through the real
engine on the shipped index and the replay seed only (a call the seed does not answer fails
the export: no Gemini call, no key read), redacts the events and writes
``frontend/public/runs/<level>.json``, which the workbench can play while the API sleeps.

Visible cases keep every event and fact. Hidden and trap cases keep only their
``case.graded`` verdict plus ``cite_unknown`` (the fabricated citations that turned that label
on, minus any that name the case's own gold article) and ``pack_tokens`` (the pack's total):
never their steps, so no retrieved list, ``pack.included``, answer text, prompt, rank or score,
and no gold or diagnosis in ``run.finished``. Every ``case.graded`` gets the two extra fields.
``ms`` is the wall time of this export (replayed answers take ~0 ms), not of the original live
call.
"""

import argparse
import asyncio
import json
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, Final

from vgame.config import SHIPPED_INDEX_DIR, Settings
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.corpus import load_documents
from vgame.engine.grading import LevelEvaluator, load_grading_spec, public_cases
from vgame.engine.index import IndexStore, golden_questions, rerank_questions
from vgame.engine.levels import load_level
from vgame.engine.llm import ReplayingLLM
from vgame.engine.replay import SEED_PATH, ReplayStore
from vgame.engine.runtime import run_level
from vgame.engine.types import (
    BlockType,
    CaseGrade,
    CaseTrace,
    EngineEvent,
    IndexHandle,
    LLMCallError,
    LLMRequest,
    LLMResponse,
    RunReport,
    StarResult,
)
from vgame.engine.validator import validate

LEVEL_IDS: Final = ("grounded-citation", "chunk-tuning", "article-number-lookup")
# backend/src/vgame/engine/recorded.py -> parents[4] is the repo root.
OUT_DIR: Final = Path(__file__).resolve().parents[4] / "frontend" / "public" / "runs"
RUN_ID: Final = "recorded"
_HIDDEN_GRADED_KEYS: Final = frozenset(
    {"type", "run", "case", "status", "passed", "counted", "criteria", "labels", "reason"}
)


class RecordError(Exception):
    """The starter run could not be recorded from the seed alone."""


class _SeedOnly:
    """Stands where the Gemini client would: refuses every call the replay seed misses."""

    provider = "gemini"  # replay keys carry the provider

    def __init__(self, model: str) -> None:
        self.model = model
        self.calls = 0

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self.calls += 1
        raise LLMCallError("not in the replay seed: the export never calls Gemini")


class _KeepGrades:
    """The level evaluator, keeping each case's grade: cite_unknown is not in case.graded."""

    def __init__(self, inner: LevelEvaluator) -> None:
        self.inner = inner
        self.grades: dict[str, CaseGrade] = {}

    def grade_case(self, trace: CaseTrace) -> CaseGrade:
        grade = self.inner.grade_case(trace)
        self.grades[trace.case.id] = grade
        return grade

    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult:
        return self.inner.score(traces, grades)

    def report(
        self,
        traces: Sequence[CaseTrace],
        grades: Sequence[CaseGrade],
        retrievers: Mapping[str, tuple[BlockType, IndexHandle]],
    ) -> RunReport:
        return self.inner.report(traces, grades, retrievers)


def _without_gold_articles(cite_unknown: Sequence[str], gold_dieus: frozenset[int]) -> list[str]:
    """``cite_unknown`` entries that do not name one of the case's own gold articles.

    ``Điều N`` lands in ``cite_unknown`` whenever no packed chunk touches article N
    (grading.py ``_unknown_citations``). A case whose gold was never retrieved therefore
    publishes its own answer's article number, which §8.1 keeps out of a hidden case.
    """
    return [c for c in cite_unknown if c not in {f"Điều {dieu}" for dieu in gold_dieus}]


def redact(
    events: Sequence[EngineEvent],
    grades: Mapping[str, CaseGrade],
    gold_dieus: Mapping[str, frozenset[int]] = {},
) -> list[Any]:
    """The events as the static file shows them (module docstring). ``gold_dieus`` maps a case
    id to its gold article numbers, which a hidden or trap case never publishes."""
    started = events[0]
    if started["type"] != "run.started":
        raise RecordError("a run starts with run.started")
    secret = {c["id"] for c in started["cases"] if c["role"] != "visible"}
    pack_tokens: dict[str, int] = {}
    for event in events:
        if event["type"] == "step.finished":
            for fact in event["facts"]:
                if fact["kind"] == "pack":
                    pack_tokens[event["case"]] = fact["tokens"]["total"]

    out: list[Any] = []
    for event in events:
        if event["type"] in ("step.started", "step.finished") and event["case"] in secret:
            continue
        shown: dict[str, Any] = dict(event)
        if event["type"] == "case.graded":
            case_id = event["case"]
            cite_unknown = list(grades[case_id].cite_unknown)
            if case_id in secret:
                shown = {k: v for k, v in shown.items() if k in _HIDDEN_GRADED_KEYS}
                cite_unknown = _without_gold_articles(
                    cite_unknown, gold_dieus.get(case_id, frozenset())
                )
            shown["cite_unknown"] = cite_unknown
            shown["pack_tokens"] = pack_tokens.get(case_id)
        elif event["type"] == "run.finished":
            report = event["report"]
            shown["report"] = {
                "gold": {k: v for k, v in report["gold"].items() if k not in secret},
                "diagnosis": [d for d in report["diagnosis"] if d["case"] not in secret],
            }
        out.append(shown)
    return out


def record_level(
    level_id: str,
    store: IndexStore,
    replay: ReplayStore,
    models: Sequence[str],
    content_dir: Path,
) -> dict[str, Any]:
    """The starter run of ``level_id`` as the static file holds it. Raises RecordError when a
    case needed a live call or the run did not finish."""
    level = load_level(level_id)
    graph, issues = validate(level.starter_graph.model_dump_json(by_alias=True).encode(), level)
    if graph is None:
        raise RecordError(f"{level_id}: the starter graph does not validate: {issues}")
    live = _SeedOnly(models[0])
    llm = ReplayingLLM(live, replay, models=models)
    deps = EngineDeps(store, llm, store.rerank, RunBudget())
    spec = load_grading_spec(content_dir, level_id)
    evaluator = _KeepGrades(LevelEvaluator(spec, level.rules, store))
    events: list[EngineEvent] = []
    compiled = compile_graph(graph, level, deps)
    asyncio.run(run_level(RUN_ID, compiled, public_cases(spec), deps, evaluator, events.append))
    if live.calls or events[-1]["type"] != "run.finished":
        raise RecordError(
            f"{level_id}: {live.calls} answer(s) missing from the replay seed, run ended with "
            f"{events[-1]['type']}; regenerate the seed (engine-spike-report.md §3.4)"
        )
    return {
        "format": 1,
        "level": level_id,
        "level_version": level.version,
        "graph": "starter",
        "corpus_sha256": store.manifest["corpus_sha256"],
        "events": redact(
            events,
            evaluator.grades,
            {c.id: frozenset(q.dieu for q in c.gold) for c in spec.cases},
        ),
    }


def main(argv: Sequence[str] | None = None) -> int:
    """``vgame-export-recorded-runs``: one file per Library level into ``--out``."""
    parser = argparse.ArgumentParser(
        prog="vgame-export-recorded-runs",
        description="Record the starter run of every Library level from the replay seed.",
    )
    parser.add_argument("--out", type=Path, default=OUT_DIR, help=f"default: {OUT_DIR}")
    args = parser.parse_args(argv)

    settings = Settings(_env_file=None)  # the model chain only; no key is needed or read
    content = settings.content_dir
    store = IndexStore.load(SHIPPED_INDEX_DIR)
    store.check_fresh(load_documents(content), golden_questions(content), rerank_questions(content))
    replay = ReplayStore(":memory:")
    replay.import_seed(SEED_PATH)
    models = list(dict.fromkeys([settings.gemini_model, *settings.gemini_fallback_models]))
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    try:
        for level_id in LEVEL_IDS:
            recorded = record_level(level_id, store, replay, models, content)
            path = out / f"{level_id}.json"
            text = json.dumps(recorded, ensure_ascii=False, separators=(",", ":")) + "\n"
            path.write_text(text, encoding="utf-8", newline="\n")
            print(f"{path}: {len(text.encode()):,} bytes")
    except RecordError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        replay.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
