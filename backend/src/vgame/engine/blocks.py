"""The Library and Watchtower W1 blocks: one frozen Pydantic params model each, whose ``run``
is the block.

``run`` gets its inputs already resolved (``BlockCall``) and returns a ``StepResult``; the
compiler's ``instrumented`` wrapper owns events, timing and error statuses. Summaries are
deterministic, gold-free, never contain the question, and use Vietnamese numbers (1.420, 0,83).
"""

import asyncio
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from typing import Annotated, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from vgame.engine import desk, retrieval
from vgame.engine.budget import RunBudget
from vgame.engine.constants import (
    SYSTEM_PROMPT_MAX_CHARS,
    ChunkSize,
    IndexVariant,
    OverlapPct,
    Profile,
    Strategy,
    count_tokens,
)
from vgame.engine.index import IndexNotBuiltError, IndexStore, RerankTable
from vgame.engine.packing import pack, pack_fact
from vgame.engine.prompt import build_request, parse_citations
from vgame.engine.retrieval import retrieved_fact, summarize_docs, vi_number
from vgame.engine.types import (
    Answer,
    ApprovalSpec,
    DocList,
    EngineError,
    Fact,
    GuardFact,
    IndexHandle,
    LedgerEntry,
    LedgerFact,
    LLMCallError,
    LLMClient,
    LLMFact,
    LLMNotConfiguredError,
    Order,
    PackedContext,
    PortValue,
    PublicCase,
    Reranker,
    StepStatus,
    ToolHandle,
    Usage,
)

T = TypeVar("T")


@dataclass(frozen=True)
class EngineDeps:
    """Per-run dependencies. ``store``/``llm`` may be None (index not built, no API key): the
    runtime then fails the run with a Vietnamese message before emitting anything."""

    store: IndexStore | None
    llm: LLMClient | None
    reranker: Reranker | None
    budget: RunBudget
    # Watchtower: the watchdog's precomputed confidence per case id (watchtower §1.2), and the
    # level's shop, whose orders the desk looks up before the call (§1.3).
    guard_scores: Mapping[str, float] = field(default_factory=dict)
    orders: Mapping[str, Order] = field(default_factory=dict)


@dataclass(frozen=True)
class BlockCall:
    node: str
    case: PublicCase
    inputs: Mapping[str, Sequence[PortValue]]  # port -> values in graph-JSON edge order
    deps: EngineDeps

    def many(self, port: str, kind: type[T]) -> list[T]:
        values = self.inputs.get(port, ())
        out: list[T] = [v for v in values if isinstance(v, kind)]
        if len(out) != len(values):
            raise TypeError(f"{self.node}.{port}: expected {kind.__name__}")
        return out

    def one(self, port: str, kind: type[T]) -> T:
        values = self.many(port, kind)
        if len(values) != 1:
            raise TypeError(f"{self.node}.{port}: expected exactly one value")
        return values[0]

    def store(self) -> IndexStore:
        if self.deps.store is None:
            raise IndexNotBuiltError
        return self.deps.store


@dataclass(frozen=True)
class StepResult:
    outputs: dict[str, PortValue]  # output port -> value
    summary: str
    facts: tuple[Fact, ...] = ()
    usage: Usage = field(default_factory=Usage)
    status: StepStatus = "ok"
    answer: Answer | None = None  # set by the output block only
    ms: int | None = None  # simulated duration, replaces the measured one (rerank only)
    halt: str | None = None  # a guard stopped the case: this refusal is the customer's answer


# --- Params models + behaviour -----------------------------------------------------------


def _docs_result(docs: DocList, *, n_in: int = 0, method: str = "rrf") -> StepResult:
    summary = summarize_docs(docs, n_in=n_in, method=method)
    return StepResult({"docs": docs}, summary, (retrieved_fact(docs),))


class BlockParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    async def run(self, call: BlockCall) -> StepResult:
        """Runtime blocks override this; ingestion blocks (corpus, chunker) never run."""
        raise NotImplementedError


class InputParams(BlockParams):
    async def run(self, call: BlockCall) -> StepResult:
        return StepResult({"query": call.case}, "Nhận câu hỏi.")


class OutputParams(BlockParams):
    async def run(self, call: BlockCall) -> StepResult:
        answer = call.one("answer", Answer)
        return StepResult({}, "Đã ghi câu trả lời.", answer=answer)


