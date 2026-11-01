"""Render free plan (512 MB, 0.1 CPU): the API installs without ML libraries and runs one run at
a time (engine-v0.2.md §14, 2026-10-08 "bản miễn phí"; docs/deploy.md)."""

import tomllib
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]  # PyYAML comes with uvicorn[standard]

BACKEND = Path(__file__).resolve().parents[1]


def _name(requirement: str) -> str:
    return requirement.split("==")[0].split("[")[0].strip()


def test_ml_libraries_are_not_runtime_dependencies() -> None:
    pyproject = tomllib.loads((BACKEND / "pyproject.toml").read_text(encoding="utf-8"))
    assert "fastembed" not in {_name(r) for r in pyproject["project"]["dependencies"]}
    groups = pyproject["dependency-groups"]
    assert "fastembed==0.9.1" in groups["models"]
    assert {"include-group": "models"} in groups["dev"]  # local `uv sync`, CI and slow tests

    lock = tomllib.loads((BACKEND / "uv.lock").read_text(encoding="utf-8"))
    root = next(p for p in lock["package"] if p["name"] == "v-game-backend")
    assert "fastembed" not in {d["name"] for d in root["dependencies"]}
    assert {"name": "fastembed"} in root["dev-dependencies"]["models"]


def _api_service() -> dict[str, Any]:
    blueprint = yaml.safe_load((BACKEND.parent / "render.yaml").read_text(encoding="utf-8"))
    service: dict[str, Any] = next(s for s in blueprint["services"] if s["name"] == "v-game-api")
    return service


def test_render_installs_the_runtime_only_with_bytecode() -> None:
    build = _api_service()["buildCommand"]
    assert "uv sync --frozen --no-dev --compile-bytecode" in build  # no fastembed/onnxruntime


def test_render_pins_the_free_tier_limits() -> None:
    env = {v["key"]: v.get("value") for v in _api_service()["envVars"]}
    assert env["MAX_CONCURRENT_RUNS"] == "1"  # 0.1 CPU
    assert int(env["DAILY_LLM_CALL_CAP"]) > 0
    assert env["OPENBLAS_NUM_THREADS"] == "1"  # no idle BLAS thread buffers
    assert "INDEX_DIR" not in env  # the shipped index


# daily-shift §3.1, pilot class of 30: the class gets 90 % of the cap, the projector pool and the
# common-incident fix run come off the top, 15 is the floor kept for the shared reserve R, and the
# remainder of the division goes back into R. Nothing else may be handed out.
STUDENTS = 30
PROJECTOR_CALLS = 40
COMMON_FIX_CALLS = 3
RESERVE_FLOOR = 15


def test_render_sizes_the_learner_share_and_reserve_from_the_cap() -> None:
    # P and R are derived from DAILY_LLM_CALL_CAP, so the blueprint must set all three together:
    # the config defaults (13/17) are for a cap of 500 and silently overshoot a smaller cap.
    env = {v["key"]: v.get("value") for v in _api_service()["envVars"]}
    cap = int(env["DAILY_LLM_CALL_CAP"])
    learner = int(env["QUOTA_LEARNER_CALLS"])
    reserve = int(env["QUOTA_RESERVE_CALLS"])

    class_share = cap * 9 // 10
    spare = class_share - PROJECTOR_CALLS - COMMON_FIX_CALLS
    assert learner == (spare - RESERVE_FLOOR) // STUDENTS
    assert reserve == spare - STUDENTS * learner
    assert STUDENTS * learner + PROJECTOR_CALLS + COMMON_FIX_CALLS + reserve <= class_share
