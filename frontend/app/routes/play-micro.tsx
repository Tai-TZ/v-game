import { data } from "react-router";

import { loadMicroPage } from "~/features/micro/pages";
import { findMicro } from "~/features/micro/registry";

import type { Route } from "./+types/play-micro";

/** `/play/:zoneId/vi-mo/:lessonId`: a micro lesson of the registry, under its own zone only.
 * The page comes with its own content, loaded here and nowhere else (plan v0.7 4.5). */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const lesson = findMicro(params.zoneId, params.lessonId);
  if (lesson === null) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router convention
    throw data("Not Found", { status: 404 });
  }
  return { title: lesson.title, Page: await loadMicroPage(lesson.id) };
}

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: `${loaderData.title} · V-Game` },
];

export default function PlayMicro({ loaderData }: Route.ComponentProps) {
  const { Page } = loaderData;
  return <Page />;
}
