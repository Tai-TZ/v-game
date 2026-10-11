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
