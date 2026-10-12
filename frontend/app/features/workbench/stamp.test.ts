import { describe, expect, it } from "vitest";

import { stampAnswer } from "./stamp";
import { readText } from "./test-fixtures";

describe("stampAnswer", () => {
  it("stamps a sentence that cites a passage the packer actually put in the bin", () => {
    const parts = stampAnswer("Nộp đơn trước hai tuần [ab12cd34]. Hết.", ["ab12cd34"]);
    expect(parts[0]).toEqual({
      text: "Nộp đơn trước hai tuần [ab12cd34].",
      kind: "brick",
      ids: ["ab12cd34"],
    });
  });

  it("marks a citation the bin never held as fabricated", () => {
    // The L1 lesson: a model with nothing in the bin invents a source that looks real.
    const parts = stampAnswer("Theo Điều 47 [zz99zz99].", ["ab12cd34"]);
    expect(parts[0]?.kind).toBe("fake");
    expect(parts[0]?.ids).toEqual(["zz99zz99"]);
  });

  it("leaves an uncited sentence as a bubble", () => {
    const parts = stampAnswer("Bạn nên hỏi phòng đào tạo.", ["ab12cd34"]);
    expect(parts[0]?.kind).toBe("bubble");
    expect(parts[0]?.ids).toEqual([]);
  });

  it("turns the committed L1 answer into bubbles, because its bin was empty", () => {
    const parts = stampAnswer("Chào bạn! Làm đơn xin bảo lưu. Nộp cho phòng đào tạo.", []);
    expect(parts.every((p) => p.kind === "bubble")).toBe(true);
    expect(parts).toHaveLength(3);
  });

  it("keeps every character of the answer, so nothing is quietly dropped", () => {
    const text = "Một câu [ab12cd34]. Câu hai.\n\nCâu ba!";
    expect(
      stampAnswer(text, ["ab12cd34"])
        .map((p) => p.text)
        .join(" ")
        .replace(/\s+/g, " "),
    ).toBe(text.replace(/\s+/g, " "));
  });

  it("says nothing about an empty answer", () => {
    expect(stampAnswer("", [])).toEqual([]);
  });
});

/** The answers the game ships, so the splitter is measured against real model prose. */
function committedAnswer(level: string, caseId: string): string {
  const run = JSON.parse(readText("public", "runs", `${level}.json`)) as {
    events?: { case?: string; facts?: { kind: string; answer?: string }[] }[];
  };
  for (const ev of run.events ?? []) {
    if (ev.case !== caseId) continue;
    for (const f of ev.facts ?? []) if (f.kind === "llm" && f.answer) return f.answer;
  }
  throw new Error(`no answer for ${caseId}`);
}

describe("sentence splitting on the committed answers", () => {
  it("keeps a decimal inside its sentence instead of tearing the citation off it", () => {
    // lib-l1-v03 says "equivalent IELTS 5.5 hoặc TOEIC 600 trở lên) [VD_ANH_02]". Splitting at
    // the decimal stamped the first half "no source" -- inverting L1's whole lesson -- and gave
    // the second half the citation.
    const parts = stampAnswer(committedAnswer("grounded-citation", "lib-l1-v03"), []);
    const torn = parts.filter((p) => p.text.startsWith("5 hoặc TOEIC"));
    expect(torn).toHaveLength(0);
    const cited = parts.filter((p) => p.ids.includes("VD_ANH_02"));
    expect(cited).toHaveLength(1);
    expect(cited[0]?.text).toContain("IELTS 5.5");
  });

  it("does not make a card out of a bracket left over from an ellipsis", () => {
    // "(… như TOEIC, IELTS, TOEFL...)" used to split after the dots, leaving ")." on its own.
    const parts = stampAnswer(committedAnswer("grounded-citation", "lib-l1-v03"), []);
    expect(parts.map((p) => p.text)).not.toContain(").");
    expect(parts.every((p) => p.text.length > 2)).toBe(true);
  });

  it("keeps a numbered list marker with the step it numbers", () => {
    // lib-l1-v01 is a four-step list; "1." through "4." are not sentences.
    const parts = stampAnswer(committedAnswer("grounded-citation", "lib-l1-v01"), []);
    expect(parts.map((p) => p.text)).not.toContain("1.");
    expect(parts.filter((p) => /^\d+\.\s/.test(p.text))).toHaveLength(4);
  });

  it("stamps every bullet of a grounded answer as a brick", () => {
    // lib-l2-v02 cites 758e555c on each bullet; with it in the bin they are all bricks.
    const parts = stampAnswer(committedAnswer("chunk-tuning", "lib-l2-v02"), ["758e555c"]);
    const bullets = parts.filter((p) => p.text.startsWith("-"));
    expect(bullets.length).toBeGreaterThanOrEqual(6);
    expect(bullets.every((p) => p.kind === "brick")).toBe(true);
  });
});

describe("a sentence citing more than one passage", () => {
  it("is fabricated when any one of its citations was never in the bin", () => {
    // The strict branch: `every`, not `some`. A sentence that leans half on a real passage and
    // half on an invented one is the harder version of L1's lesson, not a brick.
    const parts = stampAnswer("Theo Điều 12 [aa11] và Điều 47 [zz99].", ["aa11"]);
    expect(parts[0]?.kind).toBe("fake");
    expect(parts[0]?.ids).toEqual(["aa11", "zz99"]);
  });

  it("is a brick when every citation was in the bin", () => {
    const parts = stampAnswer("Theo Điều 12 [aa11] và Điều 13 [bb22].", ["aa11", "bb22"]);
    expect(parts[0]?.kind).toBe("brick");
  });
});
