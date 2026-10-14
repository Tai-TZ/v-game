import * as v from "valibot";

import { runReducer, type RunView } from "./run";
import { EVENT_SCHEMAS, type EventType, type RunEvent } from "./schema";

/**
 * N4: the level opens on a run that already happened. B0 recorded one real run of each level's
 * starter configuration and shipped it as a static file, so the first thing a player sees costs
 * no AI call and does not wait on Render waking up (about a minute, X9).
 */
export interface RecordedRun {
  events: readonly RunEvent[];
}

const FileSchema = v.object({
  format: v.literal(1),
  level: v.string(),
  level_version: v.number(),
  events: v.array(v.looseObject({ type: v.string() })),
});

export const recordedUrl = (levelId: string) => `/runs/${encodeURIComponent(levelId)}.json`;

/**
 * Validates a shipped log against the level asking for it. Null on anything unexpected: a
 * missing picture is a far smaller loss than a picture of some other level's run.
 *
 * Every event goes through the same contract the live stream does, and the run.started is
 * stamped `scope: "da_ghi"` so the reducer's output can never be mistaken for the player's own
 * attempt -- the log carries a real `run.scored`, which would otherwise be written to their
 * progress as stars they did not earn.
 */
export function parseRecorded(
  levelId: string,
  levelVersion: number,
  raw: unknown,
): RecordedRun | null {
  const parsed = v.safeParse(FileSchema, raw);
  if (!parsed.success) return null;
  const file = parsed.output;
  if (file.level !== levelId || file.level_version !== levelVersion) return null;

  const events = file.events.flatMap((event): RunEvent[] => {
    const schema = EVENT_SCHEMAS[event.type as EventType] as
      (typeof EVENT_SCHEMAS)[EventType] | undefined;
    if (schema === undefined) return [];
    const body = v.safeParse(schema, event);
    if (!body.success) return [];
    const stamped =
      event.type === "run.started" ? { ...body.output, scope: "da_ghi" } : body.output;
    return [{ ...stamped, type: event.type } as RunEvent];
  });
  return events.length > 0 ? { events } : null;
}

/**
 * The log as a finished run view. Sequence numbers are the reducer's duplicate guard and start
 * above its initial 0, so building them here is the only way to get them right once.
 */
export function replayRecorded(log: RecordedRun): RunView | null {
  let run = runReducer(null, { kind: "reset", runId: RECORDED_RUN_ID });
  log.events.forEach((event, index) => {
    run = runReducer(run, { kind: "event", seq: index + 1, event });
  });
  return run === null ? null : { ...run, stream: "closed" };
}

/** Not a server run id: no cancel, no reconnect and no refund can ever name this run. */
export const RECORDED_RUN_ID = "da-ghi";
