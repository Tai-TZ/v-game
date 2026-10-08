"""Retrievers, fusion, rerank and summaries. BM25 traps run on the real corpus (deterministic)."""

from pathlib import Path

import numpy as np
import pytest

from tests.engine.fakes_retrieval import HashingEmbedder, OverlapReranker
from vgame.config import Settings
from vgame.engine.constants import ALL_VARIANTS, SUMMARY_MAX_CHARS, IndexVariant
from vgame.engine.corpus import find_quote, load_documents
from vgame.engine.index import IndexStore, golden_questions, question_key
from vgame.engine.retrieval import (
    FastEmbedder,
    FastReranker,
    RerankerUnavailableError,
    bm25_search,
    bm25_tokens,
    fuse_alpha,
    fuse_rrf,
    rerank,
    retrieved_fact,
    summarize_docs,
    vector_search,
    vi_number,
)
from vgame.engine.types import Chunk, DocHit, DocList, IndexHandle

CONTENT_DIR = Settings(_env_file=None).content_dir
L1_DOCS = frozenset({"qcdt-2024"})
L2_DOCS = frozenset({"qcdt-2024", "qcdt-2019"})
T01 = "Em tính nghỉ ở nhà một thời gian để đi làm kiếm tiền, sau này quay lại thì có được không ạ?"
V01_L3 = "Điều 47 khoản 2 quy định gì?"


def _variant(key: str) -> IndexVariant:
    return next(v for v in ALL_VARIANTS if v.key == key)


def _chunk(cid: str, dieu: int = 1, text: str = "") -> Chunk:
    return Chunk(cid, "d", dieu, (), True, text or cid, 1, 0, 1)


def _docs(origin: str, *pairs: tuple[str, float]) -> DocList:
    return DocList(origin, tuple(DocHit(_chunk(cid), score) for cid, score in pairs))  # type: ignore[arg-type]


def _ids(docs: DocList) -> list[str]:
    return [h.chunk.chunk_id for h in docs.hits]


@pytest.fixture(scope="module")
def store() -> IndexStore:
    return IndexStore.build(
        load_documents(CONTENT_DIR), HashingEmbedder(), golden_questions(CONTENT_DIR)
    )


@pytest.fixture
def tiny() -> tuple[IndexStore, IndexHandle]:
    """Three hand-made chunks; the second and third tie for the query."""
    variant = _variant("theo_dieu-512-10")
    chunks = (_chunk("c1"), _chunk("c2"), _chunk("c3"))
    vectors = np.array([[1, 0], [0.6, 0.8], [0.6, 0.8]], dtype=np.float32)
    query = np.array([[0.6, 0.8]], dtype=np.float32)
    built = IndexStore(
        {}, {variant.key: chunks}, {variant.key: vectors}, {question_key("q"): 0}, query, {}
    )
    return built, IndexHandle(variant, frozenset({"d"}), False)


def test_bm25_tokens_keep_digits_and_accents() -> None:
    assert bm25_tokens("Điều 47, KHOẢN 2: nghỉ_học 0,5") == [
        "điều",
        "47",
        "khoản",
        "2",
        "nghỉ_học",
        "0",
        "5",
    ]
    assert bm25_tokens("nghỉ") != bm25_tokens("nghị")


def test_vector_search_ranks_by_cosine_with_stable_ties(
    tiny: tuple[IndexStore, IndexHandle],
) -> None:
    built, handle = tiny
    ranked = vector_search(built, handle, "q", top_k=None)
    assert ranked.origin == "vector_search"
    assert _ids(ranked) == ["c2", "c3", "c1"]
    assert [round(h.score, 4) for h in ranked.hits] == [1.0, 1.0, 0.6]
    assert _ids(vector_search(built, handle, "q", top_k=1)) == ["c2"]
    assert _ids(vector_search(built, handle, "q", top_k=5, score_threshold=0.9)) == ["c2", "c3"]
    assert vector_search(built, handle, "q", top_k=5, score_threshold=1.01).hits == ()


def test_vector_search_on_real_index_covers_the_handle(store: IndexStore) -> None:
    handle = IndexHandle(_variant("theo_dieu-512-10"), L2_DOCS, True)
    ranked = vector_search(store, handle, V01_L3, top_k=None)
    assert len(ranked.hits) == len(store.chunks(handle))
    assert all(h.chunk.hieu_luc for h in ranked.hits)
    scores = [h.score for h in ranked.hits]
    assert scores == sorted(scores, reverse=True)


def _gold_ranks(docs: DocList, start: int, end: int) -> list[int]:
    return [i for i, h in enumerate(docs.hits, 1) if h.chunk.start < end and start < h.chunk.end]


