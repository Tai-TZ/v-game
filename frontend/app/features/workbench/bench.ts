import type { BlockType, Blocks, Graph, GraphNode, JsonValue, PublicLevel } from "./schema";

/**
 * The bench: one fixed slot per block type (workbench-v0.1 §3). Players attach, detach and tune
 * toys; a pure function turns the slots into the graph JSON the server runs, and another reads a
 * graph back into slots. No graph editor: a Library graph has at most ten nodes of fixed shape.
 */

/** Slot order = topological order = Tab order (§3.1). */
export const SLOT_ORDER: readonly BlockType[] = [
  "input",
  "corpus",
  "chunker",
  "vector_search",
  "bm25_search",
  "fusion",
  "rerank",
  "context_packer",
  "llm",
  "output",
];
/** Slots the player can attach and detach. */
export const OPTIONAL_SLOTS = ["vector_search", "bm25_search", "fusion", "rerank"] as const;
export type SlotType = (typeof OPTIONAL_SLOTS)[number];
export const isOptional = (type: BlockType): type is SlotType =>
  (OPTIONAL_SLOTS as readonly BlockType[]).includes(type);

const DEFAULT_ID: Readonly<Record<BlockType, string>> = {
  input: "q",
  corpus: "kb",
  chunker: "ix",
  vector_search: "vs",
  bm25_search: "bm",
  fusion: "fu",
  rerank: "rr",
  context_packer: "pk",
  llm: "llm",
  output: "out",
};

export type Params = Record<string, JsonValue>;
export type Cards = readonly [string | null, string | null, string | null];

export interface Bench {
  attached: Readonly<Record<SlotType, boolean>>;
  /** By node id, detached slots included (re-attaching keeps their values). */
  params: Readonly<Record<string, Params>>;
  /** Prompt card keys in the three Lăng kính slots (§3.3). */
  cards: Cards;
}

export type Domain =
  | { kind: "fixed"; value: JsonValue }
  | { kind: "choice"; options: JsonValue[] }
  | { kind: "range"; min: number; max: number; step: number; integer: boolean }
  | { kind: "toggle" };

/** Level + block registry: everything the bench is built from. */
export interface Env {
  level: PublicLevel;
  blocks: Blocks;
}

/** Node id per block type: the starter graph's id when it has that type, else the default. */
export function nodeIds(level: PublicLevel): Readonly<Record<BlockType, string>> {
  const ids = { ...DEFAULT_ID };
  for (const node of level.starter_graph.nodes) ids[node.type] = node.id;
  return ids;
}

export const isAllowed = (level: PublicLevel, type: BlockType) =>
  level.allowed_blocks.includes(type);
export const isLocked = (level: PublicLevel, type: BlockType) =>
  level.locked_nodes.includes(nodeIds(level)[type]);

/** Params the bench tunes with a control; `system_prompt` is the Lăng kính (cards). */
export const paramNames = (blocks: Blocks, type: BlockType) =>
  Object.keys(blocks[type].params.properties).filter((name) => name !== "system_prompt");

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
/** 0.15, not 0.15000000000000002 (§3.2). */
export const roundToStep = (value: number, step: number) =>
  Number((Math.round(value / step) * step).toFixed(decimals(step)));

/** A control's domain = the block's JSON Schema ∩ the level's `param_limits` (§3.2). */
export function domain(env: Env, type: BlockType, param: string): Domain | null {
  const schema = env.blocks[type].params.properties[param];
  if (!schema) return null;
  const limit = env.level.param_limits[`${type}.${param}`];
  // `!== undefined`, never truthiness: L1 fixes values at 0 and at false.
  if (limit?.const !== undefined) return { kind: "fixed", value: limit.const };
  if (schema.const !== undefined) return { kind: "fixed", value: schema.const };
  if (schema.enum) return { kind: "choice", options: schema.enum };
  if (schema.type === "boolean") return { kind: "toggle" };
  if (schema.type === "integer" || schema.type === "number") {
    const min = Math.max(schema.minimum ?? -Infinity, limit?.ge ?? -Infinity);
    const max = Math.min(schema.maximum ?? Infinity, limit?.le ?? Infinity);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    const step = limit?.multiple_of ?? schema.multipleOf ?? 1;
    return { kind: "range", min, max, step, integer: schema.type === "integer" };
  }
  return null;
}

