import { ChevronDownIcon } from "~/components/ui/icons";
import { IncidentBadge } from "~/features/zones/ui";

import { LEVEL_COPY, vaiVi } from "./copy";
import type { PublicLevel } from "./schema";

/**
 * Page head (§8.2): title, brief and cô Lan on the left; from `lg` the star goals and tonight's
 * questions sit in the right column (over the aside), so the bench and "Mở ca" reach the first
 * screen at 1280×800.
 */
export function Brief({ level }: { level: PublicLevel }) {
  const copy = LEVEL_COPY[level.id];
  const { normal, trap } = level.case_counts;
  const visible = level.visible_cases.length;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="max-w-prose">
        <div aria-hidden="true" className="h-[5px] w-12 bg-brand" />
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{level.title}</h1>
          {level.kind === "incident" && <IncidentBadge />}
        </div>
        <p className="mt-3 text-lg text-fg-muted">{level.brief}</p>

        {copy && (
          <figure className="mt-6 rounded-md border border-line bg-surface p-4">
            <figcaption className="text-sm">
              <span className="font-bold">Cô Lan</span>{" "}
              <span className="text-fg-muted">· Thủ thư ca tối</span>
            </figcaption>
            <blockquote className="mt-2">{copy.intro}</blockquote>
          </figure>
        )}
      </div>

      <div className="max-w-prose">
        <h2 className="mt-8 text-lg font-semibold lg:mt-0">Mục tiêu</h2>
        <ol className="mt-3 space-y-2">
          {level.stars_vi.map((goal, index) => (
            <li key={goal} className="grid grid-cols-[3.5rem_1fr] gap-2">
              <span className="font-semibold">Sao {index + 1}</span>
              <span>{goal}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-fg-muted">
          Tối nay: {normal + trap} câu tính sao ({visible} câu mẫu, {normal - visible} câu ẩn,{" "}
          {trap} câu bẫy). Câu ẩn và câu bẫy không hiện câu hỏi.
        </p>
        {visible > 0 && (
          <details className="group mt-3">
            <summary className="flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-brand">
              Xem {visible} câu mẫu
              <ChevronDownIcon />
            </summary>
            <ol className="mt-2 space-y-2">
              {level.visible_cases.map((c, index) => (
                <li key={c.id} className="text-sm">
                  <span className="font-semibold">
                    #{index + 1} · {vaiVi(c.vai)}
                  </span>{" "}
                  · {c.question}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
