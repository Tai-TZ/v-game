import { useEffect, useRef, useState, type ReactNode } from "react";

import { PageFrame } from "~/components/PageFrame";
import { buttonClass } from "~/components/ui/button";
import { CheckIcon, CrossIcon } from "~/components/ui/icons";
import { ProjectorLink } from "~/features/projector/ProjectorLink";
import { ZONE_BAR } from "~/features/zones/ui";

import { levelHref, type MicroLesson } from "./registry";

/**
 * What every micro lesson page shares (roadmap X18: an optional card, never in the way of the
 * level): the frame, whose way back is the level; a head that says it costs no AI call and no
 * star; the check; and the graded box with the way on. Each lesson's own cards go in between.
 */
export function MicroFrame({
  lesson,
  lead,
  how,
  children,
}: {
  lesson: MicroLesson;
  lead: ReactNode;
  /** What to do, after "costs nothing": one sentence, verb first. */
  how: string;
  children: ReactNode;
}) {
  return (
    <PageFrame back={levelHref(lesson)} backLabel={`Về màn ${lesson.levelTitle}`}>
      <div aria-hidden="true" className={`h-[5px] w-12 ${ZONE_BAR[lesson.zone]}`} />
      <p className="mt-4 text-sm font-semibold text-fg-muted">
        Khởi động 2 phút · {lesson.zoneName}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{lesson.title}</h1>
      <p className="mt-3 max-w-prose text-lg text-fg-muted">{lead}</p>
      <p className="mt-2 max-w-prose text-sm text-fg-muted">
        Bài này không tốn lượt gọi AI và không tính sao. {how}
      </p>
      {children}
    </PageFrame>
  );
}

/** Before the grade: the check waits for a complete answer (a half-done one is not graded). */
export function CheckRow({
  lesson,
  left,
  onCheck,
}: {
  lesson: MicroLesson;
  /** What is still missing, or null once the answer is complete. */
  left: string | null;
  onCheck: () => void;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={left !== null}
        onClick={onCheck}
        className={buttonClass("primary")}
      >
        Kiểm tra
      </button>
      {left !== null && <span className="text-sm text-fg-muted">{left}</span>}
      <ProjectorLink to={levelHref(lesson)} className={buttonClass("quiet")}>
        Vào màn {lesson.levelTitle}
      </ProjectorLink>
    </div>
  );
}

/**
 * The graded box. It takes focus as it appears, so the keyboard and a screen reader land on the
 * score rather than on a check button that is gone.
 */
export function GradeBox({
  lesson,
  right,
  onStartOver,
  children,
}: {
  lesson: MicroLesson;
  right: number;
  onStartOver: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.focus();
  }, []);
  return (
    <div
      ref={box}
      tabIndex={-1}
      data-grade=""
      data-right={right}
      className="mt-8 rounded-md border border-line p-4"
    >
      {children}
      <div className="mt-4 flex flex-wrap gap-2">
        <ProjectorLink to={levelHref(lesson)} className={buttonClass("primary")}>
          Vào màn {lesson.levelTitle}
        </ProjectorLink>
        <button type="button" onClick={onStartOver} className={buttonClass("secondary")}>
          Làm lại
        </button>
      </div>
    </div>
  );
}

/** One line under a graded item: right or not, then why. */
export function VerdictLine({ right, children }: { right: boolean; children: ReactNode }) {
  return (
    <p data-why="" className="mt-3 flex gap-2 text-sm">
      {right ? (
        <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <CrossIcon className="mt-0.5 size-4 shrink-0 text-danger" />
      )}
      <span>{children}</span>
    </p>
  );
}

/**
 * "Làm lại" unmounts the graded box that held focus: hand focus to the lesson's first control
 * instead of <body>, so the keyboard starts over where the lesson does. Call `startOver` after
 * resetting; the returned ref goes on the element that holds the lesson's controls.
 */
export function useStartOver<T extends HTMLElement>() {
  const controls = useRef<T>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (round > 0) controls.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [round]);
  return { controls, startOver: () => setRound((n) => n + 1) };
}
