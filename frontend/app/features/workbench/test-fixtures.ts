// Test-only helpers (vitest and Playwright): the API payloads captured in e2e/data and the level
// files of the backend (read-only). Never imported by app code.
import { readFileSync } from "node:fs";
import path from "node:path";

import * as v from "valibot";

import type { Env } from "./bench";
import { runReducer, type RunView } from "./run";
import {
  BlocksResponseSchema,
  EVENT_TYPES,
  GraphSchema,
  parseEvent,
  PublicLevelSchema,
  type BlockSpec,
  type BlockType,
  type EventType,
  type Graph,
} from "./schema";

// vitest and Playwright both run from frontend/.
const FRONTEND = process.cwd();
const readJson = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(path.resolve(FRONTEND, ...parts), "utf8"));
export const readText = (...parts: string[]) =>
  readFileSync(path.resolve(FRONTEND, ...parts), "utf8");

export const LEVEL_IDS = ["grounded-citation", "chunk-tuning", "article-number-lookup"] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export const publicLevelJson = (id: string) => readJson("e2e", "data", "levels", `${id}.json`);
export const blocksJson = () => readJson("e2e", "data", "blocks.json");

export function testEnv(id: LevelId): Env {
  const level = v.parse(PublicLevelSchema, publicLevelJson(id));
  const list = v.parse(BlocksResponseSchema, blocksJson()).blocks;
  return {
    level,
    blocks: Object.fromEntries(list.map((block) => [block.type, block])) as Record<
      BlockType,
      BlockSpec
    >,
  };
}

/** `backend/src/vgame/engine/levels/<id>.json`: reference graph and star rules. */
export function levelFile(id: LevelId) {
  const raw = readJson("..", "backend", "src", "vgame", "engine", "levels", `${id}.json`);
  return v.parse(
    v.looseObject({
      reference_graph: GraphSchema,
      rules: v.looseObject({
        s1_required: v.array(v.string()),
        s3_forbidden_labels: v.array(v.string()),
      }),
    }),
    raw,
  ) as { reference_graph: Graph; rules: { s1_required: string[]; s3_forbidden_labels: string[] } };
}

export interface SseFrame {
  id: number;
  event: string;
  data: string;
}

/** Frames of a captured `text/event-stream` body (comments such as `: ping` dropped). */
export function parseSse(text: string): SseFrame[] {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const fields: Record<string, string> = {};
      for (const line of block.split(/\r?\n/)) {
        if (!line || line.startsWith(":")) continue;
        const at = line.indexOf(":");
        const name = at < 0 ? line : line.slice(0, at);
        fields[name] = at < 0 ? "" : line.slice(at + 1).replace(/^ /, "");
      }
      return fields;
    })
    .filter((fields) => fields.event !== undefined && fields.data !== undefined)
    .map((fields) => ({
      id: Number(fields.id),
      event: fields.event ?? "",
      data: fields.data ?? "",
    }));
}

export const sseText = (frames: readonly SseFrame[]) =>
  frames.map((frame) => `id: ${frame.id}\nevent: ${frame.event}\ndata: ${frame.data}\n\n`).join("");

/** Run id of the captured and hand-written streams. */
export const RUN = "0123456789abcdef0123456789abcdef";

/** The run view after these frames, from `start` or from a fresh run. */
export function replay(frames: readonly SseFrame[], start: RunView | null = null): RunView | null {
  let state = start ?? runReducer(null, { kind: "reset", runId: RUN });
  for (const frame of frames) {
    const event = EVENT_TYPES.includes(frame.event as EventType)
      ? parseEvent(frame.event as EventType, frame.data)
      : null;
    if (event) state = runReducer(state, { kind: "event", seq: frame.id, event });
  }
  return state;
}

export const frame = (id: number, event: EventType, data: object): SseFrame => ({
  id,
  event,
  data: JSON.stringify({ type: event, run: RUN, ...data }),
});
