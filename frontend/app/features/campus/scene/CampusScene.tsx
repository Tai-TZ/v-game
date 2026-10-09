import { addAfterEffect, Canvas, useThree } from "@react-three/fiber";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  GreaterDepth,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MultiplyBlending,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  type SkinnedMesh,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from "three";

import { REDUCED_MOTION, useMediaQuery } from "~/lib/useMediaQuery";
import { readProgress } from "~/features/progress/progress";
import { useActiveTheme } from "~/features/theme/context";
import type { CampusTheme, TimeOfDay } from "~/features/theme/schema";

import { cameraOffset } from "../camera";
import { advanceScene, sceneLoad, sceneMounted, STAGE, type SceneLoad } from "../hud/sceneLoad";
import { ViewControls } from "../hud/ViewControls";
import { NPC_SPOT, NPCS, SITES } from "../layout";
import { siteLooks, type InteractTarget, type SiteInfoMap } from "../sites";
import { hubStore, useHub } from "../store";
import {
  BLOB_SEGMENTS,
  RING_SEGMENTS,
  TREE_INSTANCES,
  treeMatrix,
  type TreeInstance,
} from "./campus";
import { disposeFigure, loadCast, paintFigure, type CastJson, type CastRole } from "./cast";
import { useCampusGeometry, type CampusGeometry } from "./useCampusGeometry";
import { castFigures, FIGURE_Y, useHubFrame } from "./useHubFrame";
import { WorldLabels } from "./WorldLabels";

export interface CampusSceneProps {
  sites: SiteInfoMap;
  onInteract: (target: InteractTarget) => void;
}

const ROUND = TREE_INSTANCES.filter((tree) => tree.kind === "round");
const CYPRESS = TREE_INSTANCES.filter((tree) => tree.kind === "cypress");
const FLAT = -Math.PI / 2;

/**
 * The 3D hub (lazy-loaded so the HUD renders first). Canvas renders on demand only; every
 * shape is procedural and every colour comes from the active theme manifest.
 */
