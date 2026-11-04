import { DATA_KINDS_LESSON } from "./registry";

/**
 * Bài vi mô "Ba loại dữ liệu" (research/lesson-visualization: Thư viện, trước L1; course Day 7,
 * "3 loại dữ liệu"; roadmap-v0.4 N24). Nine things the library desk's assistant needs, each put
 * in one of three places. No AI call: the place is a rule over each card's facts, so grading is
 * deterministic and the reveal can say *why*. The point: not everything belongs in a vector
 * store.
 */

export type PlaceId = "kho_vector" | "tra_cuu" | "loi_dan";

export interface Place {
  id: PlaceId;
  /** On the chip, with `hint` under it: both short, so three chips fit across a phone. */
  name: string;
  hint: string;
  /** In the key and in "nên là: …". */
  full: string;
  /** What the place does, for the key above the cards. */
  does: string;
}

export const PLACES: readonly Place[] = [
  {
    id: "kho_vector",
    name: "Kho vector",
    hint: "theo nghĩa",
    full: "Tìm theo nghĩa trong kho vector",
    does: "mỗi câu hỏi kéo lên vài đoạn gần nghĩa nhất.",
  },
  {
    id: "tra_cuu",
    name: "Tra cứu",
    hint: "API, SQL",
    full: "Tra cứu có cấu trúc (API hoặc SQL)",
    does: "hỏi thẳng hệ thống lúc cần, lấy đúng dòng theo mã.",
  },
  {
    id: "loi_dan",
    name: "Lời dặn",
    hint: "chèn thẳng",
    full: "Chèn thẳng vào lời dặn",
    does: "đi kèm mọi câu hỏi gửi cho model.",
  },
];

export interface Facts {
  /** Changes during the day: a copy in the store or the prompt is stale by the next question. */
  live: boolean;
  /** Each answer is one record found by an exact key (mã sinh viên, mã lớp), not by meaning. */
  keyed: boolean;
  /** A few lines, not pages. */
  short: boolean;
  /** Every question the desk gets needs it. */
  always: boolean;
}

/** The place a card's facts call for. Order matters: fresh and exact come before short. */
export function placeFor(f: Facts): PlaceId {
  if (f.live) return "tra_cuu";
  if (f.keyed) return "tra_cuu";
  if (f.short && f.always) return "loi_dan";
  return "kho_vector";
}

/** The rule as the reveal states it, in the order `placeFor` reads it. */
export const RULE_VI: readonly string[] = [
  "Đổi trong ngày: tra cứu tận nguồn lúc hỏi. Bản chép vào kho hay vào lời dặn sẽ cũ.",
  "Tra theo một mã chính xác: tra cứu có cấu trúc. Tìm theo nghĩa coi hai mã gần nhau gần như là một.",
  "Ngắn, và câu nào cũng cần: chèn thẳng vào lời dặn.",
  "Còn lại, văn bản dài hỏi bằng lời thường: tìm theo nghĩa trong kho vector.",
];

export interface Card {
  id: string;
  text: string;
  facts: Facts;
  place: PlaceId;
  /** Why, in one line, shown after the check. */
  why: string;
  /** The wrong place its wording points to: the decoy the lesson also grades. */
  lure?: PlaceId;
}

const card = (c: Omit<Card, "place">): Card => ({ ...c, place: placeFor(c.facts) });
const TEXT: Facts = { live: false, keyed: false, short: false, always: false };
const RULE: Facts = { live: false, keyed: false, short: true, always: true };

