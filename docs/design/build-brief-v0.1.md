# Build brief v0.1: lát cắt dọc Thư viện

- **Ngày:** 2026-10-07 · **Chủ sở hữu file:** leader (điều phối). Agent khác chỉ đọc.
- **Mục đích:** chốt những gì mọi agent phải dùng chung, để các nhánh chạy song song mà không đá nhau.

## 1. v0.1 gồm gì

**Có:**
1. `/play`: campus hub 3D nhẹ, đi lại được (bàn phím, click, chạm), theme campus mặc định và nút đổi sang theme `town`.
2. Gặp thủ thư (NPC) ở cửa Thư viện, hội thoại ngắn, thẻ thông tin khu (dữ liệu từ `GET /api/zones`).
3. Vào `/play/library`: trang khu liệt kê 3 level theo thứ tự (dữ liệu từ `GET /api/zones/library`). Level chưa chơi được, nút ghi rõ "Đang xây".
4. Hai khu còn lại (Tháp canh, Chợ model) hiện trên bản đồ ở trạng thái "Sắp mở".
5. Tài liệu đầy đủ để bắt đầu engine: kịch bản L1–L3, outline 6 level còn lại, ca trực hằng ngày, phòng ý tưởng, dạy lại; kho quy chế hư cấu và bộ câu hỏi vàng; art bible; tham khảo nghiên cứu.

**Chi tiết phần code (coder làm đúng, không thêm):**
- Cảnh hub dựng procedural theo `docs/design/art-direction.md` §5–§7 (13 draw call, 39 cây, không texture). Đổi theme trong cảnh không tải lại trang: đổi bảng màu và kiểu landmark (`spire-hall` ↔ `clock-tower`), hàng cột theo `lm.colonnades`.
- HUD DOM theo art §8: cụm nút trên ("Về trang chủ", "Các khu", ThemeToggle), gợi ý tương tác, hội thoại cô Lan (panel phải ở desktop, bottom sheet ở mobile) có thẻ khu, danh sách khu làm đường đi không cần canvas.
- Điều khiển: WASD/mũi tên, click/chạm để đi (raycast một mặt đất), E/Enter-trên-nút-gợi-ý/chạm để tương tác, Esc đóng. Cả hai đi qua `movement.ts` (`step`, `isBlocked`, `nearestWithin`).
- Trạng thái trong khuôn mẫu: poster chờ chunk 3D, khung tải danh sách khu, lỗi API có "Thử lại" (cảnh vẫn chạy), trang khu: đang tải / khoá / không tìm thấy / lỗi.
- Trang khu chỉ hiện dữ liệu API (`title`, `brief`, `concepts`, `kind`). **Móc kịch bản** = chính `title`/`brief` trong `zones.json`, đã khớp tên đồ chơi của kịch bản ("Lược dao chunk"…). Frontend **không** chép thêm câu chữ kịch bản theo level (một nguồn, CLAUDE.md).
- Quay về từ trang khu: `/play?at=<location>`; `at` chỉ nhận khoá của `SITES`, giá trị lạ thì bỏ qua và dùng `SPAWN`. Điểm đứng theo art §4.6.
- Giảm chuyển động theo art §7 (cột `prefers-reduced-motion`).

**Không có (cố ý):** engine LangGraph, runtime level, bàn thợ/đồ chơi, Vòm Sao, SSE, đăng nhập, vai trò giáo viên, FSRS, lưu tiến độ phía server, sửa backend.

## 2. Quyết định đã chốt cho v0.1

