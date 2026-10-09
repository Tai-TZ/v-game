import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  advanceScene,
  beginScene,
  CEILINGS,
  failScene,
  progress,
  sceneLoad,
  sceneMounted,
  STAGE,
} from "./sceneLoad";

const fresh = sceneLoad.getState();

beforeEach(() => sceneLoad.setState(fresh, true));
afterEach(() => vi.useRealTimers());

describe("progress (honest ceilings)", () => {
  const times = [0, 50, 300, 1e3, 1e4, 1e7];

  it("never reaches the next stage's floor and never moves backwards", () => {
    for (let k = 0; k < STAGE.done; k += 1) {
      const ceiling = CEILINGS[k]?.[1] ?? 0;
      for (const t of times) {
        const p = progress(k, t, false);
        if (k > 0) expect(p).toBeLessThan(ceiling);
        expect(progress(k + 1, 0, false)).toBeGreaterThanOrEqual(p);
      }
    }
  });

  it("is complete at the last stage and with reduced motion", () => {
    expect(progress(STAGE.done, 0, false)).toBe(1);
    expect(progress(STAGE.fetch, 0, true)).toBe(1);
  });
});

describe("stage signals", () => {
  it("only move forwards and ignore repeats", () => {
    beginScene();
    advanceScene(STAGE.build);
    advanceScene(STAGE.boot);
    advanceScene(STAGE.build);
    expect(sceneLoad.getState().stage).toBe(STAGE.build);
  });

  it("begin a new entry at stage 1 with a new run", () => {
    beginScene();
    advanceScene(STAGE.done);
    beginScene();
    expect(sceneLoad.getState()).toMatchObject({ stage: STAGE.fetch, run: 2 });
  });

  it("leave a live scene alone on revalidation, and stop after a failure", () => {
    beginScene();
    sceneMounted(true);
    advanceScene(STAGE.done);
    beginScene();
    expect(sceneLoad.getState()).toMatchObject({ stage: STAGE.done, run: 1 });

    sceneMounted(false);
    failScene();
    beginScene();
    advanceScene(STAGE.done);
    expect(sceneLoad.getState()).toMatchObject({ run: 1, failed: true });
  });

  it("finish 2.5 s after the scene graph without a frame, only for the same entry", () => {
    vi.useFakeTimers();
    beginScene();
    advanceScene(STAGE.paint);
    vi.advanceTimersByTime(2499);
    expect(sceneLoad.getState().stage).toBe(STAGE.paint);
    vi.advanceTimersByTime(1);
    expect(sceneLoad.getState().stage).toBe(STAGE.done);

    // A timer from an earlier visit must not finish the next one.
    beginScene();
    advanceScene(STAGE.paint);
    beginScene();
    vi.advanceTimersByTime(3000);
    expect(sceneLoad.getState().stage).toBe(STAGE.fetch);
  });
});
