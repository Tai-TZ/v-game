import type { Zone } from "~/features/zones/schema";
import { IncidentBadge } from "~/features/zones/ui";

import { SectionHeading } from "./SectionHeading";

export function ZonesSection({ zones }: { zones: readonly Zone[] }) {
  return (
    <section id="khu-hoc" className="scroll-mt-20 bg-subtle py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title="Ba khu đầu tiên">
          Mỗi khu là một nhóm bài học gồm ba màn. Màn thứ ba là một sự cố làm hỏng chính giải pháp
          bạn vừa dựng.
        </SectionHeading>

        <ul className="mt-10 divide-y divide-line border-y border-line">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="grid gap-6 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-xl font-bold">{zone.name}</h3>
                  <span
                    className={
                      zone.status === "open"
                        ? "text-sm font-semibold text-success"
                        : "text-sm text-fg-muted"
                    }
                  >
                    {zone.status === "open" ? "Đang mở" : "Sắp mở"}
                  </span>
                </div>
                <p className="text-fg-muted">{zone.summary}</p>
              </div>
              <ol className="space-y-3">
                {zone.levels.map((level) => (
                  <li key={level.id} className="flex gap-3">
                    <span className="w-5 shrink-0 text-right font-semibold text-fg-muted tabular-nums">
                      {level.order}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{level.title}</span>
                      {level.kind === "incident" && <IncidentBadge />}
                    </span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
