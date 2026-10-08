# Engine v0.2: khu Thư viện (L1–L3)

> **Trạng thái:** hợp đồng cho 4 builder song song (A–D) và integrator (E). **Chủ file:** architect. Builder chỉ đọc; thấy lỗi thì báo, không sửa.
> **Nguồn sự thật:** [Phần 3](part-3-block-system.md) (kể cả các vấn đề phản biện ở cuối) · [build brief v0.1](build-brief-v0.1.md) D1–D9 · kịch bản [L1](../content/scenarios/library-l1-grounded-citation.md) / [L2](../content/scenarios/library-l2-chunk-tuning.md) / [L3](../content/scenarios/library-l3-article-number-lookup.md) §5, §6, §9–§11 · golden `docs/content/golden/library-l{1,2,3}.json` (**thắng khi lệch**) · [corpus README](../content/corpus/README.md) §2–§4.
> **Code dùng chung đã có:** `backend/src/vgame/engine/{__init__,constants,types}.py`, các trường engine trong `backend/src/vgame/config.py`, dependency trong `backend/pyproject.toml`. Đọc hai file `constants.py` và `types.py` trước khi đọc tiếp.

## 1. Phạm vi

**Có trong v0.2:** chạy thật ba level Thư viện từ graph JSON của người chơi, chấm sao, phát sự kiện, chẩn đoán sau run.

- 10 khối: `input`, `output`, `corpus`, `chunker`, `vector_search`, `bm25_search`, `fusion`, `rerank`, `context_packer`, `llm`.
- Graph JSON → validate → biên dịch thành `StateGraph` LangGraph tĩnh → chạy từng ca (tối đa 3 song song) → chấm từng ca → chấm sao → báo cáo (gold chỉ sau khi run kết thúc, D4).
- LLM không phụ thuộc nhà cung cấp: `LLMClient` Protocol; adapter Gemini (SDK `google-genai`); `FakeLLM` và `Oracle` chỉ trong test.
- Cache phát lại sqlite; `RunBudget` (12 lời gọi/ca); trần lượt chạy đồng thời và trần lời gọi LLM/ngày toàn máy chủ.
- Truy xuất: 24 biến thể index tính sẵn bằng CLI, KNN cosine chính xác bằng numpy, BM25 (`rank-bm25`), RRF/alpha, rerank cross-encoder (fastembed).
- Lưu tạm trong RAM: run store, event log, SSE phát lại theo `Last-Event-ID`.

**Không có (YAGNI, có trần ghi ở §12):** guard/halt, `agent_react`/tool, HITL, `compress`, `router`, `history_compactor`, `doc_shelf`, Postgres/pgvector/Redis, Langfuse, đăng nhập, frontend, gợi ý 3 bậc và menu "Vì sao" (frontend làm sau, dữ liệu đã có trong báo cáo), cổng hiệu chỉnh với model thật (script làm sau), `reorder_docs`, `repeat_task_at_end`, `order`, `on_overflow = bo_uu_tien_thap`, `graph_hash` và cache biên dịch, ghim version từng khối, ước tính token trước khi chạy, làm ấm prompt cache.

## 2. Quyết định đã chốt cho v0.2

| # | Quyết định | Lý do / nguồn |
|---|---|---|
| E1 | **Model:** một model `gemini-3.8-flash` (Stable, tra ai.google.dev 2026-10-07). Profile → `thinking_level`: `nhe` → `LOW`, `can_bang` → `MEDIUM`, `sau` → `HIGH`. `max_output_tokens` = `PROFILE_MAX_TOKENS` (4096 / 8192 / 16000). Không gửi temperature. Đổi model bằng `GEMINI_MODEL`, đổi xong phải hiệu chỉnh lại ngân sách sao 2. | Model này không hỗ trợ `MINIMAL` (trả lỗi). Library khoá `can_bang` nên mọi level dùng `MEDIUM`. |
| E2 | **Usage:** `input_tokens = usage_metadata.prompt_token_count` (đã gồm phần cache), `output_tokens = candidates_token_count + thoughts_token_count`. Metric sao 2 `tokens = input + output`. | Phản biện "đếm cache 2 lần"; thinking tính vào output (giá Gemini tính như output). |
| E3 | **Tokenizer engine** `regex-v1`: `count_tokens = số khớp của \w+|[^\w\s]` (`constants.py`). Dùng cho `chunk_size`, ngân sách thùng, `pack.tokens`. Đo trên `qcdt-2024`: 13.792 token so với 13.649 của tokenizer XLM-R (multilingual-e5), lệch < 3 %. Token thật cho sao luôn lấy từ usage của nhà cung cấp. | "một tokenizer có tài liệu"; không cần mạng, test được. |
| E4 | **Embedding:** fastembed `intfloat/multilingual-e5-large` (1024 chiều, giới hạn 512 token, MIT). Passage: `"passage: " + tiêu đề điều không kèm số + chữ đoạn đã bỏ dòng "Điều N. …"`; query: `"query: " + câu hỏi`. Manifest ghi `embed_model`, `fastembed_version`, `dim`, `tokenizer_id`, sha256 của kho. | Đề xuất của corpus README §2 (dense không thấy số hiệu, chỉ BM25 thấy). |
| E5 | **Rerank:** fastembed `TextCrossEncoder` `jinaai/jina-reranker-v2-base-multilingual`, chỉ nạp từ cache cục bộ. **Dự phòng có tài liệu:** không có dự phòng ngầm. Thiếu model thì run có `rerank` báo `run.failed` (`rerank_unavailable`) bằng tiếng Việt; chất lượng kém với tiếng Việt thì đổi `RERANK_MODEL` sang model khác của fastembed. Rerank bằng LLM (Phần 3 §3.7) hoãn tới khi spike cho thấy cần. | Dự phòng ngầm (ví dụ dùng cosine) sẽ đảo bài học L3. |
| E6 | **`only_in_force` nằm ở `chunker`** (tầng Index), không ở `vector_search`. Mọi retriever cắm vào index đó đều chỉ thấy văn bản còn hiệu lực. Đồ chơi "Kính lọc hiệu lực" của L2/L3 ánh xạ vào `chunker.only_in_force`. | Sửa lỗi phản biện (medium) "L3 không lọc được nhánh BM25". |
| E7 | **Kho theo level ở tầng Index:** `IndexHandle.docs` = `corpus` của level. L1, L3 = `{qcdt-2024}`; L2 = `{qcdt-2024, qcdt-2019}`. Biến thể index được tính một lần cho cả hai văn bản; handle lọc hàng. | D7. |
| E8 | **Ngân sách thùng** (`context_packer.token_budget`) tính **tài liệu + câu hỏi**. Khung nền và system prompt của người chơi không nằm trong ngân sách; bước `llm` báo `system_tokens`. | Packer không phải biết prompt của khối phía sau. |
| E9 | **BM25:** trường index = `"Điều N. Tiêu đề"` của mọi điều mà đoạn chạm tới + chữ đoạn. Tokenizer: NFC, chữ thường, `\w+` (giữ chữ số), **không** bỏ dấu. Bỏ hit có điểm ≤ 0. | Giả định 2 của corpus README; bỏ dấu sẽ làm "nghỉ" khớp "nghị", "thời gian" khớp "gián đoạn" và phá bẫy `lib-l3-t01` (đã đo). |
| E10 | **Replay cache** là cache chi phí, **không** hứa chống quay số. Khoá = sha256 của `(provider, model, profile, max_tokens, system, messages, frame_version)`. Trúng cache: trả kết quả đã lưu, `usage` gốc, `replayed = true`. | Phản biện (low) về lời hứa chống quay số. |
| E11 | **Không làm ấm prompt cache**, không ghi "cache hit 0 %". | Phản biện (low). |
| E12 | **G07 đếm lời gọi theo cấu trúc** (số khối `llm` trên đường tới output × 1 lời gọi ≤ 12, số khối LLM ≤ 8). `RunBudget` lúc chạy là trần thật. Test: mọi `starter_graph`, `reference_graph`, `naive_graphs` đều qua G07. | Phản biện (high). |
| E13 | **Không có guard** nên không có `halt`, không có conditional edge. DAG tĩnh, fan-in bằng `add_edge([a, b], c)` (barrier). `output` là node duy nhất nối tới `END`, chạy đúng một lần mỗi ca (đã thử: nhánh lệch độ dài vẫn chạy `out` một lần). | Phản biện (high) chỉ cắn khi có guard. |
| E14 | **Câu hỏi của ca được embed sẵn** trong CLI (mọi ca của 3 file golden, kể cả ca ôn). Lúc chạy không embed gì. | Phần 3 §3.7; kịch bản "Đèn pin chỉ chiếu câu có sẵn". |

## 3. Bản đồ module và quyền sở hữu

Mọi đường dẫn tính từ `backend/`. **Một file chỉ có một chủ.** Builder cần thay đổi file của người khác thì nhắn chủ file (qua leader).

| Builder | File được ghi | Việc |
|---|---|---|
| **architect** (xong) | `src/vgame/engine/__init__.py`, `engine/constants.py`, `engine/types.py`, `src/vgame/config.py`, `pyproject.toml`, `uv.lock`, `tests/__init__.py`, `tests/engine/__init__.py`, `tests/engine/test_shared.py`, `tests/conftest.py`, dòng `backend/.cache/` trong `.gitignore`, file này | hợp đồng dùng chung |
| **A · dữ liệu + truy xuất** | `engine/corpus.py`, `engine/chunking.py`, `engine/index.py` (kèm CLI `main`), `engine/retrieval.py`, `tests/engine/fakes_retrieval.py`, `tests/engine/test_corpus.py`, `test_chunking.py`, `test_index.py`, `test_retrieval.py` | nạp kho, 24 biến thể, artifact, KNN, BM25, fusion, rerank |
| **B · evaluator** | `engine/grading.py`, `engine/scoring.py`, `tests/engine/test_grading.py`, `tests/engine/test_scoring.py` | đọc golden, chấm ca, nhãn không cần gold, cờ cần gold, sao, chẩn đoán |
| **C · lớp LLM** | `engine/prompt.py`, `engine/packing.py`, `engine/llm.py`, `engine/replay.py`, `engine/budget.py`, `tests/engine/fakes_llm.py`, `tests/engine/test_prompt.py`, `test_packing.py`, `test_llm.py`, `test_replay.py`, `test_budget.py` | khung prompt, đóng gói thùng, adapter Gemini, cache phát lại, RunBudget, DailyCap, FakeLLM, Oracle |
| **D · registry + graph + runtime** | `engine/graph.py`, `engine/registry.py`, `engine/blocks.py`, `engine/levels.py`, `engine/validator.py`, `engine/compiler.py`, `engine/runtime.py`, `engine/run_store.py`, `tests/engine/test_graph.py`, `test_registry.py`, `test_validator.py`, `test_compiler.py`, `test_runtime.py`, `test_run_store.py` | khai báo khối, validate, biên dịch LangGraph, chạy ca, sự kiện, lưu run |
| **E · integrator (sau)** | `engine/levels/grounded-citation.json`, `chunk-tuning.json`, `article-number-lookup.json`, `src/vgame/api/routes/levels.py`, `src/vgame/api/routes/runs.py`, `src/vgame/api/__init__.py` (gắn router), `src/vgame/main.py` (dựng deps, CORS thêm `POST`), `backend/README.md`, `.env.example`, `tests/engine/test_levels_e2e.py`, `tests/test_api_runs.py` | API, ba file level, test đầu-cuối |

Đồ thị phụ thuộc (không vòng): `constants` ← `types` ← {A, C} ← B (dùng `corpus`, `index`, `retrieval`) ← D (dùng A, B, C) ← E. Builder chạy song song code theo chữ ký ở §5; import module của builder khác chỉ trong code, test dùng double của chính mình hoặc file `fakes_*` của builder kia khi đã có.

**Quy tắc chung cho mọi builder:** ruff strict, mypy strict, `uv run pytest -q` xanh; không mạng trong test (không tải model, không gọi Gemini); không đọc/in/log `.env` hay key (test luôn dựng `Settings(_env_file=None, …)`); chữ người chơi là dữ liệu, không bao giờ qua `str.format`/template; thông điệp cho người chơi bằng tiếng Việt; mỗi đơn giản hoá có trần ghi bằng `# ponytail: <trần>, <đường nâng cấp>`; không commit, không push.

## 4. Kiểu dùng chung (đã có trong code)

Xem nguyên văn ở `engine/types.py` và `engine/constants.py`. Tóm tắt:

| Tên | Vai trò |
|---|---|
| `IndexVariant`, `ALL_VARIANTS` (24), `count_tokens`, `TOKENIZER_ID` | lưới biến thể và tokenizer duy nhất |
| `CASE_DEADLINE_S` 20, `RUN_DEADLINE_S` 90, `MAX_CONCURRENT_CASES` 3, `MAX_LLM_CALLS_PER_CASE` 12, `MAX_LLM_BLOCKS` 8, `PROFILE_MAX_TOKENS`, `MAX_PAYLOAD_BYTES` 64 KB, `MAX_NODES` 25, `SYSTEM_PROMPT_MAX_CHARS` 2000, `SUMMARY_MAX_CHARS` 140, `FORBIDDEN_CHARS_RE` | giới hạn |
| `Usage` (`tokens = input + output`) | usage |
| `LLMMessage`, `LLMRequest`, `LLMResponse`, `LLMClient` (Protocol) | cổng LLM |
| `Embedder`, `Reranker` (Protocol), `Vectors` | cổng mô hình truy xuất |
| `Chunk`, `IndexHandle`, `DocHit`, `DocList` | giá trị cổng `Index`, `Docs` |
| `PublicCase`, `PackedContext`, `Answer`, `PortValue` | giá trị cổng `Query`, `Context`, `Answer` |
| `RetrievedFact`, `PackFact`, `LLMFact`, `Fact` | dữ kiện trung tính trong `step.finished` |
| `StepRecord`, `CaseTrace` | vết một ca, đưa cho evaluator |
| `CaseGrade`, `StarResult`, `GoldReveal`, `Diagnosis`, `RunReport` | đầu ra evaluator |
| `LevelRules`, `StaleRule` | luật sao/chấm của một level |
| `ValidationIssue` | lỗi validate |
| `RunStartedEvent` … `RunFailedEvent`, `EngineEvent`, `EventSink` | sự kiện |
| `EngineError`, `LLMNotConfiguredError`, `LLMCallError`, `BudgetExceededError` | lỗi có `message_vi` an toàn cho người chơi |

