> **Trạng thái:** đề xuất v0.1 (2026-11-02), **chưa duyệt**. Mọi mục dưới đây là đề xuất, không phải quyết định; cần chủ dự án chọn trước khi vào lộ trình.
> **Yêu cầu gốc (chủ dự án, 2026-11-02):** nghiên cứu các cách học qua chơi game; sáng tạo màn chơi; cải thiện đồ họa; làm màn chơi tương tác hơn.
> **Nền:** [evidence-dossier](../research/evidence-dossier.md) (31 nguồn, đã đối chiếu DOI) đã trả lời phần lớn câu "game dạy thế nào"; tài liệu này không lặp lại nó. [course-coverage](../content/course-coverage.md) chỉ ra chỗ khoá học còn trống. [level-identity-v0.5](level-identity-v0.5.md) ghi cỗ máy và hiện trường đã làm. [art-direction](art-direction.md) giữ các luật hình ảnh.

# Màn mới và tương tác hơn: đề xuất v0.6

## 1. Kết luận ngắn

- **Hướng nghiên cứu mới chỉ thêm một ý có sức nặng: tương tác theo bậc.** ICAP (Chi & Wylie 2014) xếp việc người học làm thành bốn bậc, từ thụ động tới tương tác, và dự đoán kết quả tăng theo bậc. Điều này đổi cách hỏi từ "thêm gì cho vui" sang "mỗi cú chạm đang ở bậc nào". Hiện nay phần lớn thao tác của V-Game ở bậc *chủ động* (kéo núm, bấm); các bước *kiến tạo* (đoán, giải thích) đang là tuỳ chọn.
- **Màn mới nên lấp chỗ khoá học còn trống, không thêm màn cho đủ số.** Ngày 4 là lỗ lớn nhất ([course-coverage §1](../content/course-coverage.md)); Ngày 1 chỉ phủ một phần.
- **Đồ họa nên tăng lượng thông tin thật mà hình mang, không tăng trang trí.** Luật hiện có (SVG, không vòng lặp, token màu) giữ nguyên.
- **Giới hạn trung thực:** không nghiên cứu nào đo kết quả học của game dạy AI (dossier §5). Đề xuất dưới đây suy từ bằng chứng ở miền khác và phải đo ở pilot.

## 2. Nghiên cứu: phần bổ sung cho dossier

Ba nguồn mới. Cả ba chỉ xác nhận được **metadata qua Crossref (2026-11-02), chưa đọc abstract hay toàn văn**, nên theo quy ước của dossier §7 tôi không trích con số nào.

