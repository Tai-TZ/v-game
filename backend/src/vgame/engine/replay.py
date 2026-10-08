"""Replay cache for LLM responses (engine-v0.2.md E10).

A cost cache only, not an anti-reroll promise: identical requests return the stored answer
with its ORIGINAL usage, stamped ``replayed=True``. ``SEED_PATH`` ships real answers for the
reference and starter graph of every Library level (§14, 2026-10-08 "bản miễn phí"), merged
into the cache at startup so the common showcase runs cost no provider call.
"""

import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from vgame.engine.types import LLMRequest, LLMResponse, Usage

# Regenerate with scripts/spike_llm.py --seed (see engine-spike-report.md §3.4).
SEED_PATH = Path(__file__).parent / "data" / "replay-seed.json"
_FIELDS = frozenset({"text", "stop_reason", "input_tokens", "output_tokens", "model"})

_SCHEMA = """CREATE TABLE IF NOT EXISTS llm_replay (
    key TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL
)"""


def replay_key(provider: str, model: str, request: LLMRequest, frame_version: int) -> str:
    material = {
        "provider": provider,
        "model": model,
        "profile": request.profile,
        "max_tokens": request.max_tokens,
        "system": request.system,
        "messages": [[m.role, m.text] for m in request.messages],
        "frame_version": frame_version,
    }
    blob = json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def response_json(response: LLMResponse) -> dict[str, object]:
    """What the cache keeps of a response: no request, key or provider metadata."""
    return {
        "text": response.text,
        "stop_reason": response.stop_reason,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "model": response.model,
    }


class ReplayStore:
    """Blocking sqlite calls on the event loop: each is a sub-millisecond primary-key lookup."""

    # ponytail: local sqlite file, single process; upgrade to a Postgres llm_replay table
    # (Part 3 §3.8) when there is more than one instance.

    def __init__(self, path: Path | str) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False: created in app startup, used from the event loop thread.
        self._conn = sqlite3.connect(path, check_same_thread=False)
        with self._conn:
            self._conn.execute(_SCHEMA)

    def get(self, key: str) -> LLMResponse | None:
        row = self._conn.execute("SELECT response FROM llm_replay WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        data = json.loads(row[0])
        return LLMResponse(
            text=data["text"],
            stop_reason=data["stop_reason"],
            usage=Usage(data["input_tokens"], data["output_tokens"]),
            model=data["model"],
            replayed=True,
        )

    def put(self, key: str, response: LLMResponse) -> None:
        """Store end/max_tokens/refusal responses; errors are never cached. First write wins."""
        if response.stop_reason == "error":
            return
        data = json.dumps(response_json(response), ensure_ascii=False)
        with self._conn:
            self._conn.execute(
                "INSERT OR IGNORE INTO llm_replay (key, response, created_at) VALUES (?, ?, ?)",
                (key, data, datetime.now(UTC).isoformat()),
            )

    def import_seed(self, path: Path) -> int:
        """Adds the shipped answers; rows already cached win (INSERT OR IGNORE), so importing
        at every startup is harmless. Returns the rows added. A malformed seed raises: startup
        fails and the previous deploy stays live."""
        seed = json.loads(path.read_text(encoding="utf-8"))
        if seed.get("version") != 1:
            raise ValueError(f"replay seed {path.name}: unknown version")
        rows = []
        for key, entry in seed["entries"].items():
            if set(entry) != _FIELDS:
                raise ValueError(f"replay seed {path.name}: entry {key[:8]} malformed")
            rows.append((key, json.dumps(entry, ensure_ascii=False), "seed"))
        with self._conn:
            before = self._conn.total_changes
            self._conn.executemany(
                "INSERT OR IGNORE INTO llm_replay (key, response, created_at) VALUES (?, ?, ?)",
                rows,
            )
            return self._conn.total_changes - before

    def close(self) -> None:
        self._conn.close()
