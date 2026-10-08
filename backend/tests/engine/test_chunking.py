"""The 24 chunking variants: invariants on the real corpus, exact cuts on a synthetic one."""

import json
import re
from bisect import bisect_left
from dataclasses import replace

import pytest

from vgame.config import Settings
from vgame.engine.chunking import bm25_text, chunk_document, chunk_id, embed_text
from vgame.engine.constants import ALL_VARIANTS, TOKEN_RE, IndexVariant, count_tokens
from vgame.engine.corpus import Document, find_quote, load_documents, parse_document

CONTENT_DIR = Settings(_env_file=None).content_dir
DOCUMENTS = load_documents(CONTENT_DIR)
QCDT_2024 = DOCUMENTS["qcdt-2024"]


def _variant(key: str) -> IndexVariant:
    return next(v for v in ALL_VARIANTS if v.key == key)


def _quote(case_id: str, level: int) -> str:
    data = json.loads((CONTENT_DIR / "golden" / f"library-l{level}.json").read_text("utf-8"))
    return str(next(c for c in data["cases"] if c["id"] == case_id)["gold"][0]["quote"])


def _words(n: int) -> str:
    return " ".join(["từ"] * n)


def _synthetic() -> Document:
    raw = (
        "---\ndoc_id: demo\nin_force: true\n---\n## Chương I. A\n"
        f"### Điều 1. Một\n1. {_words(40)}\n2. {_words(40)}\n3. {_words(60)}\n"
        f"### Điều 2. Hai\n1. {_words(298)}\n2. {_words(10)}\n"
    )
    doc = parse_document(raw)
    assert doc is not None
    return doc


@pytest.mark.parametrize("variant", ALL_VARIANTS, ids=lambda v: v.key)
def test_variant_invariants_on_real_corpus(variant: IndexVariant) -> None:
    for doc in DOCUMENTS.values():
        chunks = chunk_document(doc, variant)
        assert len({c.chunk_id for c in chunks}) == len(chunks)
        for c in chunks:
            assert re.fullmatch(r"[0-9a-f]{8}", c.chunk_id)
            assert c.text == doc.text[c.start : c.end]
            assert c.tokens == count_tokens(c.text) <= variant.chunk_size
            assert c.hieu_luc is doc.in_force
            article = next(a for a in doc.articles if a.start <= c.start <= a.end)
            assert c.dieu == article.dieu
            assert set(c.khoan) <= {k.number for k in article.clauses}
            if variant.strategy == "theo_dieu":
                assert c.end <= article.end  # never crosses two articles
        starts = [m.start() for m in TOKEN_RE.finditer(doc.text)]
        covered = [False] * len(starts)
        for c in chunks:
            for i in range(bisect_left(starts, c.start), bisect_left(starts, c.end)):
                covered[i] = True
        assert all(covered)  # every token is in some chunk


def test_theo_dieu_512_keeps_article_12_whole() -> None:
    chunks = [c for c in chunk_document(QCDT_2024, _variant("theo_dieu-512-10")) if c.dieu == 12]
    assert len(chunks) == 1
    assert chunks[0].khoan == (1, 2, 3)
    assert chunks[0].text.startswith("Điều 12. Bảo lưu kết quả học tập")


def test_co_dinh_128_splits_the_long_quote_of_lib_l2_v02() -> None:
    start, end = find_quote(QCDT_2024, _quote("lib-l2-v02", 2))
    chunks = chunk_document(QCDT_2024, _variant("co_dinh-128-0"))
    assert not [c for c in chunks if c.start <= start and end <= c.end]
    assert len([c for c in chunks if c.start < end and start < c.end]) >= 2


def test_theo_dieu_groups_clauses_and_cuts_long_ones_with_overlap() -> None:
    doc = _synthetic()
    chunks = chunk_document(doc, _variant("theo_dieu-128-10"))
    assert [(c.dieu, c.khoan, c.tokens) for c in chunks] == [
        (1, (1, 2), 4 + 42 + 42),  # heading goes with clause 1; 1+2 fit, adding 3 would not
        (1, (3,), 62),
        (2, (1,), 128),  # heading + 300-token clause = 304 tokens: inner cuts, step 116
        (2, (1,), 128),
        (2, (1,), 304 - 232),
        (2, (2,), 12),  # clean cut at the clause boundary, no overlap carried over
    ]
    assert chunks[0].text.startswith("Điều 1. Một\n1. ")
    assert chunks[-1].text == f"2. {_words(10)}"
    first, second = chunks[2], chunks[3]
    assert first.text.split()[-12:] == second.text.split()[:12]  # 12-token overlap


def test_co_dinh_slides_across_articles() -> None:
    doc = _synthetic()
    total = count_tokens(doc.text)
    chunks = chunk_document(doc, _variant("co_dinh-128-20"))  # step 128 - 25 = 103
    assert [c.tokens for c in chunks[:-1]] == [128] * (len(chunks) - 1)
    starts = [m.start() for m in TOKEN_RE.finditer(doc.text)]
    assert [c.start for c in chunks] == [starts[i * 103] for i in range(len(chunks))]
    assert chunks[-1].end == len(doc.text)
    assert (len(chunks) - 1) * 103 < total <= (len(chunks) - 1) * 103 + 128
    assert any(c.dieu == 1 and "Điều 2. Hai" in c.text for c in chunks)


def test_chunk_id_is_opaque_and_variant_specific() -> None:
    a = chunk_id(_variant("co_dinh-128-0"), "qcdt-2024", 0, 100)
    b = chunk_id(_variant("co_dinh-128-10"), "qcdt-2024", 0, 100)
    assert a != b
    assert re.fullmatch(r"[0-9a-f]{8}", a)


def test_bm25_text_has_every_heading_and_embed_text_has_no_numbers() -> None:
    doc = _synthetic()
    spanning = next(c for c in chunk_document(doc, _variant("co_dinh-128-0")) if "Điều 2" in c.text)
    assert bm25_text(doc, spanning).startswith("Điều 1. Một\nĐiều 2. Hai\n")
    dense = embed_text(doc, spanning)
    assert dense.startswith("Một\nHai\n")
    assert "Điều" not in dense

    article_47 = next(
        c for c in chunk_document(QCDT_2024, _variant("theo_dieu-512-10")) if c.dieu == 47
    )
    assert "Điều 47" in bm25_text(QCDT_2024, article_47)
    dense = embed_text(QCDT_2024, article_47)
    assert dense.startswith("Đề nghị xem xét lại điểm đánh giá quá trình\n1. Sinh viên")
    assert "47" not in dense


def test_embed_text_cuts_a_partial_heading_at_chunk_start() -> None:
    doc = _synthetic()
    heading_end = doc.articles[1].start + len("Điều 2. Hai")
    chunk = chunk_document(doc, _variant("theo_dieu-128-0"))[0]
    # a chunk that starts at the "2" of "Điều 2. Hai" must not leak the number
    partial = replace(chunk, start=doc.articles[1].start + len("Điều "), end=heading_end + 20)
    assert embed_text(doc, partial) == "Hai\n" + doc.text[heading_end + 1 : heading_end + 20]
