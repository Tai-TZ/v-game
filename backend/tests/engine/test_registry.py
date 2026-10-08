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
    assert sum(s.llm_calls for s in REGISTRY.values()) == 1
    assert {b for b, s in REGISTRY.items() if not s.runtime} == {"corpus", "chunker"}
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
