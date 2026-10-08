import asyncio

import pytest

from vgame.engine.run_store import IdempotencyConflictError, RunBusyError, RunStore
from vgame.engine.types import EngineEvent


def ev(kind: str = "run.scored") -> EngineEvent:
    if kind == "run.finished":
        return {"type": "run.finished", "run": "r", "report": {"gold": {}, "diagnosis": []}}
    return {"type": "step.started", "run": "r", "case": "c1", "node": "q", "block": "input"}


def test_start_idempotency_and_unguessable_ids() -> None:
    store = RunStore(max_concurrent_runs=5)
    run_id, new = store.start("grounded-citation", "key-1")
    assert new
    assert len(run_id) == 32
    assert store.start("grounded-citation", "key-1") == (run_id, False)
    with pytest.raises(IdempotencyConflictError):  # same key, another graph
        store.start("grounded-citation", "key-1", "other-graph-hash")
    assert store.start("chunk-tuning", "key-1")[0] != run_id  # key is per level
    assert store.start("grounded-citation", None)[0] != run_id


def test_concurrent_run_cap_frees_on_terminal_event() -> None:
    store = RunStore(max_concurrent_runs=2)
    first, _ = store.start("l", None)
    store.start("l", None)
    with pytest.raises(RunBusyError) as exc:
        store.start("l", None)
    assert exc.value.message_vi.startswith("Đang có nhiều lượt chạy")
    store.append(first, ev("run.finished"))
    store.start("l", None)


def test_append_numbers_events_and_rejects_after_finish() -> None:
    store = RunStore(max_concurrent_runs=1)
    run_id, _ = store.start("l", None)
    assert [store.append(run_id, ev()) for _ in range(3)] == [1, 2, 3]
    assert store.append(run_id, ev("run.finished")) == 4
    with pytest.raises(ValueError, match="finished"):
        store.append(run_id, ev())


def test_subscribe_replays_after_last_event_id_then_follows_live() -> None:
    async def scenario() -> list[int]:
        store = RunStore(max_concurrent_runs=1)
        run_id, _ = store.start("l", None)
        for _ in range(3):
            store.append(run_id, ev())

        async def producer() -> None:
            await asyncio.sleep(0.01)
            store.append(run_id, ev())
            await asyncio.sleep(0.01)
            store.append(run_id, ev("run.finished"))

        task = asyncio.create_task(producer())
        seen = [seq async for seq, _ in store.subscribe(run_id, 2)]
        await task
        return seen

    assert asyncio.run(scenario()) == [3, 4, 5]


def test_unknown_run_and_eviction() -> None:
    store = RunStore(max_concurrent_runs=10, keep_last=2)
    with pytest.raises(KeyError):
        store.subscribe("nope", None)
    ids: list[str] = []
    for _ in range(3):
        run_id, _ = store.start("l", "k" + str(len(ids)))
        store.append(run_id, ev("run.finished"))
        ids.append(run_id)
    store.start("l", None)  # evicts the oldest finished runs beyond keep_last
    with pytest.raises(KeyError):
        store.subscribe(ids[0], None)
    assert store.start("l", "k0")[1]  # its idempotency key is forgotten too