| # | Quyết định | Ghi chú |
|---|---|---|
| D1 | Thư viện là khu mở đầu tiên. L1 Thư viện tự giới thiệu Thùng Context (không cần đã chơi Chợ). | Trả lời tạm câu 13.1.5 của đặc tả; chủ dự án xác nhận sau. |
| D2 | Mã level lấy từ `backend/src/vgame/content/data/zones.json`: `grounded-citation` (L1), `chunk-tuning` (L2), `article-number-lookup` (L3, `incident`). | Không đặt mã mới. |
| D3 | Kịch bản dùng hình thức "Xưởng Đồ Chơi Trực Ca" cho phần trình bày, nhưng mọi tham số engine theo **Phần 3** (tên khối, khoảng giá trị): `chunker.chunk_size` ∈ {128, 256, 512, 1024}, `overlap_pct` ∈ {0, 10, 20}, `vector_search.top_k` 1–20, `bm25_search`, `fusion` (rrf/alpha), `rerank.top_n`; không có temperature; profile là effort. | Mỗi đồ chơi ghi khối và tham số Phần 3 tương ứng. |
| D4 | Gold (chunk đáp án, hạng) chỉ hiện **sau** khi run kết thúc, trong màn truy vết/chẩn đoán. Không bao giờ trong lúc chạy. | Giữ nguyên tắc Phần 3, vẫn dùng được "sao vàng" của đề xuất gameplay ở bước hậu kiểm. |
| D5 | NPC thủ thư: **cô Lan**, thủ thư ca tối của Thư viện. Người hư cấu. | Kịch bản, art và code dùng đúng tên này. |
| D6 | Kho luật: "Quy chế đào tạo trình độ đại học" của **Trường Đại học Sao Mai** (hư cấu). Không tên trường thật nào xuất hiện trong nội dung. | |
| D7 | L3 dùng kho không có bản 2019 hết hiệu lực (sửa lỗi `ret.stale_doc` mà phản biện chỉ ra). | Ghi trong `docs/content/corpus/README.md`. |
| D8 | Theme manifest chỉ đổi khi `docs/design/art-direction.md` liệt kê rõ trường mới và giá trị cho **cả hai** theme. Coder sửa `schema.ts` và cả hai `manifest.json` cùng lúc. | |
| D9 | `app/features/campus/layout.ts` là nguồn toạ độ duy nhất. Art spec dùng toạ độ này; nếu cần dời gì, liệt kê thay đổi để coder sửa cả test. | |

## 3. Neo nội dung (bắt buộc, content và kịch bản cùng dùng)

**Văn bản:**
- Điều 12 (Bảo lưu kết quả học tập), khoản 2 có **nguyên văn** câu: "Sinh viên nộp đơn bảo lưu cho phòng đào tạo chậm nhất hai tuần trước ngày bắt đầu học kỳ, kèm ý kiến của cố vấn học tập." Được thêm câu sau câu này (ví dụ dẫn chiếu khoản 3), không được sửa câu này.
- Điều 12 khoản 3: ngoại lệ (trường hợp được nộp muộn) — bẫy "ngoại lệ nằm ở khoản ngay sau" của L2.
- Điều 41, 47, 74 cùng một họ chủ đề, lời văn na ná nhau, để tìm theo nghĩa xếp 74 và 41 trên 47 khi hỏi "Điều 47 khoản 2".
- **Cấm** ở bất kỳ đâu trong kho: quy định rằng sinh viên chỉ cần gửi email cho phòng đào tạo (để bảo lưu hay bất cứ việc gì). Điều 47 không được nói về bảo lưu.
- **Không có Điều 99** (số điều cao nhất ≤ 90).
- Bản 2019 (hết hiệu lực) có vài điều gần giống bản 2024 nhưng khác số liệu, gồm cả điều về bảo lưu với thời hạn khác.

**Mã ca:** `lib-l{1|2|3}-{v|h|t|r}{NN}` — v = visible (3 ca/level), h = hidden, t = trap, r = review (biến thể cho ca trực hằng ngày).

| Ca neo | Câu hỏi / vai trò | Đáp án |
|---|---|---|
| `lib-l1-v01` | Nguyên văn câu demo trang chủ: "Em muốn bảo lưu kết quả học tập một học kỳ thì cần làm gì?" | Điều 12 khoản 2 |
| `lib-l1-t01` | Hỏi về "Điều 99" | Từ chối: không có điều này |
| `lib-l1-t02` | Câu ngoài phạm vi quy chế | Từ chối: không tìm thấy |
| `lib-l2-v01` | Câu chỉ trả lời đúng khi lấy được Điều 12 khoản 3 | Điều 12 khoản 2 + 3 |
| `lib-l2-t01` | Câu mà bản 2019 trả lời khác bản 2024 | Theo bản 2024 |
| `lib-l3-v01` | "Điều 47 khoản 2 quy định gì?" | Điều 47 khoản 2 |
| `lib-l3-t01` | Hỏi diễn đạt lại kiểu "nghỉ học một thời gian" (dense thắng, BM25 trượt) | Điều 12 |
| `lib-l3-t02` | Hồi quy: một ca của L2 phải vẫn đạt | như ca L2 gốc |

