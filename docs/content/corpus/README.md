# Kho quy chế hư cấu của khu Thư viện

> **Trạng thái:** v0.1, nội dung cho engine (chưa có engine). **Chủ file:** người viết nội dung. **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D6, D7 và §3; [Phần 3](../../design/part-3-block-system.md) §3.2, §3.3, §3.7–§3.9; yêu cầu nội dung ở [library.md](../scenarios/library.md) mục 5.
> **Hư cấu.** Trường Đại học Sao Mai không có thật. Mọi tên, số liệu, thủ tục trong kho đều do nhóm tự đặt. Không có tên trường thật, tên người, số điện thoại hay địa chỉ thư điện tử nào.

Tài liệu này mô tả hai văn bản trong kho, cách engine nên nạp chúng, các bẫy đã cài và vị trí cắt dự kiến. Bộ câu hỏi vàng nằm ở [`../golden/`](../golden/).

## 1. Văn bản và level dùng

| doc_id | File | Tiêu đề | Ban hành · hiệu lực | `in_force` | Số điều | L1 `grounded-citation` | L2 `chunk-tuning` | L3 `article-number-lookup` |
|---|---|---|---|---|---|---|---|---|
| `qcdt-2024` | [quy-che-dao-tao-2024.md](quy-che-dao-tao-2024.md) | Quy chế đào tạo trình độ đại học | 2024-07-15 · 2024-08-15 | `true` | 84 (Điều 1–84, liên tiếp), 8 chương, khoảng 12.000 âm tiết | có | có | có |
| `qcdt-2019` | [quy-che-dao-tao-2019.md](quy-che-dao-tao-2019.md) | Quy chế đào tạo trình độ đại học (bản cũ) | 2019-08-20 · 2019-09-01 | `false`, bị `qcdt-2024` thay | 16 (Điều 1–16) | không | có | **không** (D7) |

- **L1:** chỉ `qcdt-2024`. Người chơi học truy xuất và trích nguồn trước, chưa có nhiễu văn bản cũ.
- **L2:** `qcdt-2024` + `qcdt-2019`. Bản 2019 "vừa được phòng lưu trữ số hoá" là bẫy văn bản hết hiệu lực.
- **L3:** chỉ `qcdt-2024` (D7). Lý do gốc: khi `only_in_force` còn nằm ở `vector_search`, nhánh BM25 kéo bản cũ về mà người chơi không lọc được (phản biện Phần 3). Engine v0.2 đã chuyển `only_in_force` sang `chunker` (tầng Index, E6) nên mọi retriever đều được lọc; kho L3 vẫn giữ một văn bản.

## 2. Cách nạp (giả định cho engine)

**Phạm vi nạp.** Engine chỉ nạp hai file có front matter `doc_id` ở bảng trên, không nạp file README này. Trong mỗi file, engine chỉ nạp từ dòng `## Chương I` trở xuống. Front matter YAML là metadata của văn bản. Tiêu đề `#`, dòng "Ban hành kèm theo…" và chú thích HTML không phải nội dung quy chế.

**Cấu trúc.**
- `## Chương …` là chương.
- `### Điều N. Tiêu đề` là điều.
- Dòng bắt đầu bằng `N. ` là khoản.
- Dòng bắt đầu bằng `a) `, `b) `, `đ) `… là điểm, thuộc khoản ngay trên. Điều không chia khoản (ví dụ Điều 35, 51, 80 của bản 2024) có `khoan = null`.

**Metadata của mỗi đoạn (chunk):**

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `doc_id` | string | `qcdt-2024` hoặc `qcdt-2019` |
| `dieu` | int | số điều chứa đoạn |
| `khoan` | int[] | các khoản mà đoạn chạm tới, theo thứ tự; `[]` nếu điều không chia khoản |
| `hieu_luc` | bool | lấy từ `in_force` của văn bản; `chunker.only_in_force` lọc trên trường này ở tầng Index (engine-v0.2 E6) |

