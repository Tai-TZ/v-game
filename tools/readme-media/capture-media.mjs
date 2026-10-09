// Captures the README media from a served production build. Lives in <repo>/tools/readme-media/.
// Public media show the town theme only, so build with just that pack, like the Vercel deploy:
//
//   cd frontend
//   VITE_THEME_PACKS=town VITE_DEFAULT_THEME=town npm run build
//   npm run preview -- --port 4351                                   (keep it running)
//   node ../tools/readme-media/capture-media.mjs [--base URL] [--theme <id from themes/index.json>]
//                                                [--only hero-walk,sky] [--realtime]
//
// GIF frames go to out/frames/<name>/NNNN.png plus timeline.json; PNGs go to out/png/ (out/ is
// git-ignored). Then: uvx --with pillow python tools/readme-media/make-gifs.py  (writes docs/media/)
//
// Every API the pages call is mocked as frontend/e2e/fixtures.ts does (zones, levels, blocks, a
// recorded L1 run stream, Open-Meteo); the hub's display is pinned to "Cố định ban ngày" except
// for the sky stills, which pin the clock instead.
//
// Timing: by default the page runs on Playwright's fake clock, paused, and every recorded frame
// advances it by exactly one frame time (FRAME_MS unless the job sets its own), so walking speed
// and GIF timing do not depend on how fast SwiftShader renders.
// --realtime samples the live page on the wall clock instead (fallback if the fake clock
// misbehaves; scene-loader and workbench always record in real time). ponytail: it assumes the page keeps >= 10 fps; below that useHubFrame caps dt at
// 0.1 s and the hero walk falls short of the librarian.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const { chromium } = createRequire(`${REPO}/frontend/package.json`)("@playwright/test");

const FRAME_MS = 80;
const HINT_ID = "hub-interact-hint";
const THEMES = JSON.parse(readFileSync(`${REPO}/frontend/public/themes/index.json`, "utf8")).themes.map(
  (theme) => theme.id,
);

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "http://127.0.0.1:4351" },
    theme: { type: "string", default: "town" },
    only: { type: "string", default: "" },
    realtime: { type: "boolean", default: false },
  },
});
if (!THEMES.includes(args.theme)) throw new Error(`--theme must be one of ${THEMES.join(", ")}`);

// The APIs are mocked from the content seed and e2e/data, exactly like frontend/e2e/fixtures.ts.
const readJson = (file) => JSON.parse(readFileSync(`${REPO}/${file}`, "utf8"));
const seed = readJson("backend/src/vgame/content/data/zones.json");
const zoneList = { zones: seed.zones.map(({ levels, ...zone }) => ({ ...zone, level_count: levels.length })) };
const E2E_DATA = "frontend/e2e/data";
/** The lazy scene chunk (three.js), as scripts/check-bundle.mjs reports it. */
const SCENE_CHUNKS = new Set(readJson("frontend/build/bundle-report.json").threeChunks.map((file) => `/${file}`));
const WMO = { clear: 0, rain: 63 };

/** Open-Meteo's reply, observed at the page's own now (the app rejects a time over 3 h away). */
async function fulfillWeather(route, condition) {
  const now = await route
    .request()
    .frame()
    .evaluate(() => Date.now())
    .catch(() => Date.now());
  await route.fulfill({
    headers: { "Access-Control-Allow-Origin": "*" },
    json: {
      utc_offset_seconds: 0,
      timezone: "GMT",
      current: {
        time: new Date(now).toISOString().slice(0, 16),
        interval: 900,
        temperature_2m: 30,
        weather_code: WMO[condition],
      },
    },
  });
}

/**
 * `display` is the hub's vg-hub-display ("day" pins the daytime look, "live" follows the clock);
 * `setup(page)` runs before the page loads (routes, a fixed clock).
 */
