import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  /** One or two sentences that say what the section is for. */
  children?: ReactNode;
  tone?: "default" | "on-ink";
}

export function SectionHeading({ title, children, tone = "default" }: SectionHeadingProps) {
  return (
    <div className="max-w-prose space-y-3">
      <h2 className="section-heading text-title font-bold">{title}</h2>
      {children && (
        <p className={tone === "on-ink" ? "text-lg text-on-ink-muted" : "text-lg text-fg-muted"}>
          {children}
        </p>
      )}
    </div>
  );
}
