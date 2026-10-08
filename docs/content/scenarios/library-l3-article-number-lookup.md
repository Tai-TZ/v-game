> **Trạng thái:** kịch bản v0.1 cho engine, chưa chơi được. **Ràng buộc:** [build brief](../../design/build-brief-v0.1.md) D1–D7 và §3. Tên khối, tham số và cờ theo [Phần 3](../../design/part-3-block-system.md); đã áp các sửa lỗi của phản biện cho L3 (`param_limits` đủ thấp, kho không có bản 2019).
> **Liên quan:** [Tổng quan Thư viện](library.md) · [L1](library-l1-grounded-citation.md) · [L2](library-l2-chunk-tuning.md) · [Dạy lại](teach-back.md) · [Ca trực](daily-shift.md)

# Thư viện L3 · Hỏi bằng số điều (sự cố)

## 1. Metadata

| Trường | Giá trị |
|---|---|
| Mã level | `article-number-lookup` (order 3, khu `library`) |
| Kind | `incident` · type Phần 3: `rag`, sự cố |
| Khái niệm (zones.json) | Tìm kiếm lai · Tìm theo từ khoá · Xếp hạng lại |
| Slide gốc | **Ngày 8:** slide 12/46 "Hai trường phái tìm kiếm cốt lõi" (dense / sparse), 13/46 "Semantic search" (bỏ lỡ mã lỗi, tên riêng, số ticket), 14/46 "Lexical search (BM25)" (bỏ lỡ paraphrase; hợp với luật, mã), 15/46 "Hybrid search", 16/46 "RRF vs Alpha weighting" (k = 60; luật α 0,2–0,4), 17/46 "Reranking: vì sao top-k chưa đủ", 42/46 "Case study: hybrid lên bàn cân", 43/46 "ROI của RAG" (rerank: latency 1 s → 4 s), 44/46 "CI/CD cho RAG evaluation". **Ngày 14:** slide 10/42 "Khi nào chạy evaluation" (regression check mỗi lần đổi) |
| Điều kiện vào | Đã có sao 1 ở L2 |
| Kho | chỉ `qcdt-2024`; **không** có bản 2019 (D7) |
| Ca test | Nguồn sự thật: [`library-l3.json`](../golden/library-l3.json) (brief §4.2). 13 ca: `lib-l3-v01`–`v03`, 7 ca ẩn `h01`–`h07`, 3 ca bẫy: `lib-l3-t01` (diễn đạt lại), `lib-l3-t02` (hồi quy, dùng nguyên câu và tiêu chí của `lib-l2-v01`), `lib-l3-t03` (hỏi Điều 41 khoản 6, không tồn tại, phải từ chối). Thêm 4 ca ôn `lib-l3-r01`–`r04` |
| Khởi đầu | **bản sao lời giải tốt nhất ở L2 của người chơi**. Gợi ý đầu tiên luôn là "chạy lại lời giải cũ" (Phần 3 §3.3) |
| Thời lượng | lần chạy 1 ở khoảng phút 1:20; cả level 7–10 phút, thêm 60 giây kiểm tra |

## 2. Mục tiêu học

**Sau level này, người chơi làm được:**
1. Giải thích, có bằng chứng về hạng, vì sao tìm theo nghĩa trượt câu "Điều 47 khoản 2" và vì sao tìm từ khoá trượt câu hỏi bằng lời thường. Hai cách có hai điểm mù bù cho nhau. Đo bằng rubric dạy lại L3.
2. Lắp tìm kiếm lai (BM25 + vector + gộp), quyết định có cần xếp hạng lại hay không, để có ít nhất 8/10 ca thường đạt mà không làm vỡ ca của L2. Đo bằng sao 1 và sao 3.
3. Lý giải chi phí và lợi ích của rerank bằng con số của chính lần chạy: token, ms, hạng trước và sau. Đo bằng sao 2 và câu "Sửa thế nào" trong dạy lại.
4. Xếp đúng 3 câu hỏi mới vào "cần từ khoá", "cần nghĩa" hay "cần cả hai". Đo bằng bài 60 giây, đạt khi đúng ít nhất 2/3.

**Hiểu lầm nhắm tới:**
- Chính: "**Tìm theo nghĩa hiểu được mọi câu hỏi**", kể cả số hiệu. Thực tế (Ngày 8, slide 13/46): dense bỏ lỡ mã lỗi, tên riêng, số.
- Phụ: "Lời giải cũ đã đạt thì vẫn đúng" (sự cố) và "Thêm khối xếp hạng lại lúc nào cũng tốt hơn" (Ngày 8, slide 43/46: ROI).

## 3. Mồi truyện và Hiện trường

**Bối cảnh:**
- Sau vụ áp phích ở L1, ai cũng muốn biết Điều 47 **thật** nói gì, và họ hỏi thẳng bằng số điều.
- Đang là tuần đăng ký học phần nên câu hỏi đổ về gấp mười. Ban quản lý thư viện giới hạn mỗi câu chỉ được kéo tối đa 5 đoạn từ Vòm Sao.

**Hiện trường (≤ 25 giây):**
- Một hàng sinh viên dài trước quầy tra cứu. Ai cũng cầm cùng một tờ in tiêu đề "Điều 47 khoản 2", nhưng nội dung và con số là của một điều khác cùng họ.
- Khang, sinh viên năm nhất, giơ tờ in lên: "Em hỏi Điều 47 mà nó đọc cho em Điều 74!"
- Cô Lan mở cuốn quy chế giấy đúng trang Điều 47, đặt cạnh tờ in.
- Click, chạm hoặc nhấn E vào tờ in để Tua lại.

