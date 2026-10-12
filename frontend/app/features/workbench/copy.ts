import { domain, isAllowed, nodeIds, type Env } from "./bench";
import type { Change } from "./diff";
import type { Confidence, Why } from "./guess";
import { unfinished, type BlockState, type CaseView, type RunView } from "./run";
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

/** Vòm Sao (vom-sao-v0.1 §7): the drawing never passes itself off as a measurement. */
export const DOME_VI = {
  projection: "Vị trí sao theo hạng, không theo khoảng cách thật. Cosine là số đo.",
  /** ranks[node] is null: the passage exists, this block's ranking does not reach it. */
  unranked: "Khối này không tìm thấy đoạn đáp án trong xếp hạng của nó.",
} as const;

const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
/** Vietnamese number: 15.000, 0,83. */
export const fmt = (value: number) => number.format(value);

/** Thùng Context (gameplay-direction §3): the bin says what it measured and what it did not. */
export const BIN_VI = {
  overflow: "Nắp không đóng được: thùng xin nhiều hơn ngân sách cho phép.",
  counted: "Thùng đo tổng token; mỗi khối là một đoạn, không theo cỡ của đoạn đó.",
} as const;

/** Lược dao (L2's lesson): the blade says when it cut through the thing being looked for. */
export const BLADE_VI = {
  caption: "Chỗ lược dao hạ xuống kho, theo cỡ đoạn trung bình của lượt này.",
  columns: {
    variant: "Cách chia",
    chunks: "Số đoạn",
    avg: "Trung bình",
    split: "Cắt đứt câu đáp án",
  },
  split: "lượt này cắt đứt câu đáp án",
  splitLine: "Lược dao cắt đứt câu đáp án: đoạn đúng nằm vắt qua hai mảnh.",
} as const;

/**
 * The seven source stamps of frontend-architecture §8.4, word for word. The list is closed: a
 * figure whose provenance is none of these has no stamp to wear, and inventing one is the thing
 * the rule exists to stop.
 */
export const VIZ_STAMP = {
  run: "Đo từ lượt của bạn",
  labels: "Đo từ nhãn của bạn",
  index: "Tính sẵn từ chỉ mục",
  illustration: "Minh hoạ",
  recorded: "Lượt chạy đã ghi",
  simulation: "Mô phỏng",
  precomputed: "Dữ liệu ghi sẵn",
} as const;
export type VizStamp = keyof typeof VIZ_STAMP;

export const VIZ_VI = {
  toTable: "Xem dạng bảng",
  toPicture: "Xem dạng hình",
} as const;

/**
 * There are two token counts and §8.4 requires every bar to say which one it is using. The bin
 * counts with the engine's own `regex-v1` (chunking, packing; engine-v0.2 E3); star 2 counts
 * with Gemini's usage, thinking tokens included (E2, E8). They are not two readings of one
 * quantity: the provider counts the whole prompt, the bin only what it packed.
 */
export const TOKENS_VI = {
  bin: "đếm bằng regex-v1",
  usage: "theo usage của Gemini",
  prompt: (n: string) => `Gemini tính ${n} token vào cho cả lời nhắc, không chỉ phần trong thùng.`,
  /** Said rather than defaulting the provider's number to zero. */
  noneYet: "Chưa có số của Gemini cho câu này.",
  /**
   * The spread, never a mean: §8.4 asks for the swing to be shown, not flattened. Output
   * includes thinking tokens, and the engine reports no separate count for them.
   */
  spread: (low: string, high: string, cases: number) =>
    low === high
      ? `Token ra: ${low} ở câu duy nhất đã trả lời (gồm token suy nghĩ).`
      : `Token ra: ${low}–${high} qua ${cases} câu (gồm token suy nghĩ).`,
} as const;

