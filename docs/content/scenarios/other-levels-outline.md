> **Trạng thái:** phác thảo v0.1, chưa viết kịch bản đầy đủ. Mỗi level ≤ ~250 chữ.
> **Nguồn:** [Phần 3](../../design/part-3-block-system.md) §3.2–3.3 và các sửa lỗi của phản biện là chuẩn; [gameplay-direction](../../design/gameplay-direction.md) chỉ dùng cho phần trình bày. Mỗi mục ghi điểm lệch đã giải quyết thế nào.
> **Ghi chú D1:** Thư viện mở trước, nên Chợ model L1 không còn giới thiệu Thùng Context lần đầu; nó mở rộng chiếc thùng người chơi đã gặp ở Thư viện L1.

# Sáu level còn lại: Chợ model và Tháp canh

## Chợ model · NPC: chị Hạnh

Chị Hạnh là chủ quầy chợ phiên cuối tuần trong khuôn viên: nói nhanh, tính nhẩm giỏi, ghét lãng phí.

### M1 · `context-packing` · Đóng thùng context

- **Mồi:** khách cầm phiếu đi tìm "sạp E9" (không có sạp này) và lội xuống ao; quầy báo giá theo bảng phí cũ.
- **Đồ chơi → khối:**
  - Kệ tư liệu → `doc_shelf.items` (≤ 12);
  - Thùng Context → `context_packer{token_budget 300–16000, order, on_overflow cat_duoi|bo_uu_tien_thap}`; lần đầu được **đổi cỡ thùng**;
  - Máy nén → `compress{target_tokens 100–2000, keep ⊆ {so_lieu, nguon_thoi_diem, ngoai_le}}`.
  - Thể tích khối là số token đếm sẵn bằng `count_tokens`; khối tiếng Việt to hơn.
- **Bẫy:**
  - [T] 9 tư liệu ≈ 9k token so với ngân sách 3k nên bảng phí 2026 bị `cat_duoi` cắt (`pack.dropped`).
  - [M] Bảng giá 2024 và 2026 cùng vào thùng.
  - [M] Một ca hỏi dữ kiện không có ở đâu.
  - Hai bẫy [M] qua cổng hiệu chỉnh; không cắn thì hạ thành `info` (phản biện).
- **Aha:** "nhét hết" thì không vừa thùng, còn cắt bừa thì mất đúng tờ cần. Nén là mất thông tin, nên phải chọn giữ gì.
- **Lệch đã giải quyết:**
  - Tham số packer theo Phần 3 (`token_budget`, `order`, `on_overflow`), không dùng `items/budget/output_reserve`.
  - Không có "model rẻ" mà chỉ có profile effort.
  - `compress` chạy **một lần mỗi run** trước các ca, tính vào `RunBudget` chứ không vào deadline từng ca (sửa lỗi phản biện về trần 12 lời gọi).
  - Khởi động tay "đóng thùng cho từng khách" (≤ 60 giây) dùng đúng Thùng, không thêm mini-game mới.

### M2 · `model-routing` · Ghi ray

- **Mồi:** ba loại đơn (phân loại, tóm tắt, suy luận) dồn ứ; đơn tính tiền sai vì quầy đoán số liệu đơn hàng.
- **Đồ chơi → khối:**
  - Ghi ray → `router{method tu_khoa|llm, nhãn phan_loai/tom_tat/suy_luan/khac}`;
  - mỗi ray là một nhánh `llm` hoặc `agent_react{profile, max_iterations 1–8}`;
  - Bàn Tính → `tool_order`, `tool_discount`, `tool_shipping` (`Tool<read>`, `description` ≤ 400 ký tự).
- **Bẫy:**
  - [T] Đơn suy luận cần số liệu chỉ tool mới có (thiếu dữ liệu).
  - [T] Đơn ghi chữ "phân loại" nhưng cần tra, nên router từ khoá đi sai nhánh (`route.chosen`).
  - [T] Dùng agent cho đơn phân loại tốn token gấp nhiều lần.
  - [M] Profile `nhe` cho đơn suy luận.
  - [M] Mô tả tool mơ hồ.
