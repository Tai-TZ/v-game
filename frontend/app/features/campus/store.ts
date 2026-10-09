import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { TimeOfDay } from "~/features/theme/schema";

import {
  INTERACT_RADIUS,
  NPC_SPOT,
  NPC_TALK_SPOT,
  routeTo,
  SPAWN,
  SPAWN_HEADING,
  type Vec2,
} from "./layout";
import { nearestWithin } from "./movement";
import { INTERACT_POINTS, type InteractTarget } from "./sites";

/**
 * Per-frame player data. Mutated in place by the scene's frame loop and input handlers;
 * never passed to `set`, so it never re-renders React.
 */
export interface Motion {
  position: Vec2;
  heading: number;
  /** Click/tap destination, cleared on arrival. */
  target: Vec2 | null;
  /** Waypoints still to walk after `target` (front to back of campus, v0.3 §2.5). */
  route: Vec2[];
  /** Open the dialog when the current walk target is reached (clicked the librarian). */
  talkOnArrival: boolean;
  keys: Set<string>;
}

export type DialogLines = "first" | "again";

export interface HubState {
  /** Coarse state for the HUD: the interaction point the player stands next to. */
  nearby: InteractTarget | null;
  /** Which lines the open dialog shows; null when closed. */
  dialog: DialogLines | null;
  /** The player has talked to the librarian in this session. */
  metLan: boolean;
  /** Height (px) of the bottom sheet covering the scene, for the follow camera. */
  sheetInset: number;
  /** Light preset the player picked (N8); null follows the theme's default. */
  time: TimeOfDay | null;
  motion: Motion;
  /** Requests a frame from the scene (`invalidate`); a no-op until the scene mounts. */
  wake: () => void;
  /** True while the 3D scene is mounted: scene-only controls (the dusk toggle) show only then. */
  sceneUp: boolean;

  setNearby: (target: InteractTarget | null) => void;
  openDialog: () => void;
  closeDialog: () => void;
  /** Accessible path: place the player next to the librarian and open the dialog. */
  talkToLan: () => void;
  placePlayer: (position: Vec2, heading: number) => void;
  /** Click-to-move to `goal`, through the lane waypoints when it is in another part of campus. */
  walkTo: (goal: Vec2) => void;
  setSheetInset: (px: number) => void;
  setTime: (time: TimeOfDay) => void;
  /** The scene's `invalidate` on mount; null on unmount. */
  setWake: (wake: (() => void) | null) => void;
}

const noop = () => undefined;

export function createHubStore() {
  return createStore<HubState>()((set, get) => ({
    nearby: null,
    dialog: null,
    metLan: false,
    sheetInset: 0,
    time: null,
    motion: {
      position: { ...SPAWN },
      heading: SPAWN_HEADING,
      target: null,
      route: [],
      talkOnArrival: false,
      keys: new Set(),
    },
    wake: noop,
    sceneUp: false,

    setNearby: (nearby) => {
      if (nearby !== get().nearby) set({ nearby });
    },
    openDialog: () => {
      if (get().dialog) return;
      set({ dialog: get().metLan ? "again" : "first" });
    },
    closeDialog: () => {
      if (get().dialog) set({ dialog: null, metLan: true, sheetInset: 0 });
      get().wake();
    },
    talkToLan: () => {
      const heading = Math.atan2(NPC_SPOT.x - NPC_TALK_SPOT.x, NPC_SPOT.z - NPC_TALK_SPOT.z);
      get().placePlayer(NPC_TALK_SPOT, heading);
      get().openDialog();
    },
    placePlayer: (position, heading) => {
      const { motion } = get();
      motion.position = { ...position };
      motion.heading = heading;
      motion.target = null;
      motion.route = [];
      motion.talkOnArrival = false;
      motion.keys.clear();
      get().setNearby(nearestWithin(position, INTERACT_POINTS, INTERACT_RADIUS)?.id ?? null);
      get().wake();
    },
    walkTo: (goal) => {
      const { motion } = get();
      const [next, ...rest] = routeTo(motion.position, goal);
      motion.target = next ?? null;
      motion.route = rest;
      motion.talkOnArrival = false;
      motion.keys.clear();
      get().wake();
    },
    setSheetInset: (sheetInset) => {
      if (sheetInset !== get().sheetInset) {
        set({ sheetInset });
        get().wake();
      }
    },
    setTime: (time) => {
      set({ time });
      // Flags the scene busy at once (?debug=frames); the re-bake's commit wakes it again.
      get().wake();
    },
    setWake: (wake) => set({ wake: wake ?? noop, sceneUp: wake !== null }),
  }));
}

export type HubStore = ReturnType<typeof createHubStore>;

/** One store per page session, so "already met" survives a visit to a zone page and back. */
export const hubStore = createHubStore();

export function useHub<T>(selector: (state: HubState) => T): T {
  return useStore(hubStore, selector);
}
