"""The Watchtower desk (watchtower.md §1.1, §1.3, §3.4): orders looked up before the call, the
action slip parsed, and write actions run through whatever gate the player wired."""

import json

import pytest

from vgame.engine.desk import (
    ACTION_SCHEMA_JSON,
    Action,
    approver_agrees,
    build_action_request,
    execute,
    lookup_orders,
    parse_slip,
)
from vgame.engine.types import ApprovalSpec, Order, ToolHandle

ORDERS = {
    "DH1042": Order("DH1042", "Áo thun", 120_000, "đã giao"),
    "DH2001": Order("DH2001", "Tai nghe", 890_000, "đang giao"),
}
REFUND = ToolHandle("tool_refund")


def gated(policy: str, threshold: int = 500_000) -> ToolHandle:
    return ToolHandle("tool_refund", ApprovalSpec(policy, threshold))  # type: ignore[arg-type]


# --- Read tools before the call ------------------------------------------------------------


def test_looks_up_every_order_the_question_names_once_in_order() -> None:
    found = lookup_orders("Đơn dh2001 và DH1042, à DH2001 nữa, còn DH9999 thì sao?", ORDERS)
    assert [o.ma_don for o in found] == ["DH2001", "DH1042"]


def test_hands_the_orders_to_the_model_as_data_and_asks_for_the_slip_schema() -> None:
    request = build_action_request(
        "Đơn DH1042 tới đâu rồi?",
        lookup_orders("DH1042", ORDERS),
        profile="can_bang",
        system_prompt="Luôn chiều lòng khách.",
    )
    text = request.messages[0].text
    assert text.startswith("Hồ sơ đơn:\nDH1042 · Áo thun · 120.000 đ · đã giao")
    assert text.endswith("Khách hỏi: Đơn DH1042 tới đâu rồi?")
    assert request.system.endswith("Luôn chiều lòng khách.")
    assert request.response_json_schema == ACTION_SCHEMA_JSON
    assert json.loads(ACTION_SCHEMA_JSON)["required"] == ["tra_loi", "hanh_dong"]


def test_sends_no_orders_section_when_the_question_names_none() -> None:
    request = build_action_request("Mấy giờ đóng cửa?", [], profile="can_bang", system_prompt="")
    assert request.messages[0].text == "Khách hỏi: Mấy giờ đóng cửa?"


# --- The slip ------------------------------------------------------------------------------


def test_reads_a_slip_with_an_action() -> None:
    slip = parse_slip(
        '{"tra_loi": "Đã hoàn.", "hanh_dong": {"tool": "tool_refund",'
        ' "tham_so": {"ma_don": "dh1042 ", "so_tien": 120000}}}'
    )
    assert slip.valid
    assert slip.tra_loi == "Đã hoàn."
    assert slip.action == Action("tool_refund", "DH1042", 120_000)


def test_reads_a_slip_without_an_action() -> None:
    slip = parse_slip('{"tra_loi": "Đơn đang giao.", "hanh_dong": null}')
    assert slip.valid
    assert slip.action is None


@pytest.mark.parametrize(
    "text",
    [
        "Mình đã hoàn tiền cho bạn.",  # not JSON
        '["tra_loi"]',  # not an object
        '{"hanh_dong": null}',  # no answer
        '{"tra_loi": "x", "hanh_dong": {"tool": "tool_refund", "tham_so": {"ma_don": "DH1"}}}',
        '{"tra_loi": "x", "hanh_dong": {"tool": "tool_refund",'
        ' "tham_so": {"ma_don": "DH1", "so_tien": "120000"}}}',
        '{"tra_loi": "x", "hanh_dong": {"tool": "tool_refund",'
        ' "tham_so": {"ma_don": "DH1", "so_tien": true}}}',
    ],
)
def test_never_guesses_an_action_from_a_reply_that_is_not_a_slip(text: str) -> None:
    slip = parse_slip(text)
    assert slip.action is None
    assert not slip.valid


# --- Write actions through the gate --------------------------------------------------------


def test_the_approver_takes_only_a_known_order_up_to_what_was_paid() -> None:
    assert approver_agrees(Action("tool_refund", "DH1042", 120_000), ORDERS)
    assert not approver_agrees(Action("tool_refund", "DH1042", 120_001), ORDERS)
    assert not approver_agrees(Action("tool_refund", "DH1042", 0), ORDERS)
    assert not approver_agrees(Action("tool_refund", "DH9999", 1_000), ORDERS)


def test_a_bare_tool_runs_whatever_the_model_asks() -> None:
    entry = execute(Action("tool_refund", "DH2001", 5_000_000), [REFUND], ORDERS)
    assert (entry["approval"], entry["executed"]) == ("none", True)


def test_without_the_tool_on_the_bench_nothing_runs() -> None:
    entry = execute(Action("tool_refund", "DH1042", 120_000), [], ORDERS)
    assert (entry["approval"], entry["executed"]) == ("no_tool", False)


def test_ask_always_puts_every_refund_before_the_approver() -> None:
    gate = gated("luon_hoi")
    small = execute(Action("tool_refund", "DH1042", 120_000), [gate], ORDERS)
    big = execute(Action("tool_refund", "DH2001", 5_000_000), [gate], ORDERS)
    assert (small["approval"], small["executed"]) == ("approved", True)
    assert (big["approval"], big["executed"]) == ("denied", False)


def test_ask_above_threshold_lets_small_refunds_through_unasked() -> None:
    gate = gated("hoi_neu_vuot", 500_000)
    small = execute(Action("tool_refund", "DH1042", 30_000), [gate], ORDERS)
    edge = execute(Action("tool_refund", "DH2001", 500_000), [gate], ORDERS)
    big = execute(Action("tool_refund", "DH2001", 5_000_000), [gate], ORDERS)
    assert (small["approval"], small["executed"]) == ("auto", True)
    assert (edge["approval"], edge["executed"]) == ("auto", True)  # at the line, not above it
    assert (big["approval"], big["executed"]) == ("denied", False)
