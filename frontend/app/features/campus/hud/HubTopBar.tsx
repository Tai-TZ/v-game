import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { buttonClass } from "~/components/ui/button";
import { ChevronLeftIcon } from "~/components/ui/icons";
import { useActiveTheme } from "~/features/theme/context";
import { ThemeToggle } from "~/features/theme/ThemeToggle";
import type { ZoneListResult } from "~/features/zones/api";
import { ZoneCard, ZonesErrorNotice } from "~/features/zones/ZoneCard";
import { AUTHOR } from "~/lib/site";
import { useDelayedFlag } from "~/lib/useSettled";

import { BACK_SPOT, BACK_Z, SPAWN } from "../layout";
import { hubStore, useHub } from "../store";

const PANEL_ID = "hub-zone-list";

interface HubTopBarProps {
  /** Undefined while loading. */
  zones: ZoneListResult | undefined;
  onTalk: () => void;
  onRetry: () => void;
}

/**
 * Top HUD: back to the landing page, the "Các khu" list and the theme switch. The list is the
 * path through the hub that needs no canvas: talk to the librarian, read every zone card,
 * enter open zones.
 */
export function HubTopBar({ zones, onTalk, onRetry }: HubTopBarProps) {
  const [open, setOpen] = useState(false);
  /** Where the player stood when the list opened: behind the main building or in front. */
  const [inBack, setInBack] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const showSkeleton = useDelayedFlag(zones === undefined, 300);
  const defaultTime = useActiveTheme().campus.lights.default;
  const dusk = (useHub((state) => state.time) ?? defaultTime) === "dusk";
  // The light preset lives in the scene; while it is down (no WebGL, failed) the button would
  // do nothing.
  const sceneUp = useHub((state) => state.sceneUp);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // While the dialog is open, Esc belongs to the dialog.
      if (event.key !== "Escape" || hubStore.getState().dialog) return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (hubStore.getState().dialog || !(event.target instanceof Node)) return;
      if (panelRef.current?.contains(event.target) || toggleRef.current?.contains(event.target))
        return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // The notice unmounts on retry; keep focus in the panel so the movement keys stay inert.
  const retryKeepingFocus = () => {
    headingRef.current?.focus();
    onRetry();
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-20 flex gap-2 lg:top-6 lg:left-6">
        <Link to="/" className={buttonClass("secondary", "max-sm:w-11 max-sm:px-0")}>
          <ChevronLeftIcon />
          <span className="sr-only sm:not-sr-only">Về trang chủ</span>
        </Link>
        {/* Light preset (N8): pressed is dusk, released is day. Icon only below md, so the
            two corner groups stay apart at 640–767 px. */}
        {sceneUp && (
          <button
            type="button"
            aria-pressed={dusk}
            onClick={() => hubStore.getState().setTime(dusk ? "day" : "dusk")}
            className={buttonClass(
              "secondary",
              "px-3 aria-pressed:border-brand aria-pressed:bg-brand-tint max-md:w-11 max-md:px-0",
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="none">
              <path
                d="M5 13a5 5 0 0 1 10 0M2 13h16M4 16.5h12M10 3v3M4.3 6.3l1.4 1.4M15.7 6.3l-1.4 1.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only md:not-sr-only">Hoàng hôn</span>
          </button>
        )}
      </div>

      <div className="absolute top-4 right-4 z-20 flex gap-2 lg:top-6 lg:right-6">
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          onClick={() => {
            setInBack(hubStore.getState().motion.position.z < BACK_Z);
            setOpen((value) => !value);
          }}
          className={buttonClass("secondary")}
        >
          Các khu
        </button>
        <ThemeToggle tone="surface" compact />
      </div>

      <div
        ref={panelRef}
        id={PANEL_ID}
        hidden={!open}
        className="fixed inset-x-2 top-[68px] z-50 max-h-[calc(100dvh-84px)] overflow-y-auto rounded-md border border-line-strong bg-surface sm:absolute sm:inset-x-auto sm:right-4 sm:w-80 lg:top-[76px] lg:right-6"
      >
        <h2 ref={headingRef} tabIndex={-1} className="px-4 pt-4 pb-2 text-sm font-bold">
          Các khu
        </h2>
        <ul className="divide-y divide-line border-t border-line">
          <li>
            <button
              type="button"
              onClick={onTalk}
              className="min-h-12 w-full px-4 text-left text-sm font-semibold hover:bg-subtle"
            >
              Nói chuyện với cô Lan
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                toggleRef.current?.focus();
                hubStore.getState().walkTo(inBack ? SPAWN : BACK_SPOT);
              }}
              className="min-h-12 w-full px-4 text-left text-sm font-semibold hover:bg-subtle"
            >
              {inBack ? "Về mặt trước" : "Đi tới khuôn viên phía sau"}
            </button>
          </li>
          {zones === undefined &&
            showSkeleton &&
            [0, 1, 2].map((row) => (
              <li key={row} aria-hidden="true" className="p-2">
                <div className="h-12 rounded-sm bg-subtle" />
              </li>
            ))}
          {zones?.ok === false && (
            <li>
              <ZonesErrorNotice onRetry={retryKeepingFocus} className="m-4" />
            </li>
          )}
          {zones?.ok &&
            zones.zones.map((zone) => (
              <li key={zone.id}>
                <ZoneCard zone={zone} variant="compact">
                  {zone.status === "open" && (
                    <Link to={`/play/${zone.id}`} className={buttonClass("primary", "mt-4 w-full")}>
                      Vào {zone.name}
                    </Link>
                  )}
                </ZoneCard>
              </li>
            ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-xs text-fg-muted">V-Game · {AUTHOR}</p>
      </div>
    </>
  );
}
