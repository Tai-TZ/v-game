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

  it("answers axe's structural rules", async () => {
    const { container } = render(
      <RankJourney ranks={{ vs: 23, rr: 1 }} order={ORDER} toys={TOYS} />,
    );
    const result = await axe.run(container, {
      runOnly: {
        type: "rule",
        values: ["list", "listitem", "aria-required-children", "aria-allowed-role", "role-img-alt"],
      },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
