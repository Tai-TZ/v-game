import { useId, type ReactElement } from "react";

import { ChevronDownIcon } from "~/components/ui/icons";

import type { LevelScene, Npc } from "./copy";

/**
 * Hiện trường (scenario §3): the object a level opens on. L1 is a poster pinned to the notice
 * board, L2 a leave form stamped overdue, L3 the printout a whole queue is holding, W1 the
 * refund receipt rolling out of the counter's printer. Each its own shape, so the head of each
 * level reads as its own place before a single knob is touched.
 *
 * It takes the place of cô Lan's box, and her line moves behind the disclosure with the rest
 * of the story: at 1280×800 the head had no room to spare, and one more box pushed "Mở ca" off
 * the first screen (workbench §2.1). Her line repeats the goals the right column already lists.
 *
 * Static text only: what a recorded run said belongs to the replay and its stamp, never here.
 */
export function Scene({
  scene,
  npc,
  line,
}: {
  scene: LevelScene;
  npc: Npc;
  line: string;
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
      {object(scene)}
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand">
          {npc.name} kể lại chuyện tối nay
          <ChevronDownIcon />
        </summary>
        <div className="space-y-3 text-sm">
          {story(scene)}
          <figure>
            <figcaption>
              <span className="font-bold">{npc.name}</span>{" "}
              <span className="text-fg-muted">· {npc.role}</span>
            </figcaption>
            <blockquote className="mt-1">{line}</blockquote>
          </figure>
        </div>
      </details>
    </section>
  );
}

function object(scene: LevelScene): ReactElement {
  switch (scene.kind) {
    case "poster":
      // A poster: a thick top edge like the tape that holds it.
      return (
        <blockquote
          data-scene-poster=""
          className="rounded-sm border border-t-4 border-line-strong px-3 py-2 text-sm font-semibold"
        >
          «{scene.poster}»
        </blockquote>
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
            className="shrink-0 -rotate-6 rounded-sm border-2 border-danger px-1.5 text-xs font-bold tracking-wider text-danger"
          >
            {scene.stamp}
          </span>
        </div>
      );
    case "dossier":
      // The printout: monospaced, like the counter's printer.
      return (
        <div
          data-scene-print=""
          className="rounded-sm border border-line-strong bg-subtle px-3 py-2"
        >
          <p className="font-mono text-sm font-semibold">{scene.print.title}</p>
          <p className="font-mono text-sm">{scene.print.body}</p>
        </div>
      );
    case "receipt":
      // A till roll: torn top edge, one line per refund, the last one bold.
      return (
        <div
          data-scene-receipt=""
          className="mx-auto max-w-sm rounded-b-sm border border-t-2 border-dashed border-line-strong bg-subtle px-3 py-2 font-mono text-sm"
        >
          <ul className="divide-y divide-dashed divide-line">
            {scene.lines.map((text) => (
              <li key={text} className="py-1 text-fg-muted">
                {text}
              </li>
            ))}
            <li data-scene-total="" className="py-1 font-bold">
              {scene.total}
            </li>
          </ul>
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
    case "receipt":
      return (
        <div className="space-y-1">
          <p className="text-fg-muted">{scene.where}</p>
          <p>{scene.note}</p>
        </div>
      );
  }
}
