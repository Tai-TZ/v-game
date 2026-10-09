> **Trạng thái:** kịch bản v0.1 cho engine, chưa chơi được. **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D1–D7 và §3, §4. Tên khối, tham số và cờ theo [Phần 3](../../design/part-3-block-system.md). Phần trình bày theo [Xưởng Đồ Chơi Trực Ca](../../design/gameplay-direction.md).
> **Liên quan:** [Tổng quan Thư viện](library.md) · [L2](library-l2-chunk-tuning.md) · [L3](library-l3-article-number-lookup.md) · [Dạy lại](teach-back.md) · [Ca trực](daily-shift.md) · [Nhân vật](npc-cast.md)

# Thư viện L1 · Thôi bịa điều luật

## 1. Metadata

| Trường | Giá trị |
|---|---|
| Mã level | `grounded-citation` (order 1, khu `library`) |
| Kind | `standard` · type Phần 3: `rag` |
| Khái niệm (zones.json) | Truy xuất tài liệu · Trích dẫn nguồn · Chống bịa thông tin |
| Slide gốc | Ngày 7 slide 30/60 "Retrieval Pipeline chuẩn", 36/60 "So sánh: LLM chay vs RAG-Enhanced", 27/60 "Top-k, score threshold, filter", 45/60 "Answer function có retrieved context" (câu "Nếu không tìm thấy, nói 'Không có thông tin'"). Ngày 8 slide 5/46 "Ảo giác của LLM", 20/46 "Cấu trúc prompt: tách System / Context / Question", 22/46 "Grounding & Verification", 27/46 "Grounding & Abstention" (forcing citations, graceful degradation). Ngày 14 slide 14/42 "Golden dataset" (ca adversarial, out-of-scope) |
| Điều kiện vào | Không có (D1). Đây là level đầu tiên của game. L1 tự giới thiệu Thùng Context ở mức tối thiểu: thùng có cỡ cố định, thể tích là token |
| Kho | `qcdt-2024` (Quy chế đào tạo trình độ đại học, Trường Đại học Sao Mai, còn hiệu lực). Không có bản 2019 |
| Ca test | Nguồn sự thật: [`library-l1.json`](../golden/library-l1.json) (brief §4.2). 10 ca: `lib-l1-v01`–`v03` (thấy được), 5 ca ẩn `h01`–`h05`, `lib-l1-t01`, `lib-l1-t02` (bẫy, ẩn). Thêm 4 ca ôn `lib-l1-r01`–`r04` cho ca trực |
| Thời lượng | ~~lần chạy thật đầu tiên ở khoảng phút 1:30 (luôn trước phút 3)~~ **Sửa 2026-10-08 (X11, N4):** cú vấp đầu tiên đến từ lượt đã ghi ở khoảng phút 1:30 (luôn trước phút 3); lượt thật đầu tiên là lượt Thử 3 câu mẫu ở khoảng phút 4:15. Cả level 6–9 phút thời gian chơi, thêm 60 giây kiểm tra cuối; ở quỹ P = 13 mỗi ngày, đủ 3 sao có thể trải qua vài ngày (mục 4) |

## 2. Mục tiêu học

**Sau level này, người chơi làm được:**
1. Đoán đúng chuyện xảy ra khi model không có tài liệu: nó bịa ra câu nghe rất hợp lý, hoặc trả lời chung chung, chứ hiếm khi nói "không biết" đúng chỗ. Đo bằng phiếu đoán lần chạy 1 và câu 1 của bài kiểm tra 60 giây.
2. Lắp truy xuất kèm trích nguồn để ít nhất 6/8 ca thường trả lời đúng và trích một đoạn có thật trong thùng. Đo bằng sao 1.
3. Phân biệt được từ chối đúng, từ chối sai và bịa nguồn trên 3 câu trả lời mới. Đo bằng bài 60 giây, đạt khi đúng ít nhất 2/3.
4. Giải thích cho Bống vì sao câu của Minh sai, có dẫn bằng chứng trong vết chạy. Đo bằng rubric dạy lại L1, đạt khi được ít nhất 5/8.

**Hiểu lầm nhắm tới:**
- Chính: "Không có tài liệu thì model sẽ tự nói là không biết." Thực tế (Ngày 8, slide 5/46): model ưu tiên trôi chảy hơn chính xác và không biết mình không biết.
- Phụ: "Nội dung đúng là đủ, nguồn không quan trọng." Ngày 8, slide 27/46: RAG mất nửa giá trị nếu không chỉ ra lấy từ tài liệu nào.

## 3. Mồi truyện và Hiện trường

**Bối cảnh:** khuôn viên Trường Đại học Sao Mai, ca tối. Thư viện có một trợ lý tra cứu (cỗ máy đồng nhỏ đặt ở quầy) trả lời sinh viên về quy chế đào tạo.

**Hiện trường (≤ 20 giây, không có chữ ngoài áp phích):**
- Bảng Tin trước cửa Thư viện dán kín áp phích giống hệt nhau. Mỗi tờ in nguyên văn câu bịa:
  > "Theo Điều 47 Quy chế đào tạo, em chỉ cần gửi email cho phòng đào tạo trước khi học kỳ kết thúc là được bảo lưu."
- Minh, sinh viên năm hai, đứng đọc rồi giơ điện thoại chụp. Chú Bảy (lao công) xách xô hồ, ngước nhìn, thở dài.
- Gió thổi một tờ bay xuống chân người chơi. Tờ đó phát sáng nhẹ: click, chạm hoặc nhấn E để xem.

**Đây là cờ thế giới của L1.** Áp phích chỉ được gỡ khi người chơi đạt sao 1 (mục 10). Lần chạy nào trích sai nguồn sẽ ghim thêm áp phích mới, mỗi tờ in đúng câu trả lời thật của lần chạy đó.

