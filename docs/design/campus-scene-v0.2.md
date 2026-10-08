# Cảnh campus v0.2: dựng theo khuôn viên thật (hub `/play`)

- **Ngày:** 2026-10-07 · **Chủ sở hữu file:** art. Coder đọc và dựng theo, không cần hỏi lại số.
- **Nguồn:** [../research/vinuni-campus-reference.md](../research/vinuni-campus-reference.md) (mặt bằng OSM, tỷ lệ tháp §2.2, hàng cột §2.4, màu §2.6), ảnh tham chiếu trong scratchpad của phiên (không đưa vào repo), [art-direction.md](art-direction.md), [build-brief-v0.1.md](build-brief-v0.1.md) §5.
- **Thay thế:** art-direction §5.1–§5.7, §6.1 và §6.4, §2.1 cho các bề mặt mới. Các mục còn lại của art-direction vẫn giữ nguyên: §1 tinh thần, §2.2–§2.5 công thức màu, §3 ánh sáng, §4 camera, §5.8–§5.10 người và nhãn, §7 chuyển động, §8 HUD.
- **Bị thay một phần bởi [campus-scene-v0.3.md](campus-scene-v0.3.md)** (cổng ba vòm, khuôn viên phía sau): §1 mục 2 và 7, §2.1, các khối `WORLD_BOUNDS`, `ROUND_TREES`, hồ, `LAKE_BLOCKS`, `OBSTACLES` trong §2.2, §2.4, §3, các dòng T1, T2, W1, W2 của §5.1, §5.9, gạch đầu dòng cuối của §6, §7 và câu hỏi về cổng ở §9.
- **Đã kiểm bằng blockout:** script Python dựng lại mọi footprint, vật cản và khối chính trong file này. Script mô phỏng `step()` của `movement.ts` cho mọi cặp điểm tương tác, rồi vẽ isometric ở 1280×800 và 375×812 cho cả hai theme. Script và ảnh nằm ở scratchpad (`v02/blockout.py`), không nằm trong repo. Số tam giác ở §7 là số đếm theo công thức primitive của three.js. Coder đo lại bằng `sceneBudget()`.

---

## 1. Quyết định chính

1. **Trục chính chạy theo trục z của thế giới, như v0.1.** Tháp đặt ở phía sau (`−z`), quảng trường đài phun ở phía trước (`+z`). Trên màn hình, trục này chạy chéo từ dưới-trái lên trên-phải. Tháp đứng ở phía trên bên phải tâm hình, đài phun ở dưới bên trái. Đã cân nhắc xoay cả khuôn viên 45° để nhìn thẳng mặt đứng như ảnh chụp. Phương án đó bị loại vì vật cản sẽ phải là hộp xoay (OBB), trong khi `movement.ts` chỉ hỗ trợ hộp thẳng trục (AABB).
2. **`WORLD_BOUNDS`, `CONTENT` và camera giữ nguyên.** Zoom vẫn là 32.8 ở 1280×800 và 29.8 ở 375×812. `camera.ts` và `camera.test.ts` không đổi. Đỉnh ngôi sao trên tháp chiếu lên màn hình tại `sy = 11.51`, thấp hơn `CONTENT.maxY = 11.61`.
3. **Mặt bằng đọc ra khuôn viên thật.** Từ sau ra trước có: dãy nhà hình chữ U nông (tháp tòa I, hai cánh C/E có 4 chòi tháp, hai tay chữ U ở vị trí tòa D và F) → bậc thềm và sảnh 4 cột → sân trước lát đá có tia khảm tối → thảm cỏ trung tâm, hai lối đi bên có 12 tượng, hai hàng thông tháp → lan can → quảng trường đài phun nhiều tầng, có hai hàng cột cong và lát vòng đồng tâm → hồ ở góc trước-phải, Vườn Hồng ở trước-trái.
4. **Ba khu chơi giữ chức năng, chỉ đổi chỗ và đổi hình.** Thư viện là tay trái chữ U (vị trí tòa D), mang hình tòa A: 2 tầng, hành lang cột, vườn trên mái. Tháp canh là tay phải chữ U (vị trí tòa F), lấy hình chòi tháp của cánh nhà rồi phóng to thành tháp 4 bậc. Chợ model là nhà chợ mở ven hồ. Campus không có chợ, nên đây là công trình thay thế chung.
5. **Không thêm trường manifest, không thêm archetype.** Giữ `spire-hall` / `clock-tower` và `colonnades: boolean`, vì cả ba tên đã trung tính. Hai cánh, chòi tháp, hồ, vườn và tượng là hình dùng chung cho cả hai theme. Theme chỉ đổi màu, phần thân giữa (archetype) và hàng cột. `schema.ts` không đổi. Chỉ đổi giá trị màu trong hai `manifest.json` và màu trời của `theme.css` theme `vinuni`.
6. **Quy tắc chặn đường mới:** chỉ nhà, đài phun, gốc cây tán tròn, hồ và cô Lan là vật cản. Mọi vật thấp (≤ 0.4) hoặc mảnh (≤ 0.3) chỉ để trang trí và không chặn: cột, đèn, tượng, thông tháp, hàng rào cây, lan can, luống hoa. Nhờ vậy, click-to-move đi thẳng không cần tìm đường. Blockout đã kiểm mọi cặp điểm tương tác.
7. **Ngân sách:** vẫn 13 draw call. Tổng tam giác khoảng 14,8k (campus) / 12,3k (town) sau QA vòng 1, nằm trong giới hạn 60k. Nâng trần trong test từ 12 000 lên 20 000.

---

## 2. Bố cục (`layout.ts`, nguồn toạ độ duy nhất)

### 2.1 Sơ đồ (nhìn từ trên, x sang phải, z xuống dưới; 1 ô ≈ 2 u)

```
z=−10 ┌─────────────────────────────────────────────────────────────┐
      │ (tròn)  [chòi]══ cánh C ══[chòi] THÁP I [chòi]══ cánh E ══[chòi] (tròn)
 −7.6 │          ║                    ▲ sảnh               ║        │
 −6.0 │ ┌─THƯ VIỆN─┐  ↑↑↑↑↑ thông    bậc thềm   thông ↑↑↑↑↑ ┌THÁP CANH┐
      │ │ (tòa D/A)│ ▲ ┌────── sân trước, tia khảm ─────┐ ▲  │(tòa F)  │
 −2.8 │ │  cửa ●──┼─ ─┤────────────────────────────────┼─ ─┼──● cửa   │
      │ └──────────┘ ▲ │ tượng│  thảm cỏ (★spawn) │tượng│ ▲ └─────────┘
      │      Lan ☺     ▲ │  4  │                    │  4  │ ▲          │
 +1.5 │   (tròn)       ▲   ═══ lan can ═══   ═══ lan can ═══          │
      │ ┌VƯỜN HỒNG┐   (  hàng cột   ◎ ĐÀI PHUN    hàng cột  ) ┌CHỢ┐●  │
 +5.6 │ │ 6 luống │   (   cong       quảng trường   cong      ) └───┘   │
      │ └─────────┘          bậc cong ở mép trước              ≈≈ HỒ ≈≈ │
z=+10 └─────────────────────────────────────────────────────────────┘
     x=−14                         x=0                            x=+14
```

Đối chiếu với thực tế (§2.1 của tài liệu nghiên cứu): Vườn Hồng nằm phía tây quảng trường đài phun (`−x`), hồ uốn quanh phía nam và đông nam (`+x, +z`). Hai đầu cánh nhô về phía trước tạo chữ U nông, đúng như ảnh chụp từ trên cao. Các phần bỏ qua có chủ đích ở v0.2: cổng ba vòm, sân vận động, nhà thể thao, ký túc xá, mái vòm tòa B, các tháp chung cư bên ngoài. v0.3 dựng thêm cổng (vị trí đã xác nhận ở tài liệu nghiên cứu §2.7.1), sân vận động và hội trường B.

### 2.2 Hằng số (thay khối tương ứng trong `layout.ts`)

