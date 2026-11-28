import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { Stamp } from "./Stamp";

afterEach(cleanup);

function stamp(tone: "pass" | "fail" | "muted", delay?: 0 | 1 | 2) {
  const { container } = render(
    <Stamp tone={tone} {...(delay === undefined ? {} : { delay })}>
      Đạt
    </Stamp>,
  );
  const node = container.querySelector("[data-stamp]");
  if (!(node instanceof HTMLElement)) throw new Error("no stamp");
  return node;
}

describe("Stamp (graphics upgrade 4.3)", () => {
  it.each([
    ["pass", "text-success", "border-success"],
    ["fail", "text-danger", "border-danger"],
    ["muted", "text-fg-muted", "border-line-strong"],
  ] as const)("inks a %s stamp in its tone, tilted, in a double border", (tone, text, border) => {
    const node = stamp(tone);
    expect(node.dataset.stamp).toBe(tone);
    expect(node.classList.contains(text)).toBe(true);
    expect(node.classList.contains(border)).toBe(true);
    for (const name of ["-rotate-3", "border-double", "border-4", "font-mono", "uppercase"])
      expect(node.classList.contains(name), name).toBe(true);
    expect(node.classList.contains("font-semibold")).toBe(true);
  });

  it("plays once, motion-safe only, and reads 24 px or more on the projector", () => {
    const node = stamp("pass");
    expect(node.classList.contains("motion-safe:animate-stamp")).toBe(true);
    expect(node.classList.contains("chieu:text-2xl")).toBe(true);
  });

  it.each([
    [undefined, "[animation-delay:0ms]"],
    [0, "[animation-delay:0ms]"],
    [1, "[animation-delay:60ms]"],
    [2, "[animation-delay:120ms]"],
  ] as const)("delays a stamp of delay %s by %s", (delay, cls) => {
    expect(stamp("pass", delay).classList.contains(cls)).toBe(true);
  });

  it("keeps its copy as typed, for a screen reader", () => {
    expect(stamp("muted").textContent).toBe("Đạt");
  });

  it("passes axe's structural rules and keeps the visible text in the name", async () => {
    const { container } = render(
      <ol>
        <li>
          <Stamp tone="pass">Đạt</Stamp>
        </li>
        <li>
          <Stamp tone="muted">Chưa đạt</Stamp>
        </li>
      </ol>,
    );
    const result = await axe.run(container, {
      runOnly: {
        type: "rule",
        values: ["list", "listitem", "label-content-name-mismatch", "aria-allowed-attr"],
      },
    });
    expect(result.passes.length).toBeGreaterThan(0);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