Settings mới (`config.py`, đọc từ env hoặc `backend/.env`): `GEMINI_API_KEY` (SecretStr, tuỳ chọn), `GEMINI_MODEL` (`gemini-3.8-flash`), `CONTENT_DIR` (`<repo>/docs/content`), `ENGINE_CACHE_DIR` (`backend/.cache/engine`, đã gitignore), `EMBED_MODEL`, `RERANK_MODEL`, `MAX_CONCURRENT_RUNS` (1 cho pilot: tối đa 3 lời gọi Gemini song song, 429 đã xuất hiện ở mức 3; nâng khi biết hạn mức RPM của key), `DAILY_LLM_CALL_CAP` (500). `.env` đọc theo đường dẫn tuyệt đối `backend/.env` (đúng từ mọi cwd); `main.py` không có `app` cấp module, chạy bằng `uvicorn --factory vgame.main:create_app`.

Bố cục cache: `ENGINE_CACHE_DIR/models/` (fastembed), `ENGINE_CACHE_DIR/index/` (artifact), `ENGINE_CACHE_DIR/replay.sqlite3`.

## 5. Interface giữa các module (chữ ký bắt buộc)

Tên hàm, tham số và kiểu trả về dưới đây là hợp đồng. Hàm phụ nội bộ tuỳ builder.

### 5.1 A · `engine/corpus.py`

```python
@dataclass(frozen=True, slots=True)
class Clause:
    number: int | None          # None khi điều không chia khoản
    start: int                  # offset trong Document.text
    end: int

@dataclass(frozen=True, slots=True)
class Article:
    dieu: int
    title: str                  # "Bảo lưu kết quả học tập" (không kèm số)
    start: int                  # offset dòng tiêu đề "Điều N. …"
    end: int
    clauses: tuple[Clause, ...]

@dataclass(frozen=True, slots=True)
class Document:
    doc_id: str
    in_force: bool
    text: str                   # văn bản đã làm sạch, NFC, "\n"
    articles: tuple[Article, ...]

def load_documents(content_dir: Path) -> dict[str, Document]: ...
def find_quote(doc: Document, quote: str) -> tuple[int, int]: ...   # ValueError nếu không có
```

Luật nạp (corpus README §2): chỉ hai file có front matter `doc_id`; chỉ từ dòng `## Chương I` trở xuống; bỏ dòng `## Chương …`, chú thích HTML; dòng `### Điều N. Tiêu đề` thành `Điều N. Tiêu đề`; dòng `N. ` là khoản; `a) `, `đ) ` là điểm thuộc khoản trên; NFC; gộp dòng trống. Mọi `quote` trong golden phải là chuỗi con của `Document.text` (test với cả ba file golden).

### 5.2 A · `engine/chunking.py`

```python
def chunk_document(doc: Document, variant: IndexVariant) -> list[Chunk]: ...
def bm25_text(doc: Document, chunk: Chunk) -> str: ...
def embed_text(doc: Document, chunk: Chunk) -> str: ...      # không có tiền tố "passage: "
def chunk_id(variant: IndexVariant, doc_id: str, start: int, end: int) -> str: ...  # sha256[:8]
```

- Token = các khớp `TOKEN_RE` trên `doc.text`; một đoạn = dải token liền nhau; `Chunk.text = doc.text[start:end]` với `start` = đầu token đầu, `end` = cuối token cuối.
- **`co_dinh`:** cửa sổ trượt trên toàn bộ token của văn bản (bắc qua ranh giới điều), cỡ S, bước S − `overlap_tokens`; không sinh cửa sổ cuối nằm trọn trong cửa sổ trước.
- **`theo_dieu`** (chốt Câu hỏi mở 2 của L2): đơn vị = khoản (kèm các điểm); dòng tiêu đề điều gắn vào khoản đầu; điều không chia khoản là một đơn vị. Gộp tham lam các đơn vị liền nhau **cùng một điều** khi tổng ≤ S. Đơn vị dài hơn S bị cắt cố định bên trong với overlap. Overlap chỉ áp cho vết cắt bên trong một khoản; vết cắt ở ranh giới khoản thì sạch. Không bao giờ bắc qua hai điều.
- `dieu` = điều của token đầu; `khoan` = các khoản của điều đó mà đoạn chạm tới (`()` nếu không chia khoản); `hieu_luc = doc.in_force`.
- `chunk_id` mờ: 8 ký tự hex đầu của sha256(`"{variant.key}|{doc_id}|{start}|{end}"`). Test: không trùng trong một biến thể.

### 5.3 A · `engine/index.py`

```python
class IndexNotBuiltError(EngineError):   # message_vi: "Chưa dựng index. Chủ máy chủ cần chạy vgame-build-index."
    ...

class IndexStore:
    manifest: dict[str, object]           # embed_model, fastembed_version, dim, tokenizer_id, corpus_sha256, built_at

    @classmethod
    def build(cls, documents: Mapping[str, Document], embedder: Embedder,
              questions: Sequence[str], variants: Sequence[IndexVariant] = ALL_VARIANTS) -> "IndexStore": ...
    @classmethod
    def load(cls, index_dir: Path) -> "IndexStore": ...          # IndexNotBuiltError nếu thiếu/hỏng
    def save(self, index_dir: Path) -> None: ...
    def document(self, doc_id: str) -> Document: ...
    def chunks(self, handle: IndexHandle) -> tuple[Chunk, ...]: ...      # đã lọc docs + only_in_force
    def vectors(self, handle: IndexHandle) -> Vectors: ...               # cùng thứ tự với chunks()
    def bm25(self, handle: IndexHandle) -> BM25Okapi: ...                # lru theo handle
    def query_vector(self, question: str) -> Vectors: ...                # 1-D; EngineError nếu chưa tính sẵn

def main(argv: Sequence[str] | None = None) -> int: ...   # script `vgame-build-index`
```

- Artifact mỗi biến thể: `index/<variant.key>.json` (chunk + meta) và `.npy` (float32, đã chuẩn hoá). Câu hỏi: `index/queries.json` (sha256 của câu hỏi NFC → hàng) + `queries.npy`. `index/manifest.json`. Không dùng pickle.
- CLI: đọc `Settings`, nạp kho từ `CONTENT_DIR`, câu hỏi từ ba file golden, tải model embedding và rerank về `ENGINE_CACHE_DIR/models`, dựng 24 biến thể, ghi artifact. In thống kê mỗi biến thể (số đoạn, token trung bình). Đoạn trùng chữ giữa các biến thể chỉ embed một lần.
- `FastEmbedder(model_id, cache_dir)` và `FastReranker(model_id, cache_dir, local_files_only=True)` sống trong `retrieval.py` (dưới). Thêm tiền tố e5 (`query: ` / `passage: `) trong `FastEmbedder`, không trong `embed_text`.

### 5.4 A · `engine/retrieval.py`

```python
def vector_search(store: IndexStore, handle: IndexHandle, question: str, *,
                  top_k: int | None, score_threshold: float = 0.0) -> DocList: ...   # origin "vector_search"
def bm25_search(store: IndexStore, handle: IndexHandle, question: str, *,
                top_k: int | None) -> DocList: ...                                   # origin "bm25_search"
def fuse_rrf(lists: Sequence[DocList], *, k: int, top_k: int) -> DocList: ...       # origin "fusion"
def fuse_alpha(vector: DocList, bm25: DocList, *, alpha: float, top_k: int) -> DocList: ...
def rerank(store: IndexStore, reranker: Reranker, question: str, docs: DocList, *, top_n: int) -> DocList: ...  # origin "rerank"
def bm25_tokens(text: str) -> list[str]: ...

class FastEmbedder: ...      # Embedder thật
class FastReranker: ...      # Reranker thật; RerankerUnavailableError(EngineError) nếu model chưa tải
```

- `top_k=None` = xếp hạng toàn bộ (evaluator dùng để tính hạng gold ngoài top-k).
- Vector: cosine = tích vô hướng; giữ `score ≥ score_threshold`; hoà điểm thì theo thứ tự đoạn.
- BM25: `BM25Okapi` mặc định trên `bm25_tokens(bm25_text)`; bỏ hit có điểm ≤ 0.
- RRF: `Σ 1/(k + rank)` trên mọi danh sách; hoà điểm thì `chunk_id` tăng dần.
- Alpha: chuẩn hoá min-max từng danh sách về [0, 1] (danh sách một phần tử → 1.0), thiếu mặt → 0, điểm = α·vector + (1 − α)·bm25.
- Rerank: `reranker.score(question, [bm25_text(doc, c) …])` (tiêu đề "Điều N. …" + nội dung: đoạn giữa điều không chứa số điều, chấm `c.text` trần thì rerank không bao giờ cứu được câu tra số điều — L3 N8), giữ `top_n` cao nhất; cache điểm trong RAM theo `(model_id, question, văn bản được chấm)` (`# ponytail:` dict không giới hạn, đủ cho ~50 câu × vài nghìn đoạn).
- `tests/engine/fakes_retrieval.py`: `HashingEmbedder` (túi từ băm `\w+`, 256 chiều, chuẩn hoá, tất định, không mạng) và `OverlapReranker` (điểm = số token chung kể cả chữ số). Hai lớp này dùng chung cho test của B, D, E.

### 5.5 C · `engine/prompt.py`

```python
FRAME_VERSION: Final = 1
FRAME_VI: Final[str]     # khung nền cố định: vai trợ lý tra cứu quy chế, trả lời tiếng Việt,
                         # "khi đoạn tài liệu có mã trong ngoặc vuông, ghi đúng mã đó trong ngoặc
                         # vuông ngay sau ý đã dùng". Không thêm lớp phòng thủ nào (Phần 3 nguyên tắc 6).

def render_docs(chunks: Sequence[Chunk], *, cite_ids: bool) -> str: ...
def build_request(ctx: PackedContext, *, profile: Profile, system_prompt: str) -> LLMRequest: ...
def parse_citations(text: str) -> tuple[str, ...]: ...
```

- `render_docs`: mỗi đoạn một khối cách nhau một dòng trống; có `cite_ids` thì `"[<chunk_id>] " + text`, không thì chỉ `text`. Không in meta (`hieu_luc`, `dieu`) vào packet.
- `build_request`: `system = FRAME_VI + "\n\n" + system_prompt` (ghép chuỗi, không format); một message `user` = (`"Tài liệu:\n" + docs_text + "\n\n"` nếu có đoạn) + `"Câu hỏi: " + question`. Thùng rỗng thì **không** có phần "Tài liệu" (để bẫy L1-N1 cắn đúng). `max_tokens = PROFILE_MAX_TOKENS[profile]`.
- `parse_citations`: mọi nhóm `[...]` (không chứa `[`, `]`, xuống dòng, ≤ 64 ký tự), tách theo `,`/`;`, bỏ khoảng trắng, giữ thứ tự, bỏ trùng.

### 5.6 C · `engine/packing.py`

```python
def pack(question: str, lists: Sequence[DocList], *, token_budget: int, cite_ids: bool) -> PackedContext: ...
def pack_fact(ctx: PackedContext) -> PackFact: ...
```

- Ghép các danh sách theo **thứ tự cạnh trong graph JSON**, bỏ đoạn trùng `chunk_id` (giữ lần đầu).
- Ngân sách = `docs_tokens + query_tokens ≤ token_budget`, với `docs_tokens = count_tokens(render_docs(included))`, `query_tokens = count_tokens("Câu hỏi: " + question)`.
- `on_overflow = cat_duoi` (duy nhất ở v0.2): giữ nguyên đoạn theo thứ tự tới khi đoạn kế tiếp làm vượt ngân sách; mọi đoạn từ đó trở đi vào `dropped` (không nhặt đoạn nhỏ hơn phía sau).

### 5.7 C · `engine/llm.py`, `engine/replay.py`, `engine/budget.py`

```python
# llm.py
GEMINI_THINKING: Final[dict[Profile, types.ThinkingLevel]]   # nhe→LOW, can_bang→MEDIUM, sau→HIGH
RETRYABLE_STATUS: Final = frozenset({500, 502, 503})        # không có semaphore cục bộ: trần là MAX_CONCURRENT_RUNS x 3 ca

class GeminiClient:                                          # LLMClient
    def __init__(self, *, api_key: str, model: str, daily_cap: DailyCap) -> None: ...
class ReplayingLLM:                                          # LLMClient, bọc client thật
    def __init__(self, inner: LLMClient, store: ReplayStore) -> None: ...
def build_llm_client(settings: Settings, *, daily_cap: DailyCap, store: ReplayStore) -> LLMClient: ...
    # LLMNotConfiguredError khi settings.gemini_api_key is None

# replay.py
def replay_key(provider: str, model: str, request: LLMRequest, frame_version: int) -> str: ...
class ReplayStore:
    def __init__(self, path: Path | str) -> None: ...         # ":memory:" trong test
    def get(self, key: str) -> LLMResponse | None: ...       # trả replayed=True, usage gốc
    def put(self, key: str, response: LLMResponse) -> None: ...

# budget.py
class RunBudget:
    def __init__(self, max_calls_per_case: int = MAX_LLM_CALLS_PER_CASE) -> None: ...
    def reserve(self, case_id: str) -> None: ...             # BudgetExceededError("case")
    def commit(self, case_id: str, usage: Usage) -> None: ...
    @property
    def usage(self) -> Usage: ...                            # tổng run
class DailyCap:
    def __init__(self, cap: int, today: Callable[[], date] = <UTC today>) -> None: ...
    def reserve(self) -> None: ...                           # BudgetExceededError("daily")
```

