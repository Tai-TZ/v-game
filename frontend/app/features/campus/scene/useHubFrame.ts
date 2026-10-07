import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Plane, Raycaster, Vector2, Vector3, type Group, type Mesh } from "three";

import {
  CAMERA_OFFSET,
  cameraCentre,
  desiredCentre,
  easeFactor,
  groundFromScreen,
  toScreen,
  viewFor,
  type Screen,
} from "../camera";
import {
  INTERACT_RADIUS,
  NPC_SPOT,
  NPC_TALK_SPOT,
  OBSTACLES,
  SITES,
  WORLD_BOUNDS,
} from "../layout";
import { isMovementKey, nearestWithin, step } from "../movement";
import { INTERACT_POINTS, type InteractTarget } from "../sites";
import { hubStore } from "../store";
import { LABEL_ANCHORS, labelElements, labelWidths, type LabelId } from "./labels";

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

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

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
const bodyPlane = new Plane(new Vector3(0, 1, 0), -0.7);
const hit = new Vector3();
const projected = new Vector3();

/**
 * The hub's per-frame loop and input. Reads and mutates `hubStore.motion` directly; the only
 * store writes that re-render React are coarse (nearby target, dialog). Requests a new frame
 * only while something moves, so an idle scene renders nothing (`frameloop="demand"`).
 */
export function useHubFrame(options: {
  reducedMotion: boolean;
  countFrames: boolean;
  onInteract: (target: InteractTarget) => void;
}) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const player = useRef<Group>(null);
  const playerBlob = useRef<Mesh>(null);
  const lan = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const onInteract = useRef(options.onInteract);
  const reducedMotion = useRef(options.reducedMotion);
  useEffect(() => {
    onInteract.current = options.onInteract;
    reducedMotion.current = options.reducedMotion;
  });

  const anim = useRef({
    yaw: hubStore.getState().motion.heading,
    lanYaw: LAN_REST_YAW,
    lanTarget: LAN_REST_YAW,
    walked: 0,
    ringFor: null as InteractTarget | null,
    ringTime: RING_TOTAL,
    cam: null as Screen | null,
    viewKey: "",
    inset: 0,
    insetEasing: false,
    wasBusy: false,
    slowFrames: 0,
    sampledFrames: 0,
  });

  useEffect(() => {
    hubStore.getState().setWake(invalidate);
    return () => hubStore.getState().setWake(() => undefined);
  }, [invalidate]);

  // Keyboard: movement keys and E. Ignored while focus is in a button, input or dialog.
  useEffect(() => {
    const { motion } = hubStore.getState();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!sceneHasFocus() || hubStore.getState().dialog) return;
      if (isMovementKey(event.code)) {
        event.preventDefault();
        motion.keys.add(event.code);
        motion.target = null;
        motion.talkOnArrival = false;
        invalidate();
      } else if (event.code === "KeyE" && !event.repeat) {
        const { nearby } = hubStore.getState();
        if (nearby) {
          event.preventDefault();
          onInteract.current(nearby);
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (motion.keys.delete(event.code)) invalidate();
    };
    const release = () => {
      motion.keys.clear();
      invalidate();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
    };
  }, [invalidate]);

  // Click / tap to walk: ray against the librarian's body height, then the ground plane.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const state = hubStore.getState();
      if (state.dialog) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const { motion } = state;
      const body = raycaster.ray.intersectPlane(bodyPlane, hit);
      if (body && Math.hypot(body.x - NPC_SPOT.x, body.z - NPC_SPOT.z) < 0.45) {
        if (state.nearby === "lan") {
          onInteract.current("lan");
          return;
        }
        motion.target = { ...NPC_TALK_SPOT };
        motion.talkOnArrival = true;
      } else {
        const ground = raycaster.ray.intersectPlane(groundPlane, hit);
        if (!ground) return;
        const site = SITES.find(
          ({ footprint: f }) =>
            Math.abs(ground.x - f.x) <= f.halfX + 0.2 && Math.abs(ground.z - f.z) <= f.halfZ + 0.2,
        );
        motion.target = site ? { ...site.door } : { x: ground.x, z: ground.z };
        motion.talkOnArrival = false;
      }
      invalidate();
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [canvas, camera, invalidate]);

  const countFrames = options.countFrames;

  useFrame((three, delta) => {
    const { size } = three;
    const state = hubStore.getState();
    const { motion } = state;
    const a = anim.current;
    const reduced = reducedMotion.current;
    // After an idle gap the clock delta is huge; start a new movement with one normal frame.
    const dt = a.wasBusy ? Math.min(delta, 0.1) : IDLE_DT;
    let busy = false;

    // Movement.
    if (state.dialog) {
      motion.keys.clear();
      motion.target = null;
    }
    const moved = step(
      motion.position,
      { keys: motion.keys, target: motion.target },
      dt,
      OBSTACLES,
      WORLD_BOUNDS,
    );
    if (moved.moving) {
      a.walked += Math.hypot(
        moved.position.x - motion.position.x,
        moved.position.z - motion.position.z,
      );
      motion.position = moved.position;
      busy = true;
    } else {
      a.walked = 0;
    }
    if (moved.heading !== null) motion.heading = moved.heading;

    const near = nearestWithin(motion.position, INTERACT_POINTS, INTERACT_RADIUS)?.id ?? null;
    state.setNearby(near);
    if (moved.targetDone) {
      motion.target = null;
      if (motion.talkOnArrival) {
        motion.talkOnArrival = false;
        if (near === "lan") onInteract.current("lan");
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

    // Camera: fixed overview, or follow with a dead-zone (art §4).
    const view = viewFor(size.width, size.height, state.sheetInset);
    const shift = (view.insetTop - view.insetBottom) / (2 * view.zoom);
    const focus = state.dialog ? toScreen(NPC_SPOT.x, 0, NPC_SPOT.z) : toScreen(x, 0, z);
    const viewKey = `${size.width}x${size.height}`;
    const current = a.cam ? { sx: a.cam.sx, sy: a.cam.sy - shift } : focus;
    const goal = cameraCentre(desiredCentre(current, focus, view, state.dialog !== null), view);
    if (!a.cam || viewKey !== a.viewKey) {
      a.cam = goal;
      a.viewKey = viewKey;
      a.inset = view.insetBottom;
    } else {
      if (view.insetBottom !== a.inset) {
        a.inset = view.insetBottom;
        a.insetEasing = true;
      }
      const k = easeFactor(a.insetEasing ? 6 : 10, dt, reduced);
      a.cam = { sx: a.cam.sx + (goal.sx - a.cam.sx) * k, sy: a.cam.sy + (goal.sy - a.cam.sy) * k };
      if (Math.hypot(goal.sx - a.cam.sx, goal.sy - a.cam.sy) < 0.005) {
        a.cam = goal;
        a.insetEasing = false;
      } else {
        busy = true;
      }
    }
    const look = groundFromScreen(a.cam);
    const { camera } = three;
    camera.position.set(look.x + CAMERA_OFFSET, CAMERA_OFFSET, look.z + CAMERA_OFFSET);
    camera.lookAt(look.x, 0, look.z);
    if (camera.zoom !== view.zoom) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

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
    }

    a.wasBusy = busy;
    if (busy) three.invalidate();
  });

  return { player, playerBlob, lan, ring };
}
