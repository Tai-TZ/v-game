import { useEffect, useId, useRef, type ReactElement } from "react";

import { DOME_VI, fmt } from "./copy";
import type { Fact } from "./schema";
import { starField, type Star } from "./stardome";

type RetrievedItem = Extract<Fact, { kind: "retrieved" }>["items"][number];

const W = 320;
const H = 170;

/** "Điều 47 khoản 2, hạng 3, cosine 0,8" — the sentence a screen reader hears for one star. */
function label(star: Star): string {
  const khoan = star.khoan.length > 0 ? ` khoản ${star.khoan.join(", ")}` : "";
  const stale = star.stale ? ", văn bản hết hiệu lực" : "";
  const gold = star.gold ? ", đoạn đáp án" : "";
  return `Điều ${star.dieu}${khoan}, hạng ${star.rank}, cosine ${fmt(star.score)}${gold}${stale}`;
}

/**
 * Vòm Sao (vom-sao-v0.1): the passages a search block pulled, drawn as a dome of stars with the
 * answer passage in `accent`. The canvas is the picture; the `sr-only` list beside it is the
 * same data as buttons, so the keyboard and a screen reader get every star and its real numbers.
 * Drawn once per data change — no animation frame loop (art §1.2 principle 6).
 */
export function StarDome({
  items,
  goldChunks,
  goldRank,
  showGold,
  onSelect,
}: {
  items: readonly RetrievedItem[];
  goldChunks: readonly string[];
  goldRank: number | null;
  /** False for a hidden or trap case: no gold star, whatever the payload carries. */
  showGold: boolean;
  onSelect?: (chunkId: string) => void;
}): ReactElement | null {
  const id = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const dome = starField(items, showGold ? goldChunks : [], showGold ? goldRank : null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return; // jsdom has no 2D context; the sr-only list is still the record.
    const css = getComputedStyle(canvas.current as Element);
    const ink = css.getPropertyValue("--vg-text").trim() || "#1f2a2c";
    const muted = css.getPropertyValue("--vg-text-muted").trim() || "#55625f";
    const accent = css.getPropertyValue("--vg-accent").trim() || "#b85f12";
    const warning = css.getPropertyValue("--vg-warning").trim() || "#8a4f00";
    const line = css.getPropertyValue("--vg-border").trim() || "#dfe5e3";

    ctx.clearRect(0, 0, W, H);
    const px = (s: Star) => [s.x * W, H - s.y * H] as const;

    // The dome's arc and the beam, flat strokes only: no glow, no gradient (art §1.3).
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, H - 0.05 * H, 0.42 * W, 0.42 * H, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();

    for (const star of dome.stars) {
      const [x, y] = px(star);
      ctx.beginPath();
      ctx.arc(x, y, star.gold ? 7 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = star.gold ? accent : ink;
      ctx.globalAlpha = star.gold ? 1 : Math.max(0.35, 1 - (star.rank - 1) * 0.18);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (star.stale) {
        ctx.strokeStyle = warning;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = muted;
      ctx.font = "11px sans-serif";
      ctx.fillText(`#${star.rank}`, x + 9, y + 4);
    }

    if (dome.missingGold) {
      // Outside the pull: a dashed tether to the rim rather than a star in a made-up place.
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(W / 2, H);
      ctx.lineTo(W - 10, 14);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = accent;
      ctx.font = "11px sans-serif";
      ctx.fillText(`hạng ${dome.missingGold.rank}`, W - 70, 11);
    }
  }, [dome]);

  if (items.length === 0) return null;

  const name =
    dome.missingGold || dome.stars.some((s) => s.gold)
      ? `${dome.stars.length} đoạn đã kéo, đoạn đáp án ở hạng ${
          dome.missingGold?.rank ?? dome.stars.find((s) => s.gold)?.rank
        }`
      : `${dome.stars.length} đoạn đã kéo`;

  return (
    <div className="mt-2">
      {/* The picture is the figure; the canvas is only the surface it is painted on, and
          jsx-a11y is right that a canvas must not carry role="img" itself. */}
      <div role="img" aria-label={name} aria-describedby={`${id}-stars`}>
        <canvas
          ref={canvas}
          width={W}
          height={H}
          aria-hidden="true"
          className="w-full max-w-80 rounded-sm border border-line bg-subtle"
        />
      </div>
      <p className="mt-1 max-w-prose text-xs text-fg-muted">{DOME_VI}</p>
      <ul id={`${id}-stars`} className="sr-only">
        {dome.stars.map((star) => (
          <li key={star.chunkId}>
            <button type="button" onClick={() => onSelect?.(star.chunkId)}>
              {label(star)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
