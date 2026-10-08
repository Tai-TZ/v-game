import { describe, expect, it } from "vitest";

import {
  cameraCentre,
  CONTENT,
  desiredCentre,
  groundFromScreen,
  toScreen,
  viewFor,
} from "./camera";

describe("viewFor (art §4.3, campus-scene v0.3 §4.2)", () => {
  it("uses overview at 1280×800 with zoom 26.9", () => {
    const view = viewFor(1280, 800);
    expect(view.mode).toBe("overview");
    expect(Math.abs(view.zoom - 26.9)).toBeLessThanOrEqual(0.1);
    expect(view.insetTop).toBe(0);
  });

  it("keeps common laptops in overview and drops 1024×768 to follow", () => {
    const short = viewFor(1366, 657);
    expect(short.mode).toBe("overview");
    expect(Math.abs(short.zoom - 22.7)).toBeLessThanOrEqual(0.1);
    expect(viewFor(1536, 730).mode).toBe("overview");
    expect(viewFor(1280, 720).mode).toBe("overview");
    expect(viewFor(1024, 768).mode).toBe("follow");
  });

  it("uses follow at 375×812 with zoom 29.8", () => {
    const view = viewFor(375, 812);
    expect(view.mode).toBe("follow");
    expect(Math.abs(view.zoom - 29.8)).toBeLessThanOrEqual(0.1);
    expect(view.insetTop).toBe(72);
  });

  it("clamps the follow zoom to 28–40", () => {
    expect(viewFor(768, 1024).zoom).toBe(40);
    expect(viewFor(320, 600).zoom).toBe(28);
  });
});

describe("screen projection", () => {
  it("round-trips a ground point", () => {
    const screen = toScreen(-5.4, 0, 3.4);
    const ground = groundFromScreen(screen);
    expect(ground.x).toBeCloseTo(-5.4);
    expect(ground.z).toBeCloseTo(3.4);
  });

  it("moves world (-1, -1) up the screen, matching movement.ts", () => {
    const up = toScreen(-1, 0, -1);
    expect(up.sx).toBeCloseTo(0);
    expect(up.sy).toBeGreaterThan(0);
  });
});

describe("follow camera", () => {
  const view = viewFor(375, 812);

  it("stays still while the focus is inside the dead-zone", () => {
    expect(desiredCentre({ sx: 0, sy: 0 }, { sx: 0.5, sy: 0.5 }, view).sx).toBe(0);
  });

  it("slides up on a portrait phone, but not past the back of the model", () => {
    const next = desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 9 }, view);
    expect(next.sy).toBeCloseTo(CONTENT.maxY - (812 - 72) / (2 * view.zoom));
    expect(next.sy).toBeCloseTo(2.42, 1);
  });

  it("is pushed by exactly the overshoot when the focus leaves the dead-zone", () => {
    const halfW = (0.12 * 375) / view.zoom;
    const next = desiredCentre({ sx: 0, sy: 0 }, { sx: halfW + 1, sy: 0 }, view);
    expect(next.sx).toBeCloseTo(1);
  });

  it("never shows past the edge of the model", () => {
    const next = desiredCentre({ sx: 0, sy: 0 }, { sx: 100, sy: 0 }, view);
    expect(next.sx + 375 / (2 * view.zoom)).toBeCloseTo(CONTENT.maxX);
  });

  it("shifts the camera so the visible centre sits below the top HUD", () => {
    const centre = cameraCentre({ sx: 0, sy: 0 }, view);
    expect(centre.sy).toBeCloseTo(72 / (2 * view.zoom));
  });
});
