import { defineConfig } from "vitest/config";

// The React Router Vite plugin is intentionally not loaded here: unit tests exercise
// plain modules and components, not the framework build.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    // scripts/ too: the deploy config is code, and until now nothing checked it.
    include: ["app/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
});
