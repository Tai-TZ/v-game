# Frontend architecture v0.1

- **Ngày:** 2026-10-07 · **Chủ sở hữu file:** coder.
- **Sửa 2026-10-08:** thêm §8 (luật trực quan hoá, [roadmap-v0.4](roadmap-v0.4.md) N23); §1–§7 giữ nguyên.
- **Sửa 2026-10-09 (v0.4, bộ nhân vật):** §1 thêm `scene/cast.ts` và `public/models/cast.json`; §3 cập nhật draw call, tam giác và mức chặn.
- **Nguồn:** [build-brief-v0.1.md](build-brief-v0.1.md), [art-direction.md](art-direction.md).

## 1. Sơ đồ module

```
app/
├─ routes/
│  ├─ home.tsx            trang chủ (pre-render)
│  ├─ play.tsx            hub: clientLoader (?at=, zones promise), HUD, lazy CampusScene
│  └─ play-zone.tsx       trang khu: clientLoader → ZonePageData, HydrateFallback = khung tải
├─ features/
│  ├─ campus/             (không import three, trừ scene/)
│  │  ├─ layout.ts        nguồn toạ độ duy nhất (D9): SITES, TREES (39), OBSTACLES, arrival
│  │  ├─ movement.ts      step, isBlocked, nearestWithin, phím → hướng
│  │  ├─ camera.ts        toán camera isometric (zoom §4.3, dead-zone, inset)
│  │  ├─ sites.ts         DEFAULT_STATUS, tên dự phòng, INTERACT_POINTS, chữ gợi ý §4
│  │  ├─ store.ts         zustand: nearby, dialog, metLan, sheetInset, sky + `motion` (mutable)
│  │  ├─ sky.ts           thuần, không three: độ cao mặt trời, pha (±6°), buổi theo múi giờ
│  │  │                   của `place`, 7 nhóm thời tiết → 5 lớp nướng, WeatherSchema,
│  │  │                   sceneLook, chế độ hiển thị (`vg-hub-display`)
│  │  ├─ useSkyClock.ts   gọi một lần ở route: pha mỗi 60 s, /api/weather 30 phút/lần
│  │  │                   (2 phút sau lỗi) khi tab hiện; ghi store khi đổi
│  │  ├─ hud/             HubTopBar (+ danh sách "Các khu"), InteractHint, LanDialog,
│  │  │                   SceneLoader + sceneLoad + blueprint (màn chờ), SceneBoundary,
│  │  │                   WeatherChip (chip + popover), WeatherLayer (mưa, sương, chớp CSS)
│  │  └─ scene/           chunk lazy: three + r3f
│  │     ├─ palette.ts    màu manifest + màu phái sinh §2.2, shade §2.3; palette(campus,
│  │     │                pha, lớp nướng), weatherPreset, darkness (art §14)
│  │     ├─ primitives.ts box/cyl/quad/prismX/arcSlab… + part() nướng sáng vào vertex colour
│  │     ├─ campus.ts     builder từng nhóm (§5): terrain, landmark, library, watchtower,
│  │     │                market, player, lan, cây
│  │     ├─ useCampusGeometry.ts  memo nhóm tĩnh theo theme/pha/lớp nướng/status, người và
│  │     │                        cây chỉ theo theme; dispose; sceneBudget()
│  │     ├─ useHubFrame.ts        vòng frame + input (phím, click/chạm); castFigures
│  │     ├─ cast.ts       giải mã public/models/cast.json (nướng sẵn, không GLTFLoader):
│  │     │                parseCast, buildFigure, paintFigure, clip và mixer (chỉ import three)
│  │     ├─ labels.ts, WorldLabels.tsx  nhãn DOM bám neo thế giới
│  │     └─ CampusScene.tsx       <Canvas>, vật liệu dùng chung, mesh
│  ├─ zones/              schema (valibot), api (loadZoneList, loadZonePage), ZoneCard,
│  │                      ZonePage, ui (chip, trạng thái, huy hiệu Sự cố)
│  └─ theme/              manifest, ThemeProvider, ThemeToggle (h-11, biến thể `surface`)
└─ lib/                   api.getJson, useMediaQuery, useSettled/useDelayedFlag
```

