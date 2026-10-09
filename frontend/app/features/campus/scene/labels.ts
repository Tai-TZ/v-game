import { speakerSpot, type Speaker } from "../layout";

/** A person's "!" badge stands 1.85 above their spot. */
const badge = (who: Speaker) => [speakerSpot(who).x, 1.85, speakerSpot(who).z] as const;

/** World anchors of the DOM labels (art §5.10, campus-scene v0.2 §2.3, npc-cast v0.4 §7.1). */
export const LABEL_ANCHORS = {
  library: [-10.8, 2.9, -3.3],
  watchtower: [10.6, 6.6, -4.8],
  market: [9.0, 2.9, 3.9],
  lan: badge("lan"),
  registrar: badge("registrar"),
  guard: badge("guard"),
  examiner: badge("examiner"),
  operator: badge("operator"),
} as const satisfies Record<string, readonly [number, number, number]>;

export type LabelId = keyof typeof LABEL_ANCHORS;

/**
 * Mounted label elements, filled by WorldLabels' ref callbacks and positioned by the frame
 * loop. Module scope because the labels are DOM next to the canvas while the loop runs inside
 * it; there is one hub per page.
 */
export const labelElements = new Map<LabelId, HTMLElement>();

/** Rendered widths of the labels (px), kept current by a ResizeObserver in WorldLabels. */
export const labelWidths = new Map<LabelId, number>();

/** The compass needle of the view buttons (hud/ViewControls), turned by the frame loop. */
export const viewNeedle: { element: SVGGElement | null } = { element: null };