/** Sổ đối chiếu trích dẫn (N13): the same codes at three stages, aligned so a gap shows. */
export const LEDGER_VI = {
  pull: "Đã lấy về",
  bin: "Vào thùng",
  cite: "Đã trích",
  gap: "không có",
  /** Codes, not sentences: Stamps already counts sentences, and the two numbers differ. */
  note: (cited: number, inBin: number, ghost: number) =>
    ghost === 0
      ? `Trợ lý trích ${cited} mã: cả ${cited} đều có trong thùng.`
      : inBin === 0
        ? `Trợ lý trích ${cited} mã: không mã nào có trong thùng.`
        : `Trợ lý trích ${cited} mã: ${inBin} có trong thùng, ${ghost} không có.`,
  caption: "Mã đoạn qua ba chặng: đã lấy về, vào thùng, đã trích.",
  /** Said on screen, because a player who opens a hidden case will wonder where this went. */
  samplesOnly: "Sổ đối chiếu chỉ mở cho câu mẫu.",
} as const;

/** Máy đóng tem (L1's lesson): a source the bin never held is the thing to notice. */
/**
 * N5: cô Lan's diagnosis is assembled from the run's own trace. The assistant is never asked
 * why it failed -- a reader who thinks it was takes away the opposite of the lesson -- so this
 * is descriptive copy and deliberately not one of §8.4's source stamps (roadmap N5).
 */
export const DIAGNOSIS_VI = {
  source:
    "Chẩn đoán này dựng từ vết chạy của lượt. Trợ lý không được hỏi vì sao nó sai: " +
    "mọi câu dưới đây là mẫu câu điền bằng số liệu của chính lượt bạn vừa chạy.",
} as const;

/**
 * Dải hồi quy (N3). The caption says what the strip shows and never a run count: §3.1 of the
 * reward rules forbids presenting attempts as an achievement.
 */
export const HISTORY_VI = {
  caption: "Các lượt đã chấm của màn này, mới nhất trên cùng, theo từng câu.",
  heading: "Các lượt trước",
  cell: { pass: "Đạt", fail: "Trượt", skip: "Không chạy" },
  case: (n: number) => `Câu #${n}`,
  /** The numeral only: the column header says "Sao", and "3/3 sao" in a cell would read word
   *  for word like the screen's own score headline, which means something else. */
  stars: (n: number) => `${n}/3`,
  starsColumn: "Sao",
  /** Identifies the row. Counting from the newest, the order the table reads -- and not the
   *  star count, which would read exactly like the screen's own "3/3 sao" headline. */
  run: (n: number) => `Lượt ${n}`,
  runColumn: "Lượt",
  /** Per row. The number counts from the newest, which is the order the table reads. */
  duplicate: "Nhân bản cấu hình",
  duplicateRow: (n: number) => `Nhân bản cấu hình của lượt ${n}`,
  actionColumn: "Cấu hình",
} as const;

/**
 * Thẻ so lượt (N20). The label is a causality claim and rests entirely on how many turnable
 * variables changed: see history.ts `compare`. This is intentionally a different sentence from
 * `sameGraphNote` above -- that one is about the bench matching the run on show before a rerun;
 * this is about two REMEMBERED runs, read after the fact.
 */
export const COMPARE_VI = {
  heading: "So với lượt trước",
  sameConfig: "Hai lượt này cùng một cấu hình, nên khác biệt không phải do bàn thợ.",
  /** The one case where naming a cause is honest: exactly one variable moved. */
  single: (name: string) => `${name} là thứ duy nhất đổi.`,
  /** The required wording (roadmap §20), verbatim regardless of how many variables changed. */
  multiple: "Đổi 2 thứ cùng lúc, chưa biết thứ nào gây ra",
  changed: "Đã đổi:",
  flip: (n: number, from: boolean, to: boolean) =>
    `Câu #${n}: ${from ? "Đạt" : "Trượt"} → ${to ? "Đạt" : "Trượt"}.`,
} as const;