## 2. Luồng dữ liệu

- **Theme:** `useActiveTheme().campus` → `useCampusGeometry` dựng lại nhóm khi đổi theme (dispose
  geometry cũ), vật liệu tạo một lần; x-ray và vòng chỉ đổi `color`. Không tải lại trang.
- **Zones (hub):** `clientLoader` gọi `loadZoneList()` nhưng **không await**; `useSettled` đọc
  promise. Trước khi có dữ liệu hoặc khi lỗi: `siteInfo(null)` dùng `DEFAULT_STATUS` và tên §4.3,
  nên cảnh không chờ API. "Thử lại" = `revalidator.revalidate()` (promise mới).
- **Zones (trang khu):** `loadZonePage(id)` trả về `open | locked | not-found | error`; trang
  tự vẽ từng trạng thái (không ném lỗi sang ErrorBoundary).
- **Mỗi frame:** `useHubFrame` đọc `hubStore.getState().motion` (vị trí, phím, đích click) và sửa
  trực tiếp; chỉ ghi `nearby`/`dialog` khi đổi (React render lại HUD). Không có state React theo
  frame. Nhãn DOM được đặt `style.transform` qua ref trong frame đã render.
- **Trời và thời tiết (campus v0.4, art §14):** `useSkyClock(theme.place)` ở route tính pha từ
  mặt trời tại `place` (không mạng, đúng khi API ngủ) và gọi `getJson("/api/weather")` không
  await; mọi lỗi im lặng (thời tiết là trang trí), chip ghi "Chưa có thời tiết". Store giữ
  `sky = { phase, weather, failed, display, look }`, chỉ ghi khi đổi; `look` chỉ thay khi
  (hiển thị, pha, nhóm thời tiết) đổi và lúc đó gọi `wake()`. Route đặt
  `<main data-sky data-clouds>` (CSS ra `--vg-sky`) và truyền `look` cho `CampusScene`, cảnh
  dựng lại qua `useDeferredValue`. Chip đọc phần còn lại; đồng hồ trong popover chỉ đọc khi mở.
- **Tương tác:** phím E, nút gợi ý, click/chạm cô Lan, mục "Nói chuyện với cô Lan" đều đi qua
  `onInteract`/`talkToLan` của route.

## 3. Ngân sách và cách ép

| Ngân sách | Thực tế | Ép bằng |
|---|---|---|
| Trang chủ không có three | 0 chunk | `scripts/check-bundle.mjs` (manifest + dò chuỗi `THREE.WebGLRenderer`) và `e2e/landing.spec.ts` (danh sách chunk từ `build/bundle-report.json`) |
| `/play` ≤ 300 kB gzip ¹ | 292,8 kB (2026-10-09, sau giờ thật và thời tiết: +3,8 kB cho `sky.ts`, chip, lớp phủ, 9 icon; trước đó khoảng 289 kB) | `check-bundle.mjs` trong `npm run build`, fail nếu vượt |
| ≤ 40 draw call, ≤ 60k tam giác | v0.4: 14 khi còn tượng, 17 khi bộ nhân vật Kenney đã tải (6 SkinnedMesh + x-ray người chơi); ban ngày 22 177 / 19 032 (tượng) và 26 112 (campus) / 22 967 (town) (bộ nhân vật), đo bằng `sceneBudget()` | `scene.test.ts` (fail nếu > 20 hoặc > 28 000; trước v0.4 là 16 và 23 000). Xoay 360° (v0.4) không thêm draw call hay tam giác; `scene.test.ts` còn kiểm khung `ORBIT_FRAME` và góc HUD ở mọi yaw |
| `frameloop="demand"` | không frame khi đứng yên, kể cả lúc mưa dông ban đêm (mưa và chớp là CSS) | `e2e/play.spec.ts`, `e2e/weather.spec.ts` với `?debug=frames` |
| Thời tiết | +0 draw call, +0 program, +0 tam giác trên cả 20 look; dựng lại khoảng 6 lần/ngày; 1 GET cùng origin khi vào hub rồi 30 phút/lần khi tab hiện; `rain.svg` < 1 kB nhúng `data:` | `scene.test.ts` (trần 18 draw call / 34 500 tam giác, tường orbit trên mọi look), `useSkyClock.test.ts`, `weather.spec.ts` |
| Không shadow map / postprocessing | — | `scene.test.ts` grep `app/features/campus` |
| DPR | `dpr={[1, 2]}`, `[1, 1.5]` khi `(pointer: coarse)` hoặc < 768 px | xem dưới |
| Dispose khi đổi theme | — | `scene.test.ts` |

