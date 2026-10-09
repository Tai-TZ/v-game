> **Trạng thái:** kịch bản v0.1 (2026-10-08), chưa xây ([roadmap-v0.4](../../design/roadmap-v0.4.md) N25; xây ở T20). Phòng phụ của Thư viện, không phải một khu.
> **Nguồn:** Ngày 10, slide 10/28 (upsert idempotent), 12/28 (chuẩn hoá Unicode NFC/NFD), 15/28 (6 chiều chất lượng dữ liệu), 17/28 ("nhiều lỗi nhìn giống model hallucination nhưng gốc rễ là data pipeline bug"), 25/28 (chạy lại pipeline hai lần phải cho kết quả như chạy một lần); Ngày 7, slide 13/60 (che PII trước khi embed).
> **Liên quan:** [Thư viện](library.md) · [L2](library-l2-chunk-tuning.md) (Kính lọc hiệu lực) · [Nhân vật](npc-cast.md) · [Bản đồ phủ](../course-coverage.md) (Ngày 10 chưa có màn nào trước kịch bản này)

# Thư viện · Phòng phụ: Cổng nạp liệu

**Tem ở tiêu đề level:** "Dữ liệu ghi sẵn" ([frontend architecture §8.4](../../design/frontend-architecture.md#84-tem-nguồn-và-trung-thực-số-liệu)). Hình truy xuất mang tem "Tính sẵn từ chỉ mục" (tính trên vector tính sẵn); câu trả lời mang tem "Lượt chạy đã ghi". Level không gọi AI khi chơi.

## 1. Metadata

| Trường | Giá trị |
|---|---|
| Mã level | `library-intake`; mã ca `lib-n1-vNN`, `lib-n1-hNN`, `lib-n1-tNN` |
| Nơi chốn | Phòng nạp sách sau Thư viện: một băng chuyền chở tờ thông báo từ xe của chú Bảy vào kho |
| NPC | Cô Lan giao việc; Bống phụ trách nạp ("cho nhanh"); chú Bảy đẩy xe |
| Mở khi | Đạt sao 1 ở Thư viện L2 (người chơi đã biết Kính lọc hiệu lực) |
| Thời lượng | 8–10 phút |
| Lời gọi | 0 mỗi lượt; 3 lời gọi một lần lúc build cho phần "xem trợ lý trả lời" của cấu hình khởi đầu (3 câu thấy được, mục 3) |

## 2. Mục tiêu học

1. Nhiều câu trả lời trông như bịa thật ra là lỗi pipeline: dữ liệu cũ, trùng, hỏng mã hoá.
2. Cổng chất lượng phải chấm hai chiều: chặt quá thì rơi mất bản ghi ngắn mà sống còn.
3. Chạy pipeline hai lần không được nhân đôi dữ liệu (upsert idempotent).
4. Chuẩn hoá Unicode (NFC) phải chạy trước khi bỏ trùng; che PII trước khi embed.

**Hiểu lầm nhắm tới:** "trợ lý trả lời sai là do model bịa"; "lọc càng chặt càng sạch"; "chạy lại cho chắc thì có sao đâu".

## 3. Mồi truyện và Hiện trường

Phòng đào tạo vừa gửi 30 thông báo cho năm học 2026–2027. Bống nạp hết trong năm phút. Sáng hôm sau, quầy tra cứu nhận ba lời than: trợ lý báo lịch thi của năm ngoái, một câu trả lời đầy ký tự lạ, và thùng của một câu chứa hai đoạn y hệt nhau.

- Bống: "Em nạp hết cho nhanh ạ. Lọc làm gì cho mất công."
- Cô Lan: "Trợ lý không bịa đâu. Nó đọc đúng những gì mình đưa vào."

Người chơi bấm vào lời than thứ nhất: màn Tua lại hiện **lượt đã ghi** của cấu hình khởi đầu, câu trả lời trích lịch thi đã hết hạn (tem "Lượt chạy đã ghi").

**Lượt đã ghi gồm đúng 3 câu thấy được** (sửa 2026-10-08), mỗi câu khớp một lời than: `v01` hỏi lịch thi học kỳ 1 (`tb-04` hết hạn đứng đầu), `v02` chạm một bản hỏng mã hoá, `v03` có cặp `tb-07`/`tb-07b` cùng vào thùng. Câu ẩn và câu bẫy không ghi: lượt đã ghi hiện chữ câu trả lời, mà câu trả lời lộ nội dung câu hỏi (luật dùng chung số 2); chấm sao cũng không cần câu trả lời, vì tiêu chí chỉ xét top 3 (mục 7).

## 4. Dữ liệu: 30 bản ghi

Mỗi bản ghi là một thông báo hư cấu của Trường Đại học Sao Mai: `{id, tieu_de, noi_dung, ngay_ban_hanh, hieu_luc_den, nguon}`. Embedding e5 của từng bản ghi, của bản đã chuẩn hoá NFC và của bản đã che PII đều **tính sẵn lúc build**; không embed lúc chạy.

| Loại | Số bản | Ví dụ cài sẵn | Chiều chất lượng (Ngày 10, slide 15/28) |
|---|---|---|---|
| Sạch | 18 | lịch thi, thủ tục phúc khảo, học bổng | |
| Trùng | 2 cặp | `tb-07` và `tb-07b` cùng chữ nhưng `tb-07b` ở dạng NFD (nhìn y hệt, khác byte); `tb-12` được gửi hai lần | Uniqueness, Consistency |
| Hỏng mã hoá | 2 | "Há»c phÃ­ há»c ká»³ 1…" | Validity |
| Hết hạn | 2 | `tb-03` mức học phí năm 2025–2026 (bẫy `t02`), `tb-04` lịch thi học kỳ 1 năm 2025–2026 (câu `v01`); cả hai có `hieu_luc_den` đã qua | Timeliness |
| Thiếu trường | 2 | `noi_dung` rỗng; thiếu `ngay_ban_hanh` | Completeness |
| Có PII | 1 | danh sách sinh viên nợ học phí kèm số điện thoại "09 12 34 56 78" | (Ngày 7: che trước khi embed) |
| **Ngắn mà sống còn** | 1 | `tb-09`, một câu: "Hạn cuối nộp học phí học kỳ 1 năm học 2026–2027 là ngày 15/10/2026." (khoảng 20 token) | bẫy của cổng quá chặt |

Chiều thứ sáu, Accuracy (đúng với thực tế), cần đối chiếu nguồn gốc nên không có cổng trong level này; Lật mặt sau nói rõ.

## 5. Đồ chơi → khối

| Đồ chơi | Khối (mới) | Tham số |
|---|---|---|
| Máy là chữ | `quality_gate.normalize` | `nfc` bật/tắt |
| Kính soi chữ | `quality_gate.validity` | loại bản ghi có chuỗi mã hoá hỏng hoặc ký tự điều khiển |
| Ô kiểm trường | `quality_gate.required_fields` | ⊆ {`noi_dung`, `ngay_ban_hanh`, `hieu_luc_den`} |
| Cân | `quality_gate.min_tokens` | 0–60, bước 10 |
| Tem hạn | `quality_gate.drop_expired` | bật/tắt (so `hieu_luc_den` với ngày trong truyện, 2026-10-08) |
| Máy soi trùng | `quality_gate.dedupe` | băm `noi_dung` (sau Máy là chữ nếu Máy là chữ đứng trước) |
| Kính PII | `quality_gate.pii` | `che` hoặc `chan`; regex theo đầu số và độ dài cho SĐT (chấp nhận dấu cách giữa các nhóm số), 12 chữ số với 3 số đầu là mã tỉnh hợp lệ cho CCCD, và email. SĐT và CCCD không có chữ số kiểm tra |
| Công tắc ghi | `upsert.mode` | `noi_them` hoặc `ghi_de_theo_ma` (khoá `id`) |
| Thùng cách ly | (hình) | bản ghi bị loại nằm đây, mỗi bản một chip lý do |

Thứ tự trạm trên băng chuyền kéo đổi được; Máy soi trùng đứng trước Máy là chữ thì cặp NFD lọt. Truy xuất cố định: Vòm Sao `top_k = 3` trên kho sau dây chuyền.

**Ba nút:**
- **Chạy dây chuyền** (0 lời gọi, xem trước): bản ghi đi qua từng trạm, bản bị loại rơi vào Thùng cách ly. Bấm lần hai là chạy lại cùng 30 bản ghi (mô phỏng lần chạy cron hôm sau).
- **Chiếu câu mẫu** (0 lời gọi, xem trước): Đèn pin chiếu 3 câu mẫu lên kho hiện tại, hiện 3 bản ghi vào thùng kèm hạng và cosine (chưa nói bản nào là đáp án, luật X11).
- **Chấm sao** (0 lời gọi, lượt chấm thật của level; sửa 2026-10-08, rà soát vòng 3): server chạy dây chuyền hai lần từ kho trống với cấu hình hiện tại, rồi chấm 10 câu trên kho sau lần thứ hai (mục 7). Kết quả chỉ phụ thuộc cấu hình, nên bấm lại khi không đổi gì cho đúng kết quả cũ và không tính là một lần trượt nữa.

## 6. Ca test

10 câu: 3 thấy được (`v01`–`v03`), 5 ẩn (`h01`–`h05`), 2 bẫy (`t01`, `t02`). Câu hỏi và embedding tính sẵn; câu ẩn và câu bẫy không bao giờ hiện chữ.

| Ca | Hỏi về | Bẫy |
|---|---|---|
| `lib-n1-t01` | hạn nộp học phí học kỳ 1 | đáp án chỉ có ở `tb-09` (bản ngắn); Cân ≥ 30 loại nó |
| `lib-n1-t02` | mức học phí năm nay | `tb-03` (hết hạn) đứng hạng 1 nếu không có Tem hạn |

## 7. Chấm và sao

Mỗi câu đạt khi: bản ghi đáp án nằm trong top 3; không bản ghi hết hạn, hỏng mã hoá hay chứa PII chưa che nào nằm trong top 3; và top 3 không có hai bản cùng nội dung.

| Sao | Điều kiện |
|---|---|
| 1 | ≥ 8/10 câu đạt |
| 2 | **Ngân sách kho:** sau hai lần chạy dây chuyền của lượt Chấm sao, kho có đúng số bản ghi hợp lệ, không bản nào bị nhân đôi (lần chạy thứ hai thêm 0 bản ghi) |
| 3 | **An toàn hai chiều:** cả hai câu bẫy đạt (`tb-09` sống sót, `tb-03` không vào thùng) **và** kho không có PII chưa che |

Sao 2 và 3 chỉ tính khi đã có sao 1. Mọi bẫy đều tất định ([T]): không phần nào phụ thuộc model.

**Cấu hình ngây thơ phải trượt:**

| Mã | Cấu hình | Trượt vì |
|---|---|---|
| I-N1 | không cổng nào, `noi_them` (cấu hình khởi đầu của Bống) | bản hết hạn và bản hỏng mã hoá vào thùng; trượt sao 1 |
| I-N2 | đủ cổng, Cân 40 "cho sạch" | mất `tb-09`; `t01` trượt, mất sao 3 |
| I-N3 | như lời giải mẫu nhưng bỏ Máy là chữ | Máy soi trùng so byte nên `tb-07b` (dạng NFD) lọt: kho thừa một bản, trượt sao 2. Chỉ `v03` hỏi tới nội dung của `tb-07`, nên chỉ câu đó trượt (top 3 có hai bản cùng nội dung, so sau NFC) và sao 1 vẫn đạt 9/10 |
| I-N4 | đủ cổng, `noi_them` | lần chạy thứ hai nhân đôi kho; trượt sao 2 |

**Lời giải mẫu:** Máy là chữ → Kính soi chữ → Ô kiểm trường (`noi_dung`, `ngay_ban_hanh`) → Tem hạn → Máy soi trùng → Kính PII (`che`), Cân ≤ 10, `ghi_de_theo_ma`.

## 8. Biên đạo và chẩn đoán

- Lần chạy đầu chiếu trên băng chuyền: mỗi bản ghi là một tờ giấy; tờ bị loại rơi vào Thùng cách ly với chip lý do ("hết hạn 30/06/2026", "ký tự hỏng", "trùng `tb-07`"). Sau lượt chấm, một **đường dòng dõi** nối câu trả lời sai về mã bản ghi gây ra nó.
- Câu trả lời của trợ lý chỉ có ở lượt đã ghi của cấu hình khởi đầu (3 câu thấy được, ghi một lần; mục 3). Với cấu hình của người chơi, game hiện thùng 3 bản ghi mà trợ lý sẽ nhận, không giả câu trả lời.

| Tình huống | Cô Lan nói |
|---|---|
| Bản hết hạn vào thùng | "Câu #{n} nhận `{id}`, hết hiệu lực từ {ngay}. Trợ lý đọc đúng tờ mình đưa, chỉ là tờ đó cũ." |
| Bản ngắn bị Cân loại | "Cân đã bỏ `tb-09` vì ngắn {k} token. Tờ ngắn nhất kho lại là tờ duy nhất nói hạn nộp." |
| Nhân đôi | "Lần chạy thứ hai thêm {m} bản ghi. Kho bây giờ có hai bản của mọi thông báo." |
| Trùng lọt vì NFD | "`tb-07` và `tb-07b` trông y hệt, nhưng một bản viết dấu kiểu khác. Máy soi trùng so byte, không so chữ." |

**Gợi ý** (thang N16: mở theo yêu cầu sau lần chấm đầu; nấc sau mở khi người chơi đã chiếu đèn hoặc mở Thùng cách ly từ lần trước). Gợi ý 3 đưa núm lời giải, nên đi qua **cổng gợi ý 3** ở [overview §4](overview.md#4-các-luật-dùng-chung-cho-mọi-kịch-bản) luật 5 (sửa 2026-10-08, X28): level 0 lời gọi, nên chỉ mở sau lần Chấm sao trượt thứ ba ở cùng sao, trên ba cấu hình khác nhau, khi người chơi đã nhìn thêm sau gợi ý 2.
1. "Câu #{n} trượt. Tờ trong thùng của nó còn hiệu lực không?"
2. Thùng cách ly sắp theo lý do, cạnh danh sách bản ghi trong thùng của các câu trượt.
3. "Đặt Tem hạn, hạ Cân xuống dưới 20, và gạt Công tắc ghi sang ghi đè theo mã."

**Bài biến thể sau gợi ý 3:** một lô 6 bản ghi mới (`tb-x01`–`x06`): một bản sạch, một bản ngắn mà sống còn, một bản hết hạn, một bản hỏng mã hoá, một bản trùng dạng NFD với một bản sạch trong kho, một bản có PII. Người chơi cho lô này đi qua dây chuyền đã sửa, không gợi ý, và phải để qua bản sạch và bản ngắn, cho bản PII qua sau khi đã che, và chặn đúng ba bản còn lại. Chấm tất định, 0 lời gọi.

## 9. Lật mặt sau: Ngoài đời thật

- "Trông như bịa" thường là lỗi dữ liệu. Trước khi sửa prompt, lần ngược câu trả lời sai về bản ghi gốc (dòng dõi dữ liệu).
- Năm trạm của level khớp năm trong sáu chiều chất lượng của Ngày 10; Accuracy cần đối chiếu nguồn gốc và quy tắc nghiệp vụ.
- Upsert theo khoá ổn định là điều kiện để chạy lại an toàn; thiếu nó, vector store đầy bản trùng.
- Tiếng Việt có hai cách mã hoá dấu (NFC, NFD); chuẩn hoá trước khi băm, trước khi so khớp, trước khi embed.
- PII che trước khi embed, vì vector không xoá chọn lọc được.

## 10. Engine và dữ liệu cần thêm

- Khối `quality_gate`, `upsert`; chỉ mục con dựng bằng cách lọc 30 vector tính sẵn (không embed lúc chạy).
- **Xem trước** (bản ghi nào qua cổng nào, thùng của câu mẫu) chạy ở client trên file tĩnh do script build xuất (N21).
- **Chấm sao** chạy ở server bằng bảng cosine tính sẵn (câu × biến thể bản ghi, vài trăm số): không cần model embedding lúc chạy, nên nhẹ đủ cho Render free, và đáp án của câu ẩn không xuống trình duyệt (D4).
- Script build: embed 30 bản ghi × 3 dạng, lô biến thể 6 bản ghi (mục 8) và 10 câu bằng e5 cục bộ; ghi câu trả lời của cấu hình khởi đầu cho 3 câu thấy được (3 lời gọi một lần).
- Test: mỗi cấu hình ngây thơ trượt đúng sao ở bảng mục 7; lời giải mẫu đạt 3 sao; chạy dây chuyền hai lần với `ghi_de_theo_ma` cho cùng kho.
- `zones.json` (`backend/src/vgame/content/data/zones.json`, nguồn duy nhất của nội dung khu): thêm level `library-intake` vào khu `library` cùng điều kiện mở (sửa 2026-10-08).

## 11. Telemetry và câu hỏi mở

**Telemetry:** `intake.open` → `gate.place{station, order}` → `pipeline.run{n, admitted, quarantined}` → `probe.shine{case}` → `grade{passed, stars}` → `lineage.open{case}`.

**Câu hỏi mở:**
1. Thêm thẻ khái niệm `data.pipeline` vào ca trực (sự cố mẫu: Tem hạn bị tắt) khi ca trực có lưu trữ bền (T4).
2. Mức Cân của bẫy `tb-09` (≥ 30 token) đo lại bằng `count_tokens` lúc build.
