import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Fact } from "./schema";
import { StarDome } from "./StarDome";
import { readText } from "./test-fixtures";

type RetrievedItem = Extract<Fact, { kind: "retrieved" }>["items"][number];

function retrievedOf(level: string, caseId: string, node: string): RetrievedItem[] {
  const run = JSON.parse(readText("public", "runs", `${level}.json`)) as {
    events: { type: string; case?: string; node?: string; facts?: Fact[] }[];
  };
  const step = run.events.find(
    (e) => e.type === "step.finished" && e.case === caseId && e.node === node,
  );
  const fact = step?.facts?.find(
    (f): f is Extract<Fact, { kind: "retrieved" }> => f.kind === "retrieved",
  );
  if (!fact) throw new Error(`no retrieved fact for ${caseId}/${node}`);
  return fact.items;
}

const items = () => retrievedOf("article-number-lookup", "lib-l3-v01", "vs");
const GOLD = "f22a1df7";

afterEach(cleanup);

describe("StarDome", () => {
  it("lists every retrieved passage with its real numbers for a screen reader", () => {
    render(<StarDome items={items()} goldChunks={[]} goldRank={null} showGold />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // Three decimals: the L3 cosines differ by 0,005, and at two they all read "0,8", so the
    // numbers could not contradict the picture even when the picture was wrong.
    expect(screen.getByText(/Điều 53.*hạng 1.*0,803/)).toBeDefined();
    expect(screen.getByText(/Điều 13.*0,800/)).toBeDefined();
  });

  it("names the picture by what it shows", () => {
    render(<StarDome items={items()} goldChunks={[GOLD]} goldRank={72} showGold />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "3 đoạn đã kéo, đoạn đáp án ở hạng 72",
    );
  });

  it("says nothing about an answer passage for a hidden or trap case", () => {
    render(<StarDome items={items()} goldChunks={[GOLD]} goldRank={72} showGold={false} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("3 đoạn đã kéo");
    expect(screen.queryByText(/đáp án/)).toBeNull();
  });

  it("says a passage is out of force", () => {
    const stale = items().map((i, n) => (n === 0 ? { ...i, hieu_luc: false } : i));
    render(<StarDome items={stale} goldChunks={[]} goldRank={null} showGold />);
    expect(screen.getByText(/hết hiệu lực/)).toBeDefined();
  });

  it("renders nothing without a retrieved fact", () => {
    const { container } = render(<StarDome items={[]} goldChunks={[]} goldRank={null} showGold />);
    expect(container.innerHTML).toBe("");
  });

  it("says so when this block never ranked the answer passage", () => {
    // ranks[node] is null: the passage exists, this block's ranking does not contain it.
    // Drawing nothing and saying nothing leaves the player to guess which it was.
    render(<StarDome items={items()} goldChunks={[GOLD]} goldRank={null} showGold />);
    expect(screen.getByText(/không tìm thấy đoạn đáp án/)).toBeDefined();
  });

  it("says what the positions mean, so the drawing is not read as a measurement", () => {
    render(<StarDome items={items()} goldChunks={[]} goldRank={null} showGold />);
    expect(screen.getByText(/Vị trí sao theo hạng/)).toBeDefined();
  });
});