**Hai giả định engine phải chốt (yêu cầu A10):**
1. `chunk_id` là chuỗi mờ, ví dụ băm của (biến thể, vị trí). Không suy ra được số điều từ `chunk_id`. Vì vậy không bật `cite_ids` thì model không thể trích đúng đoạn (cơ chế của L1-N2).
2. Tiêu đề điều ("Điều N. Tiêu đề") được ghép vào **trường mà BM25 index** của mọi đoạn thuộc điều đó, kể cả đoạn giữa điều ở biến thể `co_dinh`. Nhờ vậy câu "Điều 47 khoản 2" bắt được đoạn khoản 2 dù đoạn đó không chứa chữ "Điều 47" (kịch bản L3, Câu hỏi mở 2).

**Đề xuất (chưa chốt):** chuỗi đem đi embedding gồm tiêu đề điều **không kèm số điều** và nội dung đoạn. Như vậy dense hiểu chủ đề của đoạn, còn số hiệu chỉ BM25 thấy. Nếu engine nhúng cả "Điều 47", cổng phát hành phải đo lại xem dense có còn trượt các ca `tra-so` không.

**Đoạn đáp án (đề xuất cho evaluator, Phần 4).** Với mỗi biến thể index, tập đoạn đáp án của một ca là mọi đoạn chồng lên ít nhất một `quote` trong `gold` của ca. `ret.boundary_split` bật khi một `quote` trải trên hai đoạn trở lên.

## 3. Bẫy đã cài

[T] = tất định: kiểm bằng chữ, số token hoặc metadata, không phụ thuộc model. [M] = phụ thuộc model, phải qua cổng hiệu chỉnh của Phần 3 §3.9. Mã cấu hình ngây thơ lấy từ mục 6 kịch bản của từng level, ví dụ L2-N1 là N1 trong [kịch bản L2](../scenarios/library-l2-chunk-tuning.md).

