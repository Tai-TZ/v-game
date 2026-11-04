import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { Brief } from "./Brief";
import { testEnv, type LevelId } from "./test-fixtures";

/** The warm-up micro lesson is a link beside the goals, optional, never a step (roadmap X18). */

afterEach(cleanup);

const show = (id: LevelId) =>
  render(
    <MemoryRouter>
      <Brief level={testEnv(id).level} />
    </MemoryRouter>,
  );

describe("the brief's warm-up", () => {
  it("offers W1's tool-risk ladder before the level", () => {
    show("direct-injection");
    const link = document.querySelector("[data-warmup]");
    expect(link?.getAttribute("href")).toBe("/play/watchtower/vi-mo/thang-rui-ro-tool");
    expect(link?.textContent).toBe("Khởi động 2 phút: Thang rủi ro tool");
  });

  it("offers the library's warm-ups before L1 and L3 (plan v0.7 4.5)", () => {
    for (const [level, lesson, title] of [
      ["grounded-citation", "ba-loai-du-lieu", "Ba loại dữ liệu"],
      ["article-number-lookup", "tu-tay-tron-rrf", "Tự tay trộn RRF"],
    ] as const) {
      show(level);
      const links = document.querySelectorAll("[data-warmup]");
      expect(links, level).toHaveLength(1);
      expect(links[0]?.getAttribute("href")).toBe(`/play/library/vi-mo/${lesson}`);
      expect(links[0]?.textContent).toBe(`Khởi động 2 phút: ${title}`);
      cleanup();
    }
  });

  it("offers nothing on a level without one", () => {
    show("chunk-tuning");
    expect(document.querySelector("[data-warmup]")).toBeNull();
  });
});
