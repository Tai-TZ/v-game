> **Trạng thái:** v0.2 (2026-11-04). Đã xây ba bài: "Thang rủi ro tool", rồi hai trong sáu bài B8 là "Ba loại dữ liệu" và "Tự tay trộn RRF" ([kế hoạch v0.7](../../design/upgrade-plan-v0.7.md) 4.5). Danh sách 23 bài và nguyên tắc chung ở [lesson-visualization](../../research/lesson-visualization.md) (mục "Hai mươi ba bài vi mô không gọi model") và [roadmap-v0.4](../../design/roadmap-v0.4.md) X18, B8.

# Bài vi mô

Bài vi mô dài 1–3 phút, không gọi AI, không tính sao. Nó là **thẻ tuỳ chọn**, không bao giờ chặn đường vào level (X18).

- **Đường dẫn:** `/play/<khu>/vi-mo/<mã bài>`. Mã bài không có trong registry, hoặc nằm dưới khu khác, thì trả "Không tìm thấy trang".
- **Lối vào:** một liên kết "Khởi động 2 phút: …" trong phần đầu trang của level mà bài đi trước, và một dòng "Khởi động 2 phút" ngay trên level đó ở trang khu. Cả hai đọc `warmupsBefore` của `registry.ts`.
- **Code:** `frontend/app/features/micro/`. `registry.ts` chỉ giữ metadata (mã, khu, level đi trước, tên), nên trang khu và phần đầu trang level không kéo nội dung bài nào vào chunk của chúng. `pages.ts` nạp trang của từng bài, mỗi bài một chunk riêng, chỉ route vi mô dùng; `scripts/check-bundle.mjs` kiểm điều này mỗi lần build.
- **B8 chưa xây:** ba bài của Chợ ("Mặt bàn có hạn", "Hoá đơn 1.000 khách", "Nhiệt độ 0 không phải công tắc ổn định") chờ khu Chợ; "Luật AI Việt Nam xếp hạng" chờ một bảng phân loại mức rủi ro của luật đã được kiểm chứng.

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

## Ba loại dữ liệu (`ba-loai-du-lieu`, Thư viện, trước L1)

- **Ngày học:** Ngày 7, "3 loại dữ liệu" ([bản đồ phủ](../course-coverage.md)).
- **Người học làm:** đặt chín thứ dữ liệu mà trợ lý ở quầy Thư viện cần vào một trong ba nơi, rồi kiểm tra.
- **Điều nhận ra:** không phải thứ gì cũng vào kho vector. Kho vector giỏi một việc: tìm văn bản dài theo nghĩa. Số đổi trong ngày và dòng tra theo mã thì hỏi tận nguồn; luật ngắn mà câu nào cũng cần thì chèn thẳng vào lời dặn.

### Ba nơi

Ba nơi ngang nhau, không phải một thang, nên cái sai được gọi theo nơi đã chọn nhầm (mục Chấm).

1. Tìm theo nghĩa trong kho vector
2. Tra cứu có cấu trúc (API hoặc SQL)
3. Chèn thẳng vào lời dặn

### Luật (theo thứ tự đọc)

Luật này do V-Game viết cho quầy hư cấu, **không phải** bản chép slide của khoá học.

1. Đổi trong ngày: tra cứu có cấu trúc, hỏi tận nguồn lúc cần. Bản chép vào kho hay vào lời dặn sẽ cũ.
2. Tra theo một mã chính xác: tra cứu có cấu trúc. Tìm theo nghĩa coi hai mã gần nhau gần như là một.
3. Ngắn, và câu nào cũng cần: chèn thẳng vào lời dặn.
4. Còn lại, văn bản dài hỏi bằng lời thường: tìm theo nghĩa trong kho vector.

### Chín thẻ

