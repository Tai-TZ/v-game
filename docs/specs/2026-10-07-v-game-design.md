# V-Game: đặc tả thiết kế tổng hợp

- **Ngày:** 2026-10-07
- **Trạng thái:** vòng chơi (Phần 1), kiến trúc (Phần 2), cơ chế học/ôn/brainstorm và theme packs đã được chủ dự án duyệt. Hệ khối (Phần 3) là bản thiết kế chưa triển khai. Hướng gameplay "Xưởng Đồ Chơi Trực Ca" đang chờ duyệt.
- **Tài liệu chi tiết:**
  - [Phần 3: Hệ khối và cách dựng agent từ khối](../design/part-3-block-system.md), kèm các vấn đề agent phản biện yêu cầu sửa
  - [Hướng gameplay đề xuất: Xưởng Đồ Chơi Trực Ca](../design/gameplay-direction.md)
  - ADR: [0001 Frontend stack](../adr/0001-frontend-stack.md) · [0002 Theme packs](../adr/0002-theme-packs.md) · [0003 Backend stack](../adr/0003-backend-stack.md)

## 1. Mục tiêu

V-Game là game web giáo dục cho chương trình đào tạo AI 20K. Chủ đề của game chính là các bài học AI trong chương trình. Người chơi đi trong một campus 3D nhẹ, gặp NPC và lắp agent AI từ các khối. Backend biên dịch các khối thành agent LangGraph và chạy thật.

Mục tiêu đã chốt:
- Gần như ai cũng muốn chơi, và game khơi được tò mò.
- Chơi xong, người học hiểu thật.
- Dùng được cho cả lần học đầu lẫn ôn tập.
- Giúp người học brainstorm cho dự án của chính họ.

## 2. Người dùng và vai trò

| Vai trò | Làm gì |
|---|---|
| Học viên (student) | chơi level, chạy agent, đọc chẩn đoán, ôn tập, brainstorm ý tưởng dự án, dạy lại cho NPC |
| Giáo viên (teacher) | duyệt nội dung level do AI sinh từ slide trước khi phát hành, nhận xét thẻ ý tưởng, giao bài ôn nhanh |

Ban tổ chức chương trình là đối tượng cần thuyết phục ở bước sau (mục 3), chưa phải một vai trò trong hệ thống.

## 3. Lộ trình

1. Làm thành capstone trước, rồi pilot với một lớp và đo trước/sau (pre/post).
2. Dùng kết quả pilot để đề xuất ban tổ chức đưa game vào toàn chương trình.

Nhóm gồm chủ dự án và Claude. Không có deadline, nhưng cần có thứ cho giảng viên xem càng sớm càng tốt. Vì vậy thứ tự làm là:
1. làm hoàn thiện một vertical slice cho khu "Thư viện" (RAG) và deploy sớm;
2. mở rộng tới MVP 3 khu × 3 level.

## 4. Yêu cầu capstone và chỗ thiết kế đáp ứng

| Yêu cầu của khóa | Chỗ đáp ứng |
|---|---|
| Web đã deploy | SPA + API FastAPI, deploy từ vertical slice (mục 8) |
| ≥2 vai trò | học viên và giáo viên (mục 2) |
| Agentic workflow có state và tool use | đồ thị khối biên dịch thành LangGraph với `CaseState`; khối `agent_react` gọi tool chạy trên fixture (Phần 3, mục 3.6–3.7) |
| HITL cho hành động rủi ro | giáo viên duyệt level trước khi phát hành; tùy chọn `InterruptApprover` dùng LangGraph `interrupt()`, checkpointer Postgres và endpoint resume (Phần 3, mục 3.6). Chế độ sandbox cho HITL đang chờ quyết định (mục 13) |
| Xử lý lỗi | validation gom mọi lỗi vào một phản hồi 422 có thông điệp tiếng Việt; mỗi bước luôn phát `step.finished` với status ok, timeout, cancelled, budget, llm_error hoặc refusal; chỉ retry 429/5xx/529 khi deadline còn đủ; vượt trần `RunBudget` thì các ca còn lại thành `skipped_budget` kèm lời giải thích, không trả lỗi 500 (vượt ngân sách sao vẫn cho chạy, chỉ mất sao 2) |
| Eval/benchmark | chấm sao trên test set của NPC (có ca ẩn, ca bẫy); evaluator tách khỏi engine; cổng phát hành chạy model thật 3/3 lần; pilot đo pre/post |
| Giám sát độ trễ, chi phí, lỗi | Langfuse callback mang `{run_id, case_id, node, block}`; usage token theo node, ca và run; thời gian (ms) từng bước; tỉ lệ cache hit |

