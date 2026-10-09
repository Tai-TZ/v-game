> **Trạng thái:** thiết kế v0.1, chưa xây (cần vai trò giáo viên, chưa có trong v0.1). **Thêm 2026-10-08:** thẻ quyết định "Prompt, RAG, tool hay fine-tune?" dùng cho Phòng ý tưởng của mọi khu (mục 7, [roadmap-v0.4](../../design/roadmap-v0.4.md) N12); thẻ này không cần giáo viên nên xây được trước. **Nguồn:** đặc tả §7 ("Mỗi khu có một Phòng ý tưởng… giáo viên nhận xét được trên thẻ"); Ngày 7 slide 48/60 (Data inventory template), 54/60 (Khi nào không cần RAG), 13/60 (PII masking trước khi embed); Ngày 8 slide 27/46 (Grounding & Abstention), 36/46 (Vibe check là không đủ); Ngày 14 slide 13–14/42 (Golden dataset).
> **Liên quan:** [Tổng quan Thư viện](library.md) · [Nhân vật](npc-cast.md)

# Phòng ý tưởng của Thư viện

**Nơi chốn:** một phòng đọc nhỏ trên gác Thư viện, có bảng ghim và đèn bàn. Cửa mở sau khi người chơi đạt sao 1 ở L1. Mỗi lần xong một level của Thư viện, phòng có thêm câu hỏi mới (mục 2).

**Mục đích:** biến điều vừa chơi thành một **thẻ ý tưởng cho dự án của chính người học**, đủ cụ thể để mai làm thử được. Không chấm sao, không có đúng sai.

## 1. Luồng (10–15 phút)

| # | Bước | Người học làm | Hệ thống làm |
|---|---|---|---|
| 0 | Thẻ quyết định (tuỳ chọn, 3–4 phút) | Chọn đòn bẩy đầu tiên cho 8 tình huống (mục 7) | Chấm theo đáp án chuyên gia, 0 lời gọi |
| 1 | Chọn hạt giống | Chọn 1 trong 3 câu mở đầu, hoặc tự gõ: "Nhóm mình có một đống tài liệu mà ai cũng hỏi đi hỏi lại" · "Có một chỗ mà người ta hay trả lời sai quy định" · "Người dùng hỏi bằng mã, số hiệu" | Gợi mở thẻ trống theo hạt giống |
| 2 | Điền thẻ (mục 3) | Điền 7 trường, phần lớn bằng lựa chọn kèm ô chữ ngắn | Đếm ký tự, lưu nháp cục bộ |
| 3 | Cô Lan vặn hỏi | Trả lời 2–4 câu Socratic mà luật (mục 2) bắt được từ thẻ; sửa thẻ nếu muốn | Luật tất định chọn câu hỏi; không gọi LLM ở v1 |
| 4 | Soi lại bằng ba thứ đã chơi | Đối chiếu thẻ với 3 bài học: thiếu dữ liệu thì bịa; cách cắt và văn bản cũ; số hiệu cần từ khoá | Hiện 3 ô "Ở dự án của bạn, chỗ này là…?" |
| 5 | Gửi giáo viên | Bấm "Gửi thẻ cho giáo viên" | Trạng thái "Chờ nhận xét" |
| 6 | Nhận nhận xét | Đọc nhận xét theo từng trường, sửa thành bản 2 | Giữ lịch sử phiên bản của thẻ |
| 7 | Mang về | "Tải thẻ (Markdown)" | Xuất 1 trang, có ngày và phiên bản |

## 2. Cô Lan vặn hỏi: 8 câu Socratic

Mỗi câu gắn với một trường của thẻ và một slide. Luật kích hoạt đọc nội dung thẻ: lựa chọn và từ khoá đơn giản, chạy tất định. Mỗi lần vặn hỏi tối đa 4 câu, ưu tiên theo thứ tự trong bảng. Cô Lan hỏi chứ không phán, và không bao giờ nói "sai".

