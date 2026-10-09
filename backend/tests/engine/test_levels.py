import json
from typing import Any

import pytest
from pydantic import ValidationError

from tests.engine.engine_fixtures import L1_STARTER, L3, without
from vgame.engine.levels import LevelSpec, load_level
from vgame.engine.types import PublicCase

CASES = [
    PublicCase("lib-l3-v01", "visible", "sv", "Khoản 2 Điều 47 nói gì?"),
    PublicCase("lib-l3-h01", "hidden", "sv", "HIDDEN_Q"),
    PublicCase("lib-l3-t01", "trap", "sv", "TRAP_Q"),
    PublicCase("lib-l3-t03", "trap", "sv", "INFO_Q"),
]


def test_public_level_hides_solutions_gold_and_hidden_questions() -> None:
    public: dict[str, Any] = L3.public(CASES)
    text = json.dumps(public, ensure_ascii=False)
    for secret in (
        "reference_graph",
        "naive_graphs",
        "diagnosis",
        "info_cases",
        "HIDDEN_Q",
        "TRAP_Q",
    ):
        assert secret not in text
    assert public["title"] == "Hỏi bằng số điều"
    assert public["kind"] == "incident"
    assert public["budget_metric"] == "tokens"
    assert public["token_budget"] == 30000
    assert public["visible_cases"] == [
        {"id": "lib-l3-v01", "vai": "sv", "question": "Khoản 2 Điều 47 nói gì?"}
    ]
    # lib-l3-t03 is info only: it runs (one more AI call) but earns no star.
    assert public["case_counts"] == {"normal": 2, "trap": 1, "info": 1}
    # Star rules stars_vi words, so the client's star evidence needs no copy of them.
    assert public["s1_required"] == ["lib-l3-v01"]
    assert public["s3_forbidden_labels"] == []
    assert public["param_limits"]["rerank.top_n"] == {"ge": 1, "le": 5}
    assert public["starter_graph"]["schema"] == 1


def test_locked_nodes_must_exist_in_starter() -> None:
    data = L3.model_dump(mode="json", by_alias=True)
    data["starter_graph"] = without(L1_STARTER, "kb")
    with pytest.raises(ValidationError, match="locked nodes"):
        LevelSpec.model_validate(data)


@pytest.mark.parametrize("level_id", ["../../config", "no-such-level", "A", ""])
def test_load_level_rejects_unknown_ids(level_id: str) -> None:
    with pytest.raises(KeyError):
        load_level(level_id)
