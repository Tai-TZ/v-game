import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";

import { PageFrame } from "~/components/PageFrame";
import { buttonClass } from "~/components/ui/button";
import { CheckIcon, CrossIcon } from "~/components/ui/icons";
import { CHIP } from "~/features/workbench/BenchView";

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

const LEVEL_URL = `/play/${TOOL_RISK.zone}/${TOOL_RISK.before}`;

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
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (grade) summary.current?.focus();
  }, [grade]);

  const ready = gradeLadder(picks) !== null;
  const verdictOf = (cardId: string) => grade?.cards.find((c) => c.id === cardId)?.verdict;

  return (
    <PageFrame back={LEVEL_URL} backLabel="Về màn Cổng thành">
      <div aria-hidden="true" className="h-[5px] w-12 bg-ink" />
      <p className="mt-4 text-sm font-semibold text-fg-muted">Khởi động 2 phút · Tháp canh</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{TOOL_RISK.title}</h1>
      <p className="mt-3 max-w-prose text-lg text-fg-muted">{TOOL_RISK.lead}</p>
      <p className="mt-2 max-w-prose text-sm text-fg-muted">
        Bài này không tốn lượt gọi AI và không tính sao. Chọn một mức cho mỗi việc, rồi kiểm tra.
      </p>

      <ol className="mt-8 space-y-4">
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
                <div className="mt-3 flex flex-wrap gap-1">
                  {LANES.map((lane) => (
                    <label key={lane.id} className="cursor-pointer">
                      <input
                        type="radio"
                        name={`${id}-${card.id}`}
                        checked={picks[card.id] === lane.id}
                        onChange={() => setPicks({ ...picks, [card.id]: lane.id })}
                        className="peer sr-only"
                      />
                      <span className={CHIP}>{lane.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {verdict && (
                <p className="mt-3 flex gap-2 text-sm">
                  {verdict === "right" ? (
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <CrossIcon className="mt-0.5 size-4 shrink-0 text-danger" />
                  )}
                  <span>
                    <span className="font-semibold">{VERDICT_VI[verdict]}</span>
                    {verdict !== "right" && ` · nên là: ${laneLabel(card.lane)}`}. {card.why}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {grade ? (
        <div
          ref={summary}
          tabIndex={-1}
          data-grade=""
          data-right={grade.right}
          className="mt-8 rounded-md border border-line p-4"
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={LEVEL_URL} className={buttonClass("primary")}>
              Vào màn Cổng thành
            </Link>
            <button
              type="button"
              onClick={() => {
                setGrade(null);
                setPicks({});
              }}
              className={buttonClass("secondary")}
            >
              Làm lại
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={() => setGrade(gradeLadder(picks))}
            className={buttonClass("primary")}
          >
            Kiểm tra
          </button>
          {!ready && (
            <span className="text-sm text-fg-muted">
              Còn {CARDS.length - Object.keys(picks).length} việc chưa chọn mức.
            </span>
          )}
          <Link to={LEVEL_URL} className={buttonClass("quiet")}>
            Vào màn Cổng thành
          </Link>
        </div>
      )}
    </PageFrame>
  );
}
