import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "~/features/theme/context";
import { parseThemeIndex, parseThemeManifest } from "~/features/theme/schema";

import type { ZonePageData } from "./api";
import { ZoneContentSchema, type Zone } from "./schema";
import { ZonePage } from "./ZonePage";

const read = (...parts: string[]): unknown =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), ...parts), "utf8"));

const themes = parseThemeIndex(read("public", "themes", "index.json"));
const catalog = {
  themes,
  defaultId: themes[0]?.id ?? "",
  manifests: Object.fromEntries(
    themes.map(({ id }) => [id, parseThemeManifest(read("public", "themes", id, "manifest.json"))]),
  ),
};

// The same seed the backend serves.
const zones = v.parse(
  ZoneContentSchema,
  read("..", "backend", "src", "vgame", "content", "data", "zones.json"),
).zones;
const zone = (id: string): Zone => {
  const found = zones.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No zone ${id} in the seed.`);
  return found;
};

function renderPage(data: ZonePageData, onRetry = vi.fn()) {
  // A data router: the page frame reads the navigation and revalidation state.
  const router = createMemoryRouter([
    { path: "*", element: <ZonePage data={data} onRetry={onRetry} /> },
  ]);
  render(
    <ThemeProvider catalog={catalog}>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
  return onRetry;
}

afterEach(cleanup);

describe("ZonePage", () => {
  it("lists the open zone's levels in order, each with a 'Vào màn' link to its workbench", () => {
    renderPage({ kind: "open", zone: zone("library") });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Thư viện" })).toBeDefined();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(["Thôi bịa điều luật", "Lược dao chunk", "Hỏi bằng số điều"]);
    const enter = screen.getAllByRole("link", { name: /^Vào màn / });
    expect(enter.map((link) => link.getAttribute("href"))).toEqual([
      "/play/library/grounded-citation",
      "/play/library/chunk-tuning",
      "/play/library/article-number-lookup",
    ]);
    expect(screen.queryByRole("button", { name: "Đang xây" })).toBeNull();
    expect(screen.getAllByText("Sự cố")).toHaveLength(1);

    const back = screen.getAllByRole("link", { name: "Về khuôn viên" });
    for (const link of back) expect(link.getAttribute("href")).toBe("/play?at=library");
  });

  it("shows a coming-soon zone as locked, with level titles but no buttons", () => {
    renderPage({ kind: "locked", zone: zone("watchtower") });
    expect(screen.getByRole("heading", { name: "Khu này sắp mở" })).toBeDefined();
    expect(screen.getByText("Cổng thành")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Đang xây" })).toBeNull();
  });

  it("explains an unknown zone and links back to the campus", () => {
    renderPage({ kind: "not-found" });
    expect(screen.getByRole("heading", { level: 1, name: "Không tìm thấy khu này" })).toBeDefined();
    expect(screen.getByText("Đường dẫn không khớp khu nào trong khuôn viên.")).toBeDefined();
    const back = screen.getAllByRole("link", { name: "Về khuôn viên" });
    expect(back.every((link) => link.getAttribute("href") === "/play")).toBe(true);
  });

  it("shows an API error as an alert with a working retry", () => {
    const onRetry = renderPage({ kind: "error" });
    expect(screen.getByRole("alert")).toBeDefined();
    screen.getByRole("button", { name: "Thử lại" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
