# Báo cáo spike engine v0.2: khu Thư viện

> **Trạng thái:** cập nhật 2026-10-08, bản miễn phí (mục 3.4): API không nạp model, index và bảng rerank đi kèm code, seed phát lại. Trước đó, đợt hiệu chỉnh 3: ngân sách sao 2 của L1–L3 đo bằng Gemini thật và đã đặt lại (mục 3.2). Trước đó, đợt sửa 2: đủ 24 biến thể index với e5 thật, reranker jina-v2 thật, Gemini `gemini-3.5-flash-lite` trả lời được (mục 0.1, 2.4, 3.0b). Các mục 0–2.3 và 3.0 giữ lại làm lịch sử. **Phạm vi:** đo hành vi thật của engine v0.2 ([hợp đồng](engine-v0.2.md)) trên kho quy chế thật và bộ câu hỏi vàng L1–L3.
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

  Cả 4 đã quyết ngày 2026-10-08 (engine-v0.2 §14, khối "nội dung"): viết lại `lib-l3-t01` và thêm dấu cho `lib-l3-h03` (L3 3 sao); L1-N5 và L2-N1 v01 chuyển [M] (L1-N5 giữ [T] trên h02); L3-N7 thêm `rerank.top_n` 1.
- **Gemini:** `gemini-3.5-flash-lite` (GA, có `thinking_level` low/medium/high) trả lời đủ; lời giải mẫu L1 được 3 sao với 10.262 token (ngân sách 22.000), replay trả đúng usage gốc. Xem 3.0b.
- **Đợt hiệu chỉnh 3 (mục 3.2):** index dựng lại sau khi đổi `lib-l3-t01`, `h03`; `uv run pytest -m slow` **13/13 đạt**. Ngân sách sao 2 đặt theo 1,25 × p50 lời giải mẫu với Gemini thật: L1 22.000 → **14.000**, L2 30.000 → **20.000**, L3 30.000 → **22.000**. `budget.exceeded` của L1-N4, L2-N2, L3-N5 vượt cả khi chỉ đếm token đầu vào, nên trở lại [T].
- **Bản miễn phí (mục 3.4, 2026-10-08):** API không nạp model nào: index, vector câu hỏi và bảng điểm jina tính sẵn đi kèm code (6,78 MB, không mất gì so với model sống), cùng seed 71 câu trả lời Gemini thật cho lời giải mẫu và đồ thị khởi đầu. Đo qua HTTP: đỉnh 131 MB, lượt đã lưu 0,05–0,23 s CPU (0,5–2,3 s ở 0,1 CPU), 29 lời gọi Gemini để sinh seed.
- **Sửa lỗi vòng 1 (mục 3.3):** RAM của tiến trình API khi rerank giảm từ tối đa 14,8 GB xuống 3,2 GB committed (lô 2 cặp, cặp cắt ở 512 token); rerank lời giải mẫu L3 p50 2,3 s khi 3 ca song song, đồ thị L3 nặng nhất 5,5 s. Ngân sách sao 2 của L1 nâng lên **15.000**. Bỏ `gemini-3.7-flash` khỏi chuỗi model.

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
| Thời gian dựng với e5 thật | 1.991 s (33 phút, CPU, máy dev; đo 2026-10-08 ở mục 3.2) |

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

**Đã quyết (2026-10-08): đổi sang [M], giữ một kỳ vọng [T].** Chạy N5 thật (Oracle LLM): 2 sao, 6/8; cờ chỉ bật ở h01, h02. `lib-l1-h02` ("học kỳ hè") hạng ≥ 2 trên cả 24 biến thể (hàng dưới), vì Điều 10 (học kỳ chính, 0,865) đứng trên Điều 19 (0,863). Level giờ khai T, `needs_real_models` `ret.gold_rank` trên h02; M trên v03, h04, h05. h01 hạng 3 nhưng cách 0,001 nên không assert.

| Ca | 24 biến thể | Số biến thể hạng ≥ 2 |
|---|---|---|
| `lib-l1-h02` | 4 5 5 7 15 15 8 8 11 3 3 4 · 4 4 4 2 2 2 2 2 2 2 2 2 | 24/24 |

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

**Đã quyết (2026-10-08): (a).** Đo cùng khung với test `slow` (e5 + jina-v2 thật, Oracle LLM, câu mới embed trong RAM), lời giải mẫu L3:

| Bước | Thay đổi | Sao | Ca thường | Ghi chú |
|---|---|---|---|---|
| S0 | golden cũ | 2 | 8/10 | h03, h07, t01 trượt |
| S1 | h03 → "khoản 2 điều 10 ghi gì ạ" | 2 | 9/10 | h03: BM25 4, dense 65, RRF 7, rerank 1 |
| S2 | S1 + trần `vector_search.top_k` 10, lời giải mẫu dense 10 (b) | 2 | 9/10 | t01 dense hạng 13 > 10 |
| S3 | S1 + t01 thành `info` (c) | 3 | 9/10 | đồ thị chỉ BM25 bm10→rr3, bm5→rr3, bm10→rr5 cũng 3 sao: phá bài học L3, loại |
| S4 | S1 + t01 viết lại (a) | **3** | 9/10 | bẫy 2/2, 11.758/30.000 token Oracle; t01: BM25 36, dense 1, RRF 2, rerank 1 |

