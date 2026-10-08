"""The 24 chunking variants (engine-v0.2.md §5.2).

A chunk is a run of consecutive ``TOKEN_RE`` tokens of ``doc.text``; ``Chunk.text`` is the
exact slice from the first token's start to the last token's end.

- ``co_dinh``: sliding window over the whole document (crosses article borders), size S,
  step S - overlap; no last window that lies inside the previous one.
- ``theo_dieu``: unit = clause (with its points); the article heading and any intro text go
  with the first clause; an article without clauses is one unit. Consecutive units of the
  same article are merged greedily while the total stays <= S. A unit longer than S is cut
  with the fixed window inside it (overlap applies only to those inner cuts). Never crosses
  two articles.
"""

import hashlib
from bisect import bisect_right
from itertools import pairwise

from vgame.engine.constants import TOKEN_RE, IndexVariant
from vgame.engine.corpus import Article, Document
from vgame.engine.types import Chunk


def chunk_id(variant: IndexVariant, doc_id: str, start: int, end: int) -> str:
    """Opaque id: nothing about the article can be derived from it (corpus README §2.1)."""
    return hashlib.sha256(f"{variant.key}|{doc_id}|{start}|{end}".encode()).hexdigest()[:8]


def _windows(first: int, last: int, size: int, step: int) -> list[tuple[int, int]]:
    """Token ranges [a, b) covering [first, last) with a fixed window."""
    out: list[tuple[int, int]] = []
    start = first
    while True:
        end = min(start + size, last)
        out.append((start, end))
        if end >= last:
            return out
        start += step


def _token_ranges(
    doc: Document, spans: list[tuple[int, int]], v: IndexVariant
) -> list[tuple[int, int]]:
    size, step = v.chunk_size, v.chunk_size - v.overlap_tokens
    if v.strategy == "co_dinh":
        return _windows(0, len(spans), size, step) if spans else []

    token_starts = [s for s, _ in spans]

    def tok(offset: int) -> int:  # index of the first token at or after a char offset
        return bisect_right(token_starts, offset - 1)

    ranges: list[tuple[int, int]] = []
    for article in doc.articles:
        # Units: heading (+ intro) + clause 1, then one per clause; one unit if unnumbered.
        bounds = [article.start, *(c.start for c in article.clauses[1:]), article.end]
        units = [(a, b) for a, b in pairwise(tok(x) for x in bounds) if b > a]
        group: tuple[int, int] | None = None
        for a, b in units:
            if b - a > size:
                if group:
                    ranges.append(group)
                    group = None
                ranges.extend(_windows(a, b, size, step))
            elif group and b - group[0] <= size:
                group = (group[0], b)
            else:
                if group:
                    ranges.append(group)
                group = (a, b)
        if group:
            ranges.append(group)
    return ranges


def _article_at(doc: Document, offset: int) -> Article:
    starts = [a.start for a in doc.articles]
    return doc.articles[max(bisect_right(starts, offset) - 1, 0)]


def chunk_document(doc: Document, variant: IndexVariant) -> list[Chunk]:
    spans = [m.span() for m in TOKEN_RE.finditer(doc.text)]
    chunks: list[Chunk] = []
    for a, b in _token_ranges(doc, spans, variant):
        start, end = spans[a][0], spans[b - 1][1]
        article = _article_at(doc, start)
        khoan = tuple(
            c.number
            for c in article.clauses
            if c.number is not None and c.start < end and start < c.end
        )
        chunks.append(
            Chunk(
                chunk_id=chunk_id(variant, doc.doc_id, start, end),
                doc_id=doc.doc_id,
                dieu=article.dieu,
                khoan=khoan,
                hieu_luc=doc.in_force,
                text=doc.text[start:end],
                tokens=b - a,
                start=start,
                end=end,
            )
        )
    return chunks


def _touched(doc: Document, chunk: Chunk) -> list[Article]:
    return [a for a in doc.articles if a.start < chunk.end and chunk.start < a.end]


def bm25_text(doc: Document, chunk: Chunk) -> str:
    """BM25 field: "Điều N. Tiêu đề" of every article the chunk touches + the chunk text, so
    "Điều 47 khoản 2" finds a mid-article chunk (corpus README §2, assumption 2)."""
    return "\n".join([a.heading for a in _touched(doc, chunk)] + [chunk.text])


def embed_text(doc: Document, chunk: Chunk) -> str:
    """Dense field (E4): titles without numbers + chunk text with heading lines cut out, so
    only BM25 sees article numbers. No "passage: " prefix (FastEmbedder adds it)."""
    articles = _touched(doc, chunk)
    pieces: list[str] = []
    cursor = chunk.start
    for article in articles:  # cut each heading line span that overlaps the chunk
        h_start, h_end = article.start, article.start + len(article.heading)
        if h_end > chunk.start and h_start < chunk.end:
            pieces.append(doc.text[cursor : max(h_start, cursor)])
            cursor = max(cursor, h_end)
    pieces.append(doc.text[cursor : chunk.end])
    body = [p.strip() for p in pieces if p.strip()]
    return "\n".join([a.title for a in articles] + body)
