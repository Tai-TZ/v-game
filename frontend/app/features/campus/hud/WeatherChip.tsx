import { useEffect, useRef, useState } from "react";

import { buttonClass } from "~/components/ui/button";
import {
  CloudIcon,
  CloudMoonIcon,
  CloudSunIcon,
  DrizzleIcon,
  FogIcon,
  MoonIcon,
  RainIcon,
  StormIcon,
  SunIcon,
} from "~/components/ui/icons";
import type { Place } from "~/features/theme/schema";

import {
  clockText,
  CONDITION_TEXT,
  partOfDay,
  writeDisplay,
  type Condition,
  type Display,
  type Phase,
} from "../sky";
import { hubStore, useHub } from "../store";

const POPOVER_ID = "hub-weather";
const ICON = "size-5 shrink-0";

/** The group's icon; a clear or partly cloudy night shows the moon. */
export function WeatherIcon({ condition, phase }: { condition: Condition | null; phase: Phase }) {
  const night = phase === "night";
  switch (condition) {
    case "partly_cloudy":
      return night ? <CloudMoonIcon className={ICON} /> : <CloudSunIcon className={ICON} />;
    case "cloudy":
      return <CloudIcon className={ICON} />;
    case "fog":
      return <FogIcon className={ICON} />;
    case "drizzle":
      return <DrizzleIcon className={ICON} />;
    case "rain":
      return <RainIcon className={ICON} />;
    case "thunderstorm":
      return <StormIcon className={ICON} />;
    default:
      return night ? <MoonIcon className={ICON} /> : <SunIcon className={ICON} />;
  }
}

/** Whole degrees; never "-0°C". */
const degrees = (celsius: number) => `${Math.round(celsius) || 0}°C`;

/**
 * Today's weather and hour at the theme's place, in the top-left HUD group (campus v0.4 W6): icon
 * and "27°C" from `sm`, the icon alone (44 px) below. A native popover holds the details, the
 * display mode ("Cố định ban ngày" also stops the rain, WCAG 2.2.2) and the data credit next to
 * the data (Open-Meteo, CC BY 4.0). Old browsers without popover never show its content.
 */
export function WeatherChip({ place }: { place: Place }) {
  const { phase, weather, failed, display } = useHub((state) => state.sky);
  const dialogOpen = useHub((state) => state.dialog !== null);
  const popover = useRef<HTMLDivElement>(null);
  // The popover's clock: read when it opens, not ticking (no per-minute renders).
  const [now, setNow] = useState(() => Date.now());

  // A conversation takes the screen: the popover sits in the top layer, over the dialog.
  useEffect(() => {
    // Browsers without popover (Safari < 17) lack hidePopover; their popover never opens.
    const element = popover.current;
    if (dialogOpen && element && "hidePopover" in element) element.hidePopover();
  }, [dialogOpen]);

  const condition = weather?.condition ?? null;
  const choose = (next: Display) => {
    writeDisplay(next);
    hubStore.getState().setDisplay(next);
  };

  return (
    <>
      <button
        type="button"
        popoverTarget={POPOVER_ID}
        className={buttonClass("secondary", "px-3 max-sm:w-11 max-sm:px-0")}
      >
        <WeatherIcon condition={condition} phase={phase} />
        {/* The name starts with the visible text (WCAG 2.5.3). */}
        {weather ? (
          <>
            <span className="max-sm:sr-only">{degrees(weather.temperature_c)}</span>
            <span className="sr-only">
              , {CONDITION_TEXT[weather.condition]}, {place.name}
            </span>
          </>
        ) : (
          <span className="sr-only">Thời tiết {place.name}</span>
        )}
      </button>
      <div
        ref={popover}
        id={POPOVER_ID}
        popover="auto"
        aria-labelledby={`${POPOVER_ID}-title`}
        onToggle={(event) => {
          if (event.newState === "open") setNow(Date.now());
        }}
        className="fixed inset-x-2 top-[68px] m-0 hidden w-auto rounded-md border border-line-strong bg-surface p-4 text-fg open:block sm:inset-x-auto sm:left-4 sm:w-80 lg:top-[76px] lg:left-6"
      >
        <h2 id={`${POPOVER_ID}-title`} className="text-sm font-bold">
          Thời tiết ở {place.name}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          {clockText(now, place.timeZone)} · {partOfDay(phase, now, place.timeZone)}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {weather
            ? `${degrees(weather.temperature_c)} · ${CONDITION_TEXT[weather.condition]} · Cập nhật ${clockText(Date.parse(weather.updated_at), place.timeZone)}`
            : failed
              ? "Chưa có thời tiết"
              : "Đang tải thời tiết"}
        </p>

        <fieldset className="mt-4 border-t border-line pt-3">
          <legend className="pt-3 text-xs font-semibold text-fg-muted">Hiển thị</legend>
          {(
            [
              ["live", "Theo thời gian thực"],
              ["day", "Cố định ban ngày"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="hub-display"
                value={value}
                checked={display === value}
                onChange={() => choose(value)}
                className="size-4 accent-brand"
              />
              {label}
            </label>
          ))}
          <p className="text-xs text-fg-muted">
            Cố định ban ngày tắt mưa, sương và chớp, giữ cảnh sáng. Hợp khi chiếu lên màn hình lớp
            học.
          </p>
        </fieldset>

        <p className="mt-3 border-t border-line pt-3 text-xs text-fg-muted">
          Dữ liệu thời tiết:{" "}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline"
          >
            Open-Meteo.com<span className="sr-only"> (mở thẻ mới)</span>
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline"
          >
            CC BY 4.0<span className="sr-only"> (mở thẻ mới)</span>
          </a>
          ), đã quy về nhóm và làm tròn
        </p>
      </div>
    </>
  );
}