- Gemini: `client.aio.models.generate_content(model, contents, config=GenerateContentConfig(system_instruction, max_output_tokens, thinking_config=ThinkingConfig(thinking_level=…)))`. `HttpOptions.timeout` tính bằng **mili giây** (= 20 000). Đặt key qua tham số `api_key`, không qua biến môi trường của SDK.
- `finish_reason`: `STOP` → `end`; `MAX_TOKENS` → `max_tokens`; `SAFETY`, `PROHIBITED_CONTENT`, `BLOCKLIST`, `SPII`, `RECITATION` hoặc `prompt_feedback.block_reason` → `refusal`; còn lại → `error`.
- Lỗi: `errors.APIError` → `LLMCallError(status=e.code, retryable=code in {500, 502, 503})`; retry **một lần** sau 1 s nếu là lỗi retryable. Không retry 429 (retry sau 1 s lại chạm đúng giới hạn) và 504 (hạn của provider không vừa phần thời gian còn lại của ca). Mỗi lần thử đều tính vào `DailyCap`. Không có hàng đợi cục bộ: chờ slot sẽ ăn vào hạn 20 s của ca. Không bao giờ đưa nội dung phản hồi lỗi, header hay key vào message/log; log chỉ `type(exc).__name__` và `status`.
- `DailyCap.reserve()` chỉ gọi ngay trước lời gọi mạng thật (trúng replay không tính). `# ponytail:` bộ đếm trong RAM theo ngày UTC, mất khi restart; nâng cấp: Redis `INCR` có TTL.
- `ReplayStore`: bảng `llm_replay(key TEXT PRIMARY KEY, response TEXT NOT NULL, created_at TEXT NOT NULL)`, JSON của `LLMResponse`. Chỉ lưu phản hồi `end`/`max_tokens`/`refusal`, không lưu `error`. `# ponytail:` sqlite cục bộ, một tiến trình; nâng cấp: bảng Postgres `llm_replay` (Phần 3 §3.8).
- `tests/engine/fakes_llm.py`:
  - `FakeLLM(script: Callable[[LLMRequest], str] | str, *, stop_reason="end", delay_s=0.0, fail: LLMCallError | None = None)`. Usage giả = `Usage(count_tokens(system + mọi message), count_tokens(text))`, để ngân sách sao trong test gần với số đo thật.
  - `Oracle(cases: Mapping[str, OracleCase])`, với `OracleCase(answer_points, quotes, abstain)` dựng **trong test** từ golden. Nhận ra ca bằng câu hỏi sau `"Câu hỏi: "`. Ca abstain: trả `"Quy chế hiện hành không có thông tin này."`. Ca answer: nếu **mọi** quote nằm trọn trong một khối tài liệu của packet thì trả các `answer_points` kèm `[chunk_id]` của khối chứa quote (nếu packet có mã); thiếu quote thì bịa `"Theo Điều 12, …"` không kèm mã. Oracle là chỗ duy nhất ngoài evaluator được thấy gold.

### 5.8 B · `engine/grading.py`, `engine/scoring.py`

```python
# grading.py
@dataclass(frozen=True)
class GoldenCase: id, role, vai, question, expect, answer_points, gold (tuple[GoldQuote]), forbidden, trap, bites
@dataclass(frozen=True)
class GradingSpec:
    level_id: str
    corpus: tuple[str, ...]
    cases: tuple[GoldenCase, ...]            # thứ tự file golden; "review" giữ lại cho ca trực
    equivalents: dict[str, tuple[str, ...]]
    refusal_markers: tuple[str, ...]

def load_grading_spec(content_dir: Path, level_id: str) -> GradingSpec: ...   # quét golden/library-l*.json
def public_cases(spec: GradingSpec) -> list[PublicCase]: ...                  # bỏ role "review"
def normalize(text: str) -> str: ...

class LevelEvaluator:
    def __init__(self, spec: GradingSpec, rules: LevelRules, store: IndexStore) -> None: ...
    def grade_case(self, trace: CaseTrace) -> CaseGrade: ...                  # gọi ngay khi ca xong
    def score(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade]) -> StarResult: ...
    def report(self, traces: Sequence[CaseTrace], grades: Sequence[CaseGrade],
               retrievers: Mapping[str, tuple[BlockType, IndexHandle]]) -> RunReport: ...  # sau run
```

`LevelRules` và `StaleRule` là TypedDict trong `types.py` (D parse từ level JSON, B dùng để chấm): `s1_min_normal`, `s1_required`, `token_budget`, `s3_forbidden_labels`, `info_cases`, `stale_fails`, `max_dieu`, `diagnosis` (khoá cờ → mẫu tiếng Việt có `{biến}`).

Luật chi tiết ở §10.

### 5.9 D · graph, registry, blocks, levels, validator, compiler, runtime, run store

```python
# graph.py
class GraphNode(BaseModel):   id: str (^[a-z][a-z0-9_]{0,15}$), type: BlockType, params: dict[str, JsonValue] = {}
class GraphPayload(BaseModel): schema_: Literal[1] (alias "schema"), nodes: list[GraphNode], edges: list[tuple[str, str]], ui: dict[str, JsonValue] | None = None
    # extra="forbid"; ui không bao giờ ảnh hưởng chạy

# registry.py
@dataclass(frozen=True)
class PortSpec: type: Literal["Query", "Index", "Docs", "Context", "Answer"]; many: bool = False; required: bool = True
@dataclass(frozen=True)
class BlockSpec: type: BlockType; name_vi: str; inputs: Mapping[str, PortSpec]; outputs: Mapping[str, PortSpec]
                 params: type[BaseModel]; llm_calls: int; runtime: bool; concepts: tuple[str, ...]
REGISTRY: Final[Mapping[BlockType, BlockSpec]]
def registry_json() -> dict[str, JsonValue]: ...      # cho GET /api/blocks: model_json_schema() + cổng

# blocks.py: một model Pydantic tham số cho mỗi khối (extra="forbid", frozen) + hàm chạy + summarize()
@dataclass(frozen=True)
class EngineDeps: store: IndexStore; llm: LLMClient; reranker: Reranker | None; budget: RunBudget

# levels.py
class LevelSpec(BaseModel): ...   # parse engine/levels/<id>.json (§9.1)
    def public(self, cases: Sequence[PublicCase]) -> dict[str, JsonValue]: ...   # PublicLevel (§9.2)
def load_level(level_id: str) -> LevelSpec: ...

# validator.py
def validate(raw: bytes, level: LevelSpec) -> tuple[GraphPayload | None, list[ValidationIssue]]: ...
    # trả graph đã chuẩn hoá (NFC, locked node chèn lại) khi không có lỗi severity "error"

# compiler.py
@dataclass(frozen=True)
class CompiledLevelGraph:
    graph: CompiledStateGraph            # ainvoke một CaseState mỗi ca
    handles: Mapping[str, IndexHandle]   # chunker node → handle
    retrievers: Mapping[str, tuple[BlockType, IndexHandle]]
    ingestion: list[IngestionInfo]
def compile_graph(graph: GraphPayload, level: LevelSpec, deps: EngineDeps) -> CompiledLevelGraph: ...

# runtime.py
async def run_level(run_id: str, compiled: CompiledLevelGraph, cases: Sequence[PublicCase],
                    deps: EngineDeps, evaluator: LevelEvaluator, emit: EventSink) -> None: ...

# run_store.py
class RunBusyError(EngineError): ...     # message_vi: "Đang có nhiều lượt chạy, bạn thử lại sau ít phút."
class RunStore:
    def __init__(self, *, max_concurrent_runs: int, keep_last: int = 200) -> None: ...
    def start(self, level_id: str, idempotency_key: str | None, graph_hash: str = "") -> tuple[str, bool]: ...  # (run_id, is_new); RunBusyError; cùng (level, key) khác graph_hash → IdempotencyConflictError (409)
    def append(self, run_id: str, event: EngineEvent) -> int: ...   # trả seq (id SSE), đánh dấu xong khi gặp run.finished/run.failed
    def subscribe(self, run_id: str, last_event_id: int | None) -> AsyncIterator[tuple[int, EngineEvent]]: ...
```

`run_id` = `uuid4().hex` (không đoán được; không có đăng nhập nên id là quyền xem). `# ponytail:` run store và event log trong RAM, giữ 200 run gần nhất, mất khi restart, chỉ một tiến trình; nâng cấp: bảng `run`/`run_event` Postgres + Redis pub/sub (Phần 2).

## 6. Khối (registry)

### 6.1 Cổng và tham số

| Khối | `name_vi` | Vào | Ra | Tham số `miền (mặc định)` | LLM | runtime |
|---|---|---|---|---|---|---|
| `input` | Câu hỏi khách | — | `query: Query` | — | 0 | có |
| `output` | Trả lời | `answer: Answer` | — | — | 0 | có |
| `corpus` | Kho luật | — | — | — (kho lấy từ `level.corpus`) | 0 | không |
| `chunker` | Chia chunk | — | `index: Index` | `strategy` co_dinh/theo_dieu (theo_dieu); `chunk_size` {128, 256, 512, 1024} (512); `overlap_pct` {0, 10, 20} (10); `only_in_force` bool (false) | 0 | không |
| `vector_search` | Tìm theo nghĩa | `query: Query`, `index: Index` | `docs: Docs` | `top_k` 1–20 (5); `score_threshold` 0–0.9, bội 0.05 (0) | 0 | có |
| `bm25_search` | Tìm từ khóa | `query`, `index` | `docs` | `top_k` 1–20 (5) | 0 | có |
| `fusion` | Hợp nhất kết quả | `docs: Docs` many (2–3) | `docs` | `method` rrf/alpha (rrf); `k` 1–100 (60); `alpha` 0–1, bội 0.1 (0.5); `top_k` 1–30 (10) | 0 | có |
| `rerank` | Xếp hạng lại | `query`, `docs` | `docs` | `top_n` 1–10 (3) | 0 | có |
| `context_packer` | Đóng gói context | `query`, `docs` many, không bắt buộc | `context: Context` | `token_budget` 300–16000 (3000); `on_overflow` cat_duoi (cat_duoi); `cite_ids` bool (false) | 0 | có |
| `llm` | Gọi LLM | `context: Context` | `answer: Answer` | `profile` nhe/can_bang/sau (can_bang); `system_prompt` str ≤ 2000 ký tự ("") | 1 | có |

`concepts` theo cột "Khái niệm" của Phần 3 §3.2 (ví dụ `N7.top_k`, `N8.hybrid`). Hai khối `corpus`, `chunker` thuộc làn Ingestion: không thành node LangGraph; `chunker` thành `IndexHandle(variant, level.corpus, only_in_force)` lúc biên dịch.

### 6.2 Hành vi lúc chạy và `summarize()` (≤ 140 ký tự, số kiểu Việt: `1.420`, `0,83`)

| Khối | Chạy | Facts | Summary mẫu |
|---|---|---|---|
| `input` | ghi `PublicCase` vào `q.query` | — | "Nhận câu hỏi." |
| `vector_search` | `retrieval.vector_search` | `retrieved` | "Lấy 3 đoạn: Điều 12 (0,83), Điều 13 (0,71), Điều 10 (0,69)" |
| `bm25_search` | `retrieval.bm25_search` | `retrieved` | "Lấy 5 đoạn: Điều 47 (12,4), Điều 41 (6,1)…" |
| `fusion` | `fuse_rrf` hoặc `fuse_alpha` (alpha cần đúng một danh sách `vector_search` và một `bm25_search`) | `retrieved` | "Gộp 2 danh sách (RRF) còn 10 đoạn: Điều 47, Điều 41…" |
| `rerank` | `retrieval.rerank` | `retrieved` | "Xếp lại 10 đoạn, giữ 3: Điều 47 (0,92)…" |
| `context_packer` | `packing.pack` | `pack` | "Thùng: 1.420/3.000 token. Bị cắt: 0 đoạn." |
| `llm` | `budget.reserve` → `build_request` → `llm.complete` → `budget.commit` → `Answer` | `llm` (có `answer` chỉ khi ca `visible`) | "Trợ lý trả lời (1.234 vào, 210 ra token)." + " Kết quả đã lưu." khi `replayed` |
| `output` | ghi `Answer` cuối | — | "Đã ghi câu trả lời." |

Luật chéo chạy lúc validate: `rerank.top_n ≤` số ứng viên tối đa phía trước (`top_k` của khối nguồn) → G06; `top_n` bằng đúng số đó → `W_RERANK_NOOP` (info). `fusion.method = alpha` mà nguồn không đúng một vector + một bm25 → G06.

## 7. Graph JSON, validate, biên dịch, chạy

### 7.1 Graph JSON (Phần 3 §3.4)

```json
{"schema": 1,
 "nodes": [{"id": "q", "type": "input"},
           {"id": "kb", "type": "corpus"},
           {"id": "ix", "type": "chunker", "params": {"strategy": "theo_dieu", "chunk_size": 512, "overlap_pct": 10, "only_in_force": false}},
           {"id": "vs", "type": "vector_search", "params": {"top_k": 3}},
           {"id": "pk", "type": "context_packer", "params": {"token_budget": 3000, "on_overflow": "cat_duoi", "cite_ids": true}},
           {"id": "llm", "type": "llm", "params": {"profile": "can_bang", "system_prompt": "…"}},
           {"id": "out", "type": "output"}],
 "edges": [["q.query", "vs.query"], ["ix.index", "vs.index"], ["vs.docs", "pk.docs"],
           ["q.query", "pk.query"], ["pk.context", "llm.context"], ["llm.answer", "out.answer"]],
 "ui": {"q": [40, 120]}}
```

Khác Phần 3: node `corpus` không có cổng và không có tham số (kho do level quyết định); `only_in_force` ở `chunker` (E6).

### 7.2 Thứ tự validate (gom mọi lỗi của các tầng chạy được vào một 422)

| Bước | Kiểm | Mã |
|---|---|---|
| 1 | ≤ 64 KB; UTF-8 hợp lệ; JSON hợp lệ; đúng `GraphPayload`; id node không trùng; ≤ 25 node. Dừng sớm ở đây nếu không đọc được | `P01` quá lớn, `P02` không đọc được, `P03` sai hình dạng |
| 2 | Mọi chuỗi: chuẩn hoá NFC; không khớp `FORBIDDEN_CHARS_RE` | `P02` |
| 3 | Chèn lại `locked_nodes` từ `starter_graph` của level (bỏ bản client); khối thuộc `allowed_blocks` | `G06` |
| 4 | Tham số: Pydantic của khối ∩ `param_limits` (`ge`, `le`, `const`, `multiple_of`); `system_prompt` ≤ 2000 ký tự; luật chéo §6.2 | `G06` |
| 5 | Cạnh: `"node.port"` tồn tại; kiểu cổng khớp; cổng không `many` chỉ nhận 1 cạnh; `fusion.docs` nhận 2–3 cạnh | `G02` |
| 6 | Cổng bắt buộc có cạnh | `G05` |
| 7 | DAG (`graphlib.TopologicalSorter`) | `G03` |
| 8 | Đúng một node `output`, nhận đúng một cạnh; có đường `input` → … → `output` | `G04`, `G01` |
| 9 | G07 cấu trúc: số khối `llm` trên đường tới `output` × `llm_calls` ≤ 12; số khối LLM ≤ 8 | `G07` |
| 10 | Node runtime không nằm trên đường nào tới `output` | `I01` (info, không biên dịch node đó) |

