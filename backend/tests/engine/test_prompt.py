from vgame.engine.constants import PROFILE_MAX_TOKENS, count_tokens
from vgame.engine.prompt import FRAME_VI, build_request, parse_citations, render_docs
from vgame.engine.types import Chunk, PackedContext


def chunk(cid: str, text: str, dieu: int = 12) -> Chunk:
    return Chunk(cid, "qcdt-2024", dieu, (1,), True, text, count_tokens(text), 0, len(text))


def ctx(
    chunks: tuple[Chunk, ...], *, cite_ids: bool, question: str = "Bảo lưu thế nào?"
) -> PackedContext:
    return PackedContext(
        question=question,
        docs_text=render_docs(chunks, cite_ids=cite_ids),
        included=chunks,
        dropped=(),
        docs_tokens=0,
        query_tokens=0,
        token_budget=3000,
        cite_ids=cite_ids,
    )


def test_render_docs_with_and_without_ids_prints_no_metadata() -> None:
    chunks = [chunk("ab12cd34", "Điều 12. Bảo lưu"), chunk("ff00ee11", "2. Nộp đơn")]
    assert (
        render_docs(chunks, cite_ids=True) == "[ab12cd34] Điều 12. Bảo lưu\n\n[ff00ee11] 2. Nộp đơn"
    )
    plain = render_docs(chunks, cite_ids=False)
    assert plain == "Điều 12. Bảo lưu\n\n2. Nộp đơn"
    assert "hieu_luc" not in plain
    assert "True" not in plain


def test_build_request_frames_system_and_lays_out_docs_then_question() -> None:
    req = build_request(
        ctx((chunk("ab12cd34", "Nội dung"),), cite_ids=True), profile="can_bang", system_prompt="G1"
    )
    assert req.system == FRAME_VI + "\n\nG1"
    assert [m.role for m in req.messages] == ["user"]
    assert req.messages[0].text == "Tài liệu:\n[ab12cd34] Nội dung\n\nCâu hỏi: Bảo lưu thế nào?"
    assert req.max_tokens == PROFILE_MAX_TOKENS["can_bang"]
    assert req.profile == "can_bang"


def test_empty_pack_has_no_docs_section() -> None:
    req = build_request(ctx((), cite_ids=True), profile="nhe", system_prompt="")
    assert req.messages[0].text == "Câu hỏi: Bảo lưu thế nào?"
    assert "Tài liệu" not in req.messages[0].text
    assert req.max_tokens == PROFILE_MAX_TOKENS["nhe"]


def test_player_text_is_data_not_a_template() -> None:
    evil = "{x} {0} {__class__} %s"
    req = build_request(ctx((), cite_ids=False, question=evil), profile="sau", system_prompt=evil)
    assert req.system.endswith(evil)
    assert req.messages[0].text == "Câu hỏi: " + evil


def test_parse_citations_order_split_dedupe_and_limits() -> None:
    text = "Ý một [ab12cd34]. Ý hai [ff00ee11, ab12cd34; 9a9a9a9a]. [ ] [" + "x" * 65 + "] [a\nb]"
    assert parse_citations(text) == ("ab12cd34", "ff00ee11", "9a9a9a9a")
    assert parse_citations("không trích") == ()
    assert parse_citations("[[ab]]") == ("ab",)
