# Art direction v0.1: campus hub `/play` và trang khu `/play/:zoneId`

- **Ngày:** 2026-10-07 · **Chủ sở hữu file:** art. Agent khác chỉ đọc.
- **Ràng buộc:** [build-brief-v0.1.md](build-brief-v0.1.md) (D5, D8, D9, §4 lời thoại, §5 ngân sách), `CLAUDE.md`, ADR 0002.
- **Phạm vi:** cảnh 3D của `/play`, lớp HUD/DOM đè lên cảnh, trang `/play/:zoneId`. Không có engine, bàn thợ, đồ chơi.
- **Đã kiểm chứng bằng blockout:** mọi số trong mục 3–6 đã được dựng thử bằng three 0.186 (bản dựng nháp ở scratchpad, không nằm trong repo) và chụp ở 1280×800, 375×812, cả hai theme. Số draw call và tam giác ở mục 6 là số đo được, không phải ước lượng.
- **Quy ước tên:** "theme campus" là theme pack mặc định lấy cảm hứng từ trường thật (`public/themes/<campus>/`), "theme town" là `public/themes/town/`. Tài liệu này không ghi tên thương hiệu.

---

## 1. Art bible

### 1.1 Tinh thần

Một **sa bàn kiến trúc (maquette)** của khuôn viên đặt trên đế trắng, nhìn isometric. Yên tĩnh, sáng, chính xác như mô hình trưng bày ở sảnh trường, không phải đồ chơi hoạt hình. Công trình trắng, mái mang màu nhận diện, cỏ xanh nhạt, người là tượng nhỏ đơn sắc như tượng người trong mô hình kiến trúc. Giờ trong cảnh là 16:30, trước giờ cô Lan vào ca tối (đồng hồ toà thị chính của theme town chỉ 4:30). Ánh sáng trung tính để màu thương hiệu lên đúng.

Theme campus gợi lại khuôn viên tham chiếu bằng ba hình dễ nhận ra: toà trung tâm trắng nhiều tầng giật cấp với tháp nhọn và đỉnh vàng, quảng trường đài phun nước hai tầng, hai hàng cột bán nguyệt ôm quảng trường. Mọi thứ còn lại tiết chế.

### 1.2 Nguyên tắc (7)

1. **Maquette, không phải đồ chơi.** Đế trắng, lớp đất dày 0.6, người là tượng đơn sắc (đầu màu `plaza`, không mặt, không da). Không mắt to, không nảy tưng.
2. **Màu thật ở mặt trên.** Mặt hướng lên luôn hiện đúng mã hex của manifest. Bóng đổ chỉ làm tối mặt đứng theo một quy tắc cố định (mục 2.3), nên đổi theme là đổi màu, không đổi ánh sáng.
3. **Một điểm nhấn.** Tháp nhọn của landmark là thứ cao nhất và là thứ duy nhất có kim loại vàng ở đỉnh. Trong các khu, chỉ khu đang mở có cửa sổ sáng ấm, nên mắt tự đi về Thư viện.
4. **Hình nói trạng thái, không chỉ màu.** Mở: cửa sổ sáng, màu đầy đủ. Sắp mở: giảm bão hoà **và** có giàn giáo gỗ (tín hiệu không dựa vào màu). Tương tác được: vòng sáng dưới đất và huy hiệu "!" ở DOM.
5. **Chữ ở DOM, hình ở 3D.** Không có chữ nào dựng trong WebGL. Nhãn công trình, "!", lời thoại, thẻ khu đều là DOM dùng token Tailwind.
6. **Đứng yên là im lặng.** Không vòng lặp idle. Mọi chuyển động trả lời một thao tác và tự dừng (mục 7). Không ai làm gì thì không có khung hình mới.
7. **Chỉ dựng phần camera thấy.** Camera không xoay (azimuth cố định), nên cửa sổ, cửa, giàn giáo chỉ dựng trên mặt `+x` và `+z`. Mặt `−x`, `−z` để trơn.

### 1.3 Danh sách chống "AI slop" (cấm)

- Bầu trời gradient, sương mù màu, bloom, glow, lens flare, depth of field, viền toon, hạt bụi lấp lánh, mây trôi.
- Đảo nổi có rễ và đá treo bên dưới. Đế của ta là tấm đế mô hình phẳng, cạnh vuông.
- Bảng màu ngoài manifest: không tím, không neon, không cầu vồng. Không tự pha màu bằng mắt; mọi màu phái sinh có công thức ở mục 2.2.
- Nhân vật chibi, mắt to, nảy theo nhịp, NPC nhún liên tục.
- Panel kính mờ (`backdrop-filter`), bóng đổ dày dưới panel, nút gradient, emoji làm icon, viên thuốc pastel quanh metadata tĩnh.
- Chữ 3D, biển hiệu 3D, mũi tên khổng lồ lơ lửng.
- Hiệu ứng vào cảnh kiểu bay camera vòng quanh. Cảnh hiện ngay ở góc cố định.

### 1.4 Theme town khác gì (cùng một đường code)

| Hạng mục | Theme campus | Theme town |
|---|---|---|
| Landmark | `archetype: "spire-hall"`: toà giật 3 cấp, trống bát giác, tháp kim, đỉnh vàng | `archetype: "clock-tower"`: toà thị chính mái hông xanh, tháp đồng hồ chỉ 4:30 |
| Hàng cột quanh quảng trường | Có (`colonnades: true`) | Không; thay bằng 4 cột đèn ở đầu mút hai cung |
| Bảng màu | xanh `#134d8b`, đỏ `#c72127`, trắng ngà | xanh mòng két `#1d6b62`, cam đất `#b85f12`, kem ấm |
| Font và bo góc HUD | font, `--vg-radius-sm/md` của theme campus (4/8 px) | Be Vietnam Pro, 6/12 px |
| Bầu trời | `--vg-scene-sky` = `#dfeaf5` | `--vg-scene-sky` = `#e3efec` |

Mọi builder (địa hình, đài phun, 3 khu, cây, người, vòng tương tác) dùng chung code; chỉ màu và hai nhánh `archetype`/`colonnades` khác nhau.

---

## 2. Màu

### 2.1 Bề mặt → khoá manifest

Ký hiệu khoá dùng trong toàn bộ mục 5: `lm.*` = `campus.landmark.*`, `lib.*` / `wt.*` / `mk.*` = `campus.buildings.library|watchtower|market.*`. Khoá có dấu `~` là màu phái sinh (mục 2.2). `{top: A, side: B}` nghĩa là mặt có pháp tuyến `n.y > 0.5` dùng A, còn lại dùng B.

| Bề mặt | Khoá |
|---|---|
| Mặt cỏ của đế đất | `ground` |
| Cạnh đứng của đế đất | `~soil` |
| Tấm đế trắng dưới cùng | `plaza` |
| Đường, sân trước Thư viện | `path` |
| Quảng trường | `plaza`; vòng lát đá `lm.trim` |
| Đài phun (đá) / nước / gợn sáng / quả cầu đỉnh | `lm.wall` / `water` / `~waterHi` / `lm.accent` |
| Hàng cột: thân, dầm cong / đế, mũ cột, gờ, bệ cong | `lm.wall` / `lm.trim` |
| Landmark: tường / gờ, bệ / mái, kim tháp / đỉnh | `lm.wall` / `lm.trim` / `lm.roof` / `lm.accent` |
| Thư viện, Tháp canh, Chợ model: tường / gờ, bệ / mái | `<site>.wall` / `<site>.trim` / `<site>.roof` |
| Đầu hồi tam giác của mái hai dốc | `<site>.wall` (qua quy tắc `{top, side}`) |
| Cửa sổ khu chưa mở, cửa sổ landmark | `~glass` |
| Cửa sổ, cửa, ô tròn khu đang mở; chụp đèn | `~lit` (cờ E) |
| Gáy sách trong cửa sổ Thư viện | lần lượt `lib.roof`, `lm.accent`, `mk.roof`, `wt.roof`, `lib.trim` |
| Giàn giáo, quầy chợ | `trunk` |
| Thân cây / tán tròn / tán bách | `trunk` / `foliage` / `~cypress` |
| Vệt tiếp đất dưới cây | `~contact` |
| Viền tối quanh chân công trình | `~skirt` → `ground` |
| Cột đèn, tóc, kính, kim đồng hồ | `~dark` |
| Người chơi: áo / quần, ba lô / đầu | `player` / `~pants` / `plaza` |
| Cô Lan: áo len / váy / sách / đầu / tóc, búi, kính | `npc` / `~lanSkirt` / `lib.roof` / `plaza` / `~dark` |
| Bóng người chơi khi bị che (x-ray) | `~xray` |
| Vòng tương tác | `player` |
| Hàng hoá trên quầy chợ (3 khối S/M/L) | `player`, `npc`, `lm.accent` |
| Mặt đồng hồ / viền | `plaza` (E) / `lm.accent` |

### 2.2 Màu phái sinh (không thêm trường manifest)

Mọi phép tính làm trên `THREE.Color` trong không gian **linear** (`new Color(hex)` tự đổi sRGB → linear): `mul(c,k)` = `c.clone().multiplyScalar(k)`, `lerpW(c,t)` = `c.clone().lerp(white,t)`. Hex dưới đây là kết quả đổi ngược về sRGB, để QA so (sai số ±1).

| Khoá | Công thức | Campus | Town |
|---|---|---|---|
| `~soil` | `mul(ground, 0.45)` | `#81966f` | `#8b9a7a` |
| `~skirt` | `mul(ground, 0.70)` | `#9eb788` | `#aabc96` |
| `~contact` | `mul(ground, 0.80)` | `#a7c391` | `#b5c79f` |
| `~glass` | `mul(water, 0.45)` | `#6288a1` | `#6c9097` |
| `~lit` | `lerpW(lm.accent, 0.20)` | `#d5b985` | `#c9937d` |
| `~waterHi` | `lerpW(water, 0.35)` | `#c0daef` | `#c6e1e7` |
| `~dark` | `mul(trunk, 0.35)` | `#4a3522` | `#4e3924` |
| `~lanSkirt` | `mul(npc, 0.45)` | `#915f12` | `#804009` |
| `~pants` | `mul(player, 0.45)` | `#0a3360` | `#114942` |
| `~xray` | `lerpW(player, 0.45)` | `#b3baca` | `#b4c1be` |
| `~cypress` | `mul(foliage, 0.82)` | `#48833e` | `#548d4a` |

