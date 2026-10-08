"""IndexStore build/save/load, per-handle views (E6, E7) and the build CLI. No real models."""

import json
import unicodedata
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest

from tests.engine.fakes_retrieval import HashingEmbedder
from vgame.config import Settings
from vgame.engine.chunking import embed_text
from vgame.engine.constants import ALL_VARIANTS, TOKENIZER_ID, IndexVariant
from vgame.engine.corpus import load_documents
from vgame.engine.index import (
    IndexNotBuiltError,
    IndexStaleError,
    IndexStore,
    golden_questions,
    main,
)
from vgame.engine.types import IndexHandle, Vectors

CONTENT_DIR = Settings(_env_file=None).content_dir
L2_DOCS = frozenset({"qcdt-2024", "qcdt-2019"})
L1_DOCS = frozenset({"qcdt-2024"})
QUESTION = "Em muốn bảo lưu kết quả học tập một học kỳ thì cần làm gì?"  # lib-l1-v01


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
    (tmp_path / "co_dinh-128-0.npy").write_bytes(b"not numpy")
    with pytest.raises(IndexNotBuiltError):
        IndexStore.load(tmp_path)

    store.save(tmp_path)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    (tmp_path / "manifest.json").write_text(json.dumps({**manifest, "tokenizer_id": "other"}))
    with pytest.raises(IndexNotBuiltError):
        IndexStore.load(tmp_path)


def test_unbuilt_variant_is_an_index_error(tmp_path: Path) -> None:
    only = IndexStore.build(
        load_documents(CONTENT_DIR), HashingEmbedder(), [QUESTION], [_variant("theo_dieu-512-10")]
    )
    with pytest.raises(IndexNotBuiltError):
        only.chunks(IndexHandle(_variant("co_dinh-128-0"), L1_DOCS, False))


def test_cli_builds_artifacts_with_an_injected_embedder(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = Settings(_env_file=None, engine_cache_dir=tmp_path)
    assert (
        main(["--variant", "theo_dieu-512-10"], settings=settings, embedder=HashingEmbedder()) == 0
    )
    out = capsys.readouterr().out
    assert "theo_dieu-512-10" in out
    assert "chunks" in out
    loaded = IndexStore.load(tmp_path / "index")
    assert loaded.manifest["variants"] == ["theo_dieu-512-10"]
    assert not (tmp_path / "models").exists()  # no model download with an injected embedder


def test_cli_fails_cleanly_without_content(tmp_path: Path) -> None:
    settings = Settings(_env_file=None, engine_cache_dir=tmp_path, content_dir=tmp_path)
    assert main([], settings=settings, embedder=HashingEmbedder()) == 1


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


def test_cli_rebuild_reuses_the_index_on_disk(tmp_path: Path) -> None:
    settings = Settings(_env_file=None, engine_cache_dir=tmp_path)
    argv = ["--variant", "theo_dieu-512-10"]
    assert main(argv, settings=settings, embedder=HashingEmbedder()) == 0
    again = CountingQueries()
    assert main(argv, settings=settings, embedder=again) == 0
    assert (again.passages, again.queries) == (0, [])
