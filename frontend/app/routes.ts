import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("play", "routes/play.tsx"),
  route("play/:zoneId", "routes/play-zone.tsx"),
  route("play/:zoneId/:levelId", "routes/play-level.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
