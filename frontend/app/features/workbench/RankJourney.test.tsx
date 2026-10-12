import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RankJourney } from "./RankJourney";

afterEach(cleanup);

const TOYS = { vs: "Vòm Sao", bm: "Tủ ngăn kéo", fu: "Phễu", rr: "Kính lúp" };
const ORDER = ["vs", "bm", "fu", "rr"];

const STORE = { vs: { kind: "corpus" }, bm: { kind: "corpus" } } as const;

describe("RankJourney", () => {
  it("renders nothing when no block ranked anything", () => {
    const { container } = render(<RankJourney ranks={{}} order={ORDER} toys={TOYS} />);
    expect(container.innerHTML).toBe("");
  });

  it("stays out of the a11y tree: the prose list beside it is the readable version", () => {
    // GoldTrace prints the same ranks in words, with the scale each was taken on (§8.6). A
    // second, scale-free reading of them would be duplicate and worse, so the chips are the
    // picture only -- and nothing of this component reaches a screen reader.
    const { container } = render(
      <RankJourney ranks={{ vs: 23, bm: 1 }} order={ORDER} toys={TOYS} scales={STORE} />,
    );
    expect(container.querySelector("ol")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".sr-only")).toBeNull();
  });
});

describe("what the journey actually draws", () => {
  const chips = () => [...document.querySelectorAll("[data-hop]")] as HTMLElement[];

  it("draws one chip per block that ranked the passage, in the order the graph ran them", () => {
    render(<RankJourney ranks={{ rr: 1, vs: 23, fu: 2 }} order={ORDER} toys={TOYS} />);
    // Keyed by node, so JSON order must not decide what the player reads.
    expect(chips().map((c) => c.textContent)).toEqual(["Vòm Sao #23", "Phễu #2", "Kính lúp #1"]);
  });

  it("says a block never found the passage instead of showing a number it does not have", () => {
    render(<RankJourney ranks={{ vs: null, bm: 1 }} order={ORDER} toys={TOYS} scales={STORE} />);
    expect(chips()[0]?.textContent).toContain("không thấy");
  });

  it("marks a hop with an arrow as well as a colour, for the two blocks that share a ruler", () => {
    render(<RankJourney ranks={{ vs: 23, bm: 2 }} order={ORDER} toys={TOYS} scales={STORE} />);
    expect(chips().map((c) => c.dataset.hop)).toEqual(["start", "up"]);
    expect(chips()[1]?.textContent).toContain("↑");
  });

  it("will not draw a move between two blocks that counted different populations", () => {
    // hạng 23 over the whole store, then hạng 2 inside the 3 passages Kính lúp kept: the
    // passage is better off, but the two numbers are not points on one ruler.
    render(
      <RankJourney
        ranks={{ vs: 23, rr: 2 }}
        order={ORDER}
        toys={TOYS}
        scales={{ vs: { kind: "corpus" }, rr: { kind: "kept", size: 3 } }}
      />,
    );
    expect(chips().map((c) => c.dataset.hop)).toEqual(["start", "rescaled"]);
    expect(chips()[1]?.textContent).not.toContain("↑");
    // Neither tint: a rescaled hop must look like neither a rise nor a fall.
    expect(chips()[1]?.className).not.toContain("success");
    expect(chips()[1]?.className).not.toContain("danger");
  });

  it("claims no move at all when it was not told the scales", () => {
    render(<RankJourney ranks={{ vs: 23, bm: 2 }} order={ORDER} toys={TOYS} />);
    expect(chips()[1]?.dataset.hop).toBe("rescaled");
  });
});
