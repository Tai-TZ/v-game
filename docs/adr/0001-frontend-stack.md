# ADR 0001: Frontend stack

- **Trạng thái:** Đã chấp nhận (chủ dự án duyệt trong Phần 2)
- **Ngày ghi:** 2026-10-07
- **Liên quan:** [Đặc tả tổng hợp](../specs/2026-10-07-v-game-design.md), [ADR 0002](0002-theme-packs.md), [ADR 0003](0003-backend-stack.md)

## Bối cảnh

- V-Game chạy trong trình duyệt, trên laptop của học viên, kể cả máy chỉ có GPU tích hợp.
- Người chơi đi trong một campus 3D nhẹ dạng diorama isometric và lắp agent từ khối.
- Agent chạy trên server. Client nhận kết quả qua SSE (ADR 0003), và lời gọi AI không được làm khựng hình.
- Cần một chế độ xem đồ thị dự phòng ("blueprint").
- Nhóm chỉ có chủ dự án và Claude, và cần deploy sớm.

## Quyết định

- **App:** Vite + React 19 + TypeScript, dạng SPA.
- **Routing:** React Router 8 ở framework mode, `ssr: false`. Riêng landing page được prerender.
- **3D:** react-three-fiber + drei.
- **State:** Zustand.
- **Xem dự phòng:** React Flow, dùng làm chế độ "blueprint".
- **Ngân sách hiệu năng:**
  - 60 FPS trên laptop dùng GPU tích hợp;
  - dưới 100 draw call;
  - lighting bake, instancing;
  - CI có test FPS;
  - lời gọi AI không bao giờ chặn một khung hình.

## Hệ quả

- Bản build là file tĩnh cộng landing page đã prerender. API là một service riêng (ADR 0003).
- Mọi xử lý mạng và SSE phải chạy bất đồng bộ, ngoài vòng render 3D.
- Nội dung 3D phải theo ngân sách draw call ngay từ đầu: mesh tĩnh gộp và bake, vật lặp lại dùng instancing. CI chặn khi FPS tụt.
- Theme pack nạp lười và không làm tăng bundle (ADR 0002).
- React Flow chỉ là chế độ phụ. Màn lắp agent chính phụ thuộc quyết định hướng gameplay đang chờ ("Xưởng Đồ Chơi Trực Ca").
- Phiên bản cụ thể ghim trong `frontend/package.json`; ADR này không lặp lại để tránh lệch.

## Phương án đã loại

Tài liệu nguồn không ghi lại phép so sánh với các stack frontend khác. Các lựa chọn bị loại rõ trong quyết định:
- **Render phía server cho các route game:** không dùng (`ssr: false`); chỉ landing page được prerender.
- **Ánh sáng động tính lúc chạy:** thay bằng lighting bake để giữ ngân sách 60 FPS.
- **Gọi AI đồng bộ trong vòng render:** bị cấm.

Đề xuất gameplay (chờ duyệt) loại thêm physics Rapier và postprocessing trên GPU tích hợp.