**Trạng thái "Sắp mở"** (áp cho mọi màu của nhóm khu đó, trước khi tô bóng):
`desat(c) = mul(c.lerp(gray(Y), 0.70), 0.97)`, với `Y = 0.2126 r + 0.7152 g + 0.0722 b` (linear). Kết quả mẫu: mái Tháp canh `#222936` / `#283032`, mái Chợ `#8b5758` / `#8d6f64`, giàn giáo `#685d56` / `#6d635b` (campus / town).

### 2.3 Tô bóng nướng sẵn vào vertex colour (cố định)

Hình tĩnh dùng `MeshBasicMaterial({ vertexColors: true })`; ánh sáng được nướng vào màu đỉnh theo pháp tuyến **của từng mặt** (geometry non-indexed, `computeVertexNormals()` cho pháp tuyến phẳng):

```ts
const L = new Vector3(-0.35, 1, 0.75).normalize(); // (-0.2696, 0.7704, 0.5778), hướng tới mặt trời
const shade = (n: Vector3) =>
  Math.min(1, 0.466 + 0.268 * (0.5 + 0.5 * n.y) + 0.346 * Math.max(0, n.dot(L)));
```

| Mặt | Pháp tuyến | Hệ số (linear) | Tường trắng campus `#f7f6f2` thành |
|---|---|---|---|
| Trên | `+y` | 1.00 | `#f7f6f2` |
| Trái màn hình | `+z` | 0.80 | `#e0dfdb` |
| Phải màn hình | `+x` | 0.60 | `#c5c4c1` |
| Dưới | `−y` | 0.466 | (không thấy) |

Mặt nghiêng (mái, nón, cầu) tự nhận giá trị trung gian từ cùng công thức. Unit test: `shade(+y)=1.000`, `shade(+z)=0.800`, `shade(+x)=0.600` (±0.002).

**Màu cuối của một đỉnh** = `màuKhoá × shade(n) × ao`, trừ phần có cờ **E** (emissive: cửa sổ sáng, chụp đèn, mặt đồng hồ, kim đồng hồ, gáy sách) dùng `shade = 1`, `ao = 1`.

### 2.4 AO giả (không tốn draw call)

1. **AO dọc:** với phần có cờ **AO** ở bảng mục 5, mọi đỉnh của mặt đứng (`|n.y| < 0.5`) nằm ở đáy của phần đó (`y ≤ bbox.min.y + 0.001`) nhân `0.82`; đỉnh trên giữ `1.0`. Nội suy theo chiều cao tạo vệt tối nhẹ dần lên.
2. **Viền chân công trình (skirt):** quanh 4 footprint (`LANDMARK.footprint` và 3 `SITES[*].footprint`), một khung phẳng rộng `0.45` ở `y = 0.006`, 4 hình thang (8 tam giác). Đỉnh trong màu `~skirt`, đỉnh ngoài màu `ground` (hoà vào cỏ). Đường đi nằm trên (`y = 0.012`) nên che skirt ở chỗ giao, chấp nhận.
3. **Vệt tiếp đất dưới cây:** đĩa phẳng `circle(r, 12)` ở `y = 0.006`, màu `~contact`, `r = 0.62·s` (cây tròn) hoặc `0.40·s` (cây bách), `s` là scale của cây đó (mục 5.6). Đục, không trong suốt, nằm trong nhóm địa hình.

### 2.5 Bầu trời, sương mù, trường hợp thêm trường manifest

- **Bầu trời:** một màu phẳng lấy từ biến đã có `--vg-scene-sky` trong cả hai `theme.css` (`#dfeaf5` / `#e3efec`). Canvas trong suốt (`alpha: true`, không đặt `scene.background`); khung chứa canvas tô `bg-scene`. Coder thêm một token vào `app/app.css`: `--color-scene: var(--vg-scene-sky);` trong `@theme inline`, và fallback `--vg-scene-sky: #eef2f5` trong `:root` của `@layer base`. Poster chờ tải dùng cùng token nên không có nháy màu khi canvas hiện.
- **Sương mù:** không. Đế mô hình nổi trên nền trời phẳng; cạnh đế là đường viền rõ ràng.
- **Manifest additions: không có.** Đã cân nhắc `sky`, `signal`, `skin`, `glass` và bỏ cả bốn: trời đã có trong `theme.css`; vòng tương tác dùng `player`, huy hiệu "!" dùng token CSS `accent`; tượng người không có da; kính và đèn phái sinh được. Vì vậy D8 không kích hoạt: coder **không** sửa `schema.ts` hay hai `manifest.json` cho art.

---

## 3. Ánh sáng và vật liệu

| Thứ | Giá trị chính xác |
|---|---|
| Renderer | `<Canvas orthographic flat frameloop="demand" shadows={false} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} dpr={[1, cap]}>`; `flat` = `NoToneMapping` (bắt buộc, nếu không ACES làm lệch màu manifest); output sRGB mặc định |
| `cap` DPR | 2 trên desktop; 1.5 khi `(pointer: coarse)` hoặc chiều rộng < 768; `PerformanceMonitor` hạ về 1 khi FPS tụt (brief §5) |
| `HemisphereLight` | sky `#ffffff`, ground `#d1d1d1`, intensity `2.306` (vị trí mặc định `(0,1,0)`) |
| `DirectionalLight` | màu `#ffffff`, intensity `1.087`, `position = L × 30` (L ở mục 2.3), target gốc toạ độ, `castShadow = false` |
| Shadow map | Không có. Không postprocessing. |
| Hình tĩnh (5 nhóm gộp) | `MeshBasicMaterial({ vertexColors: true })`, ánh sáng nướng sẵn (mục 2.3). Rẻ nhất về fragment trên GPU tích hợp, màu tất định, test được bằng vitest. |
| Người, cây (động hoặc instanced) | `MeshLambertMaterial({ vertexColors: true, flatShading: true })`. Hai đèn trên được hiệu chỉnh để Lambert cho đúng 1.00/0.80/0.60 như hình nướng (đã đo pixel: trắng → 255/231/204). Cây dùng `instanceColor` nhân thêm độ sáng. |
| Bóng blob người chơi | `CircleGeometry(0.36, 20)` nằm ngang, `y = 0.05`, `MeshBasicMaterial({ color: #000000, transparent: true, opacity: 0.18, depthWrite: false })` |
| Bóng blob cô Lan | như trên, bán kính `0.40` |
| Bóng cây | không dùng blob trong suốt; nướng đĩa đục `~contact` vào địa hình (mục 2.4) |
| X-ray người chơi | dùng chung geometry người chơi, `MeshBasicMaterial({ color: ~xray, depthFunc: GreaterDepth, depthWrite: false })`, **đục** (không `transparent`), `renderOrder = 1`; mesh người chơi `renderOrder = 2`. Hiện bóng người chơi phía sau mái Chợ, hàng cây mép nam/đông, mặt sau landmark. |

Thứ tự vẽ: hình tĩnh và cây (`renderOrder 0`) → x-ray (1) → người chơi (2) → blob, vòng (trong suốt, three tự vẽ sau). Vì x-ray đục và vẽ trước người chơi, nó không tự xuyên qua thân người chơi.

---

## 4. Camera

### 4.1 Rig

- Orthographic, isometric thật: elevation `35.264°` (= `atan(1/√2)`), azimuth 45° từ phía `+x,+z`. Hướng nhìn `(−1,−1,−1)/√3`; `camera.position = target + (1,1,1) × 34.641` (khoảng cách 60), `up = (0,1,0)`, `near 0.1`, `far 200`. Khớp `movement.ts`: lên màn hình = thế giới `(−1,−1)`.
- Trục màn hình (đơn vị thế giới): `R = (1,0,−1)/√2` (sang phải), `U = (−1,2,−1)/√6` (lên). Điểm thế giới `p` có toạ độ màn hình `sx = p·R`, `sy = p·U`. Điểm mặt đất ứng với `(sx, sy)`: `x = (sx√2 − sy√6)/2`, `z = (−sx√2 − sy√6)/2`.
- Với R3F orthographic, `zoom` = số pixel CSS cho 1 đơn vị thế giới.
- **Không** xoay camera, **không** pinch/wheel zoom ở v0.1. Canvas có `touch-action: manipulation` (vẫn cho người dùng phóng to trang bằng hai ngón).

### 4.2 Khung nội dung

Hình chiếu của toàn bộ cảnh (đế + cây + tháp) trên màn hình, đo từ blockout, **giống nhau ở hai theme** (đỉnh cao nhất là tán cây ở góc xa, không phải tháp):
`CONTENT = { minX: −18.46, maxX: 18.46, minY: −11.31, maxY: 11.61 }` → `spanX = 36.92`, `spanY = 22.92`.
Coder có thể tính lại từ đỉnh của các nhóm gộp lúc build; test chấp nhận lệch ±0.05.

### 4.3 Công thức zoom và hai chế độ

```
pad = 24
zFit = min((W − 2·pad) / spanX, (H − 2·pad) / spanY)
if zFit ≥ 26:  mode = "overview", zoom = min(zFit, 56)
else:          mode = "follow",   zoom = clamp(min((W − 32) / 11.5, (H − 72) / 8), 28, 40)
```

| Viewport | Chế độ | zoom (px/u) | Người chơi cao (px) |
|---|---|---|---|
| 1920×1080 | overview | 45.0 | 47 |
| 1440×900 | overview | 37.2 | 39 |
| **1280×800** | overview | **32.8** | 34 |
| 1024×768 | overview | 26.4 | 27 |
| 768×1024 | follow | 40 | 41 |
| 812×375 | follow | 37.9 | 39 |
| 390×844 | follow | 31.1 | 32 |
| **375×812** | follow | **29.8** | 31 |
| 360×740 | follow | 28.5 | 30 |