```ts
export const WORLD_BOUNDS = { halfX: 14, halfZ: 10 } as const; // không đổi
export const SPAWN: Vec2 = { x: 0, z: -0.8 };                  // giữa thảm cỏ, trên trục
export const PLAZA: Vec2 = { x: 0, z: 5.6 };                   // tâm đài phun và hàng cột
export const FOUNTAIN_RADIUS = 1.88;                           // nửa cạnh hộp chặn = mép hàng rào quanh bể
export const INTERACT_RADIUS = 1.7;                            // không đổi

const span = (x0: number, x1: number, z0: number, z1: number): Box => ({
  x: (x0 + x1) / 2, z: (z0 + z1) / 2, halfX: (x1 - x0) / 2, halfZ: (z1 - z0) / 2,
});

export const LANDMARK = {
  centre: { x: 0, z: -7.6 },
  /** Cánh + chòi; khối đế tháp nhô ra; sảnh + bậc thềm. */
  footprints: [span(-9.75, 9.75, -9.9, -6.0), span(-3.15, 3.15, -6.0, -5.15), span(-1.7, 1.7, -5.15, -3.55)],
} as const;
```

| Site | `centre` | `footprint` (x0, x1, z0, z1) | `door` | `facing` | Mặt chính camera thấy |
|---|---|---|---|---|---|
| `library` | (−10.6, −3.3) | −12.4, −8.8, −6.0, −0.6 | (−8.2, −2.8) | `π/2` | `+x` (hành lang cột, cửa), `+z` (cửa sổ kệ sách) |
| `watchtower` | (10.4, −3.5) | 8.8, 12.0, −6.0, −1.0 | (8.2, −2.8) | `−π/2` | `+z`, `+x`; cửa ở mặt `−x`, mái che màu `wt.roof` đánh dấu từ trên |
| `market` | (9.0, 3.9) | 7.0, 11.0, 2.6, 5.2 | (6.4, 3.9) | `−π/2` | `+z` (hướng hồ), `+x`; cửa mặt `−x` hướng quảng trường |

Điểm đứng khi quay về (`arrivalPose` không đổi công thức): Thư viện (−7.4, −2.8), Tháp canh (7.4, −2.8), Chợ (5.6, 3.9). Cả ba không bị chặn.

```ts
export const NPC_SPOT: Vec2 = { x: -6.6, z: -2.0 };      // cạnh lối vào Thư viện, lệch khỏi đường chéo camera từ cửa
export const NPC_TALK_SPOT: Vec2 = { x: -6.6, z: -2.8 }; // trên lối đi, cách cô 0.80 (< INTERACT_RADIUS)
// SPAWN_HEADING = atan2(-6.6 - 0, -2.0 + 0.8) = -1.7506 (giữ công thức hiện có)
```

**Hàng cột** (chỉ vẽ khi `colonnades = true`, không là vật cản). Công thức điểm giữ nguyên quy ước góc hiện có: `arcPoint(a, r) = { x: PLAZA.x + sin(a)·r, z: PLAZA.z − cos(a)·r }`.

```ts
export const COLONNADE = { inner: 3.05, outer: 3.75, mid: 3.4 } as const;
/** 24 cột: mỗi bên s ∈ {−1, 1}, 6 góc a = s·(0.37 + 0.05·i)·π (i = 0..5), mỗi góc 2 cột ở inner và outer. */
export const COLONNADE_COLUMNS: readonly Vec2[];
/** 2 trụ khối ở đầu cung phía trước: a = s·0.68π, r = COLONNADE.mid → (±2.87, 7.42). */
export const COLONNADE_PIERS: readonly Vec2[];
```

**Cây.** `TREES = [...ROUND_TREES, ...CYPRESS_TREES]` (41 cây). Chỉ cây tròn vào `OBSTACLES`, mỗi cây một hộp `±0.35`. Loại cây lấy từ danh sách chứa nó, không suy từ vị trí như v0.1.

```ts
export const ROUND_TREES: readonly Vec2[] = [            // 23 cây
  { x: -11.4, z: -9.0 }, { x: -13.3, z: -7.4 }, { x: 11.4, z: -9.0 }, { x: 13.3, z: -7.4 }, // góc sau
  { x: -13.4, z: -4.4 }, { x: -13.4, z: -1.8 }, { x: -13.3, z: 1.2 },                       // mép tây
  { x: 13.3, z: -4.4 }, { x: 13.3, z: -1.6 }, { x: 12.8, z: 1.3 }, { x: 13.4, z: 3.7 },     // mép đông
  { x: -5.4, z: 2.4 }, { x: 5.6, z: 1.8 }, { x: -4.9, z: 0.6 }, { x: 5.0, z: 0.6 },          // bãi cỏ hai bên trục
  { x: -4.9, z: 6.4 }, { x: 4.9, z: 6.4 }, { x: -4.3, z: 8.9 }, { x: 4.3, z: 8.9 },          // sau hàng cột
  { x: -13.4, z: 4.3 }, { x: -13.4, z: 7.3 }, { x: -12.8, z: 9.6 }, { x: -5.6, z: 9.6 },     // quanh Vườn Hồng
];
export const CYPRESS_TREES: readonly Vec2[] = [          // 18 cây, không chặn
  // Hai hàng dọc trục: x = ±3.75, z = −5.6 + 0.8k, k = 0..8 (18 cây)
  // Không trồng trước mặt cánh nhà để mặt đứng có cửa sổ vẫn đọc được (QA vòng 1)
];
```

**Hồ** (góc trước-phải). Bờ là một phần tư elip, tâm ở góc đế `(14.8, 10.8)`, `rx = 8.2`, `rz = 5.0`. Điểm bờ: `(14.8 − 8.2·cos t, 10.8 − 5.0·sin t)` với `t ∈ [0, π/2]`. Vùng chặn gồm 4 hộp nằm trọn trong nước. Người chơi có thể chạm mép nước tối đa khoảng 0.45, chấp nhận được.

```ts
export const LAKE_BLOCKS: readonly Box[] = [
  span(8.6, 14.8, 8.3, 10.8), span(11.4, 14.8, 6.4, 8.3), span(7.2, 8.6, 9.0, 10.8), span(13.0, 14.8, 5.9, 6.4),
];

export const OBSTACLES: readonly Box[] = [
  ...LANDMARK.footprints,
  ...SITES.map((site) => site.footprint),
  { x: PLAZA.x, z: PLAZA.z, halfX: FOUNTAIN_RADIUS, halfZ: FOUNTAIN_RADIUS },
  ...ROUND_TREES.map((t) => ({ x: t.x, z: t.z, halfX: 0.35, halfZ: 0.35 })),
  ...LAKE_BLOCKS,
  NPC_BOX, // { ...NPC_SPOT, halfX: 0.3, halfZ: 0.3 }
];
```

### 2.3 Nhãn DOM (`scene/labels.ts`)

Chỉ đổi neo, giao diện nhãn giữ nguyên: Thư viện `[-10.8, 2.9, -3.3]`, Tháp canh `[10.6, 6.6, -4.8]`, Chợ `[9.0, 2.9, 3.9]`, cô Lan `[NPC_SPOT.x, 1.85, NPC_SPOT.z]` (công thức không đổi).

### 2.4 Test cần sửa hoặc thêm

- `layout.test.ts`:
  - Đổi số cây thành 51.
  - Giữ kiểm "đĩa 0.9 quanh mọi cây không giao footprint 3 khu", vẫn đạt; vẫn đạt.
  - Đổi điểm quay về như §2.2.
  - Đổi `SPAWN_HEADING` thành `−1.751` (3 chữ số).
- **Thêm một test đi bộ.** Cho `step()` chạy với `dt = 1/60`, tối đa 4 000 bước, đích click lần lượt là từng cặp trong `{SPAWN, NPC_TALK_SPOT, 3 door, 3 arrival}`. Test phải tới đích (`targetDone` và cách đích ≤ 0.08). Blockout đã chạy đủ 56 cặp và đều tới. Test này giữ đúng quy tắc §1.6.
- `movement.test.ts`: không đổi, các test spawn, cửa và `nearestWithin` vẫn đạt.

---

## 3. Camera và khung hình

`camera.ts` không đổi (art §4). Nội dung trong khung hình:

| Viewport | Chế độ, zoom | Thấy gì |
|---|---|---|
| 1280×800 | overview, 32.8 | Toàn bộ đế. Tháp ở góc trên-phải tâm, ngôi sao cách mép trên khoảng 27 px (gồm cả pad 24). Đài phun ở dưới-trái, hồ ở mũi dưới cùng của hình thoi. Hai góc trên vẫn là trời trống cho cụm nút HUD. |
| 375×812 | follow, 29.8 | Khung rộng khoảng 12.6 u quanh người chơi. Tại `SPAWN (0, −0.8)` (`sx = 0.57`), khung thấy cùng lúc tháp (`sx = 5.37`), cô Lan và cửa Thư viện (`sx ≈ −3.2`, `−3.8`), đài phun (`sx = −3.96`) và Chợ. Cửa Tháp canh (`sx = 7.78`) nằm ngoài mép phải, chấp nhận được, vì camera trượt khi người chơi đi sang. |

Nên thêm một test nhỏ vào `scene.test.ts`. Với mọi đỉnh của `landmark` và `terrain` ở cả hai theme, giá trị `sy = (−x + 2y − z)/√6` phải ≤ `CONTENT.maxY`. Test này bắt lỗi khi ai đó nâng tháp mà quên camera.

---

## 4. Màu, trời và ánh sáng

### 4.1 Giá trị manifest (chỉ đổi giá trị, schema giữ nguyên)

**Theme `vinuni`** (trung thành với ảnh thật). Màu cỏ, lá và nước lấy từ mẫu §2.6, làm sáng thêm khoảng 20% cho hợp với sa bàn. Tường và gờ là trắng ngà. Mái phẳng màu xám nhạt. Vàng kim lấy theo mẫu chụp từ mặt đất.

| Khoá | Cũ | Mới | Ghi chú |
|---|---|---|---|
| `ground` | `#b9d7a0` | `#a7c584` | Cỏ, bớt màu phấn |
| `path` | `#ece8df` | `#ece4d8` | Đá lát sáng ấm |
| `plaza` | `#f2efe8` | `#f1ece4` | Quảng trường, tấm đế trắng, đầu tượng người |
| `water` | `#8ec3e6` | `#8fb9cf` | Xanh-xám đục như hồ thật |
| `foliage` | `#4f8f45` | `#5e8c4c` | |
| `trunk`, `player`, `npc` | giữ | giữ | |
| `landmark.wall / trim / roof / accent` | `#f7f6f2 / #e1ddd2 / #d8d2c2 / #c9a13b` | `#f6f3ee / #dfd9cf / #d3d3cf / #d4a24c` | `roof` giờ là **mặt mái phẳng** của cánh nhà |
| `landmark.archetype / colonnades` | `spire-hall / true` | giữ | |
| `buildings.library` | | `{ wall: #f6f3ee, trim: #dcd5ca, roof: #134d8b }` | `roof` = mái che cửa, sách cô Lan, gáy sách |
| `buildings.watchtower` | | `{ wall: #f4f2ee, trim: #d9d4cb, roof: #0b2a4d }` | `roof` = chóp tháp và mái che cửa |
| `buildings.market` | | `{ wall: #f6f3ee, trim: #ddd6ca, roof: #c72127 }` | `roof` = mái bạt, mái che cửa, gốc màu hoa |

**Theme `town`**: giữ nguyên mọi giá trị. Cùng hình dùng chung, town tự ra chất thị trấn nhờ ba thứ: mái phẳng của hai cánh tô `lm.roof` xanh mòng két (nhìn từ trên thành mái màu), toà thị chính có tháp đồng hồ, và thay hàng cột bằng hai cung hàng rào cây cùng 4 đèn.

**`theme.css`**: `--vg-scene-sky` của `vinuni` đổi từ `#dfeaf5` thành `#d7e7f3` (xanh hơn một chút để tường trắng nổi lên). `town` giữ `#e3efec`.

### 4.2 Màu phái sinh (`palette.ts`)

Ba màu phái sinh mới, không thêm trường manifest. Hex là kết quả đổi về sRGB, sai số ±1.

| Khoá | Công thức (linear) | vinuni | town | Dùng cho |
|---|---|---|---|---|
| `~band` | `mul(lm.trim, 0.50)` | `#a49f98` | `#989080` | Dải lát tối trong quảng trường, tia khảm ở sân trước |
| `~hedge` | `mul(foliage, 0.70)` | `#4f7740` | `#4d8345` | Hàng rào cây thấp, bụi cắt tỉa, sân mái tháp, hàng rào quanh đài phun |
| `~bloom` | `mul(lerpW(mk.roof, 0.35), 0.85)` | `#cd9697` | `#c6a295` | Luống hồng quanh bể, lõi các luống Vườn Hồng |

Các màu phái sinh cũ giữ công thức. Giá trị mới của theme `vinuni` dùng trong `scene.test.ts`:
- `~soil` = `#74895b` (cũ `#81966f`)
- `~lit` = `#ddba8b` (cũ `#d5b985`)
- `~xray` = `#b3baca` (không đổi)
- `desat(wt.roof)` = `#222936` (không đổi)

Tham khảo thêm: `~skirt #8ea870`, `~contact #97b277`, `~glass #638190`, `~waterHi #c0d5e1`, `~cypress #558045`.

Chọn kính `~glass` xanh-xám vì tài liệu nghiên cứu §3 còn bỏ ngỏ màu kính. Kính tối xanh-xám khớp ảnh chụp từ trên cao và đủ tương phản trên tường trắng.

### 4.3 Ánh sáng

Không đổi so với art §3: Hemisphere `#ffffff / #d1d1d1 / 2.306`, Directional `1.087` tại `L × 30`, `flat` (NoToneMapping), không shadow map, không postprocessing. Hệ số nướng sáng theo hướng mặt vẫn là trên 1.0, `+z` 0.8, `+x` 0.6, nên mặt tiền chính (hướng `+z`) là mặt trắng sáng thứ hai, đúng ý.

---

## 5. Hình procedural chính xác

### 5.0 Quy ước

- Dùng helper sẵn có trong `primitives.ts`, tham số theo thứ tự của art §5.0. Ký hiệu `box(x0,x1 | y0,y1 | z0,z1)`. Cột "Nhóm" xem §7.
- **Chỉ đổi helper ở hai chỗ:**
  1. `ring(rIn, rOut, seg, x, y, z, thetaStart = 0, thetaLength = 2π)` truyền thẳng vào `RingGeometry(rIn, rOut, seg, 1, thetaStart, thetaLength)`. Sau `rotateX(−π/2)`, góc θ ứng với điểm `(cos θ, −sin θ)`, nên cung **phía trước** (`+z`) là `thetaStart = 7π/6`, `thetaLength = 2π/3`.
  2. `hand()` nhận thêm tham số `v`, vì tâm mặt đồng hồ dời lên 5.31.
- Xoá `prismX` nếu không còn ai gọi (Thư viện và Chợ v0.2 đều mái phẳng).
- Hộp xoay theo cung: `box(−h, h | y0, y1 | −h, h).rotateY(−a).translate(px, 0, pz)`.
- Cờ **AO** và **E** giữ nghĩa như art §2.3–§2.4. Màu `lm.*`, `lib.*`, `wt.*`, `mk.*`, `~*` như §4.
- Mặt camera không thấy (`−x`, `−z`) để trơn, như nguyên tắc 7 của art §1.2.

### 5.1 `G-terrain` (1 draw call; vinuni 4 260 tam giác, town 4 452)

