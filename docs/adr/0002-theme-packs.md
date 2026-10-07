# ADR 0002: Theme packs

- **Trạng thái:** Đã chấp nhận (phương án C của chủ dự án)
- **Ngày ghi:** 2026-10-07
- **Liên quan:** [Đặc tả tổng hợp](../specs/2026-10-07-v-game-design.md), [ADR 0001](0001-frontend-stack.md)

## Bối cảnh

- Game cần một theme campus lấy cảm hứng từ một trường đại học có thật, nhưng chưa có phép dùng thương hiệu của trường.
- Game cũng phải chạy được với một theme trung tính, và core code không được gắn với thương hiệu nào.
- Theme không được làm hỏng ngân sách hiệu năng: 60 FPS, bundle không lớn thêm (ADR 0001).

## Quyết định

- Có hai theme pack:
  - `town`: trung tính;
  - theme campus lấy cảm hứng từ trường thật.
- Theme pack chỉ là dữ liệu: manifest, CSS và assets.
- Người chơi đổi theme bằng một nút. Theme được lazy-load nên bundle không lớn thêm.
- Tên thương hiệu chỉ nằm trong theme pack, không bao giờ nằm trong core code. CI kiểm tra điều này.
- NPC là người hư cấu.
- Theme campus dùng hình ảnh công khai trên web của trường và một bộ design token không chính thức, **chỉ cho prototype nội bộ**. Cần phép của chủ thương hiệu trước bất kỳ lần deploy công khai nào.

## Hệ quả

- Frontend lõi, backend và logic workflow không chứa chuỗi thương hiệu. Ngoại lệ duy nhất là chính bước kiểm tra tách thương hiệu trong CI. Tài liệu trong `docs/` cũng không ghi tên thương hiệu.
- Theme không chứa logic. Mọi thứ theme được thay phải đi qua manifest, CSS hoặc assets.
- Thêm theme mới không cần sửa core code.
- Mọi lần deploy công khai phải dùng `town`, hoặc phải có phép dùng thương hiệu trước.

## Phương án đã loại

- **Phương án A và B** cùng đợt với phương án C: nội dung không được lưu trong tài liệu nguồn.
- **Đưa tên hoặc hình ảnh thương hiệu vào core code:** bị loại, có CI chặn.
- **NPC dựa trên người thật:** bị loại; NPC là người hư cấu.
- **Gói sẵn mọi theme trong bundle chính:** bị loại; theme được lazy-load.