async function openPage(
  browser,
  { width, height, scale = 1, mobile = false, url, display = "day", weather = "clear", setup, waitUntil = "load" },
) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await context.addInitScript(
    ({ theme, display }) => {
      localStorage.setItem("vg-theme", theme);
      localStorage.setItem("vg-hub-display", display);
    },
    { theme: args.theme, display },
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`  page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.warn(`  console: ${message.text()}`);
  });
  // The landing page pings /api/health to wake a sleeping API; no backend runs here.
  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/zones", (route) => route.fulfill({ json: zoneList }));
  await page.route("**/api/zones/*", (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
    const zone = seed.zones.find((candidate) => candidate.id === id);
    return route.fulfill(zone ? { json: zone } : { status: 404, json: { detail: "Not found" } });
  });
  await page.route("**/api.open-meteo.com/**", (route) => fulfillWeather(route, weather));
  await setup?.(page);
  await page.goto(new URL(url, args.base).href, { waitUntil });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // A build that does not ship the wanted pack falls back to another one: never record that.
  const shown = await page.locator("html").getAttribute("data-theme");
  if (shown !== args.theme) throw new Error(`The page shows theme "${shown}", not "${args.theme}".`);
  return page;
}

/** Same rule as frontend/e2e/fixtures.ts: drawn, and nothing left to move. Needs ?debug=frames. */
async function waitForIdleScene(page, timeout = 60_000) {
  await page.locator("canvas").waitFor({ state: "visible", timeout });
  await page.locator("html[data-frames]").waitFor({ state: "attached", timeout });
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-scene-busy"), undefined, {
    timeout,
  });
}

class Recorder {
  /** `clip` crops every frame to a page rectangle at native scale (default: the whole viewport). */
  static async start(page, name, frameMs = FRAME_MS, clip = undefined, realtime = args.realtime) {
    const rec = new Recorder(page, name, frameMs, clip);
    rec.realtime = realtime;
    if (!realtime) {
      await page.clock.install();
      // An installed clock still flows with the wall clock (slow screenshots would speed the walk
      // up); paused, only runFor() moves it.
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 20));
    }
    rec.startedAt = Date.now();
    await rec.shot();
    return rec;
  }

  constructor(page, name, frameMs, clip) {
    this.page = page;
    this.name = name;
    this.frameMs = frameMs;
    this.clip = clip;
    this.dir = path.join(OUT, "frames", name);
    this.frames = [];
    this.virtualMs = 0;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
  }

  /** Recording time in ms: the wall clock with --realtime, else the fake clock. */
  now() {
    return this.realtime ? Date.now() - this.startedAt : this.virtualMs;
  }

  async shot() {
    const file = `${String(this.frames.length).padStart(4, "0")}.png`;
    const t = this.now();
    await this.page.screenshot({ path: path.join(this.dir, file), clip: this.clip });
    this.frames.push({ file, t });
  }

  /** Advances the page by one frame and captures it. */
  async tick() {
    if (this.realtime) {
      const wait = this.startedAt + this.frames.at(-1).t + this.frameMs - Date.now();
      if (wait > 0) await this.page.waitForTimeout(wait);
    } else {
      await this.page.clock.runFor(this.frameMs);
      this.virtualMs += this.frameMs;
    }
    await this.shot();
  }

  /** Records for `ms` of recording time; slow screenshots in --realtime do not stretch it. */
  async hold(ms) {
    const end = this.now() + ms - this.frameMs / 2;
    do await this.tick();
    while (this.now() < end);
  }

  /** Ticks until `predicate` holds or `maxMs` passes; returns whether it held. */
  async until(predicate, maxMs) {
    for (let elapsed = 0; elapsed < maxMs; elapsed += this.frameMs) {
      if (await predicate()) return true;
      await this.tick();
    }
    return predicate();
  }

  finish() {
    writeFileSync(
      path.join(this.dir, "timeline.json"),
      JSON.stringify({ frame_ms: this.frameMs, clock: this.realtime ? "real" : "virtual", frames: this.frames }),
    );
    const seconds = ((this.frames.at(-1).t + this.frameMs) / 1000).toFixed(1);
    console.log(`  ${this.frames.length} frames, ${seconds} s -> ${path.relative(HERE, this.dir)}`);
  }
}

/**
 * Key events dispatched in one task, as in e2e/play.spec.ts: separate CDP presses leave frames
 * where only one key of a combo is held. `releaseAfterMs` releases the held keys on the page's
 * own timer (fake or real), so the walk length does not depend on screenshot speed. With
 * `releaseOn`, they are released the moment an element with that id appears, so the player stops
 * right where the hint shows.
 */
async function keys(page, { up = [], down = [], releaseOn = null, releaseAfterMs = null }) {
  await page.evaluate(
    ({ up, down, releaseOn, releaseAfterMs }) => {
      const send = (type, codes) => {
        for (const code of codes) {
          document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
        }
      };
      send("keyup", up);
      send("keydown", down);
      if (releaseAfterMs !== null) setTimeout(() => send("keyup", down), releaseAfterMs);
      if (!releaseOn) return;
      const observer = new MutationObserver(() => {
        if (!document.getElementById(releaseOn)) return;
        observer.disconnect();
        send("keyup", down);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    },
    { up, down, releaseOn, releaseAfterMs },
  );
}

/** A visible stand-in for the mouse (screenshots never show the real pointer). */
class Cursor {
  static async add(page, at) {
    await page.evaluate(({ x, y }) => {
      const dot = document.createElement("div");
      dot.id = "readme-cursor";
      dot.setAttribute("aria-hidden", "true");
      Object.assign(dot.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: "22px",
        height: "22px",
        margin: "-11px 0 0 -11px",
        borderRadius: "50%",
        border: "2px solid #ffffff",
        background: "rgba(15, 23, 42, 0.55)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.35)",
        pointerEvents: "none",
        zIndex: "2147483647",
        transform: `translate(${x}px, ${y}px)`,
      });
      document.body.append(dot);
    }, at);
    return new Cursor(page, at);
  }

  constructor(page, at) {
    this.page = page;
    this.at = at;
  }

  async place({ x, y }, scale = 1, opacity = 1) {
    this.at = { x, y };
    await this.page.mouse.move(x, y);
    await this.page.evaluate(
      ({ x, y, scale, opacity }) => {
        const dot = document.getElementById("readme-cursor");
        dot.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        dot.style.opacity = String(opacity);
      },
      { x, y, scale, opacity },
    );
  }

  /** Eases to a point (or the centre of a locator), one recorded frame per step. */
  async glide(rec, target, ms) {
    const isLocator = typeof target.boundingBox === "function";
    if (isLocator) await target.scrollIntoViewIfNeeded();
    const to = isLocator ? centre(await target.boundingBox()) : target;
    const from = this.at;
    const steps = Math.max(1, Math.round(ms / rec.frameMs));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      await this.place({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      await rec.tick();
    }
  }

  /** Glides to the locator, rests on it for `dwellMs` (hover state visible), then clicks it. */
  async click(rec, locator, ms = 480, dwellMs = 0) {
    await this.glide(rec, locator, ms);
    if (dwellMs > 0) await rec.hold(dwellMs);
    await this.place(this.at, 0.72);
    await this.page.mouse.click(this.at.x, this.at.y);
    await rec.tick();
    await this.place(this.at, 1);
  }

  /** Fades out where it is, one recorded frame per step, so no idle dot sits in the shot. */
  async fadeOut(rec, steps = 3) {
    for (let i = steps - 1; i >= 0; i--) {
      await this.place(this.at, 1, i / steps);
      await rec.tick();
    }
  }
}

function centre(box) {
  if (!box) throw new Error("Click target is not visible.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const png = (name) => path.join(OUT, "png", `${name}.png`);

// --- the media ---------------------------------------------------------------------------------

/**
 * Follow camera at 1024x640 (wide enough for the side dialog, narrower than the ~1056x640
 * overview). The walk is e2e/play.spec.ts's: ArrowLeft + ArrowUp from SPAWN until the
 * librarian's hint shows, past the garden beds and props. E opens her dialog; after it, the view
 * turns 90° so the dressed campus shows from another side.
 * Then, off the record, her badge list leads to chị Diệp: her dialog is npc-dialog.png.
 */
async function heroWalk(browser) {
  const page = await openPage(browser, { width: 1024, height: 640, url: "/play?debug=frames" });
  await waitForIdleScene(page);
  // 10 fps: the follow camera pans, so nearly every pixel changes.
  const rec = await Recorder.start(page, "hero-walk", 100);
  await rec.hold(500);
  await keys(page, { down: ["ArrowLeft", "ArrowUp"], releaseOn: HINT_ID });
  const lanHint = page.getByRole("button", { name: "Nhấn E hoặc chạm để nói chuyện với cô Lan", exact: true });
  const arrived = await rec.until(() => lanHint.isVisible(), 8000);
  await keys(page, { up: ["ArrowLeft", "ArrowUp"] });
  if (!arrived) throw new Error("The librarian's hint never appeared: the walk went off the e2e path.");
  await rec.hold(900);
  await keys(page, { down: ["KeyE"] });
  await keys(page, { up: ["KeyE"] });
  await rec.until(() => page.getByRole("dialog").isVisible(), 1600);
  await rec.hold(2200);
  await page.keyboard.press("Escape");
  await rec.hold(500);
  // Focus is back on the hint, a button, where , and . do nothing: turn with the view button.
  const turn = page.getByRole("group", { name: "Góc nhìn" });
  await turn.getByRole("button", { name: "Xoay theo chiều kim đồng hồ", exact: true }).click();
  await rec.hold(1800);
  rec.finish();

  await page.clock.resume();
  await page.locator('[data-badge="registrar"]').click();
  await page.getByRole("dialog", { name: "Chị Diệp" }).waitFor({ timeout: 60_000 });
  await waitForIdleScene(page);
  await page.screenshot({ path: png("npc-dialog") });
  console.log("  -> png/npc-dialog.png");
  await page.context().close();
}

/**
 * "Sa bàn đang dựng": the scene chunk is held 2.5 s, so the blueprint sits at step 2, then
 * steps 3-5 and the hand-over to the 3D board. Real-time (CSS animations ignore the fake clock).
 */
async function sceneLoader(browser) {
  const page = await openPage(browser, {
    width: 1024,
    height: 640,
    url: "/play?debug=frames",
    waitUntil: "domcontentloaded",
    setup: (p) =>
      p.route(
        (url) => SCENE_CHUNKS.has(url.pathname),
        async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          await route.continue();
        },
      ),
  });
  const loader = page.locator("[data-scene-loader]");
  await loader.waitFor();
  const rec = await Recorder.start(page, "scene-loader", FRAME_MS, undefined, true);
  const done = await rec.until(async () => (await loader.count()) === 0, 30_000);
  if (!done) throw new Error("The loader never left.");
  await rec.hold(1500);
  rec.finish();
  await page.context().close();
}

/** One still per look, at fixed Hanoi times (the display follows the clock): tiled by make-gifs.py. */
const SKIES = [
  ["day", "10:00", "clear"],
  ["dusk", "17:30", "clear"],
  ["night", "21:00", "clear"],
  ["rain", "10:00", "rain"],
];

async function skyStills(browser) {
  for (const [name, time, weather] of SKIES) {
    const page = await openPage(browser, {
      width: 1024,
      height: 640,
      url: "/play?debug=frames",
      display: "live",
      weather,
      setup: (p) => p.clock.setFixedTime(new Date(`2026-10-08T${time}:00+07:00`)),
    });
    await page.locator(`main[data-sky="${name === "rain" ? "day" : name}"]`).waitFor();
    await waitForIdleScene(page);
    await page.screenshot({ path: png(`sky-${name}`) });
    console.log(`  -> png/sky-${name}.png`);
    await page.context().close();
  }
}

/**
 * Level 1 on the bench at 1280x800: build the reference solution (e2e/workbench.spec.ts), open
 * the shift, watch the recorded run stream in, then the stars and cô Lan's diagnosis. The stream
 * comes from a local server that sends one event every 30 ms, so the run panel fills live.
 */
async function workbench(browser) {
  const events = readFileSync(`${REPO}/${E2E_DATA}/run-l1-reference.sse`, "utf8").split(/\n\n/).filter(Boolean);
  const server = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    for (const event of events) {
      response.write(`${event}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const page = await openPage(browser, {
      width: 1280,
      height: 800,
      url: "/play/library/grounded-citation",
      setup: async (p) => {
        await p.route("**/api/blocks", (route) => route.fulfill({ json: readJson(`${E2E_DATA}/blocks.json`) }));
        await p.route("**/api/levels/*", (route) => {
          const id = new URL(route.request().url()).pathname.split("/").at(-1);
          return route.fulfill({ json: readJson(`${E2E_DATA}/levels/${id}.json`) });
        });
        await p.route(
          (url) => url.pathname === "/api/runs",
          (route) => route.fulfill({ status: 202, json: { run_id: "1".padStart(32, "0"), created: true, issues: [] } }),
        );
        await p.route("**/api/runs/*/events", (route) =>
          route.continue({ url: `http://127.0.0.1:${server.address().port}/events` }),
        );
      },
    });
    await page.getByRole("heading", { level: 1, name: "Thôi bịa điều luật" }).waitFor();
    await page
      .locator("#wb-bench-title")
      .evaluate((el) =>
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "instant" }),
      );
    const rest = { x: 1200, y: 760 };
    const cursor = await Cursor.add(page, rest);
    const rec = await Recorder.start(page, "workbench", 100, undefined, true);
    await rec.hold(700);
    await cursor.click(rec, page.getByRole("switch", { name: "Gắn Vòm Sao" }), 480, 200);
    await rec.hold(400);
    const hook = page.getByRole("slider", { name: /Móc kéo/ });
    await cursor.glide(rec, hook, 400);
    await hook.fill("3");
    await rec.hold(400);
    await cursor.click(rec, page.getByRole("switch", { name: /Máy đóng tem/ }), 400, 200);
    for (const [slot, value] of [
      ["Khe thẻ 1", "G1"],
      ["Khe thẻ 2", "G2"],
      ["Khe thẻ 3", "G3"],
    ]) {
      const select = page.getByLabel(slot);
      await cursor.glide(rec, select, 320);
      await select.selectOption(value);
      await rec.hold(240);
    }
    await cursor.click(rec, page.getByRole("button", { name: "Mở ca" }), 480, 200);
    await cursor.fadeOut(rec);
    const stars = page.getByText("3/3 sao", { exact: true });
    if (!(await rec.until(() => stars.isVisible(), 20_000))) throw new Error("The run never finished.");
    await rec.hold(2400);
    await page
      .getByRole("heading", { name: "Cô Lan chẩn đoán" })
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await rec.hold(2400);
    rec.finish();
    await page.context().close();
  } finally {
    server.close();
  }
}

