import { useId, useState } from "react";

import { CHIP } from "~/components/ui/chip";
import { ChevronDownIcon } from "~/components/ui/icons";

import { fmt } from "./copy";
import type { RunView } from "./run";

/**
 * The price the bill is computed at: the main model's paid-tier text rate, per million tokens.
 * Output includes thinking tokens. Read by hand from the provider's page, which shows no
 * update date, so the card says when it was read; the engine's fallback models cost more or
 * less, and the card prices every case at this rate.
 */
export const PRICE = {
  model: "gemini-3.5-flash-lite",
  input: 0.3,
  output: 2.5,
  checked: "2026-11-02",
  source: "https://ai.google.dev/gemini-api/docs/pricing",
} as const;

const PER_DAY = [100, 1000, 10000] as const;
const DAYS = 30;

const usdFormat = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** One run's tokens, per case, times customers a day, for a 30-day month. */
export function monthlyBill(
  tokens: { in: number; out: number },
  cases: number,
  perDay: number,
): { usd: number; outputShare: number } {
  if (cases === 0) return { usd: 0, outputShare: 0 };
  const input = ((tokens.in / cases) * PRICE.input) / 1e6;
  const output = ((tokens.out / cases) * PRICE.output) / 1e6;
  const perCase = input + output;
  return { usd: perCase * perDay * DAYS, outputShare: perCase > 0 ? output / perCase : 0 };
}

/**
 * Plan v0.7 §4 item 0.4 (course Day 1): "Nhân quy mô". The run's measured tokens become a
 * monthly bill at a chosen number of customers a day. An estimate, labelled as one: real
 * traffic does not ask tonight's questions, and the price can change.
 */
export function ScaleBill({ run }: { run: RunView }) {
  const id = useId();
  const [perDay, setPerDay] = useState<number>(1000);
  const tokens = run.cases.reduce(
    (sum, c) => ({ in: sum.in + c.tokens.in, out: sum.out + c.tokens.out }),
    { in: 0, out: 0 },
  );
  const bill = monthlyBill(tokens, run.cases.length, perDay);
  return (
    <details className="group mt-6 max-w-prose rounded-md border border-line p-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1 font-semibold">
        Nhân quy mô: nếu mỗi ngày có nhiều khách như tối nay
        <ChevronDownIcon />
      </summary>
      <fieldset className="mt-3">
        <legend className="text-sm">Số khách mỗi ngày</legend>
        <div className="mt-2 flex flex-wrap gap-1">
          {PER_DAY.map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-per-day`}
                checked={perDay === n}
                onChange={() => setPerDay(n)}
                className="peer sr-only"
              />
              <span className={CHIP}>{fmt(n)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p
        data-scale-bill=""
        data-per-day={perDay}
        data-usd={bill.usd}
        className="mt-3 text-lg font-bold tabular-nums"
      >
        Khoảng {usdFormat.format(bill.usd)} mỗi tháng
      </p>
      <p className="mt-1 text-sm tabular-nums">
        Phần trả lời (gồm phần nghĩ) chiếm {Math.round(bill.outputShare * 100)} % hoá đơn
        {tokens.out < tokens.in ? ", dù ít token hơn phần đưa vào" : ""}: một token ra đắt gấp{" "}
        {fmt(PRICE.output / PRICE.input)} lần một token vào.
      </p>
      <p className="mt-2 text-xs text-fg-muted">
        Ước tính = token của {run.cases.length} câu tối nay, chia đều mỗi câu, × {fmt(perDay)} khách
        × {DAYS} ngày, theo giá {PRICE.model} ({fmt(PRICE.input)} US$ cho 1 triệu token vào,{" "}
        {fmt(PRICE.output)} US$ cho 1 triệu token ra), tra ngày {PRICE.checked} ở{" "}
        <a href={PRICE.source} className="underline underline-offset-4">
          trang giá của nhà cung cấp
        </a>
        . Khách thật không hỏi đúng các câu tối nay, và giá có thể đổi.
      </p>
    </details>
  );
}
