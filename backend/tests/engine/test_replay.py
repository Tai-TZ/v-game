import json
from dataclasses import replace
from pathlib import Path

import pytest

from vgame.engine.replay import ReplayStore, replay_key, response_json
from vgame.engine.types import LLMMessage, LLMRequest, LLMResponse, Usage

REQ = LLMRequest("can_bang", "khung\n\nG1", (LLMMessage("user", "Câu hỏi: x"),), 8192)
RESP = LLMResponse("Đáp [ab12cd34]", "end", Usage(1200, 340), "gemini-3.8-flash")


def test_hit_returns_original_usage_stamped_replayed() -> None:
    store = ReplayStore(":memory:")
    key = replay_key("gemini", "gemini-3.8-flash", REQ, 1)
    assert store.get(key) is None
    store.put(key, RESP)
    hit = store.get(key)
    assert hit is not None
    assert hit.replayed is True
    assert hit.usage == Usage(1200, 340)
    assert (hit.text, hit.stop_reason, hit.model) == (RESP.text, "end", RESP.model)


def test_key_changes_with_profile_frame_model_and_content() -> None:
    base = replay_key("gemini", "m", REQ, 1)
    assert base == replay_key("gemini", "m", REQ, 1)
    others = {
        replay_key("gemini", "m", LLMRequest("sau", REQ.system, REQ.messages, 8192), 1),
        replay_key("gemini", "m", LLMRequest("can_bang", REQ.system, REQ.messages, 4096), 1),
        replay_key("gemini", "m", REQ, 2),
        replay_key("gemini", "m2", REQ, 1),
        replay_key("fake", "m", REQ, 1),
        replay_key("gemini", "m", LLMRequest("can_bang", "khung\n\nG2", REQ.messages, 8192), 1),
        replay_key(
            "gemini", "m", LLMRequest("can_bang", REQ.system, (LLMMessage("user", "y"),), 8192), 1
        ),
    }
    assert base not in others
    assert len(others) == 7


def test_errors_are_not_cached_and_first_write_wins(tmp_path: Path) -> None:
    store = ReplayStore(tmp_path / "sub" / "replay.sqlite3")
    store.put("k-err", LLMResponse("", "error", Usage(5, 0), "m"))
    assert store.get("k-err") is None
    store.put("k", RESP)
    store.put("k", LLMResponse("khác", "end", Usage(1, 1), "m"))
    store.close()
    reopened = ReplayStore(tmp_path / "sub" / "replay.sqlite3")  # persists across restarts
    hit = reopened.get("k")
    assert hit is not None
    assert hit.text == RESP.text
    reopened.close()


def test_seed_import_keeps_runtime_rows_and_is_idempotent(tmp_path: Path) -> None:
    seeded = LLMResponse("Mẫu đã lưu [ab12cd34]", "end", Usage(900, 120), "gemini-3.5-flash-lite")
    seed = tmp_path / "seed.json"
    entries = {"k-runtime": response_json(seeded), "k-seed": response_json(seeded)}
    seed.write_text(json.dumps({"version": 1, "entries": entries}), encoding="utf-8")
    store = ReplayStore(":memory:")
    store.put("k-runtime", RESP)
    assert store.import_seed(seed) == 1  # INSERT OR IGNORE: the runtime row wins
    assert store.import_seed(seed) == 0  # every startup imports again, harmlessly
    runtime_hit, seed_hit = store.get("k-runtime"), store.get("k-seed")
    assert runtime_hit is not None
    assert runtime_hit.text == RESP.text
    assert seed_hit == replace(seeded, replayed=True)


@pytest.mark.parametrize(
    "seed",
    [{"version": 2, "entries": {}}, {"version": 1, "entries": {"k": {"text": "x"}}}],
    ids=["version", "fields"],
)
def test_malformed_seed_fails_fast(tmp_path: Path, seed: object) -> None:
    path = tmp_path / "seed.json"
    path.write_text(json.dumps(seed), encoding="utf-8")
    with pytest.raises(ValueError, match="seed"):
        ReplayStore(":memory:").import_seed(path)
