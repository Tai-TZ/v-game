"""Graph validation (engine-v0.2.md §7.2): every runnable layer's issues in one 422 payload.

Only an unreadable payload (P01/P02 decode, P03 shape) stops early. Player text is data: it is
never used as a format string, and P03 never echoes the payload.
"""

import json
from collections import Counter, defaultdict
from graphlib import CycleError, TopologicalSorter
from typing import Literal

from pydantic import JsonValue, ValidationError

from vgame.engine.blocks import BlockParams
from vgame.engine.constants import (
    FORBIDDEN_CHARS_RE,
    MAX_LLM_BLOCKS,
    MAX_LLM_CALLS_PER_CASE,
    MAX_NODES,
    MAX_PAYLOAD_BYTES,
    SYSTEM_PROMPT_MAX_CHARS,
)
from vgame.engine.graph import GraphNode, GraphPayload, nfc, split_ref
from vgame.engine.levels import LevelSpec, ParamLimit
from vgame.engine.registry import PORT_TYPE_VI, REGISTRY, BlockSpec
from vgame.engine.retrieval import vi_number
from vgame.engine.types import ValidationIssue

Edge = tuple[str, str, str, str]  # src node, src port, dst node, dst port
_FUSION_LISTS = range(2, 4)
_ECHO_MAX = 40


def _issue(
    code: str,
    message_vi: str,
    node: str | None = None,
    port: str | None = None,
    concept_ref: str | None = None,
    severity: Literal["error", "info"] = "error",
) -> ValidationIssue:
    return {
        "code": code,
        "severity": severity,
        "node": node,
        "port": port,
        "message_vi": message_vi,
        "concept_ref": concept_ref,
    }


def _num(value: object) -> str:
    if isinstance(value, bool):
        return "bật" if value else "tắt"
    if isinstance(value, float) and not value.is_integer():
        return f"{value:g}".replace(".", ",")
    if isinstance(value, int | float):
        return vi_number(int(value))
    return str(value)


def _echo(text: str) -> str:
    return text if len(text) <= _ECHO_MAX else text[: _ECHO_MAX - 1] + "…"


def _concept(spec: BlockSpec, param: str | None = None) -> str | None:
    if param is not None:
        hit = next((c for c in spec.concepts if c.endswith("." + param)), None)
        if hit is not None:
            return hit
    return spec.concepts[0] if spec.concepts else None


def _has_forbidden(value: JsonValue) -> bool:
    if isinstance(value, str):
        return FORBIDDEN_CHARS_RE.search(value) is not None
    if isinstance(value, list):
        return any(_has_forbidden(v) for v in value)
    if isinstance(value, dict):
        return any(_has_forbidden(k) or _has_forbidden(v) for k, v in value.items())
    return False


# --- Step 1-2: decode ----------------------------------------------------------------------


def _decode(raw: bytes) -> tuple[JsonValue, list[ValidationIssue]] | ValidationIssue:
    if len(raw) > MAX_PAYLOAD_BYTES:
        return _issue("P01", "Đồ thị quá lớn (tối đa 64 KB). Hãy bớt khối hoặc rút gọn chữ.")
    unreadable = _issue("P02", "Không đọc được đồ thị: dữ liệu không phải JSON UTF-8 hợp lệ.")
    try:
        data: JsonValue = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError, RecursionError):
        return unreadable
    issues = []
    try:  # json.loads accepts nesting deeper than these recursive walks can go
        if _has_forbidden(data):
            issues.append(
                _issue(
                    "P02", "Đồ thị chứa ký tự điều khiển hoặc ký tự đảo chiều ẩn. Hãy xoá chúng."
                )
            )
        return nfc(data), issues
    except RecursionError:
        return unreadable


def _shape(data: JsonValue) -> GraphPayload | ValidationIssue:
    try:
        graph = GraphPayload.model_validate(data)
    except ValidationError as exc:
        loc = exc.errors()[0]["loc"]
        where = ""
        if len(loc) >= 2 and loc[0] == "nodes" and isinstance(loc[1], int):
            where = f" (khối thứ {loc[1] + 1})"
        return _issue("P03", "Đồ thị không đúng định dạng" + where + ".")
    ids = Counter(n.id for n in graph.nodes)
    dup = next((i for i, c in ids.items() if c > 1), None)
    if dup is not None:
        return _issue("P03", f"Có hai khối cùng mã «{dup}».", node=dup)
    if len(graph.nodes) > MAX_NODES:
        return _issue("P03", f"Đồ thị có {len(graph.nodes)} khối, tối đa là {MAX_NODES}.")
    return graph


