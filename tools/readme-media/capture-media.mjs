// Captures the README media from a served production build. Lives in <repo>/tools/readme-media/.
// Public media show the town theme only, so build with just that pack, like the Vercel deploy:
//
//   cd frontend
//   VITE_THEME_PACKS=town VITE_DEFAULT_THEME=town npm run build
//   node scripts/serve-build.mjs --port 4351                         (keep it running)
//   node ../tools/readme-media/capture-media.mjs [--base URL] [--theme <id from themes/index.json>]
//                                                [--only hero-walk,mobile] [--realtime]
//
// GIF frames go to out/frames/<name>/NNNN.png plus timeline.json; PNGs go to out/png/ (out/ is
// git-ignored). Then: uvx --with pillow python tools/readme-media/make-gifs.py  (writes docs/media/)
//
// Timing: by default the page runs on Playwright's fake clock, paused, and every recorded frame
// advances it by exactly one frame time (FRAME_MS unless the job sets its own), so walking speed
// and GIF timing do not depend on how fast SwiftShader renders.
// --realtime samples the live page on the wall clock instead (fallback if the fake clock
// misbehaves). ponytail: it assumes the page keeps >= 10 fps; below that useHubFrame caps dt at
// 0.1 s and the hero walk falls short of the librarian.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const ZONE_LIST = "#hub-zone-list";
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

// The zones API is mocked from the content seed, exactly like frontend/e2e/fixtures.ts.
const seed = JSON.parse(readFileSync(`${REPO}/backend/src/vgame/content/data/zones.json`, "utf8"));
const zoneList = { zones: seed.zones.map(({ levels, ...zone }) => ({ ...zone, level_count: levels.length })) };

