import { describe, expect, it } from "vitest";

import { describePostError, newKey } from "./api";

const headers = (entries: Record<string, string> = {}) => new Headers(entries);
const NOW = Date.parse("2026-10-08T12:00:00Z");

describe("describePostError", () => {
  it("422 with issues: the server's title and its issues for the slots", () => {
    const issue = {
      code: "G05",
      severity: "error",
      node: "rr",
      port: "docs",
      message_vi: "*Xếp hạng lại* chưa có gì cắm vào cổng Tài liệu.",
      concept_ref: "N8.rerank",
    };
    const error = describePostError(
      422,
      { detail: "Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại.", issues: [issue] },
      headers(),
    );
    expect(error.title).toBe("Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại.");
    expect(error.issues).toHaveLength(1);
    expect(error.issues?.[0]).toMatchObject({ node: "rr", port: "docs" });
    expect(error.retry).toBe(false);
  });

  it("422 from the framework (detail is a list, no issues): the generic box", () => {
    const error = describePostError(
      422,
      { detail: [{ loc: ["header", "idempotency-key"], msg: "String should match pattern" }] },
      headers(),
    );
    expect(error).toMatchObject({ title: "Chưa mở ca được", issues: null, retry: false });
    expect(error.lines).toEqual(["Máy chủ đang gặp sự cố. Thử lại sau ít phút."]);
    // The shape the local backend answers for a malformed Idempotency-Key (2026-10-08).
    const local = describePostError(
      422,
      { detail: "Yêu cầu không hợp lệ.", fields: ["header.idempotency-key"] },
      headers(),
    );
    expect(local).toMatchObject({ title: "Chưa mở ca được", issues: null });
  });

  it("429 as the server sends it today: the detail, no time, retry with the same key", () => {
    const error = describePostError(
      429,
      { detail: "Đang có nhiều lượt chạy, bạn thử lại sau ít phút." },
      headers(),
      NOW,
    );
    expect(error.title).toBe("Máy chủ đang bận");
    expect(error.lines).toEqual(["Đang có nhiều lượt chạy, bạn thử lại sau ít phút."]);
    expect(error.lines.join(" ")).not.toContain("giây");
    expect(error.retry).toBe(true);
  });

  it("429 with Retry-After in seconds or as an HTTP date", () => {
    const seconds = describePostError(429, { detail: "Bận." }, headers({ "Retry-After": "30" }));
    expect(seconds.lines).toContain("Bạn có thể thử lại sau khoảng 30 giây.");
    const date = describePostError(
      429,
      { detail: "Bận." },
      headers({ "Retry-After": "Thu, 08 Oct 2026 12:01:30 GMT" }),
      NOW,
    );
    expect(date.lines).toContain("Bạn có thể thử lại sau khoảng 2 phút.");
    const minutes = describePostError(429, null, headers({ "Retry-After": "120" }));
    // No detail but a time: one plain line, then the time (no "sau ít phút" next to it).
    expect(minutes.lines).toEqual([
      "Đang có nhiều lượt chạy.",
      "Bạn có thể thử lại sau khoảng 2 phút.",
    ]);
    // A daily quota is hours away: hours from 90 minutes on.
    const hours = describePostError(429, null, headers({ "Retry-After": String(5 * 3600) }));
    expect(hours.lines).toContain("Bạn có thể thử lại sau khoảng 5 giờ.");
    const half = describePostError(429, null, headers({ "Retry-After": String(90 * 60) }));
    expect(half.lines).toContain("Bạn có thể thử lại sau khoảng 1,5 giờ.");
    const under = describePostError(429, null, headers({ "Retry-After": String(89 * 60) }));
    expect(under.lines).toContain("Bạn có thể thử lại sau khoảng 89 phút.");
    const junk = describePostError(429, { detail: "Bận." }, headers({ "Retry-After": "soon" }));
    expect(junk.lines).toEqual(["Bận."]);
  });

  it("503 for each code keeps the config, and tells how to run without the reranker", () => {
    for (const code of [
      "llm_not_configured",
      "index_stale",
      "index_missing",
      "rerank_unavailable",
    ]) {
      const error = describePostError(503, { detail: `Chi tiết ${code}.`, code }, headers());
      expect(error.title).toBe("Máy chủ chưa sẵn sàng chạy");
      expect(error.lines[0]).toBe(`Chi tiết ${code}.`);
      expect(error.lines.at(-1)).toBe("Cấu hình của bạn vẫn được giữ trên máy này.");
      expect(error.lines.includes("Tháo Kính lúp thì vẫn mở ca được.")).toBe(
        code === "rerank_unavailable",
      );
      expect(error.retry).toBe(true);
    }
  });

  it("409: no retry with that key", () => {
    const error = describePostError(
      409,
      { detail: "Idempotency-Key này đã dùng cho một đồ thị khác." },
      headers(),
    );
    expect(error).toMatchObject({ title: "Chưa mở ca được", retry: false, backLink: false });
    expect(error.lines).toEqual(["Idempotency-Key này đã dùng cho một đồ thị khác."]);
  });

  it("404: the detail and a way back to the level list", () => {
    const error = describePostError(404, { detail: "Không tìm thấy level." }, headers());
    expect(error).toMatchObject({ title: "Chưa mở ca được", backLink: true });
    expect(error.lines).toEqual(["Không tìm thấy level."]);
  });

  it("415, 5xx and a broken body: the generic box; only a 5xx or broken body retries", () => {
    for (const status of [415, 500, 502, 504, -1]) {
      const error = describePostError(status, { detail: "Chỉ nhận JSON." }, headers());
      expect(error.title).toBe("Chưa mở ca được");
      expect(error.lines).toEqual(["Máy chủ đang gặp sự cố. Thử lại sau ít phút."]);
      // A gateway error may hide a run the server did start: the same key gets that run back.
      expect(error.retry).toBe(status !== 415);
    }
  });

  it("fetch threw: network box, retry with the same key", () => {
    const error = describePostError(0, null, null);
    expect(error.title).toBe("Không gửi được cấu hình");
    expect(error.lines).toEqual(["Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại."]);
    expect(error.retry).toBe(true);
  });
});

describe("newKey", () => {
  it("makes a fresh key the server accepts", () => {
    const a = newKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(a).toHaveLength(32);
    expect(newKey()).not.toBe(a);
  });
});
