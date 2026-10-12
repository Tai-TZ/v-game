/**
 * What changed between two configurations, one turnable variable at a time (N20).
 *
 * The honest-causality label of the comparison card rests entirely on the LENGTH of this list:
 * one change may suggest a cause, more than one may not. So a variable the player turns must
 * count as exactly one entry, and nothing else may count at all.
 */

import {
  cardsFromPrompt,
  domain,
  fillDefaults,
  isAllowed,
  isLocked,
  isOptional,
  nodeIds,
  sameJson,
  SLOT_ORDER,
  type Env,
} from "./bench";
import { TOY } from "./copy";
import type { BlockType, Graph, JsonValue } from "./schema";

export type Change =
  /** A block was attached or detached. */
  | { kind: "slot"; type: BlockType }
  /** One knob of one block moved. */
  | { kind: "param"; type: BlockType; param: string; from: JsonValue; to: JsonValue }
  /** One Lăng kính slot took a different card. */
  | { kind: "card"; slot: 0 | 1 | 2; from: string | null; to: string | null };

/** The joined prompt is three card slots; comparing it as one param would hide a swap. */
const CARDS = "system_prompt";

export function diffGraphs(env: Env, before: Graph, after: Graph): Change[] {
  // Normalised first: a param written out in one graph and defaulted in the other is the same
  // configuration, and a phantom change would make every rerun look like a two-variable test.
  const a = fillDefaults(env.blocks, before);
  const b = fillDefaults(env.blocks, after);
  const node = (graph: Graph, id: string) => graph.nodes.find((n) => n.id === id);
  const ids = nodeIds(env.level);
  const changes: Change[] = [];

  for (const type of SLOT_ORDER) {
    const id = ids[type];
    const was = node(a, id);
    const now = node(b, id);
    if ((was === undefined) !== (now === undefined)) changes.push({ kind: "slot", type });
    // Attaching a block is one change, not one per param it brings with it -- and a block
    // missing from either side has no params to compare.
    if (was === undefined || now === undefined) continue;
    for (const param of Object.keys(env.blocks[type].params.properties)) {
      if (param === CARDS) continue;
      // Every param is a scalar today, so this is `!==`; it stays structural because the day
      // one becomes an array, `!==` would report a phantom change on every rerun.
      if (!sameJson(was.params[param], now.params[param])) {
        changes.push({
          kind: "param",
          type,
          param,
          from: was.params[param] ?? null,
          to: now.params[param] ?? null,
        });
      }
    }
  }

  // The cards, slot by slot. An unreadable prompt (hand-edited JSON, an older level) is left
  // alone rather than reported as three changes.
  const llm = ids.llm;
  // Narrowed, not coerced: a non-string here is a graph nobody drew, and String() would turn
  // it into "[object Object]" and then report three card changes.
  const prompt = (graph: Graph) => {
    const value = node(graph, llm)?.params[CARDS];
    return typeof value === "string" ? value : "";
  };
  const wasCards = cardsFromPrompt(env.level, prompt(a));
  const nowCards = cardsFromPrompt(env.level, prompt(b));
  if (wasCards !== null && nowCards !== null) {
    for (const slot of [0, 1, 2] as const) {
      if (wasCards[slot] !== nowCards[slot]) {
        changes.push({ kind: "card", slot, from: wasCards[slot], to: nowCards[slot] });
      }
    }
  }
  return changes;
}

export type NextDirection = "on" | "off" | "up" | "down" | "add" | "remove";

export interface NextPick {
  type: BlockType;
  param?: string;
  /** Only when `param` is "system_prompt": which Lăng kính slot. */
  slot?: 0 | 1 | 2;
  direction: NextDirection;
}

export interface NextOption {
  label: string;
  pick: NextPick;
}

/**
 * "Lần tới đổi đúng một thứ" (N20): every variable the player could turn on the CURRENT graph,
 * each as one named direction -- never free text, so a later count of what players try next
 * (T18, not built here) has a closed set to count over.
 *
 * Only what the graph on screen can actually offer: an unattached optional block offers only to
 * attach it (its knobs are not on screen yet to turn); an attached one offers to detach it, plus
 * up/down on each of its own non-fixed numeric or boolean knobs. A level-locked block offers
 * nothing at all -- the player cannot touch it, so suggesting a turn on it would be a lie.
 */
export function nextPickOptions(env: Env, graph: Graph): NextOption[] {
  const ids = nodeIds(env.level);
  const node = (id: string) => graph.nodes.find((n) => n.id === id);
  const options: NextOption[] = [];

  const knobOptions = (type: BlockType, params: Readonly<Record<string, JsonValue>>) => {
    for (const param of Object.keys(env.blocks[type].params.properties)) {
      if (param === "system_prompt") continue; // the three card slots, handled separately
      const d = domain(env, type, param);
      if (d === null || d.kind === "fixed" || d.kind === "choice") continue; // not directional
      const name = TOY[type].params?.[param] ?? param;
      if (d.kind === "toggle") {
        const on = params[param] === true;
        options.push({
          label: on ? `Rút ${name}` : `Gắn ${name}`,
          pick: { type, param, direction: on ? "off" : "on" },
        });
      } else {
        options.push({ label: `Tăng ${name}`, pick: { type, param, direction: "up" } });
        options.push({ label: `Giảm ${name}`, pick: { type, param, direction: "down" } });
      }
    }
  };

  for (const type of SLOT_ORDER) {
    const id = ids[type];
    if (isLocked(env.level, type) || !isAllowed(env.level, type)) continue;
    if (isOptional(type)) {
      const n = node(id);
      if (n === undefined) {
        options.push({ label: `Gắn ${TOY[type].name}`, pick: { type, direction: "on" } });
      } else {
        options.push({ label: `Rút ${TOY[type].name}`, pick: { type, direction: "off" } });
        knobOptions(type, n.params);
      }
      continue;
    }
    // Always-present blocks (chunker, context_packer): their knobs are always on screen.
    const n = node(id);
    if (n !== undefined && type !== "input" && type !== "corpus" && type !== "output") {
      knobOptions(type, n.params);
    }
  }

  // The three Lăng kính slots, from the llm node's joined prompt.
  const llm = node(ids.llm);
  const prompt = typeof llm?.params.system_prompt === "string" ? llm.params.system_prompt : "";
  const cards = cardsFromPrompt(env.level, prompt);
  if (cards !== null && !isLocked(env.level, "llm") && isAllowed(env.level, "llm")) {
    for (const slot of [0, 1, 2] as const) {
      const filled = cards[slot] !== null;
      options.push({
        label: filled ? `Bỏ Lăng kính (khe ${slot + 1})` : `Thêm Lăng kính (khe ${slot + 1})`,
        pick: { type: "llm", param: "system_prompt", slot, direction: filled ? "remove" : "add" },
      });
    }
  }

  return options;
}
