import { describe, expect, it, vi } from "vitest";

import { HOME_YAW, wrapAngle } from "./camera";
import {
  BACK_SPOT,
  INTERACT_RADIUS,
  NPC_SPOT,
  NPC_TALK_SPOT,
  NPCS,
  routeTo,
  SITES,
  SPAWN,
  towardFor,
} from "./layout";
import { nearestWithin } from "./movement";
import { hintFor, INTERACT_POINTS, isSpeaker, siteInfo } from "./sites";
import { createHubStore } from "./store";

describe("nearest interaction point", () => {
  it("picks the librarian from her talk spot and nothing from the spawn", () => {
    expect(nearestWithin(NPC_TALK_SPOT, INTERACT_POINTS, INTERACT_RADIUS)?.id).toBe("lan");
    expect(nearestWithin(SPAWN, INTERACT_POINTS, INTERACT_RADIUS)).toBeNull();
  });

  it("picks each NPC from their talk spot", () => {
    for (const npc of NPCS) {
      expect(nearestWithin(npc.talk, INTERACT_POINTS, INTERACT_RADIUS)?.id).toBe(npc.id);
    }
  });

  it("picks a building from in front of its door", () => {
    for (const site of SITES) {
      expect(nearestWithin(site.door, INTERACT_POINTS, INTERACT_RADIUS)?.id).toBe(site.id);
    }
  });
});

describe("hub store", () => {
  it("opens the dialog with two lines first, one line afterwards", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    store.getState().openDialog("lan");
    expect(store.getState().dialog).toEqual({ who: "lan", lines: "first" });
    expect(store.getState().met).toEqual({});
    // The camera and the speaker's talk run in the scene's frames.
    expect(wake).toHaveBeenCalledOnce();

    store.getState().closeDialog();
    expect(store.getState().dialog).toBeNull();
    expect(store.getState().met).toEqual({ lan: 1 });

    store.getState().openDialog("lan");
    expect(store.getState().dialog).toEqual({ who: "lan", lines: "again" });
  });

  it("counts the closed dialogs per speaker, and opens only one at a time", () => {
    const store = createHubStore();
    store.getState().openDialog("guard");
    store.getState().openDialog("lan");
    expect(store.getState().dialog).toEqual({ who: "guard", lines: "first" });
    store.getState().closeDialog();
    store.getState().closeDialog();
    store.getState().openDialog("guard");
    expect(store.getState().dialog?.lines).toBe("again");
    store.getState().closeDialog();
    expect(store.getState().met).toEqual({ guard: 2 });
  });

  it("only notifies listeners when the nearby target really changes", () => {
    const store = createHubStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().setNearby("lan");
    store.getState().setNearby("lan");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("knows whether the scene is up from its wake handle", () => {
    const store = createHubStore();
    expect(store.getState().sceneUp).toBe(false);
    store.getState().setWake(vi.fn());
    expect(store.getState().sceneUp).toBe(true);
    store.getState().setWake(null);
    expect(store.getState().sceneUp).toBe(false);
    expect(() => store.getState().wake()).not.toThrow();
  });

  it("places the player next to the librarian when talking from the zone list", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    store.getState().motion.target = { x: 9, z: 9 };

    store.getState().talkTo("lan");

    const { motion, nearby, dialog } = store.getState();
    expect(motion.position).toEqual(NPC_TALK_SPOT);
    expect(motion.heading).toBeCloseTo(
      Math.atan2(NPC_SPOT.x - NPC_TALK_SPOT.x, NPC_SPOT.z - NPC_TALK_SPOT.z),
    );
    expect(motion.target).toBeNull();
    expect(nearby).toBe("lan");
    expect(dialog).toEqual({ who: "lan", lines: "first" });
    expect(wake).toHaveBeenCalled();
  });

  it.each(NPCS.map((npc) => [npc.id, npc] as const))(
    "places the player at %s's talk spot, facing them, and opens their dialog",
    (id, npc) => {
      const store = createHubStore();
      store.getState().talkTo(id);
      const { motion, nearby, dialog } = store.getState();
      expect(motion.position).toEqual(npc.talk);
      expect(motion.heading).toBeCloseTo(
        Math.atan2(npc.spot.x - npc.talk.x, npc.spot.z - npc.talk.z),
      );
      expect(nearby).toBe(id);
      expect(dialog).toEqual({ who: id, lines: "first" });
    },
  );

  it("walks to the back of campus along the route, and placing the player drops the route", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    store.getState().motion.talkOnArrival = "guard";

    store.getState().walkTo(BACK_SPOT);

    const { motion } = store.getState();
    expect([motion.target, ...motion.route]).toEqual(routeTo(SPAWN, BACK_SPOT));
    expect(motion.route.length).toBeGreaterThan(0);
    expect(motion.route.at(-1)).toEqual(BACK_SPOT);
    expect(motion.talkOnArrival).toBeNull();
    expect(wake).toHaveBeenCalled();

    store.getState().placePlayer(SPAWN, 0);
    expect(store.getState().motion.target).toBeNull();
    expect(store.getState().motion.route).toEqual([]);
  });

  it("recomputes the nearby target whenever the player is placed", () => {
    const store = createHubStore();
    store.getState().placePlayer(NPC_TALK_SPOT, 0);
    expect(store.getState().nearby).toBe("lan");
    store.getState().placePlayer(SPAWN, 0);
    expect(store.getState().nearby).toBeNull();
    for (const site of SITES) {
      store.getState().placePlayer(site.door, 0);
      expect(store.getState().nearby).toBe(site.id);
    }
  });
});

