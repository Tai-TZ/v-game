// Test-only helper (vitest): a micro lesson page inside the theme and a data router, as the
// route renders it. Never imported by app code.
import { readFileSync } from "node:fs";
import path from "node:path";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { ThemeProvider } from "~/features/theme/context";
import { parseThemeIndex, parseThemeManifest } from "~/features/theme/schema";

const read = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), ...parts), "utf8"));
const themes = parseThemeIndex(read("public", "themes", "index.json"));
const catalog = {
  themes,
  defaultId: themes[0]?.id ?? "",
  manifests: Object.fromEntries(
    themes.map(({ id }) => [id, parseThemeManifest(read("public", "themes", id, "manifest.json"))]),
  ),
};

export function renderLesson(page: ReactNode) {
  // A data router: the page frame reads the navigation and revalidation state.
  const router = createMemoryRouter([{ path: "*", element: page }]);
  return render(
    <ThemeProvider catalog={catalog}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}
