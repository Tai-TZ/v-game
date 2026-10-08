import { describe, expect, it, vi } from "vitest";

import { BACK_SPOT, INTERACT_RADIUS, NPC_TALK_SPOT, routeTo, SITES, SPAWN } from "./layout";
import { nearestWithin } from "./movement";
import { hintFor, INTERACT_POINTS, siteInfo } from "./sites";
import { createHubStore } from "./store";

describe("nearest interaction point", () => {
  it("picks the librarian from her talk spot and nothing from the spawn", () => {
    expect(nearestWithin(NPC_TALK_SPOT, INTERACT_POINTS, INTERACT_RADIUS)?.id).toBe("lan");
    expect(nearestWithin(SPAWN, INTERACT_POINTS, INTERACT_RADIUS)).toBeNull();
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
    store.getState().openDialog();
    expect(store.getState().dialog).toBe("first");
    expect(store.getState().metLan).toBe(false);

    store.getState().closeDialog();
    expect(store.getState().dialog).toBeNull();
    expect(store.getState().metLan).toBe(true);

    store.getState().openDialog();
    expect(store.getState().dialog).toBe("again");
  });

  it("only notifies listeners when the nearby target really changes", () => {
    const store = createHubStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.getState().setNearby("lan");
    store.getState().setNearby("lan");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("places the player next to the librarian when talking from the zone list", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    store.getState().motion.target = { x: 9, z: 9 };

    store.getState().talkToLan();

    const { motion, nearby, dialog } = store.getState();
    expect(motion.position).toEqual(NPC_TALK_SPOT);
    expect(motion.target).toBeNull();
    expect(nearby).toBe("lan");
    expect(dialog).toBe("first");
    expect(wake).toHaveBeenCalled();
  });

  it("walks to the back of campus along the route, and placing the player drops the route", () => {
    const store = createHubStore();
    const wake = vi.fn();
    store.getState().setWake(wake);
    store.getState().motion.talkOnArrival = true;

    store.getState().walkTo(BACK_SPOT);

    const { motion } = store.getState();
    expect([motion.target, ...motion.route]).toEqual(routeTo(SPAWN, BACK_SPOT));
    expect(motion.route.length).toBeGreaterThan(0);
    expect(motion.route.at(-1)).toEqual(BACK_SPOT);
    expect(motion.talkOnArrival).toBe(false);
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

describe("hints (brief §4)", () => {
  it("uses the verbatim copy, with API names when present", () => {
    const fallback = siteInfo(null);
    expect(hintFor("lan", fallback)).toEqual({
      text: "Nhấn E hoặc chạm để nói chuyện với cô Lan",
      actionable: true,
    });
    expect(hintFor("library", fallback).text).toBe("Nhấn E để vào Thư viện");
    expect(hintFor("watchtower", fallback)).toEqual({
      text: "Tháp canh · Sắp mở",
      actionable: false,
    });
    expect(hintFor("market", fallback).text).toBe("Chợ model · Sắp mở");
  });
});