- **Overview:** thấy toàn khuôn viên, camera đứng yên. Tâm nhìn = tâm `CONTENT`. Hai góc trên của màn hình là trời trống, đó là chỗ đặt cụm nút HUD (mục 8).
- **Follow:** khung nhìn khoảng 11.5 đơn vị ngang quanh người chơi. Ở màn dọc, chiều cao nhìn được (≈ 25 đơn vị) lớn hơn `spanY`, nên camera chỉ trượt ngang.

### 4.4 Vùng che (inset) và kẹp biên

- `insetTop` / `insetBottom` (px) là phần màn hình bị HUD đặc che. Overview: 0 / 0 (cụm nút nằm ở góc trời trống). Follow: `insetTop = 72`; `insetBottom = 0`, hoặc bằng chiều cao bottom sheet khi sheet mở.
- Tâm vùng nhìn thấy được dịch: `sy_target = sy_mong_muốn + (insetTop − insetBottom) / (2·zoom)`.
- Kẹp (follow): nửa khung `hw = W/(2·zoom)`, `hh = (H − insetTop − insetBottom)/(2·zoom)`. `sx_target ∈ [minX + hw, maxX − hw]`, `sy ∈ [minY + hh, maxY − hh]`; chiều nào khung lớn hơn nội dung thì đặt bằng tâm nội dung theo chiều đó.

### 4.5 Bám theo (follow mode)

- **Dead-zone:** hình chữ nhật quanh tâm vùng nhìn thấy, nửa rộng `0.12·W`, nửa cao `0.10·(H − insets)`. Người chơi còn trong vùng: camera đứng yên. Ra khỏi vùng: mục tiêu camera bị đẩy đúng phần vượt ra.
- **Ease:** `k = 1 − exp(−10·dt)` cho phần đẩy dead-zone; `k = 1 − exp(−6·dt)` (khoảng 500 ms) khi đổi `insetBottom` lúc mở/đóng sheet. Hết ease khi sai lệch < 0.005 đơn vị thì ngừng `invalidate()`.
- **Giảm chuyển động (`prefers-reduced-motion: reduce`):** gán thẳng (`k = 1`), không ease.
- Lúc vào cảnh, đổi kích thước cửa sổ, hoặc chuyển overview ↔ follow: đặt camera ngay, không ease. Đổi kích thước tính lại sau 100 ms debounce rồi `invalidate()`.

### 4.6 Hướng ban đầu

- Spawn mặc định `SPAWN (0, 3)`, người chơi quay về phía cô Lan: `yaw = atan2(NPC_SPOT.x − SPAWN.x, NPC_SPOT.z − SPAWN.z) ≈ −1.497`. Gợi ý nhẹ mục tiêu đầu tiên.
- Quay về từ trang khu: đứng tại `door + 0.8 × (hướng ra phía quảng trường)` (Thư viện `(−4.8, 2)`, Tháp canh `(5.6, 2)`, Chợ `(0, 4.5)`), mặt quay ra quảng trường. Cả ba điểm không bị chặn.

---

## 5. Hình procedural chính xác

### 5.0 Quy ước dựng

- Đơn vị: 1 u ≈ 1.2 m ở tỉ lệ người; chiều cao công trình nén còn khoảng 50%, như sa bàn. `y` hướng lên, mặt cỏ `y = 0`. Mọi toạ độ là toạ độ thế giới tuyệt đối, lấy từ `layout.ts` (D9).
- Mỗi phần: tạo primitive → đặt vị trí → `toNonIndexed()` → xoá `uv`, `normal` → `computeVertexNormals()` (pháp tuyến phẳng) → tính màu (mục 2) → xoá `normal` với nhóm Basic → `mergeGeometries` (từ `three/examples/jsm/utils/BufferGeometryUtils.js`, có sẵn trong `three`). Attribute cuối: `position` + `color` (Float32, 3).
- Hàm trợ giúp (tham số theo thứ tự):

| Ký hiệu | Nghĩa |
|---|---|
| `box(x0,x1 │ y0,y1 │ z0,z1)` | `BoxGeometry` theo hai mép mỗi trục |
| `cyl(rTop,rBot,seg │ y0→y1 │ x,z)` | `CylinderGeometry` đứng |
| `cone(r,seg │ y0→y1 │ x,z │ sq)` | `ConeGeometry`; `sq` = `rotateY(π/4)` nên đáy vuông nửa cạnh `r/√2` |
| `ico(r,detail │ x,y,z)` | `IcosahedronGeometry` |
| `circle(r,seg │ x,y,z)`, `ring(rIn,rOut,seg │ x,y,z)` | `CircleGeometry`/`RingGeometry` xoay `rotateX(−π/2)`, nằm ngang hướng lên |
| `rect(x0,x1 │ z0,z1 │ y)` | `PlaneGeometry` nằm ngang |
| `quad(face, plane, u, v, w, h)` | `PlaneGeometry(w,h)` dựng đứng trên mặt `face`, lệch ra ngoài 0.01. `"+z"`: `u` = x, mặt ở `z = plane`. `"+x"`: `rotateY(π/2)`, `u` = z, mặt ở `x = plane`. `v` = tâm theo y |
| `arch(face, plane, u, v, r)` | `CircleGeometry(r, 8, 0, π)` (nửa tròn) cùng cách đặt như `quad` |
| `disc(face, plane, u, v, r, seg)` | `CircleGeometry(r, seg)` cùng cách đặt |
| `prismX(x0,x1 │ z0,z1 │ yBase,yRidge)` | lăng trụ tam giác, nóc chạy theo trục x tại `z = (z0+z1)/2`; 8 tam giác (2 đầu hồi, 2 dốc, đáy), quấn ngược chiều kim đồng hồ nhìn từ ngoài |
| `arcSlab(rIn,rOut,a0,a1 │ y0,y1)` | quạt vành khuyên bám đúng công thức `COLONNADE_COLUMNS`: điểm `(PLAZA.x + sin a·r, PLAZA.z − cos a·r)`, 16 đoạn. Dựng `Shape` với điểm `(x, −z)`, `ExtrudeGeometry({ depth: y1−y0, bevelEnabled: false })`, `rotateX(−π/2)`, `translate(0, y0, 0)` |
| `lathe(profile, seg)` | `LatheGeometry`, profile `(r, y)` theo đúng thứ tự ghi (thứ tự này cho mặt hướng ra ngoài) |

- Cột "Cờ": **AO** = AO dọc (mục 2.4), **E** = emissive (mục 2.3). Cột "Nhóm" xem mục 6.

### 5.1 Đế, đường, quảng trường, đài phun, đèn (nhóm `G-terrain`)

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| T1 | Đế đất | `box(−14.8,14.8 │ −0.6,0 │ −10.8,10.8)` (= `WORLD_BOUNDS` + 0.8) | `{top: ground, side: ~soil}` | |
| T2 | Tấm đế trắng | `box(−15.05,15.05 │ −0.8,−0.6 │ −11.05,11.05)` | `plaza` | |
| T3 | Trục Bắc–Nam (landmark → Chợ) | `rect(−1.0,1.0 │ −5.4,6.1 │ 0.012)` | `path` | |
| T4 | Trục Đông–Tây (cửa Thư viện → cửa Tháp canh, z = door.z = 2) | `rect(−6.3,7.1 │ 1.4,2.6 │ 0.012)` | `path` | |
| T5 | Sân trước Thư viện (chỗ cô Lan đứng) | `rect(−6.3,−4.5 │ 0.0,4.0 │ 0.013)` | `path` | |
| T6 | Quảng trường | `cyl(4.9,4.9,48 │ 0→0.04 │ PLAZA)` | `plaza` | |
| T7 | Vòng lát trong | `ring(2.30,2.45,48 │ PLAZA.x, 0.041, PLAZA.z)` | `lm.trim` | |
| T8 | Vòng lát ngoài | `ring(4.50,4.65,48 │ PLAZA.x, 0.041, PLAZA.z)` | `lm.trim` | |
| T9 | Skirt × 4 | mục 2.4 | `~skirt`→`ground` | |
| T10 | Vệt tiếp đất × 39 | mục 2.4 | `~contact` | |
| F1 | Thành bể + gờ | `lathe([(1.22,0.04),(1.22,0.46),(1.5,0.46),(1.5,0.40),(1.4,0.40),(1.4,0.04),(1.22,0.04)], 32)` tại PLAZA | `lm.wall` | |
| F2 | Mặt nước bể | `circle(1.22,32 │ PLAZA.x, 0.30, PLAZA.z)` | `water` | |
| F3 | Gợn sáng (tĩnh) | `ring(0.70,0.80,32 │ y 0.302)` | `~waterHi` | |
| F4 | Trụ giữa | `cyl(0.26,0.34,12 │ 0.30→1.05 │ PLAZA)` | `lm.wall` | |
| F5 | Bát trên (miệng rộng) | `cyl(0.72,0.32,24 │ 1.05→1.25 │ PLAZA)` | `lm.wall` | |
| F6 | Nước bát trên | `circle(0.62,24 │ y 1.252)` | `water` | |
| F7 | Cuống đỉnh | `cyl(0.08,0.12,8 │ 1.25→1.65 │ PLAZA)` | `lm.wall` | |
| F8 | Quả cầu đỉnh | `ico(0.15,0 │ PLAZA.x, 1.78, PLAZA.z)` | `lm.accent` | |
| L1 | Cột đèn | `cyl(0.05,0.06,6 │ 0→1.9 │ x,z)` | `~dark` | |
| L2 | Chụp đèn | `box(x−0.1,x+0.1 │ 1.9,2.12 │ z−0.1,z+0.1)` | `~lit` | E |
| L3 | Nắp đèn | `cone(0.17,4 │ 2.12→2.24 │ x,z │ sq)` | `~dark` | |

