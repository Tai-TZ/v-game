import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigation, useRevalidator } from "react-router";

import { buttonClass } from "~/components/ui/button";
import { ChevronLeftIcon } from "~/components/ui/icons";
import { ThemeToggle } from "~/features/theme/ThemeToggle";
import { AUTHOR } from "~/lib/site";

const WIDTH = { "3xl": "max-w-3xl", "6xl": "max-w-6xl" } as const;

/** Focus the page's h1 without scrolling: ScrollRestoration owns the scroll position. */
function focusHeading() {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/** Plain page frame (art §9.1): back link and theme toggle on top, author line at the bottom. */
export function PageFrame({
  back,
  backLabel,
  width = "3xl",
  children,
}: {
  back: string;
  backLabel: string;
  width?: keyof typeof WIDTH;
  children: ReactNode;
}) {
  const box = `mx-auto ${WIDTH[width]} px-4 sm:px-6`;
  // A client-side route change leaves focus on <body> and announces nothing: move it to the new
  // page's h1. Keyed on the pathname, not the history entry: a hash link ("Xem câu #2") and
  // Back to it stay on the page, where the player's place matters. Not on the first page of a
  // visit (key "default"), where reading starts at the top.
  const { key, pathname } = useLocation();
  const [firstPage] = useState(key === "default");
  useEffect(() => {
    if (!firstPage) focusHeading();
  }, [pathname, firstPage]);

  // "Thử lại" on a failed load swaps the page under the focused button, which drops focus to
  // <body>; the location does not change, so the effect above does not run.
  const revalidation = useRevalidator().state;
  const was = useRef(revalidation);
  useEffect(() => {
    if (was.current === "loading" && document.activeElement === document.body) focusHeading();
    was.current = revalidation;
  }, [revalidation]);

  // The next page's data is loading (a sleeping API can take half a minute): say so.
  const loading = useNavigation().state === "loading";

  return (
    <>
      <header className="relative h-16 border-b border-line bg-surface">
        <div className={`${box} flex h-full items-center justify-between gap-4`}>
          <Link to={back} className={buttonClass("inline")}>
            <ChevronLeftIcon />
            {backLabel}
          </Link>
          <ThemeToggle />
        </div>
        <p role="status" className="sr-only">
          {loading ? "Đang tải trang…" : ""}
        </p>
        {loading && (
          <div aria-hidden="true" className="absolute inset-x-0 -bottom-px h-1 overflow-hidden">
            <div className="h-full animate-appear">
              <div className="h-full w-1/3 animate-poster-bar bg-brand motion-reduce:animate-none" />
            </div>
          </div>
        )}
      </header>
      <main aria-busy={loading || undefined} className={`${box} py-10`}>
        {children}
      </main>
      <footer className={`${box} pb-10`}>
        <p className="border-t border-line pt-5 text-xs text-fg-muted">V-Game · {AUTHOR}</p>
      </footer>
    </>
  );
}