## 5. Nội dung

- Bài học được lọc theo chủ đề, không bám theo 15 ngày học, rồi chia vào 6 khu. Chủ đề chỉ có trên bài giảng thì đưa vào hội thoại NPC.
- MVP gồm 3 khu × 3 level. Level 3 của mỗi khu là một **sự cố** làm vỡ lời giải của level trước.
- Một level gồm nội dung JSON và code cơ chế theo loại level (`context-packing`, `rag`, `defense`). AI sinh nội dung level từ slide, giáo viên duyệt.

| Khu (MVP) | Chủ đề | Level (mã trong Phần 3) |
|---|---|---|
| Chợ model | token, context, chọn model | M1 đóng gói context · M2 phân luồng theo loại đơn · M3 sự cố lịch sử hội thoại |
| Thư viện | RAG | L1 grounding · L2 chunk, top-k, metadata filter · L3 sự cố hỏi theo số điều (BM25, hybrid, rerank) |
| Tháp canh | guardrails | W1 guard đầu vào và HITL · W2 injection gián tiếp, PII · W3 đổi vai red-team |

Tài liệu nguồn chưa đặt tên cho 3 khu còn lại.

## 6. Vòng chơi (Phần 1, đã duyệt)

1. Gặp NPC.
2. NPC đưa vấn đề kèm mục tiêu đo được.
3. Lắp agent trên bàn thợ (workbench).
4. Chạy agent **thật** trên test set của NPC.
5. Chấm sao: sao 1 cho mục tiêu chính, sao 2 cho việc nằm trong ngân sách token, sao 3 cho các câu bẫy.
6. Chẩn đoán dựa trên bằng chứng của lần chạy, kèm 3 gợi ý tăng dần.
7. Mở khóa nội dung mới; codex liên kết tới slide.

Hình thức bàn thợ chưa chốt. Phần 3 thiết kế canvas nối khối tự do. Đề xuất "Xưởng Đồ Chơi Trực Ca" thay màn chính bằng bàn thợ có khe cố định và các món đồ chơi, còn React Flow lùi thành chế độ "Bản vẽ" (mục 13).

## 7. Cơ chế học, ôn và brainstorm (đã duyệt)

**Học lần đầu**
- Mọi lần chạy đều theo nhịp đoán → chạy → giải thích (predict → run → explain).
- Một bài có nhiều lời giải hợp lệ; người chơi xem histogram lời giải của cả lớp, đã ẩn danh.
- Dạy lại cho NPC (teach-back), chấm theo rubric.

**Ôn tập**
- Campus xuống cấp về hình ảnh khi khái niệm bị quên dần.
- Ca trực hằng ngày 5 phút, xen kẽ sự cố của nhiều khái niệm, lịch do FSRS (py-fsrs) xếp.
- Ôn bằng biến thể level, không chơi lại y nguyên.
- Codex có mục "luyện lại".
- Giáo viên giao bài ôn nhanh.

**Brainstorm**
- Mỗi khu có một "Phòng ý tưởng". Người học làm ra một thẻ ý tưởng cho dự án của mình, và giáo viên nhận xét được trên thẻ.

## 8. Kiến trúc (Phần 2, đã duyệt)

