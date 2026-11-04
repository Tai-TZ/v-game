import type { ReactNode } from "react";

import { PageFrame } from "~/components/PageFrame";
import { buttonClass } from "~/components/ui/button";
import { microHref, warmupsBefore } from "~/features/micro/registry";
import { ProjectorLink } from "~/features/projector/ProjectorLink";
import { SessionExport } from "~/features/session/SessionExport";

import type { ZonePageData } from "./api";
import type { Zone } from "./schema";
import { ConceptChips, IncidentBadge, ZONE_BAR, ZoneStatusText } from "./ui";

const BACK_LABEL = "Về khuôn viên";

/** The hub URL that puts the player back at this zone's door (art §4.6). */
const hubAt = (zone: Zone | null) => (zone ? `/play?at=${zone.location}` : "/play");

function Frame({ back, children }: { back: string; children: ReactNode }) {
  return (
    <PageFrame back={back} backLabel={BACK_LABEL}>
      {children}
    </PageFrame>
  );
}

function ZoneHeader({ zone }: { zone: Zone }) {
  return (
    <>
      <div aria-hidden="true" className={`h-[5px] w-12 ${ZONE_BAR[zone.location]}`} />
      <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{zone.name}</h1>
        <ZoneStatusText status={zone.status} className="text-sm" />
      </div>
      <p className="mt-3 max-w-prose text-lg text-fg-muted">{zone.summary}</p>
      <ConceptChips concepts={zone.concepts} className="mt-4" />
    </>
  );
}

const byOrder = (zone: Zone) => [...zone.levels].sort((a, b) => a.order - b.order);

/** `/play/:zoneId`: an open zone with its levels, or the locked / not found / error state. */
export function ZonePage({ data, onRetry }: { data: ZonePageData; onRetry: () => void }) {
  switch (data.kind) {
    case "open":
      return (
        <Frame back={hubAt(data.zone)}>
          <ZoneHeader zone={data.zone} />
          <ol className="mt-10 space-y-4">
            {byOrder(data.zone).flatMap((level, index) => [
              // A warm-up micro lesson sits just before the level it prepares: optional, never a
              // step in the way (roadmap X18).
              ...warmupsBefore(data.zone.id, level.id).map((lesson) => (
                <li
                  key={`vi-mo-${lesson.id}`}
                  data-warmup-row=""
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-line px-5 py-3"
                >
                  <p className="text-sm">
                    <span className="font-semibold">Khởi động 2 phút</span>
                    <span className="text-fg-muted"> · {lesson.title} · không tính sao</span>
                  </p>
                  <ProjectorLink
                    to={microHref(lesson)}
                    aria-label={`Làm bài khởi động ${lesson.title}`}
                    className={buttonClass("quiet")}
                  >
                    Làm bài khởi động
                  </ProjectorLink>
                </li>
              )),
              <li
                key={level.id}
                data-level={level.id}
                data-level-status={level.status}
                data-look={level.status === "open" ? "open" : "coming"}
                className={`grid grid-cols-[2rem_1fr] gap-x-4 rounded-md border p-5 sm:grid-cols-[2rem_1fr_auto] ${
                  level.status === "open"
                    ? "border-line bg-surface"
                    : "border-dashed border-fg-muted bg-subtle text-fg-muted"
                }`}
              >
                <span aria-hidden="true" className="text-2xl font-bold text-fg-muted tabular-nums">
                  {level.order}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-lg font-semibold">{level.title}</h2>
                    {level.kind === "incident" && <IncidentBadge />}
                  </div>
                  <p className="mt-1 text-fg-muted">{level.brief}</p>
                  <ConceptChips concepts={level.concepts} className="mt-3" />
                </div>
                <div className="col-span-2 mt-4 sm:col-span-1 sm:mt-0">
                  {level.status !== "open" ? (
                    <ZoneStatusText status={level.status} className="text-sm" />
                  ) : (
                    <ProjectorLink
                      to={`/play/${data.zone.id}/${level.id}`}
                      aria-label={`Vào màn ${level.title}`}
                      // No progress is stored yet, so the first level is the one to start with.
                      className={buttonClass(
                        index === 0 ? "primary" : "secondary",
                        "w-full sm:w-auto",
                      )}
                    >
                      Vào màn
                    </ProjectorLink>
                  )}
                </div>
              </li>,
            ])}
          </ol>
          <SessionExport />
          <ProjectorLink to={hubAt(data.zone)} className={buttonClass("secondary", "mt-10")}>
            {BACK_LABEL}
          </ProjectorLink>
        </Frame>
      );

    case "locked":
      return (
        <Frame back={hubAt(data.zone)}>
          <ZoneHeader zone={data.zone} />
          <section className="mt-10 rounded-md border border-line bg-subtle p-5">
            <h2 className="text-lg font-semibold">Khu này sắp mở</h2>
            <ol className="mt-3 list-inside list-decimal space-y-1 text-fg-muted">
              {byOrder(data.zone).map((level) => (
                <li key={level.id}>{level.title}</li>
              ))}
            </ol>
            <ProjectorLink to={hubAt(data.zone)} className={buttonClass("primary", "mt-5")}>
              {BACK_LABEL}
            </ProjectorLink>
          </section>
        </Frame>
      );

    case "not-found":
      return (
        <Frame back={hubAt(null)}>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Không tìm thấy khu này</h1>
          <p className="mt-3 text-fg-muted">Đường dẫn không khớp khu nào trong khuôn viên.</p>
          <ProjectorLink to={hubAt(null)} className={buttonClass("primary", "mt-8")}>
            {BACK_LABEL}
          </ProjectorLink>
        </Frame>
      );

    case "error":
      return (
        <Frame back={hubAt(null)}>
          <div role="alert" className="rounded-md border border-line bg-warning-tint p-5">
            <h1 className="text-base font-semibold text-fg">Chưa tải được thông tin khu này.</h1>
            <p className="mt-1 text-sm text-fg-muted">Kiểm tra kết nối rồi thử lại.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
                Thử lại
              </button>
              <ProjectorLink to={hubAt(null)} className={buttonClass("quiet")}>
                {BACK_LABEL}
              </ProjectorLink>
            </div>
          </div>
        </Frame>
      );
  }
}

/** Static loading frame (no shimmer), shaped like the open zone page (art §9.4). */
export function ZonePageSkeleton() {
  const block = "bg-subtle rounded-sm";
  return (
    <Frame back={hubAt(null)}>
      <div aria-hidden="true">
        <div className={`h-[5px] w-12 ${block}`} />
        <div className={`mt-4 h-9 w-56 ${block}`} />
        <div className={`mt-4 h-4 w-full ${block}`} />
        <div className={`mt-2 h-4 w-2/3 ${block}`} />
        <div className="mt-10 space-y-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-28 rounded-md bg-subtle" />
          ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        Đang tải khu
      </p>
    </Frame>
  );
}
