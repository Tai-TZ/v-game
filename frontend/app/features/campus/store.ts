import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { HOME_YAW, nextIsoYaw, wrapAngle } from "./camera";
import {
  INTERACT_RADIUS,
  routeTo,
  SPAWN,
  SPAWN_HEADING,
  speakerSpot,
  talkSpot,
  towardFor,
  type Speaker,
  type Vec2,
} from "./layout";
import { nearestWithin } from "./movement";
import { INTERACT_POINTS, type InteractTarget } from "./sites";
import { sceneLook, type Display, type Phase, type SceneLook, type Weather } from "./sky";

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
  /** Who to talk to when the walk ends next to them (a click on a person or a "!" badge). */
  talkOnArrival: Speaker | null;
  keys: Set<string>;
}

/**
 * Camera azimuth (camera.ts yaw), mutated in place like `motion`: drags write `yaw`; while `to`
 * is set the frame loop eases `yaw` from `from` to `to` (unwrapped, so the ease turns the way it
 * was asked) over `duration` seconds.
 */
export interface ViewYaw {
  yaw: number;
  from: number;
  to: number | null;
  t: number;
  duration: number;
}

/** A rotate key, button or the compass turns in 0.3 s (orbit-camera §2.4). */
export const TURN_SECONDS = 0.3;

/**
 * Starts an ease from the shown yaw to `target`: the short way for `dir` 0, else the way `dir`
 * turns (+1 clockwise from above, yaw growing).
 */
export function easeView(view: ViewYaw, target: number, duration: number, dir: -1 | 0 | 1 = 0) {
  let delta = wrapAngle(target - view.yaw);
  if (dir > 0 && delta < 0) delta += 2 * Math.PI;
  if (dir < 0 && delta > 0) delta -= 2 * Math.PI;
  Object.assign(view, { from: view.yaw, to: view.yaw + delta, t: 0, duration });
}

export type DialogLines = "first" | "again";

/** The open conversation: who with, and whether it is the first meeting in this session. */
export interface HubDialog {
  who: Speaker;
  lines: DialogLines;
}

/** The hub's sky (campus v0.4 W3): written only on change, never per frame. */
export interface HubSky {
  phase: Phase;
  /** The last good /api/weather body; null until one arrives. */
  weather: Weather | null;
  /** No weather yet and the last fetch failed: the chip says so instead of "loading". */
  failed: boolean;
  display: Display;
  /** Replaced only when (display, phase, weather group) changes: the scene re-bakes on it. */
  look: SceneLook;
}

export interface HubState {
  /** Coarse state for the HUD: the interaction point the player stands next to. */
  nearby: InteractTarget | null;
  /** The open dialog; null when closed. */
  dialog: HubDialog | null;
  /** Dialogs closed with each speaker in this session (npc-cast v0.4 §7.3). */
  met: Partial<Record<Speaker, number>>;
  /** Height (px) of the bottom sheet covering the scene, for the follow camera. */
  sheetInset: number;
  sky: HubSky;
  motion: Motion;
  /**
   * Camera azimuth. Lasts for the current scene, revalidations included (a `?at=` change, a zone
   * retry); each new entry to /play resets it to HOME_YAW (resetView), where the loader's
   * blueprint is drawn.
   */
  view: ViewYaw;
  /** Coarse: the view is away from HOME_YAW (the compass button's disabled state). */
  rotated: boolean;
  /** Requests a frame from the scene (`invalidate`); a no-op until the scene mounts. */
  wake: () => void;
  /** True while the 3D scene is mounted. */
  sceneUp: boolean;

  setNearby: (target: InteractTarget | null) => void;
  openDialog: (who: Speaker) => void;
  closeDialog: () => void;
  /** Accessible path: place the player at `who`'s talk spot, facing them, and open the dialog. */
  talkTo: (who: Speaker) => void;
  placePlayer: (position: Vec2, heading: number) => void;
  /** Click-to-move to `goal`, through the lane waypoints when it is in another part of campus. */
  walkTo: (goal: Vec2) => void;
  setSheetInset: (px: number) => void;
  setPhase: (phase: Phase) => void;
  /** A fetched body, or null for a failed fetch (the last good body stays). */
  setWeather: (weather: Weather | null) => void;
  setDisplay: (display: Display) => void;
  /** Turn to the next diagonal, clockwise for +1; 0 goes back to HOME_YAW. */
  rotateView: (dir: -1 | 0 | 1) => void;
  setRotated: (rotated: boolean) => void;
  /**
   * Back to HOME_YAW at once: a new entry to /play starts at home, where the loader's blueprint
   * is drawn (hud/blueprint.ts), so its first 3D frame lands on it.
   */
  resetView: () => void;
  /** The scene's `invalidate` on mount; null on unmount. */
  setWake: (wake: (() => void) | null) => void;
}

