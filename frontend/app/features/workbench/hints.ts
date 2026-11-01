import * as v from "valibot";

import { SAMPLE_CALLS } from "./quota";
import { cappedRun, sampleVerdict, type CaseView, type RunView } from "./run";
import type { BlockType, Graph } from "./schema";

/**
 * The hint ladder (roadmap-v0.4 N16, B4; L1-L3 §11). Hints 1 and 2 open on request after a
 * failed run; hint n+1 needs a free look -- a toy turned, a case followed, a failing case's
 * trace opened -- since hint n. No run is spent to be helped, and no hint lowers a bar.
 * Hint 3 is the worked solution, behind its own three-part gate (X28, `hint3Gate`).
 *
 * Every opened hint is logged in this browser, because the evidence on hints is mixed: they
 * get gamed (Baker et al. 2004) and feedback on help-seeking moved behaviour but not learning
 * (Aleven et al. 2016). The pilot needs the log to tell the two apart (docs/research
 * evidence-dossier §4).
 */

/** The goal a hint aims at: the lowest star not earned, split where the lesson differs. */
export type TargetKey = "s1" | "s1_source" | "s2" | "s3" | "s3_t01" | "s3_t02" | "s3_t03";

export interface Target {
  key: TargetKey;
  star: 1 | 2 | 3;
  /** The case the hint names: the first failing one, or the costliest for the budget star. */
  n: number | null;
}

const failing = (c: CaseView) => c.graded?.counted === true && !c.graded.passed;

/**
 * What the next hint should aim at after this run, or null when there is nothing to help with:
 * a recorded run is nobody's attempt, a run still going has no verdict, and a run the server's
 * daily cap cut short does not count (daily-shift §3.3).
 */
export function hintTarget(levelId: string, run: RunView, best = 0): Target | null {
  // A variant run is the self-fix after hint 3, not another attempt at the star.
  if (run.scope === "da_ghi" || run.scope === "bien_the") return null;
  if (run.phase !== "finished" || cappedRun(run)) return null;

  // Stuck at the samples (L1 §11, X28; rà soát vòng 6): a failing sample counts for the lowest
  // star not yet earned on this level -- star 1 before any star, star 2 once star 1 is in --
  // since the samples stand in front of every star run.
  if (run.scope === "mau") {
    if (sampleVerdict(run) !== "failed" || best >= 3) return null;
    return best === 0 ? starOne(levelId, run) : best === 1 ? starTwo(run) : starThree(levelId, run);
  }
  const score = run.score;
  if (!score) return null;
  if (!score.s1) return starOne(levelId, run);
  if (!score.s2) return starTwo(run);
  if (!score.s3) return starThree(levelId, run);
  return null;
}

/** Star 2 is the run's token budget, so the case to name is the costliest. */
function starTwo(run: RunView): Target {
  const costliest = [...run.cases].sort(
    (a, b) => b.tokens.in + b.tokens.out - (a.tokens.in + a.tokens.out),
  )[0];
  return { key: "s2", star: 2, n: costliest?.n ?? null };
}

const starThree = (levelId: string, run: RunView): Target => ({
  key: starThreeKey(levelId, run),
  star: 3,
  n: null,
});

function starOne(levelId: string, run: RunView): Target {
  const first = run.cases.find((c) => c.role !== "trap" && failing(c));
  const flags = new Set(
    (run.report?.diagnosis ?? []).filter((d) => d.case === first?.id).map((d) => d.flag),
  );
  // L1 has two lessons under star 1: nothing was retrieved, or the passages carried no code.
  const source =
    levelId === "grounded-citation" &&
    !flags.has("ret.gold_missing") &&
    (flags.has("llm.cite_missing") || flags.has("llm.cite_unknown"));
  return { key: source ? "s1_source" : "s1", star: 1, n: first?.n ?? null };
}