**Cờ thế giới:** hàng người trước quầy giải tán khi đạt sao 1. Bảng hồi quy L2 treo cạnh quầy (một dòng cho ca `lib-l3-t02`) chuyển xanh khi ca này đạt.

**Nhãn trung thực:** Tua lại phát lần chạy đã ghi của **lời giải mẫu L2** cho `lib-l3-v01`, đóng tem "kết quả đã lưu". Lần chạy 1 của người chơi là bản sao lời giải của chính họ, chạy thật.

## 4. Beat sheet

| # | Thời điểm | Trên màn hình | Người chơi làm | Lời thoại |
|---|---|---|---|---|
| 1 | 0:00–0:25 | Hiện trường | Click hoặc chạm tờ in | Cô Lan: "Sau vụ áp phích, ai cũng muốn biết Điều 47 thật nói gì. Và trợ lý của chúng ta trả lời bằng… Điều 74." |
| 2 | 0:25–0:50 | Tua lại: đèn pin chiếu câu "Điều 47 khoản 2", các sao Điều 74 và 41 sáng nhất; sao Điều 47 không sáng. Biển "Tuần đăng ký: tối đa 5 sao mỗi câu" treo lên Móc kéo | Xem | Cô Lan: "Tuần đăng ký học phần, câu hỏi đổ về gấp mười. Từ nay mỗi câu chỉ được kéo tối đa năm sao." · Nếu lời giải cũ có `top_k` > 5: thông báo DOM "Móc kéo của bạn đang ở {K}; đã hạ về 5 theo giới hạn tuần đăng ký." |
| 3 | 0:50–1:05 | Thẻ nhiệm vụ: "13 câu · ≥8/10 câu thường đúng, có câu của Khang · ca của Hà không được vỡ" | Đọc | Cô Lan: "Tối nay có người hỏi bằng số điều, có người hỏi bằng lời thường. Tám trên mười câu thường phải đúng, kể cả câu của Khang, và ca của Hà hôm trước không được vỡ." |
| 4 | 1:05–1:20 | Phiếu đoán 1 | Chọn, bấm Mở ca | Cô Lan: "Bắt đầu từ lời giải cũ của bạn. Chạy lại xem nó vỡ chỗ nào." |
| 5 | 1:20–2:05 | **Lần chạy 1** (bản sao lời giải L2). Camera bám câu của Khang (`lib-l3-v01`) | Xem | Sau run: "Với Vòm Sao, '47' chỉ là một con số, chẳng mang nghĩa gì. Điều 74 và 41 nghe 'giống' câu hỏi hơn." |
| 6 | 2:05–2:35 | Menu "Vì sao câu #1 sai?" rồi chẩn đoán; hiện "đường đời hạng" của đoạn đáp án qua từng khối | Chọn lý do | — |
| 7 | 2:35–4:15 | Bàn thợ mở 3 khe mới: **Tủ ngăn kéo** (BM25), **Phễu** hoặc **Bập bênh** (gộp), **Kính lúp** (xếp hạng lại). Xem trước cho 3 câu mẫu: hai danh sách cạnh nhau và danh sách sau khi gộp hoặc soi lại, mỗi dòng có hạng và điểm thật | Lắp, chỉnh, chiếu thử | Ngăn kéo: "Tủ ngăn kéo thì ngược lại: không hiểu nghĩa, nhưng thấy số 47 là mở đúng ngăn." · Phễu: "Hai cách tìm, hai danh sách. Phễu gộp lại theo thứ hạng, không nhìn điểm." · Bập bênh: "Bập bênh thì nhìn điểm. Nghiêng về bên nào là tin bên đó hơn." · Kính lúp: "Kính lúp đọc kỹ từng cặp câu hỏi và đoạn, chậm mà chắc. Đừng soi cả kho, soi vài ứng viên thôi." |
| 8 | 4:15–4:30 | Phiếu đoán 2 | Chọn | — |
| 9 | 4:30–5:15 | Lần chạy 2 | Xem | Nếu chỉ còn BM25: "Có câu hỏi bằng lời thường mà ngăn kéo trả về toàn đoạn không liên quan. Quy chế đâu dùng chữ của người hỏi." · Nếu `lib-l3-t02` trượt: "Nhớ ca của Hà không? Sửa chỗ này mà vỡ chỗ kia thì coi như chưa sửa." |
| 10 | 5:15–6:15 | Hậu kiểm 2: menu, chẩn đoán, đường đời hạng, dải token và ms theo khối | Chỉnh tiếp | Nếu vượt ngân sách: "Phễu đổ mười đoạn vào thùng thì đúng mà đắt. Kính lúp tốn mili giây, nhưng nó giúp bạn chỉ cần mang ba đoạn." |
| 11 | 6:15–7:00 | Lần chạy 3 | Xem | — |
| 12 | 7:00–7:45 | Truy vết; Báo Tường; hàng người giải tán; bảng hồi quy xanh | Mở các ca | Sao 1: "Hàng người giải tán rồi. Hai cách tìm, mỗi cách che điểm mù cho cách kia." · Sao 3: "Ca của Hà vẫn xanh. Cái bảng đó là thứ mình xem đầu tiên mỗi khi có ai sửa trợ lý." |
| 13 | 7:45–8:45 | Lật mặt sau (mục 12) | Xem, tải | "Lần này lật bàn lên, bạn sẽ thấy gần như không còn đồ chơi nào, chỉ còn đồ thị thật." |
| 14 | 8:45–9:45 | Kiểm tra 60 giây | Phân loại 3 câu | — |
| — | sau level | Dạy lại (tuỳ chọn) | | Bống: "Sao Vòm Sao giỏi thế mà lại thua cái tủ ngăn kéo ạ?" |

