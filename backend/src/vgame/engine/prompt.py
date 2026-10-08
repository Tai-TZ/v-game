"""Fixed system frame, request assembly and citation parsing (engine-v0.2.md §5.5).

Player text (system prompt, question, chunk text) is data: it is only concatenated, never used
as a format string or template.
"""

import re
from collections.abc import Sequence
from typing import Final

from vgame.engine.constants import PROFILE_MAX_TOKENS, Profile
from vgame.engine.types import Chunk, LLMMessage, LLMRequest, PackedContext

# Bump when FRAME_VI changes: it is part of the replay key.
FRAME_VERSION: Final = 1
# No defensive layer here (Part 3 principle 6): grounding and refusal are the player's job.
FRAME_VI: Final = (
    "Bạn là trợ lý tra cứu quy chế đào tạo của trường. Trả lời bằng tiếng Việt. "
    "Khi đoạn tài liệu có mã trong ngoặc vuông, ghi đúng mã đó trong ngoặc vuông "
    "ngay sau ý đã dùng."
)
QUESTION_PREFIX: Final = "Câu hỏi: "
DOCS_PREFIX: Final = "Tài liệu:\n"

# A bracket group on one line, at most 64 chars, no nested brackets.
_CITATION_RE: Final = re.compile(r"\[([^\[\]\n]{1,64})\]")
_CITATION_SPLIT_RE: Final = re.compile(r"[,;]")


def render_docs(chunks: Sequence[Chunk], *, cite_ids: bool) -> str:
    """One block per chunk, blank line between blocks; no metadata (hieu_luc, dieu) printed."""
    return "\n\n".join("[" + c.chunk_id + "] " + c.text if cite_ids else c.text for c in chunks)


def build_request(ctx: PackedContext, *, profile: Profile, system_prompt: str) -> LLMRequest:
    # Empty pack -> no "Tài liệu" section at all, so L1-N1 (no retriever) bites as designed.
    docs = DOCS_PREFIX + ctx.docs_text + "\n\n" if ctx.included else ""
    return LLMRequest(
        profile=profile,
        system=FRAME_VI + "\n\n" + system_prompt,
        messages=(LLMMessage("user", docs + QUESTION_PREFIX + ctx.question),),
        max_tokens=PROFILE_MAX_TOKENS[profile],
    )


def parse_citations(text: str) -> tuple[str, ...]:
    """Every bracketed id in order of appearance, split on ``,``/``;``, de-duplicated."""
    seen: dict[str, None] = {}
    for group in _CITATION_RE.findall(text):
        for part in _CITATION_SPLIT_RE.split(group):
            if cid := part.strip():
                seen.setdefault(cid, None)
    return tuple(seen)
