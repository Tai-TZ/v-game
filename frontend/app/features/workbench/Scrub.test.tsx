import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SCRUB_VI } from "./copy";
import type { CaseView } from "./run";
import { Scrub } from "./Scrub";

afterEach(cleanup);

const cases = (count: number): CaseView[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `c${i + 1}`,
    n: i + 1,
    role: i < 3 ? "visible" : "hidden",
    vai: "su-kien",
    state: "graded",
    steps: {},
    tokens: { in: 0, out: 0 },
  }));

function draw(followedId: string | null, count = 10) {
  const onFollow = vi.fn();
  render(<Scrub cases={cases(count)} followedId={followedId} onFollow={onFollow} />);
  return onFollow;
}

const slider = () => screen.getByRole("slider", { name: SCRUB_VI.label });

describe("Scrub", () => {
  it("walks to the next case, and says where in the run it now is", () => {
    const onFollow = draw("c4");
    expect(screen.getByText("Câu #4/10")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: SCRUB_VI.next }));
    expect(onFollow).toHaveBeenCalledExactlyOnceWith("c5");
  });

  it("walks back to the previous case", () => {
    const onFollow = draw("c4");
    fireEvent.click(screen.getByRole("button", { name: SCRUB_VI.prev }));
    expect(onFollow).toHaveBeenCalledExactlyOnceWith("c3");
  });

  // A control that wraps would walk off the end of a run and look like it kept playing.
  it("stops at the ends rather than wrapping round", () => {
    const first = draw("c1");
    expect(screen.getByRole("button", { name: SCRUB_VI.prev })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: SCRUB_VI.prev }));
    expect(first).not.toHaveBeenCalled();
    cleanup();
    const last = draw("c10");
    expect(screen.getByRole("button", { name: SCRUB_VI.next })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: SCRUB_VI.next }));
    expect(last).not.toHaveBeenCalled();
  });

  it("seeks straight to a case the player drags to, by that case's own id", () => {
    const onFollow = draw("c1");
    fireEvent.change(slider(), { target: { value: "7" } });
    expect(onFollow).toHaveBeenCalledExactlyOnceWith("c7");
  });

  it("starts on the first case when the run has nothing followed yet", () => {
    draw(null);
    expect(screen.getByText("Câu #1/10")).toBeDefined();
    expect(slider()).toHaveProperty("value", "1");
  });

  it("is not drawn for a run of one case, where there is nothing to walk through", () => {
    draw("c1", 1);
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("carries no aria-live region of its own: the page already has exactly one", () => {
    const { container } = render(
      <Scrub cases={cases(10)} followedId="c1" onFollow={() => undefined} />,
    );
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
  });
});

// The Playwright a11y suite is the real gate but runs nine minutes later; these rules need no
// layout. A range input with only an aria-label, or a button whose label is an icon, is exactly
// the shape that fails there.
it("answers axe's structural rules", async () => {
  const { container } = render(
    <Scrub cases={cases(10)} followedId="c3" onFollow={() => undefined} />,
  );
  const result = await axe.run(container, {
    runOnly: {
      type: "rule",
      values: ["button-name", "aria-allowed-attr", "aria-valid-attr-value", "nested-interactive"],
    },
  });
  expect(result.passes.length).toBeGreaterThan(0);
  expect(result.violations.map((v) => v.id)).toEqual([]);
});