const noop = () => undefined;

export function createHubStore() {
  return createStore<HubState>()((set, get) => {
    /** Writes the sky only when it changed; a new look wakes the scene, whose re-bake follows. */
    const setSky = (change: Partial<Omit<HubSky, "look">>) => {
      const sky = get().sky;
      const next = { ...sky, ...change };
      if (
        next.phase === sky.phase &&
        next.weather === sky.weather &&
        next.display === sky.display &&
        next.failed === sky.failed
      )
        return;
      const look = sceneLook(next.display, next.phase, next.weather?.condition ?? null);
      const same = (Object.keys(look) as (keyof SceneLook)[]).every((k) => look[k] === sky.look[k]);
      set({ sky: { ...next, look: same ? sky.look : look } });
      // Flags the scene busy at once (?debug=frames); the re-bake's commit wakes it again.
      if (!same) get().wake();
    };
    return {
      nearby: null,
      dialog: null,
      met: {},
      sheetInset: 0,
      sky: {
        phase: "day",
        weather: null,
        failed: false,
        display: "live",
        look: sceneLook("live", "day", null),
      },
      motion: {
        position: { ...SPAWN },
        heading: SPAWN_HEADING,
        target: null,
        route: [],
        talkOnArrival: null,
        keys: new Set(),
      },
      view: { yaw: HOME_YAW, from: HOME_YAW, to: null, t: 0, duration: 0 },
      rotated: false,
      wake: noop,
      sceneUp: false,

      setNearby: (nearby) => {
        if (nearby !== get().nearby) set({ nearby });
      },
      openDialog: (who) => {
        if (get().dialog) return;
        set({ dialog: { who, lines: get().met[who] ? "again" : "first" } });
        // The camera turns to the speaker and they start talking (useHubFrame).
        get().wake();
      },
      closeDialog: () => {
        const { dialog, met } = get();
        if (dialog) {
          set({
            dialog: null,
            met: { ...met, [dialog.who]: (met[dialog.who] ?? 0) + 1 },
            sheetInset: 0,
          });
        }
        get().wake();
      },
      talkTo: (who) => {
        const spot = speakerSpot(who);
        const talk = talkSpot(who);
        get().placePlayer(talk, Math.atan2(spot.x - talk.x, spot.z - talk.z));
        get().openDialog(who);
      },
      placePlayer: (position, heading) => {
        const { motion } = get();
        motion.position = { ...position };
        motion.heading = heading;
        motion.target = null;
        motion.route = [];
        motion.talkOnArrival = null;
        motion.keys.clear();
        get().setNearby(nearestWithin(position, INTERACT_POINTS, INTERACT_RADIUS)?.id ?? null);
        get().wake();
      },
      walkTo: (goal) => {
        const { motion } = get();
        const [next, ...rest] = routeTo(motion.position, goal, towardFor(get().view.yaw));
        motion.target = next ?? null;
        motion.route = rest;
        motion.talkOnArrival = null;
        motion.keys.clear();
        get().wake();
      },
      setSheetInset: (sheetInset) => {
        if (sheetInset !== get().sheetInset) {
          set({ sheetInset });
          get().wake();
        }
      },
      setPhase: (phase) => setSky({ phase }),
      setWeather: (weather) => {
        const old = get().sky.weather;
        if (!weather) {
          if (!old) setSky({ failed: true });
          return;
        }
        const same =
          old?.condition === weather.condition &&
          old.temperature_c === weather.temperature_c &&
          old.updated_at === weather.updated_at;
        if (!same) setSky({ weather, failed: false });
      },
      setDisplay: (display) => setSky({ display }),
      rotateView: (dir) => {
        const { view } = get();
        const target = dir === 0 ? HOME_YAW : nextIsoYaw(view.to ?? view.yaw, dir);
        easeView(view, target, TURN_SECONDS, dir);
        get().wake();
      },
      setRotated: (rotated) => {
        if (rotated !== get().rotated) set({ rotated });
      },
      resetView: () => {
        Object.assign(get().view, { yaw: HOME_YAW, to: null });
        get().setRotated(false);
      },
      setWake: (wake) => set({ wake: wake ?? noop, sceneUp: wake !== null }),
    };
  });
}

export type HubStore = ReturnType<typeof createHubStore>;

/** One store per page session, so "already met" survives a visit to a zone page and back. */
export const hubStore = createHubStore();

export function useHub<T>(selector: (state: HubState) => T): T {
  return useStore(hubStore, selector);
}