# --- Step 3-4: blocks and params -----------------------------------------------------------


def _relock(graph: GraphPayload, level: LevelSpec) -> list[GraphNode]:
    """Server re-inserts locked nodes from the starter graph, dropping the client's copy."""
    nodes = {n.id: n for n in graph.nodes}
    for node_id in level.locked_nodes:
        locked = level.starter_graph.node(node_id)
        if locked is not None:
            nodes[node_id] = locked
    return list(nodes.values())


def _param_errors(node: GraphNode, spec: BlockSpec, exc: ValidationError) -> list[ValidationIssue]:
    issues = []
    for err in exc.errors():
        name = str(err["loc"][0]) if err["loc"] else ""
        ctx = err.get("ctx", {})
        kind = err["type"]
        if kind == "extra_forbidden":
            msg = f"*{spec.name_vi}* không có tham số «{_echo(name)}»."
        elif kind == "string_too_long" and name == "system_prompt":
            length = len(str(node.params.get("system_prompt", "")))
            msg = (
                f"System prompt dài {vi_number(length)} ký tự, tối đa là "
                f"{vi_number(SYSTEM_PROMPT_MAX_CHARS)}. Prompt dài hơn không tự tốt hơn: mỗi ký tự "
                "là token bạn phải trả ở mọi lần gọi (Ngày 1)."
            )
        elif kind == "greater_than_equal":
            msg = f"{name} của *{spec.name_vi}* tối thiểu là {_num(ctx.get('ge'))}."
        elif kind == "less_than_equal":
            msg = f"{name} của *{spec.name_vi}* tối đa là {_num(ctx.get('le'))}."
        elif kind == "multiple_of":
            msg = f"{name} của *{spec.name_vi}* phải là bội của {_num(ctx.get('multiple_of'))}."
        elif kind == "literal_error":
            msg = f"{name} của *{spec.name_vi}* chỉ nhận: {ctx.get('expected')}."
        else:
            msg = f"{name} của *{spec.name_vi}* có giá trị không hợp lệ."
        issues.append(_issue("G06", msg, node.id, None, _concept(spec, name)))
    return issues


_WHY = {"top_k": " Lấy nhiều đoạn sẽ làm loãng context và tốn token (Ngày 7)."}


def _limit_errors(
    node: GraphNode, spec: BlockSpec, params: BlockParams, limits: dict[str, ParamLimit]
) -> list[ValidationIssue]:
    issues = []
    for key, limit in limits.items():
        block, _, name = key.partition(".")
        if block != spec.type or name not in type(params).model_fields:
            continue
        value = getattr(params, name)
        msg = None
        if limit.const is not None and value != limit.const:
            msg = f"{name} của *{spec.name_vi}* chưa mở ở level này (giữ ở {_num(limit.const)})."
        elif isinstance(value, int | float) and not isinstance(value, bool):
            if limit.le is not None and value > limit.le:
                msg = f"{name} tối đa là {_num(limit.le)} ở level này." + _WHY.get(name, "")
            elif limit.ge is not None and value < limit.ge:
                msg = f"{name} tối thiểu là {_num(limit.ge)} ở level này."
            elif limit.multiple_of is not None:
                ratio = value / limit.multiple_of
                if abs(ratio - round(ratio)) > 1e-9:
                    msg = f"{name} phải là bội của {_num(limit.multiple_of)} ở level này."
        if msg is not None:
            issues.append(_issue("G06", msg, node.id, None, _concept(spec, name)))
    return issues


# --- Step 5-6: edges -----------------------------------------------------------------------