Thông điệp tiếng Việt lấy mẫu ở Phần 3 §3.5 (G01–G07); G06 có biến thể cho "khối chưa mở", "tham số chưa mở ở level này", "ngoài miền", "chữ quá dài". Lỗi P03 không lặp lại nội dung payload.

### 7.3 Biên dịch

```python
class CaseState(TypedDict):
    case: PublicCase
    ports: Annotated[dict[str, PortValue], merge_once]   # "vs.docs" -> DocList; ghi trùng khoá = lỗi
    steps: Annotated[list[StepRecord], operator.add]
```

- Node runtime = `instrumented(node_id, spec, params, deps, emit)`. Node đọc cổng vào từ `ports` theo bảng cạnh, ghi `ports["<id>.<port>"]`.
- Cạnh: `START → input`; node có tập nguồn runtime P: `add_edge(P[0], n)` nếu |P| = 1, `add_edge(sorted(P), n)` nếu |P| > 1 (barrier, chạy một lần sau khi mọi nguồn xong); `output → END`. Cạnh từ `chunker` không thành cạnh LangGraph.
- Biên dịch một lần mỗi run; `ainvoke` cho từng ca.

### 7.4 Chạy

1. Kiểm trước khi phát gì: thiếu index → `run.failed{code: "index_missing"}`; graph có `rerank` mà `deps.reranker is None` → `run.failed{code: "rerank_unavailable"}`; không có LLM client → `run.failed{code: "llm_not_configured"}` (E trả 503 ngay ở POST thì càng tốt).
2. Phát `run.started`.
3. Mỗi ca trong `asyncio.Semaphore(3)`, mỗi ca có hạn `CASE_DEADLINE_S`, cả run có hạn `RUN_DEADLINE_S`. `instrumented()` phát `step.started`, chạy khối, và trong `finally` **luôn** phát `step.finished` với `status`:
   - `ok`; `timeout` (hết hạn ca hoặc run); `cancelled` (bị huỷ vì lý do khác); `budget` (`BudgetExceededError`); `llm_error` (`LLMCallError`); `index_error` (lỗi index trong bước, ví dụ câu hỏi chưa embed: lỗi máy chủ, không phải provider); `refusal` (`stop_reason == "refusal"`, câu trả lời vẫn đi tiếp tới `output`).
   - Bước lỗi (trừ `refusal`) dừng ca: node sau không chạy nên không có `step.started` mồ côi.
4. Ca xong → `CaseTrace` → `evaluator.grade_case` → `case.graded`. Trạng thái ca: `ok`, `refusal`, `timeout`, `cancelled`, `llm_error`, `index_error`, `skipped_budget` (bước `budget`, hoặc ca chưa bắt đầu khi `DailyCap` đã cạn: không phát step nào, chỉ `case.graded`).
5. Hết hạn run: ca chưa chạy thành `timeout`, vẫn chấm. Chấm sao → `run.scored`; báo cáo → `run.finished`. `run.failed` chỉ dành cho lỗi trước khi chạy, lỗi nội bộ (message chung, không stack trace), huỷ, hoặc provider sập: sau khi mọi ca đã `case.graded`, có ca `index_error` thì phát `run.failed{index_stale}` (lỗi máy chủ, không chấm); nếu không ca nào có bước `llm` `ok`/`refusal` **và** có ít nhất một ca `llm_error`, `skipped_budget` do `DailyCap` cạn, hoặc một bước `llm` `timeout` (ca hết giờ ở rerank, chưa gọi AI, không tính), thì phát `run.failed{llm_unavailable}` thay cho `run.scored` + `run.finished` (lượt không tính sao). Cuối run log một dòng INFO `run <id> llm reserved=N committed=M` (chênh lệch = lời gọi bị huỷ giữa chừng có thể vẫn bị tính phí).

## 8. Hợp đồng sự kiện (SSE)

Kiểu ở `types.py`. Run store thêm `seq` tăng dần từ 1; SSE: `id: <seq>`, `event: <type>`, `data: <json>`. Client nối lại với `Last-Event-ID: n` thì nhận lại mọi sự kiện có `seq > n` rồi tiếp tục trực tiếp.

| Sự kiện | Trường | Ghi chú |
|---|---|---|
| `run.started` | `run`, `level`, `cases[{id, role, vai, question?}]`, `ingestion[{node, variant, chunks, avg_tokens}]` | `question` chỉ có ở ca `visible` |
| `step.started` | `run`, `case`, `node`, `block` | |
| `step.finished` | `run`, `case`, `node`, `block`, `status`, `summary` ≤ 140, `tokens{in, out}`, `ms`, `facts[]` | luôn đi cặp với `step.started` |
| `case.graded` | `run`, `case`, `status`, `passed`, `counted`, `criteria{…: bool}`, `labels[]` | **không** có gold, không có hạng gold |
| `run.scored` | `run`, `score: StarResult` | `stars`, `s1..s3`, `normal_passed/total`, `traps_passed/total`, `tokens`, `budget` |
| `run.finished` | `run`, `report{gold{case: GoldReveal}, diagnosis[]}`, `models{model: số lời gọi có trả lời}` | gold chỉ ở đây (D4); `models` cho biết model nào của chuỗi đã phục vụ |
| `run.failed` | `run`, `code`, `message_vi` | `code`: `index_missing`, `rerank_unavailable`, `llm_not_configured`, `cancelled`, `internal`, `llm_unavailable`, `index_stale` |

| `code` | `message_vi` |
|---|---|
| `llm_unavailable` | Dịch vụ AI đang quá tải hoặc hết lượt hôm nay, lượt này không tính. Hãy thử lại sau. |
| `index_stale` | Index đã cũ so với kho quy chế hoặc bộ câu hỏi. Chủ máy chủ cần chạy lại vgame-build-index. |

Facts: `retrieved{items[{chunk_id, rank, score, doc_id, dieu, khoan, hieu_luc}]}` (metadata, không phải kết luận); `pack{included, dropped, tokens{docs, query, total, budget}}`; `llm{stop_reason, cited_ids, replayed, model, system_tokens, answer?}`.

Nhãn không cần gold trong `case.graded.labels`: `cite_unknown`, `cite_missing`, `abstained`, `stale_doc`, `skipped_budget`, `timeout`, `cancelled`, `llm_error`, `index_error`, `refusal`. Câu hỏi của ca ẩn/bẫy không bao giờ nằm trong sự kiện nào; summary và facts không chứa câu hỏi.

## 9. Level

### 9.1 File `engine/levels/<id>.json` (E viết, D parse bằng `LevelSpec`)

```json
{"id": "grounded-citation", "version": 1, "zone": "library",
 "corpus": ["qcdt-2024"],
 "allowed_blocks": ["input", "output", "corpus", "chunker", "vector_search", "context_packer", "llm"],
 "locked_nodes": ["q", "kb", "ix", "out"],
 "param_limits": {"vector_search.top_k": {"ge": 1, "le": 10}},
 "prompt_cards": {"G1": "…", "G2": "…"},
 "starter_graph": {…}, "reference_graph": {…},
 "naive_graphs": [{"id": "N1", "graph": {…}, "max_stars": 0,
                   "expect": [{"flag": "ret.gold_missing", "cases": ["lib-l1-v01"], "mechanism": "T", "needs_real_models": false}]}],
 "rules": {…LevelRules…},
 "stars_vi": ["…", "…", "…"]}
```

- `expect.flag` thuộc: cờ trong `GoldReveal.flags`, nhãn trong `case.graded.labels`, `budget.exceeded`, hoặc `fail` (ca không đạt). `mechanism`: `T` (test phải bắt) hoặc `M` (chỉ cổng hiệu chỉnh kiểm, test bỏ qua). `needs_real_models: true` = phụ thuộc hạng dense/rerank thật, chỉ chạy ở test `slow`.
- `system_prompt` trong graph là văn bản thẻ ghép bằng `"\n"`, đúng nguyên văn bảng thẻ L1 §5. Ký hiệu `[G1, G2, G3]` dưới đây là viết tắt cho chuỗi đó.
- Test (E): `level.corpus == golden.corpus`; `starter_graph`, `reference_graph`, mọi `naive_graphs` qua validator (kể cả G07); `reference_graph`/`naive_graphs` không bao giờ có trong `public()`.

### 9.2 `PublicLevel` (GET `/api/levels/{id}`)

`id`, `version`, `zone`, `title`/`brief`/`kind` (từ `zones.json`), `corpus`, `allowed_blocks`, `locked_nodes`, `param_limits`, `prompt_cards`, `starter_graph`, `budget_metric: "tokens"`, `token_budget`, `stars_vi`, `visible_cases[{id, vai, question}]`, `case_counts{normal, trap}`. **Không có:** `reference_graph`, `naive_graphs`, `rules.diagnosis`, câu hỏi ẩn, gold, `info_cases`.

### 9.3 L1 `grounded-citation` (kịch bản L1 §5, §6, §10)

- `corpus` `["qcdt-2024"]`; `allowed_blocks` input, output, corpus, chunker, vector_search, context_packer, llm; `locked_nodes` q, kb, ix, out.
- `param_limits`: `vector_search.top_k {ge 1, le 10}`, `vector_search.score_threshold {const 0}` (mở ở L2), `context_packer.token_budget {const 3000}`, `context_packer.on_overflow {const "cat_duoi"}`, `llm.profile {const "can_bang"}`.
- Node khoá: `ix` = `theo_dieu`/512/10, `only_in_force: false`.
- **Starter:** q, kb, ix, `pk {3000, cat_duoi, cite_ids false}`, `llm {can_bang, [G4, G5]}`, out; cạnh `q.query→pk.query`, `pk.context→llm.context`, `llm.answer→out.answer`.
- **Reference:** starter + `vs {top_k 3}` với `q.query→vs.query`, `ix.index→vs.index`, `vs.docs→pk.docs`; `cite_ids true`; `[G1, G2, G3]`.
- **Naive:**

| id | Graph | max_stars | expect |
|---|---|---|---|
| N1 | starter | 0 | T: `ret.gold_missing` trên 8 ca thường; T: `cite_missing` trên 8 ca thường; M: `cite_unknown` |
| N2 | starter + `vs {top_k 5}` nối như reference, `cite_ids false`, `[G4, G5]` | 0 | T: `fail` (tiêu chí `cited` trượt) trên 8 ca thường; M: `cite_unknown` |
| N3 | reference với `[G2]` | — | M: `fail` trên `lib-l1-t01`, `lib-l1-t02` |
| N4 | reference với `top_k 10`, `[G1, G2, G3, G6]` | 1 | T: `budget.exceeded` (run) |
| N5 | reference với `top_k 1` | — | T, `needs_real_models`: `ret.gold_rank` trên `lib-l1-h02`; M: trên `lib-l1-v03`, `h04`, `h05` (đo 2026-10-08, §14) |

- **Rules:** `s1_min_normal 6`, `s1_required ["lib-l1-v01"]`, `token_budget 15000`, `s3_forbidden_labels ["cite_unknown"]`, `info_cases []`, `stale_fails null`, `max_dieu 84`.

### 9.4 L2 `chunk-tuning` (kịch bản L2 §5, §6, §10)

- `corpus` `["qcdt-2024", "qcdt-2019"]`; `allowed_blocks` như L1; `locked_nodes` q, kb, out (ix mở).
- `param_limits`: `vector_search.top_k {ge 1, le 10}`, `vector_search.score_threshold {ge 0, le 0.9, multiple_of 0.05}`, `context_packer.token_budget {const 3000}`, `context_packer.on_overflow {const "cat_duoi"}`, `llm.profile {const "can_bang"}`. `chunker.only_in_force` mở (E6).
- **Starter:** reference L1 với `ix {co_dinh, 128, 0, only_in_force false}`, `vs {top_k 3, score_threshold 0}`.
- **Reference:** `ix {theo_dieu, 512, 10, only_in_force true}`, `vs {top_k 3, score_threshold 0}`, `cite_ids true`, `[G1, G2, G3]`.
- **Naive:**

| id | Graph | max_stars | expect |
|---|---|---|---|
| N1 | starter | 0 | T: `ret.boundary_split` trên `lib-l2-v02`, `lib-l2-h03`, `lib-l2-h04`; T, `needs_real_models`: `ret.stale_doc` trên `lib-l2-t01`, `t02`, `t03`; M: `ret.gold_missing` trên `lib-l2-v01` (đo 2026-10-08, §14) |
| N2 | `ix {co_dinh, 1024, 0, false}`, `vs {top_k 10}` | 1 | T: `pack.dropped` khác rỗng ở mọi ca (kiểm qua fact `pack`); T: `budget.exceeded`; T, `needs_real_models`: `stale_doc` trên `t01`, `t02`, `t03` |
| N3 | `ix {theo_dieu, 512, 10, false}`, `vs {top_k 3}` | 2 | T, `needs_real_models`: `stale_doc` trên `t01`, `t02`, `t03` |
| N4 | reference với `score_threshold 0.8` | 0 | T, `needs_real_models`: `ret.gold_missing` trên đa số ca thường (xem câu hỏi mở 7) |
| N5 | `ix {co_dinh, 256, 20, true}`, `vs {top_k 1}` | — | T, `needs_real_models`: `ret.gold_missing` trên `lib-l2-v01`, `lib-l2-h01`, `lib-l2-h02` |

- **Rules:** `s1_min_normal 8`, `s1_required ["lib-l2-v01"]`, `token_budget 20000`, `s3_forbidden_labels ["stale_doc"]`, `info_cases []`, `stale_fails {roles ["trap"], vai ["van-ban-cu", "da-bai-bo"]}`, `max_dieu 84`.

### 9.5 L3 `article-number-lookup` (kịch bản L3 §5, §6, §10)

