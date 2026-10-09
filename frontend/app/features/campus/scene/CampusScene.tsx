import { Canvas, useThree } from "@react-three/fiber";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  GreaterDepth,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MultiplyBlending,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from "three";

import { REDUCED_MOTION, useMediaQuery } from "~/lib/useMediaQuery";
import { readProgress } from "~/features/progress/progress";
import { useActiveTheme } from "~/features/theme/context";
import type { CampusTheme, TimeOfDay } from "~/features/theme/schema";

import { CAMERA_OFFSET } from "../camera";
import { NPC_SPOT, SITES } from "../layout";
import { siteLooks, type InteractTarget, type SiteInfoMap } from "../sites";
import { useHub } from "../store";
import {
  BLOB_SEGMENTS,
  RING_SEGMENTS,
  TREE_INSTANCES,
  treeMatrix,
  type TreeInstance,
} from "./campus";
import { useCampusGeometry, type CampusGeometry } from "./useCampusGeometry";
import { useHubFrame } from "./useHubFrame";
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
  const time = useDeferredValue(useHub((state) => state.time) ?? campus.lights.default);

  return (
    <>
      {/* Dusk paints its own flat sky over the page's day sky (art §2.5). */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 z-0 touch-manipulation ${time === "dusk" ? "bg-scene-dusk" : ""}`}
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
            position: [CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET],
          }}
        >
          <Campus
            campus={campus}
            time={time}
            sites={sites}
            options={{ reducedMotion, countFrames, onInteract }}
          />
        </Canvas>
      </div>
      <WorldLabels sites={sites} />
    </>
  );
}

interface CampusProps {
  campus: CampusTheme;
  time: TimeOfDay;
  sites: SiteInfoMap;
  options: Parameters<typeof useHubFrame>[0];
}

function Campus({ campus, time, sites, options }: CampusProps) {
  // Read once per visit: the workbench saves stars on a sibling route, so going back remounts
  // this (N9). If /play ever stays mounted under the workbench, re-read on a progress version
  // from the hub store instead (campus-scene v0.3 §13.5).
  const [progress] = useState(readProgress);
  const looks = siteLooks(sites, progress);
  const g = useCampusGeometry(campus, time, looks.library, looks.watchtower, looks.market);
  const preset = campus.lights[time];
  const sunPosition = useMemo(() => g.palette.light.sun.clone().multiplyScalar(30), [g.palette]);
  const invalidate = useThree((state) => state.invalidate);
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
  useEffect(() => {
    materials.xray.color.copy(g.palette.xray);
    materials.ring.color.copy(g.palette.player);
    invalidate();
  }, [materials, g.palette, invalidate]);

  const { player, playerBlob, lan, ring, statics } = useHubFrame(options);

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

      <group ref={player}>
        <mesh geometry={g.player} material={materials.xray} renderOrder={1} />
        <mesh geometry={g.player} material={materials.figure} renderOrder={2} />
      </group>
      <mesh ref={playerBlob} rotation-x={FLAT} material={materials.blob}>
        <circleGeometry args={[0.36, BLOB_SEGMENTS]} />
      </mesh>

      <group ref={lan} position={[NPC_SPOT.x, 0.045, NPC_SPOT.z]}>
        <mesh geometry={g.lan} material={materials.figure} />
      </group>
      <mesh position={[NPC_SPOT.x, 0.05, NPC_SPOT.z]} rotation-x={FLAT} material={materials.blob}>
        <circleGeometry args={[0.4, BLOB_SEGMENTS]} />
      </mesh>

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
