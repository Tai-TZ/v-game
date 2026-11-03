import { loadHints } from "~/features/workbench/hints";
import { loadHistory } from "~/features/workbench/storage";

/**
 * Plan v0.7 1.3: what this browser already keeps about a session, as one CSV the learner
 * downloads and hands in. Nothing is sent anywhere. The one link to a paper test is a random
 * six-character code the learner copies onto it: no name, no graph, no question, no free text.
 */

const CODE_KEY = "vg.session.v1";
// No 0/O, 1/I: the code is copied by hand onto paper.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** The browser's session code, made on first use and kept. */
export function sessionCode(): string {
  try {
    const kept = window.localStorage.getItem(CODE_KEY);
    if (kept && /^[A-HJ-NP-Z2-9]{6}$/.test(kept)) return kept;
  } catch {
    /* blocked storage: a fresh code for this page */
  }
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  try {
    window.localStorage.setItem(CODE_KEY, code);
  } catch {
    /* still usable for this download */
  }
  return code;
}

export const CSV_COLUMNS = [
  "code",
  "level",
  "kind",
  "at",
  "stars",
  "tokens",
  "budget",
  "passed",
  "cases",
  "why",
  "next",
  "hint_target",
  "star",
  "hint_n",
  "principle",
  "right",
] as const;

export type SessionRow = Partial<Record<(typeof CSV_COLUMNS)[number], string | number>> & {
  code: string;
  level: string;
  kind: "run" | "hint" | "principle";
  at: number;
};

/** Levels this browser holds history or hints for, from the storage keys themselves. */
function levelsWithData(): string[] {
  const levels = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i) ?? "";
      const match = /^vg\.(?:history|hints)\.v1\.(.+)$/.exec(key);
      if (match?.[1]) levels.add(match[1]);
    }
  } catch {
    /* blocked storage: nothing to export */
  }
  return [...levels].sort();
}

/** One row per scored run, per opened hint and per principle pick, every level, oldest first. */
export function sessionRows(code: string): SessionRow[] {
  const rows: SessionRow[] = [];
  for (const level of levelsWithData()) {
    for (const run of loadHistory(level)) {
      rows.push({
        code,
        level,
        kind: "run",
        at: run.at,
        stars: run.stars,
        tokens: run.tokens,
        budget: run.budget,
        passed: run.cases.filter((c) => c.passed).length,
        cases: run.cases.length,
        ...(run.why !== undefined && { why: run.why }),
        ...(run.next && { next: `${run.next.type}:${run.next.direction}` }),
      });
    }
    for (const hint of loadHints(level).log) {
      rows.push({
        code,
        level,
        kind: "hint",
        at: hint.at,
        hint_target: hint.target,
        star: hint.star,
        hint_n: hint.n,
      });
    }
    // Plan v0.7 2.2: every "nguyên lý nào?" answer, as a key from a closed list; 1 is right.
    for (const pick of loadHints(level).picks) {
      rows.push({
        code,
        level,
        kind: "principle",
        at: pick.at,
        hint_target: pick.target,
        hint_n: pick.n,
        principle: pick.pick,
        right: pick.right ? 1 : 0,
      });
    }
  }
  return rows.sort((a, b) => a.at - b.at);
}

const cell = (value: string | number | undefined) => {
  if (value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(rows: readonly SessionRow[]): string {
  const lines = rows.map((row) => CSV_COLUMNS.map((column) => cell(row[column])).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\n") + "\n";
}
