import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseThemeIndex, parseThemeManifest } from "./schema";
import type { ThemeCatalog } from "./store";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

/**
 * Build-time loader: reads the theme index and every listed manifest from public/themes.
 * Theme packs are data only; adding or removing one never touches application code.
 */
export async function loadThemeCatalog(
  preferredDefault: string | undefined,
): Promise<ThemeCatalog> {
  const themes = parseThemeIndex(await readJson(path.join(THEMES_DIR, "index.json")));
  const entries = await Promise.all(
    themes.map(async ({ id }) => {
      const manifest = parseThemeManifest(
        await readJson(path.join(THEMES_DIR, id, "manifest.json")),
      );
      if (manifest.id !== id) {
        throw new Error(`Theme manifest id "${manifest.id}" does not match its folder "${id}".`);
      }
      return [id, manifest] as const;
    }),
  );
  const first = themes[0];
  if (!first) throw new Error("public/themes/index.json lists no themes.");
  const defaultId =
    preferredDefault && themes.some((theme) => theme.id === preferredDefault)
      ? preferredDefault
      : first.id;
  return { themes, defaultId, manifests: Object.fromEntries(entries) };
}
