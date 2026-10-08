"""Evaluator (Part 4 minimal): golden spec, per-case grading, gold reveal and diagnosis.

With the test Oracle, the only code that reads gold. ``grade_case`` returns booleans and
no-gold labels only, safe to emit mid-run; positions of gold appear only in ``report``,
which the runtime calls after the run ends (D4). Rules: engine-v0.2.md §10, scenario §9-§11,
and the ``grading`` section of each golden file (which wins on conflict).
"""

import json
import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import TypeAdapter

from vgame.engine.chunking import chunk_document
from vgame.engine.constants import ALL_VARIANTS
from vgame.engine.corpus import Document, find_quote
from vgame.engine.index import IndexStore
from vgame.engine.retrieval import bm25_search, vector_search, vi_number
from vgame.engine.scoring import compute_stars, render
from vgame.engine.types import (
    BlockType,
    CaseGrade,
    CaseTrace,
    Chunk,
    Diagnosis,
    DocHit,
    GoldReveal,
    IndexHandle,
    LevelRules,
    PackFact,
    PublicCase,
    RetrievedFact,
    RunReport,
    StarResult,
)

# --- Golden spec --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class GoldQuote:
    doc_id: str
    dieu: int
    khoan: int | None
    quote: str


@dataclass(frozen=True, slots=True)
class GoldenCase:
    id: str
    role: Literal["visible", "hidden", "trap", "review"]
    vai: str
    question: str
    expect: Literal["answer", "abstain"]
    answer_points: tuple[str, ...]
    gold: tuple[GoldQuote, ...]
    forbidden: tuple[str, ...]
    trap: str | None
    bites: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class GradingSpec:
    level_id: str
    corpus: tuple[str, ...]
    cases: tuple[GoldenCase, ...]  # golden file order; "review" kept for the daily shift
    equivalents: dict[str, tuple[str, ...]]
    refusal_markers: tuple[str, ...]


_CASES = TypeAdapter(tuple[GoldenCase, ...])


