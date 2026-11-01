import { useEffect, useRef, useState } from "react";

import { PROJECTOR_SHARE } from "~/features/projector/projector";

import { claimRefund, fetchQuota } from "./api";
import { QUOTA_VI } from "./copy";
import type { Slip } from "./guess";
import {
  credit,
  loadLedger,
  loadRefundMarks,
  openMode,
  refundClaim,
  remaining,
  resetsAtLabel,
  saveLedger,
  saveRefundMarks,
  shiftCost,
  spend,
  utcDay,
  type OpenMode,
  type Pool,
  type ServerQuota,
} from "./quota";
import { llmCalls, type RunView } from "./run";

export interface QuotaView {
  /** Calls left today; null until the server has been read (no made-up number). */
  left: number | null;
  /** "07:00", in the player's clock. */
  refill: string | null;
  /** The most this Mở ca can cost. */
  cost: number;
  mode: OpenMode;
  /** The outcome of a refund claim, said once. */
  note: string | null;
  /** Whose pool: the learner's, or the projector's own on `?chieu=1` (lesson plan R5). */
  pool: Pool;
  /** The API answered `/api/quota`; false while it sleeps or is down (R6). */
  awake: boolean;
}

/** How often the projector asks again while the API wakes (about a minute on Render, X9). */
export const WAKE_POLL_MS = 10_000;

const terminal = (run: RunView) => run.phase === "finished" || run.phase === "failed";

/**
 * The learner pool beside Mở ca (roadmap-v0.4 §5.1). Charges each of the player's own runs once,
 * by its fresh calls (`llm.replayed = false`) -- a failed run too, since its calls happened --
 * and claims the refund of a level's first sample run when the slip earned it (daily-shift §3.1).
 * The storage is re-read before every write, so a second tab or a new UTC day is never undone.
 */
export function useQuota({
  levelId,
  cases,
  ours,
  samplesCached,
  slipOf,
  projector = false,
}: {
  levelId: string;
  /** Every case of a star run: one call each. */
  cases: number;
  ours: RunView | null;
  /** A sample run of this exact configuration finished in this browser (§3.1). */
  samplesCached: boolean;
  slipOf: (runId: string) => Slip | null;
  /** Projector mode: its own pool of PROJECTOR_SHARE calls, no refunds, and a wake-up poll. */
  projector?: boolean;
}): QuotaView {
  const pool: Pool = projector ? "projector" : "learner";
  const [server, setServer] = useState<ServerQuota | null>(null);
  const [ledger, setLedger] = useState(() => loadLedger(new Date()));
  const [note, setNote] = useState<string | null>(null);
  const charged = useRef(new Set<string>());
  const claimed = useRef(new Set<string>());

  useEffect(() => {
    // Async bodies, not a helper the effect calls: the set happens after the await either way,
    // but this shape is the one the hooks linter can see is not a synchronous set.
    const stop = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      const quota = await fetchQuota(stop.signal);
      if (stop.signal.aborted) return;
      setServer(quota);
      // R6: a lesson usually starts on a sleeping API, so the projector keeps knocking until it
      // answers; a learner's bench asks once and lets Mở ca find out.
      if (quota === null && projector) timer = setTimeout(() => void ask(), WAKE_POLL_MS);
    };
    void ask();
    return () => {
      stop.abort();
      clearTimeout(timer);
    };
  }, [projector]);

  useEffect(() => {
    if (ours === null || !terminal(ours) || charged.current.has(ours.runId)) return;
    charged.current.add(ours.runId);
    const calls = llmCalls(ours).real;
    const next = calls > 0 ? spend(loadLedger(new Date()), pool, calls, "level") : null;
    if (next) saveLedger(next);
    // Both numbers move together once the server has answered, so the line never shows the
    // player's pool already down while the server's still reads the old figure.
    void fetchQuota().then((quota) => {
      setServer(quota);
      if (next) setLedger(next);
    });
  }, [ours, pool]);

  useEffect(() => {
    // The projector's runs are the teacher's demonstration, not a pair's first try: no refund.
    if (projector || ours?.scope !== "mau" || ours.phase !== "finished") return;
    if (claimed.current.has(ours.runId)) return;
    claimed.current.add(ours.runId);
    const marks = loadRefundMarks();
    const today = utcDay(new Date());
    const first = !marks.levels.includes(levelId);
    if (first) saveRefundMarks({ ...marks, levels: [...marks.levels, levelId] });
    if (!refundClaim(ours, slipOf(ours.runId), first, marks.refundedOn === today)) return;
    void claimRefund(ours.runId).then((result) => {
      if (result.ok) {
        saveRefundMarks({ ...loadRefundMarks(), refundedOn: today });
        if (result.refunded === 0) return; // every answer came from the cache: nothing to say
        const next = credit(loadLedger(new Date()), "learner", result.refunded);
        saveLedger(next);
        setLedger(next);
        setNote(QUOTA_VI.refunded(result.refunded));
      } else if (result.code !== null) {
        setNote(result.code === "reserve_empty" ? QUOTA_VI.reserveEmpty : result.message);
      }
    });
  }, [ours, levelId, slipOf, projector]);

  const cost = shiftCost(cases, samplesCached);
  // The projector's share is fixed (R5), so its own count stands even while the API sleeps.
  const left = projector
    ? remaining(ledger, pool, PROJECTOR_SHARE, server?.remaining ?? null)
    : server === null
      ? null
      : remaining(ledger, pool, server.learnerDaily, server.remaining);
  return {
    left,
    refill: server === null ? null : resetsAtLabel(server.resetsAt),
    cost,
    mode: left === null ? "shift" : openMode(left, cost),
    note,
    pool,
    awake: server !== null,
  };
}
