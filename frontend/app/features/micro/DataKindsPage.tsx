import { useId, useState } from "react";

import { CHIP } from "~/features/workbench/BenchView";

import {
  CARDS,
  DATA_KINDS,
  gradeSort,
  PLACES,
  RULE_VI,
  type Miss,
  type PlaceId,
  type SortGrade,
  type Verdict,
} from "./dataKinds";
import { CheckRow, GradeBox, MicroFrame, useStartOver, VerdictLine } from "./MicroFrame";

/**
 * On top of the shared chip: a full-width cell, the place's name over its hint, left-aligned;
 * the pick kept at full strength once graded (the fieldset locks), as on the tool-risk ladder.
 */
const PLACE_CHIP =
  "h-auto min-h-11 w-full flex-col items-start gap-0.5 py-2 text-left peer-checked:peer-disabled:opacity-100";

const placeFull = (id: PlaceId) => PLACES.find((p) => p.id === id)?.full ?? id;

const VERDICT_VI: Readonly<Record<Verdict, string>> = {
  right: "Đúng",
  vao_kho: "Nhầm vào kho vector",
  nhoi_loi_dan: "Nhồi vào lời dặn",
  ep_tra_cuu: "Ép thành tra cứu",
};

/** The count line, in the order the kinds are read. */
const MISS_COUNT_VI: Readonly<Record<Miss, string>> = {
  vao_kho: "thẻ nhầm vào kho vector",
  nhoi_loi_dan: "thẻ nhồi vào lời dặn",
  ep_tra_cuu: "thẻ ép thành tra cứu",
};

/** What each kind of mistake teaches, said only when the player made it. */
const MISS_LESSON_VI: Readonly<Record<Miss, string>> = {
  vao_kho:
    "Kho vector tìm theo nghĩa: nó không giữ kịp số đổi từng phút, không phân biệt được hai mã gần nhau, và có câu sẽ không kéo lên được một luật mà câu nào cũng cần.",
  nhoi_loi_dan:
    "Lời dặn đi kèm mọi câu hỏi: thứ dài thì câu nào cũng trả tiền cho nó, còn số liệu chép vào thì cũ đi.",
  ep_tra_cuu:
    "Tra cứu cần một mã hay một cột để hỏi. Văn bản viết bằng lời không có mã, còn luật chung thì không nên chờ trợ lý nhớ gọi tool.",
};

const MISSES = Object.keys(MISS_COUNT_VI) as Miss[];

/**
 * `/play/library/vi-mo/ba-loai-du-lieu`: a 1–3 minute warm-up before L1 (roadmap X18: optional,
 * never in the way of the level). No AI call and no star: the grade is a rule over each card's
 * facts (dataKinds.ts), and a wrong pick is named for where it went, since each place taken by
 * mistake teaches something different.
 */
export function DataKindsPage() {
  const id = useId();
  const [picks, setPicks] = useState<Partial<Record<string, PlaceId>>>({});
  const [grade, setGrade] = useState<SortGrade | null>(null);
  const { controls, startOver } = useStartOver<HTMLOListElement>();

  const ready = gradeSort(picks) !== null;
  const gradeOf = (cardId: string) => grade?.cards.find((c) => c.id === cardId);

  return (
    <MicroFrame
      lesson={DATA_KINDS}
      lead={DATA_KINDS.lead}
      how="Chọn một nơi cho mỗi thẻ, rồi kiểm tra."
    >
      <h2 id={`${id}-key`} className="mt-6 text-sm font-semibold">
        Ba nơi để dữ liệu
      </h2>
      <ul aria-labelledby={`${id}-key`} className="mt-2 space-y-1 text-sm">
        {PLACES.map((place) => (
          <li key={place.id}>
            <span className="font-semibold">{place.full}:</span> {place.does}
          </li>
        ))}
      </ul>

      <ol ref={controls} className="mt-8 space-y-4">
        {CARDS.map((card, index) => {
          const graded = gradeOf(card.id);
          return (
            <li
              key={card.id}
              data-card={card.id}
              data-verdict={graded?.verdict}
              className="rounded-md border border-line bg-surface p-4"
            >
              <fieldset disabled={grade !== null}>
                <legend className="font-semibold">
                  <span className="text-fg-muted tabular-nums">{index + 1}.</span> {card.text}
                </legend>
                {/* Three places, not a scale: no order to mark. Three across even on a phone,
                    the hint under the name, so a card stays one row of choices. */}
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {PLACES.map((place) => (
                    // A grid of one, so the chip fills the row's height: equal cells.
                    <label key={place.id} data-place={place.id} className="grid cursor-pointer">
                      <input
                        type="radio"
                        name={`${id}-${card.id}`}
                        checked={picks[card.id] === place.id}
                        onChange={() => setPicks({ ...picks, [card.id]: place.id })}
                        className="peer sr-only"
                      />
                      <span className={`${CHIP} ${PLACE_CHIP}`}>
                        <span className="font-semibold">{place.name}</span>
                        {/* The key above says it in full: the hint is a reminder, not the name. */}
                        <span aria-hidden="true" className="text-xs">
                          {place.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {graded && (
                <VerdictLine right={graded.verdict === "right"}>
                  <span className="font-semibold">{VERDICT_VI[graded.verdict]}</span>
                  {graded.verdict !== "right" && ` · nên là: ${placeFull(card.place)}`}.{" "}
                  {graded.picked === card.lure && "Mồi nhử: chữ trong thẻ dẫn sang nơi sai. "}
                  {card.why}
                </VerdictLine>
              )}
            </li>
          );
        })}
      </ol>

      {grade ? (
        <GradeBox
          lesson={DATA_KINDS}
          right={grade.right}
          onStartOver={() => {
            setGrade(null);
            setPicks({});
            startOver();
          }}
        >
          <p className="text-lg font-bold tabular-nums">
            Đúng {grade.right}/{grade.total} thẻ
          </p>
          <p className="mt-1 text-sm tabular-nums">
            {MISSES.map((miss) => `${grade.misses[miss]} ${MISS_COUNT_VI[miss]}`).join(" · ")}
          </p>
          {MISSES.filter((miss) => grade.misses[miss] > 0).map((miss) => (
            <p key={miss} data-miss-lesson={miss} className="mt-2 max-w-prose text-sm">
              <span className="font-semibold">{VERDICT_VI[miss]}.</span> {MISS_LESSON_VI[miss]}
            </p>
          ))}
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
            Không phải thứ gì cũng vào kho vector. Kho vector giỏi một việc: tìm văn bản dài theo
            nghĩa. Số đổi từng phút và dòng tra theo mã thì hỏi tận nguồn; luật ngắn mà câu nào cũng
            cần thì chèn thẳng vào lời dặn.
          </p>
        </GradeBox>
      ) : (
        <CheckRow
          lesson={DATA_KINDS}
          left={ready ? null : `Còn ${CARDS.length - Object.keys(picks).length} thẻ chưa xếp.`}
          onCheck={() => setGrade(gradeSort(picks))}
        />
      )}
    </MicroFrame>
  );
}
