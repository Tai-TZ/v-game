import { data } from "react-router";

import { ToolRiskPage } from "~/features/micro/MicroPage";
import { findMicro } from "~/features/micro/registry";

import type { Route } from "./+types/play-micro";

/** `/play/:zoneId/vi-mo/:lessonId`: a micro lesson of the registry, under its own zone only.
 * One lesson today, so one page; a second lesson picks its page by id here. */
export function clientLoader({ params }: Route.ClientLoaderArgs) {
  const lesson = findMicro(params.zoneId, params.lessonId);
  if (lesson === null) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router convention
    throw data("Not Found", { status: 404 });
  }
  return { title: lesson.title };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `${loaderData.title} · V-Game` },
];

export default function PlayMicro() {
  return <ToolRiskPage />;
}
