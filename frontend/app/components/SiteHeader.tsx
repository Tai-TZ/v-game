import { Link } from "react-router";

import { ThemeToggle } from "~/features/theme/ThemeToggle";

import { buttonClass } from "./ui/button";
import { Wordmark } from "./Wordmark";

interface SiteHeaderProps {
  /** In-page anchors, shown on wide screens only. */
  sections?: readonly { href: string; label: string }[];
}

export function SiteHeader({ sections = [] }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark />
        {sections.length > 0 && (
          <nav aria-label="Trong trang" className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {sections.map((section) => (
                <li key={section.href}>
                  <a
                    href={section.href}
                    className="text-sm font-medium text-fg-muted transition-[color] hover:text-fg"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/play"
            prefetch="intent"
            className={buttonClass("primary", "hidden sm:inline-flex")}
          >
            Vào khuôn viên
          </Link>
        </div>
      </div>
    </header>
  );
}
