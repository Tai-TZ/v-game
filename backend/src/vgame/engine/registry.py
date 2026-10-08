"""Block registry (engine-v0.2.md §6.1): ports, params model, LLM calls and concepts per block."""

import builtins
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Final, Literal

from pydantic import JsonValue

from vgame.engine import blocks as b
from vgame.engine.types import BlockType

PortType = Literal["Query", "Index", "Docs", "Context", "Answer"]

PORT_TYPE_VI: Final[Mapping[PortType, str]] = {
    "Query": "Câu hỏi",
    "Index": "Chỉ mục",
    "Docs": "Tài liệu",
    "Context": "Context",
    "Answer": "Câu trả lời",
}


@dataclass(frozen=True)
class PortSpec:
    type: PortType
    many: bool = False
    required: bool = True


@dataclass(frozen=True)
class BlockSpec:
    type: BlockType
    name_vi: str
    params: builtins.type[b.BlockParams]
    inputs: Mapping[str, PortSpec] = field(default_factory=dict)
    outputs: Mapping[str, PortSpec] = field(default_factory=dict)
    llm_calls: int = 0
    runtime: bool = True  # False: ingestion lane (corpus, chunker), resolved at compile time
    concepts: tuple[str, ...] = ()


_Q = PortSpec("Query")
_IX = PortSpec("Index")
_DOCS = PortSpec("Docs")

REGISTRY: Final[Mapping[BlockType, BlockSpec]] = {
    s.type: s
    for s in (
        BlockSpec("input", "Câu hỏi khách", b.InputParams, outputs={"query": _Q}),
        BlockSpec("output", "Trả lời", b.OutputParams, inputs={"answer": PortSpec("Answer")}),
        BlockSpec("corpus", "Kho luật", b.CorpusParams, runtime=False, concepts=("N7.ingestion",)),
        BlockSpec(
            "chunker",
            "Chia chunk",
            b.ChunkerParams,
            outputs={"index": _IX},
            runtime=False,
            concepts=("N7.chunking", "N7.overlap", "N7.only_in_force"),
        ),
        BlockSpec(
            "vector_search",
            "Tìm theo nghĩa",
            b.VectorSearchParams,
            inputs={"query": _Q, "index": _IX},
            outputs={"docs": _DOCS},
            concepts=("N7.embedding", "N7.top_k", "N7.score_threshold"),
        ),
        BlockSpec(
            "bm25_search",
            "Tìm từ khóa",
            b.BM25SearchParams,
            inputs={"query": _Q, "index": _IX},
            outputs={"docs": _DOCS},
            concepts=("N8.sparse", "N8.top_k"),
        ),
        BlockSpec(
            "fusion",
            "Hợp nhất kết quả",
            b.FusionParams,
            inputs={"docs": PortSpec("Docs", many=True)},
            outputs={"docs": _DOCS},
            concepts=("N8.hybrid", "N8.rrf", "N8.alpha"),
        ),
        BlockSpec(
            "rerank",
            "Xếp hạng lại",
            b.RerankParams,
            inputs={"query": _Q, "docs": _DOCS},
            outputs={"docs": _DOCS},
            concepts=("N8.rerank", "N8.top_n"),
        ),
        BlockSpec(
            "context_packer",
            "Đóng gói context",
            b.ContextPackerParams,
            inputs={"query": _Q, "docs": PortSpec("Docs", many=True, required=False)},
            outputs={"context": PortSpec("Context")},
            concepts=("N4.context_packet", "N4.token_budget", "N8.cite_ids"),
        ),
        BlockSpec(
            "llm",
            "Gọi LLM",
            b.LLMParams,
            inputs={"context": PortSpec("Context")},
            outputs={"answer": PortSpec("Answer")},
            llm_calls=1,
            concepts=("N1.token_economy", "N1.system_prompt"),
        ),
    )
}


def _ports(ports: Mapping[str, PortSpec]) -> dict[str, JsonValue]:
    return {
        name: {
            "type": p.type,
            "type_vi": PORT_TYPE_VI[p.type],
            "many": p.many,
            "required": p.required,
        }
        for name, p in ports.items()
    }


def registry_json() -> dict[str, JsonValue]:
    """Payload of ``GET /api/blocks``: JSON Schema (Vietnamese titles) + port matrix per block."""
    return {
        "blocks": [
            {
                "type": s.type,
                "name_vi": s.name_vi,
                "inputs": _ports(s.inputs),
                "outputs": _ports(s.outputs),
                "params": s.params.model_json_schema(),
                "llm_calls": s.llm_calls,
                "runtime": s.runtime,
                "concepts": list(s.concepts),
            }
            for s in REGISTRY.values()
        ]
    }
