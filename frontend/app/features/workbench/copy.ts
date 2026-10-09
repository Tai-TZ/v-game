import { domain, isAllowed, nodeIds, type Env } from "./bench";
import { unfinished, type CaseView, type RunView } from "./run";
import type { BlockType, Graph, JsonValue, RunReport } from "./schema";

/**
 * Every Vietnamese string of the workbench (docs/design/workbench-v0.1.md §8). Lines quoted from
 * the scenarios come from docs/content/scenarios/library*.md and npc-cast.md; update them here
 * when the scenarios change.
 */

/** Toy names per block, and per param where the param has its own toy (§8.3). */
export const TOY: Readonly<Record<BlockType, { name: string; params?: Record<string, string> }>> = {
  input: { name: "Chuông quầy" },
  corpus: { name: "Kệ sách" },
  chunker: {
    name: "Lược dao",
    params: {
      strategy: "Nam châm bám Điều",
      chunk_size: "Lược dao",
      overlap_pct: "Băng keo",
      only_in_force: "Kính lọc hiệu lực",
    },
  },
  vector_search: {
    name: "Vòm Sao",
    params: { top_k: "Móc kéo", score_threshold: "Màn lọc mờ" },
  },
  bm25_search: { name: "Tủ ngăn kéo", params: { top_k: "Móc kéo ngăn" } },
  fusion: {
    name: "Phễu",
    params: { k: "Hằng số k", alpha: "Độ nghiêng", top_k: "Số đoạn giữ lại" },
  },
  rerank: { name: "Kính lúp", params: { top_n: "Số đoạn giữ lại" } },
  context_packer: { name: "Thùng Context", params: { cite_ids: "Máy đóng tem" } },
  llm: { name: "Bộ Óc", params: { system_prompt: "Lăng kính", profile: "Mức suy nghĩ" } },
  output: { name: "Bảng trả lời" },
};

/**
 * The toy a diagnosis opens: the knob's own where the slot's knobs are toys of their own (the
 * chunker's Nam châm, Kính lọc), so two lessons on one slot read differently.
 */
export function knobName(type: BlockType, param?: string): string {
  return (type === "chunker" && param ? TOY.chunker.params?.[param] : undefined) ?? TOY[type].name;
}

/** Toy of a node: the fusion toy depends on its method (Phễu for rrf, Bập bênh for alpha). */
export function toyName(type: BlockType, params?: Readonly<Record<string, JsonValue>>): string {
  if (type === "fusion" && params?.method === "alpha") return "Bập bênh";
  return TOY[type].name;
}

export const ENUM_VI: Readonly<Record<string, string>> = {
  co_dinh: "Cắt đều theo token",
  theo_dieu: "Bám điều, khoản",
  rrf: "Phễu RRF (theo hạng)",
  alpha: "Bập bênh α (theo điểm)",
  nhe: "nhẹ",
  can_bang: "cân bằng",
  sau: "sâu",
  cat_duoi: "cắt đuôi",
};

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
/** Vietnamese number: 15.000, 0,83. */
export const fmt = (value: number) => number.format(value);

const UNIT: Readonly<Record<string, string>> = {
  top_k: "đoạn",
  top_n: "đoạn",
  chunk_size: "token",
  token_budget: "token",
  overlap_pct: "%",
};

/** A param value as the player reads it: "3 đoạn", "512 token", "10 %", "0,15", "bật". */
export function fmtValue(param: string, value: JsonValue): string {
  if (typeof value === "boolean") return value ? "bật" : "tắt";
  if (typeof value === "number") {
    const unit = UNIT[param];
    return unit ? `${fmt(value)} ${unit}` : fmt(value);
  }
  if (typeof value === "string") return ENUM_VI[value] ?? value;
  return JSON.stringify(value);
}

export interface LevelCopy {
  /** Asker of case #1 (scenario §4). */
  asker: string;
  intro: string;
  win1: string;
  win3: string;
  /** Star rules PublicLevel does not return (engine/levels/<id>.json `rules`); see §8.2. */
  s1Required: readonly string[];
  s3ForbiddenLabels: readonly string[];
  /** Knobs that do nothing at this level, by param, with why (shown dimmed, scenario §5). */
  inertKnobs?: Readonly<Record<string, string>>;
}