/**
 * The name of one turnable variable, for the comparison card's evidence list.
 *
 * Reads `TOY[type].params` directly rather than `knobName`: that helper collapses every non-
 * chunker param to its slot's own name (it exists for the "Xem ở {slot}" diagnosis link, which
 * is about navigating to a slot, not naming a knob). Here the knob is the point -- "Vòm Sao đổi"
 * would read as the block itself being attached or detached, when only its top_k moved.
 */
export function changeName(change: Change): string {
  if (change.kind === "slot") return toyName(change.type);
  if (change.kind === "param") return TOY[change.type].params?.[change.param] ?? change.param;
  return `${TOY.llm.params?.system_prompt ?? "Lăng kính"} (khe ${change.slot + 1})`;
}

/**
 * Rút kinh nghiệm 30 giây (N20): a four-line card closing the run. Lines 1-2 reuse gradeSlip's
 * own sentences -- no new typing. Line 3 reads back the reason the player picked. Line 4 is the
 * "next attempt" picker; its enum labels and legend live here.
 */
export const DEBRIEF_VI = {
  heading: "Rút kinh nghiệm",
  why: (text: string) => `Lý do bạn chọn: ${text}`,
  nextLegend: "Lần tới đổi đúng một thứ",
  nextChosen: (label: string) => `Đã chọn: ${label}`,
} as const;

export const DROPPED_VI = {
  /** On a cut block. The rank is the place it had in the list the packer was handed. */
  piece: (rank: number) => `bị cắt: hạng ${rank}`,
  /** The ranked list never named it, so there is no rank to show. */
  unknown: "bị cắt: không rõ hạng",
  /** En dash, as a span of ranks: "Bị cắt: 4 đoạn (hạng 4–7)." */
  summary: (count: number, range: readonly [number, number] | null) =>
    range === null
      ? `Bị cắt: ${count} đoạn.`
      : range[0] === range[1]
        ? `Bị cắt: ${count} đoạn (hạng ${range[0]}).`
        : `Bị cắt: ${count} đoạn (hạng ${range[0]}–${range[1]}).`,
} as const;

export const STAMP_VI = {
  fake: "· mã này không có trong thùng",
  /** L1 §12: "TRƯỢT vì thiếu nguồn: bong bóng vỡ, chữ 'không có nguồn'". */
  bubble: "· không có nguồn",
  /** The same three kinds as words, for the table form. */
  kind: { brick: "có nguồn trong thùng", fake: "trích nguồn bịa", bubble: "không có nguồn" },
  caption: "Từng câu của trả lời và nguồn nó dựa vào.",
  note: "Câu viền liền là câu có nguồn trong thùng; viền đứt là câu không trích nguồn nào.",
} as const;

/** Đường đời hạng (L3): a block that never found the answer says so, not "#—". */
export const JOURNEY_VI = {
  absent: "không thấy",
  /** What the rank was counted over. §8.6: the meaning of a rank differs by block. */
  corpus: "toàn kho",
  kept: (size: number) => `${size} đoạn giữ lại`,
  /** The knob that decides the kept size is not on the bench, so say so, do not guess. */
  unknownScale: "chưa rõ",
  caption: "Hạng của đoạn đáp án ở từng khối, mỗi khối trên thang đo của nó.",
  columns: { block: "Khối", rank: "Hạng", scale: "Trên" },
} as const;

const cosine = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
/**
 * A retrieval score: 0,803. Three decimals, not `fmt`'s two, because neighbouring passages
 * routinely differ in the third — the committed L3 run's top three are 0,8032 / 0,8004 /
 * 0,7984, and at two decimals all three read "0,8".
 */
