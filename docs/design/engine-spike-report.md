# Báo cáo spike engine v0.2: khu Thư viện

> **Trạng thái:** cập nhật 2026-10-08 sau đợt sửa 2: đủ 24 biến thể index với e5 thật, reranker jina-v2 thật, Gemini `gemini-3.5-flash-lite` trả lời được (mục 0.1, 2.4, 3.0b). Các mục 0–2.3 và 3.0 giữ lại làm lịch sử. **Phạm vi:** đo hành vi thật của engine v0.2 ([hợp đồng](engine-v0.2.md)) trên kho quy chế thật và bộ câu hỏi vàng L1–L3.
> **Script:** [`backend/scripts/spike_retrieval.py`](../../backend/scripts/spike_retrieval.py) (truy xuất, không gọi LLM, không tải gì) và [`backend/scripts/spike_llm.py`](../../backend/scripts/spike_llm.py) (Gemini thật, tối đa 40 lần gọi).

## 0. Tóm tắt

**Chưa đo được phần phụ thuộc model.** Có ba lý do:

1. **Model embedding trong cache chưa tải xong.** Báo cáo tích hợp nói multilingual-e5-large "đã cache", nhưng snapshot `qdrant/multilingual-e5-large-onnx@ac6781cd` mới có `model.onnx_data` (2.235.363.328 byte). Còn thiếu `model.onnx` (545.851 byte) và `special_tokens_map.json` (964 byte). Khi chạy offline, fastembed báo `Could not load model intfloat/multilingual-e5-large from any source`.
2. **Reranker** `jinaai/jina-reranker-v2-base-multilingual` chưa tải. Báo cáo tích hợp ước khoảng 1 GB; spike chưa đo con số này.
3. **Chưa có `GEMINI_API_KEY`.** Đối tượng `Settings` báo key chưa cấu hình, và `backend/.env` không tồn tại.

Tải file phải được chủ dự án đồng ý, nên spike không tải gì: script chạy với `HF_HUB_OFFLINE=1`. Vì vậy các cột dense, hybrid và rerank trong báo cáo này còn trống. Hai script đã sẵn sàng: khi đủ model và key, chạy lại theo mục 5 là có số.

**Đo được, không phụ thuộc model:** chunking của cả 24 biến thể, kích thước artifact, BM25 trên mọi cặp ca × biến thể (1.560 dòng), các bẫy cắt biên, và bẫy văn bản cũ ở phía BM25. Phát hiện chính:

- **24 biến thể chỉ cho 17 bộ đoạn khác nhau.** Ở `theo_dieu`, chunk 512 và 1024 cho ra cùng một bộ đoạn, vì điều dài nhất chỉ có 501 token. Overlap không có tác dụng ở `theo_dieu` từ cỡ 256 trở lên.
- **e5 cắt câu vào ở 512 token.** 11–18 đoạn của mỗi biến thể `co_dinh`-512 và `co_dinh`-1024 bị cắt đuôi khi embedding.
- **Bẫy L2-N1 `ret.boundary_split` (v02, h03, h04) cắn tất định**, vì mỗi câu trích dài 161–166 token, lớn hơn 128.
- **L2-N5:** ca v01 và h02 cắn tất định. Ca h01 **không** tất định.
- **BM25 bắt số điều rất chắc**, nhưng ca không dấu `lib-l3-h03` đứng hạng 8, nằm ngoài `bm25_search.top_k = 5` của lời giải mẫu L3.
- **L3-N3** (BM25 top 10 trượt `lib-l3-t01`) cắn tất định: đoạn đúng đứng hạng 48.
- **Văn bản 2019 chiếm hạng 1 ở BM25** với 7/17 ca L2 khi không lọc. Lọc `only_in_force` ở tầng index loại sạch văn bản này.

## 0.1 Tóm tắt đợt sửa 2 (2026-10-08, model thật)