/** Cô Lan's lines per level, verbatim from each scenario §4 (beats 3 and 12). */
export const LEVEL_COPY: Readonly<Record<string, LevelCopy>> = {
  "grounded-citation": {
    asker: "Minh",
    intro:
      "Tối nay có mười câu hỏi. Mình cần ít nhất sáu trên tám câu thường đúng và có nguồn, còn hai câu bẫy thì nó phải biết nói 'không có'.",
    win1: "Bảng tin sạch rồi. Chú Bảy dặn lần sau in ít thôi.",
    win3: "Biết nói 'không có' đúng lúc, đó là kỹ năng mình quý nhất ở một thủ thư.",
    s1Required: ["lib-l1-v01"],
    s3ForbiddenLabels: ["cite_unknown"],
  },
  "chunk-tuning": {
    asker: "Hà",
    intro:
      "Mười ba câu tối nay: ít nhất tám trên mười câu thường phải đủ ý, và không câu nào được trả lời theo bản cũ.",
    win1: "Phòng đào tạo nhận đơn của Hà rồi. Bạn ấy gửi hộp bánh cảm ơn, mình sẽ không chia cho Bống.",
    win3: "Không một tờ giấy vàng nào lọt vào thùng. Phòng lưu trữ sẽ tự hào về bạn.",
    s1Required: ["lib-l2-v01"],
    s3ForbiddenLabels: ["stale_doc"],
  },
  "article-number-lookup": {
    asker: "Khang",
    intro:
      "Tối nay có người hỏi bằng số điều, có người hỏi bằng lời thường. Tám trên mười câu thường phải đúng, kể cả câu của Khang, và ca của Hà hôm trước không được vỡ.",
    win1: "Hàng người giải tán rồi. Hai cách tìm, mỗi cách che điểm mù cho cách kia.",
    win3: "Ca của Hà vẫn xanh. Cái bảng đó là thứ mình xem đầu tiên mỗi khi có ai sửa trợ lý.",
    s1Required: ["lib-l3-v01"],
    s3ForbiddenLabels: [],
    inertKnobs: { only_in_force: "Kho tối nay không có văn bản hết hiệu lực." },
  },
};

export const ROLE_VI: Readonly<Record<string, string>> = {
  visible: "Câu mẫu",
  hidden: "Câu ẩn",
  trap: "Câu bẫy",
};

export const VAI_VI: Readonly<Record<string, string>> = {
  "su-kien": "Hỏi một dữ kiện",
  "dien-dat-lai": "Hỏi bằng lời đời thường",
  "ngoai-le-khoan-sau": "Cần cả khoản ngoại lệ",
  "cau-dai": "Đáp án dài",
  "nhieu-khoan": "Gộp nhiều khoản",
  "don-gian": "Câu đối chứng",
  "van-ban-cu": "Dễ nhầm bản cũ",
  "da-bai-bo": "Quy định đã bãi bỏ",
  "tra-so": "Hỏi bằng số điều",
  "tra-so-kho": "Số điều lẫn lời thường",
  "hoi-quy": "Ca hồi quy",
  "dieu-khong-ton-tai": "Điều không tồn tại",
  "khoan-khong-ton-tai": "Khoản không tồn tại",
  "ngoai-pham-vi": "Ngoài phạm vi quy chế",
};
export const vaiVi = (vai: string) => VAI_VI[vai] ?? vai;

/** Case and step statuses other than "ok". */
export const STATUS_VI: Readonly<Record<string, string>> = {
  refusal: "AI từ chối trả lời",
  timeout: "Hết giờ",
  cancelled: "Đã dừng",
  budget: "Hết lượt gọi AI",
  llm_error: "Lỗi gọi AI",
  index_error: "Lỗi chỉ mục",
  skipped_budget: "Bỏ qua vì hết lượt gọi AI",
};

export const CRITERIA_VI: Readonly<Record<string, string>> = {
  points: "Đủ ý",
  cited: "Có nguồn",
  no_fabrication: "Không bịa nguồn",
  no_forbidden: "Không có nội dung cấm",
  refusal: 'Biết nói "không có"',
  no_stale: "Không dùng văn bản cũ",
};

export const LABEL_VI: Readonly<Record<string, string>> = {
  cite_unknown: "Trích nguồn không có trong thùng",
  cite_missing: "Không trích nguồn",
  abstained: 'Đã nói "không có"',
  stale_doc: "Thùng có văn bản hết hiệu lực",
  ...STATUS_VI,
};

export const FLAG_VI: Readonly<Record<string, string>> = {
  "ret.gold_missing": "Đoạn đáp án không vào tới thùng",
  "ret.gold_rank": "Đoạn đáp án đứng ngoài số đoạn lấy về",
  "ret.boundary_split": "Đoạn đáp án bị cắt đôi khi chia",
  "ctx.gold_dropped": "Đoạn đáp án bị cắt khỏi thùng vì tràn",
  "ret.stale_doc": LABEL_VI.stale_doc ?? "",
  "llm.cite_missing": LABEL_VI.cite_missing ?? "",
  "llm.cite_unknown": LABEL_VI.cite_unknown ?? "",
  "trap.failed": "Câu trả lời chưa đạt",
};

