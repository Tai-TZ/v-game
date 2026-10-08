"""Corpus loading: structure of both regulations and every golden quote."""

import json
import unicodedata
from pathlib import Path

import pytest

from vgame.config import Settings
from vgame.engine.corpus import Article, Document, find_quote, load_documents, parse_document

CONTENT_DIR = Settings(_env_file=None).content_dir


@pytest.fixture(scope="module")
def documents() -> dict[str, Document]:
    return load_documents(CONTENT_DIR)


def _article(doc: Document, dieu: int) -> Article:
    return next(a for a in doc.articles if a.dieu == dieu)


def test_loads_exactly_the_two_regulations(documents: dict[str, Document]) -> None:
    assert sorted(documents) == ["qcdt-2019", "qcdt-2024"]
    assert documents["qcdt-2024"].in_force is True
    assert documents["qcdt-2019"].in_force is False


def test_2024_structure(documents: dict[str, Document]) -> None:
    doc = documents["qcdt-2024"]
    assert [a.dieu for a in doc.articles] == list(range(1, 85))
    assert [c.number for c in _article(doc, 12).clauses] == [1, 2, 3]
    assert [c.number for c in _article(doc, 41).clauses] == [1, 2, 3, 4]
    for dieu in (35, 51, 80):  # articles without numbered clauses
        assert [c.number for c in _article(doc, dieu).clauses] == [None]
    assert _article(doc, 12).title == "Bảo lưu kết quả học tập"
    assert [a.dieu for a in documents["qcdt-2019"].articles] == list(range(1, 17))


def test_spans_slice_the_text(documents: dict[str, Document]) -> None:
    doc = documents["qcdt-2024"]
    article = _article(doc, 12)
    assert doc.text[article.start : article.end].startswith("Điều 12. Bảo lưu kết quả học tập\n1. ")
    assert doc.text[article.end + 1 :].startswith("Điều 13. ")
    second = article.clauses[1]
    assert doc.text[second.start : second.end].startswith("2. Sinh viên nộp đơn bảo lưu")
    assert doc.text[second.end] == "\n"
    no_clause = _article(doc, 35).clauses[0]
    assert doc.text[no_clause.start :].startswith("Sinh viên được dự thi")
    assert no_clause.end == _article(doc, 35).end


def test_loaded_text_keeps_only_regulation_body(documents: dict[str, Document]) -> None:
    for doc in documents.values():
        assert doc.text.startswith("Điều 1. ")
        assert unicodedata.is_normalized("NFC", doc.text)
        for junk in ("## ", "###", "<!--", "doc_id", "Ban hành kèm theo", "\n\n", "\r"):
            assert junk not in doc.text


def test_every_golden_quote_is_in_its_article(documents: dict[str, Document]) -> None:
    checked = 0
    for path in sorted((CONTENT_DIR / "golden").glob("library-l[0-9]*.json")):
        for case in json.loads(path.read_text(encoding="utf-8"))["cases"]:
            for gold in case["gold"]:
                doc = documents[gold["doc_id"]]
                start, end = find_quote(doc, gold["quote"])
                article = _article(doc, gold["dieu"])
                assert article.start <= start, case["id"]
                assert end <= article.end, case["id"]
                if gold["khoan"] is not None:
                    clause = next(c for c in article.clauses if c.number == gold["khoan"])
                    assert clause.start <= start, case["id"]
                    assert end <= clause.end, case["id"]
                checked += 1
    assert checked > 40


def test_find_quote_rejects_absent_or_empty_text(documents: dict[str, Document]) -> None:
    with pytest.raises(ValueError, match="quote not found"):
        find_quote(documents["qcdt-2024"], "email")
    with pytest.raises(ValueError, match="quote not found"):
        find_quote(documents["qcdt-2024"], "")


def test_parse_skips_files_without_doc_id_and_requires_chapter_one(tmp_path: Path) -> None:
    assert parse_document("# README\n\nno front matter\n") is None
    assert parse_document("---\ntitle: x\n---\n## Chương I. A\n") is None
    with pytest.raises(ValueError, match="Chương I"):
        parse_document("---\ndoc_id: x\n---\n### Điều 1. A\n")


def test_parse_points_and_intro_text() -> None:
    raw = (
        "---\ndoc_id: demo\nin_force: true\n---\n<!-- note -->\n# Title\n\n"
        "## Chương I. CHUNG\n\n### Điều 1. Một\n\nMở đầu.\n\n1. Khoản một:\na) điểm a;\n"
        "đ) điểm đ.\n2. Khoản hai.\n\n## Chương II. KHÁC\n\n### Điều 2. Hai\n\nKhông chia khoản.\n"
    )
    doc = parse_document(raw)
    assert doc is not None
    assert doc.text == (
        "Điều 1. Một\nMở đầu.\n1. Khoản một:\na) điểm a;\nđ) điểm đ.\n2. Khoản hai.\n"
        "Điều 2. Hai\nKhông chia khoản."
    )
    first, second = doc.articles
    one, two = first.clauses
    assert doc.text[one.start : one.end] == "1. Khoản một:\na) điểm a;\nđ) điểm đ."
    assert doc.text[two.start : two.end] == "2. Khoản hai."
    assert doc.text[second.clauses[0].start : second.clauses[0].end] == "Không chia khoản."
