import type { ReactNode } from "react";

import { buttonClass } from "~/components/ui/button";

import type { ZoneSummary } from "./schema";
import { ConceptChips, ZONE_BAR, ZoneStatusText } from "./ui";

interface ZoneCardProps {
  zone: ZoneSummary;
  /** `full` (dialog) has the zone colour bar; `compact` (zone list) does not. */
  variant: "full" | "compact";
  /** Actions shown under the card, e.g. "Vào Thư viện". */
  children?: ReactNode;
}

/** Zone summary from `GET /api/zones` (art §8.4). Borderless: it sits inside a panel. */
export function ZoneCard({ zone, variant, children }: ZoneCardProps) {
  return (
    <article className={variant === "compact" ? "p-4" : undefined}>
      {variant === "full" && (
        <div aria-hidden="true" className={`mb-3 h-1 w-6 ${ZONE_BAR[zone.location]}`} />
      )}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg font-bold">{zone.name}</h3>
        <ZoneStatusText status={zone.status} className="text-sm" />
      </div>
      <p className="mt-2 text-sm text-fg-muted">{zone.summary}</p>
      <ConceptChips concepts={zone.concepts} className="mt-3" />
      <p className="mt-3 text-sm text-fg-muted">{zone.level_count} màn</p>
      {children}
    </article>
  );
}

/** API failure inside a hub panel: the scene keeps working (art §8.4). */
export function ZonesErrorNotice({
  onRetry,
  className = "",
}: {
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={`rounded-md border border-line bg-warning-tint p-4 ${className}`}>
      <p className="text-sm font-semibold text-fg">Chưa tải được thông tin các khu.</p>
      <p className="mt-1 text-sm text-fg-muted">
        Cảnh vẫn dùng được. Kiểm tra kết nối rồi thử lại.
      </p>
      <button type="button" onClick={onRetry} className={buttonClass("secondary", "mt-3")}>
        Thử lại
      </button>
    </div>
  );
}
