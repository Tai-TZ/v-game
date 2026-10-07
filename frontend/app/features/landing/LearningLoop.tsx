import { SectionHeading } from "./SectionHeading";

const STEPS: readonly { title: string; body: string }[] = [
  {
    title: "Đoán",
    body: "Trước khi bấm chạy, bạn đoán agent sẽ đúng mấy câu và sai ở đâu.",
  },
  {
    title: "Chạy thật",
    body: "Agent bạn lắp chạy trên bộ câu hỏi của NPC. Từng bước sáng lên theo dữ liệu thật, không có kết quả dựng sẵn.",
  },
  {
    title: "Giải thích",
    body: "Đặt dự đoán cạnh kết quả, lần theo dấu vết tới đúng bước gây lỗi và nói lại vì sao.",
  },
  {
    title: "So với cả lớp",
    body: "Xem lời giải của bạn đứng ở đâu về độ chính xác và chi phí, rồi thử một cách khác.",
  },
];

export function LearningLoop() {
  return (
    <section id="cach-hoc" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title="Mỗi lần chạy là một thí nghiệm nhỏ">
          Game không chấm đúng sai ngay. Nó cho bạn đặt giả thuyết, kiểm chứng trên dữ liệu thật,
          rồi tự giải thích điều vừa thấy.
        </SectionHeading>

        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="space-y-2 border-t-2 border-brand pt-4">
              <p className="text-sm font-bold text-brand tabular-nums">Bước {index + 1}</p>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-2xl text-fg-muted">
          Khu nào lâu không ôn sẽ tối dần trên bản đồ. Ca trực năm phút mỗi ngày trộn lại các sự cố
          cũ để kiến thức không trôi đi sau buổi học.
        </p>
      </div>
    </section>
  );
}
