import { useEffect } from "react";

import { ZoneStatusText } from "~/features/zones/ui";

import type { SiteInfoMap } from "../sites";
import { hubStore, useHub } from "../store";
import { labelElements, labelWidths, type LabelId } from "./labels";

const ZONES = ["library", "watchtower", "market"] as const;
const BOX = "absolute top-0 left-0 will-change-transform";

const register = (id: LabelId) => (element: HTMLElement | null) => {
  if (element) labelElements.set(id, element);
  else labelElements.delete(id);
};

/**
 * Building labels and the librarian's "!" as plain DOM (no text in WebGL). The frame loop
 * positions each element through its ref, only in frames that render, and reveals it there
 * (labels start `hidden` so none flashes at the corner before the first frame). Decorative
 * for assistive tech: the same information is in the "Các khu" list.
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
          <p className="rounded-sm border border-line bg-surface px-2 py-1 text-xs font-semibold whitespace-nowrap text-fg">
            {sites[id].name} · <ZoneStatusText status={sites[id].status} />
          </p>
        </div>
      ))}
      <div ref={register("lan")} hidden className={BOX}>
        {showBadge && (
          <p className="grid size-7 place-items-center rounded-sm bg-accent text-lg leading-none font-bold text-on-brand">
            !
          </p>
        )}
      </div>
    </div>
  );
}
