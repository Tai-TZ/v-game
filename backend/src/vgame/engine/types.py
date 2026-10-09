"""Values that cross module boundaries: port values, facts, events, ports (Protocols), errors.

Rules (docs/design/engine-v0.2.md §4):
- Nothing here carries gold. Gold lives only in the evaluator (``grading.py``) and the test oracle.
- Facts and events are JSON-ready TypedDicts; port values are frozen dataclasses.
- Only three Protocols exist, each because tests need a double: LLMClient, Embedder, Reranker.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal, NotRequired, Protocol, TypedDict

import numpy as np
from numpy.typing import NDArray

from vgame.engine.constants import IndexVariant, Profile

# --- Small enums --------------------------------------------------------------------------

BlockType = Literal[
    "input",
    "output",
    "corpus",
    "chunker",
    "vector_search",
    "bm25_search",
    "fusion",
    "rerank",
    "context_packer",
    "llm",
]
CaseRole = Literal["visible", "hidden", "trap"]  # "review" cases are not part of level runs
StopReason = Literal["end", "max_tokens", "refusal", "error"]
StepStatus = Literal["ok", "timeout", "cancelled", "budget", "llm_error", "index_error", "refusal"]
CaseStatus = Literal[
    "ok", "timeout", "cancelled", "skipped_budget", "llm_error", "index_error", "refusal"
]
Retriever = Literal["vector_search", "bm25_search", "fusion", "rerank"]


# --- Usage --------------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Usage:
    """Provider usage of one or more LLM calls.

    ``input_tokens`` already includes cached input; ``output_tokens`` includes thinking.
    Star metric (critic fix): ``tokens = input_tokens + output_tokens``, nothing else added.
    """

    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def __add__(self, other: "Usage") -> "Usage":
        return Usage(
            self.input_tokens + other.input_tokens, self.output_tokens + other.output_tokens
        )


# --- LLM port -----------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LLMMessage:
    role: Literal["user", "model"]
    text: str


@dataclass(frozen=True, slots=True)
class LLMRequest:
    """Provider-agnostic request. Player text is data inside ``system``/``messages``, never a
    template. There is no temperature: profiles map to thinking effort only."""

    profile: Profile
    system: str
    messages: tuple[LLMMessage, ...]
    max_tokens: int


@dataclass(frozen=True, slots=True)
class LLMResponse:
    text: str
    stop_reason: StopReason
    usage: Usage  # on a replay hit: the ORIGINAL usage of the stored response
    model: str
    replayed: bool = False


class LLMClient(Protocol):
    """Implementations: GeminiClient, ReplayingLLM (wrapper); FakeLLM and Oracle in tests."""

    @property
    def provider(self) -> str: ...

    @property
    def model(self) -> str: ...

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Raises LLMCallError (provider/network), BudgetExceededError (daily cap)."""
        ...


# --- Retrieval ports ----------------------------------------------------------------------

Vectors = NDArray[np.float32]


class Embedder(Protocol):
    """Rows are L2-normalised float32. Implementations: FastEmbedder; HashingEmbedder in tests."""

    @property
    def model_id(self) -> str: ...

    def embed_passages(self, texts: Sequence[str]) -> Vectors: ...

    def embed_queries(self, texts: Sequence[str]) -> Vectors: ...


class Reranker(Protocol):
    """Cross-encoder relevance, higher is better. Implementations: FastReranker; fake in tests."""

    @property
    def model_id(self) -> str: ...

    def score(self, query: str, texts: Sequence[str]) -> list[float]: ...


@dataclass(frozen=True, slots=True)
class Chunk:
    """One chunk of one index variant. ``chunk_id`` is opaque (8 hex chars of a hash); nothing
    about the article number can be derived from it. ``start``/``end`` are character offsets
    into the loaded document text, used only by the evaluator to map gold quotes."""

    chunk_id: str
    doc_id: str
    dieu: int  # article holding the chunk's first token
    khoan: tuple[int, ...]  # clauses of that article the chunk touches; () if unnumbered
    hieu_luc: bool
    text: str  # what the LLM sees
    tokens: int  # count_tokens(text)
    start: int
    end: int


@dataclass(frozen=True, slots=True)
class IndexHandle:
    """Compile-time value of the ``chunker`` output port (``Index``). Never a runtime node.

    ``docs`` is the level corpus (L1/L3 exclude qcdt-2019, D7). ``only_in_force`` filters at
    the index layer, so every retriever on this index obeys it (critic fix)."""

    variant: IndexVariant
    docs: frozenset[str]
    only_in_force: bool


@dataclass(frozen=True, slots=True)
class DocHit:
    chunk: Chunk
    score: float  # cosine, BM25, fused or rerank score of the block that produced the list