def _edges(
    graph: GraphPayload, nodes: dict[str, GraphNode]
) -> tuple[list[Edge], list[ValidationIssue]]:
    issues: list[ValidationIssue] = []
    valid: list[Edge] = []
    seen: set[tuple[str, str]] = set()
    for src_ref, dst_ref in graph.edges:
        label = _echo(f"{src_ref} → {dst_ref}")
        src, dst = split_ref(src_ref), split_ref(dst_ref)
        if src is None or dst is None or src[0] not in nodes or dst[0] not in nodes:
            issues.append(_issue("G02", f"Cạnh «{label}» nối tới khối không tồn tại."))
            continue
        s_spec, d_spec = REGISTRY[nodes[src[0]].type], REGISTRY[nodes[dst[0]].type]
        out_port, in_port = s_spec.outputs.get(src[1]), d_spec.inputs.get(dst[1])
        if out_port is None or in_port is None:
            issues.append(_issue("G02", f"Cạnh «{label}» nối tới cổng không tồn tại.", dst[0]))
            continue
        if (src_ref, dst_ref) in seen:
            issues.append(_issue("G02", f"Cạnh «{label}» bị lặp.", dst[0], dst[1]))
            continue
        seen.add((src_ref, dst_ref))
        if out_port.type != in_port.type:
            if d_spec.type == "output":
                msg = (
                    "*Trả lời* cần một câu trả lời đã sinh. Tài liệu chỉ là nguyên liệu cho bước "
                    "sinh (Augmentation → Generation, Ngày 8)."
                )
            else:
                msg = (
                    f"Cổng {PORT_TYPE_VI[out_port.type]} của *{s_spec.name_vi}* không cắm được "
                    f"vào cổng {PORT_TYPE_VI[in_port.type]} của *{d_spec.name_vi}*."
                )
            issues.append(_issue("G02", msg, dst[0], dst[1], _concept(d_spec)))
            continue
        valid.append((src[0], src[1], dst[0], dst[1]))

    fan_in = Counter((d, dp) for _, _, d, dp in valid)
    for node in nodes.values():
        spec = REGISTRY[node.type]
        for port, p in spec.inputs.items():
            count = fan_in[(node.id, port)]
            if count == 0 and p.required:
                msg = f"*{spec.name_vi}* chưa có gì cắm vào cổng {PORT_TYPE_VI[p.type]}."
                if spec.type == "llm":
                    msg += " Model chỉ thấy những gì ta đặt lên bàn (Ngày 4)."
                issues.append(_issue("G05", msg, node.id, port, _concept(spec)))
            elif spec.type == "output" and count > 1:
                issues.append(
                    _issue(
                        "G04",
                        "Một câu hỏi đang có hai đường tới *Trả lời*, nên khách sẽ nhận hai câu "
                        "trả lời. Mỗi ca chỉ được đi một nhánh (Routing, Ngày 3).",
                        node.id,
                        port,
                    )
                )
            elif not p.many and count > 1:
                msg = f"Cổng {PORT_TYPE_VI[p.type]} của *{spec.name_vi}* chỉ nhận một cạnh."
                issues.append(_issue("G02", msg, node.id, port, _concept(spec)))
            elif spec.type == "fusion" and count and count not in _FUSION_LISTS:
                msg = f"*{spec.name_vi}* gộp từ 2 đến 3 danh sách, đang có {count}."
                issues.append(_issue("G02", msg, node.id, port, _concept(spec)))
    return valid, issues


# --- Step 4 (cross-param rules, need edges) ------------------------------------------------


def _upstream_size(params: BlockParams) -> int | None:
    if hasattr(params, "top_k"):
        return int(params.top_k)
    if hasattr(params, "top_n"):
        return int(params.top_n)
    return None


def _cross_rules(
    nodes: dict[str, GraphNode], params: dict[str, BlockParams], edges: list[Edge]
) -> list[ValidationIssue]:
    issues = []
    sources: dict[tuple[str, str], list[str]] = defaultdict(list)
    for s, _, d, dp in edges:
        sources[(d, dp)].append(s)
    for node in nodes.values():
        p = params.get(node.id)
        spec = REGISTRY[node.type]
        if node.type == "rerank" and p is not None and hasattr(p, "top_n"):
            for src in sources[(node.id, "docs")]:
                size = _upstream_size(params[src]) if src in params else None
                if size is None:
                    continue
                if p.top_n > size:
                    msg = (
                        f"top_n của *{spec.name_vi}* là {p.top_n} nhưng phía trước chỉ lấy "
                        f"{size} đoạn."
                    )
                    issues.append(_issue("G06", msg, node.id, None, _concept(spec, "top_n")))
                elif p.top_n == size:
                    msg = (
                        f"Xếp hạng lại giữ {size}/{size} đoạn nên không đổi thứ tự, nhưng vẫn tốn "
                        "thời gian."
                    )
                    issues.append(
                        _issue("W_RERANK_NOOP", msg, node.id, None, _concept(spec), "info")
                    )
        if node.type == "fusion" and getattr(p, "method", None) == "alpha":
            kinds = sorted(nodes[s].type for s in sources[(node.id, "docs")])
            if kinds != ["bm25_search", "vector_search"]:
                msg = (
                    "Gộp theo alpha cần đúng một danh sách *Tìm theo nghĩa* và một danh sách "
                    "*Tìm từ khóa*."
                )
                issues.append(_issue("G06", msg, node.id, "docs", _concept(spec, "alpha")))
    return issues


# --- Step 7-10: structure ------------------------------------------------------------------