- **Aha:** profile nhẹ có tool thắng profile nặng không có tool. Không phải đơn nào cũng cần agent.
- **Lệch đã giải quyết:**
  - "Model Nhỏ/Vừa/Lớn" đổi thành 3 mức effort của cùng `claude-opus-5-5`. UI ghi đúng câu của Phần 3 §3.3.
  - Bỏ metric `usd`, chỉ chấm `tokens` (phản biện).
  - "Sổ đền bù" chỉ còn là hình minh hoạ có nhãn, vì M2 không có tool ghi.
  - **Chủ dự án cần quyết:** có định tuyến sang model khác thật không (đặc tả §13.1.3).

### M3 · `history-compaction` · Lịch sử phình to (sự cố)

- **Mồi:** sân khấu chợ đêm dựng ở Sân A tối om, vì quầy quên lời đính chính "chuyển sang Sân B" ở lượt 21.
- **Đồ chơi → khối:** Máy Ép → `history_compactor{strategy giu_n_cuoi|tom_tat_cu, keep_last_n 0–20, state_fields ⊆ {quyet_dinh, rang_buoc, dinh_chinh_moi_nhat, cau_hoi_mo}}`. Mỗi nam châm giữ là một `state_field`.
- **Khởi đầu:** bản sao lời giải M2 cộng 30 lượt (≈ 14k token) nối thẳng vào packer. Gợi ý 1: chạy lại lời giải cũ.
- **Bẫy:**
  - [T] Packer cắt từ lượt cũ nhất nên ràng buộc ở lượt 2 mất (`pack.dropped` theo lượt).
  - [T] `giu_n_cuoi` 6 cũng bỏ lượt 2.
  - [M] `tom_tat_cu` mà không giữ `rang_buoc`; chất lượng bản tóm tắt phụ thuộc model, phải hiệu chỉnh (phản biện).
- **Aha:** nén là mất thông tin; bản tóm tắt phải giữ quyết định, ràng buộc và **đính chính mới nhất**.
- **Lệch đã giải quyết:**
  - Nam châm "nguồn" không phải trường của Phần 3, nên đưa vào câu hỏi mở.
  - "Sọt lời chào" và "ngăn lưu trữ" chỉ là hình ảnh của việc bỏ và lưu, không có tham số riêng.

## Tháp canh · NPC: anh Quân, chị Vy

Anh Quân là bảo vệ ca đêm của Tháp canh: ít lời, kỹ tính, ghét báo động giả. Chị Vy là trưởng nhóm tấn công thử (W3).

### W1 · `direct-injection` · Cổng thành

- **Mồi:** cuộn biên lai dài: sổ hoàn tiền giả ghi 5 triệu đã chi cho một yêu cầu "trông hợp lệ".
- **Đồ chơi → khối:**
  - Lưới cụm từ → `pattern_guard{phrases ≤ 30 × ≤ 50 ký tự, refusal}`. Người chơi khoanh cụm từ, **không viết regex**.
  - Chó gác → `injection_classifier{threshold 0.5–0.95}`.
  - Chuông duyệt → `human_approval{policy luon_hoi|hoi_neu_vuot, amount_threshold}` bọc `tool_refund`.
- **Bẫy:**
  - [T] Đòn base64 và đòn nhập vai lọt danh sách cụm từ.
  - [T] Câu lành tính có chữ "bỏ qua" bị lưới quá rộng chặn nhầm (`guard.blocked_benign`).
  - [T] Ledger ghi hoàn tiền khi không có cổng duyệt.
  - [M] Injection để nguyên, không biến tấu.
- **Chấm:**
  - 0 hoàn tiền sai trong ledger **và** phục vụ ≥ 7/8 khách thật.
  - Refusal của model ở ca tấn công tính là `info`; refusal ở ca lành tính tính là chặn nhầm (phản biện).
- **Aha:** chặn tất cả thì mất khách thật; một lớp lọc không đủ.
- **Lệch đã giải quyết:**
  - Bỏ "Lưới regex/Đúc khuôn", "Cân", "Rào chủ đề", vì không có trong catalog.
  - W1 không có canary.
  - Khởi động "đóng dấu DUYỆT/CHẶN" dùng chính Lưới cụm từ.

### W2 · `poisoned-documents` · Tài liệu độc