¹ Theo brief §5: chỉ tính chunk của route (three + r3f + mã scene), cộng thêm vào shell. Tải
nguội trực tiếp `/play` khoảng 375 kB gzip, gồm cả shell ~115 kB. Lighthouse chạy trên
`npm run preview` đo số chưa nén: đo sau một host có gzip hoặc bằng script tương đương.

**DPR:** không dùng `PerformanceMonitor`/`AdaptiveDpr` của drei: với `frameloop="demand"` khoảng
nghỉ giữa các frame bị tính thành FPS thấp và hạ DPR sai. Thay bằng bộ đo trong `useHubFrame`: chỉ
đếm các frame liên tiếp khi cảnh đang chuyển động (đi bộ, camera, hiệu ứng); một frame nghỉ mở
cửa sổ mới. Mỗi cửa sổ 45 frame, nếu quá nửa chậm hơn 22 ms (tương đương trung vị > 22 ms, không
cần sort) thì hạ một bậc 2 → 1,5 → 1. (Brief §5 ghi drei; lệch có chủ đích, cần leader duyệt.)

## 4. Thêm một công trình

1. `layout.ts`: thêm `Site` (footprint, door, facing) vào `SITES`; chạy `layout.test.ts`.
2. `zones/schema.ts` + backend: thêm `location` mới (backend là nguồn nội dung).
3. `sites.ts`: `DEFAULT_STATUS` và tên dự phòng.
4. `scene/campus.ts`: viết `buildX(pal, look)` theo quy ước §5.0 (dùng `paint(pal)` và `merge`; `look` là `SiteLook`, campus-scene v0.3 §13.5).
5. `useCampusGeometry.ts` + `CampusScene.tsx`: thêm nhóm (một draw call); cập nhật
   `sceneBudget`. `labels.ts`: neo nhãn. `zones/ui.tsx`: màu thanh khu.

## 5. Thêm một theme

Chỉ là dữ liệu: thư mục `public/themes/<id>/` (manifest.json đúng `schema.ts`, kể cả
`place` và `campus.lights` với bốn preset `dawn`, `day`, `dusk`, `night`; theme.css có
`--vg-scene-sky`, `--vg-scene-dawn`, `--vg-scene-dusk`, `--vg-scene-night`, `--vg-scene-cloud`,
`--vg-scene-cloud-night`, font) và một dòng trong `public/themes/index.json`. Không sửa code;
`scene.test.ts` tự kiểm tra mọi theme trong index (parse, ngân sách, dispose). Muốn trường
manifest mới: theo D8.

## 6. Giới hạn đã biết

- "Đã gặp cô Lan" sống trong store mức module: giữ khi đi trang khu rồi quay lại, mất khi tải lại.
- Hiệu ứng ra (exit 120 ms) của gợi ý/panel chưa làm: phần tử gỡ ngay. Vào thì có (200 ms).
- Click ra ngoài danh sách "Các khu" đóng danh sách nhưng không kéo focus về nút mở (để focus
  theo chỗ vừa bấm); Esc thì trả focus.