/** "Hết giờ" -> "hết giờ"; an acronym stays ("AI từ chối trả lời"). */
export const lowerFirst = (text: string) =>
  /^\p{Lu}\p{Lu}/u.test(text) ? text : text.charAt(0).toLowerCase() + text.slice(1);

/**
 * Labels worth showing on a graded case. A correct "không có" cites nothing by design, so it
 * drops `cite_missing`, as the server's diagnosis does (grading.py).
 */
export function shownLabels(labels: readonly string[]): readonly string[] {
  return labels.includes("abstained") ? labels.filter((l) => l !== "cite_missing") : labels;
}

/** Flag keys the server can leave in a message (the regression and fallback templates). */
const FLAG_KEY = /\b(?:ret|llm|ctx|trap)\.[a-z_]+(?::[a-z0-9_]+)?/g;

/** "Ca của Hà trượt: ret.gold_rank:vector_search." -> "… đoạn đáp án đứng ngoài …". */
export const flagWords = (text: string) =>
  text.replace(FLAG_KEY, (key) => {
    const label = FLAG_VI[key.split(":")[0] ?? key];
    return label ? lowerFirst(label) : key;
  });

/** Flags whose fix is always the same knob (§8.6); the rank flags depend on the graph. */
const FLAG_TARGET: Readonly<Record<string, Target>> = {
  "ret.gold_missing": { slot: "vector_search", param: "top_k" },
  "ret.boundary_split": { slot: "chunker", param: "strategy" },
  "ret.stale_doc": { slot: "chunker", param: "only_in_force" },
  "llm.cite_missing": { slot: "context_packer", param: "cite_ids" },
  "llm.cite_unknown": { slot: "llm", param: "system_prompt" },
  "trap.failed": { slot: "llm", param: "system_prompt" },
};

/** A slot and the knob to focus there; a detached slot focuses its switch (`slotTargets`). */
export interface Target {
  slot: BlockType;
  param?: string;
  /** Why this knob, when the message points elsewhere (no hook reaches the rank). */
  why?: string;
}

const SEARCHES = ["vector_search", "bm25_search"] as const;

/**
 * Where "Xem ở …" goes (§8.6): the control that can fix the lesson in the graph that ran.
 * A regression item names the flag that broke in its message. Ranks are the first case's
 * `report.gold[case].ranks` (whole-corpus rank for a search, rank in the kept list after it).
 */
export function diagnosisTarget(
  env: Env,
  group: Pick<DiagnosisGroup, "flag" | "message_vi" | "cases">,
  gold: RunReport["gold"] | undefined,
  graph: Graph | null,
): Target | null {
  const flag =
    group.flag === "regression"
      ? (group.message_vi.match(FLAG_KEY)?.[0] ?? group.flag)
      : group.flag;
  const fixed = FLAG_TARGET[flag];
  if (fixed) return fixed;
  const ids = nodeIds(env.level);
  const ranks = gold?.[group.cases[0] ?? ""]?.ranks ?? {};
  const has = (type: BlockType) => graph?.nodes.some((node) => node.type === type) ?? false;
  /** The hook can reach the rank (or there is no rank to judge by). */
  const reaches = (type: BlockType) => {
    const rank = ranks[ids[type]];
    const d = domain(env, type, "top_k");
    return rank === undefined || (rank !== null && (d?.kind !== "range" || rank <= d.max));
  };

  const search = SEARCHES.find((type) => flag === `ret.gold_rank:${type}`);
  if (search) {
    // L3 N1: the other search finds what this one ranks too deep for any hook.
    const other = search === "vector_search" ? "bm25_search" : "vector_search";
    if (isAllowed(env.level, other) && !has(other)) return { slot: other, param: "top_k" };
    if (reaches(search)) return { slot: search, param: "top_k" };
    // A funnel cannot help: it only merges what the hooks pulled in.
    if (has(other) && typeof ranks[ids[other]] === "number" && reaches(other))
      return { slot: other, param: "top_k" };
    // No hook reaches: how passages are cut is the knob left (L2, L3; L1 fixes the chunker).
    if (domain(env, "chunker", "strategy")?.kind === "fixed") return null;
    const where = SEARCHES.filter((type) => has(type) && ranks[ids[type]] !== undefined).map(
      (type) => {
        const rank = ranks[ids[type]];
        const d = domain(env, type, "top_k");
        const hook = TOY[type].params?.top_k ?? "";
        return typeof rank !== "number"
          ? `${TOY[type].name} không tìm thấy`
          : `${TOY[type].name} hạng ${rank}${d?.kind === "range" ? ` (${hook} tối đa ${d.max})` : ""}`;
      },
    );
    return {
      slot: "chunker",
      param: "strategy",
      why: `Không móc nào với tới đoạn đáp án${where.length > 0 ? `: ${where.join(", ")}` : ""}. Thử đổi cách chia ở ${TOY.chunker.name}.`,
    };
  }
  if (flag === "ret.gold_rank:fusion") {
    // The server names the first stage after the hooks that lost it, the magnifier included.
    const funnelCut = has("fusion") && (!has("rerank") || ranks[ids.fusion] === null);
    return funnelCut ? { slot: "fusion", param: "top_k" } : { slot: "rerank", param: "top_n" };
  }
  if (flag === "ctx.gold_dropped" || flag === "budget.exceeded") {
    // The box's knobs are locked: fix how many passages reach it, at the last stage before it.
    if (isAllowed(env.level, "rerank")) return { slot: "rerank", param: "top_n" };
    const last = (["fusion", ...SEARCHES] as const).find(has);
    return last ? { slot: last, param: "top_k" } : null;
  }
  return null;
}