| Bẫy | Vị trí | Ca | Cấu hình ngây thơ bị cắn | Vì sao tất định |
|---|---|---|---|---|
| Thùng trống thì bịa | Cả kho. Câu neo ở `qcdt-2024` Điều 12 khoản 2 | `lib-l1-v01`–`v03`, `lib-l1-h01`–`h05` | L1-N1 | [T] Không truy xuất thì thùng không có đoạn nào: `answer_points` (ví dụ "hai tuần", "cố vấn học tập") chỉ xuất hiện nếu trùng may, và `cited_ids` rỗng. Câu bịa "Điều N" là [M] |
| Không mã đoạn thì không trích được | Mọi đoạn | 8 ca thường của L1 | L1-N2 | [T] `cite_ids: false` nên packet không có mã, và `chunk_id` mờ nên `cited_ids` không thể thuộc tập đoạn đáp án |
| Câu bịa "Điều 47 ma" | Điều 47 có thật nhưng nói về xem xét lại điểm đánh giá quá trình; cả hai văn bản không có chữ "email" | `lib-l1-v01` (`forbidden`: "email", "Điều 47") | L1-N1 | [T] Kiểm chuỗi. Self-check xác nhận cả hai văn bản không có cụm của câu bịa trong brief §3 và không có chữ "email" |
| Điều hoặc khoản không tồn tại | Không có Điều 99 (kho dừng ở Điều 84, không dẫn chiếu Điều 99); Điều 12 chỉ có 3 khoản; Điều 41 chỉ có 4 khoản | `lib-l1-t01`, `lib-l1-r02`, `lib-l3-t03` | L1-N3 | [M] Kho không có đoạn trả lời; đạt hay trượt tuỳ model có nghe thẻ G3 không. Phần [T] là kho thật sự không có nội dung đó |
| Ngoài phạm vi | Không điều nào nói về lương sau tốt nghiệp hay vé gửi xe | `lib-l1-t02`, `lib-l1-r03` | L1-N3 (r03 còn L1-N1) | [M] như trên |
| Ngoại lệ nằm ở khoản sau | `qcdt-2024` Điều 12 k2→k3; Điều 10 k2→k3; Điều 36 k2→k3; Điều 78 k2→k3 | `lib-l2-v01`, `lib-l2-h01`, `lib-l2-h02`, `lib-l2-r01`, `lib-l3-t02` | L2-N1, L2-N5, L3-N7 | [T] Khoảng cách từ dữ kiện bắt buộc của khoản chung tới dữ kiện bắt buộc của khoản ngoại lệ là 152–161 token (mục 4), lớn hơn 128, nên ở `co_dinh` 128/0 không đoạn nào chứa đủ cả hai. Việc đoạn sau có được kéo về hay không là hạng, phụ thuộc model: đo 2026-10-08, L2-N1 (top 3) kéo đủ cả hai đoạn của `lib-l2-v01` nên là [M]; L2-N5 (top 1) và L3-N7 (`rerank.top_n` 1) cắn tất định |
| Câu đáp án dài | `qcdt-2024` Điều 68 k1, Điều 21 k2, Điều 25 k2 (mỗi khoản là một câu); Điều 13 k2 (8 điểm a–h) | `lib-l2-v02`, `lib-l2-h03`, `lib-l2-h04`, `lib-l2-r03` | L2-N1 | [T] Mục bắt buộc đầu và cuối cách nhau 137–236 token, nên ở 128/0 luôn bị cắt ngang. Ở 256/0 chỉ có xác suất (mục 4) |
| Văn bản cũ gần trùng | `qcdt-2019`: Điều 10 (bảo lưu: "một tuần", "08 ngày"), Điều 5 (22 và 26 tín chỉ), Điều 6 (rút học phần trước hết tuần thứ hai), Điều 8 (chuyên cần 25%), Điều 9 (lấy điểm lần học sau cùng), Điều 13 (cảnh báo dưới 0,80) | `lib-l2-t01`, `lib-l2-t03`, `lib-l2-r02`, `lib-l2-r04`; phụ: `lib-l2-v01`, `lib-l2-h01`, `lib-l2-h05` | L2-N1, L2-N2, L2-N3 | [T] Tiêu chí "không có đoạn `hieu_luc = false` trong `pack.included`" kiểm bằng metadata. Việc câu trả lời dùng con số cũ là [M]. Hạng 1–2 của đoạn 2019 khi không lọc là **ước tính**, cổng phát hành đo |
| Quy định đã bãi bỏ | `qcdt-2019` Điều 12 (cộng 1,0 điểm cho giải Olympic). Bản 2024 không có điều nào về cộng điểm hay giải thưởng thi đấu | `lib-l2-t02` (`expect: abstain`) | L2-N1, L2-N2, L2-N3 | [T] như dòng trên cho phần thùng; phần từ chối là [M] |
| Thùng tràn | Mọi đoạn ở biến thể 1024 | không gắn ca; cắn sao 2 | L1-N4, L2-N2, L3-N4, L3-N5 | [T] Số token đầu vào tính được từ biến thể và `top_k`. Chỉ L3-N4 vượt ngân sách bằng token đầu vào; L1-N4, L2-N2, L3-N5 vượt hay không tuỳ token ra của model: [M] (engine-v0.2 §15) |
| Số điều trong họ na ná | `qcdt-2024` Điều 41 (phúc khảo bài thi), Điều 47 (xem xét lại điểm quá trình), Điều 74 (khiếu nại kết quả khóa luận): cùng khung 4 khoản; khoản 2 lần lượt 07 / 05 / 10 ngày làm việc; khoản 3 lần lượt 12 / 03 / 20 ngày làm việc | `lib-l3-v01`, `v02`, `h01`, `h02`, `h04`, `h05`, `r01`, `r03` | L3-N1, L3-N2, L3-N6; L3-N8 cho vai `tra-so-kho` | [T] Chuỗi "47", "41", "74" chỉ xuất hiện trong chính điều đó (self-check), nên BM25 giữ chữ số bắt chắc. `forbidden` chứa con số tương ứng của hai điều kia, nên trả lời nhầm điều trượt bằng kiểm chuỗi. Dense trượt hay không là **ước tính**, cổng phát hành đo trên cả 24 biến thể |
| Diễn đạt lại không trùng chữ | `qcdt-2024` Điều 12 so với câu `lib-l3-t01` | `lib-l3-t01` | L3-N3 | [T] về chữ: câu hỏi không chung từ đặc thù nào với Điều 12 (nghỉ, nhà, thời gian, đi làm, kiếm tiền, quay lại, giữ, điểm), chỉ chung cụm "kết quả học tập" (có ở 9 điều của `qcdt-2024`), "số" và hư từ. Điều kiện kiểm là BM25 top 10 trượt trên mọi biến thể `theo_dieu` và `co_dinh` ≤ 256 (`test_retrieval`); đo 2026-10-08: hạng BM25 ≥ 15 trên các biến thể đó |

