> **Trạng thái:** kế hoạch đề xuất v0.1 (2026-11-02), **chưa duyệt**. Tổng hợp sáu hướng nghiên cứu chạy song song cùng ngày: cơ chế game, bằng chứng học tập, nợ kỹ thuật, đường tới W2, ảnh chụp giao diện thật, đo lường pilot. Mỗi mục ghi nguồn; chỗ nào là suy luận thì ghi "suy ra".
> **Đi trước:** [interactive-levels-v0.6](interactive-levels-v0.6.md) (đề xuất màn và tương tác), [evidence-dossier](../research/evidence-dossier.md), [roadmap-v0.4](roadmap-v0.4.md), [watchtower](../content/scenarios/watchtower.md).

# Kế hoạch nâng cấp v0.7

## 1. Kết luận ngắn

- **Việc chặn buổi pilot:** máy chủ không lưu gì qua lần khởi động lại, và không có giới hạn theo người gọi. Một script có thể giữ chỗ chạy duy nhất và tiêu hết quỹ 500 lời gọi/ngày trước giờ học.
- **Đòn bẩy học tập rẻ nhất:** đưa người chơi từ "bấm" lên "đoán và giải thích", không tốn lời gọi AI. Bằng chứng mới cho điều này mạnh hơn dossier hiện có (mục 3).
- **Giao diện:** ảnh chụp thật cho thấy nút Mở ca không bao giờ lên màn đầu, trang kết quả dài 6.000–10.000 px, và cỗ máy bị cắt mất phần bài học ở 375px.
- **W2:** cần khoảng 8 PR, trong đó phải đổi định dạng index (dựng lại index cho mọi level), cùng 6 quyết định của chủ dự án.

## 2. Đã sửa ngay trong đợt này

| Việc | Nguồn | PR |
|---|---|---|
| Kết quả W1 hiện mã engine (`no_wrong_refund`, `ledger.refund_wrong`, `hoan-trong-hop-le`…) thay vì tiếng Việt | Ảnh chụp | `fix/w1-results-labels` |
| Sao 1 của W1 ghi "câu #1 (chị Thảo): Trượt" trong khi câu #1 đạt; đúng ra là câu #9 | Ảnh chụp | như trên |

## 3. Bằng chứng mới (đã đối chiếu DOI qua OpenAlex)

Mức **A**: đã đọc abstract, mọi con số dưới đây lấy từ abstract. Chưa đọc toàn văn. Theo quy ước dossier §9, phải đọc toàn văn sáu bài in đậm trước khi đưa số cho giảng viên.

| Khoảng trống | Nguồn chính | Điều đổi trong thiết kế |
|---|---|---|
| Hiệu ứng mới lạ | **Rodrigues 2022** (10.1186/s41239-021-00314-6): N = 756, 14 tuần; hiệu ứng gamification giảm sau 4 tuần, hồi một phần ở tuần 6–10 | Kiểm tra lại sau **≥ 4 tuần**, không chỉ 1–2 tuần như dossier §6.4. Coi hứng thú buổi đầu là tín hiệu mới lạ, không phải kết quả |
| Hiệu chỉnh tự tin | **Janssen & Lazonder 2024** (10.1007/s10648-024-09936-4): 35 nghiên cứu, g = 0,25; đặt chuẩn bên ngoài thì có ích, đổi thời điểm phán đoán thì hại | Luôn đặt cược cạnh kết quả thật; hỏi mức chắc ngay sau lời đoán; kỳ vọng hiệu ứng nhỏ |
| Gợi ý | **McLaren 2021** (10.1016/j.compedu.2021.104366): game Decimal Point, trên lớp bản *không* gợi ý tốt hơn ở hậu kiểm trễ; Atkinson 2003 (10.1037/0022-0663.95.4.774): rút dần kèm câu "nguyên lý nào?" có hiệu ứng vừa đến lớn | Mỗi nấc gợi ý kèm câu hỏi gọi tên nguyên lý; chạy chế độ gợi ý thành một nhánh A/B ở pilot |
| Dạy lại NPC | **Kobayashi 2019** (10.1111/jpr.12221): dạy sau khi chuẩn bị g = 0,56, lớn hơn khi tương tác; **Jin 2024** (10.1145/3613904.3642349): tutee LLM bị giới hạn kiến thức, hỏi "vì sao" | NPC phải là học trò có hiểu lầm soạn sẵn và hỏi vặn; cho NPC *chạy* cấu hình người chơi dạy (Okita & Schwartz 2013) |
| Đoán và tự giải thích | **Mayer & Johnson 2010** (10.2190/EC.42.3.a): chọn nguyên lý từ danh sách d = 0,91, cộng phản hồi giải thích d = 1,03; Crouch 2004 (10.1119/1.1707018): xem minh hoạ thụ động không hơn không xem, đoán trước thì hơn | Menu "Vì sao câu #N sai?" nên là bước mặc định (xem quyết định Q2) |
| Game dạy prompt, bảo mật LLM, RAG | **Không tìm thấy** nghiên cứu có đối chứng. Ng 2024 (10.1111/jcal.13009): game hiểu biết AI tăng khái niệm nhưng *không* tăng áp dụng, đánh giá, sáng tạo | Giữ nguyên lời cảnh báo của dossier; bài chuyển giao ngoài game là bắt buộc |