| Nguồn | DOI | Dùng để nói gì | Mức |
|---|---|---|---|
| Chi & Wylie (2014), *Educational Psychologist* | [10.1080/00461520.2014.965823](https://doi.org/10.1080/00461520.2014.965823) | Khung ICAP: bốn bậc tham gia (thụ động, chủ động, kiến tạo, tương tác) và dự đoán thứ bậc kết quả. Là khung thiết kế, không phải con số hiệu ứng | khung lý thuyết |
| Plass, Homer & Kinzer (2015), *Educational Psychologist* | [10.1080/00461520.2015.1122533](https://doi.org/10.1080/00461520.2015.1122533) | Cần nhìn game học tập qua bốn mặt cùng lúc: nhận thức, động lực, cảm xúc, xã hội. Một tóm tắt thứ cấp liệt kê các yếu tố thiết kế: cơ chế, hình ảnh, truyện, thưởng, nhạc, nội dung | khung lý thuyết |
| Rey, Beege, Nebel và cộng sự (2019), *Educational Psychology Review* | [10.1007/s10648-018-9456-4](https://doi.org/10.1007/s10648-018-9456-4) | Meta-analysis hiệu ứng chia đoạn (segmenting): trình bày theo từng đoạn nhỏ có lợi. Một bản tóm tắt tìm được ghi hiệu ứng nhỏ đến vừa; chưa đọc nguồn gốc | vừa, chưa xác minh số |

**Khoảng trống dossier đã nêu mà lần tìm này vẫn không lấp được:** hiệu ứng mới lạ (novelty). Kết quả tìm kiếm chỉ cho các đoạn trích thứ cấp, không tìm ra bài nào để trích; một vài báo cáo gợi ý hiệu ứng giảm sau khoảng 4 tuần nhưng tôi không xác minh được nguồn. Vì vậy: **không nói với giảng viên điều gì về novelty**, và để pilot kéo dài tối thiểu hai tuần như dossier §6 đã đề xuất.

### 2.1 ICAP đặt lên V-Game

| Bậc | Việc người chơi làm | Chỗ nó đang có | Khoảng trống |
|---|---|---|---|
| Thụ động | Đọc hiện trường, xem lượt đã ghi | Hiện trường, lượt đã ghi | |
| Chủ động | Kéo núm, bấm gắn món, theo một ca | Bàn thợ, cỗ máy, Scrub | Đã nhiều |
| Kiến tạo | Tự sinh ra thứ mới: đoán trước, giải thích vì sao, tự nêu giả thuyết | Phiếu đoán, menu "Vì sao câu #N sai?" (cả hai tuỳ chọn) | Chỉ chọn trong danh sách đóng; chưa có chỗ người chơi tự diễn đạt |
| Tương tác | Đối thoại làm thay đổi cả hai bên | Teach-back với NPC ([teach-back.md](../content/scenarios/teach-back.md)); chơi theo cặp | NPC chưa hỏi vặn; dossier §4.3 cảnh báo NPC chỉ nghe thì lợi ích thấp |

Hàm ý: việc đáng làm nhất không phải đồ chơi mới mà là **kéo thao tác từ bậc chủ động lên bậc kiến tạo mà không thêm lời gọi AI**. Các đề xuất ở mục 3 và 4 theo hướng đó.

## 3. Màn và chế độ đề xuất

Chọn theo hai tiêu chí: lấp chỗ trống của khoá học, và tốn ít lời gọi AI (quỹ P = 13 mỗi ngày, [ca trực §3.1](../content/scenarios/daily-shift.md)). Chưa có màn nào trong số này được viết thành kịch bản.

### 3.1 Chế độ "Hai bàn song song" (mọi level)

- **Ý:** hai bàn thợ cạnh nhau, khác nhau **đúng một thứ**. Người chơi đoán bàn nào hơn và vì sao trước khi xem. Sau đó chạy cả hai.
- **Vì sao:** `diffGraphs` đã đếm "một thay đổi" cho nhãn nhân quả thật (đang vá ở việc 3 của W1). Chế độ này biến nó thành thao tác: đoán là kiến tạo; xem hai kết quả khác nhau một biến là bằng chứng nhân quả sạch nhất bàn thợ có thể đưa.
- **Lời gọi AI:** ít. Một bàn thường là cấu hình đã chạy, nên lấy từ bộ nhớ phát lại. Bàn còn lại tốn một lượt.
- **Bằng chứng:** phiếu đoán trước (Kornell 2009, Richland 2009) và khám phá có giàn giáo (Alfieri 2011), dossier §2. Cả hai là vừa; chưa ai đo cho kỹ năng thiết kế.
- **Rủi ro:** người chơi đoán bừa để xem đáp án (kiểu gaming, Baker 2004). Chấm đoán theo mức chắc (đã có N19) và không thưởng sao cho việc đoán.

### 3.2 "Thợ viết lời dặn" (Ngày 4, lỗ lớn nhất)

- **Ý:** người chơi giữ tối đa ba phiên bản bộ thẻ Lăng kính trên một kệ, chạy từng phiên bản trên 5 ca thấy được, rồi **một lần duy nhất** chạy ca giữ lại (held-out) cho phiên bản đã chọn. Bảng hiện điểm ca thấy được và điểm ca giữ lại cạnh nhau cho từng phiên bản.
- **Bài học:** vá một lời dặn cho vừa các ca đang thấy chưa phải là cải thiện. Khớp với slide Ngày 4 về quản lý phiên bản prompt với tập giữ lại.
- **Điều kiện để bài có nghĩa:** chỉ có ý nghĩa nếu ít nhất một cấu hình khởi đầu **thật sự** tốt ở ca thấy được và tệ ở ca giữ lại. Phải qua cổng hiệu chỉnh nhiều lần chạy như W1 (watchtower.md §3.3); nếu không cắn thì hạ ca xuống `info`.
- **Lời gọi AI:** 5 ca mỗi lần chạy thử, ba phiên bản là 15, cộng ca giữ lại. Vượt P; cần giảm số ca thấy được hoặc dùng lượt đã ghi cho phiên bản khởi đầu.
- **Bằng chứng:** thử trước rồi mới dạy (Sinha & Kapur 2021, vừa) cần bước chốt; bảng điểm cạnh nhau chính là bước chốt.

### 3.3 "Hoá đơn 1.000 khách" (Ngày 1, 0 lời gọi AI)

- **Ý:** người chơi kéo độ dài câu hỏi, độ dài câu trả lời và số khách; xem hoá đơn tháng tăng. Trước khi xem, đoán con số. Đếm token bằng `count_tokens` tất định, không gọi AI.
- **Bài học:** token tiếng Việt tốn hơn; output đắt hơn input; chi phí nhân với quy mô. Đã được liệt kê ở bản đồ phủ như vi mô; đề xuất này đẩy nó thành màn chơi được.
- **Hình:** chồng xu SVG theo số liệu thật (gameplay-direction: xu bạc cho input, xu vàng cho output), không cần cảnh 3D.
- **Rủi ro thấp:** không phụ thuộc model, nên không cần cổng hiệu chỉnh.

### 3.4 "Hỏi lại hay đoán?" (Ngày 4, đã có mã T25)

- **Ý:** ca thiếu thông tin; trợ lý nên hỏi lại hay trả lời luôn. Người chơi đặt luật và thấy khách bị hỏi thừa so với bị trả lời sai.
- **Ghi chú:** đã nằm trong bản đồ phủ. Tôi đề xuất nó đi **cùng** 3.2 như hai nửa của Ngày 4, không phải thêm một hướng mới.

### 3.5 "Máy hỏng sẵn" (chế độ ôn, mọi khu)

- **Ý:** người chơi nhận một cấu hình của người khác với ba lỗi cài sẵn và phải tìm, sửa. Không có hiện trường kể trước lỗi nằm ở đâu.
- **Vì sao:** là cách đưa thất bại hữu ích (Sinha & Kapur 2021) vào mà không cần người chơi tự làm hỏng trước. Cũng có thể dùng làm bài ôn cách quãng (Cepeda 2006) cho cấu hình của tuần trước.
- **Lời gọi AI:** như một lượt thường. Lỗi cài sẵn lấy từ `naive_graphs` đã có trong các file level, nên không cần nội dung mới.

**Không đề xuất thêm** vì đã có kịch bản: Phòng chấm, Cổng nạp liệu, Giờ cao điểm, Phòng ý tưởng. Nếu muốn ưu tiên, theo thứ tự lấp bản đồ phủ: Ngày 4 (3.2, 3.4) trước, rồi Ngày 13.

## 4. Đồ họa và tương tác

Luật giữ nguyên: SVG ở bàn thợ (three.js chỉ ở chunk `/play`), không vòng lặp nhàn rỗi ([art-direction §1.2.6](art-direction.md)), chỉ token màu của `app.css`, không emoji, không `style` inline (CSP), tôn trọng `prefers-reduced-motion`, 375px và 1280px không tràn ngang.

| # | Đề xuất | Thông tin thật mà hình mang | Tốn gì |
|---|---|---|---|
| G1 | **Hạt token chạy dọc băng chuyền**, mỗi hạt = 100 token, chạy một lần theo bước | `tokens.in` / `tokens.out` của từng step | SVG, vài chục phần tử; không vòng lặp |
| G2 | **Xem trước tức thì cho mọi núm số**: kéo ngưỡng, thấy ca nào đổi trạng thái ngay | Chó gác đã có (điểm tính sẵn); mở rộng cho `top_k`, cỡ đoạn | Tính tất định ở client, 0 lời gọi |
| G3 | **Bấm hạt hay đoạn để nhảy tới nguồn** trong trace | Chuỗi nhân quả từ đầu ra về đầu vào | Liên kết trong dữ liệu đã có |
| G4 | **Thanh ngân sách đổ đầy khi máy chạy**, có vạch sao 2 | Token tích luỹ so với `token_budget` | Có sẵn `Bar`; thêm vạch |
| G5 | **Kéo thả cụm từ vào lưới** (W1), bấm vẫn là lối chính | Số cụm = số thẻ treo | Kéo là lối tắt cho chuột (đã là quy ước của Lăng kính) |
| G6 | **Âm thanh tuỳ chọn, tắt mặc định**: vài tiếng (chuông, dấu) | Chỉ xác nhận sự kiện đã có hình | Plass 2015 liệt kê nhạc là yếu tố thiết kế nhưng chưa có bằng chứng cho riêng nó ở đây; làm sau cùng |
| G7 | **Cờ thế giới tổng hợp thành bảng tháp** | Các sao đạt được trên campus | Đã có Báo Tường trong đặc tả; chưa xây |

**Chưa kiểm:** tôi chưa mở bản chạy thật để xem hiện trạng hình ảnh ở 375px và 1280px khi viết bảng này. Trước khi làm G1–G7, chụp màn hiện tại ở hai kích thước và liệt kê chỗ đang rối; đề xuất có thể đổi sau đó.

## 5. Thứ tự và câu hỏi cho chủ dự án

Thứ tự đề xuất, vì rủi ro tăng dần:

1. G2, G4: nhỏ, 0 lời gọi, dùng dữ liệu có sẵn.
2. 3.3 Hoá đơn 1.000 khách: 0 lời gọi, không cần hiệu chỉnh model.
3. 3.1 Hai bàn song song: dùng lại `diffGraphs` và phát lại.
4. 3.2 và 3.4: lấp Ngày 4, cần cổng hiệu chỉnh với Gemini thật.
5. G1, G3, G5, G6, G7 và 3.5.

Cần bạn quyết:

1. Bạn muốn làm theo thứ tự trên, hay ưu tiên đồ họa (G) trước màn mới (3.x)?
2. W1 chưa phát hành (việc 3 và 4 của bàn giao). Làm các mục này **trước** hay **sau** khi W1 ra mắt?
3. Bạn có muốn tôi chụp và đánh giá hiện trạng hình ảnh (mục 4, "Chưa kiểm") trước khi chọn G không?
