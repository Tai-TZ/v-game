import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VARIANT_VI } from "./copy";
import type { RunView } from "./run";
import { VariantResult } from "./VariantResult";

afterEach(cleanup);

const run = (passed: boolean, over: Partial<RunView> = {}): RunView => ({
  runId: "v1",
  lastSeq: 0,
  stream: "closed",
  phase: "finished",
  scope: "bien_the",
  ingestion: [],
  cases: [
    {
      id: "lib-l1-r01",
      n: 1,
      role: "review",
      vai: "su-kien",
      question: "Một lần bảo lưu được tối đa bao lâu?",
      state: "graded",
      steps: {},
      tokens: { in: 0, out: 0 },
      graded: { status: passed ? "ok" : "fail", passed, counted: true, criteria: {}, labels: [] },
    },
  ],
  ...over,
});

describe("VariantResult", () => {
  it("shows the variant's question and that the player fixed it", () => {
    render(<VariantResult run={run(true)} />);
    expect(screen.getByText("Một lần bảo lưu được tối đa bao lâu?")).toBeTruthy();
    expect(screen.getByText(VARIANT_VI.passed)).toBeTruthy();
  });

  it("says plainly when the fix did not hold", () => {
    render(<VariantResult run={run(false)} />);
    expect(screen.getByText(VARIANT_VI.failed)).toBeTruthy();
  });

  it("shows nothing for any other run, or one still going", () => {
    const { container, rerender } = render(<VariantResult run={run(true, { scope: "mau" })} />);
    expect(container.innerHTML).toBe("");
    rerender(<VariantResult run={run(true, { phase: "running" })} />);
    expect(container.innerHTML).toBe("");
  });
});