Vị trí đèn: cả hai theme `(−5.0, 1.0)`, `(5.8, 1.0)`, `(−1.35, 5.4)`, `(1.35, 5.4)`. Khi `colonnades = false` (town) thêm 4 đèn tại `COLONNADE_COLUMNS[0]`, `[5]`, `[6]`, `[11]` (đầu mút hai cung). Đèn mảnh, không là vật cản.

Không có gợn nước động: gợn tĩnh F3 thay thế, 0 draw call.

### 5.2 Hàng cột (theme campus, `lm.colonnades = true`; nhóm `G-landmark`)

Với mỗi điểm `c` trong `COLONNADE_COLUMNS` (12 cột):

| Phần | Hình | Màu |
|---|---|---|
| Đế cột | `box(c.x±0.18 │ 0.10,0.20 │ c.z±0.18)` | `lm.trim` |
| Thân cột | `cyl(0.13,0.15,10 │ 0.20→2.26 │ c.x,c.z)` | `lm.wall` |
| Mũ cột | `box(c.x±0.17 │ 2.26,2.36 │ c.z±0.17)` | `lm.trim` |

Với mỗi bên `s ∈ {−1, +1}` (cùng quy ước góc với `layout.ts`):

| Phần | Hình | Màu |
|---|---|---|
| Bệ cong | `arcSlab(3.90,4.50, s·0.34π, s·0.72π │ 0.04,0.10)` | `lm.trim` |
| Dầm cong (entablature) | `arcSlab(3.98,4.42, s·0.34π, s·0.72π │ 2.36,2.62)` | `lm.wall` |
| Gờ trên | `arcSlab(3.93,4.47, s·0.335π, s·0.725π │ 2.62,2.70)` | `lm.trim` |

Cột không là vật cản. Hàng cột ngoài đời là lối đi có mái, người chơi đi xuyên qua khe cột là hợp lý; đầu dầm phía nam vươn tới `z ≈ 1.8` ở độ cao 2.36, nằm trên đầu người chơi khi đi trục Đông–Tây.

### 5.3 Landmark (nhóm `G-landmark`)

Tâm `LANDMARK.centre (0, −7.2)`, footprint `x ∈ [−3.4, 3.4]`, `z ∈ [−9.2, −5.2]`, mặt chính hướng `+z` (về quảng trường).

**Phần chung hai archetype:**

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| LM1 | Bệ | `box(−3.4,3.4 │ 0,0.30 │ −9.2,−5.5)` | `lm.trim` | AO |
| LM2 | Bậc thềm | `box(−1.3,1.3 │ 0,0.15 │ −5.5,−5.2)` | `lm.trim` | AO |

**`spire-hall` (theme campus), tổng cao 9.82:**

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| S1 | Hai cánh thấp | `box(−3.2,3.2 │ 0.30,2.20 │ −9.05,−6.25)` | `lm.wall` | AO |
| S2 | Gờ cánh | `box(−3.3,3.3 │ 2.20,2.32 │ −9.15,−6.15)` | `lm.trim` | |
| S3 | Khối giữa (nhô 0.3) | `box(−1.4,1.4 │ 0.30,3.10 │ −9.05,−5.95)` | `lm.wall` | AO |
| S4 | 4 cột portico | `cyl(0.11,0.13,8 │ 0.30→2.20 │ x, −5.72)`, `x ∈ {−0.9, −0.3, 0.3, 0.9}` | `lm.wall` | |
| S5 | Dầm portico | `box(−1.4,1.4 │ 2.20,2.38 │ −5.95,−5.5)` | `lm.trim` | |
| S6 | Gờ khối giữa | `box(−1.5,1.5 │ 3.10,3.24 │ −9.15,−5.85)` | `lm.trim` | |
| S7 | Tầng 2 | `box(−1.1,1.1 │ 3.24,4.44 │ −8.5,−6.3)` | `lm.wall` | |
| S8 | Gờ tầng 2 | `box(−1.2,1.2 │ 4.44,4.56 │ −8.6,−6.2)` | `lm.trim` | |
| S9 | Tầng 3 | `box(−0.8,0.8 │ 4.56,5.46 │ −8.2,−6.6)` | `lm.wall` | |
| S10 | Gờ tầng 3 | `box(−0.88,0.88 │ 5.46,5.56 │ −8.28,−6.52)` | `lm.trim` | |
| S11 | Trống bát giác | `cyl(0.55,0.60,8 │ 5.56→6.36 │ 0, −7.4)` | `lm.wall` | |
| S12 | Nắp trống | `cyl(0.64,0.64,8 │ 6.36→6.44 │ 0, −7.4)` | `lm.trim` | |
| S13 | Vòm nhọn | `cone(0.52,8 │ 6.44→7.14 │ 0, −7.4)` | `lm.roof` | |
| S14 | Kim tháp | `cyl(0.035,0.12,6 │ 7.14→9.44 │ 0, −7.4)` | `lm.roof` | |
| S15 | Đỉnh vàng | `ico(0.20,0 │ 0, 9.62, −7.4)` | `lm.accent` | |

Cửa sổ `spire-hall` (37 quad, màu `~glass`, nhịp 0.55–0.6):

| Mặt | Lệnh | Vị trí |
|---|---|---|
| Cánh, mặt trước | `quad("+z", −6.25, x, y, 0.30, 0.50)` | `x ∈ {±1.75, ±2.30, ±2.85}`, `y ∈ {0.95, 1.70}` → 12 |
| Cánh, mặt phải | `quad("+x", 3.2, z, y, 0.30, 0.50)` | `z ∈ {−6.7, −7.3, −7.9, −8.5}`, `y ∈ {0.95, 1.70}` → 8 |
| Khối giữa, trên portico | `quad("+z", −5.95, x, 2.75, 0.30, 0.45)` | `x ∈ {−0.9, −0.3, 0.3, 0.9}` → 4 |
| Khối giữa, mặt phải | `quad("+x", 1.4, z, 2.75, 0.30, 0.45)` | `z ∈ {−6.5, −7.1, −7.7, −8.3}` → 4 |
| Tầng 2 | `quad("+z", −6.3, x, 3.84, 0.28, 0.60)`, `quad("+x", 1.1, z, 3.84, 0.28, 0.60)` | `x ∈ {−0.6, 0, 0.6}`, `z ∈ {−6.8, −7.4, −8.0}` → 6 |
| Tầng 3 | `quad("+z", −6.6, 0, 5.0, 0.36, 0.55)`, `quad("+x", 0.8, −7.4, 5.0, 0.36, 0.55)` | 2 |
| Cửa chính | `quad("+z", −5.95, 0, 0.85, 0.50, 1.10)` | 1 |

**`clock-tower` (theme town), tổng cao 7.32:**

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| C1 | Thân toà | `box(−3.0,3.0 │ 0.30,2.30 │ −9.0,−6.2)` | `lm.wall` | AO |
| C2 | Gờ thân | `box(−3.1,3.1 │ 2.30,2.42 │ −9.1,−6.1)` | `lm.trim` | |
| C3 | Mái hông | `ConeGeometry(1, 1.1, 4).rotateY(π/4).scale(3.1·√2, 1, 1.5·√2)`, đáy ở `y 2.42`, đỉnh `3.52`, tâm `(0, −7.6)` | `lm.roof` | |
| C4 | Thân tháp (nhô 0.6) | `box(−0.7,0.7 │ 0.30,3.90 │ −7.0,−5.6)` | `lm.wall` | AO |
| C5 | Gờ tháp | `box(−0.8,0.8 │ 3.90,4.02 │ −7.1,−5.5)` | `lm.trim` | |
| C6 | Tầng đồng hồ | `box(−0.65,0.65 │ 4.02,5.12 │ −6.95,−5.65)` | `lm.wall` | |
| C7 | Mái tháp | `cone(1.0,4 │ 5.12→6.72 │ 0, −6.3 │ sq)` | `lm.roof` | |
| C8 | Cột cờ + quả cầu | `cyl(0.025,0.025,4 │ 6.72→7.12 │ 0, −6.3)`, `ico(0.12,0 │ 0, 7.2, −6.3)` | `lm.accent` | |
| C9 | Mặt đồng hồ × 2 | `disc("+z", −5.65, 0, 4.57, 0.40, 16)`, `disc("+x", 0.65, −6.3, 4.57, 0.40, 16)` | `plaza` | E |
| C10 | Viền đồng hồ × 2 | `RingGeometry(0.40, 0.48, 16)`, đặt như C9 | `lm.accent` | |
| C11 | Kim × 4 | `PlaneGeometry(w, len)` gốc ở tâm, lệch 0.02 khỏi mặt: kim phút `0.04 × 0.32` chỉ số 6, kim giờ `0.05 × 0.22` chỉ giữa 4 và 5 (góc 135° theo chiều kim đồng hồ từ 12) | `~dark` | E |

Cửa sổ `clock-tower` (25 quad, `~glass`): thân trước `quad("+z", −6.2, x, y, 0.32, 0.50)` với `x ∈ {±1.3, ±1.9, ±2.5}`, `y ∈ {0.95, 1.75}` (12); thân phải `quad("+x", 3.0, z, y, 0.32, 0.50)` với `z ∈ {−6.6, −7.2, −7.8, −8.4}` (8); tháp trước: cửa `quad("+z", −5.6, 0, 0.85, 0.50, 1.10)`, cửa sổ `(0, 2.3, 0.30×0.60)` và `(0, 3.3, 0.30×0.50)` (3); tháp phải `quad("+x", 0.7, −6.3, …)` tại `y 2.3` và `3.3` (2).

### 5.4 Thư viện (khu mở; nhóm `G-library`)