@dataclass(frozen=True, slots=True)
class DocList:
    """Value of a ``Docs`` port, ranked best first (rank = index + 1)."""

    origin: Retriever
    hits: tuple[DocHit, ...]


# --- Case, context, answer ----------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PublicCase:
    """Value of the ``Query`` port. ``question`` is needed to run the case but is sent to the
    client only for ``visible`` cases (Part 3 §3.7, B6). No expect/gold/answer_points here."""

    id: str
    role: CaseRole
    vai: str
    question: str


@dataclass(frozen=True, slots=True)
class PackedContext:
    """Value of the ``Context`` port. ``token_budget`` covers docs + question; the system
    prompt is reported by the llm step, not budgeted (engine-v0.2.md §6.4)."""

    question: str
    docs_text: str  # rendered docs block, "[chunk_id] text" lines when cite_ids is on
    included: tuple[Chunk, ...]
    dropped: tuple[str, ...]  # chunk ids cut by on_overflow, in cut order
    docs_tokens: int
    query_tokens: int
    token_budget: int
    cite_ids: bool


@dataclass(frozen=True, slots=True)
class Answer:
    """Value of the ``Answer`` port."""

    text: str
    cited_ids: tuple[str, ...]  # every bracketed token parsed from text, in order, de-duplicated
    stop_reason: StopReason
    usage: Usage
    replayed: bool


PortValue = PublicCase | IndexHandle | DocList | PackedContext | Answer


# --- Facts (neutral, gold-free; step.finished.facts) --------------------------------------


class RetrievedItem(TypedDict):
    chunk_id: str
    rank: int  # 1-based
    score: float
    doc_id: str
    dieu: int
    khoan: list[int]
    hieu_luc: bool


class RetrievedFact(TypedDict):
    kind: Literal["retrieved"]
    items: list[RetrievedItem]


class PackTokens(TypedDict):
    docs: int
    query: int
    total: int
    budget: int


class PackFact(TypedDict):
    kind: Literal["pack"]
    included: list[str]
    dropped: list[str]
    tokens: PackTokens


class LLMFact(TypedDict):
    kind: Literal["llm"]
    stop_reason: StopReason
    cited_ids: list[str]
    replayed: bool
    model: str
    system_tokens: int  # count_tokens(frame + player system prompt)
    answer: NotRequired[str]  # only for visible cases


Fact = RetrievedFact | PackFact | LLMFact


@dataclass(frozen=True, slots=True)
class StepRecord:
    """One finished runtime step; the runtime keeps these per case for the evaluator."""

    node: str
    block: BlockType
    status: StepStatus
    ms: int  # wall ms; rerank over the precomputed table: simulated live cost (engine-v0.2 §14)
    usage: Usage
    facts: tuple[Fact, ...]


@dataclass(frozen=True, slots=True)
class CaseTrace:
    """Handed to the evaluator when a case ends (``on_case_finished``)."""

    case: PublicCase
    status: CaseStatus
    steps: tuple[StepRecord, ...]
    answer: Answer | None
    usage: Usage  # every committed LLM call, failed steps included (original usage on replays)
    ms: int


# --- Evaluator outputs --------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CaseGrade:
    """Gold-free verdict, safe to emit during the run (D4)."""

    case_id: str
    passed: bool
    counted: bool  # False for cases demoted to info until calibration (e.g. lib-l3-t03)
    criteria: dict[str, bool]  # e.g. points, cited, no_fabrication, no_forbidden, refusal
    labels: tuple[str, ...]  # no-gold labels: cite_unknown, cite_missing, abstained, stale_doc,
    # skipped_budget, timeout, llm_error, index_error, refusal


class StaleRule(TypedDict):
    roles: list[str]  # ["trap"]
    vai: list[str]  # ["van-ban-cu", "da-bai-bo"]


class LevelRules(TypedDict):
    """Grading/star rules of one level (``rules`` in engine/levels/<id>.json)."""

    s1_min_normal: int
    s1_required: list[str]
    token_budget: int
    s3_forbidden_labels: list[str]
    info_cases: list[str]  # traps demoted to info until calibration
    stale_fails: StaleRule | None  # L2 only: these cases also need no hieu_luc=false in pack
    max_dieu: int
    diagnosis: dict[str, str]  # flag key -> Vietnamese template with {var} placeholders


class StarResult(TypedDict):
    stars: int  # 0..3; stars 2 and 3 only count with star 1
    s1: bool
    s2: bool
    s3: bool
    normal_passed: int
    normal_total: int
    traps_passed: int
    traps_total: int
    tokens: int
    budget: int


