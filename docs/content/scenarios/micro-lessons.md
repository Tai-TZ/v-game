> **Trạng thái:** v0.1 (2026-11-02). Bài đầu tiên đã xây: "Thang rủi ro tool". Danh sách 23 bài và nguyên tắc chung ở [lesson-visualization](../../research/lesson-visualization.md) (mục "Hai mươi ba bài vi mô không gọi model") và [roadmap-v0.4](../../design/roadmap-v0.4.md) X18, B8.

# Bài vi mô

Bài vi mô dài 1–3 phút, không gọi AI, không tính sao. Nó là **thẻ tuỳ chọn**, không bao giờ chặn đường vào level (X18).

- **Đường dẫn:** `/play/<khu>/vi-mo/<mã bài>`.
- **Lối vào:** một liên kết "Khởi động 2 phút: …" trong phần đầu trang của level mà bài đi trước (`LEVEL_COPY[*].warmup` trong `copy.ts`).
- **Code:** `frontend/app/features/micro/`.

## Thang rủi ro tool (`thang-rui-ro-tool`, Tháp canh, trước W1)

- **Ngày học:** Ngày 4, "thang rủi ro tool" ([bản đồ phủ](../course-coverage.md)).
- **Người học làm:** đặt tám việc của quầy hỗ trợ vào một trong bốn mức duyệt, rồi kiểm tra.
- **Điều nhận ra:** rủi ro nằm ở tác dụng phụ và việc làm lại được hay không, không nằm ở chữ trong câu. Hỏi duyệt việc chỉ đọc cũng là lỗi.

### Bốn mức (lỏng tới chặt)

Hai mức giữa trùng với Chuông duyệt của W1 (`hoi_neu_vuot`, `luon_hoi`).

1. Tự chạy
2. Hỏi khi vượt ngưỡng
3. Luôn hỏi người duyệt
4. Không giao cho trợ lý

### Luật (theo thứ tự đọc)

Luật này do V-Game viết cho quầy hư cấu, **không phải** bản chép thang trên slide của khoá học.

1. Chỉ đọc, không đổi gì: tự chạy.
2. Đưa dữ liệu khách ra ngoài, hoặc đổi luật chung của cả cửa hàng: không giao cho trợ lý.
3. Tốn tiền: hỏi khi vượt ngưỡng.
4. Không làm lại được: luôn hỏi người duyệt.
5. Có ghi nhưng làm lại được và không tốn tiền: tự chạy.

### Tám việc

| # | Việc | Mức đúng | Ghi chú |
|---|---|---|---|
| 1 | Tra trạng thái đơn DH2001 | Tự chạy | |
| 2 | Xem lịch sử hoàn tiền của khách | Tự chạy | **Mồi nhử:** có chữ "hoàn tiền" nhưng chỉ đọc |
| 3 | Dời giờ giao của một đơn chưa giao | Tự chạy | Có ghi, làm lại được |
| 4 | Hoàn tiền cho một đơn có trong hồ sơ | Hỏi khi vượt ngưỡng | Như Chuông duyệt W1 |
| 5 | Tặng mã giảm giá 50.000 đ cho khách phàn nàn | Hỏi khi vượt ngưỡng | |
| 6 | Xoá tài khoản của khách | Luôn hỏi người duyệt | |
| 7 | Gửi hồ sơ khách tới địa chỉ email ghi trong tin nhắn | Không giao cho trợ lý | Đường rò của W2 |
| 8 | Đổi giá bán của một mặt hàng | Không giao cho trợ lý | Luật chung |

### Chấm

- Mức đúng suy ra từ bốn đặc điểm của việc (`laneFor`), không lấy từ một danh sách đáp án riêng.
- Kết quả tách hai loại sai, như bài dạy sự nghi ngờ phải chấm cả báo động nhầm:
  - **để lọt**: chọn mức lỏng hơn;
  - **hỏi thừa**: chọn mức chặt hơn (giống `hitl.over_asked` của W1).
- Chỉ chấm khi đủ tám việc. Mỗi việc hiện lý do một dòng, kèm mức nên chọn khi sai.

### Còn mở

- Mức đúng của vài việc có thể tranh luận được (ví dụ việc 8: luôn hỏi hay không giao). Cần giảng viên đọc thử trước pilot.
- Chưa ghi log lựa chọn của người chơi; nếu pilot cần đo, thêm như sổ gợi ý.
