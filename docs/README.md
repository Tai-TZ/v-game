# Tài liệu V-Game

V-Game là game web giáo dục cho chương trình AI 20K. Người chơi lắp agent AI từ khối, rồi chạy agent thật trên test set của NPC. Bắt đầu đọc từ đặc tả tổng hợp.

| Tài liệu | Nội dung | Trạng thái |
|---|---|---|
| [specs/2026-10-07-v-game-design.md](specs/2026-10-07-v-game-design.md) | Đặc tả tổng hợp: mục tiêu, người dùng, lộ trình, vòng chơi, cơ chế học/ôn/brainstorm, kiến trúc, hiệu năng, bảo mật, theme packs, phạm vi, quyết định đang chờ | Đã duyệt phần lớn; có mục chờ quyết |
| [design/part-3-block-system.md](design/part-3-block-system.md) | Phần 3: hệ khối, validation, biên dịch LangGraph, sandbox, instrumentation; kèm vấn đề của agent phản biện | Thiết kế, chưa triển khai; phải sửa vấn đề trước khi code engine |
| [design/gameplay-direction.md](design/gameplay-direction.md) | Hướng gameplay "Xưởng Đồ Chơi Trực Ca" | Đề xuất, chờ chủ dự án duyệt |
| [adr/0001-frontend-stack.md](adr/0001-frontend-stack.md) | Vite, React 19, React Router 8 (`ssr: false`), react-three-fiber, Zustand, React Flow | Đã chấp nhận |
| [adr/0002-theme-packs.md](adr/0002-theme-packs.md) | Theme pack chỉ là dữ liệu; tách thương hiệu khỏi core code | Đã chấp nhận |
| [adr/0003-backend-stack.md](adr/0003-backend-stack.md) | FastAPI, PostgreSQL/pgvector, Redis, LangGraph, Langfuse, SSE, Claude | Đã chấp nhận |

## Quy ước

- Viết bằng tiếng Việt; thuật ngữ kỹ thuật giữ tiếng Anh.
- Đặc tả đặt tên theo dạng `specs/YYYY-MM-DD-<chủ-đề>.md`.
- ADR đánh số tăng dần, mỗi ADR có bốn phần: Bối cảnh, Quyết định, Hệ quả, Phương án đã loại. Muốn đổi một quyết định đã chấp nhận thì viết ADR mới thay thế, không sửa ADR cũ.
- Tài liệu trong `design/` chép nguyên văn từ bản thiết kế. Ghi chú trạng thái nằm ở đầu file.
- Tên thương hiệu chỉ nằm trong theme pack, không nằm trong tài liệu này (ADR 0002).