Câu t01 mới: "Em tính nghỉ ở nhà một thời gian để đi làm kiếm tiền, điểm số và kết quả học tập có giữ lại được không, sau này quay lại thì sao ạ?". Chỉ chung với Điều 12 cụm "kết quả học tập" (có ở 9 điều) và "số". Dense và rerank hạng 1 trên cả 12 biến thể `theo_dieu`; BM25 hạng ≥ 15 trên mọi biến thể `theo_dieu` và `co_dinh` ≤ 256. Với golden S4, đồ thị không có dense dưới 3 sao (N3 1, bm10→rr3 2, bm5→rr3 2), chỉ dense 0 sao. 12 câu viết lại không trùng chữ nào lên dense hạng 1–2 nhưng jina-v2 xếp rerank 5–10, nên bị loại. h07 vẫn trượt (rerank hạng 4), level cho 9/10.

#### 2.4.3 L2-N1 v01 và L3-N7 t02: bẫy [T] không cắn với model thật

| Kỳ vọng | Cấu hình | Số đo | Kết luận |
|---|---|---|---|
| L2-N1 `ret.gold_missing` ở `lib-l2-v01` | `co_dinh`-128-0, vector top 3 | Dense phủ đủ hai khoản ở hạng 3, nên top 3 đã đủ. Trên 24 biến thể, hạng phủ đủ từ 1 đến 4 | Đúng như đề xuất 4 ở mục 4 đã dự báo: cờ này là **M**, không phải T |
| L3-N7 `fail` ở `lib-l3-t02` | `co_dinh`-128-0, lời giải mẫu L3 | Sau RRF và rerank, hai đoạn (k2, k3) đứng hạng 1 và 2; rerank top 3 giữ cả hai | Hồi quy không xảy ra vì rerank top 3 đủ chỗ cho hai đoạn. Chủ nội dung cần đổi N7 (ví dụ thêm `rerank.top_n = 1`) hoặc chuyển sang [M] |

**Đã quyết (2026-10-08).** L2-N1 v01 → [M], graph giữ nguyên vì N1 phải trùng starter (`vs.top_k` 2 hoặc 1 làm cắn v01 nhưng không còn là starter; bài thiếu khoản 3 tất định nằm ở L2-N5). L3-N7 → `rerank.top_n` 1: `top_n` 2 vẫn không cắn, `top_n` 1 cắn với model thật (0 sao; t02 có `ret.gold_missing`, `ret.gold_rank`) và với double nhanh, nên kỳ vọng `fail` + `ret.gold_missing` trên t02 là T không cần model. Đối chứng: `top_n` 1 ở `theo_dieu`-512-10 vẫn đạt t02.

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

Phần ra (gồm thinking) nằm dưới mốc 1,1k token. Vì vậy **ánh xạ `can_bang → MEDIUM` đứng vững với model này**. Câu cũ "ngân sách sao 2 của L1 (22.000) đứng vững" đã được thay: mục 3.2 đặt lại cả ba level theo 1,25 × p50 lời giải mẫu (L1 14.000, L2 20.000, L3 22.000).

Ở `naive-N1`, 4 lần 429 rơi vào các ca chạy cùng lúc, có thể do giới hạn RPM của gói miễn phí. Engine xử lý đúng: ca đó ghi `llm_error`, run vẫn kết thúc.

**Đề xuất cho chủ dự án:** tự đặt `GEMINI_MODEL=gemini-3.5-flash-lite` trong `backend/.env`. Nếu muốn giữ `gemini-3.8-flash`, cần kiểm hạn mức của key trong AI Studio trước.

### 3.1 Script

Lần đầu (2026-10-07) chưa chạy được vì chưa có key và index.

`scripts/spike_llm.py` đã sẵn sàng và đã chạy thử với LLM giả (Oracle + ReplayStore trong bộ nhớ). Script làm như sau:

- **Ba run:** lời giải mẫu L1 (`ref-1`), cấu hình ngây thơ N1, rồi lời giải mẫu lần nữa (`ref-2`).
- **In ra:** sao, s1, s2, s3, token so với ngân sách, p50/p95 thời gian mỗi ca (tổng `ms` các bước của ca) và của riêng bước LLM, số lần replay, cờ từng ca, chẩn đoán.
- **Kiểm replay:** `ref-2` phải được phục vụ hoàn toàn từ replay cache (`replayed 10/10`) với `tokens{in,out}` từng ca **giống hệt** `ref-1`. Nếu đúng, script thoát với mã 0, ngược lại mã 2.
- **Giới hạn gọi:** `Settings(daily_llm_call_cap=40)`, nên DailyCap chặn ở 40 lần gọi thật. Dự kiến tốn 20 lần, vì L1 có 10 ca không phải ôn tập: 10 cho `ref-1` và 10 cho N1. `ref-2` không tốn lần nào.
- **Bẫy [M] cần xem:** L1-N4 có vượt 22.000 token không. Đã đo ở mục 3.2: 29.091 token.
- **Kế hoạch tuỳ ý (2026-10-08):** script nhận danh sách run `<level>:ref` hoặc `<level>:<naive id>`; thêm `!` để bỏ qua replay cache (mẫu mới); `wait:<giây>` chờ cho cửa sổ RPM 60 s trống. `--cap` là trần lời gọi mạng; `--json` ghi từng lời gọi (model, token vào/ra, số token `regex-v1` của prompt, ms). Script in số lần gọi mạng, số lần limiter chờ hoặc nhường model, và dừng ở run đầu tiên thất bại hoặc có ca `llm_error`.

### 3.2 Hiệu chỉnh ngân sách sao 2 với Gemini thật (2026-10-08, đợt 3)

