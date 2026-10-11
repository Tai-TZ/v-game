> **Trạng thái:** đề xuất, chờ chủ dự án duyệt. Là lát cắt dọc đầu tiên của [hướng gameplay Xưởng Đồ Chơi](gameplay-direction.md) (§5: "Prototype đầu tiên: Vòm Sao"), đã được chủ dự án duyệt hướng ngày 2026-10-11.
> **Phạm vi file được đụng:** chỉ `frontend/` và file này. Không đổi engine, không đổi contract sự kiện.
> **Liên quan:** [bàn thợ v0.1](workbench-v0.1.md) · [art direction](art-direction.md) · [Phần 3](part-3-block-system.md) · [L1 §11](../content/scenarios/library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý) · [L3](../content/scenarios/library-l3-article-number-lookup.md)

# Vòm Sao v0.1: món đồ chơi đầu tiên thay cho form

## 1. Vì sao

Bàn thợ hôm nay gọi tên mười món đồ vật — Vòm Sao, Đèn pin, Móc kéo, Lược dao, Tủ ngăn kéo, Kính lúp, Máy đóng tem, Lăng kính, Phễu, Bập bênh — rồi vẽ tất cả thành `<select>` và `<input type=range>`. Chủ dự án xem bản chạy ngày 2026-10-11 và nói đúng một câu: *"nhìn không phải game mà là một bài học bình thường"*. Lược dao, thứ đáng ra là một lưỡi dao cắt văn bản, đang là bốn dòng chữ có ổ khoá.

Vòm Sao đi trước vì nó là món **duy nhất** mà dữ liệu thật đã có sẵn đủ để vẽ, không cần thêm gì ở engine.

## 2. Không dùng three.js

`frontend/scripts/check-bundle.mjs` gác hai luật: bàn thợ thêm tối đa **120 kB** gzip, và **không chunk nào của bàn thợ được chứa three.js** (bàn thợ v0.1 §10). Chunk three.js của `/play` hiện nặng 265 kB gzip, tức hơn gấp đôi cả ngân sách bàn thợ.

Vòm Sao dựng bằng **canvas 2D**. "2.5D" ở đây là cách nhìn — chiếu isometric, xếp lớp theo độ sâu, bóng phẳng — không phải đòi hỏi engine 3D. Một trường vài trăm điểm với chùm sáng xoay thì canvas 2D thừa sức, tốn gần 0 kB, và chạy mượt trên GPU tích hợp. Hướng gameplay §5 viết "Vòm Sao là một `THREE.Points`"; đó là **điểm lệch thứ 15**, không có trong bảng §13.2 của đặc tả, và file này chốt nó về canvas 2D.

Chi phí dự kiến: dưới 8 kB gzip, nên bàn thợ còn khoảng 80 kB dư cho chín món sau.

## 3. Dữ liệu: chỉ vẽ thứ đã biết

Mọi thứ Vòm Sao vẽ đều lấy từ sự kiện đã chạy, không thêm trường nào.

| Vật trên màn | Lấy từ | Kiểu |
|---|---|---|
| Một ngôi sao | `RetrievedItem` trong fact `retrieved` của bước `vector_search` | `chunk_id`, `rank` (1-based), `score`, `doc_id`, `dieu`, `khoan`, `hieu_luc` |
| Sao vàng (đoạn đáp án) | `report.gold[caseId].gold_chunks` | danh sách `chunk_id` |
| Hạng thật của sao vàng | `report.gold[caseId].ranks[node]` | hạng trong **toàn bộ** xếp hạng của khối đó, kể cả khi nằm ngoài `top_k`; `null` = không có |
| Sao vàng có vào thùng không | `report.gold[caseId].in_pack` | bool |
| Vì sao trượt | `report.gold[caseId].flags` | `ret.gold_missing`, `ret.gold_rank`, `ret.boundary_split`, `ctx.gold_dropped` |

**Vòm Sao tự lọc về ba câu mẫu, không tin dữ liệu đã sạch.** Hai nguồn hành xử khác nhau:

