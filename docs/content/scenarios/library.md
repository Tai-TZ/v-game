> **Trạng thái:** v0.1. Trang tổng của khu Thư viện; kịch bản đầy đủ nằm ở ba file level. Cuối trang là **yêu cầu cho người viết nội dung** (kho quy chế và bộ câu hỏi vàng).
> **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D1–D7, §3 · [Phần 3](../../design/part-3-block-system.md) · [gameplay-direction](../../design/gameplay-direction.md) (phần trình bày).

# Khu Thư viện: mạch ba level

Trường Đại học Sao Mai (hư cấu) có một trợ lý tra cứu quy chế đặt ở quầy Thư viện. Cô Lan, thủ thư ca tối, nhờ người chơi dạy nó **tra sách trước khi trả lời**.
- **L1:** nó thôi bịa.
- **L2:** nó tra đủ ý và đúng bản còn hiệu lực.
- **L3:** người ta hỏi bằng số điều, và lời giải cũ vỡ.

## 1. Ba level trong một bảng

| | [L1 · Thôi bịa điều luật](library-l1-grounded-citation.md) | [L2 · Lược dao chunk](library-l2-chunk-tuning.md) | [L3 · Hỏi bằng số điều](library-l3-article-number-lookup.md) |
|---|---|---|---|
| Hiện trường | Bảng Tin dán kín áp phích "Điều 47 ma" (câu bịa nguyên văn của brief §3) | Hà ngồi trên bậc thềm với đơn "QUÁ HẠN" và giấy ra viện | Hàng người trước quầy, ai cũng cầm tờ in "Điều 47 khoản 2" mang nội dung của điều khác |
| Ca test (golden) | 10 ca: 3 `v` + 5 `h` + 2 `t` (`t01` Điều 99, `t02` ngoài phạm vi) | 13 ca: 3 `v` + 7 `h` + 3 `t` (`t01` và `t03` văn bản cũ, `t02` đã bãi bỏ) | 13 ca: 3 `v` + 7 `h` + 3 `t` (`t01` diễn đạt lại, `t02` hồi quy, `t03` khoản không tồn tại) |
| Mục tiêu đo được | ≥ 6/8 ca thường đúng **và** có nguồn, gồm `lib-l1-v01`; mọi ca bẫy nói "không có" | ≥ 8/10 ca thường đủ ý, gồm `lib-l2-v01`; không ca nào dùng bản 2019 | ≥ 8/10 ca thường đúng, gồm `lib-l3-v01`; ca hồi quy `lib-l3-t02` vẫn đạt; ca `lib-l3-t03` được từ chối |
| Hiểu lầm nhắm tới | "Không có tài liệu thì model sẽ nói không biết" | "top-k càng lớn càng chắc"; "cắt càng nhỏ càng chuẩn" | "Tìm theo nghĩa hiểu cả số hiệu"; "rerank lúc nào cũng đáng" |
| Đồ chơi mới → khối | Vòm Sao → `vector_search`; Móc kéo → `top_k` 1–10; Máy đóng tem → `context_packer.cite_ids`; Lăng kính → `llm.system_prompt` (thẻ G1–G6) | Lược dao → `chunker.chunk_size` {128, 256, 512, 1024}; Nam châm → `strategy` {co_dinh, theo_dieu}; Băng keo → `overlap_pct` {0, 10, 20}; Màn lọc → `score_threshold`; Kính lọc → `only_in_force` | Tủ ngăn kéo → `bm25_search`; Phễu / Bập bênh → `fusion` (rrf, k / alpha); Kính lúp → `rerank.top_n`; `vector_search.top_k` giới hạn ≤ 5 |
| Cơ chế bẫy tất định | Thùng rỗng nên thiếu dữ kiện; không có mã đoạn nên không trích được | Ranh giới đoạn tách khoản 3; thùng 3.000 token cắt đoạn thừa; đoạn `in_force: false` vào thùng | Hạng dense của Điều 47 > giới hạn `top_k`; BM25 không trùng chữ với câu diễn đạt lại |
| Đoán → chạy → giải thích | 3 phiếu đoán; menu "Vì sao câu #N sai?" | 3 phiếu đoán (có phiếu về token khi tăng `top_k`) | 3 phiếu đoán (có phiếu về hạng sau gộp, ms của rerank) |
| Gợi ý 1 → 3 | "Trong thùng có gì?" → thanh token → "Gắn Vòm Sao…" | "Đoạn dừng ở đâu?" → dải đoạn có vết cắt → "Nam châm hoặc 512 + Băng keo" | **"Chạy lại lời giải cũ"** → đường đời hạng → "Lắp ngăn kéo cạnh Vòm Sao rồi gộp" |
| Aha | RAG là đổ đúng thứ vào thùng, và "không có" cũng là một câu trả lời đúng | Không có nấc tốt nhất, chỉ có nấc đã đo; lọc trước khi tìm | Hai cách tìm có hai điểm mù bù nhau; sửa chỗ này phải nhìn bảng hồi quy |
| Cờ thế giới | Áp phích; chú Bảy gỡ khi đạt sao 1 | Tờ đơn ở cửa phòng đào tạo đổi thành "ĐÃ NHẬN" | Hàng người giải tán; bảng hồi quy L2 xanh |
| Ca ôn | `lib-l1-r01`–`r04` | `lib-l2-r01`–`r04` | `lib-l3-r01`–`r04` |