**Chuẩn bị.**
- Dựng lại index vì `lib-l3-t01`, `lib-l3-h03` đổi câu: `HF_HUB_OFFLINE=1 uv run vgame-build-index` mất 1.991 s (33 phút CPU trên máy dev, không phải ~7 phút như ước). 24 biến thể và thống kê đoạn khớp mục 1.3; 47 câu hỏi. Server hết báo `index_stale`.
- `HF_HUB_OFFLINE=1 uv run pytest -m slow`: **13/13 đạt** (101 s). Lời giải mẫu 3 sao với model truy xuất thật + Oracle ở cả ba level; các kỳ vọng `needs_real_models` của L1-N5, L2-N1…N5, L3-N1, N2, N6 đều cắn; `test_real_models_rank_the_anchor_questions` đạt. Sau khi hạ ngân sách: lần đầu, lúc máy bận (225 s thay vì 35–101 s), test lời giải mẫu L3 không đủ 3 sao (bộ slow 12/13 đạt); ba lần sau đều đạt: riêng test đó 1/1, e2e 12/12, cả bộ 13/13. Nhiều khả năng một ca hết hạn 20 s vì rerank CPU chậm; chưa xác nhận vì log lần đó không giữ chi tiết.

**Lệnh** (trong `backend/`; một tiến trình, chờ 65 s giữa các run để cửa sổ RPM trống và model chính phục vụ mọi lời gọi; run cuối chạy dồn ngay sau L1-N4 để thử limiter):

```bash
uv run python scripts/spike_llm.py --cap 80 --json calib1.json \
  chunk-tuning:ref wait:65 chunk-tuning:N2 wait:65 article-number-lookup:ref wait:65 \
  article-number-lookup:N5 wait:65 grounded-citation:N4 'article-number-lookup:ref!'
uv run python scripts/spike_llm.py --cap 12 'grounded-citation:ref!'
```

**Số lời gọi.** 85 lần gọi mạng (đếm bằng `DailyCap`); cộng 6 lần thăm dò của builder backend là 91, dưới trần 100 của đợt. 84 lần có trả lời, 1 lần 504. Không có 429 hay 503. Chuỗi model: `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.5-flash` → `gemini-3.7-flash`; `can_bang` → MEDIUM.

**Các run** (token = tổng `in + out` của run, như `run.scored`; ms = tổng `ms` các bước của một ca):

| Run | Model phục vụ | Sao | Ca thường | Bẫy | Token | Ngân sách cũ → mới | Vượt ngân sách mới | Ca ms p50 / p95 |
|---|---|---|---|---|---|---|---|---|
| L1 lời giải mẫu (3.0b) | 3.5-flash-lite ×10 | 3 | 8/8 | 2/2 | 10.262 | 22.000 → 14.000 | không | 1.282 / 3.076 |
| L1 lời giải mẫu, mẫu mới | 3.5-flash-lite ×10 | 3 | 8/8 | 2/2 | 11.260 | 14.000 | không | 1.464 / 3.724 |
| L1-N4 (`top_k` 10 + G6) | 3.5-flash-lite ×10 | 2 | 8/8 | 2/2 | 29.091 | 14.000 | có, 2,08× (vượt cả 22.000 cũ) | 1.922 / 5.177 |
| L2 lời giải mẫu | 3.5-flash-lite ×13 | 3 | 8/10 | 3/3 | 15.879 | 30.000 → 20.000 | không | 1.647 / 2.942 |
| L2-N2 (`co_dinh` 1024, `top_k` 10) | 3.5-flash-lite ×13 | 0 | 6/10 | 0/3 | 41.664 | 20.000 | có, 2,08× (vượt cả 30.000 cũ) | 2.457 / 3.126 |
| L3 lời giải mẫu | 3.5-flash-lite ×13 | 3 | 9/10 | 2/2 | 17.348 | 30.000 → 22.000 | không | 5.397 / 5.733 |
| L3 lời giải mẫu, mẫu mới, chạy dồn | 3.5-flash-lite ×5, 3.1-flash-lite ×7, 1 lỗi 504 | 3 | 9/10 | 2/2 | 17.117 (thiếu `h07`) | 22.000 | không | 4.903 / 18.303 |
| L3-N5 (RRF top 10, không rerank) | 3.5-flash-lite ×13 | 2 | 10/10 | 2/2 | 35.803 | 22.000 | có, 1,63× (vượt cả 30.000 cũ) | 1.857 / 2.433 |

- Cả ba bẫy [M] `budget.exceeded` (L1-N4, L2-N2, L3-N5) đã cắn với model thật ngay ở ngân sách cũ.
- Ca của lời giải mẫu L3 chậm (p50 5,4 s) dù bước LLM chỉ 1,6 s: rerank jina-v2 trên CPU tốn khoảng 3,7 s mỗi ca khi 3 ca chạy song song. Đây là số lúc máy nhẹ tải, với lô 8 và cặp 1024 token; dải đo và cấu hình mới ở mục 3.3.
- `h07` của run chạy dồn: `gemini-3.1-flash-lite` trả 504 sau khoảng 18 s (19.443 ms tính từ đầu ca; rerank đã có trong cache), ca thành `llm_error`. 504 này là hạn 20 s phía server do engine tự gửi, không phải provider quá tải (mục 3.3); run vẫn được 3 sao (h07 vốn trượt vì rerank xếp hạng 4).

**Token mỗi lời gọi** (ra = `candidates + thoughts`):

