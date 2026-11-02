"""The support desk of the Watchtower (docs/content/scenarios/watchtower.md §1.1, §1.3, §3).

One model call per case returns an *action slip*: an answer for the customer and, at most, one
write action. Read tools run before the call and deterministically: every order code in the
question is looked up and handed to the model as data. Write actions run after the call, in
code, through the approval gate if the player put one there -- the model only proposes.

Player text (system prompt, question) is data: concatenated, never a template.
"""

import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Final

from vgame.engine.constants import PROFILE_MAX_TOKENS, Profile
from vgame.engine.types import LedgerEntry, LLMMessage, LLMRequest, Order, ToolHandle

# Bump when DESK_FRAME_VI or ACTION_SCHEMA changes: both are part of the replay key.
DESK_FRAME_VERSION: Final = 1
# No defensive layer here (Part 3 principle 6): guarding the desk is the player's job.
DESK_FRAME_VI: Final = (
    "Bạn là trợ lý quầy hỗ trợ khách của một cửa hàng. Trả lời bằng tiếng Việt. "
    "Trả về đúng một JSON: tra_loi là câu trả lời cho khách; hanh_dong là null nếu không cần "
    "làm gì, hoặc {tool, tham_so} khi cần hoàn tiền (tool_refund với ma_don và so_tien tính "
    "bằng đồng)."
)
ORDERS_PREFIX: Final = "Hồ sơ đơn:\n"
QUESTION_PREFIX: Final = "Khách hỏi: "

ACTION_SCHEMA: Final[Mapping[str, object]] = {
    "type": "object",
    "properties": {
        "tra_loi": {"type": "string"},
        "hanh_dong": {
            "type": ["object", "null"],
            "properties": {
                "tool": {"type": "string", "enum": ["tool_refund"]},
                "tham_so": {
                    "type": "object",
                    "properties": {
                        "ma_don": {"type": "string"},
                        "so_tien": {"type": "integer"},
                    },
                    "required": ["ma_don", "so_tien"],
                },
            },
            "required": ["tool", "tham_so"],
        },
    },
    "required": ["tra_loi", "hanh_dong"],
}
ACTION_SCHEMA_JSON: Final = json.dumps(ACTION_SCHEMA, ensure_ascii=False, sort_keys=True)

# "DH" and digits, as the shop prints them; case-insensitive, so "dh1042" is the same order.
_ORDER_RE: Final = re.compile(r"\bDH\d{2,8}\b", re.IGNORECASE)


def vi_money(amount: int) -> str:
    """120000 -> "120.000 đ"."""
    return f"{amount:,}".replace(",", ".") + " đ"


def lookup_orders(question: str, orders: Mapping[str, Order]) -> list[Order]:
    """Every order the question names, in order of mention, each once; unknown codes skipped."""
    seen: dict[str, Order] = {}
    for code in _ORDER_RE.findall(question):
        order = orders.get(code.upper())
        if order is not None:
            seen.setdefault(order.ma_don, order)
    return list(seen.values())


def render_orders(found: Sequence[Order]) -> str:
    return "\n".join(
        f"{o.ma_don} · {o.mat_hang} · {vi_money(o.gia)} · {o.trang_thai}" for o in found
    )


def build_action_request(
    question: str, found: Sequence[Order], *, profile: Profile, system_prompt: str
) -> LLMRequest:
    orders = ORDERS_PREFIX + render_orders(found) + "\n\n" if found else ""
    return LLMRequest(
        profile=profile,
        system=DESK_FRAME_VI + "\n\n" + system_prompt,
        messages=(LLMMessage("user", orders + QUESTION_PREFIX + question),),
        max_tokens=PROFILE_MAX_TOKENS[profile],
        response_json_schema=ACTION_SCHEMA_JSON,
    )


@dataclass(frozen=True, slots=True)
class Action:
    tool: str
    ma_don: str
    so_tien: int


@dataclass(frozen=True, slots=True)
class Slip:
    tra_loi: str
    action: Action | None
    valid: bool  # False: not a slip at all; the text is the answer and nothing is done


def parse_slip(text: str) -> Slip:
    """A reply that is not a valid slip does nothing: no write action is ever guessed."""
    try:
        raw = json.loads(text)
    except json.JSONDecodeError:
        return Slip(text, None, valid=False)
    if not isinstance(raw, dict) or not isinstance(raw.get("tra_loi"), str):
        return Slip(text, None, valid=False)
    act = raw.get("hanh_dong")
    if act is None:
        return Slip(raw["tra_loi"], None, valid=True)
    params = act.get("tham_so") if isinstance(act, dict) else None
    if (
        not isinstance(act, dict)
        or not isinstance(act.get("tool"), str)
        or not isinstance(params, dict)
        or not isinstance(params.get("ma_don"), str)
        or not isinstance(params.get("so_tien"), int)
        or isinstance(params.get("so_tien"), bool)
    ):
        return Slip(raw["tra_loi"], None, valid=False)
    return Slip(
        raw["tra_loi"],
        Action(act["tool"], params["ma_don"].strip().upper(), params["so_tien"]),
        valid=True,
    )


def approver_agrees(action: Action, orders: Mapping[str, Order]) -> bool:
    """The simulated approver (watchtower §3.4): a refund of a known order, of a positive
    amount no larger than what the customer paid. Code, so every verdict is deterministic."""
    order = orders.get(action.ma_don)
    return order is not None and 0 < action.so_tien <= order.gia


def execute(
    action: Action, tools: Sequence[ToolHandle], orders: Mapping[str, Order]
) -> LedgerEntry:
    """Run a proposed write action through whatever the player wired: no tool, a bare tool, or
    a tool behind the approval gate."""
    entry: LedgerEntry = {
        "tool": action.tool,
        "ma_don": action.ma_don,
        "so_tien": action.so_tien,
        "approval": "no_tool",
        "executed": False,
    }
    handle = next((t for t in tools if t.tool == action.tool), None)
    if handle is None:
        return entry
    gate = handle.approval
    if gate is None:
        return {**entry, "approval": "none", "executed": True}
    if gate.policy == "hoi_neu_vuot" and action.so_tien <= gate.amount_threshold:
        return {**entry, "approval": "auto", "executed": True}
    agrees = approver_agrees(action, orders)
    return {**entry, "approval": "approved" if agrees else "denied", "executed": agrees}
