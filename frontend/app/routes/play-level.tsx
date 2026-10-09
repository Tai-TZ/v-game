import { useRevalidator } from "react-router";

import { loadLevelPage } from "~/features/workbench/api";
import { LevelPage, LevelPageSkeleton } from "~/features/workbench/WorkbenchPage";

import type { Route } from "./+types/play-level";

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return loadLevelPage(params.zoneId, params.levelId);
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  {
    title:
      loaderData.kind === "ready" ? `${loaderData.env.level.title} · V-Game` : "Màn chơi · V-Game",
  },
];

export function HydrateFallback() {
  return <LevelPageSkeleton />;
}

export default function PlayLevel({ loaderData }: Route.ComponentProps) {
  const revalidator = useRevalidator();
  return <LevelPage data={loaderData} onRetry={() => void revalidator.revalidate()} />;
}