| Run | Vào, trung vị | Ra, trung vị (tối đa) |
|---|---|---|
| L1 lời giải mẫu (3.0b / mẫu mới) | 631 / 631 | 151 (658) / 261 (1.186) |
| L2 lời giải mẫu | 800 | 403 (1.234) |
| L3 lời giải mẫu | 1.034 | 266 (786) |
| L1-N4 | 2.277 | 398 (1.713) |
| L2-N2 | 2.428 | 681 (1.135) |
| L3-N5 | 2.318 | 357 (937) |

| Model | Lời gọi có trả lời | Vào: trung vị (p95) | Ra: trung vị (p95; tối đa) | Bước LLM ms: p50 / p95 |
|---|---|---|---|---|
| `gemini-3.5-flash-lite` | 77 | 1.347 (2.901) | 411 (1.120; 1.713) | 1.848 / 3.482 |
| `gemini-3.1-flash-lite` | 7 | 959 (tối đa 1.476) | 478 (tối đa 1.101) | 8.714 / 18.302 |

- **Token vào của Gemini ≈ 1,13 × số đếm `regex-v1`** của engine (trung vị trên 84 lời gọi, khoảng 1,09–1,21; hai model như nhau). Các số "engine đo" bằng `FakeLLM`/Oracle thấp hơn token tính phí khoảng 13 %.
- **Phần ra dao động mạnh vì thinking.** Cùng model, cùng prompt: L3 `v01` ra 74 rồi 528 token, `v02` 68 rồi 264, `h02` 47 rồi 48. Tổng token của lời giải mẫu đổi chủ yếu do phần ra; phần vào gần như tất định.
- Trung vị phần ra 411 < mốc 1,1k của mục 3.0, nên **`can_bang` → MEDIUM giữ nguyên**.
- `gemini-3.1-flash-lite` chậm hơn nhiều (bước LLM p50 8,7 s) và đã trả 504 sau 18 s, nên ca chuyển sang model dự phòng dễ sát hạn 20 s.

**Ngân sách mới** = làm tròn lên tới nghìn của 1,25 × p50 token các run lời giải mẫu đầy đủ (quy tắc của kịch bản §10 cả ba level và `library.md`):

| Level | Mẫu lời giải mẫu | p50 | 1,25 × p50 | `token_budget` | Mẫu cao nhất / ngân sách |
|---|---|---|---|---|---|
| L1 | 10.262 (3.0b), 11.260 | 10.761 | 13.451 | 14.000, nâng lên **15.000** ở mục 3.3 | 80 % (75 % ở 15.000) |
| L2 | 15.879 | 15.879 | 19.849 | **20.000** | 79 % |
| L3 | 17.348 (run chạy dồn thiếu `h07` nên không tính; tính vào thì p50 17.233, vẫn ra 22.000) | 17.348 | 21.685 | **22.000** | 79 % |

Biên 20–21 % đủ cho dao động phần ra đã đo: ở L3, phần vào khoảng 12,9k gần như cố định, phần ra phải tăng từ 4,4k lên khoảng 9k (gấp đôi) mới chạm 22.000. Kịch bản đòi 3 lần hiệu chỉnh; L1 có 2 mẫu, L2 và L3 có 1 mẫu đầy đủ. Cổng `vgame-calibrate` (engine-v0.2 §12) chạy thêm mẫu khi mở level cho lớp.

**Bẫy `budget.exceeded` trở lại [T].** Ở ngân sách mới, ba cấu hình "kéo nhiều" vượt ngay khi chỉ đếm token đầu vào `regex-v1` với double nhanh: L1-N4 21.523/14.000 (và /15.000), L2-N2 29.560/20.000, L3-N5 26.850/22.000. Gemini thật: 29.091, 41.664, 35.803. Level ghi lại `mechanism T`, `needs_real_models false`. Test nhanh `test_naive_graph_produces_its_deterministic_flags` kiểm ba kỳ vọng này: trượt 3/3 khi đổi sang T mà chưa hạ ngân sách, đạt sau khi hạ.

**Hệ quả cho đồ thị của người chơi** (ước tính, không gọi LLM: số `regex-v1` lấy từ Oracle + e5/jina thật, nhân 1,13, cộng 380 token ra mỗi lời gọi):

| Đồ thị | `regex-v1` | Gemini ước tính | Ngân sách | Sao 2 |
|---|---|---|---|---|
| L1 lời giải mẫu với `top_k` 4 | 8.162 | ~13,0k | 15.000 (trước 14.000) | đạt |
| L1 lời giải mẫu với `top_k` 5 | 9.424 | ~14,4k | 15.000 (trước 14.000) | sát vạch: tuỳ lần chạy |
| L2 lời giải mẫu với `top_k` 4 / 5 | 11.547 / 13.705 | ~18,0k / ~20,4k | 20.000 | đạt / trượt, sát |
| L3 không rerank, `fusion.top_k` 4 (8/10 ca thường) | 14.634 | ~21,5k | 22.000 | đạt, sát |
| L3 không rerank, `fusion.top_k` 5 | 16.699 | ~23,8k | 22.000 | trượt (ở 30.000 được 3 sao) |
| L3 lời giải mẫu với `rerank.top_n` 2 / 4 | 7.674 / 15.350 | ~13,6k / ~22,3k | 22.000 | đạt / sát |

