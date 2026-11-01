import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Brief } from "./Brief";
import { testEnv } from "./test-fixtures";

afterEach(cleanup);

function scene(id: Parameters<typeof testEnv>[0]) {
  render(<Brief level={testEnv(id).level} />);
  const found = document.querySelector("[data-scene]");
  if (!found) throw new Error(`${id} draws no scene`);
  return found;
}

// Each level opens on its own scene (level-identity-v0.5 §2), drawn from scenario §3: the
// shape of the thing on screen is what tells one level from the next, so the kind is asserted.
describe("the scene at the head of each level", () => {
  it("pins L1's fabricated line on the notice board, word for word", () => {
    const found = scene("grounded-citation");
    expect(found.getAttribute("data-scene")).toBe("poster");
    expect(found.querySelector("[data-scene-poster]")?.textContent).toContain(
      "em chỉ cần gửi email cho phòng đào tạo",
    );
  });

  it("stamps L2's leave form overdue", () => {
    const found = scene("chunk-tuning");
    expect(found.getAttribute("data-scene")).toBe("form");
    expect(found.querySelector("[data-scene-stamp]")?.textContent).toBe("QUÁ HẠN");
  });

  it("opens L3 on the incident file: the printout and what it wrongly says", () => {
    const found = scene("article-number-lookup");
    expect(found.getAttribute("data-scene")).toBe("dossier");
    const print = found.querySelector("[data-scene-print]");
    expect(print?.textContent).toContain("Điều 47 khoản 2");
    expect(print?.textContent).toContain("Quy chế hiện hành không có thông tin này.");
  });

  it("gives the three levels three different scenes", () => {
    const kinds = (["grounded-citation", "chunk-tuning", "article-number-lookup"] as const).map(
      (id) => {
        const kind = scene(id).getAttribute("data-scene");
        cleanup();
        return kind;
      },
    );
    expect(new Set(kinds).size).toBe(3);
  });

  it("is a named section a screen reader can jump to", () => {
    scene("grounded-citation");
    expect(screen.getByRole("heading", { name: "Hiện trường" })).toBeDefined();
  });
});

// Cờ thế giới (scenario §3): once the level has a star, its scene shows the trouble fixed.
describe("the scene once the level has a star", () => {
  function wonScene(id: Parameters<typeof testEnv>[0], won: boolean) {
    render(<Brief level={testEnv(id).level} won={won} />);
    const found = document.querySelector("[data-scene]");
    if (!found) throw new Error(`${id} draws no scene`);
    return found;
  }

  it("keeps the trouble on show before the first star", () => {
    for (const id of ["grounded-citation", "chunk-tuning", "article-number-lookup"] as const) {
      expect(wonScene(id, false).querySelector("[data-scene-won]")).toBeNull();
      cleanup();
    }
  });

  it("takes L1's poster down", () => {
    const found = wonScene("grounded-citation", true);
    expect(found.querySelector("[data-scene-won]")?.textContent).toBe("ĐÃ GỠ");
    expect(found.querySelector("[data-scene-poster]")?.getAttribute("data-taken-down")).toBe("");
  });

  it("stamps L2's form received instead of overdue", () => {
    const found = wonScene("chunk-tuning", true);
    expect(found.querySelector("[data-scene-stamp]")?.textContent).toBe("ĐÃ NHẬN");
    expect(found.querySelector("[data-scene-won]")).not.toBeNull();
  });

  it("closes L3's incident file", () => {
    const found = wonScene("article-number-lookup", true);
    expect(found.querySelector("[data-scene-won]")?.textContent).toBe("ĐÃ XỬ LÝ");
  });

  it("lets cô Lan say the level's win line", () => {
    wonScene("chunk-tuning", true);
    expect(screen.getByText(/Phòng đào tạo nhận đơn của Hà rồi/)).toBeDefined();
  });
});
