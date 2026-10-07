import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import type { ThemeManifest } from "./schema";
import { createThemeStore, type ThemeCatalog, type ThemeState, type ThemeStore } from "./store";

const ThemeStoreContext = createContext<ThemeStore | null>(null);

export function ThemeProvider({
  catalog,
  children,
}: {
  catalog: ThemeCatalog;
  children: ReactNode;
}) {
  const [store] = useState(() => createThemeStore(catalog));

  useEffect(() => {
    store.getState().restoreSavedTheme();
  }, [store]);

  return <ThemeStoreContext value={store}>{children}</ThemeStoreContext>;
}

export function useTheme<T>(selector: (state: ThemeState) => T): T {
  const store = useContext(ThemeStoreContext);
  if (!store) throw new Error("useTheme must be used inside <ThemeProvider>.");
  return useStore(store, selector);
}

export function useActiveTheme(): ThemeManifest {
  const manifest = useTheme((state) => state.manifests[state.activeId]);
  if (!manifest) throw new Error("Active theme manifest is missing from the catalog.");
  return manifest;
}