function starThreeKey(levelId: string, run: RunView): TargetKey {
  if (levelId !== "article-number-lookup") return "s3";
  // L3's three traps teach three different things; the ids end in t01, t02, t03.
  const trap = run.cases.find((c) => c.role === "trap" && failing(c));
  const tail = trap?.id.slice(-3);
  return tail === "t01" || tail === "t02" || tail === "t03" ? `s3_${tail}` : "s3";
}

// --- What each hint says ----------------------------------------------------------------------

/** What a hint points at on the screen: a case to follow, or a toy's slot on the bench. */
export type Pointer =
  { kind: "case"; n: number } | { kind: "slot"; slot: BlockType; param?: string };

export interface Hint {
  text: string;
  pointer: Pointer;
}

type Line = (n: number) => { text: string; pointer: Pointer | "case" };
/** Hints 1, 2 and 3; the third is the worked example. */
type Ladder = readonly [Line, Line, Line];

const slot = (s: BlockType, param?: string): Pointer => ({
  kind: "slot",
  slot: s,
  ...(param && { param }),
});

/** L1-L3 §11, hints 1 to 3. A "case" pointer resolves to the target's own case. */
const HINTS: Readonly<Record<string, Partial<Record<TargetKey, Ladder>>>> = {
  "grounded-citation": {
    s1: [
      (n) => ({
        text: `Nhìn vào thùng lúc Bộ Óc trả lời câu #${n}: trong đó có gì?`,
        pointer: "case",
      }),
      (n) => ({
        text: `Ở câu #${n}, thùng chia token cho ba phần: dặn dò, tài liệu, câu hỏi. Phần tài liệu được bao nhiêu token?`,
        pointer: "case",
      }),
      () => ({
        text: "Gắn Vòm Sao vào khe Truy xuất rồi chiếu thử câu của Minh.",
        pointer: slot("vector_search"),
      }),
    ],
    s1_source: [
      (n) => ({
        text: `Minh hỏi "ghi ở đâu thế ạ?". Ở câu #${n}, trợ lý trả lời được không?`,
        pointer: "case",
      }),
      (n) => ({
        text: `Mở thùng của câu #${n}: các đoạn trong đó có mang mã nào không?`,
        pointer: "case",
      }),
      () => ({
        text: "Bật Máy đóng tem, và cho Lăng kính một thẻ đòi ghi mã.",
        pointer: slot("context_packer", "cite_ids"),
      }),
    ],
    s3: [
      () => ({
        text: "Đọc lại thẻ đang cắm trong Lăng kính, từng chữ một.",
        pointer: slot("llm", "system_prompt"),
      }),
      () => ({
        text: "Cả hai ca bẫy hỏi điều mà kho không có. So các số điều đã vào thùng với điều trợ lý trích.",
        pointer: slot("context_packer"),
      }),
      () => ({
        text: 'Rút thẻ "kể cả khi phải suy đoán". Thêm thẻ dặn nói "không có" khi tài liệu không có.',
        pointer: slot("llm", "system_prompt"),
      }),
    ],
    s2: [
      (n) => ({
        text: `Câu nào tốn nhiều token nhất? Câu #${n} kéo bao nhiêu đoạn vào thùng?`,
        pointer: "case",
      }),
      (n) => ({
        text: `Câu #${n} tốn nhất. Đếm số đoạn trong thùng của nó, rồi nhìn Móc kéo.`,
        pointer: slot("vector_search", "top_k"),
      }),
      () => ({
        text: 'Thử Móc kéo nhỏ hơn và bỏ thẻ "càng chi tiết càng tốt"; chiếu thử để xem đoạn đúng còn trong K không.',
        pointer: slot("vector_search", "top_k"),
      }),
    ],
  },
  "chunk-tuning": {
    s1: [
      (n) => ({
        text: `Đọc chậm đoạn mà trợ lý đưa cho câu #${n}. Nó dừng ở đâu?`,
        pointer: "case",
      }),
      (n) => ({
        text: `Xem dải đoạn ở Lược dao cho câu #${n}: ranh giới cắt nằm ở đâu, đoạn nào đã vào thùng?`,
        pointer: slot("chunker"),
      }),
      () => ({
        text: "Thử Nam châm bám Điều, hoặc Lược 512 kèm Băng keo 10%, rồi chiếu thử câu của Hà.",
        pointer: slot("chunker", "strategy"),
      }),
    ],
    s3: [
      () => ({
        text: "Mở thùng của các ca trượt: có tờ giấy nào ngả vàng không?",
        pointer: slot("context_packer"),
      }),
      () => ({
        text: "Ở các ca bẫy, thùng mang đoạn của văn bản nào, còn hiệu lực không?",
        pointer: slot("chunker"),
      }),
      () => ({
        text: "Bật Kính lọc hiệu lực. Lọc trước khi tìm rẻ hơn dặn model tự chọn bản mới.",
        pointer: slot("chunker", "only_in_force"),
      }),
    ],
    s2: [
      (n) => ({
        text: `Câu nào tốn nhất? Thùng của câu #${n} đầy bao nhiêu?`,
        pointer: "case",
      }),
      (n) => ({
        text: `Câu #${n} tốn nhất. So số token của nó với cỡ đoạn ở Lược dao.`,
        pointer: slot("chunker"),
      }),
      () => ({
        text: "Đoạn nhỏ hơn hoặc ít đoạn hơn. Chiếu thử để chắc đoạn đúng vẫn trong K.",
        pointer: slot("chunker", "chunk_size"),
      }),
    ],
  },
  "article-number-lookup": {
    s1: [
      (n) => ({
        text: `Chiếu đèn câu #${n} trên lời giải của bạn, rồi nhìn hạng của đoạn đáp án ở Vòm Sao.`,
        pointer: "case",
      }),
      (n) => ({
        text: `Theo đường đời hạng của đoạn đáp án câu #${n}: những đoạn nào đứng trên nó?`,
        pointer: "case",
      }),
      () => ({
        text: "Lắp Tủ ngăn kéo cạnh Vòm Sao rồi gộp hai danh sách bằng Phễu.",
        pointer: slot("bm25_search"),
      }),
    ],
    s3: [
      () => ({
        text: "Có câu hỏi bằng lời thường. Cách tìm nào hiểu được lời thường?",
        pointer: slot("vector_search"),
      }),
      () => ({
        text: "Ở ca bẫy đó, Tủ ngăn kéo không thấy đoạn đúng, còn Vòm Sao thì thấy.",
        pointer: slot("bm25_search"),
      }),
      () => ({
        text: "Giữ cả Vòm Sao lẫn Tủ ngăn kéo. Hai điểm mù bù cho nhau.",
        pointer: slot("fusion"),
      }),
    ],
    s3_t02: [
      () => ({ text: "Ca của Hà ở màn trước cần gì để đạt?", pointer: slot("chunker") }),
      () => ({
        text: "So cách cắt của Lược dao bây giờ với cách cắt đã đạt ở màn trước.",
        pointer: slot("chunker"),
      }),
      () => ({
        text: "Đưa Lược dao về cách cắt đã đạt ở màn trước. Mỗi lần đổi, nhìn bảng hồi quy trước tiên.",
        pointer: slot("chunker"),
      }),
    ],
    s3_t03: [
      () => ({
        text: 'Đọc lại thẻ đang cắm trong Lăng kính. Thẻ nào dặn nó nói "không có"?',
        pointer: slot("llm", "system_prompt"),
      }),
      () => ({
        text: 'Ca bẫy trượt vì trợ lý không chịu nói "không có". Xem các số điều đã vào thùng.',
        pointer: slot("context_packer"),
      }),
      () => ({
        text: 'Cắm lại thẻ dặn nói "không có", rút thẻ bảo cứ suy đoán nếu có. Tìm giỏi hơn không có nghĩa là thôi phải biết nói "không có".',
        pointer: slot("llm", "system_prompt"),
      }),
    ],
    s2: [
      (n) => ({ text: `Bao nhiêu đoạn đi vào thùng ở câu #${n}?`, pointer: "case" }),
      (n) => ({
        text: `Câu #${n} tốn nhất. Xem hạng đoạn đúng sau Phễu: cần giữ bao nhiêu đoạn?`,
        pointer: slot("fusion"),
      }),
      () => ({
        text: "Đặt Kính lúp giữ 3 đoạn sau Phễu, hoặc thu miệng phễu lại; chiếu thử 3 câu mẫu.",
        pointer: slot("rerank", "top_n"),
      }),
    ],
  },
};