/** The landing page's "Một ca trực ở Thư viện": predict, run, retrieve and rerun, reset. */
async function landingDemo(browser) {
  // 760 high: at 800 the next section's grey band shows along the bottom edge.
  const page = await openPage(browser, { width: 1280, height: 760, url: "/" });
  const section = page.locator("#ca-truc");
  await section.waitFor();
  // Put the section heading just under the header (or the top edge, if the header scrolls away).
  await section.evaluate((element) => {
    const header = document.querySelector("header");
    const pinned = header && ["fixed", "sticky"].includes(getComputedStyle(header).position);
    const heading = element.querySelector("h2") ?? element;
    const top = heading.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top - (pinned ? header.getBoundingClientRect().height : 0) - 32, behavior: "instant" });
  });
  const rest = { x: 1060, y: 700 };
  const cursor = await Cursor.add(page, rest);
  const rec = await Recorder.start(page, "landing-demo");
  await rec.hold(960);
  await cursor.click(rec, section.locator("label", { hasText: "Bịa ra một điều khoản" }), 640);
  await rec.hold(560);
  await cursor.click(rec, section.getByRole("button", { name: "Chạy agent" }));
  await rec.hold(3200);
  await cursor.click(rec, section.getByRole("button", { name: "Gắn bước truy xuất và chạy lại" }));
  await rec.hold(3200);
  await cursor.click(rec, section.getByRole("button", { name: "Làm lại" }));
  await rec.hold(480);
  await cursor.glide(rec, rest, 480);
  rec.finish();
  await page.context().close();
}

