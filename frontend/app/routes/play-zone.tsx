import { useRevalidator } from "react-router";

import { loadZonePage } from "~/features/zones/api";
import { ZonePage, ZonePageSkeleton } from "~/features/zones/ZonePage";

import type { Route } from "./+types/play-zone";

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return loadZonePage(params.zoneId);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title:
      loaderData.kind === "open" || loaderData.kind === "locked"
        ? `${loaderData.zone.name} · V-Game`
        : "Khu học · V-Game",
  },
];

export function HydrateFallback() {
  return <ZonePageSkeleton />;
}

export default function PlayZone({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  return <ZonePage data={loaderData} onRetry={() => void revalidator.revalidate()} />;
}