## 4. Kế hoạch theo đợt

Mỗi dòng là một PR cỡ S (dưới 1 ngày), M (2–4 ngày) hoặc L (từ 1 tuần). Thứ tự trong đợt là thứ tự đề xuất.

### Đợt 0: sửa nhanh, không cần quyết định

| # | Việc | Cỡ | Nguồn |
|---|---|---|---|
| 0.1 | `test_static_viz` đỏ trên macOS: một điểm float32 đúng biên làm tròn (0,80794990 → 0,8079, file ghi 0,808) do BLAS khác CI. Cộng dồn float64 trước khi làm tròn, rồi xuất lại | S | Nợ kỹ thuật, đã xác minh |
| 0.2 | Gộp hai thẻ chẩn đoán trùng của câu #9 W1 (`ledger.refund_wrong` và `hitl.bypassed`) thành một | S | Ảnh chụp |
| 0.3 | Trang khu: level "Sắp mở" có nền nhạt, viền đứt; bài khởi động thành dòng 0 trước Cổng thành | S | Ảnh chụp |
| 0.4 | Thẻ **"Nhân quy mô"** trên mỗi lượt có sao: token thật × giá × N khách/ngày = hoá đơn tháng, gắn nhãn "ước tính". Lấp Ngày 1 mà không cần mở khu Chợ | S | Cơ chế game (kiểu bảng sản lượng) |
| 0.5 | Một nguồn cho danh sách level: `static_viz.py`, `recorded.py`, `fakes_oracle.py`, `test-fixtures.ts` đang chép tay | S | Nợ kỹ thuật |

### Đợt 1: sẵn sàng pilot

| # | Việc | Cỡ | Ghi chú |
|---|---|---|---|
| 1.1 | Giới hạn theo IP cho `POST /api/runs` và `/api/quota/refund`, kèm vị trí hàng chờ (X27) | S–M | Chặn một script tiêu hết quỹ |
| 1.2 | Lưu bền (T1): bộ nhớ phát lại, `DailyCap`, quỹ R | M–L | **Cần quyết định Q1** (`render.yaml` cấm cơ sở dữ liệu) |
| 1.3 | Nút **"Tải dữ liệu buổi học"**: CSV từ các khoá `vg.*` của trình duyệt, đồng ý trước, mã ngẫu nhiên 6 ký tự ghi lên phiếu giấy | S | Không hạ tầng mới. Bản thiết kế sự kiện: mục 5 |
| 1.4 | Lượt đã ghi cho W1 (mở rộng `recorded.py` cho quầy) | M | W1 chơi được khi API đang ngủ |
| 1.5 | Kiểm chế độ máy chiếu (R1–R10, axe ở 1280×720) | S | Phần lớn đã xây |
| 1.6 | Phiếu tiền/hậu kiểm W1, 4 câu × 2 dạng, giảng viên duyệt | S | Bản nháp có trong báo cáo đo lường; Thư viện đã có `library-assessment.json` |
| 1.7 | Đo SSE qua rewrite của Vercel và số lượt mỗi phút (hoàn tất B0) | S | |

