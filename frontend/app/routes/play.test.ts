import { beforeEach, describe, expect, it, vi } from "vitest";

import { cameraCentre, desiredCentre, HOME_YAW, toScreen, viewFor } from "~/features/campus/camera";
import { blueprintViewBox, entryFocus } from "~/features/campus/hud/blueprint";
import { sceneLoad, sceneMounted } from "~/features/campus/hud/sceneLoad";
import { hubStore } from "~/features/campus/store";

import { clientLoader } from "./play";

vi.mock("~/features/campus/scene/CampusScene", () => ({ default: () => null }));
vi.mock("~/features/zones/api", () => ({ loadZoneList: () => new Promise(() => undefined) }));

const fresh = sceneLoad.getState();
const enter = (url = "http://localhost/play") =>
  clientLoader({ request: new Request(url) } as Parameters<typeof clientLoader>[0]);

/** The first 3D frame's viewBox, from the camera maths at the store's yaw (useHubFrame). */
function firstFrame(width: number, height: number, search: string) {
  const yaw = hubStore.getState().view.yaw;
  const view = viewFor(width, height);
  const player = entryFocus(search);
  const f = toScreen(player.x, 0, player.z, yaw);
  const c = cameraCentre(desiredCentre(f, f, view, false, yaw), view);
  const [w, h] = [width / view.zoom, height / view.zoom];
  return [c.sx - w / 2, -c.sy - h / 2, w, h].map((n) => Math.round(n * 1000) / 1000).join(" ");
}

beforeEach(() => {
  sceneLoad.setState(fresh, true);
  hubStore.getState().resetView();
});

describe("entering /play with the view turned (orbit-camera §3, loader handover)", () => {
  it("starts the scene at home, where the blueprint is drawn", () => {
    enter();
    sceneMounted(true);
    hubStore.getState().rotateView(1);
    const { view } = hubStore.getState();
    view.yaw = view.to ?? view.yaw;
    view.to = null;
    expect(firstFrame(1280, 800, "")).not.toBe(blueprintViewBox(1280, 800, entryFocus("")));

    // To a zone page and back: the scene unmounts, the next entry is a new one.
    sceneMounted(false);
    enter("http://localhost/play?at=library");
    expect(hubStore.getState().view.yaw).toBe(HOME_YAW);
    for (const [width, height] of [
      [1280, 800],
      [375, 812],
    ] as const) {
      expect(firstFrame(width, height, "?at=library")).toBe(
        blueprintViewBox(width, height, entryFocus("?at=library")),
      );
    }
  });

  it("keeps the view on a revalidation of the live scene", () => {
    enter();
    sceneMounted(true);
    hubStore.getState().view.yaw = 2;
    enter("http://localhost/play?at=market");
    expect(hubStore.getState().view.yaw).toBe(2);
    sceneMounted(false);
  });
});
