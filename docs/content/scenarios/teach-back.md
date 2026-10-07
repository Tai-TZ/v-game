> **Trạng thái:** thiết kế v0.1, chưa xây. **Nguồn:** đặc tả §7 ("Dạy lại cho NPC, chấm theo rubric"); research §3.5 (Johnson & Mayer 2010: chọn lý do từ menu giúp chuyển giao, tự gõ thì không); research "Đo xem người chơi có hiểu thật không" (Capewell và cộng sự 2024: kiểm tra ngay sau can thiệp).
> **Liên quan:** [L1](library-l1-grounded-citation.md) §13 · [L2](library-l2-chunk-tuning.md) §13 · [L3](library-l3-article-number-lookup.md) §13 · [Nhân vật](npc-cast.md)

# Dạy lại cho Bống

## 1. Cách hoạt động

**Bống** là học việc ca tối của cô Lan: nhiệt tình, hay tìm mẹo tắt, và chính là người chỉnh Lược về 128 ở L2. Sau mỗi level Thư viện, Bống hỏi người chơi **một câu** về đúng chỗ trợ lý vừa sai, vì ca sáng sẽ hỏi lại Bống.

- **Tuỳ chọn, không chặn tiến độ, không tính sao.** Điểm dạy lại là số đo mức hiểu, tách khỏi số sao (research: "Tin vào số sao" là bẫy).
- **Không viết bài luận.** Mọi ô chấm điểm là menu hoặc ô có cấu trúc, nên máy chấm được. Có thêm một ô ghi chú tự do ≤ 140 ký tự, không chấm, giáo viên đọc được.
- **Bằng chứng lấy từ vết chạy thật của chính người chơi.** Hệ thống sinh 4 thẻ bằng chứng từ facts của lần chạy người chơi chọn: 1–2 thẻ quyết định, còn lại là dữ kiện đúng nhưng không liên quan. Nếu run của người chơi không có tình huống cần hỏi (ví dụ họ không bao giờ trượt), dùng run đã ghi của cấu hình khởi đầu, đóng tem "kết quả đã lưu".
- **Thời lượng:** 2–3 phút.

**Phản ứng của Bống theo điểm** (tổng 8):

| Điểm | Bống nói | Sau đó |
|---|---|---|
| 7–8 | "Em hiểu rồi! Ca sáng mà hỏi là em kể lại y như anh chị." | Cô Lan: "Dạy được Bống là chuyện không nhỏ đâu." |
| 5–6 | "Em hiểu gần hết, riêng chỗ {tiêu chí thấp nhất} em vẫn lơ mơ." | Mở lại thẻ bằng chứng liên quan |
| 0–4 | "Em vẫn chưa thông lắm… Mình xem lại vết chạy cùng nhau nhé?" | Mở truy vết, tô sáng thẻ quyết định; cho làm lại một lần, không trừ gì |

## 2. Khuôn nhập (chung cho mọi level)

| Ô | Dạng | Chấm |
|---|---|---|
| A. Chuyện gì xảy ra? | Menu 4 lựa chọn (triệu chứng) | Không chấm; dùng để phân luồng câu hỏi tiếp theo |
| B. Vì sao? | Menu 4 lựa chọn (cơ chế, dùng thuật ngữ thật) | Rubric |
| C. Bằng chứng nào cho thấy vậy? | Chọn 1–2 trong 4 thẻ sinh từ vết chạy | Rubric |
| D. Sửa thế nào? | Có cấu trúc: chọn khối + tham số + giá trị hoặc chiều (tăng, giảm, bật, tắt) | Rubric |
| E. Khi nào cách sửa này không đủ? | Menu 4 lựa chọn | Rubric |
| Ghi chú | Chữ tự do ≤ 140 ký tự | Không chấm |

Mỗi level chọn 4 trong các ô B–E làm tiêu chí rubric, mỗi tiêu chí 0–2 điểm, tổng 8. **Đạt khi ≥ 5.**

**Luật chấm ô C** (thẻ bằng chứng):
- **2 điểm:** có ít nhất 1 thẻ quyết định và không có thẻ không liên quan.
- **1 điểm:** có thẻ quyết định kèm 1 thẻ không liên quan.
- **0 điểm:** không có thẻ quyết định.

## 3. Rubric và bài mẫu theo level

### 3.1 L1 · Thôi bịa điều luật

Bống hỏi: "Hôm qua trợ lý nói về Điều 47, ca sáng hỏi em vì sao. Anh chị giải thích giúp em với?"

