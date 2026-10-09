> **Trạng thái:** kịch bản v0.1 cho engine, chưa chơi được. **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D1–D7 và §3. Tên khối, tham số và cờ theo [Phần 3](../../design/part-3-block-system.md).
> **Liên quan:** [Tổng quan Thư viện](library.md) · [L1](library-l1-grounded-citation.md) · [L3](library-l3-article-number-lookup.md) · [Dạy lại](teach-back.md) · [Ca trực](daily-shift.md)

# Thư viện L2 · Lược dao chunk

## 1. Metadata

| Trường | Giá trị |
|---|---|
| Mã level | `chunk-tuning` (order 2, khu `library`) |
| Kind | `standard` · type Phần 3: `rag` |
| Khái niệm (zones.json) | Kích thước chunk · Độ chồng lấp · Top-k |
| Slide gốc | **Ngày 7:** slide 31/60 "Chunking: quá to hay quá nhỏ đều trả giá", 32/60 "Các phương pháp chunking" (fixed-size cắt giữa câu, section/heading), 33/60 "Chunk overlap" (10–20%), 26/60 "Metadata quan trọng không kém similarity" (time/freshness), 27/60 "Top-k, score threshold, filter", 38/60 "Common failure patterns" (top-k quá cao, data cũ), 49/60 "Anti-patterns" (top-k = 10 "cho chắc"). **Ngày 8:** slide 31/46 "Pre-filtering" (chỉ lấy policy còn hiệu lực), 22/46 "Metadata integration", 23/46 "Token budget 20/60/20", 30/46 "Xung đột ngữ cảnh" |
| Điều kiện vào | Đã có sao 1 ở L1 |
| Kho | `qcdt-2024` (còn hiệu lực) + `qcdt-2019` (`in_force: false`), vừa được phòng lưu trữ số hoá |
| Ca test | Nguồn sự thật: [`library-l2.json`](../golden/library-l2.json) (brief §4.2). 13 ca: `lib-l2-v01`–`v03`, 7 ca ẩn `h01`–`h07`, 3 ca bẫy: `lib-l2-t01` (`van-ban-cu`, hạn nộp bảo lưu), `lib-l2-t02` (`da-bai-bo`, phải từ chối), `lib-l2-t03` (`van-ban-cu`, ngưỡng cảnh báo học tập). Thêm 4 ca ôn `lib-l2-r01`–`r04` |
| Thời lượng | lần chạy 1 ở khoảng phút 1:30 (sửa 2026-10-08: lượt đã ghi, 0 lời gọi; lượt thật đầu tiên là lượt Thử 3 câu mẫu ở khoảng phút 4:45); cả level 7–9 phút thời gian chơi, thêm 60 giây kiểm tra; ở quỹ P = 13 mỗi ngày, đủ 3 sao có thể trải qua vài ngày (mục 4) |

## 2. Mục tiêu học

**Sau level này, người chơi làm được:**
1. Dùng bằng chứng trong vết chạy để giải thích hai kiểu hỏng: đoạn **quá nhỏ** (ý bị cắt đôi, ngoại lệ ở khoản sau rơi sang đoạn khác) và đoạn **quá to** (thùng đầy, đoạn đúng bị cắt ở bước đóng thùng, tốn token). Đo bằng rubric dạy lại L2.
2. Chỉnh cỡ đoạn, chiến lược cắt, overlap, top_k và bộ lọc hiệu lực để có ít nhất 8/10 ca thường đạt, không ca nào dùng văn bản hết hiệu lực, và tổng token trong ngân sách. Đo bằng sao 1–3.
3. Đoán đúng chiều thay đổi của token và độ đúng khi tăng top_k. Đo bằng phiếu đoán 2.
4. Gọi đúng nguyên nhân của 3 lỗi truy xuất mới. Đo bằng bài 60 giây, đạt khi đúng ít nhất 2/3.

**Hiểu lầm nhắm tới:**
- Chính: "**top-k càng lớn càng chắc**" (research §2.2). Thực tế: thùng có hạn, đoạn thừa đẩy đoạn đúng ra ngoài, và kéo theo cả bản cũ (Ngày 7, slide 49/60).
- Phụ: "Cắt càng nhỏ thì tìm càng chuẩn" (niềm tin của Bống) và "Văn bản nào trong kho cũng dùng được".

## 3. Mồi truyện và Hiện trường

**Bối cảnh:**
- Đêm qua phòng lưu trữ gửi sang bản quy chế 2019 đã số hoá.
- Bống, học việc của cô Lan, nạp lại toàn bộ kho và chỉnh Lược dao xuống 128, không overlap, "cho gọn".
- Bàn thợ sáng nay là bản sao lời giải L1 của người chơi trên index mới. Cảnh Tua lại và lượt đã ghi là của lời giải mẫu L1 trên cùng index (Nhãn trung thực bên dưới; sửa 2026-10-08, rà soát vòng 5).

**Hiện trường (≤ 25 giây):**
- Hà, sinh viên năm ba, ngồi trên bậc thềm phòng đào tạo. Tay trái cầm đơn bảo lưu đóng dấu đỏ "QUÁ HẠN". Tay phải cầm tờ giấy ra viện.
- Màn hình điện thoại của Hà hiện đúng câu trả lời của `lib-l2-v01` trong lượt đã ghi, theo nhánh ở bảng "Lời dẫn theo dữ kiện" bên dưới (sửa 2026-10-08, rà soát vòng 5).
- Click, chạm hoặc nhấn E vào tờ đơn để Tua lại.

**Cờ thế giới:** tờ đơn "QUÁ HẠN" dán ở cửa phòng đào tạo. Tờ đơn được thay bằng tem "ĐÃ NHẬN" khi đạt sao 1.

**Nhãn trung thực:** Tua lại phát lần chạy đã ghi của **lời giải mẫu L1 trên index 128/0** cho `lib-l2-v01`, đóng tem "kết quả đã lưu". ~~Lần chạy 1 của người chơi là bản sao lời giải L1 của chính họ, chạy thật.~~ **Sửa 2026-10-08 ([roadmap-v0.4](../../design/roadmap-v0.4.md) X11, N4):** lần chạy 1 là lượt đã ghi của cùng cấu hình đó (lời giải mẫu L1 trên index 128/0, cả 13 ca), tem "Lượt chạy đã ghi", 0 lời gọi. Mỗi người chơi có lời giải L1 khác nhau nên không ghi trước được bản của từng người; bản sao lời giải L1 của chính họ chỉ chạy thật ở lượt Thử 3 câu mẫu đầu tiên, và trúng kết quả đã lưu nếu trùng lời giải mẫu.