describe("view yaw (orbit-camera §2, §3)", () => {
  const deg = (d: number) => (d * Math.PI) / 180;
  /** Runs the frame loop's ease to its end. */
  const settle = (store: ReturnType<typeof createHubStore>) => {
    const { view } = store.getState();
    if (view.to !== null) view.yaw = wrapAngle(view.to);
    view.to = null;
  };

  it("turns 90° a press, chaining from the running target, and back home", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    const { view } = store.getState();
    expect(view.yaw).toBe(HOME_YAW);

    store.getState().rotateView(1);
    store.getState().rotateView(1);
    expect(view.to).not.toBeNull();
    expect(wrapAngle(view.to ?? 0)).toBeCloseTo(deg(-135));
    // Clockwise all the way: 180° from where the view shows, not back the short way.
    expect((view.to ?? 0) - view.from).toBeCloseTo(Math.PI);
    expect(view.duration).toBeCloseTo(0.3);
    expect(wake).toHaveBeenCalledTimes(2);

    settle(store);
    store.getState().rotateView(-1);
    expect(wrapAngle(view.to ?? 0)).toBeCloseTo(deg(135));
    settle(store);
    store.getState().rotateView(0);
    expect(wrapAngle(view.to ?? 0)).toBeCloseTo(HOME_YAW);
  });

  it("keeps turning counter-clockwise for quick presses, not back the short way", () => {
    const store = createHubStore();
    const { view } = store.getState();
    for (let i = 0; i < 3; i += 1) store.getState().rotateView(-1);
    expect(wrapAngle(view.to ?? 0)).toBeCloseTo(deg(135));
    expect((view.to ?? 0) - view.from).toBeCloseTo((-3 * Math.PI) / 2);
  });

  it("walks to the stand point on the side the view shows", () => {
    const store = createHubStore();
    const back = { x: 0, z: -9.8 };
    store.getState().view.yaw = deg(-135);
    store.getState().walkTo(back);
    const { motion } = store.getState();
    expect([motion.target, ...motion.route]).toEqual(routeTo(SPAWN, back, towardFor(deg(-135))));
  });

  it("keeps the view when the player is placed, and resets it for a new entry", () => {
    const store = createHubStore();
    store.getState().view.yaw = deg(135);
    store.getState().setRotated(true);
    store.getState().placePlayer(SPAWN, 0);
    expect(store.getState().view.yaw).toBe(deg(135));

    store.getState().view.to = deg(225);
    store.getState().resetView();
    expect(store.getState().view.yaw).toBe(HOME_YAW);
    expect(store.getState().view.to).toBeNull();
    expect(store.getState().rotated).toBe(false);
  });
});

/** Placeholder names: the real ones are theme data (npcs.test.ts keeps them out of app/). */
const NAMES = {
  guard: { name: "role guard" },
  registrar: { name: "role registrar" },
  operator: { name: "role operator" },
  examiner: { name: "role examiner" },
};

describe("hints (brief §4)", () => {
  it("uses the verbatim copy, with API names when present", () => {
    const fallback = siteInfo(null);
    expect(hintFor("lan", fallback, NAMES)).toEqual({
      text: "Nhấn E hoặc chạm để nói chuyện với cô Lan",
      actionable: true,
    });
    expect(hintFor("library", fallback, NAMES).text).toBe("Nhấn E để vào Thư viện");
    expect(hintFor("watchtower", fallback, NAMES)).toEqual({
      text: "Tháp canh · Sắp mở",
      actionable: false,
    });
    expect(hintFor("market", fallback, NAMES).text).toBe("Chợ model · Sắp mở");
  });

  it("names each NPC from the theme (npc-cast v0.4 §7.1)", () => {
    for (const npc of NPCS) {
      expect(isSpeaker(npc.id)).toBe(true);
      expect(hintFor(npc.id, siteInfo(null), NAMES)).toEqual({
        text: `Nhấn E hoặc chạm để nói chuyện với role ${npc.id}`,
        actionable: true,
      });
    }
    expect(isSpeaker("library")).toBe(false);
  });
});
