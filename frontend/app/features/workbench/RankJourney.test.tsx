import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { RankJourney } from "./RankJourney";

afterEach(cleanup);

const TOYS = { vs: "Vòm Sao", bm: "Tủ ngăn kéo", fu: "Phễu", rr: "Kính lúp" };
const ORDER = ["vs", "bm", "fu", "rr"];

describe("RankJourney", () => {
  it("reads the whole journey as one sentence for a screen reader", () => {
    render(<RankJourney ranks={{ vs: 23, fu: 2, rr: 1 }} order={ORDER} toys={TOYS} />);
    expect(screen.getByText("Vòm Sao hạng 23, Phễu hạng 2, Kính lúp hạng 1")).toBeDefined();
  });

  it("says a block never found the passage instead of showing a number it does not have", () => {
    render(<RankJourney ranks={{ vs: null, rr: 1 }} order={ORDER} toys={TOYS} />);
    expect(screen.getByText(/Vòm Sao không tìm thấy/)).toBeDefined();
  });

  it("renders nothing when no block ranked anything", () => {
    const { container } = render(<RankJourney ranks={{}} order={ORDER} toys={TOYS} />);
    expect(container.innerHTML).toBe("");
  });

  it("hides the chips from a screen reader and gives it the sentence instead", async () => {
    // The chips are a picture: colour plus a number, read left to right. A screen reader gets
    // the same journey as one sentence, so the list is deliberately out of the a11y tree.
    const { container } = render(
      <RankJourney ranks={{ vs: 23, rr: 1 }} order={ORDER} toys={TOYS} />,
    );
    expect(container.querySelector("ol")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Vòm Sao hạng 23, Kính lúp hạng 1")).toBeDefined();

    // The old scan here could not fail: every rule it ran needs a node in the a11y tree, and
    // aria-hidden removes them all, so it reported five inapplicable rules and no violations
    // whatever the markup was. Assert it examined something, or do not assert at all.
    const result = await axe.run(container, {
      runOnly: { type: "rule", values: ["aria-hidden-focus", "aria-allowed-attr"] },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
    expect(result.passes.length).toBeGreaterThan(0);
  });
});

describe("what the journey actually draws", () => {
  const chips = () => [...document.querySelectorAll("[data-hop]")] as HTMLElement[];

  it("draws one chip per block that ranked the passage, in the order the graph ran them", () => {
    render(<RankJourney ranks={{ rr: 1, vs: 23, fu: 2 }} order={ORDER} toys={TOYS} />);
    // Keyed by node, so JSON order must not decide what the player reads.
    expect(chips().map((c) => c.textContent)).toEqual(["Vòm Sao #23", "Phễu #2", "Kính lúp #1"]);
  });

  it("marks which way each hop went, so the colour is not the only carrier", () => {
    render(<RankJourney ranks={{ vs: 23, fu: 2, rr: 9 }} order={ORDER} toys={TOYS} />);
    expect(chips().map((c) => c.dataset.hop)).toEqual(["start", "up", "down"]);
  });

  it("draws a block that found nothing as a chip without a number", () => {
    render(<RankJourney ranks={{ vs: 3, bm: null }} order={ORDER} toys={TOYS} />);
    expect(chips()).toHaveLength(2);
    expect(chips()[1]?.textContent).toContain("Tủ ngăn kéo");
    expect(chips()[1]?.textContent).not.toMatch(/#\d/);
  });
});
