"""Spike (real Gemini) through the engine: model chain, RPM limiter, DailyCap, replay cache.

    uv run python scripts/spike_llm.py           # L1 reference, naive N1, reference again
    uv run python scripts/spike_llm.py --cap 75 --json out.json \\
        chunk-tuning:ref wait:65 chunk-tuning:N2 wait:65 article-number-lookup:ref!

Plan items: ``<level>:ref``, ``<level>:starter`` or ``<level>:<naive id>``; a trailing ``!``
bypasses the replay cache (a fresh sample). ``wait:<s>`` sleeps, so the 60 s RPM window drains and
the primary model serves the next run. A run repeated without ``!`` must be served from the replay
cache with the original usage (exit 2 otherwise). The script stops at the first run that fails or
has an ``llm_error`` case (the whole chain refused): it does not spend the cap on more runs.

``--seed PATH`` writes every answer the runs used (replayed or fresh) as the shipped replay seed
(engine-v0.2.md §14, 2026-10-08), only if every run finished without an ``llm_error`` case::

    uv run python scripts/spike_llm.py --cap 80 --seed src/vgame/engine/data/replay-seed.json \\
        grounded-citation:ref grounded-citation:starter wait:65 \\
        chunk-tuning:ref chunk-tuning:starter wait:65 \\
        article-number-lookup:ref article-number-lookup:starter

Needs GEMINI_API_KEY in backend/.env and a fresh index (``vgame-build-index``). Hard cap:
``--cap`` real network attempts for the whole script (DailyCap). The key is never read here:
only ``Settings`` sees it.
"""

import argparse
import asyncio
import io
import json
import logging
import statistics
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from vgame.api.engine import EngineServices, build_engine
from vgame.config import Settings
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.grading import LevelEvaluator, public_cases
from vgame.engine.graph import GraphPayload
from vgame.engine.levels import LevelSpec, load_level
from vgame.engine.llm import GeminiClient, ReplayingLLM
from vgame.engine.prompt import FRAME_VERSION
from vgame.engine.replay import replay_key, response_json
from vgame.engine.runtime import run_level
from vgame.engine.types import EngineEvent, LLMClient, LLMRequest, LLMResponse
from vgame.engine.validator import validate

DEFAULT_PLAN = ("grounded-citation:ref", "grounded-citation:N1", "grounded-citation:ref")


def _pct(values: Sequence[int], q: float) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(q * (len(ordered) - 1)))] if ordered else 0


def _graph(level: LevelSpec, name: str) -> GraphPayload:
    if name == "ref":
        return level.reference_graph
    if name == "starter":
        return level.starter_graph
    return next(n.graph for n in level.naive_graphs if n.id == name)


class _Recorder:
    """Keeps every answer the engine received under its replay key: the seed entries."""

    def __init__(self, inner: ReplayingLLM) -> None:
        self.inner = inner
        self.entries: dict[str, dict[str, object]] = {}

    @property
    def provider(self) -> str:
        return self.inner.provider

    @property
    def model(self) -> str:
        return self.inner.model

    async def complete(self, request: LLMRequest) -> LLMResponse:
        response = await self.inner.complete(request)
        if response.stop_reason != "error":  # never cached either
            key = replay_key(self.provider, response.model, request, FRAME_VERSION)
            self.entries[key] = response_json(response)
        return response


async def _run(
    engine: EngineServices, llm: LLMClient, level: LevelSpec, graph: GraphPayload, run_id: str
) -> list[EngineEvent]:
    validated, issues = validate(graph.model_dump_json(by_alias=True).encode(), level)
    if validated is None or engine.store is None:
        raise SystemExit(f"{run_id}: graph invalid: {issues}")
    deps = EngineDeps(engine.store, llm, engine.reranker, RunBudget())
    spec = engine.spec(level.id)
    evaluator = LevelEvaluator(spec, level.rules, engine.store)
    events: list[EngineEvent] = []
    compiled = compile_graph(validated, level, deps)
    await run_level(run_id, compiled, public_cases(spec), deps, evaluator, events.append)
    return events