| # | Phần | Hình | Màu | Cờ |
|---|---|---|---|---|
| T1 | Đế đất | `box(−14.8,14.8 \| −0.6,0 \| −10.8,10.8)` | `{top: ground, side: ~soil}` | |
| T2 | Tấm đế trắng | `box(−15.05,15.05 \| −0.8,−0.6 \| −11.05,11.05)` | `plaza` | |
| P1 | Sân trước | `rect(−3.4,3.4 \| −6.0,−1.8 \| 0.012)` | `path` | |
| P2, P3 | Hai lối đi bên thảm cỏ | `rect(−3.1,−2.0 \| −1.8,1.7 \| 0.012)`, `rect(2.0,3.1 \| −1.8,1.7 \| 0.012)` | `path` | |
| P4 | Lối vào Thư viện | `rect(−8.8,−3.4 \| −3.1,−2.5 \| 0.012)` | `path` | |
| P5 | Lối vào Tháp canh | `rect(3.4,8.8 \| −3.1,−2.5 \| 0.012)` | `path` | |
| P6 | Lối vào Chợ | `rect(3.6,7.0 \| 3.6,4.2 \| 0.012)` | `path` | |
| P7 | Sỏi Vườn Hồng | `rect(−12.8,−6.2 \| 3.6,9.4 \| 0.011)` | `path` | |
| K1 | 6 tia khảm hội tụ về bậc thềm | `groundTriangles` dạng tứ giác, `y = 0.013`. Với `s ∈ {−1,1}` và `(xa, xb) ∈ {(0.55,1.25), (1.15,2.45), (1.70,3.35)}`, bốn đỉnh là `(s·xa−0.05, −3.55)`, `(s·xa+0.05, −3.55)`, `(s·xb+0.05, −1.8)`, `(s·xb−0.05, −1.8)` | `~band` | |
| K2 | Dải tối ngang mép sân trước | `rect(−3.4,3.4 \| −2.0,−1.9 \| 0.013)` | `~band` | |
| G1 | 6 luống Vườn Hồng | Với `c ∈ {0,1}`, `r ∈ {0,1,2}`: `x0 = −12.6 + 3.2c`, `z0 = 3.85 + 1.85r`. Viền `box(x0,x0+2.6 \| 0,0.14 \| z0,z0+1.5)`. Cỏ trong `rect(x0+0.12,x0+2.48 \| z0+0.12,z0+1.38 \| 0.142)`. Hoa hai dải `rect(x0+0.35,x0+2.25 \| z0+dz,z0+dz+0.20 \| 0.143)`, `dz ∈ {0.38, 0.92}` | `~hedge` / `foliage` / `~bloom` | |
| H1 | Hàng rào hai mép thảm cỏ | `box(−2.02,−1.92 \| 0,0.16 \| −1.7,1.3)`, `box(1.92,2.02 \| 0,0.16 \| −1.7,1.3)` | `~hedge` | |
| Q1 | Mặt quảng trường | `cyl(4.2,4.2,48 \| 0→0.04 \| PLAZA)` | `plaza` | |
| Q2 | Dải lát đồng tâm, `y 0.041` | `ring(2.30,2.55,48)` `lm.trim`; `ring(2.75,2.82,48)` `~band`; `ring(3.60,3.85,48)` `lm.trim`; `ring(4.02,4.09,48)` `~band`, tất cả quanh PLAZA | xem cột Hình | |
| Q3 | 3 vạch bậc cong phía trước, `y 0.013` | `ring(r, r+0.10, 24, PLAZA.x, 0.013, PLAZA.z, 7π/6, 2π/3)`, `r ∈ {4.22, 4.42, 4.62}`, trên nền bậc liền `ring(4.20, 4.72, 24, …, 0.012, …, 7π/6, 2π/3)` | `~band` / nền `path` | |
| F1 | Hàng rào quanh bể | `cyl(1.88,1.88,32 \| 0.04→0.14 \| PLAZA)` | `~hedge` | |
| F2 | Luống hồng | `circle(1.78,32 \| PLAZA.x, 0.142, PLAZA.z)` | `~bloom` | |
| F3 | Thành bể ngoài | `lathe([(1.30,0.14),(1.30,0.30),(1.50,0.30),(1.50,0.14)], 32)` tại PLAZA | `lm.wall` | |
| F4 | Nước bể ngoài, gợn tĩnh | `circle(1.30,32 \| y 0.22)` `water`; `ring(1.12,1.20,32 \| y 0.222)` `~waterHi` | | |
| F5 | 8 tượng nhỏ trong bể | Tại `r = 1.0`, góc `π/8 + kπ/4`: bệ `box(±0.06 \| 0.22,0.36)` `lm.trim`; thân `cyl(0.035,0.05,5 \| 0.36→0.56)` `lm.wall`; đầu `ico(0.045,0 \| y 0.60)` `lm.wall` | | |
| F6 | Bể nâng (≈ 45% đường kính) | `cyl(0.68,0.70,24 \| 0.22→0.60)` `lm.wall`; nước `circle(0.60,24 \| y 0.602)` `water` | | |
| F7 | Bệ bậc | `cyl(0.36,0.42,8 \| 0.60→0.85)` `lm.wall`; `cyl(0.26,0.30,8 \| 0.85→1.05)` `lm.trim` | | |
| F8 | Tượng lớn (quay ra `+z`) | Áo `cyl(0.11,0.20,8 \| 1.05→1.85)`; đầu `ico(0.09,1 \| y 1.95)`; tay giơ `CylinderGeometry(0.025,0.03,0.36,5).rotateZ(−0.35).translate(PLAZA.x+0.13, 1.88, PLAZA.z)` | `lm.wall` | |
| W1 | Hồ | `groundTriangles` hình quạt từ `(14.8,10.8)` tới 17 điểm bờ (§2.2, `t = πi/32`, i = 0..16), `y 0.008` | `water` | E |
| W2 | Viền bờ đá | Dải giữa bờ và elip `rx + 0.14`, `rz + 0.14`, 16 đoạn, `y 0.009` | `lm.trim` | |
| W3 | (bỏ ở QA vòng 1: dải gợn đọc như bờ thứ hai) | | | |
| B1 | 2 đoạn lan can | Với `s`: tường `box(s·[0.7,2.0] \| 0,0.28 \| 1.40,1.50)` `lm.wall`; gờ `box(s·[0.66,2.04] \| 0.28,0.33 \| 1.37,1.53)` `lm.trim`; 2 trụ `box(xe±0.08 \| 0,0.40 \| 1.37,1.53)` và bình `ico(0.07,0 \| xe, 0.47, 1.45)` `lm.wall`, `xe ∈ {s·0.7, s·2.0}` | | |
| S1 | 12 tượng trên bệ | Vị trí `(±3.05, {−1.35, −0.45, 0.45, 1.35})` và `(±3.3, {−2.05, −5.5})`. Bệ `box(±0.13 \| 0,0.32)` `lm.trim`; thân `cyl(0.06,0.09,6 \| 0.32→0.72)` `lm.wall`; đầu `ico(0.06,0 \| y 0.78)` `lm.wall` | | |
| L1–L3 | 6 cột đèn: trụ `cyl(0.045,0.055,6 \| 0→1.6)`, đèn `box(±0.1 \| 1.6,1.8)`, chóp `cone(0.17,4 \| 1.8→1.9)` | `(±3.55, −3.7)`, `arcPoint(s·0.30π, 4.6) = (±3.72, 2.90)`, `arcPoint(s·0.75π, 4.6) = (±3.25, 8.85)`. Town thêm 4 đèn tại `arcPoint(s·{0.37, 0.66}π, 3.4)` | `~band` / `~lit` E | |
| R1 | 6 bụi cắt tỉa chân hàng cột | `ico(0.22,0).scale(1,0.8,1)` tâm `y 0.18` tại `arcPoint(s·{0.42, 0.52, 0.62}π, 4.2)` | `~hedge` | |
| T9 | Viền tối chân công trình | Như art §2.4, cho 3 hộp `LANDMARK.footprints` và 3 footprint khu | `~skirt → ground` | |
| T10 | Vệt tiếp đất dưới cây | Như art §2.4, `r = 0.62·s` (cây tròn) hoặc `0.26·s` (thông tháp), 41 đĩa | `~contact` | |

Bỏ phần đài phun v0.1 (F1–F8 cũ) và các đường T3–T5 cũ.

### 5.2 `G-landmark`: phần chung hai archetype

Nền và bậc:

| # | Hình | Màu | Cờ |
|---|---|---|---|
| LM1 | `box(−9.9,9.9 \| 0,0.3 \| −9.95,−5.95)` | `lm.trim` | AO |
| LM2 | `box(−3.15,3.15 \| 0,0.3 \| −5.95,−5.15)` | `lm.trim` | AO |
| LM3 sàn sảnh | `box(−1.7,1.7 \| 0,0.3 \| −5.15,−4.15)` | `lm.trim` | AO |
| LM4, LM5 bậc thềm | `box(−1.7,1.7 \| 0,0.2 \| −4.15,−3.85)`, `box(−1.7,1.7 \| 0,0.1 \| −3.85,−3.55)` | `lm.trim` | |

