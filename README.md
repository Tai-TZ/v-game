<p align="center">
  <img src="frontend/public/favicon.svg" width="72" height="72" alt="Biểu tượng V-Game: chữ V trắng trên nền xanh đậm">
</p>

<h1 align="center">V-Game</h1>

<p align="center">
  <strong>Lắp agent AI từ khối, chạy thật trên câu hỏi của NPC, rồi lần theo bằng chứng để hiểu vì sao agent đúng hay sai.</strong><br>
  Trò chơi học tập trên web cho chương trình AI 20K.
</p>

<p align="center">
  <a href="https://github.com/Tai-TZ/v-game/actions/workflows/ci.yml"><img src="https://github.com/Tai-TZ/v-game/actions/workflows/ci.yml/badge.svg?branch=main" alt="Trạng thái workflow CI"></a>
  <a href="https://github.com/Tai-TZ/v-game/actions/workflows/security.yml"><img src="https://github.com/Tai-TZ/v-game/actions/workflows/security.yml/badge.svg?branch=main" alt="Trạng thái workflow Security"></a>
  <a href="https://v-game-theta.vercel.app"><img src="https://img.shields.io/badge/b%E1%BA%A3n_ch%E1%BA%A1y_th%E1%BB%AD-Vercel-0b2a4d?style=flat-square&logo=vercel&logoColor=white" alt="Bản chạy thử trên Vercel"></a>
  <br>
  <img src="https://img.shields.io/badge/React-19-0b2a4d?style=flat-square&logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/three.js-0.186-0b2a4d?style=flat-square&logo=threedotjs&logoColor=white" alt="three.js 0.186">
  <img src="https://img.shields.io/badge/TypeScript-6_strict-0b2a4d?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6 strict">
  <img src="https://img.shields.io/badge/FastAPI-0.142-0b2a4d?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI 0.142">
  <img src="https://img.shields.io/badge/LangGraph-1.2-0b2a4d?style=flat-square&logo=langchain&logoColor=white" alt="LangGraph 1.2">
</p>

<p align="center">
  <a href="#bản-chạy-thử">Bản chạy thử</a> ·
  <a href="#vòng-chơi">Vòng chơi</a> ·
  <a href="#chạy-local">Chạy local</a> ·
  <a href="#trạng-thái-và-lộ-trình">Lộ trình</a> ·
  <a href="#một-lượt-chạy-diễn-ra-thế-nào">Một lượt chạy</a> ·
  <a href="#kỹ-thuật">Kỹ thuật</a> ·
  <a href="docs/README.md">Tài liệu</a>
</p>

<p align="center">
  <img src="docs/media/hero-walk.gif" width="800" alt="Hub 3D theme town: nhân vật đi chéo qua bãi cỏ, hàng cây và luống vườn tới cô Lan đứng trước Thư viện; gợi ý nói chuyện hiện ra, hội thoại của cô Lan mở ở bên phải rồi đóng; góc nhìn xoay 90 độ, cho thấy đài phun, luống vườn và Thư viện từ phía khác.">
  <br>
  <sub>Hub khuôn viên: đi bằng phím mũi tên, WASD, nhấp hoặc chạm; camera bám theo và xoay được 360°; cảnh chỉ vẽ lại khi có chuyển động.</sub>
</p>

## V-Game là gì

V-Game biến bài học AI thành các ca trực trong một khuôn viên 3D thu nhỏ. Người học gặp NPC, nhận một
vấn đề có mục tiêu đo được, lắp agent từ các khối (truy xuất, chia chunk, tìm kiếm lai, xếp hạng lại,
gọi LLM) rồi chạy agent đó **thật** trên bộ câu hỏi của NPC. Kết quả là số sao và lời chẩn đoán rút ra
từ dấu vết của chính lượt chạy, không phải đáp án mẫu.