async function openPage(browser, { width, height, scale = 1, mobile = false, url }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await context.addInitScript((theme) => localStorage.setItem("vg-theme", theme), args.theme);
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
  await page.goto(new URL(url, args.base).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // A build that does not ship the wanted pack falls back to another one: never record that.
  const shown = await page.locator("html").getAttribute("data-theme");
  if (shown !== args.theme) throw new Error(`The page shows theme "${shown}", not "${args.theme}".`);
  return page;
}

/** Same rule as frontend/e2e/fixtures.ts: the frame counter stops changing. Needs ?debug=frames. */
async function waitForIdleScene(page, timeout = 60_000) {
  await page.locator("canvas").waitFor({ state: "visible", timeout });
  await page.locator("html[data-frames]").waitFor({ state: "attached", timeout });
  const deadline = Date.now() + timeout;
  let previous = -1;
  while (Date.now() < deadline) {
    const frames = await page.evaluate(() => Number(document.documentElement.dataset.frames));
    if (frames === previous) return;
    previous = frames;
    await page.waitForTimeout(500);
  }
  throw new Error("The scene never stopped drawing.");
}

class Recorder {
  /** `clip` crops every frame to a page rectangle at native scale (default: the whole viewport). */
  static async start(page, name, frameMs = FRAME_MS, clip = undefined) {
    const rec = new Recorder(page, name, frameMs, clip);
    if (!args.realtime) {
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
    return args.realtime ? Date.now() - this.startedAt : this.virtualMs;
  }

  async shot() {
    const file = `${String(this.frames.length).padStart(4, "0")}.png`;
    const t = this.now();
    await this.page.screenshot({ path: path.join(this.dir, file), clip: this.clip });
    this.frames.push({ file, t });
  }

  /** Advances the page by one frame and captures it. */
  async tick() {
    if (args.realtime) {
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
      JSON.stringify({ frame_ms: this.frameMs, clock: args.realtime ? "real" : "virtual", frames: this.frames }),
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
    const to = typeof target.boundingBox === "function" ? centre(await target.boundingBox()) : target;
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
 * Follow camera at 960x600 (the overview needs about 1056x640 since campus-scene v0.3). Path,
 * checked against app/features/campus/layout.ts OBSTACLES with the player's 0.35 radius:
 * 1. ArrowLeft = world (-1, +1) at WALK_SPEED 4.2 (2.97 per axis per second), held 2.30 s: from
 *    SPAWN (0, -0.8) to about (-6.8, 6.0). The trunks at (-4.9, 0.6), (-5.4, 2.4) and (-4.9, 6.4)
 *    stay off the line and the fountain hedge (PLAZA 0, 5.6) passes 4.5 away on the left.
 * 2. ArrowUp + ArrowRight = world (0, -1): north at x ≈ -6.8 until the librarian's hint appears
 *    near (-6.8, -0.3). The safe x window is (-8.0, -6.1): east of -6.1 the player stops on the
 *    trunk at (-5.4, 2.4); west of about -8.0 the library door (-8.2, -2.8) comes within
 *    INTERACT_RADIUS 1.7 before Lan (NPC_SPOT -6.6, -2.0), so the hint offers the library instead.
 *    Step 1 must therefore last 2.06-2.69 s (planned 2.30 s: -0.24/+0.39 s). The player turns
 *    north beside a garden bed and a tree; the follow camera holds still there for about 0.5 s
 *    (dead zone) while the player keeps walking.
 * 3. The hint holds about 1.2 s so it can be read, then E opens her dialog.
 */
async function heroWalk(browser) {
  const page = await openPage(browser, { width: 960, height: 600, url: "/play?debug=frames" });
  await waitForIdleScene(page);
  // 10 fps: the follow camera pans, so nearly every pixel changes and 12.5 fps does not fit 4 MB.
  const rec = await Recorder.start(page, "hero-walk", 100);
  await rec.hold(600);
  await keys(page, { down: ["ArrowLeft"], releaseAfterMs: 2300 });
  await rec.hold(2300);
  await keys(page, { up: ["ArrowLeft"], down: ["ArrowUp", "ArrowRight"], releaseOn: HINT_ID });
  const lanHint = page.getByRole("button", { name: "Nhấn E hoặc chạm để nói chuyện với cô Lan", exact: true });
  const arrived = await rec.until(() => lanHint.isVisible(), 6000);
  await keys(page, { up: ["ArrowUp", "ArrowRight"] });
  if (!arrived) throw new Error("The librarian's hint never appeared: the walk went off the planned path.");
  await rec.hold(1200);
  await keys(page, { down: ["KeyE"] });
  await keys(page, { up: ["KeyE"] });
  await rec.until(() => page.getByRole("dialog").isVisible(), 1600);
  await rec.hold(3000);
  rec.finish();
  await page.context().close();
}

/**
 * Overview at 1280x800, where the whole diorama fits and the camera stays put: "Các khu", then
 * "Đi tới khuôn viên phía sau". The player walks its own route (layout.ts routeTo) from SPAWN
 * round the main building to the running track (BACK_SPOT 12.0, -12.3), about 26 units.
 * Recorded as a native-scale 960x600 crop, not scaled down, so the small figure stays visible; the
 * crop keeps "Các khu", the zone list, the whole route and the track.
 */
async function backCampus(browser) {
  const page = await openPage(browser, { width: 1280, height: 800, url: "/play?debug=frames" });
  await waitForIdleScene(page);
  const clip = { x: 300, y: 16, width: 960, height: 600 };
  const rest = { x: 1180, y: 560 }; // background inside the crop, clear of the diorama and the list
  const cursor = await Cursor.add(page, rest);
  const rec = await Recorder.start(page, "back-campus", FRAME_MS, clip);
  const zones = page.getByRole("button", { name: "Các khu" });
  await rec.hold(800);
  await cursor.click(rec, zones, 560);
  await rec.hold(1200);
  const walkBack = page.locator(ZONE_LIST).getByRole("button", { name: "Đi tới khuôn viên phía sau", exact: true });
  await cursor.click(rec, walkBack, 400, 600);
  // Hidden for the walk; make-gifs.py's loop cross-fade brings it back at `rest` for frame 0.
  await cursor.fadeOut(rec);
  // Arrived when a whole recorded frame passes without the scene drawing.
  const frames = () => page.evaluate(() => Number(document.documentElement.dataset.frames));
  let previous = -1;
  const settled = await rec.until(async () => {
    const now = await frames();
    const idle = now === previous;
    previous = now;
    return idle;
  }, 12_000);
  if (!settled) throw new Error("The walk to the back campus never ended.");
  await rec.hold(1600);
  rec.finish();
  // The list reads where the player stands when it opens: "Về mặt trước" only from the back.
  await page.getByRole("button", { name: "Các khu" }).click();
  const back = page.locator(ZONE_LIST).getByRole("button", { name: "Về mặt trước", exact: true });
  if (!(await back.isVisible())) throw new Error("The player stopped before the back campus.");
  await page.context().close();
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

/**
 * Clipped to the content column, from the top bar down to the footer: in the README's half-width
 * cell the body text stays readable, and it matches mobile.png (width 265) in height.
 */
async function zoneLibrary(browser) {
  const page = await openPage(browser, { width: 1024, height: 1280, url: "/play/library" });
  await page.getByRole("heading", { level: 1, name: "Thư viện" }).waitFor();
  await page.waitForTimeout(400);
  const footer = await page.locator("footer").boundingBox();
  if (!footer) throw new Error("The zone page has no footer to clip to.");
  await page.screenshot({
    path: png("zone-library"),
    clip: { x: footer.x, y: 0, width: footer.width, height: footer.y + footer.height },
  });
  console.log("  -> png/zone-library.png");
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
  "back-campus": backCampus,
  "landing-demo": landingDemo,
  "zone-library": zoneLibrary,
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
try {
  for (const name of only) {
    console.log(name);
    await JOBS[name](browser);
  }
} finally {
  await browser.close();
}
