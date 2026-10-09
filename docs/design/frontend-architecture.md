# Frontend architecture v0.1

- **Ngày:** 2026-10-07 · **Chủ sở hữu file:** coder.
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
│  │  ├─ store.ts         zustand: nearby, dialog, metLan, sheetInset + `motion` (mutable)
│  │  ├─ hud/             HubTopBar (+ danh sách "Các khu"), InteractHint, LanDialog,
│  │  │                   ScenePoster, SceneBoundary
│  │  └─ scene/           chunk lazy: three + r3f
│  │     ├─ palette.ts    màu manifest + màu phái sinh §2.2, shade §2.3
│  │     ├─ primitives.ts box/cyl/quad/prismX/arcSlab… + part() nướng sáng vào vertex colour
│  │     ├─ campus.ts     builder từng nhóm (§5): terrain, landmark, library, watchtower,
│  │     │                market, player, lan, cây
│  │     ├─ useCampusGeometry.ts  memo theo theme/status + dispose; sceneBudget()
│  │     ├─ useHubFrame.ts        vòng frame + input (phím, click/chạm)
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
- **Tương tác:** phím E, nút gợi ý, click/chạm cô Lan, mục "Nói chuyện với cô Lan" đều đi qua
  `onInteract`/`talkToLan` của route.

## 3. Ngân sách và cách ép

| Ngân sách | Thực tế | Ép bằng |
|---|---|---|
| Trang chủ không có three | 0 chunk | `scripts/check-bundle.mjs` (manifest + dò chuỗi `THREE.WebGLRenderer`) và `e2e/landing.spec.ts` (danh sách chunk từ `build/bundle-report.json`) |
| `/play` ≤ 300 kB gzip ¹ | 268,9 kB (sau N8/N9 và QA vòng 2, campus-scene v0.3 §13.4) | `check-bundle.mjs` trong `npm run build`, fail nếu vượt |
| ≤ 40 draw call, ≤ 60k tam giác | 14 (lớp bóng nắng riêng, QA vòng 1 2026-10-08); 20 185 (campus) / 17 108 (town) ban ngày với Thư viện `lit`, đo bằng `sceneBudget()` sau QA vòng 2 (campus-scene v0.3 §13.4) | `scene.test.ts` (fail nếu > 16 hoặc > 23 000) |
| `frameloop="demand"` | không frame khi đứng yên | `e2e/play.spec.ts` với `?debug=frames` |
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
`campus.lights` với hai preset ngày và hoàng hôn; theme.css có `--vg-scene-sky`,
`--vg-scene-dusk`, font) và một dòng trong `public/themes/index.json`. Không sửa code;
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
