// The route table of the Vercel Build Output config, apart from the script that writes it so
// it can be tested: a deploy header is code, and a wrong one is invisible until production.

/** A year, for hashed filenames that can never mean anything else. */
const IMMUTABLE = "public, max-age=31536000, immutable";
/**
 * A day, for files whose names are stable but whose contents change only when someone reruns a
 * generator: theme packs, the baked campus model data (the bake scripts under tools/) and the recorded
 * static runs (`vgame-export-recorded-runs`). Served with Vercel's default max-age=0 they cost
 * a revalidation round trip on every visit — 204 kB of model data before the scene can build.
 */
const DAY = "public, max-age=86400";

export function buildRoutes({ apiOrigin, security }) {
  return [
    {
      src: "^/assets/(.*)$",
      headers: { "Cache-Control": IMMUTABLE },
      continue: true,
    },
    {
      src: "^/(themes|models|runs)/(.*)$",
      headers: { "Cache-Control": DAY },
      continue: true,
    },
    {
      src: "^/(.*)$",
      headers: { ...security, "Strict-Transport-Security": "max-age=63072000; includeSubDomains" },
      continue: true,
    },
    { src: "^/api/(.*)$", dest: `${apiOrigin}/api/$1` },
    { handle: "filesystem" },
    // Pre-rendered page with the scene loader, whatever Vercel does with directory indexes.
    { src: "^/play/?$", dest: "/play/index.html" },
    { src: "^/(assets|themes|models|runs)/(.*)$", status: 404 },
    { src: "^/(.*)$", dest: "/__spa-fallback.html" },
  ];
}