| # | Câu cô Lan hỏi (nguyên văn) | Trường | Kích hoạt khi | Nguồn |
|---|---|---|---|---|
| S1 | "Người dùng của bạn cần dữ liệu riêng, hay đó là thứ model đã biết sẵn? Nếu là kiến thức chung, có khi bạn không cần tra gì cả." | Vấn đề, Nguồn dữ liệu | luôn hỏi ở lần đầu | Ngày 7, slide 54/60 |
| S2 | "Tài liệu này ai sửa, và bao lâu sửa một lần? Hôm nó đổi, trợ lý của bạn biết bằng cách nào?" | Nguồn dữ liệu | chưa điền chủ sở hữu hoặc tần suất cập nhật | Ngày 7, slide 12/60, 48/60 |
| S3 | "Nếu có hai bản cùng nói một chuyện mà khác số, trợ lý tin bản nào? Bạn ghi điều đó vào đâu?" | Chiến lược truy xuất | tần suất cập nhật ≠ "không bao giờ" và chưa chọn bộ lọc metadata | L2; Ngày 8, slide 31/46 |
| S4 | "Người ta hay hỏi bằng mã, số hiệu, tên riêng không? Tìm theo nghĩa hay hụt đúng mấy thứ đó." | Chiến lược truy xuất | chỉ chọn "tìm theo nghĩa" | L3; Ngày 8, slide 13/46 |
| S5 | "Câu trả lời đúng thường nằm gọn trong một đoạn, hay vắt qua nhiều mục, kiểu 'trừ trường hợp ở mục sau'?" | Chiến lược truy xuất | chọn cắt cố định | L2; Ngày 7, slide 31/60 |
| S6 | "Khi tài liệu không có câu trả lời, bạn muốn trợ lý nói gì, và chuyển người ta cho ai?" | Rủi ro | chưa tick rủi ro "câu ngoài phạm vi" | L1; Ngày 8, slide 27/46 |
| S7 | "Bạn sẽ biết nó tốt lên bằng con số nào, đo trên bao nhiêu câu? 'Thấy ổn' thì không tính nhé." | Thước đo | không có con số, hoặc bộ câu dưới 20 | Ngày 8, slide 36/46; Ngày 14, slide 13/42 |
| S8 | "Có dữ liệu cá nhân nào sẽ vào kho không? Che trước khi tạo embedding, đừng để sau." | Rủi ro, Nguồn dữ liệu | tick "có dữ liệu cá nhân" hoặc nguồn là "hồ sơ", "danh sách" | Ngày 7, slide 13/60 |

Câu kết của cô Lan, sau khi người học trả lời hết: "Ý tưởng tốt là ý tưởng mai làm thử được. Còn ý tưởng hay thì để dành cho lúc uống trà."

## 3. Mẫu thẻ ý tưởng

| Trường | Nhập liệu | Giới hạn |
|---|---|---|
| **Vấn đề** | Ô chữ: "Ai đang gặp chuyện gì, và hậu quả là gì?" | ≤ 200 ký tự |
| **Người dùng** | Chọn: sinh viên, nhân viên nội bộ, khách hàng, khác; kèm ô chữ "họ hỏi thế nào" | ≤ 100 ký tự |
| **Nguồn dữ liệu** | Loại dữ liệu: tri thức / vận hành / ngữ cảnh (Ngày 7, slide 6/60). Chủ sở hữu. Tần suất cập nhật: không bao giờ / theo quý / hằng tháng / hằng ngày / theo thời gian thực. Có dữ liệu cá nhân? Có / không | mỗi ô ≤ 80 ký tự |
| **Chiến lược truy xuất** | Cách cắt: theo mục / cố định. Cỡ ước tính. Tìm theo nghĩa / từ khoá / lai. Xếp hạng lại: có / không / chưa biết. Lọc metadata: trường nào | chọn + ≤ 120 ký tự |
| **Rủi ro** | Tick: bịa nguồn · dùng văn bản cũ · câu ngoài phạm vi · lộ dữ liệu cá nhân · tài liệu chứa lệnh ẩn (dẫn sang Tháp canh); kèm ô chữ | ≤ 200 ký tự |
| **Thước đo** | Chọn: Recall@k, Precision@k, tỉ lệ trích dẫn hợp lệ, tỉ lệ từ chối đúng, faithfulness. Kèm ngưỡng và số câu golden | số câu ≥ 1 |
| **Thử nghiệm đầu tiên** | Giả thuyết ("Nếu … thì … vì …"), **một** biến thay đổi, cách đo, thời lượng ≤ 1 ngày | ≤ 300 ký tự |

Thẻ là dữ liệu có cấu trúc (JSON), nên giáo viên lọc được theo trường, ví dụ "những thẻ chưa có thước đo".

