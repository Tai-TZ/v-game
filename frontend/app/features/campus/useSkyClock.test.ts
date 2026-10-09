import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hubStore } from "./store";
import { useSkyClock, WEATHER_EVERY_MS, WEATHER_RETRY_MS } from "./useSkyClock";

const HANOI = { lat: 21.0285, lon: 105.8542 };
const body = { condition: "drizzle", temperature_c: 26.4, updated_at: "2026-10-08T03:00:00Z" };
const reply = (status: number) =>
  Promise.resolve(
    new Response(JSON.stringify(status === 200 ? body : { detail: "Chưa lấy được" }), { status }),
  );

let hidden = false;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(Date.parse("2026-10-08T21:00:00+07:00"));
  hidden = false;
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() =>
    hidden ? "hidden" : "visible",
  );
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

/** Lets the fetch promise chain settle under fake timers. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

describe("useSkyClock", () => {
  it("sets the phase at once, retries the weather 2 min after a failure, then every 30 min", async () => {
    const fetch = vi.fn(() => reply(503));
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("vg-hub-display", "day");
    const { unmount } = renderHook(() => useSkyClock(HANOI));
    expect(hubStore.getState().sky.phase).toBe("night");
    expect(hubStore.getState().sky.display).toBe("day");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(hubStore.getState().sky.weather).toBeNull();

    fetch.mockImplementation(() => reply(200));
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS - 1000));
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(hubStore.getState().sky.weather).toEqual(body);

    await act(() => vi.advanceTimersByTimeAsync(WEATHER_EVERY_MS - 1000));
    expect(fetch).toHaveBeenCalledTimes(2);

    // Due while hidden: nothing until the tab shows again, then one call.
    hidden = true;
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(fetch).toHaveBeenCalledTimes(2);
    hidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(3);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_EVERY_MS * 2));
    expect(fetch).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it("moves to the next phase within a minute of the sun crossing 6°", async () => {
    vi.setSystemTime(Date.parse("2026-10-08T17:08:00+07:00")); // dusk starts 17:09
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const { unmount } = renderHook(() => useSkyClock(HANOI));
    expect(hubStore.getState().sky.phase).toBe("day");
    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));
    expect(hubStore.getState().sky.phase).toBe("dusk");
    unmount();
    vi.unstubAllGlobals();
  });
});
