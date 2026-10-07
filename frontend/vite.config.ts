import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    // Read by scripts/check-bundle.mjs (play chunk budget, chunks the landing page must not
    // load); the script removes it from the deployable output afterwards.
    manifest: true,
    // three.js is isolated in the /play route chunk; keep the warning meaningful for
    // everything else.
    chunkSizeWarningLimit: 1000,
  },
});