def _calls(run_id: str, events: list[Any]) -> list[dict[str, Any]]:
    """One record per llm step: provider tokens next to the engine's regex-v1 prompt count."""
    pack: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    case_ms: dict[str, int] = {}
    for e in events:
        if e["type"] != "step.finished":
            continue
        case_ms[e["case"]] = case_ms.get(e["case"], 0) + e["ms"]
        for f in e["facts"]:
            if f["kind"] == "pack":
                pack[e["case"]] = f["tokens"]["total"]
        if e["block"] == "llm":
            fact = next((f for f in e["facts"] if f["kind"] == "llm"), {})
            out.append(
                {
                    "run": run_id,
                    "case": e["case"],
                    "status": e["status"],
                    "model": fact.get("model"),
                    "replayed": fact.get("replayed"),
                    "in": e["tokens"]["in"],
                    "out": e["tokens"]["out"],
                    "llm_ms": e["ms"],
                    "regex_prompt": pack.get(e["case"], 0) + fact.get("system_tokens", 0),
                }
            )
    for c in out:
        c["case_ms"] = case_ms[c["case"]]
    return out


def _summarise(run_id: str, events: list[Any], calls: list[dict[str, Any]]) -> dict[str, Any]:
    last = events[-1]
    print(f"\n## {run_id}: {last['type']}")
    if last["type"] != "run.finished":
        print(last)
        return {"run": run_id, "finished": False}
    score = next(e for e in events if e["type"] == "run.scored")["score"]
    keys = ("stars", "s1", "s2", "s3", "normal_passed", "normal_total", "traps_passed")
    print({k: score[k] for k in (*keys, "traps_total", "tokens", "budget")})
    for c in calls:
        print(
            f"  {c['case']}: {c['status']} {c['model']} replayed={c['replayed']} "
            f"in {c['in']} out {c['out']} (regex-v1 prompt {c['regex_prompt']}) "
            f"llm {c['llm_ms']} ms case {c['case_ms']} ms"
        )
    case_ms = [c["case_ms"] for c in calls]
    print(
        f"case ms p50 {_pct(case_ms, 0.5)} p95 {_pct(case_ms, 0.95)}; "
        f"models {last.get('models')}; replayed {sum(bool(c['replayed']) for c in calls)}"
        f"/{len(calls)}; budget exceeded {score['tokens'] > score['budget']}"
    )
    labels: dict[str, list[str]] = {}
    for e in events:
        if e["type"] == "case.graded":
            labels[e["case"]] = e["labels"]
            flags = last["report"]["gold"].get(e["case"], {}).get("flags", [])
            print(f"  {e['case']}: passed={e['passed']} labels={e['labels']} flags={flags}")
    for d in last["report"]["diagnosis"]:
        print("  diagnosis:", d)
    return {
        "run": run_id,
        "finished": True,
        "score": score,
        "models": last.get("models"),
        "llm_error": sorted(c for c, ls in labels.items() if "llm_error" in ls),
        "case_ms_p50": _pct(case_ms, 0.5),
        "case_ms_p95": _pct(case_ms, 0.95),
        "usage": {c["case"]: (c["in"], c["out"]) for c in calls},
    }


def _per_model(calls: list[dict[str, Any]]) -> None:
    print("\n## per model (answered, non-replayed calls)")
    by_model: dict[str, list[dict[str, Any]]] = {}
    for c in calls:
        if c["status"] == "ok" and not c["replayed"]:
            by_model.setdefault(str(c["model"]), []).append(c)
    for model, rows in sorted(by_model.items()):
        ins, outs = [r["in"] for r in rows], [r["out"] for r in rows]
        ratio = statistics.median(r["in"] / r["regex_prompt"] for r in rows if r["regex_prompt"])
        print(
            f"  {model}: {len(rows)} calls; in median {statistics.median(ins)} "
            f"(max {max(ins)}); out median {statistics.median(outs)} p95 {_pct(outs, 0.95)} "
            f"(max {max(outs)}); provider in / regex-v1 prompt median {ratio:.2f}"
        )