| Tiêu chí | 2 điểm | 1 điểm | 0 điểm |
|---|---|---|---|
| **B. Cơ chế** | "Thùng không có đoạn tài liệu nào, model lấp chỗ trống bằng một câu nghe hợp lý" | "Trợ lý chưa có bước truy xuất" (đúng thành phần, chưa nói vì sao lại bịa) | "Model quá yếu, cần model lớn hơn" · "Câu hỏi của Minh mơ hồ" |
| **C. Bằng chứng** (thẻ từ lần chạy 1) | Quyết định: "Thùng câu #1: tài liệu 0 token" · "Câu trả lời #1 nhắc Điều 47, thùng không có điều nào" | (theo luật ô C) | Không liên quan: "Câu #1 tốn 740 token" · "Ca bẫy đạt 2/2" |
| **D. Sửa** (chọn nhiều) | Có **cả** "Gắn Vòm Sao (`vector_search`)" **và** "Bật tem (`cite_ids`)", không chọn "Đổi Bộ Óc lớn hơn" hay "Móc kéo lên 10" | Chỉ có "Gắn Vòm Sao" | Không có truy xuất, hoặc chỉ "Đổi Bộ Óc lớn hơn" |
| **E. Giới hạn** | "Khi kho không có câu trả lời: lúc đó trợ lý phải biết nói 'không có'" **hoặc** "Khi Vòm Sao lấy sai đoạn, đoạn đúng không vào thùng" | — | "Không bao giờ, có truy xuất là hết bịa" · "Khi câu hỏi bằng tiếng Anh" |

**Bài mạnh (8/8):**
- B: "Thùng không có đoạn tài liệu nào, model lấp chỗ trống bằng một câu nghe hợp lý" → **2**.
- C: chọn "Thùng câu #1: tài liệu 0 token" → **2**.
- D: Gắn Vòm Sao + Bật tem + rút thẻ G5 → **2**.
- E: "Khi kho không có câu trả lời…" → **2**.
- Ghi chú: "Không có sách thì nó vẫn trả lời, chỉ là trả lời bằng trí tưởng tượng."

**Bài yếu (2/8):**
- B: "Model quá yếu, cần model lớn hơn" → **0**.
- C: chọn "Câu #1 tốn 740 token" và "Thùng câu #1: tài liệu 0 token" → **1** (có thẻ quyết định nhưng kèm thẻ không liên quan).
- D: "Đổi Bộ Óc lớn hơn" + "Gắn Vòm Sao" → **1**. Có truy xuất nhưng thiếu tem; chọn đổi model không trừ thêm vì đã mất mức 2.
- E: "Không bao giờ, có truy xuất là hết bịa" → **0**.
- Nhận xét tự động cho giáo viên: hiểu lầm "model to hơn sẽ hết bịa" vẫn còn (Ngày 7, slide 56/60: hầu hết là do dữ liệu, không phải do model).

### 3.2 L2 · Lược dao chunk

Bống hỏi: "Em chỉnh lược 128 cho gọn mà sao hỏng ạ? Lần sau em nên chỉnh thế nào?"

| Tiêu chí | 2 điểm | 1 điểm | 0 điểm |
|---|---|---|---|
| **B. Cơ chế** (câu của Hà) | "Cắt 128 làm khoản 3 (ngoại lệ) rơi sang đoạn khác, và đoạn đó không được kéo về" | "Đoạn quá nhỏ" · "top_k quá thấp" (đúng một phần) | "Model không đọc kỹ" |
| **C. Bằng chứng** | Quyết định: "Điều 12 ở 128/0: khoản 2 ở đoạn {a}, khoản 3 ở đoạn {b}; đoạn {b} hạng {r} > K" | (theo luật ô C) | Không liên quan: "Thùng câu #1: 1.100/3.000 token" · "Câu #2 tốn ít token nhất" · "Ca bẫy có giấy 2019" (đúng nhưng là lỗi khác) |
| **D. Sửa** (cấu trúc: strategy, size, overlap, top_k, lọc) | (`theo_dieu`, size ≥ 256) **hoặc** (`co_dinh`, size ≥ 512, overlap ≥ 10); **và** top_k ≤ 5; **và** bật lọc hiệu lực | Sửa đúng phần chunk nhưng top_k ≥ 8 hoặc không bật lọc | Chỉ tăng top_k lên 10 |
| **E. Hiểu lầm top-k:** "Nếu chỉ kéo Móc kéo lên 10 thì…" | "Thùng đầy, đoạn thừa đẩy đoạn đúng ra ngoài và kéo cả bản 2019 vào; token tăng" | "Tốn token hơn, đúng hay không còn tuỳ" | "Chắc chắn hơn vì lấy được nhiều hơn" · "Không đổi gì" |

