import { Link } from "react-router";

import { buttonClass } from "~/components/ui/button";
import { useActiveTheme } from "~/features/theme/context";
import { themeAssetUrl } from "~/features/theme/paths";

export function Hero() {
  const theme = useActiveTheme();
  const { hero, brand } = theme;
  const srcSet = hero.sources
    .map((source) => `${themeAssetUrl(theme.id, source.src)} ${source.width}w`)
    .join(", ");
  const largest = hero.sources.at(-1) ?? hero.sources[0];
  const programLead = brand.programName
    ? `Bài học của chương trình ${brand.programName}`
    : "Bài học AI thực chiến";

  return (
    <section className="relative isolate overflow-hidden bg-ink text-on-ink">
      <img
        key={theme.id}
        src={largest ? themeAssetUrl(theme.id, largest.src) : undefined}
        srcSet={srcSet}
        sizes="100vw"
        width={hero.width}
        height={hero.height}
        alt={hero.alt}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 -z-20 size-full object-cover object-[60%_center]"
      />
      {/* Scrim keeps the headline legible over any photo. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/85 to-ink/20 md:bg-linear-to-r"
      />
      <div className="mx-auto flex min-h-[34rem] max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 md:min-h-[40rem] md:justify-center md:py-24">
        <div className="max-w-xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Học AI bằng cách sửa những agent đang làm hỏng việc
          </h1>
          <p className="text-lg text-on-ink-muted">
            {programLead} được dựng thành những ca trực trong một khuôn viên thu nhỏ. Bạn lắp agent,
            cho nó chạy thật trên câu hỏi của người dùng, rồi lần theo dấu vết để hiểu vì sao nó
            đúng hay sai.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/play" prefetch="intent" className={buttonClass("primary")}>
              Vào khuôn viên
            </Link>
            <a href="#ca-truc" className={buttonClass("on-ink")}>
              Xem một ca trực
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