Footprint `x ∈ [−10.8, −6.2]`, `z ∈ [0.3, 3.7]`, mặt chính `+x` (`facing = π/2`), cửa `(−5.6, 2)`. Đọc ra "thư viện" từ xa nhờ ba thứ: **mặt tiền đền cổ điển** (4 cột + đầu hồi tam giác có ô cửa tròn), **cửa sổ vòm cao** sáng ấm, **gáy sách nhiều màu** sau cửa sổ như kệ sách nhìn qua kính. Mái mang màu `lib.roof` (xanh thương hiệu ở campus), mái màu đậm duy nhất phía tây quảng trường.

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| B1 | Bệ | `box(−10.8,−6.2 │ 0,0.25 │ 0.3,3.7)` | `lib.trim` | AO |
| B2 | Sảnh | `box(−10.6,−7.0 │ 0.25,2.55 │ 0.5,3.5)` | `lib.wall` | AO |
| B3 | 4 cột portico | `cyl(0.10,0.12,8 │ 0.25→2.55 │ −6.55, z)`, `z ∈ {1.1, 1.7, 2.3, 2.9}` | `lib.wall` | |
| B4 | Dầm (phủ sảnh và portico) | `box(−10.7,−6.3 │ 2.55,2.75 │ 0.4,3.6)` | `lib.trim` | |
| B5 | Mái hai dốc | `prismX(−10.75,−6.25 │ 0.35,3.65 │ 2.75,3.50)` | `{top: lib.roof, side: lib.wall}` (đầu hồi trắng) | |
| B6 | Ô cửa tròn đầu hồi | `disc("+x", −6.25, 2.0, 3.0, 0.20, 12)` | `~lit` | E |
| B7 | Cửa | `quad("+x", −7.0, 2.0, 0.95, 0.70, 1.40)` | `~lit` | E |
| B8 | 4 cửa sổ vòm (mặt nam) | `quad("+z", 3.5, x, 1.325, 0.44, 1.35)` + `arch("+z", 3.5, x, 2.0, 0.22)`, `x ∈ {−10.0, −9.2, −8.4, −7.6}` | `~lit` | E |
| B9 | Gáy sách, 2 tầng × 5 gáy mỗi cửa sổ | `PlaneGeometry(0.07, h)` ở `z = 3.512`, gáy thứ `k` (0–4) tại `x − 0.164 + 0.082k`; tầng dưới đáy `y 0.75`, `h = [0.55, 0.48, 0.60, 0.50, 0.56]`; tầng trên đáy `y 1.42`, `h = [0.45, 0.50, 0.42, 0.52, 0.47]` | màu gáy `k` (tầng `row`) = danh sách mục 2.1, vị trí `(k + 2·row) mod 5` | E |
| B10 | Thanh kệ | `PlaneGeometry(0.44, 0.03)` tại `(x, 1.39, 3.513)` | `lib.trim` | E |

Khi Thư viện ở trạng thái khác "open" (dự phòng, xem mục 6.3): B6–B8 đổi sang `~glass` không cờ E, bỏ B9–B10, áp `desat`, thêm giàn giáo như Tháp canh.

### 5.5 Tháp canh (Sắp mở; nhóm `G-watchtower`)

Footprint `x ∈ [7.0, 10.0]`, `z ∈ [0.5, 3.5]`, cửa `(6.4, 2)` ở phía tây (bị chính toà che khỏi camera). Thân tháp **lùi về góc đông bắc** của footprint (tâm `(8.8, 1.7)`) để người chơi đứng ở cửa không bị khối cao che (đã kiểm tra trên blockout); phần còn lại của footprint là bệ thấp 0.25.

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| W1 | Bệ | `box(7.0,10.0 │ 0,0.25 │ 0.5,3.5)` | `wt.trim` | AO |
| W2 | Thân tháp | `box(7.8,9.8 │ 0.25,3.85 │ 0.7,2.7)` | `wt.wall` | AO |
| W3 | Sàn quan sát | `box(7.6,10.0 │ 3.85,4.05 │ 0.5,2.9)` | `wt.trim` | |
| W4 | 8 lỗ châu mai | `box(cx±0.17 │ 4.05,4.39 │ cz±0.17)`, `cx = 8.8 + dx`, `cz = 1.7 + dz`, `dx, dz ∈ {−1.03, 0, 1.03}` trừ `(0,0)` | `wt.wall` | |
| W5 | Phòng kính | `box(8.2,9.4 │ 4.05,4.95 │ 1.1,2.3)` | `~glass` (mở: `~lit`, E) | |
| W6 | Mái chóp | `cone(1.06,4 │ 4.95→5.85 │ 8.8, 1.7 │ sq)` | `wt.roof` | |
| W7 | Cột anten + đèn hiệu | `cyl(0.03,0.03,4 │ 5.85→6.40 │ 8.8, 1.7)` (`wt.trim`), `ico(0.10,0 │ 8.8, 6.48, 1.7)` (`lm.accent`) | | |
| W8 | 4 khe bắn | `quad("+z", 2.7, 8.8, y, 0.14, 0.60)`, `quad("+x", 9.8, 1.7, y, 0.14, 0.60)`, `y ∈ {1.4, 2.6}` | `~glass` | |
| W9 | Giàn giáo (chỉ khi Sắp mở), mặt nam | 3 cột `box(x±0.035 │ 0.25,3.55 │ 2.915,2.985)`, `x ∈ {7.85, 8.8, 9.75}`; 2 ván `box(7.75,9.85 │ y,y+0.06 │ 2.73,3.03)`, `y ∈ {1.35, 2.55}` | `trunk` | |

Tổng cao 6.58, thứ hai sau landmark.

### 5.6 Chợ model (Sắp mở; nhóm `G-market`)

Footprint `x ∈ [−2.7, 2.7]`, `z ∈ [6.0, 9.2]`, cửa `(0, 5.3)` phía bắc. Làm **nhà chợ mở bốn phía** (cột + mái hai dốc + quầy) để mọi phía đọc giống nhau, vì camera chỉ thấy mặt nam và đông. Ba khối hàng S/M/L trên mỗi quầy là "các cỡ model".

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| M1 | Nền | `box(−2.7,2.7 │ 0,0.20 │ 6.0,9.2)` | `mk.trim` | AO |
| M2 | 8 cột vuông | `box(x±0.09 │ 0.20,2.00 │ z±0.09)`, `x ∈ {−2.45, −0.82, 0.82, 2.45}`, `z ∈ {6.25, 8.95}` | `mk.wall` | |
| M3 | Tấm mái hiên | `box(−2.85,2.85 │ 2.00,2.12 │ 5.9,9.3)` | `mk.trim` | |
| M4 | Mái hai dốc | `prismX(−2.9,2.9 │ 5.85,9.35 │ 2.12,3.10)` | `{top: mk.roof, side: mk.wall}` | |
| M5 | 3 quầy | `box(x±0.6 │ 0.20,0.95 │ 7.3,7.9)`, `x ∈ {−1.6, 0, 1.6}` | `trunk` | |
| M6 | Hàng hoá, mỗi quầy 3 khối | cạnh `s` ∈ {0.18, 0.26, 0.36} tại `x + {−0.35, 0, 0.38}`, đáy `y 0.95`, tâm `z 7.6` | `player`, `npc`, `lm.accent` | |
| M7 | Giàn giáo (chỉ khi Sắp mở), đầu hồi đông | 3 cột `box(2.745,2.815 │ 0,2.90 │ z±0.035)`, `z ∈ {6.3, 7.6, 8.9}`; 2 ván `box(2.73,3.03 │ y,y+0.06 │ 6.2,9.0)`, `y ∈ {1.0, 2.0}` | `trunk` | |

Đứng ở cửa Chợ `(0, 5.3)`, phần thân dưới người chơi bị mái che: x-ray (mục 3) hiện bóng người chơi qua mái. Đã kiểm tra trên blockout.

### 5.7 Cây (instanced; `I-round`, `I-cypress`)

Vị trí: `TREES` sau thay đổi D9 ở mục 6.4 (39 cây). Loại: `|x| ≤ 5.5` → bách (11 cây: hàng sau landmark, hai bên mặt trước landmark, hai bên Chợ, tạo trục đối xứng như khuôn viên tham chiếu); còn lại → tròn (28 cây).

| Loại | Thân | Tán |
|---|---|---|
| Tròn | `cyl(0.09,0.13,6 │ 0→0.75 │ 0,0)`, `trunk` | `ico(0.78,1)` `scale(1, 1.12, 1)` tâm `y 1.45`, `foliage` |
| Bách | `cyl(0.07,0.10,6 │ 0→0.40 │ 0,0)`, `trunk` | `cone(0.42,8 │ 0.30→2.60)`, `~cypress` |

Geometry mỗi loại là một mesh gộp (vertex colour = màu gốc, không nướng bóng vì dùng Lambert). Biến thể tất định theo chỉ số `i` trong `TREES`:

```ts
const hash = (i: number, k: number) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const s = 0.9 + 0.22 * hash(i, 0);               // scale x, z
const sy = s * (0.95 + 0.2 * hash(i, 1));         // scale y
const yaw = 2 * Math.PI * hash(i, 2);             // xoay quanh y
const g = 0.9 + 0.18 * hash(i, 3);                // instanceColor = (g, g, g)
```

`frustumCulled = false` cho hai `InstancedMesh` (luôn trong khung ở overview; tránh lỗi bounding sphere của instance).

### 5.8 Người chơi (`D-player`; Lambert)

Gốc ở chân, mặt hướng `+z` cục bộ (`rotation.y = heading` của `movement.ts`), đặt ở `y = 0.045` để chân không lún vào quảng trường (cao 0.04). Cao 1.27.

| Phần | Hình | Màu |
|---|---|---|
| Chân | `cyl(0.15,0.13,8 │ 0→0.42 │ 0,0)` | `~pants` |
| Thân áo | `cyl(0.19,0.23,8 │ 0.42→0.92 │ 0,0)` | `player` |
| Ba lô (sau lưng, cho biết hướng) | `box(−0.14,0.14 │ 0.54,0.86 │ −0.31,−0.17)` | `~pants` |
| Đầu | `ico(0.17,1 │ 0, 1.10, 0)` | `plaza` |

### 5.9 Cô Lan (`D-lan`; Lambert)

Đứng tại `NPC_SPOT (−5.4, 3.4)` trên sân trước Thư viện, `y = 0.045`, `yaw` mặc định `π/4` (nhìn về camera, thấy cuốn sách). Cao 1.46, cao hơn người chơi. Dáng nhận ra từ xa: **váy loe hình nón + áo len dài + búi tóc + sách ôm trước ngực**.

