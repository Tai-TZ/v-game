import type { ComponentType } from "react";

import type { MicroLessonId } from "./registry";

/**
 * Each lesson's page with its content, one lazy chunk per lesson (plan v0.7 4.5): only the
 * micro route imports this map, so a lesson loads on its own page and nowhere else, and the
 * zone page and the brief keep to the registry's metadata. Typed by the registry's ids, so a
 * lesson cannot be registered without a page.
 */
const PAGES: Readonly<Record<MicroLessonId, () => Promise<ComponentType>>> = {
  "thang-rui-ro-tool": () => import("./ToolRiskPage").then((m) => m.ToolRiskPage),
  "ba-loai-du-lieu": () => import("./DataKindsPage").then((m) => m.DataKindsPage),
  "tu-tay-tron-rrf": () => import("./RrfPage").then((m) => m.RrfPage),
};

export const loadMicroPage = (id: MicroLessonId) => PAGES[id]();
