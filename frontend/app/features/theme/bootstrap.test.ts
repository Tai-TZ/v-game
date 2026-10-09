import { afterEach, describe, expect, it, vi } from "vitest";

import { writeDisplay } from "../campus/sky";
import { themeBootstrapScript } from "./bootstrap";

const run = (hanoi: string) => {
  vi.setSystemTime(Date.parse(`2026-10-08T${hanoi}:00+07:00`));
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the inline script as shipped
  const script = new Function(themeBootstrapScript(["town"], "town", "Asia/Ho_Chi_Minh"));
  (script as () => void)();
  return document.documentElement.dataset.sky;
};

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.sky;
  localStorage.clear();
});

describe("themeBootstrapScript's sky hint", () => {
  it("marks the night before hydration, so the prerendered /play is not a day sky", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    expect(run("21:00")).toBe("night");
    delete document.documentElement.dataset.sky;
    expect(run("05:30")).toBe("night");
    delete document.documentElement.dataset.sky;
    expect(run("10:00")).toBeUndefined();
  });

  it("leaves the day sky to a viewer who fixed the daytime display", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    writeDisplay("day");
    expect(run("21:00")).toBeUndefined();
  });
});
