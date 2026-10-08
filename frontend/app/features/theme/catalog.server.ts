import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseThemeIndex, parseThemeManifest } from "./schema";
import type { ThemeCatalog } from "./store";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

/**
 * Keeps only the packs named in `packs` (comma-separated, e.g. VITE_THEME_PACKS="town" for a
 * public build that must not ship a brand-licensed pack). Empty or unset keeps every pack.
 */
export function selectPacks<T extends { id: string }>(themes: T[], packs: string | undefined): T[] {
  const wanted = (packs ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (wanted.length === 0) return themes;
  const unknown = wanted.filter((id) => !themes.some((theme) => theme.id === id));
  if (unknown.length > 0) {
    throw new Error(`VITE_THEME_PACKS lists unknown theme pack(s): ${unknown.join(", ")}.`);
  }
  return themes.filter((theme) => wanted.includes(theme.id));
}

/**
 * Build-time loader: reads the theme index and every listed manifest from public/themes.
 * Theme packs are data only; adding or removing one never touches application code.
 */
export async function loadThemeCatalog(
  preferredDefault: string | undefined,
  packs?: string,
): Promise<ThemeCatalog> {
  const themes = selectPacks(
    parseThemeIndex(await readJson(path.join(THEMES_DIR, "index.json"))),
    packs,
  );
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
