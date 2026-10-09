import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { buttonClass } from "~/components/ui/button";
import { ZonesErrorNotice } from "~/features/zones/ZoneCard";

import type { SiteInfo } from "../sites";
import { hubStore, type DialogLines } from "../store";
import { HINT_BUTTON_ID } from "./InteractHint";

/** Dialogue copy, verbatim from the build brief §4 (sentence 1 as revised in §4.1). */
const LINES: Readonly<Record<DialogLines, readonly string[]>> = {
  first: [
    "Chào bạn, mình là Lan, thủ thư ca tối. Trợ lý tra cứu của thư viện vừa trả lời sai quy chế cho một bạn sinh viên, còn gán cho Điều 47 một quy định không hề có.",
    "Mình cần người dạy nó tra sách trước khi trả lời. Bạn vào xem giúp mình nhé?",
  ],
  again: ["Trợ lý vẫn đang chờ bạn ở quầy tra cứu."],
};

const TITLE_ID = "lan-dialog-title";
const WIDE = "(min-width: 1024px)";
const FOCUSABLE = "a[href], button:not([disabled])";

interface LanDialogProps {
  lines: DialogLines;
  library: SiteInfo;
  /** "Dạy trợ lý tra sách": straight to the first Library level. */
  onTeach: () => void;
  onEnter: () => void;
  onClose: () => void;
  /** The zone list failed to load: show the error notice instead of `zoneCard`. */
  zonesFailed: boolean;
  onRetry: () => void;
  /** The library's zone card or its loading frame. */
  zoneCard: ReactNode;
}

/**
 * Conversation with the librarian: a modal `<dialog>` (the rest of the page is inert), a
 * side panel from `lg`, a bottom sheet below it. Focus starts on "Dạy trợ lý tra sách", Tab is
 * trapped, Esc or a click on the backdrop closes, and focus goes back where it came from.
 */
export function LanDialog({
  lines,
  library,
  onTeach,
  onEnter,
  onClose,
  zonesFailed,
  onRetry,
  zoneCard,
}: LanDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const teachRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    teachRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // After the commit (the hint button is back by then). Skipped when the dialog is still
      // mounted, i.e. a development-only effect re-run.
      queueMicrotask(() => {
        if (dialog.isConnected) return;
        // Back to the control that opened the dialog; after E or a click on the scene, the hint.
        const control =
          opener instanceof HTMLElement &&
          opener.isConnected &&
          opener !== document.body &&
          opener.dataset.campusScene === undefined
            ? opener
            : null;
        (
          control ??
          document.getElementById(HINT_BUTTON_ID) ??
          document.querySelector<HTMLElement>("[data-campus-scene]")
        )?.focus();
      });
    };
  }, []);

  // Below `lg` the sheet covers the bottom of the scene; tell the follow camera how much.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const report = () => {
      const covered = window.matchMedia(WIDE).matches ? 0 : dialog.getBoundingClientRect().height;
      hubStore.getState().setSheetInset(Math.round(covered));
    };
    const observer = new ResizeObserver(report);
    observer.observe(dialog);
    return () => {
      observer.disconnect();
      hubStore.getState().setSheetInset(0);
    };
  }, []);

  // The notice unmounts on retry; keep focus in the dialog instead of letting it fall to <body>.
  const retryKeepingFocus = () => {
    teachRef.current?.focus();
    onRetry();
  };

  const trapTab = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    // The backdrop click lands on the <dialog> element itself; content clicks land inside.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- backdrop click; Esc is handled by onCancel
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={trapTab}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[70dvh] w-full max-w-none animate-enter overflow-y-auto rounded-t-md border-0 border-t border-line-strong bg-surface p-0 text-fg backdrop:bg-ink/20 lg:inset-x-auto lg:top-20 lg:right-6 lg:bottom-auto lg:max-h-[calc(100dvh-104px)] lg:w-96 lg:rounded-md lg:border"
    >
      <div className="px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-5">
        <h2 id={TITLE_ID} className="text-base font-bold">
          Cô Lan
        </h2>
        <p className="text-sm text-fg-muted">Thủ thư ca tối</p>
        <div className="mt-3 space-y-3 text-base leading-relaxed text-fg">
          {LINES[lines].map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button ref={teachRef} type="button" onClick={onTeach} className={buttonClass("primary")}>
            Dạy trợ lý tra sách
          </button>
          <button type="button" onClick={onEnter} className={buttonClass("secondary")}>
            Vào {library.name}
          </button>
          <button type="button" onClick={onClose} className={buttonClass("quiet")}>
            Để sau
          </button>
        </div>
        <div className="mt-5 border-t border-line pt-5">
          {zonesFailed ? <ZonesErrorNotice onRetry={retryKeepingFocus} /> : zoneCard}
        </div>
      </div>
    </dialog>
  );
}
