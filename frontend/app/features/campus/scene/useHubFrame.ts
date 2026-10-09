import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef } from "react";
import {
  Box3,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type Object3D,
} from "three";

import {
  cameraCentre,
  cameraOffset,
  desiredCentre,
  dragRate,
  easeFactor,
  groundFromScreen,
  HOME_YAW,
  PIVOT,
  rotateAbout,
  snapYaw,
  toScreen,
  viewFor,
  wrapAngle,
} from "../camera";
import { sceneLoad, STAGE } from "../hud/sceneLoad";
import {
  INTERACT_RADIUS,
  NPC_SPOT,
  OBSTACLES,
  SITES,
  speakerSpot,
  SPEAKERS,
  talkSpot,
  WORLD_BOUNDS,
  type Vec2,
} from "../layout";
import { isMovementKey, nearestWithin, step } from "../movement";
import { INTERACT_POINTS, type InteractTarget } from "../sites";
import { easeView, hubStore } from "../store";
import { LABEL_ANCHORS, labelElements, labelWidths, viewNeedle, type LabelId } from "./labels";

const FIGURE_Y = 0.045;
const LAN_REST_YAW = Math.PI / 4;
const RING_INTRO = 0.18;
const RING_PULSE = 0.7;
const RING_TOTAL = RING_INTRO + 2 * RING_PULSE;
const IDLE_DT = 1 / 60;
/** Keeps labels this far (px) from the viewport edges. */
const LABEL_MARGIN = 8;
/** Consecutive walking frames per DPR check; more than half slower than SLOW_FRAME steps down. */
const DPR_WINDOW = 45;
const SLOW_FRAME = 0.022;
/** A press moves this far (px) before it turns the view instead of clicking (orbit §2.1). */
const MOUSE_SLOP = 6;
const TOUCH_SLOP = 10;
/** A released drag settles on a diagonal in this long (orbit §2.4). */
const SNAP_SECONDS = 0.18;

/** Exponential approach of an angle; returns the target once within 0.01 rad. */
function turn(current: number, target: number, tau: number, dt: number, reduced: boolean) {
  const diff = wrapAngle(target - current);
  if (reduced || Math.abs(diff) < 0.01) return target;
  return current + diff * (1 - Math.exp(-dt / tau));
}

/** Ring scale: grows 0.85 → 1 in 180 ms (ease-out cubic), then two 1 → 1.1 → 1 pulses. */
function ringScale(t: number): number {
  if (t < RING_INTRO) return 0.85 + 0.15 * (1 - (1 - t / RING_INTRO) ** 3);
  if (t >= RING_TOTAL) return 1;
  const phase = ((t - RING_INTRO) % RING_PULSE) / RING_PULSE;
  return 1 + 0.1 * (0.5 - 0.5 * Math.cos(2 * Math.PI * phase));
}

/** No turn until the first frame is drawn at HOME_YAW, on the loader's blueprint. */
const painted = () => sceneLoad.getState().stage >= STAGE.paint;

/** Keys reach the scene only when focus is on the page itself or on the scene container. */
function sceneHasFocus(): boolean {
  const active = document.activeElement;
  return (
    active === null ||
    active === document.body ||
    (active instanceof HTMLElement && active.dataset.campusScene !== undefined)
  );
}

const pointer = new Vector2();
const raycaster = new Raycaster();
const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();
const projected = new Vector3();
const bodyBox = new Box3();

/**
 * The person whose body the ray meets before any static surface (orbit-camera §2.6): a box
 * 0.7 wide and 1.6 tall round each spot, head and feet included. From a turned view a building
 * can stand in front of someone; the click then belongs to the building.
 */
export function pickNpc<T>(
  ray: Raycaster,
  statics: Object3D | null,
  spots: readonly { id: T; spot: Vec2 }[],
): T | null {
  const [surface] = statics ? ray.intersectObject(statics, true) : [];
  let best: T | null = null;
  let nearest = surface?.distance ?? Infinity;
  for (const { id, spot } of spots) {
    bodyBox.min.set(spot.x - 0.35, 0, spot.z - 0.35);
    bodyBox.max.set(spot.x + 0.35, 1.6, spot.z + 0.35);
    const at = ray.ray.intersectBox(bodyBox, hit);
    const distance = at ? at.distanceTo(ray.ray.origin) : Infinity;
    if (distance < nearest) [best, nearest] = [id, distance];
  }
  return best;
}

