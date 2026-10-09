> **Trạng thái:** kịch bản v0.1 (2026-10-08), chưa xây ([roadmap-v0.4](../../design/roadmap-v0.4.md) N25; xây ở T19). Trạm vận hành là ứng viên khu 5 ([đặc tả §5](../../specs/2026-10-07-v-game-design.md#5-nội-dung)).
> **Nguồn:** Ngày 12 (API gateway: rate limiting, cost protection; health check; cold start serverless 5–15 s, bản trích tr. 48); Ngày 13 (vì sao P99 quan trọng hơn trung bình, SLO); đề cương kỳ thi AWS Certified Generative AI Developer Professional ([AIP-C01](https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.md)), [Domain 2](https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01-domain2.md): circuit breaker, exponential backoff, rate limiting, fallback để xuống cấp êm; OWASP Top 10 cho ứng dụng agent (12/2025), ASI08 lỗi dây chuyền ([Giskard](https://www.giskard.ai/knowledge/owasp-top-10-for-agentic-application-2026)); URL lấy từ [báo cáo nghiên cứu 2](../../research/lesson-visualization.md). Tham số mặc định chép từ bộ giới hạn thật của engine ([engine-v0.2](../../design/engine-v0.2.md) §14; §5.7 còn ghi 503 được thử lại một lần trên cùng model, đã cũ: bản đúng là §14).
> **Liên quan:** [Nhân vật](npc-cast.md) (anh Tùng) · [Ca trực §3](daily-shift.md#3-quỹ-chạy-thật-theo-ngày) (cùng bộ giới hạn, nhìn từ phía người chơi)

# Trạm vận hành · Giờ cao điểm

**Tem ở tiêu đề level:** "Mô phỏng". Level không gọi AI: mọi con số đến từ một mô phỏng có seed chạy trong trình duyệt. Sao vẫn tất định.

**Vì sao level này đáng làm:** Ngày 12 và 13 chưa có màn nào. Mặc định của mô phỏng chép đúng bộ giới hạn của chính V-Game (cửa sổ trượt 62 giây, model chính 15 lời gọi mỗi phút, rơi xuống model dự phòng chậm hơn), nên người chơi học vận hành trên chính hạ tầng của game đang chơi. Ở Lật mặt sau, cấu hình thật của engine được đặt cạnh lời giải của người chơi, kèm những núm mà engine chưa có (mục 7).

## 1. Metadata

| Trường | Giá trị |
|---|---|
| Mã level | `ops-rush-hour`, loại `simulation` (chạy ở client) |
| Nơi chốn | Trạm vận hành: phòng máy nhỏ của trường, một bảng đèn lớn, quạt chạy rì rì |
| NPC | Anh Tùng, trực vận hành |
| Mở khi | Đạt sao 1 ở Thư viện L1 (người chơi đã thấy một lượt chạy thật, và có thể đã thấy câu "Dịch vụ AI đang quá tải" nếu từng gặp `llm_unavailable`; sửa 2026-10-08) |
| Thời lượng | 8–10 phút |
| Lời gọi | 0 |

## 2. Mục tiêu học

1. Thử lại ngay lập tức, không giãn cách và không jitter, biến một đợt quá tải thành bão: mọi người cùng thử lại cùng lúc.
2. Trần theo từng người (rate limit) bảo vệ mọi người khỏi một người dùng chạy loạn.
3. Model dự phòng cứu được lượng, nhưng đổi độ trễ và token; chỉ chuyển khi còn đủ thời gian.
4. Đo đuôi (P95, P99) và SLO, không đo trung bình.

**Hiểu lầm nhắm tới:** "lỗi thì cứ thử lại cho tới khi được"; "đông người thì chỉ cần model mạnh hơn"; "thời gian trả lời trung bình 4 giây là ổn".

## 3. Mồi truyện và Hiện trường

19:00, đêm mở đăng ký học phần. 30 sinh viên cùng hỏi trợ lý tra cứu quy chế; một sinh viên chạy script hỏi một câu mỗi 2 giây. Bảng đèn ở Trạm vận hành đỏ rực; màn hình quầy tra cứu hiện đúng câu của engine: "Dịch vụ AI đang quá tải hoặc hết lượt hôm nay, lượt này không tính."

- Anh Tùng: "Máy không sập vì đông người. Máy sập vì ai cũng bấm lại cùng một lúc."

Người chơi bấm vào bảng đèn: màn Tua lại chạy mô phỏng của cấu hình khởi đầu, có tem "Mô phỏng".

## 4. Mô hình mô phỏng

Hàm thuần `simulate(config, seed) → events[]`, mô phỏng sự kiện rời rạc 10 phút (19:00–19:10), dùng bộ sinh số ngẫu nhiên có seed, chạy dưới 50 ms ở client. Cùng `config` và `seed` luôn cho cùng kết quả.

| Thành phần | Mặc định | Nguồn |
|---|---|---|
| Sinh viên thường | 30 người, mỗi người 2–4 câu; câu đầu rải trong 19:00–19:03, câu sau cách 20–60 s (thời gian đọc) | soạn cho level |
| Người dùng chạy loạn | 1 người, một câu mỗi 2 s trong 3 phút, từ 19:01 | soạn cho level |
| Mỗi câu | 1 lời gọi LLM | đơn giản hoá |
| Model chính | 15 lời gọi trong cửa sổ trượt 60 s phía provider; vượt thì trả 429 kèm thời gian chờ | engine §14 (`gemini-3.5-flash-lite`, 15/phút) |
| Model dự phòng | 15 lời gọi/phút; chậm hơn model chính; output nhiều hơn khoảng 15 % | engine §14 (trung vị 478 so với 411 token mỗi lời gọi) |
| Lỗi 503 | 2 % số lời gọi, ngẫu nhiên theo seed | soạn cho level |
| API ngủ | Lúc 19:00 API đang ngủ; thức dậy mất 60 s trừ khi đã được đánh thức | [deploy.md](../../deploy.md) (Render free, khoảng một phút) |
| Hạn mỗi câu (SLO) | 20 s | engine: 20 s mỗi ca |
| Trần ngày | 500 lần gọi provider | `DAILY_LLM_CALL_CAP` |

Độ trễ của từng model lấy từ log thật của engine lúc build (trung vị và đuôi), không đoán tay; trước khi có log, dùng số tạm và ghi "tạm" trong Lật mặt sau. Cổng hiệu chỉnh của mô phỏng: lời giải mẫu đạt 3 sao trên mọi seed ẩn, và mỗi cấu hình ngây thơ trượt đúng sao dự định.

## 5. Đồ chơi → cấu hình

| Đồ chơi | Trường cấu hình | Giá trị |
|---|---|---|
| Chuông đánh thức | `warmup` | bật: trang tự gọi `/api/health` khi mở (như trang chủ thật) |
| Cửa xoay | `per_user_limit` | tắt, hoặc 1–10 câu mỗi phút cho mỗi người |
| Đồng hồ cát | `retry` | `max` 0–5; `backoff_s` 0, 1, 2, 4 (nhân đôi mỗi lần); `jitter` bật/tắt; `respect_retry_after` bật/tắt |
| Cầu dao | `breaker` | tắt, hoặc mở sau 1–10 lỗi liên tiếp, mở trong 10–60 s |
| Ray dự phòng | `fallback` | tắt, hoặc chuyển sang model dự phòng khi model chính trả 429/503; `min_time_left_s` 0–20 |
| Quầy chờ | `queue_max_wait_s` | 5–30 s; quá hạn thì trả câu "đang quá tải" ngay thay vì để người dùng chờ |

## 6. Bảng giờ cao điểm (trực quan)

Theo luật [frontend architecture §8](../../design/frontend-architecture.md#8-trực-quan-hoá-luật-chốt-2026-10-08): bảng là giao diện chính, hình là lớp phủ, tem "Mô phỏng".
- **Bảng theo phút** (mặc định ở 375 px): mỗi phút một hàng, cột là số câu tới, số câu được trả lời trong 20 s, số 429, số lần thử lại, số lời gọi rơi sang model dự phòng.
- **Lớp phủ ở màn rộng:** đồng hồ RPM chạm vạch 15; sóng thử lại vẽ như tiếng vang sau mỗi đợt 429; người dùng chạy loạn là một làn riêng; vạch SLO 20 s trên dải thời gian chờ.
- **Thẻ số:** tỉ lệ câu của sinh viên thường được trả lời trong 20 s; P50, P95, P99 thời gian chờ; số lần gọi provider và phần trần ngày đã tiêu.
- Thanh kéo của mọi núm là `<input type="range">` gốc; kéo xong thì mô phỏng chạy lại ngay (0 lời gọi), bóng mờ của lần trước giữ lại để so.

## 7. Chấm và sao

Người chơi nghịch trên **seed mẫu**. Sao chấm trên **3 seed ẩn** (giống ca ẩn: không hiện chi tiết từng seed, chỉ hiện tổng), để cấu hình không chỉ khớp một kịch bản.

| Sao | Điều kiện (trên cả 3 seed ẩn) |
|---|---|
| 1 | ≥ 90 % câu của sinh viên thường được trả lời trong 20 s |
| 2 | **Ngân sách:** số lần gọi provider (gồm mọi lần thử lại) ≤ 1,3 × số câu được trả lời; không có bão thử lại, tức là không phút nào có quá 5 lần thử lại, bằng một phần ba trần 15 lời gọi/phút của model chính (lần thử lại là gửi lại cùng câu tới cùng model, chuyển sang model dự phòng không tính; ngưỡng chốt lại ở cổng hiệu chỉnh của mô phỏng) |
| 3 | **An toàn hai chiều:** người dùng chạy loạn nhận không quá 3 câu mỗi phút **và** không sinh viên thường nào bị Cửa xoay chặn |

Sao 2 và 3 chỉ tính khi đã có sao 1. Mọi bẫy là [T]: mô phỏng tất định theo seed.

**Cấu hình ngây thơ phải trượt:**

| Mã | Cấu hình | Trượt vì |
|---|---|---|
| G-N1 | Thử lại 5 lần, giãn cách 0, không jitter | Bão thử lại: 429 dồn theo đợt, trần ngày cháy nhanh, P95 vượt 20 s |
| G-N2 | Không Cửa xoay | Người dùng chạy loạn chiếm phần lớn 15 lời gọi/phút; sinh viên thường chờ quá 20 s |
| G-N3 | Ray dự phòng với `min_time_left_s` = 0 | Câu trả lời của model chậm về sau 20 s, vẫn tính trượt SLO mà vẫn tốn lời gọi |
| G-N4 | Cầu dao mở sau 1 lỗi, mở 60 s | Một lỗi 503 lẻ đóng cửa cả trạm một phút |
| G-N5 | Cửa xoay 1 câu/phút | Chặn oan sinh viên hỏi câu tiếp theo; trượt sao 3 |
| G-N6 | Không Chuông đánh thức | Mọi câu trong phút đầu chờ API thức dậy; trượt SLO ngay đợt đầu |

**Lời giải mẫu:** Chuông bật; Cửa xoay 3 câu/phút; Đồng hồ cát không thử lại 429 mà tôn trọng thời gian chờ, thử lại 503 một lần sau 1 s có jitter; Ray dự phòng bật, `min_time_left_s` 15; Cầu dao mở sau 5 lỗi liên tiếp, mở 30 s; Quầy chờ 20 s.

Lời giải mẫu **không** phải cấu hình của engine V-Game. Nó dùng cả các núm mà engine chưa có; Lật mặt sau đặt hai bên cạnh nhau:

| Núm | Engine V-Game ([engine-v0.2](../../design/engine-v0.2.md) §14) |
|---|---|
| Chuông đánh thức | Giống: trang chủ gọi `/api/health` khi mở ([deploy.md](../../deploy.md)) |
| Ray dự phòng | Giống: 429 hoặc 503 thì model nghỉ theo thời gian chờ của lỗi (không có thì 60 s) rồi lời gọi chuyển sang model sau trong chuỗi; không gọi model nếu thời gian còn lại của ca dưới `MIN_CALL_S` (4 s model chính, 15 s model dự phòng) |
| Đồng hồ cát | Khác: engine không thử lại 429 hay 503 trên cùng model (chuyển model thay vì thử lại); chỉ 500 và 502 được thử lại một lần trên cùng model; không backoff nhân đôi, không jitter |
| Giới hạn chung | Giống phần mặc định của mô phỏng: cửa sổ trượt 62 s mỗi model, model chính 15 lời gọi/phút, `DAILY_LLM_CALL_CAP` 500, `MAX_CONCURRENT_RUNS` 1 |
| Cửa xoay | Engine chưa có: không giới hạn theo người dùng, chỉ có trần chung |
| Cầu dao | Engine chưa có |
| Quầy chờ | Engine cố ý không có hàng đợi cục bộ: run thứ hai nhận 429 ngay |

Ba núm cuối là phần mở rộng để dạy: một gateway production nên có, V-Game thì chưa cần ở quy mô một lớp.

## 8. Chẩn đoán và gợi ý

Mọi câu là mẫu câu điền số từ mô phỏng.

| Tình huống | Anh Tùng nói |
|---|---|
| Bão thử lại | "Phút {m} có {a} lần thử lại cho {b} câu. Cứ mỗi đợt 429 là một đợt gọi lại đúng lúc máy còn đang nghẹt." |
| Người chạy loạn chiếm chỗ | "Một người dùng {c} trong {d} lời gọi của phút {m}. Ba mươi người còn lại xếp hàng sau anh ta." |
| Trả lời trễ qua model dự phòng | "{e} câu được trả lời sau 20 s. Model dự phòng có trả lời, chỉ là lúc đó người hỏi đã đi rồi." |
| Trung bình đẹp, đuôi xấu | "Trung bình {f} s, nhưng P99 là {g} s. Người chờ lâu nhất mới là người nhớ trải nghiệm này." |

**Gợi ý** (thang N16: mở theo yêu cầu sau lần chấm đầu; nấc sau mở khi người chơi đã kéo một núm và xem lại mô phỏng). Gợi ý 3 đưa núm lời giải, nên đi qua **cổng gợi ý 3** ở [overview §4](overview.md#4-các-luật-dùng-chung-cho-mọi-kịch-bản) luật 5 (sửa 2026-10-08, X28): level 0 lời gọi, nên chỉ mở sau lần chấm trượt thứ ba ở cùng sao (chấm trên 3 seed ẩn), trên ba cấu hình khác nhau (chấm lại khi không đổi núm nào cho đúng kết quả cũ và không đếm), khi người chơi đã nhìn thêm sau gợi ý 2.
1. "Phút nào có nhiều 429 nhất? Ngay sau phút đó có chuyện gì?"
2. Bảng theo phút tô đậm cột "lần thử lại" cạnh cột "câu tới".
3. "Giãn cách lần thử lại, thêm jitter, và đặt Cửa xoay vài câu mỗi phút."

**Bài biến thể sau gợi ý 3:** một seed biến thể có hình dạng tải khác (hai người dùng chạy loạn, API đã thức sẵn, lỗi 503 ở 5 % số lời gọi). Người chơi phải đạt sao đang trượt trên seed này mà không gợi ý; như seed ẩn, chỉ hiện tổng.

## 9. Lật mặt sau: Ngoài đời thật

Bảng cấu hình thật của engine V-Game ([engine-v0.2](../../design/engine-v0.2.md) §14), đặt cạnh lời giải của người chơi:
- Mỗi model có cửa sổ trượt 62 s (60 s của provider cộng 2 s biên); model chính 15 lời gọi/phút.
- Không thử lại 429: thử lại sau 1 s sẽ chạm đúng giới hạn. Model bị 429 hoặc 503 nghỉ theo thời gian chờ của lỗi rồi nhường lời gọi cho model sau trong chuỗi.
- Không gọi model nếu không đủ thời gian còn lại của ca (4 s cho model chính, 15 s cho model dự phòng).
- `DAILY_LLM_CALL_CAP` 500 đếm mọi lần gọi mạng; hạn mức ngày của provider hồi lúc nửa đêm giờ Thái Bình Dương.
- Ngoài đời: với P99 = 5 s, một phiên 10 lượt chat có xác suất 1 − 0,99¹⁰ ≈ 9,6 % gặp ít nhất một lượt chậm hơn 5 s (Ngày 13, slide 18/96 "Percentile Math"; bài vi mô "P99 của 10 lượt chat", T23; sửa 2026-10-08).

## 10. Level thứ hai của khu (phác thảo): Phòng điều khiển

- **Mồi:** 14 ngày telemetry tổng hợp của trợ lý tra cứu, có ba sự cố chôn trong đó (tăng độ trễ dần, tỉ lệ từ chối nhảy vọt sau một lần nạp dữ liệu, hoá đơn tăng do một nhãn metric).
- **Người chơi làm:** ghép luật cảnh báo từ menu (ngưỡng, cửa sổ, burn rate nhiều cửa sổ, đo chất lượng như một metric).
- **Sao:** 1 = bắt cả ba sự cố; 2 = thời gian phát hiện trung bình dưới mục tiêu; 3 = không quá một báo động giả trong 14 ngày.
- **Rủi ro lớn nhất:** telemetry tổng hợp phải đủ thật để không dạy sai. Báo động ở đây mở phòng đọc trace ([roadmap X25](../../design/roadmap-v0.4.md#3-các-xung-đột-đã-gỡ)).

## 11. Kỹ thuật, telemetry và câu hỏi mở

- **`zones.json`** (`backend/src/vgame/content/data/zones.json`, nguồn duy nhất của nội dung khu): khi Trạm vận hành được chốt làm khu 5, thêm khu, vị trí trên campus và level `ops-rush-hour` (sửa 2026-10-08).
- **Kỹ thuật:** `simulate` là hàm thuần trong frontend, có test đơn vị: cùng seed cho cùng kết quả; lời giải mẫu đạt 3 sao trên 3 seed ẩn; mỗi cấu hình ngây thơ trượt đúng sao ở bảng mục 7. Không cần API, nên level chơi được cả khi Render đang ngủ. Seed ẩn nằm trong mã client: chấp nhận được với một level luyện tập không dùng để thi.
- **Telemetry:** `rush.open` → `knob.change{toy, value}` → `sim.run{seed: "mau"}` → `grade{s1, s2, s3}` → `backside.open`.
- **Câu hỏi mở:**
  1. Lấy độ trễ thật của từng model từ log engine (cần bật ghi `ms` theo model khi chạy pilot).
  2. Có cho người chơi xem chi tiết một seed ẩn sau khi đạt 3 sao không? Đề xuất: không, như ca ẩn.