**Bài mạnh (8/8):**
- B: "Cắt 128 làm khoản 3 rơi sang đoạn khác…" → **2**.
- C: thẻ "khoản 3 ở đoạn 8, hạng 11 > K = 3" → **2**.
- D: `theo_dieu`, 512, 10%, top_k 3, bật lọc → **2**.
- E: "Thùng đầy, đoạn thừa đẩy đoạn đúng ra…" → **2**.

**Bài yếu (2/8):**
- B: "top_k quá thấp" → **1**.
- C: chọn "Thùng câu #1: 1.100/3.000 token" → **0**.
- D: giữ `co_dinh` 128/0, top_k 10, không lọc → **0**.
- E: "Tốn token hơn, đúng hay không còn tuỳ" → **1**.
- Ghi chú hệ thống: hiểu lầm "top-k càng lớn càng chắc" vẫn còn.

### 3.3 L3 · Hỏi bằng số điều

Bống hỏi: "Sao Vòm Sao giỏi thế mà lại thua cái tủ ngăn kéo ạ? Thế bỏ hẳn Vòm Sao đi được không?"

| Tiêu chí | 2 điểm | 1 điểm | 0 điểm |
|---|---|---|---|
| **B. Điểm mù của tìm theo nghĩa** | "Số hiệu như '47' gần như không mang nghĩa, nên tìm theo nghĩa xếp các điều có lời văn giống câu hỏi (74, 41) lên trên" | "top_k quá thấp" | "Vòm Sao bị hỏng" · "Điều 47 bị cắt nhỏ quá" |
| **E. Bỏ hẳn Vòm Sao được không?** | "Không: câu hỏi bằng lời thường không trùng chữ với điều luật, tìm từ khoá sẽ trượt" | — | "Được, ngăn kéo tốt hơn" · "Được, nếu thêm Kính lúp" (kính lúp không cứu được đoạn chưa từng được lấy về) · "Không, vì Vòm Sao nhanh hơn" |
| **C. Bằng chứng** | Quyết định: "Đường đời hạng câu #1: dense #{r_d} → BM25 #1 → gộp #{r_f} → kính lúp #{r_r}" · "Ca diễn đạt lại: BM25 không có mặt, dense #{r}" | (theo luật ô C) | Không liên quan: "Kính lúp mất {ms} ms" · "Thùng 1.700/3.000" |
| **D. Sửa** (cấu trúc) | Dense + BM25 + gộp (RRF, hoặc alpha ≤ 0,5), **và** ít đoạn vào thùng (kính lúp `top_n` ≤ 5 hoặc phễu ≤ 5), **và** giữ cách cắt đã đạt ở L2 | Hybrid nhưng phễu 10 không kính lúp (vượt ngân sách), hoặc alpha ≥ 0,7 | Chỉ BM25, hoặc chỉ dense với top_k cao nhất |

**Bài mạnh (8/8):**
- B → **2**.
- E: "Không: câu hỏi bằng lời thường…" → **2**.
- C: thẻ đường đời hạng → **2**.
- D: dense 5 + BM25 5 + RRF k 60 phễu 10 + kính lúp 3, giữ `theo_dieu` 512/10 → **2**.
- Ghi chú: "Ngăn kéo thấy chữ, Vòm Sao thấy nghĩa. Gộp hai cái rồi soi lại ba đoạn đầu."

**Bài yếu (2/8):**
- B: "top_k quá thấp" → **1**.
- E: "Được, nếu thêm Kính lúp" → **0**.
- C: chọn "Kính lúp mất 420 ms" và đường đời hạng → **1**.
- D: chỉ BM25 + kính lúp → **0**.
- Ghi chú hệ thống: chưa thấy điểm mù của BM25; nghĩ rerank sửa được lỗi truy xuất.

## 4. Lưu và hiển thị

- Mỗi lần dạy lại lưu: `{level, run_id, answers, scores_by_criterion, total, version}`. Không lưu chữ ghi chú vào analytics, chỉ lưu cho giáo viên.
- Giáo viên thấy phân bố điểm theo tiêu chí của cả lớp, ví dụ "62% lớp được 0 ở L3-E", và dùng nó cho buổi debrief.
- Không có bảng xếp hạng điểm dạy lại.

## 5. Kiểm tra 60 giây sau level (Capewell)

