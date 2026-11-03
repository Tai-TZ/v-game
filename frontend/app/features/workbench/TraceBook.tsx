import { useEffect, useId, useRef, useState } from "react";

import { buttonClass } from "~/components/ui/button";

import type { Env } from "./bench";
import { hasControls } from "./BenchView";
import { diagnosisTarget, groupDiagnosis, TOY } from "./copy";
import { unfinished, type CaseView, type RunView } from "./run";
import { caseTitle } from "./RunPanel";
import type { BlockType, Graph, RunReport } from "./schema";

/**
 * Plan v0.7 2.3, the trace book: before the diagnosis, the player ties each failed case to the
 * slot that caused it, from a closed menu. The book only ever says whether all three rows are
 * right at once. A mark per row would let the answer be found by elimination, which is
 * guessing, not tracing.
 */

/** Rows per book. Fewer failed cases than this can be found by trying, so there is no book. */
export const TRACE_ROWS = 3;

export interface TraceRow {
  c: CaseView;
  /** Every slot the diagnosis blames for this case: a case under two flags has two answers. */
  right: ReadonlySet<BlockType>;
}

/**
 * The cases to trace: failed in a star run, each blamed on a slot the player can touch, the
 * answer being where the diagnosis's own "Xem ở …" would go. Cases with a new set of slots go
 * first, so the three rows are not one lesson three times when the run offers more.
 */
export function traceRows(
  env: Env,
  run: RunView,
  gold: RunReport["gold"] | undefined,
  graph: Graph | null,
): TraceRow[] {
  if (run.scope !== undefined || run.phase !== "finished" || !run.report) return [];
  const right = new Map<string, Set<BlockType>>();
  for (const group of groupDiagnosis(run.report.diagnosis)) {
    const target = diagnosisTarget(env, group, gold, graph);
    if (!target || !hasControls(env, target.slot)) continue;
    for (const id of group.cases) {
      const slots = right.get(id) ?? new Set<BlockType>();
      slots.add(target.slot);
      right.set(id, slots);
    }
  }
  const skipped = new Set(unfinished(run).map((c) => c.id));
  const candidates = run.cases.flatMap((c) => {
    const slots = right.get(c.id);
    return slots && c.graded && !c.graded.passed && !skipped.has(c.id) ? [{ c, right: slots }] : [];
  });
  if (candidates.length < TRACE_ROWS) return [];
  const seen = new Set<string>();
  const fresh = candidates.filter((row) => {
    const key = [...row.right].sort().join();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rest = candidates.filter((row) => !fresh.includes(row));
  return [...fresh, ...rest].slice(0, TRACE_ROWS).sort((a, b) => a.c.n - b.c.n);
}

/** The closed menu: the level's slots with something to turn, in the level's own order. */
export function traceOptions(env: Env): BlockType[] {
  return env.level.allowed_blocks.filter((type) => hasControls(env, type));
}

type Verdict = "incomplete" | "wrong" | "right";

export function TraceBook({
  env,
  rows,
  onSolved,
  onSkip,
}: {
  env: Env;
  rows: readonly TraceRow[];
  /** All rows right; the number of counted checks it took. */
  onSolved: (checks: number) => void;
  onSkip: () => void;
}) {
  const id = useId();
  const options = traceOptions(env);
  const [picks, setPicks] = useState<Readonly<Record<string, BlockType>>>({});
  const [checks, setChecks] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (verdict !== null) feedback.current?.focus();
  }, [verdict, checks]);
  const solved = verdict === "right";

  const check = () => {
    if (rows.some((row) => picks[row.c.id] === undefined)) {
      setVerdict("incomplete");
      return;
    }
    const count = checks + 1;
    setChecks(count);
    const allRight = rows.every((row) => {
      const pick = picks[row.c.id];
      return pick !== undefined && row.right.has(pick);
    });
    setVerdict(allRight ? "right" : "wrong");
    if (allRight) onSolved(count);
  };

  return (
    <fieldset className="mt-3 max-w-prose rounded-md border border-line p-4">
      <legend className="px-1 font-semibold">Sổ truy vết</legend>
      <p className="text-sm text-fg-muted">
        Gắn mỗi câu trượt với món gây ra lỗi. Sổ chỉ báo khi cả {rows.length} dòng cùng đúng, không
        báo dòng nào sai.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.c.id} data-trace-row="" data-case={row.c.id}>
            <label htmlFor={`${id}-${row.c.id}`} className="block text-sm font-semibold">
              Câu {caseTitle(row.c, env.level.id)}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-x-4">
              <select
                id={`${id}-${row.c.id}`}
                value={picks[row.c.id] ?? ""}
                disabled={solved}
                onChange={(event) => {
                  const value = event.target.value as BlockType | "";
                  setPicks((now) => {
                    const others = Object.fromEntries(
                      Object.entries(now).filter(([key]) => key !== row.c.id),
                    );
                    return value === "" ? others : { ...others, [row.c.id]: value };
                  });
                }}
                className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm"
              >
                <option value="">Chọn món…</option>
                {options.map((type) => (
                  <option key={type} value={type}>
                    {TOY[type].name}
                  </option>
                ))}
              </select>
              <a
                href={`#cau-${row.c.n}`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4"
              >
                Xem câu #{row.c.n}
              </a>
            </div>
          </li>
        ))}
      </ul>
      {!solved && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" onClick={check} className={buttonClass("secondary")}>
            Kiểm tra sổ
          </button>
          <button type="button" onClick={onSkip} className={buttonClass("inline")}>
            Bỏ qua, xem chẩn đoán
          </button>
        </div>
      )}
      {verdict && (
        <p
          ref={feedback}
          tabIndex={-1}
          data-trace-verdict={verdict}
          className="mt-2 text-sm font-semibold"
        >
          {verdict === "incomplete"
            ? "Chọn món cho mọi dòng rồi hãy kiểm."
            : verdict === "wrong"
              ? `Chưa đúng cả ${rows.length} dòng (lần kiểm thứ ${checks}). Đổi một dòng rồi kiểm lại.`
              : `Đúng cả ${rows.length} dòng sau ${checks} lần kiểm. Chẩn đoán ở ngay dưới.`}
        </p>
      )}
    </fieldset>
  );
}
