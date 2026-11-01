import { useId, type ReactElement } from "react";

import { ChevronDownIcon } from "~/components/ui/icons";

import type { LevelScene } from "./copy";

/**
 * Hiện trường (scenario §3): the object a level opens on. L1 is a poster pinned to the notice
 * board, L2 a leave form stamped overdue, L3 the printout a whole queue is holding. Three
 * shapes, so the head of each level reads as its own place before a single knob is touched.
 *
 * It takes the place of cô Lan's box, and her line moves behind the disclosure with the rest
 * of the story: at 1280×800 the head had no room to spare, and one more box pushed "Mở ca" off
 * the first screen (workbench §2.1). Her line repeats the goals the right column already lists.
 *
 * Static text only: what a recorded run said belongs to the replay and its stamp, never here.
 */
export function Scene({
  scene,
  lan,
  won = false,
  win,
}: {
  scene: LevelScene;
  lan: string;
  /** The level has a star: the scene shows its trouble fixed (cờ thế giới, scenario §3). */
  won?: boolean;
  /** Cô Lan's line for the first star (scenario §4), said once the level is won. */
  win?: string;
}): ReactElement {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      data-scene={scene.kind}
      className="mt-6 rounded-md border border-line bg-surface p-4"
    >
      <h2 id={id} className="sr-only">
        Hiện trường
      </h2>
      {object(scene, won)}
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand">
          Cô Lan kể lại chuyện tối nay
          <ChevronDownIcon />
        </summary>
        <div className="space-y-3 text-sm">
          {story(scene)}
          <figure>
            <figcaption>
              <span className="font-bold">Cô Lan</span>{" "}
              <span className="text-fg-muted">· Thủ thư ca tối</span>
            </figcaption>
            <blockquote className="mt-1">{lan}</blockquote>
          </figure>
          {won && win && (
            <figure>
              <figcaption>
                <span className="font-bold">Cô Lan</span>{" "}
                <span className="text-fg-muted">· sau sao đầu tiên</span>
              </figcaption>
              <blockquote className="mt-1">{win}</blockquote>
            </figure>
          )}
        </div>
      </details>
    </section>
  );
}

/** A stamp across the object once the trouble is fixed, in the success colour. */
function Fixed({ text }: { text: string }) {
  return (
    <span
      data-scene-won=""
      className="absolute top-1/2 right-3 -translate-y-1/2 -rotate-6 rounded-sm border-2 border-success bg-surface px-1.5 text-xs font-bold tracking-wider text-success"
    >
      {text}
    </span>
  );
}

function object(scene: LevelScene, won: boolean): ReactElement {
  switch (scene.kind) {
    case "poster":
      // A poster: a thick top edge like the tape that holds it. Taken down, it is struck through.
      return (
        <div className="relative">
          <blockquote
            data-scene-poster=""
            {...(won ? { "data-taken-down": "" } : {})}
            className={`rounded-sm border border-t-4 border-line-strong px-3 py-2 text-sm font-semibold ${won ? "text-fg-muted line-through" : ""}`}
          >
            «{scene.poster}»
          </blockquote>
          {won && <Fixed text={scene.won} />}
        </div>
      );
    case "form":
      // A form: its title on a ruled line and the stamp across its corner.
      return (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-line-strong px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{scene.form}</p>
            <div aria-hidden="true" className="mt-1 h-px bg-line" />
          </div>
          <span
            data-scene-stamp=""
            {...(won ? { "data-scene-won": "" } : {})}
            className={`shrink-0 -rotate-6 rounded-sm border-2 px-1.5 text-xs font-bold tracking-wider ${won ? "border-success text-success" : "border-danger text-danger"}`}
          >
            {won ? scene.won : scene.stamp}
          </span>
        </div>
      );
    case "dossier":
      // The printout: monospaced, like the counter's printer.
      return (
        <div
          data-scene-print=""
          className="relative rounded-sm border border-line-strong bg-subtle px-3 py-2"
        >
          <p className="font-mono text-sm font-semibold">{scene.print.title}</p>
          <p className="font-mono text-sm">{scene.print.body}</p>
          {won && <Fixed text={scene.won} />}
        </div>
      );
  }
}

function story(scene: LevelScene): ReactElement {
  switch (scene.kind) {
    case "poster":
      return (
        <div className="space-y-1">
          <p className="text-fg-muted">{scene.where}</p>
          <p>{scene.note}</p>
        </div>
      );
    case "form":
      return (
        <div className="space-y-1">
          <p className="text-fg-muted">{scene.who}</p>
          <p>{scene.note}</p>
        </div>
      );
    case "dossier":
      return (
        <div className="space-y-2">
          <figure>
            <blockquote className="font-semibold">«{scene.quote.text}»</blockquote>
            <figcaption className="text-fg-muted">{scene.quote.who}</figcaption>
          </figure>
          <ul className="list-disc space-y-1 pl-5">
            {scene.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      );
  }
}