- **File tĩnh** `frontend/public/runs/*.json` đã qua `redact`, nên `report.gold` chỉ còn ca `visible` (kiểm trên bản ghi L3: đúng ba khoá `lib-l3-v01..v03`).
- **Lượt chạy thật** thì **không**: `LevelEvaluator.report` dựng `gold` cho mọi ca đã chấm, và `backend/tests/test_api_runs.py:176` khẳng định đúng điều đó — `set(report["gold"]) == graded`, tức cả 10 ca của L1.

Nên Vòm Sao chỉ đọc `report.gold[caseId]` khi `caseId` có `role === "visible"` trong `run.started`, và test ở mục 9 giữ luật này. Điểm lệch số 12 của đặc tả §13.2 (hiện sao vàng kèm hạng thật) **tự tan** cho ba câu mẫu: không cần đổi luật "`case.graded` không mang gold", vì hạng nằm ở `run.finished` chứ không ở `case.graded`.

> **Việc cho chủ dự án, ngoài phạm vi file này:** lượt chạy thật đang gửi `gold_chunks`, `ranks` và `flags` của ca ẩn và ca bẫy về client. Câu hỏi của chúng vẫn không bao giờ lộ, nên không giải ngay được; nhưng biết đoạn nào là đáp án của ca ẩn thì lượt sau có thể chỉnh `top_k` và Lược dao cho trúng bộ ca ẩn. Cần chốt có lọc `report.gold` theo vai ngay trong `run.finished` hay không.

## 4. Hai pha, vì chưa có endpoint xem trước

Bàn thợ v0.1 §12 ghi phần xem trước tất định cần "backend có endpoint xem trước không gọi AI". Endpoint đó **chưa tồn tại** (đã kiểm `backend/src/vgame/api/routes/`). Nên:

**Pha 1 (file này).** Vòm Sao vẽ dữ liệu của lượt đã chạy: lượt đã ghi tĩnh trong `frontend/public/runs/<level>.json` khi mở màn, hoặc lượt vừa chạy xong. Người chơi **khám phá** được — chọn câu mẫu, rê vào sao để đọc hạng và cosine, thấy sao vàng ở đâu — nhưng vặn núm thì vòm chưa đổi.

**Pha 2 (sau).** Thêm `POST /api/preview/retrieval` (không gọi LLM, chỉ truy xuất trên index đã ship) để đổi `top_k` hoặc biến thể Lược dao là vòm vẽ lại trong dưới một giây. Đây mới là "mỗi cú vặn núm cho phản hồi tức thì" của hướng gameplay §1.

Pha 1 đứng một mình vẫn đáng làm: nó biến bảng số thành hình, và là thứ chủ dự án nhìn thấy ngay.

## 5. Vẽ gì

Vòm là một **cung tròn** chiếm chiều ngang khe, nhìn hơi chếch từ trên xuống (ellipse, tỉ lệ trục ngắn 0,45 — đủ gợi chiều sâu, không méo).

- **Đèn pin** đặt ở đáy cung, chùm sáng là một hình quạt mở khoảng 30°, hướng lên.
- **Góc của mỗi sao so với trục chùm** = `(1 − score)` chuẩn hoá trong khoảng score của chính lượt đó. Sao cosine cao nằm trong chùm, sao thấp dạt ra rìa. Đây là **hình chiếu**, và màn hình phải nói thế (mục 7).
- **Độ sáng và cỡ sao** theo `rank`: hạng 1 sáng nhất.
- **Sao vàng** tô màu `accent`, luôn có nhãn hạng thật cạnh nó. Nằm ngoài `top_k` thì đặt ngoài rìa cung kèm nét đứt nối về chùm và chữ "hạng {n}" — đúng cảnh L3: đoạn Điều 47 khoản 2 ở **hạng 72** trong khi Điều 53 và 13 chiếm chỗ trên nó.
- **Sao của văn bản hết hiệu lực** (`hieu_luc: false`) có viền `warning` — đó là "tờ giấy vàng 2019" của L2.
- **Phần trời còn lại** không vẽ: ta không biết score của các đoạn khác. Thay vào đó một dòng "còn {n} đoạn nữa trong kho, không nằm trong {k} đoạn đã kéo". Không bịa sao.

