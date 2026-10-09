> **Trạng thái:** v0.1 (2026-10-08, [roadmap-v0.4](../design/roadmap-v0.4.md) N25). Cập nhật mỗi khi một level được xây hoặc một kịch bản mới được viết.
> **Dùng để:** kiểm độ phủ khoá học và làm giáo án ghép đúng ngày. **Không** dùng để đổi cấu trúc khu: đặc tả §5 vẫn lọc bài học theo chủ đề, không bám 15 ngày (quyết định Q6, X17).
> **Nguồn:** bản trích slide của khoá học (lưu ngoài repo). Bản trích không có slide Ngày 5 (lấy từ phần tổng kết Ngày 15), file Ngày 5–6 chỉ có phần hackathon Ngày 6, và slide Ngày 12 phần lớn là ảnh. Số slide ghi theo chân trang của slide; khi chân trang không đọc được thì ghi số trang của bản trích.

# Bản đồ phủ khoá học

## 1. Từng ngày học và chỗ của nó trong V-Game

"V-Game đang có" gồm cả level ở dạng kế hoạch hay kịch bản; tới 2026-10-08 chỉ Thư viện L1–L3 đã xây.

| Ngày | Nội dung chính | V-Game đang có | Độ phủ | Lấp bằng |
|---|---|---|---|---|
| 1. Nền tảng LLM | token (tiếng Việt tốn hơn), output đắt 3–5 lần input, context window, `max_tokens` và `stop_reason`, temperature, streaming | Chợ M1 (ngân sách token), M2 (profile) | Một phần | Vi mô "Hoá đơn 1.000 khách", "Nhiệt độ 0 không phải công tắc ổn định", "Vì sao bị cắt?", "Mặt bàn có hạn"; level Thợ nghĩ lâu (D14) |
| 2. Định khung bài toán | 4 phản mẫu (có "không có baseline"), cổng vòng đời, luật hay workflow hay LLM hay agent; Go, Not-yet, No-go | Phòng ý tưởng; thẻ quyết định "Prompt, RAG, tool hay fine-tune?" | Một phần | Level "Có cần AI không?" (D14) |
| 3. Agent ReAct | phổ từ bot tới agent, agent tốn khoảng 4,5 lần, vòng ReAct, xuống cấp êm khi tool hỏng, `MAX_ITERATIONS` | Chợ M2 `agent_react` (engine đang hoãn) | Một phần | Agent đi vòng (D13); vi mô "Tìm 3 lỗi trong trace", "Song song hay nối tiếp?" |
| 4. Prompt, context, tool, kiểm soát | hỏi lại khi thiếu thông tin chặn, few-shot không miễn phí, quản lý phiên bản prompt với tập giữ lại, dữ liệu động cần `fetched_at` và `valid_until`, thang rủi ro tool | Chợ M1, M3; Thư viện L1 (trích dẫn); Tháp W1 | Một phần; **khoảng trống lớn nhất** | Hỏi lại hay đoán? (T25), Dữ liệu sống (D14), Phiếu khai (T6); vi mô "Thang rủi ro tool" |
| 5–6. Sản phẩm, hackathon | Product Canvas, trust UX; từ spec tới demo | Phòng ý tưởng | Một phần | Trust UX đưa vào Bàn duyệt (T22) |
| 7. Embedding, vector store | 3 loại dữ liệu, che PII trước khi embed, chia đoạn, P@k, R@k, MRR, khi nào không dùng RAG | **Thư viện L1–L2 (đã xây)** | Mạnh, một phần | Vi mô "Ba loại dữ liệu"; Cổng nạp liệu (che PII) |
| 8. RAG pipeline | dense và BM25, RRF k = 60, rerank, biến đổi truy vấn, agentic RAG, RAGAS | **Thư viện L1–L3 (đã xây)** | Mạnh | Câu hỏi hai ý (T21); vi mô "Tự tay trộn RRF", "Đọc vị bảng điểm RAG", "Tách câu hỏi" |
| 9. Đa agent, MCP, A2A | supervisor-worker, phản mẫu, `tools/list`, hợp đồng A2A | Đề xuất "Dây chuyền hay đội nhóm" (D2) | Một phần | Vi mô "MCP hay A2A?" ở lại trong thoại NPC (khó thấy nhân quả trong một engine đơn) |
| 10. Data pipeline | ETL và ELT, upsert idempotent, NFC cho tiếng Việt, 6 chiều chất lượng, cổng chất lượng, "trông như bịa nhưng là lỗi pipeline" | **Kịch bản [Cổng nạp liệu](scenarios/intake-gate.md) (2026-10-08)**; trước đó chỉ có bẫy văn bản 2019 ở L2 | Chưa có màn; đã có kịch bản | Cổng nạp liệu (T20); vi mô "Chạy lại hai lần" |
| 11. Guardrail | OWASP LLM 2025, injection, rate limit, HITL theo độ tin, trust UX, thiên lệch | Tháp W1–W3 | Mạnh, một phần | Bàn duyệt (T22), Đổi tên đổi kết quả? (D14); vi mô "Luật AI Việt Nam xếp hạng", "Lỗi hay tấn công?", "Nhãn tự tin" |
| 12. Triển khai | 12-factor, rate limiter, cost guard, health check, cold start 5–15 s | **Kịch bản [Giờ cao điểm](scenarios/rush-hour.md) (2026-10-08)** | Chưa có màn; đã có kịch bản | Giờ cao điểm (T19) |
| 13. Giám sát | P50, P95, P99, TTFT, SLO, burn rate, cardinality, che PII trong log, Observathon | Phác thảo Phòng điều khiển ([rush-hour §10](scenarios/rush-hour.md#10-level-thứ-hai-của-khu-phác-thảo-phòng-điều-khiển)) | Phần lớn **chưa có** | Phòng điều khiển (T19); vi mô "P99 của 10 lượt chat", "Ngân sách lỗi", "Nhãn nổ hoá đơn", "Che trước khi ghi" |
| 14. Đánh giá | BLEU và ROUGE hỏng với câu diễn đạt lại, cỡ golden set, giám khảo LLM thang 1–5 | Chấm golden, ca ẩn, ca bẫy ở mọi level; **kịch bản [Phòng chấm](scenarios/grading-room.md) (2026-10-08)** | Một phần; mạnh khi xây T5 | Sổ lỗi, Giám khảo cũng phải thi, Đấu mù; vi mô "BLEU khen câu sai", "20 câu có đủ không?", "Giám khảo đổi chỗ" |
| 15. Tổng kết | Work Trend Index 2026: kiểm soát chất lượng output AI là kỹ năng tăng giá trị nhanh nhất (50 %) | | | Không phải level; là lý do để có Phòng chấm |

**Nhận xét:**
- Khoảng trống không ngẫu nhiên: Ngày 10, 12, 13 cùng thuộc mốc "vận hành, an toàn, deploy, quan sát, đánh giá" mà Ngày 15 tổng kết. Riêng Ngày 13 có 96 slide (114 trang bản trích) và kết bằng capstone Observathon.
- Trong các ngày đã có màn, Ngày 4 là lỗ lớn nhất: đây là ngày dạy prompt dày nhất, nhưng chưa level nào chấm nội dung prompt. M1–M3 chấm cách đóng thùng, L1 chấm trích dẫn, Phiếu khai chấm schema.
- Cả ba ngày chưa có màn đều có bài học nằm **trước** bước sinh câu trả lời (nạp dữ liệu, chính sách vận hành), nên chấm được với 0 lời gọi.

## 2. Ba khu chưa có tên

Chốt 2026-10-08 ([đặc tả §5](../specs/2026-10-07-v-game-design.md#5-nội-dung)):

| Khu | Trạng thái | Ngày học chính | Lời gọi khi chơi |
|---|---|---|---|
| Phòng chấm | Khu 4, đã chốt | 14 (cùng RAGAS của Ngày 8 và kỹ năng của Ngày 15) | 0 khi chấm nhãn; 5–12 khi chạy |
| Trạm vận hành | Ứng viên khu 5 | 12, 13 | 0 (mô phỏng) |
| Văn phòng một cửa | Ứng viên khu 6 | 4 (structured output, thiết kế tool), 3 | 10–30 mỗi lượt; vượt quỹ học viên P = 13 ở lớp 30 người ([ca trực §3.1](scenarios/daily-shift.md#31-luật)), nên trước khi xây phải đưa một lượt xuống ≤ 13 (spike structured output, T6). Chơi theo cặp không cứu được: một lượt chỉ trừ quỹ của một máy (sửa 2026-10-08, rà soát vòng 3) |

Cổng nạp liệu (Ngày 10) là phòng phụ của Thư viện, không phải khu.

## 3. Cập nhật 2026 (không sửa slide)

Bốn chỗ slide đã cũ so với tháng 10/2026 (mọi link trong mục này kiểm 2026-10-08; hàng Ngày 8 thêm cùng ngày ở rà soát vòng 4, vì hai báo cáo nghiên cứu bỏ sót). V-Game chỉ sửa trong tài liệu của chính mình và báo trước giảng viên qua giáo án (ô "Cập nhật 2026" trong [giáo án Thư viện](lesson-plan-library.md)). Không bao giờ sửa slide, và luôn nói như một cập nhật kể từ lúc slide được soạn, không phủ nhận người dạy (quyết định Q7, X20).

| Slide | Slide ghi | Cập nhật 2026 | V-Game làm gì |
|---|---|---|---|
| Ngày 1, slide 24/32 (bản trích tr. 30) | "Bắt đầu với temperature=0 cho tác vụ cần ổn định" | Với Gemini 3, Google "khuyên mạnh" giữ temperature ở mặc định 1,0, vì hạ xuống có thể gây lặp vòng hoặc giảm chất lượng ([Gemini 3](https://ai.google.dev/gemini-api/docs/gemini-3)). Temperature 0 cũng không tất định: 1.000 lần chạy ở T = 0 trên Qwen3-235B cho 80 câu khác nhau, vì kết quả phụ thuộc kích thước batch khi server tải nặng ([Thinking Machines](https://thinkingmachines.ai/blog/defeating-nondeterminism-in-llm-inference/)). Lời khuyên hạ temperature tuỳ nhà cung cấp | Engine không gửi temperature ([đặc tả §8.4](../specs/2026-10-07-v-game-design.md#84-llm)). Vi mô "Nhiệt độ 0 không phải công tắc ổn định" (N24), tem "Minh hoạ". Đã sửa câu "temperature 0" trong [gameplay-direction](../design/gameplay-direction.md) |
| Ngày 8, slide 30/46 "Generation Failure Patterns" (bản trích tr. 37) và slide 39/46 "Faithfulness" (tr. 49) | Slide 30, ô "Bỏ qua constraints": "Fix: … Giảm temperature = 0". Slide 39, ô "Thấp → sửa ở đâu": "Giảm temperature = 0" | Như hàng Ngày 1. Giữ các cách sửa còn lại của hai slide (đặt luật quan trọng ở cuối prompt, grounding chặt, vòng tự sửa); model quên trích dẫn hay faithfulness thấp không chữa bằng temperature 0 | Thư viện L1 chạy đúng ngày này ([giáo án](lesson-plan-library.md) nối ngay sau slide 27/46), nên giảng viên được báo trước cả hai slide. L1 chữa "quên trích dẫn" bằng Máy đóng tem và thẻ G2, không bằng temperature |
| Ngày 14, slide 18/42 (bản trích tr. 26) | "temperature=0 cho consistent scoring. Chạy 2–3 lần để check variance" | Giữ phần "chạy nhiều lần". Bỏ phần temperature 0 với Gemini 3 (như trên). Độ tin của giám khảo đo bằng độ khớp với nhãn người (TPR, TNR), không bằng temperature | Phòng chấm, level Giám khảo cũng phải thi |
| Ngày 11, slide 18/65 (bản trích tr. 23) | Chiến lược AI Việt Nam: "định hướng phát triển AI có trách nhiệm, đang xây dựng" | Luật Trí tuệ nhân tạo số 134/2025/QH15 được Quốc hội thông qua ngày 10/12/2025 và **có hiệu lực từ 1/3/2026**. Luật chia ba mức rủi ro, buộc người dùng phải nhận biết được khi đang tương tác với AI, và cho hệ thống đang chạy 18 tháng chuyển tiếp ở y tế, giáo dục, tài chính ([Rajah & Tann](https://www.rajahtannasia.com/?p=184653), [Rahmat Lim](https://www.rahmatlim.com/publication/articles/32667/s-new-law-on-artificial-intelligence-risk-based-regulatory-framework-in-force-1-march-2026)) | Vi mô "Luật AI Việt Nam xếp hạng" (N24). Với chính V-Game: trợ lý tra cứu luôn hiện là cỗ máy do người chơi lắp, NPC dùng thoại viết sẵn; trước khi deploy công khai cần rà lại theo văn bản luật và hướng dẫn thi hành |

**Bổ sung, không phải sửa:** OWASP công bố Top 10 cho ứng dụng agent vào tháng 12/2025 (ASI01 chiếm mục tiêu tới ASI10 agent nổi loạn; [Giskard](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026), kiểm 2026-10-08), trong khi khoá học dạy bản cho LLM năm 2025. Ba mục khớp thẳng level của V-Game: ASI06 (đầu độc trí nhớ và context) với Cổng nạp liệu và Tháp W2, ASI08 (lỗi dây chuyền) với bão thử lại ở Giờ cao điểm, ASI09 (khai thác lòng tin của người dùng) với Bàn duyệt.

## 4. Cách dùng

- **Giảng viên:** chọn level theo ngày đang dạy; mỗi level sẽ có giáo án 45 phút cùng khuôn với [giáo án Thư viện](lesson-plan-library.md) (5 phút đoán, 25 phút chơi theo cặp, 15 phút debrief). Hiện chỉ Thư viện L1 có giáo án.
- **Người viết nội dung:** trước khi viết một level mới, đối chiếu bảng mục 1 để lấp ngày còn trống trước; sau khi xây, sửa cột "V-Game đang có" và "Độ phủ".
- **Nguồn ngoài slide:** mọi sự thật mới (luật, khuyến nghị của nhà cung cấp) ghi kèm link và ngày kiểm; kiểm lại trước mỗi đợt học.
