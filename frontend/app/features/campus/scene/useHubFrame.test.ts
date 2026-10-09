import { describe, expect, it } from "vitest";

import { DPR_PROBE_AFTER, DPR_WINDOW, dprGuard, stepDpr } from "./useHubFrame";

const SLOW = 0.03;
const FAST = 1 / 60;

/** Runs `frames` busy frames (the first continuing a busy run) from `t`; returns the dpr. */
function run(
  guard: ReturnType<typeof dprGuard>,
  dpr: number,
  t: number,
  frames: number,
  delta: number,
) {
  let current = dpr;
  for (let i = 0; i < frames; i += 1) {
    const now = t + i * delta;
    current =
      stepDpr(guard, { busy: true, wasBusy: true, delta, now, dpr: current, initialDpr: 2 }) ??
      current;
  }
  return current;
}

/** The first busy frame after an idle spell. */
const wake = (guard: ReturnType<typeof dprGuard>, dpr: number, now: number) =>
  stepDpr(guard, { busy: true, wasBusy: false, delta: 5, now, dpr, initialDpr: 2 });

describe("stepDpr (adaptive pixel ratio, art §6.1)", () => {
  it("steps down a level after a window of slow busy frames, never on fast ones", () => {
    const guard = dprGuard();
    expect(run(guard, 2, 0, DPR_WINDOW, FAST)).toBe(2);
    expect(run(guard, 2, 1, DPR_WINDOW, SLOW)).toBe(1.5);
    expect(run(guard, 1.5, 3, DPR_WINDOW, SLOW)).toBe(1);
    expect(run(guard, 1, 5, DPR_WINDOW * 2, SLOW)).toBe(1);
  });

  it("never samples an idle frame", () => {
    const guard = dprGuard();
    for (let i = 0; i < DPR_WINDOW * 2; i += 1) {
      const idle = { busy: false, wasBusy: false, delta: SLOW, now: i, dpr: 2, initialDpr: 2 };
      expect(stepDpr(guard, idle)).toBeNull();
    }
    expect(guard.sampled).toBe(0);
  });

  it("probes one level up on the first busy frame of a new interaction, after a quiet spell", () => {
    const guard = dprGuard();
    expect(run(guard, 2, 0, DPR_WINDOW, SLOW)).toBe(1.5);
    const down = DPR_WINDOW * SLOW;
    // Too soon, or mid-interaction: no probe.
    expect(wake(guard, 1.5, down + 1)).toBeNull();
    expect(run(guard, 1.5, down + DPR_PROBE_AFTER, 3, FAST)).toBe(1.5);
    // A new interaction once the spell is over: one level up, never above initialDpr.
    expect(wake(guard, 1.5, down + DPR_PROBE_AFTER + 1)).toBe(2);
    const low = dprGuard();
    run(low, 1.5, 0, DPR_WINDOW, SLOW);
    expect(
      stepDpr(low, { busy: true, wasBusy: false, delta: 5, now: 100, dpr: 1, initialDpr: 1.25 }),
    ).toBe(1.25);
  });

  it("latches after a step-down that follows a probe: no ping-pong", () => {
    const guard = dprGuard();
    run(guard, 2, 0, DPR_WINDOW, SLOW);
    expect(wake(guard, 1.5, 100)).toBe(2);
    expect(run(guard, 2, 100, DPR_WINDOW, SLOW)).toBe(1.5);
    expect(guard.latched).toBe(true);
    expect(wake(guard, 1.5, 1000)).toBeNull();
    // The step-down itself still works while latched.
    expect(run(guard, 1.5, 1000, DPR_WINDOW, SLOW)).toBe(1);
  });

  it("keeps a sharp screen sharp: no probe without a step-down", () => {
    const guard = dprGuard();
    expect(wake(guard, 2, 100)).toBeNull();
    expect(wake(guard, 1.5, 200)).toBeNull();
  });
});
