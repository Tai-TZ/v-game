import { THEME_OVERRIDE_ID, THEME_STORAGE_KEY } from "./paths";

/**
 * Inline script that applies the viewer's saved theme before first paint, so a
 * pre-rendered page does not flash the default theme. It only reads from a fixed list of
 * known ids; anything else in storage is ignored. A non-default theme gets its own
 * <link id=THEME_OVERRIDE_ID> appended to <head>: rewriting the React-rendered link would
 * make hydration fail, while React skips unexpected tags in <head>. Until that stylesheet has
 * loaded (or failed) plus two animation frames, <html> carries .vg-theme-loading, which turns
 * transitions off (app.css): otherwise every transition-colors element would fade from the
 * default palette on first paint. The double rAF guarantees one styled frame with transitions
 * off; removing the class in onload directly can share a style recalc with the new sheet.
 * It also hints the hub's night sky on <html data-sky="night"> from the hour at `timeZone`
 * (night before 06:00 and from 18:00), unless the viewer fixed the daytime display: the
 * prerendered /play would otherwise paint the day sky until hydration. useSkyClock removes it
 * and sets the exact phase on <main>.
 * Its hash is allowed by the CSP that scripts/postbuild-csp.mjs generates.
 */
export function themeBootstrapScript(
  themeIds: readonly string[],
  defaultId: string,
  timeZone: string,
): string {
  const ids = JSON.stringify(themeIds);
  const fallback = JSON.stringify(defaultId);
  const key = JSON.stringify(THEME_STORAGE_KEY);
  const linkId = JSON.stringify(THEME_OVERRIDE_ID);
  return `(function(){try{var a=${ids},d=${fallback},s=localStorage.getItem(${key});var t=a.indexOf(s)>-1?s:d;if(t!==d){var h=document.documentElement;h.setAttribute("data-theme",t);h.classList.add("vg-theme-loading");var l=document.createElement("link");l.rel="stylesheet";l.id=${linkId};l.onload=l.onerror=function(){requestAnimationFrame(function(){requestAnimationFrame(function(){h.classList.remove("vg-theme-loading")})})};l.href="/themes/"+t+"/theme.css";document.head.appendChild(l)}}catch(e){}try{if(localStorage.getItem("vg-hub-display")!=="day"){var n=+new Intl.DateTimeFormat("en-GB",{timeZone:${JSON.stringify(timeZone)},hour:"numeric",hourCycle:"h23"}).format(new Date());if(n<6||n>=18)document.documentElement.setAttribute("data-sky","night")}}catch(e){}})();`;
}