- **Chạy thật, không mô phỏng.** Backend biên dịch khối thành đồ thị LangGraph, gọi Gemini và phát từng bước qua SSE.
- **Chấm theo bằng chứng.** Chẩn đoán chỉ ra bước gây lỗi từ dấu vết của lượt chạy; bộ câu hỏi có câu ẩn và câu bẫy, đáp án chỉ hiện khi lượt chạy kết thúc.
- **Bàn thợ ngay trong trình duyệt.** Ở ba level Thư viện, người chơi gắn khối, chỉnh núm, mở ca rồi xem từng câu chạy trực tiếp qua SSE; hết ca là sao, kết quả từng câu và lời chẩn đoán của cô Lan.
- **Một sa bàn đi bộ được.** Cổng ở mép trước, ba khu chơi quanh quảng trường, khuôn viên phía sau nhà chính có hội trường mái vòm, sân tennis và sân vận động. Nhấp vào đâu, nhân vật tự tìm đường ngắn nhất tới đó. Mọi toà dựng đủ bốn mặt, nên góc nhìn xoay trọn 360°: kéo chuột, phím `,` `.` hoặc ba nút ở góc dưới bên phải.
- **Có người để gặp.** Cô Lan ở Thư viện và bốn NPC hư cấu (chú bảo vệ, chị Diệp, cô Thục, thầy Khải), mỗi người có lời thoại riêng. Nhân vật, cây cối và đồ trang trí là model CC0 của Kenney và Quaternius.
- **Giờ thật và thời tiết hôm nay.** Ánh sáng nướng sẵn đổi theo mặt trời ở Hà Nội (bình minh, ban ngày, chiều tối, đêm; tính ngay trong trình duyệt) và theo thời tiết thật (mưa, sương, dông) trình duyệt lấy thẳng từ Open-Meteo. Chip ở góc trên bên trái mở bảng thời tiết kèm nguồn dữ liệu, và có chế độ "Cố định ban ngày" cho máy chiếu.
- **Nhẹ.** Cả cảnh hub, kể cả đồ trang trí và nhân vật, chỉ 18 draw call; three.js chỉ tải ở `/play`. Trong lúc tải, bản vẽ "Sa bàn đang dựng" dựng dần đúng chỗ sa bàn 3D sẽ hiện.

