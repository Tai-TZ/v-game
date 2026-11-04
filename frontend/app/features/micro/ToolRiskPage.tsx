import { useId, useState } from "react";

import { CHIP } from "~/features/workbench/BenchView";

import { CheckRow, GradeBox, MicroFrame, useStartOver, VerdictLine } from "./MicroFrame";
import {
  CARDS,
  gradeLadder,
  LANES,
  RULE_VI,
  TOOL_RISK,
  type LadderGrade,
  type LaneId,
  type Verdict,
} from "./toolRisk";

/**
 * On top of the shared chip: a full-width cell holding number, label and marks, and the picked
 * lane kept at full strength once the ladder is checked (the fieldset locks; a dimmed pick read
 * as unselected next to its verdict).
 */
const LANE_CHIP =
  "h-auto min-h-11 w-full flex-wrap justify-start gap-x-2 gap-y-1 py-2 text-left peer-checked:peer-disabled:opacity-100";

const laneLabel = (id: LaneId) => LANES.find((l) => l.id === id)?.label ?? id;

const VERDICT_VI: Readonly<Record<Verdict, string>> = {
  right: "Đúng",
  under: "Để lọt",
  over: "Hỏi thừa",
};

/**
 * `/play/watchtower/vi-mo/thang-rui-ro-tool`: a 1–3 minute warm-up before W1 (roadmap X18: an
 * optional card, never in the way of the level). No AI call and no star: the grade is a rule
 * over each job's facts (toolRisk.ts), and it counts a lane too loose apart from one too strict.
 */
export function ToolRiskPage() {
  const id = useId();
  const [picks, setPicks] = useState<Partial<Record<string, LaneId>>>({});
  const [grade, setGrade] = useState<LadderGrade | null>(null);
  const { controls, startOver } = useStartOver<HTMLOListElement>();

  const ready = gradeLadder(picks) !== null;
  const verdictOf = (cardId: string) => grade?.cards.find((c) => c.id === cardId)?.verdict;

  return (
    <MicroFrame
      lesson={TOOL_RISK}
      lead={TOOL_RISK.lead}
      how="Chọn một mức cho mỗi việc, rồi kiểm tra."
    >
      <ol ref={controls} className="mt-8 space-y-4">
        {CARDS.map((card, index) => {
          const verdict = verdictOf(card.id);
          return (
            <li
              key={card.id}
              data-card={card.id}
              data-verdict={verdict}
              className="rounded-md border border-line bg-surface p-4"
            >
              <fieldset disabled={grade !== null}>
                <legend className="font-semibold">
                  <span className="text-fg-muted tabular-nums">{index + 1}.</span> {card.text}
                </legend>
                {/* A scale, not four equal buttons: numbered loosest to strictest, each with as
                    many marks as its step (order without relying on colour), 2x2 on a phone. */}
                <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {LANES.map((lane, index) => (
                    // A grid of one, so the chip fills the row's height: equal cells.
                    <label key={lane.id} className="grid cursor-pointer">
                      <input
                        type="radio"
                        name={`${id}-${card.id}`}
                        checked={picks[card.id] === lane.id}
                        onChange={() => setPicks({ ...picks, [card.id]: lane.id })}
                        className="peer sr-only"
                      />
                      <span data-step={index + 1} className={`${CHIP} ${LANE_CHIP}`}>
                        <span aria-hidden="true" className="font-semibold tabular-nums">
                          {index + 1}
                        </span>
                        {lane.label}
                        <span aria-hidden="true" className="flex gap-0.5">
                          {LANES.map((_, mark) =>
                            mark <= index ? (
                              <span key={mark} data-mark-on="" className="size-1.5 bg-current" />
                            ) : (
                              <span key={mark} className="size-1.5 bg-line" />
                            ),
                          )}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {verdict && (
                <VerdictLine right={verdict === "right"}>
                  <span className="font-semibold">{VERDICT_VI[verdict]}</span>
                  {verdict !== "right" && ` · nên là: ${laneLabel(card.lane)}`}. {card.why}
                </VerdictLine>
              )}
            </li>
          );
        })}
      </ol>

      {grade ? (
        <GradeBox
          lesson={TOOL_RISK}
          right={grade.right}
          onStartOver={() => {
            setGrade(null);
            setPicks({});
            startOver();
          }}
        >
          <p className="text-lg font-bold tabular-nums">
            Đúng {grade.right}/{grade.total} việc
          </p>
          <p className="mt-1 text-sm tabular-nums">
            {grade.under} việc để lọt · {grade.over} việc hỏi thừa
          </p>
          <h2 id={`${id}-rule`} className="mt-4 font-semibold">
            Luật của quầy
          </h2>
          <ol
            aria-labelledby={`${id}-rule`}
            className="mt-2 list-inside list-decimal space-y-1 text-sm"
          >
            {RULE_VI.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="mt-3 max-w-prose text-sm text-fg-muted">
            Rủi ro nằm ở tác dụng phụ và việc làm lại được hay không, không nằm ở chữ trong câu. Hỏi
            duyệt việc chỉ đọc cũng là một lỗi: người duyệt sẽ quen bấm đồng ý.
          </p>
        </GradeBox>
      ) : (
        <CheckRow
          lesson={TOOL_RISK}
          left={
            ready ? null : `Còn ${CARDS.length - Object.keys(picks).length} việc chưa chọn mức.`
          }
          onCheck={() => setGrade(gradeLadder(picks))}
        />
      )}
    </MicroFrame>
  );
}