- Người xem đã lưu theme khác mặc định vẫn tải theme.css mặc định (~2,4 kB), các font preload của
  theme mặc định (~51 kB) và ảnh hero preload ưu tiên cao ở `/` (`campus-1280.webp`, 78 kB). Chấp
  nhận cho v0.1 vì pilot chỉ phát hành theme mặc định; xem lại khi có theme production thứ hai.
  Trong lúc theme.css đã lưu đang tải, `<html>` mang `.vg-theme-loading` (tắt transition) để
  nút không mờ dần từ bảng màu mặc định ở lần vẽ đầu.
- Không có pinch/wheel zoom, camera không xoay (art §4.1).
- Test e2e chạy WebGL phần mềm (SwiftShader), tối đa 4 worker; FPS thật cần đo tay trên GPU
  tích hợp. Test đi bộ phát hai phím mũi tên trong cùng một task (CDP gửi lần lượt làm người
  chơi trôi khi render chậm).

## 7. Dependency

Không thêm thư viện mới cho v0.1. `drei` vẫn trong `package.json` nhưng scene không dùng (không
vào bundle). `isbot` được ghi thẳng vào `dependencies` (5.2.2, vốn là phụ thuộc gián tiếp của
`@react-router/dev`): CLI `react-router typegen` tự cài nó nếu thiếu ở package.json, và lần tự
cài đó làm hỏng `node_modules` trên Windows.

## 8. Trực quan hoá (luật, chốt 2026-10-08)

Áp dụng cho mọi biểu đồ, thanh, bảng hạng và bài vi mô của bàn thợ và các route sau này (đề xuất
N23, [roadmap-v0.4](roadmap-v0.4.md)). Số đo hiệu năng và kích thước gói lấy từ báo cáo trực quan
hoá 2026-10-08; header CSP và hành vi CSP ở §8.5 đo lại trên site thật cùng ngày.

### 8.1 Cách vẽ

- **SVG hoặc HTML/CSS, không thư viện biểu đồ.** Scale tuyến tính tự viết (một dòng). `d3-scale`,
  `d3-shape`, `d3-array` (≈ 12,5 kB gzip cộng lại) chỉ thêm khi bump chart hoặc biên Pareto cần, ghi
  lý do trong PR; luật "không thêm dependency" của v0.1 (§7) vẫn đứng.
- **Đủ nhanh ở cỡ của V-Game.** Mọi trực quan dự kiến có ≤ 500 phần tử (dải token ≤ 500, bump chart
  ≤ 25 đường, ma trận ≤ 400 ô, bản đồ sao ≤ 175 điểm). Đo trên Chrome 152, Intel Iris Xe, trung vị 15
  lần, mặt vẽ 800×500: SVG cập nhật mọi điểm mỗi khung chịu khoảng 700 điểm trong 8 ms; cập nhật một
  điểm (rê, chọn) dưới 2 ms tới 20.000 điểm (số SVG chưa gồm thời gian paint, chi phí thật cao hơn); dựng mới 5.000 điểm mất 71 ms (một tác vụ dài, hỏng độ
  phản hồi lúc vào route). Canvas 2D chỉ khi cần hoạt cảnh trên 700 điểm. WebGL và worker không dùng
  ngoài `/play`. Tìm điểm gần nhất bằng quét tuyến tính (≤ 0,1 ms ở 10.000 điểm), không cần quadtree.
- **Kích thước và màu không qua `style=`.** Dùng thuộc tính SVG (`width`, `x`, `transform`) hoặc lớp
  Tailwind; màu bằng lớp `fill-*`/`stroke-*` của token ngữ nghĩa. `style={{…}}` của React chỉ chạy ở
  component render phía client (đi qua CSSOM) và thành thuộc tính `style=` bị CSP chặn nếu lọt vào
  HTML prerender.
