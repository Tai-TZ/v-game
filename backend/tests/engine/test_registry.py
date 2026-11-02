import json
from typing import get_args

import pytest
from pydantic import ValidationError

from vgame.engine.registry import REGISTRY, registry_json
from vgame.engine.types import BlockType


def test_registry_covers_every_block_type() -> None:
    assert set(REGISTRY) == set(get_args(BlockType))
    for block, spec in REGISTRY.items():
        assert spec.type == block
        assert spec.name_vi


def test_ports_and_llm_calls_match_contract() -> None:
    assert REGISTRY["fusion"].inputs["docs"].many
    assert not REGISTRY["context_packer"].inputs["docs"].required
    assert REGISTRY["llm"].llm_calls == 1
    # The Watchtower desk calls the model once per case too (watchtower.md §1.1).
    assert {b: s.llm_calls for b, s in REGISTRY.items() if s.llm_calls} == {
        "llm": 1,
        "action_llm": 1,
    }
    # Resolved at compile time: the ingestion lane, and tools with their approval gates.
    assert {b for b, s in REGISTRY.items() if not s.runtime} == {
        "corpus",
        "chunker",
        "tool_refund",
        "human_approval",
    }
    assert REGISTRY["action_llm"].inputs["tools"].many
    assert not REGISTRY["action_llm"].inputs["tools"].required
    assert REGISTRY["chunker"].outputs["index"].type == "Index"
    assert not REGISTRY["corpus"].inputs
    assert not REGISTRY["corpus"].outputs


@pytest.mark.parametrize("block", sorted(REGISTRY))
def test_params_are_strict_frozen_and_defaulted(block: BlockType) -> None:
    model = REGISTRY[block].params
    params = model()  # every param has a default
    with pytest.raises(ValidationError):
        model.model_validate({"unknown": 1})
    if model.model_fields:
        name = next(iter(model.model_fields))
        with pytest.raises(ValidationError):
            setattr(params, name, getattr(params, name))


def test_registry_json_is_serialisable_with_vietnamese_titles() -> None:
    payload = registry_json()
    text = json.dumps(payload, ensure_ascii=False)
    blocks = {b["type"]: b for b in json.loads(text)["blocks"]}
    vs = blocks["vector_search"]
    assert vs["name_vi"] == "Tìm theo nghĩa"
    assert vs["params"]["properties"]["top_k"]["title"] == "Số đoạn lấy về"
    assert vs["params"]["properties"]["top_k"]["maximum"] == 20
    assert vs["inputs"]["index"] == {
        "type": "Index",
        "type_vi": "Chỉ mục",
        "many": False,
        "required": True,
    }
    assert vs["concepts"] == ["N7.embedding", "N7.top_k", "N7.score_threshold"]
    assert blocks["llm"]["params"]["properties"]["system_prompt"]["maxLength"] == 2000
    assert "temperature" not in blocks["llm"]["params"]["properties"]


def test_unreleased_blocks_stay_off_the_client_payload() -> None:
    """The workbench reads block types as a closed list: an unknown one breaks every level."""
    payload = json.loads(json.dumps(registry_json()))
    listed = {b["type"] for b in payload["blocks"]}
    library = {
        "input",
        "output",
        "corpus",
        "chunker",
        "vector_search",
        "bm25_search",
        "fusion",
        "rerank",
        "context_packer",
        "llm",
    }
    assert listed == library
