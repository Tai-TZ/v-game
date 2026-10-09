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

import { BACK_SPOT, BACK_Z, NPCS, SPAWN, type Speaker } from "../layout";
import { hubStore } from "../store";

const PANEL_ID = "hub-zone-list";

interface HubTopBarProps {
  /** Undefined while loading. */
  zones: ZoneListResult | undefined;
  onTalk: (who: Speaker) => void;
  onRetry: () => void;
}

/**
 * Top HUD: back to the landing page, the "Các khu" list and the theme switch. The list is the
 * path through the hub that needs no canvas: talk to the librarian and the four NPCs, read
 * every zone card, enter open zones.
 */
export function HubTopBar({ zones, onTalk, onRetry }: HubTopBarProps) {
  const [open, setOpen] = useState(false);
  /** Where the player stood when the list opened: behind the main building or in front. */
  const [inBack, setInBack] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const showSkeleton = useDelayedFlag(zones === undefined, 300);
  const { npcs } = useActiveTheme().campus;

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
      <div className="on-scene absolute top-4 left-4 z-20 flex gap-2 lg:top-6 lg:left-6">
        <Link to="/" className={buttonClass("secondary", "max-sm:w-11 max-sm:px-0")}>
          <ChevronLeftIcon />
          <span className="sr-only sm:not-sr-only">Về trang chủ</span>
        </Link>
      </div>

      <div className="on-scene absolute top-4 right-4 z-20 flex gap-2 lg:top-6 lg:right-6">
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
              onClick={() => onTalk("lan")}
              className="min-h-12 w-full px-4 text-left text-sm font-semibold hover:bg-subtle"
            >
              Nói chuyện với cô Lan
            </button>
          </li>
          {NPCS.map(({ id }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onTalk(id)}
                className="min-h-12 w-full px-4 text-left text-sm font-semibold hover:bg-subtle"
              >
                Nói chuyện với {npcs[id].name}
              </button>
            </li>
          ))}
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
