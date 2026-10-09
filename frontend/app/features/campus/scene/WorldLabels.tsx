import { useEffect } from "react";

import { ZoneStatusText } from "~/features/zones/ui";

import { NPCS, siteFor, talkSpot, type Speaker, type Vec2 } from "../layout";
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
const walk = (goal: Vec2, talk: Speaker | null = null) => ({
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

const BADGE =
  "pointer-events-auto grid size-7 cursor-pointer place-items-center rounded-sm bg-accent text-lg leading-none font-bold text-on-brand";

/**
 * Building labels and the people's "!" badges as plain DOM (no text in WebGL). The librarian's
 * shows until she is met; each NPC's shows once she is, until that NPC is met (npc-cast v0.4
 * §7.1). The frame loop
 * positions each element through its ref, only in frames that render, and reveals it there
 * (labels start `hidden` so none flashes at the corner before the first frame). Hidden from
 * assistive tech and out of the tab order: the "Các khu" list has the same names and actions.
 */
export function WorldLabels({ sites }: { sites: SiteInfoMap }) {
  // A string, so the selector's result compares by value: the speakers whose badge shows.
  const badges = useHub((state) =>
    state.dialog
      ? ""
      : !state.met.lan
        ? "lan"
        : NPCS.filter(({ id }) => !state.met[id])
            .map(({ id }) => id)
            .join(" "),
  ).split(" ");

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
      {(["lan", ...NPCS.map(({ id }) => id)] as const).map((who) => (
        <div key={who} ref={register(who)} hidden className={BOX}>
          {badges.includes(who) && (
            <button type="button" data-badge={who} {...walk(talkSpot(who), who)} className={BADGE}>
              !
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
