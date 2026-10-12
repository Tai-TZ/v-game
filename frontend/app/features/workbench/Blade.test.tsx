import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Blade } from "./Blade";

afterEach(cleanup);

describe("Blade", () => {
  it("says how the index came out, in the run's own numbers", () => {
    render(<Blade variant="co_dinh-128-0" chunks={115} avgTokens={128} split={false} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Lược dao cắt kho thành 115 đoạn, trung bình 128 token mỗi đoạn",
    );
  });

  it("marks the blade when this run cut the answer sentence in half", () => {
    // ret.boundary_split on the committed L2 run, case v02 at co_dinh-128-0: the lesson of L2.
    render(<Blade variant="co_dinh-128-0" chunks={115} avgTokens={128} split />);
    expect(screen.getByText(/cắt đứt câu đáp án/)).toBeDefined();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("cắt đứt câu đáp án");
  });

  it("stays quiet when nothing was split", () => {
    render(<Blade variant="theo_dieu-512-10" chunks={84} avgTokens={158} split={false} />);
    expect(screen.queryByText(/cắt đứt/)).toBeNull();
  });
});

describe("what the strip actually draws", () => {
  const cuts = () => document.querySelectorAll("[data-cut]");

  it("draws a tick for every cut the average implies", () => {
    // 158 of a widest 1024 is a cut every 15,4 %: six inside the strip.
    render(<Blade variant="theo_dieu-512-10" chunks={84} avgTokens={158} split={false} />);
    expect(cuts()).toHaveLength(6);
  });

  it("still cuts the widest chunk the level offers", () => {
    // co_dinh/1024 bakes to 15 chunks averaging 979; a strip with no tick at all would be a
    // picture of an uncut corpus above a caption reading "15 đoạn".
    render(<Blade variant="co_dinh-1024-0" chunks={15} avgTokens={979} split={false} />);
    expect(cuts()).toHaveLength(1);
  });

  it("spaces the ticks evenly from the left edge", () => {
    render(<Blade variant="co_dinh-512-0" chunks={29} avgTokens={512} split={false} />);
    const at = [...cuts()].map((c) => parseFloat((c as HTMLElement).style.left));
    expect(at).toHaveLength(1);
    expect(at[0]).toBeCloseTo(50, 6);
  });
});
