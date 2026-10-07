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
  }),
});

export type ThemeSummary = v.InferOutput<typeof ThemeSummarySchema>;
export type ThemeManifest = v.InferOutput<typeof ThemeManifestSchema>;
export type CampusTheme = ThemeManifest["campus"];
export type LandmarkArchetype = CampusTheme["landmark"]["archetype"];

export function parseThemeIndex(data: unknown): ThemeSummary[] {
  return v.parse(ThemeIndexSchema, data).themes;
}

export function parseThemeManifest(data: unknown): ThemeManifest {
  return v.parse(ThemeManifestSchema, data);
}
