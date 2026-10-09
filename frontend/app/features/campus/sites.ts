import type { ZoneLocation, ZoneStatus, ZoneSummary } from "~/features/zones/schema";

import { NPC_SPOT, SITES, type Vec2 } from "./layout";

/**
 * Status and name of each building before (or without) the zones API. The scene never waits
 * for the API (brief §4.3), so these match the content seed; the API wins when it answers.
 */
export const DEFAULT_STATUS: Readonly<Record<ZoneLocation, ZoneStatus>> = {
  library: "open",
  watchtower: "coming_soon",
  market: "coming_soon",
};

const FALLBACK_NAME: Readonly<Record<ZoneLocation, string>> = {
  library: "Thư viện",
  watchtower: "Tháp canh",
  market: "Chợ model",
};

/** Level cô Lan's dialog opens: "Dạy trợ lý tra sách" (workbench-v0.1 §8.1). */
export const FIRST_LIBRARY_LEVEL = "grounded-citation";

export interface SiteInfo {
  location: ZoneLocation;
  /** Zone id for `/play/:zoneId`; the seed uses the location as the id. */
  zoneId: string;
  name: string;
  status: ZoneStatus;
  zone: ZoneSummary | null;
}

export type SiteInfoMap = Readonly<Record<ZoneLocation, SiteInfo>>;

export function siteInfo(zones: readonly ZoneSummary[] | null): SiteInfoMap {
  const entry = (location: ZoneLocation): SiteInfo => {
    const zone = zones?.find((candidate) => candidate.location === location) ?? null;
    return {
      location,
      zoneId: zone?.id ?? location,
      name: zone?.name ?? FALLBACK_NAME[location],
      status: zone?.status ?? DEFAULT_STATUS[location],
      zone,
    };
  };
  return { library: entry("library"), watchtower: entry("watchtower"), market: entry("market") };
}

/** Things the player can stand next to and use. */
export type InteractTarget = "lan" | ZoneLocation;

export const INTERACT_POINTS: readonly { id: InteractTarget; door: Vec2 }[] = [
  { id: "lan", door: NPC_SPOT },
  ...SITES.map((site) => ({ id: site.id, door: site.door })),
];

export interface Hint {
  text: string;
  /** False for buildings that are not open yet: the hint is information, not a button. */
  actionable: boolean;
}

/** Interaction hint copy, verbatim from the build brief §4. */
export function hintFor(target: InteractTarget, sites: SiteInfoMap): Hint {
  if (target === "lan") {
    return { text: "Nhấn E hoặc chạm để nói chuyện với cô Lan", actionable: true };
  }
  const site = sites[target];
  return site.status === "open"
    ? { text: `Nhấn E để vào ${site.name}`, actionable: true }
    : { text: `${site.name} · Sắp mở`, actionable: false };
}
