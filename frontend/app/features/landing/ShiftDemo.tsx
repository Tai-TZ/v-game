import { useId, useState } from "react";

import { buttonClass } from "~/components/ui/button";

import { SectionHeading } from "./SectionHeading";

type Prediction = "correct" | "invented" | "unknown";
type Stage = "predict" | "ran-without-retrieval" | "ran-with-retrieval";

const PREDICTIONS: readonly { value: Prediction; label: string }[] = [
  { value: "correct", label: "Trả lời đúng quy chế" },
  { value: "invented", label: "Bịa ra một điều khoản" },
  { value: "unknown", label: "Nói là không biết" },
];

const QUESTION = "Em muốn bảo lưu kết quả học tập một học kỳ thì cần làm gì?";

const RETRIEVED_PASSAGE =
  "Điều 12. Bảo lưu kết quả học tập. 2. Sinh viên nộp đơn bảo lưu cho phòng đào tạo chậm nhất hai tuần trước ngày bắt đầu học kỳ, kèm ý kiến của cố vấn học tập.";

/**
 * Illustrative walk-through of the first Library level: predict, run, explain. The game
 * runs agents for real; this page section uses a fixed, labelled example.
 */
export function ShiftDemo() {
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [stage, setStage] = useState<Stage>("predict");
  const [missingPrediction, setMissingPrediction] = useState(false);
  const errorId = useId();

  const runWithoutRetrieval = () => {
    if (!prediction) {
      setMissingPrediction(true);
      return;
    }
    setStage("ran-without-retrieval");
  };

  const reset = () => {
    setPrediction(null);
    setStage("predict");
  };

  return (
    <section id="ca-truc" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading title="Một ca trực ở Thư viện">
          Trợ lý tra cứu của thư viện vừa trả lời một sinh viên. Đoán xem nó làm đúng không, chạy
          thử, rồi gắn thêm bước truy xuất và chạy lại.
        </SectionHeading>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="rounded-md border border-line bg-subtle p-6">
            <p className="text-sm text-fg-muted">Sinh viên hỏi</p>
            <p className="mt-1 text-lg font-semibold">{QUESTION}</p>

            <fieldset className="mt-6" disabled={stage !== "predict"}>
              <legend className="text-sm font-semibold">
                Agent hiện chưa được đưa tài liệu nào. Bạn đoán nó sẽ:
              </legend>
              <div className="mt-3 grid gap-2">
                {PREDICTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:disabled]:cursor-default"
                  >
                    <input
                      type="radio"
                      name="prediction"
                      value={option.value}
                      checked={prediction === option.value}
                      onChange={() => {
                        setPrediction(option.value);
                        setMissingPrediction(false);
                      }}
                      aria-describedby={missingPrediction ? errorId : undefined}
                      className="size-4 accent-brand"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            {missingPrediction && (
              <p id={errorId} className="mt-2 text-sm text-danger">
                Chọn một dự đoán trước khi chạy.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {stage === "predict" && (
                <button type="button" onClick={runWithoutRetrieval} className={buttonClass()}>
                  Chạy agent
                </button>
              )}
              {stage === "ran-without-retrieval" && (
                <button
                  type="button"
                  onClick={() => setStage("ran-with-retrieval")}
                  className={buttonClass()}
                >
                  Gắn bước truy xuất và chạy lại
                </button>
              )}
              {stage !== "predict" && (
                <button type="button" onClick={reset} className={buttonClass("secondary")}>
                  Làm lại
                </button>
              )}
            </div>
          </div>

          <div aria-live="polite" className="min-h-64">
            {stage === "predict" ? (
              <div className="grid h-full place-items-center rounded-md border border-dashed border-line p-6 text-center text-sm text-fg-muted">
                Kết quả chạy sẽ hiện ở đây.
              </div>
            ) : (
              <RunResult stage={stage} prediction={prediction} />
            )}
          </div>
        </div>

        <p className="mt-4 text-sm text-fg-muted">
          Minh hoạ với một quy chế hư cấu. Trong game, agent bạn lắp chạy thật trên bộ câu hỏi của
          NPC.
        </p>
      </div>
    </section>
  );
}

function RunResult({ stage, prediction }: { stage: Stage; prediction: Prediction | null }) {
  if (stage === "ran-without-retrieval") {
    const guessedRight = prediction === "invented";
    return (
      <article className="space-y-4 rounded-md border border-line bg-surface p-6">
        <header className="flex items-center justify-between gap-4">
          <h3 className="font-semibold">Lần chạy 1: không truy xuất</h3>
          <span className="text-sm font-semibold text-danger">Sai</span>
        </header>
        <blockquote className="border-l-4 border-danger bg-danger-tint px-4 py-3">
          Theo Điều 47 Quy chế đào tạo, em chỉ cần gửi email cho phòng đào tạo trước khi học kỳ kết
          thúc là được bảo lưu.
        </blockquote>
        <p className="text-sm">
          Quy chế không có Điều 47 nào nói như vậy. Agent không được đưa văn bản nào, nên model tự
          điền vào chỗ trống bằng một câu nghe rất hợp lý.
        </p>
        <p className="text-sm text-fg-muted">
          {guessedRight
            ? "Bạn đoán đúng: thiếu dữ liệu thì model hay bịa thay vì nói không biết."
            : "Dự đoán của bạn khác kết quả. Đây chính là chỗ đáng tìm hiểu: thiếu dữ liệu thì model hay bịa thay vì nói không biết."}
        </p>
      </article>
    );
  }

  return (
    <article className="space-y-4 rounded-md border border-line bg-surface p-6">
      <header className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Lần chạy 2: có truy xuất</h3>
        <span className="text-sm font-semibold text-success">Đúng</span>
      </header>
      <figure className="rounded-sm bg-subtle px-4 py-3 text-sm">
        <figcaption className="text-fg-muted">Đoạn văn được truy xuất</figcaption>
        <p className="mt-1">{RETRIEVED_PASSAGE}</p>
      </figure>
      <blockquote className="border-l-4 border-success bg-success-tint px-4 py-3">
        Em nộp đơn bảo lưu cho phòng đào tạo chậm nhất hai tuần trước khi học kỳ bắt đầu, kèm ý kiến
        của cố vấn học tập.{" "}
        <cite className="font-semibold text-success not-italic">(Điều 12, khoản 2)</cite>
      </blockquote>
      <p className="text-sm">
        Câu trả lời bám đúng đoạn văn được truy xuất và ghi rõ nguồn, nên người hỏi tự kiểm tra
        được. Đây là bài học của màn đầu tiên ở Thư viện.
      </p>
    </article>
  );
}
