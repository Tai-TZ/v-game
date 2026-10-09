import { readFileSync } from "node:fs";
import path from "node:path";

import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "~/features/theme/context";
import { parseThemeIndex, parseThemeManifest } from "~/features/theme/schema";

import { hubStore } from "../store";
import { advanceScene, beginScene, sceneLoad, STAGE } from "./sceneLoad";
import { LABELS, SceneLoader, TIPS } from "./SceneLoader";

const read = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), ...parts), "utf8"));
const themes = parseThemeIndex(read("public", "themes", "index.json"));
const catalog = {
  themes,
  defaultId: themes[0]?.id ?? "",
  manifests: Object.fromEntries(
    themes.map(({ id }) => [id, parseThemeManifest(read("public", "themes", id, "manifest.json"))]),
  ),
};

const freshLoad = sceneLoad.getState();
const freshHub = hubStore.getState();
let reduced = false;

function renderLoader() {
  return render(
    <ThemeProvider catalog={catalog}>
      <SceneLoader />
    </ThemeProvider>,
  );
}
const loader = () => document.querySelector("[data-scene-loader]");
const status = () => screen.getByRole("status");
/** act() with a void callback stays synchronous (a returned value would make it async). */
const run = (fn: () => unknown) => {
  act(() => {
    fn();
  });
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "performance"],
  });
  sceneLoad.setState(freshLoad, true);
  hubStore.setState(freshHub, true);
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduced-motion"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.advanceTimersByTime(1000); // the page has been up for a second
  beginScene();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SceneLoader shell (pre-rendered)", () => {
  it("shows step 1 and the first tip, without any style attribute (CSP)", () => {
    const html = renderToStaticMarkup(<SceneLoader shell />);
    expect(html).toContain("data-scene-loader");
    expect(html).toContain(LABELS[0]);
    expect(html).toContain("Bước 1/5");
    expect(html).toContain(TIPS[0]);
    expect(html).not.toMatch(/\sstyle=|<style/);
  });
});

describe("SceneLoader", () => {
  it("names the step being waited for and announces it once it lasts a second", () => {
    renderLoader();
    expect(screen.getByText("Đang tải bộ dựng 3D")).toBeDefined();
    expect(screen.getByText("Bước 2/5")).toBeDefined();
    expect(status().textContent).toBe("");
    run(() => vi.advanceTimersByTime(1000));
    expect(status().textContent).toBe("Đang tải bộ dựng 3D");

    run(() => advanceScene(STAGE.boot));
    expect(screen.getByText("Bước 3/5")).toBeDefined();
    run(() => vi.advanceTimersByTime(300));
    expect(status().textContent).toBe("Đang tải bộ dựng 3D"); // fast steps are never announced
  });

  it("builds pieces only as their signals arrive, and draws all of them with reduced motion", () => {
    renderLoader();
    const built = () => document.querySelectorAll(".bp-pc.is-built, .bp-pc.is-set").length;
    const all = document.querySelectorAll(".bp-pc").length;
    expect(all).toBeGreaterThan(100);
    run(() => vi.advanceTimersByTime(60_000));
    const duringDownload = built();
    expect(duringDownload).toBeLessThan(all);
    expect(document.querySelectorAll(".k-tree.is-built")).toHaveLength(0);
    run(() => advanceScene(STAGE.paint));
    run(() => vi.advanceTimersByTime(1000));
    expect(built()).toBeGreaterThan(duringDownload);
    cleanup();

    reduced = true;
    renderLoader();
    expect(document.querySelectorAll(".bp-pc:not(.is-set)")).toHaveLength(0);
  });

  it("draws everything a signal owes in the same render, before any tick", () => {
    renderLoader();
    run(() => advanceScene(STAGE.build));
    // No timer has run: the main thread may be frozen right after this signal.
    expect(
      document.querySelectorAll(".k-tile:not(.is-built), .k-flat:not(.is-built)"),
    ).toHaveLength(0);
    expect(document.querySelectorAll(".k-tree.is-built").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".k-bldg.is-built")).toHaveLength(0);
  });

  it("fades out after the first frame and then unmounts", () => {
    renderLoader();
    run(() => vi.advanceTimersByTime(500));
    run(() => advanceScene(STAGE.done));
    expect(loader()?.className).toContain("animate-leave");
    expect(screen.getByText(LABELS[STAGE.done])).toBeDefined();
    run(() => vi.advanceTimersByTime(220));
    expect(loader()).toBeNull();
    expect(vi.getTimerCount()).toBe(0); // no tip, tick or slow timer outlives it
  });

  it("never shows when the scene is ready within the appear delay", () => {
    sceneLoad.setState({ begun: performance.now() });
    renderLoader();
    run(() => vi.advanceTimersByTime(50));
    run(() => advanceScene(STAGE.done));
    expect(loader()).toBeNull();
  });

  it("lifts the card above the interact hint on arrival", () => {
    hubStore.setState({ nearby: "library" });
    renderLoader();
    expect(screen.getByRole("region").className).toContain("bottom-24");
  });

  it("shows the slow notice after 10 s", () => {
    renderLoader();
    run(() => vi.advanceTimersByTime(9000));
    expect(screen.queryByText(/sa bàn hơi nặng/)).toBeNull();
    run(() => vi.advanceTimersByTime(1000));
    expect(status().textContent).toMatch(/sa bàn hơi nặng/);
  });
});

describe("tips", () => {
  it("are short, plain text", () => {
    expect(TIPS).toHaveLength(12);
    for (const tip of TIPS) {
      expect(Array.from(tip).length, tip).toBeLessThanOrEqual(120);
      expect(tip, tip).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
