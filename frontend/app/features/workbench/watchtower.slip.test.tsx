import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EMPTY_SLIP, W1_ATTACKS, type Slip } from "./guess";
import { GuessSlip, SlipResult } from "./GuessSlip";
import { levelFile, parseSse, readText, replay, testEnv } from "./test-fixtures";

/** The W1 questions on the guess slip (watchtower.md §3.6), drawn and graded. */

afterEach(cleanup);

const W1 = "direct-injection";
const env = testEnv(W1);
const run = () => {
  const view = replay(parseSse(readText("e2e", "data", "run-w1-reference.sse")));
  if (!view) throw new Error("the W1 reference run does not replay");
  return view;
};

describe("the W1 slip", () => {
  it("names the attacks the level requires stopped", () => {
    expect(W1_ATTACKS).toEqual(levelFile(W1).rules.s1_required);
  });

  it("draws both questions and records the pick", () => {
    const seen: Slip[] = [];
    render(<GuessSlip env={env} slip={EMPTY_SLIP} onChange={(next) => seen.push(next)} />);
    const asks = [...document.querySelectorAll("[data-ask]")].map((el) =>
      el.getAttribute("data-ask"),
    );
    expect(asks).toEqual(["net_catches", "blocks_customer"]);
    const net = document.querySelector<HTMLElement>('[data-ask="net_catches"]');
    if (!net) throw new Error("the net question is not drawn");
    fireEvent.click(within(net).getByRole("radio", { name: "2" }));
    expect(seen.at(-1)?.asks).toEqual({ net_catches: 2 });
  });

  it("marks the question the player picked", () => {
    render(
      <GuessSlip
        env={env}
        slip={{ ...EMPTY_SLIP, asks: { blocks_customer: 1 } }}
        onChange={() => undefined}
      />,
    );
    const ask = document.querySelector<HTMLElement>('[data-ask="blocks_customer"]');
    if (!ask) throw new Error("the customer question is not drawn");
    const radio = (name: string) => within(ask).getByRole<HTMLInputElement>("radio", { name });
    expect(radio("Có").checked).toBe(true);
    expect(radio("Không").checked).toBe(false);
  });

  it("tells a right guess from a wrong one after the run, from the run's own facts", () => {
    // In the reference run the net stops one attack alone (the admin role-play); the dog and the
    // bell take the rest. It stops no customer.
    const slip: Slip = { ...EMPTY_SLIP, asks: { net_catches: 3, blocks_customer: 0 } };
    render(<SlipResult slip={slip} run={run()} levelId={W1} />);
    const net = document.querySelector('[data-ask-result="net_catches"]');
    const customer = document.querySelector('[data-ask-result="blocks_customer"]');
    expect(net?.getAttribute("data-right")).toBe("false");
    expect(net?.textContent).toContain("Bạn đoán 3; thực tế 1");
    expect(customer?.getAttribute("data-right")).toBe("true");
    expect(customer?.textContent).toContain("Khớp");
  });

  it("shows nothing about a question the player skipped", () => {
    render(<SlipResult slip={{ ...EMPTY_SLIP, passed: 12 }} run={run()} levelId={W1} />);
    expect(document.querySelector("[data-ask-result]")).toBeNull();
  });
});
