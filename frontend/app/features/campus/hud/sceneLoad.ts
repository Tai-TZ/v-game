import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

/**
 * How far the 3D scene has got, fed by real signals only (art §8.4): the app JS runs and asks
 * for the scene chunk, the chunk is evaluated, the canvas is in the DOM, the scene graph is
 * built, the first frame is on screen. No three.js here: the scene chunk imports this module,
 * never the other way round.
 */
export const STAGE = { open: 0, fetch: 1, boot: 2, build: 3, paint: 4, done: 5 } as const;
export const STEPS = 5;
/** The loader stays invisible this long, so fast entries never flash it (art §8.4). */
export const APPEAR_MS = 150;
export const FADE_MS = 200;
/** Safety net: the scene is built but no first frame was reported (lost context, missed tick). */
const FIRST_FRAME_TIMEOUT_MS = 2500;

export interface SceneLoad {
  /** Signals received so far, 0..5. */
  stage: number;
  /** performance.now() when `stage` was entered. */
  since: number;
  /** When the loader first painted for this entry: first contentful paint on a direct load. */
  begun: number;
  /** Entry counter, so a timer from an earlier visit cannot finish this one. */
  run: number;
  /** CampusScene is mounted. */
  live: boolean;
  /** SceneBoundary caught an error; sticky for the page session. */
  failed: boolean;
}

export const sceneLoad = createStore<SceneLoad>(() => ({
  stage: STAGE.open,
  since: 0,
  begun: 0,
  run: 0,
  live: false,
  failed: false,
}));

export const useSceneLoad = <T>(pick: (state: SceneLoad) => T) => useStore(sceneLoad, pick);

/** clientLoader: a new entry to /play. Revalidation (zone retry, `?at=` change) keeps a live scene. */
export function beginScene() {
  const s = sceneLoad.getState();
  if (s.live || s.failed) return;
  const now = performance.now();
  // Direct load: the pre-rendered loader has been on screen since the first paint.
  const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
  const begun = document.querySelector("[data-scene-loader]") ? fcp : now;
  sceneLoad.setState({ stage: STAGE.fetch, since: now, begun, run: s.run + 1 });
  performance.mark("vg-scene-1");
}

/** Monotonic: a repeated or late signal (StrictMode, a cached chunk) changes nothing. */
export function advanceScene(stage: number) {
  const s = sceneLoad.getState();
  if (stage <= s.stage || s.failed) return;
  sceneLoad.setState({ stage, since: performance.now() });
  performance.mark(`vg-scene-${stage}`);
  if (stage === STAGE.paint) {
    const { run } = s;
    setTimeout(() => {
      if (sceneLoad.getState().run === run) advanceScene(STAGE.done);
    }, FIRST_FRAME_TIMEOUT_MS);
  }
}

export function sceneMounted(live: boolean) {
  sceneLoad.setState({ live });
  if (live) advanceScene(STAGE.build);
}

export const failScene = () => sceneLoad.setState({ failed: true, since: performance.now() });

/** Per stage: the progress floor a, the ceiling b it never reaches, and the easing time τ (ms). */
export const CEILINGS: readonly (readonly [number, number, number])[] = [
  [0, 0, 1],
  [0, 0.6, 2500],
  [0.6, 0.72, 300],
  [0.72, 0.92, 600],
  [0.92, 1, 300],
];

/**
 * Diorama progress in [0, 1]. Inside a stage it eases towards 90% of the gap to the ceiling,
 * so nothing tied to the next signal ever shows early (honest-ceiling rule).
 */
export function progress(stage: number, msInStage: number, reduced: boolean): number {
  if (stage >= STAGE.done || reduced) return 1;
  const [a, b, tau] = CEILINGS[Math.max(stage, 0)] ?? [0, 0, 1];
  return a + (b - a) * 0.9 * (1 - Math.exp(-msInStage / tau));
}