**Khối đế tháp (`W = 6`, cao 4 tầng × 0.65):**

| # | Hình | Màu | Cờ |
|---|---|---|---|
| BB1 | `box(−3.0,3.0 \| 0.3,2.9 \| −9.9,−5.3)` | `lm.wall` | AO |
| BB2 | Trụ góc nhô: `box(−3.06,−2.5 \| 0.3,2.9 \| −5.3,−5.24)` và `box(2.5,3.06 \| …)` | `lm.wall` | |
| BB3 | Gờ mái `box(−3.12,3.12 \| 2.9,3.02 \| −10.02,−5.18)` | `lm.trim` | |
| BB4 | Cửa sổ trước: `quad("+z", plane, x, y, 0.20, 0.36)`, `x = −2.6 + 0.4k` (k = 0..13, tức 14 khoang), `y ∈ {0.62, 1.27, 1.92, 2.57}`. Bỏ ô có `\|x\| < 1.7` và `y < 1.5` (sau sảnh). `plane = −5.24` nếu `\|x\| ≥ 2.5`, ngược lại `−5.3`. Tổng 40 ô | `~glass` | |
| BB5 | Cửa sổ hông, chỉ hàng nhô trên mái cánh: `quad("+x", 3.0, −9.6 + 0.4k, 2.57, 0.20, 0.36)`, k = 0..5 | `~glass` | |

**Hai cánh (C, E).** Với `s ∈ {−1, 1}`, `[x0, x1]` = sắp xếp của `s·3.0, s·9.7`:

| # | Hình | Màu | Cờ |
|---|---|---|---|
| WG1 | Thân `box(x0,x1 \| 0.3,2.25 \| −9.7,−6.2)` (3 tầng × 0.65) | `lm.wall` | AO |
| WG2 | Gờ mái `box(x0−0.05,x1+0.05 \| 2.25,2.37 \| −9.75,−6.15)` | `lm.trim` | |
| WG3 | Mặt mái phẳng `rect(x0+0.12,x1−0.12 \| −9.63,−6.27 \| 2.372)` | `lm.roof` | |
| WG4 | Lan can mái mặt trước `box(x0−0.05,x1+0.05 \| 2.37,2.5 \| −6.27,−6.15)` | `lm.wall` | |
| WG5 | 2 gờ tầng `box(x0,x1 \| y,y+0.04 \| −6.2,−6.16)`, `y ∈ {0.92, 1.57}` | `lm.trim` | |
| WG6 | Cửa sổ trước, `x = s·(4.6 + 0.42i)`, i = 0..8. Hai tầng trên: `quad("+z", −6.2, x, y, 0.16, 0.40)`, `y ∈ {1.27, 1.92}`. Tầng trệt vòm: `quad("+z", −6.2, x, 0.55, 0.16, 0.34)` + `arch("+z", −6.2, x, 0.72, 0.08)` | `~glass` | |
| WG7 | Chỉ cánh `s = +1`, cửa sổ đầu hồi: `quad("+x", 9.7, −9.4 + 0.42i, y, 0.16, 0.40)`, i = 0..4, `y ∈ {0.62, 1.27, 1.92}` | `~glass` | |

**4 chòi tháp**, tâm `c ∈ {−9.05, −3.7, 3.7, 9.05}`. Mỗi chòi cao hơn cánh một tầng, đỉnh thu ba bậc, trên cùng là khối nhỏ có khe vòm:

| # | Hình | Màu | Cờ |
|---|---|---|---|
| PV1 | `box(c−0.70,c+0.70 \| 0.3,2.95 \| −7.40,−6.00)` | `lm.wall` | AO |
| PV2 | `box(c±0.76 \| 2.95,3.03 \| −7.46,−5.94)` | `lm.trim` | |
| PV3 | `box(c±0.50 \| 3.03,3.13 \| −7.20,−6.20)` | `lm.wall` | |
| PV4 | (gộp vào PV3 ở QA vòng 1: mũ thấp hơn, không tranh với tháp) | | |
| PV5 | `box(c±0.26 \| 3.13,3.42 \| −6.96,−6.44)` | `lm.wall` | |
| PV6 | `box(c±0.31 \| 3.42,3.48 \| −7.01,−6.39)` | `lm.trim` | |
| PV7 | Khe vòm: `quad("+z", −6.44, c, 3.25, 0.14, 0.20)` + `arch("+z", −6.44, c, 3.35, 0.07)`; `quad("+x", c+0.26, −6.7, 3.25, 0.14, 0.20)` + `arch("+x", c+0.26, −6.7, 3.35, 0.07)` | `~glass` | |
| PV8 | Cửa sổ `quad("+z", −6.0, c±0.28, y, 0.18, 0.38)`, `y ∈ {0.63, 1.29, 1.95, 2.61}`. Khi `c > 0` thêm `quad("+x", c+0.7, z, y, 0.18, 0.38)`, `z ∈ {−7.0, −6.4}` | `~glass` | |

### 5.3 `spire-hall` (theme `vinuni`): tháp bậc theo tỷ lệ §2.2

Lấy `H = 10.0` tính từ mặt nền `y = 0.3`, `W = 6.0`. Tỷ lệ cao/rộng là 1.65, đúng số đo ảnh. Tâm tháp `(0, −7.6)`. Đỉnh ngôi sao ở `y = 10.28`.

| # | Phần (phần của H / W theo §2.2) | Hình | Màu |
|---|---|---|---|
| SH1 | Sảnh 4 cột, khoảng giữa rộng hơn | `cyl(0.09,0.10,8 \| 0.3→1.3 \| x, −4.4)`, `x ∈ {−1.4, −0.6, 0.6, 1.4}` | `lm.wall` |
| SH2 | Mái sảnh | `box(−1.65,1.65 \| 1.30,1.46 \| −5.30,−4.22)` | `lm.trim` |
| SH3 | Cửa chính | `quad("+z", −5.3, 0, 0.75, 1.0, 0.9)` | `~glass` |
| SH4 | Bậc 2 (0.35 H, 0.65 W) | `box(−1.95,1.95 \| 3.02,3.80 \| −9.10,−6.10)` | `lm.wall` |
| SH5 | Gờ nặng (0.67 W) | `box(−2.03,2.03 \| 3.80,3.96 \| −9.18,−6.02)` | `lm.trim` |
| SH6 | Cửa sổ bậc 2 | `quad("+z", −6.1, −1.6+0.4k, 3.41, 0.20, 0.40)`, k = 0..8; `quad("+x", 1.95, −8.8+0.4k, 3.41, 0.20, 0.40)`, k = 0..6 | `~glass` |
| SH7 | Bậc 3 (0.46 H, 0.61 W) | `box(−1.83,1.83 \| 3.96,4.90 \| −9.00,−6.20)` | `lm.wall` |
| SH8 | Gờ bậc 3 | `box(−1.90,1.90 \| 4.90,5.00 \| −9.07,−6.13)` | `lm.trim` |
| SH9 | Cửa sổ bậc 3, 2 hàng `y ∈ {4.20, 4.62}` | `quad("+z", −6.2, −1.4+0.35k, y, 0.18, 0.28)`, k = 0..8; `quad("+x", 1.83, −8.7+0.37k, y, 0.18, 0.28)`, k = 0..6 | `~glass` |
| SH10 | Sân mái lát sáng, viền bồn cây phía trước | `rect(−1.75,1.75 \| −8.95,−6.25 \| 5.003)`; bồn `rect(−1.75,1.75 \| −6.50,−6.25 \| 5.004)` | `lm.roof` / `~hedge` |
| SH11 | 4 chòi nhỏ ở góc | `box(kx±0.17 \| 5.00,5.42 \| kz±0.17)` `lm.wall` + `cone(0.26,4 \| 5.42→5.60 \| kx,kz \| sq)` `lm.trim`, `kx ∈ {±1.55}`, `kz ∈ {−8.75, −6.45}` | |
| SH12 | Bậc 4 (0.59 H, 0.27 W) | `box(−0.81,0.81 \| 5.00,6.20 \| −8.41,−6.79)` | `lm.wall` |
| SH13 | Cửa vòm cao mỗi mặt thấy được | `quad("+z", −6.79, 0, 5.50, 0.34, 0.62)` + `arch("+z", −6.79, 0, 5.81, 0.17)`; `quad("+x", 0.81, −7.6, 5.50, 0.34, 0.62)` + `arch("+x", 0.81, −7.6, 5.81, 0.17)` | `~glass` |
| SH14 | Gờ bậc 4 | `box(−0.88,0.88 \| 6.20,6.28 \| −8.48,−6.72)` | `lm.trim` |
| SH15 | Đế đèn lồng loe (0.62 H) | `cyl(0.56,0.82,8 \| 6.28→6.55 \| 0,−7.6)` | `lm.wall` |
| SH16 | Lõi đèn lồng (0.73 H, 0.15 W) | `cyl(0.40,0.40,8 \| 6.55→7.55 \| 0,−7.6)` | `~glass` |
| SH17 | 8 trụ đèn lồng | `box(±0.06 \| 6.55,7.55)` tâm `(0.44·cos θk, −7.6 + 0.44·sin θk)`, `θk = π/8 + kπ/4` | `lm.wall` |
| SH18 | Nắp đèn lồng | `cyl(0.52,0.52,8 \| 7.55→7.65)` | `lm.trim` |
| SH19 | 8 chóp nhọn nhỏ | `cone(0.07,4 \| 7.65→7.85 \| tâm như SH17 \| sq)` | `lm.wall` |
| SH20 | Cổ | `cyl(0.20,0.36,8 \| 7.65→7.90)` | `lm.wall` |
| SH21 | Đầu loe hình chén (0.80 H, ≈ 0.10 W) | `cyl(0.30,0.14,8 \| 7.90→8.30)` | `lm.wall` |
| SH22 | Kim tháp (0.94 H, thon) | `cyl(0.035,0.11,6 \| 8.30→9.70)` | `lm.wall` |
| SH23 | Lõi ngôi sao mặt trời | `ico(0.14,0 \| 0, 10.0, −7.6)` | `lm.accent` |
| SH24 | 8 tia (đường kính 0.56 = 0.093 W) | `ConeGeometry(0.055,0.16,4).translate(0,0.20,0).rotateZ(kπ/4).translate(0,10.0,−7.6)` | `lm.accent` |