## 5. Đồ chơi và khối Phần 3

Ẩn dụ phai dần (research §3.5). Ở L3, mỗi đồ chơi in tên khối thật to ngang tên đồ chơi, và chế độ "Bản vẽ" (React Flow) mở sẵn ở tab thứ hai.

| Đồ chơi | Khối · tham số Phần 3 | Giá trị cho phép ở L3 | Trạng thái |
|---|---|---|---|
| Kệ sách | `corpus` | chỉ `qcdt-2024` (D7) | khoá |
| Lược dao, Nam châm, Băng keo | `chunker` | như L2: {128, 256, 512, 1024} × {`co_dinh`, `theo_dieu`} × {0, 10, 20} | mở |
| Vòm Sao, Móc kéo K | `vector_search.top_k` | **1–5** | mở, giới hạn mới |
| Màn lọc mờ | `vector_search.score_threshold` | 0–0,9, bước 0,05 | mở |
| Kính lọc hiệu lực | `chunker.only_in_force` (tầng Index, engine-v0.2 E6) | `false` / `true`; không có tác dụng vì kho L3 không có văn bản hết hiệu lực. Hiện mờ với nhãn "Kho tối nay không có văn bản hết hiệu lực" | mở |
| **Tủ ngăn kéo** + Móc kéo ngăn | `bm25_search.top_k` | 1–10 (tokenizer giữ chữ số: "điều", "47") | **mở** |
| **Phễu RRF** (bi rơi nặng 1/(k+hạng)) | `fusion` `method: "rrf"`, `k`, `top_k` | `k` 1–100 (mặc định 60); `top_k` 1–10 | **mở** |
| **Bập bênh α** | `fusion` `method: "alpha"`, `alpha`, `top_k` | `alpha` 0–1 bước 0,1 (trọng số của vector; mặc định 0,5); `top_k` 1–10 | **mở** (Phễu và Bập bênh là hai mặt của cùng khe Gộp) |
| **Kính lúp** | `rerank.top_n` | 1–5 và ≤ số ứng viên đi vào | **mở** |
| Thùng, tem, Bộ Óc, Lăng kính | như L1 | như L1 | như L1 |

**Khe trống:**
- Khe Gộp để trống mà vẫn có hai cách tìm: cả hai danh sách đổ thẳng vào thùng. Đây là đồ thị hợp lệ vì packer nhận `Docs (nhiều)`; đồ thị này trượt vì token.
- Khe Truy xuất nghĩa để trống: chỉ còn BM25.
- Khe Kính lúp để trống: không xếp hạng lại.

Nếu `rerank.top_n` = số ứng viên, bàn thợ hiện `W_RERANK_NOOP` ("Xếp hạng lại giữ 5/5 đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian"). Thông báo này không chặn chạy.

**Cấu hình khởi đầu:** bản sao lời giải L2 tốt nhất của người chơi, kẹp `vector_search.top_k` về ≤ 5 và có thông báo. Kho chỉ còn bản 2024. Khe ngăn kéo, gộp và kính lúp đều trống.

**Khai báo level:**
- `allowed_blocks`: như L2 + `bm25_search`, `fusion`, `rerank`.
- `locked_nodes`: `q`, `kb`, `out`.
- `param_limits`:

```json
{"vector_search.top_k": {"ge": 1, "le": 5},
 "bm25_search.top_k": {"ge": 1, "le": 10},
 "fusion.top_k": {"ge": 1, "le": 10},
 "fusion.k": {"ge": 1, "le": 100},
 "rerank.top_n": {"ge": 1, "le": 5},
 "context_packer.token_budget": {"const": 3000},
 "context_packer.on_overflow": {"const": "cat_duoi"},
 "llm.profile": {"const": "can_bang"}}
```

Luật chéo (Phần 3 §3.5): `rerank.top_n` ≤ số ứng viên phía trước.

**Giới hạn `vector_search.top_k` ≤ 5 là giá trị tạm** (sửa lỗi phản biện: dense phải trượt ở `top_k` lớn nhất được phép). Cổng phát hành đo hạng dense của đoạn đáp án ở **mọi ca vai `tra-so`** trên **cả 24 biến thể**, rồi đặt giới hạn = (hạng nhỏ nhất − 1), sàn 3. Nếu ở sàn 3 dense vẫn với tới đáp án, level trả về người viết nội dung để tăng độ na ná của họ 41/47/74.

**Lời giải mẫu (hiệu chỉnh, không hiện):**

