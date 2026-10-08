"""Replay cache for LLM responses (engine-v0.2.md E10).

A cost cache only, not an anti-reroll promise: identical requests return the stored answer
with its ORIGINAL usage, stamped ``replayed=True``.
"""

import hashlib
import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from vgame.engine.types import LLMRequest, LLMResponse, Usage

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
        data = {
            "text": response.text,
            "stop_reason": response.stop_reason,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "model": response.model,
        }
        with self._conn:
            self._conn.execute(
                "INSERT OR IGNORE INTO llm_replay (key, response, created_at) VALUES (?, ?, ?)",
                (key, json.dumps(data, ensure_ascii=False), datetime.now(UTC).isoformat()),
            )

    def close(self) -> None:
        self._conn.close()
