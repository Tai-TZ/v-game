import { describe, expect, it } from "vitest";

import {
  cameraCentre,
  cameraOffset,
  contentAt,
  desiredCentre,
  dragRate,
  groundFromScreen,
  HOME_YAW,
  nextIsoYaw,
  ORBIT_FRAME,
  PIVOT,
  rotateAbout,
  snapYaw,
  toScreen,
  viewFor,
  wrapAngle,
} from "./camera";

const deg = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
/** v0.3's screen bounds of the model at HOME_YAW (campus-scene v0.3 §4.1). */
const V03_CONTENT = { minX: -19.73, maxX: 26.03, minY: -12.05, maxY: 14.82 };
const YAWS = [0, 45, 135, 200, 315].map(deg);

describe("viewFor (art §4.3, orbit-camera §1.3)", () => {
  it("uses overview at 1280×800 with zoom 26.85", () => {
    const view = viewFor(1280, 800);
    expect(view.mode).toBe("overview");
    expect(Math.abs(view.zoom - 26.85)).toBeLessThanOrEqual(0.01);
    expect(view.insetTop).toBe(0);
  });

  it("keeps common laptops in overview and drops 1024×768 to follow", () => {
    const short = viewFor(1366, 657);
    expect(short.mode).toBe("overview");
    expect(Math.abs(short.zoom - 22.29)).toBeLessThanOrEqual(0.01);
    expect(viewFor(1536, 730).mode).toBe("overview");
    expect(Math.abs(viewFor(1280, 720).zoom - 24.6)).toBeLessThanOrEqual(0.01);
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
  it("round-trips a ground point at any yaw", () => {
    for (const yaw of YAWS) {
      const ground = groundFromScreen(toScreen(-5.4, 0, 3.4, yaw), yaw);
      expect(ground.x).toBeCloseTo(-5.4, 9);
      expect(ground.z).toBeCloseTo(3.4, 9);
    }
  });

  it("is v0.3's projection at HOME_YAW", () => {
    for (const [x, y, z] of [
      [-5.4, 0, 3.4],
      [10.6, 6.6, -4.8],
      [0, 2, 0],
    ] as const) {
      const screen = toScreen(x, y, z);
      expect(screen.sx).toBeCloseTo((x - z) / Math.SQRT2, 12);
      expect(screen.sy).toBeCloseTo((-x + 2 * y - z) / Math.sqrt(6), 12);
    }
    cameraOffset(HOME_YAW).forEach((n) => expect(n).toBeCloseTo(34.641, 3));
  });

  it("moves away from the camera up the screen and along R(yaw) to the right", () => {
    for (let d = 0; d < 360; d += 15) {
      const yaw = deg(d);
      expect(toScreen(-Math.sin(yaw), 0, -Math.cos(yaw), yaw).sy, `${d}°`).toBeGreaterThan(0);
      expect(toScreen(Math.cos(yaw), 0, -Math.sin(yaw), yaw).sx, `${d}°`).toBeGreaterThan(0);
    }
  });
});

describe("overview orbit (orbit-camera §1.3, §1.4)", () => {
  const view = viewFor(1280, 800);
  const lookAt = (yaw: number) =>
    groundFromScreen(
      cameraCentre(desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 0 }, view, false, yaw), view),
      yaw,
    );

  it("keeps PIVOT still on screen, 0.24 above the visible centre, at every yaw", () => {
    for (let d = 0; d < 360; d += 15) {
      const yaw = deg(d);
      const centre = desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 0 }, view, false, yaw);
      const pivot = toScreen(PIVOT.x, 0, PIVOT.z, yaw);
      expect(pivot.sx - centre.sx).toBeCloseTo(0, 9);
      expect(pivot.sy - centre.sy).toBeCloseTo(0.24, 9);
      expect(pivot.sy - centre.sy).toBeCloseTo(-(ORBIT_FRAME.top + ORBIT_FRAME.bottom) / 2, 9);
    }
  });

  it("looks at PIVOT + 0.416·h(yaw), which rotateAbout PIVOT carries from yaw to yaw", () => {
    for (const yaw of YAWS) {
      const look = lookAt(yaw);
      expect(look.x).toBeCloseTo(PIVOT.x + 0.416 * Math.sin(yaw), 3);
      expect(look.z).toBeCloseTo(PIVOT.z + 0.416 * Math.cos(yaw), 3);
      const turned = rotateAbout(look, PIVOT, deg(37));
      const next = lookAt(yaw + deg(37));
      expect(turned.x).toBeCloseTo(next.x, 9);
      expect(turned.z).toBeCloseTo(next.z, 9);
    }
  });

  it("keeps the pivot's place on screen when rotateAbout follows a yaw change", () => {
    const look = { x: 3, z: -1 };
    const pivot = { x: -2.5, z: 4 };
    for (const yaw of YAWS) {
      const delta = deg(23);
      const before = toScreen(pivot.x, 0, pivot.z, yaw);
      const beforeLook = toScreen(look.x, 0, look.z, yaw);
      const turned = rotateAbout(look, pivot, delta);
      const after = toScreen(pivot.x, 0, pivot.z, yaw + delta);
      const afterLook = toScreen(turned.x, 0, turned.z, yaw + delta);
      expect(after.sx - afterLook.sx).toBeCloseTo(before.sx - beforeLook.sx, 9);
      expect(after.sy - afterLook.sy).toBeCloseTo(before.sy - beforeLook.sy, 9);
    }
  });

  it("measures the model's corners as v0.3's CONTENT at HOME_YAW", () => {
    const content = contentAt(HOME_YAW);
    expect(Math.abs(content.minX - V03_CONTENT.minX)).toBeLessThan(0.01);
    expect(Math.abs(content.maxX - V03_CONTENT.maxX)).toBeLessThan(0.01);
    expect(Math.abs(content.minY - V03_CONTENT.minY)).toBeLessThan(0.01);
    expect(Math.abs(content.maxY - V03_CONTENT.maxY)).toBeLessThan(0.01);
  });
});