export default function CampusScene({ sites, onInteract }: CampusSceneProps) {
  const { campus } = useActiveTheme();
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const smallOrTouch = useMediaQuery("(pointer: coarse), (max-width: 767.98px)");
  const [countFrames] = useState(
    () => new URLSearchParams(window.location.search).get("debug") === "frames",
  );
  // Deferred: the click paints the pressed button first, then the scene re-bakes every group in
  // a background render, a long task on slow CPUs (QA r2; campus-scene v0.3 §13.1).
  const picked = useHub((state) => state.time) ?? campus.lights.default;
  const time = useDeferredValue(picked);
  // Loader signal (hud/sceneLoad): the canvas is in the DOM. SceneReady sends the next two.
  useLayoutEffect(() => {
    sceneMounted(true);
    return () => sceneMounted(false);
  }, []);

  return (
    <>
      {/*
        Dusk paints its own flat sky over the page's day sky (art §2.5). One finger reaches the
        drag that turns the view; two still pinch-zoom the page (orbit-camera §2.1).
      */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-0 touch-pinch-zoom select-none ${time === "dusk" ? "bg-scene-dusk" : ""}`}
      >
        <Canvas
          orthographic
          flat
          frameloop="demand"
          dpr={[1, smallOrTouch ? 1.5 : 2]}
          // The stencil buffer keeps overlapping sun-shadow polygons from darkening twice.
          gl={{ antialias: true, alpha: true, stencil: true, powerPreference: "high-performance" }}
          camera={{
            near: 0.1,
            far: 200,
            zoom: 30,
            // At the view's yaw, so the first frame is never drawn from the wrong side.
            position: cameraOffset(hubStore.getState().view.yaw),
          }}
        >
          <Campus
            campus={campus}
            time={time}
            sites={sites}
            options={{ reducedMotion, countFrames, rebaking: picked !== time, onInteract }}
          />
          <SceneReady />
        </Canvas>
      </div>
      <WorldLabels sites={sites} />
      <ViewControls />
    </>
  );
}

/**
 * Loader signals: the scene graph is built, then the first frame is on screen. Rendered last
 * inside the Canvas, it commits only once every sibling has resolved, so a child that suspends
 * (an asset still loading) holds the loader up instead of revealing an empty sky.
 */
function SceneReady() {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    advanceScene(STAGE.paint);
    // Runs after every loop tick and never invalidates, so an idle scene stays idle.
    const off = addAfterEffect(() => {
      if (gl.info.render.frame === 0) return; // a tick that rendered nothing
      off();
      // The next animation frame starts once the rendered one has been presented.
      requestAnimationFrame(() => advanceScene(STAGE.done));
    });
    return off;
  }, [gl]);
  return null;
}

interface CampusProps {
  campus: CampusTheme;
  time: TimeOfDay;
  sites: SiteInfoMap;
  options: Omit<Parameters<typeof useHubFrame>[0], "castPending" | "figures">;
}

/** The first frame is on screen: the cast's download starts only then (integration spec §2). */
const painted = (s: SceneLoad) => s.stage >= STAGE.done;

function Campus({ campus, time, sites, options }: CampusProps) {
  // Read once per visit: the workbench saves stars on a sibling route, so going back remounts
  // this (N9). If /play ever stays mounted under the workbench, re-read on a progress version
  // from the hub store instead (campus-scene v0.3 §13.5).
  const [progress] = useState(readProgress);
  const looks = siteLooks(sites, progress);
  const g = useCampusGeometry(campus, time, looks.library, looks.watchtower, looks.market);
  const preset = campus.lights[time];
  const sunPosition = useMemo(() => g.palette.light.sun.clone().multiplyScalar(30), [g.palette]);
  // undefined while cast.json loads, null if it failed: the statues stand in until (unless) then.
  const [cast, setCast] = useState<CastJson | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const start = (s: SceneLoad) => {
      if (!painted(s)) return;
      off();
      void loadCast().then((c) => live && setCast(c));
    };
    const off = sceneLoad.subscribe(start);
    start(sceneLoad.getState());
    return () => {
      live = false;
      off();
    };
  }, []);
  const materials = useMemo(
    () => ({
      baked: new MeshBasicMaterial({ vertexColors: true }),
      figure: new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      blob: new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
      xray: new MeshBasicMaterial({ depthFunc: GreaterDepth, depthWrite: false }),
      ring: new MeshBasicMaterial(),
      // Multiplies the ground under it (N8); the stencil lets each pixel darken only once.
      shadow: new MeshBasicMaterial({
        vertexColors: true,
        blending: MultiplyBlending,
        premultipliedAlpha: true,
        transparent: true,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: NotEqualStencilFunc,
        stencilZPass: ReplaceStencilOp,
      }),
    }),
    [],
  );
  useEffect(
    () => () => Object.values(materials).forEach((material: Material) => material.dispose()),
    [materials],
  );
  const figures = useMemo(() => (cast ? castFigures(cast, materials) : null), [cast, materials]);
  useEffect(
    () => () => {
      if (!figures) return;
      disposeFigure(figures.player.mesh); // the x-ray shares its geometry and skeleton
      for (const { mesh } of Object.values(figures.people)) disposeFigure(mesh);
    },
    [figures],
  );
  const { player, playerBlob, lan, ring, statics, wake } = useHubFrame({
    ...options,
    figures,
    castPending: cast === undefined,
  });
  // A re-bake (time or theme) wakes the scene the way a walk does, so ?debug=frames flags it
  // busy until the new geometry is drawn.
  useEffect(() => {
    materials.xray.color.copy(g.palette.xray);
    materials.ring.color.copy(g.palette.player);
    wake();
  }, [materials, g.palette, wake]);
  // Theme colours onto the figures (only colours change; integration spec §4), before the
  // frame that first shows them, so no figure is ever drawn unpainted.
  useLayoutEffect(() => {
    if (!figures || !cast) return;
    const pal = g.palette;
    const paint = (who: CastRole, mesh: SkinnedMesh, looks: Parameters<typeof paintFigure>[2]) =>
      paintFigure(mesh, cast.roles[who], looks);
    paint("player", figures.player.mesh, { top: pal.player, bottom: pal.pants });
    paint("lan", figures.people.lan.mesh, { top: pal.npc, bottom: pal.lanSkirt });
    for (const { id } of NPCS) {
      const look = campus.npcs[id];
      paint(id, figures.people[id].mesh, {
        top: new Color(look.top),
        bottom: new Color(look.bottom),
        accent: new Color(look.accent),
      });
    }
    wake();
  }, [figures, cast, g.palette, campus.npcs, wake]);
  // The cast settled: one frame shows it (or keeps the statues). ?debug=frames tells e2e.
  useEffect(() => {
    if (options.countFrames) {
      document.documentElement.dataset.cast =
        cast === undefined ? "loading" : cast ? "ready" : "failed";
    }
    wake();
  }, [cast, options.countFrames, wake]);

  // `?debug=frames` also exposes the building looks, so e2e can check the stars reach the scene.
  const looksKey = Object.entries(looks)
    .map(([id, look]) => `${id}:${look}`)
    .join(" ");
  useEffect(() => {
    if (options.countFrames) document.documentElement.dataset.looks = looksKey;
  }, [options.countFrames, looksKey]);

  return (
    <>
      {/* The lights shade the Lambert figures and trees exactly as the statics are baked. */}
      <hemisphereLight args={[preset.sky, preset.ground, preset.hemisphere]} />
      <directionalLight args={[preset.sun, preset.sunIntensity]} position={sunPosition} />
      {/* Everything a click can land on (clickGoal); the figures, blobs and ring stay out. */}
      <group ref={statics}>
        <mesh geometry={g.terrain} material={materials.baked} />
        <mesh geometry={g.landmark} material={materials.baked} />
        {SITES.map(({ id }) => (
          <mesh key={id} geometry={g[id]} material={materials.baked} userData={{ site: id }} />
        ))}
        <Trees geometry={g.roundTree} material={materials.figure} trees={ROUND} g={g} />
        <Trees geometry={g.cypress} material={materials.figure} trees={CYPRESS} g={g} />
      </group>
      <mesh geometry={g.shadow} material={materials.shadow} />

      {/* The people: statues until the baked cast arrives (kept if it fails). */}
      <group ref={player}>
        {figures ? (
          <primitive object={figures.player.body} />
        ) : (
          <>
            <mesh geometry={g.player} material={materials.xray} renderOrder={1} />
            <mesh geometry={g.player} material={materials.figure} renderOrder={2} />
          </>
        )}
      </group>
      <mesh ref={playerBlob} rotation-x={FLAT} material={materials.blob}>
        <circleGeometry args={[0.36, BLOB_SEGMENTS]} />
      </mesh>

      <group ref={lan} position={[NPC_SPOT.x, FIGURE_Y, NPC_SPOT.z]}>
        {figures ? (
          <primitive object={figures.people.lan.body} />
        ) : (
          <mesh geometry={g.lan} material={materials.figure} />
        )}
      </group>
      {figures ? (
        NPCS.map(({ id }) => <primitive key={id} object={figures.people[id].body} />)
      ) : (
        <mesh geometry={g.npcs} material={materials.figure} />
      )}

      <mesh ref={ring} rotation-x={FLAT} visible={false} material={materials.ring}>
        <ringGeometry args={[0.55, 0.66, RING_SEGMENTS]} />
      </mesh>
    </>
  );
}

const shadeColour = new Color();

function Trees(props: {
  geometry: BufferGeometry;
  material: Material;
  trees: readonly TreeInstance[];
  g: Pick<CampusGeometry, "palette" | "shadedTrees">;
}) {
  const { geometry, material, trees } = props;
  const { palette, shadedTrees } = props.g;
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    trees.forEach((tree, i) => {
      mesh.setMatrixAt(i, treeMatrix(tree));
      shadeColour.setScalar(tree.brightness);
      // Lambert takes no shadow: a tree in a building's shadow gets the ground's factor (QA r3).
      if (shadedTrees.has(tree)) shadeColour.multiply(palette.shadow);
      mesh.setColorAt(i, shadeColour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [geometry, trees, palette, shadedTrees]);
  return (
    <instancedMesh ref={ref} args={[geometry, material, trees.length]} frustumCulled={false} />
  );
}
