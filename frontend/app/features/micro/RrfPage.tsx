import { useId, useState } from "react";

import { CheckIcon } from "~/components/ui/icons";

import { CheckRow, GradeBox, MicroFrame, useStartOver, VerdictLine } from "./MicroFrame";
import {
  ANSWER,
  chipValue,
  FUSED,
  gradeOrder,
  LISTS,
  PASSAGES,
  rawSumOrder,
  RRF,
  RRF_K,
  type Chip,
  type ListId,
  type OrderGrade,
} from "./rrf";

const number = (digits: number) =>
  new Intl.NumberFormat("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** Each list's raw score at the precision it is written with: 0,82 and 14,3. */
const RAW: Readonly<Record<ListId, Intl.NumberFormat>> = {
  vom_sao: number(2),
  tu_ngan_keo: number(1),
};
/** A Phễu sum: 0,0323. Four decimals, since the sums of two chips differ in the fourth. */
const SUM = number(4);
const RAW_SUM = number(2);

const passage = (id: string) => PASSAGES.find((p) => p.id === id) ?? { id, label: id, gist: "" };
const chipKey = (c: { list: ListId; rank: number }) => `${c.list}:${c.rank}`;
const fraction = (rank: number) => `1/${RRF_K + rank}`;
const TOTAL_CHIPS = LISTS.reduce((n, l) => n + l.hits.length, 0);

/** Each list's best raw score, and what adding them raw would order: the check's contrast. */
const SCALES = LISTS.map((l) => ({ list: l, top: Math.max(...l.hits.map((h) => h.score)) }));
const BIGGER = SCALES.reduce((a, b) => (b.top > a.top ? b : a)).list;
const RAW_ORDER = rawSumOrder(LISTS);

/** The chips a passage holds so far, in list order: the sum as the Phễu adds it up. */
function chipsOf(id: string, dropped: ReadonlySet<string>): Chip[] {
  return LISTS.flatMap((l) => {
    const index = l.hits.findIndex((hit) => hit.passage === id);
    const chip = { list: l.id, rank: index + 1, value: chipValue(index + 1) };
    return index >= 0 && dropped.has(chipKey(chip)) ? [chip] : [];
  });
}

/** Why a passage lands where it does, from the two lists alone: ranks, raw scores, the sum. */
function whyLine(id: string): string {
  const fused = FUSED.find((f) => f.passage === id);
  if (!fused) return "";
  const seen = LISTS.map((l) => {
    const index = l.hits.findIndex((hit) => hit.passage === id);
    const hit = l.hits[index];
    return hit
      ? `${l.name} hạng ${index + 1} (${RAW[l.id].format(hit.score)})`
      : `${l.name} không thấy`;
  });
  const sum = fused.chips.map((c) => fraction(c.rank)).join(" + ");
  return `${seen.join(" · ")}: ${sum} = ${SUM.format(fused.score)}.`;
}

/**
 * `/play/library/vi-mo/tu-tay-tron-rrf`: a 1–3 minute warm-up before L3, the level that brings
 * in Phễu (roadmap X18: optional, never in the way). The player does the fusion block's sum by
 * hand: a 1/(k + rank) chip per row of each list into each passage's sum, then the order out of
 * the Phễu. The check grades the order place by place against `fuseRrf` (rrf.ts) and shows what
 * adding the raw scores would have done instead. No AI call, no star.
 */
export function RrfPage() {
  const id = useId();
  const [dropped, setDropped] = useState<ReadonlySet<string>>(new Set());
  const [order, setOrder] = useState<readonly string[]>([]);
  const [grade, setGrade] = useState<OrderGrade | null>(null);
  const { controls, startOver } = useStartOver<HTMLFieldSetElement>();

  const allDropped = dropped.size === TOTAL_CHIPS;
  const left = !allDropped
    ? `Còn ${TOTAL_CHIPS - dropped.size} chip chưa thả.`
    : gradeOrder(order) === null
      ? `Còn ${PASSAGES.length - order.length} đoạn chưa xếp.`
      : null;

  const toggleChip = (key: string) => {
    const next = new Set(dropped);
    if (!next.delete(key)) next.add(key);
    setDropped(next);
  };
  const togglePlace = (passageId: string) =>
    setOrder(
      order.includes(passageId) ? order.filter((p) => p !== passageId) : [...order, passageId],
    );

  const placed = (passageId: string) => grade?.places.find((p) => p.passage === passageId);

  return (
    <MicroFrame
      lesson={RRF}
      lead={
        <>
          Một sinh viên hỏi: «{RRF.question}» Vòm Sao và Tủ ngăn kéo mỗi bên trả về năm đoạn, chấm
          theo hai thang khác nhau. Trộn hai danh sách bằng tay, như Phễu sẽ làm.
        </>
      }
      how="Thả chip vào phễu, xếp các đoạn từ nặng tới nhẹ, rồi kiểm tra."
    >
      <fieldset ref={controls} disabled={grade !== null} className="mt-8">
        <legend className="sr-only">{RRF.title}</legend>
        <h2 className="text-lg font-semibold">1. Thả chip</h2>
        <p className="mt-1 max-w-prose text-sm text-fg-muted">
          Đoạn ở hạng r của một danh sách nhận một chip nặng 1/({RRF_K} + r): hạng 1 là{" "}
          {fraction(1)}, hạng 5 là {fraction(5)}. Điểm trong bài là số minh hoạ.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {LISTS.map((l) => (
            <section
              key={l.id}
              data-list={l.id}
              aria-labelledby={`${id}-${l.id}`}
              className="rounded-md border border-line bg-surface p-4"
            >
              <h3 id={`${id}-${l.id}`} className="font-semibold">
                {l.name}
              </h3>
              <p className="text-xs text-fg-muted">{l.method}</p>
              <ol className="mt-3 space-y-2">
                {l.hits.map((hit, index) => {
                  const rank = index + 1;
                  const key = chipKey({ list: l.id, rank });
                  const on = dropped.has(key);
                  const p = passage(hit.passage);
                  return (
                    <li
                      key={hit.passage}
                      data-hit={hit.passage}
                      data-rank={rank}
                      className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-x-2"
                    >
                      <span className="font-semibold text-fg-muted tabular-nums">#{rank}</span>
                      <span className="text-sm">
                        <span className="font-semibold">{p.label}</span>
                        <span className="block text-xs text-fg-muted">{p.gist}</span>
                      </span>
                      <span className="text-sm tabular-nums">{RAW[l.id].format(hit.score)}</span>
                      <button
                        type="button"
                        data-chip=""
                        aria-pressed={on}
                        aria-label={`Thả chip ${fraction(rank)} vào ${p.label}`}
                        onClick={() => toggleChip(key)}
                        className={`inline-flex min-h-11 min-w-14 items-center justify-center gap-1 rounded-sm border px-2 text-sm font-semibold tabular-nums disabled:cursor-not-allowed ${
                          on
                            ? "border-line-strong bg-subtle text-fg-muted"
                            : "border-brand bg-surface text-brand hover:bg-brand-tint"
                        }`}
                      >
                        {on && <CheckIcon className="size-3.5 shrink-0" />}
                        {fraction(rank)}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>

        <h2 className="mt-8 text-lg font-semibold">2. Xếp phễu</h2>
        <p className="mt-1 max-w-prose text-sm text-fg-muted">
          Phễu cộng các chip của mỗi đoạn. Bấm lần lượt từng đoạn, từ tổng nặng nhất tới nhẹ nhất.
        </p>
        <ul className="mt-4 space-y-2">
          {PASSAGES.map((p) => {
            const held = chipsOf(p.id, dropped);
            const at = order.indexOf(p.id);
            const graded = placed(p.id);
            return (
              <li
                key={p.id}
                data-fused={p.id}
                data-chips={held.length}
                data-place={at >= 0 ? at + 1 : undefined}
                data-verdict={graded?.verdict}
                className="rounded-md border border-line bg-surface p-3"
              >
                <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3">
                  <span
                    aria-hidden="true"
                    className={`grid size-8 place-items-center rounded-sm text-sm font-bold tabular-nums ${
                      at >= 0
                        ? "bg-brand text-on-brand"
                        : "border border-dashed border-line-strong text-fg-muted"
                    }`}
                  >
                    {at >= 0 ? at + 1 : "–"}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold">{p.label}</span>
                    <span className="block text-fg-muted tabular-nums">
                      {held.length > 0
                        ? held.map((c) => fraction(c.rank)).join(" + ")
                        : "chưa có chip"}
                    </span>
                  </span>
                  {/* Gone once graded: the badge keeps the pick, the line under it the verdict. */}
                  {grade === null && (
                    <button
                      type="button"
                      disabled={!allDropped}
                      aria-label={
                        at >= 0
                          ? `Bỏ hạng ${at + 1}: ${p.label}`
                          : `Xếp hạng ${order.length + 1}: ${p.label}`
                      }
                      onClick={() => togglePlace(p.id)}
                      className="min-h-11 rounded-sm border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {at >= 0 ? `Bỏ hạng ${at + 1}` : `Xếp hạng ${order.length + 1}`}
                    </button>
                  )}
                </div>
                {graded && (
                  <VerdictLine right={graded.verdict === "right"}>
                    {/* The badge is aria-hidden and the order button is gone once graded: the
                        pick is said here, so a screen reader hears it too. */}
                    <span className="font-semibold">
                      {graded.verdict === "right"
                        ? `Đúng chỗ · xếp hạng ${at + 1}`
                        : `Sai chỗ · xếp hạng ${at + 1}, nên ở hạng ${graded.belongs}`}
                    </span>
                    . {whyLine(p.id)}
                  </VerdictLine>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {grade ? (
        <GradeBox
          lesson={RRF}
          right={grade.right}
          onStartOver={() => {
            setGrade(null);
            setDropped(new Set());
            setOrder([]);
            startOver();
          }}
        >
          <p className="text-lg font-bold tabular-nums">
            Đúng {grade.right}/{grade.total} vị trí
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h2 id={`${id}-fused`} className="font-semibold">
                Thứ tự sau khi trộn
              </h2>
              <ol
                data-fused-order=""
                aria-labelledby={`${id}-fused`}
                className="mt-2 list-inside list-decimal space-y-1 text-sm tabular-nums"
              >
                {FUSED.map((f) => (
                  <li key={f.passage} data-passage={f.passage}>
                    {passage(f.passage).label} · {SUM.format(f.score)}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 id={`${id}-raw`} className="font-semibold">
                Nếu cộng điểm thô
              </h2>
              <ol
                data-raw-order=""
                aria-labelledby={`${id}-raw`}
                className="mt-2 list-inside list-decimal space-y-1 text-sm tabular-nums"
              >
                {RAW_ORDER.map((r) => (
                  <li key={r.passage} data-passage={r.passage}>
                    {passage(r.passage).label} · {RAW_SUM.format(r.sum)}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-4 max-w-prose text-sm">
            {SCALES.map((s) => `${s.list.name} chấm cao nhất ${RAW[s.list.id].format(s.top)}`).join(
              ", ",
            )}
            . Cộng thẳng hai thang này thì {BIGGER.name} quyết hết:{" "}
            {passage(RAW_ORDER[0]?.passage ?? "").label} đứng đầu, còn {passage(ANSWER).label}, đoạn
            trả lời câu hỏi, đứng thứ {RAW_ORDER.findIndex((r) => r.passage === ANSWER) + 1}. Phễu
            chỉ nhìn hạng: mỗi bên góp chip như nhau, và đoạn cả hai bên cùng thấy được hai chip.
          </p>
          <p className="mt-3 max-w-prose text-sm text-fg-muted">
            Phễu không so điểm của hai cách tìm, chỉ so hạng, nên hai thang khác nhau không lấn được
            nhau. Với k = {RRF_K}, chip hạng 1 và chip hạng 5 chênh nhau rất ít: được cả hai bên tìm
            thấy mới là điều quyết định.
          </p>
        </GradeBox>
      ) : (
        <CheckRow lesson={RRF} left={left} onCheck={() => setGrade(gradeOrder(order))} />
      )}
    </MicroFrame>
  );
}
