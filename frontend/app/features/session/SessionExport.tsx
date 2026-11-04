import { useState } from "react";

import { buttonClass } from "~/components/ui/button";

import { sessionCode, sessionRows, toCsv } from "./export";

/**
 * Plan v0.7 1.3: the learner downloads this browser's session data for the class's paper
 * tests. The code is shown before anything is made, so it can be copied onto the test first.
 * Never on the projector: it is one browser's history and hints, and its code ties that
 * browser to a paper test (lesson plan R3, R8).
 */
export function SessionExport() {
  const [code, setCode] = useState<string | null>(null);
  const download = () => {
    const own = code ?? sessionCode();
    setCode(own);
    const blob = new Blob([toCsv(sessionRows(own))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `v-game-${own}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      aria-labelledby="session-export"
      data-session-export=""
      className="mt-10 rounded-md border border-line p-5 chieu:hidden"
    >
      <h2 id="session-export" className="text-lg font-semibold">
        Dữ liệu buổi học của bạn
      </h2>
      <p className="mt-1 max-w-prose text-sm text-fg-muted">
        Chỉ khi giảng viên yêu cầu. Tệp gồm số sao, số token, số câu đạt và các gợi ý đã mở của
        trình duyệt này, kèm một mã ngẫu nhiên; không có tên, cấu hình hay câu hỏi. Không gửi gì lên
        máy chủ: bạn tự tải tệp về.
      </p>
      {code && (
        <p className="mt-3 text-sm">
          Mã của bạn: <span className="font-mono text-base font-semibold">{code}</span>. Chép mã này
          lên phiếu kiểm tra.
        </p>
      )}
      <button type="button" onClick={download} className={buttonClass("secondary", "mt-3")}>
        Tải dữ liệu buổi học
      </button>
    </section>
  );
}
