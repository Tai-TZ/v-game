import { CONFIDENCE_VI } from "./copy";
import { CONFIDENCE, type Confidence } from "./guess";
import type { RunMark } from "./storage";

export interface CalibrationRow {
  confidence: Confidence;
  right: number;
  total: number;
}

/** Every remembered bet, added up by how sure the player was, least sure first. */
export function calibration(runs: readonly RunMark[]): CalibrationRow[] {
  return CONFIDENCE.flatMap((confidence) => {
    const bets = runs.flatMap((run) => run.bets ?? []).filter((b) => b.confidence === confidence);
    if (bets.length === 0) return [];
    return [{ confidence, right: bets.filter((b) => b.right).length, total: bets.length }];
  });
}

/**
 * Plan v0.7 2.4: each level of sureness next to how often it was right, the external standard
 * that helps calibration (Janssen & Lazonder 2024). One series, so one colour and no legend; the
 * numbers are in the text, the bar only lets the rows be compared at a glance.
 */
export function Calibration({ runs }: { runs: readonly RunMark[] }) {
  const rows = calibration(runs);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="wb-calibration" className="mt-6 max-w-prose">
      <h4 id="wb-calibration" className="font-semibold">
        Độ chắc so với kết quả
      </h4>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li
            key={row.confidence}
            data-confidence={row.confidence}
            data-right={row.right}
            data-total={row.total}
            className="text-sm tabular-nums"
          >
            <p>
              {CONFIDENCE_VI[row.confidence]}: đúng {row.right}/{row.total} lần
            </p>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 4"
              preserveAspectRatio="none"
              className="mt-1 h-1.5 w-full"
            >
              <rect width="100" height="4" className="fill-subtle" />
              <rect
                data-share=""
                width={(row.right / row.total) * 100}
                height="4"
                className="fill-brand"
              />
            </svg>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-muted">
        Cộng các câu mẫu bạn đã cược trong những lượt gần đây. Ít lượt thì con số dao động mạnh.
      </p>
    </section>
  );
}