## 4. Giáo viên nhận xét gì

Giáo viên nhận xét **trên từng trường**, không viết bài dài. Mỗi trường có 3 trạng thái: "Ổn" · "Cần làm rõ" · "Đổi hướng", kèm một dòng ghi chú ≤ 200 ký tự.

| Tiêu chí | Câu hỏi giáo viên tự hỏi |
|---|---|
| Có cần RAG thật không | Vấn đề có cần dữ liệu riêng, hay prompt hoặc tool là đủ? |
| Dữ liệu với tới được | Người học có quyền và có cách lấy dữ liệu này trong tuần này không? |
| Thước đo đo được | Có con số, có ngưỡng, có bộ câu cố định? |
| Rủi ro đúng trọng tâm | Rủi ro lớn nhất của dự án này đã được tick chưa (thường là văn bản cũ hoặc dữ liệu cá nhân)? |
| Thử nghiệm đủ nhỏ | Một biến, một ngày, kết quả đọc được? |

Giáo viên có thể đánh dấu một thẻ "Mang ra thảo luận" để dùng trong buổi debrief của lớp (research, mục "Bẫy cần tránh": thả game cho học viên rồi bỏ đó).

## 5. Hai thẻ mẫu

### Thẻ mẫu A: Hỏi đáp chính sách nhân sự (công ty 200 người)

| Trường | Nội dung |
|---|---|
| Vấn đề | Nhân viên hỏi phòng nhân sự cùng vài câu mỗi tuần (nghỉ phép, công tác phí, thai sản), và đôi khi được trả lời theo chính sách năm ngoái |
| Người dùng | Nhân viên nội bộ; hỏi qua chat bằng lời thường, đôi khi ghi "mục 4.2" |
| Nguồn dữ liệu | Tri thức: sổ tay nhân sự (PDF, 40 trang) + 6 thông báo sửa đổi. Chủ sở hữu: trưởng phòng nhân sự. Cập nhật theo quý. Có dữ liệu cá nhân: không (chỉ chính sách) |
| Chiến lược truy xuất | Cắt theo mục (sổ tay có đánh số mục), ~400 token. Lai, vì có người hỏi "mục 4.2". Lọc `ngay_hieu_luc` và `con_hieu_luc`. Xếp hạng lại: chưa, đo trước đã |
| Rủi ro | Dùng văn bản cũ (thông báo sửa đổi chồng lên sổ tay). Câu ngoài phạm vi (lương của đồng nghiệp): phải từ chối và chuyển người |
| Thước đo | 30 câu golden lấy từ chat thật của 2 tháng. Recall@3 ≥ 0,9. Tỉ lệ từ chối đúng ở 5 câu ngoài phạm vi = 5/5. Không câu nào trích văn bản đã bị thay |
| Thử nghiệm đầu tiên | "Nếu lọc `con_hieu_luc` trước khi tìm thì số câu dùng văn bản cũ trên bộ 30 câu giảm từ X về 0, vì hai bản đang đứng sát nhau." Đổi một biến (bộ lọc), đo bằng bộ 30 câu, nửa ngày |

Câu cô Lan đã vặn: S2 (ai sửa sổ tay), S3 (hai bản khác số), S7 (bao nhiêu câu).

### Thẻ mẫu B: Tra mã lỗi máy bán hàng cho nhân viên cửa hàng

| Trường | Nội dung |
|---|---|
| Vấn đề | Nhân viên ca tối gặp mã lỗi máy bán hàng (ví dụ "E-217") và gọi kỹ thuật lúc 10 giờ đêm cho những lỗi tự xử lý được |
| Người dùng | Nhân viên cửa hàng; gõ mã lỗi, hoặc tả kiểu "máy kêu bíp ba lần rồi tắt" |
| Nguồn dữ liệu | Tri thức: sách hướng dẫn của hãng (120 mã lỗi) + 30 ghi chú xử lý của đội kỹ thuật. Chủ sở hữu: trưởng nhóm kỹ thuật. Cập nhật hằng tháng. Có dữ liệu cá nhân: có (ghi chú có tên và số điện thoại khách), nên che trước khi tạo embedding |
| Chiến lược truy xuất | Cắt theo mã lỗi (mỗi mã một đoạn). Lai: BM25 cho mã, dense cho câu tả triệu chứng. Gộp bằng RRF k = 60. Xếp hạng lại: thử nếu câu tả triệu chứng trượt nhiều |
| Rủi ro | Bịa cách xử lý cho mã không có trong sách, nguy hiểm nếu liên quan điện. Lộ dữ liệu cá nhân trong ghi chú kỹ thuật |
| Thước đo | 40 câu: 25 câu gõ mã, 15 câu tả triệu chứng. Recall@3 theo từng nhóm câu. Tỉ lệ từ chối đúng với 5 mã không tồn tại = 5/5 |
| Thử nghiệm đầu tiên | "Nếu thêm BM25 cạnh dense thì Recall@3 ở nhóm câu gõ mã tăng từ X lên ≥ 0,9, còn nhóm câu tả triệu chứng không giảm." Đổi một biến (thêm BM25), đo trên bộ 40 câu chia hai nhóm, một ngày |