| Phần | Hình | Màu |
|---|---|---|
| Váy dài loe | `cyl(0.17,0.31,10 │ 0→0.62 │ 0,0)` | `~lanSkirt` |
| Áo len dài | `cyl(0.18,0.24,10 │ 0.56→1.08 │ 0,0)` | `npc` |
| Sách ôm trước ngực | `BoxGeometry(0.26, 0.32, 0.07).rotateX(−0.26)` tâm `(0, 0.86, 0.25)` | `lib.roof` |
| Đầu | `ico(0.16,1 │ 0, 1.24, 0)` | `plaza` |
| Tóc (cầu lệch ra sau, chừa mặt) | `ico(0.17,1 │ 0, 1.28, −0.035)` | `~dark` |
| Búi tóc | `ico(0.085,0 │ 0, 1.37, −0.17)` | `~dark` |
| Kính | `box(−0.11,0.11 │ 1.2275,1.2625 │ 0.135,0.165)` | `~dark` |

### 5.10 Vòng tương tác, "!", nhãn công trình

| Thứ | Spec |
|---|---|
| Vòng tương tác (`D-ring`) | `RingGeometry(0.55, 0.66, 40)` nằm ngang, `y = 0.052`, `MeshBasicMaterial({ color: player })` đục. Đặt tại điểm tương tác gần nhất (`NPC_SPOT` hoặc `site.door`) khi người chơi trong `INTERACT_RADIUS`; ẩn khi không có. |
| Huy hiệu "!" (DOM) | neo thế giới `(NPC_SPOT.x, 1.85, NPC_SPOT.z)`. Hộp `28×28`, `grid size-7 place-items-center rounded-sm bg-accent text-on-brand text-lg font-bold leading-none`. Chỉ hiện khi chưa gặp cô Lan trong phiên. Không nhảy, không nhấp nháy. |
| Nhãn khu (DOM) | neo: Thư viện `(−8.5, 4.1, 2.0)`, Tháp canh `(8.8, 6.95, 1.7)`, Chợ `(0, 3.6, 7.6)`. Chữ: `zone.name` (API; nếu chưa có thì dùng tên trong §4) + `" · "` + `"Đang mở"` (`text-success font-semibold`) hoặc `"Sắp mở"` (`text-fg-muted font-medium`). Hộp `rounded-sm border border-line bg-surface px-2 py-1 text-xs font-semibold text-fg whitespace-nowrap`. Landmark không có nhãn (không tương tác). |
| Lớp DOM thế giới | một `div` `pointer-events-none absolute inset-0 z-10`, `aria-hidden="true"`. Mỗi phần tử đặt bằng `el.style.transform = translate3d(px, py, 0) translate(−50%, −100%)` qua ref (CSSOM, hợp CSP), chỉ cập nhật trong frame đã có render (khi camera đổi). Ở follow mode, ẩn phần tử có neo nằm ngoài màn hình quá 24 px. |

---

## 6. Ngân sách

### 6.1 Draw call và tam giác (đo trên blockout)

| Nhóm | Loại | Vật liệu | Draw call | Tam giác campus | Tam giác town | Dựng lại khi |
|---|---|---|---|---|---|---|
| `G-terrain` | gộp tĩnh, vertex colour | Basic | 1 | 1 790 | 1 966 | đổi theme |
| `G-landmark` (+ hàng cột) | gộp tĩnh | Basic | 1 | 2 018 | 290 | đổi theme |
| `G-library` | gộp tĩnh | Basic | 1 | 314 | 314 | đổi theme hoặc status |
| `G-watchtower` | gộp tĩnh | Basic | 1 | 256 | 256 | đổi theme hoặc status |
| `G-market` | gộp tĩnh | Basic | 1 | 332 | 332 | đổi theme hoặc status |
| `I-round` | instanced × 28 | Lambert | 1 | 2 912 | 2 912 | đổi theme (vertex colour); ma trận giữ nguyên |
| `I-cypress` | instanced × 11 | Lambert | 1 | 440 | 440 | đổi theme |
| `D-player` | động | Lambert | 1 | 156 | 156 | đổi theme |
| `D-xray` | động, chung geometry | Basic (GreaterDepth) | 1 | 156 | 156 | đổi màu vật liệu |
| `D-lan` | động | Lambert | 1 | 284 | 284 | đổi theme |
| `D-blob` × 2 | động | Basic trong suốt | 2 | 40 | 40 | không |
| `D-ring` | động, chỉ khi gần | Basic | 1 | 80 | 80 | đổi màu vật liệu |
| **Tổng** | | | **13** (12 khi không có vòng) | **8 778** | **7 226** | |

Ngân sách brief: ≤ 40 draw call, ≤ 60k tam giác. Thực tế dùng 33% và 15%. Phần dư **không** dùng để thêm chi tiết ở v0.1; nó để dành cho NPC và hiệu ứng hậu quả của các bản sau.

Bộ nhớ đỉnh khoảng 26k đỉnh × 24 byte ≈ 0.63 MB. Số program shader: 4 (Basic + vertexColors, Lambert + vertexColors, Lambert + instancing, Basic màu đơn).

### 6.2 Luật dựng lại và giải phóng

- `useMemo` theo `theme.id` cho `G-terrain`, `G-landmark`, hai geometry cây, người chơi, cô Lan; theo `[theme.id, status]` cho từng nhóm khu. Đổi theme: dựng mới, `dispose()` geometry cũ trong cleanup của effect.
- Vật liệu tạo **một lần** (Basic vertex colour, Lambert vertex colour, blob, x-ray, vòng) và dùng chung. Đổi theme chỉ gán lại `color` cho x-ray và vòng. `dispose()` khi unmount.
- Ma trận instance của cây không phụ thuộc theme, tính một lần.

### 6.3 Trạng thái khu dùng cho hình

`status(site)` = trạng thái từ `GET /api/zones` khi đã có. Trước khi có, hoặc khi API lỗi: `DEFAULT_STATUS = { library: "open", watchtower: "coming_soon", market: "coming_soon" }` (khớp brief §1 và §4), nên trường hợp thường không có hình nhảy khi dữ liệu về. Chỉ dựng lại nhóm khu nào có trạng thái API khác mặc định.

### 6.4 Thay đổi `layout.ts` cần có (theo D9)

1. **Bắt buộc. Bỏ 3 cây khỏi `TREES`** (42 → 39):
   - `(14.3, 9.3)`: nằm ngoài `WORLD_BOUNDS` (`|x| > 14`); tán chìa ra ngoài mép đế.
   - `(−1.3, 9.3)` và `(1.3, 9.3)`: tán cây (bán kính tới 0.86) đâm vào mái hiên và mặt nam của Chợ, đúng mặt mà camera nhìn thấy.
   - Cách làm gợi ý: thêm `.filter((t) => Math.abs(t.x) <= WORLD_BOUNDS.halfX && !(t.z > 9 && Math.abs(t.x) < 2))` sau khi tạo mảng. `OBSTACLES` tự cập nhật. `movement.test.ts` hiện không phụ thuộc số cây. Test mới nên có: mọi cây có tâm trong `WORLD_BOUNDS`, và đĩa bán kính 0.9 quanh cây không giao footprint của 3 khu.
2. **Khuyến nghị (coder quyết):** thêm cô Lan vào `OBSTACLES` (`{ x: −5.4, z: 3.4, halfX: 0.3, halfZ: 0.3 }`) để người chơi không đi xuyên qua cô. Khi đó click vào cô Lan nên đặt đích đi bộ tại `(−4.7, 3.0)` (cách cô 0.81, trong `INTERACT_RADIUS`, không bị chặn).

Không dời công trình, cửa, cột hay `NPC_SPOT`.

---

## 7. Chuyển động

Mọi chuyển động gắn với di chuyển hoặc có thời hạn. Hết chuyển động thì ngừng `invalidate()`, không còn khung hình mới.

| Chuyển động | Khi nào | Công thức / thời lượng | `prefers-reduced-motion: reduce` |
|---|---|---|---|
| Nhún khi đi | chỉ khi `moving` | `bobY = 0.035 · |sin(π · d / 0.5)|`, `d` = quãng đường đã đi; dừng thì `bobY = 0` ngay | tắt (`bobY = 0`) |
| Xoay người chơi | khi `heading` đổi | `yaw += wrap(target − yaw) · (1 − exp(−dt / 0.06))`, khoảng 180 ms tới 95%; dừng khi `|Δ| < 0.01` | gán thẳng |
| Cô Lan quay nhìn | người chơi vào bán kính 3.0 quanh `NPC_SPOT`; rời > 3.4 thì quay về `π/4` | cùng công thức, `τ = 0.12 s` | gán thẳng |
| Vòng tương tác hiện | khi đổi đích tương tác | scale 0.85 → 1.0 trong 180 ms (ease-out cubic), rồi 2 nhịp 1.0 → 1.1 → 1.0, mỗi nhịp 700 ms (sine in-out); tổng ≤ 1.6 s rồi đứng yên | hiện ngay ở scale 1, không nhịp |
| Camera bám | follow mode, mục 4.5 | `1 − exp(−10·dt)`; đổi inset `1 − exp(−6·dt)` | gán thẳng |
| HUD: gợi ý, sheet, panel | mở/đóng | vào: opacity 0→1 + `translateY(8px → 0)`, 200 ms ease-out; ra: opacity, 120 ms | luật toàn cục trong `app.css` đã rút về 0.01 ms |
| Poster chờ tải | khi chunk chưa về | thanh tiến trình chạy ngang 1.2 s linear lặp | đứng yên (luật toàn cục) |

**Vòng lặp idle được phép: không có.** Nước, cây, cờ, đèn đều tĩnh. Không có NPC thở, không có "!" nhấp nháy.

---

## 8. HUD và lớp phủ (DOM, chỉ token ngữ nghĩa)

### 8.1 Hệ thống

