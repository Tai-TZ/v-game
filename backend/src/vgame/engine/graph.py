"""Player graph JSON (engine-v0.2.md §7.1): the wire model, NFC normalisation and graph_hash."""

import hashlib
import json
import unicodedata
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, StringConstraints

from vgame.engine.types import BlockType

NodeId = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,15}$")]


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: NodeId
    type: BlockType
    params: dict[str, JsonValue] = Field(default_factory=dict)


class GraphPayload(BaseModel):
    """``ui`` (canvas positions) never affects validation, compilation or the hash."""

    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    schema_: Literal[1] = Field(alias="schema")
    nodes: list[GraphNode]
    edges: list[tuple[str, str]]
    ui: dict[str, JsonValue] | None = None

    def node(self, node_id: str) -> GraphNode | None:
        return next((n for n in self.nodes if n.id == node_id), None)


def split_ref(ref: str) -> tuple[str, str] | None:
    """``"vs.docs"`` -> ``("vs", "docs")``; None when malformed."""
    node, sep, port = ref.partition(".")
    return (node, port) if sep and node and port else None


def nfc(value: JsonValue) -> JsonValue:
    """NFC-normalise every string (keys included) of a decoded JSON value."""
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [nfc(v) for v in value]
    if isinstance(value, dict):
        return {unicodedata.normalize("NFC", k): nfc(v) for k, v in value.items()}
    return value


def graph_hash(graph: GraphPayload) -> str:
    """sha256 of the canonical nodes + edges (Part 3 §3.4), ignoring ``ui``."""
    body = graph.model_dump(mode="json", include={"nodes", "edges"})
    canonical = json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()
