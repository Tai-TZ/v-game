import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hubStore } from "./store";
import { FETCH_TIMEOUT_MS, useSkyClock, WEATHER_EVERY_MS, WEATHER_RETRY_MS } from "./useSkyClock";

const HANOI = { lat: 21.0285, lon: 105.8542 };
/** Open-Meteo's reply (GMT, no offset) and what the store gets from it. */
const upstream = { current: { time: "2026-10-08T14:00", temperature_2m: 26.43, weather_code: 51 } };
const body = { condition: "drizzle", temperature_c: 26.4, updated_at: "2026-10-08T14:00:00.000Z" };
const reply = (status: number) =>
  Promise.resolve(
    new Response(JSON.stringify(status === 200 ? upstream : { reason: "Too many" }), { status }),
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
  it("takes over the sky from the bootstrap's hint on <html>", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(503)),
    );
    document.documentElement.dataset.sky = "night";
    const { unmount } = renderHook(() => useSkyClock(HANOI));
    expect(document.documentElement.dataset.sky).toBeUndefined();
    unmount();
  });

  it("sets the phase at once, retries the weather 2 min after a failure, then every 30 min", async () => {
    const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() => reply(429));
    vi.stubGlobal("fetch", fetch);
    localStorage.setItem("vg-hub-display", "day");
    const { unmount } = renderHook(() => useSkyClock(HANOI));
    expect(hubStore.getState().sky.phase).toBe("night");
    expect(hubStore.getState().sky.display).toBe("day");
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m%2Cweather_code&forecast_days=1",
    );
    expect(init).toMatchObject({ referrerPolicy: "no-referrer" });
    expect(hubStore.getState().sky).toMatchObject({ weather: null, failed: true });

    fetch.mockImplementation(() => reply(200));
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS - 1000));
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(hubStore.getState().sky).toMatchObject({ weather: body, failed: false });

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

  it("gives up on a hung request at the timeout and retries 2 min later", async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fetch);
    hubStore.setState({ sky: { ...hubStore.getState().sky, weather: null, failed: false } });
    const { unmount } = renderHook(() => useSkyClock(HANOI));
    await act(() => vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS - 1));
    expect(hubStore.getState().sky.failed).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(1));
    await settle();
    expect(hubStore.getState().sky.failed).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(WEATHER_RETRY_MS));
    expect(fetch).toHaveBeenCalledTimes(2);
    unmount();
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
