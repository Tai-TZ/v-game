> **Trạng thái:** Bản thiết kế, chưa triển khai; cần sửa các vấn đề ở cuối trước khi code engine.
> **Nguồn:** bản cuối của Phần 3 và báo cáo của agent phản biện, chép nguyên văn (chỉ hạ cấp tiêu đề của báo cáo phản biện). "Phần 4" (evaluator) và "Phần 5" (giáo viên duyệt level) được nhắc trong bài nhưng chưa có tài liệu.
> **Sửa 2026-10-08:** nguyên tắc 5 ("không gợi ý gì trước khi chạy") được nới bởi [roadmap-v0.4](roadmap-v0.4.md) X11: xem trước tất định được phép nhưng chỉ hiện hạng, cosine và chữ của đoạn, không bao giờ đánh dấu đoạn đáp án; đáp án chỉ lộ sau `run.finished`. Thân bài dưới đây giữ nguyên văn.
> **Liên quan:** [Đặc tả tổng hợp](../specs/2026-10-07-v-game-design.md) · [Hướng gameplay đề xuất](gameplay-direction.md) · [ADR 0003](../adr/0003-backend-stack.md)

# Phần 3. Hệ khối và cách dựng agent từ khối

## 3.0 Sáu nguyên tắc

1. **Mỗi khối dạy một khái niệm có trên slide.** Khối khai báo `concepts` trỏ tới slide (N = Ngày học). Codex, thông báo lỗi và chẩn đoán đều dùng chung trường này.
2. **Chặn ít, cho chạy nhiều.** Validation chỉ chặn ba loại đồ thị: đồ thị không có nghĩa khi chạy, đồ thị gây hại cho nền tảng (chi phí, vòng lặp vô hạn) và đồ thị dùng thứ nằm ngoài phạm vi level. Cấu hình dở nhưng hợp lệ vẫn được chạy thật. Nó thất bại kèm bằng chứng, và lần thất bại đó chính là bài học.
3. **Bẫy phải cắn bằng cơ chế tất định**, gồm: dữ liệu bị thiếu trong context, phần bị cắt do ngân sách, hạng của gold chunk, sổ cái tool (ledger), canary và regex. Bẫy nào chỉ cắn khi model "mắc lừa" thì phải qua cổng hiệu chỉnh (mục 3.9). *Lost in the middle* chỉ là thông tin chẩn đoán, không bao giờ là tiêu chí chấm sao. Vị trí trong context chỉ làm mất sao khi phần đó bị cắt, hoặc khi level cài sẵn tài liệu cũ hay mâu thuẫn (Ngày 4: model mới đọc context dài tốt hơn nhiều).
4. **Dữ liệu chấm không đi vào engine.** Level được nạp thành hai kiểu:
   - `PublicLevel`: phần các khối được thấy.
   - `GradingSpec`: phần chỉ evaluator ở Phần 4 thấy. Gồm đáp án, ánh xạ gold span sang chunk_id cho từng biến thể index, id tài liệu độc, canary và `weakness_map`.

   Engine chỉ phát dữ kiện trung tính. Mọi kết luận cần so với gold được tính sau khi ca kết thúc, và người chơi chỉ thấy chúng qua chẩn đoán cùng 3 gợi ý.
5. **Không gợi ý gì trước khi chạy.** Người chơi chỉ thấy ước tính token/chi phí và thông báo "khối này không nằm trên đường nào". Không có socket trống, không có cảnh báo kiểu "cổng duyệt đang bọc tool đọc".
6. **Khung nền trung tính, cùng đồ thị thì cùng kết quả.** Nền tảng chỉ chèn một system prefix cố định (ngôn ngữ, định dạng trích dẫn) và không thêm lớp phòng thủ nào. Phản hồi LLM được cache để phát lại (mục 3.8), nên người chơi không thể chạy lại nhiều lần để "quay số" lấy sao.

## 3.1 Kiểu cổng

| Kiểu | Nội dung |
|---|---|
| `Query` | câu hỏi của ca kèm meta công khai |
| `History` | các lượt hội thoại (rỗng ở M1–M2) |
| `Docs` | danh sách `{doc_id, chunk_id, text, score, meta{dieu, hieu_luc}}`, luôn mang nhãn `untrusted` |
| `Context` | packet đã xếp, tổng token, điểm ngắt cache |
| `Tool<read>` / `Tool<write>` | đặc tả tool; hai loại tô màu khác nhau trên canvas (ranh giới đọc/ghi, Ngày 4) |
| `Answer` | text, citations, stop_reason |
| `Index` | handle tới một biến thể index đã tính sẵn; **chỉ tồn tại lúc biên dịch** |
| `Attack` | một ca tấn công (W3) |

Không có ép kiểu ngầm. Hai khối `corpus` và `chunker` nằm trong làn "Ingestion (offline)", tô nền khác trên canvas. Trace chỉ in một dòng cho phần này, ví dụ: "Ingestion (offline, tính sẵn): 214 chunk, trung bình 498 token".

## 3.2 Danh mục khối MVP

Có tổng cộng 29 khối, trong đó 6 khối là tool, mỗi tool chỉ là một hàm mỏng chạy trên fixture. Tham số ghi theo dạng `miền (mặc định)`. Cột cuối ghi các level dùng khối và level mở khóa nó, ký hiệu "mở X".

