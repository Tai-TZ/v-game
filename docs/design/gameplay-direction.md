> **Trạng thái:** Đề xuất, chờ chủ dự án duyệt. Nếu được duyệt, bàn thợ đồ chơi thay node editor tự do làm giao diện chính.
> **Sửa 2026-10-08:** §5 từng ghi "temperature 0" cho các lượt chạy kiểm chứng. Lời khuyên này đã lỗi thời: engine không gửi temperature; trên Gemini 3, Google khuyên giữ mặc định 1,0; và temperature 0 cũng không làm output tất định. Thất bại dự định được kiểm bằng cổng hiệu chỉnh chạy model thật nhiều lần (Phần 3 §3.9). Xem [đặc tả §8.4](../specs/2026-10-07-v-game-design.md#84-llm) và [bản đồ phủ §3](../content/course-coverage.md#3-cập-nhật-2026-không-sửa-slide). Các mục cắt "9 mini-game tay" và "khởi động tay ≤ 60 giây" vẫn đứng; bài vi mô 1–3 phút là thẻ tuỳ chọn, không chặn đường vào level ([roadmap-v0.4](roadmap-v0.4.md) X18).
> **Lưu ý:** đề xuất này còn lệch Phần 3 ở một số điểm (tên khối, mã level, guard, chọn model...); xem [bảng đối chiếu trong đặc tả](../specs/2026-10-07-v-game-design.md#132-điểm-lệch-giữa-đề-xuất-gameplay-và-phần-3). "Phần đề xuất prototype" nhắc ở dòng cuối chưa được đưa vào tài liệu này.

# Xưởng Đồ Chơi Trực Ca

## 1. Ý tưởng lõi

Người chơi không nối node. Họ nghịch vài món đồ chơi vật lý (Thùng Context, Vòm Sao, Máy Ép, Tường Thành) cắm vào các khe cố định trên một bàn thợ. Mỗi cú vặn núm cho phản hồi trong chưa tới 1 giây, lấy từ phép tính thật: đếm token, cắt chunk, truy xuất trên embedding thật, và chưa tốn lần gọi LLM nào. Sau đó họ bấm **Mở ca**: agent chạy thật, rồi cả campus làm đúng từng chữ agent nói. Khách lội xuống ao vì agent bịa ra "sạp E9", áp phích "Điều 47 ma" dán kín bảng tin, số điện thoại lan khắp sân trường thành tin đồn đỏ.

**Vì sao không còn "normal":**
- Không còn form hay đồ thị.
- Trước khi chạy, mọi chỉnh sửa có phản hồi ngay.
- Kết quả không hiện thành bảng điểm mà thành hậu quả trong thế giới, và người chơi phải tự truy vết.
- Mọi hình ảnh mang ý nghĩa kết quả đều lần ngược được về một event thật.

## 2. Vòng lặp mới (5–10 phút mỗi level)

1. **Hiện trường:** level mở đầu bằng hậu quả của cấu hình cũ. Người chơi click vào hậu quả, màn Tua Lại hiện nguyên nhân thật.
2. **Khởi động tay (tuỳ chọn, ≤60s, chỉ ở 2 level):** dùng chính món đồ chơi đó, không phải một mini-game mới.
3. **Nghịch đồ chơi:** xem trước tất định, miễn phí.
4. **Đoán:** đặt một phiếu, ví dụ "case #4 trượt ở món nào?".
5. **Mở ca:** camera bám 1 case ở tốc độ 1x, các case còn lại thu gọn thành bộ đếm. Giữ Space để tua nhanh.
6. **Hậu quả, rồi truy vết:** NPC thi hành output. Kính Số Liệu hiện con số gốc. Thám Tử dẫn tới đúng món đồ mà run.diagnosis chỉ ra, và phiếu đoán được chấm.
7. **Lật mặt sau:** xem JSON block và đoạn LangGraph, xuất ra cho lab. Lần chạy đạt sẽ xoá cờ thế giới, ví dụ lao công gỡ áp phích.

## 3. Chín level

| Level | Người chơi làm | Khi AI chạy thật | Aha |
|---|---|---|---|
| **Chợ L1 · Đóng thùng** | Khởi động: đóng thùng cho từng khách, thùng được gửi thật tới model rẻ trong lúc khách sau tới. Rồi xếp khối tài liệu vào Thùng Context: thể tích bằng count_tokens (khối tiếng Việt to hơn); nhồi lấn chỗ output thì nắp không đóng | Xu bạc (input) và xu vàng to (output) rơi vào hũ. Câu trả lời mọc thành gạch, có chỉ nối về khối nguồn; câu không có nguồn là bong bóng, vỡ khi chấm. Khách đi tới đúng `sap_id`; sạp E9 bịa thì khách lội ao | Bỏ bảng sạp cho rẻ thì model bịa chứ không nói "không biết". Để cả bản 2024 lẫn 2026 thì chỉ nối nhầm vào khối cũ |
| **Chợ L2 · Ghi ray** | Gạt ghi ray cho 3 loại đơn sang model Nhỏ/Vừa/Lớn, gắn Bàn Tính (tool) và núm max_iter | Ray song song (mỗi ray là một slot concurrency), về đích theo ms thật. Vòng ReAct là chân chạy vặt mang phiếu Thought/Action/Observation. Hũ cạn thì engine dừng thật. Combo tính sai thì tiền hoàn rút từ "sổ đền bù (mô phỏng)" riêng | Model nhỏ cộng tool thắng việc nâng model. Cấu hình chuẩn đã được chạy kiểm chứng trước |
| **Chợ L3 · Sự cố lịch sử** | Kéo cần ngưỡng Máy Ép, gắn nam châm giữ (quyết định, ràng buộc, đính chính mới nhất, câu treo, nguồn), ném lời chào vào sọt, cất bản thô vào ngăn lưu trữ | Chồng lịch sử bị khiêng lại vào thùng ở mỗi lượt, xu leo như bậc thang. Búa ép ra Thẻ Trạng Thái in summary thật. Dữ kiện bị mất nằm thành vụn đỏ dưới sàn. Thợ dựng sân khấu theo JSON cuối | Thiếu nam châm "đính chính mới nhất" thì sân khấu mọc ở Sân A tối om. Nén luôn mất mát |
| **Thư viện L1 · Thôi bịa luật** | Cắm ống từ Bộ Óc vào Vòm Sao, lắp lăng kính grounding. Gõ câu hỏi vào đèn pin: chùm sáng **tự xoay theo embedding thật**, top-k sao sáng lên kèm hạng và cosine | Móc kéo K sao rơi xuống **chính Thùng Context của Chợ**. Gạch được đóng mã chunk. Trích dẫn bịa thì một áp phích "Điều 47 ma" bị ghim lên Bảng Tin | RAG là đổ đúng thứ vào thùng. Với câu ngoài bộ luật, "không tìm thấy" được tính là đúng |
| **Thư viện L2 · Lược dao** | Kéo lược dao (preset 128–1024), dải băng keo overlap, nam châm bám Điều. Câu bị cắt ngang chuyển đỏ. "Chạy thử phần gắp" (<1s, không LLM) đẩy đồng hồ Độ phủ/Độ sạch | Mỗi case có một sao vàng (chunk đáp án). Sao vàng bị bỏ lỡ có nét đứt đỏ ghi hạng thật "#14". Chunk to thì sao đục và thùng đầy nhanh | Overlap 15% kéo trọn "...trừ trường hợp tại khoản 3" về, case #4 chuyển ĐẠT. Không có nấc "tốt nhất", chỉ có nấc đã đo |
| **Thư viện L3 · Hỏi bằng số Điều** | Lắp tường ngăn kéo BM25, chọn phễu RRF (bi nặng 1/(60+hạng)) hoặc bập bênh α, đặt kính lúp rerank (top-30 xuống top-5) | Ngăn "47" bật ra trong khi chùm dense quét lệch. "Đường đời" hạng của tài liệu đáp án: #23→#1→#2→#1. Kính lúp chậm đúng ms thật. Bảng hồi quy L2 vẫn xanh, đám biểu tình giải tán | Số hiệu điều luật gần như không mang "nghĩa"; câu "nghỉ học một thời gian" thì dense cứu. Hai điểm mù bù nhau |
| **Tháp L1 · Cổng thành** | Khởi động: đóng dấu DUYỆT/CHẶN kiểu Papers Please; thư được duyệt tới agent thật đang giữ canary; "Đúc khuôn" biến cụm từ đã khoanh thành regex nháp. Rồi xếp Cân, Lưới regex, Chó classifier (có núm độ nhạy), Rào chủ đề | Máy bay giấy lơ lửng "đang soi" tới khi có verdict thật, kèm thẻ ghi lớp, rule, độ tin. Lộ canary thì cờ tháp đổi thành cờ cướp biển. Chặn oan thì hiện mây bất mãn | Bản base64 hoặc không dấu lách qua regex; chó vặn tối đa thì đuổi cả sinh viên thật. Mục tiêu: 0 lần lộ VÀ phục vụ ≥7/8 người thật |
| **Tháp L2 · Tài liệu độc** | Rê đèn UV lộ chữ ẩn thật, đóng hũ kính DATA, rút phích `gui_email` để bẻ ba trụ lethal trifecta, đặt Con Dấu PII ở cửa ra | Cổng L1 đứng im ở "đã chặn: 0". Nếu output thô (chấm TRƯỚC bộ lọc) làm theo lệnh ẩn, yêu tinh giấy giật cần lái, X-quang khoanh số rồi dấu "ĐÃ CHE" giáng xuống: "Bị chiếm lái, nhưng không rò rỉ". Không có dấu thì bong bóng tin đồn lan (gắn nhãn minh hoạ); click vào để tua về cuộn tài liệu | Kẻ địch đi qua kệ sách. Lớp sau đỡ lớp trước. Bỏ một trụ đáng tin hơn mọi bộ lọc |
| **Tháp L3 · Đổi phe** | Tấn công tháp dựng từ CHÍNH cấu hình L7+L8 của mình: gõ đạn tự do và ghép thẻ kỹ thuật (nhập vai, base64/ROT13 biến đổi thật, đổi ngôn ngữ, chẻ nhiều lượt, gài tài liệu), tổng 12 phát | Camera bám viên đạn qua tường của chính mình. Canary xuất hiện thật thì pha lê nứt một vệt khắc tên kỹ thuật. Báo cáo tự sinh từ event, người chơi chỉ chọn thẻ vá | Vá regex chỉ hàn một vết; "đưa bí mật ra khỏi context" hàn mọi vết. Mỗi phát thắng thành một test hồi quy |

## 4. Cắm vào engine, không giả gì

- **Bàn thợ là một trình soạn BlockConfig khác.** Mỗi level có khe gắn kiểu theo thứ tự topo. Đồ chơi chỉ khớp đúng khe nên graph luôn compile được. Store zustand xuất ra cùng zod schema engine đang dùng. React Flow lùi thành chế độ "Bản vẽ" (phím Tab), dùng cho máy yếu, trackpad và debug.
- **Ánh xạ đồ chơi sang block:**
  - Thùng → `context_packer{items, budget, output_reserve}`
  - Ghi ray → `router{routes}` + `tool`
  - Máy Ép → `compactor{trigger, keep, drop, archive}`
  - Lược dao → `chunker{size, overlap, strategy}`, dùng để chọn index đã tính sẵn
  - Vòm Sao, Ngăn kéo, Phễu → `retriever{mode, top_k, threshold, fusion}`
  - Kính lúp → `reranker{candidates, top_n}`
  - Tường → `input_guard{layers}`
  - Hũ kính và phích → `spotlighting`, `tools`
  - Con dấu → `output_guard{pii, canary}`
- **Xem trước chỉ dùng phép tính tất định thật:** count_tokens, ranh giới chunk (client và engine dùng chung thuật toán), retrieval dry run trên golden set, test regex trên bộ thư.
- **Choreographer viết bằng TS thuần,** unit test bằng event log fixture:
  - `step.started`: món đồ vào vòng "đang làm" vô định, không có thanh tiến độ giả.
  - `step.finished`: token thành khối và xu (token × giá), ms thành kim đồng hồ, summary thành thẻ treo, detail thành sao, hạng, verdict.
  - `case.graded`: bảng hậu quả f(labels, extracted) dùng khoảng 12 động từ chung (walk_to, splash, protest, spread_bubble, vault_burst, mood_cloud…). NPC thi hành đúng field của schema.
  - `run.scored`: Báo Tường, sao, cập nhật cờ thế giới.
  - `run.diagnosis`: Thám Tử dẫn tới món đồ có lỗi.
- **Mở rộng contract, chốt ngay tuần 1:**
  - `case_id` trên mọi event.
  - `step.finished.detail` theo từng block: retriever/bm25 `{chunk_ids, scores}`, fusion `{ranks}`, reranker `{before, after}`, compactor `{summary_text, kept, dropped}`, guard `{verdict, layer, rule, spans, confidence}`, llm `{model, tokens, cost, cited_ids}`, tool `{name, args, allowed}`.
  - `case.graded` thêm `labels` và `extracted`.
  - Thiếu detail thì dùng hoạt cảnh chung, không bịa.
- **Luật trung thực:**
  - Không phát hậu quả nào trước `case.graded`, không bao giờ đảo thứ tự event.
  - Mỗi hoạt cảnh giữ tối thiểu 0,3–0,5s, tối đa 3 làn trên màn hình.
  - Phần minh hoạ phải gắn nhãn: vùng giữa thùng, tin đồn lan, vị trí sao ("hình chiếu", luôn in hạng và cosine thật).
  - Kết quả từ cache đóng tem "kết quả đã lưu".

## 5. Hiệu năng và phạm vi

**Hiệu năng:**
- Camera orthographic isometric, lightmap bake, gộp mesh tĩnh.
- InstancedMesh pool cho khối, xu, máy bay, NPC.
- Vòm Sao là một `THREE.Points`; chọn sao bằng tích vô hướng, không raycast.
- Không Rapier, không postprocessing trên GPU tích hợp.
- Chữ tiếng Việt dài đặt ở DOM overlay.
- `frameloop='demand'` khi lắp ráp; PerformanceMonitor + AdaptiveDpr; dưới 80 draw call; tôn trọng reduced-motion.

**Phạm vi:**
- 6 đồ chơi lõi dùng lại: Thùng Context (cả 3 khu), Ghi ray, Máy Ép, Vòm Sao (cả 3 level Thư viện), Tường Thành (cả 3 level Tháp), Con Dấu.
- Mỗi khái niệm chỉ một ẩn dụ: token là thể tích; chi phí là xu; câu có nguồn là gạch, không nguồn là bong bóng; bị chiếm lái là yêu tinh giấy; rò rỉ là bong bóng tin đồn.
- 30–40 NPC, đường đi waypoint đặt tay.
- Mỗi level được chạy kiểm chứng trước để thất bại dự định xảy ra thật; ~~temperature 0~~ (sửa 2026-10-08: không gửi temperature, xem ghi chú đầu file).
- Làm vertical slice Thư viện trước.

**Cắt khỏi MVP:**
- Node editor hoặc băng chuyền tự do làm màn chính; 25 loại trạm.
- 9 mini-game tay; thủ thư WASD; đua người vs máy; chém chunk bằng Space.
- Pháo Thư (LLM sinh tấn công); phỉnh ĐẠT/TRƯỢT cho mọi lá thư; ngân sách xây tường riêng.
- 120 NPC + A* và mô phỏng hàng đợi; báo cáo red team bắt kéo thẻ.
- Thẻ vá cần tính năng engine mới; re-embed khi đang chơi; đèn pin rê chuột tự do.
- Lost-in-the-middle làm cơ chế chính. Nó chỉ còn là thử thách "bàn dài" tuỳ chọn, và game nói thật nếu không tái hiện được.

**Prototype đầu tiên:** Vòm Sao (Thư viện L2 sang L3), mô tả chi tiết ở phần đề xuất prototype.