describe("turning the view (orbit-camera §2)", () => {
  it("wraps angles into (−π, π]", () => {
    expect(wrapAngle(deg(315))).toBeCloseTo(deg(-45));
    expect(wrapAngle(deg(-200))).toBeCloseTo(deg(160));
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI);
  });

  it("steps to the next diagonal, at least 1° away, across ±180°", () => {
    const next = (d: number, dir: -1 | 1) => Math.round(toDeg(nextIsoYaw(deg(d), dir)));
    expect(next(45, 1)).toBe(135);
    expect(next(45, -1)).toBe(-45);
    expect(next(100, 1)).toBe(135);
    expect(next(100, -1)).toBe(45);
    expect(next(135, 1)).toBe(-135);
    expect(next(-135, -1)).toBe(135);
    expect(next(134.5, 1)).toBe(-135);
    expect(next(-44.5, -1)).toBe(-135);
  });

  it("snaps a released drag within 12° of a diagonal, never with reduced motion", () => {
    const snap = (d: number, reduced = false) => toDeg(wrapAngle(snapYaw(deg(d), reduced)));
    expect(snap(50)).toBeCloseTo(45);
    expect(snap(57)).toBeCloseTo(45);
    expect(snap(58)).toBeCloseTo(58);
    expect(snap(304)).toBeCloseTo(-45);
    expect(snap(300)).toBeCloseTo(-60);
    expect(snap(50, true)).toBeCloseTo(50);
  });

  it("turns 0.3°/px at 1280 px and 0.6°/px on a phone", () => {
    expect(toDeg(dragRate(1280))).toBeCloseTo(0.3);
    expect(toDeg(dragRate(375))).toBeCloseTo(0.6);
  });
});

describe("follow camera", () => {
  const view = viewFor(375, 812);
  const top = contentAt(HOME_YAW).maxY;

  it("stays still while the focus is inside the dead-zone", () => {
    expect(desiredCentre({ sx: 0, sy: 0 }, { sx: 0.5, sy: 0.5 }, view).sx).toBe(0);
  });

  it("slides up on a portrait phone, but not past the back of the model", () => {
    const next = desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 9 }, view);
    expect(next.sy).toBeCloseTo(top - (812 - 72) / (2 * view.zoom));
    expect(next.sy).toBeCloseTo(2.42, 1);
    const turned = desiredCentre({ sx: 0, sy: 0 }, { sx: 0, sy: 30 }, view, false, deg(135));
    expect(turned.sy).toBeCloseTo(contentAt(deg(135)).maxY - (812 - 72) / (2 * view.zoom));
  });

  it("is pushed by exactly the overshoot when the focus leaves the dead-zone", () => {
    const halfW = (0.12 * 375) / view.zoom;
    const next = desiredCentre({ sx: 0, sy: 0 }, { sx: halfW + 1, sy: 0 }, view);
    expect(next.sx).toBeCloseTo(1);
  });

  it("never shows past the edge of the model", () => {
    for (const yaw of [HOME_YAW, deg(135)]) {
      const next = desiredCentre({ sx: 0, sy: 0 }, { sx: 100, sy: 0 }, view, false, yaw);
      expect(next.sx + 375 / (2 * view.zoom)).toBeCloseTo(contentAt(yaw).maxX);
    }
  });

  it("shifts the camera so the visible centre sits below the top HUD", () => {
    const centre = cameraCentre({ sx: 0, sy: 0 }, view);
    expect(centre.sy).toBeCloseTo(72 / (2 * view.zoom));
  });
});