def load_grading_spec(content_dir: Path, level_id: str) -> GradingSpec:
    """Find the golden file whose ``level_id`` matches among ``golden/library-l*.json``."""
    for path in sorted((content_dir / "golden").glob("library-l*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        if raw["level_id"] != level_id:
            continue
        return GradingSpec(
            level_id=level_id,
            corpus=tuple(raw["corpus"]),
            cases=_CASES.validate_python(raw["cases"]),
            equivalents={k: tuple(v) for k, v in raw["equivalents"].items()},
            refusal_markers=tuple(raw["grading"]["refusal_markers"]),
        )
    raise ValueError(f"no golden file for level {level_id!r}")


def public_cases(spec: GradingSpec) -> list[PublicCase]:
    return [
        PublicCase(id=c.id, role=c.role, vai=c.vai, question=c.question)
        for c in spec.cases
        if c.role != "review"
    ]


# --- Normalisation (golden grading.normalize) ---------------------------------------------

_DECIMAL_COMMA_RE = re.compile(r"(?<=\d),(?=\d)")
# Any punctuation except "%" and a dot between two digits.
_PUNCT_RE = re.compile(r"(?!(?<=\d)\.(?=\d))[^\w\s%]")
_SPACE_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    """NFC, lower case, decimal comma -> dot, other punctuation -> space, whitespace
    collapsed (not stripped: the golden equivalent "dưới 1 " relies on its trailing space)."""
    text = unicodedata.normalize("NFC", text).lower()
    text = _DECIMAL_COMMA_RE.sub(".", text)
    return _SPACE_RE.sub(" ", _PUNCT_RE.sub(" ", text))


def _has(haystack: str, needle: str) -> bool:
    """``haystack`` is `` normalize(answer) `` (space padded); substring match."""
    return normalize(needle) in haystack


_SENTENCE_RE = re.compile(r"[.!?\n]")
_ARTICLE_CLAIM_RE = re.compile(r"theo điều (\d+)|điều (\d+) quy định")


# --- Helpers over traces and chunks -------------------------------------------------------


@lru_cache(maxsize=8)
def _chunks_by_id(doc: Document) -> dict[str, Chunk]:
    """Every chunk of every variant of ``doc`` by id. Chunk ids hash (variant, doc, span), so
    gold-ness of a cited id is decided without knowing which index produced it.
    ponytail: assumes no 8-hex id collision across the 24 variants (tested on the real
    corpus); key by (variant, id) if the corpus grows enough to collide."""
    return {c.chunk_id: c for v in ALL_VARIANTS for c in chunk_document(doc, v)}


def _pack(trace: CaseTrace) -> PackFact | None:
    packs = [f for s in trace.steps for f in s.facts if f["kind"] == "pack"]
    return packs[-1] if packs else None


def _retrieved(trace: CaseTrace, node: str) -> RetrievedFact | None:
    for step in trace.steps:
        if step.node == node:
            for fact in step.facts:
                if fact["kind"] == "retrieved":
                    return fact
    return None


def _step_ms(trace: CaseTrace, block: BlockType) -> int:
    return sum(s.ms for s in trace.steps if s.block == block)


Span = tuple[str, int, int]  # doc_id, start, end


def _overlaps(chunk: Chunk, span: Span) -> bool:
    return chunk.doc_id == span[0] and chunk.start < span[2] and span[1] < chunk.end


def _contains(chunk: Chunk, span: Span) -> bool:
    return chunk.doc_id == span[0] and chunk.start <= span[1] and span[2] <= chunk.end


def _covered(chunks: Sequence[Chunk], span: Span, text: str) -> bool:
    """The chunks together cover [start, end) of ``span`` in doc ``text`` (pieces of a
    boundary split count; chunks are token slices, so a whitespace-only gap is covered)."""
    reach = span[1]
    for c in sorted((c for c in chunks if _overlaps(c, span)), key=lambda c: c.start):
        if c.start > reach and not text[reach : c.start].isspace():
            return False
        reach = max(reach, c.end)
    return reach >= span[2]


def _rank(chunks: Sequence[Chunk], span: Span) -> int | None:
    return next((i + 1 for i, c in enumerate(chunks) if _overlaps(c, span)), None)


def _rank_text(rank: int | None) -> str:
    return "không có mặt" if rank is None else str(rank)


# Diagnosis priority (engine-v0.2.md §10). Template key per flag; gold_rank adds ":<block>".
_PRIORITY = (
    "cite_unknown",
    "ret.boundary_split",
    "ret.gold_rank",
    "ret.gold_missing",
    "ctx.gold_dropped",
    "stale_doc",
    "cite_missing",
    "trap.failed",
)
_TEMPLATE_KEY = {
    "cite_unknown": "llm.cite_unknown",
    "stale_doc": "ret.stale_doc",
    "cite_missing": "llm.cite_missing",
}
_FALLBACK_TEMPLATE = "Câu #{n} chưa đạt ({flag})."


@dataclass(frozen=True, slots=True)
class _NodeView:
    node: str
    block: BlockType
    out: tuple[Chunk, ...]  # what the node returned in this case
    full: tuple[DocHit, ...] | None  # whole-corpus ranking (vector/bm25 only)


# --- Evaluator ----------------------------------------------------------------------------


class LevelEvaluator:
    def __init__(self, spec: GradingSpec, rules: LevelRules, store: IndexStore) -> None:
        self._spec = spec
        self._rules = rules
        self._store = store
        self._cases = {c.id: c for c in spec.cases}
        self._ordinal = {c.id: i for i, c in enumerate(spec.cases, start=1)}
        self._docs = {d: store.document(d) for d in spec.corpus}
        self._by_id: dict[str, Chunk] = {}
        for doc in self._docs.values():
            self._by_id.update(_chunks_by_id(doc))
        self._spans: dict[str, list[Span]] = {
            c.id: [(g.doc_id, *find_quote(self._docs[g.doc_id], g.quote)) for g in c.gold]
            for c in spec.cases
        }
        self._gold_ids = {
            case_id: {
                cid for cid, ch in self._by_id.items() if any(_contains(ch, s) for s in spans)
            }
            for case_id, spans in self._spans.items()
        }

    # -- per case, during the run (gold-free output) --

    def _articles(self, chunk: Chunk) -> set[int]:
        doc = self._docs[chunk.doc_id]
        return {a.dieu for a in doc.articles if a.start < chunk.end and chunk.start < a.end}

    def _unknown_citations(
        self, text: str, cited: Sequence[str], included: Sequence[str]
    ) -> list[str]:
        """Cited ids outside the pack, then non-refusal sentences claiming "theo Điều N" /
        "Điều N quy định" for an article no packed chunk touches."""
        unknown = [f"[{cid}]" for cid in cited if cid not in included]
        dieus = set().union(*(self._articles(self._by_id[cid]) for cid in included))
        for sentence in _SENTENCE_RE.split(text):
            norm = normalize(sentence)
            if any(_has(norm, m) for m in self._spec.refusal_markers):
                continue
            for match in _ARTICLE_CLAIM_RE.finditer(norm):
                dieu = int(match.group(1) or match.group(2))
                if dieu not in dieus:
                    unknown.append(f"Điều {dieu}")
        return unknown

    def grade_case(self, trace: CaseTrace) -> CaseGrade:
        case = self._cases[trace.case.id]
        answer = trace.answer if trace.status in ("ok", "refusal") else None
        text = answer.text if answer else ""
        cited = answer.cited_ids if answer else ()
        pack = _pack(trace)
        included = pack["included"] if pack else []
        norm = f" {normalize(text)} "

        unknown = self._unknown_citations(text, cited, included)
        abstained = any(_has(norm, m) for m in self._spec.refusal_markers)
        stale = any(not self._by_id[cid].hieu_luc for cid in included)

        criteria: dict[str, bool] = {}
        if case.expect == "answer":
            criteria["points"] = all(
                any(_has(norm, alt) for alt in (p, *self._spec.equivalents.get(p, ())))
                for p in case.answer_points
            )
            criteria["cited"] = any(
                cid in included and cid in self._gold_ids[case.id] for cid in cited
            )
        else:
            criteria["refusal"] = abstained
        criteria["no_fabrication"] = not unknown
        criteria["no_forbidden"] = not any(_has(norm, f) for f in case.forbidden)
        rule = self._rules["stale_fails"]
        if rule and (case.role in rule["roles"] or case.vai in rule["vai"]):
            criteria["no_stale"] = not stale

        labels = [
            name
            for name, on in (
                ("cite_unknown", bool(unknown)),
                ("cite_missing", answer is not None and not cited),
                ("abstained", abstained),
                ("stale_doc", stale),
            )
            if on
        ]
        if trace.status != "ok":
            labels.append(trace.status)
        return CaseGrade(
            case_id=case.id,
            passed=answer is not None and all(criteria.values()),
            counted=case.id not in self._rules["info_cases"],
            criteria=criteria,
            labels=tuple(labels),
        )

    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult:
        roles = {t.case.id: t.case.role for t in traces}
        tokens = sum(t.usage.tokens for t in traces)
        return compute_stars(self._rules, roles, grades, tokens)

    # -- after the run (gold positions allowed) --

    def _views(
        self, trace: CaseTrace, retrievers: Mapping[str, tuple[BlockType, IndexHandle]]
    ) -> list[_NodeView]:
        views: list[_NodeView] = []
        for node, (block, handle) in sorted(retrievers.items()):
            fact = _retrieved(trace, node)
            if fact is None:  # the case never reached this node
                continue
            out = tuple(self._by_id[item["chunk_id"]] for item in fact["items"])
            full: tuple[DocHit, ...] | None = None
            if block == "vector_search":
                full = vector_search(self._store, handle, trace.case.question, top_k=None).hits
            elif block == "bm25_search":
                full = bm25_search(self._store, handle, trace.case.question, top_k=None).hits
            views.append(_NodeView(node, block, out, full))
        return views

    def report(
        self,
        traces: Sequence[CaseTrace],
        grades: Sequence[CaseGrade],
        retrievers: Mapping[str, tuple[BlockType, IndexHandle]],
    ) -> RunReport:
        grade_by_id = {g.case_id: g for g in grades}
        handles = {handle for _, handle in retrievers.values()}
        stale_cases = sum("stale_doc" in g.labels for g in grades)
        gold: dict[str, GoldReveal] = {}
        diagnosis: list[Diagnosis] = []

        for trace in traces:
            case = self._cases[trace.case.id]
            spans = self._spans[case.id]
            pack = _pack(trace)
            included = [self._by_id[c] for c in (pack["included"] if pack else [])]
            dropped = [self._by_id[c] for c in (pack["dropped"] if pack else [])]
            views = self._views(trace, retrievers) if spans else []
            v: dict[str, str] = {
                "n": str(self._ordinal[case.id]),
                "max_dieu": str(self._rules["max_dieu"]),
                "m": str(len(included)),
                "pack_tokens": vi_number(pack["tokens"]["total"] if pack else 0),
                "dieu_list": ", ".join(
                    f"Điều {d}" for d in sorted(set().union(*map(self._articles, included)))
                )
                or "0 đoạn",  # templates read "thùng chỉ có {dieu_list}"
            }
            flags: list[str] = []
            gold_rank_block: BlockType | None = None
            # A case that never ran (run deadline, DailyCap skip) gets no retrieval flags.
            checked = spans if trace.steps else []

            # Boundary split: a quote that no chunk of a used index variant holds whole.
            for handle in handles:
                chunks = self._store.chunks(handle)
                for span in checked:
                    if not any(_contains(c, span) for c in chunks):
                        pieces = sorted(
                            (c for c in chunks if _overlaps(c, span)), key=lambda c: c.start
                        )
                        v |= {"a": pieces[0].chunk_id, "b": pieces[-1].chunk_id} if pieces else {}
                        if "ret.boundary_split" not in flags:
                            flags.append("ret.boundary_split")

            into_pack = included + dropped
            missing = [s for s in checked if not _covered(into_pack, s, self._docs[s[0]].text)]
            found = [g for g, s in zip(case.gold, spans, strict=True) if s not in missing]
            if missing:
                flags.append("ret.gold_missing")
                span = missing[0]
                quote = case.gold[spans.index(span)]
                v |= {
                    "dieu": str(quote.dieu),
                    "k2": str(quote.khoan),
                    "k1": str((found[0] if found else quote).khoan),
                }
                culprit = _culprit(views, span)
                if culprit is not None:
                    flags.append("ret.gold_rank")
                    view, rank = culprit
                    gold_rank_block = view.block
                    v |= {"rank": _rank_text(rank), "k": str(len(view.out))}
            elif any(not _covered(included, s, self._docs[s[0]].text) for s in checked):
                flags.append("ctx.gold_dropped")

            ranks: dict[str, int | None] = {}
            for view in views:
                ranked = [h.chunk for h in view.full] if view.full is not None else view.out
                best = [r for s in spans if (r := _rank(ranked, s)) is not None]
                ranks[view.node] = min(best) if best else None
                v |= _view_vars(view, spans, ranks[view.node], _step_ms(trace, "rerank"))
            if "rank" not in v and ranks:  # ctx.gold_dropped: rank in the retrieved list
                out_ranks = [r for view in views for s in spans if (r := _rank(view.out, s))]
                v["rank"] = _rank_text(min(out_ranks) if out_ranks else None)

            gold[case.id] = {
                "gold_chunks": sorted(
                    {
                        c.chunk_id
                        for h in handles
                        for c in self._store.chunks(h)
                        for s in spans
                        if _contains(c, s)
                    }
                ),
                "ranks": ranks,
                "in_pack": any(c.chunk_id in self._gold_ids[case.id] for c in included),
                "flags": flags,
            }

            grade = grade_by_id.get(case.id)
            if grade is None or grade.passed or not trace.steps:
                continue
            present = set(flags) | set(grade.labels)
            if case.role == "trap":
                present.add("trap.failed")
            if case.expect == "abstain":
                present.discard("cite_missing")
            chosen = next((f for f in _PRIORITY if f in present), None)
            if chosen is None:
                continue
            key = _TEMPLATE_KEY.get(chosen, chosen)
            if chosen == "ret.gold_rank" and gold_rank_block is not None:
                key = (
                    f"ret.gold_rank:{'fusion' if gold_rank_block == 'rerank' else gold_rank_block}"
                )
            if chosen == "stale_doc":
                v["m"] = str(stale_cases)
            if chosen == "cite_unknown":
                v["cite"] = self._unknown_citations(
                    trace.answer.text if trace.answer else "",
                    trace.answer.cited_ids if trace.answer else (),
                    pack["included"] if pack else [],
                )[0]
            if case.trap == "regression":
                v["flag"] = key
                key = "regression"
            v.setdefault("flag", key)
            message = self._message(key, v, trap=case.role == "trap")
            diagnosis.append({"case": case.id, "flag": key, "message_vi": message})

        tokens = sum(t.usage.tokens for t in traces)
        if tokens > self._rules["token_budget"]:
            diagnosis.append(
                {
                    "case": None,
                    "flag": "budget.exceeded",
                    "message_vi": self._message(
                        "budget.exceeded", _budget_vars(traces, tokens, self._rules)
                    ),
                }
            )
        return {"gold": gold, "diagnosis": diagnosis}

    def _message(self, key: str, variables: Mapping[str, str], *, trap: bool = False) -> str:
        """Levels copy only their own §11 lines, so fall back to the nearest template."""
        templates = self._rules["diagnosis"]
        candidates = [key]
        if key.startswith("ret.gold_rank"):  # L2 has only the gold_missing template
            candidates += ["ret.gold_rank", "ret.gold_missing"]
        if trap:  # e.g. L3 has no llm.cite_unknown line but a refusal-trap line
            candidates.append("trap.failed")
        template = next((templates[k] for k in candidates if k in templates), _FALLBACK_TEMPLATE)
        return render(template, variables)


def _culprit(views: Sequence[_NodeView], span: Span) -> tuple[_NodeView, int | None] | None:
    """Which retriever lost a gold quote that never reached the packer. If some
    vector/bm25 node returned it, a fusion/rerank node downstream cut it; otherwise the
    vector/bm25 node that ranked it best (whole corpus) did not pull deep enough."""
    sources = [w for w in views if w.full is not None]
    if any(_rank(w.out, span) for w in sources):
        cut = [w for w in views if w.full is None and _rank(w.out, span) is None]
        # fusion before rerank: report the first stage that lost it
        cut.sort(key=lambda w: w.block != "fusion")
        return (cut[0], None) if cut else None
    ranked = [(w, _rank([h.chunk for h in w.full or ()], span)) for w in sources]
    ranked.sort(key=lambda p: (p[1] is None, p[1] or 0))
    return ranked[0] if ranked else None


def _view_vars(
    view: _NodeView, spans: Sequence[Span], rank: int | None, rerank_ms: int
) -> dict[str, str]:
    """Template variables that depend on one retriever (L3 §11)."""
    if view.block == "vector_search" and view.full is not None:
        head = view.full if rank is None else view.full[: rank - 1]
        above = [h for h in head if not any(_overlaps(h.chunk, s) for s in spans)]
        out = {"rank_dense": _rank_text(rank)}
        for i, hit in enumerate(above[:2], start=1):
            out |= {f"d{i}": str(hit.chunk.dieu), f"s{i}": vi_number(hit.score, 2)}
        return out
    if view.block == "bm25_search":
        return {"rank_bm25": _rank_text(rank)}
    if view.block == "fusion":
        return {"r_fu": _rank_text(rank)}
    if view.block == "rerank":
        return {"r_rr": _rank_text(rank), "ms": vi_number(rerank_ms)}
    return {}


def _budget_vars(traces: Sequence[CaseTrace], tokens: int, rules: LevelRules) -> dict[str, str]:
    packs = [p for t in traces if (p := _pack(t)) is not None]
    n = max(len(packs), 1)
    return {
        "tokens": vi_number(tokens),
        "budget": vi_number(rules["token_budget"]),
        "avg_docs": vi_number(sum(len(p["included"]) for p in packs) / n, 1),
        "avg": vi_number(round(sum(p["tokens"]["docs"] for p in packs) / n)),
        "pct": str(
            round(100 * sum(p["tokens"]["total"] / p["tokens"]["budget"] for p in packs) / n)
        ),
        "ms": vi_number(sum(_step_ms(t, "rerank") for t in traces)),
    }