```json
{"schema": 1,
 "nodes": [{"id": "q", "type": "input"},
           {"id": "ix", "type": "chunker", "params": {"strategy": "theo_dieu", "chunk_size": 512, "overlap_pct": 10}},
           {"id": "vs", "type": "vector_search", "params": {"top_k": 5}},
           {"id": "bm", "type": "bm25_search", "params": {"top_k": 5}},
           {"id": "fu", "type": "fusion", "params": {"method": "rrf", "k": 60, "top_k": 10}},
           {"id": "rr", "type": "rerank", "params": {"top_n": 3}},
           {"id": "pk", "type": "context_packer", "params": {"token_budget": 3000, "on_overflow": "cat_duoi", "cite_ids": true}},
           {"id": "llm", "type": "llm", "params": {"profile": "can_bang", "system_prompt": "<G1> <G2> <G3>"}},
           {"id": "out", "type": "output"}],
 "edges": [["q.query", "vs.query"], ["ix.index", "vs.index"], ["q.query", "bm.query"], ["ix.index", "bm.index"],
           ["vs.docs", "fu.docs"], ["bm.docs", "fu.docs"], ["q.query", "rr.query"], ["fu.docs", "rr.docs"],
           ["rr.docs", "pk.docs"], ["q.query", "pk.query"], ["pk.context", "llm.context"], ["llm.answer", "out.answer"]]}
```

(JSON minh hoạ theo định dạng §3.4; tên cổng của `bm25_search` và `rerank` chốt theo registry.)

## 6. Cấu hình ngây thơ phải trượt

[T] = tất định. [M] = phụ thuộc model hoặc reranker, phải qua cổng hiệu chỉnh.

| # | Cấu hình | Cơ chế | Ca trượt | Cờ |
|---|---|---|---|---|
| N1 | **Chạy lại lời giải L2** (chỉ dense, `top_k` ≤ 5) | [T] Với câu chỉ có số hiệu, embedding gần như không mang nghĩa của "47". Điều 74 và 41 cùng họ, lời văn na ná, nên đứng trên Điều 47. Hạng dense của đoạn đáp án > giới hạn `top_k` trên mọi biến thể (cổng phát hành kiểm) | `lib-l3-v01`, ca thấy được vai `tra-so` thứ hai và mọi ca ẩn vai `tra-so` → **sao 1** | `ret.gold_missing`, `ret.gold_rank` (dense) |
| N2 | Kéo Móc kéo lên tối đa | [T] G06 chặn mọi giá trị > 5. Ở 5 vẫn như N1 | như N1 | như N1 |
| N3 | **Chỉ BM25** (tháo Vòm Sao) | [T] Câu `lib-l3-t01` không có từ đặc thù nào chung với Điều 12 (chỉ chung cụm "kết quả học tập" có ở 9 điều), nên BM25 xếp đoạn đáp án hạng ≥ 15 trên mọi biến thể `theo_dieu` và `co_dinh` ≤ 256 (đo 2026-10-08), ngoài `bm25_search.top_k` tối đa (10) | `lib-l3-t01` và ca ẩn vai `dien-dat-lai` → **sao 3**, có thể cả sao 1 | `ret.gold_missing`, `ret.gold_rank` (bm25) |
| N4 | Hybrid, khe Gộp **trống** (hai danh sách đổ thẳng vào thùng) | [T] Tối đa 5 + 10 đoạn ≫ thùng 3.000 token, nên `cat_duoi` cắt theo thứ tự đến. Đoạn đúng đứng cuối danh sách BM25 bị cắt, và mỗi ca ≈ 3.000 token | ca có đoạn đúng chỉ nằm ở danh sách sau; **sao 2** | `pack.dropped`, `ctx.gold_dropped`, `budget.exceeded` |
| N5 | Hybrid RRF, `fusion.top_k` 10, **không** Kính lúp | [T] 10 đoạn × ~350 token làm thùng gần đầy ở mọi ca (dặn dò đi riêng, ngoài thùng, engine-v0.2 E8), nên riêng token đầu vào đã vượt ngân sách sao 2: engine đo 26.850/22.000 (regex-v1), Gemini thật 35.803/22.000 (2026-10-08, engine-spike-report §3.2). Ca vai `tra-so-kho` có thể bị cắt ở thùng nếu đoạn đúng đứng hạng ≥ 8 sau gộp | **sao 2**; có thể có ca `tra-so-kho` | `pack.tokens`, `budget.exceeded`, `ctx.gold_dropped` |
| N6 | Bập bênh α ≥ 0,7 (mức "chatbot FAQ" trên slide) | [T] Điểm đã chuẩn hoá nghiêng về dense, nên Điều 74 và 41 vẫn đứng trên 47 sau khi gộp. Cổng phát hành kiểm cho α ∈ {0,7; 0,8; 0,9; 1,0} với `fusion.top_k` ≤ 3 | `lib-l3-v01` và ca `tra-so` (khi `fusion.top_k` nhỏ) | `ret.gold_rank` (fusion) |
| N7 | Hybrid + Kính lúp giữ 1 đoạn (`top_n` 1), đổi Lược về `co_dinh` 128/0 | [T] Ở 128/0 không đoạn nào chạm cả khoản 2 lẫn khoản 3 Điều 12, Kính lúp giữ 1 đoạn nên luôn thiếu một khoản. Cùng `top_n` 1 với `theo_dieu` 512/10 (cả Điều 12 một đoạn) vẫn đạt `t02`, nên lỗi nằm ở cách cắt (đo 2026-10-08) | `lib-l3-t02` (hồi quy) → **sao 3** | `ret.gold_missing` |
| N8 | Hybrid, `fusion.top_k` 3, không Kính lúp | [M] với ca `tra-so-kho`: đoạn đúng đứng hạng 4–8 sau gộp nên rơi khỏi top 3; Kính lúp đưa nó lên ≤ 3. Phụ thuộc chất lượng cross-encoder với tiếng Việt (spike Phần 3 §3.9) | các ca ẩn vai `tra-so-kho` | `ret.gold_rank` (fusion), sau Kính lúp |