Số ca, vai và tiêu chí chấm lấy từ `docs/content/golden/*.json`; bảng trên chỉ tóm tắt, file golden thắng khi lệch (brief §4.2).

**Sao ở cả ba level:**
- sao 1 = mục tiêu chính;
- sao 2 = tổng token ≤ ngân sách, bằng 1,25 × p50 của lời giải mẫu (tạm 22k / 30k / 30k);
- sao 3 = mọi ca bẫy của level đều đạt; L1 thêm "không ca nào bịa nguồn", L2 thêm "không ca nào có giấy 2019 trong thùng".

Sao 2 và 3 chỉ tính khi đã có sao 1.

## 2. Ẩn dụ phai dần

| Level | Người chơi thấy |
|---|---|
| L1 | Đồ chơi là chính; tên khối Phần 3 in nhỏ bên cạnh; Lật mặt sau có JSON, đồ thị và prompt thật |
| L2 | Đồ chơi và tên thật ngang nhau; cô Lan nói cả hai ("Móc kéo, tức top_k") |
| L3 | Tên khối in to bằng tên đồ chơi; chế độ "Bản vẽ" (đồ thị thật) mở sẵn ở tab thứ hai |

Theo research §3.5: thao tác trên ẩn dụ, có cấu hình thật chạy song song, và cuối khu là thẻ "Ngoài đời thật".

## 3. Đồ chơi dùng chung của khu