**Nói rõ đó không phải cấu hình của người chơi** (sửa 2026-10-08, rà soát vòng 5, [frontend architecture §8.4](../../design/frontend-architecture.md#84-tem-nguồn-và-trung-thực-số-liệu)). Bàn thợ giữ bản sao lời giải L1 của người chơi suốt lúc phát lại, vì đó là thứ họ sẽ sửa và là thứ lượt Thử 3 câu mẫu chạy. Cạnh tem "Lượt chạy đã ghi" có dòng mô tả "Lời giải mẫu L1 trên index 128/0, không phải cấu hình của bạn"; ~~tab Cấu hình của Lật mặt sau cho lượt này hiện khác biệt giữa hai cấu hình~~ không hiện giá trị cấu hình của lời giải mẫu, kể cả dạng khác biệt với cấu hình của người chơi (sửa 2026-10-08, rà soát vòng 6, [roadmap-v0.4](../../design/roadmap-v0.4.md) Q9). Hai cấu hình cùng chạy trên index 128/0, nên khác biệt đúng bằng các câu trả lời ngoài chunker của L1 (`top_k`, tem, G3), tức lời giải sao 2 và sao 3 của L1, trong khi vào L2 chỉ cần sao 1 của L1; hiện ra là trao lời giải và vượt cổng gợi ý 3 (X28). Dòng mô tả cạnh tem đã đủ nói đó không phải cấu hình của người chơi. Lời dẫn và phiếu đoán gọi nó là lời giải mẫu, không gọi là lời giải của người chơi. ~~Đánh đổi đã ghi: lời giải mẫu L1 lộ ra ở đây (L1 §5 ghi "không bao giờ hiện" là trong lúc chơi L1), vì lượt đã ghi của nó vốn đã lộ hành vi của nó, và người chơi đã qua sao 1 của L1.~~ Đánh đổi đã ghi (rà soát vòng 6): chỉ **hành vi** của lời giải mẫu L1 lộ ra, qua truy vết của 3 ca thấy được trong lượt đã ghi (số đoạn kéo về, tem trích, prompt X-quang); người chơi phải tự suy ra cấu hình từ đó, như với mọi bằng chứng khác.

**Lời dẫn theo dữ kiện của bản ghi** (sửa 2026-10-08, rà soát vòng 5). Số đo của chính L2 (mục 6 N1, Câu hỏi mở 7) cho thấy ở `co_dinh` 128/0 với `top_k` 3, đoạn khoản 2, đoạn khoản 3 và một đoạn 2019 (hạng 1) đều vào thùng của v01, còn v01 đạt hay trượt là [M]. Vì vậy hình ở nhịp 2 vẽ theo `retrieved` và `pack.included` thật của bản ghi, còn câu trên điện thoại của Hà và lời của cô Lan chọn theo `case.graded` của v01. **"Có số 2019"** (sửa 2026-10-08, rà soát vòng 6) là chữ trả lời của v01 (ca thấy được giữ đủ fact) chứa một giá trị của bản 2019: "một tuần", "1 tuần", "08 ngày", "8 ngày". Không dùng tiêu chí `no_forbidden` của `case.graded`: nó chỉ là một giá trị đúng/sai, và `forbidden` của v01 còn có "email", không phải giá trị 2019:

| Nhánh (v01 trong bản ghi) | Điện thoại của Hà | Nhịp 1 | Nhịp 2, câu cuối của cô Lan | Nhịp 5, sau run |
|---|---|---|---|---|
| **Số cũ:** v01 trượt và có số 2019 (định nghĩa ở trên); ~~dự kiến hay gặp nhất theo số đo~~ có thể gặp vì đoạn 2019 đứng hạng 1 trong thùng; tần suất với Gemini chưa đo (cổng ở Câu hỏi mở 8; sửa 2026-10-08, rà soát vòng 6) | Câu có trích nguồn, nhưng mang con số của bản 2019 (giá trị `forbidden` thật trong câu, ví dụ "8 ngày") | "Hà nằm viện hai tuần, quy chế cho bạn ấy nộp muộn tới 15 ngày. Trợ lý lại đọc cho bạn ấy con số của bản 2019." | "Đoạn đúng có vào thùng. Nhưng tờ giấy vàng đứng đầu, và trợ lý đọc theo nó." | "Câu của Hà mang số của bản cũ, và có {m} ca vừa dùng phải giấy cũ." |
| **Cụt:** trượt vì thiếu ý của khoản 3, không có số 2019 | Câu đúng phần thời hạn, có trích nguồn, nhưng không nói gì về trường hợp được nộp muộn | "Hà nằm viện hai tuần, nên quy chế cho bạn ấy nộp muộn. Trợ lý chỉ đọc cho bạn ấy nửa đầu điều luật." | "Nhỏ quá thì mỗi mảnh chỉ còn nửa ý. Mảnh khoản 3 có trong thùng mà đứng tách khỏi khoản 2." | "Không tệ cho một index mới nạp. Nhưng câu của Hà vẫn cụt." Thêm "và có ca vừa dùng phải giấy cũ" khi có `ret.stale_doc` |
| **Đạt**, hoặc trượt vì lý do khác hai nhánh trên | không dùng được | không dùng được | không dùng được | không dùng được |

Nhánh **Đạt** (hoặc lý do khác): cảnh quanh Hà không còn đúng, nên không phát hành bản ghi cho tới khi người viết nội dung viết lại Hiện trường, cờ thế giới và nhịp 1, 2, 5 quanh một ca thấy được đã trượt trong bản ghi (ví dụ ca vai `cau-dai`). Không ghi lại để model tình cờ trượt (Câu hỏi mở 8).

## 4. Beat sheet

**Sửa 2026-10-08** (như [L1 §4](library-l1-grounded-citation.md#4-beat-sheet): X11, X26, N2, N4, N19; quỹ là chốt tạm, Q9). Nhịp 4, 5, 8, 9, 11 đã sửa tại chỗ. Nhịp 5 là lượt đã ghi (mục 3), 0 lời gọi. Mỗi lần chạy thật là lượt **Thử 3 câu mẫu** (3 lời gọi, có phiếu mẫu ở mục 7) rồi run chấm sao khi cả 3 câu mẫu đạt (10 lời gọi nếu cấu hình y hệt lượt mẫu, 13 nếu đã đổi). P = 13 chỉ đủ một lượt mẫu cộng một run sao mỗi ngày: lượt mẫu đầu tiên của ngày trượt thì run sao chờ quỹ hồi lúc 07:00, nên **đủ 3 sao ở L2 có thể trải qua vài ngày**. Thời điểm trong bảng là thời gian chơi.

| # | Thời điểm | Trên màn hình | Người chơi làm | Lời thoại |
|---|---|---|---|---|
| 1 | 0:00–0:25 | Hiện trường | Click hoặc chạm tờ đơn | Cô Lan: câu theo nhánh của bản ghi (mục 3; sửa 2026-10-08, rà soát vòng 5) |
| 2 | 0:25–0:55 | Tua lại: Lược dao 128 xẻ Điều 12 thành dải nhỏ, khoản 2 và khoản 3 rơi vào hai dải khác nhau. Dải nào sáng, vào thùng, đứng hạng mấy là đúng `retrieved` và `pack.included` của bản ghi (số đo: cả hai dải vào thùng, cùng một tờ giấy vàng 2019 hạng 1; sửa 2026-10-08, rà soát vòng 5) | Xem; "Bỏ qua" | Cô Lan: "Đêm qua Bống nạp lại kho và chỉnh lược dao xuống 128 cho gọn." · Bống: "Em tưởng cắt nhỏ thì tìm cho chuẩn ạ." · Cô Lan: câu theo nhánh (mục 3) |
| 3 | 0:55–1:15 | Xe sách lưu trữ 2019 đẩy vào cạnh kệ. Thẻ nhiệm vụ: "13 câu · ≥8/10 câu thường đủ ý · không câu nào theo bản cũ" | Đọc | Cô Lan: "Kho cũng vừa nhận thêm bản quy chế 2019. Bản đó hết hiệu lực rồi, nhưng trông giống bản mới đến lạ." · "Mười ba câu tối nay: ít nhất tám trên mười câu thường phải đủ ý, và không câu nào được trả lời theo bản cũ." |
| 4 | 1:15–1:30 | Phiếu đoán 1 | Chọn (hoặc Bỏ qua) rồi bấm ~~Mở ca~~ **Xem lượt đã ghi** (sửa 2026-10-08) | — |
| 5 | 1:30–2:15 | ~~**Lần chạy 1** (bản sao lời giải L1 trên index 128/0).~~ **Lượt đã ghi** của lời giải mẫu L1 trên index 128/0 (sửa 2026-10-08, N4), tem "Lượt chạy đã ghi" kèm dòng "Lời giải mẫu L1 trên index 128/0, không phải cấu hình của bạn", 0 lời gọi. Camera bám câu của Hà (`lib-l2-v01`) | Xem | Sau run: câu theo nhánh (mục 3; sửa 2026-10-08, rà soát vòng 5) |
| 6 | 2:15–2:45 | Menu "Vì sao câu #N sai?", rồi chẩn đoán | Chọn lý do | — |
| 7 | 2:45–4:30 | Bàn thợ mở thêm: Lược dao, Nam châm bám Điều, Băng keo overlap, Màn lọc mờ, Kính lọc hiệu lực. Xem trước: dải đoạn của Điều 12 và câu bị cắt ngang chuyển đỏ; đèn chiếu 3 câu mẫu; thanh thùng | Đổi Lược dao, Nam châm, Băng keo; chiếu thử | Lược dao: "Kéo lược để đổi cỡ đoạn. Câu nào bị cắt ngang sẽ đỏ lên." · Băng keo: "Băng keo dán đè một ít chữ của đoạn trước sang đoạn sau. Mười đến hai mươi phần trăm là vừa, dán nhiều thì toàn chữ lặp." · Nam châm: "Nam châm bám Điều cắt đúng ranh giới điều, khoản thay vì đếm chữ. Quy chế có sẵn cấu trúc, sao không dùng?" |
| 8 | 4:30–4:45 | ~~Phiếu đoán 2~~ Phiếu mẫu, đánh dấu Chắc hoặc Đoán (mục 7, sửa 2026-10-08), cùng phiếu 2 nhánh không đổi `top_k` (sửa rà soát vòng 5) | Chọn | Nếu vừa tăng Móc kéo: "Kéo nhiều thì chắc ăn hơn, phải không? Đoán thử xem." |
| 9 | 4:45–5:30 | ~~Lần chạy 2~~ **Thử 3 câu mẫu** (3 lời gọi, sửa 2026-10-08, N2); cả 3 đạt thì phiếu 2 nhánh đổi `top_k` (nếu có) và 3+, rồi run chấm sao (10 lời gọi) | Xem | Nếu top_k ≥ 8: "Kéo mười đoạn thì thùng đầy, và bản 2019 cũng theo vào. Nhiều hơn không có nghĩa là chắc hơn." |
| 10 | 5:30–6:15 | Hậu kiểm 2. Nếu còn `ret.stale_doc`: Kính lọc hiệu lực sáng trong truy vết | Bật Kính lọc, chỉnh tiếp | Kính lọc: "Kính lọc hiệu lực chặn văn bản hết hạn ngay từ cửa, trước khi tìm." · Màn lọc mờ (nếu người chơi dùng): "Màn lọc bỏ những đoạn quá xa nghĩa. Đặt cao quá thì nó bỏ luôn cả đoạn đúng." |
| 11 | 6:15–7:00 | ~~Lần chạy 3~~ Phiếu mẫu, **Thử 3 câu mẫu** (3), rồi run chấm sao khi cả 3 đạt (10); thường là ngày hôm sau ở P = 13 (sửa 2026-10-08) | Xem | — |
| 12 | 7:00–7:45 | Truy vết: sao vàng, hạng của nó, và việc nó có bị cắt ở thùng không; Báo Tường; tờ đơn ở cửa phòng đào tạo đổi thành "ĐÃ NHẬN" | Mở các ca | Sao 1: "Phòng đào tạo nhận đơn của Hà rồi. Bạn ấy gửi hộp bánh cảm ơn, mình sẽ không chia cho Bống." · Sao 3: "Không một tờ giấy vàng nào lọt vào thùng. Phòng lưu trữ sẽ tự hào về bạn." |
| 13 | 7:45–8:30 | Lật mặt sau (mục 12) | Xem, tải | "Lật bàn lên đi. Lần này có cả bảng các kiểu cắt bạn đã thử." |
| 14 | 8:30–9:30 | Kiểm tra 60 giây | Phân loại 3 lỗi | — |
| — | sau level | Dạy lại (tuỳ chọn) | | Bống: "Em chỉnh lược 128 cho gọn mà sao hỏng ạ? Lần sau em nên chỉnh thế nào?" |

## 5. Đồ chơi và khối Phần 3

| Đồ chơi | Khối · tham số Phần 3 | Giá trị cho phép ở L2 | Trạng thái |
|---|---|---|---|
| Kệ sách + xe lưu trữ 2019 | `corpus` | `qcdt-2024` + `qcdt-2019`; mỗi đoạn mang `meta{dieu, hieu_luc}` | khoá |
| Lược dao | `chunker.chunk_size` | {128, 256, 512, 1024} | **mở** |
| Nam châm bám Điều | `chunker.strategy` | {`co_dinh`, `theo_dieu`} | **mở** |
| Băng keo overlap | `chunker.overlap_pct` | {0, 10, 20} | **mở** |
| Vòm Sao + Đèn pin | `vector_search` | như L1 | mở |
| Móc kéo K | `vector_search.top_k` | 1–10 | mở |
| Màn lọc mờ | `vector_search.score_threshold` | 0–0,9, bước 0,05 | **mở** |
| Kính lọc hiệu lực | `chunker.only_in_force` (tầng Index, engine-v0.2 E6: lọc trước khi tìm, mọi retriever cắm vào index đó đều không thấy văn bản hết hiệu lực) | `false` / `true` | **mở** |
| Thùng Context, Máy đóng tem | `context_packer` | `token_budget` 3000 (tài liệu + câu hỏi; dặn dò đi riêng, E8), `on_overflow` `cat_duoi` (khoá); `cite_ids` | như L1 |
| Bộ Óc, Lăng kính | `llm` | `profile` `can_bang` (khoá); thẻ G1–G6 như L1 | như L1 |

- Mỗi lần đổi Lược dao, Nam châm hay Băng keo chỉ là **chọn 1 trong 24 biến thể index đã tính sẵn** (Phần 3 §3.2, §3.7). Không có index lại khi đang chơi.
- `reorder_docs` của packer **không** thành đồ chơi ở L2; xem Câu hỏi mở 4.

**Cấu hình khởi đầu:**
- bản sao lời giải tốt nhất ở L1 của người chơi;
- ghi đè `chunker` thành `{"strategy": "co_dinh", "chunk_size": 128, "overlap_pct": 0}` (index Bống vừa nạp);
- `chunker.only_in_force: false`, `score_threshold: 0`;
- kho thêm `qcdt-2019`.

Trạng thái này đúng với cấu hình dở "chunk 128 với overlap 0%" của Phần 3 §3.3.

**Khai báo level:**
- `allowed_blocks`: như L1.
- `locked_nodes`: `q`, `kb`, `out`. `ix` không còn khoá.
- `param_limits`:

```json
{"vector_search.top_k": {"ge": 1, "le": 10},
 "vector_search.score_threshold": {"ge": 0, "le": 0.9, "multiple_of": 0.05},
 "context_packer.token_budget": {"const": 3000},
 "context_packer.on_overflow": {"const": "cat_duoi"},
 "llm.profile": {"const": "can_bang"}}
```

**Lời giải mẫu (hiệu chỉnh, không hiện giá trị; sửa 2026-10-08, rà soát vòng 6: L3 phát lượt đã ghi của nó, nên hành vi của nó lộ ra ở đó, còn giá trị thì không, [L3 §3](library-l3-article-number-lookup.md#3-mồi-truyện-và-hiện-trường)):** `chunker` `theo_dieu`/512/10 với `only_in_force: true`, `top_k` 3, `score_threshold` 0, tem bật, G1–G3.

**Xem trước tất định (miễn phí, không gọi LLM, không gold):**
- dải đoạn của điều đang xem, với ranh giới thật của biến thể và câu bị cắt ngang tô đỏ (dò ranh giới câu, không cần gold);
- đèn chiếu 3 câu mẫu: hạng, cosine, chữ đoạn, và nhãn `hieu_luc` in trên chính đoạn (metadata, không phải kết luận);
- thanh thùng ước tính.

Không có đồng hồ "Độ phủ/Độ sạch" của gameplay-direction, vì đồng hồ đó cần gold (D4).

## 6. Cấu hình ngây thơ phải trượt

[T] = tất định. [M] = phụ thuộc model, phải qua cổng hiệu chỉnh. Số liệu biến thể là **ước tính**; cổng phát hành chạy cả 24 biến thể và ghi lại kết quả thật.

| # | Cấu hình | Cơ chế | Ca trượt | Cờ |
|---|---|---|---|---|
| N1 | Khởi đầu: `co_dinh` 128/0, `top_k` lấy từ L1 (thường 3), lọc tắt | [M] Ở biến thể 128/0, khoản 2 và khoản 3 Điều 12 nằm ở hai đoạn khác nhau. Đo 2026-10-08: e5 đưa đủ đoạn khoản 2 và khoản 3 vào top 3 (hạng phủ đủ 3), đoạn 2019 hạng 1 cũng vào thùng; v01 trượt hay không tuỳ model có đọc nhầm số liệu 2019; bẫy thiếu khoản 3 tất định nằm ở N5. [T] Câu đáp án dài của các ca vai `cau-dai` (một ca thấy được, các ca ẩn) bắc qua ranh giới 128. [T] Đoạn 2019 gần giống đứng hạng ≤ K cho mọi ca bẫy | `lib-l2-v01`, ca thấy được vai `cau-dai`, ca ẩn vai `ngoai-le-khoan-sau` và `cau-dai`; mọi ca bẫy `lib-l2-t01`, `t02`, `t03` (vì `ret.stale_doc`) | `ret.gold_missing`, `ret.boundary_split`, `ret.stale_doc` |
| N2 | `co_dinh` 1024/0, `top_k` 10, lọc tắt ("kéo nhiều cho chắc") | [T] 10 đoạn × ~1.000 token ≫ thùng 3.000, nên `cat_duoi` cắt 7 đoạn trở lên. Đoạn đúng đứng hạng ≥ 3 bị cắt (`ctx.gold_dropped`). [T] Mỗi ca đẩy gần 3.000 token vào, nên riêng token đầu vào đã vượt ngân sách sao 2: engine đo 29.560/20.000 (regex-v1), Gemini thật 41.664/20.000 (2026-10-08, engine-spike-report §3.2). [T] Đoạn 2019 đứng hạng 1–2 nên vẫn còn trong thùng | mọi ca bẫy `lib-l2-t01`, `t02`, `t03`; các ca ẩn có đoạn đúng đứng hạng ≥ 3; **sao 2** | `pack.dropped`, `ctx.gold_dropped`, `budget.exceeded`, `ret.stale_doc` |
| N3 | `theo_dieu` 512/10, `top_k` 3, lọc **tắt** | [T] Chunk tốt nên đủ sao 1–2, nhưng đoạn 2019 vẫn vào thùng ở mọi ca bẫy | `lib-l2-t01`, `t02`, `t03` → **sao 3** | `ret.stale_doc` |
| N4 | Như mẫu nhưng `score_threshold` 0,8 | [T] Cosine của đoạn đúng ở phần lớn ca < 0,8 (cổng phát hành đo) nên thùng rỗng. [M] Có G3 thì model từ chối, không có G3 thì có thể bịa | đa số ca thường → **sao 1** | `ret.gold_missing` (đoạn bị lọc), `pack.tokens` ≈ 0 |
| N5 | `co_dinh` 256/20, `top_k` 1, lọc bật | [T] `top_k` 1 không chứa được cả khoản 2 lẫn khoản 3 khi chúng nằm ở hai đoạn | `lib-l2-v01`, ca `ngoai-le-khoan-sau` | `ret.gold_missing` |

**Bảng kết quả dự kiến** (ước tính, cổng phát hành thay bằng số đo):

| Cấu hình | v01 | ca thấy được `cau-dai` | t01 | t02 (`da-bai-bo`) | t03 | Token/ca | Sao |
|---|---|---|---|---|---|---|---|
| N1 (khởi đầu) | trượt [M] | trượt | trượt | trượt | trượt | ~1.100 | 0 |
| N2 | đạt | đạt | trượt | trượt | trượt | ~3.400 | 0–1 |
| N3 | đạt | đạt | trượt | trượt | trượt | ~1.800 | 2 |
| Mẫu | đạt | đạt | đạt | đạt | đạt | ~1.800 | 3 |

## 7. Bước đoán

**Sửa 2026-10-08:** như [L1 §7](library-l1-grounded-citation.md#7-bước-đoán-1-click-trước-mở-ca). Mọi phiếu bỏ qua được và có cờ **Chắc / Đoán**. Phiếu 1 chấm trên lượt đã ghi. ~~Trước mỗi lượt Thử 3 câu mẫu chỉ hỏi phiếu mẫu~~ Trước mỗi lượt Thử 3 câu mẫu hỏi phiếu mẫu (mỗi câu mẫu đạt hay trượt; là phiếu dùng để xét hoàn lượt) và phiếu 2 nhánh "không đổi `top_k`" (sửa 2026-10-08, rà soát vòng 5): phiếu này chấm trên v01, một câu mẫu, nên hỏi trước run chấm sao thì lượt mẫu vừa chạy đã lộ đáp án (run sao chỉ mở khi v01 đạt), và nó thành câu nhớ lại chứ không còn là dự đoán. Phiếu 2 nhánh "đổi `top_k`" và phiếu 3+ chỉ hỏi trước run chấm sao, vì chúng chấm trên token của cả run và trên cả 13 ca. Phiếu 1 sửa cùng vòng: lựa chọn theo các nhánh của bản ghi (mục 3), vì số đo cho thấy đoạn khoản 3 luôn được kéo về ở cấu hình này.

| Lần | Câu hỏi | Lựa chọn | Chấm (sau run) |
|---|---|---|---|
| 1 | "Lời giải mẫu L1 trên Lược dao 128: câu của Hà sẽ…" | Đạt · Thiếu vế nộp muộn (khoản 3) · Lấy số của bản 2019 | Theo `case.graded` của v01 trong lượt đã ghi: đạt → 1; ~~có giá trị `forbidden` của bản 2019~~ chữ trả lời có số 2019 ("một tuần", "1 tuần", "08 ngày", "8 ngày"; không tính "email", mục 3; sửa 2026-10-08, rà soát vòng 6) → 3; trượt khác → 2 |
| 2 (nếu đổi `top_k`) | "Bạn vừa đổi Móc kéo từ {a} lên {b}. Tổng token của run sẽ…" | Giảm · Gần như không đổi · Tăng dưới 30% · Tăng 30% trở lên | So `run.scored.tokens` với run trước |
| 2 (nếu không đổi `top_k`) | "Lần này câu của Hà sẽ…" | Đạt · Vẫn thiếu khoản 3 · Lấy nhầm bản 2019 | Theo `case.graded` của v01: đạt → 1; chữ trả lời có số 2019 (như phiếu 1) → 3; trượt khác → 2 (sửa 2026-10-08, rà soát vòng 6) |
| 3+ | "Trong 13 câu, bao nhiêu câu sẽ có giấy 2019 trong thùng?" | 0 · 1–2 · 3 trở lên | Đếm ca có `ret.stale_doc` |

## 8. Biên đạo lần chạy

Áp dụng toàn bộ luật trung thực và bảng event của [L1 mục 8](library-l1-grounded-citation.md#8-biên-đạo-lần-chạy). Thêm cho L2:

| Event | Hình ảnh | Bản chữ |
|---|---|---|
| `run.started` | Một dòng Ingestion: Lược dao lướt qua kệ, dải đoạn rơi vào khay | "Ingestion (offline, tính sẵn): {n} đoạn, trung bình {avg} token." (Phần 3 §3.1) |
| `step.finished` (vector_search) | Sao sáng. Đoạn của bản 2019 hiện như giấy ngả vàng, in "hết hiệu lực" lấy từ `meta.hieu_luc` (dữ kiện trung tính, không phải gold) | "Lấy 3 đoạn: Điều 12 (2024, 0,84), Điều 10 (2019, hết hiệu lực, 0,83)…" |
| `step.finished` (context_packer) | Khối to chất đầy thùng. Khối thừa rơi xuống sàn, có nhãn "bị cắt: hạng {r}" | "Thùng: 2.980/3.000 token. Bị cắt: 4 đoạn (hạng 4–7)." |
| `case.graded` | **ĐẠT:** sinh viên nhận phiếu. **TRƯỢT vì thiếu ý:** thẻ trả lời rách ở mép (câu cụt). **TRƯỢT có `ret.stale_doc`:** thẻ trả lời ngả vàng | Chữ ĐẠT/TRƯỢT kèm tiêu chí trượt |
| `run.finished` | Truy vết: sao vàng (một hoặc nhiều đoạn đáp án); đoạn đáp án bị chia đôi hiện hai nửa nối bằng nét đứt đỏ; hạng thật; đoạn bị cắt ở thùng có dấu kéo | ~~"Đoạn đáp án câu 1: khoản 2 (hạng 1, vào thùng), khoản 3 (hạng 9, không được kéo)."~~ "Đoạn đáp án câu 1: khoản 2 (hạng {r2}, vào thùng), khoản 3 (hạng {r3}, vào thùng)." Ở bản ghi 128/0, `top_k` 3, số đo cho hai khoản ở hạng 2 và 3, giấy 2019 hạng 1; chỉ khi {r3} > K mới ghi "khoản 3 (hạng {r3}, không được kéo)" (sửa 2026-10-08, rà soát vòng 6) |

Ca bám camera là `lib-l2-v01`. Câu hỏi của ca ẩn và ca bẫy không bao giờ hiện chữ (Phần 3 §3.7). Truy vết của chúng chỉ ghi vai bằng tiếng Việt, đạt/trượt và các cờ.

## 9. Tiêu chí chấm một ca

Giống [L1 mục 9](library-l1-grounded-citation.md#9-tiêu-chí-chấm-một-ca-máy-kiểm); chi tiết ở `grading` của [`library-l2.json`](../golden/library-l2.json). Cộng thêm:
- **Ca nhiều khoản** (ví dụ v01): `answer_points` có dữ kiện của **từng** khoản đáp án. Tiêu chí "có nguồn" đạt khi `cited_ids` có ít nhất một đoạn đáp án.
- **Ca bẫy văn bản cũ** (`lib-l2-t01`, `lib-l2-t03`): đạt khi có giá trị bản 2024 (`answer_points`), không có giá trị bản 2019 (`forbidden`), **và** không có đoạn `in_force: false` nào trong thùng của ca đó. Điều kiện cuối là tất định và lấy từ `pack.included` + `meta.hieu_luc`.
- **Ca `da-bai-bo`** (`lib-l2-t02`, quy định chỉ có ở bản 2019): `expect: abstain`, chấm như ca từ chối của L1, và cũng không có đoạn `in_force: false` trong thùng.
- Điều kiện "không có đoạn hết hiệu lực trong thùng" áp cho **mọi ca bẫy** và mọi ca vai `van-ban-cu` / `da-bai-bo`, kể cả ca ôn `lib-l2-r02`, `lib-l2-r04` ở ca trực.

## 10. Sao

| Sao | Điều kiện | Ghi chú |
|---|---|---|
| 1 | Ít nhất 8/10 ca thường đạt (`v01`–`v03` + 7 ca ẩn), **bắt buộc có `lib-l2-v01`** | Mở L3. Đơn của Hà được nhận |
| 2 | Có sao 1 **và** tổng token ≤ **20.000** | 1,25 × p50 của lời giải mẫu, làm tròn lên tới nghìn. Hiệu chỉnh 2026-10-08 với `gemini-3.5-flash-lite`, `can_bang`: lời giải mẫu 15.879 token (engine-spike-report §3.2) |
| 3 | Có sao 1 **và** mọi ca bẫy (`lib-l2-t01`, `t02`, `t03`) đều đạt **và** cả run không có ca nào có `ret.stale_doc` | Điều kiện "văn bản cũ trong thùng" là tất định. Phần câu chữ của câu trả lời là [M] |

**Cơ chế trượt của từng ca bẫy:**
- `t01` và `t03` (`van-ban-cu`) trượt vì **thiếu lọc hiệu lực**: đoạn 2019 gần giống, với thời hạn hoặc ngưỡng cũ, vào thùng (`ret.stale_doc`, [T]).
- `t02` (`da-bai-bo`) trượt cũng vì thiếu lọc hiệu lực, cộng thêm thiếu từ chối nếu Lăng kính không có G3 ([M]).

**Đạt được bằng đồ chơi đã mở?** Có.
- Sao 1 cần Nam châm (`theo_dieu`), hoặc Lược dao ≥ 512 kèm Băng keo 10–20%. Cả hai mở ở L2.
- Sao 2 cần `top_k` nhỏ (mở từ L1).
- Sao 3 cần Kính lọc hiệu lực (mở ở L2) cho cả ba ca bẫy, và thẻ G3 (mở ở L1) để `t02` từ chối.

## 11. Chẩn đoán và gợi ý

**Menu "Vì sao câu #N sai?"** Đáp án đúng của menu do cờ chẩn đoán của chính ca đó quyết định, không cố định.

| Tình huống | Lựa chọn | Đáp án theo cờ |
|---|---|---|
| Thiếu ý (v01 và các ca tương tự) | A. Đoạn quá nhỏ nên ý bị cắt sang đoạn khác · B. top_k quá thấp nên đoạn còn lại không được kéo về · C. Thùng đầy nên đoạn bị cắt · D. Model đọc đủ mà vẫn bỏ sót | `ret.boundary_split` → A; `ret.gold_rank` > K và đoạn không bị chia → B; `ctx.gold_dropped` → C; đủ đoạn trong thùng → D |
| Ca bẫy văn bản cũ trượt | **Văn bản 2019 hết hiệu lực vẫn được kéo vào thùng** · Model không biết năm hiện tại · Đoạn quá to · Thiếu thẻ G3 | `ret.stale_doc` |
| Vượt ngân sách | **Đoạn to và kéo nhiều nên thùng gần đầy ở mọi câu** · Model trả lời dài · Có ca timeout · Câu hỏi khó | `budget.exceeded` + `pack.tokens` |

**Lời chẩn đoán gắn với bằng chứng:**

| Cờ | Cô Lan nói |
|---|---|
| `ret.boundary_split` | "Câu đáp án của câu #{n} bị cắt đôi: nửa đầu ở đoạn {a}, nửa sau ở đoạn {b}. Trợ lý chỉ cầm được nửa đầu." |
| `ret.gold_missing` (thiếu một khoản) | "Câu #{n} cần cả khoản {k1} lẫn khoản {k2}. Khoản {k2} đứng hạng {rank}, Móc kéo dừng ở {k}." |
| `ctx.gold_dropped` | "Đoạn đúng của câu #{n} có được kéo về, hạng {rank}, nhưng thùng đầy nên bị cắt lúc đóng thùng." |
| `ret.stale_doc` | "Có {m} câu mang giấy 2019 vào thùng. Bản đó hết hiệu lực, dù chữ nghĩa giống hệt." |
| `budget.exceeded` | "Mỗi câu trung bình mang {avg} token tài liệu, thùng đầy {pct}%. Ngân sách là {budget}, run này tốn {tokens}." |

**Ba gợi ý tăng dần** (~~mở sau lần trượt thứ *n*~~; sửa 2026-10-08: mở theo yêu cầu sau lần trượt đầu, nấc sau mở bằng một thao tác nhìn miễn phí; gợi ý 3 là ví dụ mẫu cộng một câu biến thể (`lib-l2-rNN`: sao 1 thẻ `chunk.boundary`, sao 3 thẻ `retrieval.freshness`) và chỉ mở qua cổng gợi ý 3 (run chấm sao L2 tối đa 13 lời gọi, X28); sao 2 không có câu biến thể, vì nó là ngân sách của cả run: bài tự sửa là run chấm sao kế tiếp ([ca trực §2](daily-shift.md#2-chọn-sự-cố-móc-fsrs-chỉ-mô-tả), sửa 2026-10-08, rà soát vòng 3); tất cả như [L1 §11](library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý); không đổi ngưỡng):

| Mục tiêu đang trượt | Gợi ý 1 | Gợi ý 2 | Gợi ý 3 |
|---|---|---|---|
| Sao 1 | "Đọc chậm đoạn mà trợ lý đưa cho Hà. Nó dừng ở đâu?" | Dải đoạn của Điều 12 ở biến thể hiện tại, với ranh giới cắt và đoạn nào đã vào thùng (sau run nên được hiện gold) | "Thử Nam châm bám Điều, hoặc Lược 512 kèm Băng keo 10%, rồi chiếu thử câu của Hà." |
| Sao 3 | "Mở thùng của các ca trượt: có tờ giấy nào ngả vàng không?" | Danh sách đoạn trong thùng của mọi ca bẫy, **chỉ gồm metadata** (văn bản, số điều, hiệu lực), không có chữ | "Bật Kính lọc hiệu lực. Lọc trước khi tìm rẻ hơn dặn model tự chọn bản mới." |
| Sao 2 | "Câu nào tốn nhất? Thùng của nó đầy bao nhiêu?" | Dải token theo ca, kèm cỡ đoạn trung bình | "Đoạn nhỏ hơn hoặc ít đoạn hơn. Chiếu thử để chắc đoạn đúng vẫn trong K." |

## 12. Lật mặt sau

1. **Cấu hình:** graph JSON, kèm khác biệt so với lời giải L1 (`chunker`, kể cả `chunker.only_in_force`, và `score_threshold`).
2. **Ingestion và đồ thị:** dòng `IndexHandle(level_version, variant="theo_dieu-512-10")`, và chú thích rằng `corpus` + `chunker` không sinh node runtime (Phần 3 §3.6 bước 1); đoạn LangGraph giống L1.
3. **Prompt thật (X-quang)** của câu đang chọn.
4. **Bảng biến thể đã thử:** mỗi hàng là một biến thể người chơi đã chạy, gồm số ca đạt, token và số ca có giấy cũ. Đây là "nấc đã đo", không có nấc tốt nhất.

**Thẻ "Ngoài đời thật"**
- Văn bản có cấu trúc (quy chế, SOP, hợp đồng) nên cắt theo mục, điều, heading trước. Cỡ cố định là phương án sau cùng (Ngày 7, slide 31/60 và 50/60).
- Overlap thường 10–20% cỡ đoạn (Ngày 7, slide 33/60).
- Nhiều thư viện đo `chunk_size` bằng **ký tự**, không phải token. Ví dụ bộ cắt `RecursiveCharacterTextSplitter` của LangChain mặc định dùng `len()`. 512 ký tự tiếng Việt ít hơn nhiều so với 512 token, nên khi so sánh hãy đo bằng tokenizer.
- Gắn metadata hiệu lực hoặc ngày cho từng đoạn và lọc trước khi tìm, ví dụ với Chroma: `collection.query(query_texts=[q], n_results=3, where={"in_force": True})`.
- Đổi cách cắt là phải index lại. Đo bằng cùng một bộ câu hỏi trước và sau khi đổi, đừng đo bằng cảm giác.

## 13. Dạy lại

Bống hỏi: **"Em chỉnh lược 128 cho gọn mà sao hỏng ạ? Lần sau em nên chỉnh thế nào?"**

Khuôn và rubric ở [teach-back.md](teach-back.md) mục 3.2.

## 14. Biến thể ôn cho ca trực

| Ca ôn | Vai | Sự cố dựng sẵn | Phải sửa |
|---|---|---|---|
| `lib-l2-r01` | `ngoai-le-khoan-sau` ở một điều **khác** Điều 12 | "Bống lại kéo Lược về 128" | Nam châm bám Điều, hoặc Lược ≥ 512 kèm Băng keo |
| `lib-l2-r02` | `van-ban-cu`: một con số khác nhau giữa bản 2019 và 2024, không phải về bảo lưu | "Kho vừa nạp lại, Kính lọc hiệu lực bị tắt" | bật Kính lọc |
| `lib-l2-r03` | `cau-dai`: câu đáp án dài, bị cắt ngang ở 128 và 256 không overlap | "Băng keo bị gỡ, Lược đặt 256" | Băng keo ≥ 10% hoặc Nam châm |
| `lib-l2-r04` | `van-ban-cu`: ngưỡng vắng để không được dự thi, bản 2019 ghi khác bản 2024 | "Bống tắt Kính lọc vì 'lọc thì mất bớt câu trả lời'" | bật Kính lọc |

## 15. Tiếp cận

| Ẩn dụ | Bản chữ |
|---|---|
| Lược dao | Nhóm radio "Cỡ đoạn (chunk_size): 128 · 256 · 512 · 1024 token" |
| Nam châm bám Điều | Công tắc "Cắt theo điều, khoản (strategy: theo_dieu)" |
| Băng keo | Nhóm radio "Chồng lấp (overlap_pct): 0 · 10 · 20 %" |
| Dải đoạn, vết cắt đỏ | "Điều 12 được chia thành {n} đoạn. Câu bị cắt ngang: «…» (giữa đoạn {a} và {b})." |
| Giấy ngả vàng | Nhãn chữ "(bản 2019, hết hiệu lực)" ngay sau tên đoạn |
| Màn lọc mờ | Thanh trượt "Ngưỡng điểm (score_threshold)", bước 0,05, đọc to giá trị |
| Kính lọc hiệu lực | Công tắc "Chỉ văn bản còn hiệu lực (only_in_force)" |
| Thẻ trả lời rách hoặc vàng | Chữ "Trượt: thiếu ý {x}" / "Trượt: dùng văn bản hết hiệu lực" |

Chuyển động theo `prefers-reduced-motion`: không có lược lướt; dải đoạn hiện ngay.

## 16. Telemetry

Như L1, thêm:
- `toy.change{toy, from, to}` cho chunker, `top_k`, ngưỡng và bộ lọc;
- `variant.tried{variant}`;
- `preview.boundary_view{dieu}`;
- `misconception.topk{from, to, tokens_delta, pass_delta}`, ghi khi người chơi tăng `top_k` rồi chạy.

**KPI:**
- tỉ lệ người chơi từng thử `top_k` ≥ 8;
- trong số đó, tỉ lệ hạ `top_k` ở lần sau;
- thời gian từ `run.start{run:1}` đến khi đạt sao 1.

## 17. Câu hỏi mở

1. **Cấu hình khởi đầu khác Phần 3.** Phần 3 §3.3 viết khởi đầu L2 = "lời giải L1". Kịch bản ghi đè chunker thành 128/0, có lý do trong truyện (Bống nạp lại kho), để người chơi bắt đầu từ đúng cấu hình dở mà Phần 3 liệt kê. Cần chủ dự án đồng ý.
2. **Ngữ nghĩa của `theo_dieu`** (giả định, cần engine chốt):
   - cắt ở ranh giới khoản hoặc điều, gộp các khoản liền nhau của **cùng một điều** cho tới `chunk_size`;
   - một khoản dài hơn `chunk_size` thì cắt cố định bên trong;
   - overlap chỉ áp cho các vết cắt bên trong một điều;
   - client và engine dùng chung thuật toán (gameplay-direction §4).
3. **Có đưa "không có đoạn hết hiệu lực trong thùng" vào tiêu chí chấm của mọi ca bẫy không?** Đây là tiêu chí tất định nhưng chặt hơn việc chỉ chấm câu chữ. Lý do: Ngày 8, slide 31/46 dạy lọc trước khi tìm; nếu chỉ chấm câu chữ thì bẫy phụ thuộc model, vì có `meta.hieu_luc` trong packet thì model thường tự chọn bản mới. File golden L2 đã ghi luật này vào `grading` (mục 9). Chủ Phần 4 vẫn cần duyệt.
4. **`reorder_docs`** (phản biện, mức low): không đưa thành đồ chơi; codex nói về lost in the middle với nhãn "chỉ để thông tin". Nếu giữ thì chỉ là tiêu chí `info`.
5. **Đồng hồ "Độ phủ/Độ sạch" và "sao vàng" lúc xem trước** của gameplay-direction cần gold, nên trái D4. Đã thay bằng các số đo không cần gold (câu bị cắt ngang, độ đầy thùng).
6. **"Overlap 15%"** của gameplay-direction không nằm trong {0, 10, 20}. Kịch bản chỉ dùng 0, 10, 20.
7. **Đã đo (2026-10-08): hạng của đoạn khoản 3** cho câu của Hà. Ở `co_dinh` 128/0, e5 đưa cả đoạn khoản 2 lẫn đoạn khoản 3 vào top 3 (hạng phủ đủ 3; trên 24 biến thể từ 1 đến 4). Câu v01 vốn không nhắc "ốm" hay "viện", nên giữ nguyên câu: kỳ vọng `ret.gold_missing` của N1 trên v01 chuyển sang [M], bẫy thiếu khoản 3 tất định nằm ở N5 (`top_k` 1). N1 vẫn là cấu hình khởi đầu nguyên trạng (`vs.top_k` 2 hoặc 1 làm bẫy cắn nhưng N1 sẽ không còn là khởi đầu).
8. **Cổng cho bản ghi của L2** (thêm 2026-10-08, rà soát vòng 5). Hiện trường, cờ thế giới và nhịp 1, 2, 5 kể một lượt chạy thật mang tem "Lượt chạy đã ghi", nên phải khớp dữ kiện của bản ghi. Trước khi phát hành bản ghi của B0 ([roadmap-v0.4](../../design/roadmap-v0.4.md) B0), người viết nội dung đối chiếu `case.graded`, `retrieved` và `pack.included` của v01 với bảng nhánh ở mục 3; rơi vào nhánh Đạt (hoặc lý do khác) thì viết lại cảnh trước khi phát hành. Không ghi lại cho tới khi model tình cờ trượt: đó là chọn kết quả, và tem "Lượt chạy đã ghi" khi đó sẽ thành nói dối.
