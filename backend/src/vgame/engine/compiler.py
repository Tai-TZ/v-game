"""Validated graph -> static LangGraph StateGraph (engine-v0.2.md §7.3, E13).

No guards, so no conditional edges: a static DAG with barrier fan-in, START -> input nodes and
the single output -> END, so output runs exactly once per case. Ingestion blocks (corpus,
chunker) become IndexHandles at compile time, never nodes.
"""

import asyncio
import time
from collections.abc import Awaitable, Mapping
from dataclasses import dataclass, field
from graphlib import TopologicalSorter
from typing import Annotated, Final, Protocol, TypedDict

from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from vgame.engine.blocks import BlockCall, BlockParams, ChunkerParams, EngineDeps, StepResult
from vgame.engine.constants import MAX_NODES
from vgame.engine.graph import GraphPayload, split_ref
from vgame.engine.levels import LevelSpec
from vgame.engine.registry import REGISTRY
from vgame.engine.types import (
    Answer,
    BlockType,
    BudgetExceededError,
    EngineError,
    EventSink,
    IndexHandle,
    IngestionInfo,
    PortValue,
    PublicCase,
    StepRecord,
    StepStatus,
    Usage,
)

# asyncio fires a timer up to one clock tick early; a cancel within that tick of the deadline
# is the deadline.
_CLOCK_RES: Final = time.get_clock_info("monotonic").resolution
# LangGraph superstep cap: a DAG of MAX_NODES nodes needs at most MAX_NODES steps.
RECURSION_LIMIT: Final = MAX_NODES + 2
_FAILED_SUMMARY: Final[dict[StepStatus, str]] = {
    "timeout": "Hết giờ, bước này bị dừng.",
    "cancelled": "Bước này bị huỷ.",
    "budget": "Ca này đã dùng hết số lời gọi LLM cho phép.",
    "llm_error": "Gọi LLM thất bại, thử lại sau.",
}


def merge_once(left: dict[str, PortValue], right: dict[str, PortValue]) -> dict[str, PortValue]:
    """Each port value is written once; a second write means the DAG compiled wrong."""
    if dup := left.keys() & right.keys():
        raise ValueError(f"port written twice: {sorted(dup)}")
    return {**left, **right}


class CaseState(TypedDict):
    case: PublicCase
    ports: Annotated[dict[str, PortValue], merge_once]  # "vs.docs" -> DocList
    answer: Answer | None  # written by the output node only (a plain key: two writes raise)


@dataclass
class CaseContext:
    """Per-case sink passed through ``config["configurable"]["case_ctx"]``. Step records live
    here, not in the graph state, so they survive a timeout or an error that aborts the case."""

    run_id: str
    emit: EventSink
    deadline: float  # loop.time() of the case deadline (min of case and run deadlines)
    steps: list[StepRecord] = field(default_factory=list)


CaseGraph = CompiledStateGraph[CaseState, None, CaseState, CaseState]


@dataclass(frozen=True)
class CompiledLevelGraph:
    level_id: str
    graph: CaseGraph  # ainvoke one CaseState per case
    handles: Mapping[str, IndexHandle]  # chunker node -> handle
    retrievers: Mapping[str, tuple[BlockType, IndexHandle]]  # compiled retriever -> its index
    ingestion: list[IngestionInfo]  # empty when the index store is missing
    blocks: frozenset[BlockType]  # block types of the compiled (runtime) nodes
    nodes: tuple[str, ...]  # compiled node ids in topological order


InEdge = tuple[str, str, str]  # src node, src port, dst port


class NodeFn(Protocol):
    def __call__(
        self, state: CaseState, config: RunnableConfig
    ) -> Awaitable[dict[str, object]]: ...