| Đồ chơi | Khối Phần 3 | Mở ở | Ghi chú |
|---|---|---|---|
| Chuông quầy / Bảng trả lời | `input` / `output` | luôn có, khoá | |
| Kệ sách (+ xe lưu trữ 2019 ở L2) | `corpus` | khoá | L1, L3: `qcdt-2024`; L2: thêm `qcdt-2019` (D7) |
| Lược dao, Nam châm, Băng keo | `chunker` | thấy ở L1 (khoá `theo_dieu`/512/10); mở ở L2 | mỗi lựa chọn là 1 trong 24 biến thể tính sẵn |
| Vòm Sao + Đèn pin, Móc kéo | `vector_search` | L1 | Đèn pin chỉ chiếu câu có sẵn; không embed lúc chạy |
| Màn lọc mờ, Kính lọc hiệu lực | `vector_search.score_threshold`, `only_in_force` | L2 | |
| Thùng Context | `context_packer` | L1, cỡ cố định 3.000 token | Chợ model mới cho đổi cỡ |
| Máy đóng tem | `context_packer.cite_ids` | L1 | |
| Bộ Óc | `llm` | L1, `profile` khoá `can_bang` | |
| Lăng kính (3 khe, thẻ G1–G6) | `llm.system_prompt` | L1 | Văn bản thẻ ở [L1 mục 5](library-l1-grounded-citation.md#5-đồ-chơi-và-khối-phần-3) |
| Tủ ngăn kéo | `bm25_search` | L3 | |
| Phễu RRF / Bập bênh α | `fusion` | L3 | |
| Kính lúp | `rerank` | L3 | |

## 4. Quy ước mã ca và vai

- Mã: `lib-l{1|2|3}-{v|h|t|r}{NN}` (brief §3).
- Các ca neo có nghĩa cố định theo brief. Những ca khác kịch bản chỉ gọi theo **vai**; người viết nội dung đặt số.

| Vai | Nghĩa |
|---|---|
| `su-kien` | hỏi một dữ kiện nằm gọn trong một khoản |
| `dien-dat-lai` | hỏi bằng từ đời thường, không trùng chữ với văn bản |
| `ngoai-le-khoan-sau` | đáp án cần cả khoản quy định chung lẫn khoản ngoại lệ ngay sau |
| `cau-dai` | câu đáp án dài, bị cắt ngang ở đoạn 128 không overlap |
| `nhieu-khoan` | đáp án gộp từ nhiều khoản của một điều |
| `don-gian` | ca đối chứng, đạt ở hầu hết cấu hình |
| `van-ban-cu` | bản 2019 và 2024 cho con số khác nhau |
| `da-bai-bo` | quy định chỉ có trong bản 2019; đáp án đúng là "không có" |
| `tra-so` | hỏi bằng số điều, số khoản |
| `tra-so-kho` | vừa có số vừa có lời thường; cần xếp hạng lại |
| `hoi-quy` | ca của level trước phải vẫn đạt |

## 5. Yêu cầu cho người viết nội dung

Danh sách này là những gì ba kịch bản Thư viện **dựa vào**. Từ sau đợt 1, file golden là nguồn sự thật cho số ca, vai và tiêu chí chấm (brief §4.2); tên trường dưới đây theo đúng file golden. Chỗ nào bạn đã chốt khác, giữ bản của bạn và ghi vào "Câu hỏi mở" để QA đối chiếu.

### A. Kho quy chế (`docs/content/corpus/`)

**A1. Văn bản `qcdt-2024`:**
- "Quy chế đào tạo trình độ đại học" của Trường Đại học Sao Mai, `in_force: true`.
- 75–90 điều liên tiếp từ Điều 1, không thiếu số nào; số điều lớn nhất ≤ 90.
- Không có Điều 99 ở bất kỳ đâu, kể cả trong dẫn chiếu.

**A2. Điều 12 "Bảo lưu kết quả học tập" (bản 2024):**
- **Khoản 1:** đối tượng được bảo lưu và thời gian bảo lưu tối đa, có ít nhất một con số. Dùng cho `lib-l1-r01`.
- **Khoản 2:** chứa **nguyên văn** câu neo "Sinh viên nộp đơn bảo lưu cho phòng đào tạo chậm nhất hai tuần trước ngày bắt đầu học kỳ, kèm ý kiến của cố vấn học tập." Được thêm sau nó một câu dẫn chiếu khoản 3; không sửa câu neo.
- **Khoản 3:** ngoại lệ nộp muộn (ví dụ ốm đau, tai nạn có xác nhận của cơ sở y tế), với ít nhất một dữ kiện riêng không có ở khoản 2, ví dụ thời hạn nộp muộn. Dữ kiện này là `answer_points` phân biệt của `lib-l2-v01`.
- **Số khoản:** Điều 12 có đúng 3 khoản, để `lib-l1-r02` ("Điều 12 khoản 9") hỏi một khoản không tồn tại.
- **Độ dài:** toàn văn Điều 12 ≤ 450 token (count_tokens), để biến thể `theo_dieu`/512 giữ trọn trong một đoạn.
- **Từ ngữ:** Điều 12 không chứa các từ nội dung của câu `lib-l3-t01` (ví dụ "nghỉ", "tạm", "một thời gian"), để BM25 trượt; câu t01 vẫn phải gần nghĩa với Điều 12.

**A3. Họ Điều 41, 47, 74:**
- cùng một chủ đề, cùng cấu trúc khoản, lời văn na ná nhau;
- khoản 2 của mỗi điều nêu một thời hạn hoặc con số **khác nhau**;
- Điều 47 không nói về bảo lưu;
- Điều 41 có ít hơn 6 khoản (hiện có 4), để `lib-l3-t03` ("Điều 41 khoản 6") hỏi một khoản không tồn tại;
- mỗi điều ≤ 450 token;
- đề xuất, không bắt buộc: họ "thủ tục đề nghị, khiếu nại", ví dụ phúc khảo.

**A4. Chuỗi "47" trong `qcdt-2024`** (kho của L3; bản 2019 không bị ràng buộc này vì L3 không dùng nó):
- chỉ xuất hiện trong Điều 47 (tiêu đề và thân);
- không điều nào khác dẫn chiếu "Điều 47";
- không có con số 47 ở chỗ khác ("47 tín chỉ", "47 ngày"…);
- đề xuất làm tương tự cho "41" và "74".

**A5. Cấm ở cả hai văn bản:** mọi quy định cho phép làm thủ tục (bảo lưu hay việc gì khác) chỉ bằng email, và cụm "chỉ cần gửi email". Nên tránh hẳn chữ "email" gần "nộp đơn".

**A6. Văn bản `qcdt-2019`** (cùng tên, `in_force: false`):
- một điều về bảo lưu gần như trùng lời văn Điều 12 (2024) nhưng **thời hạn khác**, cho `lib-l2-t01`. Câu t01 phải khiến đoạn 2019 đứng hạng 1–2 khi không lọc (cổng phát hành đo);
- ít nhất một quy định chỉ có ở bản 2019 (bản 2024 đã bỏ), cho ca bẫy vai `da-bai-bo` của L2 (`lib-l2-t02`);
- các cặp con số khác nhau giữa 2019 và 2024 ngoài chuyện bảo lưu, mỗi ca một cặp: `lib-l2-t03` (ngưỡng điểm bị cảnh báo học tập), `lib-l2-r02` và `lib-l2-r04` (ca ôn);
- số điều có thể lệch bản 2024; không có Điều 99; không có "chỉ cần gửi email".

**A7.** Ít nhất 2 điều (ngoài Điều 12) có dạng "khoản N quy định chung, khoản N+1 là ngoại lệ", cho ca ẩn vai `ngoai-le-khoan-sau` của L2 và cho `lib-l2-r01`.

**A8.** Ít nhất 3 câu đáp án dài (khoảng ≥ 90 token) để bị cắt ở biến thể `co_dinh` 128/0, cho các ca vai `cau-dai` (thấy được và ẩn) và `lib-l2-r03`.

**A9. `docs/content/corpus/README.md`** gồm:
- văn bản dùng ở từng level: L1 dùng 2024; L2 dùng 2024 + 2019; L3 dùng 2024 (D7);
- bảng bẫy: bẫy → điều → ca;
- vị trí cắt dự kiến ở các biến thể quan trọng (128/0, 256/0, 512/10, `theo_dieu`/512/10), ghi rõ là **ước tính**; cổng phát hành sẽ đo lại.

**A10.** Ghi vào README hai giả định cho engine:
- `chunk_id` là chuỗi mờ, không suy ra được số điều;
- mỗi đoạn mang `meta{doc_id, dieu, khoan, hieu_luc}`, và tiêu đề điều được đưa vào trường mà BM25 index (L3, Câu hỏi mở 2).

### B. Bộ câu hỏi vàng (`docs/content/golden/`)

**B1. Số ca** (khớp file golden hiện tại):
- `library-l1.json`: 10 ca = 3 `v` + 5 `h` + 2 `t` (`lib-l1-t01`, `lib-l1-t02`), cộng 4 `r`.
- `library-l2.json`: 13 ca = 3 `v` + 7 `h` + 3 `t` (`lib-l2-t01`, `lib-l2-t02` vai `da-bai-bo`, `lib-l2-t03` vai `van-ban-cu`), cộng 4 `r`.
- `library-l3.json`: 13 ca = 3 `v` + 7 `h` + 3 `t` (`lib-l3-t01`, `lib-l3-t02`, `lib-l3-t03` vai `khoan-khong-ton-tai`), cộng 4 `r`.

**B2. Trường của file và của từng ca** (theo schema golden):
- cấp file: `level_id`, `corpus` (kho của level), `grading`, `equivalents` (bảng cách viết tương đương dùng chung, ví dụ "hai tuần" → ["2 tuần", "14 ngày"]);
- `grading` là object, có `refusal_markers` (xem B9);
- mỗi ca: `id`, `role` (`visible` | `hidden` | `trap` | `review`), `vai` (mục 4), `question`, `expect` (`answer` | `abstain`);
- `gold[]` = {`doc_id`, `dieu`, `khoan`, `quote`}, với `quote` là chuỗi con **nguyên văn** của văn bản; ca `abstain` có `gold` rỗng;
- `answer_points[]` (mỗi mục khớp chính nó hoặc một cách viết trong `equivalents`), `forbidden[]`;
- `trap`, `bites` (mã cấu hình ngây thơ ở mục 6 kịch bản của chính level), `notes`.

**B3. Neo bắt buộc (brief §3):**
- `lib-l1-v01`: nguyên văn câu trang chủ;
- `lib-l1-t01`: hỏi Điều 99, đáp án là từ chối;
- `lib-l1-t02`: ngoài phạm vi, đáp án là từ chối;
- `lib-l2-v01`: cần khoản 3; đáp án Điều 12 khoản 2 + 3;
- `lib-l2-t01`: bản 2019 khác bản 2024; đáp án theo 2024;
- `lib-l3-v01`: "Điều 47 khoản 2 quy định gì?";
- `lib-l3-t01`: diễn đạt kiểu "nghỉ học một thời gian"; đáp án Điều 12;
- `lib-l3-t02`: hồi quy của L2.

**B3b. Ca bẫy thêm sau đợt 1** (không phải neo brief, nhưng kịch bản đã dựa vào để tính sao 3):
- `lib-l2-t02`: vai `da-bai-bo`, `expect: abstain`; quy định chỉ có ở bản 2019;
- `lib-l2-t03`: vai `van-ban-cu`, ngưỡng điểm bị cảnh báo học tập; bản 2019 ghi khác; `forbidden` chứa giá trị 2019;
- `lib-l3-t02`: dùng nguyên câu và tiêu chí của `lib-l2-v01`;
- `lib-l3-t03`: vai `khoan-khong-ton-tai`, hỏi "Điều 41 khoản 6", `expect: abstain`; `bites` để trống cho tới khi có cấu hình cắn nó (L3 Câu hỏi mở 7).

**B4. Vai đề xuất cho các ca không phải neo** (bạn đặt số; vai và số lượng là thứ kịch bản dựa vào):
- **L1:**
  - `v02`: `su-kien`, điều khác Điều 12;
  - `v03`: `dien-dat-lai`, và đoạn đáp án đứng hạng ≥ 2 ở biến thể L1 (để cấu hình ngây thơ N5 cắn);
  - 5 ca `h`: ≥ 3 `su-kien` ở các điều khác nhau, ≥ 1 `dien-dat-lai`;
  - L1 không dùng họ 41/47/74;
  - `forbidden` của `v01` có "email".
- **L2:**
  - `v01`: hỏi hạn nộp nhưng **không** nhắc hoàn cảnh ngoại lệ (không "ốm", không "viện"), để đoạn khoản 3 không tự đứng hạng cao;
  - `v02`: `cau-dai`;
  - `v03`: `don-gian`;
  - 7 ca `h`: ≥ 2 `ngoai-le-khoan-sau` (điều khác Điều 12), ≥ 2 `cau-dai`, ≥ 1 `nhieu-khoan`, còn lại `don-gian`;
  - ca `da-bai-bo` có `expect: abstain`;
  - `forbidden` của `t01` và `t03` chứa giá trị của bản 2019.
- **L3:**
  - `v02`: `tra-so`;
  - `v03`: `don-gian`, hỏi bằng lời thường;
  - 7 ca `h`: ≥ 3 `tra-so` (có ít nhất một điều ngoài họ 41/47/74), ≥ 2 `tra-so-kho` (dự kiến hạng 4–8 sau RRF và ≤ 3 sau rerank), còn lại `dien-dat-lai`;
  - mọi ca `tra-so` trong họ có `forbidden` chứa con số tương ứng của hai điều còn lại;
  - `t02` dùng đúng câu và tiêu chí của `lib-l2-v01` (đã chốt).

**B5. Ca ôn:**
- **L1:**
  - `lib-l1-r01`: bảo lưu được tối đa bao lâu (Điều 12 khoản 1);
  - `lib-l1-r02`: hỏi một khoản không tồn tại của điều có thật, ví dụ "Điều 12 khoản 9", đáp án là từ chối;
  - `lib-l1-r03`: câu đời sống trong khuôn viên nhưng ngoài quy chế, đáp án là từ chối;
  - `lib-l1-r04`: `su-kien` hỏi bằng lời viết tắt kiểu nhắn tin, điều khác Điều 12; `bites` gồm N1 (sự cố ca trực: Vòm Sao bị tháo).
- **L2:**
  - `lib-l2-r01`: `ngoai-le-khoan-sau` ở điều khác Điều 12;
  - `lib-l2-r02`: `van-ban-cu`, không về bảo lưu;
  - `lib-l2-r03`: `cau-dai`;
  - `lib-l2-r04`: `van-ban-cu`, không về bảo lưu, khác cặp con số của `r02` và `t03`.
- **L3:**
  - `lib-l3-r01`: `tra-so` ("khoản 2 Điều 74" hoặc Điều 41);
  - `lib-l3-r02`: `dien-dat-lai` cho một điều khác Điều 12;
  - `lib-l3-r03`: `tra-so-kho`;
  - `lib-l3-r04`: `tra-so` cho một điều ngoài họ 41/47/74; `bites` gồm N1 (sự cố ca trực: chỉ còn Vòm Sao).
- Mỗi thẻ khái niệm của ca trực nên có ≥ 2 ca ôn để hai lần ôn liền nhau không lặp ca ([daily-shift.md](daily-shift.md) mục 2). Hiện `retrieval.rerank_roi` mới có một (`lib-l3-r03`).

**B6.** Câu hỏi của ca ẩn và ca bẫy không trùng chữ với ca thấy được, và không bao giờ hiện trong UI (Phần 3 §3.7).

**B7. `library-assessment.json` (trước/sau):**
- hai dạng song song A/B, cùng độ khó;
- mỗi dạng có ≥ 2 câu cho mỗi hiểu lầm:
  - L1: không có tài liệu thì model sẽ nói không biết;
  - L2: top-k càng lớn càng chắc; cắt càng nhỏ càng chuẩn; văn bản nào cũng dùng được;
  - L3: tìm theo nghĩa hiểu cả số hiệu; rerank lúc nào cũng đáng;
- mỗi level có ≥ 1 câu chuyển giao không dùng ẩn dụ của game, ví dụ log hoặc cấu hình thật;
- dạng câu: chọn lý do từ menu, đáp án máy kiểm;
- không trùng với bài 60 giây ở [teach-back.md](teach-back.md) mục 5.

**B8. Script tự kiểm** (đặt trong scratchpad) phải xác nhận:
- mọi `quote` là chuỗi con nguyên văn;
- không có Điều 99; không có "chỉ cần gửi email";
- trong `qcdt-2024`, "47" chỉ xuất hiện trong Điều 47;
- số điều liên tiếp và ≤ 90;
- ca của level nào chỉ trích văn bản trong kho của level đó (ca L3 không trích bản 2019);
- mọi ca `abstain` có `gold` rỗng; khoản được hỏi trong `lib-l1-r02` và `lib-l3-t03` thật sự không tồn tại;
- `grading.refusal_markers` có đủ các dấu hiệu tối thiểu ở B9.

**B9. Luật chấm ca từ chối** (brief §4.2, tạm chốt cho v0.1):
- `grading.refusal_markers` có tối thiểu: "không có thông tin", "không tìm thấy", "không có điều", "không có khoản", "không tồn tại", "không quy định";
- ca `abstain` đạt khi có một dấu hiệu trong danh sách, không chứa `forbidden`, và không có `llm.cite_unknown`;
- **bỏ** điều kiện "không có `cited_ids`": được trích đoạn có thật trong thùng khi từ chối, chỉ trích bịa mới trượt;
- riêng L2: thêm điều kiện "không có đoạn `hieu_luc = false` trong thùng" cho mọi ca bẫy và mọi ca vai `van-ban-cu` / `da-bai-bo` (đã có trong `grading` của L2).
