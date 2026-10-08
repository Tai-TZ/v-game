"""LLM test doubles shared by builders C, D and E. No network, deterministic.

``Oracle`` is the only place outside the evaluator allowed to see gold; build its cases in the
test from the golden files.
"""

import asyncio
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from vgame.engine.constants import count_tokens
from vgame.engine.prompt import DOCS_PREFIX, QUESTION_PREFIX
from vgame.engine.types import LLMCallError, LLMRequest, LLMResponse, StopReason, Usage

ABSTAIN_TEXT = "Quy chế hiện hành không có thông tin này."
# Article 99 does not exist (the 2024 regulation has 84), so this is always cite_unknown.
FABRICATED_PREFIX = "Theo Điều 99, "

# Start of a rendered block with an id: "[<id>] " at the start or after a blank line.
_BLOCK_ID_RE = re.compile(r"(?:\A|\n\n)\[([^\[\]\n]{1,64})\] ")


class FakeLLM:
    """Scripted LLMClient. Usage approximates real provider counts with the engine tokenizer."""

    def __init__(
        self,
        script: Callable[[LLMRequest], str] | str,
        *,
        stop_reason: StopReason = "end",
        delay_s: float = 0.0,
        fail: LLMCallError | None = None,
    ) -> None:
        self._script = script
        self._stop_reason = stop_reason
        self._delay_s = delay_s
        self._fail = fail
        self.requests: list[LLMRequest] = []

    @property
    def provider(self) -> str:
        return "fake"

    @property
    def model(self) -> str:
        return "fake-llm"

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self.requests.append(request)
        if self._delay_s:
            await asyncio.sleep(self._delay_s)
        if self._fail is not None:
            raise self._fail
        text = self._script if isinstance(self._script, str) else self._script(request)
        prompt = "\n".join([request.system, *(m.text for m in request.messages)])
        usage = Usage(count_tokens(prompt), count_tokens(text))
        return LLMResponse(text=text, stop_reason=self._stop_reason, usage=usage, model=self.model)


@dataclass(frozen=True, slots=True)
class OracleCase:
    answer_points: tuple[str, ...]
    quotes: tuple[str, ...]
    abstain: bool


def _split_user(text: str) -> tuple[str, str]:
    """(docs_text, question) of a build_request user message."""
    head, sep, question = text.rpartition(QUESTION_PREFIX)
    if not sep:
        raise ValueError("Oracle: no question in the user message")
    docs = head.removeprefix(DOCS_PREFIX).removesuffix("\n\n") if head else ""
    return docs, question


class Oracle(FakeLLM):
    """Answers correctly when every gold quote is inside the packet, citing ``[chunk_id]`` of the
    block holding each quote (if the packet has ids); otherwise invents "Theo Điều 99, …".

    ``cases`` is keyed by question text (recognised after "Câu hỏi: ")."""

    def __init__(
        self,
        cases: Mapping[str, OracleCase],
        *,
        delay_s: float = 0.0,
        fail: LLMCallError | None = None,
    ) -> None:
        super().__init__(self._answer, delay_s=delay_s, fail=fail)
        self._cases = cases

    def _answer(self, request: LLMRequest) -> str:
        docs, question = _split_user(request.messages[-1].text)
        case = self._cases[question]
        if case.abstain:
            return ABSTAIN_TEXT
        points = "; ".join(case.answer_points)
        # Gold quotes contain no newline, so a quote found in docs never spans two blocks.
        if not case.quotes or not all(q in docs for q in case.quotes):
            return FABRICATED_PREFIX + points + "."
        starts = [(m.end(), m.group(1)) for m in _BLOCK_ID_RE.finditer(docs)]
        cited: dict[str, None] = {}
        for quote in case.quotes:
            pos = docs.index(quote)
            ids = [cid for start, cid in starts if start <= pos]
            if ids:
                cited.setdefault(ids[-1], None)
        tags = "".join(" [" + cid + "]" for cid in cited)
        return "Theo quy chế: " + points + tags + "."