/** Where a split target has no ladder of its own, the star's general one stands in. */
const FALLBACK: Readonly<Record<TargetKey, TargetKey>> = {
  s1: "s1",
  s1_source: "s1",
  s2: "s2",
  s3: "s3",
  s3_t01: "s3",
  s3_t02: "s3",
  s3_t03: "s3",
};

export function hintFor(levelId: string, target: Target, n: 1 | 2 | 3): Hint | null {
  const level = HINTS[levelId];
  const ladder = level?.[target.key] ?? level?.[FALLBACK[target.key]];
  const line = ladder?.[n - 1];
  if (!line) return null;
  const caseN = target.n ?? 1;
  const { text, pointer } = line(caseN);
  return { text, pointer: pointer === "case" ? { kind: "case", n: caseN } : pointer };
}

// --- The ladder's state, per level ------------------------------------------------------------

export interface HintEntry {
  at: number;
  target: TargetKey;
  star: 1 | 2 | 3;
  n: number;
}

export type StarKey = "1" | "2" | "3";

export interface HintBook {
  /** Per target: hints opened so far, and whether the player looked since the last one. */
  targets: Partial<Record<TargetKey, { opened: number; looked: boolean }>>;
  log: HintEntry[];
  /**
   * Per star: the configurations that failed a graded run there, across days (X28), and whether
   * the latest one counted was a sample run -- which prices the next attempt at 3, not a star run.
   */
  fails: Partial<Record<StarKey, { configs: string[]; lastSample: boolean }>>;
}

