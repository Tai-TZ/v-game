import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { THEME_OVERRIDE_ID, THEME_STYLESHEET_ID } from "./paths";
import { parseThemeIndex, parseThemeManifest } from "./schema";
import { createThemeStore } from "./store";

const THEMES_DIR = path.resolve(process.cwd(), "public", "themes");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const themes = parseThemeIndex(readJson(path.join(THEMES_DIR, "index.json")));
const manifests = Object.fromEntries(
  themes.map((t) => [
    t.id,
    parseThemeManifest(readJson(path.join(THEMES_DIR, t.id, "manifest.json"))),
  ]),
);
const [defaultTheme, otherTheme] = themes;

describe("theme store document sync", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("loads a non-default theme through an override link and never touches the React link", () => {
    if (!defaultTheme || !otherTheme) throw new Error("need two themes");
    const reactLink = document.createElement("link");
    reactLink.id = THEME_STYLESHEET_ID;
    reactLink.href = `/themes/${defaultTheme.id}/theme.css`;
    document.head.append(reactLink);
    const store = createThemeStore({ themes, defaultId: defaultTheme.id, manifests });
    const override = () => document.getElementById(THEME_OVERRIDE_ID);

    store.getState().setTheme(otherTheme.id);
    expect(document.documentElement.dataset.theme).toBe(otherTheme.id);
    expect(override()?.getAttribute("href")).toBe(`/themes/${otherTheme.id}/theme.css`);

    store.getState().setTheme(defaultTheme.id);
    expect(document.documentElement.dataset.theme).toBe(defaultTheme.id);
    expect(override()).toBeNull();

    store.getState().setTheme(otherTheme.id);
    expect(document.querySelectorAll(`#${THEME_OVERRIDE_ID}`)).toHaveLength(1);
    expect(reactLink.getAttribute("href")).toBe(`/themes/${defaultTheme.id}/theme.css`);
  });
});