Kim tháp màu trắng như thật. Ở theme `vinuni`, `lm.roof` không còn tô kim tháp mà chỉ tô mặt mái phẳng.

### 5.4 `clock-tower` (theme `town`), cùng khối đế

| # | Hình | Màu | Cờ |
|---|---|---|---|
| CT1 | Mái hông: `ConeGeometry(1, 1.28, 4).rotateY(π/4).scale(3.12√2, 1, 2.42√2)`, đáy `y 3.02`, đỉnh `4.30`, tâm `(0, −7.6)` | `lm.roof` | |
| CT2 | Thân tháp nhô trước `box(−0.85,0.85 \| 0.30,4.60 \| −6.50,−4.80)` | `lm.wall` | AO |
| CT3 | `box(−0.95,0.95 \| 4.60,4.72 \| −6.60,−4.70)` | `lm.trim` | |
| CT4 | Tầng đồng hồ `box(−0.75,0.75 \| 4.72,5.90 \| −6.40,−4.90)` | `lm.wall` | |
| CT5 | Mặt `disc("+z", −4.9, 0, 5.31, 0.42, 16)`, `disc("+x", 0.75, −5.65, 5.31, 0.42, 16)`; viền `RingGeometry(0.42,0.50,16)` cùng chỗ | `plaza` (E) / `lm.accent` | |
| CT6 | Kim (giữ 4:30): kim phút `0.04 × 0.34` góc π, kim giờ `0.05 × 0.24` góc 3π/4, `v = 5.31` | `~dark` | E |
| CT7 | Mái tháp `cone(1.10,4 \| 5.90→7.60 \| 0,−5.65 \| sq)` | `lm.roof` | |
| CT8 | Cột cờ `cyl(0.025,0.025,4 \| 7.60→8.00 \| 0,−5.65)` + `ico(0.12,0 \| 0,8.08,−5.65)` | `lm.accent` | |
| CT9 | Cửa `quad("+z", −4.8, 0, 0.80, 0.60, 1.00)`. Cửa sổ `quad("+z", −4.8, 0, y, 0.30, h)` và `quad("+x", 0.85, −5.65, y, 0.30, h)` với `(y, h) ∈ {(2.3, 0.6), (3.4, 0.5)}` | `~glass` | |

### 5.5 Hàng cột (`colonnades = true`) hoặc cung hàng rào (`false`)

**Hàng cột đôi** (tâm PLAZA, hai cung đối xứng, mỗi cung khoảng 63°; đầu cung phía trước là trụ khối):

| # | Hình | Màu |
|---|---|---|
| CO1 | Mỗi điểm `COLONNADE_COLUMNS` (24): đế `box(±0.13 \| 0.04,0.12)` `lm.trim`; thân `cyl(0.075,0.088,8 \| 0.12→1.55)` `lm.wall` (thân cao khoảng 8.4 đường kính); mũ `box(±0.13 \| 1.55,1.65)` `lm.trim` | |
| CO2 | Dầm phủ hai hàng `arcSlab(2.86,3.94, s·0.35π, s·0.70π \| 1.65,1.88)` | `lm.wall` |
| CO3 | Gờ đỉnh `arcSlab(2.80,4.00, s·0.345π, s·0.705π \| 1.88,1.95)` | `lm.trim` |
| CO4 | Trụ khối mỗi `COLONNADE_PIERS`: `box(−0.42,0.42 \| 0,1.65 \| −0.42,0.42).rotateY(−a).translate(px,0,pz)` `lm.wall`; khối đầu cột cao hơn `box(±0.36 \| 1.95,2.25 \| ±0.36)` xoay và đặt như trên `lm.wall`; bình đỉnh `cyl(0.07,0.12,6 \| 2.25→2.42)` + `ico(0.10,0 \| y 2.50)` `lm.wall` | |
| CO5 | 6 bình trên dầm tại `arcPoint(s·{0.40, 0.49, 0.58}π, 3.4)`: `cyl(0.05,0.09,6 \| 1.95→2.10)` + `ico(0.08,0 \| y 2.17)` | `lm.wall` |

**Theme town:** bỏ CO1–CO5, thay bằng `arcSlab(3.25,3.55, s·0.36π, s·0.68π | 0,0.30)` màu `~hedge` cùng 4 đèn ở §5.1. Đi xuyên qua cung hàng rào được, vì chiều cao 0.30 thấp hơn ngưỡng 0.4 của quy tắc §1.6.

### 5.6 Thư viện (mở; `G-library`): tay trái chữ U, hình tòa A

Ba thứ giúp nhận ra Thư viện từ xa: **hành lang cột đầu mạ vàng** nhìn ra trục (gợi cột dát vàng của tòa B), **cửa sổ vòm cao sáng ấm có gáy sách**, **vườn trên mái**. Mái che cửa màu `lib.roof` là chấm màu thương hiệu duy nhất ở phía tây.

