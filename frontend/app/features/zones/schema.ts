import * as v from "valibot";

/** Mirrors backend/src/vgame/content/models.py. */
const Slug = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/));

export const ZoneLocationSchema = v.picklist(["library", "watchtower", "market"]);
export const ZoneStatusSchema = v.picklist(["open", "coming_soon"]);

export const LevelSchema = v.object({
  id: Slug,
  order: v.pipe(v.number(), v.integer(), v.minValue(1)),
  title: v.string(),
  brief: v.string(),
  concepts: v.array(v.string()),
  kind: v.picklist(["standard", "incident"]),
});

const zoneFields = {
  id: Slug,
  name: v.string(),
  summary: v.string(),
  concepts: v.array(v.string()),
  location: ZoneLocationSchema,
  status: ZoneStatusSchema,
};

export const ZoneSummarySchema = v.object({
  ...zoneFields,
  level_count: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export const ZoneSchema = v.object({
  ...zoneFields,
  levels: v.array(LevelSchema),
});

export const ZoneListResponseSchema = v.object({ zones: v.array(ZoneSummarySchema) });
export const ZoneContentSchema = v.object({ zones: v.array(ZoneSchema) });

export type ZoneLocation = v.InferOutput<typeof ZoneLocationSchema>;
export type ZoneStatus = v.InferOutput<typeof ZoneStatusSchema>;
export type Level = v.InferOutput<typeof LevelSchema>;
export type ZoneSummary = v.InferOutput<typeof ZoneSummarySchema>;
export type Zone = v.InferOutput<typeof ZoneSchema>;