/**
 * Where a click walks to (campus-scene v0.3 §2.5): the first surface drawn under the ray
 * (`statics`: buildings, terrain, trees), else the ground plane. A zone building's door when
 * that surface is the building's own mesh (tagged `userData.site`, awnings included, QA r4) or
 * the point is on its footprint. A click high on a tower thus lands on the tower, not on the
 * ground far behind it, and routeTo stands the player in front of the face that was clicked.
 */
export function clickGoal(ray: Raycaster, statics: Object3D | null): Vec2 | null {
  const [surface] = statics ? ray.intersectObject(statics, true) : [];
  const point = surface?.point ?? ray.ray.intersectPlane(groundPlane, hit);
  if (!point) return null;
  const tag: unknown = surface?.object.userData.site;
  const site =
    SITES.find(({ id }) => id === tag) ??
    SITES.find(
      ({ footprint: f }) =>
        Math.abs(point.x - f.x) <= f.halfX + 0.2 && Math.abs(point.z - f.z) <= f.halfZ + 0.2,
    );
  return site ? site.door : { x: point.x, z: point.z };
}

/**
 * The hub's per-frame loop and input. Reads and mutates `hubStore.motion` directly; the only
 * store writes that re-render React are coarse (nearby target, dialog). Requests a new frame
 * only while something moves, so an idle scene renders nothing (`frameloop="demand"`).
 */
