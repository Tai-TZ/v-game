"""Engine-wide limits, the index variant grid and the one tokenizer (shared by all builders).

Change a value here only with a matching change in docs/design/engine-v0.2.md.
"""

import re
from dataclasses import dataclass
from itertools import product
from typing import Final, Literal

# --- Time and concurrency (Part 2 / Part 3 §3.8 (c)) -------------------------------------
CASE_DEADLINE_S: Final = 20.0
RUN_DEADLINE_S: Final = 90.0
MAX_CONCURRENT_CASES: Final = 3

# --- LLM budget (Part 3 §3.8 (b); critic fix: G07 counts calls, RunBudget is the real cap) --
MAX_LLM_CALLS_PER_CASE: Final = 12
MAX_LLM_BLOCKS: Final = 8

Profile = Literal["nhe", "can_bang", "sau"]
# Output ceiling per profile; the player cannot change it. Thinking counts toward it.
PROFILE_MAX_TOKENS: Final[dict[Profile, int]] = {"nhe": 4096, "can_bang": 8192, "sau": 16000}

# --- Graph payload boundary (Part 3 §3.5 step 1) -------------------------------------------
MAX_PAYLOAD_BYTES: Final = 64 * 1024
MAX_NODES: Final = 25
SYSTEM_PROMPT_MAX_CHARS: Final = 2000
SUMMARY_MAX_CHARS: Final = 140
# NUL, C0 controls except tab/newline/CR, and Unicode bidi controls are rejected in any string.
FORBIDDEN_CHARS_RE: Final = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]"
)

# --- Index variants (Part 3 §3.2 chunker): 2 x 4 x 3 = 24 -----------------------------------
Strategy = Literal["co_dinh", "theo_dieu"]
ChunkSize = Literal[128, 256, 512, 1024]
OverlapPct = Literal[0, 10, 20]

STRATEGIES: Final[tuple[Strategy, ...]] = ("co_dinh", "theo_dieu")
CHUNK_SIZES: Final[tuple[ChunkSize, ...]] = (128, 256, 512, 1024)
OVERLAP_PCTS: Final[tuple[OverlapPct, ...]] = (0, 10, 20)


@dataclass(frozen=True, slots=True)
class IndexVariant:
    strategy: Strategy
    chunk_size: ChunkSize
    overlap_pct: OverlapPct

    @property
    def key(self) -> str:
        """Stable file/cache key, e.g. ``theo_dieu-512-10``."""
        return f"{self.strategy}-{self.chunk_size}-{self.overlap_pct}"

    @property
    def overlap_tokens(self) -> int:
        return self.chunk_size * self.overlap_pct // 100


ALL_VARIANTS: Final = tuple(
    IndexVariant(s, c, o) for s, c, o in product(STRATEGIES, CHUNK_SIZES, OVERLAP_PCTS)
)

# --- The one tokenizer ---------------------------------------------------------------------
# Every engine token count (chunk_size, pack budget, pack.tokens) uses this, never the LLM's
# tokenizer. Words (Vietnamese syllables, numbers) and single punctuation marks count as one
# token each. Measured on qcdt-2024: within 3% of the XLM-R tokenizer of multilingual-e5
# (13,792 vs 13,649 tokens). Real LLM usage for stars always comes from provider usage.
# ponytail: approximation; swap for a model tokenizer if calibration shows drift, then rebuild.
TOKENIZER_ID: Final = "regex-v1"
TOKEN_RE: Final = re.compile(r"\w+|[^\w\s]")


def count_tokens(text: str) -> int:
    return sum(1 for _ in TOKEN_RE.finditer(text))
