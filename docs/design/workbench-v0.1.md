# Bàn thợ v0.1: chơi ba level Thư viện trong trình duyệt

> **Trạng thái:** đặc tả cho một lượt build (frontend). **Chủ file:** lead game UX. Builder đọc và làm theo; thấy lệch với API thật thì API thắng, ghi lại ở §13.
> **Nguồn sự thật:** [engine-v0.2](engine-v0.2.md) §6–§9, §15 (API, sự kiện, level) và mã `backend/src/vgame/api/**`, `engine/{registry,blocks,graph,validator,levels,types}.py`, `engine/levels/*.json` (**thắng khi lệch**) · [gameplay-direction](gameplay-direction.md) (hướng bàn thợ đồ chơi) · [Phần 3](part-3-block-system.md) §3.0, §3.5 · kịch bản [Thư viện](../content/scenarios/library.md), [L1](../content/scenarios/library-l1-grounded-citation.md), [L2](../content/scenarios/library-l2-chunk-tuning.md), [L3](../content/scenarios/library-l3-article-number-lookup.md), [nhân vật](../content/scenarios/npc-cast.md) · [art-direction](art-direction.md) §1.3, §7, §8, §9 · [frontend-architecture](frontend-architecture.md).
> **Phạm vi file được đụng:** chỉ `frontend/` và file này. Không sửa `backend/`, `docs/content/`, `README.md`, `docs/media/`, `tools/`.

## 0. Một đoạn

Người chơi vào một level từ trang khu hoặc từ hội thoại cô Lan, đọc việc cần làm, rồi chỉnh agent trên một **bàn thợ có khe cố định**: gắn hoặc tháo món đồ (Vòm Sao, Tủ ngăn kéo, Phễu, Kính lúp), vặn núm (Móc kéo `top_k`, Lược dao `chunk_size`…), cắm thẻ vào Lăng kính. Bấm **Mở ca**: đồ thị JSON thật đi `POST /api/runs`, agent chạy thật trên mọi câu của level, từng khối sáng lên theo sự kiện SSE thật của một câu đang theo dõi, bảng câu cập nhật khi từng câu được chấm. Cuối lượt: số sao với ba điều kiện, kết quả từng câu, đoạn đáp án và hạng của nó, lời chẩn đoán của cô Lan, và nút chỉnh rồi chạy lại (giữ nguyên cấu hình). Không 3D, không thư viện đồ thị.

## 1. Quyết định

| # | Quyết định | Vì sao |
|---|---|---|
| W1 | Route mới `/play/:zoneId/:levelId` (`app/routes/play-level.tsx`), là chunk riêng, chỉ có DOM. Không import gì từ `features/campus/scene` hay `three`. | Ngân sách: ≤ 120 kB gzip, three chỉ ở `/play` (CLAUDE.md). |
| W2 | **Bàn thợ khe cố định** thay cho trình soạn node. Mỗi loại khối có một khe ở vị trí cố định theo thứ tự topo; cạnh do một hàm thuần sinh ra từ trạng thái khe. Không dùng React Flow hay thư viện đồ thị. | Đồ thị Thư viện có ≤ 10 node, hình dạng cố định theo loại khối (engine-v0.2 §9). gameplay-direction §4: "đồ chơi chỉ khớp đúng khe nên graph luôn compile được". |
| W3 | Mọi thứ về khối và level lấy từ API: `GET /api/levels/{id}` (PublicLevel) + `GET /api/blocks` (JSON Schema tham số, tên tiếng Việt, cổng). Miền của một núm = JSON Schema ∩ `param_limits`. Frontend chỉ giữ chữ: tên đồ chơi, lời cô Lan, bảng dịch nhãn. | Một bàn thợ chung cho cả ba level; level mới chỉ cần dữ liệu. |
| W4 | Kiểm tra phía client **chép đúng** các luật của `validator.py` mà bàn thợ có thể vi phạm, cùng mã, cùng câu tiếng Việt (§5). Máy chủ vẫn là trọng tài; lỗi 422 của máy chủ vẽ bằng cùng một danh sách lỗi. | Người chơi thấy lỗi ngay, và thấy y hệt khi máy chủ báo. |
| W5 | Dùng `EventSource` gốc của trình duyệt. Trình duyệt tự nối lại và tự gửi `Last-Event-ID`. Reducer bỏ mọi sự kiện có `seq ≤ lastSeq`, nên nối lại hay phát lại từ đầu đều cho cùng kết quả. | Không cần tự viết bộ đọc SSE (bậc "tính năng có sẵn của nền tảng"). |
| W6 | Bàn thợ sáng theo **một câu đang theo dõi** (mặc định câu mẫu đầu tiên: Minh / Hà / Khang). Các câu khác nằm ở bảng câu; bấm một dòng để đổi câu theo dõi. Không chèn độ trễ giả: sự kiện tới lúc nào thì vẽ lúc đó. | Kịch bản §8 (camera bám `v01`, tối đa 3 làn); luật trung thực (không bịa, không đảo thứ tự). |
| W7 | Kết quả hiện theo hai nhịp: `run.scored` cho sao, `run.finished` cho đoạn đáp án và chẩn đoán (D4). "Chỉnh rồi chạy lại" giữ nguyên cấu hình; kết quả lượt trước còn hiện tới khi mở ca mới. | Gold chỉ có sau `run.finished`. |
| W8 | Cấu hình cuối của mỗi level lưu ở `localStorage["vg.bench.v1.<levelId>"] = {version, graph}`, mọi lần đọc/ghi bọc `try/catch`. Sai `version`, không đọc được thành khe, hoặc có giá trị ngoài miền: bỏ, dùng `starter_graph`, báo một dòng. | Yêu cầu; trang vẫn chạy khi bộ nhớ trình duyệt bị chặn. |
| W9 | `Idempotency-Key` = 32 ký tự hex từ `crypto.getRandomValues(new Uint8Array(16))`, tạo ở mỗi lần bấm **Mở ca**. Hộp lỗi giữ `{key, body}` (chuỗi JSON đã gửi); "Thử lại" (mạng rớt, 429, 503) gửi lại **đúng** `body` với **đúng** khoá. Sửa bàn thợ thì đóng hộp lỗi; lần sau là **Mở ca** với khoá mới. | Cùng khoá + cùng đồ thị trả run cũ (200), nên chạy lại sau khi xong phải có khoá mới. Cùng khoá + đồ thị khác = 409, nên không bao giờ dùng lại khoá sau khi bàn thợ đổi. Lần 429 không ghi khoá (đã đọc `run_store.py`), thử lại an toàn. Không dùng `crypto.randomUUID`: nó chỉ có trong secure context, nên vỡ khi mở dev server qua IP LAN để thử trên điện thoại. |
| W10 | Cả ba level đều mở, không khoá theo sao. | Chủ dự án muốn trình diễn đủ tính năng. Khoá tiến độ ở danh sách cắt. |
| W11 | Lối vào: trang khu thay nút "Đang xây" bằng link "Vào màn"; hội thoại cô Lan có nút chính "Dạy trợ lý tra sách" tới L1. | Yêu cầu. |
| W12 | Tên đồ chơi và tên khối thật luôn đi cạnh nhau ("Vòm Sao · Tìm theo nghĩa · `vector_search`"). Không làm "ẩn dụ phai dần" theo level. | Rẻ, đúng tinh thần library.md §2; phai dần để sau. |

## 2. Màn hình và trạng thái

### 2.1 Bố cục

Trang thường, mẫu **split pane** trên desktop. Khung trên giống trang khu (art §9.1) nhưng rộng hơn: `max-w-6xl`. Link trái: "Về danh sách màn" → `/play/:zoneId`; phải: `ThemeToggle`.

```
1280×800
┌ [‹ Về danh sách màn]                                              [◐ Theme] ┐
│ Thôi bịa điều luật  [Sự cố?]                      │ Mục tiêu               │
│ brief của level                                   │ Sao 1/2/3 (stars_vi)   │
│ khối "Cô Lan" 1–2 câu                             │ Tối nay: 10 câu tính…  │
│                                                   │ ▸ Xem 3 câu mẫu        │
├──────────────────────────── Bàn thợ ──────────────┬──── aside (sticky) ────┤
│ Chuông quầy · Câu hỏi khách            [khoá]     │ Mở ca                  │
│   │ Câu hỏi                                       │ Ngân sách sao 2: …     │
│ Kệ sách + Lược dao (chỉ mục)           [khoá/mở]  │ [ Mở ca ]              │
│   │ Chỉ mục                                       │ lỗi / ghi chú          │
│ Vòm Sao  |  Tủ ngăn kéo (L3)                      │ ▸ Xem cấu hình JSON    │
│   │ Tài liệu                                      │ Khôi phục khởi đầu     │
│ Phễu / Bập bênh (L3)                              │ ── khi chạy ──         │
│ Kính lúp (L3)                                     │ 4/10 câu đã chấm       │
│ Thùng Context + Máy đóng tem                      │ bảng câu (chọn để theo │
│   │ Context                                       │  dõi) · [Dừng ca]      │
│ Bộ Óc + Lăng kính (3 khe thẻ)                     │                        │
│   │ Câu trả lời                                   │                        │
│ Bảng trả lời                           [khoá]     │                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Kết quả ca tối nay: sao · 3 điều kiện · cô Lan chẩn đoán · từng câu        │
└─────────────────────────────────────────────────────────────────────────────┘
```

- `lg` trở lên: `grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-6`, aside `lg:sticky lg:top-6 self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1 lg:-m-1` (`p-1` trong khung cuộn để viền focus 2 px + lệch 2 px không bị cắt; `-m-1` giữ chữ thẳng mép cột). Đầu trang chia cùng hai cột: tên, brief, cô Lan bên trái; mục tiêu, số câu, câu mẫu bên phải. Nhờ vậy ở 1280×800 bàn thợ và nút **Mở ca** lên tới màn đầu. Không có giới hạn chiều cao thì aside khi chạy (hộp lỗi, JSON, bảng 13 câu × `min-h-12`) cao hơn màn 800 px và phần đáy không bao giờ cuộn tới được khi đang dính.
- Dưới `lg` (375 px): một cột theo thứ tự DOM: đầu trang (tên, brief, cô Lan, mục tiêu) → bàn thợ → aside → kết quả. Lưới vẫn có một cột **tường minh** `grid-cols-[minmax(0,1fr)]`: cột ngầm `auto` nở theo dòng dài nhất của `<pre>` JSON và kéo cả trang cuộn ngang (đo được 668–1196 px ở 375). Không có thanh dính đáy. Khi bắt đầu chạy, cuộn và focus tới tiêu đề "Đang chạy ca" ở aside; khi `run.started` tới mà tiêu đề vẫn giữ focus, cuộn nó lên **đầu** màn (`scrollIntoView({block: "start"})`, chỉ dưới `lg`). Lý do: các bước của câu đang theo dõi làm bàn thợ (nằm trên aside) cao thêm khoảng 1.400 px; khi đáy bàn thợ còn trên màn thì neo cuộn (scroll anchoring) nằm trong bàn thợ, nên tiêu đề trượt khỏi mép dưới chừng một giây sau khi nhận focus (đo được y = 809 trên 812). Khi tiêu đề ở đầu màn, bàn thợ nằm hẳn phía trên, neo cuộn rơi vào aside và giữ nó đứng yên. Mọi lần chuyển focus bằng mã đều gọi thêm `scrollIntoView({block: "nearest"})`: Chromium không cuộn khi phần tử đã lộ một phần (một hộp lỗi ló nửa dòng ở mép dưới màn 375).
- Khe đôi (Vòm Sao | Tủ ngăn kéo) nằm cạnh nhau từ `sm`, xếp chồng dưới `sm`.
- Nối giữa các khe: một đường dọc `w-0.5 bg-line` kèm nhãn kiểu dữ liệu chạy qua (`type_vi` của cổng: "Câu hỏi", "Chỉ mục", "Tài liệu", "Context", "Câu trả lời"), chữ `text-xs text-fg-muted`. Đường không đổi màu khi chạy (chỉ khe sáng).
- Không cuộn ngang ở 375 px. Khối JSON `<pre>` cuộn ngang bên trong hộp của nó (`overflow-x-auto`), mã đoạn dùng `break-all`.

### 2.2 Máy trạng thái

```
loader:  loading ─┬─ not-found
                  ├─ load-error ── Thử lại ──► loading
                  └─ ready
ready:   editing ──Mở ca──► (lỗi client? ở lại editing, focus tóm tắt lỗi)
                  └──────► sending ──┬─ 202/200 ─► running
                                     ├─ 422 ─► editing + lỗi máy chủ trên từng khe
                                     └─ 429 / 503 / mạng / khác ─► editing + hộp lỗi (Thử lại = cùng khoá)
running (connecting → live ⇄ reconnecting; lost)
         ├─ run.scored ─► scored (sao hiện) ─ run.finished ─► finished
         ├─ run.failed ─► failed
         └─ lost (EventSource CLOSED) ─► "Thử nối lại" (EventSource mới, phát lại từ đầu) | "Chạy lại" (huỷ lượt cũ rồi mở ca mới) | "Chỉnh cấu hình" (huỷ lượt cũ, về bàn thợ, không mở ca)
         (run.failed có thể tới **sau** run.scored: lỗi khi lập báo cáo, hoặc Dừng ca giữa hai sự kiện. Sao đã có thì vẫn hiện.)
finished/failed ── Chỉnh rồi chạy lại ─► editing (giữ cấu hình, giữ kết quả cũ tới lượt sau)
failed ── Chạy lại ─► sending (khoá mới)
```

Bàn thợ khoá (`<fieldset disabled>`) khi `sending` hoặc `running`; dòng phụ "Bàn thợ khóa trong lúc chạy."

Rời trang giữa lượt (đổi route, tải lại, đóng tab): đóng `EventSource` **và** gửi `POST /api/runs/{id}/cancel` với `keepalive: true` (cleanup của route + sự kiện `pagehide`; chỉ khi `phase` là `waiting`/`running`/`scored`). Lý do: máy chủ chỉ cho **một** lượt chạy cùng lúc (`MAX_CONCURRENT_RUNS = 1`) và v0.1 không theo dõi lại được lượt cũ, nên một lượt bị bỏ rơi vừa đốt lời gọi AI không ai xem, vừa làm chính người chơi (sau khi tải lại) và mọi người khác nhận 429 tới 90 giây. "Chạy lại" từ `lost`: bỏ lượt cũ khỏi state (`{kind: "clear"}`), nên aside về `editing` ngay (nút "Đang gửi cấu hình…"), rồi gửi cancel cho lượt cũ (bỏ qua 404/409) và chỉ POST khi cancel xong. Nhờ vậy POST lỗi (503 khi máy chủ đang khởi động lại, 429, mạng) hiện hộp lỗi như mọi lần mở ca; trước đây lượt `lost` còn "đang chạy" nên hộp lỗi không có chỗ hiện và bàn thợ kẹt khóa. Rời trang khi POST còn chưa trả lời: lượt đó chưa có id trong state nên cleanup không huỷ được; khi 202 về sau khi trang đã rời, `send()` tự gửi cancel (`keepalive`) cho nó. Cancel trong cleanup đọc `runId` từ ref, nên lần chạy effect kép của StrictMode lúc mount (chưa có lượt) không huỷ gì.

## 3. Bàn thợ ↔ level thật

### 3.1 Khe

Thứ tự là thứ tự topo và thứ tự Tab. Khe chỉ hiện khi loại khối thuộc `allowed_blocks`. Id node: lấy id của node cùng loại trong `starter_graph` nếu có, nếu không dùng id mặc định dưới (trùng `reference_graph`, nên JSON người chơi đọc giống JSON của kịch bản).

| Khe | Khối (`type`) | Id mặc định | Đồ chơi | Gắn/tháo | Ghi chú |
|---|---|---|---|---|---|
| 1 | `input` | `q` | Chuông quầy | luôn có | dòng gọn, không có núm |
| 2 | `corpus` | `kb` | Kệ sách | luôn có | hiện `level.corpus` (`qcdt-2024`, `qcdt-2019`) |
| 2 | `chunker` | `ix` | Lược dao, Nam châm, Băng keo, Kính lọc | luôn có | cùng hàng với Kệ sách ("chạy một lần trước mọi câu") |
| 3a | `vector_search` | `vs` | Vòm Sao, Móc kéo, Màn lọc mờ | **có** | |
| 3b | `bm25_search` | `bm` | Tủ ngăn kéo | **có** | |
| 4 | `fusion` | `fu` | Phễu (rrf) / Bập bênh (alpha) | **có** | |
| 5 | `rerank` | `rr` | Kính lúp | **có** | |
| 6 | `context_packer` | `pk` | Thùng Context, Máy đóng tem | luôn có | |
| 7 | `llm` | `llm` | Bộ Óc, Lăng kính | luôn có | `system_prompt` = thẻ |
| 8 | `output` | `out` | Bảng trả lời | luôn có | |

