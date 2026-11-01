import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QUOTA_VI } from "./copy";
import type { Slip } from "./guess";
import { loadLedger, loadRefundMarks } from "./quota";
import type { CaseView, RunView } from "./run";
import { useQuota } from "./useQuota";

const LEVEL = "grounded-citation";
const SERVER = {
  cap: 500,
  used: 0,
  remaining: 480,
  resets_at: "2026-11-02T00:00:00+00:00",
  estimate: true,
  reserve_left: 17,
  learner_daily: 13,
};

interface Reply {
  status: number;
  body: unknown;
}
let quotaReply: Reply;
let refundReply: Reply;
const fetchMock = vi.fn((url: string) => {
  const reply = url.endsWith("/api/quota/refund") ? refundReply : quotaReply;
  return Promise.resolve(
    new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

beforeEach(() => {
  quotaReply = { status: 200, body: SERVER };
  refundReply = { status: 200, body: { run_id: "r1", refunded: 3, reserve_left: 14 } };
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const graded = (n: number, fresh: boolean): CaseView => ({
  id: `c${n}`,
  n,
  role: "visible",
  vai: "",
  state: "graded",
  steps: {
    llm: {
      block: "llm",
      state: "done",
      facts: [{ kind: "llm", cited_ids: [], replayed: !fresh, model: "m", system_tokens: 0 }],
    },
  },
  tokens: { in: 0, out: 0 },
  graded: { status: "ok", passed: true, counted: true, criteria: {}, labels: [] },
});

const finished = (runId: string, fresh: boolean[], scope?: "mau"): RunView => ({
  runId,
  lastSeq: 0,
  stream: "closed",
  phase: "finished",
  ingestion: [],
  cases: fresh.map((f, i) => graded(i + 1, f)),
  ...(scope && { scope }),
});

const sureOnAll: Slip = {
  passed: null,
  failing: [],
  bets: Object.fromEntries(
    ["c1", "c2", "c3"].map((id) => [id, { pass: true, confidence: "high" as const }]),
  ),
};

function setup(initial: RunView | null, slip: Slip | null = null) {
  return renderHook(
    (props: { ours: RunView | null }) =>
      useQuota({
        levelId: LEVEL,
        cases: 10,
        ours: props.ours,
        samplesCached: false,
        slipOf: () => slip,
      }),
    { initialProps: { ours: initial } },
  );
}

describe("useQuota", () => {
  it("shows the server's share less nothing spent, and the refill time", async () => {
    const { result } = setup(null);
    await waitFor(() => expect(result.current.left).toBe(13));
    expect(result.current.mode).toBe("shift");
    expect(result.current.cost).toBe(10);
    expect(result.current.refill).not.toBeNull();
  });

  it("charges a run's fresh calls once, however often it re-renders", async () => {
    const run = finished("r9", [true, true, false]);
    const { result, rerender } = setup(run);
    await waitFor(() => expect(result.current.left).toBe(11));
    rerender({ ours: { ...run } });
    rerender({ ours: run });
    await waitFor(() => expect(loadLedger(new Date()).pools.learner.used).toBe(2));
    expect(result.current.left).toBe(11);
  });

  it("drops to the samples alone when the pool no longer covers the shift", async () => {
    const { result } = setup(finished("r9", Array<boolean>(5).fill(true)));
    await waitFor(() => expect(result.current.left).toBe(8));
    expect(result.current.mode).toBe("sample");
  });

  it("shows no number while the server cannot be read", async () => {
    quotaReply = { status: 503, body: {} };
    const { result } = setup(null);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.left).toBeNull();
    expect(result.current.mode).toBe("shift");
  });

  it("claims the first sample run's refund when every sure bet was right", async () => {
    const { result } = setup(finished("r1", [true, true, true], "mau"), sureOnAll);
    await waitFor(() => expect(result.current.note).toBe(QUOTA_VI.refunded(3)));
    expect(loadLedger(new Date()).pools.learner).toEqual({ used: 3, refunded: 3 });
    expect(loadRefundMarks().refundedOn).not.toBeNull();
    await waitFor(() => expect(result.current.left).toBe(13));
  });

  it("does not claim without the sure bets", async () => {
    setup(finished("r1", [true, true, true], "mau"), null);
    await waitFor(() => expect(loadRefundMarks().levels).toEqual([LEVEL]));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/refund"))).toBe(false);
  });

  it("claims only the level's first sample run", async () => {
    window.localStorage.setItem(
      "vg.refund.v1",
      JSON.stringify({ levels: [LEVEL], refundedOn: null }),
    );
    setup(finished("r2", [true, true, true], "mau"), sureOnAll);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/refund"))).toBe(false);
  });

  it("says the class reserve ran out in the spec's words, not the server's", async () => {
    refundReply = {
      status: 409,
      body: { code: "reserve_empty", detail: "Quỹ hoàn chung của lớp hôm nay đã hết." },
    };
    const { result } = setup(finished("r1", [true, true, true], "mau"), sureOnAll);
    await waitFor(() => expect(result.current.note).toBe(QUOTA_VI.reserveEmpty));
    expect(loadLedger(new Date()).pools.learner.refunded).toBe(0);
  });

  it("passes on the server's own sentence for any other refusal", async () => {
    refundReply = {
      status: 409,
      body: { code: "already_refunded", detail: "Lượt này đã được hoàn rồi." },
    };
    const { result } = setup(finished("r1", [true, true, true], "mau"), sureOnAll);
    await waitFor(() => expect(result.current.note).toBe("Lượt này đã được hoàn rồi."));
  });
});