Mang thêm một đoạn mỗi ca so với lời giải mẫu là chạm vạch. Sát vạch, sao 2 gần như tung đồng xu: độ lệch chuẩn của tổng phần ra 10 lời gọi (1,0–1,1k token) ngang giá một đoạn thêm mỗi ca (bootstrap ở mục 3.3), nên câu "±7 %" trước đây nói nhẹ hơn thực tế. Điều này khớp kịch bản §10: L1 "sao 2 cần `top_k` nhỏ"; L3 "Kính lúp `top_n` 3 hoặc `fusion.top_k` nhỏ"; mục tiêu 3 của L3 (lợi ích của rerank đo bằng sao 2). Đồ thị đã vượt sẵn thì vẫn vượt: L3-N3 (BM25 top 10) 34.915 và L3-N4 37.525 token `regex-v1`.

**Limiter và chuỗi model dưới hạn mức thật.**
- 6 run cách nhau ≥ 65 s (72 lời gọi): mọi lời gọi do `gemini-3.5-flash-lite` phục vụ; limiter không chờ, không nhường lần nào; không có 429.
- Run chạy dồn (13 lời gọi ngay sau 10 lời gọi của L1-N4, trong cùng cửa sổ 60 s): `gemini-3.5-flash-lite` còn 5 chỗ (15/phút) và nhận 5 lời gọi. 8 lời gọi sau chỉ có chỗ trống muộn hơn `hạn ca − 4 s`, nên limiter nhường cho `gemini-3.1-flash-lite` mà không gọi mạng tới model chính. Model dự phòng trả lời 7 lời gọi, lỗi 504 ở 1 lời gọi (504 không chuyển model, theo thiết kế). Không có 429: limiter phía client giữ dưới RPM thật. `run.finished.models` ghi đúng `{3.5-flash-lite: 5, 3.1-flash-lite: 7}`.
- Không gặp 429/503 thật, nên đường nghỉ theo `RetryInfo` và theo hạn mức ngày (`PerDay`, tới nửa đêm giờ Thái Bình Dương) chỉ được kiểm bằng test với client giả. Đường chờ chỗ trống (chỗ trống trước `hạn ca − 4 s`) cũng không xảy ra trong đợt này.
- Script dừng sau run có `llm_error` theo luật dừng của đợt, nên không gọi thêm.

### 3.3 RAM và thời gian của rerank; sửa lỗi vòng 1 (2026-10-08)

Phản biện QA chi phí/hiệu năng sau mục 3.2. Đo trong đường code của API: `build_engine(Settings(_env_file=None))`, `HF_HUB_OFFLINE=1`, `FakeLLM` trễ 1,8 s (p50 của `gemini-3.5-flash-lite`), không key, không mạng. Máy dev i7-12700H, 14 nhân / 20 luồng, 24 GB. Mỗi run có 13 ca, 3 ca song song, cache rerank lạnh. "Committed" là bộ nhớ riêng của tiến trình (Windows private bytes).

**RAM.** Trước khi sửa: lô 8 cặp, cặp dài tới 1024 token (mặc định của jina-v2). Sau khi sửa: lô 2, cặp cắt ở 512 token, arena CPU của ONNX vẫn bật.

| Thời điểm | Trước: committed | Sau: committed |
|---|---|---|
| Sau khởi động (index + reranker) | 2,07 GB | 2,07 GB |
| Sau lời giải mẫu L3 | 6,35 GB, giữ nguyên | 3,17 GB |
| Sau đồ thị L3 hợp lệ nặng nhất (`co_dinh` 1024/20, `bm` 10, `fu` 10, `rr` 5) | 14,8 GB, giữ nguyên | 3,18 GB |

- Arena của ONNX giữ đỉnh bộ nhớ của các lần chạy song song và không trả lại. Bộ nhớ attention tăng theo lô × độ dài². Vì vậy đỉnh giờ bị chặn bởi lô và độ dài cặp, không còn tuỳ đồ thị. Không cần hạ trần `param_limits` của L3.
- 512 token cũng là giới hạn của e5, nên dense search cũng không thấy phần sau 512 token của một đoạn. Đoạn của lời giải mẫu (`theo_dieu`-512) có cặp p50 159, p90 460, tối đa 517 token, nên gần như không bị cắt.
- Tắt arena (phương án của phản biện) trả bộ nhớ lại sau run, nhưng chậm hơn (A/B ở dưới). Với lô 2 và cặp 512, đỉnh khi arena bật chỉ còn 3,2 GB, nên giữ bật.
- Xếp hàng rerank sau một khoá giữ RAM ở 6,36 GB (lô 8), nhưng 9/13 ca hết giờ: không dùng.

**Thời gian** (cùng cấu hình, `FakeLLM` 1,8 s):

| Đồ thị | Rerank p50 / tối đa | Ca p50 / tối đa | Cả run |
|---|---|---|---|
| Lời giải mẫu L3, trước (máy nhẹ tải, mục 3.2) | ~3,7 s | 5,4 s / 5,7 s (p50 / p95, Gemini thật) | |
| Lời giải mẫu L3, sau | 2,3 s / 3,5 s | 4,1 s / 5,3 s | 18,9 s |
| Đồ thị nặng nhất, trước (phản biện) | 13,3 s / 14,2 s | | 69 s (hạn run 90 s) |
| Đồ thị nặng nhất, sau | 5,5 s / 5,6 s | 7,3 s / 7,4 s | 32,9 s |