async def _plan(
    engine: EngineServices, plan: Sequence[str], recorder: _Recorder | None = None
) -> tuple[int, dict[str, Any]]:
    """One event loop for every run: the shared Gemini client's pool is bound to it."""
    replaying = engine.llm
    if not isinstance(replaying, ReplayingLLM) or not isinstance(replaying.inner, GeminiClient):
        raise SystemExit("expected the engine's ReplayingLLM over GeminiClient")
    gemini = replaying.inner
    cached: LLMClient = recorder or replaying
    limiter: list[dict[str, Any]] = []
    reserve = gemini._limiter.reserve

    def traced(model: str, now: float, latest: float) -> float | None:
        start = reserve(model, now, latest)
        limiter.append({"model": model, "wait_s": None if start is None else start - now})
        return start

    gemini._limiter.reserve = traced  # type: ignore[method-assign]
    print(f"chain {gemini.models}; rpm {dict(gemini.rpm)}")
    levels: dict[str, LevelSpec] = {}
    first: dict[str, dict[str, Any]] = {}
    results: list[dict[str, Any]] = []
    calls: list[dict[str, Any]] = []
    code = 0
    try:
        for n, item in enumerate(plan, 1):
            if item.startswith("wait:"):
                await asyncio.sleep(float(item.removeprefix("wait:")))
                continue
            fresh = item.endswith("!")
            level_id, _, name = item.removesuffix("!").partition(":")
            level = levels.setdefault(level_id, load_level(level_id))
            run_id = f"{n:02d}-{level_id}-{name}{'-fresh' if fresh else ''}"
            sent, booked = gemini._daily_cap._count, len(limiter)
            events = await _run(
                engine, gemini if fresh else cached, level, _graph(level, name), run_id
            )
            run_calls = _calls(run_id, events)
            calls += run_calls
            result = _summarise(run_id, events, run_calls)
            slots = limiter[booked:]
            result["network_attempts"] = gemini._daily_cap._count - sent
            result["limiter"] = {
                "booked": sum(s["wait_s"] is not None for s in slots),
                "waited": sum((s["wait_s"] or 0) > 0 for s in slots),
                "max_wait_s": round(max((s["wait_s"] or 0) for s in slots) if slots else 0, 1),
                "skipped": [s["model"] for s in slots if s["wait_s"] is None],
            }
            print(f"network attempts {result['network_attempts']}; limiter {result['limiter']}")
            results.append(result)
            if not result["finished"] or result["llm_error"]:
                print("\nstopping: a run failed or the whole chain refused a call")
                code = 2
                break
            key = item
            if not fresh and key in first:
                again = result["usage"] == first[key]["usage"]
                full = all(c["replayed"] for c in run_calls)
                print(f"replay returned the original usage for every case: {again and full}")
                code = code or (0 if again and full else 2)
            first.setdefault(key, result)
    finally:
        await engine.aclose()
    _per_model(calls)
    print(f"\nnetwork attempts in total: {gemini._daily_cap._count}")
    return code, {"runs": results, "calls": calls, "network_attempts": gemini._daily_cap._count}


def main() -> int:
    if isinstance(sys.stdout, io.TextIOWrapper):  # Windows cp1252 console vs Vietnamese text
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n")[0])
    parser.add_argument("plan", nargs="*", default=list(DEFAULT_PLAN))
    parser.add_argument("--cap", type=int, default=40, help="real network attempts (DailyCap)")
    parser.add_argument("--json", type=Path, help="write runs and per-call records here")
    parser.add_argument("--seed", type=Path, help="write the answers used as a replay seed here")
    args = parser.parse_args()
    # The engine logs model, status and cooldown of each failed call (never bodies or the key).
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(name)s %(message)s")
    settings = Settings(daily_llm_call_cap=args.cap)
    engine = build_engine(settings)
    if engine.llm is None or engine.store is None:
        print("LLM or index not configured: set GEMINI_API_KEY and run vgame-build-index first.")
        return 1
    recorder = None
    if args.seed is not None:
        if not isinstance(engine.llm, ReplayingLLM):
            raise SystemExit("expected the engine's ReplayingLLM")
        recorder = _Recorder(engine.llm)
    code, record = asyncio.run(_plan(engine, args.plan, recorder))
    if args.json is not None:
        args.json.write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    if recorder is not None and args.seed is not None:
        if code != 0 or not all(r["finished"] and not r["llm_error"] for r in record["runs"]):
            print("seed NOT written: a run failed or had an llm_error case")
            return code or 2
        fallback = sorted(
            {str(e["model"]) for e in recorder.entries.values()} - {settings.gemini_model}
        )
        if fallback:  # star 2 is calibrated on the primary model only
            print(f"warning: fallback models served some seed answers: {fallback}")
        seed = {"version": 1, "entries": dict(sorted(recorder.entries.items()))}
        text = json.dumps(seed, ensure_ascii=False, indent=1) + "\n"
        args.seed.write_text(text, encoding="utf-8", newline="\n")
        print(f"seed: {len(recorder.entries)} answers written to {args.seed}")
    return code


if __name__ == "__main__":
    sys.exit(main())
