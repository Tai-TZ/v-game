"""IndexStore build/save/load, per-handle views (E6, E7), the rerank table, the build CLI and
the shipped artifacts. No real models except in the ``slow`` tests at the end."""

import json
import random
import sys
import tracemalloc
import unicodedata
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from tests.engine.fakes_retrieval import HashingEmbedder, OverlapReranker
from vgame.config import SHIPPED_INDEX_DIR, Settings
from vgame.engine import retrieval
from vgame.engine.chunking import bm25_text, embed_text
from vgame.engine.constants import ALL_VARIANTS, TOKENIZER_ID, IndexVariant
from vgame.engine.corpus import load_documents
from vgame.engine.grading import load_grading_spec, public_cases
from vgame.engine.index import (
    RERANK_TIMING_FALLBACK,
    IndexNotBuiltError,
    IndexStaleError,
    IndexStore,
    RerankScoreMissingError,
    RerankTable,
    build_rerank_table,
    golden_questions,
    main,
    normalise_rows,
    question_key,
    rerank_questions,
    text_key,
)
from vgame.engine.retrieval import FastEmbedder, FastReranker, bm25_search, vector_search
from vgame.engine.types import IndexHandle, Vectors

CONTENT_DIR = Settings(_env_file=None).content_dir
L2_DOCS = frozenset({"qcdt-2024", "qcdt-2019"})
L1_DOCS = frozenset({"qcdt-2024"})
QUESTION = "Em muốn bảo lưu kết quả học tập một học kỳ thì cần làm gì?"  # lib-l1-v01
OTHER = "Điều 47 khoản 2 quy định gì?"


class CountingEmbedder(HashingEmbedder):
    def __init__(self) -> None:
        self.passages = 0

    def embed_passages(self, texts: Sequence[str]) -> Vectors:
        self.passages += len(texts)
        return super().embed_passages(texts)


def _variant(key: str) -> IndexVariant:
    return next(v for v in ALL_VARIANTS if v.key == key)


@pytest.fixture(scope="module")
def built() -> tuple[IndexStore, CountingEmbedder]:
    embedder = CountingEmbedder()
    store = IndexStore.build(load_documents(CONTENT_DIR), embedder, golden_questions(CONTENT_DIR))
    return store, embedder


@pytest.fixture(scope="module")
def store(built: tuple[IndexStore, CountingEmbedder]) -> IndexStore:
    return built[0]


def test_build_embeds_identical_texts_once(built: tuple[IndexStore, CountingEmbedder]) -> None:
    store, embedder = built
    total = sum(len(store.chunks(IndexHandle(v, L2_DOCS, False))) for v in ALL_VARIANTS)
    assert 0 < embedder.passages < total  # theo_dieu 512 and 1024 share every text


def test_manifest_records_models_and_corpus(store: IndexStore) -> None:
    manifest = store.manifest
    assert manifest["embed_model"] == HashingEmbedder.model_id
    assert manifest["tokenizer_id"] == TOKENIZER_ID
    assert manifest["dim"] == 256
    assert len(str(manifest["corpus_sha256"])) == 64
    assert len(manifest["variants"]) == 24  # type: ignore[arg-type]
    assert {"fastembed_version", "built_at"} <= set(manifest)


def test_level_corpus_is_applied_at_the_index_layer(store: IndexStore) -> None:
    variant = _variant("theo_dieu-512-10")
    l1 = store.chunks(IndexHandle(variant, L1_DOCS, False))
    l2 = store.chunks(IndexHandle(variant, L2_DOCS, False))
    l2_in_force = store.chunks(IndexHandle(variant, L2_DOCS, True))
    assert {c.doc_id for c in l1} == {"qcdt-2024"}
    assert {c.doc_id for c in l2} == {"qcdt-2024", "qcdt-2019"}
    assert l2_in_force == tuple(c for c in l2 if c.hieu_luc)
    assert l2_in_force == l1


