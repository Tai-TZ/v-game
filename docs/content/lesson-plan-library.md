> **Trạng thái:** v0.1 (2026-10-08, [roadmap-v0.4](../design/roadmap-v0.4.md) N10). Cần một giảng viên đọc thử trước buổi pilot.
> **Cần từ đợt B** ([roadmap-v0.4 §5](../design/roadmap-v0.4.md#5-kế-hoạch-đợt-b-nâng-cấp-bàn-thợ)): phiếu đoán và menu lý do (B1), link chuyển máy (B3), lượt đã ghi của cấu hình khởi đầu với nút "Mở kết quả" (B5), chế độ máy chiếu và quỹ hiển thị (B7). **Chưa có thì:** đoán bằng giơ tay hoặc phiếu giấy (A, B, C và một dòng lý do); giảng viên chạy lượt thật của cấu hình khởi đầu trên máy chiếu thay cho lượt đã ghi; dùng zoom 150 % của trình duyệt thay chế độ máy chiếu; chưa có sổ quỹ (B7) thì quỹ 13 lời gọi không được máy nào giữ, nên giảng viên giữ trần trên bảng xoay: mỗi cặp một lượt cho mỗi máy đã ngồi, tức tối đa hai lượt mỗi buổi (mục xoay lượt chạy).
> **Ghép với khoá học:** Ngày 8 (RAG pipeline), ngay sau slide 27/46 "Grounding & Abstention", thay cho 45 phút đầu của lab. Ôn Ngày 7 (embedding, vector store) không bắt buộc.
> **Liên quan:** [Thư viện L1](scenarios/library-l1-grounded-citation.md) · [Dạy lại và bài 60 giây](scenarios/teach-back.md) · [Quỹ chạy thật](scenarios/daily-shift.md#3-quỹ-chạy-thật-theo-ngày) · [Bản đồ phủ khoá học](course-coverage.md)

# Giáo án 45 phút: Thư viện L1 "Thôi bịa điều luật"

**Sau buổi, học viên:**
1. giải thích được vì sao model không có tài liệu sẽ tự lấp chỗ trống thay vì nói "không biết";
2. lắp truy xuất, chọn top_k, bật trích dẫn, viết dặn dò từ chối, và đọc bằng chứng từ trace để biết sửa chỗ nào;
3. coi "không có" là một câu trả lời đúng, đo được trên bộ câu cố định.

**Chuẩn bị (10 phút trước buổi):**
- Mở trang chủ 5–10 phút trước giờ học để đánh thức API (Render ngủ sau 15 phút không có truy cập, thức dậy mất khoảng một phút).
- Mở Thư viện L1 trên máy chiếu với `?chieu=1`.
- Xếp cặp trước, không ghép ngẫu nhiên: một người quen code với một người ít quen hơn. Một cặp một máy: ngồi máy của một người và dùng quỹ của người đó (13 lời gọi mỗi ngày). Đổi máy đúng một lần, lúc đổi vai, bằng link chuyển máy (B3), để cấu hình và tiến độ gợi ý đi theo; chưa có B3 thì ngồi một máy cả buổi ([ca trực §3.1](scenarios/daily-shift.md#31-luật)). Máy chiếu có quỹ riêng 40 lời gọi.
- Chuẩn bị bảng xoay lượt chạy (mục dưới): số cặp viết sẵn trên bảng.
- Đọc trước [bản đồ phủ §3](course-coverage.md#3-cập-nhật-2026-không-sửa-slide): slide Ngày 8 của chính buổi này (30/46, 39/46) khuyên temperature 0 (sửa 2026-10-08).

| Phút | Hoạt động | Giảng viên | Học viên |
|---|---|---|---|
| 0–5 | **Đoán cả lớp** | Chiếu câu của Minh và cấu hình khởi đầu (chưa có Vòm Sao). Hỏi: "Trợ lý sẽ (A) trả lời đúng quy chế, (B) bịa ra một điều khoản, hay (C) nói không biết?" Đếm tay, rồi bấm "Mở kết quả" trên lượt đã ghi | Giơ tay A, B hoặc C; nói một câu lý do với người bên cạnh |
| 5–30 | **Chơi theo cặp** | Đi một vòng; không đưa đáp án; hỏi "câu nào trượt, bằng chứng nằm ở đâu?". Ghi lại 2–3 lời giải cùng đạt nhưng khác nhau đúng một chỗ, để dùng ở debrief | Người cầm chuột chỉnh đồ chơi; người kia đặt phiếu đoán và chọn lý do trước mỗi lần **Mở ca**. Chỉ bấm **Mở ca** khi tới lượt trên bảng xoay. Đổi vai khi đạt sao 1 hoặc ở phút 17; chỉ đổi máy vào lúc đổi vai |
| 30–45 | **Debrief** | Chiếu các lời giải đã ghi (ẩn danh) cạnh nhau, hỏi ba câu dưới đây, nối về slide, rồi cho làm bài 60 giây | Trả lời; làm bài 60 giây một mình ([teach-back §5](scenarios/teach-back.md)) |

**Xoay lượt chạy (bắt buộc ở lớp trên 5 cặp).** Engine chạy một run mỗi lúc (`MAX_CONCURRENT_RUNS` = 1): cặp thứ hai bấm cùng lúc nhận 429 "Đang có nhiều lượt chạy, bạn thử lại sau ít phút." Model chính chỉ nhận 15 lời gọi mỗi phút.
- **Một lượt trên bảng** (sửa 2026-10-08, rà soát vòng 3) là lượt mẫu (Thử 3 câu mẫu, 3 lời gọi) rồi, nếu cả 3 câu mẫu đạt, run chấm sao ngay sau đó trong cùng lượt (7 lời gọi, vì 3 câu mẫu đã là kết quả đã lưu); mẫu trượt thì lượt dừng ở đó. Chưa có lượt mẫu (B5) thì một lượt là một run chấm sao (10). Một lượt tốn tối đa 10 lời gọi, nên cả lớp chạy được khoảng một lượt mỗi phút: 25 phút là 20–25 lượt, tức 1–2 lượt mỗi cặp ở lớp pilot 15 cặp (chờ đo ở B0). Một cặp ngồi một máy có 13 lời gọi: đủ một lượt trọn và một lượt mẫu nữa; đổi máy lúc đổi vai thì thêm 13.
- Cặp sẵn sàng thì ghi số cặp lên bảng; giảng viên gọi lần lượt, mỗi lần một cặp bấm **Mở ca**, mỗi cặp tối đa một lượt mỗi vòng. Chưa có sổ quỹ (B7) thì giảng viên giữ thêm trần: mỗi cặp một lượt cho mỗi máy đã ngồi, tức hai lượt mỗi buổi nếu đổi máy lúc đổi vai, một lượt nếu chưa có link chuyển máy (B3).
- Trong lúc chờ: xem trước miễn phí, đặt phiếu đoán, đọc trace của lượt trước. Thời gian chờ chính là lúc đoán.
- **Lớp pilot 15 cặp xoay lượt mặc định** (sửa 2026-10-08, X27). Chỉ chuyển sang **chạy chung** khi số đo cho thấy xoay không kịp, không theo sĩ số: trước buổi, nếu số run L1 mỗi phút đo ở B0 nhân 25 nhỏ hơn số cặp; trong buổi, nếu 429 lặp lại ở ba lượt liền (như X27; API ngủ thì chạy chung cũng không chữa được, dùng Phương án B). Run chạy chung chạy trên máy của cặp được chọn và trừ quỹ của cặp đó; màn hình máy ấy được chiếu lên (cắm cáp hoặc chia sẻ màn hình), cả lớp đoán trước; các cặp còn lại chỉnh trên xem trước và lượt đã ghi. Quỹ máy chiếu (40) chỉ đủ khoảng 4 run L1, nên chỉ dùng cho phần đoán cả lớp và Phương án B.
- Gặp 429, API ngủ hoặc cạn quỹ: dùng lượt đã ghi (Phương án B).
- **Hoàn lượt ở lớp phụ thuộc thứ tự gọi** (đánh đổi đã ghi, sửa 2026-10-08, chốt tạm). Quỹ hoàn chung của lớp chỉ đủ khoảng 5 lần mỗi ngày, nên cặp được gọi sớm trên bảng có nhiều cơ hội được hoàn hơn. Trong buổi, lời hoàn không đổi số lượt của cặp; nó chỉ để lại quỹ cho ca trực ngoài giờ. Nếu cặp hỏi vì sao không được hoàn, nói đúng lý do đó. Ghi giờ quỹ hoàn cạn vào phần đo của buổi ([ca trực §3.1](scenarios/daily-shift.md#31-luật)).

**Khi nào một cặp cần giúp:** trượt thật 2 lần ở cùng một sao, hoặc chọn sai lý do 2 lần. Cho các cặp giơ tay khi gặp một trong hai mốc đó (bảng lớp tự động là việc sau, T2). Câu hỏi gợi mở, không đưa đáp án: "Mở thùng của câu trượt. Đoạn đúng có nằm trong đó không?"

**Ba câu hỏi debrief:**
1. "Hai lời giải này cùng đạt sao 1 mà tốn token chênh nhau nhiều. Khác nhau ở đâu?" (Móc kéo, tức top_k.)
2. "Ở câu bẫy về một điều không có, cái gì làm trợ lý chịu nói 'không có'?" (có tài liệu trong thùng, cộng thẻ dặn từ chối.)
3. "Trong dự án của bạn, 'Điều 47 ma' sẽ là câu trả lời nào?" (chuyển sang Phòng ý tưởng.) Không đọc to câu hỏi của ca bẫy: câu hỏi ẩn và câu bẫy không bao giờ được lộ, kể cả trong debrief.

**Nối về slide:** Ngày 8, slide 27/46 (grounding và abstention) và 36/46 (vibe check là không đủ: phải đo trên bộ câu cố định); Ngày 7, slide 54/60 (khi nào không cần RAG).

**Cập nhật 2026, nói như một cập nhật chứ không phải sửa bài:** slide Ngày 1 và Ngày 14 khuyên đặt temperature 0 cho tác vụ cần ổn định. **Chính buổi này cũng gặp** (sửa 2026-10-08): Ngày 8 slide 30/46 ("Generation Failure Patterns", ô "Bỏ qua constraints") và slide 39/46 ("Faithfulness") ghi "Giảm temperature = 0" như một cách sửa, chỉ vài slide sau chỗ game ghép vào. Các cách sửa khác trên hai slide đó vẫn đúng; ở L1, quên trích dẫn được chữa bằng tem và thẻ dặn trích nguồn, không bằng temperature. Với Gemini 3, Google khuyên giữ temperature mặc định, và temperature 0 cũng không làm output tất định. Game này không đặt temperature; độ ổn định đến từ việc đo nhiều lần và lưu kết quả.

**Đo gì:** độ chính xác của phiếu đoán (game tự ghi); bài 60 giây; thời gian chờ trên bảng xoay. Nếu đo trước/sau thì theo `library-assessment.json` (`pre_post.how_to_use`): một dạng trước buổi, dạng kia sau 2–4 tuần, đổi thứ tự A/B ở một nửa lớp.

**Phương án B:** API ngủ, quá tải (429) hoặc cặp cạn quỹ thì dùng **lượt đã ghi** và phần xem trước miễn phí; giảng viên chạy lượt thật trên máy chiếu bằng quỹ của máy chiếu cho cả lớp xem. Trước khi có lượt đã ghi (B5): giảng viên chạy trên máy chiếu, các cặp đoán và đọc trace trên màn chung.

---

## Phụ lục: yêu cầu chế độ máy chiếu cho frontend

Gói B7 của đợt B ([roadmap-v0.4 §5](../design/roadmap-v0.4.md#5-kế-hoạch-đợt-b-nâng-cấp-bàn-thợ)). Theo [frontend architecture §8](../design/frontend-architecture.md#8-trực-quan-hoá-luật-chốt-2026-10-08).

| # | Yêu cầu |
|---|---|
| R1 | Bật bằng tham số URL `?chieu=1` trên trang khu và bàn thợ. Nút "Thoát chế độ chiếu" luôn hiện. Không nhớ sang lần mở sau |
| R2 | Chữ to: một lớp trên `<html>` đổi cỡ chữ gốc, mọi kích thước theo `rem`; ở 1280×720, chữ thân ≥ 24 px, tiêu đề ≥ 40 px. Chỉ dùng token ngữ nghĩa có sẵn; không thuộc tính `style` trong HTML (CSP `style-src 'self'`) |
| R3 | Một cột: ẩn cột bên (lịch sử, gợi ý, log) và mọi thông tin chỉ hiện khi rê chuột. Giữ câu hỏi mẫu, đồ chơi, lưới kết quả và thẻ bằng chứng chính |
| R4 | Đoán bằng giơ tay: phiếu đoán hiện lựa chọn với chữ cái lớn A, B, C, không cần nhập. Kết quả chỉ lộ khi giảng viên bấm "Mở kết quả" (phím Space hoặc Enter); trong lúc chạy, lưới chỉ hiện "đã chấm", chưa kèm đạt hay trượt |
| R5 | Dùng quỹ máy chiếu riêng (40 lời gọi mỗi buổi), hiện số còn lại, giờ hồi và chữ "ước tính"; không trừ quỹ của cặp nào |
| R6 | API ngủ hoặc quá tải: hiện "Đang đánh thức máy chủ" kèm nút "Xem lượt đã ghi" (tem "Lượt chạy đã ghi") |
| R7 | Âm thanh tắt mặc định; không hoạt cảnh lặp; tôn trọng `prefers-reduced-motion` |
| R8 | Riêng tư: không hiện biệt danh, mã lớp hay dữ liệu của học viên. Như mọi chế độ: không bao giờ hiện câu hỏi của ca ẩn và ca bẫy |
| R9 | Máy chiếu làm nhạt màu: đo lại tương phản ở chế độ chiếu trên cả hai theme (≥ 3:1 cho chữ lớn và hình); mọi trạng thái vẫn có icon và chữ |
| R10 | Kiểm: e2e chụp `?chieu=1` ở 1280×720 và 1920×1080; axe sạch; không cuộn ngang; mọi điều khiển dùng được bằng bàn phím |