## 4. Vị trí cắt dự kiến (ƯỚC TÍNH)

Số token dưới đây đếm bằng `tiktoken` `o200k_base`, chỉ để ước lượng. Tokenizer thật của chunker (count_tokens của Claude hoặc tokenizer của model embedding) thường cho **nhiều token hơn** với tiếng Việt, nên các khoảng cách "lớn hơn 128" ở đây càng lớn hơn khi đo thật. **Engine phải đo lại bằng tokenizer thật lúc dựng index, và cổng phát hành ghi số đo thay cho bảng này.**

Với `co_dinh`, vị trí cắt phụ thuộc phần văn bản đứng trước, nên bảng ghi khoảng cách d giữa hai mục bắt buộc thay cho vị trí tuyệt đối. Nếu d > S thì ở cỡ S không overlap, hai mục **luôn** nằm ở hai đoạn khác nhau. Nếu d < S thì xác suất chung một đoạn xấp xỉ (S − d) / S. Overlap o token chỉ bảo đảm giữ trọn những đoạn dài không quá o.

| Văn bản · Điều | Tổng token điều | Hai mục bắt buộc | d | 128/0 | 256/0 | 512/10 (`co_dinh`) | `theo_dieu`/512/10 |
|---|---|---|---|---|---|---|---|
| 2024 · Điều 12 | 310 (k1 67, k2 133, k3 97) | "hai tuần" (k2) → "15 ngày" (k3) | 158 | luôn tách | chung đoạn ≈ 38% | chung đoạn ≈ 69% | cả điều một đoạn |
| 2024 · Điều 10 | 274 | "25 tín chỉ" (k2) → "30 tín chỉ" (k3) | 159 | luôn tách | ≈ 38% | ≈ 69% | cả điều một đoạn |
| 2024 · Điều 36 | 240 | "điểm 0" (k2) → "06 ngày" (k3) | 161 | luôn tách | ≈ 37% | ≈ 69% | cả điều một đoạn |
| 2024 · Điều 78 | 484 | "không được hoàn trả" (k2) → "lớp học phần bị hủy" (k3) | 152 | luôn tách | ≈ 41% | ≈ 70% | cả điều một đoạn |
| 2024 · Điều 68 | 450 (k1 187) | "2,00" → "30 ngày" (cùng k1) | 140 | luôn tách | ≈ 45% | ≈ 73% | cả điều một đoạn |
| 2024 · Điều 21 | 460 (k2 173) | "hai học kỳ" → "trưởng khoa" (cùng k2) | 146 | luôn tách | ≈ 43% | ≈ 71% | cả điều một đoạn |
| 2024 · Điều 25 | 467 (k2 183) | "80%" → "hội đồng chuyên môn" (cùng k2) | 137 | luôn tách | ≈ 46% | ≈ 73% | cả điều một đoạn |
| 2024 · Điều 13 | 541 (k2 kèm 8 điểm ≈ 250) | điểm a → "tháng 11" ở điểm h | 236 | luôn tách | ≈ 8% | ≈ 54% | điều dài hơn 512 nên tách theo khoản; k2 nằm trọn một đoạn |
| 2024 · Điều 41 / 47 / 74 | 252 / 236 / 219 (mỗi khoản 50–76) | — | — | mỗi điều 2–3 đoạn; đoạn giữa điều không chứa chữ "Điều N" nếu không ghép tiêu đề (mục 2) | 1–2 đoạn | thường chung đoạn với điều lân cận | mỗi điều một đoạn |