**`lib-l3-t03` không có cấu hình ngây thơ riêng** (golden `bites: []`). Ca này canh để thẻ G3 vẫn còn trong Lăng kính khi người chơi lắp lại đồ thị. Nó trượt khi trợ lý **không từ chối**: Lăng kính thiếu G3 hoặc có G5, BM25 kéo Điều 41 lên rất cao, và model đọc khoản 2 hoặc khoản 4 thay cho khoản 6 [M]. Theo ghi chú golden, ca này tính `info` cho tới khi qua cổng hiệu chỉnh.

**Đường đời hạng** của đoạn đáp án `lib-l3-v01` dự kiến (minh hoạ, cổng phát hành thay bằng số đo):
- dense: hạng ~20+ (ngoài top 5);
- BM25: #1;
- RRF: #1–#2;
- Kính lúp: #1.

## 7. Bước đoán

| Lần | Câu hỏi | Lựa chọn | Chấm (sau run) |
|---|---|---|---|
| 1 | "Chạy lại lời giải cũ: câu 'Điều 47 khoản 2' của Khang sẽ…" | Đạt · Lấy nhầm điều na ná · Không lấy được gì · Từ chối trả lời | `ret.gold_missing` mà thùng có điều khác cùng họ → 2; thùng rỗng → 3; từ chối → 4; đạt → 1 |
| 2 | "Sau khi gộp, đoạn đáp án câu của Khang sẽ đứng hạng mấy?" | #1 · #2–3 · #4–10 · Không có mặt | `ret.gold_rank` ở khối cuối cùng trước thùng |
| 3+ (nếu có Kính lúp) | "Kính lúp sẽ làm mỗi câu chậm thêm bao nhiêu?" | < 100 ms · 100–500 ms · 0,5–2 s · > 2 s | `ms` của `step.finished` (rerank), trung vị theo ca |

## 8. Biên đạo lần chạy