Câu cô Lan đã vặn: S4 (mã, số hiệu), S6 (khi không có câu trả lời), S8 (dữ liệu cá nhân).

## 6. Telemetry và câu hỏi mở

**Telemetry:** `idea.open` → `idea.seed{choice}` → `idea.field.fill{field}` → `idea.socratic.shown{id}` → `idea.socratic.answered{id}` → `idea.submit` → `idea.review.received{statuses}` → `idea.revise{version}` → `idea.export`.

**KPI:** tỉ lệ thẻ có thước đo kèm con số; tỉ lệ thẻ được sửa sau nhận xét.

**Câu hỏi mở:**
1. Phòng ý tưởng cần vai trò giáo viên, lưu thẻ phía server và quyền riêng tư cho thẻ (người học có thể ghi tên dự án thật). Không thuộc v0.1. Các ô chữ của thẻ không gửi tới AI ở v1; nếu sau này gửi (câu hỏi 2), phải có cảnh báo ngay phía trên ô vì free tier dùng nội dung gửi lên để cải thiện sản phẩm (đặc tả §10).
2. v1 dùng luật tất định để chọn câu Socratic. Có muốn cô Lan diễn đạt lại bằng LLM rẻ không? Research §1.1 khuyên prompt NPC ngắn và tách khỏi agent được chấm. Phải tính chi phí, và lời diễn đạt lại không được thêm phán xét.
3. Thẻ có được chia sẻ ẩn danh trong lớp (kho ý tưởng) không?

## 7. Thẻ quyết định: Prompt, RAG, tool hay fine-tune?