export function useHubFrame(options: {
  reducedMotion: boolean;
  countFrames: boolean;
  /** A new light preset is picked but not baked yet: e2e must not see the scene as idle. */
  rebaking: boolean;
  onInteract: (target: InteractTarget) => void;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const player = useRef<Group>(null);
  const playerBlob = useRef<Mesh>(null);
  const lan = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const statics = useRef<Group>(null);
  const onInteract = useRef(options.onInteract);
  const reducedMotion = useRef(options.reducedMotion);
  const rebaking = useRef(options.rebaking);
  useEffect(() => {
    onInteract.current = options.onInteract;
    reducedMotion.current = options.reducedMotion;
    rebaking.current = options.rebaking;
  });

  const anim = useRef({
    yaw: hubStore.getState().motion.heading,
    lanYaw: LAN_REST_YAW,
    lanTarget: LAN_REST_YAW,
    walked: 0,
    ringFor: null as InteractTarget | null,
    ringTime: RING_TOTAL,
    /** The camera's look-at on the ground (a screen point means something for one yaw only). */
    look: null as Vec2 | null,
    /** The view yaw drawn last; its change since is how far to turn the look-at. */
    viewYaw: hubStore.getState().view.yaw,
    viewKey: "",
    inset: 0,
    insetEasing: false,
    wasBusy: false,
    slowFrames: 0,
    sampledFrames: 0,
  });

  const countFrames = options.countFrames;
  /**
   * Requests a frame. With ?debug=frames it also flags <html data-scene-busy> at once, so e2e
   * waits for the walk itself to end, never for a quiet spell (a starved software renderer can
   * go 500 ms between two frames mid-walk). The frame loop clears it on a frame that moves
   * nothing. Every input that starts motion goes through here (the store's `wake` included).
   */
  const wake = useCallback(() => {
    if (countFrames) document.documentElement.dataset.sceneBusy = "";
    invalidate();
  }, [countFrames, invalidate]);

  useEffect(() => {
    hubStore.getState().setWake(wake);
    return () => hubStore.getState().setWake(null);
  }, [wake]);

  /** The press that may turn into a drag of the view (orbit-camera §2.1). */
  const drag = useRef({ id: null as number | null, x0: 0, y0: 0, yaw0: 0, dragged: false });

  // Keyboard: movement keys, E, and , . to turn the view. Ignored while focus is in a button,
  // input or dialog.
  useEffect(() => {
    const { motion } = hubStore.getState();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!sceneHasFocus() || hubStore.getState().dialog) return;
      if (event.code === "Comma" || event.code === "Period") {
        event.preventDefault();
        // A drag owns the yaw until it ends; one press is one 90° step.
        if (event.repeat || !painted() || (drag.current.id !== null && drag.current.dragged)) {
          return;
        }
        hubStore.getState().rotateView(event.code === "Period" ? 1 : -1);
      } else if (isMovementKey(event.code)) {
        event.preventDefault();
        motion.keys.add(event.code);
        motion.target = null;
        motion.route = [];
        motion.talkOnArrival = null;
        wake();
      } else if (event.code === "KeyE" && !event.repeat) {
        const { nearby } = hubStore.getState();
        if (nearby) {
          event.preventDefault();
          onInteract.current(nearby);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (motion.keys.delete(event.code)) wake();
    };
    const release = () => {
      motion.keys.clear();
      wake();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [wake]);

  // Drag (mouse, pen, one finger) to turn the view; no inertia. Moves and the release are heard
  // on window, so a drag that leaves the canvas still ends.
  useEffect(() => {
    const d = drag.current;
    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || hubStore.getState().dialog || !painted()) {
        return;
      }
      Object.assign(d, {
        id: event.pointerId,
        x0: event.clientX,
        y0: event.clientY,
        dragged: false,
      });
      hubStore.getState().view.to = null; // a press stops a running turn where it is
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== d.id) return;
      const { view, wake } = hubStore.getState();
      if (!d.dragged) {
        const slop = event.pointerType === "mouse" ? MOUSE_SLOP : TOUCH_SLOP;
        if (Math.hypot(event.clientX - d.x0, event.clientY - d.y0) < slop) return;
        // Measured from here, so the view does not jump by the slop.
        Object.assign(d, { dragged: true, x0: event.clientX, yaw0: view.yaw });
        view.to = null;
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // An ended or synthetic pointer: the drag still runs while it stays over the canvas.
        }
        canvas.classList.add("cursor-grabbing");
      }
      view.yaw = wrapAngle(d.yaw0 - (event.clientX - d.x0) * dragRate(canvas.clientWidth));
      wake();
    };
    const onUp = (event: PointerEvent | FocusEvent) => {
      if (d.id === null || ("pointerId" in event && event.pointerId !== d.id)) return;
      d.id = null;
      canvas.classList.remove("cursor-grabbing");
      if (!d.dragged) return;
      const { view, wake } = hubStore.getState();
      const settle = snapYaw(view.yaw, reducedMotion.current);
      if (settle !== view.yaw) easeView(view, settle, SNAP_SECONDS);
      wake();
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, [canvas]);

  // Click / tap to walk: a person if the ray meets them first (pickNpc), else the scenery
  // (clickGoal). The click that ends a drag does nothing.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (drag.current.dragged) {
        drag.current.dragged = false;
        return;
      }
      const state = hubStore.getState();
      if (state.dialog) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const who = pickNpc(raycaster, statics.current, SPEAKERS);
      if (who) {
        if (state.nearby === who) {
          onInteract.current(who);
          return;
        }
        state.walkTo(talkSpot(who));
        state.motion.talkOnArrival = who;
      } else {
        const goal = clickGoal(raycaster, statics.current);
        if (goal) state.walkTo(goal);
      }
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [canvas, camera]);

  useFrame((three, delta) => {
    const { size } = three;
    const state = hubStore.getState();
    const { motion } = state;
    const a = anim.current;
    const reduced = reducedMotion.current;
    // After an idle gap the clock delta is huge; start a new movement with one normal frame.
    const dt = a.wasBusy ? Math.min(delta, 0.1) : IDLE_DT;
    let busy = false;

    // View yaw (orbit-camera §2.4): a drag writes view.yaw; keys, buttons and the release snap
    // ease out (cubic) over a fixed time. First, so the keys walk along what is drawn.
    const v = state.view;
    if (v.to !== null) {
      v.t += dt;
      const k = reduced || v.t >= v.duration ? 1 : 1 - (1 - v.t / v.duration) ** 3;
      v.yaw = wrapAngle(v.from + (v.to - v.from) * k);
      if (k === 1) v.to = null;
      else busy = true;
    }
    const turned = wrapAngle(v.yaw - a.viewYaw);
    a.viewYaw = v.yaw;
    // A turned frame is busy: drags count for the DPR step-down and get one closing frame.
    if (turned !== 0) busy = true;
    state.setRotated(Math.abs(wrapAngle(v.yaw - HOME_YAW)) > 0.001);

    // Movement.
    if (state.dialog) {
      motion.keys.clear();
      motion.target = null;
      motion.route = [];
    }
    const moved = step(
      motion.position,
      { keys: motion.keys, target: motion.target, yaw: v.yaw },
      dt,
      OBSTACLES,
      WORLD_BOUNDS,
    );
    if (moved.moving) {
      a.walked += Math.hypot(
        moved.position.x - motion.position.x,
        moved.position.z - motion.position.z,
      );
      busy = true;
    } else {
      a.walked = 0;
    }
    motion.position = moved.position; // also the ≤ 0.08 snap onto a reached target
    if (moved.heading !== null) motion.heading = moved.heading;

    const near = nearestWithin(motion.position, INTERACT_POINTS, INTERACT_RADIUS)?.id ?? null;
    state.setNearby(near);
    if (moved.targetDone) {
      // On to the next waypoint; the walk is over only when the route is empty.
      motion.target = motion.route.shift() ?? null;
      if (motion.target) busy = true;
      else if (motion.talkOnArrival) {
        if (near === motion.talkOnArrival) onInteract.current(near);
        motion.talkOnArrival = null;
      }
    }

    // Player figure: turn, bob while walking, blob shadow stays on the ground.
    const { x, z } = motion.position;
    a.yaw = turn(a.yaw, motion.heading, 0.06, dt, reduced);
    if (a.yaw !== motion.heading) busy = true;
    const bob =
      reduced || !moved.moving ? 0 : 0.035 * Math.abs(Math.sin((Math.PI * a.walked) / 0.5));
    player.current?.position.set(x, FIGURE_Y + bob, z);
    player.current?.rotation.set(0, a.yaw, 0);
    playerBlob.current?.position.set(x, 0.05, z);

    // The librarian turns to watch the player inside 3.0 and back to rest beyond 3.4.
    const lanDistance = Math.hypot(x - NPC_SPOT.x, z - NPC_SPOT.z);
    if (lanDistance < 3) a.lanTarget = Math.atan2(x - NPC_SPOT.x, z - NPC_SPOT.z);
    else if (lanDistance > 3.4) a.lanTarget = LAN_REST_YAW;
    a.lanYaw = turn(a.lanYaw, a.lanTarget, 0.12, dt, reduced);
    if (a.lanYaw !== a.lanTarget) busy = true;
    lan.current?.rotation.set(0, a.lanYaw, 0);

    // Interaction ring under the nearest point, with a short intro then still.
    const ringMesh = ring.current;
    if (near !== a.ringFor) {
      a.ringFor = near;
      a.ringTime = reduced ? RING_TOTAL : 0;
    }
    if (ringMesh) {
      const point = INTERACT_POINTS.find((p) => p.id === near);
      ringMesh.visible = point !== undefined;
      if (point) {
        a.ringTime = Math.min(a.ringTime + dt, RING_TOTAL);
        ringMesh.position.set(point.door.x, 0.052, point.door.z);
        ringMesh.scale.setScalar(ringScale(a.ringTime));
        if (a.ringTime < RING_TOTAL) busy = true;
      }
    }

    // Camera: overview orbiting PIVOT, or follow with a dead-zone (art §4), both in the screen
    // axes of the current yaw.
    const view = viewFor(size.width, size.height, state.sheetInset);
    const at = state.dialog ? speakerSpot(state.dialog.who) : motion.position;
    // Turn the look-at with the view: round what follow tracks, or round PIVOT in overview, whose
    // look-at is PIVOT + 0.416·h(yaw) (orbit-camera §1.4). Nothing slides on screen meanwhile.
    if (turned !== 0 && a.look) {
      a.look = rotateAbout(a.look, view.mode === "follow" ? at : PIVOT, turned);
    }
    const shift = (view.insetTop - view.insetBottom) / (2 * view.zoom);
    const focus = toScreen(at.x, 0, at.z, v.yaw);
    const viewKey = `${size.width}x${size.height}`;
    let cam = a.look ? toScreen(a.look.x, 0, a.look.z, v.yaw) : null;
    const current = cam ? { sx: cam.sx, sy: cam.sy - shift } : focus;
    const goal = cameraCentre(
      desiredCentre(current, focus, view, state.dialog !== null, v.yaw),
      view,
    );
    if (!cam || viewKey !== a.viewKey) {
      cam = goal;
      a.viewKey = viewKey;
      a.inset = view.insetBottom;
    } else {
      if (view.insetBottom !== a.inset) {
        a.inset = view.insetBottom;
        a.insetEasing = true;
      }
      const k = easeFactor(a.insetEasing ? 6 : 10, dt, reduced);
      cam = { sx: cam.sx + (goal.sx - cam.sx) * k, sy: cam.sy + (goal.sy - cam.sy) * k };
      if (Math.hypot(goal.sx - cam.sx, goal.sy - cam.sy) < 0.005) {
        cam = goal;
        a.insetEasing = false;
      } else {
        busy = true;
      }
    }
    const look = groundFromScreen(cam, v.yaw);
    a.look = look;
    const [ox, oy, oz] = cameraOffset(v.yaw);
    const { camera } = three;
    camera.position.set(look.x + ox, oy, look.z + oz);
    camera.lookAt(look.x, 0, look.z);
    if (camera.zoom !== view.zoom) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    // The compass needle points where home's "up" is (a CSSOM write, like the labels).
    const needle = viewNeedle.element;
    if (needle) needle.style.transform = `rotate(${(v.yaw - HOME_YAW).toFixed(4)}rad)`;

    // DOM labels follow their anchors, clamped inside the viewport; in follow mode, hide those
    // whose anchor is well off screen.
    for (const id of Object.keys(LABEL_ANCHORS) as LabelId[]) {
      const element = labelElements.get(id);
      if (!element) continue;
      const [ax, ay, az] = LABEL_ANCHORS[id];
      projected.set(ax, ay, az).project(camera);
      const px = ((projected.x + 1) / 2) * size.width;
      const py = ((1 - projected.y) / 2) * size.height;
      const half = (labelWidths.get(id) ?? 0) / 2 + LABEL_MARGIN;
      const lx = Math.min(Math.max(px, half), size.width - half);
      element.style.transform = `translate3d(${lx.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -100%)`;
      element.hidden =
        view.mode === "follow" &&
        (px < -24 || py < -24 || px > size.width + 24 || py > size.height + 24);
    }

    // Step the pixel ratio down (2 → 1.5 → 1) while the scene animates below ~45 FPS: more than
    // half of a window of consecutive busy (animating) frames slower than 22 ms (a median test,
    // no sort). An idle frame, or the first busy one after it, starts a new window.
    if (busy && a.wasBusy && three.viewport.dpr > 1) {
      a.sampledFrames += 1;
      if (delta > SLOW_FRAME) a.slowFrames += 1;
      if (a.sampledFrames === DPR_WINDOW) {
        if (a.slowFrames > DPR_WINDOW / 2) three.setDpr(three.viewport.dpr > 1.5 ? 1.5 : 1);
        a.sampledFrames = 0;
        a.slowFrames = 0;
      }
    } else {
      a.sampledFrames = 0;
      a.slowFrames = 0;
    }

    if (countFrames) {
      const root = document.documentElement;
      root.dataset.frames = String(Number(root.dataset.frames ?? "0") + 1);
      // For e2e: the view in degrees [0, 360) and the player's ground position.
      root.dataset.yaw = (((((v.yaw * 180) / Math.PI) % 360) + 360) % 360).toFixed(3);
      root.dataset.player = `${x.toFixed(2)},${z.toFixed(2)}`;
      // The re-bake's own commit wakes the scene again (Campus), so the flag spans the gap.
      if (busy || rebaking.current) root.dataset.sceneBusy = "";
      else delete root.dataset.sceneBusy;
    }

    a.wasBusy = busy;
    if (busy) three.invalidate();
  });

  return { player, playerBlob, lan, ring, statics, wake };
}