| Hạng mục | Giá trị |
|---|---|
| Font | `font-sans` (font của theme) |
| Thang chữ | 12 (`text-xs`: nhãn, chip), 14 (`text-sm`: nút, gợi ý, tóm tắt), 16 (`text-base`: lời thoại), 18 (`text-lg`: tên khu trong thẻ), 30/36 (`text-3xl sm:text-4xl`: h1 trang khu). Đậm: 400 thân, 600 nút và nhãn, 700 tiêu đề |
| Khoảng cách | bội số 4/8: lề ngoài `16` (mobile) / `24` (`lg`), padding panel `16` / `20`, gap `8`, `12`, `16` |
| Bo góc | `rounded-sm` cho nút, chip, nhãn, huy hiệu; `rounded-md` cho panel, sheet, thẻ |
| Độ nổi | viền, không bóng: panel trên cảnh dùng `bg-surface border border-line-strong`; thẻ trong trang dùng `border-line` |
| Nền panel | `bg-surface` đặc. Không trong suốt, không blur. Chữ trên panel đạt ≥ 4.5:1 bất kể cảnh phía sau |
| Lớp phủ modal | `bg-ink/20` (token có alpha), click vào thì đóng |
| Focus | luật toàn cục `:focus-visible` (2 px `brand`, offset 2 px) đã có. `brand` trên trời: 7.0:1 / 5.35:1 |
| Vùng chạm | mọi nút `h-11` (44 px) và `min-w-11`; gợi ý tương tác `h-12`; dòng trong danh sách khu `min-h-12` |
| z-index | canvas `z-0` → nhãn thế giới `z-10` → cụm nút `z-20` → gợi ý, panel `z-30` → lớp phủ + hội thoại `z-40` → danh sách khu `z-50` |

Lưu ý cho coder: `ThemeToggle` hiện `h-10` (40 px) và nền trong suốt. Trên `/play` cần biến thể `h-11 bg-surface border-line-strong`, và dưới 640 px chỉ hiện icon (tên theme vẫn có trong `sr-only`).

### 8.2 Bố cục 1280×800 (overview)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [‹ Về trang chủ]                                      [Các khu ▾] [◐ Theme] │  ← top-6, nằm trên vùng trời trống
│                                                                            │
│                        (sa bàn, zoom 32.8, đứng yên)        ┌────────────┐ │
│                                                             │ Hội thoại  │ │  ← chỉ khi nói chuyện:
│                                                             │ + thẻ khu  │ │    right-6 top-20 w-96
│                                                             └────────────┘ │
│                 ┌──────────────────────────────────────┐                   │
│                 │ [E] Nhấn E hoặc chạm để nói chuyện…  │                   │  ← bottom-6, giữa
│                 └──────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Bố cục 375×812 (follow)

```
┌───────────────────────────────┐
│ [‹]            [Các khu] [◐]  │  ← top-4, h-11; insetTop = 72
│                               │
│     (cảnh bám người chơi,     │
│      zoom 29.8)               │
│                               │
│ ┌───────────────────────────┐ │
│ │ Nhấn E hoặc chạm để nói   │ │  ← bottom-4, inset-x-4, min-h-12, xuống dòng được
│ │ chuyện với cô Lan         │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
Khi nói chuyện: bottom sheet thay chỗ gợi ý; insetBottom = chiều cao sheet; camera dời để cô Lan nằm giữa phần còn thấy.
```

### 8.4 Thành phần

**Cụm nút trên.** Trái: link về `/`, `buttonClass("secondary")` + icon chevron SVG; từ `sm` trở lên có chữ, dưới `sm` chỉ icon `size-11` với `aria-label`. Phải: nút mở danh sách khu (`secondary`, `aria-expanded`, `aria-controls`) và `ThemeToggle`. Vị trí `absolute top-4 left-4 / right-4`, `lg:top-6 lg:left-6 lg:right-6`.

**Gợi ý tương tác** (khi `nearestWithin` trả về đích):
- Khu mở và cô Lan: là `<button>`, `fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 lg:bottom-6`, `min-h-12 max-w-xl rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-fg inline-flex items-center gap-3`. Bên trái có `<kbd>` "E": `inline-grid size-7 place-items-center rounded-sm border border-line-strong bg-subtle text-xs font-bold`, ẩn khi `(pointer: coarse)`. Bấm/chạm = nhấn E.
- Khu Sắp mở: cùng vị trí và hộp nhưng là `<p>`, chữ `text-fg-muted font-medium`, không có kbd, không bấm được.
- Chữ đúng nguyên văn §4.

**Hội thoại** (`role="dialog" aria-modal="true" aria-labelledby` → tên người nói):
- Vỏ: `lg` trở lên là panel `fixed right-6 top-20 w-96 max-h-[calc(100dvh-104px)] overflow-y-auto rounded-md border border-line-strong bg-surface p-5`; dưới `lg` là bottom sheet `fixed inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-md border-t border-line-strong bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]`. Có lớp phủ `bg-ink/20`; phần còn lại của trang đặt `inert`.
- Đầu: "Cô Lan" (`text-base font-bold`), dòng phụ "Thủ thư ca tối" (`text-sm text-fg-muted`).
- Lời: 2 câu §4 (lần đầu) hoặc 1 câu (lần sau), mỗi câu một `<p>`, `mt-3 space-y-3 text-base leading-relaxed text-fg`, hiện ngay cả câu, không gõ từng chữ.
- Nút: `mt-5 flex flex-col gap-2 sm:flex-row`. Thứ tự DOM = thứ tự nhìn: "Vào Thư viện" (`primary`) rồi "Để sau" (`secondary`). Mobile full-width.
- Dưới nút: `mt-5 border-t border-line pt-5` + thẻ khu Thư viện (biến thể không viền).
- Focus: mở thì vào "Vào Thư viện"; bẫy focus; Esc hoặc click lớp phủ = "Để sau"; đóng thì trả focus về phần tử trước đó, nếu không có (mở bằng phím E hoặc click canvas) thì về nút gợi ý nếu còn.

**Thẻ khu** (dữ liệu `GET /api/zones`):
- Dòng tiêu đề: `zone.name` (`text-lg font-bold`) + trạng thái cùng hàng chữ (`text-sm`, "Đang mở" `text-success font-semibold` / "Sắp mở" `text-fg-muted`).
- `zone.summary`: `mt-2 text-sm text-fg-muted`.
- Khái niệm: `ul mt-3 flex flex-wrap gap-2`, mỗi mục `rounded-sm border border-line px-2 py-1 text-xs font-medium text-fg`. Thẻ chữ nhật có viền, không nền pastel, không bo tròn kiểu viên thuốc.
- Số màn: `mt-3 text-sm text-fg-muted`, dạng "3 màn".
- Thanh màu khu 24×4 px phía trên tên: `bg-brand` (library), `bg-ink` (watchtower), `bg-accent` (market). Ánh xạ này trùng màu mái trong manifest của cả hai theme đang có.

**Danh sách khu** (đường đi không cần canvas):
- Panel không modal, `absolute right-4 top-[68px] w-80 lg:right-6 lg:top-[76px]`; dưới `sm`: `fixed inset-x-2 top-[68px] max-h-[calc(100dvh-84px)] overflow-y-auto`. Vỏ `rounded-md border border-line-strong bg-surface`. Mở thì focus vào mục đầu; Esc hoặc click ra ngoài thì đóng và trả focus về nút mở.
- Nội dung `ul divide-y divide-line`:
  1. Mục cô Lan: nút cả dòng "Nói chuyện với cô Lan" (`min-h-12 px-4 text-left text-sm font-semibold hover:bg-subtle`). Đưa người chơi tới `(−4.7, 3.0)` ngay (không đi bộ), rồi mở hội thoại.
  2. Mỗi khu: thẻ khu dạng gọn (`p-4`, không thanh màu); khu mở có nút `primary` "Vào Thư viện"; khu Sắp mở không có nút.
- Đang tải (> 300 ms): 3 dòng khung `h-12 bg-subtle`, không shimmer.
- Lỗi API: thay các dòng khu bằng khối `m-4 rounded-md border border-line bg-warning-tint p-4`: tiêu đề `text-sm font-semibold text-fg`, câu giải thích `text-sm text-fg-muted`, nút `secondary` "Thử lại". Mục cô Lan vẫn còn. Cảnh vẫn chạy.

**Poster chờ tải chunk 3D:** `absolute inset-0 bg-scene grid place-items-center`, hiện sau 150 ms (tránh nháy). Giữa: chữ `text-sm font-medium text-fg-muted` và thanh `h-1 w-40 rounded-sm bg-line` có lõi `bg-brand w-1/3` chạy ngang. Không dùng ảnh hero (lệch phong cách, tốn byte). Cụm nút trên và danh sách khu render **ngoài** ranh giới lazy nên dùng được ngay.

**Lỗi API trên hub:** không chặn cảnh. Nhãn khu dùng tên §4, trạng thái theo `DEFAULT_STATUS`. Lỗi chỉ hiện trong danh sách khu và trong thẻ khu của hội thoại (cùng khối lỗi như trên).

### 8.5 Độ tương phản đã đo

| Cặp | Campus | Town |
|---|---|---|
| `text-fg` trên `bg-surface`, trên trời | ≥ 11.1 | ≥ 12.5 |
| `text-fg-muted` trên `bg-surface` | 6.05 | 6.37 |
| `text-success` trên `bg-surface` | 7.43 | 6.60 |
| `text-on-brand` trên `bg-brand` | 8.53 | 6.30 |
| `text-on-brand` trên `bg-accent` (huy hiệu "!", là hình, cần ≥ 3) | 5.71 | 4.48 |
| `text-fg` trên `bg-warning-tint` | 12.83 | 13.39 |
| `text-ink` trên `bg-accent-tint` (huy hiệu Sự cố) | 11.70 | 11.30 |
| `text-accent` trên `bg-accent-tint` | 4.63 | **3.81 (không đạt chữ nhỏ)** |
| `text-accent` trên `bg-surface` | 5.71 | **4.48 (thiếu 0.02)** |

Vì hai dòng cuối, huy hiệu Sự cố dùng **chữ `text-ink`** trên `bg-accent-tint`, chỉ icon mang màu `accent`.

