import { defineConfig } from "vitest/config";

// The React Router Vite plugin is intentionally not loaded here: unit tests exercise
// plain modules and components, not the framework build.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