**Nguồn:** Ngày 7, slide 54/60 (khi nào không cần RAG); Ngày 2 (luật, workflow, LLM hay agent; Go, Not-yet, No-go); [hướng dẫn tối ưu model của OpenAI](https://developers.openai.com/api/docs/guides/model-optimization) (viết eval trước khi viết prompt; OpenAI đang thu hẹp nền tảng fine-tune của mình); luật "fine-tune chỉ khi prompt đã thất bại" là dòng thiết kế của [báo cáo nghiên cứu 1](../../research/edtech-upgrade-insights.md) (bảng đề xuất), không phải câu của OpenAI (sửa 2026-10-08); [LangChain *State of Agent Engineering*](https://www.langchain.com/state-of-agent-engineering) 2025 (57 % đội làm agent không fine-tune).

**Mục đích:** luyện câu hỏi đầu tiên của mọi dự án AI: đòn bẩy rẻ nhất nào giải được việc này. Đặt ở bước 0 của Phòng ý tưởng mọi khu, trước khi người học điền thẻ của chính mình. Không gọi AI, không sao, không điểm, không xếp hạng (luật thưởng, đặc tả §7).

**Nguyên tắc của chuyên gia** (hiện sau khi người học chọn xong cả 8 tình huống):
- Thử prompt trước, và đo trên một bộ câu cố định.
- RAG cho dữ kiện model không có, hoặc có mà hay đổi.
- Tool cho dữ liệu sống, dữ liệu riêng của từng người, và phép tính.
- Fine-tune chỉ khi prompt (kể cả ví dụ mẫu) đã thất bại **có số đo**, việc hẹp và lặp lại, và đã có dữ liệu gán nhãn.

### 7.1 Luồng

1. Mỗi tình huống: chọn **một** đòn bẩy đầu tiên (Prompt · RAG · Tool · Fine-tune), rồi đánh dấu chắc hoặc đoán. Bỏ qua được.
2. Chọn xong một tình huống thì lộ đáp án chuyên gia, một câu lý do và nguồn. Khác đáp án thì không có chữ "sai": cô Lan chỉ đọc lý do.
3. Cuối thẻ: "Bạn chọn giống chuyên gia ở {k}/8 tình huống; những lần bạn đánh dấu chắc thì đúng {c}/{n}." Không lưu điểm, không so với người khác.
4. Câu cuối dẫn sang thẻ ý tưởng: "Còn dự án của bạn: đòn bẩy đầu tiên là gì?" Lựa chọn này kích hoạt câu S1 (mục 2) ở bước vặn hỏi.

### 7.2 Tám tình huống

| # | Tình huống | Đáp án chuyên gia | Vì sao (cô Lan đọc) | Mồi nhử hay gặp |
|---|---|---|---|---|
| 1 | Trợ lý trả lời đúng nhưng câu dài, giọng cứng; nhóm muốn câu ngắn, xưng "bạn" | Prompt | Giọng và định dạng là việc của chỉ dẫn và một hai ví dụ mẫu; thử trong mười phút là biết | Fine-tune "cho giống giọng" |
| 2 | Hỏi đáp sổ tay nhân sự 40 trang, sửa mỗi quý | RAG | Model không biết tài liệu nội bộ, và tài liệu đổi; nạp lại là cập nhật, và trích được nguồn | Fine-tune |
| 3 | Sinh viên hỏi lớp học phần X còn bao nhiêu chỗ | Tool | Dữ liệu sống, đổi từng phút; kho tài liệu chỉ giữ một bản chụp cũ | RAG |
| 4 | Nhóm muốn model "thuộc lòng" toàn bộ quy chế để khỏi phải tra | RAG | Fine-tune không phải cách tin cậy để nạp dữ kiện: khó cập nhật, không trích được nguồn, vẫn có thể bịa | Fine-tune |
| 5 | Trợ lý tính học phí theo số tín chỉ và đơn giá, hay nhân sai | Tool | Phép tính để code làm; model chỉ cần gọi hàm và đọc kết quả | Prompt "hãy tính cẩn thận" |
| 6 | Sinh viên hỏi lịch thi của chính mình | Tool | Dữ liệu riêng của từng người, cần quyền truy cập; không đưa vào kho dùng chung | RAG |
| 7 | Phân loại 20.000 phiếu góp ý mỗi tháng vào 12 nhãn nội bộ. Prompt kèm ví dụ mẫu đo trên 300 phiếu có nhãn: 78 %, cần 95 %; đã có 5.000 phiếu gán nhãn | Fine-tune (cân nhắc) | Prompt đã thất bại có số đo, việc hẹp và lặp lại, có dữ liệu nhãn. Vẫn so chi phí với một model lớn hơn trước khi làm | RAG |
| 8 | Trợ lý trả JSON cho hệ thống khác đọc, đôi khi thiếu trường | Prompt (cộng structured output và kiểm bằng code) | Định dạng là việc của cấu hình lời gọi và validator, không phải của dữ kiện hay huấn luyện. Đúng khuôn chưa chắc đúng nghĩa (Văn phòng một cửa) | Fine-tune |

Phân bố có chủ ý: Tool 3, Prompt 2, RAG 2, Fine-tune 1. Fine-tune hiếm khi là đòn bẩy đầu tiên.

**Câu kết của cô Lan:** "Đòn bẩy rẻ nhất mà giải được việc là đòn bẩy đúng. Muốn dùng cái đắt hơn thì phải có số đo bảo lãnh."

### 7.3 Dùng ở các khu khác và telemetry

- Mỗi khu thêm tối đa 4 tình huống riêng khi khu đó có Phòng ý tưởng (ví dụ ở Chợ model: model nhỏ cộng tool hay model lớn; ở Tháp canh: guard tự động hay người duyệt). Luôn giữ 8 tình huống chung ở trên.
- Câu hỏi "có cần AI không?" (Ngày 2) là level riêng sau này (D14), không nằm trong thẻ này.
- **Telemetry:** `decide.open` → `decide.pick{id, choice, confident}` → `decide.reveal{id, match}` → `decide.done{match_count, confident_correct}`. Số đo cho pilot: tỉ lệ chọn "Fine-tune" ở tình huống 2 và 4 trước và sau khi học Thư viện.