- **Dữ liệu nặng tính lúc build** (N21): JSON tĩnh trong `/public`, tải lười theo level, không tính
  vào bundle. Vector của chỉ mục không bao giờ xuống trình duyệt, chỉ toạ độ 2D, bảng điểm và offset.
  Không bao giờ xuất điểm, hạng hay prompt của câu ẩn và câu bẫy. File tĩnh chạy cả khi API trên
  Render đang ngủ. **Lượt đã ghi tĩnh** ([roadmap-v0.4](roadmap-v0.4.md) B0, B5; sửa 2026-10-08, rà soát
  vòng 5) là file duy nhất trong `/public` có ca ẩn và ca bẫy, và với chúng chỉ mang đạt/trượt theo tiêu
  chí, nhãn, vai, tổng token của thùng và `cite_unknown` (các trích bịa đã bật nhãn đó, cho áp phích
  của L1; không bao giờ có mã trích hợp lệ, vì mã đó chỉ vào đoạn gold; thêm 2026-10-08, rà soát
  vòng 6): không `retrieved`, `pack.included`, chữ trả lời, hạng, điểm hay gold. Cổng CI của B6 kiểm
  ca ẩn, ca bẫy chỉ có các trường này. Vì thế truy vết của lượt đã ghi chỉ có hạng và sao vàng ở ca thấy được.

### 8.2 Khả năng tiếp cận

- Mỗi biểu đồ nằm trong `<figure>` với `<figcaption>` nêu điều rút ra bằng một câu tiếng Việt, kèm
  nút "Xem dạng bảng" mở một `<table>` cùng dữ liệu. Với ma trận nhầm lẫn và bảng hạng, bảng là
  giao diện chính, màu là lớp phụ. Ở 375 px, dạng bảng là mặc định.
- Không truyền thông tin chỉ bằng màu: mỗi trạng thái có màu, icon và chữ.
- Mọi thứ kéo được (vạch ngưỡng, vạch k, vạch ngân sách) là `<input type="range">` gốc đặt lên biểu
  đồ, có `aria-valuetext` như "0,80, còn 4 đoạn". Không tự viết thanh kéo bằng pointer event.
- Cả trang chỉ có một vùng `aria-live="polite"`, thông báo tối đa một lần mỗi 2 giây: bước xong, tóm
  tắt câu đã chấm, điểm cuối. Không đặt live region riêng trong từng biểu đồ.
- Tập điểm (bản đồ sao) có một điểm dừng Tab; phím mũi tên đi qua các điểm theo hạng.
- Màu phân loại là tập con Okabe-Ito ánh xạ vào token ngữ nghĩa, luôn kèm nhãn trực tiếp hoặc hình
  dạng. Tỉ lệ tương phản trong báo cáo (xanh dương 5,2:1, đỏ son 3,9:1, xanh lục 3,4:1, tím đỏ 3,1:1
  trên nền trắng) chưa được kiểm: đo lại trên nền của cả hai theme trước khi dùng, ngưỡng ≥ 3:1 cho
  nét và vùng.

### 8.3 Chuyển động và SSE

- Chỉ animate `transform` và `opacity`, bằng CSS transition hoặc Web Animations API. Thanh đầy dùng
  `scaleX` với `origin-left`, không đổi `width`. Hàng trong bảng hạng định vị bằng
  `translateY = hạng × chiều cao hàng` cộng transition 300 ms, không cần FLIP.
- Mọi chuyển động nằm trong `motion-safe:`; trong JS, khi `useMediaQuery` (đã có ở `app/lib`) báo
  `prefers-reduced-motion: reduce` thì nhảy thẳng tới trạng thái cuối.
- Sự kiện SSE được đẩy vào một mảng và gộp bằng một `requestAnimationFrame` thành một lần `setState`
  mỗi khung; `run.finished` và `run.failed` xả ngay. Tab ẩn thì rAF dừng: hàng đợi vẫn được xả khi
  `run.finished` tới hoặc khi tab hiện lại. Đây là cùng kỷ luật "không có state React theo frame"
  của `/play` (§2).