### Đợt 2: đẩy bước học lên "đoán và giải thích" (0 lời gọi)

| # | Việc | Cỡ | Bằng chứng |
|---|---|---|---|
| 2.1 | Menu "Vì sao" và phiếu đoán thành bước mặc định, vẫn có nút bỏ qua | S | Mayer & Johnson 2010; Crouch 2004. **Q2** |
| 2.2 | Mỗi nấc gợi ý kèm câu "nguyên lý nào?"; nấc 3 rút từ cuối lời giải | M | Atkinson 2003; Renkl 2002 |
| 2.3 | **Sổ truy vết** sau mỗi lượt có sao: gắn mỗi câu trượt với món gây lỗi (menu đóng); chỉ xác nhận khi đúng 3 câu một lúc, để chặn đoán mò | S–M | Cơ chế game; tự giải thích |
| 2.4 | Đường hiệu chỉnh tự tin của chính người chơi qua các lượt | S | Janssen & Lazonder 2024; Lee 2025 |

### Đợt 3: bàn thợ và trang kết quả (theo ảnh chụp)

| # | Việc | Cỡ |
|---|---|---|
| 3.1 | Nút Mở ca luôn trong tầm tay: cột phải dính chỉ còn nút và dòng quỹ; trên điện thoại là thanh dính ở đáy | M |
| 3.2 | Trang sau lượt chạy: sao → một thẻ chẩn đoán → nút chạy lại và gợi ý; "Từng câu" thành lưới 12 ô bấm để mở | M |
| 3.3 | Cỗ máy ở 375px: vừa chiều ngang, hoặc cuộn sẵn tới ổ trống đầu tiên (hiện cắt mất Vòm Sao ở L1 và Bàn hoàn tiền ở W1, chữ khoảng 7px) | M–L |
| 3.4 | Tách nút bước khỏi nút bật tắt Nhãn và Nhìn xuyên; bỏ thừa khoảng trống trên cỗ máy; một tỉ lệ cho mọi level | S–M |
| 3.5 | Bài vi mô: bốn mức thành thang có bậc màu; sửa tương phản của mức đã chọn sau khi chấm | S–M |
| 3.6 | Đầu trang trên điện thoại: nhãn quay lại ngắn hơn, nút giao diện chỉ còn biểu tượng dưới `sm` | S |

Lưu ý: gói `/play` còn 4,45 kB so với ngân sách 300 kB. Mọi việc ở cảnh khuôn viên phải tách `CampusScene` trước (M).

### Đợt 4: nội dung

| # | Việc | Cỡ | Ghi chú |
|---|---|---|---|
| 4.1 | **W2 Tài liệu độc**, 8 PR: test fan-in → đánh dấu chữ ẩn và nâng `FORMAT` index → `doc_guard`, `pii_filter` → quầy có `context`, `tool_email`, sổ tổng quát → nội dung → API có index → frontend dạng gộp → hiệu chỉnh | L | **Q3** (6 câu). Khung câu nhắc và schema của W1 phải giữ nguyên từng byte, nếu không lượt đã ghi và hiệu chỉnh của W1 mất hiệu lực |
| 4.2 | **W3**: mỗi lần bị xuyên, đích thêm một lớp phòng thủ; có "bắn nháp" miễn phí cho biết lớp nào chặn (điểm Chó gác tính sẵn cho khoảng 90 tổ hợp thẻ, suy ra) | M | Cơ chế game |
| 4.3 | **Bản tin ca trực**: mỗi ngày thêm một kiểu đòn mới (bỏ dấu, base64, chẻ lượt); chạy nháp lớp lọc miễn phí; dải hồi quy phải xanh | M | Cơ chế game; hợp quỹ 13 lời gọi/ngày |
| 4.4 | Histogram cả lớp theo từng chỉ số (token, chặn nhầm), không xếp hạng | M | Cần nơi lưu chung (Q1) |
| 4.5 | Khung bài vi mô dùng registry, rồi sáu bài B8 | S–M | Hiện route cố định một bài |

