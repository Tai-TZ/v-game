import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { monthlyBill, PRICE, ScaleBill } from "./ScaleBill";
import { parseSse, readText, replay } from "./test-fixtures";

/** Plan v0.7 §4 item 0.4: the run's real tokens, times a price, times customers a day. */

afterEach(cleanup);

describe("monthlyBill", () => {
  it("prices one run's tokens per case, scaled to customers a day for 30 days", () => {
    // 12 cases, 1.2M in and 0.12M out: per case 0.1M in, 0.01M out.
    const bill = monthlyBill({ in: 1_200_000, out: 120_000 }, 12, 100);
    const perCase = (0.1 * PRICE.input + 0.01 * PRICE.output) / 1;
    expect(bill.usd).toBeCloseTo(perCase * 100 * 30, 6);
    expect(bill.outputShare).toBeCloseTo((0.01 * PRICE.output) / perCase, 6);
  });

  it("is zero for a run with no case", () => {
    expect(monthlyBill({ in: 0, out: 0 }, 0, 1000).usd).toBe(0);
  });
});

describe("ScaleBill", () => {
  const run = () => {
    const view = replay(parseSse(readText("e2e", "data", "run-w1-reference.sse")));
    if (!view) throw new Error("no run");
    return view;
  };

  it("bills the chosen number of customers a day, from the run's own tokens", () => {
    render(<ScaleBill run={run()} />);
    const bill = () => document.querySelector<HTMLElement>("[data-scale-bill]");
    expect(bill()?.dataset.perDay).toBe("1000");
    const at1000 = Number(bill()?.dataset.usd);
    fireEvent.click(screen.getByRole("radio", { name: "10.000" }));
    expect(bill()?.dataset.perDay).toBe("10000");
    expect(Number(bill()?.dataset.usd)).toBeCloseTo(at1000 * 10, 6);
  });

  it("says it is an estimate, and where and when the price was read", () => {
    render(<ScaleBill run={run()} />);
    const text = document.body.textContent;
    expect(text).toContain("Ước tính");
    expect(text).toContain(PRICE.checked);
    expect(text).toContain(PRICE.model);
  });
});