**Cách chạy:**
- Chạy ngay sau Lật mặt sau, trước lời mời dạy lại.
- 3 mục **mới**, không lấy từ ca của level. Dùng một văn bản hư cấu khác (nội quy ký túc xá, bảng phí gửi xe…) để đo chuyển giao chứ không đo trí nhớ.
- Mỗi mục là 1 click, có đồng hồ 60 giây cho cả 3 mục; hết giờ thì mục chưa làm tính là bỏ trống.
- Không tính sao, không hiện đáp án đúng ngay. Người chơi xem đáp án ở cuối, kèm một dòng giải thích.
- Kết quả là chỉ số giữ lại ngắn hạn. Bài kiểm tra muộn 2–4 tuần dùng bộ trước/sau trong `docs/content/golden/library-assessment.json` (người viết nội dung soạn).

### L1: câu trả lời này thuộc loại nào?

Đoạn đã lấy: **[k1]** "Ký túc xá đóng cổng lúc 23 giờ." · **[k2]** "Khách thăm phải rời phòng trước 21 giờ."
Lựa chọn cho mỗi mục: Có nguồn, đúng · Bịa nguồn · Từ chối đúng · Từ chối sai.

| # | Câu hỏi | Câu trả lời của trợ lý | Đáp án | Giải thích |
|---|---|---|---|---|
| 1 | "Mấy giờ ký túc xá đóng cổng?" | "23 giờ [k1]." | Có nguồn, đúng | Ý khớp đoạn k1, mã có trong thùng |
| 2 | "Có được nuôi mèo trong phòng không?" | "Theo Điều 8 nội quy, được nuôi mèo dưới 3 kg." | Bịa nguồn | Không đoạn nào nói về Điều 8 hay chuyện nuôi mèo |
| 3 | "Khách thăm được ở tới mấy giờ?" | "Nội quy không có thông tin này." | Từ chối sai | Đoạn k2 có câu trả lời |

### L2: lỗi này do đâu?

Lựa chọn cho mỗi mục: Đoạn quá nhỏ cắt rời ý · Văn bản hết hiệu lực lọt vào · Lấy quá nhiều đoạn to nên thùng tràn · Không phải lỗi truy xuất.

| # | Vết chạy rút gọn | Đáp án | Giải thích |
|---|---|---|---|
| 1 | Trả lời "nộp phí trước ngày 15", thiếu "trừ trường hợp miễn giảm". Câu "trừ trường hợp…" nằm ở đoạn kế tiếp, hạng 9; top_k 3; cỡ đoạn 128 | Đoạn quá nhỏ cắt rời ý | Ý bị chia ở ranh giới đoạn |
| 2 | Trả lời "phí gửi xe 50.000 đồng". Thùng có "Bảng phí 2021 (hết hiệu lực)" hạng 1 và "Bảng phí 2025" hạng 2 | Văn bản hết hiệu lực lọt vào | Cần lọc hiệu lực trước khi tìm |
| 3 | Thùng có đoạn đúng ở hạng 1, ghi "hạn chót 30/6"; trợ lý trả lời "30/7" | Không phải lỗi truy xuất | Context đã có đáp án nên đây là lỗi sinh câu trả lời (Ngày 8, slide 30/46) |

### L3: câu hỏi này cần cách tìm nào?

Lựa chọn cho mỗi mục: Tìm từ khoá · Tìm theo nghĩa · Cần cả hai.

| # | Câu hỏi | Đáp án | Giải thích |
|---|---|---|---|
| 1 | "Mã lỗi E-217 nghĩa là gì?" | Tìm từ khoá | Mã chính xác, gần như không có nghĩa (Ngày 8, slide 13/46) |
| 2 | "Làm sao để tạm dừng việc học vì chuyện gia đình?" | Tìm theo nghĩa | Lời thường, khó trùng chữ với văn bản (slide 14/46) |
| 3 | "Khoản 3 Điều 30 có cho nộp muộn khi bị ốm không?" | Cần cả hai | Có số hiệu và có ý hỏi bằng lời thường (slide 15/46) |

**Telemetry:** `check60.start{level}` → `check60.item{n, choice, correct, ms}` → `check60.submit{score, timed_out}`. KPI: tỉ lệ đạt ≥ 2/3 theo level, và tương quan với điểm dạy lại.

## 6. Câu hỏi mở

1. Thẻ bằng chứng sinh tự động từ facts cần một bảng "thẻ quyết định theo cờ" do evaluator (Phần 4, chưa có tài liệu) cung cấp. Kịch bản đã liệt kê thẻ quyết định cho từng level ở trên.
2. Có cho giáo viên sửa rubric theo lớp không? Đề xuất: không ở MVP, để điểm so sánh được giữa các lớp pilot.
3. Ba mục 60 giây là cố định; ở pilot nên có 2 bộ luân phiên để tránh lộ đáp án giữa các bạn cùng lớp.