class CorpusParams(BlockParams):
    """No params: the corpus is the level's (``level.corpus``)."""


class ChunkerParams(BlockParams):
    strategy: Strategy = Field("theo_dieu", title="Cách chia")
    chunk_size: ChunkSize = Field(512, title="Cỡ đoạn (token)")
    overlap_pct: OverlapPct = Field(10, title="Chồng lấp (%)")
    only_in_force: bool = Field(False, title="Chỉ văn bản còn hiệu lực")

    def handle(self, corpus: Sequence[str]) -> IndexHandle:
        variant = IndexVariant(self.strategy, self.chunk_size, self.overlap_pct)
        return IndexHandle(variant, frozenset(corpus), self.only_in_force)


class VectorSearchParams(BlockParams):
    top_k: int = Field(5, ge=1, le=20, title="Số đoạn lấy về")
    score_threshold: float = Field(0.0, ge=0, le=0.9, multiple_of=0.05, title="Ngưỡng điểm")

    async def run(self, call: BlockCall) -> StepResult:
        case = call.one("query", PublicCase)
        docs = retrieval.vector_search(
            call.store(),
            call.one("index", IndexHandle),
            case.question,
            top_k=self.top_k,
            score_threshold=self.score_threshold,
        )
        return _docs_result(docs)


class BM25SearchParams(BlockParams):
    top_k: int = Field(5, ge=1, le=20, title="Số đoạn lấy về")

    async def run(self, call: BlockCall) -> StepResult:
        case = call.one("query", PublicCase)
        docs = retrieval.bm25_search(
            call.store(), call.one("index", IndexHandle), case.question, top_k=self.top_k
        )
        return _docs_result(docs)


class FusionParams(BlockParams):
    method: Literal["rrf", "alpha"] = Field("rrf", title="Cách gộp")
    k: int = Field(60, ge=1, le=100, title="Hằng số k của RRF")
    alpha: float = Field(0.5, ge=0, le=1, multiple_of=0.1, title="Trọng số tìm theo nghĩa")
    top_k: int = Field(10, ge=1, le=30, title="Số đoạn giữ lại")

    async def run(self, call: BlockCall) -> StepResult:
        lists = call.many("docs", DocList)
        if self.method == "rrf":
            docs = retrieval.fuse_rrf(lists, k=self.k, top_k=self.top_k)
        else:  # the validator guarantees exactly one vector and one bm25 list
            by_origin = {d.origin: d for d in lists}
            docs = retrieval.fuse_alpha(
                by_origin["vector_search"],
                by_origin["bm25_search"],
                alpha=self.alpha,
                top_k=self.top_k,
            )
        return _docs_result(docs, n_in=len(lists), method=self.method)


class RerankParams(BlockParams):
    top_n: int = Field(3, ge=1, le=10, title="Số đoạn giữ lại")

    async def run(self, call: BlockCall) -> StepResult:
        reranker = call.deps.reranker
        if reranker is None:  # the runtime pre-check fails the run before this
            raise EngineError("reranker unavailable")
        case = call.one("query", PublicCase)
        before = call.one("docs", DocList)
        docs = await asyncio.to_thread(
            retrieval.rerank, call.store(), reranker, case.question, before, top_n=self.top_n
        )
        result = _docs_result(docs, n_in=len(before.hits))
        if isinstance(reranker, RerankTable):  # L3 teaches rerank's cost: report the live one
            return replace(result, ms=round(len(before.hits) * reranker.ms_per_pair))
        return result


class ContextPackerParams(BlockParams):
    token_budget: int = Field(3000, ge=300, le=16000, title="Ngân sách thùng (token)")
    on_overflow: Literal["cat_duoi"] = Field("cat_duoi", title="Khi tràn thùng")
    cite_ids: bool = Field(False, title="Đóng tem mã đoạn")

    async def run(self, call: BlockCall) -> StepResult:
        case = call.one("query", PublicCase)
        ctx = pack(
            case.question,
            call.many("docs", DocList),
            token_budget=self.token_budget,
            cite_ids=self.cite_ids,
        )
        total = ctx.docs_tokens + ctx.query_tokens
        summary = (
            f"Thùng: {vi_number(total)}/{vi_number(ctx.token_budget)} token. "
            f"Bị cắt: {len(ctx.dropped)} đoạn."
        )
        return StepResult({"context": ctx}, summary, (pack_fact(ctx),))


