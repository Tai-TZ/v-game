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
type VizProps =
  | {
      caption: string;
      stamp: VizStamp;
      note?: string;
      /** The content IS a table already: no other form to offer, so no toggle. */
      form: "table";
      children: ReactNode;
    }
  | {
      caption: string;
      stamp: VizStamp;
      note?: string;
      form?: undefined;
      /** The same data as a table, behind the "Xem dạng bảng" toggle. */
      table: ReactNode;
      children: ReactNode;
    };

export function Viz(props: VizProps): ReactElement {
  const { caption, stamp, note, children } = props;
  const narrow = useMediaQuery(NARROW);
  // Null until the player picks: their choice then holds, rather than snapping back on resize.
  const [chosen, setChosen] = useState<"picture" | "table" | null>(null);
  const showing = chosen ?? (narrow ? "table" : "picture");
  const asTable = props.form !== "table" && showing === "table";
  const table = props.form === "table" ? children : props.table;

  return (
    <figure
      // Declared by the caller, not re-derived from whether a `table` prop was passed: a
      // picture with no readable alternative then fails to typecheck instead of exempting
      // itself from the toggle at the one width where the gate could not tell the difference
      // (round 4 of this PR's CI). "both": a picture with a table alternative behind the
      // toggle -- below 640 px it is SHOWING that table, which is not the same as being one.
      data-vg-viz={props.form === "table" ? "table" : "both"}
      className="mt-3"
    >
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
      ) : props.form === "table" ? (
        table
      ) : (
        children
      )}
      <figcaption className="mt-1 max-w-prose text-sm">{caption}</figcaption>
      <p className="mt-1 text-xs text-fg-muted">
        {VIZ_STAMP[stamp]}
        {note !== undefined && ` · ${note}`}
      </p>
      {props.form !== "table" && (
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