### 8.1 Frontend

Vite + React 19 + TypeScript, dạng SPA. React Router 8 ở framework mode với `ssr: false`, riêng landing page được prerender. Cảnh 3D dùng react-three-fiber + drei; state dùng Zustand; React Flow làm chế độ xem "blueprint" dự phòng. Xem [ADR 0001](../adr/0001-frontend-stack.md).

### 8.2 Backend

FastAPI + Pydantic + SQLAlchemy 2 + Alembic; PostgreSQL với pgvector; Redis; LangGraph; Langfuse. Xem [ADR 0003](../adr/0003-backend-stack.md).

### 8.3 Run và sự kiện

- Run chạy nền, không phụ thuộc kết nối SSE. Sự kiện được lưu lại và phát lại được.
- Sự kiện SSE: `run.started`, `step.started`, `step.finished`, `case.graded`, `run.scored`, `run.diagnosis`, `run.finished` / `run.failed`.
- Giới hạn thời gian: 20 s mỗi ca, 90 s mỗi run.
- Server tính tiến độ.
- Engine chỉ phát dữ kiện trung tính. Evaluator (Phần 4, chưa có tài liệu) so với gold sau khi ca kết thúc. Vị trí gold không bao giờ đi qua SSE khi run đang chạy.

### 8.4 LLM

- Claude qua langchain-anthropic, model mặc định `claude-opus-5-5`.
- Độ sâu suy luận điều khiển bằng effort. Không ép `tool_choice`, không prefill, có dùng prompt caching.
- Phần 3 chi tiết thêm: 3 profile `nhe` / `can_bang` / `sau` là effort low / medium / high của cùng model; không truyền temperature vì Opus 5.5 trả 400; có cache phát lại phản hồi LLM để cùng đồ thị cho cùng kết quả.

### 8.5 Hệ khối (Phần 3, chưa triển khai)

- 29 khối MVP, trong đó 6 khối là tool chạy trên fixture.
- Registry khai báo bằng Pydantic; `GET /blocks` trả JSON Schema để client sinh form và kiểu TypeScript.
- Graph JSON đi qua validation (mã lỗi G01–G07) rồi biên dịch thành LangGraph.
- Nguyên tắc: chặn ít, cho chạy nhiều; bẫy phải cắn bằng cơ chế tất định; dữ liệu chấm (`GradingSpec`) tách khỏi phần khối được thấy (`PublicLevel`); không gợi ý gì trước khi chạy.

Chi tiết và 16 vấn đề phản biện (3 high, 7 medium, 6 low): [part-3-block-system.md](../design/part-3-block-system.md).

## 9. Hiệu năng

**Client (đã duyệt)**
- Campus dạng diorama isometric 3D nhẹ, đạt 60 FPS trên laptop dùng GPU tích hợp.
- Dưới 100 draw call; lighting bake; instancing.
- CI có test FPS.
- Lời gọi AI không bao giờ chặn khung hình.
- Theme pack lazy-load, không làm tăng bundle.

**Server (Phần 2 và Phần 3)**
- 20 s mỗi ca, 90 s mỗi run; tối đa 3 ca song song; tối đa 12 lời gọi LLM mỗi ca.
- `RunBudget` reserve trước, commit sau mỗi lời gọi; semaphore giới hạn số lời gọi Anthropic đồng thời trên mỗi worker.
- Trần đồ thị: 25 node, 8 khối gọi LLM.
- Retrieval: KNN chính xác trên pgvector (mỗi biến thể index chỉ vài trăm dòng); BM25 trong RAM; embedding và rerank chạy ONNX trên CPU.

Đề xuất gameplay (chờ duyệt) thêm: `frameloop='demand'` khi lắp ráp, AdaptiveDpr, dưới 80 draw call, không dùng Rapier, không postprocessing trên GPU tích hợp.

## 10. Bảo mật và an toàn