**Hệ quả cho lời giải mẫu:** `theo_dieu`/512/10 giữ trọn mọi điều trong bảng (riêng Điều 13 giữ trọn khoản 2), nên mọi ca `ngoai-le-khoan-sau` và `cau-dai` đạt được ở L2 và L3.

**Điều 12 ≤ 450 token (yêu cầu A2):** o200k đếm được 310. Phải đo lại bằng count_tokens. Nếu vượt 512 ở tokenizer thật, rút khoản 2 về khoảng 100 âm tiết (brief cho phép 100–140) nhưng giữ d > 128.

## 5. Bộ câu hỏi vàng

| File | level_id | corpus | Thấy được | Ẩn | Bẫy | Ôn | Tổng |
|---|---|---|---|---|---|---|---|
| [library-l1.json](../golden/library-l1.json) | `grounded-citation` | `qcdt-2024` | 3 | 5 | 2 | 4 | 14 |
| [library-l2.json](../golden/library-l2.json) | `chunk-tuning` | `qcdt-2024`, `qcdt-2019` | 3 | 7 | 3 | 4 | 17 |
| [library-l3.json](../golden/library-l3.json) | `article-number-lookup` | `qcdt-2024` | 3 | 7 (5 hỏi số điều, 2 diễn đạt lại) | 3 (gồm 1 hồi quy) | 4 | 17 |
| [library-assessment.json](../golden/library-assessment.json) | dùng cho pilot, engine không đọc | — | — | — | — | — | 2 dạng × 12 câu trước/sau; 6 mục 60 giây; 1 bài chuyển giao |

**Trường của mỗi ca:**

| Trường | Ý nghĩa |
|---|---|
| `id` | `lib-l{1,2,3}-{v,h,t,r}NN` (brief §3) |
| `role` | `visible`, `hidden`, `trap`, `review`. Câu hỏi của `hidden` và `trap` không bao giờ hiện trong UI (Phần 3 §3.7) |
| `vai` | vai trong [library.md](../scenarios/library.md) mục 4, cộng 4 vai mới cho ca bẫy: `dieu-khong-ton-tai`, `khoan-khong-ton-tai`, `ngoai-pham-vi`, `hoi-quy`. Truy vết của ca ẩn chỉ in vai |
| `question` | câu của sinh viên; khoảng 20% số ca gõ không dấu hoặc viết tắt |
| `expect` | `answer` hoặc `abstain` |
| `answer_points` | mỗi mục phải có trong câu trả lời, hoặc một cách viết trong `equivalents[mục]` |
| `gold[]` | `{doc_id, dieu, khoan, quote}`; `quote` là chuỗi con nguyên văn của văn bản; `khoan` là `null` nếu điều không chia khoản. Ca `abstain` có `gold` rỗng |
| `forbidden` | cụm không được xuất hiện, gồm con số của bản 2019 và con số của hai điều cùng họ |
| `trap` | cơ chế ca kiểm: `null`, `nonexistent_article`, `out_of_scope`, `boundary_split`, `stale_doc`, `article_number`, `paraphrase`, `regression`. Gắn cả cho ca không phải `role: trap` để engine và QA biết ca thuộc cơ chế nào |
| `bites` | mã cấu hình ngây thơ ở mục 6 kịch bản của chính level đó, những cấu hình phải làm ca này trượt |
| `notes` | lý do có ca, kèm phần nào là ước tính |

**Cấp file:**
- `grading` là object: `status`, `normalize` (NFC, chữ thường, dấu phẩy thập phân thành dấu chấm, bỏ dấu câu khác; áp cho cả `refusal_markers`), `answer` (luật ca trả lời), `abstain` (luật ca từ chối), `refusal_markers` (danh sách dấu hiệu từ chối cố định), `bites`, và `level_rule` ở L2, L3.
- `equivalents` gom các cách viết tương đương; nó thay cho dạng "mỗi mục `must_include` là một danh sách" trong yêu cầu B2 mà vẫn giữ đúng hình dạng ca của brief.