- `corpus` `["qcdt-2024"]` (D7); `allowed_blocks` L2 + `bm25_search`, `fusion`, `rerank`; `locked_nodes` q, kb, out.
- `param_limits` nguyên văn kịch bản L3 §5: `vector_search.top_k {1..5}`, `bm25_search.top_k {1..10}`, `fusion.top_k {1..10}`, `fusion.k {1..100}`, `rerank.top_n {1..5}`, `context_packer.token_budget {const 3000}`, `context_packer.on_overflow {const "cat_duoi"}`, `llm.profile {const "can_bang"}`; thêm `vector_search.score_threshold {ge 0, le 0.9, multiple_of 0.05}` và `fusion.alpha {multiple_of 0.1}`.
- **Starter:** reference L2 (`theo_dieu`/512/10, `only_in_force true`, `vs top_k 3`).
- **Reference:** nguyên văn JSON kịch bản L3 §5 + node `kb`, `ix.only_in_force false`: `vs {top_k 5}`, `bm {top_k 5}`, `fu {rrf, k 60, top_k 10}`, `rr {top_n 3}`, `pk {3000, cat_duoi, cite_ids true}`, `llm {can_bang, [G1, G2, G3]}`.
- **Naive:**

| id | Graph | max_stars | expect |
|---|---|---|---|
| N1 | starter | 0 | T, `needs_real_models`: `ret.gold_rank` (vector) trên `lib-l3-v01`, `v02`, `h01`, `h02`, `h03` |
| N2 | starter với `vs top_k 5` | 0 | như N1 |
| N3 | reference bỏ `vs`, `fu`, `rr`; `bm {top_k 10}` → `pk.docs` | — | T (BM25 tất định, không cần model): `ret.gold_missing` trên `lib-l3-t01` |
| N4 | `vs {5}` và `bm {10}` cùng nối thẳng `pk.docs` (không fusion) | 1 | T: `budget.exceeded`; T: `pack.dropped` khác rỗng ở ≥ 1 ca |
| N5 | reference bỏ `rr`, `fu.docs→pk.docs` | 1 | T: `budget.exceeded` |
| N6 | reference với `fu {alpha, alpha 0.8, top_k 3}`, bỏ `rr` | 0 | T, `needs_real_models`: `ret.gold_rank` (fusion) trên `lib-l3-v01` |
| N7 | reference với `ix {co_dinh, 128, 0}`, `rr {top_n 1}` | — | T (không cần model): `fail` và `ret.gold_missing` trên `lib-l3-t02` (đo 2026-10-08, §14) |
| N8 | reference bỏ `rr`, `fu {rrf, 60, top_k 3}` | — | M: `ret.gold_rank` (fusion) trên `lib-l3-h04`, `h05` |

- **Rules:** `s1_min_normal 8`, `s1_required ["lib-l3-v01"]`, `token_budget 22000`, `s3_forbidden_labels []`, `info_cases ["lib-l3-t03"]`, `stale_fails null`, `max_dieu 84`.

Giới hạn `vector_search.top_k ≤ 5` và mọi hạng là **tạm**; cổng hiệu chỉnh (hoãn) thay bằng số đo. Ngân sách 15k/20k/22k đã hiệu chỉnh với Gemini thật ngày 2026-10-08 (§14, khối "hiệu chỉnh" và khối "sửa lỗi vòng 1": L1 14k → 15k).

## 10. Chấm (B)

**Chuẩn hoá** (golden `grading.normalize`): NFC → chữ thường → dấu phẩy giữa hai chữ số thành dấu chấm → bỏ dấu câu khác (giữ `%` và dấu chấm giữa hai chữ số) → gộp khoảng trắng. Áp như nhau cho câu trả lời, `answer_points`, `equivalents`, `forbidden`, `refusal_markers`. So khớp = chuỗi con sau chuẩn hoá.

**Tập đoạn gold** của một ca (sau run, theo biến thể của index mà retriever dùng): mỗi `quote` → `find_quote` → mọi `Chunk` của handle có khoảng `[start, end)` **chứa trọn** quote (golden `grading.answer`: "tập đoạn chứa một quote"). Một mảnh của quote bị cắt đôi, hay một đoạn chỉ chạm dấu chấm cuối của quote, không phải đoạn gold. `ret.boundary_split`: một quote không nằm trọn trong đoạn nào của biến thể.

**Ca `answer` đạt** khi cả bốn: `points` (mọi `answer_points` hoặc một cách viết trong `equivalents[mục]`); `cited` (≥ 1 `cited_id` thuộc tập đoạn gold **và** nằm trong `pack.included`); `no_fabrication` (không `cite_unknown`); `no_forbidden`.

**Ca `abstain` đạt** khi: `refusal` (có ≥ 1 `refusal_markers`), `no_fabrication`, `no_forbidden`. Được trích đoạn có thật trong thùng.

**L2 `stale_fails`:** ca có `role ∈ roles` hoặc `vai ∈ vai` còn cần `no_stale` (không đoạn `hieu_luc = false` trong `pack.included`).

**Nhãn không cần gold:**
- `cite_unknown`: có `cited_id` không thuộc `pack.included`; **hoặc** một vế (tách theo `.`, `!`, `?`, `;`, xuống dòng, "nhưng", "tuy nhiên") **không** chứa dấu hiệu từ chối có `theo điều N` hoặc `điều N quy định` (sau chuẩn hoá) với N không là `dieu` của đoạn nào trong thùng.
- `cite_missing`: không có `cited_id` nào. `abstained`: có dấu hiệu từ chối. `stale_doc`: thùng có đoạn `hieu_luc = false`. Cùng nhãn trạng thái ca (`skipped_budget`, `timeout`, `cancelled`, `llm_error`, `index_error`, `refusal`).

**Cờ cần gold** (chỉ trong `run.finished.report.gold`): `ret.gold_missing` (có quote mà các đoạn đi vào packer, gộp lại, không phủ kín `[start, end)`; khoảng trắng giữa hai đoạn liền nhau tính là phủ; hai mảnh của một quote bị cắt đôi cùng vào packer vẫn tính là tới), `ctx.gold_dropped` (quote được phủ kín bởi các đoạn vào packer nhưng không bởi `pack.included`), `ret.gold_rank` (đoạn gold tốt nhất có hạng > số lấy về của retriever đó; hạng ở retriever gốc tính trên **toàn kho** bằng `top_k=None`), `ret.boundary_split`. `budget.exceeded` là cờ cấp run. Ca chưa chạy (không có bước nào: hết hạn run trước khi bắt đầu, hoặc bị bỏ vì `DailyCap`) không có cờ truy xuất và không có chẩn đoán, chỉ có mục gold.

**Sao** (ca thường = `visible` + `hidden`; ca bẫy = `trap` không thuộc `info_cases`):
- s1 = số ca thường đạt ≥ `s1_min_normal` và mọi `s1_required` đạt.
- s2 = s1 và tổng `tokens` của run ≤ `token_budget`.
- s3 = s1 và mọi ca bẫy được tính đều đạt và không ca nào có nhãn trong `s3_forbidden_labels`.
- `stars = s1 + s2 + s3` (s2, s3 chỉ tính khi có s1).

**Chẩn đoán:** mỗi ca trượt chọn **một** cờ theo thứ tự ưu tiên `cite_unknown` → `ret.boundary_split` → `ret.gold_rank` → `ret.gold_missing` → `ctx.gold_dropped` → `stale_doc` → `cite_missing` → `trap.failed`; cộng `budget.exceeded` cấp run. Khoá mẫu trong `rules.diagnosis`: `ret.gold_missing`, `ret.gold_rank:vector_search`, `ret.gold_rank:bm25_search`, `ret.gold_rank:fusion`, `ret.boundary_split`, `ctx.gold_dropped`, `ret.stale_doc`, `llm.cite_missing`, `llm.cite_unknown`, `trap.failed`, `regression`, `budget.exceeded`. E chép **nguyên văn** câu của cô Lan ở kịch bản §11 của từng level vào đó. Render bằng thay `{tên}` theo regex `\{(\w+)\}` từ dict biến do engine tính (không `str.format`, biến lạ giữ nguyên). Biến: `n` (số thứ tự ca trong file golden, từ 1), `dieu`, `rank`, `k`, `pack_tokens`, `m`, `cite`, `dieu_list`, `max_dieu`, `tokens`, `budget`, `avg_docs`, `avg`, `pct`, `a`, `b`, `k1`, `k2`, `rank_dense`, `d1`, `d2`, `s1`, `s2`, `rank_bm25`, `r_fu`, `r_rr`, `ms`, `flag`. Mẫu của ca ẩn/bẫy không được chứa câu hỏi.

## 11. Các sửa lỗi phản biện chạm tới Thư viện

| Phản biện | Áp dụng ở v0.2 |
|---|---|
| (high) Guard + fan-in làm output chạy hai lần | Không có guard (E13). DAG tĩnh, barrier fan-in, một `output`; test compiler hình dạng nhánh lệch (`q→rr` cùng `q→vs→fu→rr`) assert `output` chạy đúng một lần mỗi ca. |
| (high) G07 chặn starter | G07 đếm lời gọi theo cấu trúc (E12); `RunBudget` là trần thật; test mọi graph trong 3 file level qua G07. |
| (medium) `only_in_force` chỉ ở vector, BM25 kéo bản 2019 | Lọc ở tầng Index cho mọi retriever (E6) **và** kho L3 không có bản 2019 (E7, D7). |
| (medium) Bẫy phụ thuộc model chưa đủ | Mỗi `expect` khai `mechanism` T/M; test chỉ assert T; M để cổng hiệu chỉnh (hoãn). `lib-l3-t03` là `info_cases`. |
| (low) Đếm cache 2 lần | `Usage.tokens = input + output` (E2), test usage có cache. |
| (low) Lời hứa chống quay số | Bỏ; replay chỉ là cache chi phí (E10). |
| (low) Cổng L3 "dense trượt" không nói top_k | Cổng đo ở `top_k` tối đa của `param_limits` L3 (5). |
| (low) Làm ấm cache, "cache hit 0 %" | Bỏ (E11). |
| (low) `reorder_docs` không có hệ quả | Không đưa vào v0.2. |
| (low) "Bộ luật Thị trấn" | Engine dùng `qcdt-2024`/`qcdt-2019` của Trường Đại học Sao Mai (D6). |

## 12. Hoãn lại (có trần)

| Mục | Trần hiện tại | Khi nào nâng cấp |
|---|---|---|
| Run store, event log | RAM, 200 run, mất khi restart, một tiến trình | Postgres `run`/`run_event` + Redis pub/sub khi có >1 worker hoặc cần lưu tiến độ |
| Replay cache | sqlite cục bộ | bảng Postgres `llm_replay` khi deploy nhiều instance |
| `DailyCap` | đếm trong RAM theo ngày UTC | Redis `INCR`+TTL khi >1 tiến trình |
| Index | file `.npy`/`.json` trong cache, nạp hết vào RAM (vài MB) | pgvector khi kho > ~100k đoạn |
| Nội dung | đọc `docs/content` từ repo (`CONTENT_DIR`) | đóng gói vào image khi deploy Docker |
| Rerank cache | dict không giới hạn | LRU khi câu hỏi tự do của người chơi xuất hiện |
| Cổng hiệu chỉnh 3/3 với model thật, `needs_real_models` | test `slow` thủ công | script `vgame-calibrate` trước khi mở level cho lớp |
| Gợi ý, menu "Vì sao", phiếu đoán | chưa có | frontend v0.3 dùng `report` + `case.graded` |

## 13. Kế hoạch test

| Builder | Test bắt buộc (không mạng, không model thật) |
|---|---|
| A | nạp 2 văn bản: 84 điều liên tục, Điều 12 có 3 khoản, Điều 41 có 4 khoản; mọi `quote` của 3 golden là chuỗi con; 24 biến thể: id không trùng, `theo_dieu`/512/10 giữ trọn Điều 12 trong một đoạn, `co_dinh`/128/0 tách quote của `lib-l2-v02`; `IndexStore.build/save/load` khứ hồi với `HashingEmbedder`; handle L1 không có đoạn 2019, `only_in_force` loại 2019; BM25: `lib-l3-t01` không có Điều 12 trong top 10 trên mọi biến thể, `lib-l3-v01` có Điều 47 khoản 2 trong top 3 ở `theo_dieu`/512/10; RRF/alpha/rerank trên dữ liệu tay; CLI chạy được với embedder giả (tham số ẩn cho test). Một test `@pytest.mark.slow` dùng model thật. |
| B | chuẩn hoá (dấu phẩy thập phân, `%`, NFC); equivalents; abstain có trích đoạn thật vẫn đạt; `cite_unknown` theo mã lạ và theo "theo Điều 99"; câu từ chối không bị tính `cite_unknown`; L2 `stale_fails`; tập đoạn gold và `boundary_split` trên chunk tay; hạng toàn kho; sao: s2/s3 không tính khi thiếu s1, `info_cases` không tính; mẫu chẩn đoán không dùng `str.format` (mẫu chứa `{0}` hay `{__class__}` vô hại). |
| C | `render_docs`/`build_request` (không có "Tài liệu" khi thùng rỗng; chữ người chơi chứa `{x}` giữ nguyên); `parse_citations`; `pack` cắt đuôi, bỏ trùng, thứ tự cạnh; replay: trúng cache trả usage gốc + `replayed`, khoá đổi khi profile/frame đổi; `RunBudget` lời gọi thứ 13 bị chặn; `DailyCap` đổi ngày thì reset; Gemini adapter test bằng client SDK giả (monkeypatch), ánh xạ `finish_reason`, usage có `thoughts_token_count` và `cached_content_token_count`, retry một lần 503, không retry 429/504/400, không có key → `LLMNotConfiguredError`, message lỗi không chứa key. |
| D | registry contract (schema, cổng, summarize ≤ 140, concepts); validator kiểu bảng cho P01–P03, G01–G07, I01, `W_RERANK_NOOP`, locked node bị client sửa thì bị chèn lại; payload độc (`{__class__}`, 1 MB, NUL, bidi, SQL) bị từ chối hoặc vô hại; compiler golden (node + cạnh) cho reference L1/L3; `output` chạy đúng 1 lần; runtime với `FakeLLM`: started/finished đi cặp khi ok, timeout (FakeLLM `delay_s` + hạn nhỏ), budget, `llm_error`, `refusal`, huỷ; tối đa 3 ca song song; ca ẩn không lộ câu hỏi trong mọi sự kiện; run store: `Last-Event-ID` phát lại đúng, trần run đồng thời. |
| E | 3 file level qua validator; `public()` không lộ reference/naive/gold; e2e với `Oracle` + `HashingEmbedder` + `OverlapReranker` trên kho thật: mọi `expect` có `mechanism T` và `needs_real_models false` sinh đúng cờ; API: POST run → SSE đủ chuỗi sự kiện, không key → 503 tiếng Việt, payload xấu → 422 gom lỗi, CORS cho POST. Test `slow`: reference 3 sao với Oracle + model thật, cùng các `expect` `needs_real_models`. |