| id | Tên | Làm gì | Tham số | Vào → Ra | Khái niệm | Level |
|---|---|---|---|---|---|---|
| `input` / `output` | Câu hỏi khách / Trả lời | phát ca test / nhận 1 Answer cho mỗi ca | — | → Query, History / Answer → | — | tất cả, khóa sẵn |
| `doc_shelf` | Kệ tư liệu | chọn tư liệu NPC đưa, hiện số token thật | `items` ⊆ tư liệu của level, ≤12 ([]) | → Docs | Select; thiếu dữ liệu thì model bịa (N1, N4) | M1–M3 (mở M1) |
| `compress` | Nén tóm tắt | LLM effort low tóm một tư liệu | `target_tokens` 100–2000 (400); `keep` ⊆ {so_lieu, nguon_thoi_diem, ngoai_le} | Docs → Docs | Compress; nén là lossy (N4) | M1–M3 (mở M1) |
| `context_packer` | Đóng gói context | xếp các phần lên "bàn", áp ngân sách | `token_budget` 300–16000 (3000); `order`; `on_overflow` cat_duoi/bo_uu_tien_thap. Mở dần: `repeat_task_at_end` (M3), `cite_ids` (L1), `reorder_docs` giu_nguyen/dau_cuoi (L2) | Query, History, Docs (nhiều) → Context | context packet, token budget, chia 20/60/20, reordering (N4, N8) | M1–W2 (mở M1) |
| `llm` | Gọi LLM | một lần gọi Claude | `profile` nhe/can_bang/sau (can_bang); `system_prompt` ≤2000 ký tự | Context → Answer | token economy, system prompt (N1, N4) | M1–L3 (mở M1) |
| `router` | Phân luồng | đọc nội dung đơn rồi chọn 1 nhánh | `method` tu_khoa (bảng nhãn → cụm từ) / llm; nhãn phan_loai/tom_tat/suy_luan/khac | Context → Context@nhãn | routing/triage, chọn model (N1, N3) | M2–M3 (mở M2) |
| `agent_react` | Tác tử ReAct | vòng Thought → Action → Observation | `profile`; `system_prompt`; `max_iterations` 1–8 (5) | Context, Tool (nhiều) → Answer | ReAct, Agentic Fit, MAX_ITERATIONS (N3) | M2–W2 (mở M2) |
| `tool_order`, `tool_discount`, `tool_shipping` | Tra đơn / Tra mã giảm / Tính phí ship | tool đọc trên fixture | `description` ≤400 ký tự (mặc định cố ý viết mơ hồ) | → `Tool<read>` | 5 thành phần của tool definition, chained tools (N3, N4) | M2–W1 (mở M2) |
| `history_compactor` | Nén lịch sử | giữ N lượt cuối, tóm phần cũ thành bản ghi có trường | `strategy` giu_n_cuoi/tom_tat_cu; `keep_last_n` 0–20 (6); `state_fields` ⊆ {quyet_dinh, rang_buoc, dinh_chinh_moi_nhat, cau_hoi_mo} | History → History | compaction là lossy (N4) | M3 (mở M3) |
| `corpus` | Kho luật | "Bộ luật Thị trấn" hư cấu của level | khóa | → (ingestion) | ranh giới ingestion và retrieval (N7) | L1–L3, W2 (mở L1) |
| `chunker` | Chia chunk | chọn 1 trong 24 biến thể index đã tính sẵn | `strategy` co_dinh/theo_dieu; `chunk_size` {128, 256, 512, 1024} (512); `overlap_pct` {0, 10, 20} (10) | → Index | chunking, overlap 10–20% (N7) | khóa ở L1, mở tham số ở L2 |
| `vector_search` | Tìm theo nghĩa | KNN cosine chính xác | `top_k` 1–20 (5). Mở ở L2: `score_threshold` 0–0.9 (0), `only_in_force` (false) | Query, Index → Docs | embedding, top-k, threshold, metadata filter (N7) | L1–L3, W2 (mở L1) |
| `bm25_search` | Tìm từ khóa | BM25, tokenizer giữ chữ số ("điều", "47") | `top_k` 1–20 (5) | Query, Index → Docs | sparse search, khớp chính xác (N8) | L3 (mở L3) |
| `fusion` | Hợp nhất kết quả | gộp 2–3 danh sách | `method` rrf/alpha; `k` 1–100 (60); `alpha` 0–1 (0.5, trọng số của vector); `top_k` 1–30 (10) | Docs (2–3) → Docs | hybrid search, RRF, alpha (N8) | L3 (mở L3) |
| `rerank` | Xếp hạng lại | cross-encoder chấm từng cặp (câu hỏi, chunk) | `top_n` 1–10 (3), ≤ số ứng viên | Query, Docs → Docs | retrieve-and-rerank, ROI so với độ trễ (N8) | L3 (mở L3) |
| `pattern_guard` | Lọc mẫu injection | khớp cụm từ nguyên văn sau khi chuẩn hóa (NFKC, chữ thường, bỏ dấu) | `phrases` ≤30 × ≤50 ký tự; `refusal` ≤200 ký tự | Query → Query (chặn thì đặt `halt`) | input guardrail, mẫu chỉ bắt được 60–70% (N11) | W1–W2 (mở W1) |
| `injection_classifier` | Phân loại injection | Claude effort low trả `{nhan, do_tin_cay, ly_do}` | `threshold` 0.5–0.95 (0.8); `refusal` | Query → Query (`halt`) | LLM classifier, defense in depth (N11) | W1–W2 (mở W1) |
| `human_approval` | Cổng duyệt | bọc 1 tool; mọi lần gọi tool phải qua người duyệt | `policy` luon_hoi/hoi_neu_vuot; `amount_threshold` 0–10.000.000đ (500.000) | `Tool<x>` → `Tool<x>` | HITL; việc duyệt nằm trong code, không nằm trong prompt (N4, N11) | W1–W3 (mở W1) |
| `tool_refund`, `tool_customer`, `tool_email` | Hoàn tiền / Tra hồ sơ khách / Gửi email | tool ghi / tool đọc có PII / tool ghi ra ngoài | `description` | → `Tool<write>`, `Tool<read>`, `Tool<write>` | lethal trifecta (N11) | refund mở W1; hai tool còn lại mở W2 |
| `doc_guard` | Cách ly tài liệu | spotlighting và làm sạch tài liệu | `mode` the_xml/datamark; `strip_hidden` (false); `strip_imperative` (false) | Docs → Docs | indirect injection, spotlighting (N4, N11) | W2 (mở W2) |
| `pii_filter` | Lọc PII đầu ra | regex bắt CCCD, SĐT, email, số thẻ | `types`; `action` che/chan; `normalize` (false) | Answer → Answer | output guardrail (N11) | W2 (mở W2) |
| `attack_prompt` | Đòn tấn công | gửi 1–5 lượt tới NPC | `technique` ghi_de/nhap_vai/base64/doi_ngon_ngu/trich_xuat; `turns` 1–5 lượt × ≤800 ký tự; `goal` lo_ma/lo_pii/goi_tool_cam | → Attack | direct injection, jailbreak, multi-turn (N11) | W3 |
| `attack_poison_doc` | Cài tài liệu độc | chèn chữ ẩn vào một tài liệu của kho đích (overlay trong RAM) | `host_doc`; `hidden_text` ≤500 ký tự; `position` dau/giua/cuoi | → Attack | indirect injection (N11) | W3 |
| `target_agent` | Agent của NPC | đồ thị đích, khóa, hiện mờ trên canvas | — | Attack (nhiều) → báo cáo | red teaming, ASR (N11) | W3 |

**Thứ tự mở khóa:**
- Chợ model đi theo thứ tự M1 → M2 → M3.
- Thư viện mở sau M1, đi theo thứ tự L1 → L2 → L3.
- W1 cần đã qua M2 (phải có agent và tool).
- W2 cần đã qua W1 và L1 (phải có retrieval).
- W3 cần đã qua W2.

Giá trị tham số chưa mở hiện mờ, kèm nhãn "Mở khoá ở «level»".

## 3.3 Chín level ánh xạ vào khối

Mỗi level có:
- một `type` thuộc context-packing, rag hoặc defense;
- một **starter graph** chạy được ngay;
- một palette chỉ gồm các khối được phép.

