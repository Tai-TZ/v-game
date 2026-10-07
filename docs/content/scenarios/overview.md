> **Trạng thái:** v0.1. Trang mục lục của thư mục kịch bản, cộng thiết kế "campus xuống cấp" để nhắc ôn (đặc tả §7), phần này chưa có ở file nào khác.
> **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D1–D7, §3, §4.

# Kịch bản V-Game: tổng quan

## 1. Các file

| File | Nội dung |
|---|---|
| [library.md](library.md) | Mạch khu Thư viện qua 3 level, bảng đồ chơi → khối, luật chung, **yêu cầu cho người viết nội dung** |
| [library-l1-grounded-citation.md](library-l1-grounded-citation.md) | L1 · Thôi bịa điều luật (kịch bản đầy đủ) |
| [library-l2-chunk-tuning.md](library-l2-chunk-tuning.md) | L2 · Lược dao chunk (kịch bản đầy đủ) |
| [library-l3-article-number-lookup.md](library-l3-article-number-lookup.md) | L3 · Hỏi bằng số điều, sự cố (kịch bản đầy đủ) |
| [other-levels-outline.md](other-levels-outline.md) | Phác thảo 3 level Chợ model và 3 level Tháp canh; các quyết định cần chủ dự án |
| [daily-shift.md](daily-shift.md) | Ca trực hằng ngày 5 phút: chọn sự cố (móc FSRS), giới hạn lượt, thẻ chia sẻ, 3 ca mẫu |
| [brainstorm-room.md](brainstorm-room.md) | Phòng ý tưởng: luồng, mẫu thẻ ý tưởng, 8 câu Socratic, nhận xét của giáo viên, 2 thẻ mẫu |
| [teach-back.md](teach-back.md) | Dạy lại cho Bống: khuôn nhập máy chấm được, rubric từng level, bài mẫu đã chấm, kiểm tra 60 giây |
| [npc-cast.md](npc-cast.md) | Dàn nhân vật hư cấu, giọng, luật lời thoại |

## 2. Một vòng học trọn vẹn ở Thư viện

**Mỗi level:**
1. Hiện trường (hậu quả trước, ≤ 30 giây).
2. Đoán.
3. Chạy thật.
4. Hậu quả, rồi truy vết.
5. Chọn lý do, rồi chẩn đoán và gợi ý.
6. Sửa.
7. Đạt sao.
8. Lật mặt sau và thẻ "Ngoài đời thật".
9. Kiểm tra 60 giây.
10. Dạy lại (tuỳ chọn).

**Sau L1:** Phòng ý tưởng mở cửa. Mỗi level Thư viện sau đó thêm câu hỏi vặn mới cho thẻ ý tưởng.

**Từ ngày hôm sau:**
- ca trực 5 phút, xen kẽ khái niệm, lịch theo FSRS;
- đồ vật trong khuôn viên phai dần khi khái niệm đến hạn ôn (mục 3).

**Học lần đầu và ôn dùng chung đồ chơi và tiêu chí chấm.** Khác nhau ở ba điểm:
- ôn dùng ca biến thể `lib-lN-rNN`;
- sự cố chỉ hỏng một chỗ;
- ôn không có sao.

## 3. Campus xuống cấp (nhắc ôn)

**Mục đích:** nhắc người chơi quay lại khái niệm sắp quên mà không cần thông báo đẩy hay chữ đỏ. Đây là "đến hạn ôn", **không phải hình phạt**:
- không khoá nội dung, không trừ sao;
- không bao giờ nói agent của người chơi đã hỏng.

**Gắn với thẻ FSRS** ([daily-shift.md](daily-shift.md) mục 2):
- Mỗi thẻ khái niệm có một đồ vật trong khuôn viên.
- Retrievability (R) của thẻ quyết định mức phai:

| Thẻ khái niệm | Đồ vật | Mức 1 (R < 0,8) | Mức 2 (R < 0,6) |
|---|---|---|---|
| `grounding.citation` | Bảng Tin trước Thư viện | một góc áp phích cũ bong ra | một tờ "Điều ?? ma" mờ mờ dán lại |
| `grounding.abstention` | Biển "Không có thì nói không có" trên quầy | biển nghiêng | biển úp mặt xuống |
| `chunk.boundary` | Lược dao treo ở cửa sổ phòng đọc | lược xỉn màu | một răng lược gãy |
| `retrieval.freshness` | Xe sách lưu trữ 2019 | xe nhích ra khỏi góc | xe chắn nửa lối vào kệ |
| `retrieval.hybrid` | Tủ ngăn kéo ở sảnh | một ngăn kẹt hé | hai ngăn kẹt hé |
| `retrieval.rerank_roi` | Kính lúp trên quầy | kính phủ bụi | kính bị úp |

**Luật:**
- Chỉ đồ vật của khái niệm **người chơi đã học** mới phai. Người chưa chơi Thư viện thấy Thư viện bình thường.
- Mỗi đồ vật phai có nhãn khi rê chuột hoặc chạm: "Đến hạn ôn: {tên khái niệm}. Có trong ca trực hôm nay." Nhãn này là bản chữ cho người dùng trình đọc màn hình. Danh sách "Đến hạn ôn" cũng có trong menu DOM của hub.
- Làm xong một sự cố của thẻ đó trong ca trực thì đồ vật trở lại bình thường. Có hoạt cảnh nhỏ (chú Bảy dựng lại biển, lau kính); tắt khi bật `prefers-reduced-motion`.
- **Luật trung thực:** phai là hình ảnh của lịch ôn, không phải kết quả chạy agent. Nó không dùng hình ảnh "hậu quả" (áp phích in câu trả lời thật, giấy vàng trong thùng) của level, để không lẫn với cờ thế giới đến từ event thật.
- **Hiệu năng:** mỗi mức phai chỉ đổi màu đỉnh hoặc bật/tắt một chi tiết trong mesh đã gộp. Không thêm draw call; áp ngân sách của brief §5.
- Giáo viên thấy bản đồ nhiệt "khái niệm đến hạn" của cả lớp (dashboard, ngoài v0.1).

**Ngoài v0.1:** hub v0.1 chưa có FSRS và chưa lưu tiến độ, nên chưa có xuống cấp. Art có thể chừa sẵn hai trạng thái cho các đồ vật trên nếu không tốn thêm draw call.

## 4. Các luật dùng chung cho mọi kịch bản

1. Chạy trước, giảng sau. Lần chạy thật đầu tiên đến sớm (L1: trước phút 3).
2. Câu hỏi của ca ẩn và ca bẫy không bao giờ hiện cho người chơi, kể cả sau run.
3. Gold (đoạn đáp án, hạng của nó) chỉ hiện sau `run.finished` (D4).
4. Không gợi ý gì trước khi chạy. Phần xem trước tất định chỉ cho dữ kiện không cần gold (Câu hỏi mở 3 của L1).
5. Gợi ý tăng dần thêm bằng chứng, không bao giờ hạ ngưỡng.
6. Sao 2 và sao 3 chỉ tính khi đã có sao 1. Mọi sao đạt được bằng đồ chơi đã mở ở level đó.
7. Mọi bẫy phụ thuộc model phải qua cổng hiệu chỉnh của Phần 3 §3.9. Bẫy không cắn thì hạ thành `info`.
8. Lời thoại: tối đa 2 câu mỗi lượt; không dùng ba từ gợi lớp học mà research §1.1 cấm trong UI.