Node thuộc `locked_nodes`: hiện giá trị, ổ khoá, chữ "Khóa ở màn này"; không có núm; JSON gửi đi chép nguyên node của `starter_graph` (máy chủ cũng chèn lại, engine-v0.2 §7.2 bước 3). Loại khối không thuộc `allowed_blocks`: không có khe; một dòng mờ dưới tiêu đề bàn thợ: "Chưa mở ở màn này: Tủ ngăn kéo, Phễu, Kính lúp." (tên đồ chơi `TOY`, thứ tự khe; bàn thợ gọi món bằng tên đồ chơi ở mọi chỗ khác).

Khe trống (đã tháo) là hộp viền nét đứt `border-dashed border-line-strong`, có công tắc "Gắn {đồ chơi}" và một câu nói **sự thật về dây nối**, không phải gợi ý:

| Khe trống | Câu |
|---|---|
| `vector_search` và `bm25_search` cùng trống | "Không có khe truy xuất nào: thùng chỉ có câu hỏi." (hiện ở khe 3a) |
| `bm25_search` | "Không tìm theo từ khóa." |
| `fusion` | "Không gộp: các danh sách đổ thẳng vào bước sau." |
| `rerank` | "Không xếp hạng lại." |

Tháo rồi gắn lại giữ nguyên tham số cũ của khe.

### 3.2 Núm: miền = JSON Schema ∩ `param_limits`

Từ `properties[param]` của `/api/blocks` và `param_limits["<type>.<param>"]` của level:

| Schema | Limit | Điều khiển |
|---|---|---|
| bất kỳ, hoặc schema có `const` (`on_overflow`) | `const` | chữ chỉ đọc + ổ khoá: "{nhãn}: {giá trị} · cố định ở màn này". Xét bằng `"const" in limit`, không xét truthy: `score_threshold {const: 0}` (L1) và `only_in_force {const: false}` (L1) là giá trị thật |
| `enum` (`chunk_size`, `strategy`, `overlap_pct`, `method`, `profile`) | — | nhóm radio (`fieldset` + `legend`), kiểu nút liền |
| `integer`/`number` có `minimum`/`maximum` | `ge`/`le`/`multiple_of` | `<input type="range">` với `min = max(minimum, ge)`, `max = min(maximum, le)`, `step = multiple_of ?? multipleOf ?? 1`, kèm `<output>` và nhãn biên "1–10" |
| `boolean` | — | `<input type="checkbox" role="switch">` |
| `string` `system_prompt` | — | Lăng kính: 3 `<select>` thẻ (§3.3) |

- Số thực làm tròn theo số lẻ của `step` trước khi lưu (`0.15`, không phải `0.15000000000000002`); đã thử `validate()` của máy chủ với mọi bội 0,05 của `score_threshold` và 0,1 của `alpha`: đều hợp lệ. Số nguyên gửi đi là số nguyên.
- Tham số khi gắn mới = `default` của schema, kẹp vào miền (`const` thắng).
- `fusion`: `method` chọn Phễu/Bập bênh; `k` chỉ hiện khi `rrf`, `alpha` chỉ hiện khi `alpha`; tham số ẩn vẫn gửi đi với giá trị đang giữ.
- Nhãn núm: "{đồ chơi} · {title của schema} (`{param}`)", ví dụ "Móc kéo · Số đoạn lấy về (`top_k`)". `aria-valuetext` có đơn vị: "3 đoạn", "512 token", "10 %", "0,15".

### 3.3 Lăng kính

- 3 khe thẻ, mỗi khe một `<select>` ("Khe thẻ 1/2/3"): "Trống" + mọi khoá của `prompt_cards`, nhãn option "G1 · {văn bản thẻ}". Thẻ đã cắm ở khe khác bị `disabled`. Văn bản thẻ đang chọn hiện đủ dưới select.
- `system_prompt` = văn bản các thẻ khác "Trống", theo thứ tự khe, nối bằng `"\n"` (engine-v0.2 §9.1). Dòng đếm: "Dặn dò: {n} ký tự, đi riêng ngoài thùng."
- Đọc ngược từ đồ thị: tách `system_prompt` theo `"\n"`, mỗi dòng phải trùng nguyên văn một thẻ, tối đa 3 dòng; không thì đồ thị không đọc được thành khe (W8). Starter của cả ba level đọc được: L1 `[G4, G5]`, L2/L3 `[G1, G2, G3]`.

### 3.4 Sinh đồ thị (hàm thuần `graphFromBench`)

```
nodes = q, kb, ix                         // locked: chép starter; ix mở: tham số của khe
lists = []
vs gắn: nodes += vs; q.query→vs.query; ix.index→vs.index; lists += vs
bm gắn: nodes += bm; q.query→bm.query; ix.index→bm.index; lists += bm
heads = lists
fu gắn: nodes += fu; mỗi l ∈ lists: l.docs→fu.docs; heads = [fu]
rr gắn: nodes += rr; q.query→rr.query; mỗi h ∈ heads: h.docs→rr.docs; heads = [rr]
nodes += pk; mỗi h ∈ heads: h.docs→pk.docs; q.query→pk.query
nodes += llm; pk.context→llm.context
nodes += out; llm.answer→out.answer
→ {"schema": 1, nodes, edges}            // không gửi "ui"
```

Thứ tự cạnh quyết định thứ tự packer ghép danh sách (engine-v0.2 §5.6): `vs` luôn trước `bm`. Hàm này ra **đúng** thứ tự node và cạnh của `starter_graph` và `reference_graph` cả ba level (đã đối chiếu file level). Khác duy nhất: đồ thị của bàn thợ ghi đủ mọi tham số (ví dụ `vs.score_threshold: 0`, `fu.alpha: 0.5`), còn file level bỏ tham số mặc định; so sánh trong test sau khi điền mặc định. Cấu hình bàn thợ không vẽ ra được: chu trình, hai `output`, khối nằm ngoài đường tới `output`, hơn một khối cùng loại.

`benchFromGraph(level, blocks, graph)` làm ngược lại: mỗi loại khối tối đa một node, khe tuỳ chọn "gắn" khi có node, tham số phải nằm trong miền §3.2, thẻ đọc được §3.3, và `graphFromBench(benchFromGraph(g))` phải bằng `g` (sau khi điền mặc định). Sai bất kỳ điều nào: trả `null`.

### 3.5 Ba level trên bàn thợ (số lấy từ `engine/levels/*.json` ngày 2026-10-08)

**L1 `grounded-citation`.** Kho `qcdt-2024`. Khoá: `q`, `kb`, `ix`, `out`.

| Khe | Starter | Người chơi đổi được |
|---|---|---|
| Lược dao `ix` | `theo_dieu`/512/10, `only_in_force` false | không (node khoá; cả bốn tham số còn `const`) |
| Vòm Sao `vs` | không có | gắn/tháo; `top_k` 1–10 (mặc định 5); `score_threshold` cố định 0 |
| Thùng `pk` | 3.000, `cat_duoi`, `cite_ids` false | Máy đóng tem `cite_ids`; `token_budget`, `on_overflow` cố định |
| Bộ Óc `llm` | `can_bang`, thẻ G4, G5 | 3 khe thẻ G1–G6; `profile` cố định `can_bang` |

Không có khe 3b, 4, 5. Lời giải mẫu (test chứ không hiện): gắn Vòm Sao `top_k` 3, bật tem, thẻ G1, G2, G3.

**L2 `chunk-tuning`.** Kho `qcdt-2024` + `qcdt-2019`. Khoá: `q`, `kb`, `out`.

| Khe | Starter | Người chơi đổi được |
|---|---|---|
| Lược dao `ix` | `co_dinh`/128/0, `only_in_force` false | Nam châm `strategy` {`co_dinh`, `theo_dieu`}, Lược dao `chunk_size` {128, 256, 512, 1024}, Băng keo `overlap_pct` {0, 10, 20}, Kính lọc `only_in_force` |
| Vòm Sao `vs` | `top_k` 3, `score_threshold` 0 | gắn/tháo; `top_k` 1–10; Màn lọc mờ `score_threshold` 0–0,9 bước 0,05 |
| Thùng, Bộ Óc | tem bật; G1, G2, G3 | như L1 |

**L3 `article-number-lookup`.** Kho `qcdt-2024`. Khoá: `q`, `kb`, `out`. Huy hiệu "Sự cố" (`kind = incident`).

| Khe | Starter | Người chơi đổi được |
|---|---|---|
| Lược dao `ix` | `theo_dieu`/512/10, `only_in_force` true | như L2 |
| Vòm Sao `vs` | `top_k` 3 | gắn/tháo; `top_k` **1–5**; `score_threshold` 0–0,9 bước 0,05 |
| Tủ ngăn kéo `bm` | không có | gắn/tháo; `top_k` 1–10 (mặc định 5) |
| Phễu/Bập bênh `fu` | không có | gắn/tháo; `method` rrf/alpha; `k` 1–100 (60); `alpha` 0–1 bước 0,1 (0,5); `top_k` 1–10 (10) |
| Kính lúp `rr` | không có | gắn/tháo; `top_n` 1–5 (3) |
| Thùng, Bộ Óc | tem bật; G1, G2, G3 | như L1 |

Lời giải mẫu L3 dựng được bằng bàn thợ: gắn `bm` 5, `fu` rrf/60/10, `rr` 3, `vs` 5, `ix.only_in_force` tắt.

## 4. Kiến trúc

### 4.1 File

```
app/routes/play-level.tsx            clientLoader → LevelPageData; meta "{title} · V-Game"; HydrateFallback
app/components/PageFrame.tsx         Frame của ZonePage tách ra (back, backLabel, width "3xl" | "6xl")
app/components/ui/icons.tsx          + LockIcon, CheckIcon, CrossIcon, StarIcon, AlertIcon (SVG 20×20, aria-hidden)
app/features/workbench/
  schema.ts      valibot: PublicLevel, BlocksResponse, Graph, ValidationIssue, PostRunResponse, 7 sự kiện
  api.ts         loadLevelPage(zoneId, levelId); postRun(levelId, body, key); describePostError(status, json, headers) (thuần, §6.1); cancelRun(runId, {keepalive}); eventsUrl(runId)
  bench.ts       Bench, domain(), benchFromGraph(), graphFromBench(), starterBench()
  validate.ts    validateGraph(graph, level, blocks) → ValidationIssue[] (§5)
  run.ts         RunView, runReducer (§6.3)
  storage.ts     loadSaved(level, blocks) / save(levelId, version, graph), try/catch
  copy.ts        mọi chữ tiếng Việt của §8: TOY, LEVEL_COPY, VAI_VI, ROLE_VI, CRITERIA_VI, LABEL_VI, FLAG_VI, STATUS_VI; fmt (Intl vi-VN)
  WorkbenchPage.tsx  ghép trang; giữ state (§4.2); useRunStream
  Brief.tsx      đầu trang, cô Lan, mục tiêu, câu mẫu
  Bench.tsx      khe, núm, Lăng kính, lỗi theo khe, trạng thái chạy của khe
  RunPanel.tsx   aside: Mở ca, lỗi, JSON, khôi phục; khi chạy: tiến độ, bảng câu, Dừng ca
  Results.tsx    sao, điều kiện, chẩn đoán, từng câu, model
  *.test.ts      bench, validate, run, storage, api, copy
```

Tái dùng: `buttonClass`, `ChevronLeftIcon`, `IncidentBadge` (`features/zones/ui`), `ThemeToggle`, `getJson`/`ApiError` (`lib/api`; xuất thêm `API_BASE`, hiện là hằng nội bộ), `useDelayedFlag` (`lib/useSettled`). Không thêm dependency. `zustand` không cần: state sống trong một route.

### 4.2 State và luồng dữ liệu

```
clientLoader ─► {level, blocks}
WorkbenchPage
  bench      useState<Bench>      ← loadSaved() ?? starterBench(); mỗi lần đổi: save()
  graph      useMemo(graphFromBench(bench))
  clientIssues useMemo(validateGraph(graph))
  request    useState<Request>    idle | sending{key, body} | failed{kind, title, detail, retryAfter?, key, body}; về idle khi bench đổi (W9)
  serverIssues useState<Issue[]>  từ 422; xoá khi bench đổi
  notes      useState<Issue[]>    issues info của 202 (ghi chú ở aside); xoá khi bench đổi
  stopping   useState<{runId, "pending" | "failed"}>  lần "Dừng lượt chạy" của lượt đang hiện (§8.5)
  run        useReducer(runReducer, null)   null = chưa chạy lượt nào
  lastBody   useState<string|null>  thân JSON của lượt đang hiện kết quả; so với JSON hiện tại cho hai dòng ở §8.4/§8.6
  followed   useState<caseId|null> null = câu mẫu đầu tiên
  useRunStream(runId, dispatch)   mở/đóng EventSource (§6.2)
```

```ts
type SlotType = "vector_search" | "bm25_search" | "fusion" | "rerank";
interface Bench {
  attached: Record<SlotType, boolean>;
  params: Record<string, Record<string, JsonValue>>; // theo node id, kể cả khe đang tháo
  cards: [string | null, string | null, string | null];
}
type Domain =
  | { kind: "fixed"; value: JsonValue }
  | { kind: "choice"; options: JsonValue[] }
  | { kind: "range"; min: number; max: number; step: number }
  | { kind: "toggle" };
```

## 5. Kiểm tra phía client (chép `validator.py`)

`validateGraph` chạy trên **đồ thị đã sinh** (không trên khe), dùng cổng của `/api/blocks`, nên khớp máy chủ cả với đồ thị đọc từ bộ nhớ. Chỉ chép những luật bàn thợ có thể chạm; luật còn lại hàm sinh đồ thị không cho xảy ra (§3.4), và nếu có thì 422 của máy chủ vẫn hiện đúng chỗ.

| Mã | Mức | Khi nào (trên bàn thợ) | `node`, `port` | `message_vi` (nguyên văn máy chủ) |
|---|---|---|---|---|
| G05 | error | Kính lúp hoặc Phễu gắn mà không có danh sách nào vào | `rr`/`fu`, `docs` | `*{name_vi}* chưa có gì cắm vào cổng Tài liệu.` |
| G02 | error | Kính lúp nhận 2 danh sách (2 cách tìm, không gộp) | `rr`, `docs` | `Cổng Tài liệu của *Xếp hạng lại* chỉ nhận một cạnh.` |
| G02 | error | Phễu nhận 1 danh sách | `fu`, `docs` | `*Hợp nhất kết quả* gộp từ 2 đến 3 danh sách, đang có {n}.` |
| G06 | error | Bập bênh (alpha) mà nguồn không đúng 1 `vector_search` + 1 `bm25_search` | `fu`, `docs` | `Gộp theo alpha cần đúng một danh sách *Tìm theo nghĩa* và một danh sách *Tìm từ khóa*.` |
| G06 | error | `rerank.top_n` > `top_k`/`top_n` của nguồn (xét từng nguồn) | `rr`, — | `top_n của *Xếp hạng lại* là {top_n} nhưng phía trước chỉ lấy {size} đoạn.` |
| W_RERANK_NOOP | info | `top_n` = cỡ nguồn | `rr`, — | `Xếp hạng lại giữ {size}/{size} đoạn nên không đổi thứ tự, nhưng vẫn tốn thời gian.` |

