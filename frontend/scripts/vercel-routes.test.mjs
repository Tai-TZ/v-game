import { describe, expect, it } from "vitest";

import { buildRoutes } from "./vercel-routes.mjs";

const routes = () => buildRoutes({ apiOrigin: "https://api.example", security: { "X-A": "b" } });
const ruleFor = (pathname) =>
  routes().find((r) => r.headers?.["Cache-Control"] && new RegExp(r.src).test(pathname));

describe("Vercel cache rules", () => {
  it("caches the baked model data, which is 200 kB that changes only when the bake script runs", () => {
    // /models/cast.json is 119 kB and /models/props.json 84 kB; served with max-age=0 they cost
    // a revalidation round trip before the campus scene can build, on every single visit.
    expect(ruleFor("/models/cast.json")?.headers["Cache-Control"]).toMatch(/max-age=[1-9]/);
  });

  it("caches the recorded static runs the workbench plays while the API sleeps", () => {
    expect(ruleFor("/runs/article-number-lookup.json")?.headers["Cache-Control"]).toMatch(
      /max-age=[1-9]/,
    );
  });

  it("keeps hashed assets immutable and everything else revalidating", () => {
    expect(ruleFor("/assets/root-abc123.css")?.headers["Cache-Control"]).toContain("immutable");
    // The HTML itself must not be cached hard: a deploy has to be able to change it.
    expect(ruleFor("/play/index.html")).toBeUndefined();
  });

  it("proxies the API to the configured origin and nowhere else", () => {
    const api = routes().find((r) => r.dest?.includes("/api/"));
    expect(api?.dest).toBe("https://api.example/api/$1");
  });
});
