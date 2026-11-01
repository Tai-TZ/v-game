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

### 2.3 Cỗ máy isometric ở đầu bàn thợ (2026-11-01, vòng 2)

Phản hồi của chủ dự án: màn chơi còn quá nhiều chữ, "khác gì một blog"; muốn chơi qua hình, tham chiếu là các hình isometric bấm được kiểu "Colorfigures" (máy pha cà phê có nút "Pull a shot", "Steam the milk"...).

- **Cỗ máy:** trợ lý vẽ thành một cỗ máy isometric trên đế sa bàn (art bible §1.1), mỗi món một khối trên băng chuyền từ Chuông quầy tới Bảng trả lời. Mỗi khối mặc đúng thông số của nó: vết cắt đỏ của Lược dao theo `chunk_size`, móc dưới Vòm Sao theo `top_k`, sách 2019 màu vàng trên kệ L2, tem trên nắp Thùng khi `cite_ids`, ba khe thẻ cạnh Lăng kính, dấu ✓/✗ trên Bảng trả lời theo câu đang theo dõi.
- **Ổ trống:** món tuỳ chọn chưa gắn là ổ đỏ nét đứt, và băng chuyền sau ổ tìm kiếm trống bị đứt (bài của L1). Bấm ổ trống là gắn món; bấm món đã gắn là nhảy tới khe của nó.
- **Các bước (beat):** hàng nút "Khách rung chuông → Cắt kho → Kéo đoạn → … → Chấm câu trả lời". Mỗi bước nhấc món đó lên một lần (không lặp) và đọc một dòng lấy từ fact của lượt chạy cho câu đang theo dõi, hoặc từ thông số bàn thợ khi chưa chạy. Câu ẩn và câu bẫy không bao giờ lộ câu hỏi, câu trả lời hay hạng đoạn đáp án.
- **Nhãn / Nhìn xuyên:** bật tắt tên đồ chơi, và hiện tên khối thật (`vector_search`...) theo tinh thần "ẩn dụ phai dần" (library §2).
- **SVG, không three.js:** quy định "three.js chỉ ở chunk `/play`" và ngân sách bàn thợ 120 kB gzip nhỏ hơn riêng three.js. Hình 2.5D bằng SVG nặng thêm khoảng 3 kB, phím và trình đọc màn hình dùng được.
- **Bớt chữ ở các khe:** thông số giữ cố định của mỗi món gom vào một dòng thu gọn "N thông số giữ cố định ở màn này".
- **Một vùng live:** dòng đọc của bước không phải `aria-live` (trang giữ đúng một vùng, Q5); nút bước trỏ tới nó bằng `aria-describedby`.

### 2.4 Một món mở một lúc

- Dưới cỗ máy, chỉ khe của món đang chọn mở đầy đủ (núm, dải đoạn, vòm sao, thùng, sổ trích dẫn). Mọi món khác thu thành một dòng: tên, trạng thái, nút "Mở", công tắc "Gắn …" nếu món chưa có trên bàn, chấm điểm của Bảng trả lời và mọi lỗi kiểm tra (lỗi không bao giờ bị giấu sau khe đóng).
- Món mở ban đầu là món đầu tiên người chơi được chỉnh theo dòng chảy: L1 là ổ Vòm Sao trống, L2 và L3 là Lược dao.
- Bấm một món trên cỗ máy thì mở khe đó và đưa tay tới núm đầu tiên. Gắn một món (từ ổ trống hay công tắc) thì mở luôn khe của nó.
- Gợi ý và chẩn đoán vẫn trỏ được tới núm: món được trỏ tới mở ngay trong cùng lượt render, trước khi trang đặt focus.
- Đo ở L1, 1280×800: chữ trên bàn thợ từ khoảng 600 xuống 220 từ, chiều cao từ 1588 px xuống 1216 px.

### 2.5 Lăng kính là bộ thẻ

- Ba ô chọn dài của Lăng kính được thay bằng ba khe hình thẻ và bộ thẻ dặn dò của level, chữ của mỗi thẻ in ngay trên thẻ.
- Bấm một thẻ: cắm vào khe trống đầu tiên; bấm lại: rút ra; bấm một khe: rút thẻ trong khe. Trên máy tính có thể kéo thẻ vào khe, kéo thẻ đã cắm sang khe khác là chuyển chỗ.
- Khi ba khe đã đầy, các thẻ còn lại khóa và có dòng nhắc "Ba khe đã đầy: bấm một khe để rút thẻ ra". L1 khởi đầu với hai thẻ sai (G4, G5) nên người chơi phải rút chúng ra trước, đúng bài học của level.
- Bấm là cách vào cho mọi người (chạm, bàn phím, trình đọc màn hình); kéo-thả chỉ là lối tắt cho chuột.

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
