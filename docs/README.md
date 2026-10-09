# Tài liệu V-Game

V-Game là game web giáo dục cho chương trình AI 20K. Người chơi lắp agent AI từ khối, rồi chạy agent thật trên test set của NPC. Bắt đầu đọc từ đặc tả tổng hợp, rồi lộ trình v0.4 (quyết định mới nhất, 2026-10-08).

## Thiết kế và quyết định

| Tài liệu | Nội dung | Trạng thái |
|---|---|---|
| [specs/2026-10-07-v-game-design.md](specs/2026-10-07-v-game-design.md) | Đặc tả tổng hợp: mục tiêu, người dùng, lộ trình, vòng chơi, cơ chế học/ôn/brainstorm, luật thưởng, quỹ chạy thật, kiến trúc, hiệu năng, bảo mật, theme packs, phạm vi, quyết định | Đã duyệt phần lớn; sửa 2026-10-08; có mục chờ quyết |
| [design/roadmap-v0.4.md](design/roadmap-v0.4.md) | Lộ trình v0.4: quyết định 2026-10-08, 28 xung đột đã gỡ, trạng thái N1–N25 (và T, D), kế hoạch đợt B cho bàn thợ | Đã duyệt 2026-10-08; thứ tự xây ở X24 và X26–X28 chốt tạm (Q9) |
| [design/part-3-block-system.md](design/part-3-block-system.md) | Phần 3: hệ khối, validation, biên dịch LangGraph, sandbox, instrumentation; kèm vấn đề của agent phản biện | Thiết kế; engine v0.2 đã hiện thực phần Thư viện |
| [design/gameplay-direction.md](design/gameplay-direction.md) | Hướng gameplay "Xưởng Đồ Chơi Trực Ca" | Đề xuất, chờ chủ dự án duyệt; build brief dùng phần trình bày |
| [design/build-brief-v0.1.md](design/build-brief-v0.1.md) | Brief lát cắt dọc Thư viện: quyết định D1–D7, neo nội dung, ngân sách, nghiệm thu | Đang dùng |
| [design/engine-v0.2.md](design/engine-v0.2.md) | Engine khu Thư viện: model Gemini và chuỗi dự phòng, chỉ mục, chấm, SSE, `DailyCap`, replay cache | Đã xây |
| [design/frontend-architecture.md](design/frontend-architecture.md) | Module frontend, luồng dữ liệu, ngân sách; §8 luật trực quan hoá và CSP đã đo trên site thật | Đang dùng; §8 chốt 2026-10-08 |
| [design/art-direction.md](design/art-direction.md), [campus-scene-v0.3.md](design/campus-scene-v0.3.md) | Art bible và cảnh campus | Đang dùng |
| [deploy.md](deploy.md) | Vercel (frontend) và Render (API), gói miễn phí, CI/CD | Đang dùng |
| [adr/0001-frontend-stack.md](adr/0001-frontend-stack.md) | Vite, React 19, React Router 8 (`ssr: false`), react-three-fiber, Zustand, React Flow | Đã chấp nhận |
| [adr/0002-theme-packs.md](adr/0002-theme-packs.md) | Theme pack chỉ là dữ liệu; tách thương hiệu khỏi core code | Đã chấp nhận |
| [adr/0003-backend-stack.md](adr/0003-backend-stack.md) | FastAPI, PostgreSQL/pgvector, Redis, LangGraph, Langfuse, SSE, Claude | Đã chấp nhận; engine v0.2 dùng Gemini, cần ADR mới thay thế |

## Nội dung và lớp học

| Tài liệu | Nội dung | Trạng thái |
|---|---|---|
| [content/scenarios/overview.md](content/scenarios/overview.md) | Mục lục kịch bản và luật dùng chung cho mọi kịch bản | v0.1, sửa 2026-10-08 |
| [content/scenarios/grading-room.md](content/scenarios/grading-room.md), [intake-gate.md](content/scenarios/intake-gate.md), [rush-hour.md](content/scenarios/rush-hour.md) | Kịch bản mới: Phòng chấm (khu 4), Cổng nạp liệu, Giờ cao điểm | Kịch bản 2026-10-08, chưa xây |
| [content/course-coverage.md](content/course-coverage.md) | Bản đồ phủ 15 ngày học; cập nhật 2026 cho slide đã cũ (không sửa slide) | v0.1 |
| [content/lesson-plan-library.md](content/lesson-plan-library.md) | Giáo án 45 phút cho Thư viện L1; yêu cầu chế độ máy chiếu | v0.1, cần giảng viên đọc thử |
| [content/corpus/README.md](content/corpus/README.md), `content/golden/` | Kho quy chế hư cấu và bộ câu hỏi vàng | Đang dùng |

## Quy ước

- Viết bằng tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh.
- Đặc tả đặt tên theo dạng `specs/YYYY-MM-DD-<chủ-đề>.md`.
- ADR đánh số tăng dần, mỗi ADR có bốn phần: Bối cảnh, Quyết định, Hệ quả, Phương án đã loại. Muốn đổi một quyết định đã chấp nhận thì viết ADR mới thay thế, không sửa ADR cũ.
- Tài liệu trong `design/` chép nguyên văn từ bản thiết kế. Ghi chú trạng thái nằm ở đầu file; sửa về sau ghi ngày ("Sửa 2026-10-08") và giữ chữ cũ bằng gạch ngang khi cần.
- Quyết định mới ghi kèm mã trong lộ trình (Q, X, N, T, D) để lần ngược được.
- Tên thương hiệu chỉ nằm trong theme pack, không nằm trong tài liệu này (ADR 0002).
- Không sửa slide của khoá học. Thông tin slide đã cũ được ghi ở [bản đồ phủ §3](content/course-coverage.md#3-cập-nhật-2026-không-sửa-slide) và báo giảng viên qua giáo án.
