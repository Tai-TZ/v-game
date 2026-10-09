import { useRef, type ReactNode } from "react";

import { buttonClass } from "~/components/ui/button";
import { ZonesErrorNotice } from "~/features/zones/ZoneCard";

import type { SiteInfo } from "../sites";
import type { DialogLines } from "../store";
import { HubDialog } from "./HubDialog";

/** Dialogue copy, verbatim from the build brief §4 (sentence 1 as revised in §4.1). */
const LINES: Readonly<Record<DialogLines, readonly string[]>> = {
  first: [
    "Chào bạn, mình là Lan, thủ thư ca tối. Trợ lý tra cứu của thư viện vừa trả lời sai quy chế cho một bạn sinh viên, còn gán cho Điều 47 một quy định không hề có.",
    "Mình cần người dạy nó tra sách trước khi trả lời. Bạn vào xem giúp mình nhé?",
  ],
  again: ["Trợ lý vẫn đang chờ bạn ở quầy tra cứu."],
};

interface LanDialogProps {
  lines: DialogLines;
  library: SiteInfo;
  /** "Dạy trợ lý tra sách": straight to the first Library level. */
  onTeach: () => void;
  /** That level is loading (a sleeping API can take half a minute): the dialog says so. */
  opening: boolean;
  onEnter: () => void;
  onClose: () => void;
  /** The zone list failed to load: show the error notice instead of `zoneCard`. */
  zonesFailed: boolean;
  onRetry: () => void;
  /** The library's zone card or its loading frame. */
  zoneCard: ReactNode;
}

/** Conversation with the librarian (HubDialog shell); focus starts on "Dạy trợ lý tra sách". */
export function LanDialog({
  lines,
  library,
  onTeach,
  opening,
  onEnter,
  onClose,
  zonesFailed,
  onRetry,
  zoneCard,
}: LanDialogProps) {
  const teachRef = useRef<HTMLButtonElement>(null);

  // The notice unmounts on retry; keep focus in the dialog instead of letting it fall to <body>.
  const retryKeepingFocus = () => {
    teachRef.current?.focus();
    onRetry();
  };

  return (
    <HubDialog
      titleId="lan-dialog-title"
      title="Cô Lan"
      subtitle="Thủ thư ca tối"
      initialFocus={teachRef}
      onClose={onClose}
    >
      <div className="mt-3 space-y-3 text-base leading-relaxed text-fg">
        {LINES[lines].map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <button
          ref={teachRef}
          type="button"
          // Not disabled: that would drop focus to <body> until the level opens.
          onClick={opening ? undefined : onTeach}
          aria-busy={opening}
          className={buttonClass("primary")}
        >
          {opening ? "Đang mở màn…" : "Dạy trợ lý tra sách"}
        </button>
        <p role="status" className="sr-only">
          {opening ? "Đang mở màn…" : ""}
        </p>
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
    </HubDialog>
  );
}
