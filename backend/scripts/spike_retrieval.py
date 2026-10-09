"""Spike (no LLM): gold-chunk rank per golden case x index variant x retriever.

    uv run python scripts/spike_retrieval.py [--json OUT] [--sizes DIR]

Dense, hybrid and rerank need the built index (``vgame-build-index``) and the cached reranker;
when they are missing only BM25 and the model-free chunk checks run. Never downloads anything
(HF_HUB_OFFLINE=1). Results feed docs/design/engine-spike-report.md.

Rank = 1-based position of the first chunk overlapping a gold quote (grading.py ``_rank``);
"all" = the position by which every gold quote is covered (max over quotes). None = absent.
"""

import argparse
import json
import os
import statistics
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")  # spike must never download models

import numpy as np

from vgame.config import Settings
from vgame.engine.constants import ALL_VARIANTS, count_tokens
from vgame.engine.corpus import Document, find_quote, load_documents
from vgame.engine.index import IndexNotBuiltError, IndexStore, golden_questions
from vgame.engine.retrieval import (
    FastReranker,
    RerankerUnavailableError,
    bm25_search,
    fuse_alpha,
    fuse_rrf,
    rerank,
    vector_search,
)
from vgame.engine.types import Chunk, DocList, IndexHandle, Reranker, Vectors

Span = tuple[str, int, int]


def _rank(chunks: Sequence[Chunk], spans: Sequence[Span], mode: str) -> int | None:
    per = [
        next(
            (i for i, c in enumerate(chunks, 1) if c.doc_id == d and c.start < e and s < c.end),
            None,
        )
        for d, s, e in spans
    ]
    found = [r for r in per if r is not None]
    if mode == "first":
        return min(found) if found else None
    return max(found) if found and len(found) == len(per) else None


def _stale_rank(chunks: Sequence[Chunk]) -> int | None:
    return next((i for i, c in enumerate(chunks, 1) if not c.hieu_luc), None)


def _chunks(docs: DocList) -> list[Chunk]:
    return [h.chunk for h in docs.hits]


class _ConstEmbedder:
    """Artifact-size measurement only: vector values do not change file sizes."""

    model_id = "spike/const-1024"

    def embed_passages(self, texts: Sequence[str]) -> Vectors:
        return np.ones((len(texts), 1024), dtype=np.float32)

    def embed_queries(self, texts: Sequence[str]) -> Vectors:
        return np.ones((len(texts), 1024), dtype=np.float32)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=Path, help="write every rank row to this file")
    parser.add_argument("--sizes", type=Path, help="save a const-vector index here for sizes")
    args = parser.parse_args(argv)
    settings = Settings(_env_file=None)
    documents = load_documents(settings.content_dir)

    if args.sizes:
        t0 = time.perf_counter()
        store = IndexStore.build(
            documents, _ConstEmbedder(), golden_questions(settings.content_dir)
        )
        store.save(args.sizes)
        print(f"const-vector index saved to {args.sizes} in {time.perf_counter() - t0:.1f}s")
        seen: dict[tuple[tuple[str, int, int], ...], str] = {}
        for v in ALL_VARIANTS:
            chunks = store.chunks(IndexHandle(v, frozenset(documents), False))
            layout = tuple((c.doc_id, c.start, c.end) for c in chunks)
            tokens = [c.tokens for c in chunks]
            same = seen.setdefault(layout, v.key)
            print(
                f"{v.key:<18} {len(chunks):>4} chunks avg {statistics.mean(tokens):6.1f} "
                f"max {max(tokens):>4}" + (f"  == {same}" if same != v.key else "")
            )
        for doc in documents.values():
            longest = max(doc.articles, key=lambda a: count_tokens(doc.text[a.start : a.end]))
            n = count_tokens(doc.text[longest.start : longest.end])
            print(f"{doc.doc_id}: {count_tokens(doc.text)} tokens, longest Điều {longest.dieu}={n}")

    try:
        store = IndexStore.load(settings.index_dir)
        dense = True
        print("index:", json.dumps(store.manifest, ensure_ascii=False))
    except IndexNotBuiltError as exc:
        store, dense = IndexStore.build(documents, _ConstEmbedder(), []), False
        print(f"DENSE UNAVAILABLE ({exc}); BM25 + chunk checks only")
    reranker: Reranker | None = None
    if dense:
        try:
            reranker = FastReranker(settings.rerank_model, settings.engine_cache_dir / "models")
        except RerankerUnavailableError as exc:
            print(f"RERANK UNAVAILABLE ({exc})")

    rows: list[dict[str, Any]] = []
    rerank_ms: list[float] = []
    for path in sorted((settings.content_dir / "golden").glob("library-l[0-9]*.json")):
        golden = json.loads(path.read_text(encoding="utf-8"))
        level = path.stem.removeprefix("library-")
        corpus = frozenset(golden["corpus"])
        for variant in ALL_VARIANTS:
            for only_in_force in (False, True) if "qcdt-2019" in corpus else (False,):
                handle = IndexHandle(variant, corpus, only_in_force)
                for case in golden["cases"]:
                    q = case["question"]
                    spans: list[Span] = [
                        (g["doc_id"], *find_quote(documents[g["doc_id"]], g["quote"]))
                        for g in case["gold"]
                    ]
                    all_chunks = store.chunks(handle)
                    row: dict[str, Any] = {
                        "level": level,
                        "case": case["id"],
                        "variant": variant.key,
                        "only_in_force": only_in_force,
                        "quote_whole": all(
                            any(c.doc_id == d and c.start <= s and e <= c.end for c in all_chunks)
                            for d, s, e in spans
                        ),
                        "quotes_together": any(
                            all(c.doc_id == d and c.start <= s and e <= c.end for d, s, e in spans)
                            for c in all_chunks
                        )
                        if spans
                        else None,
                        # top_k=1 can cover every quote only if one chunk touches them all
                        "one_chunk_touches_all": any(
                            all(c.doc_id == d and c.start < e and s < c.end for d, s, e in spans)
                            for c in all_chunks
                        )
                        if spans
                        else None,
                    }
                    bm = bm25_search(store, handle, q, top_k=None)
                    lists: dict[str, list[Chunk]] = {"bm25": _chunks(bm)}
                    if dense:
                        vs = vector_search(store, handle, q, top_k=None)
                        lists["dense"] = _chunks(vs)
                        n = len(all_chunks)
                        lists["rrf_full"] = _chunks(fuse_rrf([vs, bm], k=60, top_k=n))
                        lists["alpha05_full"] = _chunks(fuse_alpha(vs, bm, alpha=0.5, top_k=n))
                        vs5 = vector_search(store, handle, q, top_k=5)
                        bm5 = bm25_search(store, handle, q, top_k=5)
                        rrf10 = fuse_rrf([vs5, bm5], k=60, top_k=10)
                        lists["rrf_5_5_10"] = _chunks(rrf10)
                        lists["alpha08_5_5"] = _chunks(fuse_alpha(vs5, bm5, alpha=0.8, top_k=10))
                        if reranker is not None:
                            t0 = time.perf_counter()
                            lists["rerank_rrf10"] = _chunks(
                                rerank(store, reranker, q, rrf10, top_n=len(rrf10.hits))
                            )
                            rerank_ms.append((time.perf_counter() - t0) * 1000)
                    for name, ranked in lists.items():
                        row[name] = _rank(ranked, spans, "first") if spans else None
                        row[name + "_all"] = _rank(ranked, spans, "all") if spans else None
                        row[name + "_stale"] = _stale_rank(ranked)
                    rows.append(row)

    if rerank_ms:
        # First calls include ONNX warm-up; the cache makes repeats free, so report both.
        print(
            f"rerank ms: n={len(rerank_ms)} median={statistics.median(rerank_ms):.0f} "
            f"max={max(rerank_ms):.0f}"
        )
    _print_claims(rows, documents)
    if args.json:
        args.json.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        print(f"{len(rows)} rows -> {args.json}")
    return 0


