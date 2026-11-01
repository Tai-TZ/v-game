import * as v from "valibot";

import type { Slip } from "./guess";
import { sampleVerdict, type RunView } from "./run";

/**
 * The daily pool of fresh AI calls (roadmap-v0.4 §5.1, daily-shift §3). A soft promise kept in
 * this browser until accounts exist (T1, T2): the hard ceiling is the server's DailyCap, which
 * is why the number shown is the smaller of the two. Every storage access is wrapped -- a
 * blocked or cleared store reads as a full pool.
 */

export type Pool = "learner" | "projector";
export type Spend = "level" | "shift";

export interface Ledger {
  /** UTC date: the pool refills at 00:00 UTC, with the server's DailyCap. */
  day: string;
  pools: Record<Pool, { used: number; refunded: number }>;
  /** Only to show what the day went on (X26); `pools` is what the pool reads. */
  spent: Record<Spend, number>;
}

/** The three visible cases a sample run grades (N2). */
export const SAMPLE_CALLS = 3;

const LEDGER_KEY = "vg.quota.v1";
const REFUND_KEY = "vg.refund.v1";

export const utcDay = (now: Date) => now.toISOString().slice(0, 10);

const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const PoolSchema = v.object({ used: Count, refunded: Count });
const LedgerSchema = v.object({
  day: v.string(),
  pools: v.object({ learner: PoolSchema, projector: PoolSchema }),
  spent: v.object({ level: Count, shift: Count }),
});

const fresh = (day: string): Ledger => ({
  day,
  pools: { learner: { used: 0, refunded: 0 }, projector: { used: 0, refunded: 0 } },
  spent: { level: 0, shift: 0 },
});

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Today's ledger: yesterday's, a missing one or an unreadable one all start full. */
export function loadLedger(now: Date): Ledger {
  const day = utcDay(now);
  const parsed = v.safeParse(LedgerSchema, readJson(LEDGER_KEY));
  return parsed.success && parsed.output.day === day ? parsed.output : fresh(day);
}

export const saveLedger = (ledger: Ledger) => writeJson(LEDGER_KEY, ledger);

/** The ledger after `calls` fresh calls were spent from `pool` on `what`. */
export function spend(ledger: Ledger, pool: Pool, calls: number, what: Spend): Ledger {
  const p = ledger.pools[pool];
  return {
    ...ledger,
    pools: { ...ledger.pools, [pool]: { ...p, used: p.used + calls } },
    spent: { ...ledger.spent, [what]: ledger.spent[what] + calls },
  };
}

/** The ledger after a refund the server granted landed back in `pool`. */
export function credit(ledger: Ledger, pool: Pool, calls: number): Ledger {
  const p = ledger.pools[pool];
  return { ...ledger, pools: { ...ledger.pools, [pool]: { ...p, refunded: p.refunded + calls } } };
}

/**
 * Calls left in `pool` today: its share less what was spent, plus refunds -- capped by what the
 * server itself has left (daily-shift §3.3), which is the true number when one learner plays on
 * two browsers. `server` is null when the API could not be asked.
 */
export function remaining(ledger: Ledger, pool: Pool, share: number, server: number | null) {
  const p = ledger.pools[pool];
  const mine = Math.max(0, share - p.used + p.refunded);
  return server === null ? mine : Math.max(0, Math.min(mine, server));
}

/**
 * The most Mở ca can cost: one call per case. Only the samples of a sample run of this very
 * configuration, finished in this browser, are known to come back from the replay cache.
 */
export const shiftCost = (cases: number, samplesCached: boolean) =>
  samplesCached ? cases - SAMPLE_CALLS : cases;

/** What the run button offers: the whole shift, the 3 samples alone, or the recorded run. */
export type OpenMode = "shift" | "sample" | "recorded";

export function openMode(left: number, cost: number): OpenMode {
  if (left >= cost) return "shift";
  return left >= SAMPLE_CALLS ? "sample" : "recorded";
}

// --- GET /api/quota ---------------------------------------------------------------------------

const QuotaSchema = v.object({
  remaining: Count,
  resets_at: v.string(),
  learner_daily: Count,
});

export interface ServerQuota {
  remaining: number;
  resetsAt: string;
  learnerDaily: number;
}

export function parseQuota(raw: unknown): ServerQuota | null {
  const parsed = v.safeParse(QuotaSchema, raw);
  if (!parsed.success) return null;
  const { remaining, resets_at, learner_daily } = parsed.output;
  return { remaining, resetsAt: resets_at, learnerDaily: learner_daily };
}

/** "07:00": the refill in the player's own clock, or null for a time that does not parse. */
export function resetsAtLabel(at: string): string | null {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return null;
  return `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
}

// --- Refund (daily-shift §3.1, "Hoàn lượt khi đoán chắc và sửa đạt ngay") ---------------------

export interface RefundMarks {
  /** Levels whose first sample run has happened in this browser: only that one can refund. */
  levels: string[];
  /** UTC day of the last refund: one a day per learner. */
  refundedOn: string | null;
}

const RefundSchema = v.object({ levels: v.array(v.string()), refundedOn: v.nullable(v.string()) });

export function loadRefundMarks(): RefundMarks {
  const parsed = v.safeParse(RefundSchema, readJson(REFUND_KEY));
  return parsed.success ? parsed.output : { levels: [], refundedOn: null };
}

export const saveRefundMarks = (marks: RefundMarks) => writeJson(REFUND_KEY, marks);

/**
 * Whether this finished run earns a refund claim: the level's first sample run, all 3 samples
 * passed, and the player bet "chắc" on every sample and was right. The server checks the run's
 * scope and results again; the first-run and once-a-day rules are the client's to keep.
 */
export function refundClaim(
  run: RunView,
  slip: Slip | null,
  firstSample: boolean,
  refundedToday: boolean,
): boolean {
  if (!firstSample || refundedToday || slip === null) return false;
  if (sampleVerdict(run) !== "passed") return false;
  return run.cases.every((c) => {
    const bet = slip.bets[c.id];
    return bet?.confidence === "high" && bet.pass === c.graded?.passed;
  });
}