@pytest.mark.parametrize(
    "variant",
    [v for v in ALL_VARIANTS if v.strategy == "theo_dieu" or v.chunk_size <= 256],
    ids=lambda v: v.key,
)
def test_bm25_misses_the_paraphrase_trap_lib_l3_t01(
    store: IndexStore, variant: IndexVariant
) -> None:
    # Article 12 shares no content syllable with the question (corpus README §3). co_dinh 512/1024
    # windows are excluded: they also hold unrelated articles that do share words.
    doc = store.document("qcdt-2024")
    start, end = find_quote(
        doc, "được bảo lưu kết quả học tập để gián đoạn việc học tối đa hai học kỳ"
    )
    top10 = bm25_search(store, IndexHandle(variant, L1_DOCS, False), T01, top_k=10)
    assert not _gold_ranks(top10, start, end)


def test_bm25_finds_article_47_clause_2_by_number(store: IndexStore) -> None:
    top3 = bm25_search(
        store, IndexHandle(_variant("theo_dieu-512-10"), L1_DOCS, False), V01_L3, top_k=3
    )
    assert top3.origin == "bm25_search"
    assert any(h.chunk.dieu == 47 and 2 in h.chunk.khoan for h in top3.hits)
    assert all(h.score > 0 for h in top3.hits)


def test_bm25_finds_mid_article_chunk_through_the_heading(store: IndexStore) -> None:
    # co_dinh 128/0: a chunk inside Article 47 whose own text lacks "Điều 47" still matches.
    handle = IndexHandle(_variant("co_dinh-128-0"), L1_DOCS, False)
    top5 = bm25_search(store, handle, V01_L3, top_k=5)
    assert any(h.chunk.dieu == 47 and "Điều 47" not in h.chunk.text for h in top5.hits)


def test_only_in_force_hides_the_2019_text_from_bm25_too(store: IndexStore) -> None:
    question = "nghe noi dat giai olympic sinh vien thi duoc cong diem vao mon lien quan"
    variant = _variant("theo_dieu-512-10")
    unfiltered = bm25_search(
        store, IndexHandle(variant, L2_DOCS, False), question + " Olympic", top_k=10
    )
    assert any(not h.chunk.hieu_luc for h in unfiltered.hits)
    filtered = bm25_search(
        store, IndexHandle(variant, L2_DOCS, True), question + " Olympic", top_k=None
    )
    assert all(h.chunk.hieu_luc for h in filtered.hits)


def test_bm25_drops_zero_scores(store: IndexStore) -> None:
    handle = IndexHandle(_variant("theo_dieu-512-10"), L1_DOCS, False)
    assert bm25_search(store, handle, "zzzz qqqq", top_k=None).hits == ()


def test_rrf_sums_reciprocal_ranks_and_breaks_ties_by_id() -> None:
    a = _docs("vector_search", ("x", 0.9), ("y", 0.8), ("z", 0.7))
    b = _docs("bm25_search", ("z", 9.0), ("w", 3.0))
    fused = fuse_rrf([a, b], k=1, top_k=10)
    assert fused.origin == "fusion"
    expected = {"x": 1 / 2, "y": 1 / 3, "z": 1 / 4 + 1 / 2, "w": 1 / 3}
    assert _ids(fused) == ["z", "x", "w", "y"]  # w and y tie at 1/3: id order
    assert {h.chunk.chunk_id: h.score for h in fused.hits} == pytest.approx(expected)
    assert _ids(fuse_rrf([a, b], k=1, top_k=2)) == ["z", "x"]


def test_alpha_fusion_min_max_normalises_each_list() -> None:
    vec = _docs("vector_search", ("x", 0.9), ("y", 0.5))
    bm = _docs("bm25_search", ("y", 10.0), ("z", 4.0), ("w", 6.0))
    fused = fuse_alpha(vec, bm, alpha=0.5, top_k=10)
    scores = {h.chunk.chunk_id: h.score for h in fused.hits}
    assert scores == pytest.approx({"x": 0.5, "y": 0.5, "w": 1 / 6, "z": 0.0})
    assert _ids(fused) == ["x", "y", "w", "z"]
    single = fuse_alpha(
        _docs("vector_search", ("x", 0.2)), _docs("bm25_search"), alpha=0.8, top_k=1
    )
    assert single.hits[0].score == pytest.approx(0.8)  # one-item list normalises to 1.0