**Nhãn trung thực:** cảnh Tua lại ở nhịp 2 là ca đêm qua.
- Nếu cổng phát hành ghi được một lần chạy thật của cấu hình khởi đầu ra đúng câu trên, cảnh đóng tem "kết quả đã lưu".
- Nếu không, cảnh đóng tem "dựng lại để minh hoạ" (xem Câu hỏi mở 1).
- **Tem theo danh sách cố định (sửa 2026-10-08, [frontend architecture §8.4](../../design/frontend-architecture.md#84-tem-nguồn-và-trung-thực-số-liệu)):** trên màn, "kết quả đã lưu" của một lượt đã ghi phát lại (ở mục này, L2, L3 và [dạy lại](teach-back.md)) hiện bằng tem "Lượt chạy đã ghi"; ca trúng cache giữa một lượt chạy thật thì không (mục 8); "dựng lại để minh hoạ" hiện bằng tem "Minh hoạ". Hai cụm cũ chỉ còn là chữ mô tả trong tài liệu.

~~Lần chạy 1 của người chơi luôn là lần chạy thật, kể cả khi trúng cache phát lại.~~ **Sửa 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X11, N4):** lần chạy 1 là lượt đã ghi của cấu hình khởi đầu, phát lại cả 10 ca với tem "Lượt chạy đã ghi", 0 lời gọi. Lượt thật đầu tiên của người chơi là lượt Thử 3 câu mẫu, sau khi họ đã sửa (mục 4).

## 4. Beat sheet

Lời thoại của cô Lan dùng nguyên văn. Mỗi lượt thoại tối đa 2 câu, hiện ở khung thoại DOM và có thể bỏ qua bằng Enter hoặc chạm.

**Sửa 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X11, X26, N2, N4, N19; quỹ là chốt tạm, Q9).** Bảng dưới đã sửa tại chỗ ở nhịp 4, 5, 8, 9, 11 và hai dòng đường nhanh, đường chậm:
- **Nhịp 2 và 5 là lượt đã ghi** của cấu hình khởi đầu (N4). Nhịp 2 phát câu của Minh; nhịp 5 phát cả 10 ca, tem "Lượt chạy đã ghi", 0 lời gọi, và che khoảng một phút Render thức dậy.
- **Mỗi lần chạy thật là hai bước.** Trước hết là **Thử 3 câu mẫu** (`scope=mau`, 3 lời gọi, không tính sao, có phiếu mẫu ở mục 7). Run chấm sao chỉ mở khi cả 3 câu mẫu đạt, và tốn 7 lời gọi nếu cấu hình y hệt lượt mẫu (3 câu mẫu là kết quả đã lưu), 10 nếu đã đổi ([ca trực §3.1](daily-shift.md#31-luật)).
- **Quỹ một ngày P = 13** đủ cho lượt mẫu, run sao và thêm một lượt mẫu. Đường thường: lượt mẫu 1 trượt vì thiếu nguồn (nhịp 9), người chơi bật tem và sửa Lăng kính, lượt mẫu 2 đạt, rồi run sao (nhịp 11): 3 + 3 + 7 = 13, đủ sao 1 trong buổi. Bẫy chỉ chạy trong run sao, nên trượt sao 3 thì run sao kế tiếp chờ quỹ hồi lúc 07:00. Vì vậy **đủ 3 sao ở L1 có thể trải qua vài ngày**. Thời điểm trong bảng là thời gian chơi, không tính lúc chờ quỹ hay chờ bảng xoay của lớp ([giáo án](../lesson-plan-library.md)).

| # | Thời điểm | Trên màn hình | Người chơi làm | Cô Lan nói |
|---|---|---|---|---|
| 1 | 0:00–0:20 | Hiện trường Bảng Tin (mục 3) | Click hoặc chạm tờ áp phích (nút DOM "Xem áp phích") | (im 8 giây đầu) "Sáng nay bảng tin có thêm mười hai tờ y hệt nhau. Cái Điều 47 này nổi tiếng nhanh hơn cả lịch thi." |
| 2 | 0:20–0:50 | Tua lại: câu của Minh đi vào bàn thợ. Thùng Context hiện "Tài liệu: 0 token". Bộ Óc nhả câu trả lời, tem đỏ "Không có nguồn trong thùng" | Xem; nút "Bỏ qua" | "Đây là ca đêm qua. Thùng trống trơn, vậy mà nó trả lời không chớp mắt." · rồi: "Điều 47 thì có thật, nhưng nói chuyện khác hẳn. Còn cái quy định 'chỉ cần gửi email' kia thì không điều nào có cả." |
| 3 | 0:50–1:10 | Bàn thợ cấu hình khởi đầu (mục 5). Thẻ nhiệm vụ một dòng: "10 câu tối nay · ≥6/8 câu thường đúng và có nguồn · 2 câu bẫy phải nói 'không có'" | Đọc | "Tối nay có mười câu hỏi. Mình cần ít nhất sáu trên tám câu thường đúng và có nguồn, còn hai câu bẫy thì nó phải biết nói 'không có'." |
| 4 | 1:10–1:30 | Phiếu đoán 1 (mục 7) | Chọn 1 đáp án hoặc bấm Bỏ qua (X4), rồi bấm **Xem lượt đã ghi** (~~nút **Mở ca** chỉ sáng sau khi chọn~~, sửa 2026-10-08) | ~~"Cứ chạy nguyên trạng một lần đã. Muốn chữa thì phải thấy nó ốm thế nào."~~ "Xem lại cả ca đêm qua đã. Muốn chữa thì phải thấy nó ốm thế nào." |
| 5 | 1:30–2:15 | ~~**Lần chạy thật 1.**~~ **Lượt đã ghi** của cấu hình khởi đầu (sửa 2026-10-08, N4), tem "Lượt chạy đã ghi", 0 lời gọi. Camera bám câu của Minh (`lib-l1-v01`), 9 ca còn lại thu thành bộ đếm | Xem; giữ Space để tua nhanh | Nhánh A (có áp phích mới): "Thêm {n} tờ nữa. Chú Bảy chắc đang rất vui." · Nhánh B (trả lời chung chung): "Ít ra lần này nó không bịa. Nhưng 'hỏi phòng đào tạo đi' thì Minh tự nghĩ ra được." |
| 6 | 2:15–2:45 | Phiếu đoán được chấm. Menu "Vì sao câu #1 sai?" (mục 11) | Chọn lý do, rồi xem chẩn đoán | "Không phải nó dốt đâu, nó chưa được mở sách." |
| 7 | 2:45–4:00 | Vòm Sao hạ xuống khe Truy xuất. Đèn pin chỉ chiếu được 3 câu mẫu (v01–v03). Sao sáng kèm hạng và cosine thật | Gắn Vòm Sao, xoay Móc kéo K, chiếu thử từng câu mẫu | "Vòm Sao là cả cuốn quy chế, mỗi ngôi sao là một đoạn. Chiếu đèn vào câu hỏi xem sao nào sáng." · (khi chiếu lần đầu) "Số bên cạnh là độ gần nghĩa, không phải điểm đúng sai." |
| 8 | 4:00–4:15 | ~~Phiếu đoán 2~~ Phiếu mẫu: đoán từng câu mẫu đạt hay trượt, đánh dấu Chắc hoặc Đoán (mục 7, sửa 2026-10-08) | Chọn | "Đoán trước rồi hẵng mở ca. Đoán sai cũng được, miễn là có đoán." |
| 9 | 4:15–5:00 | ~~Lần chạy 2~~ **Thử 3 câu mẫu** (3 lời gọi, sửa 2026-10-08, N2). Cả 3 câu mẫu đạt thì run chấm sao mở ngay (7 lời gọi; xem đường nhanh) | Xem | Nếu nội dung đúng mà thiếu nguồn: "Nội dung đúng rồi đấy, nhưng Minh hỏi 'ghi ở đâu' thì nó chịu. Câu trả lời không có nguồn thì không ai kiểm được." |
| 10 | 5:00–5:45 | Hậu kiểm 2: menu "Vì sao", chẩn đoán. Máy đóng tem và khay Lăng kính phát sáng trong truy vết, vì đây là bước sau run, không phải gợi ý trước run | Bật tem, thay thẻ Lăng kính, chiếu thử lại | Tem: "Máy đóng tem in mã lên từng đoạn trước khi bỏ vào thùng. Có mã thì nó mới trích được." · Lăng kính: "Lăng kính là mấy dòng dặn trước khi nó trả lời. Dặn khéo thôi, dặn thừa cũng tốn chữ." |
| 11 | 5:45–6:30 | ~~Lần chạy 3~~ Phiếu mẫu, **Thử 3 câu mẫu** lần nữa (3 lời gọi), rồi phiếu 2 và 3+ (mục 7) và **run chấm sao** khi cả 3 câu mẫu đạt (7 lời gọi). Sửa 2026-10-08 | Xem | Nếu bẫy trượt: "Có câu hỏi về một điều không hề có, mà nó vẫn kể vanh vách. Quy chế này dừng ở Điều {max_dieu} cơ mà." |
| 12 | 6:30–7:30 | Truy vết sau run: sao vàng (đoạn đáp án) và hạng thật của nó ở từng ca. Báo Tường hiện số sao. Đạt sao 1 thì chú Bảy gỡ áp phích | Mở từng ca nếu muốn | Sao 1: "Bảng tin sạch rồi. Chú Bảy dặn lần sau in ít thôi." · Sao 3: "Biết nói 'không có' đúng lúc, đó là kỹ năng mình quý nhất ở một thủ thư." |
| 13 | 7:30–8:30 | Lật mặt sau (mục 12) | Xem JSON, đồ thị, prompt thật; tải về nếu muốn | "Muốn xem nó thật sự trông thế nào không? Lật cái bàn lên là thấy." |
| 14 | 8:30–9:30 | Kiểm tra 60 giây ([teach-back.md](teach-back.md) mục 5) | Phân loại 3 câu trả lời mới | "Ba câu nhanh thôi, không tính sao." |
| — | sau level | Lời mời dạy lại Bống (tuỳ chọn) | | "Bống, học việc của mình, có vài câu muốn hỏi bạn. Giải thích được cho Bống mới là hiểu thật." |

**Đường nhanh:** người chơi gắn đủ Vòm Sao, tem và thẻ đúng ngay ở ~~lần 2~~ lượt mẫu đầu (nhịp 9) thì run chấm sao chạy ngay sau đó (3 + 7 lời gọi, sửa 2026-10-08), bỏ qua nhịp 10–11 và xong trong khoảng 6 phút.
**Đường chậm:** ~~sau mỗi lần trượt mở thêm một gợi ý (mục 11).~~ **Sửa 2026-10-08 (X15, N16):** sau lần trượt đầu, gợi ý mở theo yêu cầu; nấc sau mở bằng một thao tác nhìn miễn phí, không bằng lượt chạy (mục 11). Mục tiêu không hạ. Hết quỹ trong ngày thì người chơi vẫn xem lượt đã ghi, chiếu thử và đọc trace miễn phí.

## 5. Đồ chơi và khối Phần 3

| Đồ chơi | Khối · tham số Phần 3 | Giá trị cho phép ở L1 | Trạng thái |
|---|---|---|---|
| Chuông quầy (câu hỏi khách) | `input` | — | khoá |
| Kệ sách gốc | `corpus` | `qcdt-2024` | khoá |
| Lược dao (treo tường, có ổ khoá) | `chunker` | `strategy` = `theo_dieu`, `chunk_size` = 512, `overlap_pct` = 10 | khoá, nhìn thấy, nhãn "Mở khoá ở Lược dao chunk" |
| Vòm Sao + Đèn pin | `vector_search` | gắn hoặc tháo khỏi khe Truy xuất. Đèn pin chỉ chiếu câu có sẵn (embedding tính sẵn), không nhận chữ gõ tự do | mở |
| Móc kéo K | `vector_search.top_k` | 1–10, mặc định 5 | mở |
| Thùng Context | `context_packer` | `token_budget` = 3000 (chỉ tính tài liệu + câu hỏi; dặn dò của Lăng kính và khung nền đi riêng, ngoài thùng, engine-v0.2 E8), `on_overflow` = `cat_duoi`, `order` = mặc định engine | khoá (thùng cỡ cố định; Chợ model mới cho đổi cỡ) |
| Máy đóng tem | `context_packer.cite_ids` | `false` / `true` | mở |
| Bộ Óc | `llm.profile` | `can_bang` (effort medium) | khoá, nhãn "Bộ Óc · cân bằng" |
| Lăng kính (3 khe thẻ) | `llm.system_prompt` | ghép theo thứ tự từ ≤ 3 thẻ G1–G6 bên dưới; luôn ≤ 2000 ký tự | mở |
| Bảng trả lời | `output` | — | khoá |

**Thẻ Lăng kính.** Văn bản của các thẻ được ghép đúng nguyên văn vào `system_prompt`. Khung nền cố định của nền tảng đã quy định ngôn ngữ và dạng trích `[mã đoạn]` (Phần 3, nguyên tắc 6).

| Thẻ | Văn bản ghép vào system_prompt | Vai trò |
|---|---|---|
| G1 | "Chỉ dùng thông tin trong các đoạn tài liệu được đưa kèm." | grounding |
| G2 | "Sau mỗi ý, ghi mã đoạn đã dùng trong ngoặc vuông." | buộc trích nguồn |
| G3 | "Nếu các đoạn tài liệu không có câu trả lời, chỉ nói: «Quy chế hiện hành không có thông tin này.»" | từ chối có kiểm soát |
| G4 | "Xưng «mình», gọi người hỏi là «bạn», giọng thân thiện." | vô hại, nằm sẵn trong cấu hình khởi đầu |
| G5 | "Luôn đưa ra câu trả lời hữu ích nhất có thể, kể cả khi phải suy đoán." | bẫy, nằm sẵn trong cấu hình khởi đầu |
| G6 | "Trả lời thật đầy đủ, càng chi tiết càng tốt." | bẫy token |

**Cấu hình khởi đầu** (theo Phần 3 L1: "LLM chay" cộng corpus; JSON minh hoạ theo §3.4, tên cổng chốt theo registry):

```json
{"schema": 1,
 "nodes": [{"id": "q", "type": "input"},
           {"id": "kb", "type": "corpus", "params": {"doc": "qcdt-2024"}},
           {"id": "ix", "type": "chunker", "params": {"strategy": "theo_dieu", "chunk_size": 512, "overlap_pct": 10}},
           {"id": "pk", "type": "context_packer", "params": {"token_budget": 3000, "on_overflow": "cat_duoi", "cite_ids": false}},
           {"id": "llm", "type": "llm", "params": {"profile": "can_bang", "system_prompt": "<G4> <G5>"}},
           {"id": "out", "type": "output"}],
 "edges": [["q.query", "pk.query"], ["pk.context", "llm.context"], ["llm.answer", "out.answer"]]}
```

**Khai báo level:**
- `allowed_blocks`: input, output, corpus, chunker, vector_search, context_packer, llm.
- `locked_nodes`: `q`, `kb`, `ix`, `out`.
- `param_limits`:

```json
{"vector_search.top_k": {"ge": 1, "le": 10},
 "context_packer.token_budget": {"const": 3000},
 "context_packer.on_overflow": {"const": "cat_duoi"},
 "llm.profile": {"const": "can_bang"}}
```

- `budget_metric`: `tokens` = `usage_metadata.input_tokens + output_tokens`. Không cộng thêm cache_read, theo sửa lỗi của phản biện.
- Chưa mở ở L1: `score_threshold` và `only_in_force` (mở ở L2), mọi tham số chunker (mở ở L2), bm25, fusion, rerank (mở ở L3). Các phần này hiện mờ kèm nhãn level mở.

**Lời giải mẫu (để hiệu chỉnh, không bao giờ hiện cho người chơi):** thêm `vs` (`top_k` 3, đang chờ hiệu chỉnh) với cạnh `q.query→vs.query`, `ix.index→vs.index`, `vs.docs→pk.docs`; bật `cite_ids: true`; Lăng kính gồm G1, G2, G3.

## 6. Cấu hình ngây thơ phải trượt

Ký hiệu: **[T]** là cơ chế tất định (nguyên tắc 3 Phần 3). **[M]** là bẫy phụ thuộc model, phải qua cổng hiệu chỉnh: cắn ở cả 3/3 lần chạy thật, nếu không thì hạ ca đó thành `info`, không tính sao, và báo cáo ghi "model tự chống được, đừng dựa vào điều này".

| # | Cấu hình | Cơ chế | Ca trượt | Cờ trong vết chạy |
|---|---|---|---|---|
| N1 | Khởi đầu nguyên trạng (LLM chay, G4+G5) | [T] Thùng không có đoạn nào nên các dữ kiện bắt buộc (`answer_points`, ví dụ "hai tuần", "cố vấn học tập") không thể xuất hiện, trừ khi trùng may rủi; không có `cited_ids` hợp lệ. [M] Model bịa "Điều N" (áp phích) hay trả lời chung chung là tuỳ model | cả 3 ca thấy được (`lib-l1-v01` và hai ca còn lại) cùng 5 ca ẩn thường (8/8). Ca bẫy `t01`, `t02` có thể **đạt** nhờ model từ chối: đây là điểm dạy, không phải lỗi | `ret.gold_missing` (sau run), `llm.cite_unknown` [M], `llm.cite_missing` |
| N2 | Gắn Vòm Sao, tem tắt, giữ G4+G5 | [T] Packet không có mã đoạn, nên không thể có `cited_ids` thuộc đoạn đáp án (mã đoạn là chuỗi mờ, không suy ra được từ số điều; xem Yêu cầu A10). Tiêu chí "có nguồn" trượt | 8/8 ca thường trượt tiêu chí nguồn dù đủ ý; `t01` có thể trượt nếu G5 khiến model suy đoán [M] | `llm.cite_missing`; `llm.cite_unknown` nếu model tự chế mã [M] |
| N3 | Gắn Vòm Sao, bật tem, Lăng kính chỉ G2 (không G1, không G3) | [M] Không có lệnh từ chối nên câu Điều 99 và câu ngoài phạm vi dễ bị trả lời bằng đoạn gần nhất | `lib-l1-t01`, `lib-l1-t02` (sao 3) | `llm.cite_unknown`, trượt tiêu chí từ chối |
| N4 | Như lời giải mẫu nhưng `top_k` = 10 và thêm G6 | [T] Thùng gần đầy (≈ 2.000 token tài liệu mỗi ca) nên tổng token vượt ngân sách sao 2 (mục 10) ngay cả khi chỉ đếm token đầu vào: engine đo 21.523/15.000 (regex-v1), Gemini thật 29.091/15.000 (2026-10-08, engine-spike-report §3.2). G6 làm tăng thêm | không ca nào trượt nội dung; trượt **sao 2** | `pack.tokens`, `budget.exceeded` |
| N5 | Gắn Vòm Sao với `top_k` = 1, tem bật, G1–G3 | [T, đo 2026-10-08] Câu có điều na ná: "học kỳ hè" (`h02`) kéo Điều 10 (học kỳ chính) lên trên Điều 19 (học kỳ phụ), hạng ≥ 2 trên cả 24 biến thể, nên `top_k` 1 bỏ mất đoạn đúng. [M] Ca diễn đạt lại `v03`, `h04`, `h05`: e5 xếp đoạn đúng hạng 1 | `lib-l1-h02` (đo thêm: `h01` gõ không dấu hạng 3 ở `theo_dieu` ≥ 512). Đo 2026-10-08: ca thấy được vai `dien-dat-lai` (`v03`) đứng hạng 1 ở biến thể L1 (cosine 0,865, trên Điều 69 0,829), nên cổng phát hành cũ (hạng ≥ 2) không đạt; N5 không có ca thấy được nào trượt | `ret.gold_missing`, `ret.gold_rank` |

Cổng phát hành phải chạy đủ N1–N5 trên model thật và ghi lại cờ sinh ra cho từng ca (theo sửa lỗi của phản biện: áp cổng cho từng ca, không chỉ cho 4 bẫy đã liệt kê).

## 7. Bước đoán (1 click, trước Mở ca)

**Sửa 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) N1, N19, X4, X22).** Phiếu nào được hỏi tuỳ lượt sắp chạy, vì một phiếu chỉ chấm được trên ca mà lượt đó chạy:
- phiếu 1 trước lượt đã ghi (nhịp 4), chấm trên lượt đã ghi;
- **phiếu mẫu** trước mỗi lượt Thử 3 câu mẫu, chấm trên 3 câu mẫu;
- phiếu 2 và 3+ chỉ trước run chấm sao, vì chúng chấm trên 8 ca thường và ca bẫy `t01`, mà lượt mẫu không chạy các ca này.