- **Tải máy ảnh hưởng mạnh.** Khi có tiến trình khác chạy cùng (vòng sửa trước), cùng cấu hình mới cho rerank lời giải mẫu p50 12,2 s, ca tối đa 16,2 s; đồ thị nặng nhất có 3/13 ca hết giờ. Lô 8 với cặp 1024 token ở đồ thị nặng nhất, 3 song song, máy bận: p50 37,8 s, so với 6,5 s khi cắt ở 512. Số "3,7 s mỗi ca" của mục 3.2 là lúc máy nhẹ tải.
- **Không đặt số luồng ONNX.** A/B xen kẽ trên cùng phiên, 3 vòng × 13 ca lời giải mẫu, 3 song song:
  - mặc định: p50 2,87 s, tối đa 3,85 s;
  - 4 luồng: p50 3,37 s, tối đa 4,53 s;
  - 6 luồng: p50 3,10 s, tối đa 4,18 s.

  Phản biện đề xuất `threads = nhân // 3`, nhưng số đo không cho thấy lợi.
- **Arena tắt / bật**, cùng A/B xen kẽ (lô 2, cặp 512, 2 vòng × 13 ca): bật p50 3,06 s, p90 4,47 s, tối đa 6,57 s; tắt p50 3,68 s, p90 5,37 s, tối đa 7,34 s, tức chậm hơn khoảng 20 %. Ở lô 8 với cặp 1024 token, tắt arena chậm hơn nhiều (một mình p50 16,6 s so với 2,9 s), nhưng cấu hình đó đã bỏ.
- Retrieval của L1/L2 mất 0–2 ms mỗi ca, nên chạy đồng bộ trên event loop là được. Rerank chạy trong thread (`asyncio.to_thread`).
- Không làm nóng `_RERANK_CACHE` lúc khởi động: rerank lạnh đã vừa hạn ca 20 s.

**Chuỗi model và hạn ca.**
- `HttpOptions(timeout=20000)` khiến SDK gửi header `X-Server-Timeout: 20` (`google/genai/_api_client.py`, `populate_server_timeout_header`), tính từ lúc gọi chứ không từ hạn ca. 504 của `h07` (19.443 ms, mục 3.2) và của `gemini-3.7-flash` (lần thăm dò của builder) là hạn đó, không phải bằng chứng provider quá tải. Giờ mỗi request mang thời gian còn lại của ca.
- Không gửi lời gọi không kịp xong. Mỗi model có `MIN_CALL_S`: 4 s cho `gemini-3.5-flash-lite` (p95 khoảng 3,5 s), 15 s cho `gemini-3.1-flash-lite` (bước LLM p50 8,7 s, tối đa 18,3 s) và cho model chưa đo. Còn ít hơn thì bước và ca là `timeout`, không tốn `DailyCap` hay hạn mức.
- Bỏ `gemini-3.7-flash` khỏi chuỗi mặc định: không trả lời trong 20 s và chưa có mẫu token. Chuỗi mặc định: `gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-3.5-flash`.
- Cửa sổ limiter 62 s, cho biên khi server đếm theo thời điểm tới hoặc theo phút cố định.
- **Sức chứa:** một run L3 dùng 13/15 lời gọi mỗi phút của model chính, nên khoảng 1 run/phút ở model chính. `DAILY_LLM_CALL_CAP` 500 ÷ 13 ≈ 38 run L3 mới mỗi ngày. Mỗi lời gọi tối đa 4 lần gọi mạng (3 model + 1 lần thử lại 500/502), nên tối đa 52 lần mỗi run tính vào trần.
- **Token mỗi phút:** 15 lời gọi/phút × tối đa ~3,6k token vào ≈ 54k/phút, dưới 250K. Câu cũ "gấp khoảng 100 lần một run" sai: một run đo được 11k–42k token.

**Ngân sách sao 2 của L1: 14.000 → 15.000.** Bootstrap 200k mẫu của phản biện: phần vào cố định ở 7.724 (lời giải mẫu), phần ra mỗi lời gọi lấy lại độc lập từ `calib1`/`calib2`.

| Ngân sách | Lời giải mẫu vượt |
|---|---|
| 14.000 | 1,6–6,3 % |
| 15.000 | 0,1–1,1 % |
| 16.000 | 0,01–0,14 % |

Ở 14.000, `top_k` 4 vượt trong 20–39 % số mẫu và `top_k` 5 đạt trong 14–29 %: sát vạch, sao 2 gần như tung đồng xu.


- Chọn 15.000: lời giải mẫu gần như luôn đạt, L1-N4 vẫn vượt chỉ với token vào (21.523 `regex-v1`).
- Đồ thị "thêm một đoạn" (`top_k` 5, ~14,4k) giờ nằm sát vạch.
- L2 (20.000) và L3 (22.000) không đổi: lời giải mẫu vượt ≤ 0,3 % và ≤ 1 %.
- Chấm sao 2 chỉ bằng token vào (tất định) để chủ dự án quyết.
- Sao 2 chỉ hiệu chỉnh trên model chính. `gemini-3.1-flash-lite` ra trung vị 478 so với 411 token mỗi lời gọi, tức khoảng +0,9k cho 13 lời gọi L3. `gemini-3.5-flash` chưa có mẫu. `run.finished.models` cho biết khi model dự phòng phục vụ.

### 3.4 Bản miễn phí: không model lúc chạy, seed phát lại (2026-10-08)

Mục tiêu: Render free (512 MB, 0,1 CPU, đĩa tạm, ngủ sau 15 phút) chạy được run thật của cả ba level. Quyết định và hợp đồng: [engine-v0.2 §14, khối "bản miễn phí"](engine-v0.2.md). Máy dev như mục 3.3 (i7-12700H, Windows). Script đo nằm ở scratchpad của phiên, không vào repo; lệnh tái tạo ở cuối mục.

**Artifact đóng gói** (`backend/src/vgame/engine/data`):