const LOG_LIMIT = 50;
const key = (levelId: string) => `vg.hints.v1.${levelId}`;
const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const TargetKeySchema = v.picklist(["s1", "s1_source", "s2", "s3", "s3_t01", "s3_t02", "s3_t03"]);
const BookSchema = v.object({
  targets: v.record(TargetKeySchema, v.object({ opened: Count, looked: v.boolean() })),
  log: v.array(
    v.object({ at: Count, target: TargetKeySchema, star: v.picklist([1, 2, 3]), n: Count }),
  ),
  // Optional: books written before B4b have no failures yet.
  fails: v.optional(
    v.record(
      v.picklist(["1", "2", "3"]),
      v.object({ configs: v.array(v.string()), lastSample: v.boolean() }),
    ),
    {},
  ),
});

export function loadHints(levelId: string): HintBook {
  try {
    const raw = window.localStorage.getItem(key(levelId));
    const parsed = v.safeParse(BookSchema, raw === null ? null : JSON.parse(raw));
    if (parsed.success) return parsed.output;
  } catch {
    /* blocked, full or not JSON: a fresh ladder */
  }
  return { targets: {}, log: [], fails: {} };
}

export function saveHints(levelId: string, book: HintBook): boolean {
  try {
    window.localStorage.setItem(key(levelId), JSON.stringify(book));
    return true;
  } catch {
    return false;
  }
}

/**
 * The hint the player may open next for this target, or null. Every rung after the first needs
 * a look since the last; hint 3 also needs `gate3`, the rest of its gate (`hint3Gate`).
 */
export function canOpen(book: HintBook, target: TargetKey, gate3 = false): 1 | 2 | 3 | null {
  const state = book.targets[target];
  if (!state || state.opened === 0) return 1;
  if (!state.looked) return null;
  if (state.opened === 1) return 2;
  return state.opened === 2 && gate3 ? 3 : null;
}

export interface GateContext {
  /** Learner calls left today; null when the server could not be read. */
  left: number | null;
  /** The most a star run of this level costs: one call per case (L1 10, L2 and L3 13). */
  starPrice: number;
}

