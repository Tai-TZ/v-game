import * as v from "valibot";

/**
 * Wire shapes of the engine API (docs/design/engine-v0.2.md §6–§9; backend `api/routes/*`,
 * `engine/types.py`). Objects are loose: the client reads only the fields it uses, so the server
 * may add fields without breaking it.
 */

export const BLOCK_TYPES = [
  "input",
  "output",
  "corpus",
  "chunker",
  "vector_search",
  "bm25_search",
  "fusion",
  "rerank",
  "context_packer",
  "llm",
] as const;
export const BlockTypeSchema = v.picklist(BLOCK_TYPES);
export type BlockType = v.InferOutput<typeof BlockTypeSchema>;

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const Json = v.custom<JsonValue>(() => true);

const Int = v.pipe(v.number(), v.integer());

// --- Graph (engine-v0.2 §7.1) ---------------------------------------------------------------

export const GraphNodeSchema = v.object({
  id: v.string(),
  type: BlockTypeSchema,
  params: v.optional(v.record(v.string(), Json), {}),
});
export const GraphSchema = v.object({
  schema: v.literal(1),
  nodes: v.array(GraphNodeSchema),
  edges: v.array(v.tuple([v.string(), v.string()])),
});
export type GraphNode = v.InferOutput<typeof GraphNodeSchema>;
export type Graph = v.InferOutput<typeof GraphSchema>;

// --- GET /api/blocks ------------------------------------------------------------------------

const PortSchema = v.looseObject({
  type: v.string(),
  type_vi: v.string(),
  many: v.boolean(),
  required: v.boolean(),
});

/** One property of a block's params JSON Schema (Pydantic `model_json_schema`). */
export const ParamSchemaSchema = v.looseObject({
  type: v.optional(v.string()),
  title: v.optional(v.string()),
  default: v.optional(Json),
  enum: v.optional(v.array(Json)),
  const: v.optional(Json),
  minimum: v.optional(v.number()),
  maximum: v.optional(v.number()),
  multipleOf: v.optional(v.number()),
});
export type ParamSchema = v.InferOutput<typeof ParamSchemaSchema>;

export const BlockSpecSchema = v.looseObject({
  type: BlockTypeSchema,
  name_vi: v.string(),
  inputs: v.record(v.string(), PortSchema),
  outputs: v.record(v.string(), PortSchema),
  params: v.looseObject({
    properties: v.optional(v.record(v.string(), ParamSchemaSchema), {}),
  }),
});
export const BlocksResponseSchema = v.object({ blocks: v.array(BlockSpecSchema) });
export type BlockSpec = v.InferOutput<typeof BlockSpecSchema>;
export type Blocks = Readonly<Record<BlockType, BlockSpec>>;

// --- GET /api/levels/{id} (PublicLevel, engine-v0.2 §9.2) -----------------------------------

export const ParamLimitSchema = v.looseObject({
  ge: v.optional(v.number()),
  le: v.optional(v.number()),
  multiple_of: v.optional(v.number()),
  const: v.optional(Json),
});
export type ParamLimit = v.InferOutput<typeof ParamLimitSchema>;

export const PublicLevelSchema = v.looseObject({
  id: v.string(),
  version: Int,
  zone: v.string(),
  title: v.string(),
  brief: v.string(),
  kind: v.picklist(["standard", "incident"]),
  corpus: v.array(v.string()),
  allowed_blocks: v.array(BlockTypeSchema),
  locked_nodes: v.array(v.string()),
  param_limits: v.record(v.string(), ParamLimitSchema),
  prompt_cards: v.record(v.string(), v.string()),
  starter_graph: GraphSchema,
  token_budget: Int,
  stars_vi: v.array(v.string()),
  // Star rules stars_vi words (engine-v0.2 §9.2); the star evidence of §8.6 reads them.
  // Optional here and in case_counts.info: Vercel deploys before Render, so the page meets the
  // older backend for a while; the evidence then just leaves those parts out.
  s1_required: v.optional(v.array(v.string()), []),
  s3_forbidden_labels: v.optional(v.array(v.string()), []),
  visible_cases: v.array(v.looseObject({ id: v.string(), vai: v.string(), question: v.string() })),
  // `info`: cases that run (one AI call each) but earn no star.
  case_counts: v.looseObject({ normal: Int, trap: Int, info: v.optional(Int, 0) }),
});
export type PublicLevel = v.InferOutput<typeof PublicLevelSchema>;

// --- POST /api/runs -------------------------------------------------------------------------

export const IssueSchema = v.looseObject({
  code: v.string(),
  severity: v.picklist(["error", "info"]),
  node: v.nullish(v.string(), null),
  port: v.nullish(v.string(), null),
  message_vi: v.string(),
});
export type Issue = v.InferOutput<typeof IssueSchema>;