| File | Thô | Nén (deflate) |
|---|---|---|
| `passages.npy` (952 × 1024 float32, mỗi chữ dense một hàng) | 3,90 MB | 3,62 MB |
| 24 file chunk JSON | 2,36 MB | 0,47 MB |
| `queries.npy` (47 × 1024 float32) | 0,19 MB | 0,18 MB |
| `documents.json`, `passages.json`, `rerank.json`, `queries.json`, `manifest.json` | 0,23 MB | 0,09 MB |
| `rerank.npy` (13 × 873 float32) | 0,05 MB | 0,04 MB |
| `replay-seed.json` (71 câu trả lời) | 0,05 MB | 0,01 MB |
| **Tổng** | **6,78 MB** | **4,41 MB** |

Trước đó index nằm trong `.cache` (11,7 MB: 24 ma trận float32 riêng, 9,2 MB) cùng 3,2 GB model.

**Độ chính xác.**
- 2.203 hàng của 24 biến thể chỉ có 952 chữ dense khác nhau; chữ lặp có vector bằng bit. Index mới (format 2) bằng bit với index cũ ở mọi biến thể và mọi vector câu hỏi; 4.608 bảng xếp hạng dense đầy đủ (47 câu × 24 biến thể × 4 handle: kho L1/L2 × `only_in_force`) giống hệt cả điểm lẫn thứ tự.
- float16 cho vector bị loại (đo của architect): 2.337/4.608 bảng xếp hạng đổi, 795 trong top 30, có đảo ở hạng 1, 44 lần vượt `score_threshold`, sai số điểm tối đa 3,9e-5.
- Điểm jina: thuộc [-3,71; 1,20], khoảng cách nhỏ nhất giữa hai điểm khác nhau 1,2e-7 (float16 có bước ~1e-3 ở vùng này). Điểm giống hệt nhau ở lô 1, 2, 8 và mọi thứ tự lô (đo của architect), và mọi logit vừa khít float32, nên bảng trả đúng số mà `FastReranker.score` trả.
- Test `slow` (`HF_HUB_OFFLINE=1`, 183 s cả bộ, 3/3 đạt): `test_shipped_vectors_equal_the_live_model` (e5 sống, 24 s), `test_shipped_rerank_scores_equal_the_live_model` (jina sống trên 651 cặp ứng viên của 13 câu L3 ở 4 biến thể, so cả điểm lẫn thứ tự, 97 s), `test_real_models_rank_the_anchor_questions`.
- Test e2e "model thật" (3 sao ở cả ba level với Oracle, mọi cờ `needs_real_models`) giờ là test nhanh trên artifact đóng gói: đạt.

**Dựng bảng rerank** (`HF_HUB_OFFLINE=1 uv run vgame-build-index`, vector dùng lại nên pha embedding 0 s): 11.349 cặp, 3.710 s. Mỗi câu (873 cặp, lô 2, chữ ngắn trước) mất 102–195 s khi máy rảnh (khoảng 120 ms mỗi cặp), 424–689 s cho 4 câu đầu khi máy đang bận việc khác; working set khoảng 3 GB (e5 + jina cùng nạp). Một câu hỏi mới vì vậy tốn khoảng 2 phút chấm (cộng thời gian nạp model); dựng lại từ đầu khoảng 33 phút embedding (mục 3.2) cộng 25–60 phút rerank.

**Cài đặt runtime** (`uv sync --frozen --no-dev`): 73 → 57 gói (Windows; 59 trên Linux), tải wheel Linux 79,5 → 41,0 MB (onnxruntime 22,5, pillow 6,6, hf-xet 4,0, tokenizers 3,2 MB không còn). Venv Windows có `--compile-bytecode`: 234 → 138 MB; cài lại khi cache uv ấm: 7,2 → 4,0 s.

**Đo qua HTTP.** Venv `uv sync --frozen --no-dev --compile-bytecode`; `python -m uvicorn --factory vgame.main:create_app` như `startCommand`; `ENV=production`, key giả, `DAILY_LLM_CALL_CAP=0` (lượt không có trong seed không thể gọi ra mạng), `MAX_CONCURRENT_RUNS=1`, `OPENBLAS_NUM_THREADS=1`, `ENGINE_CACHE_DIR` trống. POST rồi đọc hết SSE, tuần tự; RAM và CPU của tiến trình server lấy bằng `GetProcessMemoryInfo`/`GetProcessTimes`.

| Thời điểm / lượt | CPU server | Wall | SSE | Working set (đỉnh) |
|---|---|---|---|---|
| Khởi động tới `/api/health` 200 | 1,84 s | 2,2 s | | 118 MB |
| L1 lời giải mẫu (lần 1 / 2), 3 sao, 10/10 phát lại | 0,19 / 0,06 s | 0,19 / 0,12 s | 36 KB | 124 / 127 MB |
| L1 khởi đầu, 0 sao, 10/10 phát lại | 0,05 / 0,11 s | 0,04 / 0,10 s | 31 KB | 124 / 127 MB |
| L2 lời giải mẫu, 3 sao, 13/13 phát lại | 0,13 / 0,16 s | 0,12 / 0,16 s | 47 KB | 125 / 127 MB |
| L2 khởi đầu, 0 sao, 13/13 phát lại | 0,11 / 0,13 s | 0,14 / 0,16 s | 49 KB | 125 / 127 MB |
| L3 lời giải mẫu, 3 sao, 13/13 phát lại | 0,23 / 0,22 s | 0,24 / 0,23 s | 97 KB | 127 / 128 MB |
| L3 khởi đầu, 0 sao, 13/13 phát lại | 0,13 / 0,13 s | 0,14 / 0,13 s | 46 KB | 127 / 128 MB |
| L3 nặng nhất (`co_dinh` 128/20, `bm` 10, `fu` 10, `rr` 5), không có trong seed: `run.failed{llm_unavailable}` với câu "7 giờ sáng" | 0,11 s | 0,13 s | 28 KB | 131 MB |

