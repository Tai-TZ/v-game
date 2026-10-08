"""Level files ``engine/levels/<id>.json`` (engine-v0.2.md §9) and their public view (§9.2)."""

import re
from collections.abc import Sequence
from functools import cache
from importlib import resources
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, JsonValue, model_validator

from vgame.content.repository import load_catalog
from vgame.engine.graph import GraphPayload
from vgame.engine.types import BlockType, LevelRules, PublicCase

_LEVEL_ID_RE = re.compile(r"^[a-z][a-z0-9-]{1,31}$")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class ParamLimit(_Strict):
    """Narrows a block param's Pydantic domain for one level (Part 3 §3.4 ``param_limits``)."""

    ge: float | None = None
    le: float | None = None
    multiple_of: float | None = None
    const: JsonValue = None  # null means "no const": a null const is never meaningful


class Expectation(_Strict):
    flag: str
    cases: list[str] | None = None
    mechanism: Literal["T", "M"]
    needs_real_models: bool = False


class NaiveGraph(_Strict):
    id: str
    graph: GraphPayload
    max_stars: int | None = None
    expect: list[Expectation] = Field(default_factory=list)


class LevelSpec(_Strict):
    id: str
    version: int
    zone: str
    corpus: list[str]
    allowed_blocks: list[BlockType]
    locked_nodes: list[str]
    param_limits: dict[str, ParamLimit] = Field(default_factory=dict)  # "block.param" -> limit
    prompt_cards: dict[str, str] = Field(default_factory=dict)
    starter_graph: GraphPayload
    reference_graph: GraphPayload
    naive_graphs: list[NaiveGraph] = Field(default_factory=list)
    rules: LevelRules
    stars_vi: list[str]

    @model_validator(mode="after")
    def _locked_nodes_in_starter(self) -> Self:
        missing = [n for n in self.locked_nodes if self.starter_graph.node(n) is None]
        if missing:
            raise ValueError(f"locked nodes missing from starter_graph: {missing}")
        return self

    def public(self, cases: Sequence[PublicCase]) -> dict[str, JsonValue]:
        """PublicLevel: no reference/naive graphs, diagnosis, hidden questions, gold, info cases."""
        zone = load_catalog().find_zone(self.zone)
        meta = next((lv for lv in zone.levels if lv.id == self.id), None) if zone else None
        if meta is None:
            raise LookupError(f"level {self.id!r} missing from zones.json")
        info = set(self.rules["info_cases"])
        return {
            "id": self.id,
            "version": self.version,
            "zone": self.zone,
            "title": meta.title,
            "brief": meta.brief,
            "kind": meta.kind,
            "corpus": list(self.corpus),
            "allowed_blocks": list(self.allowed_blocks),
            "locked_nodes": list(self.locked_nodes),
            "param_limits": {
                k: v.model_dump(mode="json", exclude_none=True)
                for k, v in self.param_limits.items()
            },
            "prompt_cards": dict(self.prompt_cards),
            "starter_graph": self.starter_graph.model_dump(mode="json", by_alias=True),
            "budget_metric": "tokens",
            "token_budget": self.rules["token_budget"],
            "stars_vi": list(self.stars_vi),
            "visible_cases": [
                {"id": c.id, "vai": c.vai, "question": c.question}
                for c in cases
                if c.role == "visible"
            ],
            "case_counts": {
                "normal": sum(c.role in ("visible", "hidden") for c in cases),
                "trap": sum(c.role == "trap" and c.id not in info for c in cases),
            },
        }


@cache
def load_level(level_id: str) -> LevelSpec:
    """Raises KeyError for an unknown or malformed id (never touches paths built from it
    unless it matches the slug pattern)."""
    if not _LEVEL_ID_RE.fullmatch(level_id):
        raise KeyError(level_id)
    path = resources.files("vgame.engine").joinpath("levels", f"{level_id}.json")
    if not path.is_file():
        raise KeyError(level_id)
    return LevelSpec.model_validate_json(path.read_text("utf-8"))
