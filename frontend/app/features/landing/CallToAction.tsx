import { Link } from "react-router";

import { buttonClass } from "~/components/ui/button";

export function CallToAction() {
  return (
    <section className="bg-brand text-on-brand">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Thư viện đang mở</h2>
          <p className="text-on-brand/85">
            Bắt đầu với màn đầu tiên: dạy trợ lý tra cứu thôi bịa điều luật.
          </p>
        </div>
        <Link to="/play" prefetch="intent" className={buttonClass("on-ink")}>
          Vào khuôn viên
        </Link>
      </div>
    </section>
  );
}
