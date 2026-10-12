import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContextBin } from "./ContextBin";

afterEach(cleanup);

describe("ContextBin", () => {
  it("says how full the bin is, in the numbers the run measured", () => {
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a", "b"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Thùng chứa 1.000 trên 3.000 token, 2 đoạn vào thùng",
    );
  });

  it("shows the lid refusing to close when the pack is over budget", () => {
    render(
      <ContextBin
        tokens={{ docs: 3500, query: 100, total: 3600, budget: 3000 }}
        included={["a"]}
        dropped={["b", "c"]}
        promptTokens={null}
      />,
    );
    expect(screen.getByText(/Nắp không đóng được/)).toBeDefined();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("2 đoạn bị cắt");
  });

  it("counts the passages rather than weighing them, and says so", () => {
    // The pack fact measures the whole, never one passage, so a block per passage would be
    // inventing a size the run never measured.
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a", "b", "c"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(screen.getByText(/mỗi khối là một đoạn, không theo cỡ/)).toBeDefined();
  });
});

describe("what the bin actually paints", () => {
  const bands = () => ({
    docs: document.querySelector<HTMLElement>('[data-band="docs"]'),
    query: document.querySelector<HTMLElement>('[data-band="query"]'),
    bin: document.querySelector<HTMLElement>("[data-bin]"),
  });

  it("draws the part that will not fit, so a lid that shuts is not the same picture", () => {
    // Before: overflow-hidden clipped the band, so 3.600/3.000 and 3.000/3.000 painted
    // pixel-identically and only a border colour and one sentence told them apart.
    render(
      <ContextBin
        tokens={{ docs: 3500, query: 100, total: 3600, budget: 3000 }}
        included={["a"]}
        dropped={["b"]}
        promptTokens={null}
      />,
    );
    const over = document.querySelector("[data-overflow]");
    expect(over).not.toBeNull();
    expect(parseFloat(over?.getAttribute("data-overflow") ?? "0")).toBeCloseTo(20, 1);
    // Colour is not the only carrier: an icon and the words sit beside it.
    expect(document.querySelector("[data-overflow-note] svg")).not.toBeNull();
    expect(document.querySelector("[data-overflow-note]")?.textContent).toContain(
      "Nắp không đóng được",
    );
  });

  it("draws nothing over the rim for a pack that exactly fills the bin", () => {
    render(
      <ContextBin
        tokens={{ docs: 2900, query: 100, total: 3000, budget: 3000 }}
        included={["a"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(document.querySelector("[data-overflow]")).toBeNull();
    expect(document.querySelector("[data-overflow-note]")).toBeNull();
  });

  it("sizes the bands with SVG attributes, never a style attribute", () => {
    // frontend-architecture §8.1: sizes and colours go through SVG attributes or Tailwind, not
    // `style=`, which CSP blocks the moment it reaches prerendered HTML.
    const { container } = render(
      <ContextBin
        tokens={{ docs: 1200, query: 93, total: 1293, budget: 3000 }}
        included={["a"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("gives each band its measured share of the bin, not the square of it", () => {
    // 1.200 + 93 of 3.000 is 40 % + 3,1 %. Nesting the bands inside a wrapper that was itself
    // 43,1 % of the bin painted 40 % *of that*: 17,2 % of the bin for a 40 % band.
    render(
      <ContextBin
        tokens={{ docs: 1200, query: 93, total: 1293, budget: 3000 }}
        included={["a", "b"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    const { docs, query, bin } = bands();
    // The bin's viewBox is 100 tall, so a band's height attribute IS its share of the budget.
    expect(parseFloat(docs?.getAttribute("height") ?? "")).toBeCloseTo(40, 6);
    expect(parseFloat(query?.getAttribute("height") ?? "")).toBeCloseTo(3.1, 6);
    // Both bands are drawn straight into the bin, so no ancestor can rescale them.
    expect(docs?.parentElement).toBe(bin);
    expect(query?.parentElement).toBe(bin);
    // The question stacks on top of the documents: its foot is where the documents end.
    expect(parseFloat(query?.getAttribute("y") ?? "")).toBeCloseTo(100 - 40 - 3.1, 6);
    expect(parseFloat(docs?.getAttribute("y") ?? "")).toBeCloseTo(60, 6);
  });

  it("lets an over-budget band run past the bin instead of pinning it at full", () => {
    render(
      <ContextBin
        tokens={{ docs: 3500, query: 100, total: 3600, budget: 3000 }}
        included={["a"]}
        dropped={["b"]}
        promptTokens={null}
      />,
    );
    // bin.test.ts asks for an overflow that sticks out rather than a bar quietly at 100 %.
    expect(parseFloat(bands().docs?.getAttribute("height") ?? "0")).toBeGreaterThan(100);
  });

  it("draws one block per passage that made it in", () => {
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a", "b", "c", "d", "e"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(document.querySelectorAll("[data-passage]")).toHaveLength(5);
  });

  it("prints the documents and the question the way round the run measured them", () => {
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(screen.getByText(/tài liệu 600 · câu hỏi 400/)).toBeDefined();
  });
});

describe("the bin's table form", () => {
  it("carries the same numbers the bands were drawn from", () => {
    render(
      <ContextBin
        tokens={{ docs: 1200, query: 93, total: 1293, budget: 3000 }}
        included={["a", "b"]}
        dropped={["c"]}
        promptTokens={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem dạng bảng" }));
    const cells = [...document.querySelectorAll("tbody tr")].map(
      (tr) => `${tr.querySelector("th")?.textContent}=${tr.querySelector("td")?.textContent}`,
    );
    expect(cells).toEqual([
      "Tổng=1.293",
      "Ngân sách=3.000",
      "Tài liệu=1.200",
      "Câu hỏi=93",
      "Đoạn vào thùng=2",
      "Đoạn bị cắt=1",
    ]);
  });

  it("wears the run stamp, because every number in it was measured by the run", () => {
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a"]}
        dropped={[]}
        promptTokens={null}
      />,
    );
    expect(document.querySelector("figure[data-vg-viz]")).not.toBeNull();
    expect(document.body.textContent).toContain("Đo từ lượt của bạn");
  });
});

describe("the two token counts", () => {
  const pack = { docs: 393, query: 27, total: 420, budget: 3000 };

  it("names the counter the bin used, and gives the provider's number its own words", () => {
    // The committed L2 case: the bin counted 420 with regex-v1, Gemini charged 600 in for the
    // same case. Both are true and they do not measure the same thing.
    render(<ContextBin tokens={pack} included={["a"]} dropped={[]} promptTokens={600} />);
    expect(document.body.textContent).toContain("đếm bằng regex-v1");
    expect(document.body.textContent).toContain(
      "Gemini tính 600 token vào cho cả lời nhắc, không chỉ phần trong thùng.",
    );
    // Two different figures, not one printed twice.
    expect(document.body.textContent).toContain("420");
    expect(document.body.textContent).toContain("600");
  });

  it("says it has no provider number yet rather than showing a zero", () => {
    render(<ContextBin tokens={pack} included={["a"]} dropped={[]} promptTokens={null} />);
    expect(document.body.textContent).toContain("Chưa có số của Gemini cho câu này.");
    expect(document.body.textContent).not.toContain("0 token vào");
    expect(document.body.textContent).toContain("đếm bằng regex-v1");
  });
});

describe("the passages the lid cut off", () => {
  const ranked = [4, 5, 6, 7].map((rank) => ({
    chunk_id: `d${rank}`,
    rank,
    score: 1 - rank / 100,
    doc_id: "quy-che",
    dieu: rank,
    khoan: [1],
    hieu_luc: true,
  }));

  it("drops one block per cut passage, each saying the rank it was cut from", () => {
    render(
      <ContextBin
        tokens={{ docs: 2960, query: 20, total: 2980, budget: 3000 }}
        included={["a1"]}
        dropped={["d4", "d5", "d6", "d7"]}
        ranked={ranked}
        promptTokens={null}
      />,
    );
    const cut = [...document.querySelectorAll("[data-cut-piece]")];
    expect(cut).toHaveLength(4);
    expect(cut.map((el) => el.getAttribute("aria-label"))).toEqual([
      "bị cắt: hạng 4",
      "bị cắt: hạng 5",
      "bị cắt: hạng 6",
      "bị cắt: hạng 7",
    ]);
  });

  it("says the span of the ranks it cut, not only how many", () => {
    // L2 §6 asks for "Thùng: 2.980/3.000 token. Bị cắt: 4 đoạn (hạng 4–7)."
    render(
      <ContextBin
        tokens={{ docs: 2960, query: 20, total: 2980, budget: 3000 }}
        included={["a1"]}
        dropped={["d4", "d5", "d6", "d7"]}
        ranked={ranked}
        promptTokens={null}
      />,
    );
    expect(document.querySelector("[data-cut-note]")?.textContent).toBe(
      "Bị cắt: 4 đoạn (hạng 4–7).",
    );
  });

  it("will not invent a rank for a passage the ranked list never named", () => {
    render(
      <ContextBin
        tokens={{ docs: 100, query: 20, total: 120, budget: 3000 }}
        included={["a1"]}
        dropped={["zz"]}
        ranked={ranked}
        promptTokens={null}
      />,
    );
    const cut = document.querySelector("[data-cut-piece]");
    expect(cut?.getAttribute("aria-label")).toBe("bị cắt: không rõ hạng");
    expect(cut?.textContent).not.toMatch(/\d/);
    expect(document.querySelector("[data-cut-note]")?.textContent).toBe("Bị cắt: 1 đoạn.");
  });

  it("draws no floor at all when the lid closed over everything", () => {
    render(
      <ContextBin
        tokens={{ docs: 100, query: 20, total: 120, budget: 3000 }}
        included={["a1"]}
        dropped={[]}
        ranked={ranked}
        promptTokens={null}
      />,
    );
    expect(document.querySelectorAll("[data-cut-piece]")).toHaveLength(0);
    expect(document.querySelector("[data-cut-note]")).toBeNull();
  });
});
