"""context_packer: merge retrieved lists into the context box (engine-v0.2.md §5.6)."""

from collections.abc import Sequence

from vgame.engine.constants import count_tokens
from vgame.engine.prompt import QUESTION_PREFIX, render_docs
from vgame.engine.types import Chunk, DocList, PackedContext, PackFact


def pack(
    question: str, lists: Sequence[DocList], *, token_budget: int, cite_ids: bool
) -> PackedContext:
    """Budget = docs + question tokens. ``on_overflow = cat_duoi``: keep chunks in order until
    the next one would overflow; it and everything after it are dropped (no smaller later
    chunk is picked up)."""
    unique: dict[str, Chunk] = {}
    for doc_list in lists:  # graph-JSON edge order; first occurrence of a chunk wins
        for hit in doc_list.hits:
            unique.setdefault(hit.chunk.chunk_id, hit.chunk)
    candidates = list(unique.values())

    query_tokens = count_tokens(QUESTION_PREFIX + question)
    included: list[Chunk] = []
    docs_tokens = 0
    for chunk in candidates:
        # Blocks are joined by blank lines, so the rendered count is the sum of block counts.
        block = count_tokens(render_docs([chunk], cite_ids=cite_ids))
        if docs_tokens + block + query_tokens > token_budget:
            break
        included.append(chunk)
        docs_tokens += block
    dropped = tuple(c.chunk_id for c in candidates[len(included) :])

    return PackedContext(
        question=question,
        docs_text=render_docs(included, cite_ids=cite_ids),
        included=tuple(included),
        dropped=dropped,
        docs_tokens=docs_tokens,
        query_tokens=query_tokens,
        token_budget=token_budget,
        cite_ids=cite_ids,
    )


def pack_fact(ctx: PackedContext) -> PackFact:
    return {
        "kind": "pack",
        "included": [c.chunk_id for c in ctx.included],
        "dropped": list(ctx.dropped),
        "tokens": {
            "docs": ctx.docs_tokens,
            "query": ctx.query_tokens,
            "total": ctx.docs_tokens + ctx.query_tokens,
            "budget": ctx.token_budget,
        },
    }
