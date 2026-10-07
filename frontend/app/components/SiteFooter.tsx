import { useActiveTheme } from "~/features/theme/context";
import { AUTHOR } from "~/lib/site";

import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  const theme = useActiveTheme();

  return (
    <footer className="footer-skyline bg-ink text-on-ink">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-xl space-y-3 pt-14 pb-12">
          <Wordmark tone="light" />
          <p className="text-sm text-on-ink-muted">
            Dự án học tập cá nhân. Quy chế, điều luật và nhân vật trong game đều là hư cấu.
          </p>
          {theme.brand.disclaimer && (
            <p className="text-sm text-on-ink-muted">{theme.brand.disclaimer}</p>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-on-ink/15 py-5 text-xs text-on-ink-muted">
          <p>© 2026 {AUTHOR}</p>
          {theme.hero.credit && <p>{theme.hero.credit}</p>}
        </div>
      </div>
    </footer>
  );
}
