import { useEffect } from "react";

import { ZoneStatusText } from "~/features/zones/ui";

import { NPC_TALK_SPOT, siteFor, type Vec2 } from "../layout";
import type { SiteInfoMap } from "../sites";
import { hubStore, useHub } from "../store";
import { labelElements, labelWidths, type LabelId } from "./labels";

const ZONES = ["library", "watchtower", "market"] as const;
const BOX = "absolute top-0 left-0 will-change-transform";

/**
 * A click on a label walks to what it names, wherever the label sits over the scene (QA r4);
 * the badge's walk opens the dialog on arrival, like a click on the librarian. Mouse-down keeps
 * focus where it was, so the movement keys still reach the scene.
 */
const walk = (goal: Vec2, talk = false) => ({
  tabIndex: -1,
  onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
  onClick: () => {
    const state = hubStore.getState();
    if (state.dialog) return;
    state.walkTo(goal);
    state.motion.talkOnArrival = talk;
  },
});

const register = (id: LabelId) => (element: HTMLElement | null) => {
  if (element) labelElements.set(id, element);
  else labelElements.delete(id);
};

/**
 * Building labels and the librarian's "!" as plain DOM (no text in WebGL). The frame loop
 * positions each element through its ref, only in frames that render, and reveals it there
 * (labels start `hidden` so none flashes at the corner before the first frame). Hidden from
 * assistive tech and out of the tab order: the "Các khu" list has the same names and actions.
 */
export function WorldLabels({ sites }: { sites: SiteInfoMap }) {
  const showBadge = useHub((state) => !state.metLan && state.dialog === null);

  // Widths for keeping labels inside the viewport, measured on show and on text change only,
  // so the frame loop never reads layout.
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        for (const [id, element] of labelElements) {
          if (element === target) labelWidths.set(id, element.offsetWidth);
        }
      }
      hubStore.getState().wake();
    });
    for (const element of labelElements.values()) observer.observe(element);
    return () => {
      observer.disconnect();
      labelWidths.clear();
    };
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {ZONES.map((id) => (
        <div key={id} ref={register(id)} hidden className={BOX}>
          <button
            type="button"
            {...walk(siteFor(id).door)}
            className="pointer-events-auto cursor-pointer rounded-sm border border-line bg-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-fg"
          >
            {sites[id].name} · <ZoneStatusText status={sites[id].status} />
          </button>
        </div>
      ))}
      <div ref={register("lan")} hidden className={BOX}>
        {showBadge && (
          <button
            type="button"
            {...walk(NPC_TALK_SPOT, true)}
            className="pointer-events-auto grid size-7 cursor-pointer place-items-center rounded-sm bg-accent text-lg leading-none font-bold text-on-brand"
          >
            !
          </button>
        )}
      </div>
    </div>
  );
}
