# Bản sắc từng level: đổi thao tác và màn hình (v0.5, bản nháp)

> **Trạng thái:** nháp đề xuất, chưa duyệt. Phạm vi: ba level đã có nội dung của khu Thư viện (L1–L3). Chưa đụng tới khung bàn thợ chung, chưa đổi luật chấm sao, chưa đổi golden set.
> **Ràng buộc:** [gameplay-direction](gameplay-direction.md), [library.md](../content/scenarios/library.md) §2–§3 (đồ chơi dùng chung và ẩn dụ phai dần), [art-direction](art-direction.md) §1.3 và §7 (không vòng lặp idle).

## 1. Vấn đề

Ba level hiện đã khác nhau về việc phải làm (lắp, chỉnh, chẩn đoán), nhưng khi mở ra người chơi gặp cùng một bố cục: bàn thợ với các slot, bảng câu bên phải, ba phiếu đoán, cùng một cách chấm sao. Thao tác khác, màn hình gần như giống. Đề xuất này giữ khung và đổi **đối tượng người chơi chạm vào** và **màn hình chính** của từng level.

## 2. Ba bản sắc

| Level | Thao tác chính | Màn hình chính | Cảm giác |
|---|---|---|---|
| L1 · Thôi bịa điều luật | **Lắp** khối và **đóng tem** nguồn | Bảng Tin với áp phích; câu trả lời hiện dần, mỗi câu phải dán tem mã đoạn | Thợ ráp, kiểm chứng từng câu |
| L2 · Lược dao chunk | **Cắt** văn bản bằng lưỡi dao | Trang quy chế trải ra; người chơi kéo lưỡi dao xuống để cắt đoạn, dải đoạn là màn hình chính | Thợ cắt vải, nhìn đường cắt |
| L3 · Hỏi bằng số điều | **Điều tra** hồ sơ sự cố | Hồ sơ "Điều 47 khoản 2" và hàng người; bàn thợ chỉ mở sau phiếu đoán đầu tiên | Thám tử, đọc bằng chứng trước khi sửa |

## 3. Chi tiết từng level

### L1: lắp và đóng tem

- **Màn hình chính:** bảng trả lời của trợ lý nằm giữa. Mỗi câu có một ô tem trống. Người chơi kéo một đoạn từ "Kệ sách" hoặc từ kết quả truy xuất sang ô tem để gắn nguồn.
- **Bàn thợ:** vẫn là slot, nhưng chỉ có ba khối: Vòm Sao, Thùng, Bộ Óc. Lăng kính và Máy đóng tem được nhúng vào bảng trả lời thay vì nằm trên bàn.
- **Điểm khác:** ca "không có" là một ô tem đặc biệt, gắn vào câu nói "không có thông tin". Thiếu tem là lỗi nhìn thấy được ngay trên câu.
- **Tái dùng:** `CitationLedger`, `Stamps`, `ContextBin`.

### L2: cắt bằng lưỡi dao

- **Màn hình chính:** `Strip` chuyển thành trang quy chế đầy đủ. Lưỡi dao (`Blade`) kéo dọc để đặt vết cắt, số token của mỗi đoạn hiện ngay dưới.
- **Thay núm vặn:** `chunk_size`, `overlap_pct` và `strategy` không còn là ô chọn. Người chơi chọn **kiểu cắt** (cố định hoặc theo điều) bằng nút nam châm, còn kích thước và độ chồng lấp là hai nấc của lưỡi dao.
- **Điểm khác:** kính lọc hiệu lực (`only_in_force`) hiện thành dấu gạch ngang lên các khoản bản 2019. Người chơi thấy trước đoạn nào đã bị loại.
- **Tái dùng:** `Blade`, `Strip`, `vizData.articleStrip`.

### L3: điều tra hồ sơ

- **Màn hình chính:** hồ sơ sự cố gồm câu hỏi của Khang, đáp án đúng của cô Lan và hai cách tìm xếp cạnh nhau (`Compare`). Hành động đầu tiên là phiếu đoán: người chơi đoán vì sao Điều 47 không lên top, rồi mới mở bàn thợ.
- **Bàn thợ:** mở sau phiếu đoán đầu tiên. Ba khối Tủ ngăn kéo, Phễu và Kính lúp được đưa ra đúng lúc cần, không phải từ đầu.
- **Điểm khác:** `RankJourney` là màn hình chính khi chẩn đoán, không chỉ là chú thích.
- **Tái dùng:** `Compare`, `GuessSlip`, `RankJourney`, `Debrief`.

## 4. Những thứ không đổi

- Luật chấm sao (số ca, mục tiêu, ngân sách token) và golden set `docs/content/golden/*.json`.
- Khung dữ liệu level (`allowed_blocks`, `locked_nodes`, `param_limits`) và engine.
- Quỹ lời gọi AI và chẩn đoán cuối ca.

## 5. Kiểm thử cần có

- Với mỗi level, bảng test hiện có (`BenchView.test.tsx`, `Strip.test.tsx`, `GuessSlip.test.tsx`, `Compare.test.tsx`) phải tiếp tục đạt. Các test chỉ kiểm cấu trúc DOM có thể cần cập nhật có chủ đích.
- Một e2e mới cho mỗi level, đi đúng thao tác chính: L1 gắn tem, L2 đặt vết cắt, L3 làm phiếu đoán trước.
- `toys.a11y.test.tsx`: thao tác kéo phải có bản thay thế bằng bàn phím (nút tăng giảm vị trí lưỡi dao, nút gắn tem theo thứ tự).

## 6. Câu hỏi mở cho chủ dự án

1. L2 đổi núm vặn thành lưỡi dao có làm mất tính "đo được" của ba nấc chunk hay không? Cần xác nhận trước khi làm.
2. L3 giấu bàn thợ đến sau phiếu đoán có vượt quá quyết định "phiếu đoán trở lại ngay" (X4) không? Mình cho rằng không, vì phiếu đoán vẫn đứng trước bàn thợ.
3. Có giữ thứ tự Đoán → Chạy → Giải thích ở L1 không, hay L1 đi thẳng vào lắp khối như hiện nay?
