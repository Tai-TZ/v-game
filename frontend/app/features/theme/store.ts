import { createStore } from "zustand";

import { THEME_OVERRIDE_ID, THEME_STORAGE_KEY, themeStylesheetUrl } from "./paths";
import type { ThemeManifest, ThemeSummary } from "./schema";

export interface ThemeCatalog {
  themes: ThemeSummary[];
  defaultId: string;
  manifests: Record<string, ThemeManifest>;
}

export interface ThemeState extends ThemeCatalog {
  activeId: string;
  setTheme: (id: string) => void;
  cycleTheme: () => void;
  /** Adopt the theme saved by this viewer, if any. Call after hydration. */
  restoreSavedTheme: () => void;
}

export type ThemeStore = ReturnType<typeof createThemeStore>;

function readSavedTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // storage blocked (private mode, browser policy)
  }
}

function saveTheme(id: string): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Saving is a convenience; the theme still applies for this visit.
  }
}

/**
 * Leaves the React-rendered default stylesheet alone and loads any other theme through a
 * separate override link. Each theme.css scopes its tokens under :root[data-theme=...], so
 * the default one stays harmless while another theme is active.
 */
function applyToDocument(id: string, defaultId: string): void {
  document.documentElement.setAttribute("data-theme", id);
  const existing = document.getElementById(THEME_OVERRIDE_ID);
  if (id === defaultId) {
    existing?.remove();
    return;
  }
  const href = themeStylesheetUrl(id);
  if (existing instanceof HTMLLinkElement) {
    if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.id = THEME_OVERRIDE_ID;
  link.href = href;
  document.head.appendChild(link);
}

/**
 * The store starts on the build-time default so the first client render matches the
 * pre-rendered HTML; `restoreSavedTheme` then switches to the viewer's saved choice.
 */
export function createThemeStore(catalog: ThemeCatalog) {
  return createStore<ThemeState>()((set, get) => ({
    ...catalog,
    activeId: catalog.defaultId,

    setTheme: (id) => {
      if (!(id in get().manifests)) return;
      applyToDocument(id, get().defaultId);
      saveTheme(id);
      if (id !== get().activeId) set({ activeId: id });
    },

    cycleTheme: () => {
      const { themes, activeId, setTheme } = get();
      if (themes.length < 2) return;
      const index = themes.findIndex((theme) => theme.id === activeId);
      const next = themes[(index + 1) % themes.length];
      if (next) setTheme(next.id);
    },

    restoreSavedTheme: () => {
      const saved = readSavedTheme();
      if (saved && saved !== get().activeId && saved in get().manifests) {
        // The inline bootstrap script normally applied this already; repeat it in case
        // the script did not run.
        applyToDocument(saved, get().defaultId);
        set({ activeId: saved });
      }
    },
  }));
}