## 6. Chạm vào được gì

| Thao tác | Kết quả | Tốn |
|---|---|---|
| Chọn câu mẫu (#1, #2, #3) | vòm vẽ lại theo `retrieved` của câu đó | 0 |
| Rê chuột hoặc Tab tới một sao | thẻ nhỏ: Điều, khoản, hạng, cosine, còn hiệu lực hay không | 0 |
| Chọn một sao | làm nổi đúng đoạn đó ở bảng fact bên dưới (`chunk_id` khớp) | 0 |
| Bấm sao vàng | cuộn tới dòng chẩn đoán của câu đó | 0 |

Không có thao tác nào gọi AI. Toàn bộ mục này là phần "luôn miễn phí" của ca trực §3.1.

## 7. Luật trung thực

Theo hướng gameplay §4 và art direction §1.3:

- Nhãn **"hình chiếu"** hiện cạnh vòm. Vị trí sao là cách vẽ, không phải toạ độ thật trong không gian embedding.
- **Hạng và cosine luôn in bằng số**, không chỉ bằng vị trí hay độ sáng.
- Không vẽ sao cho đoạn không có trong `retrieved`.
- Lượt đã ghi giữ tem "Lượt chạy đã ghi" đang có; Vòm Sao không được làm nó trông như lượt vừa chạy.
- Không bloom, không glow, không hạt lấp lánh, không trời gradient (art §1.3). Sao là chấm tròn phẳng có viền.

## 8. Tiếp cận được

- Canvas là hình, nên **mọi sao cũng là một danh sách DOM** `sr-only` đặt cạnh: mỗi mục một `<button>` mang "Điều {d} khoản {k}, hạng {n}, cosine {s}". Tab đi qua được, đọc màn hình đọc được, và đó cũng là đường chọn sao bằng bàn phím.
- Canvas mang `role="img"` với `aria-label` tóm tắt: "{k} đoạn đã kéo, đoạn đáp án ở hạng {n}".
- Không dùng màu làm tín hiệu duy nhất: sao vàng có cả nhãn chữ, sao hết hiệu lực có cả viền và chữ trong thẻ.
- `prefers-reduced-motion`: chùm sáng không quét, vẽ thẳng ở vị trí cuối. Không có vòng lặp idle — vẽ một lần mỗi khi dữ liệu hoặc câu đang chọn đổi, đúng luật "đứng yên là im lặng" (art §1.2 nguyên tắc 6).

## 9. Kiểm

- Hàm thuần `starField(items, gold, node)` → danh sách sao đã có toạ độ, test bằng `retrieved` thật lấy từ `frontend/public/runs/*.json`, không mock.
- Sao vàng ngoài `top_k` phải có nhãn hạng; test bằng chính `lib-l3-v01` (`ranks: {vs: 72}`, `in_pack: false`).
- Ca ẩn và ca bẫy **không** sinh sao vàng, kể cả khi truyền nhầm: khẳng định `starField` bỏ qua ca không có trong `report.gold`.
- Danh sách DOM và canvas luôn cùng số sao.
- Ngân sách: `npm run build` giữ bàn thợ dưới 120 kB và không có three.js trong chunk của nó.

## 10. Chưa làm ở v0.1

- Vặn núm để vòm vẽ lại (cần endpoint pha 2).
- Vòm cho khối `bm25_search`, `fusion`, `rerank` — L3 có ba khối cùng xếp hạng, nên "đường đời hạng" đi qua nhiều khối là việc sau. `GoldReveal.ranks` đã sẵn khoá theo node nên không cần đổi dữ liệu.
- Chín món đồ chơi còn lại.
