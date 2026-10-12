import { useState, type ReactElement, type ReactNode } from "react";

import { buttonClass } from "~/components/ui/button";
import { useMediaQuery } from "~/lib/useMediaQuery";

import { VIZ_STAMP, VIZ_VI, type VizStamp } from "./copy";

/**
 * Below this the table is the interface and the picture is the extra, per
 * frontend-architecture §8.2: "Ở 375 px, dạng bảng là mặc định." Tailwind's `sm`, so 375 px
 * opens the table and 1280 px opens the picture -- the two widths the a11y suite checks.
 */
const NARROW = "(max-width: 639px)";

/**
 * The frame every figure on the bench wears (§8.2, §8.4): a one-sentence takeaway, one of the
 * seven fixed source stamps, and the same data as a table.
 *
 * No `role="img"` here. Putting one on a wrapper orphaned every list item inside it the last
 * time it was tried, which axe caught on the workbench page.
 */
export function Viz({
  caption,
  stamp,
  note,
  table,
  children,
}: {
  /** What the picture shows, as one Vietnamese sentence. */
  caption: string;
  stamp: VizStamp;
  /** Said beside the stamp when the figure needs it, e.g. whose recorded run this is. */
  note?: string;
  /** The same numbers as a table. Without one, no toggle is offered. */
  table?: ReactNode;
  children: ReactNode;
}): ReactElement {
  const narrow = useMediaQuery(NARROW);
  // Null until the player picks: their choice then holds, rather than snapping back on resize.
  const [chosen, setChosen] = useState<"picture" | "table" | null>(null);
  const showing = chosen ?? (narrow ? "table" : "picture");
  const asTable = table !== undefined && showing === "table";

  return (
    <figure data-vg-viz className="mt-3">
      {/* A region that scrolls has to be reachable by keyboard, or a keyboard-only player
          cannot scroll it (axe scrollable-region-focusable). Unlike a chip, the tab stop here
          does something: it scrolls. The <figcaption> below names it. */}
      {asTable ? (
        <div
          tabIndex={0}
          role="region"
          aria-label={caption}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-brand"
        >
          {table}
        </div>
      ) : (
        children
      )}
      <figcaption className="mt-1 max-w-prose text-sm">{caption}</figcaption>
      <p className="mt-1 text-xs text-fg-muted">
        {VIZ_STAMP[stamp]}
        {note !== undefined && ` · ${note}`}
      </p>
      {table !== undefined && (
        <button
          type="button"
          onClick={() => setChosen(asTable ? "picture" : "table")}
          className={buttonClass("quiet")}
        >
          {asTable ? VIZ_VI.toPicture : VIZ_VI.toTable}
        </button>
      )}
    </figure>
  );
}