## 6. Ca theo vai (để QA đối chiếu với kịch bản)

| Level | Vai | Ca |
|---|---|---|
| L1 | `su-kien` | v01 (neo), v02, h01, h02, h03, r01, r04 |
| L1 | `dien-dat-lai` | v03, h04, h05 |
| L1 | bẫy và ôn từ chối | t01 `dieu-khong-ton-tai`, t02 `ngoai-pham-vi`, r02 `khoan-khong-ton-tai`, r03 `ngoai-pham-vi` |
| L2 | `ngoai-le-khoan-sau` | v01 (neo), h01 (Điều 10), h02 (Điều 36), r01 (Điều 78) |
| L2 | `cau-dai` | v02 (Điều 68), h03 (Điều 21), h04 (Điều 25), r03 (Điều 13) |
| L2 | `nhieu-khoan` · `don-gian` | h05 (Điều 15) · v03, h06, h07 |
| L2 | `van-ban-cu` · `da-bai-bo` | t01 (neo), t03, r02, r04 · t02 |
| L3 | `tra-so` | v01 (neo, Điều 47 k2), v02 (Điều 41 k2), h01 (Điều 47 k3), h02 (Điều 74 k3), h03 (Điều 10 k2, ngoài họ), r01 (Điều 74 k2), r04 (Điều 62 k2, ngoài họ) |
| L3 | `tra-so-kho` | h04 (Điều 47 k2), h05 (Điều 41 k4), r03 (Điều 74 k4) |
| L3 | `dien-dat-lai` | t01 (neo, Điều 12), h06 (Điều 42), h07 (Điều 71), r02 (Điều 28) |
| L3 | `don-gian` · `hoi-quy` · `khoan-khong-ton-tai` | v03 · t02 (chép `lib-l2-v01`) · t03 |

## 7. Tự kiểm

Script tự kiểm nằm trong thư mục scratchpad của phiên làm việc, không nằm trong repo. QA chạy lại một script tương đương. Script kiểm:
- mọi file JSON đọc được và đúng hình dạng; mã ca không trùng; số ca mỗi vai đúng mức tối thiểu;
- mọi `quote` là chuỗi con nguyên văn của đúng văn bản;
- ca của level nào chỉ trích văn bản trong `corpus` của level đó;
- ca `abstain` có `gold` rỗng;
- hai văn bản không có cụm của câu bịa trong brief §3, không có chữ "email", không có Điều 99;
- `qcdt-2024` có số điều liên tiếp từ 1, lớn nhất ≤ 90; "47", "41", "74" chỉ xuất hiện trong chính điều đó;
- Điều 12 khoản 2 chứa nguyên văn câu neo; Điều 12 không chứa từ đặc thù nào của câu `lib-l3-t01` (cụm chung "kết quả học tập" được phép; BM25 top 10 trượt trên mọi biến thể `theo_dieu` và `co_dinh` ≤ 256, `test_retrieval` kiểm);
- `lib-l1-v01` đúng nguyên văn câu trên trang chủ; `lib-l3-v01` đúng câu neo; `lib-l3-t02` có câu và tiêu chí giống hệt `lib-l2-v01`;
- `grading.refusal_markers` có đủ 6 dấu hiệu tối thiểu (gồm "không có khoản"), luật `abstain` không còn điều kiện `cited_ids`, và không mục `forbidden` nào của ca `abstain` nằm trong một dấu hiệu từ chối;
- khoản được hỏi ở `lib-l1-r02` (Điều 12 khoản 9) và `lib-l3-t03` (Điều 41 khoản 6) thật sự không có trong `qcdt-2024`.

## 8. Câu hỏi mở

