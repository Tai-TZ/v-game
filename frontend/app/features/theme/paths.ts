/** Public URL of a file inside a theme pack (`public/themes/<id>/<relative>`). */
export function themeAssetUrl(themeId: string, relativePath: string): string {
  return `/themes/${themeId}/${relativePath}`;
}

export function themeStylesheetUrl(themeId: string): string {
  return themeAssetUrl(themeId, "theme.css");
}

export const THEME_STYLESHEET_ID = "vg-theme-css";
export const THEME_STORAGE_KEY = "vg-theme";
/** Extra stylesheet for a non-default theme, appended outside React's tree (see bootstrap). */
export const THEME_OVERRIDE_ID = "vg-theme-css-saved";