def _pick(rows: list[dict[str, Any]], case: str, variant: str, oif: bool = False) -> dict[str, Any]:
    return next(
        r
        for r in rows
        if r["case"] == case and r["variant"] == variant and r["only_in_force"] == oif
    )


def _print_claims(rows: list[dict[str, Any]], documents: dict[str, Document]) -> None:
    cols = [
        "dense",
        "bm25",
        "rrf_full",
        "alpha05_full",
        "rrf_5_5_10",
        "alpha08_5_5",
        "rerank_rrf10",
    ]

    def show(title: str, cases: Sequence[str], variant: str, oif: bool = False) -> None:
        print(f"\n## {title} [{variant}, only_in_force={oif}]")
        for case in cases:
            r = _pick(rows, case, variant, oif)
            cells = [f"{c}={r.get(c, '-')}/{r.get(c + '_all', '-')}" for c in cols if c in r]
            stale = [f"{c}={r[c + '_stale']}" for c in ("dense", "bm25") if r.get(c + "_stale")]
            extra = f" stale1st:{','.join(stale)}" if stale else ""
            print(
                f"{case}: whole={r['quote_whole']} together={r['quotes_together']} "
                f"touch1={r['one_chunk_touches_all']} "
                f"{' '.join(cells)}{extra}"
            )

    show(
        "L1 N5 paraphrase (claim: dense rank >= 2)",
        ["lib-l1-v03", "lib-l1-h04", "lib-l1-h05"],
        "theo_dieu-512-10",
    )
    show(
        "L1 all cases",
        [r["case"] for r in rows if r["level"] == "l1" and r["variant"] == "theo_dieu-512-10"],
        "theo_dieu-512-10",
    )
    l2 = sorted({r["case"] for r in rows if r["level"] == "l2"})
    show("L2 N1 boundary (co_dinh 128/0)", l2, "co_dinh-128-0")
    show("L2 N5 (co_dinh 256/20, only_in_force, top1)", l2, "co_dinh-256-20", True)
    show("L2 N3 stale (theo_dieu 512/10, no filter)", l2, "theo_dieu-512-10")
    show("L2 reference (theo_dieu 512/10, only_in_force)", l2, "theo_dieu-512-10", True)
    l3 = sorted({r["case"] for r in rows if r["level"] == "l3"})
    show("L3 article numbers (theo_dieu 512/10)", l3, "theo_dieu-512-10")
    show("L3 N7 regression (co_dinh 128/0)", ["lib-l3-t02"], "co_dinh-128-0")

    print("\n## Min tokens to hold every gold quote of a case in one chunk (regex-v1)")
    seen: set[str] = set()
    golden_dir = Settings(_env_file=None).content_dir / "golden"
    for path in sorted(golden_dir.glob("library-l[0-9]*.json")):
        for case in json.loads(path.read_text(encoding="utf-8"))["cases"]:
            if not case["gold"] or case["id"] in seen:
                continue
            seen.add(case["id"])
            doc = documents[case["gold"][0]["doc_id"]]
            spans = [find_quote(doc, g["quote"]) for g in case["gold"]]
            lo, hi = min(s for s, _ in spans), max(e for _, e in spans)
            print(
                f"{case['id']}: {count_tokens(doc.text[lo:hi])} tokens, "
                f"{len(spans)} quote(s), dieu {case['gold'][0]['dieu']}"
            )


if __name__ == "__main__":
    raise SystemExit(main())
