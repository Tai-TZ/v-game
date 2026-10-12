import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { Blade } from "./Blade";
import { CitationLedger } from "./CitationLedger";
import { ContextBin } from "./ContextBin";
import { Stamps } from "./Stamps";
import { StarDome } from "./StarDome";

afterEach(cleanup);

/**
 * axe in jsdom over the toys. The Playwright a11y suite is the real gate, but it runs only in
 * CI and twice today it was the only thing that caught a structural mistake — the last one a
 * role="img" on a <ul>, which orphaned every <li>. These rules need no layout, so jsdom can
 * answer them in milliseconds, right where the component is written.
 */
const STRUCTURAL = [
  "list",
  "th-has-data-cells",
  "td-headers-attr",
  "scope-attr-valid",
  "listitem",
  "aria-required-children",
  "aria-required-parent",
  "aria-allowed-role",
  "aria-allowed-attr",
  "aria-valid-attr-value",
  "image-alt",
  "role-img-alt",
  "nested-interactive",
];

async function violations(node: Element) {
  const result = await axe.run(node, { runOnly: { type: "rule", values: STRUCTURAL } });
  // An empty violations list means nothing only if a rule actually matched something. Put
  // aria-hidden on the subtree, or role="img" on a list, and every structural rule becomes
  // inapplicable -- which reads exactly like a pass. Fail loudly instead.
  expect(result.passes.length).toBeGreaterThan(0);
  return result.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`);
}

const items = [
  {
    chunk_id: "ab12cd34",
    rank: 1,
    score: 0.8,
    doc_id: "qcdt-2024",
    dieu: 12,
    khoan: [2],
    hieu_luc: true,
  },
];

describe("the toys answer axe's structural rules", () => {
  it("Stamps", async () => {
    const { container } = render(
      <Stamps answer="Nộp đơn [ab12cd34]. Không rõ." included={["ab12cd34"]} />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("ContextBin", async () => {
    const { container } = render(
      <ContextBin
        tokens={{ docs: 600, query: 40, total: 640, budget: 3000 }}
        included={["ab12cd34"]}
        dropped={["zz"]}
        promptTokens={600}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("Blade", async () => {
    const { container } = render(
      <Blade variant="co_dinh-128-0" chunks={115} avgTokens={128} split />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("StarDome", async () => {
    const { container } = render(
      <StarDome items={items} goldChunks={["ab12cd34"]} goldRank={1} showGold />,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("the citation ledger answers the table rules too", async () => {
    // A <table> brings its own structural rules: a row header with no data cells, a bad scope,
    // or headers pointing at nothing are all invisible to the list rules above.
    const { container } = render(
      <CitationLedger
        caseRole="visible"
        ranked={items}
        included={["ab12cd34"]}
        cited={["ab12cd34", "zz99zz99"]}
        gold={{ chunks: ["ab12cd34"], ranks: {}, flags: [], visible: true }}
      />,
    );
    expect(await violations(container)).toEqual([]);
  });
});