export const fmtCosine = (value: number) => cosine.format(value);

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
  },
  "chunk-tuning": {
    asker: "Hà",
    intro:
      "Mười ba câu tối nay: ít nhất tám trên mười câu thường phải đủ ý, và không câu nào được trả lời theo bản cũ.",
    win1: "Phòng đào tạo nhận đơn của Hà rồi. Bạn ấy gửi hộp bánh cảm ơn, mình sẽ không chia cho Bống.",
    win3: "Không một tờ giấy vàng nào lọt vào thùng. Phòng lưu trữ sẽ tự hào về bạn.",
  },
  "article-number-lookup": {
    asker: "Khang",
    intro:
      "Tối nay có người hỏi bằng số điều, có người hỏi bằng lời thường. Tám trên mười câu thường phải đúng, kể cả câu của Khang, và ca của Hà hôm trước không được vỡ.",
    win1: "Hàng người giải tán rồi. Hai cách tìm, mỗi cách che điểm mù cho cách kia.",
    win3: "Ca của Hà vẫn xanh. Cái bảng đó là thứ mình xem đầu tiên mỗi khi có ai sửa trợ lý.",
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
 * A regression item carries the flag that broke in `cause`. Ranks are the first case's
 * `report.gold[case].ranks` (whole-corpus rank for a search, rank in the kept list after it).
 */
export function diagnosisTarget(
  env: Env,
  group: Pick<DiagnosisGroup, "flag" | "cause" | "cases">,
  gold: RunReport["gold"] | undefined,
  graph: Graph | null,
): Target | null {
  const flag = group.flag === "regression" ? (group.cause ?? group.flag) : group.flag;
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
  /** "regression" only: the flag that broke. */
  cause?: string;
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
        ...(item.cause !== undefined && { cause: item.cause }),
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

/** Evidence of a graded case from its case.graded: outcome, missed criteria, labels. */
export function evidenceText(c: CaseView): string {
  const graded = c.graded;
  if (!graded) return outcomeText(c);
  const missed = Object.entries(graded.criteria)
    .filter(([, ok]) => !ok)
    .map(([name]) => CRITERIA_VI[name] ?? name);
  const labels = shownLabels(graded.labels).map((label) => LABEL_VI[label] ?? label);
  const parts = [
    outcomeText(c),
    ...(missed.length > 0 ? [`chưa đạt: ${missed.join(", ")}`] : []),
    ...labels,
  ];
  return [...new Set(parts)].join(" · ");
}

/** Confidence of a bet (N19); "Chắc" is the sure bet of the refund rule (ca trực §3.1). */
export const CONFIDENCE_VI: Readonly<Record<Confidence, string>> = {
  low: "Đoán",
  medium: "Hơi chắc",
  high: "Chắc",
};

/** N6 slot states, each also with its own colour token and icon (BenchView). */
export const BLOCK_STATE_VI: Readonly<Record<BlockState, string>> = {
  idle: "Chưa chạy",
  stale: "Cần chạy lại",
  queued: "Đang chờ",
  running: "Đang chạy",
  passed: "Đạt",
  error: "Lỗi",
};

export interface WhyMenu {
  /** The answer first; the menu rotates the order per case so it is not always first. */
  options: readonly [string, ...string[]];
}

/** "Vì sao câu #N sai?" per level, verbatim from the scenario (L1 §11). */
export const WHY_MENU: Readonly<Record<string, Readonly<Partial<Record<Why, WhyMenu>>>>> = {
  "grounded-citation": {
    no_docs: {
      options: [
        "Không có đoạn tài liệu nào trong thùng, model tự lấp chỗ trống",
        "Model quá yếu",
        "Câu hỏi của Minh mơ hồ",
        "top_k quá thấp",
      ],
    },
    cite: {
      options: [
        "Các đoạn trong thùng không mang mã, nên không có gì để trích",
        "Model quên trích dẫn",
        "Vòm Sao lấy sai đoạn",
        "Thùng bị cắt",
      ],
    },
    trap: {
      options: [
        'Không có lệnh "không thấy thì nói không có", lại có lệnh "cứ suy đoán"',
        "top_k quá thấp",
        "Kho thiếu điều đó nên phải thêm vào",
        "Model không đọc được số",
      ],
    },
    budget: {
      options: [
        "Kéo nhiều đoạn quá và dặn trả lời dài, nên thùng gần đầy ở mọi câu",
        "Model chọn sai",
        "Câu hỏi dài",
        "Có ca timeout",
      ],
    },
  },
};