- Không lưu secret trong repo. `.env*` bị gitignore, trừ `.env.example`. Repo có cấu hình Gitleaks (`.gitleaks.toml`).
- Không chạy code của người chơi. Người chơi chỉ nhập enum, số và text có giới hạn độ dài. Text được ghép vào message như dữ liệu, không qua `str.format` hay Jinja.
- Payload đồ thị ≤64 KB, UTF-8 hợp lệ, chuẩn hóa NFC, không có NUL hay ký tự bidi. Khối phải nằm trong whitelist và đã mở khóa.
- Guard của người chơi so khớp cụm từ nguyên văn, không phải regex, nên không có ReDoS. Regex chỉ đến từ level đã được duyệt.
- Tool chạy trên snapshot fixture bất biến; tool ghi chỉ ghi vào ledger giả. Compiler không bao giờ thêm server tool.
- Truy vấn retrieval chạy bằng role DB chỉ có quyền SELECT; mọi giá trị là bind param.
- Egress chỉ tới Anthropic, Langfuse, và API embedding nếu dùng.
- Đáp án nằm trong `GradingSpec`, không vào engine. Ca ẩn và ca bẫy không hiện cho người chơi.
- W3: canary là HMAC theo người chơi; chỉ hiện 600 ký tự đầu của phản hồi target; rate limit riêng; log mọi đòn. Phản biện chỉ ra hai lỗ quanh canary và trace của target, cần sửa trước khi code.
- Histogram lời giải của lớp được ẩn danh.
- Theme campus chỉ dùng cho prototype nội bộ (mục 11).

## 11. Theme packs (quyết định C)

- Có hai theme: `town` trung tính và một theme campus lấy cảm hứng từ một trường đại học có thật.
- Theme chỉ là dữ liệu: manifest, CSS và assets. Người chơi đổi theme bằng một nút. Theme được lazy-load nên bundle không lớn thêm.
- Tên thương hiệu không bao giờ nằm trong code lõi; CI kiểm tra điều này. Tài liệu này cũng không ghi tên thương hiệu.
- NPC là người hư cấu.
- Theme campus dùng hình ảnh công khai trên web của trường và một bộ design token không chính thức, chỉ cho prototype nội bộ. Cần có phép của chủ thương hiệu trước bất kỳ lần deploy công khai nào.

Xem [ADR 0002](../adr/0002-theme-packs.md).

## 12. Phạm vi

| Giai đoạn | Gồm |
|---|---|
| Vertical slice | khu Thư viện (RAG) làm hoàn thiện, deploy sớm để giảng viên xem. Đề xuất gameplay chọn Vòm Sao (L2 sang L3) làm prototype đầu tiên |
| MVP | 3 khu × 3 level (mục 5); 29 khối của Phần 3; vai trò học viên và giáo viên; theme `town` và theme campus (campus chỉ dùng nội bộ) |
| Ngoài MVP | 3 khu còn lại; deploy công khai theme campus khi chưa có phép; nếu đề xuất gameplay được duyệt: các mục nó đề nghị cắt (node editor tự do làm màn chính, mini-game tay, LLM sinh tấn công, 120 NPC với A*...) |

Tài liệu nguồn chưa xếp giai đoạn cho:
- các cơ chế ôn tập và brainstorm (mục 7);
- việc ánh xạ profile sang model khác. Phần 3 để đây là quyết định sau, và nếu đổi thì phải hiệu chỉnh lại các ngưỡng; điểm này gắn với M2 ở mục 13.1.

## 13. Quyết định đang chờ

### 13.1 Danh sách

1. **Hướng gameplay "Xưởng Đồ Chơi Trực Ca":** bàn thợ đồ chơi thay node editor tự do làm giao diện chính ([gameplay-direction.md](../design/gameplay-direction.md)).
2. **Câu hỏi mở của Phần 3:**
   - chế độ sandbox cho HITL (hiện tại run chấm điểm dùng `ScriptedApprover`, còn `InterruptApprover` là tùy chọn);
   - có cho fallback khi gặp refusal trong run chấm điểm không (hiện tắt `fallbacks` sang model khác để giữ tính tất định);
   - bàn thợ dùng canvas tự do hay dùng khe cố định làm phương án dự phòng.
