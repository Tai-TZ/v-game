> **Trạng thái:** thiết kế v0.1, chưa xây (FSRS và lưu tiến độ phía server nằm ngoài v0.1). **Sửa 2026-10-08:** mục 3 thay luật "2 lượt chạy mỗi sự cố" bằng quỹ lời gọi theo ngày ([roadmap-v0.4](../../design/roadmap-v0.4.md) Q4, X5, X15, X22, X26, X28). **Nguồn:** đặc tả §7 (ôn bằng biến thể, FSRS, xen kẽ); research §1.5 (Wordle, lưới chia sẻ không lộ đáp án).
> **Liên quan:** [L1](library-l1-grounded-citation.md) §14 · [L2](library-l2-chunk-tuning.md) §14 · [L3](library-l3-article-number-lookup.md) §14 · [Tổng quan](overview.md) (campus xuống cấp)

# Ca trực hằng ngày (5 phút)

## 1. Một ca trực trông thế nào

**Tóm tắt:**
- Mỗi ngày có **3 sự cố nhỏ**, mỗi sự cố thuộc một khái niệm khác nhau và được xếp xen kẽ.
- Mỗi sự cố là một cấu hình đã bị làm hỏng **đúng một chỗ**. Nó chạy trên 3 ca: 1 ca ôn `lib-lN-rNN` và 2 ca thấy được của level gốc làm ca đồng hành, để bắt kiểu "sửa chỗ này vỡ chỗ kia".
- Người chơi tìm chỗ hỏng, sửa một món đồ chơi, rồi mở ca (chạy thật).
- Tổng khoảng 5 phút; mỗi sự cố khoảng 90 giây.

| Bước | Thời lượng | Nội dung |
|---|---|---|
| Mở ca | 10 s | Cô Lan đọc bảng phân công: "Ba việc sáng nay. Việc nào cũng nhỏ, nhưng đừng để nhỏ thành to." |
| Sự cố 1 | ~90 s | Hiện trường thu nhỏ (1 câu thoại + 1 hậu quả), bàn thợ đã dựng sẵn cấu hình hỏng, phiếu đoán 1 click, Mở ca |
| Sự cố 2 | ~90 s | Như trên, khái niệm khác |
| Sự cố 3 | ~90 s | Như trên, khái niệm khác |
| Kết ca | 20 s | Lưới kết quả, thẻ chia sẻ, câu chốt của cô Lan |

