import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { hubStore } from "../store";
import { HINT_BUTTON_ID } from "./InteractHint";

const WIDE = "(min-width: 1024px)";
const FOCUSABLE = "a[href], button:not([disabled])";

interface HubDialogProps {
  titleId: string;
  /** The speaker's name, as the heading the dialog is labelled by. */
  title: string;
  subtitle: string;
  /** Takes focus when the dialog opens. */
  initialFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The shell of every hub conversation: a modal `<dialog>` (the rest of the page is inert), a
 * side panel from `lg`, a bottom sheet below it. Focus starts on `initialFocus`, Tab is
 * trapped, Esc or a click on the backdrop closes, and focus goes back where it came from.
 */
export function HubDialog({
  titleId,
  title,
  subtitle,
  initialFocus,
  onClose,
  children,
}: HubDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();
    initialFocus.current?.focus();
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
  }, [initialFocus]);

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
      aria-labelledby={titleId}
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
        <h2 id={titleId} className="text-base font-bold">
          {title}
        </h2>
        <p className="text-sm text-fg-muted">{subtitle}</p>
        {children}
      </div>
    </dialog>
  );
}
