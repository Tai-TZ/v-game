"""Load the fictional regulations (docs/content/corpus) into articles and clauses.

Loading rules (corpus README §2, engine-v0.2.md §5.1): only files whose front matter has a
``doc_id``; only from the ``## Chương I`` line down; chapter lines and HTML comments dropped;
``### Điều N. Tiêu đề`` becomes ``Điều N. Tiêu đề``; ``N. `` lines are clauses; ``a) `` lines
are points of the clause above; NFC; blank lines collapsed; lines joined with ``\\n``.
"""

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

_FRONT_MATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_FIRST_CHAPTER_RE = re.compile(r"^## Chương I\b", re.MULTILINE)
_ARTICLE_RE = re.compile(r"^### Điều (\d+)\. (.+)$")
_CLAUSE_RE = re.compile(r"^(\d+)\. ")


@dataclass(frozen=True, slots=True)
class Clause:
    number: int | None  # None when the article has no numbered clauses
    start: int  # offsets into Document.text
    end: int


@dataclass(frozen=True, slots=True)
class Article:
    dieu: int
    title: str  # "Bảo lưu kết quả học tập" (no number)
    start: int  # offset of the "Điều N. …" line
    end: int
    clauses: tuple[Clause, ...]

    @property
    def heading(self) -> str:
        return f"Điều {self.dieu}. {self.title}"


@dataclass(frozen=True, slots=True)
class Document:
    doc_id: str
    in_force: bool
    text: str  # cleaned, NFC, "\n" line breaks
    articles: tuple[Article, ...]


def parse_document(raw: str) -> Document | None:
    """Parse one corpus file; None when it has no ``doc_id`` front matter (e.g. README)."""
    raw = unicodedata.normalize("NFC", raw.replace("\r\n", "\n"))
    front = _FRONT_MATTER_RE.match(raw)
    if front is None:
        return None
    meta = dict(
        (key.strip(), value.strip())
        for key, sep, value in (line.partition(":") for line in front.group(1).splitlines())
        if sep
    )
    if "doc_id" not in meta:
        return None
    first = _FIRST_CHAPTER_RE.search(raw)
    if first is None:
        raise ValueError(f"{meta['doc_id']}: no '## Chương I' line")
    body = _COMMENT_RE.sub("", raw[first.start() :])

    lines: list[str] = []
    offset = 0
    heads: list[tuple[int, str, int]] = []  # (dieu, title, start)
    clause_starts: list[list[tuple[int, int]]] = []  # per article: (number, start)
    for line in (raw_line.rstrip() for raw_line in body.split("\n")):
        if not line or line.startswith("## "):
            continue
        heading = _ARTICLE_RE.match(line)
        if heading:
            title = heading.group(2).strip()
            line = f"Điều {heading.group(1)}. {title}"
            heads.append((int(heading.group(1)), title, offset))
            clause_starts.append([])
        elif not heads:
            raise ValueError(f"{meta['doc_id']}: text before the first article: {line[:40]!r}")
        elif clause := _CLAUSE_RE.match(line):
            clause_starts[-1].append((int(clause.group(1)), offset))
        lines.append(line)
        offset += len(line) + 1
    text = "\n".join(lines)

    # Every kept line belongs to an article, so a span ends right before the next one starts.
    ends = [start - 1 for _, _, start in heads[1:]] + [len(text)]
    parsed: list[Article] = []
    for (dieu, title, start), starts, end in zip(heads, clause_starts, ends, strict=True):
        if starts:
            clause_ends = [s - 1 for _, s in starts[1:]] + [end]
            clauses = tuple(
                Clause(number, cstart, cend)
                for (number, cstart), cend in zip(starts, clause_ends, strict=True)
            )
        else:
            clauses = (Clause(None, min(start + len(f"Điều {dieu}. {title}") + 1, end), end),)
        parsed.append(Article(dieu, title, start, end, clauses))
    return Document(
        doc_id=meta["doc_id"],
        in_force=meta.get("in_force", "").lower() == "true",
        text=text,
        articles=tuple(parsed),
    )


def load_documents(content_dir: Path) -> dict[str, Document]:
    """Every ``corpus/*.md`` with a ``doc_id`` front matter, keyed by ``doc_id``."""
    documents: dict[str, Document] = {}
    for path in sorted((content_dir / "corpus").glob("*.md")):
        doc = parse_document(path.read_text(encoding="utf-8"))
        if doc is None:
            continue
        if doc.doc_id in documents:
            raise ValueError(f"duplicate doc_id {doc.doc_id!r} in {path.name}")
        documents[doc.doc_id] = doc
    return documents


def find_quote(doc: Document, quote: str) -> tuple[int, int]:
    """Character span of a golden ``quote`` in ``doc.text``; ValueError if absent."""
    quote = unicodedata.normalize("NFC", quote)
    start = doc.text.find(quote) if quote else -1
    if start < 0:
        raise ValueError(f"quote not found in {doc.doc_id}: {quote[:40]!r}")
    return start, start + len(quote)