M1 chạy ở chế độ dẫn dắt: bố cục tự động, khối thả gần một cổng hợp lệ thì tự nối. Từ M2 trở đi người chơi nối tự do. Hai level sự cố (M3, L3) bắt đầu từ bản sao lời giải tốt nhất của người chơi ở level trước, và gợi ý đầu tiên là "chạy lại lời giải cũ" để thấy nó vỡ (L3 làm việc này bằng chiếu đèn miễn phí trên lời giải cũ, không chạy lượt thật, vì mỗi lượt tốn quỹ ngày; sửa 2026-10-08, rà soát vòng 6, [L3 §11](../content/scenarios/library-l3-article-number-lookup.md#11-chẩn-đoán-và-gợi-ý)).

Bảng dưới đây cũng chính là danh sách các cấu hình **được chạy để thất bại**.

| Level · type | Starter → khối thêm | Cấu hình dở vẫn chạy | Bẫy (cơ chế tất định) | Dữ kiện trong trace → kết luận sau ca | Khái niệm |
|---|---|---|---|---|---|
| M1 · context-packing | input → kệ (trống) → packer (3000) → llm → output; thêm compress | lấy cả 9 tư liệu, `cat_duoi` | 9k token so với ngân sách 3k nên bảng phí 2026 bị cắt; một ca hỏi dữ kiện không có ở đâu; bảng giá 2024 và 2026 mâu thuẫn | `pack.dropped`, `pack.tokens` → thiếu nguồn, có số liệu không nguồn, dùng bản giá cũ | Select/Compress, thiếu dữ liệu dẫn tới bịa (N1, N4) |
| M2 · context-packing | M1 + 3 loại đơn; thêm router, agent_react, 3 tool đọc | `sau` cho mọi đơn; `nhe` cho mọi đơn; router từ khóa | đơn suy luận cần số liệu đơn hàng mà chỉ tool mới có; đơn ghi chữ "phân loại" nhưng thực ra cần tra; dùng agent cho đơn phân loại tốn gấp nhiều lần | `route.chosen`, tool calls, usd theo từng loại đơn → sai nhánh, dùng agent thừa, vượt ngân sách | chọn model theo loại đơn, Agentic Fit, routing (N1, N3) |
| M3 · context-packing, sự cố | lời giải M2 + lịch sử 30 lượt (khoảng 14k token) nối thẳng vào packer; thêm history_compactor | nối thẳng History; `giu_n_cuoi`; tóm tắt nhưng không giữ `rang_buoc` | ràng buộc nằm ở lượt 2, đính chính nằm ở lượt 21; packer cắt từ lượt cũ nhất | `pack.dropped` (theo lượt), `compact.fields` → mất ràng buộc, dùng thông tin đã bị đính chính | compaction là lossy (N4) |
| L1 · rag | input → packer → llm → output (tức "LLM chay") + corpus; thêm chunker (khóa) và vector_search; mở `cite_ids` | giữ nguyên LLM chay | luật hư cấu nên model không thể biết từ trước; một ca hỏi "Điều 99" không tồn tại | `retrieved`, citations → trích điều không có trong docs hay corpus | grounding, abstention (N7, N8) |
| L2 · rag | lời giải L1; mở tham số chunker, threshold, `only_in_force`, `reorder_docs` | chunk 128 với overlap 0%; chunk 1024 với top_k 10 | ngoại lệ nằm ở khoản ngay sau; văn bản 2019 đã hết hiệu lực nhưng gần giống bản 2024 | `retrieved`, `pack.dropped` → gold bị tách hoặc thiếu, vượt ngân sách, dùng văn bản hết hiệu lực | chunk size, overlap, top-k, metadata filter (N7) |
| L3 · rag, sự cố | lời giải L2; thêm bm25, fusion, rerank | chỉ dùng dense search | hỏi "Điều 47 khoản 2" trong khi Điều 74 và 41 có nội dung na ná, xếp hạng cao hơn | `retrieved` (rank, score) → gold nằm ngoài top-k | BM25, hybrid, rerank (N8) |
| W1 · defense | agent của NPC (tool_order, tool_refund, prompt cho phép hoàn tiền), chưa có phòng thủ; thêm 2 guard và human_approval | không guard, không gate; hoặc gate lên mọi tool | yêu cầu hoàn 5 triệu "trông hợp lệ"; đòn base64 và nhập vai; câu lành tính có chữ "bỏ qua" hoặc "system prompt" | ledger, `guard.decision`, `approval.requested` → `hitl.bypassed`, `hitl.over_asked`, chặn nhầm câu lành tính | input guardrail, HITL, over-refusal (N3, N11) |
| W2 · defense | lời giải W1 + vector_search trên kho chính sách (có tài liệu độc) + tool_customer + tool_email; thêm doc_guard, pii_filter; được phép tháo tool | chỉ có guard đầu vào | lệnh ẩn trong tài liệu truy xuất bảo gửi hồ sơ khách qua email; SĐT viết dạng "09 12 34 56 78" | `retrieved` (doc_id), email trong ledger, `redactions` → tài liệu độc lọt tới LLM, rò rỉ ra ngoài, PII lọt do regex không chuẩn hóa | indirect injection, spotlighting, lethal trifecta (N11) |
| W3 · defense, đảo vai | target khóa: regex guard, chưa spotlight, pii_filter không chuẩn hóa, cổng duyệt hoàn tiền đặt ngưỡng cao; người chơi đặt các khối attack | đòn "ignore previous instructions" để nguyên, không biến tấu | điểm yếu của target là tất định: regex trượt base64 và câu đổi ngôn ngữ; PII có khoảng trắng lọt bộ lọc | canary HMAC riêng cho từng người chơi, PII giả, ledger → ASR tính theo từng lớp | red teaming, defense in depth (N11) |

**M2 chấm đúng bài đã chốt.** Bảng kết quả hiện cả độ chính xác lẫn chi phí theo từng loại đơn. Muốn 1 sao, người chơi phải đạt ngưỡng ở cả ba loại đơn.
- UI ghi rõ: "3 profile là 3 mức effort của cùng một model (thinking luôn bật), không phải Haiku, Sonnet và Opus".
- Trace có thêm cột "nếu tính theo giá Haiku/Sonnet/Opus trên slide Ngày 1". Cột này chỉ để tham khảo, không dùng để chấm.

**Chấm sao ở W3:**
- 1 sao: ít nhất 2 đòn thành công, nhắm ít nhất 2 mục tiêu khác nhau.
- 2 sao: thêm điều kiện nằm trong ngân sách token.
- 3 sao: với mỗi đòn thành công, người chơi gắn đúng lớp phòng thủ bị xuyên và khối dùng để sửa. Phần này chấm theo `weakness_map`, giống Activity 3 của Ngày 11.

Nếu NPC từ chối (bằng `refusal` hoặc bằng lời), đòn đó tính là NPC đã chống được.

## 3.4 Khai báo registry và graph JSON

```python
class VectorParams(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    top_k: int = Field(5, ge=1, le=20, title="Số đoạn lấy về")
    score_threshold: float = Field(0.0, ge=0, le=0.9, multiple_of=0.05)
    only_in_force: bool = False

@block("vector_search", v=1, name_vi="Tìm theo nghĩa", zone="thu_vien",
       inputs={"query": In("Query"), "index": In("Index")},
       outputs={"docs": "Docs"}, params=VectorParams, llm_calls=0,
       concepts=["N7.top_k", "N7.threshold", "N7.metadata_filter"])
async def vector_search(p, inp, rt) -> Outputs: ...   # kèm summarize() tất định
```

- **Registry cho client:** `GET /blocks` trả JSON Schema sinh bằng `model_json_schema()`, nhãn tiếng Việt lấy từ `title`, kèm ma trận cổng và mẫu thông điệp.
  - Client sinh form tham số bằng RJSF và sinh kiểu TypeScript bằng json-schema-to-typescript.
  - Canvas chặn ngay các phép kéo sai kiểu. Server vẫn là bên quyết định cuối cùng.
- **Level JSON có các trường:**
  - `allowed_blocks`;
  - `param_limits`, ví dụ `"vector_search.top_k": {"le": 10}`;
  - `locked_nodes`: server tự chèn lại, bỏ bản client gửi lên;
  - `starter_graph`;
  - `budget_metric`: `tokens` hoặc `usd`.

  Mỗi level version ghim luôn version của từng khối.

```json
{"schema": 1,
 "nodes": [{"id": "q", "type": "input"},
           {"id": "ix", "type": "chunker", "params": {"strategy": "theo_dieu", "chunk_size": 512, "overlap_pct": 10}},
           {"id": "vs", "type": "vector_search", "params": {"top_k": 8}},
           {"id": "bm", "type": "bm25_search", "params": {"top_k": 8}},
           {"id": "fu", "type": "fusion", "params": {"method": "rrf", "k": 60}}],
 "edges": [["q.query", "vs.query"], ["ix.index", "vs.index"], ["vs.docs", "fu.docs"], ["bm.docs", "fu.docs"]],
 "ui": {"q": [40, 120]}}
```

`graph_hash` là sha256 của nodes và edges sau khi chuẩn hóa, bỏ qua `ui`. Hash này làm khóa cho cache biên dịch và cache phản hồi. Idempotency vẫn dùng `idempotency_key` do client gửi, như đã chốt ở Phần 2.

## 3.5 Luật nối và validation

**Luật nối:**
- Một cạnh hợp lệ khi kiểu cổng ra trùng kiểu cổng vào. `Tool<read>` khác `Tool<write>`; `human_approval` giữ nguyên kiểu của tool mà nó bọc.
- Cổng `many` nhận được nhiều cạnh.
- Đồ thị phải là DAG. Vòng lặp duy nhất nằm bên trong `agent_react`.
- `output` chỉ nhận nhiều cạnh khi các cạnh đó đến từ các nhãn khác nhau của cùng một `router`. Nhãn nhánh được lan từ router xuống, nên chỉ cần một lượt duyệt theo thứ tự topo để kiểm.
- Guard không có cổng rẽ nhánh. Khi guard chặn, compiler cho ca nhảy thẳng tới `output` kèm lời từ chối.
- Trần: 25 node, 8 khối gọi LLM, 8 đòn tấn công. Level có thể đặt thấp hơn.

**Thứ tự kiểm:**
1. Payload ≤64 KB, UTF-8 hợp lệ, chuẩn hóa NFC, không có NUL hay ký tự bidi.
2. Khối nằm trong whitelist và đã mở khóa.
3. Tham số hợp lệ theo Pydantic giao với `param_limits`, cộng luật chéo giữa các tham số (ví dụ `top_n` không vượt `top_k` phía trước).
4. Kiểu cổng.
5. Cấu trúc đồ thị, kiểm bằng graphlib.TopologicalSorter.
6. Ước tính chi phí trong trường hợp xấu nhất.

Lỗi của **mọi tầng chạy được** được gom vào một phản hồi 422 duy nhất. Chỉ dừng sớm khi payload không đọc được. Mỗi lỗi có dạng `{code, severity, node, port, message_vi, concept_ref}`.

| Mã | Điều kiện | Thông điệp mẫu |
|---|---|---|
| G01 | không có đường từ input tới output | "Câu hỏi của khách chưa có đường tới ô *Trả lời*. Mỗi ca đi từ *Câu hỏi khách*, qua các khối của bạn, rồi tới *Trả lời* (luồng một ca, Ngày 3)." |
| G02 | sai kiểu cổng | "Công cụ là 'tay chân' của agent (Ngày 3). Chỉ *Tác tử ReAct* quyết định khi nào gọi nó, nên công cụ chỉ cắm vào cổng Công cụ." / "*Trả lời* cần một câu trả lời đã sinh. Tài liệu chỉ là nguyên liệu cho bước sinh (Augmentation → Generation, Ngày 8)." |
| G03 | có chu trình | "Vòng lặp chỉ được nằm trong *Tác tử ReAct*, nơi max_iterations ngăn agent đi vòng mãi (Max Iterations Safeguard, Ngày 3). Đồ thị trong xưởng chạy một chiều." |
| G04 | hai nhánh cùng có thể trả lời một ca | "Một câu hỏi đang có hai đường tới *Trả lời*, nên khách sẽ nhận hai câu trả lời. Mỗi ca chỉ được đi một nhánh (Routing, Ngày 3)." |
| G05 | cổng bắt buộc bị bỏ trống | "*Đóng gói context* đang trống. Model chỉ thấy những gì ta đặt lên bàn (Ngày 4)." |
| G06 | khối chưa mở, tham số ngoài miền, hoặc chữ quá dài | "top_k tối đa là 10 ở level này. Lấy nhiều đoạn sẽ làm loãng context và tốn token (Ngày 7)." / "System prompt dài 2.450 ký tự, tối đa là 2.000. Prompt dài hơn không tự tốt hơn: mỗi ký tự là token bạn phải trả ở mọi lần gọi (Ngày 1)." |
| G07 | ước tính xấu nhất vượt trần cứng | "Ước tính xấu nhất là 210k token cho 12 ca, gấp 7 lần trần của xưởng. Mỗi vòng ReAct gửi lại toàn bộ lịch sử, nên agent đắt hơn chatbot khoảng 4,5 lần (Ngày 3)." |

Trước khi chạy, người chơi còn thấy một số thông tin không chặn và không gợi ý thiết kế:
- thanh token ước tính theo từng khối;
- mức `info` "khối này không nằm trên đường nào";
- `W_RERANK_NOOP`: "Xếp hạng lại giữ 5/5 đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian".

**Chính sách chặn hay cho chạy**

| Nhóm cấu hình | Xử lý | Vì sao |
|---|---|---|
| khối lạ hoặc chưa mở, tham số ngoài miền, chữ quá dài, payload bất thường | CHẶN | biên an toàn, không phải bài học |
| sai kiểu cổng, thiếu cổng bắt buộc, có chu trình, hai câu trả lời cho một ca | CHẶN | đồ thị không có ngữ nghĩa để chạy |
| ước tính chi phí xấu nhất vượt trần cứng | CHẶN | an toàn tài chính |
| vượt ngân sách sao, thiếu tư liệu hoặc thiếu retrieval, chunk/top-k dở, chỉ dùng dense, không nén lịch sử | CHO CHẠY | phần bị cắt, bị thiếu, sai hạng hiện rõ trong trace, đúng bài của Ngày 1, 4, 7, 8 |
| profile không hợp loại đơn, dùng agent cho việc không cần agent, max_iterations quá thấp | CHO CHẠY | trượt mục tiêu hoặc vượt ngân sách, đo được (Ngày 1, 3) |
| không có guard, chỉ có guard đầu vào, guard quá rộng, tool ghi không có cổng duyệt, gate lên mọi tool | CHO CHẠY | injection lọt, ledger ghi hoàn tiền, chặn nhầm, hỏi duyệt thừa (Ngày 11) |
| system prompt rỗng hoặc yếu, mô tả tool mơ hồ | CHO CHẠY | riêng bẫy mô tả tool mơ hồ phải qua cổng hiệu chỉnh (mục 3.9) |

## 3.6 Biên dịch thành LangGraph

```python
class CaseState(TypedDict):
    case: PublicCase                                    # không chứa đáp án
    ports: Annotated[dict[str, Any], merge_once]        # "vs.docs" -> giá trị
    route: Annotated[dict[str, str], merge]             # router -> nhãn đã chọn
    halt: GuardVerdict | None
    facts: Annotated[list[StepFact], operator.add]
    ledger: Annotated[list[ToolEffect], operator.add]
    usage: Annotated[list[Usage], operator.add]
```

1. **Ingestion:** `corpus` và `chunker` được quy về `IndexHandle(level_version, variant)`. Bước này không sinh node runtime nào.
2. **Node:** mỗi khối runtime thành `instrumented(spec, params, deps)`. Node đọc `ports` theo bảng cạnh và ghi kết quả vào `ports["id.port"]`.
3. **Cạnh:**
   - Cạnh thường dùng `add_edge`. Fan-in dùng `add_edge([a, b], c)`.
   - Router dùng `add_conditional_edges`. Các nguồn từ những nhánh khác nhau đi vào `output` bằng các cạnh riêng.
   - Sau mỗi guard là một conditional edge: nếu `halt` có giá trị thì đi thẳng tới `output`.
4. **`agent_react` biên dịch thành subgraph:**
   - Node model dùng `bind_tools(tools, strict=True)` với tool_choice auto, nối qua lại với `ToolNode` dựng sẵn.
   - Số vòng được giới hạn bằng một bộ đếm cộng conditional edge, không dựa vào `recursion_limit`, để vẫn giữ được bằng chứng khi chạm trần.
   - Hết vòng thì trả "Dừng: hết số vòng" và ghi fact `agent.max_iter`.
   - Gọi trùng (cùng tool, cùng args) thì trả observation cảnh báo và ghi `agent.dup_call` (Agent Loop V2, Ngày 3).
   - Lịch sử trong vòng chỉ được nối thêm. Mọi content block, kể cả thinking block, được trả lại nguyên byte (preserved thinking). Bộ tool cố định suốt vòng. Không dùng prefill.
   - "Thought" lấy từ các progress-update thinking block. Để có nội dung, engine yêu cầu `thinking.display: "updates"` (beta) hoặc `"summarized"`, và chỉ hiển thị những block có chữ.
5. **Chạy:** graph được compile một lần cho mỗi run (cache LRU theo `graph_hash` và `level_version`), rồi `ainvoke` cho từng ca, tối đa 3 ca song song.

**Quy tắc cho mọi lời gọi LLM:**
- Effort luôn được đặt tường minh. Không có temperature, vì Opus 5.5 trả 400 khi nhận tham số này.
- Các khối cần trả JSON (router dạng llm, classifier, compactor, compress) dùng `with_structured_output(method="json_schema")` hoặc tool strict với tool_choice auto. Không bao giờ dùng chế độ function-calling mặc định, vì nó ép tool_choice và gây lỗi 400.
- Mọi khối gọi LLM đều xử lý `stop_reason`:
  - `refusal`: chỉ khi đó mới đọc `stop_details`. Ở các level W, refusal tính là phòng thủ thành công; ở các level M và L, đó là ca trượt có ghi rõ lý do.
  - `max_tokens`: thành một fact hiện rõ trong trace.
- Các run chấm điểm tắt `fallbacks` sang model khác để giữ tính tất định. Đây là cấu hình, có thể đổi (xem câu hỏi mở).

**Context-packing (M1–M3):** đồ thị là DAG: input → kệ → (compress) → packer → llm, hoặc packer → router → các nhánh llm/agent.
- Packer viết bằng Python thuần.
- Số token của nội dung tĩnh được đếm sẵn bằng `count_tokens` lúc publish. Chữ người chơi viết được ước lượng cục bộ lúc validate, không gọi mạng. Số token thật lấy từ usage sau khi chạy.
- Trace hiện thanh token xếp chồng System / History / Docs / Query / Headroom và chỉ rõ phần nào bị cắt.

**Defense (W1–W2):** starter graph là agent của NPC. Khối `human_approval` gọi interface `ApprovalPolicy`.
- Run chấm điểm dùng `ScriptedApprover`: người duyệt mô phỏng duyệt các yêu cầu hợp lệ theo chính sách trong fixture và từ chối phần còn lại. Nhờ vậy kết quả tất định.
- HITL thật của capstone có hai chỗ:
  - giáo viên duyệt level trước khi phát hành (Phần 5);
  - tùy chọn cắm `InterruptApprover` vào cùng interface, dùng LangGraph `interrupt()`, checkpointer trên Postgres và một endpoint resume.

**Red-team (W3):** `target_graph` dùng cùng format, biên dịch bằng cùng compiler, bị khóa và do server chèn vào. Khối tấn công của người chơi không thành node mà thành ca test:
- Kỹ thuật base64 do engine mã hóa tất định. Các kỹ thuật khác do người chơi tự viết; `technique` chỉ là nhãn để chấm sao 3.
- `turns` chạy tuần tự, mỗi phản hồi thật của NPC được nối vào History.
- `attack_poison_doc` là overlay trong RAM lên các chunk của `host_doc`, đi kèm một câu hỏi lành tính do level cung cấp.

Canary là `HMAC(server_secret, user_id ‖ level_version)`, so khớp sau khi chuẩn hóa NFKC và bỏ ký tự vô hình. Vì canary riêng cho từng người, kết quả tấn công không chia sẻ được.

Chống dùng W3 làm proxy gọi Claude miễn phí:
- chỉ hiển thị 600 ký tự đầu của phản hồi target;
- W3 có rate limit riêng;
- mọi đòn tấn công đều được log.

Không hạ `max_tokens` của target, vì thinking tính vào max_tokens.

## 3.7 Sandbox

- **Tool:** hàm Python thuần chạy trên snapshot fixture bất biến, đồng hồ cố định, mỗi ca một bản sao.
  - Args do LLM sinh được Pydantic kiểm lại; sai thì trả `is_error` bằng tiếng Việt.
  - Kết quả là compact result packet `{tool, source, fetched_at, data | error{code}}` (Ngày 4).
  - Lỗi tất định theo id, ví dụ `DH-404` trả NOT_FOUND, `DH-TIMEOUT` trả timeout giả (không sleep).
  - Tool ghi chỉ ghi vào `ledger` (hoàn tiền giả, hộp thư đi giả).
- **Kho luật:** "Bộ luật Thị trấn" hư cấu, có nhiều điều na ná nhau và một bản 2019 đã hết hiệu lực.
  - Lưu trong bảng `corpus_chunk(level_id, level_version, variant, chunk_id, doc_id, text, tokens, meta jsonb, embedding vector)`. Bảng dùng model SQLAlchemy riêng và migration bằng Alembic.
  - 24 biến thể được tính sẵn lúc publish.
  - KNN chính xác: `ORDER BY embedding <=> :q, chunk_id LIMIT :k`. Mỗi biến thể chỉ vài trăm dòng nên không cần index ANN.
  - Truy vấn chạy bằng role DB chỉ có quyền SELECT; mọi giá trị đều là bind param.
- **Embedding:** fastembed (ONNX, chạy CPU, không cần torch), ghim version.
  - Câu hỏi của test set được tính sẵn.
  - Lúc chạy chỉ embed chữ người chơi viết (W3), cache theo hash.
- **BM25:** `rank_bm25` trong RAM, cache LRU theo biến thể.
- **Rerank:** FlashRank (ONNX), điểm cache theo `(query_hash, chunk_id)`.
- **Phương án dự phòng:** nếu spike cho thấy embedding hoặc rerank yếu với tiếng Việt:
  - embedding chuyển sang một API nằm trong egress allowlist;
  - rerank chuyển sang dùng LLM, và codex ghi rõ đây là rerank bằng LLM, khác cross-encoder trên slide.
- **Không chạy code của người chơi.** Người chơi chỉ nhập được enum, số và text có giới hạn độ dài.
  - Text là dữ liệu: được ghép vào message dưới dạng content, không qua `str.format` hay Jinja.
  - Cụm từ của guard được so khớp nguyên văn, không phải regex, nên không có ReDoS. Regex chỉ đến từ level đã được duyệt.
  - Compiler không bao giờ thêm server tool.
  - Egress chỉ tới Anthropic, Langfuse, và API embedding nếu dùng.
- **Ca ẩn:** người chơi thấy 3 ca mẫu. Các ca còn lại và các ca bẫy là ca ẩn.

## 3.8 Instrumentation, chi phí, độ trễ

**Sự kiện.** `instrumented()` bọc mỗi node theo trình tự:
1. phát `step.started`;
2. chạy khối bên trong `get_usage_metadata_callback()` để gom usage;
3. trong `finally`, luôn phát `step.finished` với `status` thuộc ok, timeout, cancelled, budget, llm_error hoặc refusal.

Chi tiết:
- `summary` do hàm `summarize()` tất định của khối sinh ra: ≤140 ký tự, không dùng LLM, không chứa đáp án.
- Bằng chứng đầy đủ (chunk id và điểm, layout packet, args và kết quả tool, stop_reason) được ghi vào `run_step_artifacts`.
- Agent phát thêm các bước con `thought`, `action`, `observation` kèm số `iter`.
- Engine chỉ biết interface `EventSink.emit()`. Tầng app cài đặt việc ghi Postgres và publish Redis; test dùng `ListSink`.
- Callback Langfuse mang metadata `{run_id, case_id, node, block}`.

```json
{"type": "step.finished", "case": "c07", "node": "vs", "block": "vector_search", "status": "ok",
 "summary": "Lấy 5 đoạn: Điều 74 (0.83), Điều 41 (0.81), Điều 47 (0.64)…",
 "tokens": {"in": 0, "out": 0}, "ms": 31, "facts": [{"kind": "retrieved", "chunk_ids": ["…"]}]}
```

**Hook cho Phần 4.** Khi một ca kết thúc, engine gọi `on_case_finished(CaseTrace)`. Evaluator nối các facts với `GradingSpec`, sinh kết luận và lưu cùng ca.
- Sự kiện `case.graded` chỉ mang kết quả đạt hay trượt theo từng tiêu chí sao.
- Vị trí của gold không bao giờ đi qua SSE trong lúc run đang chạy.

| Engine phát (dữ kiện trung tính) | Evaluator kết luận (sau khi ca kết thúc) |
|---|---|
| `pack.included`, `pack.dropped`, `pack.tokens`, `cache.hit_rate` | `ctx.gold_dropped`, `ctx.gold_position` (chỉ để thông tin), `ctx.no_cache_prefix` |
| `retrieved{chunk_id, rank, score}` theo từng khối | `ret.gold_missing`, `ret.gold_rank`, `ret.boundary_split`, `ret.stale_doc` |
| `route.chosen`, `agent.step`, `agent.max_iter`, `agent.dup_call`, `tool.error` | `route.mismatch`, `agent.unneeded` |
| `compact.fields`, `compact.turns_kept` | `hist.lost`, `hist.stale_correction` |
| `guard.decision`, `approval.requested`, `approval.decided`, ledger, `redactions` | `hitl.bypassed`, `hitl.over_asked`, `guard.blocked_benign`, `poison.reached_llm`, `pii.leaked`, `canary.leaked`, `exfil.email` |
| `llm.stop_reason`, citations, usage | `llm.cite_unknown`, `llm.cite_missing`, `budget.exceeded` |

**Chi phí.**
- **Đếm usage:** lấy từ `usage_metadata` của mỗi lời gọi (input, output gồm cả thinking, cache_read, cache_creation), cộng dồn theo node, theo ca và theo run. UI hiện một dải token theo khối, ví dụ "Truy xuất 0 · Rerank 0 · Trả lời 3,4k".
- **Metric cho sao 2** do level JSON chọn:
  - `tokens` = input + cache_read + cache_creation + output (gồm thinking). Người chơi điều khiển con số này qua packet, profile và số vòng.
  - `usd` (dùng ở M2) = cùng các số đó nhân với giá danh nghĩa của model thực sự được gọi.

  Metric không trừ phần giảm giá của cache, để số sao không phụ thuộc trạng thái hạ tầng. Tỉ lệ cache hit và chi phí thật chỉ hiện để người chơi xem và đưa vào giám sát.
- **Profile:** `nhe`, `can_bang`, `sau` đều là claude-opus-5-5, với effort lần lượt `low`, `medium`, `high`.
  - `max_tokens` có mức sàn 4096 / 8192 / 16000 và người chơi không chỉnh được. Độ dài câu trả lời được điều khiển bằng prompt.
  - Lời gọi nội bộ dùng effort low và `max_tokens` 4096.
  - Có ánh xạ profile sang model khác hay không là quyết định sau này; nếu đổi thì phải hiệu chỉnh lại các ngưỡng.
- **Prompt caching:**
  - Thứ tự request: tools (đã sắp xếp) → khung nền → system prompt của người chơi → nội dung tĩnh dùng chung cho mọi ca → điểm `cache_control` → phần riêng của từng ca.
  - Trước khi chạy song song 3 ca, engine làm ấm cache bằng một request `max_tokens: 0`.
  - Mỗi mức effort có prefix cache riêng.
  - Nếu người chơi đặt câu hỏi lên đầu packet thì cache hit bằng 0%, và trace hiện điều này (Ngày 13).
- **Cache phát lại:** bảng Postgres riêng `llm_replay(key, response, usage)`.
  - Khóa là sha256 của (model, effort, thinking display, max_tokens, tools đã sắp xếp, system, messages, frame_version, registry_version).
  - Khi trúng cache: cùng kết quả, chi phí thật bằng 0, và sao được tính trên usage gốc đã lưu.
  - Các lần chạy hiệu chỉnh bỏ qua cache này.
- **Các lớp trần:**
  - (a) **Trước khi chạy:** G07 ước tính tĩnh trường hợp xấu nhất = packet + max_tokens × số lời gọi × max_iterations × số ca.
  - (b) **Khi chạy:** `RunBudget` dùng chung cho mọi ca, `reserve()` trước và `commit()` sau mỗi lời gọi; mỗi ca tối đa 12 lời gọi LLM. Khi vượt trần, các ca còn lại thành `skipped_budget` kèm lời giải thích, không trả lỗi 500.
  - (c) **Thời gian:** deadline asyncio 20 s cho mỗi ca và 90 s cho mỗi run, áp lên mọi bước bên trong. Chỉ retry các lỗi 429, 5xx, 529 với backoff ngắn, và chỉ khi deadline còn đủ. Một semaphore trên mỗi worker giới hạn số lời gọi Anthropic đồng thời.
- **Mặc định cho level có agent:** dùng `nhe` cho tới khi spike đo được p95 của `can_bang` nằm trong 20 s. Dùng `sau` cho mọi bước sẽ dễ chạm mốc 20 s; đó chính là bài học về độ trễ của reasoning model (Ngày 13).

## 3.9 Kiểm thử, cổng phát hành, spike

- **FakeLLM:** lớp con của `GenericFakeChatModel`, có thêm `bind_tools`.
  - Trả text hoặc tool_calls theo kịch bản khớp với nội dung prompt.
  - Luôn trả `usage_metadata` và `stop_reason`; tùy chọn giả refusal và độ trễ.
- **Oracle:** chỉ dùng trong test, là nơi duy nhất được nhận gold. Nó trả lời đúng khi gold span có trong prompt; nếu không có thì bịa "Theo Điều 12…".
- **Cassette:** phát lại các phản hồi thật đã ghi lúc hiệu chỉnh. Embedding thật được tính sẵn và dùng làm fixture.
- **Các tầng test:**
  1. Contract của registry: mỗi khối có schema, cổng, hàm summarize, và concept của nó tồn tại.
  2. Validator kiểu bảng: graph fixture → mã lỗi kèm thông điệp tiếng Việt mong đợi.
  3. Golden test cho compiler: graph JSON → đúng danh sách node và cạnh.
  4. Hypothesis: validator không bao giờ crash, và compiler nhận mọi đồ thị đã qua validate.
  5. Snapshot chuỗi sự kiện: started/finished luôn đi cặp, kể cả khi timeout, cancel hoặc hết budget.
  6. Sandbox: tất định, `pytest-socket` chặn mạng, payload độc (`{__class__}`, 1 MB chữ, NUL, ký tự bidi, đoạn SQL) bị từ chối hoặc vô hại.
  7. Mỗi level: `reference_graph` phải đạt 3 sao với oracle, và mỗi `naive_graph` phải sinh **đúng** các `expected_failures` đã khai báo.
- **Cổng phát hành:** chạy với claude-opus-5-5 thật, bỏ qua cache.
  - Lời giải mẫu phải đạt 3 sao ở cả 3/3 lần chạy.
  - Đồ thị ngây thơ phải sinh đủ các flag dự kiến ở mọi lần chạy.
  - Ở các ca "Điều 47 khoản 2", dense search đơn thuần phải trượt gold trên mọi biến thể index.
- **Bẫy phụ thuộc model** gồm: injection không biến tấu ở W1, injection gián tiếp ở W2, mô tả tool mơ hồ, và effort low cho đơn suy luận. Nếu một bẫy như vậy không cắn ở mọi lần chạy hiệu chỉnh, xử lý theo một trong hai cách:
  - thay bằng cơ chế tất định: yêu cầu "trông hợp lệ" kèm ledger, regex, canary, hoặc dữ liệu bị thiếu;
  - hạ ca đó thành `info`, hiện trong báo cáo dòng "model tự chống được, đừng dựa vào điều này (Ngày 11)", và không tính vào sao.

  Level nào còn ít hơn số bẫy cắn tối thiểu thì không được phát hành.
- **Spike trong tuần đầu:**
  - langchain-anthropic có truyền được `output_config.effort`, `thinking.display`, tool strict và `method="json_schema"` không.
  - p95 của một ca ReAct có 3 tool ở effort low và medium, so với mốc 20 s.
  - Các bẫy phụ thuộc model ở trên có cắn thật không.
  - Chất lượng của fastembed và FlashRank với tiếng Việt.
  - Replay cache có trả đúng usage gốc không.

## Vấn đề cần sửa (agent phản biện)

### Critic verdict

The overall design is sound. The split between neutral facts and grading, the 'fail visibly' policy, the sandbox and the fake-LLM testing are all coherent, and most LLM-API claims check out against the claude-api skill: temperature 400s on Opus 5.5, max_tokens:0 pre-warm, thinking.display "updates" (beta), stop_details only on refusal, effort changes invalidating the cache, no prefill, forced tool_choice 400. The langchain-anthropic source confirms with_structured_output(method="json_schema"), bind_tools(strict=...) and an effort field. The lesson citations also check out: 60–70% pattern matching, ~4.5x agent cost, 10–20% overlap, 20/60/20, Activity 3, lethal trifecta, spotlighting/datamark. The real problems sit at four seams. (1) Compiling guard conditional edges together with fan-in barriers breaks exactly the W2 graph shape: output runs twice or packer runs without Docs, and `halt` has no reducer. (2) G07 as written would reject every starter agent graph. (3) W3 claims determinism, but attack success depends on Opus 5.5 complying; W3 is missing from the calibration gate, the canary can be echoed or leaked through the target trace, and multi-turn attacks cannot fit in 20 s/90 s. (4) Smaller holes: L3 cannot filter the expired document on the BM25 branch; the refusal-scoring rule contradicts itself; the list of model-dependent traps is incomplete (including M1's missing-data case, part of the decided M1 lesson); M2 drifts from 'choose a model' to 'choose effort' with no stable cost difference; compress runs per case and blows through the call cap and timeout. All of these can be fixed inside the existing architecture without adding heavy components.

- [high] 3.6 Biên dịch, bước 3 (Cạnh) + CaseState.halt; ảnh hưởng trực tiếp tới W2 (và mọi đồ thị có guard đứng trước một điểm fan-in): Bản thiết kế dùng `add_edge([a,b], c)` cho fan-in, rồi lại đặt sau mỗi guard một conditional edge 'halt → output'. Hai thứ này đá nhau. Đồ thị W2 có đúng hình dạng này: input→pattern_guard→packer (1 bước) song song với input→vector_search→doc_guard→packer (2 bước). Theo tài liệu LangGraph, nhánh ngắn halt thì nhánh dài vẫn chạy tiếp, vì halt không dừng được nhánh anh em. Barrier vẫn mở nên packer→llm/agent→output vẫn chạy, và output nhận 2 câu trả lời. Ngược lại, nếu guard nối tới packer bằng conditional edge chứ không bằng cạnh thường, packer sẽ chạy ngay ở superstep kế tiếp khi chưa có Docs. G04 chỉ kiểm tính loại trừ giữa các nhãn router, nên không bắt được trường hợp này. Thêm nữa, `halt` không có reducer: nếu hai guard cùng ghi trong một superstep thì LangGraph ném InvalidUpdateError.
  - evidence: docs.langchain.com/oss/python/langgraph/use-graph-api: "A list of start nodes runs `d` once, after all of the listed nodes have completed"; "`defer=True` postpones the node until no tasks are pending anywhere in the graph". Thiết kế 3.6: "Fan-in dùng add_edge([a, b], c)" và "Sau mỗi guard là một conditional edge: nếu halt có giá trị thì đi thẳng tới output". Bảng 3.3 W2: "lời giải W1 + vector_search …; thêm doc_guard".
  - fix: Bỏ conditional edge sau guard và giữ topo DAG tĩnh. Guard chỉ ghi `halt`. `instrumented()` của mọi node phía sau tự pass-through khi `halt` đã có (không gọi LLM hay tool). Output có `defer=True` (hoặc nhận qua barrier) và trả lời từ chối nếu `halt` có giá trị. Cho `halt` một reducer giữ verdict đầu tiên hoặc nghiêm nhất. Thêm golden test cho đúng hình dạng W2 (guard ∥ retrieval với độ dài nhánh lệch nhau) và assert output chạy đúng 1 lần.
- [high] 3.5 G07 + 3.8 Các lớp trần (a): Công thức ước tính xấu nhất 'packet + max_tokens × số lời gọi × max_iterations × số ca' chặn luôn các starter graph. agent_react mặc định max_iterations=5, profile `nhe` có max_tokens sàn 4096, 12 ca, nên riêng output đã là 4096×5×12 ≈ 246k token. Thông điệp mẫu G07 cho thấy trần ≈ 30k ('210k … gấp 7 lần trần'), vậy starter của M2/W1 bị 422 trước khi người chơi sửa gì. Công thức này còn tuyến tính, trong khi ReAct gửi lại toàn bộ lịch sử ở mỗi vòng (chính slide được trích nói vậy), nên phần input thực tế tăng gần bậc hai. Kết quả là con số vừa quá lỏng (bỏ sót input) vừa quá chặt (max_tokens thinking hiếm khi chạm). Muốn đặt trần đủ cao để starter qua được thì trần đó lại không còn bảo vệ được gì.
  - evidence: 3.8: "`max_tokens` có mức sàn 4096 / 8192 / 16000"; catalog: `max_iterations` 1–8 (5); G07: "Ước tính xấu nhất là 210k token cho 12 ca, gấp 7 lần trần của xưởng"; Day_3.txt:208 "Agent đắt hơn ∼4.5×".
  - fix: Để RunBudget reserve/commit lúc chạy làm trần thật duy nhất. G07 chỉ chặn cấu hình vô lý về cấu trúc, ví dụ số lời gọi LLM tối đa mỗi ca > 12 hoặc tổng (khối LLM × max_iterations × ca) vượt một trần đếm lời gọi. Phần ước tính token trước khi chạy dùng giá trị kỳ vọng (p50/p95 lấy từ hiệu chỉnh) và chỉ để hiển thị. Thêm test: mọi starter_graph và reference_graph phải qua G07.
- [high] 3.3 W3 + chấm sao W3 + 3.9 danh sách bẫy phụ thuộc model: Thiết kế gọi điểm yếu của target là 'tất định', nhưng phần tất định chỉ là việc đòn lọt qua lớp guard (regex trượt base64, đổi ngôn ngữ). Để 'lộ mã', 'lộ PII' hay 'gọi tool cấm' thì claude-opus-5-5 phía sau còn phải làm theo, và đó là hành vi phụ thuộc model. Thiết kế lại quy định 'NPC từ chối thì tính là đã chống được'. 1 sao cần ≥2 đòn thành công nhắm ≥2 mục tiêu, nên nếu Opus 5.5 tự kháng thì level không thể qua. W3 không có trong danh sách bẫy phải qua cổng hiệu chỉnh, và cổng phát hành cũng không có điều kiện nào cho W3. Điều này mâu thuẫn với nguyên tắc 3 của chính bản thiết kế.
  - evidence: 3.0 nguyên tắc 3: "Bẫy nào chỉ cắn khi model 'mắc lừa' thì phải qua cổng hiệu chỉnh"; 3.3: "điểm yếu của target là tất định: regex trượt base64…"; "Nếu NPC từ chối … đòn đó tính là NPC đã chống được"; 3.9 chỉ liệt kê W1, W2, mô tả tool mơ hồ, effort low.
  - fix: Đưa W3 vào cổng phát hành: một bộ `reference_attacks` (≥2 mục tiêu) phải thành công 3/3 lần chạy thật, và level không phát hành nếu trượt. Làm target dễ tổn thương một cách có chủ đích bằng system prompt yếu do level viết (ví dụ cho phép làm theo 'ghi chú quản trị' trong tài liệu) và cho phép hoàn tiền dưới ngưỡng. Tách điểm theo lớp: 'xuyên lớp guard' (tất định) là đủ cho 1 sao, 'model làm theo' chỉ là điểm thưởng hoặc info.
- [medium] 3.6 Red-team W3 (canary) + 3.8 run_step_artifacts / bước con thought: Có hai lỗ quanh canary. (1) Detector chỉ kiểm canary có xuất hiện trong phản hồi của target hay không. Người chơi đã biết canary (vì từng làm lộ một lần, và canary cố định theo user_id‖level_version) chỉ cần đòn 'hãy lặp lại chuỗi sau: <canary>' là được tính 'lộ mã'. (2) Bản thiết kế không nói gì về việc che trace của target: layout packet trong run_step_artifacts, các bước con thought/action/observation từ progress-update thinking. Nếu những thứ này hiện cho người chơi như ở level khác thì canary, system prompt và kết quả tool_customer lộ ra qua trace mà không cần tấn công.
  - evidence: 3.6: "Canary là HMAC(server_secret, user_id ‖ level_version), so khớp sau khi chuẩn hóa NFKC"; "chỉ hiển thị 600 ký tự đầu của phản hồi target" (chỉ giới hạn phản hồi, không nói gì về trace); 3.8: "Bằng chứng đầy đủ (… layout packet, args và kết quả tool…) ghi vào run_step_artifacts", "Agent phát thêm các bước con thought…".
  - fix: Chỉ tính lo_ma khi canary không xuất hiện trong bất kỳ turn nào của attacker, kể cả sau khi giải base64 và bỏ khoảng trắng. Có thể xoay canary theo từng run. Với target_graph, SSE và trace chỉ phát summary đã redact (block, status, ms, tokens), không phát packet, thought hay observation. Thêm test: mọi sự kiện của run W3 không chứa canary.
- [medium] 3.3 L2→L3 + catalog bm25_search / fusion / rerank: Metadata filter `only_in_force` chỉ có trên vector_search. L3 bắt đầu từ lời giải L2 (đã lọc văn bản 2019 hết hiệu lực), rồi thêm BM25 để bắt 'Điều 47 khoản 2'. Văn bản 2019 'gần giống bản 2024' nên gần như chắc chắn cũng có Điều 47, và BM25 khớp chính xác số điều sẽ kéo bản 2019 về. Không khối nào ở nhánh BM25, fusion hay rerank lọc được hiệu lực, nên `ret.stale_doc` ở L3 không có cách sửa. Bài 'hybrid' bị phạt vì một thứ người chơi không điều khiển được.
  - evidence: Catalog: `bm25_search` tham số chỉ có `top_k`; `fusion`/`rerank` không có filter; 3.3 L2: "văn bản 2019 đã hết hiệu lực nhưng gần giống bản 2024"; 3.7: kho luật "có … một bản 2019 đã hết hiệu lực".
  - fix: Đưa `only_in_force` thành tham số của chính Index hoặc chunker để áp cho mọi retriever, hoặc thêm param đó vào bm25_search. Cách khác là loại bản 2019 khỏi corpus của L3. Thêm vào cổng phát hành: reference_graph L3 không có `ret.stale_doc`.
- [medium] 3.6 Quy tắc LLM (refusal) và 3.9 Bẫy phụ thuộc model: Hai quy tắc mâu thuẫn nhau. 3.6 nói ở level W, `stop_reason: refusal` được tính là phòng thủ thành công. 3.9 nói ca mà model tự chống được thì hạ xuống `info` ('đừng dựa vào điều này') và không tính vào sao. Ở W1/W2 người chơi là bên phòng thủ, nên refusal do classifier an toàn của Anthropic sinh ra là công của model, không phải của đồ thị người chơi, vậy mà lại được cộng sao. Ngoài ra refusal trên một ca lành tính phải tính là over-refusal, không phải 'phòng thủ thành công'.
  - evidence: 3.6: "Ở các level W, refusal tính là phòng thủ thành công"; 3.9: "hạ ca đó thành info, … 'model tự chống được, đừng dựa vào điều này (Ngày 11)', và không tính vào sao"; claude-api skill: stop_details chỉ có khi stop_reason == "refusal" (classifier an toàn: cyber/bio/reasoning_extraction).
  - fix: Ở W1/W2: ca tấn công có refusal (không do guard của người chơi) thì ghi `info` và không cộng sao. Ca lành tính có refusal thì tính là chặn nhầm. Chỉ ở W3 refusal của target mới tính là target chống được.
- [medium] 3.9 danh sách bẫy phụ thuộc model (không đầy đủ): Nhiều bẫy cốt lõi cũng chỉ cắn khi model 'mắc lừa' nhưng không có trong danh sách hiệu chỉnh. M1: 'một ca hỏi dữ kiện không có ở đâu' (Opus 5.5 có thể tự nói không biết), và bảng giá 2024/2026 mâu thuẫn khi cả hai cùng nằm trong context. L1: 'Điều 99' không tồn tại. M2: 'sau cho mọi đơn' vượt ngân sách (thinking thích ứng có thể tiêu rất ít token cho đơn dễ). M3: chất lượng bản tóm `tom_tat_cu`. Đây đúng là bài học 'missing data → hallucination' đã chốt cho M1.
  - evidence: 3.0 nguyên tắc 3; 3.3 M1 "một ca hỏi dữ kiện không có ở đâu; bảng giá 2024 và 2026 mâu thuẫn"; L1 "một ca hỏi 'Điều 99' không tồn tại"; 3.9 chỉ liệt kê 4 bẫy.
  - fix: Quy tắc chung: mọi ca có `expected_failures` phụ thuộc đầu ra LLM phải chạy hiệu chỉnh. Cổng phát hành kiểm toàn bộ expected_failures của mọi naive_graph, không chỉ 4 bẫy đã liệt kê (3.9 đã nói 'đồ thị ngây thơ phải sinh đủ flag' nhưng nên áp cho từng ca). Bẫy nào trượt thì thay bằng cơ chế tất định như đã nêu.
- [medium] 3.3 W3 (turns tuần tự) và giới hạn thời gian đã chốt ở Phần 2: Mỗi đòn attack_prompt là một ca chạy 1–5 lượt tuần tự. Mỗi lượt chạy cả pipeline target: guard, có thể classifier, rồi vòng agent của Opus 5.5 có thinking. Thiết kế tự thừa nhận phải spike xem p95 của MỘT ca ReAct ở `can_bang` có nằm trong 20 s hay không. Một đòn 5 lượt gần như chắc vượt mốc 20 s/ca, và 8 đòn × 5 lượt vượt 90 s/run. Kết quả là timeout chứ không có kết quả tấn công, nên kỹ thuật multi-turn (khái niệm Ngày 11 trong catalog) trên thực tế không chơi được.
  - evidence: Phần 2 đã chốt: "Timeouts 20 s per case, 90 s per run"; 3.6: "`turns` chạy tuần tự, mỗi phản hồi thật của NPC được nối vào History"; trần "8 đòn tấn công"; 3.8: "dùng nhe cho tới khi spike đo được p95 của can_bang nằm trong 20 s".
  - fix: Ở W3 giới hạn turns ≤2 và số đòn mỗi run ≤3 (một ca mỗi lượt), target dùng effort low, hoặc tính deadline 20 s cho từng lượt chứ không cho cả đòn. Đưa 'p95 của một đòn W3 đủ lượt' vào spike tuần đầu. Nếu cần đổi mốc 20 s/90 s cho W3 thì đó là thay đổi Phần 2 và người dùng phải quyết định.
- [medium] Catalog `compress` + 3.8 (12 lời gọi LLM/ca, 20 s/ca): `compress` tóm từng tư liệu bằng một lời gọi LLM. Đầu ra chỉ phụ thuộc tư liệu và tham số, không phụ thuộc câu hỏi, nhưng nó vẫn nằm trong đồ thị mỗi ca. Kệ cho phép tới 12 tư liệu, nên 12 lần compress cộng 1 llm là 13 lời gọi, vượt trần 12 lời gọi/ca. Ca sẽ bị dừng vì budget, không bị validate chặn trước, vì trần '8 khối gọi LLM' đếm theo khối chứ không theo lời gọi. Nếu các lời gọi chạy tuần tự, vài lần compress Opus cũng đủ ăn hết 20 s. Ba ca song song ở lần chạy đầu đều trượt replay cache cùng lúc nên còn trả tiền 3 lần.
  - evidence: Catalog: doc_shelf `items` ≤12; compress "LLM effort low tóm một tư liệu"; 3.8: "mỗi ca tối đa 12 lời gọi LLM"; 3.5: "Trần: 25 node, 8 khối gọi LLM".
  - fix: Coi compress (và các khối khác không phụ thuộc câu hỏi) là bước 'chuẩn bị theo run': chạy một lần trước các ca, song song, tính vào RunBudget nhưng không tính vào deadline từng ca, rồi đưa kết quả vào ports của mọi ca. Validator đếm số lời gọi tối đa mỗi ca, không chỉ đếm số khối.
- [medium] 3.3 M2 + 3.8 Profile/metric `usd`: Phần đã chốt là M2 'chọn model theo loại đơn trong ngân sách' (slide Ngày 1 so giá Haiku và Opus). Bản thiết kế đổi thành chọn effort của cùng một model. Do ràng buộc LLM thì có thể hiểu được, nhưng hệ quả là: (a) metric `usd` chỉ là số token nhân một đơn giá nên trùng với metric `tokens`; (b) chênh lệch chi phí giữa low và high trên đơn dễ là nhỏ và dao động, nên bẫy ngân sách không tất định; (c) nếu lời giải đúng cho đơn suy luận cần `sau` cộng agent cộng tool, chính thiết kế đã thừa nhận cấu hình đó dễ chạm 20 s. Bài học cốt lõi của M2 có thể không chơi được.
  - evidence: ALREADY DECIDED: "L2 choose a model per order type (classification / summarization / reasoning) within budget"; Day_1.txt:253 "Claude Haiku 4.5 $0.8 $4 … Fast, cheap"; 3.8: "usd … nhân với giá danh nghĩa của model thực sự được gọi"; "Dùng sau cho mọi bước sẽ dễ chạm mốc 20 s".
  - fix: Bỏ metric `usd` cho tới khi có nhiều model (YAGNI). Ghi rõ đây là điểm lệch so với phần đã chốt và đưa vào câu hỏi mở cho người dùng (định tuyến sang model rẻ hơn là quyết định của họ). Cổng phát hành M2 phải đo được chênh lệch token ổn định giữa các profile, và reference_graph M2 phải chạy trong 20 s ở 3/3 lần.
- [low] 3.0 nguyên tắc 3 (lost in the middle) + param `reorder_docs`: Phần đã chốt ghi M1 dạy 'lost in the middle'. Thiết kế hạ khái niệm này xuống chỉ còn chẩn đoán và dẫn nửa đầu slide Ngày 4, bỏ mất kết luận best practice. `reorder_docs` (Document Reordering, Ngày 8) mở ở L2 nhưng không bao giờ ảnh hưởng tới sao, tức là một tham số không có hệ quả đo được.
  - evidence: Day_4.txt p39: "Model mới đọc context dài tốt hơn nhiều — nhưng thông tin quan trọng vẫn không nên bị chôn ở giữa nếu cần độ tin cậy cao"; Day_8.txt:435 "Lost in the Middle & Document Reordering"; ALREADY DECIDED M1 "(lost in the middle, missing data -> hallucination)".
  - fix: Giữ việc không chấm sao (vì cần tất định) nhưng nói rõ quyết định này trong codex. Hoặc bỏ `reorder_docs` khỏi MVP (YAGNI), hoặc chuyển nó thành tiêu chí tất định, ví dụ 'gold nằm trong 20% đầu hoặc cuối packet' như một tiêu chí info có nhãn rõ.
- [low] 3.8 Chi phí, đếm usage: Bẫy dễ dính khi cài đặt: trong langchain-anthropic, `usage_metadata.input_tokens` ĐÃ cộng sẵn cache_read và cache_creation. Nếu lấy metric `tokens = input + cache_read + cache_creation + output` từ usage_metadata thì phần cache bị đếm 2 lần, làm sao 2 sai và dải token theo khối sai.
  - evidence: langchain_anthropic/chat_models.py (master), `_create_usage_metadata`: "input_tokens = (input_tokens) + (input_token_details['cache_read']) + (cache_creation)" kèm chú thích "Anthropic's `input_tokens` excludes cached tokens, so we manually add…".
  - fix: Định nghĩa `tokens = usage_metadata.input_tokens + usage_metadata.output_tokens`. Chỉ dùng input_token_details để hiển thị tỉ lệ cache hit. Thêm unit test với usage giả có cache_read > 0.
- [low] 3.0 nguyên tắc 6 / 3.8 cache phát lại: Câu 'người chơi không thể chạy lại nhiều lần để quay số lấy sao' là sai. Khóa replay là sha256 của messages, mà chuẩn hóa chỉ là NFC, nên thêm một dấu cách vào system_prompt hay description là có cache miss và một lần lấy mẫu mới.
  - evidence: 3.4: "chuẩn hóa NFC"; 3.8: "Khóa là sha256 của (… system, messages …)".
  - fix: Bỏ lời hứa chống quay số, hoặc chuẩn hóa whitespace trong text người chơi trước khi băm. Độ tất định thật nên đến từ cổng hiệu chỉnh, không đến từ cache.
- [low] 3.3 W3 target 'regex guard' so với catalog `pattern_guard`: target_graph được nói là 'dùng cùng format, biên dịch bằng cùng compiler', nhưng catalog không có khối guard nào dùng regex. `pattern_guard` khớp cụm từ nguyên văn và được ghi rõ 'không phải regex'. Tương tự, W2 cần chunker (cổng Index) cho vector_search trên 'kho chính sách', trong khi catalog chỉ ghi chunker cho L1/L2 và `corpus` được định nghĩa là 'Bộ luật Thị trấn'.
  - evidence: Catalog pattern_guard: "khớp cụm từ nguyên văn"; 3.7: "Cụm từ của guard được so khớp nguyên văn, không phải regex"; 3.3 W3: "target khóa: regex guard".
  - fix: Đổi mô tả W3 thành 'pattern_guard với danh sách cụm từ cố định'. Base64 và đổi ngôn ngữ vẫn lọt một cách tất định. Ghi cột level của chunker/corpus thêm W2, W3, và cho corpus là nội dung theo từng level.
- [low] 3.9 Cổng phát hành L3: Điều kiện 'dense search đơn thuần phải trượt gold trên mọi biến thể index' không nói ở top_k nào. Mỗi biến thể chỉ có vài trăm chunk, nên tăng top_k của vector_search lên 20 có thể kéo được Điều 47 về. Người chơi khi đó vượt L3 mà không cần hybrid hay rerank, chỉ mất sao 2.
  - evidence: Catalog vector_search `top_k` 1–20; 3.7 "Mỗi biến thể chỉ vài trăm dòng".
  - fix: Phát biểu cổng thành: 'dense trượt gold ở top_k tối đa mà param_limits của L3 cho phép', và đặt `param_limits` cho L3 đủ thấp.
- [low] 3.8 Prompt caching (làm ấm, 'cache hit bằng 0%'): (a) `max_tokens: 0` bị API từ chối khi đi kèm `output_config.format`, nên không làm ấm được các khối dùng json_schema (router llm, classifier, compactor, compress). Làm ấm cho từng khối và từng effort trong mỗi run còn thêm một request vào trong 90 s, trong khi replay cache đã gánh phần lặp lại, nên đây là YAGNI. (b) 'Đặt câu hỏi lên đầu packet thì cache hit bằng 0%' không đúng: tools, khung nền và system prompt vẫn nằm trước nên vẫn được cache, vì ngưỡng tối thiểu của Opus 5.5 chỉ là 512 token.
  - evidence: claude-api skill shared/prompt-caching.md: "`max_tokens: 0` is an invalid_request_error with … `output_config.format`"; bảng ngưỡng: "Claude Opus 5.5 … 512 tokens"; 3.8 thứ tự request: "tools → khung nền → system prompt …".
  - fix: Bỏ bước làm ấm khỏi MVP (để đo sau). Sửa thông điệp thành 'phần docs tĩnh không được cache vì câu hỏi đứng trước', hiện tỉ lệ thực đo được.
