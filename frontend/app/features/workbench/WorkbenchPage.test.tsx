import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as progress from "~/features/progress/progress";
import { PROGRESS_KEY, readProgress, recordStars } from "~/features/progress/progress";

import { starterBench } from "./bench";
import { runReducer, type RunView } from "./run";
import { parseSse, readText, replay, testEnv } from "./test-fixtures";
import { useRecordStars, WorkbenchPage } from "./WorkbenchPage";

vi.mock("~/features/progress/progress", async (importOriginal) => {
  const actual = await importOriginal<typeof progress>();
  return { ...actual, recordStars: vi.fn(actual.recordStars) };
});

const l1 = testEnv("grounded-citation");
const DISCARDED = "Cấu hình đã lưu không còn hợp với màn này";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(recordStars).mockClear();
  window.localStorage.clear();
});

describe("WorkbenchPage", () => {
  it("drops the discarded-config notice once the bench saves again", () => {
    const starter = starterBench(l1);
    if (!starter) throw new Error("L1 starter is not drawable");
    window.localStorage.setItem("vg.bench.v1.grounded-citation", "{broken");
    render(
      <MemoryRouter>
        <WorkbenchPage env={l1} starter={starter} back="/play/library" />
      </MemoryRouter>,
    );
    expect(screen.getByText(DISCARDED, { exact: false })).toBeDefined();
    fireEvent.click(screen.getByRole("switch", { name: /Vòm Sao/ }));
    expect(screen.getByText("Đã lưu cấu hình trên máy này.")).toBeDefined();
    expect(screen.queryByText(DISCARDED, { exact: false })).toBeNull();
  });
});

describe("useRecordStars", () => {
  const short = parseSse(readText("e2e", "data", "run-l1-short.sse"));
  const scored = short.findIndex((f) => f.event === "run.scored");
  const record = (run: RunView | null, level = l1.level) =>
    renderHook((props: { run: RunView | null }) => useRecordStars(level, props.run), {
      initialProps: { run },
    });

  it("records the stars once per scored run, under the level's zone and id", () => {
    const hook = record(replay(short.slice(0, scored)));
    expect(recordStars).not.toHaveBeenCalled();
    hook.rerender({ run: replay(short.slice(0, scored + 1)) });
    hook.rerender({ run: replay(short) }); // run.finished: same run, no second call
    expect(recordStars).toHaveBeenCalledExactlyOnceWith("library", "grounded-citation", 1);
    expect(readProgress()).toEqual({ library: { "grounded-citation": 1 } });

    const next = runReducer(null, { kind: "reset", runId: "f".repeat(32) });
    hook.rerender({ run: next });
    hook.rerender({ run: replay(short, next) });
    expect(recordStars).toHaveBeenCalledTimes(2);
  });

  it("keeps going when the storage fails", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => record(replay(short))).not.toThrow();
    expect(recordStars).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("warns instead of throwing when the entry is invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => record(replay(short), { ...l1.level, zone: "Thư viện" })).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