- `{name_vi}` lấy từ `/api/blocks`; số in nguyên (không chấm nghìn), đúng như f-string của máy chủ.
- Thứ tự gom như máy chủ: cạnh theo thứ tự node, rồi luật chéo. Đã đối chiếu bằng `validate()` thật: Phễu alpha với 1 danh sách cho đúng hai lỗi G02 + G06 trên `fu`.
- Dòng lỗi (trong khe, hộp tóm tắt, ghi chú) có `key` theo **vị trí**, không theo `code + message`: validator lặp một câu cho mỗi danh sách (Kính lúp nhận hai danh sách 3 đoạn khi `top_n` là 5: hai dòng G06 y hệt; hoặc hai ghi chú "3/3"), và `key` trùng làm React để lại dòng ma sau lần sửa kế tiếp (một dòng "Lỗi:" không còn đúng). Các dòng không giữ state nên khoá theo vị trí là an toàn.
- Hiển thị: `*X*` trong câu thành `<strong>`. Lỗi có `node` hiện ngay trong khe đó (icon + chữ, `text-danger` cho error, `text-fg-muted` cho info); lỗi không có `node` hiện ở aside.
- **Mở ca** không bao giờ `disabled` khi đang sửa. Bấm khi còn lỗi: không gửi gì, aside hiện hộp `role="alert"` "Còn {n} lỗi cần sửa trước khi mở ca." kèm danh sách nút "{đồ chơi}: {lỗi} {bước sửa}" (bấm thì focus điều khiển của bước sửa, bảng dưới), và focus vào hộp.
- **Bước sửa** (`fixFor`, `validate.ts`): câu của máy chủ nói cái gì sai, không nói làm gì, và nút của nó từng focus đúng công tắc của món đang lỗi (gắn Phễu một mình → focus "Gắn Phễu", trong khi cách sửa là gắn Tủ ngăn kéo). Client thêm một câu sau câu máy chủ (giữ nguyên câu máy chủ, W4) và đổi đích focus:

  | Lỗi | Câu thêm | Focus |
  |---|---|---|
  | G02 trên Phễu/Bập bênh (1 danh sách) | "Gắn thêm {khe tìm còn tháo} hoặc tháo {Phễu/Bập bênh}." | công tắc gắn của khe tìm đó |
  | G02 trên Kính lúp (2 danh sách) | "Gắn Phễu để gộp hai danh sách, hoặc tháo một khe tìm." | công tắc "Gắn Phễu" |
  | G05 trên Phễu hoặc Kính lúp | "Gắn Vòm Sao hoặc Tủ ngăn kéo." (khe tìm được mở ở màn) | công tắc của khe tìm đầu tiên còn tháo |
  | G06 trên Kính lúp (`top_n` > nguồn) | "Giảm Số đoạn giữ lại của Kính lúp, hoặc tăng {núm của khối phía trước} của {khối đó}." Khối phía trước là nguồn của cổng `docs` có cỡ đúng số trong câu ("chỉ lấy {size} đoạn"): "…tăng Móc kéo của Vòm Sao", "…tăng Số đoạn giữ lại của Phễu", "…tăng Móc kéo ngăn của Tủ ngăn kéo" (Phễu và Kính lúp cùng gọi núm là "Số đoạn giữ lại", nên luôn kèm tên đồ chơi) | thanh `top_n` |
  | G06 trên Bập bênh (nguồn sai) | "Gắn cả Vòm Sao lẫn Tủ ngăn kéo, hoặc đổi sang Phễu RRF." | nút chọn `method` đang chọn |
  | W_RERANK_NOOP (info, vòng 3) | Núm của khối phía trước còn dưới trần: "Tăng {núm} của {khối đó} (tối đa {max}) để Kính lúp có đoạn để chọn." (L3: lấy rộng rồi để Kính lúp chọn, đúng bài của màn). Đã ở trần: "Giảm Số đoạn giữ lại của Kính lúp để nó chỉ giữ đoạn tốt nhất." | núm được nhắc tới |

  Câu thêm hiện cả trong khe và trong hộp tóm tắt, cho lỗi client lẫn 422 (cùng mã). Không đổi tên khối trong câu máy chủ thành tên đồ chơi: tên đồ chơi đã đứng đầu mỗi dòng ("Phễu: *Hợp nhất kết quả* gộp…"), đúng cặp tên của W12.
- Lỗi máy chủ (422 `issues[]`) thay lỗi client trên khe tới lần sửa kế tiếp. Issues `info` của 202 (`I01`, `W_RERANK_NOOP`) hiện ở aside dưới dạng ghi chú.

## 6. API, SSE, reducer

### 6.1 `POST /api/runs?level=<id>`

Header `Content-Type: application/json`, `Idempotency-Key: <uuid>`; thân = `JSON.stringify(graph)`.

| Trả về | Bàn thợ làm gì | Chữ |
|---|---|---|
| 202 / 200 `{run_id, created, issues}` | mở SSE; issues info → ghi chú. `created: false` (200) = lượt cũ của cùng khoá, luồng phát lại từ đầu | — |
| 422 `{detail, issues}` | lỗi lên khe; focus tóm tắt | tiêu đề = `detail` ("Đồ thị chưa chạy được. Sửa các lỗi bên dưới rồi thử lại."). 422 không có `issues` (lỗi framework, ví dụ header khoá sai mẫu; `detail` khi đó là **mảng**, schema không được đòi chuỗi): hộp lỗi chung |
| 429 `{detail}` | hộp lỗi, "Thử lại" cùng khoá | "Máy chủ đang bận" + `detail`; có header `Retry-After` (giây hoặc ngày giờ HTTP) thì thêm "Bạn có thể thử lại sau khoảng {thời gian}." (dưới 60 giây: "{n} giây"; từ 60: "{⌈n/60⌉} phút"; từ 90 phút: giờ, làm tròn nửa giờ, "khoảng 5 giờ", "khoảng 1,5 giờ", vì hạn mức ngày hết sau nhiều giờ chứ không phải "300 phút"). Không có `detail` mà có giờ: dòng đầu là "Đang có nhiều lượt chạy." (không để "sau ít phút" đứng cạnh giờ cụ thể); `detail` của máy chủ luôn in nguyên văn. Máy chủ hiện **không** gửi header này và không có giờ reset: câu `detail` là đủ |
| 503 `{detail, code}` | hộp lỗi, "Thử lại" cùng khoá | "Máy chủ chưa sẵn sàng chạy" + `detail` (`llm_not_configured`, `index_stale`, `index_missing`, `rerank_unavailable`) + "Cấu hình của bạn vẫn được giữ trên máy này." Riêng `rerank_unavailable` thêm "Tháo Kính lúp thì vẫn mở ca được." (đúng: precheck chỉ đòi reranker khi đồ thị có `rerank`) |
| 409 | hộp lỗi; lần bấm sau tạo khoá mới | "Chưa mở ca được" + `detail` |
| 404 | hộp lỗi + link về danh sách màn | "Chưa mở ca được" + `detail` ("Không tìm thấy level.") |
| 415 | hộp lỗi | "Chưa mở ca được" + "Máy chủ đang gặp sự cố. Thử lại sau ít phút." |
| 5xx khác (500, 502, 504, trang HTML của proxy), thân 200/202 không đúng schema | hộp lỗi, "Thử lại" cùng khoá | như trên. `/api` đi qua rewrite của Vercel tới Render bản miễn phí (ngủ khi rảnh), nên 502/504 của cổng là lỗi POST dễ gặp nhất, và máy chủ có thể **đã** mở lượt. Gửi lại cùng khoá thì máy chủ trả đúng lượt đó (200, `created: false`) thay vì mở lượt thứ hai hoặc trả 429 vì `MAX_CONCURRENT_RUNS = 1` |
| `fetch` ném lỗi | hộp lỗi, "Thử lại" cùng khoá | "Không gửi được cấu hình" + "Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại." |

`POST /api/runs/{id}/cancel` (`cancelRun`, không bao giờ ném lỗi, trả `true` khi không còn gì chạy): 202 thì chờ `run.failed{cancelled}` từ luồng; 409 (đã xong) và 404 cũng là `true`, luồng tự kết thúc. 5xx hoặc lỗi mạng: `false`, aside báo "Chưa dừng được lượt chạy. Bấm Dừng ca lần nữa." (không có nút "Thử lại": nút cần bấm là "Dừng ca", và focus đã ở đó) (§8.5).

Bảng trên là một hàm thuần `describePostError` (test ở §11.2), không rải trong component.

Hết lượt gọi AI trong ngày không đi qua 429. Máy chủ đếm lời gọi thật (không tính lời gọi trúng cache phát lại) theo ngày UTC, trần mặc định 500 (`daily_llm_call_cap`); Gemini còn hạn mức riêng. Khi chạm trần: nếu **không câu nào** có trả lời, lượt kết thúc bằng `run.failed{llm_unavailable}` (§8.6); nếu chạm **giữa lượt**, các câu còn lại thành `skipped_budget`, lượt vẫn `run.scored` và các câu đó tính là trượt. Trường hợp sau phải có dòng báo ở kết quả (§8.6, "Không phải lỗi của bạn"), không thì người chơi tưởng cấu hình của mình tệ.

### 6.2 `useRunStream`

```
es = new EventSource(`${API_BASE}/api/runs/${runId}/events`)
mỗi type ∈ 7 sự kiện: es.addEventListener(type, e => dispatch({seq: Number(e.lastEventId), data: parse(e.data)}))
run.finished | run.failed → es.close()
es.onopen  → dispatch({type: "stream.open"})
es.onerror → dispatch({type: es.readyState === EventSource.CLOSED ? "stream.lost" : "stream.reconnecting"})
cleanup    → es.close(); lượt còn chạy thì cancelRun(runId, {keepalive: true}) (§2.2)
```

- Nối lại tự động: trình duyệt gửi `Last-Event-ID`, máy chủ phát lại phần sau đó (engine-v0.2 §8). Dòng `: ping` mỗi 15 s bị `EventSource` bỏ qua. Proxy (Vercel rewrite) cắt luồng dài cũng rơi vào đường này: trình duyệt tự nối lại, không mất sự kiện.
- `CLOSED` (máy chủ trả 404 vì run bị dọn sau khi khởi động lại, hoặc 5xx): trạng thái `lost`. "Thử nối lại" = `EventSource` mới (không đặt được `Last-Event-ID`, nên phát lại từ đầu; reducer bỏ trùng). "Chạy lại" = POST mới.
- Dữ liệu sai schema: bỏ sự kiện đó, `console.warn` một lần (không vỡ trang). **Trừ sự kiện kết thúc** (`run.scored`, `run.finished`, `run.failed`): bỏ nó thì bàn thợ khóa mãi, kết quả treo ở "Đang mở đáp án…", và vì máy chủ đóng luồng ngay sau sự kiện kết thúc nên trình duyệt nối lại với `Last-Event-ID` mỗi `retry` ms không dừng. `frameAction` (`run.ts`, hàm thuần) đổi nó thành `run.failed{code: "internal", message_vi: "Máy chủ trả kết quả mà bàn thợ không đọc được."}` cùng `seq`, và luồng đóng khi hành động là `run.finished` hoặc `run.failed`. Hộp lỗi lượt chạy hiện "Máy chủ gặp lỗi", bàn thợ mở khoá. (Hợp đồng có thể lệch khi một team khác sửa `backend/`.) Schema chỉ đòi các trường bàn thợ dùng (`v.looseObject`), để máy chủ thêm trường không làm hỏng client.

### 6.3 `runReducer`

```ts
interface RunView {
  runId: string;
  lastSeq: number;                       // sự kiện có seq ≤ lastSeq bị bỏ
  stream: "connecting" | "live" | "reconnecting" | "lost" | "closed";
  phase: "waiting" | "running" | "scored" | "finished" | "failed";
  cases: CaseView[];                     // thứ tự run.started (= thứ tự golden, #n = index + 1)
  ingestion: IngestionInfo[];
  score?: StarResult; report?: RunReport; models?: Record<string, number>;
  failure?: { code: string; message_vi: string };
}
interface CaseView {
  id: string; n: number; role: "visible" | "hidden" | "trap"; vai: string; question?: string;
  state: "waiting" | "running" | "graded";
  steps: Record<string, StepView>;       // theo node id; node đang chạy = steps có state "running" (có thể nhiều)
  tokens: { in: number; out: number };   // cộng từ step.finished
  answer?: string;                       // fact llm.answer, chỉ câu mẫu
  graded?: { status: CaseStatus; passed: boolean; counted: boolean;
             criteria: Record<string, boolean>; labels: string[] };
}
interface StepView { block: BlockType; state: "running" | "done"; status?: StepStatus;
                     summary?: string; ms?: number; tokens?: {in: number; out: number}; facts?: Fact[] }
```

| Hành động | Hiệu ứng |
|---|---|
| `{seq, data}` với `seq ≤ lastSeq` | trả nguyên state |
| `run.started` | `cases` từ `cases[]`, `ingestion`, `phase = running` |
| `step.started` | `steps[node] = running`, `state = running` |
| `step.finished` | `steps[node] = done + status/summary/ms/tokens/facts`; cộng `tokens`; fact `llm.answer` → `answer` |
| `case.graded` | `graded`, `state = graded` |
| `run.scored` | `score`, `phase = scored` |
| `run.finished` | `report`, `models`, `phase = finished`, `stream = closed` |
| `run.failed` | `failure`, `phase = failed`, `stream = closed`; giữ `score` nếu đã có |
| `stream.open` / `stream.reconnecting` / `stream.lost` | đổi `stream` (không đổi khi `closed`) |
| type lạ | bỏ qua |

Mọi hành động có `seq` cập nhật `lastSeq`. Hàm thuần, không đọc thời gian, test bằng log sự kiện.

Không có trường "node đang chạy" đơn: compiler chạy song song các node cùng nguồn (L3: `vs` và `bm` cùng chờ `q`), nên `step.started vs`, `step.started bm`, `step.finished vs` là thứ tự thật; một biến `current` sẽ báo "không chạy gì" trong khi Tủ ngăn kéo vẫn chạy. Ba câu cũng chạy song song (`MAX_CONCURRENT_CASES = 3`), nên sự kiện các câu xen nhau.

## 7. Hình ảnh lần chạy (cái gì sáng)

Khe vẽ trạng thái của **câu đang theo dõi**. Thanh trên bàn thợ khi chạy: "Đang theo dõi: câu #{n} · {vai}" + link "Đổi câu ở bảng câu" (`#wb-cases-title`; tiêu đề có `tabIndex -1` nên nhận focus; dưới `lg` bảng câu nằm sau cả bàn thợ, cách khoảng 3.000 px).

| Sự kiện | Khe | Aside / vùng khác |
|---|---|---|
| `run.started` | Lược dao: "Chỉ mục {variant}: {chunks} đoạn, trung bình {avg_tokens} token mỗi đoạn." `variant` là khoá máy (`theo_dieu-512-10`): tách ba phần và in bằng nhãn enum §8.3 ("Bám điều, khoản · 512 token · chồng 10 %"). `ingestion` rỗng (máy chủ thiếu index) thì không in | "Bắt đầu ca: {N} câu." (live); bảng câu đủ N dòng "Chờ" |
| `step.started` | khe của `node`: viền `border-brand`, chữ "Đang chạy", thanh vô định `animate-poster-bar motion-reduce:animate-none` (luật reduced-motion toàn cục chạy keyframe một lần tới `translateX(300%)`, tức thanh biến mất; `animate-none` giữ nó đứng yên). Không có phần trăm giả | dòng câu đó: "Đang chạy: {đồ chơi, …}" (mọi node đang chạy) |
| `step.finished` `ok` | viền `border-success`, "Xong · {ms} ms", `summary` (≤ 140 ký tự, nguyên văn máy chủ), `<details>` "Xem số liệu" theo fact (dưới) | — |
| `step.finished` khác `ok` | `timeout` "Hết giờ", `cancelled` "Đã dừng", `budget` "Hết lượt gọi AI" (viền `border-warning bg-warning-tint`); `llm_error` "Lỗi gọi AI", `index_error` "Lỗi chỉ mục" (`border-danger bg-danger-tint`); `refusal` "AI từ chối trả lời" (`border-warning`) | — |
| `case.graded` | Bảng trả lời, ngay dưới tên khe: "Đạt" `bg-success-tint` / "Trượt" `bg-danger-tint` / "Không tính sao" `bg-subtle`, kèm chip tiêu chí và nhãn (cùng component `Grade` với thẻ câu ở §8.6). Câu tính sao mà trượt: khe viền `border-danger ring-1 ring-danger`, vì mọi bước có thể "Xong" (viền xanh) trong khi câu trả lời sai | dòng câu: kết quả; live chỉ cho câu theo dõi: "Câu {n}: {Đạt / Trượt, {nhãn đầu}}." |
| `run.scored` | — | Kết quả: sao + 3 điều kiện; live: tổng kết |
| `run.finished` | — | đoạn đáp án, hạng, chẩn đoán, model |
| `run.failed` | khe đang chạy giữ trạng thái cuối | hộp `role="alert"` (§8.6) |

