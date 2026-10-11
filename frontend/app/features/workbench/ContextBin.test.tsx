import { cleanup, render, screen } from "@testing-library/react";
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