Câu bịa "Điều 47 ma" của L1 trùng với câu trên trang chủ: "Theo Điều 47 Quy chế đào tạo, em chỉ cần gửi email cho phòng đào tạo trước khi học kỳ kết thúc là được bảo lưu."

## 4. Lời thoại hub (coder dùng nguyên văn)

- Gợi ý tương tác gần NPC: "Nhấn E hoặc chạm để nói chuyện với cô Lan"
- Gợi ý ở cửa khu mở: "Nhấn E để vào Thư viện" · khu chưa mở: "Tháp canh · Sắp mở" / "Chợ model · Sắp mở"
- Hội thoại lần đầu, 2 câu:
  1. "Chào bạn, mình là Lan, thủ thư ca tối. Trợ lý tra cứu của thư viện vừa trả lời sai quy chế cho một bạn sinh viên, còn gán cho Điều 47 một quy định không hề có."
  2. "Mình cần người dạy nó tra sách trước khi trả lời. Bạn vào xem giúp mình nhé?"
- Hai nút: "Vào Thư viện" (tới `/play/library`) · "Để sau" (đóng).
- Lần gặp sau (cùng phiên): "Trợ lý vẫn đang chờ bạn ở quầy tra cứu."
- Nút trên trang khu cho level chưa chạy được: "Đang xây". Liên kết quay lại: "Về khuôn viên".

### 4.1 Chuỗi bổ sung đã chốt (leader, sau đợt 1)

- Câu 1 của hội thoại đã sửa (2026-10-07) cho khớp kho: Điều 47 **có thật** (nói về đề nghị xem xét lại điểm đánh giá quá trình), cái sai là quy định bịa gán cho nó. Khớp câu "Quy chế không có Điều 47 nào nói như vậy" trên trang chủ.
- Duyệt nguyên văn toàn bộ bảng `art-direction.md` §8.6: "Về trang chủ", "Các khu", "Nói chuyện với cô Lan", "Thủ thư ca tối", "Đang mở" / "Sắp mở", "{n} màn", "Sự cố", "Đang tải khuôn viên", "Chưa tải được thông tin các khu." / "Cảnh vẫn dùng được. Kiểm tra kết nối rồi thử lại.", "Khu này sắp mở", "Không tìm thấy khu này" / "Đường dẫn không khớp khu nào trong khuôn viên.". Coder được viết test e2e khớp nguyên văn.

### 4.2 Quyết định khác sau đợt 1

- **D9:** duyệt bỏ 3 cây theo `art-direction.md` §6.4 (42 → 39) kèm test cây nằm trong `WORLD_BOUNDS` và không chạm footprint khu. Cô Lan là vật cản: coder quyết.
- **Coder sửa luôn** (ngoài art, trong `frontend/**`): `ThemeToggle` ≥ 44 px; nhãn "Sự cố" trang chủ dùng chữ `text-ink` trên `bg-accent-tint` như trang khu (town chỉ 4.48:1).
- **Nguồn sự thật của ca test** là `docs/content/golden/*.json` (số ca, vai, tiêu chí chấm). Kịch bản tham chiếu, không chép số liệu riêng. Không tạo file gộp `library-golden.json` hay `quy-che-dao-tao.md`; nếu engine cần file phẳng thì sinh từ ba file level.
- **Chấm ca từ chối (`expect: abstain`):** đạt khi có dấu hiệu từ chối thuộc danh sách cố định trong `grading.refusal_markers` của file golden, không chứa `forbidden`, và không có `llm.cite_unknown`. Được trích đoạn **có thật** trong thùng (ví dụ để chỉ ra Điều 41 chỉ có 4 khoản); trích bịa mới trượt. Danh sách dấu hiệu tối thiểu: "không có thông tin", "không tìm thấy", "không có điều", "không có khoản", "không tồn tại", "không quy định". Tạm chốt cho v0.1; chủ Phần 4 xác nhận khi viết evaluator.