| # | Thẻ | Nơi đúng | Đặc điểm quyết định | Ghi chú |
|---|---|---|---|---|
| 1 | Toàn văn quy chế đào tạo, 84 điều, mà câu hỏi nào cũng cần tới | Kho vector | Câu nào cũng cần, nhưng dài | **Mồi nhử:** "câu hỏi nào cũng cần" chỉ về lời dặn |
| 2 | Số chỗ còn trống ở phòng tự học, cập nhật từng phút | Tra cứu | Đổi trong ngày | |
| 3 | Vai của trợ lý: xưng «mình», trả lời ngắn gọn, luôn ghi số điều đã dùng | Lời dặn | Ngắn, câu nào cũng cần | |
| 4 | Số tín chỉ đã tích lũy của từng sinh viên, mà các bạn hay hỏi bằng lời thường: «em đủ tín chỉ ra trường chưa?» | Tra cứu | Tra theo mã sinh viên | **Mồi nhử:** "hỏi bằng lời thường" chỉ về kho vector |
| 5 | Ba trăm câu hỏi đáp của phòng đào tạo, viết bằng lời thường | Kho vector | Văn bản dài, hỏi theo nghĩa | |
| 6 | Luật của quầy: không thấy trong quy chế thì nói «không có», không đoán | Lời dặn | Ngắn, câu nào cũng cần | Như thẻ G3 của Lăng kính ở L1 |
| 7 | Lịch thi kết thúc học phần của từng lớp, tra theo mã lớp học phần | Tra cứu | Tra theo mã lớp | |
| 8 | Hướng dẫn trình bày khóa luận tốt nghiệp, dài 40 trang | Kho vector | Dài, ít câu cần tới | |
| 9 | Bản quy chế đang áp dụng: bản 2024, thay bản 2019 từ ngày 15/8/2024 | Lời dặn | Ngắn, câu nào cũng cần | Chặn bẫy bản cũ của L2 |

### Chấm

- Nơi đúng suy ra từ bốn đặc điểm của thẻ (`placeFor`): đổi trong ngày, tra theo mã, ngắn, câu nào cũng cần. Không lấy từ một danh sách đáp án riêng.
- Cái sai được gọi theo nơi đã chọn nhầm, vì mỗi nơi chọn nhầm dạy một điều riêng:
  - **nhầm vào kho vector**: số đổi từng phút thì cũ, hai mã gần nhau thì lẫn, luật chung thì có câu không kéo lên được. Đây là ý chính của bài;
  - **nhồi vào lời dặn**: thứ dài thì câu nào cũng trả tiền cho nó, số liệu chép vào thì cũ;
  - **ép thành tra cứu**: văn bản viết bằng lời không có mã để tra, còn luật chung không nên chờ trợ lý nhớ gọi tool.
- Lời giải thích của một loại sai chỉ hiện khi người chơi mắc loại đó. Người chơi đi theo chữ của thẻ mồi nhử thì dòng lý do nói thêm "Mồi nhử".
- Chỉ chấm khi đủ chín thẻ. Mỗi thẻ hiện lý do một dòng, kèm nơi nên chọn khi sai.

### Còn mở

- Cần giảng viên đọc thử trước pilot. Thẻ 1 có thể tranh luận: model ngày nay có context đủ dài để nhét cả quy chế, và có hệ thống làm vậy kèm cache. Bài giữ lý do chi phí và độ liên quan.
- Luật đặt "đổi trong ngày" trước "ngắn, câu nào cũng cần". Một dữ kiện đổi theo ngày mà câu nào cũng cần, như ngày hôm nay, thường được chèn vào lời dặn lúc gửi; bài tránh loại thẻ này.
- Chưa ghi log lựa chọn của người chơi; nếu pilot cần đo, thêm như sổ gợi ý.

## Tự tay trộn RRF (`tu-tay-tron-rrf`, Thư viện, trước L3)

- **Ngày học:** Ngày 8, slide 16/46 "RRF vs Alpha weighting", k = 60 ([bản đồ phủ](../course-coverage.md)).
- **Đứng trước** L3 "Hỏi bằng số điều", màn mở ra Phễu.
- **Người học làm:** thả mười chip 1/(60 + hạng) từ hai danh sách vào tổng của từng đoạn, xếp sáu đoạn ra khỏi Phễu từ nặng tới nhẹ, rồi kiểm tra.
- **Điều nhận ra:** trộn theo hạng bỏ qua điểm thô, nên hai thang điểm khác nhau không lấn được nhau. Với k = 60, chip của hạng 1 và hạng 5 chênh nhau rất ít, nên được cả hai cách tìm thấy mới là điều quyết định.

### Câu hỏi và hai danh sách

Câu hỏi: «Theo Điều 47, muốn xem lại điểm giữa kỳ thì em nộp đơn cho ai?». Đáp án là Điều 47 khoản 2 (trưởng bộ môn, 05 ngày làm việc). Đây là câu kiểu "số điều lẫn lời thường" (vai `tra-so-kho` của L3), không phải câu chỉ có số như câu của Khang: với câu chỉ có số, Vòm Sao không đưa Điều 47 vào top 5 ([L3](library-l3-article-number-lookup.md) N1), nên đoạn đúng chỉ có một chip và bài sẽ dạy một chuyện khác.

