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

  it("gives each band its measured share of the bin, not the square of it", () => {
    // 1.200 + 93 of 3.000 is 40 % + 3,1 %. Nesting the bands inside a wrapper that was itself
    // 43,1 % of the bin painted 40 % *of that*: 17,2 % of the bin for a 40 % band.
    render(
      <ContextBin
        tokens={{ docs: 1200, query: 93, total: 1293, budget: 3000 }}
        included={["a", "b"]}
        dropped={[]}
      />,
    );
    const { docs, query, bin } = bands();
    expect(parseFloat(docs?.style.height ?? "")).toBeCloseTo(40, 6);
    expect(parseFloat(query?.style.height ?? "")).toBeCloseTo(3.1, 6);
    // Each band measures against the bin itself, so no ancestor can rescale it.
    expect(docs?.parentElement).toBe(bin);
    expect(query?.parentElement).toBe(bin);
    // The question stacks on top of the documents rather than overlapping them.
    expect(parseFloat(query?.style.bottom ?? "")).toBeCloseTo(40, 6);
  });

  it("lets an over-budget band run past the bin instead of pinning it at full", () => {
    render(
      <ContextBin
        tokens={{ docs: 3500, query: 100, total: 3600, budget: 3000 }}
        included={["a"]}
        dropped={["b"]}
      />,
    );
    // bin.test.ts asks for an overflow that sticks out rather than a bar quietly at 100 %.
    expect(parseFloat(bands().docs?.style.height ?? "0")).toBeGreaterThan(100);
  });

  it("draws one block per passage that made it in", () => {
    render(
      <ContextBin
        tokens={{ docs: 600, query: 400, total: 1000, budget: 3000 }}
        included={["a", "b", "c", "d", "e"]}
        dropped={[]}
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
      />,
    );
    expect(document.querySelector("figure[data-vg-viz]")).not.toBeNull();
    expect(document.body.textContent).toContain("Đo từ lượt của bạn");
  });
});