### 4.3 Chốt thêm (leader, trước đợt 2)

- Duyệt token `bg-scene` (art §2.5): một dòng trong `@theme inline` + fallback trong `:root`. Không đổi manifest, D8 không kích hoạt.
- Tên khu trên nhãn và khi API lỗi: "Thư viện", "Tháp canh", "Chợ model" (khớp `zones.json`). Có API thì dùng `zone.name`.
- `DEFAULT_STATUS` của art §6.3 được duyệt: cảnh không chờ API.

## 5. Ngân sách hiệu năng (đo trong e2e hoặc test)

- Trang chủ không tải three.js (three chỉ nằm trong chunk của `/play`).
- Chunk JS của `/play` ≤ 300 KB gzip (three + r3f + code cảnh).
- ≤ 40 draw call, ≤ 60k tam giác trong cảnh hub; không shadow map, không postprocessing, không texture/model tải ngoài: mọi hình là procedural.
- `frameloop="demand"`: khi không ai di chuyển và không có hoạt cảnh, không render khung mới.
- DPR tối đa 2 (desktop), 1.5 (mobile); hạ DPR khi FPS tụt.
- Cảnh hiện trong ≤ 2,5 s trên laptop GPU tích hợp với build production (sau khi chunk về). Lỗi API không chặn cảnh.

**Kiểm chứng từng ngân sách (không có cách đo = chưa đạt):**

| Ngân sách | Cách đo | Ở đâu |
|---|---|---|
| Trang chủ không có three | e2e: nghe `request` khi tải `/`, không URL chunk nào chứa module three/r3f (tên chunk lấy từ manifest build, không đoán theo tên file) | `e2e/landing.spec.ts` |
| `/play` ≤ 300 KB gzip | script đọc `build/client/.vite/manifest.json`, cộng gzip mọi chunk JS của route `play` (cả import tĩnh), fail nếu vượt | script trong `frontend/scripts/`, gọi trong `npm run check` hoặc `build` |
| ≤ 40 draw call, ≤ 60k tam giác | vitest trên hàm dựng geometry thuần: đếm nhóm (= draw call) và tam giác cho **cả hai** theme; mục tiêu thực tế theo art §6.1 (13 / ≤ 9 000), test fail nếu > 16 hoặc > 12 000 để bắt trôi sớm | `app/features/campus/*.test.ts` |
| `frameloop="demand"`, không render khi đứng yên | e2e chạy trên build prod, nên bộ đếm frame chỉ gắn khi URL có `?debug=frames` (ghi `document.documentElement.dataset.frames`, không gắn biến toàn cục); e2e đứng yên 2 s, giá trị không tăng | `e2e/play.spec.ts` |
| Không shadow map / postprocessing | grep trong test: không `castShadow`, `shadows`, `EffectComposer` dưới `app/features/campus` | vitest hoặc lint |
| DPR | `dpr={[1, cap]}`, `cap` = 2 desktop / 1.5 khi `(pointer: coarse)`; `PerformanceMonitor` + `AdaptiveDpr` | review + ghi trong `frontend-architecture.md` |
| Dispose khi đổi theme | vitest: dựng theme A, đổi sang B, mọi geometry cũ đã gọi `dispose()` | campus test |

## 6. Ai sở hữu file nào

| Vai | Được ghi |
|---|---|
| research | `docs/research/library-slice-references.md` |
| scenario | `docs/content/scenarios/*.md` |
| content | `docs/content/corpus/*.md`, `docs/content/golden/*.json` |
| art | `docs/design/art-direction.md` |
| leader | `docs/design/build-brief-v0.1.md` |
| coder | `frontend/**` (trừ `frontend/public/themes/*/fonts/`), `docs/design/frontend-architecture.md` |

