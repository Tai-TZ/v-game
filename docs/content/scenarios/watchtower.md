> **Trạng thái:** đặc tả v0.1 (2026-11-02), **chờ chủ dự án duyệt**. Nâng [dàn ý W1–W3](other-levels-outline.md#tháp-canh--npc-anh-quân-chị-vy) lên mức của khu Thư viện; chưa có dòng code nào. Mọi chỗ ghi **Đề xuất** là quyết định mới, chưa chốt (tổng hợp ở mục 9).
> **Ràng buộc:** [Phần 3](../../design/part-3-block-system.md) §3.2–3.3 và các sửa lỗi phản biện ở cuối file đó · [engine-v0.2](../../design/engine-v0.2.md) E1–E14 (model Gemini, một lời gọi mỗi khối `llm`) · [ca trực §3.1](daily-shift.md) (quỹ học viên P = 13 lời gọi/ngày) · [roadmap-v0.4](../../design/roadmap-v0.4.md) X10 (ô nhập tự do), X19 (tem "Mô phỏng") · [level-identity-v0.5](../../design/level-identity-v0.5.md) (cỗ máy, hiện trường, cờ thế giới) · [art bible](../../design/art-direction.md) §1.

# Khu Tháp canh: mạch ba level

Tháp canh là cổng gác của khuôn viên. Quầy hỗ trợ khách bên chân tháp có một trợ lý được phép **làm việc thật**: tra đơn, hoàn tiền, gửi email. Anh Quân, bảo vệ ca đêm, nhờ người chơi dựng hàng rào cho nó. Chị Vy, trưởng nhóm tấn công thử, đến ở level cuối.

- **W1:** nó hoàn tiền cho bất kỳ ai nói khéo.
- **W2:** tài liệu nó đọc cũng biết ra lệnh, và nó làm lộ số điện thoại của khách.
- **W3:** người chơi đổi vai, tấn công một trợ lý đã có rào để chỉ ra lớp nào thủng.

Bài học xuyên suốt (Ngày 11 của khoá, [bản đồ phủ](../course-coverage.md) dòng 11): **một lớp lọc không đủ; chặn hết thì mất khách thật; bỏ một trụ của "bộ ba chết người" đáng tin hơn mọi bộ lọc.**

## 1. Ràng buộc chi phối thiết kế

Ba điều dưới đây làm đặc tả khác dàn ý gốc. Chúng không phải sở thích; mỗi điều có nguồn.

1. **Quỹ lời gọi.** Mỗi học viên có P = 13 lời gọi AI mỗi ngày ([ca trực §3.1](daily-shift.md)). Một run Thư viện đã tốn 10–13. Dàn ý gốc dùng `agent_react` (vòng ReAct, 2–5 lời gọi mỗi ca) và `injection_classifier` gọi model mỗi ca: một run W1 khoảng 30–50 lời gọi, gấp 3–4 lần quỹ cả ngày. **Đề xuất:** giữ đúng một lời gọi mỗi ca, như Thư viện.
2. **Engine v0.2 chưa có** guard, `halt`, tool, ledger, cổng duyệt hay agent ([engine-v0.2](../../design/engine-v0.2.md) §1, E13). Phản biện của Phần 3 (mục "high") đã chỉ ra guard đặt trước một điểm fan-in làm `output` chạy hai lần; phải sửa trình biên dịch trước khi có W2.
3. **Ô nhập tự do gửi tới AI** phải có cảnh báo, và gói miễn phí dùng nội dung gửi lên để cải thiện sản phẩm (X10). W3 trong Phần 3 cho người chơi gõ đòn tấn công ≤ 800 ký tự. **Đề xuất:** W3 không có ô gõ tự do; đòn ghép từ thẻ (mục 5).

### 1.1 Một lời gọi mỗi ca: thay agent bằng "phiếu hành động"

- **Đề xuất:** khối `llm` của khu này trả **structured output** một lần: `{tra_loi, hanh_dong: null | {tool, tham_so}}`. Engine chạy tool một cách tất định, ghi ledger, rồi trả lời khách. Không có vòng ReAct.
- Vẫn dạy đúng điều cần dạy: model **đề nghị** một hành động, còn **code** quyết định có làm không (Phần 3 §3.2, `human_approval` "việc duyệt nằm trong code, không nằm trong prompt").
- `agent_react` và bài "không phải đơn nào cũng cần agent" để cho Chợ model M2, nơi chi phí agent chính là bài học.
- **Phải spike trước:** structured output trên `gemini-3.8-flash` (model chính, E1) với schema có trường tuỳ chọn lồng nhau. X24 ghi một spike cùng loại (trên Flash-Lite) cho Văn phòng một cửa; làm chung một lần.

### 1.2 Chó gác tính sẵn

- `injection_classifier` không gọi model lúc chạy. Câu của mọi ca là cố định (như Thư viện, E14), nên **Đề xuất:** CLI dựng index chấm sẵn mọi câu một lần, lưu bảng `{case_id → (nhan, do_tin_cay)}` đi kèm code, giống bảng rerank (E5). Núm `threshold` lúc chơi chỉ so với số đã lưu: kéo là thấy ngay câu nào bị chặn, 0 lời gọi.
- Tem trên đồ chơi: "Điểm tin cậy chấm sẵn bằng model" (X19, tem trung thực).
- Bài học vẫn nguyên: ngưỡng cao thì lọt đòn, ngưỡng thấp thì chặn nhầm khách thật.

## 2. Ba level trong một bảng

| | W1 · Cổng thành | W2 · Tài liệu độc | W3 · Đổi phe (sự cố) |
|---|---|---|---|
| Hiện trường | Cuộn biên lai dài chạy ra khỏi máy in quầy: một khoản hoàn 5.000.000 đ cho yêu cầu "trông hợp lệ" | Hộp thư đi có một email gửi hồ sơ khách ra địa chỉ lạ, tiêu đề "Theo yêu cầu của chính sách" | Chị Vy đưa thẻ "Được phép tấn công thử" kẹp trên một tấm sơ đồ tháp |
| Đồ chơi mới → khối | Lưới cụm từ → `pattern_guard`; Chó gác → `injection_classifier` (tính sẵn); Chuông duyệt → `human_approval` bọc `tool_refund` | Đèn UV → `doc_guard.strip_hidden`; Hũ kính → `doc_guard.mode`; Phích cắm → tháo `tool_email`; Con dấu PII → `pii_filter` | Bệ phóng → `attack_prompt` (ghép thẻ); Cuộn tài liệu cài → `attack_poison_doc`; đích `target_agent` khoá |
| Ca (đề xuất) | 8 khách thật + 3 đòn + 1 bẫy chặn nhầm = 12 | 7 khách thật + 3 đòn gián tiếp + 2 bẫy PII = 12 | ≤ 3 đòn × ≤ 2 lượt |
| Lời gọi / run | 12 (một mỗi ca); lượt mẫu + run sao = 3 + 12, vượt P như L2, L3 (đánh đổi đã ghi ở ca trực §3.1) | 12, như W1 | ≤ 6 |
| Hiểu lầm nhắm tới | "Một danh sách từ cấm là đủ"; "chặn càng nhiều càng an toàn" | "Tài liệu nội bộ thì tin được"; "lọc số điện thoại bằng một mẫu là xong" | "Hệ đã có rào thì không cần thử"; "vá cụm từ là vá xong" |
| Cơ chế bẫy tất định | Ledger: hoàn tiền vượt ngưỡng mà không qua cổng; base64 và nhập vai không khớp cụm từ nào; câu lành tính có "bỏ qua" khớp lưới | `doc_id` độc trong `pack.included`; ledger `tool_email`; SĐT "09 12 34 56 78" lọt khi `normalize` tắt | Đòn base64 và đổi ngôn ngữ đi qua lưới cụm từ cố định của đích |
| Aha | Chặn hết thì mất khách; một lớp không đủ | Tài liệu cũng tấn công được; bỏ một trụ của bộ ba chết người | Vá cụm từ hàn một vết; đưa bí mật ra khỏi context hàn mọi vết |
| Cờ thế giới | Biên lai đóng dấu "ĐÃ CHẶN" | Email trong hộp thư đi đổi thành "ĐÃ THU HỒI" | Báo cáo tấn công thử ghim lên bảng của tháp |
| Mở khoá | Sau Thư viện L1 (đã quen bàn thợ, Bộ Óc và Lăng kính) | Sau W1 và Thư viện L1 (cần truy xuất) | Sau W2 |

## 3. W1 · `direct-injection` · Cổng thành

### 3.1 Hiện trường và mục tiêu học

- **Hiện trường** (hiện vật trên đầu trang, [level-identity](../../design/level-identity-v0.5.md) §2.1): cuộn biên lai. Dòng cuối in đậm: "HOÀN TIỀN 5.000.000 đ · lý do: khách xác nhận đã được quản lý đồng ý". Anh Quân: "Chặn hết thì dễ. Chặn đúng mới khó."
- **Học viên làm được sau level:** đặt guard đầu vào và giải thích vì sao nó bắt được 60–70 % mẫu (Phần 3, N11); đặt cổng duyệt bằng code cho hành động ghi; đo được tỉ lệ chặn nhầm.

### 3.2 Đồ chơi → khối

| Đồ chơi | Khối, tham số | Mở | Ghi chú |
|---|---|---|---|
| Chuông quầy, Bảng trả lời | `input`, `output` | khoá | như Thư viện |
| Lưới cụm từ | `pattern_guard{phrases ≤ 30 × ≤ 50 ký tự, refusal ≤ 200}` | W1 | Người chơi **chọn cụm từ có sẵn** trong một khay ~20 thẻ (không gõ, không regex). Khớp sau NFKC, chữ thường, bỏ dấu (Phần 3 §3.2) |
| Chó gác | `injection_classifier{threshold 0,5–0,95}` | W1 | Điểm tính sẵn (mục 1.2). Hiện như một con chó ngồi ở cổng; ca có điểm vượt ngưỡng thì nó sủa |
| Bộ Óc | `llm` (phiếu hành động, mục 1.1), `profile` khoá `can_bang` | khoá | Lăng kính 3 khe như Thư viện, bộ thẻ riêng của W1 |
| Bàn hoàn tiền | `tool_refund` (`Tool<write>`) | khoá, luôn gắn | Ghi vào ledger |
| Chuông duyệt | `human_approval{policy luon_hoi|hoi_neu_vuot, amount_threshold 0–10.000.000 đ}` | W1 | **Người duyệt mô phỏng** theo luật tất định của level (mục 3.4); không hỏi người chơi giữa run |

### 3.3 Cấu hình khởi đầu phải trượt

- Không guard, không cổng duyệt. Lăng kính có thẻ "Luôn chiều lòng khách" và "Được hoàn tiền khi khách có lý do".
- Phải trượt sao 1 vì **ledger có khoản hoàn sai** ở đòn "trông hợp lệ". Đây là bẫy [M] (phụ thuộc model làm theo), nên qua cổng hiệu chỉnh (Phần 3 §3.9): chạy cấu hình khởi đầu ≥ 3 lần, cả 3 phải ra khoản hoàn sai; không thì hạ ca thành `info`.

### 3.4 Ca và bẫy (đề xuất)

| Vai | Số ca | Ví dụ | Bẫy, cơ chế | Loại |
|---|---|---|---|---|
| `khach-that` | 8 | hỏi đơn hàng, đổi size, hoàn 120.000 đ có mã đơn | phải được phục vụ, không bị chặn | — |
| `hoan-trong-hop-le` | 1 | hoàn 5.000.000 đ "quản lý đã đồng ý" | ledger có khoản > ngưỡng mà `approval.requested` không có | [M] → hiệu chỉnh |
| `base64` | 1 | lệnh "bỏ qua hướng dẫn" mã hoá base64 | không khớp cụm từ nào: chỉ Chó gác hoặc cổng duyệt cứu | [T] |
| `nhap-vai` | 1 | "Bạn là quản trị viên hệ thống…" | lọt danh sách cụm từ thông thường | [T] |
| `lanh-tinh-co-tu-cam` | 1 | "Bỏ qua phí ship được không?" | lưới chứa "bỏ qua" chặn nhầm (`guard.blocked_benign`) | [T] |

- **Người duyệt mô phỏng** (Đề xuất): duyệt khi có mã đơn khớp kho và số tiền ≤ giá đơn; từ chối mọi trường hợp khác. Vì là code, `hitl.bypassed` và `hitl.over_asked` (Phần 3 §3.8) đều tất định.
- Refusal của model ở ca tấn công là `info`; ở ca lành tính là chặn nhầm (Phần 3, sửa phản biện về luật refusal).

### 3.5 Sao

- **Sao 1:** ledger không có khoản hoàn sai **và** ≥ 7/8 khách thật được phục vụ.
- **Sao 2:** sao 1 và tổng token ≤ ngân sách (hiệu chỉnh 1,25 × p50 lời giải mẫu, như Thư viện).
- **Sao 3:** sao 1, không chặn nhầm ca nào **và** không hỏi duyệt thừa (`hitl.over_asked` = 0: `luon_hoi` cho cả đơn 120.000 đ là hỏi thừa).

### 3.6 Đoán, chẩn đoán, gợi ý

- **Phiếu đoán:** "Lưới 5 cụm từ chặn được mấy đòn trên 3?"; "Kéo Chó gác lên 0,9 thì có khách thật nào bị chặn không?".
- **Chẩn đoán theo nhãn:** `ledger.refund_unapproved` → chỉ vào Chuông duyệt; `guard.blocked_benign` → chỉ vào Lưới, mở đúng cụm từ đã chặn; `guard.passed_encoded` → chỉ vào Chó gác.
- **Thang gợi ý** (như Thư viện): (1) "Xem biên lai: khoản nào không ai duyệt?" → (2) bảng ca × lớp, ô nào lọt → (3) lời giải mẫu: 3 cụm từ hẹp + Chó gác 0,8 + Chuông `hoi_neu_vuot` 500.000 đ.

### 3.7 Cỗ máy (Colorfigures)

- Món mới trên băng chuyền: **Lưới** (khung có các thẻ cụm từ, số thẻ = số `phrases`), **Chó gác** (ngồi cạnh cổng; Nhìn xuyên hiện thang điểm và vạch ngưỡng), **Chuông duyệt** (chuông có nắp; đặt trên **nhánh tool**, không trên băng chuyền chính).
- Băng chuyền **rẽ nhánh** lần đầu: Bộ Óc → bàn hoàn tiền. Không có Chuông duyệt thì nhánh tool là đường đỏ thẳng tới ledger, giống ống đứt ở L1.
- Bước (beat): "Khách gõ cửa" → "Lưới soi" → "Chó gác ngửi" → "Bộ Óc viết phiếu" → "Chuông duyệt" → "Sổ ghi" → "Chấm".
- **Cờ thế giới:** biên lai đóng dấu xanh "ĐÃ CHẶN".

## 4. W2 · `poisoned-documents` · Tài liệu độc

### 4.1 Hiện trường và mục tiêu học

- **Hiện trường:** hộp thư đi. Một dòng: "Gửi: hoso-khachhang@… · Tiêu đề: Theo yêu cầu của chính sách · Đính kèm: 3 hồ sơ". Cô Lan xuất hiện thoáng qua: kho chính sách dùng chung khung với Thư viện.
- **Học viên làm được sau level:** nhận ra injection gián tiếp qua tài liệu truy xuất; dùng spotlighting (thẻ XML, datamark); lọc PII ở đầu ra và biết vì sao phải chuẩn hoá; giải thích "bộ ba chết người" (dữ liệu riêng tư + nội dung không tin cậy + kênh ra ngoài) và bỏ một trụ.

### 4.2 Đồ chơi → khối

| Đồ chơi | Khối, tham số | Mở | Ghi chú |
|---|---|---|---|
| Kệ chính sách, Lược dao, Vòm Sao, Thùng | `corpus`, `chunker`, `vector_search`, `context_packer` | khoá phần lớn | Kho `chinh-sach-cskh` riêng của W2, dựng index như Thư viện |
| Đèn UV | `doc_guard.strip_hidden` | W2 | Nhìn xuyên: chữ trắng trên nền trắng của tài liệu độc hiện ra dưới đèn |
| Hũ kính | `doc_guard.mode` the_xml / datamark, `strip_imperative` | W2 | Tài liệu nằm trong hũ: model thấy nhưng được dặn đó là dữ liệu |
| Tủ hồ sơ khách | `tool_customer` (`Tool<read>`, có PII giả) | khoá | |
| Phích cắm thư | `tool_email` (`Tool<write>`) | W2, **được phép tháo** | Tháo là bỏ một trụ: 0 email ra ngoài, tất định |
| Con dấu PII | `pii_filter{types, action che|chan, normalize}` | W2 | `normalize` gộp khoảng trắng, dấu chấm, gạch nối trước khi khớp |

### 4.3 Ca và bẫy (đề xuất)

| Vai | Số ca | Bẫy, cơ chế | Loại |
|---|---|---|---|
| `khach-that` | 7 | phải trả lời đúng chính sách, có nguồn | — |
| `tai-lieu-doc` | 3 | đoạn của tài liệu độc vào `pack.included` (`poison.reached_llm`, theo `doc_id`) | [T] |
| `gui-ra-ngoai` | (trong 3 ca trên) | ledger có `tool_email` tới địa chỉ ngoài (`exfil.email`) | [M] → hiệu chỉnh; tháo phích thì [T] = 0 |
| `pii-co-khoang-trang` | 2 | câu trả lời có "09 12 34 56 78"; lọt khi `normalize` tắt (`pii.leaked`) | [T] |

- **Điều kiện tiên quyết:** sửa trình biên dịch theo phản biện "high" (guard ∥ fan-in, `halt` có reducer, `output` chạy đúng một lần). Có test: đồ thị đúng hình W2 chạy `out` một lần cho mỗi ca, kể cả khi một guard dừng.

### 4.4 Sao

- **Sao 1:** 0 email ra ngoài, 0 PII lọt **và** ≥ 6/7 khách thật được trả lời đúng.
- **Sao 2:** ngân sách token.
- **Sao 3:** sao 1 và không đoạn độc nào tới Bộ Óc (`poison.reached_llm` = 0), tức chặn từ tầng tài liệu chứ không chỉ chặn ở đầu ra.

### 4.5 Cỗ máy

- Món mới: **Đèn UV** treo trên Vòm Sao, **Hũ kính** quanh Thùng, **Con dấu PII** trên Bảng trả lời, **Phích cắm** trên nhánh thư.
- Nhìn xuyên lộ dòng chữ ẩn trong tài liệu độc (màu cảnh báo) và đường nó đi vào Thùng.
- **Cờ thế giới:** email trong hộp thư đi đổi thành "ĐÃ THU HỒI".

## 5. W3 · `turncoat-agent` · Đổi phe (sự cố)

### 5.1 Hiện trường và mục tiêu học

- **Hiện trường:** thẻ "Được phép tấn công thử · Tháp canh · ca đêm" kẹp trên sơ đồ đích. Chị Vy: "Ghi lại mọi phát, kể cả phát trượt."
- **Học viên làm được sau level:** lập kế hoạch tấn công thử có phạm vi; chỉ ra **lớp nào** thủng chứ không chỉ "phá được"; hiểu vì sao vá cụm từ không đủ.

### 5.2 Đòn ghép từ thẻ (Đề xuất, thay ô gõ tự do)

- **Bệ phóng** có ba khe: **Kỹ thuật** (ghi đè, nhập vai, base64, đổi ngôn ngữ, trích xuất), **Mục tiêu** (lộ mã, lộ PII, gọi tool cấm), **Lời mồi** (một trong ~6 câu viết sẵn cho mỗi mục tiêu).
- Engine ghép đòn tất định từ ba thẻ (base64 do engine mã hoá, như Phần 3). Không có ô gõ tự do, nên không cần cảnh báo X10, và **lớp guard của đích chấm được hoàn toàn tất định**.
- **Cuộn tài liệu cài** (`attack_poison_doc`): chọn tài liệu chủ và vị trí; chữ ẩn cũng chọn từ thẻ.
- ≤ 3 đòn mỗi run, mỗi đòn ≤ 2 lượt (Phần 3, sửa phản biện); tối đa 6 lời gọi.

### 5.3 Đích (khoá)

- `pattern_guard` với **danh sách cụm từ cố định** (không phải regex, sửa phản biện "low"); chưa có Hũ kính; `pii_filter` không chuẩn hoá; Chuông duyệt đặt ngưỡng cao.
- Canary xoay theo run; chỉ tính "lộ mã" khi canary **không** có trong bất kỳ lượt nào của kẻ tấn công, kể cả sau khi giải base64 và bỏ khoảng trắng (sửa phản biện "medium").
- Trace của đích chỉ phát bản tóm tắt đã che (khối, trạng thái, ms, token); không phát packet. Có test: mọi sự kiện của run W3 không chứa canary.

### 5.4 Sao

- **Sao 1:** xuyên lớp guard ở ≥ 2 mục tiêu khác nhau. Tất định: chấm ở lớp guard, không cần model làm theo.
- **Sao 2:** báo cáo chỉ đúng lớp thủng cho mỗi đòn xuyên (người chơi chọn lớp trên bảng báo cáo; so với `weakness_map` của level).
- **Sao 3:** đề xuất bản vá đúng: chọn "đưa bí mật ra khỏi context" hoặc "chuẩn hoá trước khi lọc" thay vì "thêm cụm từ".
- Model của đích có làm theo hay không chỉ là **điểm thưởng**, hiện trên báo cáo, không tính sao (Phần 3: W3 phụ thuộc model).

### 5.5 Cỗ máy

- Cỗ máy của đích hiện mờ, khoá. Bệ phóng đứng **ngoài** đế, bắn vào cổng. Mỗi đòn là một tờ phiếu chạy trên băng chuyền của đích, dừng ở lớp chặn nó (hoặc chạy tới cuối nếu xuyên).
- **Cờ thế giới:** báo cáo tấn công thử ghim lên bảng của tháp; trên campus, đèn đỉnh tháp đổi màu (cần duyệt art, §1.2.3 "một điểm nhấn").

## 6. Việc phải làm, theo gói

### 6.1 Engine (v0.3)

1. Sửa trình biên dịch: guard trước fan-in, `halt` có reducer, `output` một lần (điều kiện của W2).
2. Phiếu hành động: structured output một lần mỗi ca; tool chạy tất định; ledger trong `CaseState`; sự kiện `ledger.*`. Spike Gemini trước (mục 1.1).
3. Khối mới: `pattern_guard`, `injection_classifier` (đọc bảng tính sẵn), `human_approval` (+ `ApprovalPolicy` mô phỏng), `doc_guard`, `pii_filter`, `tool_refund`, `tool_customer`, `tool_email`, `attack_prompt`, `attack_poison_doc`, `target_agent`.
4. Chấm: nhãn `hitl.bypassed`, `hitl.over_asked`, `guard.blocked_benign`, `guard.passed_encoded`, `poison.reached_llm`, `pii.leaked`, `exfil.email`, `canary.leaked`; canary HMAC xoay theo run; che trace của đích.
5. CLI: chấm sẵn bảng Chó gác; dựng index kho chính sách.

### 6.2 Nội dung

- Kho `chinh-sach-cskh` (hư cấu, ~15 điều) + 1 tài liệu độc có chữ ẩn; bảng đơn hàng và hồ sơ khách **giả hoàn toàn** (PII tổng hợp, X10).
- Ba file golden `wt-w1`, `wt-w2`, `wt-w3` theo quy ước mã `wt-w{1|2|3}-{v|h|t|r}NN`, kèm vai ở mục 3.4, 4.3.
- Thẻ Lăng kính, khay cụm từ, thẻ đòn, thoại anh Quân và chị Vy theo [npc-cast](npc-cast.md).
- Lượt đã ghi cho mỗi level (cần khoá Gemini, chạy một lần ở cổng phát hành).

### 6.3 Frontend

- Đồ chơi mới trong khe (khay cụm từ, thang ngưỡng, chính sách duyệt, bệ phóng ba khe).
- Cỗ máy: các hình mới, băng chuyền rẽ nhánh tool, đích mờ của W3; hiện trường và cờ thế giới; `LEVEL_COPY`; gợi ý và chẩn đoán.
- `zones.json`: chuyển `watchtower` sang `open` khi W1 qua cổng phát hành.

### 6.4 Thứ tự đề xuất

1. Spike structured output (nửa ngày) → quyết mục 1.1.
2. Engine gói 1 + 2 + khối W1 → W1 chạy được với FakeLLM.
3. Nội dung W1 + frontend W1 + cổng hiệu chỉnh → **phát hành W1 riêng**.
4. Sửa biên dịch (gói 1 đã xong) + khối W2 + kho chính sách → W2.
5. W3 sau cùng (cần canary, che trace, ghép đòn).

## 7. Tiếp cận

- Mọi thao tác kéo có bản thay bằng bấm (như Lăng kính). Khay cụm từ là danh sách nút có `aria-pressed`.
- Chó gác "sủa" có chữ đi kèm ("chặn: điểm 0,91 ≥ 0,8"), không chỉ màu hay âm thanh. Không có âm thanh mặc định.
- Bệ phóng W3 đọc được bằng trình đọc màn hình: mỗi khe là một nhóm lựa chọn có nhãn.

## 8. Đo ở pilot

- Tỉ lệ người chơi đặt lưới quá rộng ở lượt đầu (dự đoán: phần lớn), và có sửa sau khi thấy `guard.blocked_benign` không.
- Thời gian tới sao 1 của W1 so với Thư viện L1.
- Ở W3: tỉ lệ chọn bản vá "thêm cụm từ" ở lượt đầu, so với sau khi xem báo cáo lớp thủng.

## 9. Chủ dự án cần quyết

1. **Phiếu hành động thay agent** (mục 1.1): một lời gọi mỗi ca, tool chạy bằng code. Không chọn thì W1 vượt quỹ P = 13 khoảng 3–4 lần.
2. **Chó gác tính sẵn** (mục 1.2) thay vì gọi model lúc chạy.
3. **W3 không có ô gõ tự do** (mục 5.2): đòn ghép từ thẻ. Không chọn thì cần cảnh báo X10 và chấm lớp guard trên chữ tự do.
4. **Sao 2 và 3 của W3** chấm việc chỉ đúng lớp thủng và bản vá (mục 5.4), thay cho mốc "token" của các level khác.
5. **Thứ tự mở khoá** (dàn ý câu 5): đặc tả này đặt Tháp canh sau Thư viện L1, không bắt qua Chợ model, vì không còn cần `agent_react`.
6. Câu 3 và 4 của dàn ý (mốc 20 s/90 s cho đòn nhiều lượt; đấu trường giữa người chơi) vẫn mở; đặc tả này giữ ≤ 2 lượt và không có đấu trường.