def _ancestors(target: str, edges: list[Edge]) -> set[str]:
    parents: dict[str, set[str]] = defaultdict(set)
    for s, _, d, _ in edges:
        parents[d].add(s)
    seen: set[str] = set()
    stack = [target]
    while stack:
        for p in parents[stack.pop()] - seen:
            seen.add(p)
            stack.append(p)
    return seen


def _structure(nodes: dict[str, GraphNode], edges: list[Edge]) -> list[ValidationIssue]:
    issues = []
    sorter: TopologicalSorter[str] = TopologicalSorter({n: set() for n in nodes})
    for s, _, d, _ in edges:
        sorter.add(d, s)
    try:
        sorter.prepare()
    except CycleError as exc:
        cycle = exc.args[1] if len(exc.args) > 1 else [None]
        issues.append(
            _issue(
                "G03",
                "Vòng lặp chỉ được nằm trong *Tác tử ReAct*, nơi max_iterations ngăn agent đi "
                "vòng mãi (Max Iterations Safeguard, Ngày 3). Đồ thị trong xưởng chạy một chiều.",
                cycle[0],
            )
        )

    outputs = [n.id for n in nodes.values() if n.type == "output"]
    if len(outputs) > 1:
        issues.append(
            _issue(
                "G04",
                "Một câu hỏi đang có hai đường tới *Trả lời*, nên khách sẽ nhận hai câu trả lời. "
                "Mỗi ca chỉ được đi một nhánh (Routing, Ngày 3).",
                outputs[1],
            )
        )
    g01 = _issue(
        "G01",
        "Câu hỏi của khách chưa có đường tới ô *Trả lời*. Mỗi ca đi từ *Câu hỏi khách*, qua các "
        "khối của bạn, rồi tới *Trả lời* (luồng một ca, Ngày 3).",
    )
    if not outputs:
        return [*issues, g01]
    out = outputs[0]
    upstream = _ancestors(out, edges)
    if not any(nodes[a].type == "input" for a in upstream):
        issues.append({**g01, "node": out})

    calls = sum(REGISTRY[nodes[a].type].llm_calls for a in upstream)
    llm_blocks = sum(1 for n in nodes.values() if REGISTRY[n.type].llm_calls)
    if calls > MAX_LLM_CALLS_PER_CASE:
        msg = f"Mỗi ca sẽ gọi LLM {calls} lần, trần của xưởng là {MAX_LLM_CALLS_PER_CASE}."
        issues.append(_issue("G07", msg))
    if llm_blocks > MAX_LLM_BLOCKS:
        msg = f"Đồ thị có {llm_blocks} khối gọi LLM, tối đa là {MAX_LLM_BLOCKS}."
        issues.append(_issue("G07", msg))

    for node in nodes.values():
        spec = REGISTRY[node.type]
        if spec.runtime and node.id != out and node.id not in upstream:
            msg = f"*{spec.name_vi}* không nằm trên đường nào tới *Trả lời* nên sẽ không chạy."
            issues.append(_issue("I01", msg, node.id, severity="info"))
    return issues


def validate(raw: bytes, level: LevelSpec) -> tuple[GraphPayload | None, list[ValidationIssue]]:
    """Returns the normalised graph (NFC, locked nodes re-inserted, params with defaults) when
    no issue has severity ``error``; issues always include the info ones."""
    decoded = _decode(raw)
    if not isinstance(decoded, tuple):
        return None, [decoded]
    data, issues = decoded
    shaped = _shape(data)
    if not isinstance(shaped, GraphPayload):
        return None, [*issues, shaped]
    graph = shaped

    nodes = {n.id: n for n in _relock(graph, level)}
    params: dict[str, BlockParams] = {}
    for node in nodes.values():
        spec = REGISTRY[node.type]
        if node.type not in level.allowed_blocks:
            msg = f"Khối *{spec.name_vi}* chưa mở ở level này."
            issues.append(_issue("G06", msg, node.id, None, _concept(spec)))
            continue
        try:
            params[node.id] = spec.params.model_validate(node.params, strict=True)
        except ValidationError as exc:
            issues.extend(_param_errors(node, spec, exc))
            continue
        issues.extend(_limit_errors(node, spec, params[node.id], level.param_limits))

    edges, edge_issues = _edges(graph, nodes)
    issues += edge_issues
    issues += _cross_rules(nodes, params, edges)
    issues += _structure(nodes, edges)

    if any(i["severity"] == "error" for i in issues):
        return None, issues
    normalised = graph.model_copy(
        update={
            "nodes": [
                n.model_copy(update={"params": params[n.id].model_dump(mode="json")})
                for n in nodes.values()
            ]
        }
    )
    return normalised, issues