Áp dụng luật trung thực của [L1 mục 8](library-l1-grounded-citation.md#8-biên-đạo-lần-chạy). Thêm:

| Event | Hình ảnh | Bản chữ |
|---|---|---|
| `step.started` (bm25_search) | Tủ ngăn kéo rung nhẹ, chưa ngăn nào mở | "Đang tìm theo từ khoá." |
| `step.finished` (bm25_search, `detail{chunk_ids, scores}`) | Các ngăn bật ra theo hạng; ngăn "47" in số điểm BM25 thật | "BM25: Điều 47 (12,4), Điều 47 k3 (9,1)…" |
| `step.finished` (fusion, `detail{ranks}`) | RRF: bi rơi qua phễu, mỗi bi nặng 1/(k+hạng), có in con số. Alpha: bập bênh nghiêng đúng α | "Gộp RRF (k = 60): 1. Điều 47 k2 · 2. Điều 74 k2 · 3. …" |
| `step.started` (rerank) | Kính lúp hạ xuống; đồng hồ ms chạy theo thời gian thật | "Đang xếp hạng lại {n} ứng viên." |
| `step.finished` (rerank, `detail{before, after}`) | Các khối đổi chỗ, mũi tên ghi hạng cũ → mới; kim đồng hồ dừng đúng `ms` thật | "Xếp hạng lại ({ms} ms): Điều 47 k2 #2 → #1." |
| `case.graded` | **ĐẠT:** sinh viên trong hàng gật đầu, rời quầy. **TRƯỢT:** sinh viên ở lại, giơ tờ in. Ca `lib-l3-t02`: một dòng của bảng hồi quy L2 đổi xanh hoặc đỏ | Chữ ĐẠT/TRƯỢT |
| `run.finished` | Truy vết: "đường đời hạng" của đoạn đáp án qua dense → BM25 → gộp → kính lúp → thùng; dải ms và token theo khối ("Truy xuất 0 · Rerank 0 · Trả lời 3,4k token · Rerank 420 ms") | Đọc thành bảng hạng theo khối |

Ca bám camera là `lib-l3-v01`. Câu hỏi của ca ẩn và ca bẫy không bao giờ hiện chữ; truy vết ghi vai, đạt/trượt và hạng theo khối.

## 9. Tiêu chí chấm một ca

Giống L1 và L2; chi tiết ở `grading` của [`library-l3.json`](../golden/library-l3.json). Riêng ca vai `tra-so`:
- `answer_points` là con số hoặc dữ kiện riêng của khoản được hỏi;
- `forbidden` gồm các con số tương ứng của hai điều cùng họ.

Nhờ vậy, trả lời bằng nội dung Điều 74 thay cho Điều 47 trượt một cách tất định.

`lib-l3-t02` dùng đúng câu và tiêu chí của `lib-l2-v01`.

`lib-l3-t03` (`expect: abstain`) chấm như ca từ chối ở [L1 mục 9](library-l1-grounded-citation.md#9-tiêu-chí-chấm-một-ca-máy-kiểm): cần một dấu hiệu trong `grading.refusal_markers` (ví dụ "không có khoản"). Được trích đoạn có thật của Điều 41 để chỉ ra điều này chỉ có 4 khoản; trích bịa khoản 6 (`llm.cite_unknown`) hoặc đọc nội dung khoản khác như thể là khoản 6 thì trượt.

## 10. Sao

| Sao | Điều kiện | Ghi chú |
|---|---|---|
| 1 | Ít nhất 8/10 ca thường đạt (`v01`–`v03` + 7 ca ẩn), **bắt buộc có `lib-l3-v01`** | Xong khu Thư viện; hàng người giải tán |
| 2 | Có sao 1 **và** tổng token ≤ **22.000** | 1,25 × p50 của lời giải mẫu, làm tròn lên tới nghìn. Hiệu chỉnh 2026-10-08 với `gemini-3.5-flash-lite`, `can_bang`: lời giải mẫu 17.348 token (engine-spike-report §3.2). Rerank không tốn token LLM; chi phí của nó là ms, hiện trong truy vết |
| 3 | Có sao 1 **và** mọi ca bẫy (`lib-l3-t01`, `t02`, `t03`) đều đạt | `t01` bảo vệ phần dense; `t02` là hồi quy; `t03` giữ thẻ từ chối khi lắp hybrid. `t03` là [M], tính `info` cho tới khi qua cổng hiệu chỉnh (mục 6) |

**Cơ chế trượt của từng ca bẫy:**
- `t01`: chỉ còn BM25, câu lời thường không trùng từ đặc thù nào với Điều 12 (N3, [T]).
- `t02`: đổi cách cắt làm khoản 3 Điều 12 tách khỏi khoản 2, với Kính lúp giữ 1 đoạn (N7, [T]).
- `t03`: không từ chối, vì Lăng kính thiếu G3 hoặc có G5 và model đọc khoản khác của Điều 41 thay vào ([M]).

**Đạt được bằng đồ chơi đã mở?** Có.
- Sao 1 cần BM25 + gộp (mở ở L3).
- Sao 2 cần ít đoạn trong thùng, hoặc bằng Kính lúp `top_n` 3, hoặc bằng `fusion.top_k` nhỏ (mở ở L3).
- Sao 3 cần giữ dense trong hybrid và giữ chunker tốt (đã mở ở L1–L2), và giữ thẻ G3 trong Lăng kính (mở ở L1). Lời giải mẫu (mục 5) có đủ cả ba.

Nếu cổng phát hành thấy Kính lúp không đưa được các ca `tra-so-kho` vào top 3 (N8 không cắn), các ca đó được hạ thành `info` và ngân sách sao 2 được hiệu chỉnh lại. Sao vẫn đạt được.

## 11. Chẩn đoán và gợi ý

**Menu "Vì sao câu #N sai?"** (đáp án do cờ quyết định):

| Tình huống | Lựa chọn | Đáp án theo cờ |
|---|---|---|
| `lib-l3-v01` trượt với lời giải cũ | A. Tìm theo nghĩa xếp các điều na ná (74, 41) cao hơn 47 · B. Đoạn quá nhỏ · C. top_k quá thấp · D. Model bịa | `ret.gold_rank` (dense) > K và thùng có điều cùng họ → A |
| Ca diễn đạt lại trượt | A. **Câu hỏi không dùng chữ nào có trong điều luật, nên tìm từ khoá trượt** · B. Gộp sai · C. Kính lúp loại mất · D. Model bịa | `ret.gold_rank` (bm25) vô cực và dense không có trong đồ thị → A; đoạn có mặt trước Kính lúp mà mất sau → C |
| Vượt ngân sách | **Gộp ra nhiều đoạn quá, thùng gần đầy ở mọi câu** · Kính lúp tốn token · Câu hỏi dài · Model trả lời dài | `budget.exceeded` + `pack.tokens` |
| `lib-l3-t02` trượt | **Đổi cách cắt làm khoản ngoại lệ tách khỏi đoạn chính** · BM25 không bắt được · Kính lúp loại mất · Model quên | `ret.boundary_split` hoặc `ret.gold_missing` → 1 (cách cắt đã đổi); đoạn mất sau Kính lúp mà cách cắt vẫn như lời giải L2 → 3 |
| `lib-l3-t03` trượt (ca bẫy hỏi một khoản không có) | **Lăng kính không dặn "không thấy thì nói không có", nên model đọc một khoản khác thay vào** · BM25 kéo nhầm điều · Thùng bị cắt · top_k quá thấp | thiếu dấu hiệu từ chối hoặc có `llm.cite_unknown` → 1 |

**Lời chẩn đoán gắn với bằng chứng:**

| Cờ | Cô Lan nói |
|---|---|
| `ret.gold_rank` (dense) | "Đoạn Điều 47 khoản 2 đứng hạng {rank_dense} ở Vòm Sao. Điều {d1} và Điều {d2} chiếm chỗ trên nó với cosine {s1}, {s2}." |
| `ret.gold_rank` (bm25) | "Ở tủ ngăn kéo, đoạn đúng của câu #{n} đứng hạng {rank_bm25}. Câu hỏi không có chữ nào trùng với điều luật." |
| `ret.gold_rank` (fusion → rerank) | "Sau phễu, đoạn đúng đứng hạng {r_fu}. Kính lúp đưa nó lên {r_rr}, mất {ms} ms." |
| `ctx.gold_dropped` | "Đoạn đúng có mặt, hạng {rank}, nhưng thùng đầy trước khi tới lượt nó." |
| hồi quy | "Ca của Hà trượt: {flag}. Lần đổi này làm vỡ thứ đã chạy được." |
| bẫy từ chối trượt | "Có ca bẫy hỏi về một khoản không hề có, mà trợ lý vẫn đọc ra nội dung. Thùng của ca đó có {dieu_list}." (không hiện câu hỏi của ca bẫy) |
| `budget.exceeded` | "Mỗi câu mang {avg_docs} đoạn vào thùng. Kính lúp tốn {ms} ms nhưng không tốn token nào." |
| `budget.exceeded`, graph không có Kính lúp (`budget.exceeded:no_rerank`, 2026-10-08, chờ người viết nội dung duyệt) | "Mỗi câu mang {avg_docs} đoạn vào thùng. Kính lúp tốn mili giây, nhưng nó giúp bạn chỉ cần mang ba đoạn." |

**Ba gợi ý tăng dần.** Gợi ý 1 của level sự cố luôn là chạy lại lời giải cũ (Phần 3 §3.3).

| Mục tiêu đang trượt | Gợi ý 1 | Gợi ý 2 | Gợi ý 3 |
|---|---|---|---|
| Sao 1 | "Chạy lại lời giải cũ trước đã, rồi nhìn hạng của Điều 47 ở Vòm Sao." | Đường đời hạng của đoạn đáp án v01, kèm 3 sao đứng trên nó | "Lắp Tủ ngăn kéo cạnh Vòm Sao rồi gộp hai danh sách bằng Phễu." |
| Sao 3 (`t01`) | "Có câu hỏi bằng lời thường. Cách tìm nào hiểu được lời thường?" | Hạng BM25 của đoạn đúng của ca bẫy là "không có mặt"; hạng dense là {r} (không kèm câu hỏi) | "Giữ cả Vòm Sao lẫn Tủ ngăn kéo. Hai điểm mù bù cho nhau." |
| Sao 3 (`t02`) | "Ca của Hà ở L2 cần gì để đạt?" | So cấu hình chunker hiện tại với lời giải L2 của chính bạn | "Đưa Lược về cách cắt đã đạt ở L2. Mỗi lần đổi, nhìn bảng hồi quy trước tiên." |
| Sao 3 (`t03`) | "Đọc lại thẻ đang cắm trong Lăng kính. Thẻ nào dặn nó nói 'không có'?" | Ca bẫy trượt vì không có dấu hiệu từ chối; kèm danh sách số điều đã vào thùng, không kèm câu hỏi | "Cắm lại thẻ G3, rút G5 nếu có. Tìm giỏi hơn không có nghĩa là thôi phải biết nói 'không có'." |
| Sao 2 | "Bao nhiêu đoạn đi vào thùng ở mỗi câu?" | Dải token theo ca, kèm hạng đoạn đúng sau gộp | "Đặt Kính lúp giữ 3 đoạn sau Phễu, hoặc thu miệng phễu lại; chiếu thử 3 câu mẫu." |

## 12. Lật mặt sau

1. **Cấu hình:** graph JSON đầy đủ.
2. **Đồ thị:** đoạn LangGraph rút gọn có fan-in (Phần 3 §3.6, bước 3):

   ```python
   g.add_node("vs", instrumented(vector_search, {"top_k": 5}, deps))
   g.add_node("bm", instrumented(bm25_search, {"top_k": 5}, deps))
   g.add_node("fu", instrumented(fusion, {"method": "rrf", "k": 60, "top_k": 10}, deps))
   g.add_node("rr", instrumented(rerank, {"top_n": 3}, deps))
   g.add_edge(START, "vs"); g.add_edge(START, "bm")
   g.add_edge(["vs", "bm"], "fu")          # fan-in: fu chạy khi cả hai xong
   g.add_edge("fu", "rr"); g.add_edge("rr", "pk"); g.add_edge("pk", "llm"); g.add_edge("llm", END)
   ```

3. **Prompt thật (X-quang).**
4. **Bảng hạng theo khối** của mọi ca thấy được. Ca ẩn chỉ hiện vai và hạng.

**Thẻ "Ngoài đời thật"**
- Dense hợp với câu hỏi tự nhiên; sparse (BM25) hợp với mã lỗi, tên riêng, số điều luật (Ngày 8, slide 12–14/46).
- Corpus có cả hai loại thì thử hybrid trước (slide 15/46). Trong Python, `rank_bm25` (`BM25Okapi`) là cách nhanh để có BM25. Nhớ cho tokenizer giữ chữ số.
- RRF: `điểm(d) = Σ 1/(k + hạng_r(d))`, k thường là 60. Nó không cần chuẩn hoá điểm nên hợp khi mới bắt đầu. Alpha cần tinh chỉnh theo miền; slide gợi ý 0,2–0,4 cho luật và mã (slide 16/46).
- Rerank bằng cross-encoder chỉ dùng trên vài chục ứng viên. Hãy đo ROI bằng chất lượng, độ trễ và chi phí trước khi giữ (slide 43/46).
- Giữ một bộ ca hồi quy và chạy lại mỗi lần đổi cấu hình, như unit test (Ngày 8, slide 44/46; Ngày 14, slide 10/42).

## 13. Dạy lại

Bống hỏi: **"Sao Vòm Sao giỏi thế mà lại thua cái tủ ngăn kéo ạ? Thế bỏ hẳn Vòm Sao đi được không?"**

Khuôn và rubric ở [teach-back.md](teach-back.md) mục 3.3.

## 14. Biến thể ôn cho ca trực

| Ca ôn | Vai | Sự cố dựng sẵn | Phải sửa |
|---|---|---|---|
| `lib-l3-r01` | `tra-so` cho một điều khác trong họ, ví dụ "khoản 2 Điều 74" | "Ai đó tháo Tủ ngăn kéo để chạy cho nhanh" | lắp lại BM25 + gộp |
| `lib-l3-r02` | `dien-dat-lai` cho một điều khác Điều 12 | "Bống chuyển sang chỉ dùng ngăn kéo vì 'nhanh hơn'" | lắp lại Vòm Sao trong hybrid |
| `lib-l3-r03` | `tra-so-kho`: vừa có số, vừa có lời thường | "Kính lúp bị tháo, miệng phễu thu về 3" | Kính lúp `top_n` 3 sau Phễu 10, hoặc nới phễu (tốn token hơn) |
| `lib-l3-r04` | `tra-so` cho một điều **ngoài** họ 41/47/74 | "Bống khôi phục lời giải L2 cũ, chỉ có Vòm Sao, 'cho chắc'" | lắp lại BM25 + gộp |

## 15. Tiếp cận

| Ẩn dụ | Bản chữ |
|---|---|
| Tủ ngăn kéo | Danh sách "Tìm từ khoá (BM25): hạng · đoạn · điểm" |
| Phễu RRF, bi | Bảng "Gộp RRF (k = {k}): đoạn · hạng dense · hạng BM25 · điểm RRF" kèm công thức |
| Bập bênh α | Thanh trượt "Trọng số tìm theo nghĩa (alpha)", bước 0,1, đọc to giá trị |
| Kính lúp | "Xếp hạng lại: giữ {n} đoạn. Trước → sau: …; thời gian {ms} ms" |
| Đường đời hạng | Bảng "Khối · hạng của đoạn đáp án" (chỉ sau run) |
| Hàng người, bảng hồi quy | "Ca thường đạt {a}/10. Hồi quy L2: {đạt/trượt}." |

Chuyển động theo `prefers-reduced-motion`: không có bi rơi hay khối đổi chỗ; bảng hạng đổi ngay, có highlight tĩnh.

## 16. Telemetry

Như L2, thêm:
- `slot.fill{slot: "bm25" | "fusion" | "rerank", method}`;
- `fusion.method{rrf | alpha, value}`;
- `rerank.toggle{on, top_n}`;
- `regression.fail{case: "lib-l3-t02", flag}`.

**KPI:**
- tỉ lệ người chơi chạy lại lời giải cũ trước khi sửa;
- tỉ lệ thử "chỉ BM25";
- tỉ lệ giữ Kính lúp trong lời giải cuối, chia theo có hay không đạt sao 2.

## 17. Câu hỏi mở

1. **Giới hạn `vector_search.top_k` ≤ 5** thấp hơn L2 (≤ 10), nên bản sao lời giải L2 có thể bị kẹp. Kịch bản giải thích bằng truyện (tuần đăng ký) và có thông báo rõ. Cần chủ dự án duyệt. Cách khác là đặt ≤ 5 ngay từ L1, nhưng như vậy L2 mất phép thử "top-k lớn".
2. **Tiêu đề điều trong đoạn.** Với `co_dinh`, khoản 2 của Điều 47 có thể nằm ở đoạn không chứa chữ "Điều 47", khi đó BM25 trượt. Đề xuất: engine chèn tiêu đề điều (`meta.dieu`) vào trường mà BM25 index cho mọi đoạn. Nếu không, L3 chỉ giải được với `theo_dieu` hoặc đoạn đủ lớn. Cần engine chốt và ghi vào `docs/content/corpus/README.md`.
3. **Chất lượng cross-encoder với tiếng Việt** (spike Phần 3 §3.9) quyết định N8 và các ca `tra-so-kho`. Nếu dùng phương án dự phòng "rerank bằng LLM", Kính lúp sẽ tốn token, ngân sách sao 2 phải hiệu chỉnh lại, và codex phải ghi rõ là rerank bằng LLM.
4. **Bước Alpha.** Phần 3 không quy định bước cho `alpha`; kịch bản dùng 0,1 trên UI. Cách chuẩn hoá điểm trước khi trộn do engine chốt.
5. **"Đường đời hạng" #23 → #1 → #2 → #1** trong gameplay-direction là minh hoạ. Số thật lấy từ cổng phát hành; hạng dense ngoài `top_k` do evaluator tính sau run (xếp hạng toàn kho), không phải engine phát lúc chạy.
6. **Đã đóng.** Ca hồi quy `lib-l3-t02` dùng nguyên câu và tiêu chí của `lib-l2-v01` (file golden L3). Vì kho L3 không có bản 2019 nên không dùng ca văn bản cũ.
7. **`lib-l3-t03` chưa có cấu hình ngây thơ cắn nó** (golden `bites: []`). Nếu muốn ca này tính sao thay vì `info`, cổng hiệu chỉnh cần thêm một cấu hình "lời giải mẫu nhưng Lăng kính bỏ G3" và ghi vào `bites`. Cần người viết nội dung và chủ Phần 4 chốt.