async function mobile(browser) {
  const page = await openPage(browser, { width: 375, height: 812, scale: 2, mobile: true, url: "/play?debug=frames" });
  await waitForIdleScene(page);
  await page.screenshot({ path: png("mobile") });
  console.log("  -> png/mobile.png");
  await page.context().close();
}

const JOBS = {
  "hero-walk": heroWalk,
  "scene-loader": sceneLoader,
  sky: skyStills,
  workbench,
  "landing-demo": landingDemo,
  mobile,
};

const only = args.only ? args.only.split(",").map((name) => name.trim()) : Object.keys(JOBS);
const unknown = only.filter((name) => !(name in JOBS));
if (unknown.length) throw new Error(`Unknown --only: ${unknown.join(", ")}. Known: ${Object.keys(JOBS).join(", ")}`);

try {
  await fetch(args.base);
} catch {
  console.error(`Nothing answers at ${args.base}. Serve the build first (see the top of this file).`);
  process.exit(1);
}

mkdirSync(path.join(OUT, "png"), { recursive: true });
console.log(`theme ${args.theme}, ${args.realtime ? "real" : "virtual"} clock, ${args.base}`);
// Headless Chromium has no GPU; render WebGL in software, as playwright.config.ts does.
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
// One failed job does not cost the others a new browser; the exit code still says so.
const failed = [];
try {
  for (const name of only) {
    console.log(name);
    try {
      await JOBS[name](browser);
    } catch (error) {
      console.error(`  ${name} failed: ${error.message}`);
      failed.push(name);
    }
  }
} finally {
  await browser.close();
}
if (failed.length) {
  console.error(`Failed: ${failed.join(", ")}`);
  process.exitCode = 1;
}