def instrumented(
    node_id: str,
    block: BlockType,
    params: BlockParams,
    deps: EngineDeps,
    in_edges: list[InEdge],
    handles: Mapping[str, IndexHandle],
) -> NodeFn:
    """A LangGraph node that always emits a step.started/step.finished pair, whatever happens."""

    async def node(state: CaseState, config: RunnableConfig) -> dict[str, object]:
        ctx: CaseContext = config["configurable"]["case_ctx"]
        case = state["case"]
        ctx.emit(
            {
                "type": "step.started",
                "run": ctx.run_id,
                "case": case.id,
                "node": node_id,
                "block": block,
            }
        )
        started = time.perf_counter()
        status: StepStatus = "cancelled"
        result: StepResult | None = None
        message = ""
        try:
            inputs: dict[str, list[PortValue]] = {}
            for src, src_port, port in in_edges:
                value = handles[src] if src in handles else state["ports"][f"{src}.{src_port}"]
                inputs.setdefault(port, []).append(value)
            result = await params.run(BlockCall(node_id, case, inputs, deps))
            status = result.status
        except asyncio.CancelledError:
            expired = asyncio.get_running_loop().time() + _CLOCK_RES >= ctx.deadline
            status = "timeout" if expired else "cancelled"
            raise
        except TimeoutError:  # the LLM chain: no model can answer before the case deadline
            status = "timeout"
            raise
        except BudgetExceededError as exc:
            status, message = "budget", exc.message_vi
            raise
        except EngineError as exc:  # llm_error, or index_error for the index layer
            status, message = exc.step_status, exc.message_vi
            raise
        finally:
            ms = round((time.perf_counter() - started) * 1000)
            if result is not None and result.ms is not None:
                ms = result.ms
            usage = result.usage if result else Usage()
            facts = result.facts if result else ()
            summary = result.summary if result else message or _FAILED_SUMMARY[status]
            ctx.steps.append(StepRecord(node_id, block, status, ms, usage, facts))
            ctx.emit(
                {
                    "type": "step.finished",
                    "run": ctx.run_id,
                    "case": case.id,
                    "node": node_id,
                    "block": block,
                    "status": status,
                    "summary": summary,
                    "tokens": {"in": usage.input_tokens, "out": usage.output_tokens},
                    "ms": ms,
                    "facts": list(facts),
                }
            )
        update: dict[str, object] = {
            "ports": {f"{node_id}.{port}": value for port, value in result.outputs.items()}
        }
        if result.answer is not None:
            update["answer"] = result.answer
        return update

    return node


def compile_graph(graph: GraphPayload, level: LevelSpec, deps: EngineDeps) -> CompiledLevelGraph:
    """``graph`` must come from ``validator.validate`` (no error issues)."""
    types = {n.id: n.type for n in graph.nodes}
    params = {n.id: REGISTRY[n.type].params.model_validate(n.params) for n in graph.nodes}
    edges = []
    for src_ref, dst_ref in graph.edges:
        a, b = split_ref(src_ref), split_ref(dst_ref)
        if a is None or b is None:
            raise ValueError("graph was not validated")
        edges.append((*a, *b))

    in_edges: dict[str, list[InEdge]] = {n: [] for n in types}
    for src, src_port, dst, dst_port in edges:
        in_edges[dst].append((src, src_port, dst_port))

    # Only ancestors of the output run (validator issue I01 for the rest).
    output = next(n for n, t in types.items() if t == "output")
    keep, stack = {output}, [output]
    while stack:
        for src, _, _ in in_edges[stack.pop()]:
            if src not in keep:
                keep.add(src)
                stack.append(src)
    order = [
        n
        for n in TopologicalSorter({n: {e[0] for e in in_edges[n]} for n in types}).static_order()
        if n in keep
    ]

    handles: dict[str, IndexHandle] = {}
    for n in order:
        chunker = params[n]
        if isinstance(chunker, ChunkerParams):
            handles[n] = chunker.handle(level.corpus)
    runtime = [n for n in order if REGISTRY[types[n]].runtime]

    builder = StateGraph(CaseState)
    for n in runtime:
        builder.add_node(n, instrumented(n, types[n], params[n], deps, in_edges[n], handles))
        sources = sorted({src for src, _, _ in in_edges[n] if src not in handles})
        if not sources:
            builder.add_edge(START, n)
        elif len(sources) == 1:
            builder.add_edge(sources[0], n)
        else:  # barrier: runs once, after every source finished
            builder.add_edge(sources, n)
    builder.add_edge(output, END)

    retrievers: dict[str, tuple[BlockType, IndexHandle]] = {}
    for n in runtime:
        block = types[n]
        if block in ("vector_search", "bm25_search"):
            index_src = next(s for s, _, p in in_edges[n] if p == "index")
            retrievers[n] = (block, handles[index_src])
        elif block in ("fusion", "rerank"):
            docs_src = next(s for s, _, p in in_edges[n] if p == "docs")
            retrievers[n] = (block, retrievers[docs_src][1])

    ingestion: list[IngestionInfo] = []
    if deps.store is not None:
        for n, handle in handles.items():
            chunks = deps.store.chunks(handle)
            avg = round(sum(c.tokens for c in chunks) / len(chunks)) if chunks else 0
            ingestion.append(
                {"node": n, "variant": handle.variant.key, "chunks": len(chunks), "avg_tokens": avg}
            )

    return CompiledLevelGraph(
        level_id=level.id,
        graph=builder.compile(),
        handles=handles,
        retrievers=retrievers,
        ingestion=ingestion,
        blocks=frozenset(types[n] for n in runtime),
        nodes=tuple(runtime),
    )