**Số liệu theo fact** (trong `<details>`, chỉ dữ kiện trung tính):
- `retrieved` (Vòm Sao, Tủ ngăn kéo, Phễu, Kính lúp): bảng "Hạng · Điều/khoản · Điểm · Văn bản", điểm định dạng `vi-VN` (0,83), văn bản `doc_id` và chữ "hết hiệu lực" khi `hieu_luc = false`. Không có chữ của đoạn (fact không mang). Sau `run.finished`, dòng có `chunk_id` thuộc `report.gold[case].gold_chunks` thêm `StarIcon` + chữ "Đoạn đáp án" (đây là "sao vàng" của màn Truy vết trong kịch bản L1 §8; gold chỉ có sau `run.finished` nên không phạm D4).
- `pack` (Thùng): thanh SVG `{total}/{budget} token` (dài = `rect width`, không dùng thuộc tính `style`), "Tài liệu {docs} · Câu hỏi {query}", "Vào thùng: {included.length} đoạn. Bị cắt: {dropped.length} đoạn."
- `llm` (Bộ Óc): "{in} vào · {out} ra token", "Model {model}", tem "Kết quả đã lưu" khi `replayed`, "Dặn dò {system_tokens} token, ngoài thùng", mã đã trích (chip `font-mono`), câu trả lời nguyên văn khi là câu mẫu.

Không có hoạt cảnh nào trước `case.graded`; không đảo thứ tự; không chèn trễ. Chuyển viền 150 ms; luật reduced-motion toàn cục của `app.css` đã đủ.

## 8. Chữ

Tiếng Việt, viết hoa đầu câu, nút bắt đầu bằng động từ. Câu của máy chủ (`summary`, `message_vi`, `detail`, chẩn đoán) in nguyên văn.

### 8.1 Lối vào
| Chỗ | Chữ |
|---|---|
| Trang khu, mỗi màn (thay "Đang xây") | link "Vào màn" + `<span class="sr-only"> {title}</span>` → `/play/{zone.id}/{level.id}`. Màn đầu `primary`, các màn sau `secondary` (chưa lưu tiến độ, nên "màn chưa xong đầu tiên" là màn đầu); "Về khuôn viên" cuối trang hạ từ `primary` xuống `secondary` (đầu trang đã có link quay lại), để nút mạnh nhất trang trỏ vào màn chơi chứ không ra khỏi khu |
| Hội thoại cô Lan, nút chính (focus đầu) | "Dạy trợ lý tra sách" → `/play/{library.zoneId}/grounded-citation` (hằng `FIRST_LIBRARY_LEVEL` trong `sites.ts`) |
| Hội thoại, nút 2 / 3 | "Vào {library.name}" (`secondary`) / "Để sau" (`quiet`); ba nút xếp dọc (`flex-col`) ở mọi bề rộng |

### 8.2 Đầu trang
| Chỗ | Chữ |
|---|---|
| Link trên | "Về danh sách màn" |
| h1, đoạn dưới | `level.title`; `level.brief` |
| Khối cô Lan | tên "Cô Lan", phụ "Thủ thư ca tối", câu `LEVEL_COPY[id].intro` (bảng dưới); level lạ: không có khối này |
| Mục tiêu (h2) | "Mục tiêu"; danh sách "Sao 1", "Sao 2", "Sao 3" + `stars_vi[i]` |
| Số câu | "Tối nay: {normal + trap} câu tính sao ({visible} câu mẫu, {normal − visible} câu ẩn, {trap} câu bẫy). Câu ẩn và câu bẫy không hiện câu hỏi." (`case_counts` không đếm ca `info_cases`: L3 ghi 12 câu tính sao, lượt chạy có 13, câu `lib-l3-t03` hiện "Không tính sao". Chữ "tính sao" để hai con số không vênh nhau.) |
| Câu mẫu | `<details>` "Xem {visible} câu mẫu": "#{i} · {VAI_VI} · {question}" |