def test_rerank_scores_headings_so_a_mid_article_chunk_wins_a_number_lookup(
    store: IndexStore,
) -> None:
    """The cross-encoder sees "Điều N. Tiêu đề" + text: the Điều 47 k2 chunk has no "47" in its
    own text and used to lose to the chunk carrying the "Điều 4." heading (L3 N8)."""
    handle = IndexHandle(_variant("co_dinh-128-0"), frozenset({"qcdt-2024"}), True)
    chunks = store.chunks(handle)
    head = next(c for c in chunks if "Điều 4. " in c.text)
    mid = next(c for c in chunks if c.dieu == 47 and 2 in c.khoan and "47" not in c.text)
    reranker = OverlapReranker()
    docs = DocList("fusion", (DocHit(head, 0.0), DocHit(mid, 0.0)))
    out = rerank(store, reranker, V01_L3, docs, top_n=2)
    assert out.origin == "rerank"
    assert [h.chunk.chunk_id for h in out.hits] == [mid.chunk_id, head.chunk_id]
    assert _ids(rerank(store, reranker, V01_L3, docs, top_n=1)) == [mid.chunk_id]
    assert reranker.calls == 1  # second call served from the score cache


def test_fact_and_summaries_are_short_and_vietnamese() -> None:
    hits = tuple(DocHit(_chunk(f"c{i}", dieu=10 + i), 0.834 - i / 100) for i in range(30))
    vec = DocList("vector_search", hits)
    fact = retrieved_fact(vec)
    assert fact["kind"] == "retrieved"
    assert fact["items"][0] == {
        "chunk_id": "c0",
        "rank": 1,
        "score": 0.834,
        "doc_id": "d",
        "dieu": 10,
        "khoan": [],
        "hieu_luc": True,
    }
    text = summarize_docs(vec)
    assert text.startswith("Lấy 30 đoạn: Điều 10 (0,83), Điều 11 (0,82)")
    assert text.endswith("…")
    assert len(text) <= SUMMARY_MAX_CHARS
    assert summarize_docs(DocList("bm25_search", hits[:1])) == "Lấy 1 đoạn: Điều 10 (0,8)"
    assert (
        summarize_docs(DocList("fusion", hits[:2]), n_in=2)
        == "Gộp 2 danh sách (RRF) còn 2 đoạn: Điều 10, Điều 11"
    )
    assert summarize_docs(DocList("rerank", hits[:1]), n_in=10).startswith(
        "Xếp lại 10 đoạn, giữ 1: Điều 10 (0,83)"
    )
    assert summarize_docs(DocList("vector_search", ())) == "Không lấy được đoạn nào."
    assert vi_number(1420) == "1.420"
    assert vi_number(12.44, 1) == "12,4"


def test_missing_reranker_model_is_a_vietnamese_error(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")  # belt and braces: never touch the network
    with pytest.raises(RerankerUnavailableError) as exc:
        FastReranker("jinaai/jina-reranker-v2-base-multilingual", tmp_path, local_files_only=True)
    assert "Xếp hạng lại" in exc.value.message_vi


class _RecordingModel:
    """Stands in for the fastembed models; records the batch size each call asks for."""

    def __init__(self) -> None:
        self.batch_sizes: list[int] = []

    def embed(self, texts: list[str], batch_size: int = 256, **_: object) -> list[list[float]]:
        self.batch_sizes.append(batch_size)
        return [[1.0, 0.0] for _ in texts]

    def rerank(self, _q: str, texts: list[str], batch_size: int = 64, **_: object) -> list[float]:
        self.batch_sizes.append(batch_size)
        return [0.0 for _ in texts]


def test_real_models_run_in_small_batches() -> None:
    """fastembed's default batches (256 passages of up to 512 tokens through e5-large) held
    ~16 GB of RAM while vgame-build-index ran; small batches keep it to a few GB."""
    model = _RecordingModel()
    embedder = object.__new__(FastEmbedder)
    embedder._model = model  # type: ignore[assignment]
    embedder.embed_passages(["a"] * 40)
    embedder.embed_queries(["b"])
    reranker = object.__new__(FastReranker)
    reranker._model = model  # type: ignore[assignment]
    reranker.score("q", ["x"] * 40)
    assert len(model.batch_sizes) == 3
    assert max(model.batch_sizes) <= 16


@pytest.mark.slow
def test_real_models_rank_the_anchor_questions() -> None:
    """Loads (or downloads) the real models into ENGINE_CACHE_DIR/models."""
    settings = Settings(_env_file=None)
    models = settings.engine_cache_dir / "models"
    v01 = "Em muốn bảo lưu kết quả học tập một học kỳ thì cần làm gì?"
    variant = _variant("theo_dieu-512-10")
    real = IndexStore.build(
        load_documents(settings.content_dir),
        FastEmbedder(settings.embed_model, models),
        [v01, V01_L3],
        [variant],
    )
    assert real.manifest["dim"] == 1024
    handle = IndexHandle(variant, L1_DOCS, False)
    assert 12 in [h.chunk.dieu for h in vector_search(real, handle, v01, top_k=5).hits]
    reranker = FastReranker(settings.rerank_model, models, local_files_only=False)
    candidates = bm25_search(real, handle, V01_L3, top_k=10)
    assert rerank(real, reranker, V01_L3, candidates, top_n=3).hits[0].chunk.dieu == 47
