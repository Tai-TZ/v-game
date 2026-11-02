import { data } from "react-router";

import { ToolRiskPage } from "~/features/micro/MicroPage";
import { TOOL_RISK } from "~/features/micro/toolRisk";

import type { Route } from "./+types/play-micro";

/** `/play/:zoneId/vi-mo/:lessonId`: one micro lesson today, under its own zone only. */
export function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (params.zoneId !== TOOL_RISK.zone || params.lessonId !== TOOL_RISK.id) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router convention
    throw data("Not Found", { status: 404 });
  }
  return null;
}

export const meta: Route.MetaFunction = () => [{ title: `${TOOL_RISK.title} · V-Game` }];

export default function PlayMicro() {
  return <ToolRiskPage />;
}
