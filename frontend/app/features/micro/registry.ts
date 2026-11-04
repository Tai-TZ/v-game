import type { ZoneLocation } from "~/features/zones/schema";

/** A micro lesson's place: its zone, and the level it warms up for (roadmap X18). */
export interface MicroLesson {
  id: string;
  /** A zone id; the seed keeps each zone's id equal to its location. */
  zone: ZoneLocation;
  before: string;
  title: string;
  /** The zone's and the level's names as the seed has them (registry.test holds them to it), so
   * a lesson page names its way back without waiting for the API. */
  zoneName: string;
  levelTitle: string;
}

/** "Thang rủi ro tool": its content lives in toolRisk.ts, loaded only on its own page. */
export const TOOL_RISK_LESSON = {
  id: "thang-rui-ro-tool",
  zone: "watchtower",
  before: "direct-injection",
  title: "Thang rủi ro tool",
  zoneName: "Tháp canh",
  levelTitle: "Cổng thành",
} as const satisfies MicroLesson;

/** "Ba loại dữ liệu" (B8): its content lives in dataKinds.ts. */
export const DATA_KINDS_LESSON = {
  id: "ba-loai-du-lieu",
  zone: "library",
  before: "grounded-citation",
  title: "Ba loại dữ liệu",
  zoneName: "Thư viện",
  levelTitle: "Thôi bịa điều luật",
} as const satisfies MicroLesson;

/** "Tự tay trộn RRF" (B8), before the level that brings in Phễu: its content lives in rrf.ts. */
export const RRF_LESSON = {
  id: "tu-tay-tron-rrf",
  zone: "library",
  before: "article-number-lookup",
  title: "Tự tay trộn RRF",
  zoneName: "Thư viện",
  levelTitle: "Hỏi bằng số điều",
} as const satisfies MicroLesson;

const LESSONS = [TOOL_RISK_LESSON, DATA_KINDS_LESSON, RRF_LESSON] as const;

/** Ids the route can load a page for (pages.ts maps every one of them). */
export type MicroLessonId = (typeof LESSONS)[number]["id"];

/**
 * Every micro lesson, as metadata only: the zone page and the brief read this list, so it must
 * not pull a lesson's content into their chunks (plan v0.7 4.5).
 */
export const MICRO_LESSONS: readonly (MicroLesson & { id: MicroLessonId })[] = LESSONS;

export const microHref = (lesson: MicroLesson) => `/play/${lesson.zone}/vi-mo/${lesson.id}`;

/** The level a lesson warms up for: where its "Vào màn" and its way back lead. */
export const levelHref = (lesson: MicroLesson) => `/play/${lesson.zone}/${lesson.before}`;

export const findMicro = (zone: string, id: string) =>
  MICRO_LESSONS.find((lesson) => lesson.zone === zone && lesson.id === id) ?? null;

/** The warm-ups a zone page lists just before this level. */
export const warmupsBefore = (zone: string, level: string) =>
  MICRO_LESSONS.filter((lesson) => lesson.zone === zone && lesson.before === level);
