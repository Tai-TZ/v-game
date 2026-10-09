import { lazy, Suspense, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useNavigation, useRevalidator } from "react-router";

import { arrivalPose, parseArrival, SPAWN, SPAWN_HEADING } from "~/features/campus/layout";
import { HubTopBar } from "~/features/campus/hud/HubTopBar";
import { InteractHint } from "~/features/campus/hud/InteractHint";
import { LanDialog } from "~/features/campus/hud/LanDialog";
import { NpcDialog } from "~/features/campus/hud/NpcDialog";
import { advanceScene, beginScene, STAGE } from "~/features/campus/hud/sceneLoad";
import { SceneBoundary } from "~/features/campus/hud/SceneBoundary";
import { SceneLoader } from "~/features/campus/hud/SceneLoader";
import {
  FIRST_LIBRARY_LEVEL,
  isSpeaker,
  siteInfo,
  type InteractTarget,
} from "~/features/campus/sites";
import { NPC_ROLES } from "~/features/campus/npcs";
import { hubStore, useHub } from "~/features/campus/store";
import { useActiveTheme } from "~/features/theme/context";
import { loadZoneList } from "~/features/zones/api";
import { ZoneCard } from "~/features/zones/ZoneCard";
import { useDelayedFlag, useSettled } from "~/lib/useSettled";

import type { Route } from "./+types/play";

// three.js and the scene live in their own chunk; the HUD renders without waiting for it.
const loadScene = () => import("~/features/campus/scene/CampusScene");
const CampusScene = lazy(loadScene);

export const meta: Route.MetaFunction = () => [{ title: "Khuôn viên · V-Game" }];

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  // Start the scene chunk download now, in parallel with the route render. A failure reaches
  // SceneBoundary through lazy(). A new entry starts at the home view, where the loader's
  // blueprint is drawn, so the first 3D frame lands on it after the view was turned.
  if (beginScene()) hubStore.getState().resetView();
  void loadScene().then(
    () => advanceScene(STAGE.boot),
    () => undefined,
  );
  return {
    arrival: parseArrival(new URL(request.url).searchParams.get("at")),
    // Not awaited: the scene never waits for the API (brief §4.3).
    zones: loadZoneList(),
  };
}

export function HydrateFallback() {
  return (
    <main className="relative h-dvh overflow-hidden bg-scene">
      <SceneLoader shell />
    </main>
  );
}

export default function Play({ loaderData }: Route.ComponentProps) {
  const { arrival } = loaderData;
  const zones = useSettled(loaderData.zones);
  const sites = useMemo(() => siteInfo(zones?.ok ? zones.zones : null), [zones]);
  const dialog = useHub((state) => state.dialog);
  const visits = useHub((state) => (state.dialog ? (state.met[state.dialog.who] ?? 0) : 0));
  const { npcs } = useActiveTheme().campus;
  const navigate = useNavigate();
  const opening = useNavigation().state === "loading";
  const revalidator = useRevalidator();
  const showCardSkeleton = useDelayedFlag(zones === undefined, 300);

  // Stand at the door of the zone we came back from (`?at=`), otherwise at the spawn.
  useEffect(() => {
    const pose = arrival ? arrivalPose(arrival) : { position: SPAWN, heading: SPAWN_HEADING };
    const state = hubStore.getState();
    state.closeDialog();
    state.placePlayer(pose.position, pose.heading);
  }, [arrival]);

  const enterZone = useCallback(
    (zoneId: string) => {
      hubStore.getState().closeDialog();
      void navigate(`/play/${zoneId}`);
    },
    [navigate],
  );

  const onInteract = useCallback(
    (target: InteractTarget) => {
      if (isSpeaker(target)) {
        hubStore.getState().openDialog(target);
        return;
      }
      const site = sites[target];
      if (site.status === "open") enterZone(site.zoneId);
    },
    [sites, enterZone],
  );

  const retry = () => void revalidator.revalidate();
  const library = sites.library;
  const npcZone = dialog && dialog.who !== "lan" ? NPC_ROLES[dialog.who].zone : null;
  const npcSite = npcZone ? sites[npcZone] : null;

  return (
    <main className="relative h-dvh overflow-hidden bg-scene">
      <h1 className="sr-only">Khuôn viên</h1>
      {/* role="application": keys typed here move the player instead of scrolling the page. */}
      <div
        data-campus-scene
        role="application"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focus target for the movement keys
        tabIndex={0}
        aria-label="Sa bàn khuôn viên"
        aria-describedby="campus-scene-help"
        className="absolute inset-0 focus-visible:-outline-offset-4"
      >
        <p id="campus-scene-help" className="sr-only">
          Dùng phím mũi tên hoặc W, A, S, D để đi, phím E để nói chuyện hoặc vào khu. Mọi việc cũng
          làm được qua nút Các khu. Kéo hoặc vuốt ngang để xoay sa bàn, phím phẩy và chấm xoay 90
          độ.
        </p>
        <SceneBoundary>
          {/* The loader below covers the wait, outside Suspense, until the first frame. */}
          <Suspense fallback={null}>
            <CampusScene sites={sites} onInteract={onInteract} />
          </Suspense>
        </SceneBoundary>
      </div>

      <SceneLoader />
      <HubTopBar zones={zones} onTalk={(who) => hubStore.getState().talkTo(who)} onRetry={retry} />
      <InteractHint sites={sites} onInteract={onInteract} />

      {dialog?.who === "lan" && (
        <LanDialog
          lines={dialog.lines}
          library={library}
          // The dialog stays open, saying the level is opening, until the level has loaded.
          onTeach={() =>
            void Promise.resolve(navigate(`/play/${library.zoneId}/${FIRST_LIBRARY_LEVEL}`)).then(
              () => hubStore.getState().closeDialog(),
            )
          }
          opening={opening}
          onEnter={() => enterZone(library.zoneId)}
          onClose={() => hubStore.getState().closeDialog()}
          zonesFailed={zones?.ok === false}
          onRetry={retry}
          zoneCard={
            library.zone ? (
              <ZoneCard zone={library.zone} variant="full" />
            ) : (
              showCardSkeleton && <div aria-hidden="true" className="h-28 rounded-sm bg-subtle" />
            )
          }
        />
      )}
      {dialog && dialog.who !== "lan" && (
        <NpcDialog
          who={dialog.who}
          name={npcs[dialog.who].name}
          visits={visits}
          site={npcSite}
          onEnter={() => npcSite && enterZone(npcSite.zoneId)}
          onClose={() => hubStore.getState().closeDialog()}
          zoneCard={npcSite?.zone && <ZoneCard zone={npcSite.zone} variant="full" />}
        />
      )}
    </main>
  );
}