/** Mixed, so no place's cards sit together. */
export const CARDS: readonly Card[] = [
  card({
    id: "quy-che",
    text: "Toàn văn quy chế đào tạo, 84 điều, mà câu hỏi nào cũng cần tới",
    facts: { ...TEXT, always: true },
    why: "Câu nào cũng cần, nhưng mỗi câu chỉ cần vài điều. Chèn cả 84 điều vào lời dặn thì câu nào cũng trả tiền cho cả cuốn.",
    lure: "loi_dan",
  }),
  card({
    id: "cho-trong",
    text: "Số chỗ còn trống ở phòng tự học, cập nhật từng phút",
    facts: { ...TEXT, live: true, short: true },
    why: "Đổi từng phút: bản chép vào kho hay lời dặn đã cũ ở câu hỏi sau. Hỏi tận nguồn lúc cần.",
  }),
  card({
    id: "vai-tro-ly",
    text: "Vai của trợ lý: xưng «mình», trả lời ngắn gọn, luôn ghi số điều đã dùng",
    facts: RULE,
    why: "Ngắn, và câu nào cũng phải theo: đặt thẳng vào lời dặn, không phải đi tìm.",
  }),
  card({
    id: "tin-chi",
    text: "Số tín chỉ đã tích lũy của từng sinh viên, mà các bạn hay hỏi bằng lời thường: «em đủ tín chỉ ra trường chưa?»",
    facts: { ...TEXT, keyed: true, short: true },
    why: "Câu hỏi bằng lời thường, nhưng câu trả lời là một dòng tra theo mã sinh viên. Tìm theo nghĩa dễ lấy nhầm dòng của bạn khác.",
    lure: "kho_vector",
  }),
  card({
    id: "hoi-dap",
    text: "Ba trăm câu hỏi đáp của phòng đào tạo, viết bằng lời thường",
    facts: TEXT,
    why: "Văn bản dài, người hỏi dùng chữ của họ chứ không dùng chữ của văn bản: đúng việc của tìm theo nghĩa.",
  }),
  card({
    id: "khong-co",
    text: "Luật của quầy: không thấy trong quy chế thì nói «không có», không đoán",
    facts: RULE,
    why: "Luật cho mọi câu. Để trong kho thì có câu không kéo được nó lên, và trợ lý lại đoán.",
  }),
  card({
    id: "lich-thi",
    text: "Lịch thi kết thúc học phần của từng lớp, tra theo mã lớp học phần",
    facts: { ...TEXT, keyed: true },
    why: "Mỗi lớp một dòng, tra đúng mã. Hai mã lớp chỉ khác một chữ số thì tìm theo nghĩa coi như một.",
  }),
  card({
    id: "huong-dan-khoa-luan",
    text: "Hướng dẫn trình bày khóa luận tốt nghiệp, dài 40 trang",
    facts: TEXT,
    why: "Dài, và chỉ vài câu hỏi cần tới: để trong kho, cần thì tìm.",
  }),
  card({
    id: "ban-hien-hanh",
    text: "Bản quy chế đang áp dụng: bản 2024, thay bản 2019 từ ngày 15/8/2024",
    facts: RULE,
    why: "Một dòng mà câu nào cũng cần, để trợ lý không trả lời theo bản cũ.",
  }),
];

/** A wrong pick, named for where it went: each kind is its own lesson. */
export type Miss = "vao_kho" | "nhoi_loi_dan" | "ep_tra_cuu";
export type Verdict = "right" | Miss;

export const MISS_OF: Readonly<Record<PlaceId, Miss>> = {
  kho_vector: "vao_kho",
  loi_dan: "nhoi_loi_dan",
  tra_cuu: "ep_tra_cuu",
};

export interface SortGrade {
  right: number;
  total: number;
  /** Wrong picks by where they went. */
  misses: Readonly<Record<Miss, number>>;
  cards: { id: string; picked: PlaceId; verdict: Verdict }[];
}

/** Null until every card has a place: a half-sorted pile is not graded. */
export function gradeSort(picks: Readonly<Partial<Record<string, PlaceId>>>): SortGrade | null {
  const cards: SortGrade["cards"] = [];
  for (const c of CARDS) {
    const picked = picks[c.id];
    if (picked === undefined) return null;
    cards.push({ id: c.id, picked, verdict: picked === c.place ? "right" : MISS_OF[picked] });
  }
  const count = (v: Verdict) => cards.filter((c) => c.verdict === v).length;
  return {
    right: count("right"),
    total: cards.length,
    misses: {
      vao_kho: count("vao_kho"),
      nhoi_loi_dan: count("nhoi_loi_dan"),
      ep_tra_cuu: count("ep_tra_cuu"),
    },
    cards,
  };
}

/** The lesson's place, and its question. */
export const DATA_KINDS = {
  ...DATA_KINDS_LESSON,
  lead: "Trợ lý ở quầy Thư viện cần chín thứ dữ liệu. Mỗi thứ nên để ở đâu?",
} as const;
