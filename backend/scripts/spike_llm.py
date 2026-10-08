"""Spike (real Gemini): L1 reference and naive N1 once each, then the reference again.

    uv run python scripts/spike_llm.py

Needs GEMINI_API_KEY in backend/.env and the built index (``vgame-build-index``). The third run
must be served from the replay cache with the ORIGINAL usage. Hard cap: 40 real LLM calls for
the whole script (DailyCap); L1 has 10 non-review cases, so the expected spend is 20.
The key is never read here: only ``Settings`` sees it.
"""

import asyncio
import io
import sys
from typing import Any

from vgame.api.engine import EngineServices, build_engine
from vgame.config import Settings
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.grading import LevelEvaluator, public_cases
from vgame.engine.graph import GraphPayload
from vgame.engine.levels import LevelSpec, load_level
from vgame.engine.runtime import run_level
from vgame.engine.types import EngineEvent
from vgame.engine.validator import validate

CALL_CAP = 40


def _pct(values: list[int], q: float) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(q * (len(ordered) - 1)))] if ordered else 0


async def _run(engine: EngineServices, level: LevelSpec, graph: GraphPayload, run_id: str) -> Any:
    validated, issues = validate(graph.model_dump_json(by_alias=True).encode(), level)
    if validated is None:
        raise SystemExit(f"{run_id}: graph invalid: {issues}")
    deps = EngineDeps(engine.store, engine.llm, engine.reranker, RunBudget())
    spec = engine.spec(level.id)
    assert engine.store is not None  # noqa: S101 - checked in main
    evaluator = LevelEvaluator(spec, level.rules, engine.store)
    events: list[EngineEvent] = []
    compiled = compile_graph(validated, level, deps)
    await run_level(run_id, compiled, public_cases(spec), deps, evaluator, events.append)
    return events


def _summarise(run_id: str, events: list[Any]) -> dict[str, tuple[int, int]]:
    last = events[-1]
    print(f"\n## {run_id}: {last['type']}")
    if last["type"] != "run.finished":
        print(last)
        return {}
    score = next(e for e in events if e["type"] == "run.scored")["score"]
    print(
        {
            k: score[k]
            for k in (
                "stars",
                "s1",
                "s2",
                "s3",
                "normal_passed",
                "normal_total",
                "traps_passed",
                "traps_total",
                "tokens",
                "budget",
            )
        }
    )
    case_ms: dict[str, int] = {}
    llm_ms: list[int] = []
    usage: dict[str, tuple[int, int]] = {}
    replayed: list[bool] = []
    for e in events:
        if e["type"] != "step.finished":
            continue
        case_ms[e["case"]] = case_ms.get(e["case"], 0) + e["ms"]
        if e["block"] == "llm":
            llm_ms.append(e["ms"])
            usage[e["case"]] = (e["tokens"]["in"], e["tokens"]["out"])
            replayed += [f["replayed"] for f in e["facts"] if f["kind"] == "llm"]
            print(
                f"  {e['case']}: {e['status']} {e['ms']} ms tokens {e['tokens']} | {e['summary']}"
            )
    ms = list(case_ms.values())
    print(
        f"case ms p50 {_pct(ms, 0.5)} p95 {_pct(ms, 0.95)} max {max(ms, default=0)}; "
        f"llm ms p50 {_pct(llm_ms, 0.5)} p95 {_pct(llm_ms, 0.95)}; "
        f"replayed {sum(replayed)}/{len(replayed)}"
    )
    report = last["report"]
    for e in events:
        if e["type"] == "case.graded":
            flags = report["gold"].get(e["case"], {}).get("flags", [])
            print(f"  {e['case']}: passed={e['passed']} labels={e['labels']} flags={flags}")
    for d in report["diagnosis"]:
        print("  diagnosis:", d)
    return usage


def main() -> int:
    if isinstance(sys.stdout, io.TextIOWrapper):  # Windows cp1252 console vs Vietnamese text
        sys.stdout.reconfigure(encoding="utf-8")
    settings = Settings(daily_llm_call_cap=CALL_CAP)
    engine = build_engine(settings)
    if engine.llm is None or engine.store is None:
        print("LLM or index not configured: set GEMINI_API_KEY and run vgame-build-index first.")
        return 1
    return asyncio.run(_runs(engine))


async def _runs(engine: EngineServices) -> int:
    """One event loop for every run: the shared Gemini client's pool is bound to it."""
    level = load_level("grounded-citation")
    naive = next(n.graph for n in level.naive_graphs if n.id == "N1")
    try:
        first = _summarise("ref-1", await _run(engine, level, level.reference_graph, "ref-1"))
        if not first:  # provider down or over quota: do not spend the cap on two more runs
            return 2
        _summarise("naive-N1", await _run(engine, level, naive, "naive-N1"))
        again = _summarise(
            "ref-2-replay", await _run(engine, level, level.reference_graph, "ref-2")
        )
    finally:
        await engine.aclose()
    same = first == again and bool(first)
    print(f"\nreplay returned the original usage for every case: {same}")
    return 0 if same else 2


if __name__ == "__main__":
    sys.exit(main())
