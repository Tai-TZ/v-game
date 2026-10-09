# V-Game: đặc tả thiết kế tổng hợp

- **Ngày:** 2026-10-07
- **Trạng thái:** vòng chơi (Phần 1), kiến trúc (Phần 2), cơ chế học/ôn/brainstorm và theme packs đã được chủ dự án duyệt. Hệ khối (Phần 3) là bản thiết kế chưa triển khai. Hướng gameplay "Xưởng Đồ Chơi Trực Ca" đang chờ duyệt.
- **Sửa 2026-10-08:** áp dụng [lộ trình v0.4](../design/roadmap-v0.4.md) (các đề xuất "làm ngay" của hai báo cáo nghiên cứu). Các mục đổi: §2, §4 (retry, theo engine §14), §5, §6, §7 (luật thưởng, quỹ chạy thật), §8.4, §8.5 (X11), §9, §10, §12, §13.2 (dòng temperature và embed lúc chạy), §13.3.
- **Tài liệu chi tiết:**
  - [Lộ trình v0.4](../design/roadmap-v0.4.md): quyết định 2026-10-08, xung đột đã gỡ, kế hoạch đợt B
  - [Phần 3: Hệ khối và cách dựng agent từ khối](../design/part-3-block-system.md), kèm các vấn đề agent phản biện yêu cầu sửa
  - [Hướng gameplay đề xuất: Xưởng Đồ Chơi Trực Ca](../design/gameplay-direction.md)
  - [Engine v0.2](../design/engine-v0.2.md) (engine thật của khu Thư viện) · [Frontend architecture](../design/frontend-architecture.md)
  - [Kịch bản](../content/scenarios/overview.md) · [Bản đồ phủ khoá học](../content/course-coverage.md) · [Giáo án Thư viện](../content/lesson-plan-library.md)
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
| Giáo viên (teacher) | duyệt nội dung level do AI sinh từ slide trước khi phát hành, nhận xét thẻ ý tưởng, giao bài ôn nhanh; dẫn buổi học theo giáo án ghép đúng ngày và slide, dùng chế độ máy chiếu và quỹ riêng ([giáo án Thư viện](../content/lesson-plan-library.md)); cấp thêm lời gọi cho học viên (sau khi có mã lớp, lấy từ quỹ máy chiếu) |

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
| Xử lý lỗi | validation gom mọi lỗi vào một phản hồi 422 có thông điệp tiếng Việt; mỗi bước luôn phát `step.finished` với status ok, timeout, cancelled, budget, llm_error hoặc refusal; ~~chỉ retry 429/5xx/529 khi deadline còn đủ~~ (sửa 2026-10-08: không retry 429; 429 hoặc 503 chuyển sang model sau trong chuỗi; chỉ 500 và 502 thử lại một lần trên cùng model, [engine-v0.2 §14](../design/engine-v0.2.md#14-chủ-dự-án-cần-quyết)); vượt trần `RunBudget` thì các ca còn lại thành `skipped_budget` kèm lời giải thích, không trả lỗi 500 (vượt ngân sách sao vẫn cho chạy, chỉ mất sao 2) |
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

**Ba khu còn lại (chốt 2026-10-08, [roadmap-v0.4](../design/roadmap-v0.4.md) Q2, X24):**

| Khu | Trạng thái | Chủ đề | Level (kịch bản) |
|---|---|---|---|
| Phòng chấm | **Khu 4, đã chốt** | đo lường: phân tích lỗi, kiểm định giám khảo LLM, đấu mù | [Sổ lỗi, Giám khảo cũng phải thi](../content/scenarios/grading-room.md); Đấu mù (phác thảo) |
| Trạm vận hành | Ứng viên khu 5 | rate limit, retry, fallback, giám sát, SLO | [Giờ cao điểm](../content/scenarios/rush-hour.md); Phòng điều khiển (phác thảo) |
| Văn phòng một cửa | Ứng viên khu 6 | structured output, thiết kế tool | Phiếu khai (cần spike Flash-Lite bám enum) |

Thứ tự xây (chốt tạm, roadmap Q9): Phòng chấm, Trạm vận hành (cả hai gần như 0 lời gọi), rồi Văn phòng một cửa. Ngoài ra Thư viện có một phòng phụ, [Cổng nạp liệu](../content/scenarios/intake-gate.md) (data pipeline, 0 lời gọi), không phải một khu.

- Level loại `simulation` (chạy ở client, có seed) và `precomputed` (dữ liệu ghi sẵn) được phép cho chủ đề vận hành và dữ liệu, với điều kiện tiêu đề level mang tem "Mô phỏng" hoặc "Dữ liệu ghi sẵn"; sao vẫn tất định (X19).
- **Giám khảo LLM ở Phòng chấm (chốt 2026-10-08, X8):** giám khảo LLM là đối tượng học, người chơi dựng và kiểm nó bằng nhãn người. Sao vẫn tất định, tính bằng độ khớp giữa phán quyết của giám khảo và nhãn người; engine vẫn không dùng giám khảo LLM để chấm sao.
- [Bản đồ phủ khoá học](../content/course-coverage.md) đối chiếu từng ngày học với level. Nó chỉ dùng để kiểm độ phủ và làm giáo án; cấu trúc khu theo chủ đề ở trên giữ nguyên (X17).

## 6. Vòng chơi (Phần 1, đã duyệt)

1. Gặp NPC.
2. NPC đưa vấn đề kèm mục tiêu đo được.
3. Lắp agent trên bàn thợ (workbench).
4. Chạy agent **thật** trên test set của NPC. Mỗi lượt thật tiêu quỹ lời gọi theo ngày (mục 7); lượt đã ghi và kết quả đã lưu thì miễn phí.
5. Chấm sao: sao 1 cho mục tiêu chính, sao 2 cho việc nằm trong ngân sách token, sao 3 cho các câu bẫy.
6. Chẩn đoán dựa trên bằng chứng của lần chạy, kèm 3 gợi ý tăng dần. Mọi câu chẩn đoán là mẫu câu điền fact của lượt chạy; không bao giờ hỏi LLM "vì sao bạn sai". Sau lượt trượt đầu, gợi ý mở theo yêu cầu; nấc sau mở khi người chơi đã làm một thao tác nhìn miễn phí (sửa 2026-10-08, X15). Gợi ý 3 (lời giải) có cổng riêng: chỉ mở khi đã nhìn thêm sau gợi ý 2, đã có một lượt chấm thật trượt ở sao đó, và hoặc đã trượt lượt chấm thứ ba ở sao đó, hoặc quỹ còn lại không đủ cho thêm một lượt chấm; theo sau là một câu biến thể tự sửa (N16, X28, chốt tạm theo roadmap Q9, [L1 §11](../content/scenarios/library-l1-grounded-citation.md#11-chẩn-đoán-và-gợi-ý)).
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
- Phòng ý tưởng của mọi khu có thẻ quyết định "Prompt, RAG, tool hay fine-tune?", chấm theo đáp án chuyên gia, 0 lời gọi ([brainstorm-room §7](../content/scenarios/brainstorm-room.md#7-thẻ-quyết-định-prompt-rag-tool-hay-fine-tune)).

**Luật thưởng (chốt 2026-10-08, N7)**
- Không phát XP, xu, huy hiệu hay bất kỳ phần thưởng nào cho việc đăng nhập, thời gian chơi hay số lượt chạy. Không có chuỗi ngày (streak).
- Lời khen luôn nêu một năng lực cụ thể, lấy từ fact của lượt chạy. Đúng: "Bạn sửa đúng câu bị cắt đôi ngay lượt đầu." Sai: "Tuyệt vời!", "Giỏi quá!".
- Phản hồi luôn mang thông tin: nói điều gì đã đúng và vì sao, không chỉ nói là đúng.
- Số lượt chạy không bao giờ được hiện như một thành tích. Không bảng xếp hạng toàn cầu, không bảng xếp hạng bắt buộc. Khi thi đấu, mọi đội có quỹ bằng nhau, bài nộp chấm một lần phía server trên model chính sau hạn nộp, và kết quả đã lưu không cho lợi thế gì.
- Thứ duy nhất được "thưởng" bằng tài nguyên là năng lực: hoàn lời gọi khi người chơi đoán chắc đúng và sửa đạt ngay (mục dưới).
- Lý do: thưởng chỉ vì tham gia làm giảm động lực nội tại (d = −0,40), còn phản hồi tích cực có thông tin làm tăng nó (d = +0,33) (Deci, Koestner và Ryan 1999, meta-analysis 128 nghiên cứu). Leaderboard và huy hiệu bắt buộc từng kéo động lực nội tại và điểm thi cuối kỳ xuống trong một khoá học 16 tuần. Nguồn và URL: [báo cáo nghiên cứu 1](../research/edtech-upgrade-insights.md).

**Quỹ chạy thật (chốt 2026-10-08, N11; gộp quỹ level với ca trực và quỹ dự phòng R là chốt tạm, roadmap Q9)**
- Mỗi học viên (trước khi có tài khoản: mỗi trình duyệt) có một quỹ lời gọi AI theo ngày, dùng chung cho level và ca trực; máy chiếu của giảng viên và sự kiện lớp có quỹ riêng, không trừ quỹ học viên. Mặc định suy từ trần của engine: tổng quỹ đã phát mỗi ngày ≤ 90 % `DailyCap`; lớp 30 người được 13 lời gọi mỗi người, đúng một run L3 mới (X26, chờ đo ở pilot). Phần còn lại của 90 % là quỹ dự phòng chung của lớp, đếm phía máy chủ, trả cho lời hoàn và câu biến thể sau gợi ý 3, nên tổng đã phát vẫn không vượt trần.
- Xem trước tất định, xem lại log, lượt đã ghi và kết quả đã lưu luôn miễn phí. Hoàn lời gọi khi dự đoán đánh dấu chắc đúng và lượt sửa đầu tiên đạt, lấy từ quỹ dự phòng chung. Không có quảng cáo hay đá quý; sau khi có mã lớp (T2), giảng viên cấp thêm bằng cách chuyển lời gọi từ quỹ máy chiếu, nên tổng đã phát không đổi.
- Quỹ hồi đầy lúc 00:00 UTC, cùng lúc với `DailyCap` của engine; số còn lại luôn ghi "ước tính" cho tới khi có lưu trữ bền phía server.
- Luật đầy đủ, mức mặc định và ánh xạ sang engine: [ca trực §3](../content/scenarios/daily-shift.md#3-quỹ-chạy-thật-theo-ngày).

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

**Engine đang chạy (cập nhật 2026-10-08).** Engine v0.2 của Thư viện dùng Gemini, không dùng Claude: chuỗi `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.5-flash`, profile ánh xạ sang `thinking_level`, giới hạn 15 lời gọi/phút cho model chính, `DAILY_LLM_CALL_CAP` 500 ([engine-v0.2](../design/engine-v0.2.md) E1, §14). Hệ quả:
- **Temperature:** engine vẫn không gửi temperature, nhưng lý do nay khác: Google khuyên giữ temperature ở mặc định 1,0 trên Gemini 3, vì hạ xuống có thể gây lặp vòng hoặc giảm chất lượng. Temperature 0 cũng không làm output tất định (một thí nghiệm 1.000 lần ở T = 0 cho 80 câu khác nhau, do kết quả phụ thuộc kích thước batch của server). Tính ổn định của V-Game đến từ replay cache và cổng hiệu chỉnh chạy model thật nhiều lần, không đến từ temperature. Mọi lời khuyên "đặt temperature 0" trong tài liệu cũ đã lỗi thời. Nguồn (Gemini 3 docs, Thinking Machines): [bản đồ phủ §3](../content/course-coverage.md#3-cập-nhật-2026-không-sửa-slide).
- **Độ dao động thật** của game là token suy nghĩ và chuỗi model dự phòng (cùng prompt L3: 74 và 528 token output; model dự phòng tốn thêm khoảng 0,9k token mỗi run L3). Sao 2 chỉ hiệu chỉnh trên model chính, nên UI hiện model đã phục vụ ở từng câu (X7).
- Đổi stack LLM là thay đổi của ADR 0003; cần một ADR mới thay thế khi chốt Gemini lâu dài.

### 8.5 Hệ khối (Phần 3, chưa triển khai)

- 29 khối MVP, trong đó 6 khối là tool chạy trên fixture.
- Registry khai báo bằng Pydantic; `GET /blocks` trả JSON Schema để client sinh form và kiểu TypeScript.
- Graph JSON đi qua validation (mã lỗi G01–G07) rồi biên dịch thành LangGraph.
- Nguyên tắc: chặn ít, cho chạy nhiều; bẫy phải cắn bằng cơ chế tất định; dữ liệu chấm (`GradingSpec`) tách khỏi phần khối được thấy (`PublicLevel`); không gợi ý gì trước khi chạy. Nới 2026-10-08 (X11): xem trước tất định được phép nhưng chỉ hiện hạng, cosine và chữ của đoạn, không bao giờ đánh dấu đoạn đáp án; cú vấp đầu tiên của level đến từ lượt đã ghi của cấu hình khởi đầu.

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
- `RunBudget` reserve trước, commit sau mỗi lời gọi; ~~semaphore giới hạn số lời gọi Anthropic đồng thời trên mỗi worker~~ (sửa 2026-10-08: không có semaphore cục bộ; mỗi model có cửa sổ trượt 62 s phía client, số lời gọi đồng thời tối đa là `MAX_CONCURRENT_RUNS` × 3 ca, [engine-v0.2 §14](../design/engine-v0.2.md#14-chủ-dự-án-cần-quyết)).
- Trần đồ thị: 25 node, 8 khối gọi LLM.
- Retrieval: KNN chính xác trên pgvector (mỗi biến thể index chỉ vài trăm dòng); BM25 trong RAM; embedding và rerank chạy ONNX trên CPU.

Đề xuất gameplay (chờ duyệt) thêm: `frameloop='demand'` khi lắp ráp, AdaptiveDpr, dưới 80 draw call, không dùng Rapier, không postprocessing trên GPU tích hợp.

**Trực quan hoá (chốt 2026-10-08, N23):** SVG/HTML, không thư viện biểu đồ, `<figure>` kèm bảng, thanh kéo `range` gốc, một live region có điều tiết, gộp SSE theo rAF, tem nguồn trên mọi hình; dữ liệu nặng tính lúc build thành file tĩnh. Chi tiết và các sự thật CSP đã đo trên site thật: [frontend architecture §8](../design/frontend-architecture.md#8-trực-quan-hoá-luật-chốt-2026-10-08).

## 10. Bảo mật và an toàn

- Không lưu secret trong repo. `.env*` bị gitignore, trừ `.env.example`. Repo có cấu hình Gitleaks (`.gitleaks.toml`).
- Không chạy code của người chơi. Người chơi chỉ nhập enum, số và text có giới hạn độ dài. Text được ghép vào message như dữ liệu, không qua `str.format` hay Jinja.
- Payload đồ thị ≤64 KB, UTF-8 hợp lệ, chuẩn hóa NFC, không có NUL hay ký tự bidi. Khối phải nằm trong whitelist và đã mở khóa.
- Guard của người chơi so khớp cụm từ nguyên văn, không phải regex, nên không có ReDoS. Regex chỉ đến từ level đã được duyệt.
- Tool chạy trên snapshot fixture bất biến; tool ghi chỉ ghi vào ledger giả. Compiler không bao giờ thêm server tool.
- Truy vấn retrieval chạy bằng role DB chỉ có quyền SELECT; mọi giá trị là bind param.
- Egress chỉ tới ~~Anthropic~~ Google Gemini API (sửa 2026-10-08, engine v0.2), Langfuse, và API embedding nếu dùng.
- Đáp án nằm trong `GradingSpec`, không vào engine. Ca ẩn và ca bẫy không hiện cho người chơi.
- W3: canary là HMAC theo người chơi; chỉ hiện 600 ký tự đầu của phản hồi target; rate limit riêng; log mọi đòn. Phản biện chỉ ra hai lỗ quanh canary và trace của target, cần sửa trước khi code.
- Histogram lời giải của lớp được ẩn danh.
- Theme campus chỉ dùng cho prototype nội bộ (mục 11).
- **Dữ liệu gửi lên free tier (2026-10-08, X10):** Google dùng nội dung gửi lên gói miễn phí để cải thiện sản phẩm. Mọi bộ test, trace và fixture chỉ chứa dữ liệu tổng hợp (không PII thật, không trí nhớ khách hàng thật). Mọi ô nhập tự do có gửi tới AI hiện cảnh báo ngay phía trên ô. Xưởng tự do (D7) chỉ mở khi có key trả phí.
- Quỹ lời gọi theo trình duyệt (mục 7) là lời hứa mềm, không phải hàng rào bảo mật; trần cứng là `DailyCap` phía server.

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
| Đợt B (2026-10-08) | nâng cấp bàn thợ theo [roadmap-v0.4 §5](../design/roadmap-v0.4.md#5-kế-hoạch-đợt-b-nâng-cấp-bàn-thợ): phiếu đoán và cược tự tin, sổ đối chiếu trích dẫn, thùng xếp lớp, đường đời hạng, hậu kiểm dựng từ trace, trạng thái khối, lịch sử 5 lượt, thang gợi ý mới, lượt đã ghi, thử 3 câu mẫu, dải đoạn, chế độ máy chiếu, hiển thị quỹ, 6 bài vi mô |
| Ngoài MVP | khu 4–6 (Phòng chấm đã chốt; Trạm vận hành, Văn phòng một cửa là ứng viên) và phòng phụ Cổng nạp liệu; deploy công khai theme campus khi chưa có phép; nếu đề xuất gameplay được duyệt: các mục nó đề nghị cắt (node editor tự do làm màn chính, LLM sinh tấn công, 120 NPC với A*...). Mini-game tay vẫn cắt; bài vi mô 1–3 phút là thẻ tuỳ chọn, không chặn đường vào level (X18) |

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
| Temperature | không truyền (Opus 5.5 trả 400) | "temperature 0". **Gỡ 2026-10-08:** không truyền temperature; lời khuyên T = 0 đã lỗi thời (§8.4) |
| Guard ở Tháp L1 / W1 | `pattern_guard` khớp cụm từ nguyên văn; người chơi không viết regex | "Lưới regex", "Đúc khuôn" sinh regex nháp; thêm "Cân", "Rào chủ đề" không có trong catalog |
| Canary | bảng level chỉ đặt canary ở W3 | Tháp L1 đã có agent giữ canary |
| Overlap | các mức tính sẵn {0, 10, 20}% | "Overlap 15%" |
| Trường giữ khi nén lịch sử | quyết định, ràng buộc, đính chính mới nhất, câu hỏi mở | thêm "nguồn", sọt bỏ lời chào, ngăn lưu trữ bản thô |
| Embed lúc chạy | chỉ chữ người chơi viết ở W3 | đèn pin ở Thư viện L1 xoay theo embedding thật của câu gõ vào. **Gỡ 2026-10-08 (X16):** không gõ tự do; đèn pin chiếu câu mẫu và khoảng 20 cụm thăm dò tính sẵn mỗi level |
| Hiện gold cho người chơi | chỉ qua chẩn đoán và 3 gợi ý; `case.graded` chỉ mang đạt/trượt theo tiêu chí sao | mỗi case hiện sao vàng (chunk đáp án) kèm hạng thật; `case.graded` thêm `labels` và `extracted` |
| W3 / Tháp L3 | target khóa của NPC; trần 8 đòn (phản biện đề nghị ≤3 đòn, ≤2 lượt) | tấn công chính cấu hình của người chơi; 12 phát; thêm ROT13 |
| Draw call | dưới 100 (đã duyệt) | dưới 80 |

### 13.3 Đã chốt ngày 2026-10-08

Chủ dự án duyệt áp dụng các đề xuất "làm ngay" của hai báo cáo nghiên cứu. Danh sách đầy đủ (Q1–Q9) và 28 xung đột đã gỡ (X1–X28) nằm ở [roadmap-v0.4](../design/roadmap-v0.4.md) §2, §3. Những điểm đổi đặc tả này:

| Mã | Quyết định | Mục đặc tả |
|---|---|---|
| Q2, X24 | Khu 4 là Phòng chấm; Trạm vận hành, Văn phòng một cửa là ứng viên khu 5, 6; Cổng nạp liệu là phòng phụ Thư viện | §5 |
| Q3 | Luật thưởng | §7 |
| Q4, X5, X22 | Quỹ chạy thật theo ngày thay "2 lượt mỗi sự cố"; hoàn lời gọi khi đoán chắc đúng và sửa đạt ngay | §6, §7 |
| Q5 | Bộ luật trực quan | §9 |
| Q6, X17 | Bản đồ theo ngày chỉ để kiểm phủ và làm giáo án | §5 |
| Q7, X20 | Temperature 0 và luật AI Việt Nam: sửa trong tài liệu của V-Game, báo giảng viên qua giáo án, không sửa slide | §8.4, [bản đồ phủ §3](../content/course-coverage.md#3-cập-nhật-2026-không-sửa-slide) |
| X8 | Giám khảo LLM là đối tượng học ở Phòng chấm; sao vẫn tất định | §5 |
| X10 | Dữ liệu tổng hợp, cảnh báo trước ô nhập tự do | §10 |
| X26 | Mặc định quỹ suy từ trần `DailyCap`; level và ca trực dùng chung quỹ học viên; quỹ dự phòng chung cho lời hoàn và câu biến thể; cấp thêm lấy từ quỹ máy chiếu (chốt tạm, Q9) | §2, §7 |
| X28 | Cổng gợi ý 3: nhìn thêm sau gợi ý 2, một lượt chấm trượt, rồi trượt thứ ba hoặc quỹ không đủ cho thêm một lượt chấm (chốt tạm, Q9) | §6 |
| X11 | Nới nguyên tắc "không gợi ý gì trước khi chạy" cho xem trước tất định | §8.5 |
| X15 | Gợi ý mở theo thao tác nhìn miễn phí, không theo số lượt trượt | §6 |
| X18, X19 | Bài vi mô là thẻ tuỳ chọn; level mô phỏng và dữ liệu ghi sẵn có tem | §5, §12 |

Mục 13.1 vẫn mở như cũ; ngày 2026-10-08 không chốt hướng gameplay (13.1.1) và M2 (13.1.3).