Lệnh: `uv run ruff check`, `uv run ruff format --check`, `uv run mypy src tests`, `uv run pytest -q` (mặc định bỏ `slow`; chạy `uv run pytest -m slow` sau khi `uv run vgame-build-index`).

## 14. Chủ dự án cần quyết

1. **Key Gemini:** đặt `GEMINI_API_KEY=…` trong `backend/.env` (đã gitignore, test không đọc). Mặc định `DAILY_LLM_CALL_CAP=500` lời gọi/ngày, `MAX_CONCURRENT_RUNS=1`: tối đa 13 lời gọi LLM mỗi run; mỗi lời gọi tối đa 4 lần gọi mạng (3 model của chuỗi mặc định + 1 lần thử lại 500/502), nên tối đa 52 lần mỗi run tính vào `DAILY_LLM_CALL_CAP` (thực tế ít hơn: model bị 429/503 nghỉ, lời gọi sau không thử lại nó). Nên xoay key sau đợt thử.
2. **Model:** `gemini-3.8-flash` với 3 mức thinking (E1). Nếu muốn rẻ hơn: `gemini-3.5-flash-lite` (cần hiệu chỉnh lại ngân sách).
3. **Model truy xuất:** multilingual-e5-large tải khoảng 2,2 GB về `backend/.cache`. Reranker `jina-reranker-v2-base-multilingual` có giấy phép **CC-BY-NC-4.0** (phi thương mại): chấp nhận cho pilot, hay chọn model khác?
4. **`only_in_force` chuyển sang `chunker`** (E6): kịch bản ghi "Kính lọc → `vector_search.only_in_force`", cần sửa ở kịch bản/frontend khi tới lượt.
5. **Ngân sách thùng không gồm system prompt** (E8): thanh token vẫn hiện "Dặn dò" từ bước `llm`.
6. **Bẫy `cau-dai` ở 128/0:** với tokenizer thực tế (regex-v1 và XLM-R), khoảng cách mục bắt buộc của Điều 68 là 125 và Điều 25 là 118–120 token (README ước 140/137 bằng o200k), nên "luôn tách" không còn chắc cho `lib-l2-v02` và `lib-l2-h04`. Người viết nội dung kéo dài hai khoản đó thêm khoảng 15 âm tiết, hoặc chấp nhận để cổng hiệu chỉnh đo.
7. **Ngưỡng 0,8 của L2-N4:** cosine của e5 dồn trong khoảng 0,7–0,9, nên ngưỡng 0,8 có thể không làm thùng rỗng. Cổng hiệu chỉnh đo, có thể đổi N4 sang 0,9.
8. **BM25 không bỏ dấu** (E9): giữ bẫy `lib-l3-t01` nhưng `lib-l3-h03` (gõ không dấu "khoan 2 dieu 10") chỉ còn khớp chữ số. Đề nghị người viết nội dung đổi h03 sang có dấu, hoặc chấp nhận để đo.
9. **`forbidden` trong câu từ chối** (corpus README câu hỏi mở 10): engine áp nguyên văn luật golden ("không chứa mục nào của `forbidden`"), nên câu "không có Điều 99 quy định…" sẽ trượt `lib-l1-t01`. Đề nghị bỏ "Điều 99 quy định", "khoản 9 quy định", "khoản 6 quy định" khỏi `forbidden` và dựa vào `cite_unknown`; cần người viết nội dung sửa golden.
10. **Docker** chưa chạy được engine (thiếu `docs/content` và cache model trong image): chấp nhận cho v0.2 (chạy local)?

**Trạng thái 2026-10-08 · nội dung** (golden, kịch bản, naive; mục 4, 5, 8, 9 ở trên và việc mở L1-N5, L2-N1, L3-N7, sao L3). Đo bằng e5 + jina-v2 thật từ `backend/.cache/engine` (index chưa dựng lại, câu hỏi mới embed trong RAM), LLM `Oracle`, 0 lời gọi Gemini; cùng khung với test `slow` e2e.