### 8.6 Chuỗi chưa có trong §4 (đề xuất, leader chốt)

| Chỗ dùng | Chuỗi đề xuất | Nguồn |
|---|---|---|
| Nút về trang chủ | "Về trang chủ" | mới |
| Nút mở danh sách khu, tiêu đề danh sách | "Các khu" | mới |
| Mục cô Lan trong danh sách | "Nói chuyện với cô Lan" | rút từ câu gợi ý §4 |
| Dòng phụ trong hội thoại | "Thủ thư ca tối" | D5 |
| Trạng thái | "Đang mở" / "Sắp mở" | trang chủ đã dùng |
| Số màn | "{n} màn" | trang chủ dùng "màn" |
| Huy hiệu level sự cố | "Sự cố" | trang chủ đã dùng |
| Poster | "Đang tải khuôn viên" | mới |
| Lỗi API (tiêu đề + câu) | "Chưa tải được thông tin các khu." / "Cảnh vẫn dùng được. Kiểm tra kết nối rồi thử lại." | mới; nút "Thử lại" theo brief |
| Trang khu Sắp mở | "Khu này sắp mở" | mới |
| Trang không tìm thấy | "Không tìm thấy khu này" / "Đường dẫn không khớp khu nào trong khuôn viên." | mới |

---

## 9. Trang `/play/:zoneId`

Trang thường, không có canvas. Mẫu trang: **detail** (một khu + danh sách màn).

### 9.1 Khung

- Thanh trên `h-16 border-b border-line bg-surface`, nội dung `mx-auto max-w-3xl px-4 sm:px-6`: trái là link "Về khuôn viên" (`buttonClass("quiet")` + icon chevron trái); phải là `ThemeToggle`.
- `main`: `mx-auto max-w-3xl px-4 py-10 sm:px-6`.

### 9.2 Đầu trang khu

- Thanh màu `h-[5px] w-12` theo ánh xạ khu (mục 8.4), cùng ngôn ngữ với `.section-heading` của trang chủ.
- `h1` `mt-4 text-3xl font-bold tracking-tight sm:text-4xl`: `zone.name`.
- Trạng thái cùng hàng chữ cạnh h1 ở `sm` trở lên, xuống dòng trên mobile (`text-sm`, màu như thẻ khu).
- `p` `mt-3 max-w-prose text-lg text-fg-muted`: `zone.summary`.
- Khái niệm: cùng kiểu chip như thẻ khu, `mt-4`.

### 9.3 Danh sách màn

- `ol mt-10 space-y-4`, đúng thứ tự `order`.
- Mỗi màn là thẻ `rounded-md border border-line bg-surface p-5`, lưới `grid grid-cols-[2rem_1fr] gap-x-4 sm:grid-cols-[2rem_1fr_auto]`:
  - Cột 1: số thứ tự `text-2xl font-bold tabular-nums text-fg-muted`.
  - Cột 2: tiêu đề `text-lg font-semibold`, cạnh đó huy hiệu Sự cố nếu `kind = "incident"`; `brief` `mt-1 text-fg-muted`; khái niệm `mt-3` (chip `text-xs`).
  - Cột 3 (`sm`+) hoặc dòng dưới toàn chiều rộng (mobile, `mt-4 col-span-2`): nút `buttonClass("secondary")` có thuộc tính `disabled`, chữ "Đang xây".
- **Huy hiệu Sự cố:** `inline-flex items-center gap-1 rounded-sm bg-accent-tint px-2 py-0.5 text-xs font-semibold text-ink`, icon tam giác cảnh báo SVG 12 px `text-accent` `aria-hidden`. Không thêm viền trái cho thẻ.
- Cuối danh sách: link "Về khuôn viên" dạng `buttonClass("primary")`, `mt-10`, quay về `/play` và đứng ở cửa khu (mục 4.6).

### 9.4 Các trạng thái khác

| Trạng thái | Hình |
|---|---|
| Đang tải (`HydrateFallback`) | khung tĩnh `bg-subtle rounded-sm`: thanh `h-[5px] w-12`, `h-9 w-56`, hai dòng `h-4` (`w-full`, `w-2/3`), rồi 3 thẻ `h-28 rounded-md`. Không shimmer. |
| Khu Sắp mở | đầu trang như 9.2; thay danh sách bằng khối `mt-10 rounded-md border border-line bg-subtle p-5`: tiêu đề "Khu này sắp mở" `text-lg font-semibold`, rồi các tiêu đề màn dạng `ol` chữ `text-fg-muted` (không brief, không nút); rồi nút `primary` "Về khuôn viên". |
| Không tìm thấy (id lạ hoặc 404) | `h1` "Không tìm thấy khu này", một câu `text-fg-muted`, nút `primary` "Về khuôn viên". Không thanh màu. |
| Lỗi API | khối `rounded-md border border-line bg-warning-tint p-5` như mục 8.4, nút `secondary` "Thử lại" (revalidate) và link `quiet` "Về khuôn viên". |

---

## 10. Checklist QA hình ảnh

Chụp ở **1280×800** và **375×812**, mỗi kích thước cho **cả hai theme**, build production (`serve-build`), `prefers-reduced-motion` tắt rồi bật.

**Hub `/play`, 1280×800:**
- [ ] Thấy trọn đế mô hình (mép đế trắng + lớp đất) trên nền trời phẳng, cách mép màn ≥ 24 px; không gradient, không sương.
- [ ] Landmark ở phía trên bên phải. Campus: 3 tầng giật cấp, trống bát giác, kim tháp, đỉnh vàng, tổng cao gần chạm khung trên. Town: toà mái hông xanh, tháp đồng hồ chỉ 4:30, không có hàng cột, có 4 cột đèn quanh quảng trường.
- [ ] Campus: hai cung cột bán nguyệt ôm quảng trường, mở về phía landmark và phía spawn.
- [ ] Đài phun 2 tầng có nước xanh, gợn sáng tĩnh, quả cầu đỉnh màu accent.
- [ ] Thư viện phía trên bên trái: mái `lib.roof`, mặt tiền 4 cột + đầu hồi trắng có ô tròn sáng, 4 cửa sổ vòm sáng ấm có gáy sách màu.
- [ ] Tháp canh phía dưới bên phải và Chợ phía dưới bên trái: nhạt màu rõ rệt so với Thư viện, mỗi toà có giàn giáo gỗ, cửa sổ không sáng.
- [ ] 39 cây, cây bách chỉ ở dải giữa (`|x| ≤ 5.5`); không cây nào đâm vào Chợ hay chìa ra ngoài mép đế.
- [ ] Mặt trên đúng hex manifest (lấy mẫu pixel cỏ: campus `#b9d7a0`, town `#c8dcb0`); mặt trái/phải tường trắng campus `#e0dfdb` / `#c5c4c1` (±2).
- [ ] Nhãn 3 khu đúng chữ và trạng thái; "!" đỏ (campus) hoặc cam (town) trên đầu cô Lan; cụm nút nằm ở hai góc trời trống, không che công trình.
- [ ] Đứng cạnh cô Lan: vòng tương tác màu `player` dưới chân cô, gợi ý ở giữa đáy đúng chữ §4.
- [ ] Hội thoại mở ở panel phải, cô Lan vẫn thấy được bên trái; có lớp phủ nhẹ; hai nút đúng thứ tự.
- [ ] Đi tới cửa Chợ `(0, 5.3)`: bóng x-ray nhạt của người chơi hiện qua mái.
- [ ] `renderer.info.render.calls ≤ 13`, `triangles ≤ 9 000`; đứng yên 3 s thì bộ đếm frame không tăng.

**Hub `/play`, 375×812:**
- [ ] Follow mode, zoom ≈ 29.8: người chơi cao ≈ 31 px, nằm trong dead-zone giữa màn; không cuộn ngang trang.
- [ ] Cụm nút trên đủ 44 px, ThemeToggle chỉ icon; gợi ý full-width, xuống dòng không tràn.
- [ ] Mở hội thoại: bottom sheet ≤ 70% chiều cao, camera dời để cô Lan nằm giữa phần còn thấy; nút xếp dọc, "Vào Thư viện" ở trên.
- [ ] Danh sách khu mở full-width dưới cụm nút, cuộn được, mọi hành động bấm được bằng bàn phím.
- [ ] Bật reduced motion: không nhún, không nhịp vòng, camera nhảy thẳng, cô Lan quay ngay.

**Trang khu, cả hai kích thước:**
- [ ] `/play/library`: thanh màu `brand`, đúng 3 màn theo thứ tự, màn 3 có huy hiệu Sự cố chữ `ink`, mọi nút "Đang xây" bị disabled; 1280 nút nằm cột phải, 375 nút full-width dưới thẻ.
- [ ] `/play/watchtower` (coming_soon): trang khoá như mục 9.4; `/play/abc`: trang không tìm thấy; API lỗi: khối lỗi + "Thử lại".
- [ ] Không có bóng đổ, gradient, blur, emoji ở bất kỳ màn nào.

---

## 11. Câu hỏi mở và việc cần người khác xử lý

1. **D9:** leader duyệt việc bỏ 3 cây ở mục 6.4 (bắt buộc cho hình). Mục khuyến nghị (cô Lan là vật cản) do coder quyết.
2. **Chuỗi mới** ở mục 8.6 cần leader chốt trước khi coder viết test e2e khớp nguyên văn.
3. **Token `bg-scene`** (mục 2.5) là thay đổi `app.css` duy nhất art yêu cầu; không đổi manifest.
4. **Phát hiện ngoài phạm vi art:** nhãn "Sự cố" `text-accent` trên nền trắng ở trang chủ chỉ đạt 4.48:1 với theme town (dưới 4.5). `ThemeToggle` cao 40 px, dưới mức 44 px của HUD.
5. Gợn nước động, cây lay, NPC idle cố ý để ngoài v0.1. Nếu thêm sau, phải là hiệu ứng trong shader của nhóm đã có (không thêm draw call) và tôn trọng `frameloop="demand"`.