3. **Sửa các vấn đề của agent phản biện trước khi code engine** (cuối [part-3-block-system.md](../design/part-3-block-system.md)). Hai điểm trong đó cần chủ dự án tự quyết:
   - M2 đang lệch phần đã chốt: từ "chọn model theo loại đơn" thành "chọn effort của cùng một model";
   - nếu W3 cần nới mốc 20 s/90 s thì đó là thay đổi của Phần 2.
4. **Phép dùng thương hiệu** cho theme campus, cần có trước khi deploy công khai.
5. **Cần làm rõ:**
   - Phần 3 cho Thư viện mở sau M1, trong khi vertical slice làm Thư viện trước. Cần chốt người chơi vào slice thế nào khi chưa có Chợ model.
   - Vertical slice gồm những level nào của Thư viện.
   - Cơ chế ôn tập và brainstorm thuộc vertical slice, MVP hay sau MVP.

### 13.2 Điểm lệch giữa đề xuất gameplay và Phần 3

Nếu duyệt hướng gameplay mới, cần thống nhất các điểm sau trước khi code.

| Chủ đề | Phần 3 | Đề xuất gameplay |
|---|---|---|
| Mã level | M1–M3, L1–L3, W1–W3 | Chợ/Thư viện/Tháp L1–L3; Tháp L3 nhắc "L7+L8" |
| Tên khối | `vector_search`, `bm25_search`, `fusion`, `rerank`, `history_compactor`, `pattern_guard`, `injection_classifier`, `doc_guard`, `pii_filter` | `retriever`, `reranker`, `compactor`, `input_guard`, `spotlighting`, `output_guard` |
| Tham số packer | `token_budget`, `order`, `on_overflow` | `items`, `budget`, `output_reserve` |
| Schema cho client | JSON Schema sinh từ Pydantic; RJSF và json-schema-to-typescript | "zod schema engine đang dùng" |
| Chọn model (Chợ L1–L2 / M1–M2) | 3 mức effort của cùng `claude-opus-5-5` | model Nhỏ/Vừa/Lớn; gửi thùng tới "model rẻ" |
| Temperature | không truyền (Opus 5.5 trả 400) | "temperature 0" |
| Guard ở Tháp L1 / W1 | `pattern_guard` khớp cụm từ nguyên văn; người chơi không viết regex | "Lưới regex", "Đúc khuôn" sinh regex nháp; thêm "Cân", "Rào chủ đề" không có trong catalog |
| Canary | bảng level chỉ đặt canary ở W3 | Tháp L1 đã có agent giữ canary |
| Overlap | các mức tính sẵn {0, 10, 20}% | "Overlap 15%" |
| Trường giữ khi nén lịch sử | quyết định, ràng buộc, đính chính mới nhất, câu hỏi mở | thêm "nguồn", sọt bỏ lời chào, ngăn lưu trữ bản thô |
| Embed lúc chạy | chỉ chữ người chơi viết ở W3 | đèn pin ở Thư viện L1 xoay theo embedding thật của câu gõ vào |
| Hiện gold cho người chơi | chỉ qua chẩn đoán và 3 gợi ý; `case.graded` chỉ mang đạt/trượt theo tiêu chí sao | mỗi case hiện sao vàng (chunk đáp án) kèm hạng thật; `case.graded` thêm `labels` và `extracted` |
| W3 / Tháp L3 | target khóa của NPC; trần 8 đòn (phản biện đề nghị ≤3 đòn, ≤2 lượt) | tấn công chính cấu hình của người chơi; 12 phát; thêm ROT13 |
| Draw call | dưới 100 (đã duyệt) | dưới 80 |
