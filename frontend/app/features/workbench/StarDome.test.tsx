import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("renders one keyboard-reachable star per retrieved passage", () => {
    render(<StarDome items={items()} goldChunks={[]} goldRank={null} showGold />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Điều 53.*hạng 1.*0,8/ })).toBeDefined();
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
    expect(screen.getByRole("button", { name: /hết hiệu lực/ })).toBeDefined();
  });

  it("renders nothing without a retrieved fact", () => {
    const { container } = render(<StarDome items={[]} goldChunks={[]} goldRank={null} showGold />);
    expect(container.innerHTML).toBe("");
  });

  it("reports the passage the player picked", () => {
    const picked: string[] = [];
    render(
      <StarDome
        items={items()}
        goldChunks={[]}
        goldRank={null}
        showGold
        onSelect={(id) => picked.push(id)}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Điều 13/ }));
    expect(picked).toEqual([items()[1]?.chunk_id]);
  });

  it("says the positions are a projection, not real coordinates", () => {
    render(<StarDome items={items()} goldChunks={[]} goldRank={null} showGold />);
    expect(screen.getByText(/hình chiếu/)).toBeDefined();
  });
});