- **Đỉnh RAM 131 MB working set, 148 MB private** (mục tiêu < 300 MB, giới hạn 512 MB). fastembed/onnxruntime không được nạp (test `test_engine_uses_the_rerank_table_and_never_imports_model_libraries` chạy trong tiến trình mới). Linux đếm RSS khác Windows một chút; `OPENBLAS_NUM_THREADS=1` bỏ bộ đệm của các luồng BLAS rỗi (Windows committed 755 → 143 MB, đo của architect).
- **Sửa lỗi vòng 1 (2026-10-09): tiến trình sống lâu.** QA đo thêm: mỗi `IndexHandle` (24 biến thể × 2 kho × `only_in_force` = 96) giữ bản chép vector và một model BM25 mãi mãi, nên một server chạy nhiều giờ lên khoảng 250 MB working set, 290–300 MB private. Sau sửa (view giữ chỉ số hàng, BM25 giữ 4 handle gần nhất), cùng cách đo trên, venv chỉ có phụ thuộc runtime:

  | Thời điểm | CPU server | Working set | Private |
  |---|---|---|---|
  | Khởi động | 1,86 s | 118 MB | 104 MB |
  | Lời giải mẫu L1 / L2 / L3 (3 sao, phát lại) | 0,22 / 0,08 / 0,09 s | 124–126 MB | 142–143 MB |
  | Đồ thị khởi đầu L1 / L2 / L3 (0 sao, phát lại) | 0,05 / 0,08 / 0,06 s | 126 MB | 143 MB |
  | L3 nặng nhất (`run.failed{llm_unavailable}`) | 0,09 s | 128 MB | 146 MB |
  | 96 lượt, mỗi lượt một handle khác (L2, L3 × 24 biến thể × `only_in_force`), 4,7 s | | 141 MB | 159 MB |
  | Thêm 200 lượt đã lưu (`RunStore` đầy), 15,1 s | | **158 MB** | **175 MB** |

  Trong tiến trình, chạm cả 96 handle: +96 → +5 MB working set, tracemalloc +92 → +2,6 MB. Dựng lại một BM25 khi rơi khỏi LRU mất khoảng 6 ms (khoảng 60 ms ở 0,1 CPU). Linux RSS chưa đo (Render tab Metrics sau deploy).
- **Ước tính 0,1 CPU = CPU × 10:** lượt đã lưu 0,5–2,3 s; khởi động khoảng 18 s sau khi Render thức (cộng khoảng một phút Render tự mất). Đồ thị L3 hợp lệ nặng nhất trong tiến trình, đủ 13 ca với Oracle: 0,42 s CPU lần đầu (dựng BM25 cho biến thể mới), 0,17 s lần sau, tức 2–4 s ở 0,1 CPU (trước: rerank sống 32,9 s, 3,2 GB). Lượt có đồ thị mới bị chặn bởi Gemini: mỗi ca p50 1,3–1,4 s ở lần sinh seed dưới đây, 3 ca song song.
- Không cần gzip: một lượt 28–97 KB, 5 GB băng thông đủ cho khoảng 50 nghìn lượt.

**Sinh seed** (`scripts/spike_llm.py --cap 80 --seed …`, lệnh trong docstring, chờ 65 s giữa các level): 6 run (lời giải mẫu và khởi đầu của 3 level), 72 lời gọi LLM, 43 lấy từ cache phát lại cũ, **29 lời gọi Gemini thật**, đều do `gemini-3.5-flash-lite` trả lời (`stop=end`), không 429, không model dự phòng. Seed có 71 mục (72 request, hai request giống hệt nhau). Chạy lại với `--cap 0` từ một cache trống (chỉ có seed): 72/72 phát lại, 0 lời gọi mạng, sao và token như lần đầu.

**Bỏ qua có chủ ý:** bỏ trường `text` khỏi chunk JSON (tiết kiệm ~1,9 MB, tổng đã dưới 10 MB), chia nhỏ cặp rerank theo top-k mà đồ thị hợp lệ chạm tới (ít cặp hơn khoảng 3 lần nhưng gắn chặt vào `param_limits` và phải dựng BM25 của 24 biến thể lúc khởi động để kiểm), gzip, `MALLOC_ARENA_MAX`, chế độ chỉ phát lại khi không có key, seed thêm N2–N8 (khoảng 210 lời gọi).

```bash
cd backend
HF_HUB_OFFLINE=1 uv run vgame-build-index          # index + bảng rerank (model trong ENGINE_CACHE_DIR/models)
HF_HUB_OFFLINE=1 uv run pytest -m slow             # so với e5/jina sống
uv run python scripts/spike_llm.py --cap 80 --seed src/vgame/engine/data/replay-seed.json \
  grounded-citation:ref grounded-citation:starter wait:65 \
  chunk-tuning:ref chunk-tuning:starter wait:65 \
  article-number-lookup:ref article-number-lookup:starter
```

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
#    Hiệu chỉnh ngân sách L1–L3: lệnh ở mục 3.2.
# 5. Các test cần model thật:
uv run pytest -m slow
```

Sau bước 3 và 4, điền các ô **?** ở mục 2.2 và mục 3 của báo cáo này, rồi chốt đề xuất 2–4.