Mọi phiếu bỏ qua được (X4) và có thêm cờ **Chắc / Đoán**, mặc định Đoán, thêm đúng một click.

| Lần | Câu hỏi | Lựa chọn | Chấm |
|---|---|---|---|
| Mẫu (trước mỗi lượt Thử 3 câu mẫu; N19) | "Lượt mẫu này: mỗi câu mẫu sẽ đạt hay trượt?" (câu hỏi của `v01`–`v03` hiện đủ, vì là ca thấy được) | Đạt · Trượt, cho từng câu | Theo `case.graded` của từng câu mẫu; phiếu đúng khi cả 3 dự đoán khớp. "Chắc" mà sai thì hiện thẻ Bất ngờ kèm bằng chứng (B1) |
| 1 | "Trợ lý vẫn chưa được đưa tài liệu nào. Với câu của Minh, bạn đoán nó sẽ…" | Trả lời đúng quy chế · Bịa ra một điều khoản · Nói là không biết | Theo `case.graded` của v01 trong lượt đã ghi (sửa 2026-10-08): đạt → lựa chọn 1; có `llm.cite_unknown` hoặc nhắc "Điều N" không có trong thùng → lựa chọn 2; còn lại → lựa chọn 3. Ba lựa chọn này trùng với demo trang chủ để người đã chơi demo nhận ra |
| 2 | "Với cấu hình này, bao nhiêu trong 8 câu thường sẽ đúng và có nguồn?" | 0–2 · 3–5 · 6–7 · 8 | Theo số ca thường đạt đủ 4 tiêu chí (mục 10) |
| 3+ | "Nếu có ai hỏi về một điều không có trong quy chế, trợ lý của bạn sẽ…" | Nói là không có · Trích một điều gần giống · Bịa ra nội dung | Theo `lib-l1-t01`: đạt → lựa chọn 1 (kể cả khi vừa từ chối vừa trích một đoạn có thật, mục 9); không từ chối mà trả lời bằng một đoạn có thật trong thùng → 2; có `llm.cite_unknown` → 3 |