export interface DiagnosisGroup {
  flag: string;
  message_vi: string;
  cases: string[];
}

/** One entry per lesson: items with the same flag merge, the first message speaks for all. */
export function groupDiagnosis(items: readonly RunReport["diagnosis"][number][]): DiagnosisGroup[] {
  const groups = new Map<string, DiagnosisGroup>();
  for (const item of items) {
    const group = groups.get(item.flag);
    if (group) {
      if (item.case) group.cases.push(item.case);
    } else {
      groups.set(item.flag, {
        flag: item.flag,
        message_vi: item.message_vi,
        cases: item.case ? [item.case] : [],
      });
    }
  }
  return [...groups.values()];
}

/**
 * The aside's note when the bench is the graph of the finished run on show (§8.4). The replay
 * cache keeps only answers that came back, so unfinished cases are what a rerun changes.
 */
export function sameGraphNote(run: RunView): string {
  return unfinished(run).length > 0
    ? "Mở ca lại sau ít phút: các câu đã chạy xong dùng kết quả đã lưu, chỉ câu chưa chạy xong gọi AI lại."
    : "Cấu hình này giống hệt lượt vừa rồi nên kết quả sẽ giống hệt. Đổi một món rồi mở ca để thấy khác biệt.";
}

/** Outcome of a graded case: "Đạt", "Trượt", "Không tính sao", plus a non-ok status. */
export function outcomeText(c: CaseView): string {
  const graded = c.graded;
  if (!graded) return "Chờ";
  const parts = [graded.passed ? "Đạt" : "Trượt"];
  if (!graded.counted) parts.unshift("Không tính sao");
  if (graded.status !== "ok") parts.push(STATUS_VI[graded.status] ?? graded.status);
  return parts.join(" · ");
}

/** One polite message: run start, the followed case's grade (why, if it failed), the stars (§9). */
export function liveMessage(run: RunView | null, followedId: string | null): string {
  if (!run) return "";
  if (run.score) return `Kết quả ca tối nay: ${run.score.stars}/3 sao.`;
  const followed = run.cases.find((c) => c.id === followedId);
  if (followed?.graded) {
    const { passed, labels } = followed.graded;
    const label = passed ? undefined : shownLabels(labels)[0];
    const why = label ? `, ${lowerFirst(LABEL_VI[label] ?? label)}` : "";
    return `Câu ${followed.n}: ${passed ? "Đạt" : "Trượt"}${why}.`;
  }
  if (run.cases.length > 0) return `Bắt đầu ca: ${run.cases.length} câu.`;
  return "";
}

/** Run failure titles by `run.failed.code` (§8.6). */
export function failureTitle(code: string): string {
  if (code === "cancelled") return "Đã dừng lượt chạy";
  if (code === "llm_unavailable") return "Dịch vụ AI chưa trả lời được";
  if (["llm_not_configured", "index_missing", "index_stale", "rerank_unavailable"].includes(code))
    return "Máy chủ chưa sẵn sàng chạy";
  return "Máy chủ gặp lỗi";
}

/** A step status as the slot shows it (§7). */
export function stepStatusText(status: string | undefined, ms: number | undefined): string {
  if (status === undefined) return "Đang chạy";
  if (status === "ok") return `Xong · ${fmt(ms ?? 0)} ms`;
  return STATUS_VI[status] ?? status;
}

/** "theo_dieu-512-10" -> "Bám điều, khoản · 512 token · chồng 10 %". */
export function variantVi(key: string): string {
  const [strategy, size, overlap] = key.split("-");
  if (!strategy || !size || !overlap) return key;
  return `${ENUM_VI[strategy] ?? strategy} · ${size} token · chồng ${overlap} %`;
}

export const BACK_TO_LEVELS = "Về danh sách màn";
