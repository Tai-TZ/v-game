import { addAfterEffect, Canvas, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Color,
  GreaterDepth,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type BufferGeometry,
  type InstancedMesh,
  type Material,
} from "three";

import { REDUCED_MOTION, useMediaQuery } from "~/lib/useMediaQuery";
import { useActiveTheme } from "~/features/theme/context";
import type { CampusTheme } from "~/features/theme/schema";

import { CAMERA_OFFSET } from "../camera";
import { advanceScene, sceneMounted, STAGE } from "../hud/sceneLoad";
import { NPC_SPOT, SITES } from "../layout";
import type { InteractTarget, SiteInfoMap } from "../sites";
import {
  BLOB_SEGMENTS,
  RING_SEGMENTS,
  TREE_INSTANCES,
  treeMatrix,
  type TreeInstance,
} from "./campus";
import { SUN_DIRECTION } from "./palette";
import { useCampusGeometry } from "./useCampusGeometry";
import { useHubFrame } from "./useHubFrame";
import { WorldLabels } from "./WorldLabels";

export interface CampusSceneProps {
  sites: SiteInfoMap;
  onInteract: (target: InteractTarget) => void;
}

const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(30).toArray();
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
  // Loader signal (hud/sceneLoad): the canvas is in the DOM. SceneReady sends the next two.
  useLayoutEffect(() => {
    sceneMounted(true);
    return () => sceneMounted(false);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 z-0 touch-manipulation">
        <Canvas
          orthographic
          flat
          frameloop="demand"
          dpr={[1, smallOrTouch ? 1.5 : 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{
            near: 0.1,
            far: 200,
            zoom: 30,
            position: [CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET],
          }}
        >
          <hemisphereLight args={["#ffffff", "#d1d1d1", 2.306]} />
          <directionalLight position={SUN_POSITION} intensity={1.087} />
          <Campus
            campus={campus}
            sites={sites}
            options={{ reducedMotion, countFrames, onInteract }}
          />
          <SceneReady />
        </Canvas>
      </div>
      <WorldLabels sites={sites} />
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
  sites: SiteInfoMap;
  options: Parameters<typeof useHubFrame>[0];
}

function Campus({ campus, sites, options }: CampusProps) {
  const g = useCampusGeometry(
    campus,
    sites.library.status,
    sites.watchtower.status,
    sites.market.status,
  );
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

  return (
    <>
      {/* Everything a click can land on (clickGoal); the figures, blobs and ring stay out. */}
      <group ref={statics}>
        <mesh geometry={g.terrain} material={materials.baked} />
        <mesh geometry={g.landmark} material={materials.baked} />
        {SITES.map(({ id }) => (
          <mesh key={id} geometry={g[id]} material={materials.baked} userData={{ site: id }} />
        ))}
        <Trees geometry={g.roundTree} material={materials.figure} trees={ROUND} />
        <Trees geometry={g.cypress} material={materials.figure} trees={CYPRESS} />
      </group>

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
}) {
  const { geometry, material, trees } = props;
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    trees.forEach((tree, i) => {
      mesh.setMatrixAt(i, treeMatrix(tree));
      mesh.setColorAt(i, shadeColour.setScalar(tree.brightness));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [geometry, trees]);
  return (
    <instancedMesh ref={ref} args={[geometry, material, trees.length]} frustumCulled={false} />
  );
}
