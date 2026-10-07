> **Trạng thái:** thiết kế v0.1, chưa xây (FSRS và lưu tiến độ phía server nằm ngoài v0.1). **Nguồn:** đặc tả §7 (ôn bằng biến thể, FSRS, xen kẽ); research §1.5 (Wordle, lưới chia sẻ không lộ đáp án).
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

| Thẻ khái niệm | Ca ôn dùng được | Sự cố mẫu |
|---|---|---|
| `grounding.citation` | `lib-l1-r01`, `lib-l1-r04` | tem bị tắt; Vòm Sao bị tháo |
| `grounding.abstention` | `lib-l1-r02`, `lib-l1-r03` | thẻ "cứ suy đoán" cắm lại; Vòm Sao bị tháo |
| `chunk.boundary` | `lib-l2-r01`, `lib-l2-r03` | Lược về 128; Băng keo bị gỡ |
| `retrieval.freshness` | `lib-l2-r02`, `lib-l2-r04` | Kính lọc hiệu lực tắt |
| `retrieval.hybrid` | `lib-l3-r01`, `lib-l3-r02`, `lib-l3-r04` | tháo Tủ ngăn kéo; tháo Vòm Sao; khôi phục lời giải L2 chỉ dense |
| `retrieval.rerank_roi` | `lib-l3-r03` | tháo Kính lúp, thu miệng phễu |

Danh sách ca ôn, câu hỏi và tiêu chí chấm lấy từ `docs/content/golden/library-l{1,2,3}.json` (mỗi level 4 ca `r01`–`r04`).

**Lịch ôn:**
- Thẻ dùng lịch FSRS (py-fsrs, đặc tả §7). Mỗi thẻ có stability, difficulty và ngày đến hạn. Thẻ được tạo khi người chơi đạt sao 1 ở level chứa khái niệm đó.
- Sau mỗi sự cố, hệ thống tự chấm một `Rating` từ kết quả, không hỏi người chơi:

| Kết quả sự cố | Rating |
|---|---|
| Sửa đúng ở lần chạy đầu, phiếu đoán đúng | `Easy` |
| Sửa đúng ở lần chạy đầu | `Good` |
| Sửa đúng ở lần chạy thứ hai, hoặc phải mở gợi ý | `Hard` |
| Hết lượt mà chưa sửa được | `Again` |

**Chọn 3 sự cố mỗi ngày:**
1. Lấy các thẻ đã đến hạn, xếp theo retrievability tăng dần (thẻ dễ quên nhất lên trước).
2. **Xen kẽ:** không có hai sự cố liền nhau cùng một level, và khi đã mở nhiều khu thì cũng không cùng một khu; mỗi thẻ tối đa một sự cố mỗi ngày.
3. **Xoay biến thể:** trong một thẻ, chọn ca ôn người chơi gặp ít nhất, để hai lần ôn liền nhau của cùng thẻ không dùng cùng một ca.
4. **Giãn cách:** không chọn thẻ vừa tạo trong 24 giờ qua.
5. Thiếu thẻ đến hạn thì bù bằng thẻ có retrievability thấp nhất. Người chơi mới (chưa đủ 3 thẻ) có ca trực ngắn hơn, không bị nhồi.
6. Giáo viên có thể "giao bài ôn nhanh" bằng cách ghim một thẻ vào ca ngày mai (đặc tả §7). Thẻ ghim vẫn tuân luật xen kẽ.

**Liên kết với campus xuống cấp:** retrievability của thẻ quyết định đồ vật nào trong khuôn viên phai đi ([overview.md](overview.md) mục 3).

**Sự cố chung cả lớp** (research §1.5, "Sự cố hôm nay"): ngoài 3 sự cố riêng, ngày nào cũng có **1 sự cố chung** cho cả lớp. Sự cố chung được chọn theo khái niệm mà dashboard lớp cho thấy nhiều người dễ quên nhất. Lưới chia sẻ dùng sự cố này để mọi người so được với nhau.

## 3. Giới hạn lượt chạy

- **Mỗi sự cố có 2 lượt chạy thật**, cả ca tối đa 6 lượt.
- Hết 2 lượt mà chưa sửa được: cô Lan cho xem chẩn đoán đầy đủ và gợi ý 3 của level gốc. Sự cố ghi "chưa sửa" (`Again`) và quay lại sớm hơn.
- Xem trước tất định không tính lượt.
- Một lượt trúng cache phát lại vẫn tính là một lượt, để giữ cảm giác khan hiếm. Chi phí thật của lượt đó bằng 0 (Phần 3 §3.8).
- Mỗi ngày chỉ một ca trực tính điểm; có thể chơi lại ca hôm nay ở chế độ "luyện", không cập nhật FSRS và không có thẻ chia sẻ.
- Lý do: tạo cảm giác "Wordle mỗi ngày" và chặn chi phí API (research §1.5, mục "Bẫy cần tránh").

## 4. Thẻ chia sẻ

Thẻ là ảnh PNG kèm bản chữ thuần để dán vào chat. Thẻ **không hiện cấu hình, không hiện câu hỏi và không kèm link** (theo Wordle).

```text
Ca trực Thư viện · 08/10
Sự cố 1  ▢▢▢ → ■■■        1,9k token
Sự cố 2  ■▢▢ → ■■▢ → ■■■  3,1k token
Sự cố 3  ■■■              0,8k token
Sự cố chung  ■■▢ → ■■■    2,2k token
4/4 đã sửa · 7 lượt
```

- Mỗi hàng là một sự cố, mỗi khối là một lần chạy.
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

**Telemetry:** `shift.open` → `incident.start{card, case_ids}` → `predict.submit` → `run.start` → `run.end{pass, tokens}` → `incident.end{rating}` → `shift.end{fixed, runs}` → `shift.share{format}`.

**KPI:**
- tỉ lệ quay lại ngày hôm sau;
- tỉ lệ `Again` theo thẻ; thẻ nào cao thì đưa vào buổi debrief của lớp (research, mục "Bẫy cần tránh");
- thời lượng trung vị của ca, mục tiêu ≤ 5 phút 30 giây.

## 7. Câu hỏi mở

1. FSRS chạy phía server (py-fsrs) nhưng v0.1 không lưu tiến độ phía server. Ca trực chỉ bật khi có lưu tiến độ; trước đó có thể chạy bản "luyện" không lịch.
2. Một lượt trúng cache vẫn tính lượt: có hợp lý không, hay nên miễn lượt?
3. Sự cố chung cả lớp cần vai trò giáo viên hoặc dashboard lớp, tức là phụ thuộc phần chưa có tài liệu.
4. **Đóng một phần.** Mỗi level giờ có 4 ca ôn (`r01`–`r04`), nên mọi thẻ trừ `retrieval.rerank_roi` có ít nhất 2 biến thể và hai lần ôn liền nhau không lặp ca (luật xoay, mục 2). Vẫn quá ít cho lịch nhiều tuần: cần thêm ít nhất một ca ôn `tra-so-kho` cho `retrieval.rerank_roi`, và thêm biến thể theo thời gian; giáo viên duyệt (đặc tả §2).