`LEVEL_COPY` (nguyên văn kịch bản §4 nhịp 3 và nhịp 12; `asker` dùng cho câu #1):

| Level | `asker` | `intro` | `win1` | `win3` |
|---|---|---|---|---|
| `grounded-citation` | Minh | "Tối nay có mười câu hỏi. Mình cần ít nhất sáu trên tám câu thường đúng và có nguồn, còn hai câu bẫy thì nó phải biết nói 'không có'." | "Bảng tin sạch rồi. Chú Bảy dặn lần sau in ít thôi." | "Biết nói 'không có' đúng lúc, đó là kỹ năng mình quý nhất ở một thủ thư." |
| `chunk-tuning` | Hà | "Mười ba câu tối nay: ít nhất tám trên mười câu thường phải đủ ý, và không câu nào được trả lời theo bản cũ." | "Phòng đào tạo nhận đơn của Hà rồi. Bạn ấy gửi hộp bánh cảm ơn, mình sẽ không chia cho Bống." | "Không một tờ giấy vàng nào lọt vào thùng. Phòng lưu trữ sẽ tự hào về bạn." |
| `article-number-lookup` | Khang | "Tối nay có người hỏi bằng số điều, có người hỏi bằng lời thường. Tám trên mười câu thường phải đúng, kể cả câu của Khang, và ca của Hà hôm trước không được vỡ." | "Hàng người giải tán rồi. Hai cách tìm, mỗi cách che điểm mù cho cách kia." | "Ca của Hà vẫn xanh. Cái bảng đó là thứ mình xem đầu tiên mỗi khi có ai sửa trợ lý." |

`LEVEL_COPY` còn giữ hai luật sao mà `PublicLevel` không trả nhưng `stars_vi` đã nói thành lời, để bằng chứng sao ở §8.6 không gây hiểu lầm: câu bắt buộc của sao 1 là câu #1 (`rules.s1_required`: `lib-l1-v01`, `lib-l2-v01`, `lib-l3-v01`), và nhãn cấm của sao 3 (`rules.s3_forbidden_labels`: L1 `cite_unknown`, L2 `stale_doc`, L3 không có). Chép từ `engine/levels/*.json`; test `bench.test.ts` đọc file level và so (§11.2).

### 8.3 Bàn thợ
| Chỗ | Chữ |
|---|---|
| h2, dòng dưới | "Bàn thợ"; "Gắn, tháo và chỉnh từng món. Mỗi lần mở ca, trợ lý chạy thật trên mọi câu của tối nay." (một từ "trợ lý" ở mọi chỗ, không "agent") |
| Khối chưa mở | "Chưa mở ở màn này: {đồ chơi, …}." |
| Khe khoá | "Khóa ở màn này"; núm `const`: "{nhãn}: {giá trị} · cố định ở màn này" |
| Nhãn núm | "{đồ chơi của núm} · {title} · `{param}`" ("Móc kéo · Số đoạn lấy về · top_k"). Bỏ vế đồ chơi khi núm không có đồ chơi riêng, khi nó trùng tên khe ("Lược dao" trong khe Lược dao) hoặc trùng `title` ("Số đoạn giữ lại"): "Cỡ đoạn (token) · chunk_size", "Ngân sách thùng (token) · token_budget". Trước đây là "Lược dao · Cỡ đoạn (token) (chunk_size)": hai cặp ngoặc liền nhau và tên khe lặp trong chính khe đó, trình đọc màn hình đọc hết. Thanh trượt cách dòng nhãn `mt-1`, để viền focus (2 px, lệch 2 px) không đè dấu dưới ("đoạn", "lấy") |
| Công tắc gắn | "Gắn {đồ chơi}" (`role="switch"`, trạng thái đọc "bật/tắt") |
| Lăng kính | "Khe thẻ {i}", option "Trống"; "Dặn dò: {n} ký tự, đi riêng ngoài thùng." |
| Lưu | "Đã lưu cấu hình trên máy này." (chỉ khi ghi được) |
| Bỏ cấu hình đã lưu | "Cấu hình đã lưu không còn hợp với màn này nên bàn thợ dùng cấu hình khởi đầu." Vòng 4: mất đi khi lần sửa đầu đã lưu (không đứng cạnh "Đã lưu cấu hình trên máy này.") |
| Khoá khi chạy | "Bàn thợ khóa trong lúc chạy." |

Chính tả trong chữ giao diện: "khóa", "hủy" (đặt dấu kiểu cũ, như máy chủ: "Tìm từ khóa").

`TOY` (đồ chơi theo khối / tham số): `input` Chuông quầy · `corpus` Kệ sách · `chunker` Lược dao (`strategy` Nam châm bám Điều, `chunk_size` Lược dao, `overlap_pct` Băng keo, `only_in_force` Kính lọc hiệu lực) · `vector_search` Vòm Sao (`top_k` Móc kéo, `score_threshold` Màn lọc mờ) · `bm25_search` Tủ ngăn kéo (`top_k` Móc kéo ngăn) · `fusion` Phễu khi `rrf`, Bập bênh khi `alpha` (`k` Hằng số k, `alpha` Độ nghiêng, `top_k` Số đoạn giữ lại) · `rerank` Kính lúp (`top_n` Số đoạn giữ lại) · `context_packer` Thùng Context (`cite_ids` Máy đóng tem) · `llm` Bộ Óc (`system_prompt` Lăng kính, `profile` Mức suy nghĩ) · `output` Bảng trả lời. Giá trị enum: `co_dinh` "Cắt đều theo token", `theo_dieu` "Bám điều, khoản", `rrf` "Phễu RRF (theo hạng)", `alpha` "Bập bênh α (theo điểm)", `can_bang` "cân bằng".

### 8.4 Aside khi sửa
| Chỗ | Chữ |
|---|---|
| h2 | "Mở ca" |
| Ngân sách | "Ngân sách sao 2: {token_budget} token cho cả lượt." |
| Chi phí (luôn hiện, ngay trên nút; Phần 3 nguyên tắc 5 cho phép hiện ước tính chi phí trước khi chạy) | "Mỗi lần mở ca, trợ lý gọi AI thật một lần cho mỗi câu (ít nhất {normal + trap} lời gọi). Cấu hình đã chạy rồi thì dùng kết quả đã lưu, không gọi lại." ("ít nhất": `case_counts` không đếm ca `info_cases`, mà ca đó vẫn chạy và gọi AI; L3 ghi 12, lượt chạy gọi 13) |
| Cấu hình y hệt lượt đang hiện (`body === lastBody`) **và lượt đó `finished`** (sau `run.failed`, chạy lại đúng cấu hình đó chính là cách chữa, nên không hiện câu này) | ghi chú `text-fg-muted` (`sameGraphNote`): "Cấu hình này giống hệt lượt vừa rồi nên kết quả sẽ giống hệt. Đổi một món rồi mở ca để thấy khác biệt." (không chặn nút). **Vòng 3:** khi lượt đó có câu không chạy xong vì máy chủ (`unfinished`: `status` `llm_error`, `timeout`, `skipped_budget`): "Mở ca lại sau ít phút: các câu đã chạy xong dùng kết quả đã lưu, chỉ câu chưa chạy xong gọi AI lại." (`ReplayingLLM` chỉ lưu câu trả lời đã về, `backend/src/vgame/engine/llm.py`; câu cũ bảo người chơi phá một cấu hình đúng) |
| Nút chính | "Mở ca"; khi gửi: "Đang gửi cấu hình…" (`aria-busy`, `disabled`) |
| Còn lỗi | "Còn {n} lỗi cần sửa trước khi mở ca." |
| JSON | `<details>` "Xem cấu hình JSON" (`<pre>` đúng thân sẽ gửi) |
| Khôi phục | "Khôi phục cấu hình khởi đầu" (`buttonClass("inline")`) → xác nhận tại chỗ: câu "Cấu hình hiện tại sẽ được thay bằng cấu hình khởi đầu của màn." + "Khôi phục" (`primary`) + "Giữ cấu hình" (`secondary`). Mở: focus vào câu hỏi (`tabIndex -1`, để trình đọc màn hình đọc nó). Đóng (cả hai nút): focus về nút đã mở. Vòng 4: cả hai nút `disabled` khi đang gửi cấu hình (khôi phục lúc POST đang đi đặt lại yêu cầu về idle và mở đường cho POST thứ hai) |

### 8.5 Khi chạy
| Chỗ | Chữ |
|---|---|
| h2 (focus khi bắt đầu) | "Đang chạy ca" |
| Tiến độ | "{graded}/{total} câu đã chấm" |
| Luồng | `connecting` "Đang nối tới lượt chạy…"; `reconnecting` "Mất kết nối, đang nối lại…" (`text-warning`, live); `lost` hộp alert (focus khi hiện, để ở 375 px nó không nằm dưới mép màn) "Không theo dõi được lượt chạy nữa." + "Mất kết nối tới máy chủ. Thử nối lại để xem tiếp lượt này. Chạy lại sẽ hủy lượt này và mở ca mới, tốn lời gọi AI như một lần mở ca." + "Thử nối lại" (`primary`, miễn phí; focus về "Đang chạy ca") + "Chạy lại" (`secondary`, tốn lời gọi AI như một lần mở ca) + "Chỉnh cấu hình" (`inline`, một dòng riêng thẳng mép chữ của hộp, vì ba nút không bao giờ vừa một hàng của aside; huỷ lượt, bỏ nó khỏi state, focus "Bàn thợ"; khi máy chủ khởi động lại và mọi luồng trả 404, đây là đường về bàn thợ không tốn lượt mới) (§2.2) |
| Dòng câu | "#{n} · {ROLE_VI} · {VAI_VI}", câu #1: "· Câu của {asker}"; câu mẫu thêm 1 dòng câu hỏi (cắt 2 dòng). Trạng thái: "Chờ", "Đang chạy: {đồ chơi}", "Đạt", "Trượt", "Không tính sao", `STATUS_VI`. Nút cả dòng, `aria-pressed` cho câu đang theo dõi |
| Dừng | "Dừng ca" → tại chỗ: "Dừng lượt chạy này? Các câu đã gọi AI vẫn bị tính." + "Dừng lượt chạy" (`secondary`) + "Chạy tiếp" (`quiet`). Focus như Khôi phục (§8.4): câu hỏi khi mở, "Dừng ca" khi đóng. Escape ở bất kỳ đâu trong hộp xác nhận (cả hai xác nhận tại chỗ) đóng nó như "Chạy tiếp" / "Giữ cấu hình". Sau "Dừng lượt chạy": dòng `role="status"` "Đang dừng lượt chạy…" tới khi `run.failed{cancelled}` về (focus sang hộp lượt chạy, §8.6). Cancel hỏng (5xx, mạng): "Chưa dừng được lượt chạy. Bấm Dừng ca lần nữa." (không có nút "Thử lại": nút cần bấm là "Dừng ca", và focus đã ở đó) (`text-danger`), focus vẫn ở "Dừng ca" (xác nhận đã trả focus về đó) để bấm lại |

`ROLE_VI`: `visible` Câu mẫu · `hidden` Câu ẩn · `trap` Câu bẫy.
`VAI_VI`: `su-kien` Hỏi một dữ kiện · `dien-dat-lai` Hỏi bằng lời đời thường · `ngoai-le-khoan-sau` Cần cả khoản ngoại lệ · `cau-dai` Đáp án dài · `nhieu-khoan` Gộp nhiều khoản · `don-gian` Câu đối chứng · `van-ban-cu` Dễ nhầm bản cũ · `da-bai-bo` Quy định đã bãi bỏ · `tra-so` Hỏi bằng số điều · `tra-so-kho` Số điều lẫn lời thường · `hoi-quy` Ca hồi quy · `dieu-khong-ton-tai` Điều không tồn tại · `khoan-khong-ton-tai` Khoản không tồn tại · `ngoai-pham-vi` Ngoài phạm vi quy chế. Mã lạ: in nguyên mã.
`STATUS_VI` (ca): `refusal` AI từ chối trả lời · `timeout` Hết giờ · `cancelled` Đã dừng · `llm_error` Lỗi gọi AI · `index_error` Lỗi chỉ mục · `skipped_budget` Bỏ qua vì hết lượt gọi AI.
`CRITERIA_VI`: `points` Đủ ý · `cited` Có nguồn · `no_fabrication` Không bịa nguồn · `no_forbidden` Không có nội dung cấm · `refusal` Biết nói "không có" · `no_stale` Không dùng văn bản cũ. Chip: icon + chữ, không chỉ màu.
`LABEL_VI`: `cite_unknown` Trích nguồn không có trong thùng · `cite_missing` Không trích nguồn · `abstained` Đã nói "không có" · `stale_doc` Thùng có văn bản hết hiệu lực · các nhãn trạng thái như `STATUS_VI`.

### 8.6 Kết quả và lỗi lượt chạy
| Chỗ | Chữ |
|---|---|
| h2 (focus khi `run.scored`) | "Kết quả ca tối nay" |
| Sao | "{stars}/3 sao" + 3 `StarIcon` (`fill-accent` khi đạt, viền `stroke-line-strong` khi chưa) |
| Điều kiện | "Sao {i}" + `stars_vi[i]` + "Đạt" / "Chưa đạt" + bằng chứng: s1 "{normal_passed}/{normal_total} câu thường đạt · câu #1 ({asker}): {Đạt / Trượt}" (đủ số câu mà câu #1 trượt thì sao 1 vẫn trượt, không có vế sau người chơi sẽ không hiểu vì sao); s2 "{tokens}/{budget} token" + thanh SVG (`fill-danger` khi vượt); s3 "{traps_passed}/{traps_total} câu bẫy đạt", và khi level có nhãn cấm (§8.2): "· {m} câu {cụm của nhãn}", cụm theo lời của `stars_vi`: `stale_doc` "mang văn bản hết hiệu lực vào thùng", `cite_unknown` "trích nguồn không có trong thùng" (ghép `LABEL_VI` ra câu sai ngữ pháp: "3 câu thùng có văn bản hết hiệu lực"); nhãn khác dùng `LABEL_VI` viết thường (đếm từ `case.graded.labels`; bẫy đạt hết mà vẫn mất sao 3 là do vế này). Khi `s1 = false`: s2, s3 thêm "Chỉ tính khi có sao 1." |
| Không phải lỗi của bạn | khi ≥ 1 câu có `status` `skipped_budget`, `llm_error` hoặc `timeout`: hộp `bg-warning-tint` "{n} câu không chạy xong vì dịch vụ AI quá tải hoặc máy chủ hết lượt gọi hôm nay. Số sao lượt này có thể thấp hơn mức cấu hình của bạn xứng đáng. Thử lại sau." ("có thể": câu bị bỏ qua không phải lúc nào cũng đổi số sao) |
| Kết quả cũ | khi bàn thợ đã đổi so với lượt đang hiện (`body !== lastBody`): một dòng trên tiêu đề "Kết quả của cấu hình trước khi bạn chỉnh." |
| Cô Lan khi có sao | `s3` → `win3`, còn lại khi `stars ≥ 1` → `win1` |
| Lời gọi AI | "Lượt này gọi AI thật {real} lần, {replayed} câu lấy kết quả đã lưu." (đếm fact `llm` theo `replayed`; `replayed = 0` thì bỏ vế sau). Khi `real = 0`: "Mọi câu trả lời lấy từ kết quả đã lưu: cùng cấu hình thì cùng kết quả." |
| Chẩn đoán (h3) | "Cô Lan chẩn đoán"; trước `run.finished`: "Đang mở đáp án…"; rỗng: "Không có câu nào cần chẩn đoán." **Gom theo cờ** (`groupDiagnosis`): máy chủ trả một mục cho mỗi câu trượt, nên cùng một bài học lặp tới 8 lần (L1 cấu hình khởi đầu) hoặc in y hệt 3 lần (L2 "Có 3 câu mang giấy 2019…"). Mỗi cờ một mục: `message_vi` của câu đầu, rồi "Cùng lỗi ở câu #{n}, câu #{m}." (link tới thẻ câu); link "Xem câu #{n}" của câu đầu; một nút "Xem ở" cho cả nhóm. Khoá máy còn sót trong câu (mẫu `regression` "Ca của Hà trượt: {flag}.", mẫu dự phòng "Câu #{n} chưa đạt ({flag}).") đổi thành chữ theo `FLAG_VI` (`flagWords`); khoá lạ giữ nguyên. Mục có đích (`diagnosisTarget`, dưới) và khe đó có điều khiển ở màn này thêm nút `inline` "Xem ở {đồ chơi}" (vòng 3: khe đó đang **tháo** trên bàn thợ hiện tại thì "Thử gắn {đồ chơi}", vì nút dẫn tới công tắc gắn chứ không tới một núm để xem): về bàn thợ, focus **đúng núm** của cờ (khe đang tháo: công tắc gắn; núm cố định ở màn: điều khiển đầu của khe, không bao giờ là một radio chưa chọn), khe viền `border-brand` tới lần sửa kế tiếp ("đèn bàn của cô Lan rọi vào món đồ có lỗi", kịch bản L1 §8; sau khi chạy nên không phạm Phần 3 nguyên tắc 5) |
| Từng câu (h3) | "Từng câu"; mỗi câu một `<article id="cau-{n}">`: tiêu đề như dòng câu, kết quả, chip tiêu chí và nhãn, "{in + out} token"; `<details>` "Xem vết chạy": các bước (đồ chơi, status, summary, ms), câu trả lời (câu mẫu), và sau `run.finished` (xem dưới bảng) |
| Model | "Model đã trả lời: {model} ({n} lời gọi)" nối bằng " · " |
| Nút | "Chỉnh rồi chạy lại" (`primary`, về bàn thợ, focus tiêu đề "Bàn thợ") · "Về danh sách màn" (`quiet`) |

**Vết chạy sau `run.finished`** (từ `report.gold[case]`):
- Câu không có đáp án (câu bẫy `expect: abstain`; máy chủ không có span vàng nên `gold_chunks = []`, `ranks = {}`, `flags = []`): "Quy chế không có đoạn nào trả lời câu này: trợ lý phải nói 'không có'." Không in dòng thùng/hạng, vì `in_pack = false` và `ranks = {}` ở đây không có nghĩa "trượt truy xuất". Điều kiện (vòng 3): `gold_chunks` rỗng **và** `flags` rỗng **và** mọi hạng là `null` **và** `role = trap` (ở cả ba bộ golden, mọi câu `abstain` chạy được đều là câu bẫy).
- `gold_chunks` rỗng mà không phải trường hợp trên (vòng 3): cách chia cắt đôi mọi câu đáp án. `report()` chỉ gom đoạn chứa **trọn** một span (`_contains`), còn `ranks` tính trên mảnh chồng lên span (`_rank` dùng `_overlaps`) và cờ `ret.boundary_split` vẫn có; `in_pack` cũng chỉ xét đoạn chứa trọn nên luôn `false`, dù mảnh đã vào thùng. Dòng đầu: "Không đoạn nào của cách chia này chứa trọn câu đáp án."; dòng hạng: "Hạng của mảnh đứng cao nhất qua từng khối:" rồi các hạng như dưới; cờ in như thường ("Đoạn đáp án bị cắt đôi khi chia"). Đây là lượt đầu của mọi người chơi L2 (`co_dinh/128/0`: `lib-l2-v02`, `h03`, `h04`); trước vòng 3 thẻ câu bảo "quy chế không có đoạn nào trả lời", ngược với chẩn đoán của cô Lan ngay trên.
- Còn lại: "Đoạn đáp án: {đã vào thùng / không vào thùng}." (`in_pack`) + "Hạng qua từng khối:" theo **thứ tự khe** (`vs`, `bm`, `fu`, `rr`; khoá JSON của `ranks` xếp theo chữ cái nên không dùng thứ tự đó). Ý nghĩa hạng khác nhau theo khối, và chữ phải nói rõ vì đây là chỗ người chơi thấy cần vặn núm nào: Vòm Sao / Tủ ngăn kéo "hạng {rank} trên toàn kho, Móc kéo lấy {top_k}, tối đa {max}" (vòng 3: trần của núm ở màn này, để "hạng 7, Móc kéo lấy 3" không rủ người chơi kéo Móc kéo tới 7 khi trần là 5) (hạng tính trên toàn bộ xếp hạng, nên hạng 4 với `top_k` 3 là "suýt"); Phễu / Kính lúp "hạng {rank} trong {top_k / top_n} đoạn giữ lại", `null` = "không có trong {top_k / top_n} đoạn giữ lại". `top_k`/`top_n` lấy từ `lastBody`.
- `flags` → `FLAG_VI`.

`FLAG_VI`: `ret.gold_missing` Đoạn đáp án không vào tới thùng · `ret.gold_rank` Đoạn đáp án đứng ngoài số đoạn lấy về · `ret.boundary_split` Đoạn đáp án bị cắt đôi khi chia · `ctx.gold_dropped` Đoạn đáp án bị cắt khỏi thùng vì tràn · `ret.stale_doc`, `llm.cite_missing`, `llm.cite_unknown` như `LABEL_VI` của nhãn cùng tên · `trap.failed` Câu trả lời chưa đạt.

**Đích "Xem ở"** (`diagnosisTarget(env, nhóm, report.gold, đồ thị của lượt)`, `copy.ts`; khoá = `diagnosis[].flag`; mục `regression` dùng cờ mà câu của nó nêu, ví dụ `ret.gold_rank:vector_search`; đích = khe + núm, khe đang tháo thì focus công tắc gắn của nó):

- Cờ có cách chữa cố định (`FLAG_TARGET`): `ret.gold_missing` → `vs.top_k` (Móc kéo; khe tháo thì "Gắn Vòm Sao", đúng cách chữa của cấu hình khởi đầu L1) · `ret.boundary_split` → `ix.strategy` (Nam châm) · `ret.stale_doc` → `ix.only_in_force` (Kính lọc hiệu lực) · `llm.cite_missing` → `pk.cite_ids` (Máy đóng tem) · `llm.cite_unknown`, `trap.failed` → Lăng kính, Khe thẻ 1 (`trap.failed` chỉ được chọn khi không có cờ truy xuất nào, nên lỗi nằm ở dặn dò).
- `ret.gold_rank:{vector_search | bm25_search}` phụ thuộc đồ thị và hạng (`report.gold[câu đầu của nhóm].ranks`, hạng trên toàn kho): (1) khe tìm **kia** được mở ở màn mà đồ thị không gắn → khe đó ("Thử gắn Tủ ngăn kéo" → công tắc "Gắn Tủ ngăn kéo"; L3 §N1: hạng của Điều 47 khoản 2 ở Vòm Sao vượt trần Móc kéo ở mọi biến thể, cách chữa là thêm tìm từ khoá; mục `regression` "Ai đó tháo Tủ ngăn kéo" cũng vậy; chỉ có Tủ ngăn kéo thì → "Gắn Vòm Sao"); (2) hạng nằm trong miền của núm (≤ `max`, hoặc không có hạng) → `top_k` của chính khe; (3) khe kia đã gắn và hạng ở đó nằm trong miền núm của nó → `top_k` của khe kia; (4) còn lại (vòng 3): không móc nào với tới, nên núm còn mở là cách chia: nếu `chunker.strategy` không bị khoá ở màn (L2, L3) → `ix.strategy` ("Xem ở Lược dao"), kèm một dòng lý do ngay dưới câu của máy chủ (`Target.why`), ví dụ "Không móc nào với tới đoạn đáp án: Vòm Sao hạng 7 (Móc kéo tối đa 5), Tủ ngăn kéo không tìm thấy. Thử đổi cách chia ở Lược dao."; L1 khoá cách chia → không có nút. Không trỏ vào Phễu: Phễu chỉ gộp những gì hai Móc kéo đã kéo về, không cứu được đoạn mà không danh sách nào có.
- `ret.gold_rank:fusion`: máy chủ dùng khoá này cho khâu **đầu tiên sau các Móc kéo** làm rơi đoạn đáp án, kể cả Kính lúp (`grading.py` `_culprit`). Có Phễu và (không có Kính lúp hoặc hạng ở Phễu là `null`) → `fu.top_k`; còn lại → `rr.top_n`.
- `ctx.gold_dropped`, `budget.exceeded`: núm của Thùng bị khoá, nên đích là khâu quyết định bao nhiêu đoạn vào thùng: Kính lúp nếu màn mở nó (`top_n`, hoặc "Gắn Kính lúp"; câu L3 "nó giúp bạn chỉ cần mang ba đoạn"), không thì khâu cuối đang gắn trong Phễu → Vòm Sao → Tủ ngăn kéo (`top_k`). L2 `ctx.gold_dropped` cũng chữa được bằng `chunk_size`, nhưng một mục chỉ có một nút.
- Cờ lạ: không có nút.

Trước vòng sửa 1 nút focus điều khiển **đầu** của khe: với Lược dao là radio "Cắt đều theo token" (một phím mũi tên đổi luôn cách chia), với Vòm Sao là công tắc "Gắn Vòm Sao" (Space tháo luôn khe). Trước vòng sửa 2 đích là một bảng cố định cho mọi màn: ở L3 nó focus Móc kéo (đang 3, trần 5) cho một đoạn hạng 9.

`run.failed` (hộp `role="alert"` `bg-danger-tint`, nhận focus khi tới, câu thân = `message_vi` của máy chủ, rồi "Cấu hình của bạn vẫn còn nguyên."; **người chơi tự dừng** (`cancelled` sau "Dừng lượt chạy" của chính lượt này): hộp trung tính `role="status"` `bg-subtle`, câu "Bạn đã dừng lượt chạy. Các câu đã chấm vẫn ở bảng câu." thay câu máy chủ, vì đó là lựa chọn của người chơi chứ không phải lỗi (`cancelled` không do người chơi, ví dụ máy chủ tắt giữa lượt, vẫn là hộp đỏ); nút "Chạy lại" `secondary` (không có với `llm_not_configured`, `index_missing`, `index_stale`: chính câu máy chủ nói phải chờ người quản trị, chạy lại không thể khác) + "Chỉnh cấu hình" `quiet`, vì ngay dưới hộp đã có nút chính "Mở ca" làm cùng việc; các câu đã chấm vẫn ở bảng câu; nếu `run.scored` đã tới thì sao và ba điều kiện vẫn hiện, chỉ phần đáp án/chẩn đoán vắng; vòng 3: dưới tiêu đề "Cô Lan chẩn đoán" một dòng nói rõ điều đó: "Máy chủ đã chấm sao nhưng phần chẩn đoán chưa tới được. Chạy lại cùng cấu hình để xem: các câu đã chạy xong dùng kết quả đã lưu."):

| `code` | Tiêu đề |
|---|---|
| `cancelled` | Đã dừng lượt chạy |
| `llm_unavailable` | Dịch vụ AI chưa trả lời được |
| `llm_not_configured`, `index_missing`, `index_stale`, `rerank_unavailable` | Máy chủ chưa sẵn sàng chạy |
| `internal`, lạ | Máy chủ gặp lỗi |

### 8.7 Tải trang
| Trạng thái | Chữ |
|---|---|
| Đang chuyển trang (vòng 3: vào màn từ trang khu, quay về trang khu) | trang cũ ở yên tới khi `clientLoader` của trang mới xong (`GET /api/levels/{id}` + `/api/blocks`; API ngủ có thể mất nửa phút). `PageFrame` đọc `useNavigation()`: khi `loading`, `main` có `aria-busy`, dòng sr-only `role="status"` "Đang tải trang…", và một thanh vô định `bg-brand` cao 4 px (vòng 4: `fixed` ở mép trên màn, vì header cuộn đi mất khi "Vào màn" ở xa dưới trang 375 px; "Thử lại" là revalidation, cũng hiện thanh và status) (`animate-poster-bar` như thanh của khe khi chạy; hiện sau 150 ms bằng `animate-appear` để không nháy khi tải nhanh; `motion-reduce` đứng yên và phủ hết bề ngang). Không có chữ hiện trong header: ở 375 px nút quay về và nút giao diện đã gần kín hàng |
| Đang tải (`HydrateFallback`, khung tĩnh như art §9.4) | sr-only "Đang tải màn"; link "Về danh sách màn" trỏ `/play/{zoneId}` (đọc `useParams`), như trang đã tải, không về `/play` (khuôn viên 3D, nạp three.js) |
| Không tìm thấy (id sai mẫu, 404, hoặc `level.zone ≠ zoneId`) | h1 "Không tìm thấy màn này"; "Đường dẫn không khớp màn nào của khu."; nút "Về danh sách màn" |
| Lỗi tải | hộp `bg-warning-tint`: "Chưa tải được màn này." / "Kiểm tra kết nối rồi thử lại." / "Thử lại" (revalidate) + "Về danh sách màn" |

## 9. Tiếp cận

- Một `h1`; `h2` cho Mục tiêu, Bàn thợ, Mở ca / Đang chạy ca, Kết quả; mỗi khe là `<section aria-labelledby>` với `h3` = tên đồ chơi.
- Thứ tự Tab theo luồng (L1 §15): Chuông → Truy xuất → Thùng → Bộ Óc → Mở ca. Mọi điều khiển là phần tử gốc (radio, range, checkbox `role="switch"`, select, button); nhãn luôn hiện, không dùng placeholder thay nhãn.
- Một vùng `aria-live="polite"`: bắt đầu ca, kết quả của câu đang theo dõi, tổng kết, nối lại. Không đọc từng sự kiện của mọi câu. Lỗi chặn (`lost`, `run.failed`, lỗi POST, tóm tắt lỗi) dùng `role="alert"`.
- Đổi route phía client (vào màn từ trang khu hoặc từ hội thoại cô Lan, quay về danh sách màn): `PageFrame` (dùng chung cho trang khu và bàn thợ) focus `h1` của trang mới (`tabIndex -1`), để trình đọc màn hình đọc trang mới thay vì im lặng với focus ở `<body>`. Không làm ở trang đầu của một lần vào web (`location.key === "default"` lúc `PageFrame` gắn vào), nơi việc đọc bắt đầu từ đầu trang. **Vòng 3:** effect theo `pathname`, không theo `location.key`: link neo "Xem câu #n" / "Cùng lỗi ở câu #n" và Back/Forward về đó tạo mục lịch sử mới nhưng vẫn là trang đó, nên focus không đổi chỗ và người chơi không bị kéo lên đầu trang (trước đây Back sau "Xem câu #1" đưa `scrollY` từ 2.961 về 0 ở 1280, từ 5.055 về 0 ở 375). Focus dùng `{ preventScroll: true }` để `ScrollRestoration` giữ vị trí cuộn, kể cả khi Back sang một trang khác. "Thử lại" sau lỗi tải (trang khu, trang màn) thay trang dưới nút đang có focus mà không đổi location: khi `useRevalidator().state` đi từ `loading` về `idle` mà focus đã rơi về `<body>`, `PageFrame` focus `h1` mới.
- Focus: bắt đầu chạy → "Đang chạy ca"; `run.scored` → "Kết quả ca tối nay"; `run.failed` → hộp lỗi lượt chạy; `lost` → hộp "Không theo dõi được…"; "Thử nối lại" → "Đang chạy ca"; "Chỉnh rồi chạy lại" → "Bàn thợ"; bấm lỗi trong tóm tắt → điều khiển của bước sửa (§5); "Xem ở {đồ chơi}" → núm của cờ (§8.6); xác nhận tại chỗ (Khôi phục, Dừng ca) → câu hỏi khi mở, nút đã mở khi đóng. Không phần tử nào tự gỡ mình khỏi trang mà để focus rơi về `<body>`. Tiêu đề, hộp và câu hỏi nhận focus có `tabIndex={-1}`.
- Giá trị của thanh trượt hiện bằng `<span aria-hidden>`, không bằng `<output>` (vai `status` là vùng live, nên mỗi nấc bị đọc hai lần cùng `aria-valuetext`). Viền của `<select>` Khe thẻ và của nút chọn dùng `border-fg-muted` (≥ 3:1 trên `surface`, WCAG 1.4.11; `line-strong` chỉ 2,49:1). `<summary>` có `ChevronDownIcon` quay 180° khi mở (`group-open:rotate-180`), vì `flex` trên `summary` làm mất dấu tam giác.
- Đạt/Trượt, đạt/chưa đạt sao, trạng thái khe luôn có chữ, không chỉ màu. Vùng chạm `h-11`, dòng câu `min-h-12`.
- `prefers-reduced-motion`: luật toàn cục; thanh vô định `motion-reduce:animate-none` (§7).
- Không có `style` trong HTML (CSP `style-src 'self'`): thanh token và sao là SVG với thuộc tính `width`/lớp `fill-*`.
- Kiểm 375×812 và 1280×800, cả hai theme; axe không còn lỗi `serious`/`critical` (thêm vào `e2e/a11y.spec.ts`).

## 10. Ngân sách bundle

- `/play/:zoneId/:levelId` thêm **≤ 120 kB gzip** trên shell; ước tính 25–40 kB (mã bàn thợ; valibot, router, React đã ở shell).
- `scripts/check-bundle.mjs`: thêm `closure(keysWhere(k => k.startsWith("app/routes/play-level.tsx")), {dynamic: true})` trừ shell; fail khi > 120.000 B hoặc khi chunk nào của nó chứa `THREE.WebGLRenderer`. Ghi `workbenchGzipBytes`, `workbenchChunks` vào `build/bundle-report.json`. Ngân sách `/play` 300 kB giữ nguyên.
- Không thêm dependency: không React Flow (≤ 10 node, khe cố định), không thư viện SSE (`EventSource`), không thư viện định dạng (`Intl.NumberFormat("vi-VN")`), không thư viện UUID (`crypto.getRandomValues`, W9).

## 11. Kiểm thử

### 11.1 Dữ liệu test (`frontend/e2e/data/`, dùng chung cho vitest và Playwright)
- `blocks.json`, `levels/{grounded-citation,chunk-tuning,article-number-lookup}.json`: chụp từ máy chủ local (`curl http://127.0.0.1:8000/api/blocks`, `/api/levels/<id>`). Ghi lệnh chụp lại ở đầu file README nhỏ cùng thư mục hoặc ở comment của fixture.
- `run-l1-reference.sse`: luồng SSE thật của lượt L1 ở §11.4, phát lại bằng `curl -N .../api/runs/<id>/events` (phát lại từ run store, không gọi AI). Run store nằm trong RAM của tiến trình: phải `curl` **trước** khi dừng backend. Máy chủ hỏng thì viết tay theo §8 của engine-v0.2 và ghi rõ "chưa đối chiếu máy chủ thật".
- `run-l1-short.sse` viết tay: 2 câu, 6 loại sự kiện, kết thúc bằng `run.finished` (một luồng chỉ có một sự kiện kết thúc; `run.failed` nằm ở test Dừng ca), cho test nối lại và 429.

### 11.2 Unit (vitest)
- `bench.test.ts`: cả ba level, `graphFromBench(benchFromGraph(starter)) == starter` (sau điền mặc định, đúng thứ tự node và cạnh); dựng lời giải mẫu L1 và L3 bằng thao tác khe → bằng `reference_graph` (đọc từ `backend/src/vgame/engine/levels/*.json`, chỉ đọc) sau điền mặc định; `domain()`: L1 `vs.top_k` 1–10, `score_threshold` fixed 0 và `ix.only_in_force` fixed `false` (const falsy), L3 `vs.top_k` 1–5, L2 `score_threshold` bước 0,05, `fusion.alpha` bước 0,1, `on_overflow` fixed từ schema `const`; đồ thị có giá trị ngoài miền, 2 node cùng loại, thẻ lạ → `null`; `s1_required`/`s3_forbidden_labels` của `LEVEL_COPY` khớp `rules` trong file level.
- `validate.test.ts`: mỗi dòng của bảng §5 cho đúng `code`, `severity`, `node`, `port`, `message_vi`; lời giải mẫu ba level không có lỗi; `top_n` = cỡ nguồn cho đúng một info.
- `run.test.ts`: log L1 thật → 10 câu đã chấm, sao, `report`, token mỗi câu = tổng `step.finished`; cắt log ở giữa rồi phát lại từ 1 cho cùng state với đọc một lượt (không cộng token hai lần); sự kiện lạ bị bỏ; `run.failed` sau vài `case.graded` giữ các câu đã chấm; `run.failed` sau `run.scored` giữ `score`; log L3 viết tay có `step.started vs`, `step.started bm`, `step.finished vs` → `bm` vẫn đang chạy; `step.finished` khác `ok`.
- `api.test.ts`: `describePostError` cho 422 có/không có `issues` (`detail` mảng), 429 không header (đúng hình máy chủ hiện nay), 429 + `Retry-After: 30` và dạng ngày giờ HTTP, 503 từng `code` (có câu Kính lúp cho `rerank_unavailable`), 409, 404, 415/5xx, `fetch` ném lỗi.
- `copy.test.ts`: `groupDiagnosis` (gom theo cờ, giữ câu đầu và mọi câu), `diagnosisTarget` (khe + núm; `regression` theo khoá trong câu; vòng 2: L3 chỉ Vòm Sao hạng 9 → Tủ ngăn kéo, chỉ Tủ ngăn kéo hạng 15 → Vòm Sao, hai khe gắn: núm của khe nào với tới hạng, không khe nào → không nút; `ret.gold_rank:fusion` → khâu đã cắt; `ctx.gold_dropped`/`budget.exceeded` → Kính lúp ở L3, Móc kéo ở L1/L2), `flagWords` (khoá đã biết thành chữ, khoá lạ giữ nguyên), `lowerFirst` (không hạ chữ viết tắt "AI"). `validate.test.ts` thêm `fixFor` cho cả năm lỗi bàn thợ (vòng 2: G06 với nguồn là Vòm Sao, Phễu, Tủ ngăn kéo); `run.test.ts` thêm `{kind: "clear"}` và `frameAction` (sự kiện kết thúc sai schema → `run.failed{internal}`, bàn thợ mở khoá); `api.test.ts` thêm 429 tính theo phút, 5xx/thân hỏng có "Thử lại" còn 415 thì không.
- `BenchView.test.tsx` (vòng 2): dựng `BenchSection` L3 qua ba trạng thái (Kính lúp nhận hai danh sách: hai ghi chú "3/3", rồi hai G06 "5 > 3", rồi G06 + "5/5") và so từng dòng trong khe Kính lúp với `validateGraph`; trước khi sửa `key` khe còn một dòng ma (4 dòng cho 3 lỗi).
- Vòng 3: `Results.test.tsx` (mới): câu bị cắt đôi (`gold_chunks: []`, `ranks: {vs: 2}`, `ret.boundary_split`) có dòng "Không đoạn nào của cách chia này…" và hạng, không có "Quy chế không có đoạn nào…" (câu bẫy vẫn có); "tối đa {max}" sau Móc kéo; "Thử gắn Vòm Sao" khi khe tháo, "Xem ở Vòm Sao" khi gắn; dòng "Máy chủ đã chấm sao nhưng…" khi `run.failed` sau `run.scored`. `copy.test.ts`: `sameGraphNote` cả hai nhánh (câu `llm_error`), đích Lược dao + `why` khi không móc nào với tới ở L3, L1 vẫn không có nút. `validate.test.ts`: bước sửa của `W_RERANK_NOOP` (dưới trần, ở trần). `api.test.ts`: 429 theo giờ từ 90 phút. `ZonePage.test.tsx` dựng bằng `createMemoryRouter` (khung trang đọc `useNavigation`, `useRevalidator`, chỉ có trong data router). `replay`/`frame` chuyển vào `test-fixtures.ts`, dùng chung cho `run.test.ts`, `copy.test.ts`, `Results.test.tsx`.
- `storage.test.ts`: `localStorage` ném lỗi khi đọc và khi ghi → không vỡ, dùng starter; sai `version` → starter + cờ báo.
- `ZonePage.test.tsx`: sửa ca "Đang xây" thành link "Vào màn" trỏ đúng `/play/library/<id>`.

### 11.3 Playwright (`e2e/workbench.spec.ts`, API và SSE đều mock)
Helper `mockWorkbenchApi(page, {post, events})`: route `**/api/levels/*`, `**/api/blocks`, `**/api/runs?level=*` (POST), `**/api/runs/*/events` (fulfill `content-type: text/event-stream`, thân là chuỗi khung SSE), `**/api/runs/*/cancel`. Regex lọc lỗi console trong `fixtures.ts` thêm 409, 422, 429, 503 (lỗi API cố ý).

1. **Chạy trọn tới sao (L1):** từ `/play/library` bấm "Vào màn" của L1; gắn Vòm Sao, Móc kéo 3, bật tem, thẻ G1, G2, G3; mock POST kiểm `content-type`, `Idempotency-Key` khớp `^[A-Za-z0-9_-]{16,64}$`, thân = lời giải mẫu (sau điền mặc định); SSE = `run-l1-reference.sse`. Kỳ vọng: "Kết quả ca tối nay" được focus, số sao và ba điều kiện đúng như log, 10 thẻ câu, mục chẩn đoán, dòng model. "Chỉnh rồi chạy lại" → bàn thợ còn Móc kéo 3; tải lại trang → vẫn còn (localStorage). Ở 375 px: `scrollWidth ≤ 375`. Không request nào tới chunk trong `bundleReport.threeChunks`.
2. **Đồ thị không hợp lệ (L3):** gắn Phễu khi chỉ có Vòm Sao → câu G02 nguyên văn trong khe Phễu; bấm Mở ca → không có POST, hộp "Còn 1 lỗi…" được focus; gắn Tủ ngăn kéo → lỗi biến mất; mock POST trả 422 với một issue `node: "rr"` → câu hiện trong khe Kính lúp, tiêu đề là `detail`.
3. **429:** POST lần 1 trả 429 đúng hình máy chủ (`{"detail": "Đang có nhiều lượt chạy, bạn thử lại sau ít phút."}`, không header) → "Máy chủ đang bận" + câu `detail`, không có chữ "giây"; "Thử lại" gửi **cùng** `Idempotency-Key` và cùng thân; lần 2 trả 202 → chạy `run-l1-short.sse` tới kết quả. Rồi bấm "Chỉnh rồi chạy lại", đổi Móc kéo, Mở ca → khoá **khác**. (`Retry-After` chỉ thử ở `api.test.ts`.)
4. **Nối lại:** lần GET events đầu trả `retry: 1000` + sự kiện 1…k rồi đóng; kỳ vọng "Mất kết nối, đang nối lại…"; handler của lần GET thứ hai **chờ** tới khi test đã thấy chữ đó (một promise test tự mở), để không phụ thuộc cửa sổ 1 giây; lần GET thứ hai phải có header `last-event-id: k`, trả k+1…n; kết quả có đúng tổng token (không cộng trùng).
5. **Dừng ca:** "Dừng ca" → "Dừng lượt chạy" → mock nhận POST cancel → SSE trả `step.finished{cancelled}` + `run.failed{cancelled}` → hộp "Đã dừng lượt chạy", "Chạy lại" có mặt, bàn thợ mở khoá. Rồi mở ca lại (SSE treo, không gửi kết thúc) và bấm "Về danh sách màn" giữa lượt → mock nhận POST cancel của lượt thứ hai (§2.2).

6. **Rời trang khi POST chưa trả lời:** mock giữ POST, bấm "Về danh sách màn", thả 202 → mock nhận cancel của lượt đó, không mở luồng nào.
7. **`lost` rồi Chạy lại rồi 503:** luồng trả 404 → hộp `lost` được focus; "Thử nối lại" → lại `lost`, lại focus; "Chạy lại" → cancel lượt 1, POST 2 trả 503 → hộp "Máy chủ chưa sẵn sàng chạy" được focus, bàn thợ mở khóa.
8. **Chẩn đoán gom và "Xem ở":** luồng ngắn với hai mục `ret.gold_rank:vector_search` → một mục, link "câu #2", "Xem ở Vòm Sao" focus thanh Móc kéo.
9. **375 px:** mở "Xem cấu hình JSON" khi sửa, rồi mọi `<details>` sau lượt chạy → `scrollWidth − clientWidth ≤ 0`.
10. **Vòng 2:** L3 cấu hình khởi đầu, chẩn đoán `ret.gold_rank:vector_search` hạng 9 → nút "Xem ở Tủ ngăn kéo" (từ vòng 3: "Thử gắn Tủ ngăn kéo") focus "Gắn Tủ ngăn kéo"; ghi chú info của 202 biến mất ở lần sửa đầu. Luồng mất (lần nối lại tự động trả 404) → "Thử nối lại" nhận cả lượt phát lại từ sự kiện 1 → token mỗi câu không cộng trùng, `Last-Event-ID` là `[null, 9, null]`. Ở 375 × 812: lượt thật tới trước `run.scored` đến **sau** khi tiêu đề nhận focus → "Đang chạy ca" và "10/10 câu đã chấm" vẫn trên màn (test này hỏng trên bản trước khi sửa: tiêu đề ra khỏi màn hoàn toàn).
11. **Vòng 3:** (a) vào L1 từ trang khu, chạy luồng thật có một mục chẩn đoán, cuộn tới "Xem câu #1" (`scrollY` > 100), bấm, Back → `scrollY` lệch < 5 px so với trước khi bấm và `h1` **không** có focus (hỏng trên bản cũ: 2.967 → 0); (b) trang khu → "Vào màn" với `GET /api/levels/*` bị giữ: có `role="status"` "Đang tải trang…" và `main[aria-busy=true]`; thả ra với 500 → `h1` "Chưa tải được màn này." có focus, hết `aria-busy`; Enter trên "Thử lại" → `h1` của màn có focus (hỏng trên bản cũ: không có trạng thái tải, focus ở `<body>`). Test Dừng ca thêm Escape trên cả hai xác nhận và câu "Bấm Dừng ca lần nữa."; test L3 bấm "Thử gắn Tủ ngăn kéo"; test 375 px bấm "Đổi câu ở bảng câu" → "Bảng câu" vào màn.
Thêm vào các test cũ: Bảng trả lời hiện "Đạt" (1), bước sửa và đích focus của lỗi (2), focus của hai xác nhận tại chỗ và hộp `run.failed`, không có ghi chú "giống hệt" sau lượt hỏng (5).

`a11y.spec.ts`: thêm "workbench L3 khi sửa và khi có kết quả" ở cả hai viewport.

**48 test e2e cũ** phải xanh. Hai test đổi kỳ vọng vì hành vi đổi có chủ đích (W11), không đổi gì khác: `play-zone.spec.ts` "lists the library's three levels…" (link "Vào màn" thay nút "Đang xây" bị khoá) và `play.spec.ts` "talks to the librarian…" (focus đầu ở "Dạy trợ lý tra sách", Tab đi qua 3 nút, Enter cuối dẫn tới `/play/library/grounded-citation`; test này phải gọi thêm `mockWorkbenchApi`, không thì trang màn rơi vào "Lỗi tải", và kỳ vọng h1 cuối đổi từ "Thư viện" thành "Thôi bịa điều luật").

Lệnh: `npm run check`, `npm run build`, `npm run test:e2e` (trong `frontend/`).

### 11.4 Đối chiếu máy chủ thật (≤ 30 lời gọi Gemini thật)
1. Kiểm RAM trước; chỉ một trình duyệt headless và một tiến trình backend cùng lúc. `cd backend; uv run uvicorn --factory vgame.main:create_app --port 8000` (chạy nền). Không đọc, không in `backend/.env`. `GET /api/health`, `/api/blocks`, `/api/levels/<id>` phải 200; hỏng (import lỗi, 503 khi POST, workflow khác đang sửa backend) thì ghi lại và dùng mock.
2. Chụp dữ liệu test §11.1.
3. **Đối chiếu lỗi, miễn phí:** POST các đồ thị sai của `validate.test.ts` lên `/api/runs?level=…` → 422 không gọi AI; so `issues` với `validateGraph` (code, node, port, message_vi). **Chỉ POST đồ thị có ít nhất một lỗi mức `error`.** Đồ thị hợp lệ (lời giải mẫu, ca chỉ có info `W_RERANK_NOOP`) đi qua validate là mở một lượt **thật** (L2/L3: 13 lời gọi): kiểm chúng offline bằng `uv run python -c "… validate(raw, load_level(id)) …"` trong `backend/`, không qua HTTP.
4. `npm run dev` (proxy `/api` tới 8000). Trong trình duyệt: L1, dựng lời giải mẫu bằng bàn thợ, Mở ca. Đếm lời gọi thật = số fact `llm` có `replayed = false` (lời giải mẫu đã chạy lúc hiệu chỉnh nên phần lớn trúng cache phát lại). Phát lại luồng bằng `curl` để lưu `run-l1-reference.sse`. Dừng ngay nếu tổng lời gọi thật chạm 30. Không chạy thật L2, L3 (13 lời gọi mỗi lượt): chúng được kiểm bằng bước 3 và mock.
5. Chụp 375×812 và 1280×800 (sửa, đang chạy, kết quả) vào `C:/Users/Tai/AppData/Local/Temp/claude/C--Users-Tai-Desktop-Workspace/538d7dc3-ecdd-4667-b497-8ef29e93b213/scratchpad/workbench/`. Mọi lần mở ca thêm để chụp chỉ dùng **đúng** lời giải mẫu L1 đã chạy ở bước 4 (trúng cache, 0 lời gọi thật); trạng thái "đang chạy" chụp bằng bản mock nếu lượt phát lại xong quá nhanh.
6. Dừng mọi server và trình duyệt đã mở.

## 12. Cắt khỏi v0.1 (trần và lúc nâng)

| Mục | v0.1 | Thêm khi |
|---|---|---|
| Xem trước tất định (đèn pin 3 câu mẫu, dải đoạn, thanh thùng ước tính) | không có | backend có endpoint xem trước không gọi AI |
| Phiếu đoán, menu "Vì sao câu #N sai?", 3 gợi ý tăng dần | chẩn đoán hiện thẳng | sau khi chơi thử thấy người chơi không đọc chẩn đoán |
| Hiện trường, Tua lại, cờ thế giới (áp phích, tờ đơn, hàng người), chú Bảy | không có | có cảnh 3D cho Thư viện |
| Bàn thợ 3D, camera bám, giữ Space tua nhanh | DOM | sau khi bản DOM được duyệt |
| Lật mặt sau: đoạn LangGraph, X-quang prompt, tải JSON/Python | chỉ "Xem cấu hình JSON" | backend trả đoạn compiler sinh và prompt đã ghép |
| Khoá tiến độ (sao 1 mở level sau), starter = lời giải tốt nhất của level trước | cả ba mở, starter của API | có tài khoản hoặc lưu tiến độ |
| Ẩn dụ phai dần theo level, nhãn "mở ở level X" cho khe chưa mở | tên đồ chơi + tên thật cố định | khi có nội dung map khe → level |
| Theo dõi lại lượt chạy sau khi tải lại trang | rời trang = huỷ lượt (§2.2) | `sessionStorage {runId}` và bỏ cancel khi `pagehide`; reducer đã bỏ trùng nên chỉ cần mở lại luồng |
| Hiện hạn mức gọi AI còn lại trong ngày | chỉ chi phí mỗi lượt (§8.4) và số lời gọi thật sau lượt (§8.6) | backend trả số còn lại (§13.6) |
| Textarea `system_prompt` tự do | chỉ thẻ | level không có `prompt_cards` |
| Telemetry, kiểm tra 60 giây, dạy lại Bống | không | Phần 4/5 |
| Xem lượt chạy đã ghi khi máy chủ không chạy được | không (§13.1) | chủ dự án duyệt |

## 13. Rủi ro và câu hỏi cho chủ dự án

1. **Bản demo trên Vercel có thể không chạy được level.** Engine cần khoảng 2,2 GB model và 2,1–3,2 GB RAM (engine-v0.2 §14–§15), Docker chưa có engine. Khi đó khách xem chỉ thấy "Máy chủ chưa sẵn sàng chạy" (503). Đề xuất: chế độ "Xem lượt chạy đã ghi" phát lại `run-l1-reference.sse` qua cùng reducer, đóng tem "Lượt chạy đã ghi, không phải chạy trực tiếp". Khoảng 30 dòng, nhưng lộ lời giải mẫu L1; cần chủ dự án quyết. Phương án không lộ lời giải: ghi lượt của **cấu hình khởi đầu** L1 (đồ thị naive `N1`): khách thấy đúng các câu trượt, chẩn đoán "đoạn đó chưa từng vào thùng" và 0 sao, tức là đoạn mở màn của kịch bản ("cứ chạy nguyên trạng một lần đã"). Tốn tối đa 10 lời gọi thật nếu chưa có trong cache, vẫn nằm trong trần 30 của §11.4 cùng lượt lời giải mẫu.
2. **SSE qua rewrite của Vercel** chưa kiểm. Nếu bị gom bộ đệm, người xem nhận mọi sự kiện một lúc khi lượt kết thúc (vẫn đúng nhờ reducer, chỉ mất cảm giác "trực tiếp"). Nếu proxy cắt luồng giữa chừng, `EventSource` tự nối lại với `Last-Event-ID` (§6.2).
3. **429 sẽ thường gặp** khi có nhiều người xem: `MAX_CONCURRENT_RUNS = 1`, máy chủ không gửi `Retry-After` hay giờ reset. Đề nghị team backend thêm `Retry-After`; client đã đọc sẵn.
4. **Chữ chép từ kịch bản** (`LEVEL_COPY`, `VAI_VI`) có thể lệch khi kịch bản đổi. Nguồn ghi ở `copy.ts`.
5. **`#n` của câu** = vị trí trong `run.started.cases`, khớp số thứ tự trong chẩn đoán vì ca ôn nằm cuối file golden (đã kiểm ba file). Nếu golden đổi thứ tự, hai số sẽ lệch.
6. **Hạn mức miễn phí.** Mỗi cấu hình mới tốn 10 (L1) hoặc 13 (L2, L3) lời gọi Gemini thật; trần máy chủ mặc định 500 lời gọi mỗi ngày UTC cho **mọi** người xem, tức khoảng 40 lượt cấu hình mới mỗi ngày. Client chỉ giảm phí phía mình (hiện chi phí, báo cấu hình trùng, huỷ lượt bị bỏ rơi); không có API nào cho biết còn bao nhiêu lượt. Đề nghị team backend: trả số lời gọi còn lại (ví dụ trong `GET /api/health` hoặc trong 503/`run.failed`) nếu muốn hiện hạn mức.
7. **Luật sao không có trong `PublicLevel`.** `s1_required` và `s3_forbidden_labels` chỉ nằm trong `stars_vi` dạng chữ, nên client chép vào `LEVEL_COPY` (§8.2) để bằng chứng sao không gây hiểu lầm. Đề nghị backend thêm hai trường này vào `public()`; khi có, bỏ bản chép.
8. **Mẫu chẩn đoán dự phòng lộ khoá máy.** Level thiếu mẫu cho một cờ (ví dụ L3 không có `llm.cite_unknown`) thì máy chủ in `"Câu #{n} chưa đạt (llm.cite_unknown)."`. Client đổi khoá đã biết thành chữ (`flagWords`, §8.6), khoá lạ vẫn in nguyên; báo team nội dung nếu muốn câu tiếng Việt.
9. **Mẫu `regression` của L3 chèn khoá máy.** `grading.py` gán `v["flag"] = key` cho ca hồi quy, nên mẫu "Ca của Hà trượt: {flag}. Lần đổi này làm vỡ thứ đã chạy được." ra "…trượt: ret.gold_rank:vector_search.". Đề nghị backend đưa `{flag}` qua một nhãn tiếng Việt trước khi điền mẫu; client đang vá tạm bằng `flagWords` và lấy đích "Xem ở" từ khoá trong câu.
10. **`case_counts` không đếm ca `info_cases`** nên chi phí ở §8.4 viết "ít nhất". Nếu backend trả thêm số ca info (hoặc tổng số ca sẽ chạy), client in con số đúng.
11. **`brief` của level còn chữ "agent"** (cho team nội dung/backend, `engine/levels/*.json` trường `brief` và `content/data/zones.json`): đó là câu đầu tiên người chơi đọc dưới h1 ("Agent đang bịa ra điều luật… để agent trích đúng…", L2 "…cho đến khi agent lấy đủ ngữ cảnh"), và trang khu dùng cùng câu, trong khi mọi chữ của bàn thợ nói "trợ lý". L3 viết "từ khoá", client viết "khóa" (như máy chủ: "Tìm từ khóa"). Client không vá dữ liệu của máy chủ.

## 14. Thứ tự làm (một lượt)

1. Backend local + chụp dữ liệu test (§11.4 bước 1–2). Song song: `PageFrame`, icon, route và loader, trang tải/404/lỗi.
2. `schema.ts`, `bench.ts` + test (bước khó nhất: khe ↔ đồ thị ↔ miền).
3. `validate.ts` + test; đối chiếu 422 miễn phí (§11.4 bước 3).
4. `Bench.tsx`, `Brief.tsx`, aside khi sửa, `storage.ts`. Kiểm 375 và 1280.
5. `api.ts` (POST, mọi mã lỗi), `run.ts` + test, `useRunStream`, aside khi chạy, trạng thái khe.
6. `Results.tsx`, `run.failed`, Dừng ca, huỷ khi rời trang (§2.2).
7. Lối vào: trang khu, hội thoại cô Lan, sửa 2 test e2e + 1 test unit.
8. `check-bundle.mjs`, e2e mới, a11y.
9. Chạy thật L1 (§11.4 bước 4–6). `npm run check`, `npm run build`, `npm run test:e2e`.

## 15. Ghi chú khi build (2026-10-08)

**Đối chiếu máy chủ local** (§11.4): `GET /api/blocks` và ba `GET /api/levels/<id>` trùng từng byte với `frontend/e2e/data`. Sáu đồ thị L3 sai của `validate.test.ts` gửi lên đều nhận 422 với `issues` trùng `validateGraph` (mã, mức, node, cổng, câu); hai đồ thị hợp lệ (ca `W_RERANK_NOOP`, Bập bênh đúng nguồn) không gửi. Một lượt L1 lời giải mẫu dựng trên bàn thợ qua UI: 202, 113 sự kiện, 10/10 câu lấy kết quả đã lưu (**0 lời gọi Gemini thật**), 3/3 sao, 10.262/15.000 token; luồng lưu ở `e2e/data/run-l1-reference.sse`. Backend chạy với `RERANK_MODEL` trỏ tới một model không có để không nạp reranker (một workflow khác đang nạp model dựng index; luật RAM của máy chỉ cho một lần nạp model); L1 không dùng Kính lúp. Ảnh "đang chạy" và ảnh 375 px phát lại luồng thật đã lưu, không mở lượt mới.

**Lệch so với đặc tả:**
- `Bench.tsx` đổi thành `BenchView.tsx`: trên ổ đĩa không phân biệt hoa thường, `./Bench` và `./bench` là cùng một file.
- Link "Vào màn" lấy tên truy cập từ `aria-label="Vào màn {title}"` thay cho `<span class="sr-only">`: cách tính tên ghép "Vào màn" với span không có khoảng trắng ("Vào mànThôi bịa…").
- Bảng câu có tiêu đề `h3` "Bảng câu" và vẫn hiện sau lượt (kể cả khi `run.failed`). Hộp `run.failed` nằm ở aside, ngay trên "Mở ca".
- 422 của khung web trên máy chủ local có dạng `{detail: "Yêu cầu không hợp lệ.", fields: [...]}`, không phải `detail` mảng; cả hai dạng đều ra hộp lỗi chung (test ở `api.test.ts`).
- e2e nối lại: `route.fulfill` của Playwright không thấy header `Last-Event-ID` (Chrome thêm header dưới lớp chặn), nên test dùng một server SSE cục bộ qua `route.continue`; header đến server đúng là `9`.
- e2e chạy `--workers=1` theo giới hạn RAM của máy (không chạy hai trình duyệt headless cùng lúc); cấu hình `playwright.config.ts` không đổi.

**Chưa làm:** chế độ "Xem lượt chạy đã ghi" (§13.1, chờ chủ dự án chọn ghi lời giải mẫu hay cấu hình khởi đầu).

## 16. Vòng sửa 1 (2026-10-08, sau QA)

Mỗi lỗi có test hỏng trước (e2e `workbench.spec.ts`, unit `copy.test.ts`, `validate.test.ts`, `run.test.ts`, `api.test.ts`), rồi mới sửa.

| Phát hiện | Sửa |
|---|---|
| 375 px cuộn ngang 668–1196 px khi mở "Xem cấu hình JSON" | cột tường minh dưới `lg` (§2.1); e2e mở mọi `<details>` ở 375 rồi đo |
| Focus rơi về `<body>` (Dừng ca, Chạy tiếp, Dừng lượt chạy, Khôi phục, Thử nối lại, `run.failed`) | `useConfirm` (focus câu hỏi / trả về nút mở), focus hộp `run.failed` và hộp `lost`, "Thử nối lại" → "Đang chạy ca" (§9) |
| Bảng trả lời không hiện kết quả câu theo dõi | `Grade` trong khe, viền đỏ khi trượt (§7) |
| "Xem ở" focus sai núm (radio cách chia, công tắc gắn) | `FLAG_TARGET` + `data-param` (§8.6) |
| `lost` → Chạy lại → POST lỗi: hộp lỗi vô hình, bàn thợ kẹt khóa | `{kind: "clear"}` rồi cancel rồi POST (§2.2) |
| Rời trang khi POST chưa trả lời: lượt mồ côi giữ khe chạy 90 s | `send()` tự cancel khi 202 về sau khi rời (§2.2) |
| Nhỏ | hộp `lost` focus + câu giải thích; ghi chú "giống hệt" chỉ sau `finished`, "Chạy lại" trong hộp lỗi thành `secondary`; chẩn đoán gom theo cờ; viền focus không bị aside cắt; bước sửa cho lỗi bàn thợ; "trợ lý", "khóa"/"hủy", khe chưa mở bằng tên đồ chơi, nhãn live viết thường, `Retry-After` theo phút, bỏ "0 câu lấy kết quả đã lưu"; `flagWords` cho mẫu `regression`; chevron cho `<summary>`, biến thể `buttonClass("inline")` (trước đây `px-3` thua `px-5` của gốc); `<output>` → `<span aria-hidden>`, viền select/nút chọn `border-fg-muted`; đầu trang hai cột từ `lg`; chi phí "ít nhất" |

**Không làm theo đúng đề xuất, và vì sao:**
- Đổi tên khối thành tên đồ chơi bên trong câu lỗi của validator: câu chép nguyên văn máy chủ (W4) để lỗi client và 422 giống hệt nhau; tên đồ chơi đã đứng đầu mỗi dòng. Thay vào đó thêm "bước sửa" (§5).
- Bỏ dòng chung của 429 khi có giờ: chỉ bỏ dòng **của client**; `detail` của máy chủ vẫn in nguyên văn (§8).
- Nâng `line-strong` lên ≥ 3:1 trong hai theme: đổi token đó đổi viền mọi nút `secondary` của cả trang web; chỉ hai loại ô nhập cần ranh giới 3:1 nên dùng `border-fg-muted` cho chúng.
- Mẫu `regression` của backend: không sửa `backend/` (ngoài phạm vi); client vá tạm, báo ở §13.9.
- "Mất kết nối, đang nối lại…" ở 375: không chuyển focus (đây là `role="status"`, trình đọc màn hình đã đọc). Lúc lượt bắt đầu, tiêu đề "Đang chạy ca" có thể nằm sát mép dưới màn 375 vì trang tạm kết thúc ngay dưới nó (bảng câu chỉ có sau `run.started`), nên không cuộn nó lên đầu được; tự cuộn lại sau đó, khi người chơi có thể đã cuộn đi xem bàn thợ, còn tệ hơn. Hộp `lost` và hộp `run.failed` tự nhận focus nên luôn vào màn.
- Hai phát hiện "375 px cuộn ngang" (qa-ux, qa-func) là một lỗi, sửa một lần.

Ảnh chụp lại (bản build, API mock) ở `scratchpad/workbench/fix1/shots/`, nhật ký ở `fix1/log.txt`.

## 17. Vòng sửa 2 (2026-10-09, sau QA lần 2)

Lỗi thật có test hỏng trước rồi mới sửa: unit `copy.test.ts` (đích "Xem ở"), `validate.test.ts` (bước sửa G06), `BenchView.test.tsx` (dòng ma), `run.test.ts` (`frameAction`), `api.test.ts` (5xx có "Thử lại"); e2e L3 "Xem ở" và 375 px "Đang chạy ca" (test 375 đã chạy trên bản build chưa sửa: hỏng với tỉ lệ trong màn 0, sửa xong thì qua).

| Phát hiện | Sửa |
|---|---|
| "Xem ở" giống nhau cho mọi màn: L3 cấu hình khởi đầu, đoạn hạng 9 → focus Móc kéo (3, trần 5); chỉ Tủ ngăn kéo → Móc kéo ngăn; ca hồi quy → Móc kéo; `ret.gold_rank:fusion` khi Kính lúp cắt → "Gắn Phễu" | `diagnosisTarget` theo đồ thị của lượt và hạng trong `report.gold` (§8.6) |
| Bước sửa G06 luôn nói "tăng Móc kéo", kể cả khi phía trước Kính lúp là Phễu hoặc Tủ ngăn kéo | gọi tên núm và đồ chơi của khối phía trước (§5) |
| `key` trùng ở dòng lỗi (hai G06, hai ghi chú giống hệt) để lại dòng ma, kể cả dòng "Lỗi:" | `key` theo vị trí ở khe, hộp tóm tắt, ghi chú (§5) |
| 375 px: "Đang chạy ca" trượt khỏi mép dưới sau `run.started` | cuộn lên đầu màn khi lượt bắt đầu, dưới `lg` (§2.1). Lý do từ chối ở vòng 1 ("trang kết thúc ngay dưới tiêu đề") sai: nguyên nhân đo được là neo cuộn nằm trong bàn thợ |
| Viền focus của thanh trượt đè dấu dưới của nhãn ("đoan", "top k") | `mt-1` giữa nhãn và thanh (§8.3) |
| `ctx.gold_dropped`, `budget.exceeded` không có nút "Xem ở" | trỏ vào khâu quyết định số đoạn vào thùng (§8.6) |
| Tự dừng lượt hiện hộp đỏ như lỗi máy chủ; "Chạy lại" với lỗi chỉ người quản trị sửa được | hộp trung tính `role="status"` cho lần dừng của chính người chơi; bỏ "Chạy lại" với `llm_not_configured`, `index_missing`, `index_stale` (§8.6) |
| "Dừng lượt chạy" không phản hồi; cancel hỏng thì im lặng | "Đang dừng lượt chạy…", rồi "Chưa dừng được lượt chạy. Thử lại." khi cancel hỏng (`cancelRun` trả `true`/`false`) (§8.5, §6.1) |
| Sao 3 "3 câu thùng có văn bản hết hiệu lực"; "Số sao … thấp hơn cấu hình của bạn đáng được" nói như sự thật | cụm riêng cho mỗi nhãn cấm; "có thể thấp hơn mức … xứng đáng" (§8.6) |
| `brief` của level còn "agent", "từ khoá" | dữ liệu của backend, ngoài phạm vi: ghi ở §13.11 cho team nội dung |
| Nhãn núm "Cỡ đoạn (token) (chunk_size)", tên khe lặp trong khe | "{đồ chơi} · {title} · `{param}`", bỏ vế đồ chơi khi trùng (§8.3) |
| Hộp `lost`: nút tốn lời gọi AI là nút chính | "Thử nối lại" `primary`, "Chạy lại" `secondary` (§8.5) |
| Trang khu: nút mạnh nhất là "Về khuôn viên" | màn đầu `primary`, "Về khuôn viên" `secondary` (§8.1) |
| Đổi route: focus ở `<body>`, trình đọc màn hình im lặng | `PageFrame` focus `h1` của trang mới khi đổi route phía client (§9) |
| Sự kiện kết thúc sai schema: bàn thợ khóa mãi, trình duyệt nối lại mãi | `frameAction` đổi thành `run.failed{internal}` và đóng luồng (§6.2) |
| POST 5xx/502/504 bảo "thử lại" mà không có nút | "Thử lại" cùng khoá cho 5xx và thân hỏng; 415 thì không (§6.1) |
| Ghi chú info của 202 còn sau khi sửa bàn thợ | `setNotes([])` trong `edit()` (§4.2) |
| Hộp `lost` không có đường về bàn thợ ngoài một lượt mới | "Chỉnh cấu hình": huỷ lượt, `{kind: "clear"}`, focus "Bàn thợ" (§2.2, §8.5) |
| Khung tải trang trỏ "Về danh sách màn" tới `/play` | `/play/{zoneId}` từ `useParams` (§8.7) |
| Test nối lại không bao giờ nhận sự kiện trùng | máy chủ test phát lại từ sự kiện 1 bất kể `Last-Event-ID`; thêm test `lost` → "Thử nối lại" nhận cả lượt phát lại (§11.3 mục 10) |

**Không làm theo đúng đề xuất, và vì sao:**
- "Gắn Phễu" làm bước tiếp theo cho cờ hạng của khe tìm (đề xuất: khe tìm kia, "rồi Phễu nếu đang tháo"): Phễu chỉ gộp những gì hai Móc kéo đã kéo về, nên không cứu được một đoạn mà không danh sách nào có. Khi khe kia đã gắn: núm của khe nào với tới hạng thì trỏ vào đó; không khe nào với tới thì không có nút (thà không nút còn hơn một nút trỏ vào núm vô ích, đúng lỗi của phát hiện này).
- "Màn chưa xong đầu tiên" ở trang khu: chưa lưu tiến độ, nên đó là màn đầu.
- L2 `ctx.gold_dropped` → `chunk_size`: hợp lý, nhưng một mục một nút; chọn Móc kéo (bớt đoạn vào thùng) như L1 và mọi `budget.exceeded`.
- Hook đổi route dùng chung: đặt trong `PageFrame` (trang khu và bàn thợ dùng chung), không viết hook riêng; khuôn viên 3D và trang chủ không đổi.
- Lối thoát của hộp `lost` tên "Chỉnh cấu hình" (cùng chữ với hộp `run.failed`), không phải "Bỏ lượt này".

Không gọi Gemini thật ở vòng này: mọi thay đổi là logic và chữ phía client, kiểm bằng unit, e2e mock và ảnh chụp bản build với API mock.

Ảnh chụp lại ở `scratchpad/workbench/fix2/shots/`, nhật ký ở `fix2/log.txt`.

## 18. Vòng sửa 3 (2026-10-09, sau QA lần 3 và 4)

Lỗi thật có test hỏng trước rồi mới sửa: unit `Results.test.tsx` (4 ca), `copy.test.ts` (2), `validate.test.ts` (1), `api.test.ts` (1) đều hỏng trên mã cũ; e2e mới "comes back to the diagnosis…" và "says a level is loading…" và ba test đã sửa (Dừng ca, L3, 375 px) chạy trên bản build cũ và hỏng (Back: `scrollY` 2.967 → 0; không có `role="status"`; Escape không đóng xác nhận; không có "Thử gắn"; không có link bảng câu). Xong: `npm run check` (138 unit), `npm run build` (bàn thợ 29,0 kB gzip, trần 120), `npm run test:e2e` 80 qua, 2 bỏ qua như trước (82 = 78 cũ + 2 test mới × 2 viewport). Một lượt chạy toàn bộ có một lần hết giờ 30 s ở test axe L3 375 px khi bốn worker cùng dựng WebGL; chạy lại `a11y.spec.ts` ba lần liền (60 test) đều qua, lượt toàn bộ kế tiếp xanh.

| Phát hiện | Sửa |
|---|---|
| Back sau "Xem câu #n" nhảy lên đầu trang, focus `h1` (qa-ux, major; qa-func, minor: cùng một lỗi) | `PageFrame` focus `h1` theo `pathname`, không theo `location.key`; `focus({ preventScroll: true })` (§9) |
| Ghi chú "giống hệt … kết quả sẽ giống hệt" sau lượt có câu `llm_error`/`timeout`/`skipped_budget`, trái với hộp "Không phải lỗi của bạn … Thử lại sau" | `sameGraphNote`: "Mở ca lại sau ít phút: các câu đã chạy xong dùng kết quả đã lưu, chỉ câu chưa chạy xong gọi AI lại." Đã đọc `ReplayingLLM.complete`: chỉ `put` sau khi gọi thật thành công. Tập `unfinished` dùng chung cho aside và hộp kết quả (§8.4) |
| Câu bị cắt đôi (`gold_chunks` rỗng) hiện "Quy chế không có đoạn nào trả lời câu này", ẩn hạng và cờ | đã đọc `grading.py` `report()`: xác nhận. "Không có đáp án" chỉ khi không có vàng nào cả và là câu bẫy; câu cắt đôi in "Không đoạn nào của cách chia này chứa trọn câu đáp án." + hạng của mảnh + cờ, không nói "không vào thùng" (§8.6) |
| L3 hai khe tìm mà không móc nào với tới: chẩn đoán không có nút, không lý do; vết chạy "Móc kéo lấy 3" rủ kéo tới 7 | `diagnosisTarget` (4): Lược dao + dòng lý do khi màn mở cách chia; vết chạy thêm "tối đa {max}" (§8.6) |
| "Xem ở Tủ ngăn kéo" dẫn tới công tắc gắn chưa bật | khe đang tháo trên bàn thợ: "Thử gắn {đồ chơi}" (§8.6) |
| "Thử lại" sau lỗi tải màn: focus ở `<body>` (hai phát hiện, một lỗi) | `PageFrame` theo `useRevalidator().state`: `loading` → `idle` mà focus ở `<body>` thì focus `h1`. Đặt ở khung chung nên trang khu (cùng lỗi, cùng "Thử lại") cũng được sửa (§9) |
| Escape không đóng hai xác nhận tại chỗ | `useConfirm` trả `onKeyDown` cho hộp xác nhận (§8.5) |
| Bấm "Vào màn" rồi không có gì đổi tới khi màn tải xong | `useNavigation()` trong `PageFrame`: `aria-busy`, status sr-only, thanh vô định dưới header (§8.7) |
| "Chưa dừng được lượt chạy. Thử lại." mà không có nút "Thử lại" | "… Bấm Dừng ca lần nữa." (§8.5) |
| Gắn Kính lúp ở L3 cho ghi chú "giữ 3/3" không có bước tiếp | bước sửa cho `W_RERANK_NOOP` (§5) |
| `run.failed` sau `run.scored`: sao còn, chẩn đoán biến mất không lời | dòng "Máy chủ đã chấm sao nhưng phần chẩn đoán chưa tới được…" dưới "Cô Lan chẩn đoán" (§8.6) |
| 375 px: "Chỉnh cấu hình" của hộp `lost` xuống dòng, chữ thụt 20 px | dòng riêng, biến thể `inline` thẳng mép chữ (§8.5) |
| 429 `Retry-After` dài in "300 phút" | từ 90 phút in giờ, làm tròn nửa giờ (§6.1) |
| "Đổi câu ở bảng câu" là chữ trơn, bảng câu cách 3.000 px ở 375 | link tới `#wb-cases-title` (§7) |

**Không làm theo đúng đề xuất, và vì sao:**
- Focus chỉ khi `useNavigationType() !== "POP"`: lỗi nằm ở điều kiện `key` (đổi cả khi chỉ đổi neo), không ở loại điều hướng. Theo `pathname` sửa đúng ca neo và Back/Forward trong trang; Back sang **trang khác** vẫn focus `h1` (với `preventScroll`, vị trí cuộn do `ScrollRestoration` giữ), vì phần tử có focus đã rời trang và trình đọc màn hình sẽ im lặng nếu không làm. `PageFrame` gắn lại ở mỗi route, nên "trang đầu của lần vào" đọc `key === "default"` một lần lúc gắn (`useState`), không cần ref giữ `pathname` cũ.
- Khung "Đang tải màn…" thay trang khu khi đang chuyển: dùng thanh + status trong khung chung thay vì kéo `LevelPageSkeleton` (module bàn thợ) vào gốc ứng dụng; chữ hiện trong header bị bỏ vì ở 375 px không còn chỗ.
- 429: bỏ hoặc rút câu `detail` của máy chủ khi có `Retry-After`: giữ nguyên văn (W4, §6.1), vì máy chủ có thể nói lý do khác "bận" (hạn mức ngày); máy chủ hiện không gửi header này, chỉ sửa đơn vị giờ.
- Đổi "Xếp hạng lại" thành "Kính lúp" trong câu `W_RERANK_NOOP`: câu chép nguyên văn máy chủ (W4, như vòng 1); bước sửa thêm sau nó gọi tên đồ chơi.
- Hội thoại cô Lan trên khuôn viên 3D ("Dạy trợ lý tra sách") không dùng `PageFrame`. Vòng 4: hội thoại ở lại tới khi màn tải xong; `/play` đọc `useNavigation()`, nút chính thành "Đang mở màn…" với `aria-busy` (không `disabled`, để giữ focus; bấm lần nữa không làm gì) và một status sr-only cùng chữ.
- Vòng 4: Back sau "Xem câu #n" khi màn là trang đầu của lần vào (link trực tiếp, tab mới): mục đầu và mục neo đều có `location.key` "default", nên `ScrollRestoration` lưu vị trí của neo đè lên vị trí của trang. `getKey={scrollKey}` (`lib/scroll.ts`) đặt khoá `pathname + hash` cho mục "default".

Không gọi Gemini thật ở vòng này: mọi thay đổi là logic và chữ phía client, kiểm bằng unit, e2e mock và ảnh chụp bản build với API mock (luồng tổng hợp theo hình của `grading.py`).

Ảnh chụp lại ở `scratchpad/workbench/fix3/shots/` (1280 và 375: thẻ câu L2 bị cắt đôi, chẩn đoán L3 hai khe tìm với "Xem ở Lược dao", ghi chú aside sau câu `llm_error`, "Thử gắn Tủ ngăn kéo", bước sửa của Kính lúp, vị trí sau Back, hộp `lost`, thanh tải trên trang khu, dòng "đã chấm sao nhưng…", link bảng câu, cancel hỏng), nhật ký ở `fix3/log.txt`; axe sạch trên trang kết quả L3 ở cả hai viewport, không cuộn ngang.
