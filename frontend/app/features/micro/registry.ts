/** A micro lesson's place: its zone, and the level it warms up for (roadmap X18). */
export interface MicroLesson {
  id: string;
  zone: string;
  before: string;
  title: string;
}

/** "Thang rủi ro tool": its content lives in toolRisk.ts, loaded only on its own page. */
export const TOOL_RISK_LESSON = {
  id: "thang-rui-ro-tool",
  zone: "watchtower",
  before: "direct-injection",
  title: "Thang rủi ro tool",
} as const satisfies MicroLesson;

/**
 * Every micro lesson, as metadata only: the zone page and the brief read this list, so it must
 * not pull a lesson's content into their chunks.
 */
export const MICRO_LESSONS: readonly MicroLesson[] = [TOOL_RISK_LESSON];

export const microHref = (lesson: MicroLesson) => `/play/${lesson.zone}/vi-mo/${lesson.id}`;

export const findMicro = (zone: string, id: string) =>
  MICRO_LESSONS.find((lesson) => lesson.zone === zone && lesson.id === id) ?? null;

/** The warm-ups a zone page lists just before this level. */
export const warmupsBefore = (zone: string, level: string) =>
  MICRO_LESSONS.filter((lesson) => lesson.zone === zone && lesson.before === level);