**Luật của sự cố:**
- Cấu hình hỏng do kịch bản dựng sẵn và chỉ hỏng một chỗ. Mỗi sự cố có câu truyện riêng, ví dụ "Bống tắt Máy đóng tem cho đỡ rối".
- Người chơi được sửa **bất kỳ** đồ chơi nào đã mở. Không có "đáp án duy nhất"; ca ôn quyết định đạt hay trượt.
- Chỉ dùng đồ chơi đã mở ở level người chơi đã qua.
- Ca ôn không trùng nguyên văn ca trong level (đặc tả §7: ôn bằng biến thể, không chơi lại y nguyên).
- Chấm giống level: tiêu chí ca theo [L1 mục 9](library-l1-grounded-citation.md#9-tiêu-chí-chấm-một-ca-máy-kiểm). Không có sao; mỗi sự cố chỉ có "đã sửa" hoặc "chưa sửa".
- Xem trước tất định (chiếu đèn, dải đoạn, thanh thùng) vẫn miễn phí và không giới hạn.

## 2. Chọn sự cố: móc FSRS (chỉ mô tả)

Mỗi người chơi có một **thẻ nhớ cho từng khái niệm**, không phải cho từng câu hỏi:

| Thẻ khái niệm | Ca ôn dùng được | Sự cố mẫu | Câu biến thể sau gợi ý 3 ở level |
|---|---|---|---|
| `grounding.citation` | `lib-l1-r01`, `lib-l1-r04` | tem bị tắt; Vòm Sao bị tháo | L1 sao 1 |
| `grounding.abstention` | `lib-l1-r02`, `lib-l1-r03` | thẻ "cứ suy đoán" cắm lại; Vòm Sao bị tháo | L1 sao 3 |
| `chunk.boundary` | `lib-l2-r01`, `lib-l2-r03` | Lược về 128; Băng keo bị gỡ | L2 sao 1 |
| `retrieval.freshness` | `lib-l2-r02`, `lib-l2-r04` | Kính lọc hiệu lực tắt | L2 sao 3 |
| `retrieval.hybrid` | `lib-l3-r01`, `lib-l3-r02`, `lib-l3-r04` | tháo Tủ ngăn kéo; tháo Vòm Sao; khôi phục lời giải L2 chỉ dense | L3 sao 1; L3 sao 3 khi `t01` trượt (`lib-l3-r02`, diễn đạt lại) |
| `retrieval.rerank_roi` | `lib-l3-r03` | tháo Kính lúp, thu miệng phễu | L3 sao 2 (kiểm phần "Kính lúp giữ đúng đoạn" của gợi ý, không kiểm ngân sách) |

**Sao không có câu biến thể** (sửa 2026-10-08, rà soát vòng 3): L1 và L2 sao 2, và L3 sao 3 khi chỉ `t02` hoặc `t03` trượt. Sao 2 của L1 và L2 là ngân sách token của cả run, không thẻ nào ứng với nó và một ca lẻ không đo được ngân sách của run; gợi ý 3 của hai sao này chỉ nêu hướng, không đưa con số, nên bài tự sửa chính là run chấm sao kế tiếp. Khái niệm của `t02` (cắt đoạn) và `t03` (từ chối) thuộc L2 và L1, đã có ca trực ôn. Với các sao này, gợi ý 3 không gọi `scope=bien_the` và không trừ R.

Danh sách ca ôn, câu hỏi và tiêu chí chấm lấy từ `docs/content/golden/library-l{1,2,3}.json` (mỗi level 4 ca `r01`–`r04`).

**Lịch ôn:**
- Thẻ dùng lịch FSRS (py-fsrs, đặc tả §7). Mỗi thẻ có stability, difficulty và ngày đến hạn. Thẻ được tạo khi người chơi đạt sao 1 ở level chứa khái niệm đó.
- Sau mỗi sự cố, hệ thống tự chấm một `Rating` từ kết quả, không hỏi người chơi:

| Kết quả sự cố | Rating |
|---|---|
| Sửa đúng ở lần chạy đầu, phiếu đoán đúng | `Easy` |
| Sửa đúng ở lần chạy đầu | `Good` |
| Sửa đúng ở lần chạy thứ hai, hoặc phải mở gợi ý 1–2 | `Hard` |
| Sau 2 lượt thật (trên hai cấu hình khác nhau) vẫn chưa sửa được, mở gợi ý 3 (lời giải) bằng nhánh hai lượt trượt, hoặc bỏ sự cố | `Again` |
| Cạn quỹ trước khi sự cố có đủ 2 lượt thật (trên hai cấu hình khác nhau), hoặc lượt có ca `skipped_budget` do `DailyCap` cạn (`reason = "daily_cap"`, mục 3.3) | không chấm: sự cố chuyển sang "luyện", thẻ giữ hạn và quay lại ngày mai bằng biến thể khác |

`Again` chỉ là tín hiệu lịch (thẻ quay lại sớm), không khoá gì và không hiện như điểm phạt. Cạn quỹ là chuyện của trần lời gọi, không phải bằng chứng đã quên, nên không bao giờ thành `Again` (sửa 2026-10-08, [roadmap-v0.4](../../design/roadmap-v0.4.md) X26).

**Chọn 3 sự cố mỗi ngày:**
1. Lấy các thẻ đã đến hạn, xếp theo retrievability tăng dần (thẻ dễ quên nhất lên trước).
2. **Xen kẽ:** không có hai sự cố liền nhau cùng một level, và khi đã mở nhiều khu thì cũng không cùng một khu; mỗi thẻ tối đa một sự cố mỗi ngày.
3. **Xoay biến thể:** trong một thẻ, chọn ca ôn người chơi gặp ít nhất, để hai lần ôn liền nhau của cùng thẻ không dùng cùng một ca.
4. **Giãn cách:** không chọn thẻ vừa tạo trong 24 giờ qua.
5. Thiếu thẻ đến hạn thì bù bằng thẻ có retrievability thấp nhất. Người chơi mới (chưa đủ 3 thẻ) có ca trực ngắn hơn, không bị nhồi.
6. Giáo viên có thể "giao bài ôn nhanh" bằng cách ghim một thẻ vào ca ngày mai (đặc tả §7). Thẻ ghim vẫn tuân luật xen kẽ.

**Liên kết với campus xuống cấp:** retrievability của thẻ quyết định đồ vật nào trong khuôn viên phai đi ([overview.md](overview.md) mục 3).

**Sự cố chung cả lớp** (research §1.5, "Sự cố hôm nay"): ngoài 3 sự cố riêng, ngày nào cũng có **1 sự cố chung** cho cả lớp. Sự cố chung được chọn theo khái niệm mà dashboard lớp cho thấy nhiều người dễ quên nhất. Lưới chia sẻ dùng sự cố này để mọi người so được với nhau.

## 3. Quỹ chạy thật theo ngày

**Chốt 2026-10-08, thay luật cũ "mỗi sự cố có 2 lượt chạy thật".** Luật cũ thực chất là Hearts của Duolingo đổi tên: người mới sai hai lần là bị khoá, đúng nhóm người cần chơi tiếp nhất. Năm 2025 Duolingo bỏ Hearts sang Energy vì người mới dễ hết tim giữa bài gấp đôi người khác; với Energy, xem lại lỗi sai không tốn gì và quỹ hồi trong khoảng một ngày. GitHub Copilot Free đếm các quỹ độc lập, nên cạn quỹ này không khoá quỹ kia. Luật mới thưởng năng lực chứ không thưởng chuyên cần ([đặc tả §7](../../specs/2026-10-07-v-game-design.md#7-cơ-chế-học-ôn-và-brainstorm-đã-duyệt), luật thưởng). Nguồn: [báo cáo nghiên cứu 1](../../research/edtech-upgrade-insights.md), N11.

### 3.1 Luật

- **Đơn vị là lời gọi AI mới.** Một câu trúng kết quả đã lưu (replay, `llm.replayed = true`) tính 0. Một lượt 3 ca mà 2 ca trúng kết quả đã lưu chỉ tốn 1.
- **Mặc định suy từ trần của engine** (sửa 2026-10-08, [roadmap-v0.4](../../design/roadmap-v0.4.md) X26; mọi con số **chờ đo ở pilot**). Tổng quỹ đã phát trong một ngày, tính trường hợp xấu nhất (không trừ kết quả đã lưu, tính cả mọi lời hoàn, lượt câu biến thể và lời gọi giảng viên cấp thêm), không được vượt 90 % `DailyCap`; 10 % còn lại cho lần thử lại và model dự phòng, vì `DailyCap` đếm cả hai:

| Bước | Công thức | Lớp pilot 30 người |
|---|---|---|
| Phần của lớp mỗi ngày | 0,9 × `DAILY_LLM_CALL_CAP` | 0,9 × 500 = 450 |
| Quỹ máy chiếu | cố định mỗi buổi; cũng là nguồn duy nhất để giảng viên cấp thêm | 40 |
| Lượt sửa mẫu của sự cố chung (khi có ca trực) | một lượt 3 ca mỗi ngày | 3 |
| Phần mỗi học viên mỗi ngày (P) | ⌊(450 − 40 − 3 − 15) / số học viên⌋; 15 là phần tối thiểu giữ cho R | ⌊392 / 30⌋ = 13, đúng một run L3 mới ([roadmap §1](../../design/roadmap-v0.4.md#1-nguyên-tắc-chung)) |
| Quỹ dự phòng chung của lớp (R) | 450 − 40 − 3 − số học viên × P (phần dư của phép chia cũng vào R) | 450 − 43 − 390 = 17 |
| Kiểm | số học viên × P + 40 + 3 + R ≤ 450 | 390 + 40 + 3 + 17 = 450 |

**Lời gọi vận hành không có chỗ trong 450** (sửa 2026-10-08). `DailyCap` và key là chung cả máy chủ, nên mọi lời gọi khác lớp đều ăn vào phần của lớp: cổng hiệu chỉnh (3/3 lượt thật cho mỗi lời giải mẫu và mỗi cấu hình ngây thơ), ghi lượt đã ghi của cấu hình khởi đầu L1–L3 (B0, khoảng 36 lời gọi), dựng trace cho Phòng chấm (32–64), và khách vô danh trên bản deploy công khai. 10 % dư đã dành cho thử lại và model dự phòng. Vì vậy: các lượt build, hiệu chỉnh và ghi chạy vào ngày không có lớp (hoặc dùng key và trần riêng); ngày có lớp pilot thì không quảng bá bản deploy công khai.

**Giá một lượt** (lời gọi mới tối đa). L1 chấm 10 ca, L2 và L3 chấm 13 ca (3 thấy được, 7 ẩn, 3 bẫy), theo `docs/content/golden/library-l{1,2,3}.json`:

| Lượt | Tối đa | Ghi chú |
|---|---|---|
| Thử 3 câu mẫu (N2), mọi level | 3 | không tính sao |
| Run chấm sao L1 | 10 | 7 sau lượt mẫu của đúng cấu hình đó: 3 câu mẫu là kết quả đã lưu |
| Run chấm sao L2, L3 | 13 | 10 sau lượt mẫu |
| Một lượt sự cố ở ca trực | 3 | 1 ca ôn, 2 ca đồng hành |
| Câu biến thể sau gợi ý 3 (Thư viện, `scope=bien_the`) | 1 | lấy từ R, không trừ quỹ học viên |
| Phòng chấm P1: Chạy kiểm | 8 | trừ quỹ học viên; nhánh quỹ của cổng gợi ý 3 ở sao 2 so với giá này ([Phòng chấm §3.4](grading-room.md#34-chẩn-đoán-và-gợi-ý), thêm 2026-10-08, rà soát vòng 5; sửa liên kết ở rà soát vòng 6) |
| Phòng chấm P2: Chấm thử · Chấm sao · bài biến thể sau gợi ý 3 | 5 · 12 · 3 | trừ quỹ học viên, kể cả bài biến thể (không lấy từ R); [Phòng chấm §4.2](grading-room.md#42-hai-nút-chạy) |

"Sau lượt mẫu" chỉ đúng khi cấu hình y hệt, vì khoá replay là chính yêu cầu gửi model. UI chỉ trừ trước những câu nó biết chắc là kết quả đã lưu: câu mẫu của lượt mẫu vừa chạy, trên cùng trình duyệt, với đúng cấu hình đó.

**Giá 7 và 10 là ước tính cho tới T1** (sửa 2026-10-08). Trước T1, replay cache là file sqlite cục bộ và mất mỗi khi Render khởi động lại (ngủ sau 15 phút không ai gọi, hoặc deploy mới; X9). Máy chủ khởi động lại giữa lượt mẫu và run sao thì 3 câu mẫu không còn là kết quả đã lưu, run sao tốn đủ 10 (L1) hoặc 13 (L2, L3), và quỹ mềm của người chơi âm tối đa 3. Chấp nhận tới T1, vì tính giá đủ thì ở L2, L3 lượt mẫu cộng run sao (3 + 13) vượt P = 13. Quỹ âm hiện là 0, không hiện số âm; 3 lời gọi dư lấy vào 10 % dư của `DailyCap`.

| Quỹ | Ai dùng | Mặc định | Đủ cho |
|---|---|---|---|
| Học viên | Mở ca ở mọi level (kể cả "Thử 3 câu mẫu") và ca trực; mỗi học viên một quỹ (trước khi có tài khoản: mỗi trình duyệt) | P = 13 lời gọi mỗi ngày | L1: lượt mẫu, run sao, thêm một lượt mẫu (3 + 7 + 3); L2 hoặc L3: lượt mẫu và run sao (3 + 10); hoặc 4 lượt sự cố |
| Máy chiếu | Chế độ máy chiếu của giảng viên | 40 lời gọi mỗi buổi | khoảng 4 run L1 trước lớp; không trừ quỹ học viên |
| Dự phòng chung (R) | Lời hoàn và câu biến thể sau gợi ý 3 của cả lớp; đếm phía máy chủ (mục 3.3) | Phần còn lại sau P (17 ở lớp 30 người) | khoảng 5 lần hoàn 3 lời gọi, hoặc 17 câu biến thể, cho cả lớp mỗi ngày |
| Sự kiện lớp | Sự kiện do giảng viên mở (sau khi có mã lớp) | Giảng viên đặt; ngày có sự kiện thì P tính lại với số lời gọi của sự kiện | Bài nộp chấm một lần phía server trên model chính sau hạn nộp |

- **Level và ca trực dùng chung quỹ học viên** (sửa 2026-10-08, X26, chốt tạm theo [roadmap](../../design/roadmap-v0.4.md) Q9; trước đó là hai quỹ độc lập 20 và 12). Ở lớp 30 người, P chỉ có 13: tách tiếp thành hai quỹ độc lập thì mỗi quỹ nhỏ hơn một lượt của việc kia (run L3 tốn 13, run L1 tốn 10, ca trực cần ít nhất 9). Phần còn giữ của luận điểm Copilot: cạn quỹ không khoá phần miễn phí (dòng "Luôn miễn phí" bên dưới), và quỹ máy chiếu, sự kiện lớp tách khỏi quỹ học viên. Lớp nhỏ hơn thì P lớn hơn (15 người: P = 26) và có thể tách lại; quyết sau pilot.
- **Ở lớp, mỗi cặp ngồi một máy** và dùng quỹ của người ngồi máy đó (sửa 2026-10-08, X26). Đổi máy đúng một lần, lúc đổi vai (phút 17 của [giáo án](../lesson-plan-library.md)) hoặc giữa hai level, bằng **link chuyển máy** (B3): link mang cấu hình, các nấc gợi ý đã mở và số lượt chấm trượt của từng sao, nên cổng gợi ý 3 không khoá lại ở máy mới. Những thứ chỉ có trong trình duyệt cũ thì về trống ở máy mới: lịch sử 5 lượt và thẻ so lượt (N3, N20), phiếu đoán đang dở, danh sách câu đã biết là kết quả đã lưu (UI tính giá lượt theo trường hợp xấu nhất). Quyền hoàn tính theo học viên (dòng "Hoàn lượt" bên dưới), nên máy mới mang lần hoàn của người kia, đúng luật. Chưa có B3 thì cặp ngồi một máy cả buổi, và quỹ của người kia để cho buổi sau. Một cặp có tối đa 2 × 13 = 26 lời gọi mỗi buổi, vừa với sức chạy thật của cả lớp ([giáo án](../lesson-plan-library.md), xoay lượt chạy).
- **Một lần Mở ca ở level** (sửa 2026-10-08, rà soát vòng 5): nút **Mở ca** chạy một lượt hai bước, Thử 3 câu mẫu rồi, nếu cả 3 câu mẫu đạt, run chấm sao (sau phiếu đoán của run sao, nếu level có; L3 không hỏi phiếu nào trước run sao; sửa 2026-10-08, rà soát vòng 6), giống một lượt trên bảng xoay của [giáo án](../lesson-plan-library.md). Giá tối đa của lượt là tổng hai bước: L1 3 + 7, L2 và L3 3 + 10. Ở ca trực, **Mở ca** chạy một lượt sự cố.
- **Quỹ còn ít hơn giá của lượt** (sửa 2026-10-08). Nút **Mở ca** chỉ chạy khi số còn lại ≥ giá tối đa của lượt (đã trừ các câu biết chắc là kết quả đã lưu). Không đủ cho run chấm sao mà còn ít nhất 3 thì nút đổi thành ~~**Chạy 3 câu mẫu**~~ **Thử 3 câu mẫu** (một việc chỉ một nhãn, sửa 2026-10-08, rà soát vòng 5), kèm dòng chữ "Quỹ hôm nay chỉ đủ cho 3 câu mẫu", và chạy lượt mẫu; còn dưới 3 thì nút thành **Xem lượt đã ghi**. Không bao giờ bắt đầu một lượt mà quỹ học viên có thể cạn giữa chừng, trừ trường hợp mất kết quả đã lưu trước T1 đã nêu ở trên (âm tối đa 3).
- **Ca trực khi P = 13** (đánh đổi đã ghi, X26). 3 sự cố riêng, mỗi sự cố có một lượt sửa lại, cần 3 × 2 × 3 = 18 lời gọi; cả lớp 30 người là 540, vượt phần 450 của lớp. Trần không cho phép, nên:
  - **sự cố chung không trừ quỹ học viên khi sửa theo cách mẫu:** sự cố chung giống hệt nhau cho cả lớp, và mỗi sáng máy chủ chạy sẵn lượt sửa mẫu của nó (3 lời gọi, đã tính ở bảng trên). Ai sửa trùng cách mẫu, hoặc trùng cách của một bạn đã chạy trước, thì nhận kết quả đã lưu, 0 lời gọi. Cách sửa khác vẫn tốn quỹ như thường. Luật này **cần T1** (`llm_replay` bền): trước T1, Render khởi động lại là mất replay cache (X9) và lượt sửa trùng cách mẫu lại tốn 3. Vì UI không được biết trước lượt sẽ trúng kết quả đã lưu (dòng cuối của danh sách này), nút **Mở ca** của sự cố chung vẫn đòi quỹ còn ≥ 3 như mọi lượt sự cố; nên sự cố chung luôn đứng **đầu** ca trực, lúc quỹ còn đủ, và tính là sự cố đứng trước sự cố 1 trong luật xen kẽ (mục 2);
  - ngày chỉ chơi ca trực: lượt đầu của 3 sự cố riêng tốn tối đa 9; lượt đầu của sự cố chung tốn 0 nếu sửa trùng cách mẫu, 3 nếu khác. Còn 4 thì đủ một lượt sửa lại (dư 1); còn 1 thì không. Mỗi lần được hoàn thêm một lượt. Ngày đã tiêu P cho level ở lớp thì ca trực chạy ở chế độ luyện;
  - cạn quỹ trước khi sự cố có đủ 2 lượt thật thì sự cố chuyển sang "luyện" và **không chấm Rating** (mục 2), thay vì `Again`. Người mới không bị phạt vì trần;
  - ca trực không hiện báo giá theo khoá replay (T3) trước lượt: báo giá sẽ lộ cấu hình nào đã có kết quả lưu, tức là lộ cách sửa mẫu.
- **Không còn trần lượt mỗi sự cố.** Người chơi muốn chạy sự cố 1 ba lần cũng được, miễn còn quỹ. Mốc "2 lượt chưa sửa" chỉ còn là lời nhắc: cô Lan mời xem chẩn đoán đầy đủ; gợi ý 3 mở theo cổng ở dòng dưới, không khoá gì.
- **Không phải tiêu lượt để được giúp** (N16, [L1 §11](library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý)). Sau lượt trượt đầu, gợi ý 1 và 2 mở theo yêu cầu; nấc sau chỉ mở khi người chơi đã làm một thao tác nhìn miễn phí kể từ nấc trước (đổi một đồ chơi, chiếu đèn, hoặc mở trace của câu trượt).
- **Gợi ý 3 là lời giải, nên có cổng riêng** (N16; sửa 2026-10-08, [roadmap-v0.4](../../design/roadmap-v0.4.md) X28, chốt tạm Q9). Ở level và ở ca trực, gợi ý 3 chỉ mở khi đủ cả ba điều:
  1. đã mở gợi ý 2 và đã làm một thao tác nhìn miễn phí kể từ đó;
  2. đã có ít nhất một lượt chấm thật trượt ở sao đó (ca trực: ở sự cố đó). ~~Lượt "Thử 3 câu mẫu" không phải lượt chấm;~~ Lượt Thử 3 câu mẫu có câu mẫu trượt tính là lượt chấm trượt ở ~~sao 1~~ sao thấp nhất chưa đạt (trước khi có sao 1 là sao 1; sửa 2026-10-08, rà soát vòng 6: người đã có sao 1 mà làm vỡ câu mẫu khi sửa cho sao 2, 3 cũng không tới được run chấm sao), để người kẹt ở câu mẫu vẫn tới được gợi ý 3 (sửa 2026-10-08, rà soát vòng 5, [L1 §11](library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý)); lượt hỏng vì `DailyCap` cạn (mục 3.3) không tính;
  3. hoặc đã trượt lượt chấm thật thứ ba ở sao đó, đếm cả các ngày trước (ca trực: thứ hai ở cùng sự cố), hoặc quỹ còn lại không đủ cho thêm một lượt chấm (nhỏ hơn giá tối đa của run chấm sao, của lượt mẫu khi lượt trượt gần nhất là lượt mẫu, hay của một lượt sự cố). Chỉ đếm lượt trượt trên các cấu hình khác nhau: chạy lại y hệt một cấu hình đã trượt là kết quả đã lưu, 0 lời gọi. "Lượt trượt gần nhất" là lượt trượt được tính gần nhất ở chính sao đó (sửa 2026-10-08, rà soát vòng 6).

  Điều 3 thay cho "quỹ đã hết" của bản đầu: ở L2, L3 một lượt mẫu cộng một run sao đã tiêu hết P = 13, nên "quỹ hết" mở lời giải ngay sau run sao đầu tiên, trước khi người chơi kịp nhìn gì; còn "trượt thứ ba" thì không tới được trong một ngày. Lời giải trình bày như ví dụ mẫu. Ở level, ngay sau đó là một câu biến thể ([L1 §11](library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý)), tốn 1 lời gọi lấy từ R; R hết thì câu biến thể chờ lượt đầu tiên sau khi quỹ hồi. Ở ca trực, câu biến thể chính là ca ôn khác của cùng thẻ ở ca trực sau (luật xoay biến thể, mục 2). Mở bằng nhánh hai lượt trượt thì sự cố chấm `Again`; mở bằng nhánh quỹ thì sự cố đang ở chế độ luyện, không chấm.
- **Hoàn lượt khi đoán chắc và sửa đạt ngay** (sửa 2026-10-08, X26). Trước lượt sửa đầu tiên, người chơi đặt phiếu đoán và đánh dấu "chắc" hoặc "đoán". Phiếu chắc **đúng** và lượt đó đạt thì số lời gọi mới của lượt được hoàn, tối đa 3, lấy từ R:
  - **ca trực:** lượt sửa đầu tiên của một sự cố; "đạt" là cả 3 ca đạt; tối đa một lần mỗi sự cố;
  - **level:** chỉ lượt **Thử 3 câu mẫu** đầu tiên sau lượt đã ghi mở màn level (N4; ở L2, L3 đó là lượt của lời giải mẫu; level chưa có lượt đã ghi thì lượt mẫu đầu tiên sau lượt chấm trượt đầu tiên); "đạt" là cả 3 câu mẫu đạt, khớp cược tự tin trên 3 câu mẫu (N19; phiếu mẫu ở [L1 §7](library-l1-grounded-citation.md#7-bước-đoán-1-click-trước-mở-ca), cũng dùng cho L2, L3); ~~tối đa một lần mỗi level mỗi ngày~~ tối đa một lần mỗi level, tính cả đời chơi: lượt mẫu đầu tiên sau lần đầu xem lượt đã ghi; mở lại level và xem lại lượt đã ghi không mở thêm lần hoàn (sửa 2026-10-08, rà soát vòng 5: "mỗi ngày" cho phép ngày nào cũng chạy mẫu lại một cấu hình đã giải, đánh dấu Chắc, để rút 3 từ R). Run chấm sao không bao giờ được hoàn: 10–13 lời gọi một lần là gần hết R của cả lớp. Chưa có lượt mẫu (B5) thì level không hoàn;
  - **giới hạn chung:** mỗi học viên tối đa một lần hoàn mỗi ngày; R hết thì thôi hoàn, UI nói ~~"Hôm nay quỹ hoàn của lớp đã hết" và không nói gì về người chơi~~ "Bạn đoán chắc và đúng, nhưng quỹ hoàn chung của lớp hôm nay đã hết: quỹ chia theo thứ tự, ai đạt trước được trước." (sửa 2026-10-08), tức nêu năng lực và lý do thật, không trách người chơi. Chưa có bộ đếm R phía máy chủ (B0) thì không hoàn.

  Lời hoàn nêu đúng năng lực: "Hoàn 3 lời gọi: bạn đoán chắc và sửa đúng Kính lọc ngay lượt đầu."
  - **Ở lớp, R cạn theo thứ tự gọi trên bảng xoay** (đánh đổi đã ghi, sửa 2026-10-08, X26, chốt tạm Q9). R = 17 chỉ đủ khoảng 5 lần hoàn mỗi ngày cho cả lớp. Trong buổi học, giảng viên gọi các cặp lần lượt ([giáo án](../lesson-plan-library.md), xoay lượt chạy), nên cặp đủ điều kiện có được hoàn hay không tuỳ thứ tự gọi, không tuỳ năng lực. Vẫn giữ hoàn trong giờ học cho pilot, vì ở lớp lời hoàn không đổi số lượt của cặp: mỗi cặp chạy 1–2 lượt, mỗi lượt tối đa 10, mỗi máy có 13. Nó chỉ để lại quỹ cho ca trực ngoài giờ. Pilot đo giờ R cạn ([roadmap §6](../../design/roadmap-v0.4.md#6-đo-gì-ở-buổi-pilot)); nếu R thường cạn ngay trong giờ học thì tắt hoàn trong buổi học.
  - **Rủi ro đã biết, chấp nhận cho pilot:** đánh dấu chắc mà sai không mất gì, nên chiến lược tối ưu là luôn chọn chắc, và lời hoàn thực chất thành "đoán đúng và sửa đạt ngay". Phần đoán đúng vẫn cần năng lực, nên luật vẫn thưởng năng lực. Pilot đo tỉ lệ phiếu chọn chắc; nếu trên 90 % thì đổi sang hoàn theo điểm hiệu chỉnh (tỉ lệ đúng của các phiếu chắc gần đây).
- **Luôn miễn phí:** xem trước tất định (chiếu đèn, dải đoạn, thanh thùng), xem lại log và mọi kết quả đã lưu, lượt đã ghi, chẩn đoán, gợi ý.
- **Cạn quỹ** thì vẫn chơi được mọi phần miễn phí; sự cố còn dở chuyển sang chế độ "luyện" trên lượt đã ghi, không cập nhật FSRS. Không có quảng cáo hay đá quý, không bao giờ bán lượt. Trước khi có mã lớp (T2) không ai cấp thêm được cho một trình duyệt: giảng viên giúp bằng cách chạy cấu hình của học viên trên máy chiếu (quỹ máy chiếu). Sau T2, giảng viên cấp thêm bằng cách chuyển lời gọi từ quỹ máy chiếu của buổi đó, nên tổng đã phát không đổi (X26).
- **Hồi quỹ:** hồi đầy một lần mỗi ngày lúc 00:00 UTC (07:00 giờ Việt Nam), cùng lúc với `DailyCap` của engine. Không hồi dần trong ngày.
- Mỗi ngày chỉ một ca trực tính điểm; chơi lại ca hôm nay là chế độ "luyện" trên kết quả đã lưu, không cập nhật FSRS, không có thẻ chia sẻ.
- Số lượt chạy không bao giờ được hiện như một thành tích. Thẻ chia sẻ (mục 4) vẫn ghi số lượt như một dữ kiện, không xếp hạng theo nó.

### 3.2 Hiển thị

- Cạnh nút **Mở ca**: "Còn 9 lời gọi hôm nay (ước tính) · hồi đầy lúc 07:00". Trước lượt: "Lượt này tốn tối đa 3". Sau lượt: số đã trừ và số kết quả đã lưu ("2 câu dùng kết quả đã lưu, không tốn lời gọi").
- Chữ "ước tính" luôn hiện cho tới khi có lưu trữ bền phía server (T1): số còn lại có thể lạc quan (mục 3.3).
- Không dùng màu đỏ hay đồng hồ đếm ngược. Quỹ cạn thì nút **Mở ca** chuyển thành "Xem lượt đã ghi", kèm một câu: "Quỹ hôm nay đã hết. Mai 07:00 có lại; lượt đã ghi và chiếu thử vẫn miễn phí." Quỹ còn mà không đủ cho lượt thì nút đổi theo mục 3.1 (**Thử 3 câu mẫu**, kèm dòng "Quỹ hôm nay chỉ đủ cho 3 câu mẫu").

### 3.3 Ánh xạ sang engine

Quỹ là lớp mềm phía người chơi, nằm trên trần cứng của engine.

| Lớp | Ở đâu | Đếm gì | Hồi | Giới hạn đã biết |
|---|---|---|---|---|
| `DailyCap` (trần cứng, cả máy chủ) | engine, `DAILY_LLM_CALL_CAP` = 500 | mọi lần gọi mạng thật, kể cả lần thử lại và lần chuyển sang model dự phòng | 00:00 UTC | Đếm trong RAM, về 0 khi Render khởi động lại ([engine-v0.2](../../design/engine-v0.2.md) §5.7); hạn mức ngày của chính Gemini lại hồi lúc nửa đêm giờ Thái Bình Dương, nên 429 có thể tới trước khi `DailyCap` cạn |
| Quỹ người chơi (mềm) | trình duyệt, `localStorage` khoá `vg.quota.v1` | lời gọi mới theo bước `llm` có `replayed = false` | 00:00 UTC | Theo trình duyệt cho tới khi có tài khoản: xoá dữ liệu trang là có quỹ mới; hai người chung máy dùng chung quỹ (đúng ý cho chơi cặp) |

- **Trước khi có tài khoản:** mỗi trình duyệt một quỹ. Đọc và ghi trong `try/catch`; không đọc được thì coi như quỹ đầy. Đây là lời hứa mềm, không phải hàng rào bảo mật: trần thật vẫn là `DailyCap`.
- **Engine cần thêm** (đợt B, [roadmap-v0.4](../../design/roadmap-v0.4.md) B0, §5.1): `GET /api/quota` trả `{cap, used, remaining, resets_at, estimate, reserve_left, learner_daily}`. Frontend hiện số nhỏ hơn giữa quỹ người chơi và `remaining` của máy chủ. `learner_daily` là P, đặt ở máy chủ (`QUOTA_LEARNER_CALLS`, mặc định 13, sửa 2026-10-08), vì P đổi theo sĩ số (30 người: 13; 15 người: 26) và trước T2 trình duyệt không biết sĩ số; frontend đọc P từ đây, không ghi cứng.
  - **Quỹ dự phòng R** đếm phía máy chủ, cùng ngày UTC và cùng giới hạn với `DailyCap` (trong RAM, mất khi Render khởi động lại; vì thế vẫn ghi "ước tính"). Lời hoàn ghi bằng `POST /api/quota/refund {run_id}`: máy chủ chỉ nhận run đã `run.finished`, mỗi `run_id` một lần, trừ R tối đa 3. **Sửa 2026-10-08 (rà soát vòng 5):** máy chủ biết phạm vi và kết quả từng ca của run, nên tự kiểm luật thay vì tin client: chỉ hoàn run `scope=mau` mà cả 3 câu mẫu đạt (khi có ca trực: lượt sự cố mà cả 3 ca đạt, qua scope riêng của lượt sự cố mà T4 thêm; chưa có scope đó thì máy chủ từ chối và ca trực không hoàn lượt, [roadmap §5.1](../../design/roadmap-v0.4.md#51-quỹ-trên-bàn-thợ-n11), sửa 2026-10-08, rà soát vòng 6), từ chối run chấm sao, và hoàn tối đa số lời gọi có `replayed = false` của chính run đó, nên lượt mẫu toàn kết quả đã lưu được hoàn 0. Luật "lượt đầu tiên" (một lần mỗi level, một lần mỗi sự cố, một lần mỗi học viên mỗi ngày) vẫn do client giữ tới T2, vì trước đó máy chủ không biết ai là ai. Lượt câu biến thể (`scope=bien_the`) tự trừ R lúc chạy và bị từ chối khi R hết. Trước T2 không có xác thực, nên ai cũng rút được R: tác hại chỉ là hết hoàn sớm, trần cứng vẫn là `DailyCap`.

  Khi `DailyCap` cạn ([engine-v0.2](../../design/engine-v0.2.md) §7.4) có hai kết cục:
  - **không ca nào có câu trả lời:** run kết thúc `run.failed{llm_unavailable}`, lượt không tính sao, không trừ quỹ người chơi;
  - **cạn giữa run:** các ca còn lại thành `skipped_budget`, run vẫn được chấm và kết thúc bằng `run.finished`. B0 thêm `reason: "daily_cap"` vào `case.graded` của những ca này. Chỉ lượt có ca `skipped_budget` với `reason = "daily_cap"` mới được miễn: không tính là một lần thử sao (không đếm vào cổng gợi ý 3, không ghi đè kết quả sao), không tính `Again` ở ca trực, không được hoàn; quỹ chỉ trừ lời gọi mới thật sự đã chạy. UI nói rõ: "Máy chủ hết lượt hôm nay giữa chừng; {n} câu chưa chạy, lượt này không tính." Ca `skipped_budget` do `RunBudget` của chính cấu hình người chơi (quá số lời gọi mỗi ca) vẫn là ca trượt bình thường. Trước khi có `reason`, UI chỉ coi là `DailyCap` cạn khi `/api/quota` trả `remaining = 0` ngay sau lượt.
- **Khi có mã lớp và lưu trữ bền (T1, T2):** quỹ chuyển lên server theo biệt danh, giảng viên chỉnh mức mặc định của lớp và cấp thêm từ quỹ máy chiếu; tổng quỹ đã phát của lớp phải ≤ 90 % `DailyCap` theo công thức ở mục 3.1.
- Sức chứa: model chính 15 lời gọi/phút; 500 lời gọi/ngày ≈ 38 run L3 mới cho cả lớp; công thức mặc định ở mục 3.1. Quỹ theo trình duyệt chỉ giữ đúng công thức khi mỗi học viên dùng một trình duyệt; trước khi có tài khoản, ai chơi trên hai máy thì tổng có thể vượt, và khi đó `remaining` của máy chủ (số nhỏ hơn được hiện) mới là số đúng. Tốc độ: engine chạy một run mỗi lúc (`MAX_CONCURRENT_RUNS` = 1), xem cách xoay lượt ở [giáo án](../lesson-plan-library.md).

## 4. Thẻ chia sẻ

Thẻ là ảnh PNG kèm bản chữ thuần để dán vào chat. Thẻ **không hiện cấu hình, không hiện câu hỏi và không kèm link** (theo Wordle).

```text
Ca trực Thư viện · 08/10
Sự cố chung  ■■■     0,9k token
Sự cố 1  ▢▢▢ → ■■■   1,9k token
Sự cố 2  ■■■         0,8k token
Sự cố 3  ■▢■         1,0k token
3/4 đã sửa · 5 lượt
```

- Mỗi hàng là một sự cố theo thứ tự đã chơi, mỗi khối là một lần chạy. Ví dụ trên vừa P = 13 (sửa 2026-10-08): sự cố chung chơi đầu, lúc quỹ còn 13 (cần ≥ 3), và tốn 0 vì sửa trùng cách mẫu; sự cố 1 tốn 6, sự cố 2 và 3 mỗi sự cố 3; tổng 12. Sự cố 3 trượt mà quỹ chỉ còn 1 nên chuyển sang luyện, không chấm (mục 3.1).
- Mỗi ô là một ca ôn: `■` đạt, `▢` trượt. Dùng ký tự hình học, không dùng emoji (CLAUDE.md).
- Token là tổng của sự cố, giúp so "sao người khác rẻ hơn mình" (research §2.4) mà không lộ lời giải.
- Ảnh PNG dùng token màu của theme đang bật; bản chữ thì giống nhau ở mọi theme.

## 5. Ba ca trực mẫu từ biến thể Thư viện

### Ca A: người chơi vừa xong L1 và L2

| # | Thẻ | Ca ôn | Sự cố dựng sẵn | Cô Lan mở | Sửa đúng |
|---|---|---|---|---|---|
| 1 | `grounding.abstention` | `lib-l1-r02` (hỏi một khoản không tồn tại của điều có thật) | Lăng kính bị cắm lại thẻ G5 "kể cả khi phải suy đoán" | "Ai đó vừa dạy trợ lý 'cứ đoán đại'. Mình đoán là Bống." | rút G5, cắm G3 |
| 2 | `retrieval.freshness` | `lib-l2-r02` (một con số khác nhau giữa 2019 và 2024) | Kho vừa nạp lại, Kính lọc hiệu lực tắt | "Xe lưu trữ lại vừa đẩy vào. Cẩn thận giấy vàng." | bật Kính lọc |
| 3 | `grounding.citation` | `lib-l1-r01` (bảo lưu tối đa bao lâu) | Máy đóng tem tắt | "Câu trả lời hay lắm, chỉ là không ai biết nó lấy ở đâu ra." | bật tem (+ G2) |

Xen kẽ: abstention → freshness → citation (L1 → L2 → L1, khái niệm khác nhau liên tiếp).

### Ca B: người chơi đã xong cả khu Thư viện

| # | Thẻ | Ca ôn | Sự cố dựng sẵn | Cô Lan mở | Sửa đúng |
|---|---|---|---|---|---|
| 1 | `chunk.boundary` | `lib-l2-r03` (câu đáp án dài) | Băng keo bị gỡ, Lược 256 | "Có câu trả lời bị cụt mất nửa sau. Lại là cái lược." | Băng keo ≥ 10% hoặc Nam châm |
| 2 | `retrieval.hybrid` | `lib-l3-r01` (khoản 2 của một điều khác trong họ) | Tủ ngăn kéo bị tháo "cho nhanh" | "Nhanh hơn thật, sai cũng nhanh hơn." | lắp lại BM25 + Phễu |
| 3 | `grounding.abstention` | `lib-l1-r03` (câu đời sống ngoài quy chế) | Vòm Sao bị tháo, chỉ còn LLM chay | "Hôm nay trợ lý tự tin lạ thường. Mình không thích thế." | gắn lại Vòm Sao, giữ G3 |

### Ca C: một tuần sau khi xong Thư viện, nhiều thẻ đến hạn

Đây là lần ôn thứ hai của thẻ `retrieval.freshness` và `grounding.citation`, nên luật xoay biến thể (mục 2) chọn ca ôn thứ tư thay cho ca đã gặp ở Ca A.

| # | Thẻ | Ca ôn | Sự cố dựng sẵn | Cô Lan mở | Sửa đúng |
|---|---|---|---|---|---|
| 1 | `retrieval.rerank_roi` | `lib-l3-r03` (vừa số vừa lời thường) | Kính lúp bị tháo, miệng phễu thu về 3 | "Đúng thì đúng rồi, nhưng chậm một bước là trượt." | Kính lúp `top_n` 3 sau Phễu 10 |
| 2 | `retrieval.freshness` | `lib-l2-r04` (ngưỡng vắng để không được dự thi; bản 2019 ghi khác) | Bống tắt Kính lọc vì "lọc thì mất bớt câu trả lời" | "Bống bảo lọc làm mất câu trả lời. Mất câu sai thì mình chịu được." | bật Kính lọc |
| 3 | `grounding.citation` | `lib-l1-r04` (câu viết tắt kiểu nhắn tin, điều khác Điều 12) | Vòm Sao bị tháo | "Hôm nay trợ lý trả lời nhanh lạ thường. Nhanh vì nó chẳng mở sách." | gắn lại Vòm Sao, giữ tem |

Xen kẽ: L3 → L2 → L1, ba khái niệm khác nhau.

**Sự cố chung của lớp hôm đó** (mục 2): thẻ `retrieval.hybrid`, ca `lib-l3-r04` (hỏi bằng số một điều ngoài họ 41/47/74). Sự cố dựng sẵn: Bống khôi phục lời giải L2, chỉ có Vòm Sao, "cho chắc". Cô Lan mở: "Lời giải cũ chạy tốt tuần trước. Tuần này người ta hỏi bằng số." Sửa đúng: lắp lại Tủ ngăn kéo + Phễu.

**Câu chốt cuối ca** (chọn theo kết quả):
- Sửa đủ: "Ca hôm nay sạch sẽ. Mai gặp lại, và nhớ đừng dạy Bống thêm mẹo nào."
- Có sự cố chưa sửa: "Còn một việc dang dở, mai nó sẽ quay lại sớm. Thế là bình thường."

## 6. Tiếp cận và telemetry

**Tiếp cận:** lưới kết quả có bản chữ: "Sự cố 1: lần 1 trượt 3/3 ca, lần 2 đạt 3/3, 1.900 token." Thẻ chia sẻ có alt text giống bản chữ thuần.

**Telemetry:** `shift.open` → `incident.start{card, case_ids}` → `predict.submit{confident}` → `run.start{max_calls}` → `run.end{pass, tokens, new_calls, replayed_calls}` → `quota.refund{calls}` → `incident.end{rating}` → `shift.end{fixed, runs}` → `shift.share{format}`; thêm `quota.empty{pool}` khi một quỹ cạn.

**KPI:**
- tỉ lệ quay lại ngày hôm sau;
- tỉ lệ `Again` theo thẻ; thẻ nào cao thì đưa vào buổi debrief của lớp (research, mục "Bẫy cần tránh");
- thời lượng trung vị của ca, mục tiêu ≤ 5 phút 30 giây.

## 7. Câu hỏi mở

1. FSRS chạy phía server (py-fsrs) nhưng v0.1 không lưu tiến độ phía server. Ca trực chỉ bật khi có lưu tiến độ; trước đó có thể chạy bản "luyện" không lịch.
2. **Đã đóng 2026-10-08.** Kết quả đã lưu không tốn quỹ (mục 3.1): quỹ đếm lời gọi mới, không đếm lượt.
3. Sự cố chung cả lớp cần vai trò giáo viên hoặc dashboard lớp, tức là phụ thuộc phần chưa có tài liệu.
4. **Đóng một phần.** Mỗi level giờ có 4 ca ôn (`r01`–`r04`), nên mọi thẻ trừ `retrieval.rerank_roi` có ít nhất 2 biến thể và hai lần ôn liền nhau không lặp ca (luật xoay, mục 2). Vẫn quá ít cho lịch nhiều tuần: cần thêm ít nhất một ca ôn `tra-so-kho` cho `retrieval.rerank_roi`, và thêm biến thể theo thời gian; giáo viên duyệt (đặc tả §2). **Sửa 2026-10-08 (X28):** câu biến thể sau gợi ý 3 ở level cũng lấy từ tập ôn này; ca đã dùng làm câu biến thể được đánh dấu là đã gặp, nên luật xoay (mục 2) bỏ qua nó ở lần ôn sau. Tập ôn vì thế cạn nhanh hơn; đủ người viết thì soạn ca biến thể riêng `lib-lN-xNN` cho gợi ý 3.