- Vòng rAF chỉ chạy khi có hoạt cảnh và tự dừng khi xong, như `frameloop="demand"`. Không vòng lặp idle.

### 8.4 Tem nguồn và trung thực số liệu

- **Mọi trực quan mang một tem nguồn** bằng chữ. Danh sách tem là cố định; tài liệu và UI dùng đúng chữ này,
  không tự đặt tem mới:

  | Tem | Dùng khi | Ở đâu |
  |---|---|---|
  | "Đo từ lượt của bạn" | số liệu từ fact của lượt người chơi vừa chạy | trên hình |
  | "Đo từ nhãn của bạn" | số đếm từ nhãn người chơi vừa gắn trên dữ liệu ghi sẵn, không từ lượt chạy (Phòng chấm; thêm 2026-10-08) | trên hình |
  | "Tính sẵn từ chỉ mục" | tính lúc build từ chỉ mục hoặc vector tính sẵn (N21) | trên hình |
  | "Minh hoạ" | soạn tay hoặc lấy từ model khác, không phải hành vi của engine | trên hình |
  | "Lượt chạy đã ghi" | phát lại một lượt chạy thật đã ghi (N4, kết quả đã lưu). Lượt đã ghi không phải của cấu hình đang trên bàn thợ (Thư viện L2, L3) thì cạnh tem có dòng mô tả nói là của ai, ví dụ "Lời giải mẫu L1, không phải cấu hình của bạn" (sửa 2026-10-08, rà soát vòng 5) | trên hình hoặc màn phát lại |
  | "Mô phỏng" | level loại `simulation`, số đến từ mô phỏng có seed | tiêu đề level; và trên hình, màn phát lại của chính level đó (sửa 2026-10-08), vì ở đó không số nào đo từ lượt chạy thật |
  | "Dữ liệu ghi sẵn" | level loại `precomputed`, trace hoặc output ghi một lần lúc build | tiêu đề level |

- **Có hai số token.** Thùng đếm bằng `regex-v1` (chia đoạn, đóng thùng); sao 2 tính bằng usage của
  Gemini, gồm cả token suy nghĩ ([engine-v0.2](engine-v0.2.md) E2, E3, E8). Mọi thanh token ghi rõ
  đang dùng số nào. Token suy nghĩ dao động mạnh (cùng prompt L3: 74 và 528 token output); cho người
  học thấy điều đó, không làm phẳng.
- **Cosine của `multilingual-e5-large` dồn ở 0,7–1,0**, chỉ thứ tự có nghĩa: thanh trượt ngưỡng phải
  có histogram điểm đi kèm.
- **Bản đồ 2D chỉ gần đúng.** Hạng và "sao sáng" tính bằng cosine 1024 chiều thật; luôn in hạng và
  cosine thật cạnh hình chiếu.
- Không trình bày "lost in the middle" như sự thật của game khi chưa đo trên thùng 3.000 token.
- Engine không gửi temperature: mọi thẻ nói về temperature mang tem "Minh hoạ".
- Kết quả phát lại và kết quả đã lưu không bao giờ vào số liệu độ trễ.
- Tem "Lượt chạy đã ghi" chỉ dành cho cả một lượt đã ghi được phát lại. Một ca trúng kết quả đã lưu giữa
  một lượt chạy thật không đổi tem của lượt: ca đó mang dòng chữ "Kết quả đã lưu" (đúng chữ `summary`
  của engine), là chữ mô tả chứ không phải tem (sửa 2026-10-08, rà soát vòng 3).

### 8.5 CSP đã đo trên site thật

Header của `https://v-game-theta.vercel.app/` và `/play` (đọc bằng `curl -sI`, 2026-10-08), giống
nhau ở hai route:

