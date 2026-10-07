# ADR 0003: Backend stack

- **Trạng thái:** Đã chấp nhận (chủ dự án duyệt trong Phần 2). Các chi tiết lấy từ Phần 3 còn là thiết kế, chưa triển khai.
- **Ngày ghi:** 2026-10-07
- **Liên quan:** [Đặc tả tổng hợp](../specs/2026-10-07-v-game-design.md), [Phần 3: Hệ khối](../design/part-3-block-system.md), [ADR 0001](0001-frontend-stack.md)

## Bối cảnh

- Backend phải biên dịch đồ thị khối người chơi lắp thành agent thật và chạy trên test set của NPC.
- Capstone yêu cầu agentic workflow có state và tool use, HITL cho hành động rủi ro, xử lý lỗi, eval/benchmark, và giám sát độ trễ, chi phí, lỗi.
- Một run có thể kéo dài tới 90 s, trong khi kết nối của client có thể đứt giữa chừng.
- Level RAG cần retrieval trên embedding thật.
- Nhóm chỉ có chủ dự án và Claude.

## Quyết định

**Stack**
- FastAPI + Pydantic + SQLAlchemy 2 + Alembic.
- PostgreSQL với pgvector; Redis.
- LangGraph cho agent; Langfuse cho tracing.
- py-fsrs xếp lịch ôn tập (cơ chế ôn đã duyệt).

**Run và sự kiện**
- Run chạy nền, không phụ thuộc kết nối SSE. Sự kiện được lưu và phát lại được.
- Sự kiện SSE: `run.started`, `step.started` / `step.finished`, `case.graded`, `run.scored`, `run.diagnosis`, `run.finished` / `run.failed`.
- Giới hạn 20 s mỗi ca, 90 s mỗi run. Server tính tiến độ.

**LLM**
- Claude qua langchain-anthropic, model mặc định `claude-opus-5-5`.
- Effort điều khiển độ sâu suy luận.
- Không ép `tool_choice`, không prefill, dùng prompt caching.

**Chi tiết từ Phần 3 (thiết kế)**
- Engine phát sự kiện qua interface `EventSink`; tầng app ghi Postgres và publish Redis.
- Client gửi `idempotency_key` (đã chốt ở Phần 2).
- Retrieval: KNN chính xác trên pgvector, BM25 bằng `rank_bm25`, embedding bằng fastembed, rerank bằng FlashRank (ONNX, chạy CPU).
- Postgres giữ các bảng `corpus_chunk`, `run_step_artifacts` và `llm_replay`.

## Hệ quả

- API và engine cùng là Python. Schema Pydantic của registry khối sinh luôn JSON Schema cho client.
- Run tách khỏi request, nên cần worker chạy nền và kho lưu sự kiện. Client mất kết nối thì nối lại SSE và nhận phát lại.
- Vector search nằm ngay trong Postgres (pgvector), không thêm vector DB riêng. BM25 chạy trong RAM (`rank_bm25`).
- Chỉ dùng một nhà cung cấp LLM. Ba profile là ba mức effort của cùng một model. Nếu sau này ánh xạ profile sang model khác thì phải hiệu chỉnh lại các ngưỡng.
- Run chấm điểm cần tất định, nên phải có cache phát lại và cổng hiệu chỉnh. Hiện tắt `fallbacks` sang model khác (câu hỏi mở).
- Spike tuần đầu phải kiểm:
  - langchain-anthropic có truyền được `output_config.effort`, `thinking.display`, tool strict và `method="json_schema"` không;
  - p95 của một ca ReAct so với mốc 20 s;
  - chất lượng fastembed và FlashRank với tiếng Việt.
- Phản biện lưu ý: `usage_metadata.input_tokens` trong langchain-anthropic đã gồm cache_read và cache_creation. Không được cộng hai phần này lần nữa.

## Phương án đã loại

Tài liệu nguồn không ghi lại phép so sánh với các framework backend khác. Các lựa chọn bị loại rõ trong Phần 2 và Phần 3:
- **Gắn run vào vòng đời kết nối SSE:** bị loại; run chạy nền.
- **Index ANN trên pgvector:** không cần, vì mỗi biến thể index chỉ vài trăm dòng.
- **Embedding và rerank chạy bằng torch:** thay bằng ONNX chạy CPU. Nếu spike cho thấy chất lượng tiếng Việt yếu thì chuyển embedding sang một API trong egress allowlist, và rerank sang LLM.
- **Truyền `temperature`:** Opus 5.5 trả 400.
- **Chế độ function-calling mặc định cho structured output:** nó ép `tool_choice` và gây 400. Thay bằng `with_structured_output(method="json_schema")` hoặc tool strict với tool_choice auto.
- **Prefill:** không dùng.
- **Giới hạn vòng agent bằng `recursion_limit`:** thay bằng bộ đếm và conditional edge, để vẫn giữ được bằng chứng khi chạm trần.
- **Chạy code hoặc regex do người chơi viết:** bị loại. Người chơi chỉ nhập enum, số và text có giới hạn độ dài.
