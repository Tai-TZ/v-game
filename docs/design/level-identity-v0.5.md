# Bản sắc từng level: đổi thao tác và màn hình (v0.5)

> **Trạng thái:** đã làm phần trong mục 2 (2026-11-01). Chủ dự án duyệt hướng "đổi thao tác và màn hình, giữ khung bàn thợ chung" và giao việc chọn cách làm hợp lý nhất. Mục 3 ghi những đề xuất của bản nháp đã bỏ và lý do.
> **Phạm vi:** ba level đã có nội dung của khu Thư viện (L1–L3). Không đổi khung bàn thợ, luật chấm sao, golden set hay engine.
> **Ràng buộc:** [gameplay-direction](gameplay-direction.md), [library.md](../content/scenarios/library.md) §2–§3, [workbench-v0.1](workbench-v0.1.md) §2.1 (bàn thợ và nút Mở ca lên màn đầu ở 1280×800), [roadmap-v0.4](roadmap-v0.4.md) X4 (phiếu đoán cho bỏ qua), [art-direction](art-direction.md) §1.3.

## 1. Vấn đề

Ba level đã khác nhau về việc phải làm (lắp, chỉnh, chẩn đoán), nhưng khi mở ra người chơi gặp cùng một đầu trang và cùng một bố cục. Màn đầu của level này trông như màn đầu của level kia.

## 2. Đã làm

### 2.1 Hiện trường ở đầu mỗi level

Mỗi level mở bằng hiện vật của chính nó, lấy từ mục 3 "Hiện trường" của kịch bản. Ba hiện vật có ba hình dạng khác nhau:

| Level | Hiện vật | Hình |
|---|---|---|
| L1 · Thôi bịa điều luật | Áp phích trên Bảng Tin, in nguyên văn câu bịa (build brief §3) | Tờ giấy có mép băng dính, chữ đậm |
| L2 · Lược dao chunk | Đơn xin bảo lưu của Hà | Tờ đơn có dòng kẻ và dấu đỏ "QUÁ HẠN" |
| L3 · Hỏi bằng số điều | Tờ in "Điều 47 khoản 2" mà cả hàng người cầm | Chữ đơn cách như máy in ở quầy |

- Hiện trường thay chỗ khung lời cô Lan. Lời cô Lan và chuyện tối nay (ai, chuyện gì, bối cảnh) nằm trong mục mở rộng "Cô Lan kể lại chuyện tối nay".
- Lý do: ở 1280×800, đầu trang không còn chỗ. Thêm một khối riêng đẩy nút Mở ca của L3 xuống 1041 px (màn cao 800). Lời cô Lan nhắc lại mục tiêu mà cột phải đã liệt kê, nên đưa vào mục mở rộng mất ít nhất.
- Đã đo: với bố cục này, nút Mở ca ở đúng vị trí cũ trên cả ba level (L3 đáy nút 784 px). Ở L1 (810 px) và L2 (835 px), nút vốn đã nằm dưới mép màn từ trước, vì cột mục tiêu bên phải cao hơn. Hiện trường không làm việc này tệ hơn; sửa nó nằm ngoài phạm vi.
- Chỉ chữ tĩnh. Lời trợ lý trong lượt đã ghi thuộc về phần phát lại và tem của nó, không đặt ở đây.
- Code: `frontend/app/features/workbench/Scene.tsx`, nội dung ở `LEVEL_COPY[*].scene` trong `copy.ts`.

### 2.2 L2: Cỡ đoạn là lưỡi dao

- `chunk_size` không còn là hàng chip. Nó là thanh trượt bốn nấc (128, 256, 512, 1.024), có nhãn từng nấc và đánh dấu nấc đang chọn. Giá trị chỉ dừng ở một nấc level cho phép.
- Thanh trượt là `input type="range"` gốc: phím mũi tên, Home, End đều dùng được, và trình đọc màn hình đọc giá trị qua `aria-valuetext`.
- Dải đoạn ngay bên dưới đã vẽ lại theo nấc đang chọn từ trước, nên kéo lưỡi dao là thấy vết cắt đổi.
- Code: `BladeStops` trong `BenchView.tsx`.

## 3. Đề xuất của bản nháp đã bỏ

| Đề xuất | Lý do bỏ |
|---|---|
| L1: người chơi tự kéo đoạn vào ô tem của từng câu | Tem phải là bằng chứng từ trace của lượt chạy thật (`Stamps`, `CitationLedger` đã vẽ đúng điều đó). Cho người chơi tự dán tem là dựng một bức tranh không đến từ lượt chạy, trái nguyên tắc "bằng chứng từ trace" của roadmap v0.4. |
| L3: khoá bàn thợ đến sau phiếu đoán đầu tiên | Phiếu đoán "không bắt buộc" và "cho bỏ qua" (X4, chữ trên chính phiếu). Khoá bàn thợ sau phiếu biến nó thành bắt buộc. |
| L3: mở sẵn phiếu đoán | Phiếu được thu gọn để Mở ca lên màn đầu ở 1280×800 (§2.1). Mở sẵn sẽ đẩy Mở ca xuống. |
| L2: nam châm thay ô chọn kiểu cắt | Kiểu cắt chỉ có hai lựa chọn; hai chip đã là cách chọn rõ nhất. |

## 4. Kiểm thử

- `Scene.test.tsx`: mỗi level vẽ đúng loại hiện vật; ba level ra ba loại khác nhau; có tiêu đề "Hiện trường" cho trình đọc màn hình.
- `BenchView.test.tsx`: lưỡi dao có bốn nấc, không còn chip; kéo tới nấc 2 đặt `chunk_size` = 512; nấc đang chọn được đánh dấu.
- Đã thử phá code để chắc test bắt được lỗi: đổi `data-scene` thành một giá trị chung, bỏ nội dung tờ in, bỏ nhánh lưỡi dao, bỏ dấu nấc đang chọn. Lần nào cũng có test đỏ.
- e2e: bước chọn 512 ở `workbench.spec.ts` đi bằng bàn phím trên thanh trượt.

## 5. Còn mở

- Mục 2.1: ở L1 và L2, nút Mở ca vốn đã nằm dưới mép màn 1280×800 vì cột mục tiêu. Có thể rút gọn chữ mục tiêu hoặc đổi bố cục đầu trang.
- Hiện trường chưa có "cờ thế giới" (áp phích được gỡ khi đạt sao 1, đơn đổi thành "ĐÃ NHẬN"). Trang bàn thợ chưa biết số sao đã đạt khi dựng đầu trang.
