import { cleanup, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MICRO_LESSONS } from "~/features/micro/registry";
import { renderLesson } from "~/features/micro/test-render";

import { clientLoader } from "./play-micro";

/** `/play/:zoneId/vi-mo/:lessonId` renders whichever lesson the registry finds (plan v0.7 4.5). */

afterEach(cleanup);

const load = (zoneId: string, lessonId: string) =>
  clientLoader({ params: { zoneId, lessonId } } as Parameters<typeof clientLoader>[0]);

describe("the micro lesson route", () => {
  it("loads each registered lesson's own page, titled by the registry", async () => {
    for (const lesson of MICRO_LESSONS) {
      const { title, Page } = await load(lesson.zone, lesson.id);
      expect(title).toBe(lesson.title);
      renderLesson(createElement(Page));
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(lesson.title);
      cleanup();
    }
  });

  it("answers an unknown lesson, or a lesson under another zone, as not found", async () => {
    for (const [zone, id] of [
      ["watchtower", "khong-co"],
      ["watchtower", "ba-loai-du-lieu"],
      ["library", "thang-rui-ro-tool"],
    ] as const) {
      await expect(load(zone, id), `${zone}/${id}`).rejects.toMatchObject({
        init: { status: 404 },
      });
    }
  });
});
