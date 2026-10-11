"""Deterministic retrieval preview (vom-sao-v0.1 §4 phase 2, workbench-v0.1 §12).

Answers "what would this bench pull?" from the shipped index alone: no LLM call, no quota, no
run. The graph is validated and compiled exactly as ``POST /api/runs`` does, so a preview can
never use a configuration the level forbids, and only a sample case may be previewed — a
preview of a hidden case would hand the player a way to tune against the hidden set.
"""

from typing import Annotated, Final

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse

from vgame.api.engine import EngineServices, get_engine
from vgame.api.routes.levels import LEVEL_NOT_FOUND
from vgame.api.routes.runs import GRAPH_INVALID, JSON_ONLY, read_capped
from vgame.content.models import SLUG_PATTERN
from vgame.engine.blocks import EngineDeps
from vgame.engine.budget import RunBudget
from vgame.engine.compiler import compile_graph
from vgame.engine.index import IndexNotBuiltError, IndexStaleError
from vgame.engine.levels import load_level
from vgame.engine.retrieval import bm25_search, retrieved_fact, vector_search
from vgame.engine.types import EngineError
from vgame.engine.validator import validate

CASE_NOT_PREVIEWABLE: Final = "Chỉ xem trước được câu mẫu của màn này."
NO_STORE: Final = {"Cache-Control": "no-store"}

router = APIRouter(prefix="/preview", tags=["preview"])


@router.post(
    "/retrieval",
    responses={
        status.HTTP_404_NOT_FOUND: {"description": f"{LEVEL_NOT_FOUND} / {CASE_NOT_PREVIEWABLE}"},
        status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: {"description": JSON_ONLY},
        status.HTTP_422_UNPROCESSABLE_CONTENT: {"description": "Mọi lỗi của đồ thị, gom lại."},
        status.HTTP_503_SERVICE_UNAVAILABLE: {"description": "Index chưa dựng hoặc đã cũ."},
    },
)
async def preview_retrieval(
    request: Request,
    level: Annotated[str, Query(pattern=SLUG_PATTERN)],
    case: Annotated[str, Query(pattern=SLUG_PATTERN)],
    engine: Annotated[EngineServices, Depends(get_engine)],
) -> JSONResponse:
    """Body: the graph JSON, as ``POST /api/runs`` takes it. Returns one ``retrieved`` fact per
    retriever node, keyed by node id."""
    if request.headers.get("content-type", "").split(";")[0].strip() != "application/json":
        return JSONResponse({"detail": JSON_ONLY}, status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    try:
        spec_level = load_level(level)
    except KeyError:
        return JSONResponse({"detail": LEVEL_NOT_FOUND}, status.HTTP_404_NOT_FOUND)

    question = next(
        (
            c.question
            for c in engine.spec(spec_level.id).cases
            if c.id == case and c.role == "visible"
        ),
        None,
    )
    if question is None:
        return JSONResponse({"detail": CASE_NOT_PREVIEWABLE}, status.HTTP_404_NOT_FOUND)

    graph, issues = validate(await read_capped(request), spec_level)
    if graph is None:
        return JSONResponse(
            {"detail": GRAPH_INVALID, "issues": issues}, status.HTTP_422_UNPROCESSABLE_CONTENT
        )
    if engine.store is None:
        detail = IndexStaleError.message_vi if engine.index_stale else IndexNotBuiltError.message_vi
        return JSONResponse({"detail": detail}, status.HTTP_503_SERVICE_UNAVAILABLE)

    # No LLM client is needed: nothing downstream of the retrievers runs.
    deps = EngineDeps(engine.store, None, engine.reranker, RunBudget())
    try:
        compiled = compile_graph(graph, spec_level, deps)
    except EngineError as exc:
        return JSONResponse({"detail": exc.message_vi}, status.HTTP_503_SERVICE_UNAVAILABLE)

    params = {n.id: n.params for n in graph.nodes}
    nodes = {}
    for node, (block, handle) in compiled.retrievers.items():
        own = params.get(node, {})
        top_k = own.get("top_k")
        threshold = own.get("score_threshold")
        if block == "vector_search":
            docs = vector_search(
                engine.store,
                handle,
                question,
                top_k=top_k if isinstance(top_k, int) else None,
                score_threshold=float(threshold) if isinstance(threshold, int | float) else 0.0,
            )
        elif block == "bm25_search":
            docs = bm25_search(
                engine.store, handle, question, top_k=top_k if isinstance(top_k, int) else None
            )
        else:
            continue  # fusion and rerank need the upstream lists: phase 2b.
        nodes[node] = retrieved_fact(docs)

    return JSONResponse({"case": case, "nodes": nodes}, headers=NO_STORE)
