import { useActiveTheme } from "~/features/theme/context";

import { Wordmark } from "./Wordmark";

export function SiteFooter() {
  const theme = useActiveTheme();

  return (
    <footer className="footer-skyline bg-ink text-on-ink">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-14 pb-16 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-xl space-y-3">
          <Wordmark tone="light" />
          <p className="text-sm text-on-ink-muted">
            Dự án học tập cá nhân. Quy chế, điều luật và nhân vật trong game đều là hư cấu.
          </p>
          {theme.brand.disclaimer && (
            <p className="text-sm text-on-ink-muted">{theme.brand.disclaimer}</p>
          )}
        </div>
        {theme.hero.credit && <p className="text-xs text-on-ink-muted">{theme.hero.credit}</p>}
      </div>
    </footer>
  );
}
