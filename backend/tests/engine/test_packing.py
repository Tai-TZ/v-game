from vgame.engine.constants import count_tokens
from vgame.engine.packing import pack, pack_fact
from vgame.engine.prompt import render_docs
from vgame.engine.types import Chunk, DocHit, DocList, Retriever


def chunk(cid: str, words: int) -> Chunk:
    text = " ".join(["từ"] * words)
    return Chunk(cid, "qcdt-2024", 1, (), True, text, words, 0, len(text))


def docs(origin: Retriever, *chunks: Chunk) -> DocList:
    return DocList(origin, tuple(DocHit(c, 1.0) for c in chunks))


A, B, C, D = (
    chunk("aaaa0001", 10),
    chunk("bbbb0002", 50),
    chunk("cccc0003", 5),
    chunk("dddd0004", 3),
)
QUESTION = "Bảo lưu?"  # "Câu hỏi: Bảo lưu?" = 6 tokens


def test_merges_in_edge_order_and_dedupes_first_wins() -> None:
    ctx = pack(
        QUESTION,
        [docs("vector_search", A, C), docs("bm25_search", C, D)],
        token_budget=3000,
        cite_ids=False,
    )
    assert [c.chunk_id for c in ctx.included] == ["aaaa0001", "cccc0003", "dddd0004"]
    assert ctx.dropped == ()


def test_cat_duoi_drops_tail_without_picking_up_smaller_later_chunks() -> None:
    # budget 30: query 6 + A 10 = 16; B (50) overflows -> B, C, D dropped though C, D would fit.
    ctx = pack(QUESTION, [docs("vector_search", A, B, C, D)], token_budget=30, cite_ids=False)
    assert [c.chunk_id for c in ctx.included] == ["aaaa0001"]
    assert ctx.dropped == ("bbbb0002", "cccc0003", "dddd0004")
    assert ctx.query_tokens == 6 == count_tokens("Câu hỏi: " + QUESTION)
    assert ctx.docs_tokens == 10


def test_docs_tokens_match_rendered_text_with_ids() -> None:
    ctx = pack(QUESTION, [docs("fusion", A, C)], token_budget=3000, cite_ids=True)
    assert ctx.docs_text == render_docs([A, C], cite_ids=True)
    assert ctx.docs_tokens == count_tokens(ctx.docs_text) == 10 + 5 + 2 * 3
    # exact fit is allowed
    tight = pack(QUESTION, [docs("fusion", A, C)], token_budget=ctx.docs_tokens + 6, cite_ids=True)
    assert tight.dropped == ()


def test_empty_lists_and_fact_shape() -> None:
    ctx = pack(QUESTION, [], token_budget=300, cite_ids=True)
    assert ctx.included == ()
    assert ctx.docs_text == ""
    full = pack(QUESTION, [docs("rerank", A, B)], token_budget=20, cite_ids=False)
    assert pack_fact(full) == {
        "kind": "pack",
        "included": ["aaaa0001"],
        "dropped": ["bbbb0002"],
        "tokens": {"docs": 10, "query": 6, "total": 16, "budget": 20},
    }
