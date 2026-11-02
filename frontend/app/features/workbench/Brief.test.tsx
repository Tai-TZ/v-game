import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { Brief } from "./Brief";
import { testEnv } from "./test-fixtures";

/** The warm-up micro lesson is a link beside the goals, optional, never a step (roadmap X18). */

afterEach(cleanup);

const show = (id: "direct-injection" | "grounded-citation") =>
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

  it("offers nothing on a level without one", () => {
    show("grounded-citation");
    expect(document.querySelector("[data-warmup]")).toBeNull();
  });
});
