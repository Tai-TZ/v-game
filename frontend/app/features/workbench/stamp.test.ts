import { describe, expect, it } from "vitest";

import { stampAnswer } from "./stamp";

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