1. **Số ca lệch kịch bản.** Kịch bản đặt 3 ca ôn mỗi level và 2 ca bẫy cho L2, L3. Brief của vai nội dung yêu cầu ít nhất 4 ca ôn và ít nhất 3 ca bẫy ở L2, L3. Nên đã thêm `lib-l1-r04`, `lib-l2-r04`, `lib-l2-t03`, `lib-l3-r04`, `lib-l3-t03`.
   - Điều kiện sao trong kịch bản giữ nguyên.
   - `lib-l2-t03` tự rơi vào điều kiện sao 3 của L2 ("không ca nào có `ret.stale_doc`").
   - Đề xuất tính `lib-l3-t03` là `info` cho tới khi qua cổng hiệu chỉnh.
2. **Dấu hiệu từ chối: đã chốt** (brief §4.2, tạm chốt cho v0.1, chờ chủ Phần 4 duyệt khi viết evaluator). Ba file golden có `grading.refusal_markers`: "không có thông tin", "không tìm thấy", "không có điều", "không có khoản", "không tồn tại", "không quy định". Danh sách đi qua cùng bước chuẩn hoá với các trường khác.
3. **Ca từ chối mà có trích dẫn: đã chốt** (brief §4.2, tạm chốt như mục 2). Ca `abstain` đạt khi có một dấu hiệu từ chối, không chứa `forbidden`, không có `llm.cite_unknown`. Đã bỏ điều kiện "không có `cited_ids`": trích đoạn có thật trong thùng (ví dụ chỉ ra Điều 41 chỉ có 4 khoản ở `lib-l3-t03`) vẫn đạt, chỉ trích bịa mới trượt.
4. **Câu hub và kho: đã xong.** Brief §4 đã sửa câu 1 của cô Lan thành "gán cho Điều 47 một quy định không hề có", khớp kho (Điều 47 có thật, nói chuyện khác).
5. **Tokenizer của `chunk_size`.** Chưa chốt dùng tokenizer nào (count_tokens hay tokenizer của model embedding). Mọi số ở mục 4 phải đo lại.
6. **Đã đóng (2026-10-08).** Tiêu đề trong embedding và tokenizer BM25 giữ dấu đã chốt ở engine-v0.2 E4, E9. Ca `lib-l3-h03` đổi từ bản không dấu sang "khoản 2 điều 10 ghi gì ạ" (cùng nghĩa): BM25 hạng 4 thay vì 8, rerank hạng 1 ở biến thể của lời giải mẫu L3.
7. **Câu `lib-l2-v01` có vế "nộp trễ".** Vế này có thể kéo đoạn khoản 3 lên top-3 ở 128/0. Nếu cổng phát hành đo thấy vậy, bỏ vế này và giữ `answer_points` (kịch bản L2, Câu hỏi mở 7).
8. **Số điều của bản 2019 lệch bản 2024.** Ví dụ Điều 12 bản 2019 là điểm thưởng Olympic, không phải bảo lưu. Không ca L2 nào hỏi bằng số điều, nên điều này chỉ làm nhiễu thêm khi tắt lọc.
9. **Phần 3 §3.7 vẫn gọi kho là "Bộ luật Thị trấn"**, lệch D6. Kịch bản đã báo; nội dung không sửa Phần 3.
10. **Khớp chuỗi con của dấu hiệu từ chối và `forbidden`.** Hai chỗ có thể chấm sai (chỗ thứ hai đã sửa):
    - "không có điều" cũng khớp "không có điều kiện", nên một câu trả lời bịa có cụm này có thể lọt qua luật `abstain`. Hàng rào còn lại là `forbidden` và `llm.cite_unknown`.
    - **Đã sửa (2026-10-08):** `forbidden` dạng "Điều 99 quy định" (`lib-l1-t01`), "khoản 9 quy định" (`lib-l1-r02`) và "khoản 6 quy định" (`lib-l3-t03`) khớp cả một câu từ chối đúng như "không tìm thấy Điều 99 quy định về học vượt", nên đã bỏ khỏi `forbidden`. Trích bịa vẫn trượt: "theo Điều 99" / "theo khoản N" còn trong `forbidden`, câu khẳng định "Điều 99 quy định …" bị `llm.cite_unknown`, và ca `abstain` thiếu dấu hiệu từ chối thì trượt tiêu chí `refusal` (`test_grading`).