def test_vectors_follow_the_view_rows(store: IndexStore) -> None:
    handle = IndexHandle(_variant("co_dinh-256-10"), L2_DOCS, True)
    chunks, vectors = store.chunks(handle), store.vectors(handle)
    assert vectors.shape == (len(chunks), 256)
    assert vectors.dtype == np.float32
    expected = HashingEmbedder().embed_passages(
        [embed_text(store.document(c.doc_id), c) for c in chunks]
    )
    np.testing.assert_allclose(vectors, expected, atol=1e-6)


def test_query_vector_is_precomputed_and_nfc_insensitive(store: IndexStore) -> None:
    vector = store.query_vector(QUESTION)
    assert vector.shape == (256,)
    np.testing.assert_array_equal(
        store.query_vector(unicodedata.normalize("NFD", QUESTION)), vector
    )
    with pytest.raises(IndexNotBuiltError):
        store.query_vector("Một câu hỏi chưa từng tính sẵn?")


def test_save_load_round_trip(store: IndexStore, tmp_path: Path) -> None:
    store.save(tmp_path)
    # One shared row per distinct dense text (24 variants, ~2.2k rows, ~950 texts), no
    # per-variant matrices: identical texts embed to identical vectors, so it stays lossless.
    texts = {
        embed_text(store.document(c.doc_id), c)
        for v in ALL_VARIANTS
        for c in store.chunks(IndexHandle(v, L2_DOCS, False))
    }
    keys = json.loads((tmp_path / "passages.json").read_text(encoding="utf-8"))
    assert sorted(keys) == sorted(map(text_key, texts))
    assert np.load(tmp_path / "passages.npy").shape == (len(texts), 256)
    assert sorted(p.name for p in tmp_path.glob("*.npy")) == ["passages.npy", "queries.npy"]
    loaded = IndexStore.load(tmp_path)
    assert loaded.manifest == store.manifest
    assert loaded.document("qcdt-2024") == store.document("qcdt-2024")
    for variant in ALL_VARIANTS:
        handle = IndexHandle(variant, L2_DOCS, False)
        assert loaded.chunks(handle) == store.chunks(handle)
        np.testing.assert_array_equal(loaded.vectors(handle), store.vectors(handle))
    np.testing.assert_array_equal(loaded.query_vector(QUESTION), store.query_vector(QUESTION))
    assert not list(tmp_path.glob("*.pkl"))


def test_load_refuses_missing_or_broken_index(store: IndexStore, tmp_path: Path) -> None:
    with pytest.raises(IndexNotBuiltError) as missing:
        IndexStore.load(tmp_path / "nope")
    assert "vgame-build-index" in missing.value.message_vi

    store.save(tmp_path)
    (tmp_path / "passages.npy").write_bytes(b"not numpy")
    with pytest.raises(IndexNotBuiltError):
        IndexStore.load(tmp_path)

    store.save(tmp_path)  # a chunk whose dense text has no shipped vector
    keys = json.loads((tmp_path / "passages.json").read_text(encoding="utf-8"))
    (tmp_path / "passages.json").write_text(json.dumps(["0" * 64, *keys[1:]]))
    with pytest.raises(IndexNotBuiltError):
        IndexStore.load(tmp_path)

    for change in ({"tokenizer_id": "other"}, {"format": 1}):  # format 1: one .npy per variant
        store.save(tmp_path)
        manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
        (tmp_path / "manifest.json").write_text(json.dumps({**manifest, **change}))
        with pytest.raises(IndexNotBuiltError):
            IndexStore.load(tmp_path)


def test_unbuilt_variant_is_an_index_error(tmp_path: Path) -> None:
    only = IndexStore.build(
        load_documents(CONTENT_DIR), HashingEmbedder(), [QUESTION], [_variant("theo_dieu-512-10")]
    )
    with pytest.raises(IndexNotBuiltError):
        only.chunks(IndexHandle(_variant("co_dinh-128-0"), L1_DOCS, False))