```text
default-src 'self'; script-src 'self' 'sha256-…' (8 hash, theo từng bản build); style-src 'self';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

Không có `worker-src`, `'unsafe-eval'`, `'wasm-unsafe-eval'` hay `'unsafe-inline'`. Hành vi đo bằng mã
chạy trong trang trên Chrome 152 (2026-10-08), ghi kèm chỉ thị bị vi phạm:

| Cách làm | Kết quả | Chỉ thị |
|---|---|---|
| `el.setAttribute('style', …)` | chặn | `style-src-attr` |
| `innerHTML` có `style="…"` | chặn | `style-src-attr` |
| `<style>` chèn vào `<head>` hoặc bên trong `<svg>` | chặn | `style-src-elem` |
| CSSOM: `el.style.transform = …`, `el.style.setProperty(…)` | chạy | |
| `el.style.cssText = …` | chạy trên Chrome 152; MDN ghi là bị chặn và chưa kiểm Firefox, Safari, nên không dùng | |
| Thuộc tính trình bày của SVG (`fill="…"`, `width`) | chạy | |
| Web Animations API (`el.animate`) | chạy | |
| `setTimeout("chuỗi")`; `eval` và `new Function` cùng luật | chặn | `script-src` (eval) |
| `WebAssembly.compile` | chặn | `script-src` (wasm-eval) |
| `new Worker(blob:…)` | chặn | `worker-src` (blob) |

Lưu ý khi đo lại: mã chạy từ DevTools console được miễn kiểm `eval`, nên phải đo bằng đường của
trang (ví dụ `setTimeout` với chuỗi). `connect-src 'self'` nghĩa là mọi fetch và SSE đi qua
`/api/*` cùng origin (Vercel chuyển tiếp sang Render), như hiện nay.

**Gói bị loại cho route bàn thợ** (gzip đo bằng esbuild trên đúng các import cần dùng; trần route
120 kB):

| Gói | gzip (kB) | Lý do loại |
|---|---|---|
| `@observablehq/plot` | 88,4 | chèn `<style>` trong SVG, mất style |
| `recharts` | 100,9–104,5 | gần hết trần route |
| `echarts` (modular) | 166,2–188,0 | vượt trần; tooltip dùng `innerHTML` |
| `@xyflow/react` (React Flow) | 58,2 | pipeline 5–15 bước cố định không cần; chế độ Bản vẽ (ADR 0001) nếu làm thì tải lười riêng |
| `motion/react` đầy đủ | 42,3 | `popLayout` chèn `<style>`; `motion/mini` (3,3) chạy được qua WAAPI nếu thật cần API khai báo |
| `lottie-web` đầy đủ / `lottie_light` | 77,1 / 48,0 | bản đầy đủ cần `eval`; cả hai quá nặng cho hoạt cảnh phản hồi |
| Rive, dotLottie | 13,5–61,6 cộng 365–810 kB WASM | cần `'wasm-unsafe-eval'` |
| `elkjs`, `@dagrejs/dagre` | 430,3 / 16,4 | chỉ chạy lúc build (bố cục pipeline tính sẵn) |

Hoạt cảnh nhân vật và khối đạt/trượt làm bằng CSS keyframes trên sprite SVG hoặc PNG, chỉ đổi
`transform` và `opacity`, tốn 0 kB.

### 8.6 Cách ép

| Luật | Ép bằng |
|---|---|
| Trần route bàn thợ, không thư viện biểu đồ | `scripts/check-bundle.mjs` (thêm ngân sách route bàn thợ) |
| `<figure>` có `<figcaption>`, tem nguồn và nút "Xem dạng bảng" | e2e: mọi phần tử `[data-vg-viz]` có đủ ba thứ |
| axe sạch ở 375 và 1280 px | `e2e/a11y.spec.ts` |
| Không `style=` trong HTML prerender | CSP thật: vi phạm hiện trong console của e2e |
| Một live region | e2e đếm `[aria-live]` trên route bàn thợ = 1 |