| # | Hình | Màu | Cờ |
|---|---|---|---|
| LB1 | Bệ `box(−12.4,−8.8 \| 0,0.25 \| −6.0,−0.6)` | `lib.trim` | AO |
| LB2 | Thân 2 tầng `box(−12.2,−9.4 \| 0.25,1.85 \| −5.8,−0.8)` | `lib.wall` | AO |
| LB3 | 5 cột hành lang `cyl(0.075,0.085,8 \| 0.25→1.85 \| −9.05, z)`, `z ∈ {−5.2, −4.4, −3.6, −2.0, −1.2}` (khoang cửa ở giữa rộng 1.6) | `lib.wall` | |
| LB4 | 5 đai mạ vàng ở đầu cột `cyl(0.095,0.095,8 \| 1.66→1.76 \| −9.05, z)` | `lm.accent` | |
| LB5 | Dầm hành lang `box(−9.45,−8.85 \| 1.85,2.02 \| −5.85,−0.75)` | `lib.trim` | |
| LB6 | Gờ mái `box(−12.3,−8.85 \| 2.02,2.10 \| −5.9,−0.7)` | `lib.trim` | |
| LB7 | Vườn mái: nền lát `rect(−12.1,−9.1 \| −5.65,−0.95 \| 2.102)`, ô cỏ `rect(−11.7,−9.5 \| −5.2,−1.4 \| 2.103)` | `lib.trim` / `ground` | |
| LB8 | 4 bụi trên mái `ico(0.18,0).scale(1,0.9,1)` tâm `y 2.25` tại `(−11.6,−5.1)`, `(−9.6,−5.1)`, `(−11.6,−1.5)`, `(−9.6,−1.5)` | `foliage` | |
| LB9 | Cửa vòm `quad("+x", −9.4, −2.8, 0.70, 0.60, 0.90)` + `arch("+x", −9.4, −2.8, 1.15, 0.30)` | `~lit` | E |
| LB10 | Mái che cửa `box(−9.4,−8.6 \| 1.42,1.48 \| −3.4,−2.2)` | `lib.roof` | |
| LB11 | Cửa sổ trong hành lang, `z ∈ {−4.8, −4.0, −1.6}`: `quad("+x", −9.4, z, 0.65, 0.30, 0.55)`, `quad("+x", −9.4, z, 1.40, 0.30, 0.45)` + `arch("+x", −9.4, z, 1.625, 0.15)` | `~lit` | E |
| LB12 | 4 cửa sổ vòm cao 2 tầng ở mặt `+z`, `x ∈ {−11.85, −11.15, −10.45, −9.75}`: `quad("+z", −0.8, x, 0.95, 0.44, 1.25)` + `arch("+z", −0.8, x, 1.575, 0.22)` | `~lit` | E |
| LB13 | Gáy sách 2 tầng × 5 sau mỗi cửa LB12: `PlaneGeometry(0.07, h)` tại `z = −0.788`, gáy thứ k ở `x − 0.164 + 0.082k`. Tầng dưới đáy `y 0.42`, `h = [0.50, 0.44, 0.55, 0.46, 0.52]`. Tầng trên đáy `y 1.00`, `h = [0.42, 0.46, 0.39, 0.48, 0.44]`. Màu luân phiên như art §2.1 | xem art §2.1 | E |
| LB14 | Thanh kệ `PlaneGeometry(0.44, 0.03)` tại `(x, 0.99, −0.787)` | `lib.trim` | E |

Khi Thư viện chưa mở: LB9, LB11, LB12 đổi sang `~glass` không cờ E. Bỏ LB13–LB14. Áp `desat`. Thêm giàn giáo ở mặt `+z`: 3 cột `box(x±0.035 | 0.25,2.15 | −0.715,−0.645)`, `x ∈ {−11.9, −10.8, −9.7}`; 2 ván `box(−12.2,−9.4 | y,y+0.06 | −0.75,−0.50)`, `y ∈ {0.85, 1.55}`. Tất cả màu `trunk`.

### 5.7 Tháp canh (sắp mở; `G-watchtower`): tay phải chữ U, chòi tháp phóng to

Tháp đặt ở góc sau-phải footprint, nối vào chòi cuối cánh E. Phía trước là sảnh 1 tầng. Khi người chơi đứng ở cửa (8.2, −2.8), chỉ chân bị sảnh che. Thân tháp không nằm trên tia nhìn tới camera nên đầu người chơi luôn lộ (đã kiểm). Tổng cao 6.19, thứ hai sau tháp chính.

| # | Hình | Màu | Cờ |
|---|---|---|---|
| WT1 | Bệ `box(8.8,12.0 \| 0,0.25 \| −6.0,−1.0)` | `wt.trim` | AO |
| WT2 | Sảnh `box(9.0,11.8 \| 0.25,1.45 \| −3.8,−1.2)` + gờ `box(8.95,11.85 \| 1.45,1.53 \| −3.85,−1.15)` | `wt.wall` / `wt.trim` | AO |
| WT3 | Thân tháp `box(9.6,11.6 \| 0.25,3.45 \| −5.8,−3.8)` (4 tầng × 0.8) + gờ `box(9.52,11.68 \| 3.45,3.57 \| −5.88,−3.72)` | `wt.wall` / `wt.trim` | AO |
| WT4 | Bậc 1 `box(9.8,11.4 \| 3.57,4.17 \| −5.6,−4.0)` + gờ `box(9.75,11.45 \| 4.17,4.25 \| −5.65,−3.95)` | `wt.wall` / `wt.trim` | |
| WT5 | Bậc 2 `box(10.05,11.15 \| 4.25,4.75 \| −5.35,−4.25)` + gờ `box(10.0,11.2 \| 4.75,4.82 \| −5.4,−4.2)` | `wt.wall` / `wt.trim` | |
| WT6 | Khối đỉnh `box(10.3,10.9 \| 4.82,5.50 \| −5.1,−4.5)` + nắp `box(10.24,10.96 \| 5.50,5.58 \| −5.16,−4.44)` | `wt.wall` / `wt.trim` | |
| WT7 | Khe vòm đỉnh: `quad("+z", −4.5, 10.6, 5.08, 0.16, 0.34)` + `arch("+z", −4.5, 10.6, 5.25, 0.08)`; `quad("+x", 10.9, −4.8, 5.08, 0.16, 0.34)` + `arch("+x", 10.9, −4.8, 5.25, 0.08)` | `~glass` (mở: `~lit`, E) | |
| WT8 | Chóp quan sát `cone(0.42,4 \| 5.58→6.05 \| 10.6,−4.8 \| sq)` | `wt.roof` | |
| WT9 | Đèn hiệu `ico(0.07,0 \| 10.6, 6.12, −4.8)` | `lm.accent` | |
| WT10 | Cửa sổ thân: `quad("+z", −3.8, x, y, 0.20, 0.42)`, `x ∈ {10.2, 11.0}`, `y ∈ {1.95, 2.75}`; `quad("+x", 11.6, z, y, 0.20, 0.42)`, `z ∈ {−5.2, −4.4}`, `y ∈ {0.65, 1.45, 2.25, 3.05}` | `~glass` | |
| WT11 | Cửa sổ sảnh: `quad("+z", −1.2, x, 0.75, 0.30, 0.50)`, `x ∈ {9.6, 10.4, 11.2}`; `quad("+x", 11.8, z, 0.75, 0.30, 0.50)`, `z ∈ {−3.2, −2.4, −1.6}` | `~glass` | |
| WT12 | (bỏ ở QA vòng 1: đọc như ô đen trên cỏ; lối P5 và vòng đến đã đánh dấu cửa) | | |
| WT13 | Giàn giáo (chỉ khi sắp mở), mặt `+z` của thân tháp phía trên sảnh: 3 cột `box(x±0.035 \| 1.53,3.55 \| −3.715,−3.645)`, `x ∈ {9.7, 10.6, 11.5}`; 2 ván `box(9.6,11.6 \| y,y+0.06 \| −3.75,−3.50)`, `y ∈ {2.1, 2.9}` | `trunk` | |

### 5.8 Chợ model (sắp mở; `G-market`): nhà chợ mở ven hồ

Không có tòa thật tương ứng (gần nhất là canteen ở tòa E). Hình là một hành lang cột trắng mái phẳng, cùng ngôn ngữ với campus. Mái bạt màu `mk.roof` nghiêng ra hồ và ra phía đông. Ba quầy bày hàng S/M/L đại diện cho các cỡ model.