class LLMParams(BlockParams):
    profile: Profile = Field("can_bang", title="Mức suy nghĩ")
    system_prompt: str = Field(
        "", max_length=SYSTEM_PROMPT_MAX_CHARS, title="Dặn dò (system prompt)"
    )

    async def run(self, call: BlockCall) -> StepResult:
        client = call.deps.llm
        if client is None:
            raise LLMNotConfiguredError
        ctx = call.one("context", PackedContext)
        request = build_request(ctx, profile=self.profile, system_prompt=self.system_prompt)
        call.deps.budget.reserve(call.case.id)
        response = await client.complete(request)
        call.deps.budget.commit(call.case.id, response.usage)
        if response.stop_reason == "error":  # provider gave no usable answer (e.g. OTHER)
            raise LLMCallError(f"{client.provider} finished with an error")
        answer = Answer(
            text=response.text,
            cited_ids=parse_citations(response.text),
            stop_reason=response.stop_reason,
            usage=response.usage,
            replayed=response.replayed,
        )
        fact: LLMFact = {
            "kind": "llm",
            "stop_reason": response.stop_reason,
            "cited_ids": list(answer.cited_ids),
            "replayed": response.replayed,
            "model": response.model,
            "system_tokens": count_tokens(request.system),
        }
        if call.case.role == "visible":
            fact["answer"] = response.text
        usage = response.usage
        summary = (
            f"Trợ lý trả lời ({vi_number(usage.input_tokens)} vào, "
            f"{vi_number(usage.output_tokens)} ra token)."
        )
        if response.replayed:
            summary += " Kết quả đã lưu."
        return StepResult(
            {"answer": answer},
            summary,
            (fact,),
            usage=usage,
            status="refusal" if response.stop_reason == "refusal" else "ok",
        )


# --- Watchtower W1 (docs/content/scenarios/watchtower.md §3) ------------------------------

DEFAULT_REFUSAL = "Xin lỗi, quầy không xử lý được yêu cầu này. Bạn liên hệ nhân viên giúp mình nhé."
Phrase = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class GuardScoresMissingError(EngineError):
    """The watchdog's table has no score for a case: the table is older than the cases."""

    message_vi = "Bảng điểm của Chó gác chưa có câu này. Chủ máy chủ cần chấm lại bảng."
    step_status = "index_error"


def guard_text(text: str) -> str:
    """Part 3 §3.2 pattern_guard: NFKC, lower case, diacritics off (đ -> d), spaces collapsed."""
    lowered = unicodedata.normalize("NFKC", text).lower()
    bare = "".join(
        ch for ch in unicodedata.normalize("NFD", lowered) if unicodedata.category(ch) != "Mn"
    )
    return " ".join(bare.replace("đ", "d").split())


class PatternGuardParams(BlockParams):
    phrases: list[Phrase] = Field(default_factory=list, max_length=30, title="Cụm từ chặn")
    refusal: str = Field(DEFAULT_REFUSAL, min_length=1, max_length=200, title="Câu từ chối")

    async def run(self, call: BlockCall) -> StepResult:
        case = call.one("query", PublicCase)
        text = guard_text(case.question)
        hit = next((p for p in self.phrases if guard_text(p) in text), None)
        fact: GuardFact = {"kind": "guard", "by": "pattern", "decision": "pass"}
        if hit is None:
            summary = f"Lưới cho qua ({len(self.phrases)} cụm từ)."
            return StepResult({"query": case}, summary, (fact,))
        fact = {**fact, "decision": "block", "matched": hit}
        return StepResult({"query": case}, f"Lưới chặn: khớp «{hit}».", (fact,), halt=self.refusal)