class GoldReveal(TypedDict):
    """Post-run only (D4). Hidden/trap cases never carry their question."""

    gold_chunks: list[str]
    ranks: dict[str, int | None]  # node id -> rank of best gold chunk in that block's full
    # ranking (retrievers) or output list (fusion/rerank); None = absent
    in_pack: bool
    flags: list[str]  # ret.gold_missing, ret.gold_rank, ret.boundary_split, ctx.gold_dropped


class Diagnosis(TypedDict):
    case: str | None  # None for run-level flags (budget.exceeded)
    flag: str
    message_vi: str


class RunReport(TypedDict):
    gold: dict[str, GoldReveal]
    diagnosis: list[Diagnosis]


# --- Validation ---------------------------------------------------------------------------


class ValidationIssue(TypedDict):
    code: str  # P01..P03, G01..G07, I01, W_RERANK_NOOP
    severity: Literal["error", "info"]
    node: str | None
    port: str | None
    message_vi: str
    concept_ref: str | None


# --- Events (SSE payloads; the run store adds the sequence id) ----------------------------


TokensInOut = TypedDict("TokensInOut", {"in": int, "out": int})


class CaseInfo(TypedDict):
    id: str
    role: CaseRole
    vai: str
    question: NotRequired[str]  # visible only


class IngestionInfo(TypedDict):
    node: str
    variant: str
    chunks: int
    avg_tokens: int


class RunStartedEvent(TypedDict):
    type: Literal["run.started"]
    run: str
    level: str
    cases: list[CaseInfo]
    ingestion: list[IngestionInfo]


class StepStartedEvent(TypedDict):
    type: Literal["step.started"]
    run: str
    case: str
    node: str
    block: BlockType


class StepFinishedEvent(TypedDict):
    type: Literal["step.finished"]
    run: str
    case: str
    node: str
    block: BlockType
    status: StepStatus
    summary: str  # <= SUMMARY_MAX_CHARS, deterministic, gold-free
    tokens: TokensInOut
    ms: int  # wall ms; rerank over the precomputed table: simulated live cost (engine-v0.2 §14)
    facts: list[Fact]


class CaseGradedEvent(TypedDict):
    type: Literal["case.graded"]
    run: str
    case: str
    status: CaseStatus
    passed: bool
    counted: bool
    criteria: dict[str, bool]
    labels: list[str]


class RunScoredEvent(TypedDict):
    type: Literal["run.scored"]
    run: str
    score: StarResult


class RunFinishedEvent(TypedDict):
    type: Literal["run.finished"]
    run: str
    report: RunReport
    models: dict[str, int]  # model id -> answered LLM calls (replays included)


class RunFailedEvent(TypedDict):
    type: Literal["run.failed"]
    run: str
    # index_missing | rerank_unavailable | llm_not_configured | cancelled | internal |
    # llm_unavailable | index_stale
    code: str
    message_vi: str


EngineEvent = (
    RunStartedEvent
    | StepStartedEvent
    | StepFinishedEvent
    | CaseGradedEvent
    | RunScoredEvent
    | RunFinishedEvent
    | RunFailedEvent
)
EventSink = Callable[[EngineEvent], None]


# --- Errors -------------------------------------------------------------------------------


class EngineError(Exception):
    """Base. ``message_vi`` is player-safe; ``str(exc)`` may be English and is for logs only,
    and must never contain secrets or provider response bodies."""

    message_vi: str = "Có lỗi khi chạy ca."
    # Status of the step (and case) this error stops; the index layer overrides it.
    step_status: Literal["llm_error", "index_error"] = "llm_error"


class LLMNotConfiguredError(EngineError):
    message_vi = "Chưa cấu hình LLM nên chưa chạy được ca. Chủ máy chủ cần đặt GEMINI_API_KEY."


class LLMCallError(EngineError):
    """Provider call failed after any allowed retry. ``status`` is the HTTP code if known."""

    message_vi = "Gọi LLM thất bại, thử lại sau."

    def __init__(self, detail: str, *, status: int | None = None, retryable: bool = False):
        super().__init__(detail)
        self.status = status
        self.retryable = retryable


class BudgetExceededError(EngineError):
    """Raised by RunBudget.reserve (per-case call cap) or DailyCap.reserve (server-wide)."""

    def __init__(self, scope: Literal["case", "daily"]):
        super().__init__(f"LLM budget exceeded ({scope})")
        self.scope = scope
        self.message_vi = (
            "Ca này đã dùng hết số lời gọi LLM cho phép."
            if scope == "case"
            # DailyCap counts per UTC day: 00:00 UTC = 7:00 in Vietnam (UTC+7).
            else "Máy chủ đã dùng hết lượt gọi AI miễn phí của hôm nay. "
            "Lượt gọi mở lại lúc 7 giờ sáng (giờ Việt Nam)."
        )