Câu hỏi của ca ẩn và ca bẫy không bao giờ hiện cho người chơi, kể cả sau run (Phần 3 §3.7). Phiếu đoán chỉ hỏi về ca thấy được hoặc về tình huống giả định.

Phiếu đoán chỉ được chấm sau `run.finished` và không ảnh hưởng sao. Độ chính xác của phiếu qua các lần chạy là một số đo hiểu (telemetry).

**Hoàn lượt dựa trên phiếu mẫu** (sửa 2026-10-08, X22, X26; luật đầy đủ ở [ca trực §3.1](daily-shift.md#31-luật)). Chỉ xét phiếu mẫu của lượt Thử 3 câu mẫu **đầu tiên** sau lần đầu xem lượt đã ghi: một lần mỗi level, không theo ngày, và xem lại lượt đã ghi không mở thêm lần hoàn (sửa 2026-10-08, rà soát vòng 5). Máy chủ tự kiểm phần còn lại ([ca trực §3.3](daily-shift.md#33-ánh-xạ-sang-engine)). Phiếu đánh dấu Chắc, cả 3 dự đoán đúng và cả 3 câu mẫu đạt (tức phiếu chắc đoán 3/3 đạt, và đúng) thì số lời gọi mới của lượt đó được hoàn, tối đa 3, từ quỹ dự phòng chung R. Run chấm sao không bao giờ được hoàn. Lời hoàn nêu năng lực: "Hoàn 3 lời gọi: bạn đoán chắc cả ba câu mẫu và sửa đạt ngay lượt đầu."

## 8. Biên đạo lần chạy

Luật trung thực (gameplay-direction §4):
- Không phát hậu quả nào trước `case.graded` của ca đó và không đảo thứ tự event.
- Mỗi hoạt cảnh giữ 0,3–0,5 giây, tối đa 3 làn trên màn hình.
- Vị trí sao là "hình chiếu" và có nhãn; luôn in hạng và cosine thật.
- Ca trúng cache phát lại mang dòng chữ "Kết quả đã lưu" cạnh ca, đúng chữ `summary` của engine. Đó là chữ mô tả, không phải tem nguồn: lượt vẫn là lượt chạy thật, và hình vẫn mang tem "Đo từ lượt của bạn" (sửa 2026-10-08, rà soát vòng 3; [frontend architecture §8.4](../../design/frontend-architecture.md#84-tem-nguồn-và-trung-thực-số-liệu)).
- **Gold (đoạn đáp án và hạng của nó) chỉ hiện sau `run.finished`** (D4). Trong lúc chạy, `case.graded` chỉ mang đạt/trượt theo từng tiêu chí, cộng các nhãn không cần gold (`cite_unknown`, `cite_missing`, `abstained`, `skipped_budget`); xem Câu hỏi mở 2.

| Event | Hình ảnh (camera bám `lib-l1-v01`) | Bản chữ (DOM, aria-live) |
|---|---|---|
| `run.started` | Đèn ca trực bật, bộ đếm "0/10" | "Bắt đầu ca: 10 câu." |
| `step.started` (vector_search) | Đèn pin quét một vòng "đang tìm" không có thanh tiến độ | "Đang tìm đoạn liên quan." |
| `step.finished` (vector_search, `detail{chunk_ids, scores}`) | K sao sáng, mỗi sao in "#hạng · cosine"; Móc kéo thả K khối xuống thùng | "Lấy {K} đoạn: Điều 12 (0,83), Điều 13 (0,71)…" (dùng `summary` ≤ 140 ký tự của engine) |
| `step.finished` (context_packer, `pack.included`, `pack.dropped`, `pack.tokens`) | Khối xếp vào thùng, chiều cao bằng token. Nếu tem bật, mỗi khối có mã. Khối bị cắt rơi xuống sàn kèm nhãn "bị cắt" | "Thùng: 1.420/3.000 token. Bị cắt: 0 đoạn." |
| `step.finished` (llm, tokens, `cited_ids`) | Bộ Óc nhả thẻ trả lời. Câu có mã thành viên gạch nối chỉ về khối nguồn; câu không có mã thành bong bóng. Chưa phán đúng sai | "Trợ lý trả lời ({in} vào, {out} ra token)." kèm nguyên văn câu trả lời |
| `case.graded` | **ĐẠT:** Minh gật đầu ghi sổ. **TRƯỢT + `cite_unknown`:** áp phích mới ghim lên Bảng Tin; ca thấy được in nguyên câu trả lời, ca ẩn chỉ in "Điều {N} ma · ca ẩn" (ở lượt đã ghi, {N} lấy từ trường `cite_unknown` của file tĩnh, [roadmap-v0.4](../../design/roadmap-v0.4.md) B0; thêm 2026-10-08, rà soát vòng 6). **TRƯỢT vì thiếu nguồn:** bong bóng vỡ, chữ "không có nguồn". **TRƯỢT vì thiếu ý:** thẻ trả lời chuyển xám. **Bẫy từ chối đúng:** cô Lan đóng dấu "Đúng là không có" | "Câu 1: Trượt, không có nguồn." |
| `step.finished` (status ≠ ok) | timeout: đồng hồ cát đổ. budget: khối mờ "bỏ qua vì hết ngân sách" | Ghi rõ status |
| `run.scored` | Báo Tường dán lên tường: số sao, "6/8 · 2/2 bẫy · 19,4k token" | Đọc nguyên Báo Tường |
| `run.finished` | Mở màn Truy vết: mỗi ca có một sao vàng (đoạn đáp án), hạng thật của nó, và việc nó có vào thùng không | "Truy vết đã mở." |
| `run.diagnosis` | Hiện **sau** menu "Vì sao câu #N sai?": đèn bàn của cô Lan rọi vào món đồ có lỗi | Lời chẩn đoán (mục 11) |

## 9. Tiêu chí chấm một ca (máy kiểm)

Luật chuẩn hoá, `equivalents` và danh sách dấu hiệu từ chối nằm ở trường `grading` của file golden ([`library-l1.json`](../golden/library-l1.json)); mục này chỉ tóm tắt, file golden thắng khi lệch (brief §4.2).

**Ca thường (`expect: answer`) đạt khi đủ cả 4 điều:**
1. **Đủ ý:** câu trả lời (đã chuẩn hoá theo `grading`) chứa mọi mục `answer_points`, hoặc một cách viết của mục đó trong `equivalents`, ví dụ "hai tuần" hay "2 tuần".
2. **Có nguồn:** ít nhất một `cited_ids` thuộc tập đoạn chứa một `quote` của `gold`, ở biến thể index đang dùng.
3. **Không bịa:** không có `llm.cite_unknown`. Cờ này bật khi có mã trích không nằm trong thùng, hoặc câu khẳng định "theo Điều N" / "Điều N quy định" với N không phải số điều của đoạn nào trong thùng.
4. **Không chứa** mục nào của `forbidden` (ví dụ "email").

**Ca từ chối (`expect: abstain`) đạt khi** (brief §4.2, tạm chốt cho v0.1):
- có ít nhất một dấu hiệu từ chối thuộc `grading.refusal_markers` của file golden. Danh sách đó phải có tối thiểu "không có thông tin", "không tìm thấy", "không có điều", "không có khoản", "không tồn tại", "không quy định";
- không có `llm.cite_unknown`;
- không chứa mục nào của `forbidden`.

Được phép vừa từ chối vừa trích một đoạn **có thật** trong thùng, ví dụ trích Điều 12 để chỉ ra điều này chỉ có 3 khoản (`lib-l1-r02`). Chỉ trích bịa (`llm.cite_unknown`) mới trượt.

## 10. Sao

| Sao | Điều kiện | Ghi chú |
|---|---|---|
| 1 | Ít nhất 6/8 ca thường đạt (`v01`–`v03` + 5 ca ẩn), **bắt buộc có `lib-l1-v01`** | Mở L2. Chú Bảy gỡ áp phích |
| 2 | Có sao 1 **và** tổng token của run ≤ **15.000** | Ngân sách = làm tròn lên tới nghìn của 1,25 × p50 token lời giải mẫu. Hiệu chỉnh 2026-10-08 với `gemini-3.5-flash-lite`, `can_bang`: hai lần chạy 10.262 và 11.260, p50 10.761, ra 14.000 (engine-spike-report §3.2). Nâng lên 15.000 cùng ngày vì phần ra (thinking) dao động: ở 14.000 lời giải mẫu đúng vẫn mất sao 2 trong 1,6–6,3 % số lần chạy, ở 15.000 còn 0,1–1,1 % (§3.3) |
| 3 | Có sao 1 **và** `lib-l1-t01`, `lib-l1-t02` đều đạt **và** cả run không có ca nào bị `llm.cite_unknown` | Phải qua cổng hiệu chỉnh [M]. Nếu bẫy không cắn thì hạ thành `info` và sao 3 chỉ còn điều kiện "0 `cite_unknown`" |

**Đạt được bằng đồ chơi đã mở?** Có.
- Sao 1 cần Vòm Sao, tem và `top_k` ≥ 2 (mở ở L1).
- Sao 2 cần `top_k` nhỏ và không dùng G6 (mở ở L1).
- Sao 3 cần G1 và G3 (mở ở L1).

Lời giải mẫu phải đạt 3 sao ở 3/3 lần chạy thật (Phần 3 §3.9).

## 11. Chẩn đoán và gợi ý

**Menu "Vì sao câu #N sai?"** hiện trước lời chẩn đoán (Johnson & Mayer). Chọn xong mới thấy chẩn đoán; chọn sai không bị phạt.

| Tình huống | Lựa chọn (in đậm là đáp án) |
|---|---|
| Lần 1, v01 trượt | **Không có đoạn tài liệu nào trong thùng, model tự lấp chỗ trống** · Model quá yếu · Câu hỏi của Minh mơ hồ · top_k quá thấp |
| Đủ ý nhưng thiếu nguồn | Model quên trích dẫn · **Các đoạn trong thùng không mang mã, nên không có gì để trích** · Vòm Sao lấy sai đoạn · Thùng bị cắt |
| Ca bẫy "điều không tồn tại" bị trả lời | **Không có lệnh "không thấy thì nói không có", lại có lệnh "cứ suy đoán"** · top_k quá thấp · Kho thiếu điều đó nên phải thêm vào · Model không đọc được số |
| Vượt ngân sách | **Kéo nhiều đoạn quá và dặn trả lời dài, nên thùng gần đầy ở mọi câu** · Model chọn sai · Câu hỏi dài · Có ca timeout |

**Lời chẩn đoán gắn với bằng chứng.** Dùng placeholder lấy từ facts; chỉ hiện sau `run.finished`.

| Cờ | Cô Lan nói |
|---|---|
| `ret.gold_missing` (không có retrieval) | "Câu #{n} cần một đoạn trong Điều {dieu}. Đoạn đó chưa từng vào thùng, thùng chỉ có {pack_tokens} token chữ dặn dò." |
| `ret.gold_rank` > K | "Đoạn đúng của câu #{n} đứng hạng {rank} ở Vòm Sao, mà Móc kéo chỉ kéo {k} sao." |
| `llm.cite_missing` | "Câu #{n} nói đúng ý, nhưng không chỉ ra lấy từ đâu. Thùng có {m} đoạn, không đoạn nào mang mã." |
| `llm.cite_unknown` | "Câu #{n} trích {cite}, nhưng thùng chỉ có {dieu_list}. Đó là thứ dán lên bảng tin đấy." |
| bẫy trượt | "Có ca bẫy hỏi về một điều không hề có, mà nó kể vanh vách. Quy chế này dừng ở Điều {max_dieu}." (không hiện câu hỏi của ca bẫy) |
| `budget.exceeded` | "Run này tốn {tokens} token, ngân sách là {budget}. Trung bình mỗi câu kéo {avg_docs} đoạn vào thùng." |

**Ba gợi ý tăng dần** (Hades/God Mode: thêm bằng chứng, không hạ mục tiêu).
- ~~Gợi ý *n* mở sau lần trượt thứ *n*, hoặc khi người chơi bấm "Gợi ý" sau một lần trượt.~~ **Sửa 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X15, N16):** sau lần trượt đầu, gợi ý mở theo yêu cầu; gợi ý *n*+1 chỉ mở khi người chơi đã làm một thao tác nhìn miễn phí kể từ gợi ý *n* (đổi một đồ chơi, chiếu đèn, hoặc mở trace của câu trượt). Không phải tiêu lượt chạy để được giúp. Mỗi gợi ý nêu một số câu (#n) và chỉ vào một thứ đang hiện trên màn; gợi ý 1 nên là câu hỏi có/không người chơi tự trả lời bằng trace ("Đoạn đúng của câu #1 đã vào thùng chưa?").
- **Gợi ý 3 là lời giải, nên có cổng riêng (sửa 2026-10-08, N16, [roadmap-v0.4](../../design/roadmap-v0.4.md) X28; chốt tạm, roadmap Q9).** Gợi ý 3 chỉ mở khi đủ cả ba điều:
  1. đã mở gợi ý 2 và đã làm một thao tác nhìn miễn phí kể từ đó (một mình thao tác nhìn không mở gợi ý 3);
  2. đã có ít nhất một lượt chấm trượt ở sao đó: một run chấm sao trượt, hoặc, ~~riêng sao 1~~ ở sao thấp nhất chưa đạt (trước khi có sao 1 là sao 1; sửa 2026-10-08, rà soát vòng 6), một lượt Thử 3 câu mẫu có câu mẫu trượt (~~Lượt "Thử 3 câu mẫu" không phải lượt chấm~~, sửa 2026-10-08, rà soát vòng 5). Lượt hỏng vì `DailyCap` cạn không tính ([ca trực §3.3](daily-shift.md#33-ánh-xạ-sang-engine));
  3. hoặc đã trượt lượt chấm thứ ba ở sao đó, đếm cả các ngày trước, hoặc quỹ học viên còn lại không đủ cho thêm một lượt chấm (run chấm sao L1 tối đa 10 lời gọi, L2 và L3 tối đa 13; khi lượt trượt gần nhất là lượt mẫu thì so với giá lượt mẫu, 3, với "gần nhất" là lượt trượt được tính gần nhất ở chính sao đó (sửa 2026-10-08, rà soát vòng 6); giá từng lượt ở [ca trực §3.1](daily-shift.md#31-luật)).

  Chỉ đếm lượt trượt trên các cấu hình khác nhau: chạy lại y hệt một cấu hình đã trượt là kết quả đã lưu, 0 lời gọi, nên không đếm thêm. **Người kẹt ở câu mẫu** (sửa 2026-10-08, rà soát vòng 5, [roadmap-v0.4](../../design/roadmap-v0.4.md) X28; chốt tạm, Q9): run chấm sao chỉ mở khi cả 3 câu mẫu đạt (N2), nên nếu lượt mẫu không bao giờ tính thì người trượt mãi ở câu mẫu, ví dụ ở `lib-l1-v01` (ca bắt buộc của sao 1), không bao giờ có lượt chấm trượt và chỉ được gợi ý 1, 2, kể cả qua nhiều ngày. Vì vậy lượt mẫu có câu trượt tính là lượt chấm trượt ở sao 1: câu mẫu là ca thường của sao 1, và chúng chặn đường tới mọi run chấm sao. Cũng vì lý do thứ hai, nó tính cho sao thấp nhất chưa đạt (sửa 2026-10-08, rà soát vòng 6): người đã có sao 1 mà làm vỡ câu mẫu khi sửa cho sao 2 hay 3 cũng kẹt như vậy. Ở P = 13, người kẹt ở câu mẫu tới được gợi ý 3 ngay trong ngày: sau lượt mẫu trượt thứ ba trên ba cấu hình khác nhau (9 lời gọi), hoặc khi quỹ còn dưới 3. Lượt mẫu đạt cả 3 câu không tính gì.

  Gợi ý 3 trình bày như **ví dụ mẫu**. Ngay sau đó người chơi nhận một câu biến thể và phải tự sửa không gợi ý: một ca ôn `lib-l1-rNN` chưa gặp, thuộc thẻ khái niệm của sao đang trượt (cột "Câu biến thể sau gợi ý 3" ở [ca trực §2](daily-shift.md#2-chọn-sự-cố-móc-fsrs-chỉ-mô-tả): sao 1 là `grounding.citation`, sao 3 là `grounding.abstention`). Sao 2 của L1 không có câu biến thể: nó là ngân sách token của cả run, một ca lẻ không đo được, nên gợi ý 3 của sao 2 chỉ nêu hướng (bảng dưới) và bài tự sửa là run chấm sao kế tiếp; không gọi `scope=bien_the`, không trừ R (sửa 2026-10-08, rà soát vòng 3). Lượt một câu này chạy bằng `POST /api/runs?scope=bien_the&case=…` (B0), tốn 1 lời gọi lấy từ quỹ dự phòng chung R, không trừ quỹ học viên; R hết thì câu biến thể chờ lượt đầu tiên sau khi quỹ hồi. Ca đã dùng được đánh dấu là đã gặp, để ca trực không dùng lại ngay. Sao vẫn tính trên run đầy đủ như thường.
- Gợi ý nhắm vào tiêu chí sao thấp nhất chưa đạt.
- Không gợi ý nào đổi ngưỡng.

| Mục tiêu đang trượt | Gợi ý 1 | Gợi ý 2 | Gợi ý 3 |
|---|---|---|---|
| Sao 1 (chưa truy xuất) | "Nhìn vào thùng lúc Bộ Óc trả lời câu #1: trong đó có gì?" | Thanh token của packet: "Dặn dò 120 · Tài liệu 0 · Câu hỏi 32" | "Gắn Vòm Sao vào khe Truy xuất rồi chiếu thử câu của Minh." |
| Sao 1 (thiếu nguồn) | "Minh hỏi 'ghi ở đâu thế ạ?'. Trợ lý trả lời được không?" | Packet thật của câu #1, cho thấy các đoạn không có mã | "Bật Máy đóng tem, và cho Lăng kính một thẻ đòi ghi mã." |
| Sao 3 | "Đọc lại thẻ đang cắm trong Lăng kính, từng chữ một." | "Cả hai ca bẫy là câu mà kho không có đáp án." kèm cờ của chúng (ví dụ `llm.cite_unknown`) và danh sách số điều đã vào thùng, không kèm câu hỏi | "Rút thẻ 'kể cả khi phải suy đoán'. Thêm thẻ dặn nói 'không có' khi tài liệu không có." |
| Sao 2 | "Câu nào tốn nhiều token nhất? Nó kéo bao nhiêu đoạn?" | Dải token theo ca, sắp từ cao xuống | "Thử Móc kéo nhỏ hơn và bỏ thẻ 'càng chi tiết càng tốt'; chiếu thử để xem đoạn đúng còn trong K không." |

## 12. Lật mặt sau

**Mở sau mỗi lần chạy.** Gồm ba tab, và ẩn dụ đặt cạnh tên thật.
1. **Cấu hình:** graph JSON thật của lần chạy (định dạng §3.4) với tên khối Phần 3. Mỗi đồ chơi có nhãn tên thật, ví dụ "Móc kéo K = `vector_search.top_k`".
2. **Đồ thị:** đoạn LangGraph rút gọn do compiler sinh ra:

   ```python
   g = StateGraph(CaseState)
   g.add_node("vs", instrumented(vector_search, {"top_k": 3}, deps))
   g.add_node("pk", instrumented(context_packer, {"token_budget": 3000, "cite_ids": True}, deps))
   g.add_node("llm", instrumented(llm, {"profile": "can_bang", "system_prompt": SP}, deps))
   g.add_edge(START, "vs"); g.add_edge("vs", "pk"); g.add_edge("pk", "llm"); g.add_edge("llm", END)
   ```

3. **Prompt thật (X-quang):** prompt gửi cho model ở câu đang chọn, tô màu theo nguồn (khung nền, dặn dò, tài liệu kèm mã, câu hỏi) và ghi số token từng phần.

Nút: "Tải cấu hình (JSON)", "Tải đoạn đồ thị (Python)". Histogram token của các lời giải 3 sao trong lớp (ẩn danh, không hiện cấu hình) đặt ở cuối.

**Thẻ "Ngoài đời thật"**
- Dữ liệu riêng thì model không biết. Quy trình tối thiểu là: chia đoạn → embedding → lưu → tìm top-k → chèn vào prompt.
- Lưu mã nguồn (tệp, mục, ngày) cùng mỗi đoạn. Không có mã thì không trích được, và người dùng không kiểm lại được.
- Dặn model chỉ trả lời từ tài liệu; không thấy thì nói là không có và gợi ý bước tiếp theo, ví dụ liên hệ phòng ban nào.
- Đo hai số: tỉ lệ câu có trích dẫn hợp lệ, và tỉ lệ từ chối đúng trên các câu ngoài phạm vi. Bộ test nên có sẵn vài câu ngoài phạm vi.

```python
res = collection.query(query_texts=[cau_hoi], n_results=3)          # ví dụ với Chroma
doan = "\n".join(f"[{i}] {d}" for i, d in zip(res["ids"][0], res["documents"][0]))
system = ("Chỉ trả lời bằng thông tin trong các đoạn dưới đây, ghi [mã] sau mỗi ý. "
          "Nếu không có, nói: 'Không có thông tin này trong tài liệu.'")
```

## 13. Dạy lại

Bống hỏi: **"Hôm qua trợ lý nói về Điều 47, ca sáng hỏi em vì sao. Anh chị giải thích giúp em với?"**

Khuôn nhập và rubric ở [teach-back.md](teach-back.md) mục 3.1. Bằng chứng người chơi chọn lấy từ ~~vết chạy thật của chính họ (lần chạy 1)~~ vết của lần chạy 1, nay là lượt đã ghi (sửa 2026-10-08, N4), hoặc từ các lượt thật của chính họ.

## 14. Biến thể ôn cho ca trực

Câu hỏi và tiêu chí chấm của từng ca nằm ở file golden; bảng này chỉ ghi vai và sự cố dựng sẵn.

| Ca ôn | Vai | Sự cố dựng sẵn cho ca trực | Đồ chơi người chơi phải sửa |
|---|---|---|---|
| `lib-l1-r01` | Biến thể của v01: hỏi bảo lưu được tối đa bao lâu (Điều 12 khoản 1) | "Bống tắt Máy đóng tem cho đỡ rối" | bật tem (+ thẻ G2) |
| `lib-l1-r02` | Biến thể của t01: hỏi một khoản không tồn tại của điều có thật, ví dụ "Điều 12 khoản 9" | "Lăng kính bị cắm lại thẻ 'cứ suy đoán'" | rút G5, cắm G3 |
| `lib-l1-r03` | Biến thể của t02: câu đời sống trong khuôn viên nhưng ngoài quy chế | Vòm Sao bị tháo, chỉ còn LLM chay | gắn lại Vòm Sao, giữ G3 |
| `lib-l1-r04` | `su-kien` hỏi bằng lời viết tắt kiểu nhắn tin, ở một điều khác Điều 12 | "Bống tháo Vòm Sao cho trợ lý trả lời nhanh hơn" | gắn lại Vòm Sao, giữ tem và G1–G3 |

## 15. Tiếp cận

| Ẩn dụ | Bản chữ tương đương (luôn có trong DOM, canvas để `aria-hidden`) |
|---|---|
| Áp phích Bảng Tin | Ca thấy được: "Áp phích: «{câu trả lời}». Câu này trích {cite}, không có trong tài liệu đã lấy." Ca ẩn hoặc bẫy: "Áp phích từ một ca ẩn: trích {cite}, không có trong tài liệu đã lấy" (không in câu trả lời, vì nó lộ câu hỏi). Danh sách áp phích là một `<ul>` đọc được |
| Vòm Sao, sao sáng | Bảng "Hạng · Điều/khoản · Cosine · Trích đoạn 120 ký tự", kèm chú thích "Vị trí sao là hình chiếu, không có nghĩa" |
| Móc kéo K | `<input type="range" min="1" max="10">` có nhãn "Số đoạn lấy về (top_k)" và giá trị đọc to |
| Thùng Context | "Thùng: {used}/3.000 token ({pct}%). Gồm: tài liệu {b}, câu hỏi {c}. Dặn dò {a} token đi riêng, không tính vào thùng." |
| Máy đóng tem | Công tắc "Đóng mã lên từng đoạn (cite_ids)" |
| Lăng kính | 3 `<select>` thẻ, có đọc nguyên văn thẻ |
| Gạch / bong bóng | Câu trả lời hiện theo từng câu, mỗi câu kèm "nguồn: [mã]" hoặc "không có nguồn" |
| ĐẠT / TRƯỢT | Luôn có chữ, không chỉ dựa vào màu |
| Sao vàng sau run | "Đoạn đáp án: Điều {d} khoản {k}, hạng {r}, {vào thùng / không vào thùng}." |

- `prefers-reduced-motion`: bỏ bay giấy, gió và rung áp phích; camera cắt cảnh thay vì lia.
- Mọi đồ chơi dùng được bằng bàn phím. Thứ tự Tab đi theo luồng: Chuông → Truy xuất → Thùng → Bộ Óc → Mở ca.
- aria-live chỉ thông báo ca đang bám và tổng kết, không đọc từng event của 10 ca.

## 16. Telemetry (phễu)

`lvl.open` → `hientruong.view` → `hientruong.click` → `goal.view` → `predict.submit{run:1, choice}` → `run.start{run:1}` → `run.end{run, stars, pass_normal, pass_trap, tokens, cache_hit}` → `diag.menu.answer{case, choice, correct}` → `toy.first_touch{toy}` → `preview.spotlight{case, k}` → `hint.open{n, target_star}` → `run.start{run:n}` … → `flipside.open{tab}` → `export.click{kind}` → `check60.submit{score}` → `teachback.open` → `teachback.submit{score}` → `lvl.complete{stars, runs, minutes}`; nếu rời giữa chừng thì `lvl.leave{last_step}`.

**Sửa 2026-10-08 (N4, N2, N19):** `run:1` là lượt đã ghi, không tốn lời gọi; `predict.submit` thêm `confident` (Chắc/Đoán) và `kind` (`1`, `mau`, `2`, `3`); `run.start` thêm `scope` (`da_ghi`, `mau`, `sao`); thêm `quota.refund{calls}`.

**KPI cần theo dõi:**
- p50 thời điểm `run.start{run:1}` (lượt đã ghi) ≤ 3 phút;
- p50 thời lượng level 5–10 phút;
- tỉ lệ đạt sao 1;
- tỉ lệ đúng của phiếu đoán tăng từ lần 1 đến lần cuối;
- tỉ lệ chọn đúng lý do trong menu "Vì sao".

## 17. Câu hỏi mở

1. **Câu bịa của Hiện trường.** Câu nguyên văn trong brief có thể không phải là đầu ra thật của ~~Opus 5.5~~ model chính (`gemini-3.5-flash-lite`; sửa 2026-10-08, engine chạy Gemini theo [đặc tả §8.4](../../specs/2026-10-07-v-game-design.md#84-llm)) ở cấu hình khởi đầu. Đề xuất: cổng hiệu chỉnh ghi lại đầu ra thật. Nếu khác, Tua lại đóng tem "dựng lại để minh hoạ" và lần chạy 1 cho thấy câu thật. Cần leader xác nhận.
2. **Nhãn trong `case.graded`.** Phần 3 §3.8 nói `case.graded` chỉ mang đạt/trượt; gameplay-direction thêm `labels` và `extracted`. Kịch bản này chỉ cho dùng **nhãn không cần gold** trong lúc chạy và để mọi thứ cần gold tới sau `run.finished` (D4). Cần chủ Phần 4 chốt.
3. **Xem trước trước khi chạy.** Phần 3 nguyên tắc 5 ("không gợi ý gì trước khi chạy") lệch với phần xem trước tất định của gameplay-direction. Kịch bản cho chiếu đèn ở **3 câu mẫu**: hiện hạng, cosine và chữ của đoạn, không đánh dấu đoạn đáp án, không đo độ phủ. **Đã chốt 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X11):** duyệt như trên, cộng một điều: màn mở bằng lượt đã ghi của cấu hình khởi đầu, nên cú vấp đầu tiên đến trước mọi phần xem trước; đáp án chỉ lộ sau `run.finished`.
4. **Đã đóng.** Câu hub (brief §4, câu 1) đã sửa thành "…còn gán cho Điều 47 một quy định không hề có." Nó khớp kho, vì Điều 47 có thật và nói về đề nghị xem xét lại điểm đánh giá quá trình. Câu thoại nhịp 2 nối tiếp câu hub: Điều 47 có thật, còn quy định "chỉ cần gửi email" thì không điều nào có.
5. **Đèn pin.** gameplay-direction cho đèn pin xoay theo embedding thật của câu gõ vào; Phần 3 §3.7 chỉ embed lúc chạy ở W3, và brief loại embedding lúc chạy. Kịch bản chỉ cho chiếu các câu có sẵn. **Đã chốt 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X16):** không gõ tự do; ngoài 3 câu mẫu, đèn pin chiếu được khoảng 20 cụm thăm dò tính sẵn, chọn tay để không cụm nào trúng đoạn đáp án của câu ẩn hay câu bẫy.
6. **Profile khoá `can_bang` ở cả khu Thư viện,** vì Thư viện mở trước Chợ (D1). Ngân sách sao 2 hiệu chỉnh theo profile này.
7. **Phần 3 §3.7 gọi kho là "Bộ luật Thị trấn",** trong khi D6 đổi thành quy chế của Trường Đại học Sao Mai. Cần sửa Phần 3 khi chỉnh lại (kịch bản không sửa).
8. **Tạm chốt (brief §4.2).** `llm.cite_unknown` tính cả câu "theo Điều N" / "Điều N quy định" không kèm mã khi N không có trong thùng. Câu từ chối không bị tính, và được trích đoạn có thật trong thùng; chỉ trích bịa mới trượt (mục 9). Chủ Phần 4 xác nhận khi viết evaluator.
9. **`grading` của file golden.** Lúc đọc (2026-10-07), `grading` trong ba file golden vẫn là một chuỗi và còn ghi "ca abstain … không có cited_ids". Cần chuyển thành object có `refusal_markers` và sửa luật abstain theo brief §4.2. Đây là việc của người viết nội dung; kịch bản đã viết theo brief.