export function inDomain(d: Domain, value: JsonValue | undefined): boolean {
  switch (d.kind) {
    case "fixed":
      return sameJson(value ?? null, d.value);
    case "choice":
      return d.options.some((option) => sameJson(option, value ?? null));
    case "toggle":
      return typeof value === "boolean";
    case "range": {
      if (typeof value !== "number" || value < d.min || value > d.max) return false;
      if (d.integer && !Number.isInteger(value)) return false;
      const ratio = value / d.step;
      return Math.abs(ratio - Math.round(ratio)) < 1e-9;
    }
  }
}

/** Value of a newly attached control: the schema default, clamped into the domain. */
function initialValue(env: Env, type: BlockType, param: string, d: Domain): JsonValue {
  const fallback = env.blocks[type].params.properties[param]?.default ?? null;
  switch (d.kind) {
    case "fixed":
      return d.value;
    case "choice":
      return d.options.some((option) => sameJson(option, fallback))
        ? fallback
        : (d.options[0] ?? null);
    case "toggle":
      return typeof fallback === "boolean" ? fallback : false;
    case "range": {
      const start = typeof fallback === "number" ? fallback : d.min;
      return roundToStep(Math.min(d.max, Math.max(d.min, start)), d.step);
    }
  }
}

function initialParams(env: Env, type: BlockType): Params {
  const params: Params = {};
  for (const name of paramNames(env.blocks, type)) {
    const d = domain(env, type, name);
    if (d) params[name] = initialValue(env, type, name, d);
  }
  return params;
}

/** Every param of every node, with schema defaults filled in (how tests compare graphs). */
export function fillDefaults(blocks: Blocks, graph: Graph): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const defaults: Params = {};
      for (const [name, schema] of Object.entries(blocks[node.type].params.properties)) {
        if (schema.default !== undefined) defaults[name] = schema.default;
      }
      return { ...node, params: { ...defaults, ...node.params } };
    }),
  };
}