/**
 * Conditions 2 and 3 of hint 3's gate (L1 §11, X28): at least one graded run failed at this star
 * on a configuration of its own, and either three have, or the pool cannot pay for another
 * attempt -- a sample run when the latest counted failure was one, a star run otherwise.
 * Condition 1, a look since hint 2, is `canOpen`'s.
 */
export function hint3Gate(book: HintBook, target: Target, ctx: GateContext): boolean {
  const fails = book.fails[String(target.star) as StarKey];
  if (!fails || fails.configs.length === 0) return false;
  if (fails.configs.length >= 3) return true;
  const price = fails.lastSample ? SAMPLE_CALLS : ctx.starPrice;
  return ctx.left !== null && ctx.left < price;
}

/**
 * The book after a graded run failed at `star` on configuration `config`. Running the same
 * configuration again replays its answers for 0 calls, so it is not another attempt.
 */
export function recordFail(book: HintBook, star: 1 | 2 | 3, config: string, sample: boolean) {
  const key = String(star) as StarKey;
  const known = book.fails[key];
  if (known?.configs.includes(config)) return book;
  return {
    ...book,
    fails: {
      ...book.fails,
      [key]: { configs: [...(known?.configs ?? []), config], lastSample: sample },
    },
  };
}

/** A short, stable name for a configuration: FNV-1a over the graph JSON the run sent. */
export function configKey(body: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < body.length; i += 1) {
    hash ^= body.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** The book after hint n of `target` was opened at `at`. The caller checks `canOpen` first. */
export function open(book: HintBook, target: TargetKey, star: 1 | 2 | 3, at: number): HintBook {
  const opened = (book.targets[target]?.opened ?? 0) + 1;
  return {
    ...book,
    targets: { ...book.targets, [target]: { opened, looked: false } },
    log: [...book.log, { at, target, star, n: opened }].slice(-LOG_LIMIT),
  };
}

/**
 * A free look: it counts toward the next hint of every ladder already started. A ladder only
 * exists once its hint 1 is open, so a look taken before that has nothing to count toward.
 */
export function look(book: HintBook): HintBook {
  const targets: HintBook["targets"] = {};
  for (const [k, state] of Object.entries(book.targets) as [TargetKey, { opened: number }][]) {
    targets[k] = { opened: state.opened, looked: true };
  }
  return { ...book, targets };
}

// --- N17: the toys a bench edit touched -------------------------------------------------------

/** Block types whose node was added, removed or had a parameter turned between two graphs. */
export function firstTouchTypes(before: Graph, after: Graph): BlockType[] {
  const byId = (g: Graph) => new Map(g.nodes.map((node) => [node.id, node]));
  const a = byId(before);
  const b = byId(after);
  const touched = new Set<BlockType>();
  for (const [id, node] of b) {
    const old = a.get(id);
    if (!old || JSON.stringify(old.params) !== JSON.stringify(node.params)) touched.add(node.type);
  }
  for (const [id, node] of a) if (!b.has(id)) touched.add(node.type);
  return [...touched];
}

const TOUCHED_KEY = "vg.touched.v1";

/** Toys this browser has already been told about: across levels, since a toy means the same. */
export function loadTouched(): BlockType[] {
  try {
    const raw = window.localStorage.getItem(TOUCHED_KEY);
    const parsed = v.safeParse(v.array(v.string()), raw === null ? null : JSON.parse(raw));
    return parsed.success ? (parsed.output as BlockType[]) : [];
  } catch {
    return [];
  }
}

/**
 * The toys among `touched` met for the first time, now remembered. A store that cannot be
 * written still answers, so the line shows once per page rather than never.
 */
export function firstTouches(touched: readonly BlockType[]): BlockType[] {
  const seen = new Set(loadTouched());
  const fresh = touched.filter((type) => !seen.has(type));
  if (fresh.length > 0) {
    try {
      window.localStorage.setItem(TOUCHED_KEY, JSON.stringify([...seen, ...fresh]));
    } catch {
      /* the line still shows this time */
    }
  }
  return fresh;
}
