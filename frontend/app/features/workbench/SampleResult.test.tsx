import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SAMPLE_VI } from "./copy";
import type { RunView } from "./run";
import { SampleResult } from "./SampleResult";
import { frame, replay } from "./test-fixtures";

afterEach(cleanup);

const started = (scope?: "mau") =>
  frame(1, "run.started", {
    scope,
    ingestion: [],
    cases: [
      { id: "v01", role: "visible", vai: "su-kien", question: "a" },
      { id: "v02", role: "visible", vai: "su-kien", question: "b" },
      { id: "v03", role: "visible", vai: "su-kien", question: "c" },
    ],
  });
const graded = (seq: number, id: string, passed: boolean, reason?: "daily_cap") =>
  frame(seq, "case.graded", {
    case: id,
    status: passed ? "ok" : "fail",
    passed,
    counted: true,
    criteria: {},
    labels: [],
    ...(reason === undefined ? {} : { reason }),
  });
const done = (seq: number) =>
  frame(seq, "run.finished", { report: { gold: {}, diagnosis: [] }, models: {} });

function sample(passes: readonly boolean[], reason?: "daily_cap"): RunView {
  const run = replay([
    started("mau"),
    ...passes.map((p, i) => graded(i + 2, `v0${i + 1}`, p, i === 0 ? reason : undefined)),
    done(passes.length + 2),
  ]);
  if (!run) throw new Error("no run");
  return run;
}

describe("SampleResult", () => {
  // Without this the sample step vanishes the moment it ends: it earns no stars, so the
  // results section never renders, and the running panel that named it has unmounted.
  it("stays on screen after the sample run ends, counting what passed", () => {
    render(<SampleResult run={sample([true, false, true])} />);
    expect(screen.getByText("2/3 câu mẫu đạt.", { exact: false })).toBeDefined();
  });

  it("says the sample step earns no stars, wherever it landed", () => {
    render(<SampleResult run={sample([true, true, true])} />);
    expect(screen.getByText(SAMPLE_VI.noStars, { exact: false })).toBeDefined();
  });

  it("says the star run is following when all three passed", () => {
    render(<SampleResult run={sample([true, true, true])} />);
    expect(screen.getByText(SAMPLE_VI.passed)).toBeDefined();
  });

  it("says what the gate wants when one failed, instead of leaving a dead end", () => {
    render(<SampleResult run={sample([true, false, true])} />);
    expect(screen.getByText(SAMPLE_VI.failed)).toBeDefined();
    expect(screen.queryByText(SAMPLE_VI.passed)).toBeNull();
  });

  // §3.3: the server's own quota, not the player's bench. Saying "chưa đủ" here would blame
  // them for the server's day.
  it("blames the server's day, not the player, when the daily cap cut in", () => {
    render(<SampleResult run={sample([true, true, true], "daily_cap")} />);
    expect(screen.getByText(SAMPLE_VI.capped)).toBeDefined();
    expect(screen.queryByText(SAMPLE_VI.failed)).toBeNull();
  });

  it("is not drawn for a star run, which has its own results", () => {
    const star = replay([started(), done(2)]);
    if (!star) throw new Error("no run");
    const { container } = render(<SampleResult run={star} />);
    expect(container.innerHTML).toBe("");
  });

  // The running panel that held focus unmounts when the run ends; a star run hands focus to
  // its results. Without a target here the keyboard drops to <body>.
  it("can take the focus the unmounting run panel is about to drop", () => {
    render(<SampleResult run={sample([true, true, true])} />);
    const heading = document.getElementById("wb-sample");
    expect(heading?.tagName).toBe("H2");
    // Not `heading.tabIndex === -1`: an ordinary heading reports -1 too, so that assertion
    // passes with the attribute deleted. Focus it and see whether focus actually lands.
    heading?.focus();
    expect(document.activeElement).toBe(heading);
  });

  it("carries no aria-live region of its own: the page already has exactly one", () => {
    const { container } = render(<SampleResult run={sample([true, true, true])} />);
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
  });
});