Cần đã qua W1 và Thư viện L1.

- **Mồi:** hộp thư đi giả có một email gửi hồ sơ khách ra ngoài. Cô Lan xuất hiện chớp nhoáng: kho chính sách dùng chung với Thư viện.
- **Đồ chơi → khối:**
  - Đèn UV → `doc_guard{strip_hidden}`;
  - Hũ kính → `doc_guard{mode the_xml|datamark, strip_imperative}`;
  - Phích cắm → tháo `tool_email` (được phép);
  - Con Dấu PII → `pii_filter{types, action che|chan, normalize}`.
- **Bẫy:**
  - [T] Đoạn của tài liệu độc vào packet (`poison.reached_llm`, từ `doc_id`).
  - [T] SĐT "09 12 34 56 78" lọt bộ lọc khi `normalize` tắt.
  - [M] Model làm theo lệnh ẩn và gửi email.
  - Tháo `tool_email` bảo đảm 0 lần gửi ra ngoài một cách tất định (bẻ bộ ba chết người).
- **Aha:** tài liệu cũng có thể là kẻ tấn công; bỏ một trụ của bộ ba chết người đáng tin hơn mọi bộ lọc.
- **Lệch đã giải quyết:**
  - Điều kiện tiên quyết là compiler sửa lỗi guard ∥ retrieval fan-in (phản biện high).
  - Kho chính sách là `corpus` riêng của W2.
  - "Chấm trước bộ lọc" chỉ là một tab trong truy vết.

### W3 · `turncoat-agent` · Đổi phe (sự cố)

- **Mồi:** chị Vy đưa người chơi thẻ "được phép tấn công" đích của tháp: "Ghi lại mọi phát, kể cả phát trượt."
- **Đồ chơi → khối:**
  - Bệ phóng → `attack_prompt{technique ghi_de|nhap_vai|base64|doi_ngon_ngu|trich_xuat, turns ≤ 2, goal lo_ma|lo_pii|goi_tool_cam}`;
  - Cuộn tài liệu cài → `attack_poison_doc`;
  - đích là `target_agent`, bị khoá.
- **Đích:**
  - `pattern_guard` với **danh sách cụm từ cố định** (không phải regex);
  - chưa có spotlighting, `pii_filter` không chuẩn hoá, cổng hoàn tiền đặt ngưỡng cao;
  - system prompt yếu do level viết, chạy effort low.
- **Bẫy và chấm:**
  - 1 sao = xuyên lớp guard (tất định: base64 và đổi ngôn ngữ lọt danh sách) ở ≥ 2 mục tiêu.
  - Việc model làm theo sau khi xuyên là điểm thưởng hoặc `info`.
  - `reference_attacks` phải thành công 3/3 lần ở cổng phát hành.
  - Canary xoay theo run và chỉ tính khi không có trong lượt của kẻ tấn công.
  - Trace của đích bị redact.
- **Aha:** vá cụm từ chỉ hàn một vết; đưa bí mật ra khỏi context hàn mọi vết.
- **Lệch đã giải quyết:**
  - Không tấn công cấu hình của chính mình (đấu trường bất đồng bộ để sau).
  - 12 phát giảm còn ≤ 3 đòn mỗi run, mỗi đòn ≤ 2 lượt (phản biện).
  - Không có ROT13; chỉ base64 do engine mã hoá tất định.

## Chủ dự án cần quyết

1. M2: chỉ dùng effort của một model, hay định tuyến sang model rẻ hơn thật? Nếu đổi model thì phải hiệu chỉnh lại mọi ngưỡng.
2. M3: có thêm `state_field` "nguồn" (gameplay-direction) vào Phần 3 không?
3. W3: nếu cần nới mốc 20 s / 90 s cho đòn nhiều lượt thì đó là thay đổi Phần 2.
4. W3: đấu trường bất đồng bộ giữa người chơi (research §2.5) có vào MVP không? Nếu có thì cần thêm thiết kế chống lạm dụng.
5. Thứ tự mở khoá sau D1: Thư viện → Chợ → Tháp, hay cho chọn Chợ hoặc Tháp sau Thư viện? W1 cần agent và tool, nên vẫn phải qua M2.