| # | Hình | Màu | Cờ |
|---|---|---|---|
| MK1 | Sàn `box(7.0,11.0 \| 0,0.20 \| 2.6,5.2)` | `mk.trim` | AO |
| MK2 | 9 cột `cyl(0.08,0.09,8 \| 0.20→1.75 \| x,z)`: `x ∈ {7.25, 8.42, 9.58, 10.75}` × `z ∈ {2.85, 4.95}`, và `(10.75, 3.9)`. Khoang cửa phía tây để trống | `mk.wall` | |
| MK3 | Mái `box(6.95,11.05 \| 1.75,1.95 \| 2.55,5.25)` | `mk.trim` | |
| MK4 | Mái nâng lấy sáng `box(7.6,10.4 \| 1.95,2.35 \| 3.05,4.75)` + nắp `box(7.55,10.45 \| 2.35,2.42 \| 3.0,4.8)` | `mk.wall` / `mk.trim` | |
| MK5 | Mái bạt hướng hồ `PlaneGeometry(3.9, 0.646).rotateX(−π/2 + 0.3805).translate(9.0, 1.50, 5.55)`; mái bạt hướng đông `PlaneGeometry(0.646, 2.5).rotateX(−π/2).rotateZ(−0.3805).translate(11.35, 1.50, 3.9)` | `mk.roof` | |
| MK6 | Mái che cửa (thấy từ trên) `box(6.55,7.0 \| 1.45,1.51 \| 3.3,4.5)` | `mk.roof` | |
| MK7 | 3 quầy `box(x±0.55 \| 0.20,0.90 \| 3.6,4.2)`, `x ∈ {7.9, 9.0, 10.1}` | `trunk` | |
| MK8 | Hàng hoá như art M6: cạnh {0.18, 0.26, 0.36} tại `x + {−0.35, 0, 0.38}`, đáy `y 0.90`, tâm `z 3.9` | `player`, `npc`, `lm.accent` | |
| MK9 | Giàn giáo (sắp mở), mặt `+x`: 3 cột `box(11.06,11.13 \| 0,2.30 \| z±0.035)`, `z ∈ {2.8, 3.9, 5.0}`; 2 ván `box(11.05,11.30 \| y,y+0.06 \| 2.7,5.1)`, `y ∈ {0.9, 1.9}` | `trunk` | |

Khi người chơi đứng ở cửa (6.4, 3.9), đầu bị mép mái MK3 che. X-ray của art §3 vẫn hiện bóng người chơi như v0.1.

### 5.9 Cây (instanced; `I-round`, `I-cypress`)

| Loại | Thân | Tán | Tam giác |
|---|---|---|---|
| Tròn (tán rộng hơn cao, như ảnh) | `cyl(0.08,0.12,6 \| 0→0.95)` `trunk` | `ico(0.8,1).scale(1, 0.85, 1)` tâm `y 1.55` `foliage` | 104 |
| Thông tháp (cao khoảng 3.4 lần rộng, thấp hơn gờ cánh nhà) | `cyl(0.04,0.05,5 \| 0→0.12)` `trunk` | `lathe([(0,0.10),(0.17,0.13),(0.23,0.40),(0.225,0.80),(0.15,1.20),(0.05,1.45),(0,1.55)], 8)` `~cypress` | 116 |

Biến thể `hash` giữ như art §5.7, chỉ số `i` lấy theo `TREES = [...ROUND_TREES, ...CYPRESS_TREES]`. Hai `InstancedMesh` vẫn đặt `frustumCulled = false`.

### 5.10 Người, cô Lan, vòng, nhãn

Giữ nguyên art §5.8–§5.10. Chỉ đổi vị trí và neo theo §2.

---

## 6. Theme và archetype (kiểm tra cô lập thương hiệu)

- Chuỗi tên thương hiệu không xuất hiện trong `frontend/app`. Mọi lựa chọn riêng của campus thật nằm trong `public/themes/vinuni/manifest.json` và `theme.css`: màu, `archetype: "spire-hall"`, `colonnades: true`.
- Code lõi chỉ có các khái niệm trung tính:
  - `spire-hall`: tháp bậc có kim.
  - `clock-tower`: toà thị chính có đồng hồ.
  - `colonnades`: hàng cột cong quanh quảng trường.
  - Phần dùng chung cho mọi theme: cánh nhà mái phẳng, chòi tháp, hồ, vườn hoa, tượng.
- Không thêm `dormitory-block` hay archetype nào khác. Ký túc xá, sân vận động và nhà thể thao nằm ngoài khung hình, thêm vào là YAGNI.
- `scene.test.ts`:
  - Giữ test "hai archetype khác nhau".
  - Giữ test đổi theme làm số tam giác của `landmark` thay đổi (4 266 so với 1 536).

---

## 7. Ngân sách (đếm theo công thức primitive của three.js; coder đo lại bằng `sceneBudget()`)

| Nhóm | Loại | Draw call | Tam giác vinuni | Tam giác town | Dựng lại khi |
|---|---|---|---|---|---|
| `G-terrain` | gộp tĩnh, Basic | 1 | 4 260 | 4 452 | đổi theme |
| `G-landmark` | gộp tĩnh, Basic | 1 | 4 266 (chung 1 070 + tháp bậc 924 + hàng cột 2 272) | 1 536 (chung 1 070 + đồng hồ 202 + cung hàng rào 264) | đổi theme |
| `G-library` (mở) | gộp tĩnh | 1 | 636 | 636 | theme, status |
| `G-watchtower` (sắp mở) | gộp tĩnh | 1 | 304 | 304 | theme, status |
| `G-market` (sắp mở) | gộp tĩnh | 1 | 556 | 556 | theme, status |
| `I-round` | instanced × 23 | 1 | 2 392 | 2 392 | theme |
| `I-cypress` | instanced × 18 | 1 | 2 088 | 2 088 | theme |
| Người chơi + x-ray, cô Lan, 2 bóng blob, vòng | động | 6 | 716 | 716 | như v0.1 |
| **Tổng** | | **13** | **≈ 14 750** (đo sau QA vòng 1) | **≈ 12 280** | |

- So với brief: dùng 33% trần draw call (13/40) và khoảng 25% trần tam giác (14,8k/60k).
- Bộ nhớ đỉnh khoảng 49k đỉnh × 24 B ≈ 1,2 MB. Vẫn 4 program shader như trước.
- `scene.test.ts`: giữ `drawCalls ≤ 16`, đổi `triangles ≤ 20 000` (vượt 22% so với số dự kiến thì báo). Ghi chú trong test: "target 13 / ≈14.8k".
- `frontend-architecture.md` §3: cập nhật dòng ngân sách.
- Không thêm bóng, không thêm postprocessing. Mọi mặt tĩnh vẫn nướng sáng vào vertex colour.

---

## 8. Việc của coder (theo thứ tự)

1. `layout.ts` theo §2.2. Sửa `layout.test.ts` và thêm test đi bộ (§2.4).
2. `palette.ts`: thêm `band`, `hedge`, `bloom` (§4.2).
3. `primitives.ts`: `ring` nhận thêm `thetaStart` và `thetaLength`. Xoá `prismX` khi hết người gọi.
4. `campus.ts`:
   - Viết lại `buildTerrain`, `buildLandmark` (phần chung, `spireHall`, `clockTower`, `colonnade` hoặc cung hàng rào), `buildLibrary`, `buildWatchtower`, `buildMarket`, `buildCypress`, `buildRoundTree` theo §5.
   - `TREE_INSTANCES` lấy `kind` theo danh sách chứa cây.
   - `hand()` nhận thêm tham số `v`.
5. `labels.ts`: đổi neo theo §2.3.
6. Hai `manifest.json` và `theme.css` của `vinuni` theo §4.1.
7. `scene.test.ts`:
   - Đổi trần tam giác (§7) và các hex `near(...)` (§4.2).
   - Tuỳ chọn: thêm test `sy ≤ CONTENT.maxY` (§3).
8. Chụp 1280×800 và 375×812 cho cả hai theme, so với ảnh blockout trong scratchpad.

## 9. Câu hỏi mở

- Cổng ba vòm: đã giải quyết. Vị trí đã xác nhận (tài liệu nghiên cứu §2.7.1): cổng đứng trên trục, ngay trên hàng rào ranh giới, phía trước quảng trường đài phun, có đường vòng chạy giữa cổng và hàng cột. Không đặt giữa hai đèn `(±3.25, 8.85)` như ghi chú cũ. v0.3 §6.2 dựng cổng ở mép trước của đế đã kéo dài (`z 11.44–12.6`, rộng 5,6 u), cùng hàng rào hai bên, theo cờ `colonnades`.
- Kim tháp hiện màu `lm.wall`, trắng như thật. Nếu muốn kim mang màu nhận diện của theme thì đổi sang `lm.roof`. Việc này không cần đổi code dựng hình khác.