export const PostRunResponseSchema = v.looseObject({
  run_id: v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/)),
  created: v.boolean(),
  issues: v.array(IssueSchema),
});

// --- SSE events (engine-v0.2 §8) ------------------------------------------------------------

const Tokens = v.looseObject({ in: Int, out: Int });

const RetrievedItem = v.looseObject({
  chunk_id: v.string(),
  rank: Int,
  score: v.number(),
  doc_id: v.string(),
  dieu: Int,
  khoan: v.array(Int),
  hieu_luc: v.boolean(),
});
export const FactSchema = v.variant("kind", [
  v.looseObject({ kind: v.literal("retrieved"), items: v.array(RetrievedItem) }),
  v.looseObject({
    kind: v.literal("pack"),
    included: v.array(v.string()),
    dropped: v.array(v.string()),
    tokens: v.looseObject({ docs: Int, query: Int, total: Int, budget: Int }),
  }),
  v.looseObject({
    kind: v.literal("llm"),
    cited_ids: v.array(v.string()),
    replayed: v.boolean(),
    model: v.string(),
    system_tokens: Int,
    answer: v.optional(v.string()),
  }),
]);
export type Fact = v.InferOutput<typeof FactSchema>;
/** Unknown fact kinds are dropped instead of failing the whole event. */
const Facts = v.pipe(
  v.array(v.unknown()),
  v.transform((items) =>
    items.flatMap((item) => {
      const parsed = v.safeParse(FactSchema, item);
      return parsed.success ? [parsed.output] : [];
    }),
  ),
);

const CaseRoleSchema = v.picklist(["visible", "hidden", "trap"]);
export type CaseRole = v.InferOutput<typeof CaseRoleSchema>;

const StarResultSchema = v.looseObject({
  stars: Int,
  s1: v.boolean(),
  s2: v.boolean(),
  s3: v.boolean(),
  normal_passed: Int,
  normal_total: Int,
  traps_passed: Int,
  traps_total: Int,
  tokens: Int,
  budget: Int,
});
export type StarResult = v.InferOutput<typeof StarResultSchema>;

const GoldRevealSchema = v.looseObject({
  gold_chunks: v.array(v.string()),
  ranks: v.record(v.string(), v.nullable(Int)),
  in_pack: v.boolean(),
  flags: v.array(v.string()),
});
export type GoldReveal = v.InferOutput<typeof GoldRevealSchema>;

const RunReportSchema = v.looseObject({
  gold: v.record(v.string(), GoldRevealSchema),
  diagnosis: v.array(
    v.looseObject({
      case: v.nullable(v.string()),
      flag: v.string(),
      // "regression" only: the flag that broke, for "Xem ở".
      cause: v.optional(v.string()),
      message_vi: v.string(),
    }),
  ),
});
export type RunReport = v.InferOutput<typeof RunReportSchema>;

export const EVENT_SCHEMAS = {
  "run.started": v.looseObject({
    cases: v.array(
      v.looseObject({
        id: v.string(),
        role: CaseRoleSchema,
        vai: v.string(),
        question: v.optional(v.string()),
      }),
    ),
    ingestion: v.array(
      v.looseObject({ node: v.string(), variant: v.string(), chunks: Int, avg_tokens: Int }),
    ),
  }),
  "step.started": v.looseObject({ case: v.string(), node: v.string(), block: v.string() }),
  "step.finished": v.looseObject({
    case: v.string(),
    node: v.string(),
    block: v.string(),
    status: v.string(),
    summary: v.string(),
    tokens: Tokens,
    ms: Int,
    facts: Facts,
  }),
  "case.graded": v.looseObject({
    case: v.string(),
    status: v.string(),
    passed: v.boolean(),
    counted: v.boolean(),
    criteria: v.record(v.string(), v.boolean()),
    labels: v.array(v.string()),
  }),
  "run.scored": v.looseObject({ score: StarResultSchema }),
  "run.finished": v.looseObject({
    report: RunReportSchema,
    models: v.record(v.string(), Int),
  }),
  "run.failed": v.looseObject({ code: v.string(), message_vi: v.string() }),
} as const;

export type EventType = keyof typeof EVENT_SCHEMAS;
export const EVENT_TYPES = Object.keys(EVENT_SCHEMAS) as EventType[];
export type RunEvent = {
  [K in EventType]: { type: K } & v.InferOutput<(typeof EVENT_SCHEMAS)[K]>;
}[EventType];

/** Parses one SSE `data:` payload of a known type; null when it does not match the contract. */
export function parseEvent(type: EventType, data: string): RunEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return null;
  }
  const parsed = v.safeParse(EVENT_SCHEMAS[type], json);
  return parsed.success ? ({ ...parsed.output, type } as RunEvent) : null;
}