def _cli_settings(tmp_path: Path) -> Settings:
    # index_dir explicit: the default is the shipped index, which a test must never overwrite.
    return Settings(_env_file=None, engine_cache_dir=tmp_path, index_dir=tmp_path / "index")


def test_cli_builds_artifacts_with_injected_models(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = _cli_settings(tmp_path)
    argv = ["--variant", "theo_dieu-512-10"]
    assert (
        main(argv, settings=settings, embedder=HashingEmbedder(), reranker=OverlapReranker()) == 0
    )
    out = capsys.readouterr().out
    assert "theo_dieu-512-10" in out
    assert "chunks" in out
    assert "rerank" in out
    loaded = IndexStore.load(tmp_path / "index")
    assert loaded.manifest["variants"] == ["theo_dieu-512-10"]
    assert loaded.rerank is not None
    assert loaded.rerank.model_id == OverlapReranker.model_id
    scored = int(np.count_nonzero(~np.isnan(loaded.rerank.scores)))
    assert loaded.rerank.timing["pairs"] == scored  # this build timed its own scoring
    content = settings.content_dir
    loaded.check_fresh(
        load_documents(content), golden_questions(content), rerank_questions(content)
    )
    assert not (tmp_path / "models").exists()  # no model download with injected models


def test_cli_without_the_models_group_says_how_to_install_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setitem(sys.modules, "fastembed", None)  # as after `uv sync --no-dev` on Render
    assert main([], settings=_cli_settings(tmp_path)) == 1
    assert "uv sync" in capsys.readouterr().err
    assert not (tmp_path / "index").exists()


def test_cli_fails_cleanly_without_content(tmp_path: Path) -> None:
    settings = _cli_settings(tmp_path).model_copy(update={"content_dir": tmp_path})
    assert main([], settings=settings, embedder=HashingEmbedder(), reranker=OverlapReranker()) == 1


def test_check_fresh_refuses_an_index_built_from_other_content(store: IndexStore) -> None:
    documents = load_documents(CONTENT_DIR)
    questions = golden_questions(CONTENT_DIR)
    store.check_fresh(documents, questions)  # built from this checkout: fresh

    edited = dict(documents)
    old = edited["qcdt-2024"]
    edited["qcdt-2024"] = replace(old, text=old.text.replace("Điều 12", "Điều 12 (sửa)", 1))
    with pytest.raises(IndexStaleError) as corpus:
        store.check_fresh(edited, questions)
    assert "vgame-build-index" in corpus.value.message_vi

    with pytest.raises(IndexStaleError):  # a golden question rewritten after the build
        store.check_fresh(documents, [*questions, "Khoản 2 Điều 10 ghi gì vậy?"])


class CountingQueries(CountingEmbedder):
    def __init__(self, model_id: str = HashingEmbedder.model_id) -> None:
        super().__init__()
        self.model_id = model_id
        self.queries: list[str] = []

    def embed_queries(self, texts: Sequence[str]) -> Vectors:
        self.queries += texts
        return super().embed_queries(texts)


def test_rebuild_embeds_only_texts_the_old_index_lacks(tmp_path: Path) -> None:
    # Rewriting 2 golden questions cost 33 min of e5-large over 952 unchanged passages.
    documents = load_documents(CONTENT_DIR)
    questions = golden_questions(CONTENT_DIR)
    variants = [_variant("theo_dieu-512-10")]
    old = IndexStore.build(documents, HashingEmbedder(), questions, variants)

    again = CountingQueries()
    new = IndexStore.build(documents, again, [*questions, "Câu mới?"], variants, reuse=old)
    assert (again.passages, again.queries) == (0, ["Câu mới?"])
    handle = IndexHandle(variants[0], L1_DOCS, False)
    assert np.array_equal(new.vectors(handle), old.vectors(handle))
    assert np.array_equal(new.query_vector(QUESTION), old.query_vector(QUESTION))

    other = CountingQueries("test/another-model")  # vectors of another model are not reused
    IndexStore.build(documents, other, questions, variants, reuse=old)
    assert other.passages > 0
    assert len(other.queries) == len(set(questions))


class CountingReranker(OverlapReranker):
    def __init__(self, model_id: str = OverlapReranker.model_id) -> None:
        super().__init__()
        self.model_id = model_id
        self.batches: list[list[str]] = []

    def score(self, query: str, texts: Sequence[str]) -> list[float]:
        self.batches.append(list(texts))
        return super().score(query, texts)


def test_cli_rebuild_reuses_the_index_on_disk(tmp_path: Path) -> None:
    settings = _cli_settings(tmp_path)
    argv = ["--variant", "theo_dieu-512-10"]
    assert (
        main(argv, settings=settings, embedder=HashingEmbedder(), reranker=OverlapReranker()) == 0
    )
    again, scorer = CountingQueries(), CountingReranker()
    assert main(argv, settings=settings, embedder=again, reranker=scorer) == 0
    assert (again.passages, again.queries, scorer.batches) == (0, [], [])


def test_cli_variant_build_adds_to_the_index_on_disk(tmp_path: Path) -> None:
    # INDEX_DIR defaults to the shipped index: `--variant X` used to rewrite it with X alone
    # (manifest, passages and rerank table shrank), losing the reuse source of a full build.
    settings = _cli_settings(tmp_path)
    keys = ("theo_dieu-512-10", "co_dinh-256-0")
    for key in keys:
        embedder, reranker = HashingEmbedder(), OverlapReranker()
        assert (
            main(["--variant", key], settings=settings, embedder=embedder, reranker=reranker) == 0
        )
    loaded = IndexStore.load(tmp_path / "index")
    assert loaded.manifest["variants"] == [v.key for v in ALL_VARIANTS if v.key in keys]
    content = settings.content_dir
    loaded.check_fresh(  # the rerank table covers both variants
        load_documents(content), golden_questions(content), rerank_questions(content)
    )


# --- Rerank table (engine-v0.2.md §14, 2026-10-08: no ML model on the server) ---------------


@pytest.fixture(scope="module")
def one_variant() -> IndexStore:
    return IndexStore.build(
        load_documents(CONTENT_DIR),
        HashingEmbedder(),
        [QUESTION, OTHER],
        [_variant("theo_dieu-512-10")],
    )


def _texts(store: IndexStore, docs: frozenset[str]) -> list[str]:
    chunks = store.chunks(IndexHandle(_variant("theo_dieu-512-10"), docs, False))
    return [bm25_text(store.document(c.doc_id), c) for c in chunks]


def _quiet(_line: str) -> None:
    return None


def test_rerank_table_returns_stored_scores_and_refuses_unknown_pairs() -> None:
    scores = np.array([[0.5, np.nan]], dtype=np.float32)
    table = RerankTable("m", [question_key(QUESTION)], [text_key("a"), text_key("b")], scores)
    assert table.model_id == "m"
    assert table.score(unicodedata.normalize("NFD", QUESTION), ["a", "a"]) == [0.5, 0.5]
    assert table.get(QUESTION, "b") is None  # NaN: a pair no level can rerank
    for question, texts in ((QUESTION, ["a", "b"]), (QUESTION, ["c"]), (OTHER, ["a"])):
        with pytest.raises(RerankScoreMissingError) as exc:
            table.score(question, texts)
        assert exc.value.step_status == "index_error"  # the run fails as index_stale
        assert "vgame-build-index" in exc.value.message_vi
        assert question not in str(exc.value)  # logs never carry a hidden question
    with pytest.raises(ValueError, match="scores"):
        RerankTable("m", ["q"], ["t"], np.zeros((2, 1), dtype=np.float32))


def test_build_rerank_table_scores_only_new_pairs(one_variant: IndexStore) -> None:
    l1, l2 = _texts(one_variant, L1_DOCS), _texts(one_variant, L2_DOCS)
    first = CountingReranker()
    table = build_rerank_table(one_variant, first, {QUESTION: L1_DOCS}, log=_quiet)
    # One call per question with every text of its corpus, short texts first (less padding).
    assert first.batches == [sorted(set(l1), key=lambda t: (len(t), t))]
    assert table.score(QUESTION, l1) == OverlapReranker().score(QUESTION, l1)
    assert table.get(QUESTION, next(t for t in l2 if t not in l1)) is None  # 2019: not L1

    again = CountingReranker()
    wider = {QUESTION: L2_DOCS, OTHER: L1_DOCS}
    rebuilt = build_rerank_table(one_variant, again, wider, reuse=table, log=_quiet)
    assert sorted(map(len, again.batches)) == sorted([len(set(l2) - set(l1)), len(set(l1))])
    assert rebuilt.score(QUESTION, l2) == OverlapReranker().score(QUESTION, l2)
    assert rebuilt.score(OTHER, l1) == OverlapReranker().score(OTHER, l1)

    other = CountingReranker("test/another-model")  # scores of another model are not reused
    build_rerank_table(one_variant, other, {QUESTION: L1_DOCS}, reuse=table, log=_quiet)
    assert len(other.batches[0]) == len(set(l1))


def test_rerank_table_keeps_the_scoring_time_per_pair(one_variant: IndexStore) -> None:
    # §14 (2026-10-09): rerank steps over the table report this x the candidates they score.
    empty = RerankTable("m", [], [], np.zeros((0, 0), dtype=np.float32))
    assert empty.timing == RERANK_TIMING_FALLBACK  # a table saved before the timing existed
    assert empty.ms_per_pair == RERANK_TIMING_FALLBACK["ms_per_pair"]
    table = build_rerank_table(one_variant, OverlapReranker(), {QUESTION: L1_DOCS}, log=_quiet)
    assert table.timing["pairs"] == len(set(_texts(one_variant, L1_DOCS)))
    again = build_rerank_table(
        one_variant, CountingReranker(), {QUESTION: L1_DOCS}, reuse=table, log=_quiet
    )
    assert again.timing == table.timing  # nothing scored: the measured value stays


def test_rerank_scores_of_other_scoring_settings_are_not_reused(
    one_variant: IndexStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    # rerank.json kept only the model id: after a RERANK_MAX_TOKENS (or fastembed/onnxruntime)
    # change, a rebuild kept every old score and scored only new pairs the new way.
    table = build_rerank_table(one_variant, OverlapReranker(), {QUESTION: L1_DOCS}, log=_quiet)
    assert table.regime["max_tokens"] == retrieval.RERANK_MAX_TOKENS
    monkeypatch.setattr(retrieval, "RERANK_MAX_TOKENS", retrieval.RERANK_MAX_TOKENS // 2)
    again = CountingReranker()
    rebuilt = build_rerank_table(one_variant, again, {QUESTION: L1_DOCS}, reuse=table, log=_quiet)
    assert len(again.batches[0]) == len(set(_texts(one_variant, L1_DOCS)))
    assert rebuilt.regime["max_tokens"] == retrieval.RERANK_MAX_TOKENS


def test_check_fresh_flags_a_rerank_table_missing_a_pair(one_variant: IndexStore) -> None:
    documents = load_documents(CONTENT_DIR)
    store = IndexStore.build(
        documents, HashingEmbedder(), [QUESTION], [_variant("theo_dieu-512-10")], reuse=one_variant
    )
    store.rerank = build_rerank_table(store, OverlapReranker(), {QUESTION: L1_DOCS}, log=_quiet)
    store.check_fresh(documents, [QUESTION], {QUESTION: L1_DOCS})
    for wider in ({QUESTION: L2_DOCS}, {QUESTION: L1_DOCS, OTHER: L1_DOCS}):
        with pytest.raises(IndexStaleError, match="rerank"):
            store.check_fresh(documents, [QUESTION], wider)
    store.rerank = None
    with pytest.raises(IndexStaleError, match="rerank"):
        store.check_fresh(documents, [QUESTION], {QUESTION: L1_DOCS})
    store.check_fresh(documents, [QUESTION])  # no level reranks: no table needed


def test_save_load_keeps_the_rerank_table(one_variant: IndexStore, tmp_path: Path) -> None:
    store = IndexStore.build(
        load_documents(CONTENT_DIR),
        HashingEmbedder(),
        [QUESTION, OTHER],
        [_variant("theo_dieu-512-10")],
        reuse=one_variant,
    )
    table = build_rerank_table(store, OverlapReranker(), {QUESTION: L1_DOCS}, log=_quiet)
    store.rerank = table
    store.save(tmp_path)
    loaded = IndexStore.load(tmp_path)
    assert loaded.rerank is not None
    assert loaded.rerank.model_id == table.model_id
    assert loaded.rerank.regime == table.regime  # the next build's reuse check reads it
    assert loaded.rerank.timing == table.timing
    l1 = _texts(store, L1_DOCS)
    assert loaded.rerank.score(QUESTION, l1) == table.score(QUESTION, l1)
    meta_path = tmp_path / "rerank.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    for bad in ({"source": "x"}, {"ms_per_pair": "nan"}, {"ms_per_pair": 0}, {"ms_per_pair": -1}):
        # A broken timing failed every L3 rerank step as run.failed{internal}, not at startup.
        meta_path.write_text(json.dumps({**meta, "timing": bad}), encoding="utf-8")
        with pytest.raises(IndexNotBuiltError):
            IndexStore.load(tmp_path)
    store.rerank = None  # saving without a table removes the old one
    store.save(tmp_path)
    assert IndexStore.load(tmp_path).rerank is None


def test_rerank_questions_cover_only_the_levels_that_allow_rerank() -> None:
    questions = rerank_questions(CONTENT_DIR)
    l3 = load_grading_spec(CONTENT_DIR, "article-number-lookup")
    assert set(questions) == {unicodedata.normalize("NFC", c.question) for c in public_cases(l3)}
    assert set(questions.values()) == {frozenset({"qcdt-2024"})}  # L1/L2 cannot rerank
    review = {c.question for c in l3.cases if c.role == "review"}
    assert review
    assert not review & set(questions)  # review cases never run


# --- Shipped artifacts (backend/src/vgame/engine/data) ---------------------------------------


def test_shipped_index_is_fresh_and_complete() -> None:
    """Fails after a corpus, golden question or level edit until `vgame-build-index` is rerun and
    its output committed; the server would otherwise answer 503 index_stale."""
    shipped = IndexStore.load(SHIPPED_INDEX_DIR)
    shipped.check_fresh(
        load_documents(CONTENT_DIR), golden_questions(CONTENT_DIR), rerank_questions(CONTENT_DIR)
    )
    settings = Settings(_env_file=None)
    manifest = shipped.manifest
    assert manifest["variants"] == [v.key for v in ALL_VARIANTS]
    assert (manifest["embed_model"], manifest["dim"]) == (settings.embed_model, 1024)
    assert shipped.rerank is not None
    assert shipped.rerank.model_id == settings.rerank_model
    assert shipped.rerank.regime["max_tokens"] == retrieval.RERANK_MAX_TOKENS
    data = SHIPPED_INDEX_DIR.parent
    assert sum(p.stat().st_size for p in data.rglob("*") if p.is_file()) < 10_000_000


def test_every_handle_a_server_can_reach_keeps_memory_bounded() -> None:
    # 24 variants x 2 corpora x only_in_force = 96 handles. Each kept a copy of its vectors and
    # its BM25 model for good: ~90 MB more traced (~130 MB private) after all 96, never freed.
    shipped = IndexStore.load(SHIPPED_INDEX_DIR)
    handles = [
        IndexHandle(v, docs, in_force)
        for v in ALL_VARIANTS
        for docs in (L1_DOCS, L2_DOCS)
        for in_force in (False, True)
    ]
    tracemalloc.start()
    try:
        for handle in handles:
            assert vector_search(shipped, handle, OTHER, top_k=5).hits
            assert bm25_search(shipped, handle, OTHER, top_k=5).hits
        grown, _ = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    assert grown < 15_000_000


# --- Real models (slow; model files in ENGINE_CACHE_DIR/models) ------------------------------


@pytest.mark.slow
def test_shipped_vectors_equal_the_live_model() -> None:
    """The shipped float32 rows are exactly what e5 returns (no lossy compression): every
    question, and 30 of the 952 distinct passages of the 24 variants (a fixed random sample
    plus the 5 longest, cut at e5's 512 tokens)."""
    settings = Settings(_env_file=None)
    shipped = IndexStore.load(SHIPPED_INDEX_DIR)
    embedder = FastEmbedder(settings.embed_model, settings.engine_cache_dir / "models")
    questions = list(
        dict.fromkeys(unicodedata.normalize("NFC", q) for q in golden_questions(CONTENT_DIR))
    )
    live = normalise_rows(embedder.embed_queries(questions))  # as IndexStore.build does
    assert np.array_equal(live, np.stack([shipped.query_vector(q) for q in questions]))
    where: dict[str, tuple[IndexHandle, int]] = {}  # dense text -> a handle and row holding it
    for variant in ALL_VARIANTS:
        handle = IndexHandle(variant, L2_DOCS, False)
        for row, chunk in enumerate(shipped.chunks(handle)):
            where.setdefault(embed_text(shipped.document(chunk.doc_id), chunk), (handle, row))
    texts = sorted(where)
    sample = random.Random(0).sample(texts, 25)  # noqa: S311  # a fixed sample, not a secret
    picked = list(dict.fromkeys([*sample, *sorted(texts, key=len)[-5:]]))
    live = normalise_rows(embedder.embed_passages(picked))
    rows = [shipped.vectors(where[t][0])[where[t][1]] for t in picked]
    assert np.array_equal(live, np.stack(rows))


@pytest.mark.slow
def test_shipped_rerank_scores_equal_the_live_model() -> None:
    """Bit-equal to live jina, per L3 question, for every candidate a legal graph reranks on
    8 variants (each size, both strategies, every overlap: vector top 5 + BM25 top 10) and 15
    random passages of the rest of the level corpus. Equal scores give equal orders: rerank
    breaks ties by chunk order either way."""
    settings = Settings(_env_file=None)
    shipped = IndexStore.load(SHIPPED_INDEX_DIR)
    table = shipped.rerank
    assert table is not None
    live = FastReranker(settings.rerank_model, settings.engine_cache_dir / "models")
    keys = (
        "co_dinh-128-0",
        "co_dinh-256-10",
        "co_dinh-512-20",
        "co_dinh-1024-0",
        "theo_dieu-128-10",
        "theo_dieu-256-20",
        "theo_dieu-512-0",
        "theo_dieu-1024-10",
    )
    rng = random.Random(0)  # noqa: S311  # a fixed sample, not a secret
    for question, docs in rerank_questions(CONTENT_DIR).items():
        texts: dict[str, None] = {}
        for key in keys:
            handle = IndexHandle(_variant(key), docs, False)
            for found in (
                vector_search(shipped, handle, question, top_k=5),
                bm25_search(shipped, handle, question, top_k=10),
            ):
                texts |= dict.fromkeys(
                    bm25_text(shipped.document(h.chunk.doc_id), h.chunk) for h in found.hits
                )
        pool = {
            bm25_text(shipped.document(c.doc_id), c)
            for v in ALL_VARIANTS
            for c in shipped.chunks(IndexHandle(v, docs, False))
        }
        batch = [*texts, *rng.sample(sorted(pool - texts.keys()), 15)]
        assert table.score(question, batch) == live.score(question, batch)
