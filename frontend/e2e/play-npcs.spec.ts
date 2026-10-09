import type { Page } from "@playwright/test";

import { NPCS } from "../app/features/campus/layout";
import { NPC_ROLES } from "../app/features/campus/npcs";
import { expect, mockApi, npcNames, test, titleOf, waitForIdleScene } from "./fixtures";

/*
 * The four hub NPCs (npc-cast v0.4 §7, §12) and the baked cast (integration spec §8). Names are
 * theme data: read from the active pack's manifest, never written here.
 */

/** Opens "Các khu" if it is closed. */
async function openZoneList(page: Page) {
  const toggle = page.getByRole("button", { name: "Các khu" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
}

const badge = (page: Page, who: string) => page.locator(`[data-badge="${who}"]`);

/** Lets time pass in the page: measuring idleness, or holding a key, needs it. */
const pause = (page: Page, ms: number) =>
  page.evaluate((t) => new Promise((resolve) => setTimeout(resolve, t)), ms);

/** Holds a movement key on the scene for `ms`, then lets go. */
async function walkFor(page: Page, code: string, ms: number) {
  await page.locator("[data-campus-scene]").focus();
  await page.keyboard.down(code);
  await pause(page, ms);
  await page.keyboard.up(code);
}

test.describe("hub NPCs", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("talks to each NPC from the zone list, and focus comes back to the row", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto("/play");
    const names = await npcNames(page);
    for (const { id } of NPCS) {
      await openZoneList(page);
      const row = page.getByRole("button", { name: `Nói chuyện với ${names[id].name}` });
      await row.click();
      const dialog = page.getByRole("dialog", { name: titleOf(names[id].name) });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(NPC_ROLES[id].subtitle, { exact: true })).toBeVisible();
      for (const line of NPC_ROLES[id].greeting) {
        await expect(dialog.getByText(line, { exact: true })).toBeVisible();
      }
      await expect(dialog.getByRole("button", { name: "Để sau" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(row).toBeFocused();
    }
    // A second visit says one line of the "not open yet" set.
    const [first] = NPCS;
    if (!first) throw new Error("No NPC.");
    await page.getByRole("button", { name: `Nói chuyện với ${names[first.id].name}` }).click();
    await expect(
      page.getByText(NPC_ROLES[first.id].coming_soon[0] ?? "", { exact: true }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("shows the NPCs' badges once the librarian is met, and a badge walks there to talk", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    await expect(badge(page, "lan")).toHaveCount(1);
    for (const { id } of NPCS) await expect(badge(page, id)).toHaveCount(0);

    await openZoneList(page);
    await page.getByRole("button", { name: "Nói chuyện với cô Lan", exact: true }).click();
    await expect(badge(page, "registrar")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(badge(page, "lan")).toHaveCount(0);
    for (const { id } of NPCS) await expect(badge(page, id)).toHaveCount(1);

    await page.keyboard.press("Escape"); // closes the zone list
    await waitForIdleScene(page);
    const names = await npcNames(page);
    await badge(page, "registrar").click();
    const dialog = page.getByRole("dialog", { name: titleOf(names.registrar.name) });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(badge(page, "registrar")).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });

  test("swaps in the baked cast after the first frame and stays idle once a talk ends", async ({
    page,
    consoleErrors,
  }) => {
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    await expect(page.locator("html")).toHaveAttribute("data-cast", "ready");

    // Walk a moment, then let go: the walk fades to rest and the frames stop.
    await walkFor(page, "ArrowDown", 600);
    await waitForIdleScene(page);
    let before = await frames();
    await pause(page, 2000);
    expect(await frames()).toBe(before);

    // The NPC talks for the dialog's first seconds (≤ 3.2 s), then nothing moves while it stays open.
    const names = await npcNames(page);
    const [first] = NPCS;
    if (!first) throw new Error("No NPC.");
    await openZoneList(page);
    await page.getByRole("button", { name: `Nói chuyện với ${names[first.id].name}` }).click();
    const dialog = page.getByRole("dialog", { name: titleOf(names[first.id].name) });
    await expect(dialog).toBeVisible();
    await waitForIdleScene(page);
    before = await frames();
    await pause(page, 2000);
    expect(await frames()).toBe(before);
    await expect(dialog).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("stops at once after a walk with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/play?debug=frames");
    const frames = await waitForIdleScene(page);
    await walkFor(page, "ArrowDown", 600);
    await waitForIdleScene(page);
    const before = await frames();
    await pause(page, 2000);
    expect(await frames()).toBe(before);
  });

  test("keeps the statues when cast.json fails, with one warning and no error", async ({
    page,
    consoleErrors,
  }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning") warnings.push(message.text());
    });
    await page.route("**/models/cast.json", (route) => route.abort());
    await page.goto("/play?debug=frames");
    await waitForIdleScene(page);
    await expect(page.locator("html")).toHaveAttribute("data-cast", "failed");
    expect(warnings.filter((w) => w.includes("cast.json"))).toHaveLength(1);
    // Talking does not need the figures.
    const names = await npcNames(page);
    await openZoneList(page);
    await page.getByRole("button", { name: `Nói chuyện với ${names.guard.name}` }).click();
    await expect(page.getByRole("dialog", { name: titleOf(names.guard.name) })).toBeVisible();
    // The aborted request itself is the only error.
    expect(consoleErrors.filter((e) => !e.includes("net::ERR_FAILED"))).toEqual([]);
  });
});
