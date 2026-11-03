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
export type TargetKey =
  "s1" | "s1_source" | "s2" | "s3" | "s3_t01" | "s3_t02" | "s3_t03" | "s3_blocked" | "s3_asked";

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

/** The Watchtower's star 3 asks for no blocked customer and no needless approval. */
const W1 = "direct-injection";
const W1_STAR_THREE = {
  "guard.blocked_benign": "s3_blocked",
  "hitl.over_asked": "s3_asked",
} as const;

function starThree(levelId: string, run: RunView): Target {
  if (levelId === W1) {
    // The labels are on the graded cases themselves, so the hint can name the case.
    const labelled = run.cases.find((c) => c.graded?.labels.some((l) => l in W1_STAR_THREE));
    const label = labelled?.graded?.labels.find((l) => l in W1_STAR_THREE);
    const key = label ? W1_STAR_THREE[label as keyof typeof W1_STAR_THREE] : "s3";
    const refused = run.cases.find((c) => c.graded?.labels.includes("refusal"));
    return { key, star: 3, n: (labelled ?? refused)?.n ?? null };
  }
  return { key: starThreeKey(levelId, run), star: 3, n: null };
}

function starOne(levelId: string, run: RunView): Target {
  // On the Watchtower the attacks are the trap cases, and their receipts are on screen.
  const first = run.cases.find((c) => (levelId === W1 || c.role !== "trap") && failing(c));
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

/**
 * Plan v0.7 2.2: what each rung rests on, asked back as "nguyên lý nào?" from a closed list.
 * Choosing the principle a worked step applies is what made worked examples teach in Atkinson
 * et al. 2003; the names are in `PRINCIPLE_VI`.
 */
const PRINCIPLES = [
  "tim_dung",
  "nguon",
  "dan_do",
  "ngan_sach",
  "cat_doan",
  "loc_truoc",
  "diem_mu",
  "hoi_quy",
  "nhieu_lop",
  "nguoi_duyet",
  "chan_nham",
  "hoi_vua_du",
  "chan_som",
] as const;
export type Principle = (typeof PRINCIPLES)[number];

export interface Hint {
  text: string;
  pointer: Pointer;
  principle: Principle;
  /** Hint 3 only: the worked example's last step, shown after a look (backward fading). */
  last?: string;
}

type Line = (n: number) => {
  text: string;
  pointer: Pointer | "case";
  principle: Principle;
  last?: string;
};
/** Hints 1, 2 and 3; the third is the worked example. */
type Ladder = readonly [Line, Line, Line];

const slot = (s: BlockType, param?: string): Pointer => ({
  kind: "slot",
  slot: s,
  ...(param && { param }),
});

/**
 * L1-L3 §11, hints 1 to 3. A "case" pointer resolves to the target's own case. Each rung names
 * the principle it rests on (plan v0.7 2.2); hint 3 holds its last step apart (`last`).
 */
const HINTS: Readonly<Record<string, Partial<Record<TargetKey, Ladder>>>> = {
  "grounded-citation": {
    s1: [
      (n) => ({
        text: `Nhìn vào thùng lúc Bộ Óc trả lời câu #${n}: trong đó có gì?`,
        pointer: "case",
        principle: "tim_dung",
      }),
      (n) => ({
        text: `Ở câu #${n}, thùng chia token cho ba phần: dặn dò, tài liệu, câu hỏi. Phần tài liệu được bao nhiêu token?`,
        pointer: "case",
        principle: "tim_dung",
      }),
      () => ({
        text: "Thùng không có tài liệu vì chưa món nào kéo tài liệu về: khe Truy xuất còn trống.",
        last: "Gắn Vòm Sao vào khe Truy xuất rồi chiếu thử câu của Minh.",
        pointer: slot("vector_search"),
        principle: "tim_dung",
      }),
    ],
    s1_source: [
      (n) => ({
        text: `Minh hỏi "ghi ở đâu thế ạ?". Ở câu #${n}, trợ lý trả lời được không?`,
        pointer: "case",
        principle: "nguon",
      }),
      (n) => ({
        text: `Mở thùng của câu #${n}: các đoạn trong đó có mang mã nào không?`,
        pointer: "case",
        principle: "nguon",
      }),
      () => ({
        text: "Bộ Óc chỉ ghi được mã khi đoạn trong thùng có mã, và khi được dặn phải ghi.",
        last: "Bật Máy đóng tem, và cho Lăng kính một thẻ đòi ghi mã.",
        pointer: slot("context_packer", "cite_ids"),
        principle: "nguon",
      }),
    ],
    s3: [
      () => ({
        text: "Đọc lại thẻ đang cắm trong Lăng kính, từng chữ một.",
        pointer: slot("llm", "system_prompt"),
        principle: "dan_do",
      }),
      () => ({
        text: "Cả hai ca bẫy hỏi điều mà kho không có. So các số điều đã vào thùng với điều trợ lý trích.",
        pointer: slot("context_packer"),
        principle: "tim_dung",
      }),
      () => ({
        text: 'Thẻ "kể cả khi phải suy đoán" cho phép Bộ Óc bịa khi kho không có.',
        last: 'Rút thẻ đó, và thêm thẻ dặn nói "không có" khi tài liệu không có.',
        pointer: slot("llm", "system_prompt"),
        principle: "dan_do",
      }),
    ],
    s2: [
      (n) => ({
        text: `Câu nào tốn nhiều token nhất? Câu #${n} kéo bao nhiêu đoạn vào thùng?`,
        pointer: "case",
        principle: "ngan_sach",
      }),
      (n) => ({
        text: `Câu #${n} tốn nhất. Đếm số đoạn trong thùng của nó, rồi nhìn Móc kéo.`,
        pointer: slot("vector_search", "top_k"),
        principle: "ngan_sach",
      }),
      () => ({
        text: 'Móc kéo lớn và thẻ "càng chi tiết càng tốt" đều làm thùng phình ra.',
        last: "Thử Móc kéo nhỏ hơn và bỏ thẻ đó; chiếu thử để xem đoạn đúng còn trong K không.",
        pointer: slot("vector_search", "top_k"),
        principle: "ngan_sach",
      }),
    ],
  },
  "chunk-tuning": {
    s1: [
      (n) => ({
        text: `Đọc chậm đoạn mà trợ lý đưa cho câu #${n}. Nó dừng ở đâu?`,
        pointer: "case",
        principle: "cat_doan",
      }),
      (n) => ({
        text: `Xem dải đoạn ở Lược dao cho câu #${n}: ranh giới cắt nằm ở đâu, đoạn nào đã vào thùng?`,
        pointer: slot("chunker"),
        principle: "cat_doan",
      }),
      () => ({
        text: "Đoạn của Hà bị cắt ngang giữa một Điều, nên thùng chỉ có nửa câu trả lời.",
        last: "Thử Nam châm bám Điều, hoặc Lược 512 kèm Băng keo 10%, rồi chiếu thử câu của Hà.",
        pointer: slot("chunker", "strategy"),
        principle: "cat_doan",
      }),
    ],
    s3: [
      () => ({
        text: "Mở thùng của các ca trượt: có tờ giấy nào ngả vàng không?",
        pointer: slot("context_packer"),
        principle: "tim_dung",
      }),
      () => ({
        text: "Ở các ca bẫy, thùng mang đoạn của văn bản nào, còn hiệu lực không?",
        pointer: slot("chunker"),
        principle: "loc_truoc",
      }),
      () => ({
        text: "Các ca bẫy kéo về văn bản đã hết hiệu lực. Lọc chúng ra trước khi tìm rẻ hơn dặn model tự chọn bản mới.",
        last: "Bật Kính lọc hiệu lực.",
        pointer: slot("chunker", "only_in_force"),
        principle: "loc_truoc",
      }),
    ],
    s2: [
      (n) => ({
        text: `Câu nào tốn nhất? Thùng của câu #${n} đầy bao nhiêu?`,
        pointer: "case",
        principle: "ngan_sach",
      }),
      (n) => ({
        text: `Câu #${n} tốn nhất. So số token của nó với cỡ đoạn ở Lược dao.`,
        pointer: slot("chunker"),
        principle: "ngan_sach",
      }),
      () => ({
        text: "Đoạn càng to thì mỗi đoạn kéo về càng nặng.",
        last: "Thu nhỏ đoạn hoặc lấy ít đoạn hơn, rồi chiếu thử để chắc đoạn đúng vẫn trong K.",
        pointer: slot("chunker", "chunk_size"),
        principle: "ngan_sach",
      }),
    ],
  },
  "article-number-lookup": {
    s1: [
      (n) => ({
        text: `Chiếu đèn câu #${n} trên lời giải của bạn, rồi nhìn hạng của đoạn đáp án ở Vòm Sao.`,
        pointer: "case",
        principle: "diem_mu",
      }),
      (n) => ({
        text: `Theo đường đời hạng của đoạn đáp án câu #${n}: những đoạn nào đứng trên nó?`,
        pointer: "case",
        principle: "diem_mu",
      }),
      () => ({
        text: "Câu hỏi gọi số điều. Vòm Sao xếp theo nghĩa nên đẩy đoạn có đúng số đó xuống dưới, còn tìm theo chữ thì bắt được số.",
        last: "Lắp Tủ ngăn kéo cạnh Vòm Sao rồi gộp hai danh sách bằng Phễu.",
        pointer: slot("bm25_search"),
        principle: "diem_mu",
      }),
    ],
    s3: [
      () => ({
        text: "Có câu hỏi bằng lời thường. Cách tìm nào hiểu được lời thường?",
        pointer: slot("vector_search"),
        principle: "diem_mu",
      }),
      () => ({
        text: "Ở ca bẫy đó, Tủ ngăn kéo không thấy đoạn đúng, còn Vòm Sao thì thấy.",
        pointer: slot("bm25_search"),
        principle: "diem_mu",
      }),
      () => ({
        text: "Tủ ngăn kéo mù với lời thường, Vòm Sao mù với số điều: hai điểm mù bù cho nhau.",
        last: "Giữ cả Vòm Sao lẫn Tủ ngăn kéo, gộp bằng Phễu.",
        pointer: slot("fusion"),
        principle: "diem_mu",
      }),
    ],
    s3_t02: [
      () => ({
        text: "Ca của Hà ở màn trước cần gì để đạt?",
        pointer: slot("chunker"),
        principle: "hoi_quy",
      }),
      () => ({
        text: "So cách cắt của Lược dao bây giờ với cách cắt đã đạt ở màn trước.",
        pointer: slot("chunker"),
        principle: "hoi_quy",
      }),
      () => ({
        text: "Ca của Hà đạt ở màn trước nhờ cách cắt của Lược dao; bây giờ cách cắt đã khác.",
        last: "Đưa Lược dao về cách cắt đã đạt ở màn trước. Mỗi lần đổi, nhìn bảng hồi quy trước tiên.",
        pointer: slot("chunker"),
        principle: "hoi_quy",
      }),
    ],
    s3_t03: [
      () => ({
        text: 'Đọc lại thẻ đang cắm trong Lăng kính. Thẻ nào dặn nó nói "không có"?',
        pointer: slot("llm", "system_prompt"),
        principle: "dan_do",
      }),
      () => ({
        text: 'Ca bẫy trượt vì trợ lý không chịu nói "không có". Xem các số điều đã vào thùng.',
        pointer: slot("context_packer"),
        principle: "dan_do",
      }),
      () => ({
        text: 'Tìm giỏi hơn không có nghĩa là thôi phải biết nói "không có".',
        last: 'Cắm lại thẻ dặn nói "không có", rút thẻ bảo cứ suy đoán nếu có.',
        pointer: slot("llm", "system_prompt"),
        principle: "dan_do",
      }),
    ],
    s2: [
      (n) => ({
        text: `Bao nhiêu đoạn đi vào thùng ở câu #${n}?`,
        pointer: "case",
        principle: "ngan_sach",
      }),
      (n) => ({
        text: `Câu #${n} tốn nhất. Xem hạng đoạn đúng sau Phễu: cần giữ bao nhiêu đoạn?`,
        pointer: slot("fusion"),
        principle: "ngan_sach",
      }),
      () => ({
        text: "Đoạn đúng đã đứng đầu sau Phễu, nên phần lớn đoạn trong thùng là thừa.",
        last: "Đặt Kính lúp giữ 3 đoạn sau Phễu, hoặc thu miệng phễu lại; chiếu thử 3 câu mẫu.",
        pointer: slot("rerank", "top_n"),
        principle: "ngan_sach",
      }),
    ],
  },
  // Watchtower W1 (watchtower.md §3.6): the receipt first, then which layer let it through, then
  // the worked solution. Pointers are the toys of the layers, so a hint never says "add a rule".
  "direct-injection": {
    s1: [
      (n) => ({
        text: `Xem biên lai của câu #${n}: khoản hoàn nào không ai duyệt?`,
        pointer: "case",
        principle: "nguoi_duyet",
      }),
      (n) => ({
        text: `Theo câu #${n} dọc băng chuyền: lớp nào đã soi nó, lớp nào để nó đi qua?`,
        pointer: "case",
        principle: "nhieu_lop",
      }),
      () => ({
        text: "Lưới 3 cụm từ hẹp (bỏ qua hướng dẫn, quản trị viên, lệnh kiểm thử) và Chó gác 0,8 chặn các đòn ở cổng.",
        last: "Chuông duyệt chỉ hỏi khi vượt 500.000 đ, để khoản hoàn lớn nào lọt qua cổng vẫn phải có người duyệt.",
        pointer: slot("human_approval"),
        principle: "nhieu_lop",
      }),
    ],
    s3_blocked: [
      (n) => ({
        text: `Câu #${n} là khách thật mà bị chặn. Lớp nào đã chặn nó?`,
        pointer: "case",
        principle: "chan_nham",
      }),
      (n) => ({
        text: `Lưới khớp từng cụm từ với câu #${n}. Cụm nào trong lưới nằm trong lời của khách?`,
        pointer: slot("pattern_guard", "phrases"),
        principle: "chan_nham",
      }),
      () => ({
        text: "Cụm «bỏ qua» quá rộng: khách thật hay nói «bỏ qua phí ship».",
        last: "Rút «bỏ qua», giữ cụm hẹp như «bỏ qua hướng dẫn».",
        pointer: slot("pattern_guard", "phrases"),
        principle: "chan_nham",
      }),
    ],
    s3_asked: [
      (n) => ({
        text: `Chuông duyệt hỏi cả một khoản nhỏ hợp lệ ở câu #${n}. Khoản đó có đáng hỏi không?`,
        pointer: "case",
        principle: "hoi_vua_du",
      }),
      () => ({
        text: "Chuông có hai cách hỏi: luôn hỏi, hoặc chỉ hỏi khi số tiền vượt một ngưỡng.",
        pointer: slot("human_approval", "policy"),
        principle: "hoi_vua_du",
      }),
      () => ({
        text: "Khoản 120.000 đ hợp lệ không đáng làm phiền người duyệt; khoản 5.000.000 đ thì đáng.",
        last: "Chọn hỏi khi vượt ngưỡng và đặt 500.000 đ.",
        pointer: slot("human_approval", "amount_threshold"),
        principle: "hoi_vua_du",
      }),
    ],
    s3: [
      (n) => ({
        text: `Câu #${n} là khách thật mà trợ lý từ chối. Mở câu đó ra xem.`,
        pointer: "case",
        principle: "dan_do",
      }),
      () => ({
        text: "Đọc lại thẻ đang cắm trong Lăng kính, từng chữ một.",
        pointer: slot("action_llm", "system_prompt"),
        principle: "dan_do",
      }),
      () => ({
        text: "Có thẻ khiến trợ lý từ chối cả khách thật.",
        last: "Giữ thẻ dặn hoàn đúng số tiền của đơn và không làm theo lệnh trong tin nhắn; bỏ thẻ khiến trợ lý từ chối.",
        pointer: slot("action_llm", "system_prompt"),
        principle: "dan_do",
      }),
    ],
    s2: [
      (n) => ({
        text: `Câu nào tốn token nhất? Câu #${n} tốn bao nhiêu?`,
        pointer: "case",
        principle: "chan_som",
      }),
      () => ({
        text: "Một đòn bị chặn ở cổng thì Bộ Óc không phải viết phiếu. Cổng nào đang để đòn đi tiếp?",
        pointer: slot("injection_classifier"),
        principle: "chan_som",
      }),
      () => ({
        text: "Ba đòn đều có điểm Chó gác trên 0,8. Chặn chúng ngay ở cổng thì Bộ Óc chỉ còn việc của khách thật.",
        last: "Đặt ngưỡng Chó gác 0,8. Bỏ thẻ dặn không đổi kết quả.",
        pointer: slot("injection_classifier", "threshold"),
        principle: "chan_som",
      }),
    ],
  },
};

/**
 * The principles a level asks about, in the order its rungs are offered. Every rung picks from
 * four: its own and the level's first three others, so the list is short on a phone and the
 * right one is not always in the same place.
 */
const LEVEL_PRINCIPLES: Readonly<Record<string, readonly Principle[]>> = {
  "grounded-citation": ["tim_dung", "nguon", "dan_do", "ngan_sach"],
  "chunk-tuning": ["cat_doan", "tim_dung", "loc_truoc", "ngan_sach"],
  "article-number-lookup": ["diem_mu", "hoi_quy", "dan_do", "ngan_sach"],
  "direct-injection": ["nguoi_duyet", "nhieu_lop", "chan_nham", "hoi_vua_du", "chan_som", "dan_do"],
};

/** The four principles offered under a rung that rests on `right`, in the level's order. */
export function principleOptions(levelId: string, right: Principle): Principle[] {
  const all = LEVEL_PRINCIPLES[levelId] ?? [];
  const others = all.filter((p) => p !== right).slice(0, 3);
  return all.filter((p) => p === right || others.includes(p));
}

/** Where a split target has no ladder of its own, the star's general one stands in. */
const FALLBACK: Readonly<Record<TargetKey, TargetKey>> = {
  s1: "s1",
  s1_source: "s1",
  s2: "s2",
  s3: "s3",
  s3_t01: "s3",
  s3_t02: "s3",
  s3_t03: "s3",
  s3_blocked: "s3",
  s3_asked: "s3",
};

export function hintFor(levelId: string, target: Target, n: 1 | 2 | 3): Hint | null {
  const level = HINTS[levelId];
  const ladder = level?.[target.key] ?? level?.[FALLBACK[target.key]];
  const line = ladder?.[n - 1];
  if (!line) return null;
  const caseN = target.n ?? 1;
  const { text, pointer, principle, last } = line(caseN);
  return {
    text,
    pointer: pointer === "case" ? { kind: "case", n: caseN } : pointer,
    principle,
    ...(n === 3 && last !== undefined && { last }),
  };
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
  /** Every "nguyên lý nào?" answer, right or not (plan v0.7 2.2): the first one is the measure. */
  picks: PrincipleEntry[];
}

export interface PrincipleEntry {
  at: number;
  target: TargetKey;
  n: 1 | 2 | 3;
  pick: Principle;
  right: boolean;
}

const LOG_LIMIT = 50;
const key = (levelId: string) => `vg.hints.v1.${levelId}`;
const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const TargetKeySchema = v.picklist([
  "s1",
  "s1_source",
  "s2",
  "s3",
  "s3_t01",
  "s3_t02",
  "s3_t03",
  "s3_blocked",
  "s3_asked",
]);
const BookSchema = v.object({
  targets: v.record(TargetKeySchema, v.object({ opened: Count, looked: v.boolean() })),
  log: v.array(
    v.object({ at: Count, target: TargetKeySchema, star: v.picklist([1, 2, 3]), n: Count }),
  ),
  // Optional: books written before plan v0.7 2.2 have no picks.
  picks: v.optional(
    v.array(
      v.object({
        at: Count,
        target: TargetKeySchema,
        n: v.picklist([1, 2, 3]),
        pick: v.picklist(PRINCIPLES),
        right: v.boolean(),
      }),
    ),
    [],
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
  return { targets: {}, log: [], fails: {}, picks: [] };
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
export function canOpen(book: HintBook, target: TargetKey, gate3 = false): 1 | 2 | 3 | 4 | null {
  const state = book.targets[target];
  if (!state || state.opened === 0) return 1;
  if (!state.looked) return null;
  if (state.opened === 1) return 2;
  if (state.opened === 2) return gate3 ? 3 : null;
  // 4 is hint 3's last step: the worked example leaves it to the player until one more look.
  return state.opened === 3 ? 4 : null;
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

/** The book after the player picked `pick` as the principle under hint n of `target`. */
export function answer(
  book: HintBook,
  levelId: string,
  target: Target,
  n: 1 | 2 | 3,
  pick: Principle,
  at: number,
): HintBook {
  const right = hintFor(levelId, target, n)?.principle === pick;
  return {
    ...book,
    picks: [...book.picks, { at, target: target.key, n, pick, right }].slice(-LOG_LIMIT),
  };
}

/**
 * Whether `principle` has been named right on this ladder already: a rung resting on it then
 * names it instead of asking again, so a ladder of one lesson asks once.
 */
export function settled(book: HintBook, target: TargetKey, principle: Principle): boolean {
  return book.picks.some((p) => p.target === target && p.right && p.pick === principle);
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