class InjectionClassifierParams(BlockParams):
    threshold: float = Field(0.8, ge=0.5, le=0.95, multiple_of=0.05, title="Ngưỡng chặn")
    refusal: str = Field(DEFAULT_REFUSAL, min_length=1, max_length=200, title="Câu từ chối")

    async def run(self, call: BlockCall) -> StepResult:
        case = call.one("query", PublicCase)
        score = call.deps.guard_scores.get(case.id)
        if score is None:
            raise GuardScoresMissingError(f"no watchdog score for {case.id}")
        block = score >= self.threshold
        fact: GuardFact = {
            "kind": "guard",
            "by": "classifier",
            "decision": "block" if block else "pass",
            "score": score,
        }
        verdict = "chặn" if block else "cho qua"
        summary = f"Chó gác {verdict}: điểm {vi_number(score)}, ngưỡng {vi_number(self.threshold)}."
        return StepResult({"query": case}, summary, (fact,), halt=self.refusal if block else None)


class ToolRefundParams(BlockParams):
    """No params: the refund tool of the level's shop. Compiled to a ToolHandle, never run."""

    def handle(self) -> ToolHandle:
        return ToolHandle("tool_refund")


class HumanApprovalParams(BlockParams):
    policy: Literal["luon_hoi", "hoi_neu_vuot"] = Field("hoi_neu_vuot", title="Khi nào hỏi")
    amount_threshold: int = Field(
        500_000, ge=0, le=10_000_000, multiple_of=10_000, title="Ngưỡng tiền (đồng)"
    )

    def wrap(self, tool: ToolHandle) -> ToolHandle:
        return replace(tool, approval=ApprovalSpec(self.policy, self.amount_threshold))


class ActionLLMParams(BlockParams):
    profile: Profile = Field("can_bang", title="Mức suy nghĩ")
    system_prompt: str = Field(
        "", max_length=SYSTEM_PROMPT_MAX_CHARS, title="Dặn dò (system prompt)"
    )

    async def run(self, call: BlockCall) -> StepResult:
        client = call.deps.llm
        if client is None:
            raise LLMNotConfiguredError
        case = call.one("query", PublicCase)
        found = desk.lookup_orders(case.question, call.deps.orders)
        request = desk.build_action_request(
            case.question, found, profile=self.profile, system_prompt=self.system_prompt
        )
        call.deps.budget.reserve(call.case.id)
        response = await client.complete(request)
        call.deps.budget.commit(call.case.id, response.usage)
        if response.stop_reason == "error":
            raise LLMCallError(f"{client.provider} finished with an error")
        slip = desk.parse_slip(response.text)
        entries = (
            [desk.execute(slip.action, call.many("tools", ToolHandle), call.deps.orders)]
            if slip.action is not None
            else []
        )
        answer = Answer(
            text=slip.tra_loi,
            cited_ids=(),
            stop_reason=response.stop_reason,
            usage=response.usage,
            replayed=response.replayed,
        )
        llm_fact: LLMFact = {
            "kind": "llm",
            "stop_reason": response.stop_reason,
            "cited_ids": [],
            "replayed": response.replayed,
            "model": response.model,
            "system_tokens": count_tokens(request.system),
        }
        if call.case.role == "visible":
            llm_fact["answer"] = slip.tra_loi
        ledger: LedgerFact = {"kind": "ledger", "entries": entries}
        usage = response.usage
        summary = (
            f"Trợ lý viết phiếu ({vi_number(usage.input_tokens)} vào, "
            f"{vi_number(usage.output_tokens)} ra token). "
            + _ledger_line(entries, valid=slip.valid)
        )
        if response.replayed:
            summary += " Kết quả đã lưu."
        return StepResult(
            {"answer": answer},
            summary,
            (llm_fact, ledger),
            usage=usage,
            status="refusal" if response.stop_reason == "refusal" else "ok",
        )


_APPROVAL_VI: Mapping[str, str] = {
    "none": "không qua cổng duyệt",
    "auto": "dưới ngưỡng, tự chạy",
    "approved": "người duyệt đồng ý",
    "denied": "người duyệt từ chối",
    "no_tool": "không có công cụ trên bàn",
}


def _ledger_line(entries: Sequence[LedgerEntry], *, valid: bool) -> str:
    if not valid:
        return "Phiếu sai khuôn: không làm gì."
    if not entries:
        return "Phiếu: không cần làm gì."
    e = entries[0]
    done = "đã chạy" if e["executed"] else "không chạy"
    return (
        f"Phiếu: hoàn {desk.vi_money(e['so_tien'])} cho {e['ma_don']}, "
        f"{_APPROVAL_VI[e['approval']]}, {done}."
    )
