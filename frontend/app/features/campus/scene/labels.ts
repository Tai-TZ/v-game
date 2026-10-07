import { NPC_SPOT } from "../layout";

/** World anchors of the DOM labels (art §5.10). */
export const LABEL_ANCHORS = {
  library: [-8.5, 4.1, 2.0],
  watchtower: [8.8, 6.95, 1.7],
  market: [0, 3.6, 7.6],
  lan: [NPC_SPOT.x, 1.85, NPC_SPOT.z],
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
