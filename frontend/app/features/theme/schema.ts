import * as v from "valibot";

const HexColor = v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i, "Expected a #rrggbb colour"));
const ThemeId = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/, "Invalid theme id"));
const RelativeAsset = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9][a-z0-9/._-]*$/i, "Expected a relative asset path"),
  v.check((path) => !path.includes(".."), "Asset path must stay inside the theme folder"),
);

const BuildingColors = v.strictObject({
  wall: HexColor,
  trim: HexColor,
  roof: HexColor,
});

const Positive = v.pipe(v.number(), v.minValue(0), v.maxValue(10));

/**
 * One time of day for the hub (art §3, rev. 2026-10-08): the two three.js lights the figures
 * use, which are also baked into the static vertex colours, plus a rim term for baked faces.
 */
const LightPresetSchema = v.strictObject({
  sky: HexColor,
  ground: HexColor,
  hemisphere: Positive,
  sun: HexColor,
  sunIntensity: Positive,
  /** Towards the sun; y must stay above the ground. */
  sunDirection: v.pipe(
    v.tuple([v.number(), v.number(), v.number()]),
    v.check(([, y]) => y > 0.1, "The sun must be above the horizon"),
  ),
  rim: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
});

/** A hub NPC's display name and outfit (npc-cast v0.4 §8); the role's code stays in layout.ts. */
const NpcLook = v.strictObject({
  /** How the hint, the zone list and the dialog name them, honorific first, in lower case. */
  name: v.pipe(v.string(), v.nonEmpty(), v.maxLength(32)),
  top: HexColor,
  bottom: HexColor,
  accent: HexColor,
});

/** The four phases of the hub's day, from the sun at the theme's place (campus v0.4 W0.1). */
export const TimeOfDaySchema = v.picklist(["dawn", "day", "dusk", "night"]);

/**
 * Where the campus stands: the hub's time of day comes from the sun here, and the weather chip
 * names it; the browser fetches Open-Meteo's weather for it. Never the viewer's location.
 */
const PlaceSchema = v.strictObject({
  name: v.pipe(v.string(), v.nonEmpty()),
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  timeZone: v.pipe(
    v.string(),
    v.check((timeZone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone });
        return true;
      } catch {
        return false;
      }
    }, "Unknown IANA time zone"),
  ),
});

export const ThemeSummarySchema = v.strictObject({
  id: ThemeId,
  name: v.pipe(v.string(), v.nonEmpty()),
});

export const ThemeIndexSchema = v.strictObject({
  themes: v.pipe(v.array(ThemeSummarySchema), v.minLength(1)),
});

export const ThemeManifestSchema = v.strictObject({
  id: ThemeId,
  name: v.pipe(v.string(), v.nonEmpty()),
  brand: v.strictObject({
    programName: v.nullable(v.string()),
    orgName: v.nullable(v.string()),
    disclaimer: v.nullable(v.string()),
  }),
  place: PlaceSchema,
  fonts: v.strictObject({
    preload: v.array(RelativeAsset),
  }),
  hero: v.strictObject({
    sources: v.pipe(
      v.array(v.strictObject({ src: RelativeAsset, width: v.pipe(v.number(), v.integer()) })),
      v.minLength(1),
    ),
    width: v.pipe(v.number(), v.integer()),
    height: v.pipe(v.number(), v.integer()),
    alt: v.string(),
    credit: v.nullable(v.string()),
  }),
  campus: v.strictObject({
    ground: HexColor,
    path: HexColor,
    plaza: HexColor,
    water: HexColor,
    foliage: HexColor,
    trunk: HexColor,
    player: HexColor,
    npc: HexColor,
    landmark: v.strictObject({
      archetype: v.picklist(["spire-hall", "clock-tower"]),
      name: v.pipe(v.string(), v.nonEmpty()),
      wall: HexColor,
      trim: HexColor,
      roof: HexColor,
      accent: HexColor,
      colonnades: v.boolean(),
    }),
    buildings: v.strictObject({
      library: BuildingColors,
      watchtower: BuildingColors,
      market: BuildingColors,
    }),
    lights: v.strictObject({
      dawn: LightPresetSchema,
      day: LightPresetSchema,
      dusk: LightPresetSchema,
      night: LightPresetSchema,
    }),
    npcs: v.strictObject({
      guard: NpcLook,
      registrar: NpcLook,
      operator: NpcLook,
      examiner: NpcLook,
    }),
  }),
});

export type ThemeSummary = v.InferOutput<typeof ThemeSummarySchema>;
export type ThemeManifest = v.InferOutput<typeof ThemeManifestSchema>;
export type CampusTheme = ThemeManifest["campus"];
export type LandmarkArchetype = CampusTheme["landmark"]["archetype"];
export type TimeOfDay = v.InferOutput<typeof TimeOfDaySchema>;
export type LightPreset = CampusTheme["lights"]["day"];
export type NpcLook = CampusTheme["npcs"]["guard"];
export type Place = ThemeManifest["place"];

export function parseThemeIndex(data: unknown): ThemeSummary[] {
  return v.parse(ThemeIndexSchema, data).themes;
}

export function parseThemeManifest(data: unknown): ThemeManifest {
  return v.parse(ThemeManifestSchema, data);
}
