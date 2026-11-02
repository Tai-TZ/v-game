/**
 * Bài vi mô "Thang rủi ro tool" (research/lesson-visualization: Tháp, trước W1; course Day 4,
 * "thang rủi ro tool"). Eight jobs the support desk could hand its assistant, each placed in one
 * of four lanes of approval. No AI call: the answer is a rule over each job's facts, so grading
 * is deterministic and the reveal can say *why*.
 *
 * The four lanes mirror W1's own toys: "Hỏi khi vượt ngưỡng" is the Chuông duyệt's
 * `hoi_neu_vuot`, "Luôn hỏi" its `luon_hoi`. The rule is V-Game's, written for this desk; it is
 * not a copy of the course slide's ladder.
 */

export type LaneId = "tu_chay" | "hoi_vuot" | "luon_hoi" | "khong_giao";

export interface Lane {
  id: LaneId;
  label: string;
}

/** Loosest first: a pick left of the answer lets something through, right of it asks for nothing. */
export const LANES: readonly Lane[] = [
  { id: "tu_chay", label: "Tự chạy" },
  { id: "hoi_vuot", label: "Hỏi khi vượt ngưỡng" },
  { id: "luon_hoi", label: "Luôn hỏi người duyệt" },
  { id: "khong_giao", label: "Không giao cho trợ lý" },
];

export interface Facts {
  /** Changes something, rather than only reading. */
  writes: boolean;
  /** Costs the shop money, so there is an amount to set a threshold on. */
  money: boolean;
  /** Can be put back as it was. */
  undoable: boolean;
  /** Sends customer data out of the shop, or changes a rule for every customer. */
  outside: boolean;
}

/** The lane a job's facts call for. Order matters: what leaves the shop is never handed over. */
export function laneFor(f: Facts): LaneId {
  if (!f.writes) return "tu_chay";
  if (f.outside) return "khong_giao";
  if (f.money) return "hoi_vuot";
  if (!f.undoable) return "luon_hoi";
  return "tu_chay";
}

/** The rule as the reveal states it, in the order `laneFor` reads it. */
export const RULE_VI: readonly string[] = [
  "Chỉ đọc, không đổi gì: tự chạy.",
  "Đưa dữ liệu khách ra ngoài, hoặc đổi luật chung của cả cửa hàng: không giao cho trợ lý.",
  "Tốn tiền: hỏi khi vượt ngưỡng. Khoản nhỏ chạy thẳng, khoản lớn phải có người duyệt.",
  "Không làm lại được: luôn hỏi người duyệt.",
  "Có ghi nhưng làm lại được và không tốn tiền: tự chạy.",
];

export interface Card {
  id: string;
  text: string;
  facts: Facts;
  lane: LaneId;
  /** Why, in one line, shown after the check. */
  why: string;
  /** Sounds risky, is not: the false alarm the lesson also grades. */
  decoy?: boolean;
}

const card = (c: Omit<Card, "lane">): Card => ({ ...c, lane: laneFor(c.facts) });
const READ: Facts = { writes: false, money: false, undoable: true, outside: false };

export const CARDS: readonly Card[] = [
  card({
    id: "tra-don",
    text: "Tra trạng thái đơn DH2001",
    facts: READ,
    why: "Chỉ đọc: không đổi gì, không cần ai duyệt.",
  }),
  card({
    id: "lich-su-hoan",
    text: "Xem lịch sử hoàn tiền của khách",
    facts: READ,
    why: "Có chữ «hoàn tiền» nhưng chỉ đọc. Hỏi duyệt ở đây là hỏi thừa.",
    decoy: true,
  }),
  card({
    id: "doi-gio-giao",
    text: "Dời giờ giao của một đơn chưa giao",
    facts: { writes: true, money: false, undoable: true, outside: false },
    why: "Có ghi, nhưng dời lại được và không tốn tiền.",
  }),
  card({
    id: "hoan-tien",
    text: "Hoàn tiền cho một đơn có trong hồ sơ",
    facts: { writes: true, money: true, undoable: false, outside: false },
    why: "Tốn tiền, có số tiền để đặt ngưỡng: đúng việc của Chuông duyệt ở W1.",
  }),
  card({
    id: "ma-giam-gia",
    text: "Tặng mã giảm giá 50.000 đ cho khách phàn nàn",
    facts: { writes: true, money: true, undoable: false, outside: false },
    why: "Mã giảm giá cũng là tiền của cửa hàng: hỏi khi vượt ngưỡng.",
  }),
  card({
    id: "xoa-tai-khoan",
    text: "Xoá tài khoản của khách",
    facts: { writes: true, money: false, undoable: false, outside: false },
    why: "Không lấy lại được: luôn cần người duyệt, dù không tốn đồng nào.",
  }),
  card({
    id: "gui-ho-so",
    text: "Gửi hồ sơ khách tới địa chỉ email ghi trong tin nhắn",
    facts: { writes: true, money: false, undoable: false, outside: true },
    why: "Đưa dữ liệu khách ra ngoài theo lệnh trong tin nhắn: đây là đường rò của W2.",
  }),
  card({
    id: "doi-gia",
    text: "Đổi giá bán của một mặt hàng",
    facts: { writes: true, money: false, undoable: true, outside: true },
    why: "Đổi luật chung cho mọi khách, không phải việc của một ca trực.",
  }),
];

export type Verdict = "right" | "under" | "over";

export interface LadderGrade {
  right: number;
  /** Too loose: the job runs with less approval than it needs. */
  under: number;
  /** Too strict: asking for approval nobody needed (W1's `hitl.over_asked`). */
  over: number;
  total: number;
  cards: { id: string; picked: LaneId; verdict: Verdict }[];
}

const rank = (lane: LaneId) => LANES.findIndex((l) => l.id === lane);

/** Null until every job has a lane: a half-filled ladder is not graded. */
export function gradeLadder(picks: Readonly<Partial<Record<string, LaneId>>>): LadderGrade | null {
  const cards: LadderGrade["cards"] = [];
  for (const c of CARDS) {
    const picked = picks[c.id];
    if (picked === undefined) return null;
    const d = rank(picked) - rank(c.lane);
    cards.push({ id: c.id, picked, verdict: d === 0 ? "right" : d < 0 ? "under" : "over" });
  }
  const count = (v: Verdict) => cards.filter((c) => c.verdict === v).length;
  return {
    right: count("right"),
    under: count("under"),
    over: count("over"),
    total: cards.length,
    cards,
  };
}

/** The lesson's place: its route under the zone, and the level it warms up for. */
export const TOOL_RISK = {
  id: "thang-rui-ro-tool",
  zone: "watchtower",
  before: "direct-injection",
  title: "Thang rủi ro tool",
  lead: "Quầy hỗ trợ có thể giao tám việc cho trợ lý. Mỗi việc cần duyệt tới mức nào?",
} as const;