**Không làm:**
- **Ô gõ tự do để tấn công:** mỗi lần thử tốn một lời gọi, và trái X10.
- **Chấm điểm theo số token kiểu thi prompt:** thưởng việc viết prompt ngắn hơn, không thưởng hiểu vì sao lớp lọc thủng.
- **Tải tăng dần vô hạn:** cần mô phỏng giả và vòng lặp hoạt ảnh.

## 5. Nhật ký sự kiện tối thiểu cho pilot (đề xuất)

Mọi sự kiện có chung một vỏ `{pid, arm, buoi, t_min, level, type}`:
- `pid`: UUID ngẫu nhiên, chỉ tạo sau khi người học đồng ý, hiện thành mã 6 ký tự để chép lên phiếu giấy.
- `arm`: A hoặc B, qua tham số URL do giảng viên phát.
- `t_min`: thời điểm làm tròn tới phút.

**Không bao giờ thu:** tên, email, IP trong dữ liệu của app, user agent, chữ gõ tự do, câu hỏi của câu ẩn và câu bẫy. Log của Render vẫn thấy IP, phải nói rõ với người học.

| Câu hỏi pilot | Sự kiện | Hiện có |
|---|---|---|
| Độ đúng và hiệu chỉnh của lời đoán | `slip.graded{star, bet, correct}` | Có chấm ở trình duyệt, chưa lưu theo lượt |
| Gợi ý và kết quả học | `hint.open` nối `run.end{stars}` | Có trong `vg.hints.v1`, thiếu xuất |
| W1: lưới quá rộng ở lượt đầu, có sửa sau `guard.blocked_benign` không | `run.end{labels, phrases_n, stars}` | Lịch sử chưa giữ nhãn |
| Cả lớp thử gì tiếp | `debrief.next` | Có trong `vg.history.v1` |
| Quỹ hết, hoàn lượt | `quota.empty{pool}`, `quota.refund` | Có route, thiếu sự kiện |

**Cần kiểm trước pilot (suy ra):** luật bảo vệ dữ liệu cá nhân của Việt Nam. Báo cáo đo lường nhớ là Luật 91/2025/QH15, hiệu lực 1/1/2026, nhưng chưa xác minh. Mã ngẫu nhiên nối với phiếu giấy vẫn có thể là dữ liệu cá nhân, nên xoá phần nối sau khi phân tích.

## 6. Quyết định của chủ dự án

1. **Q1 · Lưu bền.** Postgres miễn phí ngoài Render (Neon hoặc Supabase), hay giữ RAM và chấp nhận mất dữ liệu khi khởi động lại? Ảnh hưởng 1.2 và 4.4.
2. **Q2 · Đoán và "Vì sao" thành bước mặc định?** X4 đã chốt là "không bắt buộc, cho bỏ qua". Đề xuất: hiện sẵn nhưng vẫn có nút bỏ qua.
3. **Q3 · Sáu câu của W2:**
   - (a) `poison.reached_llm` chỉ tính khi chữ ẩn còn trong đoạn tới model? Nếu tính theo `doc_id` thì sao 3 không đạt được.
   - (b) Chấm "trả lời đúng, có nguồn" như Thư viện, hay chỉ "được phục vụ" như W1?
   - (c) Chuông duyệt có gác `tool_email` không?
   - (d) Bẫy số điện thoại có hiệu chỉnh như [M] không?
   - (e) W2 có Lưới và Chó gác của W1 không?
   - (f) Khi nào chấp nhận dựng lại toàn bộ index? Thư viện trả 503 cho tới khi xong.
4. **Q4 · Thời điểm kiểm tra lại ở pilot:** 1–2 tuần như dossier, hay ≥ 4 tuần theo Rodrigues 2022? Đề xuất: cả hai.
5. **Q5 · Chế độ gợi ý thành nhánh A/B ở pilot** (McLaren 2021), cùng với nhánh có hoặc không có phiếu đoán?

## 7. Thứ tự đề xuất

Đợt 0 → 1.1, 1.3, 1.4, 1.5, 1.6 (không cần quyết định) → 2.1–2.3 → 3.1, 3.2 → W2 khi đã có Q3 → phần còn lại.