/** JSON equality, ignoring object key order. */
export function sameJson(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([x], [y]) => (x < y ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// --- Lăng kính ------------------------------------------------------------------------------

/** `system_prompt` = the texts of the non-empty card slots, in slot order, joined by "\n". */
export function systemPrompt(level: PublicLevel, cards: Cards): string {
  return cards.flatMap((key) => (key === null ? [] : [level.prompt_cards[key] ?? ""])).join("\n");
}

/** Cards back from a prompt: each line must be one card verbatim, at most 3, no repeats. */
export function cardsFromPrompt(level: PublicLevel, prompt: string): Cards | null {
  if (prompt === "") return [null, null, null];
  const lines = prompt.split("\n");
  if (lines.length > 3) return null;
  const entries = Object.entries(level.prompt_cards);
  const keys = lines.map((line) => entries.find(([, text]) => text === line)?.[0] ?? null);
  if (keys.some((key) => key === null) || new Set(keys).size !== keys.length) return null;
  return [keys[0] ?? null, keys[1] ?? null, keys[2] ?? null];
}

// --- Bench <-> graph ------------------------------------------------------------------------

const starterNode = (level: PublicLevel, id: string) =>
  level.starter_graph.nodes.find((node) => node.id === id);

/** Current params of a slot: the starter's for a locked node, the bench's otherwise. */
export function slotParams(env: Env, bench: Bench, type: BlockType): Params {
  const id = nodeIds(env.level)[type];
  if (isLocked(env.level, type)) {
    const node = starterNode(env.level, id);
    return node
      ? (fillDefaults(env.blocks, { schema: 1, nodes: [node], edges: [] }).nodes[0]?.params ?? {})
      : {};
  }
  return bench.params[id] ?? {};
}

const SPECIAL = new Set<BlockType>(["input", "corpus", "output"]);

/** The graph JSON for a bench (§3.4). Node and edge order match the level files exactly. */
export function graphFromBench(env: Env, bench: Bench): Graph {
  const { level } = env;
  const ids = nodeIds(level);
  const node = (type: BlockType): GraphNode => {
    const id = ids[type];
    if (isLocked(level, type)) {
      const locked = starterNode(level, id);
      if (locked) return locked;
    }
    if (SPECIAL.has(type)) return { id, type, params: {} };
    const params = { ...(bench.params[id] ?? {}) };
    if (type === "llm") params.system_prompt = systemPrompt(level, bench.cards);
    return { id, type, params };
  };
  const on = (type: SlotType) => isAllowed(level, type) && bench.attached[type];
  const q = ids.input;
  const nodes: GraphNode[] = [node("input"), node("corpus"), node("chunker")];
  const edges: [string, string][] = [];
  const lists: string[] = [];
  for (const type of ["vector_search", "bm25_search"] as const) {
    if (!on(type)) continue;
    nodes.push(node(type));
    edges.push(
      [`${q}.query`, `${ids[type]}.query`],
      [`${ids.chunker}.index`, `${ids[type]}.index`],
    );
    lists.push(ids[type]);
  }
  let heads = lists;
  if (on("fusion")) {
    nodes.push(node("fusion"));
    for (const list of lists) edges.push([`${list}.docs`, `${ids.fusion}.docs`]);
    heads = [ids.fusion];
  }
  if (on("rerank")) {
    nodes.push(node("rerank"));
    edges.push([`${q}.query`, `${ids.rerank}.query`]);
    for (const head of heads) edges.push([`${head}.docs`, `${ids.rerank}.docs`]);
    heads = [ids.rerank];
  }
  nodes.push(node("context_packer"));
  for (const head of heads) edges.push([`${head}.docs`, `${ids.context_packer}.docs`]);
  edges.push([`${q}.query`, `${ids.context_packer}.query`]);
  nodes.push(node("llm"));
  edges.push([`${ids.context_packer}.context`, `${ids.llm}.context`]);
  nodes.push(node("output"));
  edges.push([`${ids.llm}.answer`, `${ids.output}.answer`]);
  return { schema: 1, nodes, edges };
}

/**
 * Reads a graph back into slots, or null when the bench cannot draw it: a type twice, a value
 * outside its domain, an unknown card, or any edge/order the bench would not produce.
 */
export function benchFromGraph(env: Env, graph: Graph): Bench | null {
  const { level, blocks } = env;
  const ids = nodeIds(level);
  const byType = new Map<BlockType, GraphNode>();
  for (const node of graph.nodes) {
    if (byType.has(node.type) || !isAllowed(level, node.type)) return null;
    byType.set(node.type, node);
  }
  const filled = fillDefaults(blocks, graph);
  const params: Record<string, Params> = {};
  let cards: Cards = [null, null, null];
  for (const type of SLOT_ORDER) {
    if (!isAllowed(level, type) || SPECIAL.has(type) || isLocked(level, type)) continue;
    const found = filled.nodes.find((node) => node.type === type);
    const own = found ? { ...found.params } : initialParams(env, type);
    if (type === "llm") {
      const parsed = cardsFromPrompt(
        level,
        typeof own.system_prompt === "string" ? own.system_prompt : "",
      );
      if (!parsed) return null;
      cards = parsed;
      delete own.system_prompt;
    }
    for (const name of Object.keys(own)) {
      const d = domain(env, type, name);
      if (!d || !inDomain(d, own[name])) return null;
    }
    params[ids[type]] = own;
  }
  const bench: Bench = {
    attached: {
      vector_search: byType.has("vector_search"),
      bm25_search: byType.has("bm25_search"),
      fusion: byType.has("fusion"),
      rerank: byType.has("rerank"),
    },
    params,
    cards,
  };
  return sameJson(fillDefaults(blocks, graphFromBench(env, bench)), filled) ? bench : null;
}

export const starterBench = (env: Env) => benchFromGraph(env, env.level.starter_graph);

// --- Edits ----------------------------------------------------------------------------------

export function setParam(
  env: Env,
  bench: Bench,
  type: BlockType,
  param: string,
  value: JsonValue,
): Bench {
  const id = nodeIds(env.level)[type];
  return { ...bench, params: { ...bench.params, [id]: { ...bench.params[id], [param]: value } } };
}

export const setAttached = (bench: Bench, type: SlotType, on: boolean): Bench => ({
  ...bench,
  attached: { ...bench.attached, [type]: on },
});

export function setCard(bench: Bench, slot: 0 | 1 | 2, key: string | null): Bench {
  const cards: [string | null, string | null, string | null] = [...bench.cards];
  cards[slot] = key;
  return { ...bench, cards };
}
