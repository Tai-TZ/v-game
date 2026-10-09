import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hubStore } from "../store";
import { WeatherChip } from "./WeatherChip";

const HANOI = { name: "Hà Nội", lat: 21.0285, lon: 105.8542, timeZone: "Asia/Ho_Chi_Minh" };
const fresh = hubStore.getState();

afterEach(() => {
  cleanup();
  hubStore.setState(fresh, true);
  localStorage.clear();
});

describe("WeatherChip", () => {
  it("names the place while loading, then says when there is no weather", () => {
    render(<WeatherChip place={HANOI} />);
    expect(screen.getByRole("button", { name: "Thời tiết Hà Nội" })).toBeTruthy();
    expect(screen.getByText("Đang tải thời tiết")).toBeTruthy();
    act(() => hubStore.getState().setWeather(null));
    expect(screen.getByText("Chưa có thời tiết")).toBeTruthy();
  });

  it("starts its name with the visible temperature and keeps the real weather in day display", () => {
    render(<WeatherChip place={HANOI} />);
    act(() => {
      hubStore.getState().setWeather({
        condition: "drizzle",
        temperature_c: 26.6,
        updated_at: "2026-10-08T09:15:00Z",
      });
    });
    // The name is the button's own label: an sr-only span (position: absolute, so display
    // block) gets padded with spaces in browsers ("27°C , Mưa phùn"), not in jsdom.
    const button = screen.getByRole("button", { name: "27°C, Mưa phùn, Hà Nội" });
    expect(button.getAttribute("aria-label")).toBe("27°C, Mưa phùn, Hà Nội");
    expect(button.querySelector(".sr-only")).toBeNull();
    expect(screen.getByText("27°C · Mưa phùn · Cập nhật 16:15")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Cố định ban ngày", hidden: true }));
    expect(localStorage.getItem("vg-hub-display")).toBe("day");
    expect(hubStore.getState().sky.look).toMatchObject({ sky: "day", weather: "clear" });
    expect(screen.getByRole("button", { name: "27°C, Mưa phùn, Hà Nội" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Cố định ban ngày", hidden: true })).toHaveProperty(
      "checked",
      true,
    );
  });

  it("credits the data next to it, opening in a new tab", () => {
    render(<WeatherChip place={HANOI} />);
    const source = screen.getByRole("link", { name: /Open-Meteo\.com/, hidden: true });
    expect(source.getAttribute("href")).toBe("https://open-meteo.com/");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");
    expect(
      screen.getByRole("link", { name: /CC BY 4\.0/, hidden: true }).getAttribute("href"),
    ).toBe("https://creativecommons.org/licenses/by/4.0/");
    expect(screen.getByText(/tải thẳng từ Open-Meteo.*địa chỉ IP/)).toBeTruthy();
  });

  it("closes its popover when a conversation opens", () => {
    const { container } = render(<WeatherChip place={HANOI} />);
    const popover = container.querySelector<HTMLElement>("[popover]");
    if (!popover) throw new Error("no popover");
    const hide = vi.fn();
    popover.hidePopover = hide;
    act(() => hubStore.getState().openDialog("lan"));
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
