"""Static visualisation data (roadmap-v0.4 N21 for N22/B6).

``vgame-export-static-viz`` runs the engine's own chunker and vector search over the shipped
index and writes ``frontend/public/viz/<level>.json``: the real chunk boundaries of every index
variant, and where each of the level's three sample questions lands in each of them. No AI call
and no key read -- chunking is deterministic and the question vectors are already in the index.

It is what lets L2 draw the chunk strip of an article with the variant's true cuts (N22) before
any run has happened, and while the API is asleep.

**The one rule.** Only the sample questions are ranked. A hidden or trap question's ranks would
be a score for a case the player is not allowed to see, and a static file is forever: the gate
in ``tests/engine/test_static_viz.py`` greps the whole serialised file for their ids rather
than trusting the shape this module writes.

Chunk text is not repeated per variant. Every chunk is a pair of offsets into ``corpus``, which
holds each document once -- 24 variants of the same corpus would otherwise be 24 copies of it.
"""

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any, Final

from vgame.config import SHIPPED_INDEX_DIR, Settings
from vgame.engine.chunking import chunk_document
from vgame.engine.constants import ALL_VARIANTS
from vgame.engine.corpus import load_documents
from vgame.engine.grading import load_grading_spec, public_cases
from vgame.engine.index import IndexStore, golden_questions, rerank_questions
from vgame.engine.levels import load_level
from vgame.engine.retrieval import vector_search
from vgame.engine.types import IndexHandle

LEVEL_IDS: Final = ("grounded-citation", "chunk-tuning", "article-number-lookup")
OUT_DIR: Final = Path(__file__).resolve().parents[4] / "frontend" / "public" / "viz"

#: Per file, uncompressed. The three levels land at 197-217 kB today (28-30 kB over the wire,
#: gzipped by the host); the cap is a guard against an export that starts repeating chunk text
#: per variant or ranking something it should not, so it sits well above today, not on it.
BYTE_CAP: Final = 320_000

#: Ranks kept per sample question. The spotlight shows what the pack could hold, and the
#: largest top_k any level offers is 10 (level param_limits).
TOP_K: Final = 10


def viz_level(level_id: str, store: IndexStore, content_dir: Path) -> dict[str, Any]:
    """The static visualisation data of one level, as the committed file holds it."""
    level = load_level(level_id)
    docs = load_documents(content_dir)
    corpus = {doc_id: docs[doc_id].text for doc_id in level.corpus}
    samples = [
        c for c in public_cases(load_grading_spec(content_dir, level_id)) if c.role == "visible"
    ]

    strips: dict[str, list[list[Any]]] = {}
    ranks: dict[str, dict[str, list[list[Any]]]] = {}
    for variant in ALL_VARIANTS:
        strips[variant.key] = [
            [c.doc_id, c.dieu, list(c.khoan), c.start, c.end, c.tokens, c.hieu_luc]
            for doc_id in level.corpus
            for c in chunk_document(docs[doc_id], variant)
        ]
        # only_in_force False: the strip is the corpus as the blade cut it, and the Kính lọc
        # is a separate knob the player turns. Filtering here would hide what it does.
        handle = IndexHandle(variant=variant, docs=frozenset(level.corpus), only_in_force=False)
        ranks[variant.key] = {
            case.id: [
                [hit.chunk.doc_id, hit.chunk.start, hit.chunk.end, round(hit.score, 4)]
                for hit in vector_search(store, handle, case.question, top_k=TOP_K).hits
            ]
            for case in samples
        }

    return {
        "format": 1,
        "level": level_id,
        "level_version": level.version,
        "corpus_sha256": store.manifest["corpus_sha256"],
        "corpus": corpus,
        # A chunk's `dieu` is the article its FIRST token sits in, so a fixed-size cut running
        # from Điều 11 into Điều 12 is filed under 11 -- which is exactly the lesson L2 teaches.
        # "The strip of Điều 12" is therefore every chunk overlapping its range, and only these
        # ranges can answer that; the chunk list alone cannot.
        "articles": {
            doc_id: [[a.dieu, a.start, a.end] for a in docs[doc_id].articles]
            for doc_id in level.corpus
        },
        "strips": strips,
        "ranks": ranks,
    }


def main(argv: Sequence[str] | None = None) -> int:
    """``vgame-export-static-viz``: one file per Library level into ``--out``."""
    parser = argparse.ArgumentParser(
        prog="vgame-export-static-viz",
        description="Export the per-variant chunk strips and sample ranks of every level.",
    )
    parser.add_argument("--out", type=Path, default=OUT_DIR, help=f"default: {OUT_DIR}")
    args = parser.parse_args(argv)

    content = Settings(_env_file=None).content_dir
    store = IndexStore.load(SHIPPED_INDEX_DIR)
    store.check_fresh(load_documents(content), golden_questions(content), rerank_questions(content))
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)
    for level_id in LEVEL_IDS:
        body = json.dumps(viz_level(level_id, store, content), ensure_ascii=False)
        if len(body.encode()) > BYTE_CAP:
            print(
                f"{level_id}: {len(body.encode())} bytes over the {BYTE_CAP} cap", file=sys.stderr
            )
            return 1
        (out / f"{level_id}.json").write_text(body, encoding="utf-8")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
