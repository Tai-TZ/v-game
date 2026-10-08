import pytest
from pydantic import ValidationError

from tests.engine.engine_fixtures import L1_REFERENCE, with_params
from vgame.engine.graph import GraphPayload, graph_hash, nfc, split_ref


def test_payload_round_trips_with_schema_alias() -> None:
    g = GraphPayload.model_validate(L1_REFERENCE | {"ui": {"q": [40, 120]}})
    assert g.schema_ == 1
    dumped = g.model_dump(mode="json", by_alias=True)
    assert dumped["schema"] == 1
    assert g.node("vs") is not None
    assert g.node("nope") is None


@pytest.mark.parametrize("node_id", ["Q", "1q", "q-1", "a" * 17, ""])
def test_node_id_pattern(node_id: str) -> None:
    with pytest.raises(ValidationError):
        GraphPayload.model_validate(
            {"schema": 1, "nodes": [{"id": node_id, "type": "input"}], "edges": []}
        )


def test_graph_hash_ignores_ui_and_key_order_but_not_params() -> None:
    base = GraphPayload.model_validate(L1_REFERENCE)
    with_ui = GraphPayload.model_validate(L1_REFERENCE | {"ui": {"q": [1, 2]}})
    assert graph_hash(base) == graph_hash(with_ui)
    changed = GraphPayload.model_validate(with_params(L1_REFERENCE, "vs", top_k=4))
    assert graph_hash(base) != graph_hash(changed)
    assert len(graph_hash(base)) == 64


def test_nfc_normalises_keys_and_values() -> None:
    decomposed = "Điều"
    assert nfc({decomposed: [decomposed, 1, None]}) == {"Điều": ["Điều", 1, None]}


@pytest.mark.parametrize(
    ("ref", "expected"),
    [("vs.docs", ("vs", "docs")), ("vs", None), (".docs", None), ("vs.", None)],
)
def test_split_ref(ref: str, expected: tuple[str, str] | None) -> None:
    assert split_ref(ref) == expected
