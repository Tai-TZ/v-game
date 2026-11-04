import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8000";

/**
 * Writes which app modules each client chunk holds, for scripts/check-bundle.mjs: the manifest
 * names a chunk's imports, never its modules. Under .vite/, which the script removes.
 */
function chunkModules(): Plugin {
  let root = "";
  return {
    name: "vgame:chunk-modules",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    generateBundle(_, bundle) {
      if (this.environment.name !== "client") return;
      const modules = Object.fromEntries(
        Object.values(bundle).flatMap((out) =>
          out.type === "chunk"
            ? [
                [
                  out.fileName,
                  out.moduleIds.map((id) => path.relative(root, id.split("?", 1)[0] ?? id)),
                ],
              ]
            : [],
        ),
      );
      this.emitFile({
        type: "asset",
        fileName: ".vite/chunk-modules.json",
        source: `${JSON.stringify(modules, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), chunkModules()],
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
