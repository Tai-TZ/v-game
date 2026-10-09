import { domain, fillDefaults, isAllowed, type Env } from "./bench";
import { TOY, toyName } from "./copy";
import type { BlockType, Graph, Issue } from "./schema";

/**
 * The rules of backend `engine/validator.py` a bench can break (workbench-v0.1 §5), with the
 * same codes, nodes, ports and Vietnamese messages, in the server's order: fan-in per node, then
 * the cross-param rules. Every other rule cannot happen on a bench (§3.4); the server's 422
 * still shows in the same place if it ever does.
 */
export function validateGraph(env: Env, graph: Graph): Issue[] {
  const { blocks } = env;
  const issues: Issue[] = [];
  const issue = (
    code: string,
    message_vi: string,
    node: string,
    port: string | null,
    severity: Issue["severity"] = "error",
  ) => issues.push({ code, severity, node, port, message_vi });

  const types = new Map(graph.nodes.map((node) => [node.id, node.type]));
  const params = new Map(fillDefaults(blocks, graph).nodes.map((node) => [node.id, node.params]));
  const sources = (node: string, port: string) =>
    graph.edges.flatMap(([src, dst]) => {
      const [srcNode] = src.split(".");
      return dst === `${node}.${port}` && srcNode && types.has(srcNode) ? [srcNode] : [];
    });

  for (const node of graph.nodes) {
    const spec = blocks[node.type];
    for (const [port, p] of Object.entries(spec.inputs)) {
      const count = sources(node.id, port).length;
      if (count === 0 && p.required) {
        let message = `*${spec.name_vi}* chưa có gì cắm vào cổng ${p.type_vi}.`;
        if (node.type === "llm") message += " Model chỉ thấy những gì ta đặt lên bàn (Ngày 4).";
        issue("G05", message, node.id, port);
      } else if (!p.many && count > 1) {
        issue("G02", `Cổng ${p.type_vi} của *${spec.name_vi}* chỉ nhận một cạnh.`, node.id, port);
      } else if (node.type === "fusion" && count > 0 && (count < 2 || count > 3)) {
        issue(
          "G02",
          `*${spec.name_vi}* gộp từ 2 đến 3 danh sách, đang có ${count}.`,
          node.id,
          port,
        );
      }
    }
  }

  for (const node of graph.nodes) {
    const own = params.get(node.id) ?? {};
    const name = blocks[node.type].name_vi;
    if (node.type === "rerank" && typeof own.top_n === "number") {
      for (const src of sources(node.id, "docs")) {
        const upstream = params.get(src) ?? {};
        const size = upstream.top_k ?? upstream.top_n;
        if (typeof size !== "number") continue;
        if (own.top_n > size) {
          issue(
            "G06",
            `top_n của *${name}* là ${own.top_n} nhưng phía trước chỉ lấy ${size} đoạn.`,
            node.id,
            null,
          );
        } else if (own.top_n === size) {
          issue(
            "W_RERANK_NOOP",
            `Xếp hạng lại giữ ${size}/${size} đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian.`,
            node.id,
            null,
            "info",
          );
        }
      }
    }
    if (node.type === "fusion" && own.method === "alpha") {
      const kinds = sources(node.id, "docs")
        .map((src) => types.get(src))
        .sort();
      if (kinds.length !== 2 || kinds[0] !== "bm25_search" || kinds[1] !== "vector_search") {
        issue(
          "G06",
          "Gộp theo alpha cần đúng một danh sách *Tìm theo nghĩa* và một danh sách *Tìm từ khóa*.",
          node.id,
          "docs",
        );
      }
    }
  }
  return issues;
}

export const errorsOf = (issues: readonly Issue[]) =>
  issues.filter((issue) => issue.severity === "error");

export interface Fix {
  /** One next step after the server-mirrored message (which says what, not what to do). */
  hint: string;
  /** Focus target of the error's button: the control that fixes it (§9). */
  slot: BlockType;
  param?: string;
}

/**
 * The fix for each error a bench can produce (the §5 table), and for the no-op magnifier note;
 * null for anything else.
 */
export function fixFor(env: Env, graph: Graph, issue: Issue): Fix | null {
  const node = graph.nodes.find((n) => n.id === issue.node);
  if (!node) return null;
  /** The block in front of the magnifier whose size the message quotes ("{size} đoạn"). */
  const frontOf = (size: number) => {
    const fronts = graph.edges.flatMap(([src, dst]) =>
      dst === `${node.id}.docs` ? graph.nodes.filter((n) => src === `${n.id}.docs`) : [],
    );
    return fronts.find((n) => (n.params.top_k ?? n.params.top_n) === size) ?? fronts[0];
  };
  if (issue.code === "W_RERANK_NOOP") {
    // L3's lesson: fetch wider, then let the magnifier pick. At the hook's limit: keep fewer.
    const size = Number(/(\d+)\/\d+ đoạn/.exec(issue.message_vi)?.[1]);
    const front = frontOf(size);
    const knob = front && TOY[front.type].params?.top_k;
    const d = front && domain(env, front.type, "top_k");
    if (front && knob && d?.kind === "range" && size < d.max) {
      return {
        hint: `Tăng ${knob} của ${toyName(front.type, front.params)} (tối đa ${d.max}) để ${toyName(node.type)} có đoạn để chọn.`,
        slot: front.type,
        param: "top_k",
      };
    }
    return {
      hint: `Giảm ${TOY.rerank.params?.top_n ?? ""} của ${toyName(node.type)} để nó chỉ giữ đoạn tốt nhất.`,
      slot: "rerank",
      param: "top_n",
    };
  }
  if (issue.severity !== "error") return null;
  const search = (["vector_search", "bm25_search"] as const).filter((t) => isAllowed(env.level, t));
  const missing = search.find((type) => !graph.nodes.some((n) => n.type === type));
  const names = search.map((type) => TOY[type].name);
  const own = toyName(node.type, node.params);
  switch (`${issue.code} ${node.type}`) {
    case "G02 fusion":
      return missing
        ? { hint: `Gắn thêm ${TOY[missing].name} hoặc tháo ${own}.`, slot: missing }
        : null;
    case "G02 rerank":
      return { hint: "Gắn Phễu để gộp hai danh sách, hoặc tháo một khe tìm.", slot: "fusion" };
    case "G05 fusion":
    case "G05 rerank":
      return missing ? { hint: `Gắn ${names.join(" hoặc ")}.`, slot: missing } : null;
    case "G06 rerank": {
      // The block in front: the one whose size the message quotes ("chỉ lấy {size} đoạn").
      const front = frontOf(Number(/(\d+) đoạn\.$/.exec(issue.message_vi)?.[1]));
      const knob = front && TOY[front.type].params?.top_k;
      return {
        hint: `Giảm Số đoạn giữ lại của ${own}${front && knob ? `, hoặc tăng ${knob} của ${toyName(front.type, front.params)}` : ""}.`,
        slot: "rerank",
        param: "top_n",
      };
    }
    case "G06 fusion":
      return {
        hint: `Gắn cả ${names.join(" lẫn ")}, hoặc đổi sang Phễu RRF.`,
        slot: "fusion",
        param: "method",
      };
    default:
      return null;
  }
}
