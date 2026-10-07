import { SectionHeading } from "./SectionHeading";

const POINTS: readonly string[] = [
  "Duyệt từng màn chơi do AI soạn từ slide bài giảng trước khi mở cho lớp.",
  "Xem những khái niệm cả lớp đang yếu, dựa trên bằng chứng từ các lần chạy.",
  "Giao ca ôn nhanh mười lăm phút trước buổi kiểm tra.",
];

export function InstructorsSection() {
  return (
    <section id="giang-vien" className="scroll-mt-20 bg-subtle py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionHeading title="Dành cho giảng viên">
          Giảng viên giữ quyền quyết định nội dung. AI chỉ soạn nháp; mọi màn chơi cần được duyệt.
        </SectionHeading>
        <div className="space-y-6">
          <ul className="space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="mt-1 size-5 shrink-0 text-brand"
                >
                  <path
                    d="m5 10.5 3 3 7-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-fg-muted">Trang dành cho giảng viên đang được xây dựng.</p>
        </div>
      </div>
    </section>
  );
}