Không ai sửa `backend/`, `.github/`, `lefthook.yml`, `docs/specs`, `docs/adr`, `docs/design/part-3-block-system.md`, `docs/design/gameplay-direction.md`, `docs/README.md`. Thấy lỗi ở đó thì báo, không sửa. Không commit, không push.

## 7. Thứ tự

1. **Đợt 1 (song song):** research, scenario, content, art. Coder bắt đầu phần không phụ thuộc hình (route, dữ liệu, trang khu, HUD, input, test).
2. **Đợt 2:** coder dựng hình theo `art-direction.md`.
3. **Đợt 3:** QA đối chiếu: neo nội dung (mục 3), ngân sách (mục 5), tiêu chí nghiệm thu từng vai.

## 8. Khả năng tiếp cận (bắt buộc, không phải "nếu kịp")

- **Không cần canvas:** canvas `aria-hidden="true"`, không nhận focus. Mọi hành động (nói chuyện với cô Lan, xem thẻ khu, vào Thư viện, đổi theme, về trang chủ) làm được chỉ bằng Tab/Enter/Esc qua cụm nút và danh sách "Các khu".
- **Hội thoại:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` trỏ tên "Cô Lan". Mở thì focus "Vào Thư viện"; bẫy focus; Esc/click lớp phủ = "Để sau"; đóng trả focus như art §8.4.
- **Gợi ý tương tác:** là `<button>` thật (bấm = E); vùng `aria-live="polite"` báo khi đổi đích ("Nhấn E hoặc chạm để nói chuyện với cô Lan"), không đọc lại mỗi frame.
- **Lỗi API:** khối lỗi có `role="alert"`; nút "Thử lại" nhận focus được.
- **Trang khu:** một `h1`; danh sách màn là `ol`; nút "Đang xây" có thuộc tính `disabled` thật; huy hiệu "Sự cố" là chữ, không chỉ màu.
- Vùng chạm ≥ 44 px (gợi ý 48 px), vòng focus thấy rõ (luật `:focus-visible` toàn cục), tương phản chữ ≥ 4.5:1 cả hai theme (art §8.5), không cuộn ngang ở 375 px.
- `prefers-reduced-motion: reduce`: không nhún, không nhịp vòng, camera và quay người gán thẳng (art §7).
- Phím di chuyển không chặn phím khi focus nằm trong input/nút/dialog (`isMovementKey` chỉ xử lý khi focus ở `body` hoặc vùng cảnh).

## 9. Test bắt buộc

**Vitest (logic thuần, không WebGL):**
- Hàm dựng geometry: số nhóm và tam giác cả hai theme (mục 5), đổi theme cho màu khác và kiểu landmark khác, dispose.
- `layout.ts` sau thay đổi D9: 39 cây, mọi cây trong `WORLD_BOUNDS`, đĩa 0,9 quanh cây không chạm footprint khu; ba điểm quay về (art §4.6) không bị chặn.
- Camera: công thức zoom art §4.3 cho 1280×800 (overview, 32,8 ± 0,1) và 375×812 (follow, 29,8 ± 0,1).
- Store tương tác (zustand): đích gần nhất, mở/đóng hội thoại, cờ đã gặp, câu gặp lại.
- Đọc `at`: chỉ khoá `SITES` hợp lệ.
- Cả hai `manifest.json` parse được bằng `schema.ts`.
- Trang khu: render các trạng thái mở / khoá / không tìm thấy / lỗi từ dữ liệu giả.

**Playwright (build prod qua `serve-build`, API mock từng test, project `desktop` 1280×800 và `mobile`; kiểm thêm viewport 375×812):**
1. `landing`: `/` tải xong, không chunk three (mục 5).
2. `play`: có canvas; không lỗi console, không vi phạm CSP; bộ đếm frame đứng yên.
3. `play`: "Các khu" → "Nói chuyện với cô Lan" → hội thoại đúng **nguyên văn** 2 câu §4 → Esc đóng, focus về nút mở → mở lại → "Vào Thư viện" tới `/play/library`. Chạy được chỉ bằng bàn phím.
4. `play`: đi bằng phím tới gần cô Lan (giữ phím mũi tên/WASD theo hướng tính từ `SPAWN`), gợi ý đúng chữ §4 hiện, nhấn E mở hội thoại.
5. `play`: Tháp canh và Chợ hiện "Sắp mở", không có nút vào.
6. `play`: ThemeToggle đổi sang `town` không tải lại trang (giữ một biến trong `window` để chứng minh), canvas vẫn còn, không lỗi console.
7. `play` khi API 500: cảnh vẫn render, khối lỗi đúng chữ art §8.6, "Thử lại" gọi lại API và hiện danh sách khi mock trả 200.
8. `play-zone`: `/play/library` có đúng 3 màn theo thứ tự `grounded-citation`, `chunk-tuning`, `article-number-lookup`; màn 3 có "Sự cố"; 3 nút "Đang xây" đều disabled; "Về khuôn viên" về `/play?at=library`.
9. `play-zone`: `/play/watchtower` (mock `coming_soon`) hiện "Khu này sắp mở"; `/play/abc` (mock 404) hiện "Không tìm thấy khu này"; API 500 hiện lỗi có "Thử lại".
10. axe (`@axe-core/playwright`, đã cài): 0 vi phạm `serious`/`critical` trên `/play` (HUD, có và không mở hội thoại) và `/play/library`, ở 375×812 và 1280×800.

Không dùng `waitForTimeout` để chờ trạng thái; chờ theo locator hoặc thuộc tính `data-*`.

## 10. Tiêu chí nghiệm thu v0.1

Đạt khi **tất cả** đúng:
1. Trong `frontend/`: `npm run check`, `npm run build`, `npm run test:e2e` đều xanh. `grep -rniI vinuni frontend/app backend/src backend/tests` rỗng.
2. `/play` hiện sa bàn có ánh sáng ở cả hai theme; ThemeToggle đổi bảng màu và landmark không tải lại; đi được bằng phím và click/chạm; va chạm nhà, cây, đài phun.
3. Gần cô Lan: gợi ý đúng §4; E/chạm/click mở hội thoại bẫy focus với đúng 2 câu; Esc đóng, trả focus; "Vào Thư viện" tới `/play/library`. Hai khu kia "Sắp mở". Mọi việc làm được qua danh sách "Các khu" chỉ bằng bàn phím.
4. `/play/library` đúng 3 màn từ API theo thứ tự, đủ title/brief/concepts, màn 3 có "Sự cố", nút "Đang xây" disabled. Khu `coming_soon` → trang khoá; id lạ → không tìm thấy. API lỗi: cả hai route có lỗi tiếng Việt và "Thử lại"; cảnh hub vẫn chạy.
5. Ngân sách mục 5 đạt và có bằng chứng theo bảng kiểm chứng (số gzip của chunk `/play`, số draw call/tam giác từ test).
6. axe sạch như mục 9.10; vùng chạm ≥ 44 px; giảm chuyển động hoạt động.
7. Đã xem tay ảnh chụp 375×812 và 1280×800, cả hai theme, theo checklist art §10.
8. `docs/design/frontend-architecture.md` có: sơ đồ module, luồng dữ liệu, ngân sách và cách ép, cách thêm một công trình, cách thêm một theme, giới hạn đã biết, và lý do nếu thêm dependency (mặc định: không thêm).
9. Tài liệu các vai khớp D1–D9 và mục 3 (QA đối chiếu tên cô Lan, Trường Đại học Sao Mai, mã level, mã ca, trích dẫn nguyên văn trong kho).
10. Không file nào bị sửa ngoài quyền sở hữu (mục 6). Không commit, không push.

## 11. Chờ chủ dự án xác nhận

- D1 (Thư viện mở trước, không cần Chợ) và hướng gameplay "Xưởng Đồ Chơi Trực Ca" (đặc tả §13.1).
- Theme campus chỉ dùng nội bộ cho pilot một lớp; cần xin phép trước khi công khai.
- Luật chấm ca từ chối (§4.2) tạm chốt; chủ Phần 4 xác nhận khi viết evaluator.
- Bẫy kho (vị trí cắt 128 token, dense xếp 74/41 trên 47) là ước lượng; kiểm lại ở spike engine, không chặn v0.1.
