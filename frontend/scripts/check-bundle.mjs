// Enforces the bundle budgets of the build brief §5 from the Vite manifest (never by
// guessing chunk names):
//   - the /play route adds at most 300 kB of gzipped JS on top of the app shell
//     (three + react-three-fiber + scene code included);
//   - no chunk the landing page loads contains three.js;
//   - the workbench route (/play/:zoneId/:levelId) adds at most 120 kB of gzipped JS on top of
//     the app shell and none of its chunks contains three.js (workbench-v0.1 §10);
//   - each micro lesson's page is a lazy chunk the micro route alone loads (plan v0.7 4.5), and
//     none of its chunks is the workbench's.
// Writes build/bundle-report.json (read by the e2e suite) and removes the manifest from the
// deployable output.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const PLAY_BUDGET_BYTES = 300_000;
const WORKBENCH_BUDGET_BYTES = 120_000;
// Strings only three.js itself prints; used to prove where three ended up.
const THREE_SIGNATURE = "THREE.WebGLRenderer";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "build", "client");
const manifestPath = path.join(clientDir, ".vite", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const keysWhere = (test) => Object.keys(manifest).filter(test);

/** Files reachable from `keys` through static imports (and dynamic ones when asked). */
function closure(keys, { dynamic = false } = {}) {
  const seen = new Set();
  const files = new Set();
  const visit = (key) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    const chunk = manifest[key];
    files.add(chunk.file);
    for (const next of chunk.imports ?? []) visit(next);
    if (dynamic) for (const next of chunk.dynamicImports ?? []) visit(next);
  };
  keys.forEach(visit);
  return files;
}

const shell = closure(
  keysWhere((key) => manifest[key].isEntry && /entry\.client|app\/root\.tsx/.test(key)),
);
const home = new Set([
  ...shell,
  ...closure(keysWhere((key) => key.startsWith("app/routes/home.tsx"))),
]);
const play = closure(
  keysWhere((key) => key.startsWith("app/routes/play.tsx")),
  { dynamic: true },
);
const playOnly = [...play].filter((file) => !shell.has(file)).sort();

const workbench = closure(
  keysWhere((key) => key.startsWith("app/routes/play-level.tsx")),
  { dynamic: true },
);
const workbenchOnly = [...workbench].filter((file) => !shell.has(file)).sort();

const gzipBytes = async (file) => gzipSync(await readFile(path.join(clientDir, file))).length;
const sizes = await Promise.all(playOnly.map(async (file) => [file, await gzipBytes(file)]));
const playGzip = sizes.reduce((sum, [, bytes]) => sum + bytes, 0);
const workbenchSizes = await Promise.all(
  workbenchOnly.map(async (file) => [file, await gzipBytes(file)]),
);
const workbenchGzip = workbenchSizes.reduce((sum, [, bytes]) => sum + bytes, 0);

const assets = (await readdir(path.join(clientDir, "assets"))).filter((name) =>
  name.endsWith(".js"),
);
const threeChunks = [];
for (const name of assets) {
  const source = await readFile(path.join(clientDir, "assets", name), "utf8");
  if (source.includes(THREE_SIGNATURE)) threeChunks.push(`assets/${name}`);
}

const problems = [];
if (threeChunks.length === 0)
  problems.push("three.js not found in any chunk; update THREE_SIGNATURE.");
for (const file of threeChunks) {
  if (home.has(file)) problems.push(`Landing page loads three.js chunk ${file}.`);
}
if (playGzip > PLAY_BUDGET_BYTES) {
  problems.push(`/play adds ${playGzip} B gzip, over the ${PLAY_BUDGET_BYTES} B budget.`);
}
if (workbenchOnly.length === 0) problems.push("Workbench route chunk not found in the manifest.");
for (const file of threeChunks) {
  if (workbench.has(file)) problems.push(`Workbench route loads three.js chunk ${file}.`);
}
if (workbenchGzip > WORKBENCH_BUDGET_BYTES) {
  problems.push(
    `Workbench adds ${workbenchGzip} B gzip, over the ${WORKBENCH_BUDGET_BYTES} B budget.`,
  );
}

// Micro lessons (plan v0.7 4.5): each lesson's page and content is a lazy chunk of the micro
// route alone. The zone page and the brief read the registry's metadata, so neither reaches a
// lesson chunk, not even lazily, and no lesson's page loads another lesson's.
const lessonKeys = keysWhere(
  (key) => key.startsWith("app/features/micro/") && manifest[key].isDynamicEntry,
);
const lessonFiles = new Set(lessonKeys.map((key) => manifest[key].file));
const zonePage = closure(
  keysWhere((key) => key.startsWith("app/routes/play-zone.tsx")),
  { dynamic: true },
);
const microRoute = closure(
  keysWhere((key) => key.startsWith("app/routes/play-micro.tsx")),
  { dynamic: true },
);
// A lesson is a page's worth of JS: one import of the bench (a chip's class names, once) pulled
// ~43 kB gzip of workbench chunks into two of them. vite.config.ts writes each chunk's modules.
const chunkModules = JSON.parse(
  await readFile(path.join(clientDir, ".vite", "chunk-modules.json"), "utf8"),
);
const benchModules = (file) =>
  (chunkModules[file] ?? []).filter((id) => id.startsWith("app/features/workbench/"));
if (![...workbench].some((file) => benchModules(file).length > 0)) {
  problems.push("No workbench module found in the chunk module map; update check-bundle.mjs.");
}
if (lessonKeys.length === 0) problems.push("No micro lesson page chunk found in the manifest.");
for (const key of lessonKeys) {
  const file = manifest[key].file;
  if (zonePage.has(file)) problems.push(`Zone page reaches micro lesson chunk ${file}.`);
  if (workbench.has(file)) problems.push(`Workbench route reaches micro lesson chunk ${file}.`);
  if (!microRoute.has(file)) problems.push(`Micro lesson route does not load ${file}.`);
  for (const other of closure([key])) {
    if (other !== file && lessonFiles.has(other)) {
      problems.push(`Micro lesson chunk ${file} loads another lesson's, ${other}.`);
    }
  }
  for (const other of closure([key])) {
    const bench = benchModules(other);
    if (bench.length > 0) {
      problems.push(`Micro lesson chunk ${file} loads workbench code in ${other}: ${bench[0]}.`);
    }
  }
}

const sceneChunks = [...closure(keysWhere((key) => manifest[key].isDynamicEntry))].filter(
  (file) => !home.has(file),
);
await writeFile(
  path.join(root, "build", "bundle-report.json"),
  `${JSON.stringify(
    {
      playGzipBytes: playGzip,
      playBudgetBytes: PLAY_BUDGET_BYTES,
      playChunks: Object.fromEntries(sizes),
      workbenchGzipBytes: workbenchGzip,
      workbenchBudgetBytes: WORKBENCH_BUDGET_BYTES,
      workbenchChunks: Object.fromEntries(workbenchSizes),
      threeChunks,
      sceneChunks,
    },
    null,
    2,
  )}\n`,
);
await rm(path.join(clientDir, ".vite"), { recursive: true, force: true });

console.warn(
  `Bundle: /play adds ${(playGzip / 1000).toFixed(1)} kB gzip (budget ${PLAY_BUDGET_BYTES / 1000} kB); workbench adds ${(workbenchGzip / 1000).toFixed(1)} kB (budget ${WORKBENCH_BUDGET_BYTES / 1000} kB); three.js in ${threeChunks.join(", ")}.`,
);
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