- **Mục 9, `forbidden` trong câu từ chối: đã sửa golden.** Bỏ "Điều 99 quy định" (`lib-l1-t01`), "khoản 9 quy định" (`lib-l1-r02`), "khoản 6 quy định" (`lib-l3-t03`). Trích bịa vẫn trượt: "theo Điều 99" / "theo khoản N" còn trong `forbidden`, câu khẳng định "Điều 99 quy định …" bị `cite_unknown`, thiếu dấu hiệu từ chối thì trượt `refusal`. Test `test_grade_abstain_case` và `test_refusal_naming_the_missing_clause_passes_and_a_fabrication_fails` trượt trước khi sửa golden, đạt sau. `grading.py` không đổi.
- **Mục 8, h03 không dấu: đã sửa golden.** `lib-l3-h03` = "khoản 2 điều 10 ghi gì ạ" (cùng nghĩa, giữ kiểu chữ thường nhắn tin). Ở `theo_dieu`-512-10: BM25 hạng 4 (trước: 8), dense 65, RRF 7, rerank 1; ca này đạt trong lời giải mẫu.
- **Mục 4, 5, kịch bản: đã sửa.** Kính lọc → `chunker.only_in_force` ở kịch bản L2, L3, `library.md`, corpus README. Thùng 3.000 token chỉ tính tài liệu + câu hỏi, dặn dò đi riêng (L1 §5, §15; L2 §5; L3 §6 N5; `library.md`). Dòng `budget.exceeded` của L1-N4, L2-N2, L3-N5 trong kịch bản ghi [M] theo §15; số đo token thật thuộc việc hiệu chỉnh ngân sách.
- **L1-N5: giữ graph, đổi nhãn.** `ix` khoá `theo_dieu`/512/10 và `top_k` 1 đã là sàn, không còn gì để đổi. Expect: T, `needs_real_models` `ret.gold_rank` trên `lib-l1-h02`; M trên `v03`, `h04`, `h05`. Số đo: N5 thật 2 sao (6/8), `ret.gold_rank`/`ret.gold_missing` chỉ bật ở h01, h02. Dense hạng 1 ở v03, h04, h05 (cosine 0,865 / 0,843 / 0,856 trên đúng điều). h02: Điều 10 (học kỳ chính, 0,865) trên Điều 19 (học kỳ phụ, 0,863), hạng ≥ 2 ở 24/24 biến thể. h01 (không dấu) hạng 3 nhưng cách 0,001 và chỉ ở `theo_dieu` ≥ 512, không assert. Lời giải mẫu L1 vẫn 3 sao (8/8, 6.920 token Oracle). Golden: `h02.bites` thêm N5.
- **L2-N1: giữ graph, đổi nhãn.** N1 phải trùng starter (kịch bản L2 §6 "Khởi đầu"). `ret.gold_missing` trên `lib-l2-v01` → M. Số đo: N1 thật 0 sao (3/10 thường); `boundary_split` [T] bật ở v02, h03, h04 (và h01, h02, h05); `stale_doc` bật ở t01, t02, t03. v01 không có cờ: hạng phủ đủ 3 (đoạn 2019 hạng 1), nên top 3 có cả hai khoản và đoạn cũ; v01 trượt hay không tuỳ model đọc nhầm số liệu 2019. Đã đo và bỏ: `vs.top_k` 2 làm cắn v01 và giữ mọi kỳ vọng khác, `top_k` 1 cắn v01 nhưng mất `stale_doc` ở t01; cả hai không còn là starter. Bài thiếu khoản 3 tất định nằm ở L2-N5 (cắn v01, h01, h02 với model thật).
- **L3-N7: đổi graph.** `rr.top_n` 3 → 1, giữ `ix {co_dinh, 128, 0}`. Expect: T, không cần model: `fail` và `ret.gold_missing` trên `lib-l3-t02`; N7 giờ chạy trong test nhanh (`test_naive_graph_produces_its_deterministic_flags`). Ở `co_dinh`-128-0 không đoạn nào chạm cả câu trích k2 lẫn k3, nên một đoạn trong thùng luôn thiếu một khoản. `top_n` 3 và 2 không cắn (rerank đưa đoạn k2, k3 lên #1, #2); `top_n` 1 cắn với model thật (0 sao, t02 có `ret.gold_missing`, `ret.gold_rank`) và với double nhanh. Đối chứng: lời giải mẫu với `top_n` 1 ở `theo_dieu`-512-10 vẫn đạt t02, nên hồi quy đến từ cách cắt. Cờ là `ret.gold_missing`, không phải `ret.boundary_split`, vì mỗi câu trích vẫn nằm trọn trong một đoạn.
- **Lời giải mẫu L3 2 sao → 3 sao: chọn (a), viết lại `lib-l3-t01`** thành "Em tính nghỉ ở nhà một thời gian để đi làm kiếm tiền, điểm số và kết quả học tập có giữ lại được không, sau này quay lại thì sao ạ?". Không đổi `reference_graph`, trần `vector_search.top_k` ≤ 5, `info_cases ["lib-l3-t03"]`, chấm. Số đo lời giải mẫu: S0 golden cũ 2 sao (8/10; h03, h07, t01 trượt). S1 = h03 có dấu: 2 sao (9/10). S2 = S1 + trần dense 10, phương án (b): vẫn 2 sao, t01 dense hạng 13 > 10. S3 = S1 + t01 thành `info`, phương án (c): lời giải mẫu 3 sao, nhưng đồ thị chỉ BM25 (bm10→rr3, bm5→rr3, bm10→rr5) cũng 3 sao (9/10), trái bài học "Giữ cả Vòm Sao lẫn Tủ ngăn kéo"; loại. S4 = S1 + t01 mới: 3 sao (9/10, bẫy 2/2, 11.758/30.000 token Oracle). t01 mới ở `theo_dieu`-512-10: BM25 36, dense 1, RRF 2, rerank 1; dense và rerank hạng 1 trên cả 12 biến thể `theo_dieu`; BM25 hạng ≥ 15 trên mọi biến thể `theo_dieu` và `co_dinh` ≤ 256, nên `test_bm25_misses_the_paraphrase_trap_lib_l3_t01` vẫn đạt (hạng thấp nhất 15). Đồ thị không có dense dưới 3 sao: N3 1 sao, bm10→rr3 2, bm5→rr3 2; ở `co_dinh`-128 được 0, ở 256 tối đa 2. Chỉ dense (N1, N2) 0 sao. Hybrid không rerank với `fusion.top_k` 5 cũng 3 sao, `top_k` 3 được 0, khớp mục tiêu 2 "quyết định có cần xếp hạng lại". 12 câu viết lại không trùng chữ lên dense hạng 1–2 nhưng jina-v2 xếp rerank 5–10 hoặc rơi khỏi `theo_dieu`-512-10, nên bị loại. h07 vẫn trượt ở rerank hạng 4 (level cho 9/10).
- **Phát hiện phụ** (cho hiệu chỉnh ngân sách và chủ dự án; token là của Oracle): L3-N8 [M] không cắn (h04, h05 hạng 1 ở cả dense và BM25). L3-N4 được 2 sao với model thật, cao hơn `max_stars` 1 (trường này chỉ là dữ liệu, không có test). L3-N5 tốn 27.307/30.000 và được 3 sao, nên `budget.exceeded` tuỳ token ra thật. Cổng "dense trượt `tra-so` ở trần `top_k` trên cả 24 biến thể" (kịch bản L3 §5) đã vỡ ở `co_dinh`-1024 ngay với ≤ 5 (v01 hạng 2 ở 1024-10, h01 hạng 2); nâng trần lên 10 sẽ vỡ rộng hơn.
- **Còn phải làm:** dựng lại index (`uv run vgame-build-index`) vì câu `lib-l3-t01`, `lib-l3-h03` đổi; test `slow` cần index mới.

**Trạng thái 2026-10-08 · backend** (mục 2 ở trên, các mục "Còn mở" của §15, model dự phòng). Test nhanh: 470 đạt (`ruff`, `mypy` sạch). Mỗi sửa lỗi có test trượt trước, đạt sau. 6 lời gọi Gemini thật (đều qua `GeminiClient` + `DailyCap`), không lời gọi nào ra 429.

- **Mục 2, model: `gemini-3.5-flash-lite` là mặc định** (`config.py`, `.env.example`, README; `GEMINI_MODEL` vẫn ghi đè). Bằng chứng: spike 3.0 `gemini-3.8-flash` chỉ trả 429/503/504 (20 lượt/ngày của key đã hết), spike 3.0b `gemini-3.5-flash-lite` cho lời giải mẫu L1 3 sao, 10.262/22.000 token. E1 đổi theo: một chuỗi model, không còn một model.
- **Chuỗi model dự phòng (`llm.py`).** `GEMINI_MODEL` rồi `GEMINI_FALLBACK_MODELS` = `gemini-3.1-flash-lite, gemini-3.5-flash` (3.7-flash bỏ ở khối "sửa lỗi vòng 1"). Kiểm `thinking_level` (engine gửi LOW/MEDIUM/HIGH):
  - ai.google.dev (trang thinking): 3.5-flash-lite, 3.5-flash có minimal–high; 3.7-flash có low–high. Trang model 3.1-flash-lite ghi "Thinking: Supported" với ví dụ `thinking_level`, không liệt kê mức.
  - Gọi thật một lần, `can_bang` → MEDIUM: 3.1-flash-lite và 3.5-flash trả lời (`stop=end`).
  - 3.7-flash: 504, lần sau hết 20 s (`ReadTimeout`). 504 ở đây là hạn 20 s phía server do chính engine gửi (`X-Server-Timeout`, khối "sửa lỗi vòng 1"), nên chỉ biết model này không trả lời trong 20 s; đã bỏ khỏi chuỗi.
  - **`gemini-2.5-flash` bị loại:** trang thinking ghi low/medium/high nhưng API trả `400 INVALID_ARGUMENT: Thinking level is not supported for this model.`
- **Giới hạn RPM phía client.** Mỗi model có cửa sổ trượt 62 s (60 s của provider + 2 s biên), dùng chung cho mọi ca và mọi run của tiến trình. Mặc định theo bảng hạn mức của chủ dự án: 3.5-flash-lite, 3.1-flash-lite 15; 3.8-flash, 3.5-flash, 3.7-flash, 2.5-flash 5; model lạ 5. Đổi bằng `GEMINI_RPM=model=rpm,…`.
  - Chỉ giới hạn số lời gọi: 15 lời gọi/phút × tối đa ~3,6k token vào mỗi lời gọi (thùng 3.000 ở mọi level + dặn dò + câu hỏi) ≈ 54k token/phút, dưới 250K. Một run đo được 11k–42k token.
  - Không đếm RPD phía client: hạn mức ngày được nhận ra từ lỗi 429.
  - Model có chỗ trống trước `hạn ca − MIN_CALL_S[model]` thì lời gọi chờ chỗ đó; muộn hơn thì nhường model kế tiếp, không chờ. Không còn đủ thời gian cho model nào thì không gọi mạng, bước và ca là `timeout` (khối "sửa lỗi vòng 1").
  - Runtime đặt `llm.case_deadline` (ContextVar) cho từng ca.
- **429/RESOURCE_EXHAUSTED hoặc 503 → nghỉ rồi chuyển model.** Model bị nghỉ theo `RetryInfo.retryDelay` của lỗi (không có thì 60 s). Nếu `QuotaFailure.quotaId` chứa `PerDay`, model nghỉ tới nửa đêm giờ Thái Bình Dương: tính theo luật DST của Mỹ, vì Windows thiếu tzdata cho zoneinfo. Cùng lời gọi đi tiếp sang model sau.
  - 500/502 thử lại một lần trên cùng model. 504, 4xx và lỗi mạng không thử lại.
  - Mọi model đều nghỉ hoặc bận: `LLMCallError(429)` không gọi mạng. Run không có câu trả lời nào thì kết thúc `run.failed{llm_unavailable}` với câu tiếng Việt cũ.
  - `DailyCap` vẫn đếm mọi lần gọi mạng. Log chỉ ghi `model`, `status`, `cooldown_s`, không ghi thân lỗi.
- **Ghi model đã phục vụ.**
  - `LLMResponse.model` (fact `llm.model` của `step.finished`) là id trong chuỗi, không còn là `model_version`.
  - `run.finished.models` = `{model: số lời gọi có trả lời}`.
  - Khoá replay dùng model đã phục vụ. Khi tra, engine thử lần lượt các model của chuỗi theo thứ tự, nên câu trả lời cũ của model dự phòng vẫn được dùng lại.
  - Test (client SDK giả, đồng hồ giả) cho: giãn cách của limiter, chuyển model khi 429/503, tôn trọng thời gian nghỉ, hết hạn mức ngày, mọi model cạn → `llm_unavailable`.
- **§15 "Còn mở", đã đóng:**
  - **SSE heartbeat:** sau 15 s không có sự kiện, gửi dòng chú thích `: ping`. Lượt đọc đang chờ được giữ qua các nhịp ping, vì huỷ nó sẽ đóng generator.
  - **Lỗi index trong một bước** (ví dụ câu hỏi chưa embed) giờ là `index_error`, không phải `llm_error`, ở cả `step.finished` và `case.graded`. `EngineError.step_status`; `compiler.py` sửa một dòng. Không tính là provider sập.
  - **Usage của bước lỗi** (Gemini `OTHER`) giờ được cộng vào `CaseTrace.usage`: lấy từ `RunBudget.case_usage`, nên sao 2 đếm cả token đã bị tính phí.
  - **Index cũ:** lúc khởi động, so `manifest.corpus_sha256` với kho và kiểm mọi câu golden đã embed. Lệch thì không nạp index (cả reranker) và POST trả `503 index_stale`: "Index đã cũ so với kho quy chế hoặc bộ câu hỏi. Chủ máy chủ cần chạy lại vgame-build-index." Đo trên index thật hôm nay: `IndexStaleError: 2 golden questions not in the index` (t01, h03 vừa viết lại). Server và `spike_*.py` từ chối chạy cho tới khi dựng lại index.

**Trạng thái 2026-10-08 · hiệu chỉnh** (mục "Còn phải làm" của khối nội dung, hiệu chỉnh ngân sách L2/L3, kiểm [M] `budget.exceeded`, kiểm mục 3/5/6/9 với model thật). Số đo đầy đủ: [engine-spike-report §3.2](engine-spike-report.md).

- **Index đã dựng lại** (`HF_HUB_OFFLINE=1 uv run vgame-build-index`, 1.991 s trên máy dev, 47 câu hỏi): server không còn `index_stale`.
- **`uv run pytest -m slow`: 13/13 đạt.**
  - Lời giải mẫu 3 sao với e5 + jina-v2 thật và Oracle ở cả ba level (mục 6: L3 3 sao sau khi viết lại `t01`).
  - Các kỳ vọng `needs_real_models` đều cắn: L1-N5 (h02), L2-N1…N5, L3-N1, N2, N6 (mục 5).
  - `test_real_models_rank_the_anchor_questions` đạt; h03 có dấu (mục 3) đạt trong lời giải mẫu.
  - Sau khi hạ ngân sách: lần đầu, lúc máy bận (225 s), test lời giải mẫu L3 không đủ 3 sao (bộ slow 12/13 đạt); ba lần sau đều đạt (riêng test đó 1/1, e2e 12/12, cả bộ 13/13); nhiều khả năng ca hết hạn 20 s vì rerank CPU (chưa xác nhận).
- **Gemini thật: 85 lần gọi mạng** (cộng 6 của builder backend là 91 ≤ 100), 84 có trả lời, 1 lỗi 504, không có 429/503. Mọi lời gọi qua `GeminiClient` + limiter + `DailyCap` của engine (`scripts/spike_llm.py`, giờ nhận kế hoạch run tuỳ ý).
- **Ngân sách sao 2 = làm tròn lên tới nghìn của 1,25 × p50 token lời giải mẫu** (quy tắc kịch bản §10, `library.md`), model `gemini-3.5-flash-lite`, `can_bang`:
  - L1: mẫu 10.262 (3.0b) và 11.260 → 14.000 (trước 22.000); nâng lên **15.000** ở khối "sửa lỗi vòng 1".
  - L2: 15.879 → **20.000** (trước 30.000).
  - L3: 17.348 → **22.000** (trước 30.000). Mẫu thứ hai chạy dồn (17.117, thiếu `h07` vì 504) không tính; tính vào vẫn ra 22.000.
  - Mẫu cao nhất bằng 79–80 % ngân sách. Phần vào gần như tất định; phần ra (thinking) dao động mạnh, ví dụ cùng prompt L3 `v01` ra 74 rồi 528 token. L1 áp cùng quy tắc vì 22.000 cũng là số tạm của quy tắc này (`library.md` "tạm 22k / 30k / 30k"); câu "22.000 đứng vững" của spike 3.0b chỉ nói lời giải mẫu nằm dưới.
  - L1 mới có 2 mẫu, L2 và L3 có 1 mẫu đầy đủ (kịch bản đòi 3). Cổng `vgame-calibrate` (§12) thêm mẫu trước khi mở level cho lớp.
- **[M] `budget.exceeded` đã kiểm và trở lại [T]** (đảo lại thay đổi ở §15, khớp bảng §9.3–9.5):
  - Model thật vượt cả ngân sách cũ: L1-N4 29.091 (2 sao), L2-N2 41.664 (0 sao), L3-N5 35.803 (2 sao).
  - Ở ngân sách mới, token đầu vào `regex-v1` của double nhanh đã vượt: 21.523/14.000, 29.560/20.000, 26.850/22.000.
  - Level ghi `mechanism T`, `needs_real_models false`; `test_naive_graph_produces_its_deterministic_flags` trượt 3/3 khi đổi T trước, đạt sau khi hạ ngân sách.
- **Token vào thật ≈ 1,13 × `regex-v1`** (84 lời gọi, 1,09–1,21). Mọi số "engine đo" bằng `FakeLLM`/Oracle thấp hơn token tính phí khoảng 13 %.
- **Trung vị mỗi lời gọi** (`gemini-3.5-flash-lite`, 77 lời gọi): vào 1.347, ra + thinking 411 (p95 1.120, tối đa 1.713). Dưới mốc 1,1k nên `can_bang` → MEDIUM giữ nguyên.
- **Thời gian mỗi ca p50 / p95:** L2 lời giải mẫu 1.647 / 2.942 ms. L3 lời giải mẫu 5.397 / 5.733 ms (rerank CPU khoảng 3,7 s mỗi ca khi 3 ca song song). Các naive nặng 1,9–2,5 s / 2,4–5,2 s.
- **Limiter và chuỗi model với hạn mức thật (mục 9):**
  - 6 run cách nhau ≥ 65 s: mọi lời gọi do model chính phục vụ, không chờ, không nhường.
  - Run L3 chạy dồn ngay sau L1-N4: model chính nhận 5 lời gọi (chỗ còn lại của 15/phút), 8 lời gọi sau được nhường cho `gemini-3.1-flash-lite` mà không gọi model chính. Model dự phòng trả lời 7, lỗi 504 ở 1 sau ~18 s (504 không chuyển model, theo thiết kế; ca `llm_error`, run vẫn 3 sao). `run.finished.models` ghi đúng. Không có 429.
  - Chưa gặp 429/503 thật, nên đường nghỉ (`RetryInfo`, `PerDay`) chỉ có test với client giả.
  - `gemini-3.1-flash-lite` chậm (bước LLM p50 8,7 s), nên ca rơi sang model dự phòng dễ sát hạn 20 s.
- **Hệ quả cho người chơi** (ước tính từ `regex-v1` × 1,13 + 380 token ra mỗi lời gọi, không gọi LLM):
  - Mang thêm một đoạn mỗi ca so với lời giải mẫu là chạm vạch sao 2: L1 `top_k` 4 khoảng 13,0k (đạt), `top_k` 5 khoảng 14,4k (trượt ở 14.000; ở 15.000 đạt, sát).
  - L3 không rerank với `fusion.top_k` 5: khoảng 23,8k, mất sao 2 (ở 30.000 được 3 sao, xem khối "nội dung"). `fusion.top_k` 4 khoảng 21,5k (đạt, 8/10).
  - Khớp kịch bản §10 ("sao 2 cần `top_k` nhỏ"; L3 "Kính lúp `top_n` 3 hoặc `fusion.top_k` nhỏ") và mục tiêu 3 của L3.
- **Phát hiện phụ, không đổi:**
  - `max_stars` (chỉ là dữ liệu) lệch số đo: L1-N4 và L3-N5 khai 1 nhưng được 2 sao (s1 + s3), L3-N4 được 2 (khối nội dung).
  - L3-N8 [M] vẫn không cắn ở h04, h05 (rerank/BM25 hạng 1); N8 được 0 sao vì trượt h01, h03, h07.
- **File đổi:** 3 file level (`token_budget`, câu sao 2 trong `stars_vi`, `budget.exceeded` M → T); kịch bản L1 §6 N4 và §10, L2 §6 N2 và §10, L3 §6 N5 và §10, `library.md`; §9.3–9.5 ở trên; `engine-spike-report.md` §0.1, §1.2, §3.0b, §3.1, §3.2; `scripts/spike_llm.py`.

**Trạng thái 2026-10-08 · sửa lỗi vòng 1** (phản biện QA chi phí/hiệu năng sau đợt hiệu chỉnh: 1 blocker, 3 major, 13 minor). Test nhanh 486 đạt, `uv run pytest -m slow` 13/13 đạt (87 s), `ruff`, `ruff format`, `mypy` sạch. 0 lời gọi Gemini thật trong vòng này (tổng của đợt vẫn 91/100). Mỗi sửa lỗi có test trượt khi đảo ngược thay đổi (kiểm lại bằng cách đảo từng thay đổi trong code: 9/9 test trượt). RAM và thời gian đo trên máy dev (i7-12700H, 20 luồng), `FakeLLM` 1,8 s (p50 của `gemini-3.5-flash-lite`), không mạng; chi tiết ở [engine-spike-report §3.3](engine-spike-report.md).

- **Blocker, RAM của reranker: đã sửa** (`retrieval.py`). Mỗi lô rerank 2 cặp (trước 8), mỗi cặp (câu hỏi, đoạn) cắt ở 512 token (trước 1024 của jina; 512 cũng là giới hạn của e5, dense search không thấy hơn). Đồ thị L3 hợp lệ nặng nhất (`co_dinh` 1024/20, `bm` 10, `fu` 10, `rr` 5): committed sau run **3,2 GB** (trước 14,8 GB, và giữ nguyên sau run), lời giải mẫu L3 3,2 GB (trước 6,35 GB), lúc khởi động 2,1 GB.
  - Arena CPU của ONNX vẫn bật: đỉnh đã bị chặn ở 3,2 GB, còn tắt arena thì rerank chậm hơn khoảng 20 % (p50 3,68 s so với 3,06 s; A/B xen kẽ, 3 song song). Tắt arena chỉ có lợi là trả bộ nhớ sau run (về 2,1 GB).
  - Không cần hạ trần `param_limits` của L3, vì đỉnh RAM đã bị chặn bởi lô và độ dài cặp, không còn theo đồ thị.
  - Không xếp hàng rerank sau một khoá, vì cách đó biến RAM thành ca hết giờ.
  - Test: `test_reranker_scores_short_pairs_in_small_batches`. RAM ở §15, README và `.env.example` đã sửa (trước ghi ~1 GB).
- **Major, thời gian rerank so với hạn 20 s / 90 s: đã sửa nhờ hai thay đổi trên.** 3 ca song song, cache rerank lạnh:
  - Lời giải mẫu L3: rerank p50 2,3 s, tối đa 3,5 s; ca p50 4,1 s, tối đa 5,3 s; run 18,9 s.
  - Đồ thị nặng nhất: rerank p50 5,5 s, tối đa 5,6 s; ca tối đa 7,4 s; run 32,9 s (trước 69 s).
  - **Không đặt `threads`:** đo A/B xen kẽ trên cùng phiên (3 vòng × 13 ca): mặc định p50 2,87 s, 4 luồng 3,37 s, 6 luồng 3,10 s.
  - Không làm nóng cache lúc khởi động: rerank lạnh đã vừa hạn.
  - Khi máy bận (đo của vòng trước, có tiến trình khác chạy cùng), rerank lời giải mẫu lên tới p50 ~12 s. Con số "3,7 s mỗi ca" của khối "hiệu chỉnh" là lúc máy nhẹ tải.
- **Major, chuỗi model dự phòng: đã sửa** (`llm.py`, `config.py`).
  - Bỏ `gemini-3.7-flash` khỏi chuỗi mặc định: `GEMINI_FALLBACK_MODELS` = `gemini-3.1-flash-lite,gemini-3.5-flash`.
  - `MIN_CALL_S` riêng cho từng model và áp cho cả model đang rảnh: 4 s cho `gemini-3.5-flash-lite`, 15 s cho `gemini-3.1-flash-lite` và model chưa đo. Không đủ thời gian thì không gọi mạng (không tốn `DailyCap`, không tốn hạn mức), bước và ca là `timeout`.
  - Model chính có chỗ trước `hạn ca − 4 s` thì lời gọi chờ chỗ đó, không nhường sang model dự phòng chậm.
  - Test: `test_a_call_that_cannot_finish_before_the_deadline_is_never_sent`, `test_each_model_needs_its_own_time_before_the_deadline`.
  - **Không miễn sao 2 khi model dự phòng phục vụ.** Phần vào quyết định ngân sách và gần như tất định; `gemini-3.1-flash-lite` ra trung vị 478 so với 411 token mỗi lời gọi, tức khoảng +0,9k cho 13 lời gọi L3 (17,3k → ~18,2k, ngân sách 22k). Miễn sao 2 sẽ cho một đồ thị nặng ăn sao 2 chỉ vì một lời gọi rơi sang model khác. Sao 2 chỉ hiệu chỉnh trên model chính; `run.finished.models` cho biết khi model dự phòng phục vụ. `gemini-3.5-flash` chưa có mẫu token nào; vòng này không còn hạn mức gọi thật để đo.
  - **Sức chứa cho pilot:** một run L3 dùng 13 trong 15 lời gọi/phút của model chính, nên khoảng 1 run mỗi phút ở model chính; run thứ hai trong cùng phút phần lớn sang model dự phòng. `DAILY_LLM_CALL_CAP` 500 ÷ 13 ≈ 38 run L3 mới mỗi ngày.
- **Major, biên ngân sách sao 2 của L1: nâng 14.000 → 15.000** (file level, `stars_vi`, kịch bản L1 §10, `library.md`, §9.3). Bootstrap 200k mẫu của phản biện, từ phần ra của từng lời gọi trong `calib1`/`calib2`:
  - Xác suất lời giải mẫu vượt ngân sách: 0,1–1,1 % ở 15.000, so với 1,6–6,3 % ở 14.000.
  - `top_k` 4 (~13,0k) đạt. `top_k` 5 (~14,4k) nằm sát vạch, sao 2 gần như tung đồng xu.
  - L1-N4 vẫn vượt chỉ với token vào (21.523 `regex-v1`), nên bẫy vẫn [T].
  - Phương án chấm sao 2 chỉ bằng token vào (tất định, đúng bài học "cỡ ngữ cảnh") đổi hợp đồng chấm, nên để chủ dự án quyết.
  - Mẫu L1 thứ ba chưa lấy, vì cần 10 lời gọi thật và đợt chỉ còn 9. Chủ dự án chạy `vgame-calibrate` trước khi mở L1 cho lớp.
- **Minor, đã sửa** (mỗi mục có test trượt trước):
  - `cite_unknown` xét theo vế: tách thêm theo `;`, "nhưng", "tuy nhiên", nên dấu hiệu từ chối ở một vế không che câu bịa ở vế sau. Hai dòng mới trong `test_grade_abstain_case`. Ví dụ: "Quy chế không quy định học vượt; Điều 99 quy định …" trước đạt bẫy `lib-l1-t01`, giờ trượt `no_fabrication`.
  - Có ca `index_error` thì run kết thúc `run.failed{index_stale}`, không chấm như lỗi của người chơi (`test_an_index_error_fails_the_run_with_the_stale_index_message`).
  - Run có mọi ca hết giờ ở rerank, khi chưa gọi AI, giờ được chấm như thường, không thành `llm_unavailable` (`test_cases_timing_out_in_rerank_are_scored_not_a_provider_outage`). Timeout chỉ tính là provider sập khi chính bước `llm` hết giờ.
  - Chờ xong chỗ trống của limiter thì kiểm lại thời gian nghỉ của model (`test_a_model_that_cools_down_during_the_wait_for_its_slot_is_skipped`).
  - Hạn phía server của mỗi request bằng thời gian còn lại của ca, không cố định 20 s. SDK gửi `HttpOptions.timeout` thành header `X-Server-Timeout`, nên các lỗi 504 sau ~18–19,4 s (`h07` của run chạy dồn; `3.7-flash` của builder) là hạn 20 s do chính engine gửi, không phải bằng chứng provider sập.
  - Cửa sổ limiter 62 s thay vì 60 s, để có biên cho thời điểm tới server và bộ đếm theo phút cố định.
  - 404/405 của framework trả câu tiếng Việt (`test_framework_errors_answer_in_vietnamese`).
  - `vgame-build-index` dùng lại vector đã có trên đĩa (cùng `embed_model` và phiên bản fastembed), chỉ embed đoạn và câu hỏi mới (`test_rebuild_embeds_only_texts_the_old_index_lacks`, `test_cli_rebuild_reuses_the_index_on_disk`). Trước đó sửa 2 câu hỏi tốn 1.991 s.
  - L3 có thêm mẫu `budget.exceeded:no_rerank` cho đồ thị không có rerank: L3-N5 không còn nhận câu "Kính lúp tốn 0 ms".
  - `bites` của golden khớp nhãn [M]: bỏ N5 ở `lib-l1-v03`, `h04`, `h05` và N1 ở `lib-l2-v01`. Câu hỏi không đổi nên không phải dựng lại index.
  - Hợp đồng: §7.4, §8 (`run.finished.models`, `index_stale`, nhãn `index_error`), §10 (vế, nhãn), §15 (thứ tự POST, "Còn mở", RAM).
  - Con số cũ trong khối "backend": TPM (54k/phút thật, không phải "gấp 100 lần"), số lần gọi mạng mỗi run (52, không phải 26), cửa sổ 60 s.
- **Minor, không đổi:**
  - **`thinking_level` LOW/HIGH trên model dự phòng.** Cả ba level khoá `llm.profile` = `can_bang` (`param_limits` `const`), nên engine chỉ gửi MEDIUM, mức đã gọi thật được trên 3.1-flash-lite và 3.5-flash. Thử LOW/HIGH trên chuỗi trước khi một level mở profile khác (ghi ở docstring `llm.py`).
  - **Số `threads` và làm nóng cache:** xem mục major về thời gian ở trên.

## 15. Integration notes (E, 2026-10-07)

**API đã gắn** (`backend/src/vgame/api/`): `GET /api/blocks`, `GET /api/levels/{id}` (PublicLevel §9.2), `POST /api/runs?level=<id>` (thân = graph JSON, header tuỳ chọn `Idempotency-Key`), `GET /api/runs/{id}/events` (SSE, `Last-Event-ID`), `POST /api/runs/{id}/cancel`. Thứ tự kiểm ở POST: 415 (không phải `application/json`, chặn form chéo trang đốt key) → 404 level → 422 `{detail, issues[]}` (validator, gom lỗi) → 503 `llm_not_configured` → 503 `index_stale` (index lệch kho hoặc câu golden, kiểm lúc khởi động) → 503 `index_missing` (kể cả biến thể chưa dựng) → 503 `rerank_unavailable` → 409 (cùng `Idempotency-Key` cho đồ thị khác: "Idempotency-Key này đã dùng cho một đồ thị khác.") → 429 `RunBusyError` → 202 `{run_id, created, issues}` (issues info như `I01`, `W_RERANK_NOOP`); trùng `Idempotency-Key` (16-64 ký tự `[A-Za-z0-9_-]`) với cùng đồ thị (`graph_hash`) trả 200 cùng `run_id`. Lỗi 422 của framework (header/query/path sai) trả `{detail: "Yêu cầu không hợp lệ.", fields[]}`, không lặp input, không chữ tiếng Anh. Dịch vụ engine (`api/engine.py`) dựng một lần trong lifespan: index, reranker (chỉ khi index có), `ReplayStore` + `DailyCap` + client Gemini (chỉ khi có key); thiếu gì thì app vẫn chạy và POST trả 503 tiếng Việt. CORS mở `POST` và header `Content-Type`, `Idempotency-Key`, `Last-Event-ID` cho toàn app (CORSMiddleware không chia theo đường dẫn; chỉ `/api/runs` có POST).

**Level:** ba file ở `engine/levels/` theo §3/§9 (không đặt ở `content/data/levels/`, vì `load_level` của D và bảng sở hữu đã chốt chỗ này). Thẻ G1–G6 chép nguyên văn L1 §5; `rules.diagnosis` chép nguyên văn câu cô Lan ở §11 từng level, khoá theo §10 (L1 dùng `ret.gold_rank:vector_search` cho dòng "hạng > K"; L3 dùng `regression` cho dòng "hồi quy", `trap.failed` cho "bẫy từ chối trượt"). `stars_vi` tóm điều kiện §10.

**Đổi so với §9 (đo được, cần architect duyệt):** `budget.exceeded` của L1-N4, L2-N2, L3-N5 chuyển từ `T` sang `M` (2026-10-08: đã trở lại `T` sau khi hiệu chỉnh ngân sách 14k/20k/22k, xem §14 khối "hiệu chỉnh"). Chỉ tính token đầu vào (regex-v1, `FakeLLM`), ba cấu hình này tốn 21.523/22.000, 29.560/30.000 và 26.592/30.000: chưa vượt. Chúng chỉ vượt nhờ token ra + thinking của model thật, nên chỉ cổng hiệu chỉnh kiểm được. L3-N4 vẫn `T` (37.234/30.000). Kịch bản ước "≈ 3.000 token/ca" nhưng `cat_duoi` dừng ở đoạn đầu tiên làm tràn, nên thùng thực tế khoảng 2.000–2.300 token.

**Test đầu-cuối** (`tests/engine/test_levels_e2e.py`, `tests/test_api_runs.py`):
- Mọi `expect` có `T` và `needs_real_models: false` (L1-N1, N2; L2-N1, N2; L3-N3, N4) sinh đúng cờ với `HashingEmbedder` + `OverlapReranker` + `Oracle`. Luật so: các ca khai báo ⊆ các ca có cờ (không đòi bằng nhau: ví dụ `cite_missing` cũng bật ở ca từ chối vì câu từ chối không mang mã); `cases` vắng = ít nhất một ca.
- Lời giải mẫu cả ba level đạt 3 sao với `Oracle` + double "biết gold" cho truy xuất (`tests/engine/fakes_oracle.py`: `OracleEmbedder`, `OracleReranker`, chỉ trong test như `Oracle`). Với double ngây thơ, chỉ L2 đạt 3 sao; L1 được 2 sao (h04, h05 diễn đạt lại trượt dense băm), L3 được 0 sao (`OverlapReranker` loại đoạn của v01). Bản đo với model thật là test `slow` (`-m slow`), chưa chạy vì chưa dựng index (tải ~2,2 GB cần chủ dự án duyệt).
- API: chuỗi SSE đủ và đúng thứ tự, `step.*` đi cặp, gold chỉ trong `run.finished`, phát lại theo `Last-Event-ID`, idempotency, 422 gom lỗi tiếng Việt và không lặp payload, 415, 404, 429, huỷ (`run.failed{cancelled}`, slot được trả), không key → 503 "Chưa cấu hình LLM…", không index → 503.

**Sửa lỗi tích hợp:**
- `llm` gặp `stop_reason = "error"` (Gemini `OTHER`, không candidate) giờ ném `LLMCallError` → bước và ca là `llm_error`, không chấm câu rỗng như câu trả lời (`test_provider_error_finish_is_an_llm_error_not_an_answer`).
- `RunStore.__contains__` (huỷ một run đã xong trả 409, run lạ 404).
- Task run bị huỷ trước bước đầu tiên không phát gì; callback xong-task ghi `run.failed{cancelled}` để run không giữ chỗ trong trần run đồng thời.
- `pyproject.toml`: bỏ qua cảnh báo symlink của `huggingface_hub` (Windows không bật Developer Mode thì hub chép file thay vì symlink); `filterwarnings = error` biến nó thành lỗi làm hỏng mọi test `slow` trên máy này.
- `tests/conftest.py` có fixture `settings` kín (`_env_file=None`, không key, cache tạm); `test_security.py` dùng nó, vì lifespan giờ dựng engine (trước đó các test này đọc `.env` và cache thật).

**Còn mở:**
- Trần `DailyCap` chỉ được runtime biết sau khi một ca chạm trần (D đã ghi).
- ~~Lỗi index trong một bước hiện là `llm_error`~~, ~~usage của bước lỗi không cộng vào `CaseTrace.usage`~~, ~~không so `manifest.corpus_sha256` lúc khởi động~~, ~~SSE không có heartbeat~~: đã đóng 2026-10-08 (§14, khối "backend").
- Retrieval L1/L2 chạy đồng bộ trên event loop (0–2 ms mỗi bước, chấp nhận). Rerank chạy trong thread. Tiến trình API nạp index + reranker khi index có: khoảng 2,1 GB committed lúc khởi động, khoảng 3,2 GB khi 3 ca L3 rerank song song, kể cả đồ thị L3 hợp lệ nặng nhất (§14, khối "sửa lỗi vòng 1"; trước đó tới 14,8 GB).
- 9/24 biến thể trùng chữ (A đã ghi) và các mục §14 vẫn chờ chủ dự án.