> [!NOTE]
> Engine và API ở bản **v0.2**, hub ở bản **v0.4**: ba level của khu Thư viện chơi được từ đầu tới cuối trên
> bàn thợ khi chạy local với khoá Gemini và index; trang chủ, hub 3D và trang khu đã có bản chạy thử công
> khai. Xem [Trạng thái và lộ trình](#trạng-thái-và-lộ-trình).

## Bản chạy thử

**<https://v-game-theta.vercel.app>** đang chạy, chỉ với theme town; địa chỉ chính thức sẽ là
`vgame.ai20k.cloud` khi tên miền được trỏ xong. API nằm ở gói miễn phí và ngủ khi không có truy cập, nên
lần mở đầu có thể chờ khoảng một phút. Bản này có trang chủ, hub 3D, trang khu và bàn thợ với dữ liệu thật;
bàn thợ lắp được agent nhưng chưa mở ca được (API trả `503` vì gói free chưa có index truy xuất). Cách
deploy: [Kỹ thuật › Deploy](#deploy).

## Xem nhanh

<p align="center">
  <img src="docs/media/workbench.gif" width="960" alt="Bàn thợ của level Thôi bịa điều luật: gắn Vòm Sao, kéo Móc kéo lên 3 đoạn, bật Máy đóng tem, chọn ba thẻ dặn dò G1, G2, G3 rồi bấm Mở ca; bảng câu bên phải chuyển dần từ Chờ sang Đạt trong lúc lượt chạy phát về; cuối cùng là Kết quả ca tối nay với 3/3 sao và mục Cô Lan chẩn đoán.">
  <br>
  <sub><b>Bàn thợ, level 1.</b> Lắp lời giải (tìm theo nghĩa, lấy 3 đoạn, đóng tem mã đoạn, dặn trích nguồn), mở ca và xem mười câu chạy trực tiếp qua SSE, rồi nhận 3/3 sao, kết quả từng câu và mục chẩn đoán của cô Lan (lời giải đúng nên không câu nào cần chẩn đoán). Lượt chạy trong hình là luồng sự kiện thật đã ghi lại, phát lại nhanh hơn thật.</sub>
</p>

<p align="center">
  <img src="docs/media/landing-demo.gif" width="960" alt="Mục Một ca trực ở Thư viện trên trang chủ: chọn dự đoán Bịa ra một điều khoản, bấm Chạy agent và nhận câu trả lời sai viện dẫn Điều 47, bấm Gắn bước truy xuất và chạy lại và nhận câu trả lời đúng kèm nguồn Điều 12 khoản 2, rồi bấm Làm lại.">
  <br>
  <sub><b>Trang chủ dạy ngay một bài.</b> Chọn dự đoán "Bịa ra một điều khoản", chạy agent chưa có truy xuất và nhận một điều khoản bịa (Điều 47), rồi gắn bước truy xuất, chạy lại và nhận câu trả lời kèm nguồn (Điều 12, khoản 2). Đây là minh hoạ cố định, không gọi model.</sub>
</p>

<p align="center">
  <img src="docs/media/sky.png" width="960" alt="Bốn ảnh cùng một góc sa bàn theme town: ban ngày trời quang, chiều tối nắng cam, đêm với cửa sổ và đèn đường sáng, ban ngày trời mưa có vệt mưa và trời mây.">
  <br>
  <sub><b>Một sa bàn, bốn vẻ.</b> Ban ngày, chiều tối, đêm và trời mưa: ánh sáng theo giờ thật ở Hà Nội, trời theo thời tiết thật.</sub>
</p>

<p align="center">
  <img src="docs/media/scene-loader.gif" width="800" alt="Màn chờ Sa bàn đang dựng: bản vẽ nét của sa bàn với thẻ Đang tải bộ dựng 3D, Bước 2/5 và một lời của cô Lan; khi cảnh 3D tải xong, sa bàn màu hiện ra đúng chỗ bản vẽ.">
  <br>
  <sub><b>Sa bàn đang dựng.</b> Trong lúc tải cảnh 3D, bản vẽ nét của sa bàn nằm đúng chỗ sa bàn thật sẽ hiện, kèm năm bước tải và một lời của cô Lan.</sub>
</p>

<table>
  <tr>
    <td width="60%" valign="top">
      <img src="docs/media/npc-dialog.png" alt="Hội thoại với chị Diệp, phụ trách văn phòng một cửa, ở bên phải sa bàn: chị dạy trợ lý điền phiếu cho đúng mẫu, ô nào không biết thì để trống; nút Để sau. Nhân vật đứng cạnh chị trước nhà chính.">
      <br><sub><b>Gặp NPC.</b> Gặp cô Lan xong, nhãn của bốn NPC hiện trên sa bàn; nhấp nhãn là nhân vật tự đi tới và bắt chuyện.</sub>
    </td>
    <td width="40%" valign="top" align="center">
      <img src="docs/media/mobile.png" width="265" alt="Hub theme town trên điện thoại: nút quay lại, chip thời tiết và nút Các khu ở trên cùng; cảnh 3D với nhân vật giữa quảng trường, cô Lan trước Thư viện, nhà chính có tháp đồng hồ, đài phun, Chợ model và hồ nước; ba nút xoay góc nhìn ở dưới.">
      <br><sub><b>Chạy trên điện thoại.</b> Chạm để đi, kéo một ngón để xoay, không tràn ngang ở 375 px.</sub>
    </td>
  </tr>
</table>

## Vòng chơi

```mermaid
flowchart LR
    A(["Gặp NPC,<br/>nhận vấn đề"]) --> C["Đoán kết quả"] --> D["Lắp agent<br/>trên bàn thợ"] --> E["Chạy thật trên<br/>câu hỏi của NPC"] --> F["Chấm sao<br/>và chẩn đoán"]
    F -->|chưa đủ sao| D
    F -->|đủ sao| H(["Mở khoá level mới"])
    classDef pending stroke-dasharray: 5 4
    class C,H pending
```

<sub>Nét đứt: phần chưa có. Lắp agent, chạy thật, chấm sao và chẩn đoán đã chơi được trên bàn thợ.</sub>

| Sao | Điều kiện |
|---|---|
| Sao 1 | Đủ số câu thường đạt, gồm cả câu bắt buộc của level |
| Sao 2 | Có sao 1 và cả lượt chạy nằm trong ngân sách token của level |
| Sao 3 | Có sao 1, mọi câu bẫy đạt và không câu nào mắc lỗi cấm của level (level 1: trích nguồn bịa; level 2: đưa văn bản hết hiệu lực vào context) |

## Khu Thư viện

Khu đầu tiên dạy RAG trên một bộ quy chế đào tạo hư cấu (bản 2024 còn hiệu lực, bản 2019 đã hết hiệu
lực). Mỗi level có câu thấy được, câu ẩn và câu bẫy; agent của người chơi phải trích đúng điều khoản từ
văn bản gốc.

| # | Level | Bài học | Khối được dùng |
|---|---|---|---|
| 1 | Thôi bịa điều luật | Gắn truy xuất, trích dẫn nguồn, không bịa | `vector_search`, `context_packer`, `llm`; cách chia chunk cố định |
| 2 | Lược dao chunk | Kích thước chunk, độ chồng lấp, top-k, ngưỡng điểm, lọc văn bản hết hiệu lực | như level 1, chỉnh được `chunker` |
| 3 | Hỏi bằng số điều *(sự cố)* | Tìm theo nghĩa trượt khi hỏi theo số điều: thêm BM25, hợp nhất bằng RRF hoặc trọng số alpha, xếp hạng lại | thêm `bm25_search`, `fusion`, `rerank` |

Đo với model thật ngày 2026-10-08: lời giải mẫu level 1 đạt **3 sao** với **10.262 token**
(`gemini-3.5-flash-lite`); chạy lại cùng đồ thị thì câu trả lời lấy từ replay cache, không tốn thêm lời
gọi nào. Ngân sách sao 2 của từng level đang được hiệu chỉnh lại theo lượt chạy lời giải mẫu với Gemini
thật; số hiện hành nằm trong file level (`backend/src/vgame/engine/levels/`) và
[báo cáo spike](docs/design/engine-spike-report.md).

## Chạy local

Cần Node ≥ 22.22, Python 3.12, [uv](https://docs.astral.sh/uv/); khoá Gemini API để chạy agent thật.

**Backend** (terminal 1):

```bash
cd backend
uv sync
cp .env.example .env          # rồi điền khoá vào backend/.env, xem bên dưới
uv run vgame-build-index      # chạy một lần: tải model embedding (~2,2 GB) và reranker, dựng 24 biến thể index
uv run uvicorn --factory vgame.main:create_app --reload --port 8000
```

```dotenv
# backend/.env (đã có trong .gitignore, không commit)
GEMINI_API_KEY=<khoá-gemini-của-bạn>
# Model đã đo trong báo cáo spike; đổi model thì cần kiểm lại ngân sách sao 2.
GEMINI_MODEL=gemini-3.5-flash-lite
```

**Frontend** (terminal 2):

```bash
cd frontend
npm ci
npm run dev                   # http://localhost:5173, /api được proxy sang 127.0.0.1:8000
```

Mở <http://localhost:5173/play> để vào hub. Tài liệu API (tắt khi `ENV=production`):
<http://localhost:8000/docs>. Thiếu khoá hoặc index thì app vẫn chạy: các trang và API khu, level, khối
hoạt động bình thường, còn `POST /api/runs` trả `503` kèm thông báo tiếng Việt.

<details>
<summary><b>Thử một lượt chạy qua API</b> (không qua bàn thợ)</summary>

Gửi đồ thị khởi đầu của level 1. Đồ thị này chưa có bước truy xuất nên thường trả lời không có nguồn
hoặc bịa điều luật, và nhận 0 sao, đúng như bài học của level. Lần chạy đầu tốn khoảng 10 lời gọi Gemini, tính vào `DAILY_LLM_CALL_CAP`.
Chạy trong bash hoặc Git Bash (trong PowerShell 5.1, `curl` là `Invoke-WebRequest`); cần `curl` và `jq`.

```bash
curl -s http://localhost:8000/api/levels/grounded-citation | jq .starter_graph > graph.json
curl -s -X POST "http://localhost:8000/api/runs?level=grounded-citation" \
  -H "Content-Type: application/json" --data @graph.json        # trả về {"run_id": ...}
curl -N http://localhost:8000/api/runs/<run_id>/events          # luồng SSE tới run.finished
```

Danh sách endpoint, mã lỗi và biến môi trường: [backend/README.md](backend/README.md).

</details>

## Trạng thái và lộ trình

- [x] Engine v0.2: 10 khối, validate gom lỗi, biên dịch LangGraph, chạy song song, chấm sao, chẩn đoán
- [x] API: khu, level, khối, lượt chạy (SSE phát lại theo `Last-Event-ID`, idempotency, huỷ)
- [x] Ba level Thư viện chạy được từ đầu tới cuối; lời giải mẫu level 1 đạt 3 sao với Gemini thật
- [x] Trang chủ pre-render, hub 3D, trang khu, hai theme pack
- [x] Hub v0.3: cổng ở mép trước, khuôn viên phía sau nhà chính, nhấp để đi theo đường ngắn nhất
- [x] Hub v0.4: màn chờ "Sa bàn đang dựng", ánh sáng theo giờ thật và thời tiết Hà Nội, toà đủ bốn mặt, xoay 360°, props và nhân vật CC0, cô Lan và bốn NPC có lời thoại
- [x] Bàn thợ v0.1: lắp khối, mở ca và theo dõi lượt chạy qua SSE; kết quả với sao, từng câu và chẩn đoán của cô Lan; sao tốt nhất của từng level lưu trong trình duyệt, khu có sao sáng đèn cửa sổ
- [x] Bản chạy thử công khai: Vercel cho frontend, Render free cho API, chỉ theme town
- [ ] Bước đoán kết quả trong game; mở khoá level theo sao
- [ ] Ba gợi ý tăng dần trên màn kết quả
- [ ] Chạy agent trên bản deploy: chỗ chạy index truy xuất và reranker (gói free không đủ RAM)
- [ ] Chốt nội dung và ngân sách token của level 2, 3 qua thêm lượt chạy với model thật
- [ ] Tháp canh (guardrails) và Chợ model (token, context, chọn model)
- [ ] Lưu bền và giám sát theo [ADR 0003](docs/adr/0003-backend-stack.md): PostgreSQL/pgvector, Redis, Langfuse; đăng nhập và vai trò giáo viên

Thứ tự tiếp theo: dựng chỗ chạy agent cho bản chạy thử để giảng viên chơi trọn khu Thư viện →
mở rộng tới MVP 3 khu × 3 level → pilot với một lớp, đo trước và sau → đề xuất đưa vào toàn chương trình.

## Một lượt chạy diễn ra thế nào

Mỗi câu hỏi của NPC chạy thành một **ca**: ca đi qua đồ thị của người chơi và được chấm riêng.

```mermaid
sequenceDiagram
    autonumber
    participant B as Trình duyệt
    participant A as FastAPI
    participant G as LangGraph runtime
    participant L as Gemini

    B->>A: POST /api/runs?level=grounded-citation (graph JSON)
    A->>A: Kiểm tra payload, khối được mở, kiểu cổng, DAG, trần lời gọi LLM
    alt Không hợp lệ hoặc chưa sẵn sàng
        A-->>B: 422 gom mọi lỗi, 503 thiếu khoá hoặc index, 429 đang bận (tiếng Việt)
    else Hợp lệ
        A->>G: Biên dịch thành StateGraph, chạy nền (tối đa 3 ca song song)
        A-->>B: 202 kèm run_id
    end
    B->>A: GET /api/runs/{run_id}/events (SSE, Last-Event-ID)
    Note over G,L: 20 s mỗi ca, 90 s mỗi lượt, tối đa 12 lời gọi LLM mỗi ca
    loop Mỗi ca (tối đa 3 ca song song)
        G->>G: Truy xuất (vector_search, bm25_search, fusion, rerank)
        G->>L: Một lời gọi LLM (tra replay cache trước)
        L-->>G: Câu trả lời và usage token
        G-->>A: step.*, case.graded
        A-->>B: step.started, step.finished, case.graded (không có đáp án)
    end
    alt Model có trả lời
        A-->>B: run.scored rồi run.finished (đáp án và chẩn đoán)
    else Provider không trả lời
        A-->>B: run.failed (llm_unavailable), lượt không tính sao
    end
```

<details>
<summary><b>Các sự kiện SSE</b></summary>

| Sự kiện | Mang theo |
|---|---|
| `run.started` | các ca (chỉ ca của câu thấy được mới kèm nội dung câu hỏi), thống kê index của mỗi `chunker` |
| `step.started` / `step.finished` | luôn đi cặp; `status` là `ok`, `timeout`, `cancelled`, `budget`, `llm_error` hoặc `refusal`; tóm tắt ≤ 140 ký tự, token, ms, dữ kiện trung tính |
| `case.graded` | đạt hay trượt, tiêu chí, nhãn không cần đáp án (`cite_unknown`, `cite_missing`, `stale_doc`…) |
| `run.scored` | số sao 0–3, cờ s1–s3, số câu thường và câu bẫy đạt, token so với ngân sách |
| `run.finished` | đáp án và chẩn đoán bằng tiếng Việt; đây là chỗ duy nhất đáp án xuất hiện |
| `run.failed` | `index_missing`, `rerank_unavailable`, `llm_not_configured`, `cancelled`, `internal` hoặc `llm_unavailable` (thay cho cả `run.scored` và `run.finished`) |

Client mất kết nối thì gửi `Last-Event-ID: n` để nhận lại mọi sự kiện sau `n`. Hợp đồng đầy đủ:
[engine-v0.2.md](docs/design/engine-v0.2.md) §8.

</details>

## Kỹ thuật

### Công nghệ

| Tầng | Công nghệ |
|---|---|
| Giao diện | React 19, React Router 8 (framework mode, `ssr: false`, trang chủ pre-render), Vite 8, TypeScript 6 strict, Tailwind CSS 4 (chỉ token ngữ nghĩa), Zustand 5, Valibot |
| Cảnh 3D | three.js 0.186 qua `@react-three/fiber` 9; hình procedural cộng model CC0 nướng sẵn thành JSON, ánh sáng nướng vào vertex color, không texture, không shadow map; tìm đường bằng đồ thị tầm nhìn quanh vật cản |
| API | Python 3.12, FastAPI 0.142, Pydantic 2, quản lý bằng uv |
| Engine agent | LangGraph 1.2 (`StateGraph` tĩnh); Gemini qua `google-genai` sau cổng `LLMClient` không phụ thuộc nhà cung cấp; replay cache sqlite |
| Truy xuất | fastembed với `multilingual-e5-large` (embedding) và `jina-reranker-v2-base-multilingual` (rerank, giấy phép CC-BY-NC-4.0); `rank-bm25`; KNN cosine chính xác bằng numpy |
| Kiểm thử và lint | Vitest, Testing Library, Playwright và axe-core, pytest, ruff, mypy strict |
| Deploy | Vercel (Build Output API, `scripts/build-vercel.mjs`), Render Blueprint (`render.yaml`) |
| CI và bảo mật | GitHub Actions, gitleaks, semgrep, osv-scanner, lefthook |

### Hiệu năng

Mục tiêu là 60 FPS trên laptop dùng GPU tích hợp. Các ngân sách dưới đây có kiểm tra tự động, build hoặc
test thất bại khi bị vượt.

| Hạng mục | Ngân sách | Đo được | Kiểm tra |
|---|---|---|---|
| Draw call trong cảnh hub | ≤ 40 | **18** (cả props và nhân vật) | `scene.test.ts`, thất bại nếu khác 18 |
| Tam giác trong cảnh hub | ≤ 60.000 | **31.277** (theme town) · **34.422** (theme campus) | `scene.test.ts`, thất bại nếu > 34.500 |
| Chunk riêng của route `/play` (three, r3f, scene) ¹ | ≤ 300 kB gzip | **293,2 kB** | `scripts/check-bundle.mjs` trong `npm run build` |
| three.js trên trang chủ | 0 chunk | **0** | `check-bundle.mjs` và `e2e/landing.spec.ts` |
| Khung hình khi đứng yên | 0 | **0** (`frameloop="demand"`) | `e2e/play.spec.ts` với `?debug=frames` |

<sub>¹ Tải nguội <code>/play</code> khoảng 380 kB gzip, gồm shell khoảng 115 kB. CI render WebGL bằng SwiftShader nên FPS thật được đo tay. Số đo cảnh lấy từ <code>sceneBudget()</code> ở bản v0.4 (props CC0 và bộ nhân vật đã tải, mọi khu sáng).</sub>

**Số đo engine** (đo tay, 2026-10-08):

| Hạng mục | Đo được |
|---|---|
| Dựng index (một lần) | tải `multilingual-e5-large` (~2,2 GB) và reranker; 24 biến thể chia chunk, artifact 11,7 MB |
| Một lượt level 1, lời giải mẫu | **10.262 token**, 3 sao; mỗi ca p50 1,28 s, p95 3,08 s (`gemini-3.5-flash-lite`) |

<sub>Nguồn: <a href="docs/design/engine-spike-report.md">báo cáo spike</a>.</sub>

### Theme pack

Theme pack chỉ là dữ liệu trong `frontend/public/themes/<id>/` (manifest, CSS token, font, ảnh), liệt kê
ở `index.json`; theme không dùng thì không bị tải.

- `VITE_THEME_PACKS` chọn các theme được đóng gói (bản công khai: chỉ `town`); không đặt thì lấy mọi theme trong `index.json`.
- `VITE_DEFAULT_THEME` chọn theme mặc định; không đặt thì lấy theme đầu tiên.
- Khi bản build có từ hai theme, nút trên thanh trên cùng cho đổi theme mà không tải lại trang; lựa chọn được nhớ trong `localStorage` (`vg-theme`).
- Thêm theme: thêm một thư mục và một dòng trong `index.json`. Bỏ theme: xoá cả hai. Không cần sửa code.
- Mỗi manifest có `place` (tên, toạ độ, múi giờ) và bốn preset ánh sáng (`dawn`, `day`, `dusk`, `night`); `theme.css` khai màu trời của từng pha và trời mây. Thời tiết lấy theo toạ độ `place`. Không bao giờ dùng vị trí người xem.
- Code app và backend không nhắc tên thương hiệu; job Brand isolation của CI kiểm tra điều này.

### Deploy

```mermaid
flowchart LR
    U["Trình duyệt"] --> V["Vercel<br/>trang tĩnh, header bảo mật"]
    V -->|"/api/* proxy cùng origin"| R["Render free, Singapore<br/>FastAPI"]
```

| Phần | Nơi chạy | Ghi chú |
|---|---|---|
| Frontend | Vercel, thư mục gốc `frontend`, lệnh `npm run build:vercel` | Chỉ đóng gói theme town. CSP theo hash của từng bản build, SPA fallback, `/api/*` chuyển tiếp phía máy chủ nên không cần CORS |
| API | Render gói free, vùng Singapore, khai báo trong [`render.yaml`](render.yaml) | 512 MB RAM, health check `/api/health`. Ngủ sau 15 phút không có truy cập; lần mở đầu có thể chờ khoảng một phút, trang chủ tự gọi `/api/health` để đánh thức sớm |

Merge vào `main` thì Vercel tự deploy lại; Render chỉ deploy khi CI xanh và `backend/`, `docs/content/`
hoặc `render.yaml` đổi, để API giữ ở mức 0 đồng. Chưa chạy agent trên bản deploy: index truy xuất và
model embedding (khoảng 2,2 GB) không vừa gói free. Từng bước dựng lại, biến môi
trường và tên miền: [docs/deploy.md](docs/deploy.md).

### Chất lượng và bảo mật

```bash
# trong frontend/ (lần đầu: npx playwright install chromium)
npm run check && npm run build && npm run test:e2e
```

```bash
# trong backend/
uv run ruff check && uv run ruff format --check && uv run mypy src tests && uv run pytest
```

`uv run pytest` chạy offline với model giả và LLM giả. `uv run pytest -m slow` dùng model thật, cần dựng
index trước. Git hook (gitleaks và lint file đã stage): chạy `lefthook install` sau mỗi lần clone.

| Workflow | Job | Kiểm tra |
|---|---|---|
| CI | Frontend checks | Prettier, ESLint, typecheck, Vitest, build kèm ngân sách bundle và CSP |
| CI | Backend checks | `uv sync --locked`, ruff, mypy strict, pytest |
| CI | End-to-end tests | Playwright trên bản build production, desktop và Pixel 7, WebGL phần mềm, axe |
| CI | Brand isolation | Không có tên thương hiệu trong `frontend/app`, `backend/src`, `backend/tests` |
| Security | Secret scan (gitleaks) | Quét secret trên toàn bộ lịch sử git |
| Security | SAST (semgrep) | Bộ luật `p/default`, image ghim theo digest |
| Security | Dependency vulnerabilities (osv-scanner) | Lỗ hổng trong `package-lock.json` và `uv.lock` |

Workflow Security chạy ở mỗi push lên main, mỗi PR và 03:23 UTC mỗi thứ Hai.

<details>
<summary><b>Các biện pháp bảo mật</b></summary>

- **CSP chặt.** Bản build tĩnh sinh header với `default-src 'self'`, `script-src 'self'` cộng hash của
  từng script inline, `style-src 'self'` (HTML pre-render không có thuộc tính `style`), kèm HSTS,
  `nosniff`, `Referrer-Policy` và `Permissions-Policy`. Backend gắn header bảo mật cho mọi phản hồi.
- **Một origin cho API.** Trên bản chạy thử, trình duyệt chỉ gọi `/api/*` của chính trang; Vercel chuyển
  tiếp sang Render phía máy chủ, nên backend không phải mở CORS. `connect-src` chỉ thêm
  `https://api.open-meteo.com` cho thời tiết khuôn viên.
- **Đầu vào của người chơi là dữ liệu.** Không chạy code của người chơi; payload ≤ 64 KB, chuẩn hoá NFC,
  chặn NUL và ký tự bidi; khối phải nằm trong danh sách được mở; chữ không bao giờ đi qua `str.format`.
- **Đáp án không rò.** Đáp án chỉ có trong `run.finished`; nội dung câu ẩn và câu bẫy không xuất hiện
  trong sự kiện nào; lỗi không kèm stack trace.
- **Chi phí LLM có trần.** Tối đa 12 lời gọi mỗi ca, `DAILY_LLM_CALL_CAP` (mặc định 500 lời gọi mỗi ngày
  cho cả server), `MAX_CONCURRENT_RUNS` (mặc định 1).
- **Chuỗi cung ứng.** Action ghim theo commit SHA, `permissions: contents: read`, binary gitleaks và
  osv-scanner được kiểm checksum; `.env` nằm trong `.gitignore`; khoá Gemini trên Render chỉ đặt trong
  tab Environment, không nằm trong git.

</details>

### Cấu trúc dự án

<details>
<summary><b>Cây thư mục</b></summary>

```text
v-game/
├── frontend/                  React Router 8 SPA và cảnh 3D
│   ├── app/
│   │   ├── routes/            home (pre-render), play (hub), play-zone, play-level (bàn thợ), not-found
│   │   └── features/
│   │       ├── campus/        layout (vật cản, tìm đường), movement, camera, store; hud/; scene/ (three.js, tải lười)
│   │       ├── landing/       các mục của trang chủ, gồm ShiftDemo
│   │       ├── theme/         đọc theme pack, ThemeProvider, ThemeToggle
│   │       ├── workbench/     bàn thợ: lắp khối, kiểm đồ thị, mở ca, luồng SSE, kết quả
│   │       └── zones/         schema (valibot), API, trang khu
│   ├── public/themes/         theme pack: chỉ dữ liệu (manifest, CSS token, font, ảnh)
│   ├── public/models/         props và nhân vật CC0 nướng sẵn (JSON), kèm giấy phép
│   ├── e2e/                   Playwright: landing, play, play-zone, loader, orbit, NPC, thời tiết, bàn thợ, a11y, qa-regressions
│   ├── scripts/               check-bundle, postbuild-csp, serve-build, build-vercel
│   └── vercel.json            cấu hình project Vercel
├── backend/
│   ├── src/vgame/
│   │   ├── api/routes/        health, zones, levels và blocks, runs (SSE)
│   │   ├── content/data/      zones.json, nguồn nội dung duy nhất của các khu
│   │   └── engine/            registry, validator, compiler, runtime, retrieval, llm, grading, levels/
│   ├── scripts/               spike_retrieval.py, spike_llm.py
│   └── tests/                 pytest offline: engine, API, bảo mật
├── docs/                      đặc tả, ADR, thiết kế, nội dung, deploy; media/ cho README
├── tools/                     nướng props và nhân vật (props/, characters/); readme-media/ quay ảnh cho README
├── render.yaml                Render Blueprint của API
└── .github/workflows/         ci.yml, security.yml
```

</details>

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/README.md](docs/README.md) | Mục lục và quy ước tài liệu |
| [Đặc tả tổng hợp](docs/specs/2026-10-07-v-game-design.md) | Mục tiêu, vòng chơi, kiến trúc, hiệu năng, bảo mật, phạm vi |
| [Engine v0.2](docs/design/engine-v0.2.md) | Khối, validate, biên dịch, sự kiện, chấm điểm của khu Thư viện |
| [Báo cáo spike engine](docs/design/engine-spike-report.md) | Số đo truy xuất và LLM với model thật, hiệu chỉnh ngân sách |
| [Kiến trúc frontend](docs/design/frontend-architecture.md) | Module, luồng dữ liệu, ngân sách và cách ép |
| [Cảnh hub v0.3](docs/design/campus-scene-v0.3.md) | Cổng, khuôn viên phía sau, tìm đường, camera, ngân sách cảnh |
| [Bàn thợ v0.1](docs/design/workbench-v0.1.md) | Lắp khối, mở ca, theo dõi lượt chạy, màn kết quả |
| [Lộ trình v0.4](docs/design/roadmap-v0.4.md) | Các đề xuất đã duyệt cho v0.4 và thứ tự xây |
| [Deploy](docs/deploy.md) | Vercel, Render, giữ Render ở 0 đồng, tên miền, cập nhật |
| [ADR](docs/adr/) | Quyết định về frontend stack, theme pack, backend stack |
| [backend/README.md](backend/README.md) | Endpoint, mã lỗi, biến môi trường, Docker |
| [frontend/README.md](frontend/README.md) | Route, lệnh, quy tắc frontend |
| [CREDITS.md](CREDITS.md) | Model 3D miễn phí (CC0) của Kenney và Quaternius, nguồn tải, cách nướng lại; nguồn dữ liệu thời tiết |

<details>
<summary><b>Ảnh minh hoạ trong README được tạo thế nào</b></summary>

Ảnh và GIF trong `docs/media/` được quay bằng Playwright trên bản build production chỉ có theme town,
giống bản chạy thử, với script trong [`tools/readme-media/`](tools/readme-media/): mọi API được mock như
`frontend/e2e/fixtures.ts` (khu, level, khối, luồng SSE đã ghi của một lượt level 1, Open-Meteo), WebGL
render bằng SwiftShader. Hub được ghim ở "Cố định ban ngày", trừ bốn ảnh trời được ghim giờ. Đồng hồ của
trang được giả lập và dừng giữa các khung, nên tốc độ đi bộ không phụ thuộc máy quay chậm hay nhanh. GIF
rộng 800 hoặc 960 px, mỗi file tối đa 4 MB; cả thư mục khoảng 5 MB.

```bash
# bash hoặc Git Bash, trong frontend/
VITE_THEME_PACKS=town VITE_DEFAULT_THEME=town npm run build
npm run preview -- --port 4351                                 # để chạy, mở terminal khác cho hai lệnh sau
node ../tools/readme-media/capture-media.mjs                   # khung hình vào tools/readme-media/out/
uvx --with pillow python ../tools/readme-media/make-gifs.py    # GIF và PNG vào docs/media/
npm run build                                                  # build lại đủ theme trước khi chạy e2e
```

| File | Nội dung | Khung hình |
|---|---|---|
| `hero-walk.gif` | Đi tới cô Lan, mở hội thoại, xoay góc nhìn 90°; camera bám theo | 1024 × 640 thu về 800, 10 hình/giây, khoảng 7 s |
| `scene-loader.gif` | "Sa bàn đang dựng" từ bước 2 tới sa bàn 3D; chunk cảnh bị giữ 2,5 s | 1024 × 640 thu về 800, thời gian thật, khoảng 5 s |
| `workbench.gif` | Level 1: lắp lời giải, mở ca, lượt chạy phát về, sao và chẩn đoán | 1280 × 800 thu về 960, thời gian thật, khoảng 15 s |
| `landing-demo.gif` | Đoán, chạy, gắn truy xuất, chạy lại, làm lại | 1280 × 760 thu về 960, khoảng 11 s |
| `sky.png` | Ban ngày, chiều tối, đêm, trời mưa, ghép 2 × 2 | bốn ảnh 1024 × 640, mỗi ảnh thu về 476 px |
| `npc-dialog.png` | Hội thoại với chị Diệp, sau khi đi tới từ nhãn của chị | 1024 × 640 |
| `mobile.png` | Hub ở 375 × 812 | tỉ lệ điểm ảnh 2 |

</details>

---

<sub>Quy chế đào tạo, trường đại học trong nội dung level và mọi nhân vật đều là hư cấu. Mọi hình trong README và bản chạy thử dùng theme town. Theme campus lấy cảm hứng từ một khuôn viên đại học có thật, chỉ dùng cho bản nội bộ và không được đưa lên bản công khai cho tới khi có phép của chủ thương hiệu (xem <a href="docs/deploy.md">docs/deploy.md</a>).</sub>

<sub>Model 3D: Kenney và Quaternius, CC0 1.0. Dữ liệu thời tiết: <a href="https://open-meteo.com/">Open-Meteo</a>, CC BY 4.0. Chi tiết ở <a href="CREDITS.md">CREDITS.md</a>.</sub>

<p align="center"><sub>Thực hiện bởi Tai Thanh Nguyen</sub></p>