Các đoạn lấy từ họ Điều 41, 47, 74 của L3. Điểm là **số minh hoạ soạn tay**, không phải số đo của engine; trang ghi rõ điều này.

| Hạng | Vòm Sao (cosine) | Tủ ngăn kéo (BM25) |
|---|---|---|
| 1 | Điều 41 khoản 2 · 0,82 | Điều 47 khoản 1 · 14,3 |
| 2 | Điều 47 khoản 2 · 0,81 | Điều 47 khoản 2 · 12,1 |
| 3 | Điều 74 khoản 2 · 0,80 | Điều 47 khoản 3 · 9,8 |
| 4 | Điều 47 khoản 3 · 0,79 | Điều 41 khoản 2 · 9,1 |
| 5 | Điều 47 khoản 1 · 0,78 | Điều 47 khoản 4 · 6,2 |

Vòm Sao hiểu ý "nộp đơn cho ai" nên đưa Điều 41 khoản 2 (phúc khảo, điều na ná) lên đầu. Tủ ngăn kéo thấy "47" và "điểm giữa kỳ" nên đưa khoản 1 lên đầu. Không bên nào đặt đoạn đúng ở hạng 1.

### Luật (khớp engine)

Như khối `fusion` (`blocks.py`, k mặc định 60) và `retrieval.fuse_rrf`:

1. Hạng đếm từ 1.
2. Mỗi danh sách cộng 1/(k + hạng) cho đoạn nó có. Đoạn vắng mặt ở một danh sách không nhận gì từ danh sách đó.
3. Xếp theo tổng, giảm dần; bằng tổng thì theo mã đoạn. Dữ liệu của bài không có cặp nào bằng tổng (có test), nên người chơi không cần tới luật mã đoạn.
4. Điểm thô không đi vào Phễu.

### Thứ tự đúng

Tính bằng code từ hai danh sách (`fuseRrf` trong `rrf.ts`), không gõ tay; bảng dưới chỉ để đọc.

| Hạng | Đoạn | Chip | Tổng | Nếu cộng điểm thô |
|---|---|---|---|---|
| 1 | Điều 47 khoản 2 | 1/62 + 1/62 | 0,0323 | 12,91, hạng 2 |
| 2 | Điều 41 khoản 2 | 1/61 + 1/64 | 0,0320 | 9,92, hạng 4 |
| 3 | Điều 47 khoản 1 | 1/65 + 1/61 | 0,0318 | 15,08, hạng 1 |
| 4 | Điều 47 khoản 3 | 1/64 + 1/63 | 0,0315 | 10,59, hạng 3 |
| 5 | Điều 74 khoản 2 | 1/63 | 0,0159 | 0,80, hạng 6 |
| 6 | Điều 47 khoản 4 | 1/65 | 0,0154 | 6,20, hạng 5 |

### Chấm

- Thứ tự đúng tính từ hai danh sách; test so nó với công thức, và kiểm các tính chất bài dựa vào: đoạn đúng thắng mà không đứng đầu bên nào, mọi đoạn có hai chip đứng trên mọi đoạn có một chip, cộng điểm thô thì thứ tự là của Tủ ngăn kéo.
- Thứ tự chỉ xếp được khi đã thả đủ mười chip. Chỉ chấm khi đủ chip và đủ sáu đoạn.
- Chấm từng vị trí: đúng chỗ, hay sai chỗ kèm hạng nên ở. Mỗi đoạn có một dòng lý do: hạng và điểm thô ở từng danh sách (hoặc "không thấy"), các chip, tổng.
- Hộp kết quả đặt thứ tự sau khi trộn cạnh thứ tự nếu cộng điểm thô, rồi nói vì sao điểm thô không quan trọng: Tủ ngăn kéo chấm tới 14,3 còn Vòm Sao dưới 1, cộng thẳng thì Tủ ngăn kéo quyết hết và Điều 47 khoản 1 đứng đầu.

### Còn mở

- Cần giảng viên đọc thử trước pilot, nhất là câu hỏi và điểm minh hoạ.
- Bốn đoạn có hai chip chỉ chênh nhau từ 0,0315 tới 0,0323, mà tổng chỉ hiện sau khi kiểm tra. Mẹo "tổng hạng nhỏ hơn thì nặng hơn" cho đúng thứ tự ở đây; nếu pilot thấy người học chỉ đoán mò, hiện tổng ngay khi đủ chip.
- Research đề xuất làm bài này trên chính Phễu của bàn thợ; bản này vẽ riêng hai danh sách và phễu bằng HTML.
- Chưa ghi log lựa chọn của người chơi; nếu pilot cần đo, thêm như sổ gợi ý.
