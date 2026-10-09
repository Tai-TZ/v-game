import type { ReactNode } from "react";

export function ChevronLeftIcon({ className = "size-4 shrink-0" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path d="m12 4-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const ICON = "size-4 shrink-0";

/** Disclosure marker for a `<summary>`; turns when its `<details className="group">` opens. */
export function ChevronDownIcon({
  className = `${ICON} transition-transform duration-150 group-open:rotate-180`,
}: {
  className?: string;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path d="m4 8 6 6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function LockIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CheckIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path
        d="m4.5 10.5 3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CrossIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path
        d="m5.5 5.5 9 9m0-9-9 9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Star; colour comes from the caller's `fill-*` / `stroke-*` classes. */
export function StarIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} strokeWidth="1.5">
      <path d="m10 2.5 2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2-3.8-3.6 5.2-.7Z" />
    </svg>
  );
}

export function AlertIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path d="M10 3 18 17H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8v4m0 2.5v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/** Turn the campus view (orbit-camera §2.3): an arc with its arrowhead at the top left. */
export function RotateCcwIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path
        d="M4 10a6 6 0 1 0 1.8-4.3L4 7.5m0-4v4h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RotateCwIcon({ className = ICON }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <path
        d="M16 10a6 6 0 1 1-1.8-4.3L16 7.5m0-4v4h-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A compass whose needle (`needleRef`) the caller turns; at rest it points up. */
export function CompassIcon({
  className = ICON,
  needleRef,
}: {
  className?: string;
  needleRef?: (element: SVGGElement | null) => void;
}) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none">
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <g ref={needleRef} className="origin-center [transform-box:fill-box]">
        <path d="M10 4.75 12 10H8Z" fill="currentColor" />
        <path
          d="M10 15.25 8 10h4Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/*
 * Weather (campus v0.4 W6): 1.5 px strokes in currentColor on the 20-unit grid, no emoji. Each
 * cloud icon shares one cloud outline so the set reads as a family.
 */
const CLOUD = "M6 15.5h8.25a3.25 3.25 0 0 0 .4-6.48A4.5 4.5 0 0 0 6 9.5a3 3 0 0 0 0 6Z";
const SMALL_CLOUD = "M7 16h7.5a2.75 2.75 0 0 0 .3-5.48A3.75 3.75 0 0 0 7.6 11 2.5 2.5 0 0 0 7 16Z";

function WeatherSvg({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function SunIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1.06 1.06M14.24 14.24l1.06 1.06M4.7 15.3l1.06-1.06M14.24 5.76l1.06-1.06" />
    </WeatherSvg>
  );
}

export function MoonIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M15.5 12.4A6 6 0 0 1 7.6 4.5a6 6 0 1 0 7.9 7.9Z" />
    </WeatherSvg>
  );
}

export function CloudSunIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M8.2 6.9a3 3 0 0 1 5.3 1.4M8 2.5v1.2M3.5 7.5h1.2M4.8 4.3l.85.85M11.2 4.3l-.85.85" />
      <path d={SMALL_CLOUD} />
    </WeatherSvg>
  );
}

export function CloudMoonIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M12.8 7.6A4.3 4.3 0 0 1 7.4 2.6a4.3 4.3 0 0 0-3 6.1" />
      <path d={SMALL_CLOUD} />
    </WeatherSvg>
  );
}

export function CloudIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d={CLOUD} />
    </WeatherSvg>
  );
}

export function FogIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M6 11.5a3 3 0 0 1 0-.5A4.5 4.5 0 0 1 14.65 9a3.25 3.25 0 0 1 2 2.5" />
      <path d="M3 14h14M5 17h10" />
    </WeatherSvg>
  );
}

export function DrizzleIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M6 12.5h8.25a3.25 3.25 0 0 0 .4-6.48A4.5 4.5 0 0 0 6 6.5a3 3 0 0 0 0 6Z" />
      <path d="M7 15.5v.5M10 16.5v.5M13 15.5v.5" />
    </WeatherSvg>
  );
}

export function RainIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M6 12.5h8.25a3.25 3.25 0 0 0 .4-6.48A4.5 4.5 0 0 0 6 6.5a3 3 0 0 0 0 6Z" />
      <path d="m7.5 15-1 2.5M10.5 15l-1 2.5M13.5 15l-1 2.5" />
    </WeatherSvg>
  );
}

export function StormIcon({ className = ICON }: { className?: string }) {
  return (
    <WeatherSvg className={className}>
      <path d="M6 12.5h8.25a3.25 3.25 0 0 0 .4-6.48A4.5 4.5 0 0 0 6 6.5a3 3 0 0 0 0 6Z" />
      <path d="m10.5 13.5-2 3h3l-2 3" />
    </WeatherSvg>
  );
}