- **Rerank giờ chấm `bm25_text` (tiêu đề "Điều N. …" + nội dung)**, không chấm `c.text` trần. Trước đó đoạn giữa Điều 47 không chứa "47", nên cross-encoder không thể cứu câu tra số điều. Sau sửa, test neo `test_real_models_rank_the_anchor_questions` (rerank đưa Điều 47 lên #1 cho "Điều 47 khoản 2 quy định gì?") **đạt** với `jina-reranker-v2-base-multilingual`, không cần đổi `RERANK_MODEL`.
- **Index:** `uv run vgame-build-index` dựng đủ 24 biến thể (thống kê khớp mục 1.3). `uv run pytest -m slow`: **10 đạt, 4 trượt**. Cả 4 là kỳ vọng nội dung không khớp model thật, không phải lỗi engine; test giữ nguyên, không nới:
  1. Lời giải mẫu L3 chỉ được **2 sao** (s1, s2 đạt; s3 trượt vì `lib-l3-t01`). Xem 2.4.2.
  2. L1-N5 không cắn (dense e5 xếp đoạn đúng hạng 1). Xem 2.4.1.
  3. L2-N1 `ret.gold_missing` ở `lib-l2-v01` không bật. Xem 2.4.3.
  4. L3-N7 `fail` ở `lib-l3-t02` không xảy ra. Xem 2.4.3.
- **Gemini:** `gemini-3.5-flash-lite` (GA, có `thinking_level` low/medium/high) trả lời đủ; lời giải mẫu L1 được 3 sao với 10.262 token (ngân sách 22.000), replay trả đúng usage gốc. Xem 3.0b.

## 1. Index

### 1.1 Cách đo

`IndexStore.build` chạy trên kho thật với embedder giả trả vector hằng 1024 chiều, cùng số chiều với e5-large. Kích thước file `.npy` và `.json` không phụ thuộc giá trị vector, nên số đo kích thước là chính xác. Riêng thời gian dựng với model thật **chưa đo**.

Lệnh: `uv run python scripts/spike_retrieval.py --sizes <thư mục tạm>`.

### 1.2 Số đo

| Mục | Giá trị |
|---|---|
| Model embedding | `intfloat/multilingual-e5-large` qua fastembed 0.8.1 (repo ONNX `qdrant/multilingual-e5-large-onnx`, revision `ac6781cd1cf88b8306a536d7c9d18a5bd57cc14b`), 1024 chiều, truncation 512 token (`model_max_length` trong `tokenizer_config.json`) |
| Reranker | `jinaai/jina-reranker-v2-base-multilingual` (chưa tải) |
| Tokenizer của engine | `regex-v1`. Kho 2024 có 13.278 token, kho 2019 có 1.407 token. Điều dài nhất là Điều 2 bản 2024 (501 token) |
| Artifact (24 biến thể + 47 câu hỏi) | 52 file, 11.682.730 byte: `.npy` 9.219.200 byte (2.203 dòng × 1024 × float32), `.json` 2.463.530 byte |
| Số đoạn cần embedding sau khử trùng | 952 đoạn, tổng 219.112 token `regex-v1`, cộng 47 câu hỏi |
| Thời gian dựng phần không có model | 0,2–0,4 giây |
| Thời gian dựng với e5 thật | **chưa đo** (model chưa đủ file) |

### 1.3 Thống kê đoạn theo biến thể

| Biến thể | Số đoạn | Token trung bình | Tối đa | Ghi chú |
|---|---|---|---|---|
| `co_dinh`-128-0 / 10 / 20 | 115 / 128 / 143 | 127,7 / 126,5 / 127,3 | 128 | |
| `co_dinh`-256-0 / 10 / 20 | 58 / 64 / 72 | 253,2 / 253,7 / 253,5 | 256 | |
| `co_dinh`-512-0 / 10 / 20 | 29 / 32 / 37 | 506,4 / 506,7 / 493,4 | 512 | 11 / 10 / 17 đoạn bị e5 cắt đuôi |
| `co_dinh`-1024-0 / 10 / 20 | 15 / 17 / 18 | 979,0 / 953,8 / 997,2 | 1024 | 14 / 15 / 18 đoạn bị e5 cắt đuôi |
| `theo_dieu`-128-0 / 10 / 20 | 174 / 175 / 175 | 84,4 / 84,6 / 85,3 | 128 | |
| `theo_dieu`-256-* | 117 | 125,5 | 255 | ba overlap cho cùng một bộ đoạn |
| `theo_dieu`-512-* và `theo_dieu`-1024-* | 100 | 146,8 | 501 | sáu biến thể cho cùng một bộ đoạn |

Đoạn "bị e5 cắt đuôi" là đoạn mà chuỗi `"passage: " + embed_text` dài hơn 510 token `regex-v1`. Theo [`constants.py`](../../backend/src/vgame/engine/constants.py), `regex-v1` lệch tokenizer XLM-R của e5 chưa tới 3%.

**Hệ quả:**

- (a) **"Thùng tràn ở 1024" chỉ đúng với `co_dinh`.** Người chơi đổi `theo_dieu` từ 512 lên 1024 sẽ không thấy gì thay đổi.
- (b) **Ở `co_dinh`-1024, dense chỉ "thấy" khoảng nửa đầu mỗi đoạn.** Đoạn đúng nằm ở nửa sau thì dense trượt. Hiện tượng này đúng ngoài đời, nhưng hợp đồng chưa ghi.

## 2. Bẫy truy xuất, chưa dùng LLM

### 2.1 Cách đo

**Hạng của một ca:**

- **Hạng** = vị trí (tính từ 1) của đoạn đầu tiên chồng lên một `quote` vàng. Định nghĩa này giống `grading._rank`.
- **Hạng "đủ"** = vị trí mà tới đó mọi `quote` của ca đều đã được phủ, tức số lớn nhất trong các hạng của từng `quote`. Dùng cho ca có nhiều câu trích.
- Xếp hạng tính trên **toàn bộ** handle (`top_k=None`) để thấy hạng thật, rồi so với `top_k` của từng cấu hình.

**Corpus theo level:**

| Level | Corpus | Chạy `only_in_force` |
|---|---|---|
| L1 | `qcdt-2024` | không cần |
| L2 | `qcdt-2024` + `qcdt-2019` | cả hai giá trị `false` và `true` |
| L3 | `qcdt-2024` (D7) | không cần |

**Các cột:**

| Cột | Cách tính | Đã đo? |
|---|---|---|
| `bm25` | BM25Okapi trên `bm25_text` (tiêu đề điều + nội dung đoạn), tokenizer `\w+` giữ dấu và chữ số | **đã đo** |
| `dense` | cosine | chưa đo (cần index thật) |
| `rrf_full` | RRF k=60 trên hai danh sách đầy đủ | chưa đo |
| `alpha05_full` | trộn alpha 0,5 trên hai danh sách đầy đủ | chưa đo |
| `rrf_5_5_10` | RRF như lời giải mẫu L3: vector top 5 + BM25 top 5, giữ 10 | chưa đo |
| `alpha08_5_5` | alpha 0,8 như L3-N6 | chưa đo |
| `rerank_rrf10` | rerank 10 đoạn của `rrf_5_5_10` | chưa đo |

**Kiểm cắt biên, không phụ thuộc model:**

- `whole`: mọi `quote` nằm trọn trong một đoạn nào đó. Nếu sai thì bật `ret.boundary_split`.
- `touch1`: có một đoạn chạm tới mọi `quote` của ca. Nếu sai thì `top_k=1` chắc chắn bật `ret.gold_missing`.

### 2.2 Đối chiếu các tuyên bố của kịch bản

Ký hiệu: **T✓** = cắn tất định, đã kiểm. **T✗** = tuyên bố là T nhưng đo thấy không tất định. **M** = phụ thuộc model. **?** = cần dense hoặc rerank, chưa đo.

| Tuyên bố | Cấu hình | Đo được | Kết luận |
|---|---|---|---|
| **L1-N5:** ca diễn đạt lại v03, h04, h05 có đoạn đúng ở hạng dense ≥ 2, nên `top_k=1` trượt | `theo_dieu`-512-10, vector top 1 | BM25 tham khảo: v03 hạng 8, h04 hạng 3, h05 hạng 3 (ít trùng chữ, đúng ý đồ). Dense chưa đo | **?** Phải đo bằng e5. Nếu dense xếp hạng 1 thì bẫy không cắn |
| **L2-N1 `ret.boundary_split`:** v02, h03, h04 | `co_dinh`-128-0 | Câu trích dài 166 / 161 / 163 token, lớn hơn 128. Ở mọi biến thể cỡ 128 (`co_dinh` và `theo_dieu`), không đoạn nào chứa trọn câu trích | **T✓**, không phụ thuộc vị trí cắt. Cờ còn bật thêm ở h01, h02, h05, r04 do vị trí cắt cụ thể của kho này. Test đang chấp nhận ca thừa |
| **L2-N1 `ret.gold_missing`:** v01 | `co_dinh`-128-0, vector top 3 | Hai câu trích (k2, k3) phải phủ trong 170 token. Không đoạn nào chạm cả hai (`touch1=False`), nên cần đủ hai đoạn trong top 3. Ở BM25, hai đoạn đứng hạng 1 và 3 (vẫn phủ đủ) | **M** trên thực tế: cắn hay không tuỳ dense có kéo đủ hai đoạn vào top 3 |
| **L2-N5 `ret.gold_missing`:** v01, h01, h02 | `co_dinh`-256-20, `only_in_force`, top 1 | v01 và h02: không đoạn nào chạm mọi câu trích. h01: **có** một đoạn chạm cả k2 lẫn k3 | v01, h02 **T✓**. h01 **T✗**: chỉ trượt khi dense không xếp đoạn đó hạng 1. Đề xuất: bỏ h01 khỏi `cases` hoặc tách thành kỳ vọng `M` |
| **L2 văn bản cũ** (N1, N2, N3): `stale_doc` ở t01, t02, t03 | `theo_dieu`-512-10, không lọc, vector top 3 | Ở BM25, đoạn 2019 đứng **hạng 1** với t01, t02, t03, r02, r04, h01, h07. Đoạn đúng 2024 của t01, t03, r02, r04 đứng hạng 2. Trên 24 biến thể, số biến thể có đoạn 2019 ở hạng 1: t02 24/24, h01 21, r02 20, t01 19, t03 15, r04 14, h07 14. Có `only_in_force`: 0 đoạn 2019 ở mọi biến thể | Phía BM25 cắn rất chắc. N3 chỉ dùng vector nên vẫn **?**. Lọc ở tầng index hoạt động đúng như sửa đổi của phản biện |
| **Lời giải mẫu L2** | `theo_dieu`-512-10, `only_in_force` | Không ca nào bị cắt biên. Mọi ca có một đoạn phủ đủ. BM25 hạng 1 ở 13/16 ca có vàng; ngoại lệ h02 hạng 2, h04 hạng 11, h07 hạng 15 | Dense phải gánh h04 và h07, chưa đo |
| **L3-N1, N2:** dense trượt "Điều 47 khoản 2" và các ca `tra-so` ở top_k tối đa 5 | `theo_dieu`-512-10, vector top 3 / 5 | Dense chưa đo. Dense không thấy số điều, vì `embed_text` bỏ dòng tiêu đề có số (E4) | **?** |
| **L3:** BM25, hybrid và rerank cứu lại các ca số điều | lời giải mẫu: vector 5 + BM25 5 → RRF 10 → rerank 3 | BM25 hạng 1 ở v01, v02, h02, h04, h05, r01, r03, r04; hạng 2 ở h01. **h03 "khoan 2 dieu 10 ghi gi a" hạng 8**: gõ không dấu nên chỉ "2" và "10" khớp. Trên 24 biến thể, h03 không lần nào đứng hạng 1 và chỉ 8/24 lần lọt top 5 | Phía BM25 thì **T✓** cho 9/10 ca `tra-so` và `tra-so-kho`. **h03 là rủi ro cho mục tiêu 3 sao của lời giải mẫu**, xem đề xuất 2 |
| **L3-N3 `ret.gold_missing`:** t01 (diễn đạt lại không trùng chữ) | `theo_dieu`-512-10, BM25 top 10 | Đoạn đúng hạng 48. Trên 24 biến thể, hạng từ 3 đến 76; chỉ 3/24 biến thể đưa nó vào top 10 | **T✓** ở cấu hình N3 |
| **L3-N6:** alpha 0,8 top 3 trượt v01 | | chưa đo | **?** |
| **L3-N7:** hồi quy t02 ở 128/0 | `co_dinh`-128-0, hybrid + rerank top 3 | Không đoạn nào chạm cả k2 lẫn k3, nên cần đủ hai đoạn trong top 3 sau rerank. BM25 hạng 1/2 | **M** (rerank quyết định). Trên 24 biến thể, 10 biến thể không có đoạn chạm cả hai |
| **L3-N8:** RRF top 3 đẩy h04, h05 ra ngoài | | BM25 hạng 1 cho cả hai. Một đoạn chỉ có ở BM25 hạng 1 được 1/61 ≈ 0,0164 điểm RRF. Đoạn có ở cả hai danh sách, ví dụ hạng 2 và 3, được ≈ 0,0320 | **M**, đúng như nhãn: tuỳ số đoạn trùng giữa hai danh sách |

### 2.3 Thử bỏ dấu cho BM25 (câu hỏi mở 6 của README kho)

Hai phương án được thử trên `theo_dieu`-512-10, chỉ trong script tạm, không sửa engine:

| Phương án | Kết quả |
|---|---|
| (a) Bỏ dấu cả kho lẫn câu hỏi (`đ` → `d`) | h03 lên từ 8 xuống 5. Nhưng h01 tụt từ 2 xuống 5, L1-v03 từ 8 xuống 15, L1-h04 từ 3 xuống 6 |
| (b) Index cả dạng có dấu lẫn không dấu | Hỏng nặng nhóm L3: v01 tụt từ 1 xuống 7, h01 từ 2 xuống 11, r01 từ 1 xuống 5 |

**Kết luận: giữ tokenizer có dấu (E9).** Xử lý h03 bằng `top_k`, xem đề xuất 2.

### 2.4 Số đo với e5 + jina-v2 thật (2026-10-08, đủ 24 biến thể)

Lệnh: `uv run python scripts/spike_retrieval.py --json .cache/engine/spike-ranks.json` (1.560 dòng; rerank n=1.560, trung vị 464 ms, tối đa 21.618 ms ở lần đầu nạp ONNX; cả lệnh mất khoảng 50 phút CPU). Hạng = vị trí mà mọi câu trích đã được phủ. Thứ tự 24 cột:

`co_dinh` 128-0, 128-10, 128-20, 256-0, 256-10, 256-20, 512-0, 512-10, 512-20, 1024-0, 1024-10, 1024-20 · `theo_dieu` 128-0, 128-10, 128-20, 256-0, 256-10, 256-20, 512-0, 512-10, 512-20, 1024-0, 1024-10, 1024-20.

#### 2.4.1 L1-N5 (vai `dien-dat-lai`): bẫy không cắn. Gửi chủ nội dung: **trượt cổng phát hành**

Hạng dense (e5) của đoạn đúng:

| Ca | 24 biến thể | Số biến thể hạng ≥ 2 |
|---|---|---|
| `lib-l1-v03` (hiện) | 1 1 1 2 1 2 1 1 1 1 1 1 · 1 1 1 1 1 1 1 1 1 1 1 1 | 2/24 (`co_dinh`-256-0, -256-20) |
| `lib-l1-h04` | 2 2 1 2 1 1 1 1 1 8 3 1 · 1 1 1 1 1 1 1 1 1 1 1 1 | 6/24 |
| `lib-l1-h05` | 1 1 1 1 1 1 1 1 1 3 8 1 · 1 1 1 1 1 1 1 1 1 1 1 1 | 2/24 |

Ở `theo_dieu`-512-10 (cấu hình N5) cả ba ca đều hạng 1. Vì vậy `vector_search.top_k = 1` vẫn lấy đúng đoạn và `ret.gold_rank` không bật. Kịch bản L1 §6 N5 ([T]) yêu cầu cổng phát hành thấy đoạn đúng ở hạng ≥ 2 trên ca `dien-dat-lai` hiện (v03). Số đo là hạng 1, nên **N5 trượt cổng phát hành**. Test giữ kỳ vọng vì kỳ vọng khớp kịch bản. Chủ nội dung chọn một trong ba: viết lại câu hỏi v03, h04, h05 xa chữ quy chế hơn; đổi N5 sang [M]; hoặc bỏ N5.

#### 2.4.2 Lời giải mẫu L3: 2 sao, không phải 3

Test `test_reference_graph_earns_three_stars_with_real_models[article-number-lookup]` cho `stars 2, s1 True, s2 True, s3 False`. Hai ca thường trượt là h03 và h07 (8/10, vẫn đủ sao 1). Ca bẫy t01 trượt, nên mất sao 3.

Hạng từng ca trên `theo_dieu`-512-10, biến thể của lời giải mẫu (vector 5 + BM25 5 → RRF k60 top 10 → rerank top 3):

| Ca | dense | BM25 | RRF 5+5→10 | rerank (trên 10 đoạn RRF) | Vì sao trượt |
|---|---|---|---|---|---|
| `lib-l3-h03` "khoan 2 dieu 10 ghi gi a" | 57 | 8 | — | — | Gõ không dấu: BM25 hạng 8, ngoài top 5; dense không thấy số điều |
| `lib-l3-h07` | 2 | 19 | 4 | 4 | Rerank xếp hạng 4, ngoài `top_n` 3 |
| `lib-l3-t01` (lời thường, Điều 12) | 13 | 48 | — | — | Dense hạng 13, ngoài `top_k` ≤ 5; BM25 không trùng chữ |

Trên 24 biến thể:

- t01: dense chỉ lọt top 5 ở `co_dinh`-512-20 (hạng 5) và `co_dinh`-1024-0 (hạng 2).
- h03: chỉ vào top 3 sau rerank ở `co_dinh`-128-20 và `co_dinh`-256-20.
- h07: đứng hạng 4 sau rerank ở mọi biến thể `theo_dieu` từ 256 trở lên.

**Đề xuất 2 (BM25 `top_k` 5 → 10) đã đo và không giúp.** Lời giải mẫu chạy với BM25 top 10 trên cùng index cho kết quả sau:

- h03 vẫn không qua được RRF top 10. Đoạn của h03 chỉ có ở BM25 hạng 8, được 1/68 ≈ 0,0147 điểm, thua các đoạn có mặt ở cả hai danh sách. 15 ứng viên bị cắt còn 10 (`fusion.top_k` ≤ 10).
- h07 vẫn hạng 4. t01 vẫn vắng mặt.
- Các ca khác không đổi trạng thái: r02 tụt từ hạng 1 xuống 2, vẫn trong top 3.

Vì vậy **không đề xuất đổi `reference_graph` theo hướng này**.

t01 là ca quyết định sao 3. Kịch bản L3 §10 nói "`t01` bảo vệ phần dense". Với e5, dense không đưa t01 vào top 5 ở biến thể của lời giải mẫu. Vì vậy trong `param_limits` hiện tại (vector `top_k` ≤ 5), lời giải mẫu không cứu được t01. **Cần chủ nội dung quyết**; agent không sửa `docs/content` hay `reference_graph` khi chưa được duyệt. Các phương án:

- (a) viết lại câu t01 gần nghĩa Điều 12 hơn để dense bắt được;
- (b) nâng trần `vector_search.top_k` của L3 lên 10 rồi đo lại;
- (c) tạm hạ t01 thành `info` theo điều khoản cuối §10, rồi hiệu chỉnh lại.

#### 2.4.3 L2-N1 v01 và L3-N7 t02: bẫy [T] không cắn với model thật

| Kỳ vọng | Cấu hình | Số đo | Kết luận |
|---|---|---|---|
| L2-N1 `ret.gold_missing` ở `lib-l2-v01` | `co_dinh`-128-0, vector top 3 | Dense phủ đủ hai khoản ở hạng 3, nên top 3 đã đủ. Trên 24 biến thể, hạng phủ đủ từ 1 đến 4 | Đúng như đề xuất 4 ở mục 4 đã dự báo: cờ này là **M**, không phải T |
| L3-N7 `fail` ở `lib-l3-t02` | `co_dinh`-128-0, lời giải mẫu L3 | Sau RRF và rerank, hai đoạn (k2, k3) đứng hạng 1 và 2; rerank top 3 giữ cả hai | Hồi quy không xảy ra vì rerank top 3 đủ chỗ cho hai đoạn. Chủ nội dung cần đổi N7 (ví dụ thêm `rerank.top_n = 1`) hoặc chuyển sang [M] |

## 3. LLM thật

### 3.0 Lần chạy 2026-10-08 (sau đợt sửa 1): `gemini-3.8-flash` không trả lời

Chạy `uv run python scripts/spike_llm.py` một lần (trần 40 lời gọi), sau khi dựng offline biến thể `theo_dieu-512-10` của index (`HF_HUB_OFFLINE=1 uv run vgame-build-index --variant theo_dieu-512-10`: 100 đoạn, trung bình 147 token, 47 câu hỏi). Agent không đọc `backend/.env`; key chỉ đi qua `Settings`.

| Run | Kết thúc | Lần gọi mạng (log) |
|---|---|---|
| `ref-1` (lời giải mẫu L1) | `run.failed{llm_unavailable}` | 10: 504 ×6, 503 ×1, 429 ×3 |
| `naive-N1` | `run.failed{internal}` | 1, rồi `RuntimeError: Event loop is closed` (xem dưới) |
| `ref-2` | `run.failed{llm_unavailable}` | 10: 429 ×9, 504 ×1 |

- **Không lời gọi nào có câu trả lời**, nên **chưa có số trung vị token** (input, output + thinking) cho level nào. L2 và L3 chưa chạy. Ngân sách sao và ánh xạ `can_bang → MEDIUM` giữ nguyên tới khi có số đo.
- Tổng khoảng 21 lần gọi mạng tính vào `DailyCap`, dưới trần 40. Lần retry duy nhất (sau 503) không có log riêng: nó bị hạn 20 s của ca huỷ.
- Engine xử lý đúng sự cố provider: hai run lời giải mẫu kết thúc `llm_unavailable` (không tính 0 sao), 429 và 504 không bị retry.
- **429 chiếm đa số ở `ref-2`.** Có thể key đã hết hạn mức của `gemini-3.8-flash` (RPM hoặc theo ngày), không chỉ là provider quá tải.
- **`naive-N1` lỗi `internal` là lỗi của script spike, không phải của server.** Script gọi `asyncio.run` riêng cho mỗi run nhưng dùng chung một `GeminiClient`. Pool httpx còn giữ kết nối từ vòng lặp sự kiện trước, nên khi dùng lại thì báo `Event loop is closed`. Server chỉ có một vòng lặp nên không gặp lỗi này. Để sửa, script nên chạy cả ba run trong một `asyncio.run`. Ngoài ra, mọi lỗi không phải `EngineError` trong một ca, như lỗi này, sẽ thoát khỏi TaskGroup và làm cả run thành `internal`.
- SDK in cảnh báo về AFC (automatic function calling) với `AsyncModels.generate_content`. Cảnh báo này vô hại vì engine không khai báo tool.

**Đề xuất cho chủ dự án (agent không tự đổi):**

1. Thử lại `gemini-3.8-flash` vào lúc khác. Nếu vẫn chỉ có 503, 504 và 429, đặt `GEMINI_MODEL` trong môi trường hoặc `backend/.env` sang một model GA khác có `thinking_level` (kiểm id trên ai.google.dev/gemini-api/docs/models; `engine-v0.2.md` §14 đã nêu `gemini-3.5-flash-lite`, cần hiệu chỉnh lại ngân sách), rồi chạy lại `spike_llm.py`. Model `-preview` thì chỉ chủ dự án chọn.
2. Kiểm hạn mức của key trong AI Studio (RPM, RPD) trước đợt pilot. `MAX_CONCURRENT_RUNS=1` giữ tối đa 3 lời gọi song song.
3. Khi có câu trả lời thật, ghi trung vị input và output + thinking mỗi lời gọi cho từng level vào đây. Nếu trung vị output + thinking vượt khoảng 1,1k token, cần xem lại `token_budget` của sao hoặc ánh xạ `can_bang → MEDIUM`.

### 3.0b Lần chạy 2026-10-08 (sau đợt sửa 2): `gemini-3.5-flash-lite` trả lời được

**`gemini-3.8-flash` (mặc định trong `config.py`) chỉ trả 429/503/504** ở lần chạy 3.0, phần lớn là 429. Nhiều khả năng key đã hết hạn mức cho model này, không chỉ do provider quá tải.

Kiểm trên ai.google.dev ngày 2026-10-08:

- Trang models ghi `gemini-3.5-flash-lite` là model **stable/GA**.
- Trang thinking ghi model này hỗ trợ `thinking_level` minimal/low/medium/high, mặc định minimal.

Vì vậy ánh xạ `nhe → LOW`, `can_bang → MEDIUM`, `sau → HIGH` của `llm.py` dùng nguyên được.

Lệnh (biến môi trường chỉ áp cho một tiến trình; agent không đọc hay sửa `.env`, không đổi mặc định trong `config.py`):

```bash
GEMINI_MODEL=gemini-3.5-flash-lite uv run python scripts/spike_llm.py   # trần 40 lời gọi
```

| Run | Kết thúc | Sao | Token (ngân sách) | Ghi chú |
|---|---|---|---|---|
| `ref-1` (lời giải mẫu L1, `can_bang`) | `run.finished` | 3 (8/8 ca thường, 2/2 bẫy) | 10.262 (22.000) | 10 lời gọi, không lỗi |
| `naive-N1` | `run.finished` | 0 | 4.704 | 6 lời gọi có trả lời, 4 lần 429 (`llm_error`) |
| `ref-2` | `run.finished` | 3 | 10.262 | replay 10/10, usage từng ca giống hệt `ref-1` |

Tổng khoảng 20 lời gọi mạng, dưới trần 40. Script thoát với mã 0.

**Trung vị mỗi lời gọi của `ref-1`** (L1, `can_bang` → MEDIUM):

- Vào: 631 token (tối đa 1.565).
- Ra, gồm thinking: 151 token (tối đa 658).
- Thời gian mỗi ca: p50 1.282 ms, p95 3.076 ms.

Phần ra (gồm thinking) nằm dưới mốc 1,1k token. Vì vậy **ngân sách sao 2 của L1 (22.000) và ánh xạ `can_bang → MEDIUM` đứng vững với model này**. L2 và L3 chưa đo bằng LLM thật, nên hiệu chỉnh `token_budget` (Fix 12) cho hai level này vẫn còn mở.

Ở `naive-N1`, 4 lần 429 rơi vào các ca chạy cùng lúc, có thể do giới hạn RPM của gói miễn phí. Engine xử lý đúng: ca đó ghi `llm_error`, run vẫn kết thúc.

**Đề xuất cho chủ dự án:** tự đặt `GEMINI_MODEL=gemini-3.5-flash-lite` trong `backend/.env`. Nếu muốn giữ `gemini-3.8-flash`, cần kiểm hạn mức của key trong AI Studio trước.

### 3.1 Script

Lần đầu (2026-10-07) chưa chạy được vì chưa có key và index.

`scripts/spike_llm.py` đã sẵn sàng và đã chạy thử với LLM giả (Oracle + ReplayStore trong bộ nhớ). Script làm như sau:

- **Ba run:** lời giải mẫu L1 (`ref-1`), cấu hình ngây thơ N1, rồi lời giải mẫu lần nữa (`ref-2`).
- **In ra:** sao, s1, s2, s3, token so với ngân sách, p50/p95 thời gian mỗi ca (tổng `ms` các bước của ca) và của riêng bước LLM, số lần replay, cờ từng ca, chẩn đoán.
- **Kiểm replay:** `ref-2` phải được phục vụ hoàn toàn từ replay cache (`replayed 10/10`) với `tokens{in,out}` từng ca **giống hệt** `ref-1`. Nếu đúng, script thoát với mã 0, ngược lại mã 2.
- **Giới hạn gọi:** `Settings(daily_llm_call_cap=40)`, nên DailyCap chặn ở 40 lần gọi thật. Dự kiến tốn 20 lần, vì L1 có 10 ca không phải ôn tập: 10 cho `ref-1` và 10 cho N1. `ref-2` không tốn lần nào.
- **Bẫy [M] cần xem:** L1-N4 có vượt 22.000 token không. N4 không nằm trong script; muốn đo thì thêm một run, tốn 10 lần gọi, vẫn dưới mức 40.

## 4. Đề xuất

1. **Xin chủ dự án duyệt tải** (bắt buộc trước mọi số đo dense):
   - (a) hai file còn thiếu của `qdrant/multilingual-e5-large-onnx`: `model.onnx` 545.851 byte và `special_tokens_map.json` 964 byte;
   - (b) reranker jina-v2, khoảng 1 GB theo báo cáo tích hợp.

   Sau đó chạy mục 5. Sửa lại câu "embedding model is already cached" trong báo cáo tích hợp.
2. ~~**Lời giải mẫu L3: đổi `bm25_search.top_k` từ 5 lên 10.**~~ Đã đo ở mục 2.4.2: không giúp, vì RRF top 10 vẫn cắt h03. Việc cần chủ nội dung quyết là ca `lib-l3-t01` (sao 3), xem 2.4.2.
3. **`library-l2` N5:** bỏ `lib-l2-h01` khỏi `expect.cases` của `ret.gold_missing`, hoặc chuyển sang kỳ vọng `M`. Ở 256/20 có một đoạn chạm cả hai khoản, nên cờ này không tất định. File level nằm trong `backend/`; nội dung kịch bản thuộc chủ nội dung.
4. **`library-l2` N1, ca v01:** đổi nhãn từ `T` sang `M` (cắn hay không tuỳ dense có kéo đủ hai đoạn vào top 3), hoặc giữ `T` nếu số đo e5 cho thấy luôn trượt.
5. **Ghi vào `engine-v0.2.md` §5:**
   - (a) `theo_dieu` 512 ≡ 1024 và overlap vô hiệu ở `theo_dieu` ≥ 256: 24 biến thể chỉ có 17 bộ đoạn. Thẻ khái niệm có thể nói thẳng điều này với người chơi, hoặc đổi ngưỡng.
   - (b) e5 cắt ở 512 token, nên đoạn `co_dinh` 512 và 1024 bị nhúng thiếu đuôi.
6. **Lỗi chữ của chẩn đoán**, thấy khi chạy thử `spike_llm.py` với Oracle. Khi thùng rỗng, mẫu `llm.cite_unknown` của L1 sinh ra câu "…nhưng thùng chỉ có không có đoạn nào". Nên đổi giá trị mặc định của `dieu_list` hoặc tách mẫu cho trường hợp thùng rỗng (`grading.py`, `report`).

## 5. Lệnh để chủ dự án chạy lại (trong `backend/`)

```bash
# 1. Chủ dự án tự thêm key vào backend/.env (GEMINI_API_KEY=...). Agent không đọc file này.
# 2. Tải phần còn thiếu (cần duyệt) và dựng index; đo thời gian dựng:
time uv run vgame-build-index
du -sh .cache/engine/index .cache/engine/models
# 3. Điền các cột dense, hybrid và rerank của mục 2 (không gọi LLM):
uv run python scripts/spike_retrieval.py --json .cache/engine/spike-ranks.json
# 4. Gemini thật: L1 lời giải mẫu + N1 + replay (tối đa 40 lần gọi, dự kiến 20):
uv run python scripts/spike_llm.py
# 5. Các test cần model thật:
uv run pytest -m slow
```

Sau bước 3 và 4, điền các ô **?** ở mục 2.2 và mục 3 của báo cáo này, rồi chốt đề xuất 2–4.
