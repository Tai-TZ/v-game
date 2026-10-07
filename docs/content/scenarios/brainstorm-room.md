> **Trạng thái:** thiết kế v0.1, chưa xây (cần vai trò giáo viên, chưa có trong v0.1). **Nguồn:** đặc tả §7 ("Mỗi khu có một Phòng ý tưởng… giáo viên nhận xét được trên thẻ"); Ngày 7 slide 48/60 (Data inventory template), 54/60 (Khi nào không cần RAG), 13/60 (PII masking trước khi embed); Ngày 8 slide 27/46 (Grounding & Abstention), 36/46 (Vibe check là không đủ); Ngày 14 slide 13–14/42 (Golden dataset).
> **Liên quan:** [Tổng quan Thư viện](library.md) · [Nhân vật](npc-cast.md)

# Phòng ý tưởng của Thư viện

**Nơi chốn:** một phòng đọc nhỏ trên gác Thư viện, có bảng ghim và đèn bàn. Cửa mở sau khi người chơi đạt sao 1 ở L1. Mỗi lần xong một level của Thư viện, phòng có thêm câu hỏi mới (mục 2).

**Mục đích:** biến điều vừa chơi thành một **thẻ ý tưởng cho dự án của chính người học**, đủ cụ thể để mai làm thử được. Không chấm sao, không có đúng sai.

## 1. Luồng (10–15 phút)

| # | Bước | Người học làm | Hệ thống làm |
|---|---|---|---|
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
1. Phòng ý tưởng cần vai trò giáo viên, lưu thẻ phía server và quyền riêng tư cho thẻ (người học có thể ghi tên dự án thật). Không thuộc v0.1.
2. v1 dùng luật tất định để chọn câu Socratic. Có muốn cô Lan diễn đạt lại bằng LLM rẻ không? Research §1.1 khuyên prompt NPC ngắn và tách khỏi agent được chấm. Phải tính chi phí, và lời diễn đạt lại không được thêm phán xét.
3. Thẻ có được chia sẻ ẩn danh trong lớp (kho ý tưởng) không?
