import { defineConfig, devices } from "@playwright/test";

// Each checkout or worktree that runs e2e at the same time needs its own port (`E2E_PORT`).
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Each page renders WebGL in software (SwiftShader); too many at once starve each other.
  workers: 4,
  // CI renders WebGL in software: with the skinned cast a walk across the campus can take
  // longer than 15 s there, so assertions that wait for an arrival get more room on CI.
  expect: { timeout: process.env.CI ? 30_000 : 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Headless Chromium has no GPU; render WebGL in software so the 3D hub can be tested.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Serves the production build (static files + SPA fallback); the API is mocked per test.
  webServer: {
    command: `node scripts/serve-build.mjs --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Never reuse: a server already on the port may be another checkout's build, which would be
    // tested quietly in place of this one (QA r2). A taken port fails the run instead.
    reuseExistingServer: false,
  },
});
