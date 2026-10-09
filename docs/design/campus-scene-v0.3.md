# Cảnh campus v0.3: cổng ba vòm và khuôn viên phía sau (hub `/play`)

- **Ngày:** 2026-10-08 · **Chủ sở hữu file:** art. Coder đọc và dựng theo, không cần hỏi lại số.
- **Yêu cầu của chủ dự án:** (1) "thêm cổng ba vòm vào cảnh"; (2) gửi hai ảnh flycam chụp từ sau và từ trên, kèm câu "có cả các cảnh sau lưng trường nữa này", tức là đưa phần phía sau nhà chính vào cảnh.
- **Nguồn:** [../research/vinuni-campus-reference.md](../research/vinuni-campus-reference.md) §2.7 (cổng: vị trí, hình, kích thước, màu), §2.8 (phía sau nhà chính: thứ tự, từng hạng mục, hồ, màu), [campus-scene-v0.2.md](campus-scene-v0.2.md) (mọi thứ không nhắc tới ở đây). Ảnh tham chiếu chỉ nằm trong scratchpad của phiên, không đưa vào repo. Vị trí tương đối các toà phía sau lấy từ OSM, © OpenStreetMap contributors (ODbL), rồi xếp gọn lại cho vừa sa bàn (§2.3).
- **Thay thế trong v0.2:** §1 mục 2 (camera không đổi) và mục 7 (ngân sách); §2.1 (sơ đồ và câu "các phần bỏ qua"); trong §2.2 các khối `WORLD_BOUNDS`, `ROUND_TREES` (3 cây), hồ, `LAKE_BLOCKS`, `OBSTACLES`; §2.4 (test); §3 (camera); §5.1 các dòng T1, T2, W1, W2; §5.9 (danh sách instance cây); §6 gạch đầu dòng cuối (sân vận động là YAGNI); §7 (ngân sách); §9 câu hỏi về cổng. Mọi mục khác của v0.2 giữ nguyên.
- **Phương án:** dựa trên phương án A (một sa bàn to hơn, đi bộ được ra phía sau), ghép thêm từ hai phương án còn lại. Từ C: mặt cổng sát mép đế và cả ba lòng vòm tô sắt tối, màu "mù xa" cho toà phía sau, test khung hình bốn cạnh, góc HUD và cửa sổ quanh kim tháp, lớp dán phẳng cách nhau ≥ 0,002. Từ B: màu phái sinh từ palette theme thay cho nhánh mái hông theo archetype; hàng "Đi tới khuôn viên phía sau" trong danh sách "Các khu"; lối đông lát đá có 2 đèn; khán đài và sân khấu ngoài trời; cổng town là hai trụ mở có lanh tô `lm.roof`, không có cánh sắt.
- **Coder sửa khi dựng (2026-10-08):** `CONTENT` làm tròn ra ngoài (§4.1); `HUD_CORNER` rộng 320 (§4.1); E1 kéo tới `x 13.1` (§6.1); viền chân toà phía sau và vệt tiếp đất cây công viên nâng lên trên cỏ công viên (§6.0); cột bãi đỗ dừng dưới mái nghiêng (§6.4); số tam giác gốc đo lại bằng `sceneBudget()` (§8). Mỗi chỗ có ghi chú "Sửa khi dựng".
- **Sửa sau QA (2026-10-08):** `routeTo` tìm đường thật bằng đồ thị tầm nhìn, bỏ 3 điểm chờ cố định (§2.5); `LAKE_BLOCKS` khớp lại theo bờ hồ mới (§2.2); sân khấu ngoài trời thành 3 bậc đặc (§6.1 S8); số tam giác đo lại (§8). Mỗi chỗ có ghi chú "Sửa sau QA".
- **Sửa sau QA vòng 3 (2026-10-08):** click lấy điểm trên bề mặt đầu tiên được vẽ dưới con trỏ (`clickGoal`), không lấy mặt đất nữa (§2.5 bước 2); `step()` đặt người chơi đúng vào điểm đích khi tới trong 0,08 (§2.5, §3). Mỗi chỗ có ghi chú "Sửa sau QA vòng 3".
- **Sửa sau QA vòng 4 (2026-10-08):** click vào toà khu vực nhận ra toà theo mesh bị chạm (`userData.site`), nên mái hiên của Chợ cũng dẫn tới cửa (§2.5 bước 2). Vật cản đài phun là 5 hộp nội tiếp vòng giậu thay cho một hình vuông (§2.3). Click vào chỗ lát đá trống mà chỉ bị chặn vì bán kính người chơi thì đứng ở điểm trống gần nhất (§2.5 bước 2). `step()` bỏ đích bị chặn ngay ở bức tường đầu tiên, không trượt dọc tường nữa (§3). Nhãn khu và dấu "!" bấm được (§2.6). Dời một cây mép tây để mở ô bị bịt cạnh Thư viện (§2.4). Mỗi chỗ có ghi chú "Sửa sau QA vòng 4".
- **N8 và N9 (2026-10-08):** ánh sáng nướng theo preset (ngày, hoàng hôn), bóng nắng, rim, bọt sóng, và cửa sổ khu mở sáng khi đã có sao. Chi tiết, số đo và API tiến độ ở §13; quyết định art ở art-direction §12.
- **Đã kiểm bằng blockout** `scratchpad/v03/final/blockout_v03.py` (không nằm trong repo). Script dựng lại mặt trước như code đang chạy, cộng toàn bộ bảng của file này. Nó mô phỏng `step()` cho 56 cặp điểm tương tác phía trước, 180 đường đi trước ↔ sau và 72 đường đi giữa các điểm phía sau, rồi vẽ 1280×800 và 375×812 cho cả hai theme. Ảnh và `metrics_<theme>.json` nằm cùng thư mục. Số tam giác ở §8 là số đếm theo công thức primitive của three.js; coder đo lại bằng `sceneBudget()`.

---

## 1. Quyết định chính

1. **Một sa bàn liền, to hơn.** Đế đất kéo ra sau 10,7 u (mép sau `z = −21,5`) và ra trước 1,8 u (mép trước `z = 12,6`). Cổng và hàng rào thành mép trước của sa bàn. Phía sau nhà chính có ba hàng (từ tháp ra): thư viện A và 2 cầu kính → H, G mái pin, hội trường B → công viên cây lưới, trạm chiller, sân tennis. Sân vận động chạy dọc mép đông, đúng hướng thật (trục dài theo trục chính). Không dựng hồ ở phía sau, vì thực tế không có (nghiên cứu §2.8.4).
2. **Đi bộ được ra phía sau** qua một lối lát đá chạy phía đông Tháp canh. Click-to-move và hàng "Đi tới khuôn viên phía sau" đi theo đường ngắn nhất do `routeTo()` tìm trên đồ thị tầm nhìn quanh các vật cản (§2.5). Bàn phím đi được thẳng qua lối đó.
3. **Camera đổi `CONTENT` và ngưỡng overview.** Ngưỡng hạ từ `fit ≥ 26` xuống `fit ≥ 22`, để các laptop phổ biến vẫn thấy cả sa bàn trong một khung. Zoom ở 1280×800 giảm từ 32,8 xuống 26,9 (cảnh nhỏ đi 18% theo chiều dài). Nhãn DOM vẫn 12 px và không chồng nhau.
4. **Cổng ba vòm** đứng trên trục, ở mép trước. Bệ cột áp tường nằm sát mép đế. Cả ba lòng vòm tô màu sắt tối `~iron`, nên từ camera đọc ra ba vòm, vòm giữa cao hơn. Dải vàng trơn, không có chữ. Theme town (`colonnades = false`) dùng cổng hai trụ mở với lanh tô `lm.roof` và hàng rào cây.
5. **Toà phía sau "mù xa" nhẹ:** tường, gờ, mái và mái vòm pha về trắng 15% sau khi nướng sáng (`haze`). Pin mặt trời, cầu kính và mọi mặt phẳng trên đất (đường chạy, sân, cỏ) giữ màu đậm để vẫn nhận ra. Ba khu chơi và tháp chính vẫn là các khối rõ nét nhất.
6. **Không thêm trường manifest, không đổi `schema.ts`.** Có 8 màu phái sinh mới trong `palette.ts` (§5.1). Town tự ra đường chạy màu đất sét, mái vòm xanh mòng két, mái phẳng xanh mòng két, nhờ công thức chứ không nhờ nhánh code.
7. **Ngân sách:** vẫn 13 draw call (toà phía sau gộp vào `G-terrain`, cổng vào `G-landmark`, cây công viên là instance của `I-round`). Tam giác đo được 19 248 (campus) / 16 186 (town), so với 14 754 / 12 282 của v0.2 (§8); trần 60k.

---

## 2. Bố cục (`layout.ts`, nguồn toạ độ duy nhất)

### 2.1 Sơ đồ (nhìn từ trên, x sang phải, z xuống dưới; 1 ô ≈ 2 u)

```
z=−21.5 ┌──────────────────────────────────────────────────────────────────┐
        │  công viên cây lưới (16 cây nhỏ)  │đường│ [tennis][đa năng]  ╭── đường chạy ──╮▌khán
 −19.4  │  ═══ lối ngang ════ ╲ lối chéo    │ sau │                    │   sân cỏ sọc   │▌đài
 −17.0  │                ┌chiller┐          ┌─── G (pin) ───┐ ┌─ B mái vòm ─┐  │                │▌
 −16.0  │ ┌──── H ────┐  └───────┘          │               │ │             │  │                │
 −13.3  │ └───────────┘                     └───────────────┘ ├┬┬ hiên 6 cột┤  ╰── cát ─────────╯
 −12.5  │ [mái pin] ═════════ lối 2 ════════ cầu kính ════════  sân trước B ◖sân khấu
 −11.0  │                    ┌── A (vườn mái) ──┐                 ═══ lối 1 ═══════════ ║
z=−9.9  │  (cây)   [chòi]══ cánh C ══[chòi] THÁP I [chòi]══ cánh E ══[chòi]  (cây)     ║ lối
        │                       … mặt trước như v0.2 …                   THÁP CANH   ║ đông
 −0.25  │                                            ════ nối ═══════════════════════╝ (2 đèn)
        │   VƯỜN HỒNG        ( hàng cột   ◎ ĐÀI PHUN   hàng cột )    CHỢ              │
 +10.8  │ ════════════════ đường vòng ═════════════════════════════   ≈≈≈ HỒ ≈≈≈≈≈≈≈≈  │
 +12.4  │ ┼┼┼┼┼┼ hàng rào ┼┼┼┼┼┼┼┼ [ CỔNG BA VÒM ] ┼┼┼┼ rào ┼┼┼ ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈  │
z=+12.6 └──────────────────────────────────────────────────────────────────┘
       x=−14.8                           x=0                                    x=+14.8
```

Đối chiếu với thực tế (nghiên cứu §2.8.2):

- **Đúng thứ tự:** trên trục là tháp → A → G → đường sau (lệch trái); bên trái là H, chiller, công viên cây lưới; bên phải là sân trước B → B → sân khấu ngoài trời ở góc trước-phải của B; sân tennis nằm phía tây sân vận động; bãi đỗ xe mái pin ở mép tây sau cánh C.
- **Xếp gọn có chủ đích:**
  - Phần sau bị nén theo trục khoảng 1,5–2 lần so với phần trước.
  - Sân vận động dời khoảng 3 u sang đông để nằm cạnh B thay vì sau B, nhưng giữ hướng thật.
  - H dời sang trái so với thực tế để không đứng sau kim tháp trên màn hình (§4.5).
- **Bỏ:** nhà thể thao K, ký túc xá, nhà nhỏ cạnh chiller, cầu kính thứ ba, nhánh hồ phía đông (bờ gần ở `x ≈ 21`, ngoài đế), đường Hải Đăng.

### 2.2 Hằng số (thay khối tương ứng trong `layout.ts`)

```ts
/** Soil block of the diorama; the white plate is 0.25 wider on every side (campus-scene v0.3). */
export const BASE = { minX: -14.8, maxX: 14.8, minZ: -21.5, maxZ: 12.6 } as const;
/** Where the player's centre may go: 0.8 inside the base at the sides and back, short of the gate in front. */
export const WORLD_BOUNDS = { minX: -14, maxX: 14, minZ: -20.7, maxZ: 11 } as const;
/** Lake: a quarter ellipse around the front-right corner of the base (moved here from campus.ts). */
export const LAKE = { x: 14.8, z: 12.6, rx: 8.2, rz: 6.8 } as const;
/** Gate on the axis at the front edge: the arch face, and the back of its cornice. */
export const GATE = { face: 12.42, back: 11.44, halfWidth: 2.8 } as const;
```

- `SPAWN`, `PLAZA`, `LANDMARK`, `SITES`, cửa, điểm quay về, cô Lan: **không đổi**.
- Hồ: `rz` tăng từ 5,0 lên 6,8 và tâm dời theo góc đế mới, nên bờ hồ cạnh Chợ gần như giữ chỗ cũ (ở `x = 9` bờ lùi 0,5 u).

```ts
/** The lake's shore line: its z at x, for x within LAKE.rx of the corner. */
const shoreZ = (x: number) => LAKE.z - LAKE.rz * Math.sqrt(1 - ((x - LAKE.x) / LAKE.rx) ** 2);
export const LAKE_BLOCKS: readonly Box[] = [7.0, 7.8, 8.6, 9.6, 10.6, 11.6, 12.8].map((x) =>
  span(x, LAKE.x, shoreZ(x), LAKE.z),
);
```

**Sửa sau QA:** bản đầu dời bốn hộp của v0.2 theo hồ mới mà không khớp lại, nên tâm người chơi vào được tới khoảng 2,0 u trong nước (ở `(11.0, 8.85)`, chỗ bờ ở `z ≈ 6.58`). Bảy hộp bậc thang trên có góc trong nằm đúng trên bờ, nên cả hộp nằm trong nước và bờ vẫn đi được. Tâm người chơi vào nước nhiều nhất 0,27 u (test giữ dưới 0,3). Hộp tự đi theo `LAKE` nếu hồ đổi.

### 2.3 Công trình phía sau (`BACK`, cùng là vật cản)

```ts
/** Back-of-campus footprints (campus-scene v0.3 §2.3); every one blocks the player. */
export const BACK = {
  annex: span(-3.8, 3.8, -11.8, -10.15),     // A: library, roof garden, against the tower's back
  solarHall: span(-2.6, 2.6, -16.6, -13.1),  // G: solar roof
  westHall: span(-14.5, -10.3, -16.0, -13.3),// H
  hall: span(4.2, 9.0, -17.6, -13.1),        // B: body + the two front pavilions (portico stays walkable)
  chiller: span(-6.9, -4.0, -18.6, -17.0),
  carports: span(-14.6, -11.6, -12.95, -11.65),
  stand: span(14.2, 14.75, -18.0, -14.2),
} as const;

export const OBSTACLES: readonly Box[] = [
  ...LANDMARK.footprints,
  ...SITES.map((site) => site.footprint),
  // The hedge ring as five boxes with their corners on it, 15° apart (QA r4).
  ...[15, 30, 45, 60, 75].map((degrees) => ({
    ...PLAZA,
    halfX: FOUNTAIN_RADIUS * Math.cos((degrees * Math.PI) / 180),
    halfZ: FOUNTAIN_RADIUS * Math.sin((degrees * Math.PI) / 180),
  })),
  ...ROUND_TREES.map((tree) => ({ x: tree.x, z: tree.z, halfX: 0.35, halfZ: 0.35 })),
  ...LAKE_BLOCKS,
  ...Object.values(BACK),
  NPC_BOX,
];
```

**Sửa sau QA vòng 4:** vòng giậu quanh đài phun tròn, bán kính 1,88, nhưng bản trước chặn cả hình vuông ngoại tiếp, cộng bán kính người chơi 0,35. Ở bốn góc hình vuông có khoảng 848 điểm lát đá nhìn thấy trống (lưới 0,1) bị coi là bị chặn, và click vào đó đẩy người chơi xuyên qua đài phun sang phía cổng. Giờ vật cản là 5 hộp có góc nằm trên vòng giậu, ở 15°, 30°, 45°, 60° và 75°. Theo đường chéo, vật cản chỉ ra tới 1,33 thay cho 1,88.

| Hạng mục | Footprint (x0, x1, z0, z1) | Cao tới | Toà thật (§2.8.3) | Ghi chú chặn |
|---|---|---|---|---|
| A, thư viện | −3,8, 3,8, −11,8, −10,15 | 1,36 | (1, 236), 74 × 40 m, 2 tầng | Chặn. Nằm sát lưng tháp, khoảng 80% bị khối đế tháp che |
| 2 cầu kính | x −2,25 và 1,0, rộng 0,54, z −13,1…−9,95 | y 1,36–1,70 | c ≈ −30 và +10 | Không chặn. Người chơi (cao 1,27) đi dưới cầu |
| G, mái pin | −2,6, 2,6, −16,6, −13,1 | 2,14 (hộp cửa trời) | (−1, 283), 49 × 54 m, 3 tầng | Chặn |
| H | −14,5, −10,3, −16,0, −13,3 | 1,57 | (−59, 292), 57 × 39 m | Chặn |
| B, hội trường | 4,2, 9,0, −17,6, −13,1 (thân tới −13,6, hai chòi trước nhô tới −13,1) | 2,70 (đỉnh vòm) | (60, 278), 67 × 66 m, vòm ≈ 22 m | Thân và chòi chặn. Hiên 6 cột không chặn (sàn 0,18, cột mảnh), đúng quy tắc v0.2 §1.6 |
| Chiller | −6,9, −4,0, −18,6, −17,0 | 0,62 (+ quạt) | (−73, 344) | Chặn. Cách G 1,4 u để có lối đi ở giữa |
| Bãi đỗ mái pin | −14,6, −11,6, −12,95, −11,65 | 0,42 | (−142, 222) | Chặn, vì mái 0,42 thấp hơn đầu người chơi |
| Khán đài | 14,2, 14,75, −18,0, −14,2 | 1,16 (mái che) | cạnh đông sân vận động | Chặn |
| Sân vận động, sân tennis, công viên, sân trước B, sân khấu | mặt phẳng (sân khấu: 3 bậc đặc thấp) | ≤ 0,18 | | Không chặn |

### 2.4 Cây

- `ROUND_TREES` (vẫn 23 cây, chặn): dời 3 cây mép đông để mở lối, từ `(13.3, −7.4)`, `(13.3, −4.4)`, `(13.3, −1.6)` sang `(13.75, −7.4)`, `(13.75, −4.4)`, `(13.75, −1.6)`.
- **Sửa sau QA vòng 4:** cây mép tây `(−13.4, −4.4)` dời sang `(−13.75, −4.4)`. Trước đó cây này, cây `(−13.4, −1.8)`, Thư viện và `WORLD_BOUNDS.minX` bịt kín một ô ở `x −14…−12,75`, `z −3,7…−2,5`. Click vào ô đó (tán cây nhô vào) không có đường, người chơi đi thẳng và dừng ở tường Thư viện. Giờ giữa cây và Thư viện có khe 0,3 u, ô đó nối với phần còn lại. Test kiểm mọi điểm đi được trên lưới 0,5 đều nối với `SPAWN`.
- `CYPRESS_TREES`: không đổi (18 cây).
- **Mới:** `PARK_TREES`, 16 cây nhỏ trong công viên cây lưới, **không chặn**:

```ts
/** Small trees of the back park, on a 1.2 grid; decoration only (campus-scene v0.3 §2.4). */
export const PARK_TREES: readonly Vec2[] = [
  v(-14.0, -17.3), v(-14.0, -18.8), v(-12.8, -17.3), v(-10.4, -20.3), v(-9.2, -20.3), v(-8.0, -18.8),
  v(-8.0, -20.3), v(-6.8, -20.3), v(-5.6, -20.3), v(-4.4, -20.3), v(-3.2, -17.3), v(-3.2, -18.8),
  v(-3.2, -20.3), v(-2.0, -17.3), v(-2.0, -18.8), v(-2.0, -20.3),
];
export const TREES: readonly Vec2[] = [...ROUND_TREES, ...CYPRESS_TREES, ...PARK_TREES]; // 57
```

Lưới gốc là `x = −14.0 + 1.2i`, `z ∈ {−17.3, −18.8, −20.3}`. Từ lưới đó bỏ ba nhóm điểm:
- điểm có `5.5 < x − z < 9.7` (dải sau kim tháp, §4.5);
- điểm trong sân chiller (`−7.4 < x < −3.5` và `z > −19.1`);
- điểm có `x ≥ −1.9` (đường sau).

### 2.5 Lối đi và định tuyến click

Lối nhìn thấy được (vẽ ở §6.1): nhánh nối từ lối đi bên thảm cỏ, lối đông có 2 đèn, lối 1 sau cánh E, lối 2 sau A.

```ts
/** A smaller z is behind the main building (the player's centre cannot be between −10.25 and −9.9 there). */
export const BACK_Z = -10.2;
/** Where "Đi tới khuôn viên phía sau" walks to: the near end of the running track, in clear view. */
export const BACK_SPOT: Vec2 = { x: 12.0, z: -12.3 };
```

**Sửa sau QA: `routeTo` tìm đường thật.** Bản đầu có 3 điểm chờ cố định (`LANE_MOUTH (12.7, −0.25)`, `LANE_ENTRY`, `LANE_WEST`) và đi thẳng tới điểm chờ đầu tiên. Từ khoảng 23% mặt đất phía trước (thảm cỏ phía tây, Vườn Hồng, quảng trường, bờ đông), chặng thẳng đó vướng hai cây thảm cỏ `(5.0, 0.6)`, `(5.6, 1.8)` hoặc cây `(12.8, 1.3)`. Hàng "Đi tới khuôn viên phía sau" và click ra phía sau khi đó dừng ở phía trước mà không báo gì. Thay bằng:

- **Đồ thị tầm nhìn** (`waypoints()`, dựng một lần khi cần):
  - Đỉnh là 4 góc của mọi vật cản nở thêm `PLAYER_RADIUS + LEG_MARGIN + 0.01`. `LEG_MARGIN = 0.05`, lớn hơn độ lệch của mỗi bước theo trục của `step()` (0,035).
  - Chỉ giữ góc "roomy": nằm trong `WORLD_BOUNDS` và cách mọi vật cản ít nhất `PLAYER_RADIUS + LEG_MARGIN`. Còn khoảng 114 đỉnh.
  - Hai đỉnh nối nhau khi đoạn thẳng giữa chúng cách mọi vật cản `LEG_MARGIN` (cắt Liang-Barsky).
- **`routeTo(from, to)`:**
  1. Đoạn `from → to` thông (lề 0) thì trả `[to]`, như v0.2.
  2. `to` bị chặn (toà, gốc cây, hồ, ngoài biên): điểm đứng là điểm roomy đầu tiên khi đi từ `to` về phía camera (`+x, +z`, bước 0,05), tức chỗ ngay trước mặt toà mà người chơi nhìn thấy.
     - **Sửa sau QA vòng 3:** bản trước lấy `to` là giao của tia click với mặt đất. Một điểm cao `h` trên toà rơi xuống đất ở `(x − h, z − h)`, sau lưng toà. Ở v0.3 chỗ đó là đất phía sau đi được, nên bước này không chạy và người chơi đi vòng lối đông ra sau (click kim tháp: đi 45 u). Giờ `clickGoal()` trong `useHubFrame.ts` lấy `to` là điểm chạm đầu tiên của tia với nhóm `statics` (5 mesh tĩnh và 2 mesh cây instanced, đúng thứ đang được vẽ), chỉ khi không chạm gì mới lấy mặt đất. Điểm chạm nằm trên mặt toà nên bị chặn, và bước này đặt người chơi trước mặt đó. Chạm footprint một toà khu vực (+0,2) thì đi tới cửa, như trước. Một lần raycast mỗi click qua khoảng 19 000 tam giác, vài ms. Nếu không có (hồ, ngoài sa bàn) thì lấy điểm roomy gần `to` nhất trên lưới 0,25. Đường đi tới điểm đứng rồi kết thúc bằng `to`: người chơi đi tới sát vật cản, như trước.
     - **Sửa sau QA vòng 4, cửa toà khu vực:** quy tắc "footprint + 0,2" bỏ sót phần nhô ra ngoài footprint. Mái hiên đỏ của Chợ, mặt dễ thấy nhất từ camera, nhô tới `z ≈ 5,84` (phía nam) và `x ≈ 11,65` (phía đông). Click vào đó đưa người chơi tới dưới mép hiên, cách cửa khoảng 2,2 u, ngoài `INTERACT_RADIUS`, nên không hiện gợi ý. Giờ `CampusScene` gắn `userData.site` cho 3 mesh toà khu vực, và `clickGoal` đi tới cửa khi mesh bị chạm có thẻ đó. Quy tắc footprint + 0,2 chỉ còn cho tia rơi xuống đất.
     - **Sửa sau QA vòng 4, chỗ trống sát vật cản:** nếu `to` nằm ngoài mọi hộp vật cản (lát đá cạnh vòng giậu, cỏ cạnh tường, tán cây, ngoài biên), tức chỉ bị chặn vì bán kính người chơi hay vì biên, thì điểm đứng là điểm roomy gần `to` nhất trong ô ±1 quanh nó (lưới 0,05). Chỉ khi ô đó không có điểm nào mới dùng cách đi về phía camera ở trên. Trước đó cách đi về phía camera đẩy người chơi xuyên qua đài phun sang phía cổng, có khi xa chỗ bấm 4,5 u.
     - **Sửa sau QA vòng 4, chặng cuối:** từ điểm đứng, `step()` bỏ `to` ngay ở bức tường đầu tiên mà một trục chạm (§3). Trước đó chặng này trượt dọc tường với tốc độ giảm dần, cảnh vẽ đủ khung hình thêm 8–13 s trong khi người chơi trông như đã dừng, có khi trượt xa điểm đứng tới 7 u.
  3. Dijkstra từ `from` qua đồ thị. `from` và điểm đứng nối vào đồ thị bằng đoạn thẳng lề 0, vì hai điểm này có thể sát vật cản hơn một đỉnh. Kết quả là đường ngắn nhất, chỉ bẻ ở góc vật cản.
  4. Không có đường nào: đi thẳng `[to]`. **Sửa sau QA vòng 4:** ô kẹt duy nhất (giữa hai cây và Thư viện ở `x −14…−12,8`, `z −3,7…−2,5`) đã được mở (§2.4), nên trên sa bàn hiện tại không còn chỗ nào rơi vào nhánh này.
- Mỗi lần gọi khoảng 0,3 ms. Lần đầu dựng đồ thị (và lưới điểm đứng) mất khoảng 20 ms.
- Cặp điểm tương tác phía trước phần lớn vẫn là `[to]`. Vài cặp sượt hộp cô Lan (ví dụ `SPAWN → NPC_TALK_SPOT`) giờ bẻ một lần ở góc hộp đó, dài hơn đường thẳng dưới 2%. v0.2 trượt dọc hộp ở đúng chỗ đó.
- Điểm kiểm phía sau (dùng trong test): `BACK_SPOT`, sân trước B `(6.6, −12)`, sân tennis `(2.5, −19.5)`, công viên `(−8, −19)`, cuối đường chạy `(12, −19.5)`, khe G–H `(−6, −14.5)`, lối 2 phía tây `(−9, −12.5)`, góc kẹt sau cánh C `(−6.5, −10.8)`, đường sau `(−0.9, −19.5)`. Hai điểm trên lối đông: `(12.7, −5)` và `(10.3, −7.5)`.
- Đã kiểm bằng script (scratchpad `v03/fix/`), đi bằng `step()` ở `dt` 1/60, 1/20 và 1/10:
  - Từ mọi ô 0,1 đi được, tới `BACK_SPOT`, `SPAWN`, chỗ đứng nói chuyện với cô Lan và góc sau-trái: 8 596/8 596 lần tới nơi, mọi chặng tới trong 0,08.
  - **Sửa sau QA vòng 3:** `step()` coi là tới đích khi còn cách ≤ 0,08 (`ARRIVE_DISTANCE`) nhưng trước đây không bước nốt. Chặng sau khi đó bắt đầu lệch tới 0,08 khỏi đường đã kiểm (lề chỉ 0,05, hoặc 0 ở chặng cuối), sượt hộp Tháp canh ở miệng lối đông và dừng giữa đường, không báo gì (26/20 000 cặp ngẫu nhiên, ví dụ `(−2.84, −17.44) → (−3.04, −0.74)`). Giờ khi tới trong 0,08, `step()` đặt người chơi đúng vào đích nếu đích không bị chặn, nên mỗi chặng bắt đầu đúng ở điểm chờ. Quét lại: 0/20 000 cặp ngẫu nhiên và 0/24 000 lần tới các điểm có tên, ở `dt` 1/60 và 1/30.
  - Hàng "Các khu" tới được phía sau từ 5 932/5 932 ô (bản đầu hỏng 1 380/5 999). Click từ `SPAWN` tới 2 174/2 174 ô.
  - Độ dài bằng đường ngắn nhất trên 25 122 cặp điểm.
  - Trên trình duyệt thật (bản build): các bước tái hiện của QA (giữ ArrowLeft 1,5 s, hoặc ArrowDown + ArrowLeft 1,2 s, rồi bấm hàng trong "Các khu") giờ tới phía sau ở cả 1280×800 và 375×812.

### 2.6 Nhãn DOM

Không đổi neo và không thêm nhãn mới. Lối đông có đèn và hàng "Đi tới khuôn viên phía sau" (§3) đã đủ để người chơi biết đường ra sau.

**Sửa sau QA vòng 4 (có từ v0.2):** nhãn trông như chip bấm được, nhưng trước đây là DOM `pointer-events-none`, nên click rơi xuống thứ vẽ phía sau. Nhãn "Tháp canh · Sắp mở" nằm đè cánh E và hiên hội trường B: không click nào trong nhãn tới được gợi ý Tháp canh (người chơi đi vòng 12–17 s ra sau). Nhãn Chợ chỉ tới gợi ý 18% số lần, nhãn Thư viện 47%. Dấu "!" đưa người chơi tới cửa Thư viện chứ không tới cô Lan. Giờ mỗi nhãn là một `<button>` `pointer-events-auto` trong `WorldLabels.tsx`: bấm thì `walkTo(site.door)`; dấu "!" thì `walkTo(NPC_TALK_SPOT)` rồi mở hội thoại khi tới, giống click vào cô Lan. Lớp nhãn vẫn `aria-hidden`, nút có `tabIndex -1`, vì danh sách "Các khu" vẫn là đường cho trợ năng. `onMouseDown` chặn mặc định để focus không nhảy vào nút, nên phím di chuyển vẫn tới cảnh.

---

## 3. Di chuyển, store và HUD

| File | Thay đổi |
|---|---|
| `movement.ts` | `isBlocked` và `step` nhận `bounds: { minX; maxX; minZ; maxZ }`. Kiểm tra là `p.x < b.minX \|\| p.x > b.maxX \|\| p.z < b.minZ \|\| p.z > b.maxZ` (2 dòng). **Sửa sau QA vòng 3:** tới trong `ARRIVE_DISTANCE` thì trả `position` là chính đích nếu đích không bị chặn (đích bị chặn thì giữ nguyên chỗ, để không đặt người chơi vào trong vật cản). **Sửa sau QA vòng 4:** với đích bị chặn, `targetDone` là đúng ngay khi một trục chạm tường (`blockedTarget && !(xFree && zFree)`), nên người chơi dừng ở bức tường đầu tiên thay vì trượt dọc nó |
| `store.ts` | `Motion` có thêm `route: Vec2[]` (các điểm còn phải đi sau `target`). Thêm `walkTo(goal)`: `const [next, ...rest] = routeTo(motion.position, goal)`; `target = next ?? null`; `route = rest`; tắt `talkOnArrival`; xoá phím; `wake()`. `placePlayer` đặt `route = []` |
| `useHubFrame.ts` | Phím di chuyển: xoá cả `target` lẫn `route`. Click đất hoặc toà: `state.walkTo(clickGoal(raycaster, statics))`, với `statics` là nhóm bọc 5 mesh tĩnh và 2 mesh cây trong `CampusScene` (**sửa sau QA vòng 3**, §2.5 bước 2). Luôn gán `motion.position = moved.position`, cả khi `step` vừa đặt người chơi vào đích. Click cô Lan: `state.walkTo(NPC_TALK_SPOT)` rồi `talkOnArrival = true`. Khi `targetDone`: `motion.target = motion.route.shift() ?? null`; chỉ mở hội thoại khi `target` đã là `null`. Khi hội thoại mở: xoá cả `target` lẫn `route`. Truyền `WORLD_BOUNDS` mới vào `step`. **Sửa sau QA vòng 4:** `clickGoal` đi tới cửa khi mesh bị chạm có `userData.site` (§2.5 bước 2) |
| `scene/CampusScene.tsx`, `scene/WorldLabels.tsx` | **Sửa sau QA vòng 4:** 3 mesh toà khu vực mang `userData={{ site: id }}`. Nhãn khu và dấu "!" là nút bấm được (§2.6) |
| `hud/HubTopBar.tsx` | Thêm một `<li>` ngay sau "Nói chuyện với cô Lan", cùng class nút. Chữ trên nút là "Đi tới khuôn viên phía sau" khi người chơi đang ở phía trước, "Về mặt trước" khi đang ở phía sau. Biến `inBack = motion.position.z < BACK_Z` đọc một lần trong `onClick` của nút "Các khu", lúc mở danh sách, rồi giữ bằng `useState`. Khi bấm: đóng danh sách, trả focus về nút "Các khu", gọi `hubStore.getState().walkTo(inBack ? SPAWN : BACK_SPOT)` |
| `scene/campus.ts` | `buildTerrain` lấy đế từ `BASE` (bỏ `WORLD_BOUNDS + 0.8`) và hồ từ `LAKE` trong `layout.ts` |

---

## 4. Camera và khung hình (`camera.ts`)

### 4.1 Hằng số

```ts
/** Screen-space bounds of the whole model, measured on the v0.3 blockout (base corners). */
export const CONTENT = { minX: -19.73, maxX: 26.03, minY: -12.05, maxY: 14.82 } as const;
/** Pixels kept free of scenery at both top corners in overview: HubTopBar lg:top-6 + h-11 + 8. */
export const HUD_CORNER = { width: 320, height: 76 } as const;
```

- **Sửa khi dựng:** đo trên geometry thật, `maxX` là 26,0215 và `minY` là −12,0433, nên số làm tròn gần nhất (26,02 và −12,04) làm test bốn cạnh đỏ. Hai biên này làm tròn ra ngoài; zoom ở 1280×800 vẫn 26,9.
- **Sửa khi dựng:** cụm nút phải ("Các khu" và nút đổi giao diện có tên theme dài nhất) bắt đầu ở `x ≈ 965` px, tức rộng khoảng 315 px, nên `HUD_CORNER.width` là 320 chứ không phải 200. Phần đế trong góc phải ở `y < 76` vẫn là trời (mép sau-phải của đế qua `x = 960` ở khoảng `y = 198`), test góc HUD vẫn xanh.

- Trong `viewFor`, đổi `if (fit >= 26)` thành `if (fit >= 22)`. Mọi thứ khác của camera giữ nguyên.
- Nguồn của bốn biên `CONTENT`:
  - `minX`: góc trước-trái của tấm đế.
  - `maxX`: góc sau-phải của tấm đế.
  - `minY`: góc trước-phải của tấm đế.
  - `maxY`: góc sau-trái của mặt đất (`sy = 14.82`). Ngôi sao (`sy = 11.51`) không còn là điểm cao nhất của khung.
- Kích thước khung: 45,75 × 26,86 (v0.2: 36,92 × 22,92).

### 4.2 Zoom theo viewport (đo bằng `viewFor` với `CONTENT` mới)

| Viewport | v0.2 | v0.3 (ngưỡng 22) | Nếu giữ ngưỡng 26 |
|---|---|---|---|
| 1280×800 | overview 32,8 | overview **26,9** | overview |
| 1366×657 | overview 26,6 | overview 22,7 | follow 40 |
| 1440×789 | overview 32,3 | overview 27,6 | overview |
| 1536×730 | overview 29,8 | overview 25,4 | follow 40 |
| 1280×720 | overview 29,3 | overview 25,0 | follow 40 |
| 1920×960 | overview 39,8 | overview 34,0 | overview |
| 1024×768 | overview 26,4 | **follow 40** (fit 21,3) | follow 40 |
| 375×812 | follow 29,8 | follow 29,8 | follow 29,8 |

1024×768 chuyển sang follow, chấp nhận được: viewport cỡ máy tính bảng ngang, và follow ở zoom 40 vẫn chơi được.

### 4.3 Độ đọc ở 1280×800 (overview)

| Thứ | v0.2 | v0.3 |
|---|---|---|
| Người chơi cao | 34 px | 28 px |
| Cửa Thư viện (rộng × cao) | 14 × 32 px | 11 × 26 px |
| Vòng tương tác rộng | 112 px | 92 px |
| Cổng (hộp bao) | | 129 × 140 px. Vòm giữa 25 × 42 px, vòm bên 13 × 25 px |
| Đường chạy (hộp bao) | | 255 × 147 px, lớn hơn B (177 × 162 px) |
| Nhãn (chữ 12 px, hộp đo) | | Thư viện (351–473, 193–219), Tháp canh (785–913, 330–356), Chợ (586–718, 489–515), dấu "!" của cô Lan (454–482, 274–302). Không nhãn nào chồng nhau hay chồng cụm HUD |

Vùng bấm là chính mesh của toà, kể cả mái hiên (**sửa sau QA vòng 4**); footprint + 0,2 chỉ dùng khi tia rơi xuống đất. Mỗi toà vẫn rộng hơn 70 px. Nhãn của toà cũng bấm được (§2.6). Tỷ lệ diện tích khung ở 1280×800: trời 55,6%, đất 25,3%, nhà chính 6,4%, toà phía sau 4,8%, ba khu chơi 3,9%, cổng + hàng rào + đường vòng 1,6%.

### 4.4 Điện thoại (375×812, follow 29,8)

- Khung thấy 12,6 × 24,8 u. `CONTENT` cao 26,86, nên camera giờ trượt cả theo chiều dọc, trong khoảng `sy ∈ [0.36, 2.42]` (khoảng 61 px).
- Ở `SPAWN`: thấy tháp, ngọn kim, H và bãi đỗ mái pin phía sau, Thư viện, cô Lan, đài phun, Chợ. Toà phía sau chiếm 4,5% khung.
- Đi tới quảng trường: thấy cổng ở mép trái (5,1% khung) cùng đài phun và Vườn Hồng.
- Ở `BACK_SPOT`: thấy B, đường chạy, khán đài, sân tennis. Camera chạm mép phải, nửa dưới khung là trời, giống các góc của v0.2.

### 4.5 Ba quy tắc khung hình (thành test, §9)

1. **Trong khung:** mọi đỉnh của `landmark` và `terrain` có `minX ≤ sx ≤ maxX` và `minY ≤ sy ≤ maxY` (v0.2 chỉ kiểm `maxY`).
2. **Góc HUD:** ở 1280×800 overview, không đỉnh tĩnh nào và không tán cây nào rơi vào hai hình chữ nhật `HUD_CORNER` ở góc trên. Blockout đo được 0 px khác trời trong hai góc này. Góc sau-phải của đế nằm ở khoảng `(1256, 380)` px, còn đỉnh góc sau-trái ở `y ≈ 24` px, giữa khung.
3. **Cửa sổ quanh kim tháp:** kim và đèn lồng giờ đứng trước nền cỏ chứ không trước trời. Để chúng vẫn đọc được, cửa sổ màn hình `sx ∈ [4.4, 6.35]`, `sy ∈ [8.1, 11.9]` không được chứa tam giác nào của `terrain` có đỉnh cao hơn `y = 0.05`, cũng không được chứa tán cây nào.
   - Trên mặt đất, dải này là `5.5 < x − z < 9.7` phía sau tháp.
   - Blockout đo: phần nền sau kim gồm 90% là cỏ và 10% là chính thân tháp; 0 px là toà phía sau hay cây.

---

## 5. Màu

### 5.1 Màu phái sinh mới (`palette.ts`, không thêm trường manifest)

Thêm helper `lerp = (a, b, t) => a.clone().lerp(b, t)`. Mọi phép tính làm trên màu linear như các khoá cũ. Hex là kết quả đổi về sRGB, sai số ±1.

| Khoá | Công thức (linear) | vinuni | town | Dùng cho |
|---|---|---|---|---|
| `~track` | `mul(lerpW(mk.roof, 0.06), 0.72)` | `#af4143` | `#a3613d` (đất sét) | Đường chạy |
| `~vault` | `lerp(lm.roof, water, 0.35)` | `#bfcacf` | `#639899` (mòng két) | Mái vòm B, mái trán tường hiên B |
| `~solar` | `lerpW(wt.roof, 0.03)` | `#33415a` | `#35474c` | Pin mái G, bãi đỗ mái pin, mái khán đài |
| `~sand` | `mul(path, 0.80)` | `#d6cfc4` | `#d5d0c5` | Vùng cát đầu đường chạy, sân lát mái A |
| `~court` | `mul(water, 0.78)` | `#80a5b9` | `#8bb9c1` | Mặt sân tennis và sân đa năng |
| `~asphalt` | `mul(band, 0.42)` | `#6e6b65` | `#656055` | Sân trước B |
| `~park` | `lerp(ground, trunk, 0.12)` | `#a3bc7e` | `#c1d2a7` | Cỏ công viên cây lưới (ngả ô liu) |
| `~iron` | `mul(lm.trim, 0.06)` | `#3b3a36` | `#36332d` | Lòng ba vòm cổng, song sắt hàng rào (mẫu ảnh `#3A3D40`) |

Màu cũ được dùng lại: `foliage` / `~cypress` cho sọc sân cỏ, `~hedge` cho viền sân tennis và hàng rào cây town, `~bloom` cho nửa vòng tròn trên mái tháp, `water` cho cầu kính, `lm.*` cho tường, gờ và mái phẳng.

### 5.2 "Mù xa" cho toà phía sau

- `PartStyle` có thêm `haze?: number`. Trong `part()`, sau khi nhân hệ số sáng `k`, pha màu về trắng: `c = c·k; c = c + (1 − c)·haze` (3 dòng).
- `HAZE = 0.15` (hằng trong `campus.ts`) áp cho các phần `lm.wall`, `lm.trim`, `lm.roof`, `~vault`, `~glass` và `~sand` của A, G, H, B, chiller, bãi đỗ và khán đài.
- Không áp cho `~solar`, cầu kính (`water`), `lm.accent` và mọi lớp dán trên đất.
- Mức 0,22 (khoảng mà C đề xuất) làm pin mái G bạc thành xám, mất dấu hiệu nhận dạng, nên chọn 0,15.

### 5.3 Manifest và `theme.css`

Không đổi.

---

## 6. Hình procedural chính xác

### 6.0 Quy ước

Như v0.2 §5.0: `box(x0,x1 | y0,y1 | z0,z1)`, `quad`, `arch`, `rect(… | y)`, `cyl`, `ring`; cờ AO, E như cũ; mặt `−x`, `−z` để trơn. Thêm ba điều:

- **H** là cờ `haze: HAZE` (§5.2).
- **Lớp dán phẳng mới** trên đất có `y ≥ 0.010` (tránh z-fighting khi khoảng sâu dài hơn). Hai lớp chồng lên nhau cách nhau ≥ 0,0005 theo `y`: cỏ công viên 0,010 → lối công viên 0,011; đường chạy 0,010 → sân cỏ 0,011 → vạch làn 0,0115 → sọc 0,012 → cát 0,013; viền sân 0,010 → sân 0,012 → lưới 0,013. Viền chân toà vẫn ở 0,006 như v0.2. **Sửa khi dựng:** viền chân 5 toà phía sau (T9b) đặt ở 0,0105 (trên cỏ công viên 0,010, dưới các lối 0,012) và vệt tiếp đất cây công viên (K3) ở 0,0125 (trên lối công viên 0,011); ở 0,006 chúng bị cỏ công viên che mất.
- **Hình mới, không cần helper mới:**
  - **Mái vòm:** `new CylinderGeometry(r, r, len, 10, 1, false, 0, π).rotateZ(π/2).scale(1, rise/r, 1).translate(cx, y0, cz)`, tức nửa trụ có trục theo x.
  - **Trán tường:** `new ExtrudeGeometry(new Shape([v2(x0,y0), v2(x1,y0), v2(xm,y1)]), { depth, bevelEnabled: false }).translate(0, 0, z0)`. `ExtrudeGeometry` đã có trong `primitives.ts`. Gán màu `{ top: ~vault, side: lm.trim }`, nên hai mái dốc lấy `~vault` và mặt tam giác lấy `lm.trim`.
  - **Đường chạy và sân cỏ:** quạt `groundTriangles` từ tâm qua 26 điểm `oval(xc, za, zb, r)`, gồm 13 điểm nửa tròn quanh `(xc, za)` và 13 điểm nửa tròn quanh `(xc, zb)`.
  - **Vạch làn:** dải rộng 0,04 đi theo đường bầu dục, 26 đoạn.

### 6.1 `G-terrain`: sửa và thêm (cả hai theme, rebuild khi đổi theme)

| # | Phần | Hình | Màu | Cờ | Tam giác |
|---|---|---|---|---|---|
| T1 | Đế đất | `box(BASE.minX,BASE.maxX \| −0.6,0 \| BASE.minZ,BASE.maxZ)` | `{top: ground, side: ~soil}` | | 12 (giữ) |
| T2 | Tấm đế trắng | `box(−15.05,15.05 \| −0.8,−0.6 \| −21.75,12.85)` | `plaza` | | 12 (giữ) |
| W1, W2 | Hồ, viền bờ | Như v0.2 nhưng dùng `LAKE` mới (`z = 12.6`, `rz = 6.8`) | như cũ | | giữ |
| F1 | Đường vòng sau cổng | `rect(−14.8,6.6 \| 10.5,11.2 \| 0.011)` | `path` | | 2 |
| E1 | Nhánh nối từ lối đi thảm cỏ | `rect(3.1,13.1 \| −0.55,0.05 \| 0.012)` (**sửa khi dựng:** tới 13,1 chứ không 12,3, nếu không góc nối với E2, đúng miệng lối đông `(12.7, −0.25)`, bị hở một ô 0,8 × 0,6) | `path` | | 2 |
| E2 | Lối đông | `rect(12.3,13.1 \| −10.25,−0.55 \| 0.012)` | `path` | | 2 |
| E3 | 2 đèn lối đông | `lamp()` như v0.2 L1–L3 tại `(13.4, −3.0)`, `(13.4, −7.0)` | `~band` / `~lit` E | | 88 |
| E4 | Lối 1 (sau cánh E) | `rect(4.1,13.1 \| −11.25,−10.25 \| 0.012)` | `path` | | 2 |
| E5 | Lối 2 (sau A) | `rect(−9.6,4.6 \| −12.95,−12.0 \| 0.012)` | `path` | | 2 |
| E6 | Sân trước B | `rect(4.6,8.6 \| −12.85,−11.25 \| 0.012)` | `~asphalt` | | 2 |
| E7 | Đường sau | `rect(−1.3,−0.5 \| −21.5,−16.6 \| 0.012)` | `path` | | 2 |
| K1 | Cỏ công viên | `rect(−14.6,−1.6 \| −21.4,−16.4 \| 0.010)` | `~park` | | 2 |
| K2 | Lối công viên | chéo: tứ giác `(−14.6,−17.1)`, `(−14.3,−16.9)`, `(−1.8,−21.4)`, `(−2.1,−21.4)`; ngang: `rect(−14.6,−1.6 \| −19.45,−19.25)`, `y 0.011` | `path` | | 4 |
| K3 | Vệt tiếp đất cây công viên | như T10 v0.2 (`r = 0.62·scale`), 16 đĩa | `~contact` | | 192 |
| S1 | Viền sân tennis | `rect(0.2,4.9 \| −21.1,−18.0 \| 0.010)` | `~hedge` | | 2 |
| S2 | 2 sân + lưới | `rect(x0,x1 \| −20.8,−18.3 \| 0.012)`, `(x0,x1) ∈ {(0.5,2.4), (2.7,4.6)}`; lưới `rect(x0,x1 \| −19.57,−19.53 \| 0.013)` | `~court` / `plaza` | | 8 |
| S3 | Đường chạy | quạt `oval(12.0, −13.6, −18.6, 2.1)`, `y 0.010` (ngoài: x 9,9–14,1, z −20,7…−11,5) | `~track` | | 26 |
| S4 | Sân cỏ | quạt `oval(12.0, −13.6, −18.6, 1.45)`, `y 0.011` | `foliage` | | 26 |
| S5 | 3 sọc cỏ | `rect(10.7,13.3 \| −18.6+0.833k, −18.6+0.833(k+1) \| 0.012)`, `k ∈ {1, 3, 5}` | `~cypress` | | 6 |
| S6 | Cát đầu gần trục | nửa đĩa quanh `(12.0, −13.6)`, `r 1.45`, phía `+z`, 12 đoạn, `y 0.013` | `~sand` | | 12 |
| S7 | 2 vạch làn | dải 0,04 theo `oval(…, r)`, `r ∈ {1.88, 1.66}`, `y 0.0115` | `plaza` | | 104 |
| S8 | Sân khấu ngoài trời | 3 bậc nửa vòng đặc, mỗi bậc từ mặt đất lên: `arcSlab(r0, r1, 0, π, 0, y, { x: 9.4, z: −12.25 })` (nửa phía `+x`; `arcSlab` nhận thêm tâm, mặc định vẫn là quảng trường): `(0.30,0.55)` cao `0.02` `lm.trim`; `(0.55,0.75)` cao `0.10` `ground`; `(0.75,0.95)` cao `0.18` `lm.trim`. **Sửa sau QA:** bản đầu là 3 vòng phẳng, hai vòng trên lơ lửng ở `y 0.10` và `0.18` không có bậc đỡ, nên nhìn như chữ "C" trắng vẽ trên cỏ | xem cột Hình | | 396 |
| T9b | Viền tối chân toà | Gọi lại `skirt()` của v0.2 cho 5 footprint `BACK.annex`, `solarHall`, `westHall`, `hall`, `chiller` | `~skirt → ground` | | 40 |

Không đổi các phần khác của §5.1 v0.2. Riêng nhóm toà phía sau (§6.4) cũng gộp vào `buildTerrain`, trong một hàm riêng `backCampus(pal)`.

### 6.2 `G-landmark`: cổng và hàng rào

**Theme có `colonnades = true` (campus).** Kích thước Wg 5,6 × Hg 2,8, sâu 1,16. Theo tỷ lệ của nghiên cứu §2.7.2:
- thân khối giữa 0,55 Wg, gờ mái 0,65 Wg;
- vòm giữa rộng 0,23 Wg, đỉnh ở 0,68 Hg;
- cánh bên 0,20 Wg, cao 0,63 Hg;
- vòm bên rộng 0,12 Wg, đỉnh ở 0,41 Hg.

Nghiên cứu cho 4,2 × 2 u theo tỷ lệ tháp. Ở đây phóng to 1,33 lần, vì ở zoom 26,9 cổng 4,2 u đọc như một khối cụt (blockout của phương án A).

| # | Phần | Hình | Màu | Cờ | Tam giác |
|---|---|---|---|---|---|
| G1 | Khối giữa | `box(−1.54,1.54 \| 0,2.62 \| 11.5,12.42)` | `lm.wall` | AO | 12 |
| G2 | Gờ mái nặng | `box(−1.82,1.82 \| 2.62,2.8 \| 11.44,12.5)` | `lm.trim` | | 12 |
| G3 | Dải vàng mảnh dưới gờ | `quad("+z", 12.42, 0, 2.57, 3.08, 0.05)` | `lm.accent` | | 2 |
| G4 | Attic nâng lùi vào | `box(−1.16,1.16 \| 2.8,3.0 \| 11.7,12.2)` | `lm.wall` | | 12 |
| G5 | Lòng vòm giữa (cánh sắt) | `quad("+z", 12.42, 0, 0.63, 1.29, 1.26)` + `arch("+z", 12.42, 0, 1.26, 0.645)` | `~iron` | | 10 |
| G6 | Dải vàng ngang đầu cột (vòng hoa) | `quad("+z", 12.42, 0, 2.1, 3.08, 0.08)` | `lm.accent` | | 2 |
| G7 | Huy hiệu trên đỉnh vòm | `box(−0.14,0.14 \| 1.93,2.2 \| 12.42,12.47)` | `lm.accent` | | 12 |
| G8 | 4 cột áp tường, `x ∈ {±0.86, ±1.28}` | bệ `box(x±0.12 \| 0,0.3 \| 12.42,12.6)` `lm.trim`; dải bệ `box(x±0.125 \| 0.22,0.27 \| 12.42,12.605)` `lm.accent`; thân `cyl(0.08,0.09,8 \| 0.3→1.98 \| x, 12.51)` `lm.wall`; đầu cột `box(x±0.12 \| 1.98,2.06 \| 12.42,12.6)` `lm.trim` | xem cột Hình | | 272 |
| G9 | 2 cánh bên, `s ∈ {−1, 1}` | thân `box(s·[1.54,2.66] \| 0,1.66 \| 11.6,12.36)` `lm.wall` AO; gờ `box(s·[1.54,2.8] \| 1.66,1.78 \| 11.55,12.42)` `lm.trim`; lòng vòm `quad("+z", 12.36, s·2.1, 0.405, 0.67, 0.81)` + `arch("+z", 12.36, s·2.1, 0.81, 0.335)` `~iron` | xem cột Hình | | 68 |
| F2 | Hàng rào đá-sắt, 2 đoạn `x ∈ [−14.55, −2.66]` và `[2.66, 6.4]` | bệ `box(x0,x1 \| 0,0.06 \| 12.38,12.52)` `lm.wall`; song `box(x0,x1 \| 0.06,0.26 \| 12.44,12.46)` `~iron`; 16 trụ `box(x±0.07 \| 0,0.32 \| 12.36,12.54)` `lm.wall` tại `x = −14.55 + k` (k = 0..11) và `x = 3.4 + k` (k = 0..3) | xem cột Hình | | 240 |

- **Mặt trước:** bệ cột G8 sát mép đế (`z = 12.6`); mặt vòm lùi 0,18. Không có gì đứng giữa cổng và camera.
- **Mặt `+x`** của cánh phải để trơn.
- **Không có chữ:** attic và các dải vàng đều trơn. Dòng chữ tên trường (nếu sau này cần) chỉ được nằm trong theme pack.
- **Va chạm:** mặt trong của gờ cổng ở `z = 11.44`, lớn hơn `WORLD_BOUNDS.maxZ + PLAYER_RADIUS = 11.35`, nên người chơi đi tới sát cổng mà cổng không phải là vật cản. Hàng rào cũng nằm ngoài vùng đi được. Đầu hàng rào bên phải dừng ở bờ hồ (`x ≈ 6.6` khi `z = 12.45`).

**Theme có `colonnades = false` (town):**

| # | Phần | Hình | Màu | Tam giác |
|---|---|---|---|---|
| GT1 | 2 trụ cổng + mũ | `box(s·[1.25,1.65] \| 0,1.3 \| 11.95,12.35)` `lm.wall` AO; `box(s·[1.2,1.7] \| 1.3,1.4 \| 11.9,12.4)` `lm.trim` | | 48 |
| GT2 | Lanh tô | `box(−1.7,1.7 \| 1.4,1.58 \| 12.0,12.3)` | `lm.roof` | 12 |
| F3 | Hàng rào cây, 2 đoạn `x ∈ [−14.55, −1.7]` và `[1.7, 6.4]` | `box(x0,x1 \| 0,0.26 \| 12.36,12.56)` | `~hedge` | 24 |

Cổng town không có cánh sắt: trong blockout của phương án B, cánh sắt đọc như một bức tường đen.

### 6.3 `spire-hall`: vườn mái (thêm vào `spireHall()`)

Ảnh từ trên cao cho thấy mái khối đế tháp là một vườn parterre chạy quanh bốn mặt, có nửa vòng tròn màu gạch ở giữa mỗi mặt. Camera chỉ thấy mặt trước và mặt phải. Cánh E có một vườn mái. Mặt mái nằm ở `y 3.02` (đỉnh gờ BB3).

| # | Phần | Hình | Màu | Tam giác |
|---|---|---|---|---|
| RG1 | 6 ô cỏ | Trước: `rect(x0,x1 \| −6.0,−5.3 \| 3.024)` với `(x0,x1) ∈ {(−3.0,−1.9), (−1.6,−0.45), (0.45,1.6), (1.9,3.0)}`. Phải: `rect(2.05,3.0 \| z0,z1 \| 3.024)` với `(z0,z1) ∈ {(−9.9,−8.1), (−7.1,−6.2)}`. Khe giữa các ô là màu gờ, đọc thành lối đi | `ground` | 12 |
| RG2 | 2 nửa vòng tròn | `CircleGeometry(0.42, 8, θ0, π).rotateX(−π/2).translate(x, 3.026, z)`: tâm `(0, −5.3)` với `θ0 = 0` (cong về `−z`); tâm `(3.0, −7.6)` với `θ0 = π/2` (cong về `−x`) | `~bloom` | 16 |
| RG3 | Vườn mái cánh E | `rect(x0,x1 \| −9.35,−6.5 \| 2.374)`, `(x0,x1) ∈ {(4.6,6.2), (6.5,8.1)}` | `ground` | 4 |

Theme town không có phần này: mái hông che kín khối đế, và mái cánh xanh mòng két chính là thứ làm town ra chất thị trấn.

### 6.4 Toà phía sau (trong `G-terrain`, cả hai theme)

| # | Phần | Hình | Màu | Cờ | Tam giác |
|---|---|---|---|---|---|
| A1 | A: thân, gờ, sân lát mái, 2 bồn cỏ | `box(−3.8,3.8 \| 0,1.3 \| −11.8,−10.15)` `lm.wall`; `box(−3.86,3.86 \| 1.3,1.36 \| −11.86,−10.1)` `lm.trim`; `rect(−3.7,3.7 \| −11.75,−10.2 \| 1.362)` `~sand`; `rect(x0,x0+2.9 \| −11.5,−10.45 \| 1.364)` `ground`, `x0 ∈ {−3.4, 0.5}` | xem cột Hình | AO, H (trừ bồn cỏ) | 30 |
| A2 | 2 cầu kính, `x ∈ {−2.25, 1.0}` | `box(x±0.27 \| 1.36,1.66 \| −13.1,−9.95)` `water`; nắp `box(x±0.3 \| 1.66,1.7 \| −13.1,−9.95)` `lm.trim` H | xem cột Hình | | 48 |
| GS1 | G: thân, gờ, mái | `box(−2.6,2.6 \| 0,1.8 \| −16.6,−13.1)` `lm.wall` AO; `box(−2.66,2.66 \| 1.8,1.86 \| −16.66,−13.04)` `lm.trim`; `rect(−2.55,2.55 \| −16.55,−13.15 \| 1.862)` `lm.roof` | xem cột Hình | H | 26 |
| GS2 | 2 mảng pin + 6 vạch khung | `rect(x0,x0+1.85 \| −16.3,−13.4 \| 1.864)` `~solar`, `x0 ∈ {−2.4, 0.55}`; vạch `rect(x0,x0+1.85 \| zk−0.02,zk+0.02 \| 1.866)` `lm.trim`, `zk = −16.3 + 0.725k`, k = 1..3 | xem cột Hình | (pin không H) | 16 |
| GS3 | Hộp cửa trời | `box(−0.4,0.4 \| 1.86,2.14 \| −15.8,−13.9)` | `lm.roof` | H | 12 |
| GS4 | Cửa sổ G | `quad("+z", −13.1, −2.2+0.55k, y, 0.26, 0.32)`, k = 0..8; `quad("+x", 2.6, −16.1+0.65k, y, 0.26, 0.32)`, k = 0..4; `y ∈ {0.45, 1.05, 1.5}` | `~glass` | H | 84 |
| H1 | H: thân, gờ, mái | `box(−14.5,−10.3 \| 0,1.5 \| −16.0,−13.3)` `lm.wall` AO; `box(−14.56,−10.24 \| 1.5,1.57 \| −16.06,−13.24)` `lm.trim`; `rect(−14.45,−10.35 \| −15.95,−13.35 \| 1.572)` `lm.roof` | xem cột Hình | H | 26 |
| H2 | 10 khoang cửa (trên vòm cao, dưới chữ nhật) | Mặt `+z`, `x = −14.1 + 0.7k` (k = 0..5); mặt `+x`, `z = −15.65 + 0.7k` (k = 0..3). Mỗi khoang: `quad(…, 0.4, 0.26, 0.36)` + `quad(…, 1.0, 0.26, 0.5)` + `arch(…, 1.25, 0.13)` | `~glass` | H | 120 |
| B1 | B: thân, gờ | `box(4.2,9.0 \| 0,1.5 \| −17.6,−13.6)` `lm.wall` AO; `box(4.14,9.06 \| 1.5,1.58 \| −17.66,−13.54)` `lm.trim` | xem cột Hình | H | 24 |
| B2 | Mái vòm cuốn, sống mái theo x | Nửa trụ (§6.0) `r 1.9`, dài 4.6, tâm `(6.6, 1.58, −15.6)`, `rise 1.12` (đỉnh `y 2.70`) | `~vault` | H | 40 |
| B3 | Sàn hiên | `box(5.25,7.95 \| 0,0.18 \| −13.6,−12.85)` | `lm.trim` | H | 12 |
| B4 | 6 cột hiên, `x = 5.5 + 0.44k`, `z −13.05` | thân `cyl(0.075,0.085,6 \| 0.18→1.4)` `lm.wall` H; đai giữa thân `cyl(0.095,0.095,6 \| 0.74→0.82)` và đầu cột `cyl(0.1,0.1,6 \| 1.3→1.4)` `lm.accent` | xem cột Hình | | 432 |
| B5 | Dầm hiên | `box(5.3,7.9 \| 1.4,1.56 \| −13.6,−12.88)` | `lm.trim` | H | 12 |
| B6 | Trán tường | Tam giác `(5.3,1.56)`, `(7.9,1.56)`, `(6.6,2.0)`, đùn từ `z −13.6` tới `−12.88` (§6.0) | `{top: ~vault, side: lm.trim}` | H | 8 |
| B7 | 2 chòi bậc hai bên hiên, `x ∈ {4.65, 8.55}` | `box(x±0.42 \| 0,1.95 \| −13.8,−13.1)`; `box(x±0.3 \| 1.95,2.25 \| −13.68,−13.22)` `lm.wall`; gờ `box(x±0.46 \| 1.95,2.0 \| −13.84,−13.06)` `lm.trim` | xem cột Hình | H | 72 |
| B8 | 5 cửa vòm mặt `+x` | `quad("+x", 9.0, −17.0+0.72k, 0.62, 0.3, 0.55)` + `arch("+x", 9.0, …, 0.9, 0.15)` | `~glass` | H | 50 |
| C1 | Chiller + 6 quạt | `box(−6.9,−4.0 \| 0,0.62 \| −18.6,−17.0)` `lm.trim` H; quạt `circle(0.24, 8 \| x, 0.625, z)` `~band`, `x ∈ {−6.35, −5.45, −4.55}`, `z ∈ {−18.2, −17.4}` | xem cột Hình | | 60 |
| C2 | Bãi đỗ mái pin, 2 dãy, `z ∈ {−11.95, −12.65}` | mái `PlaneGeometry(2.8, 0.6).rotateX(−π/2).rotateZ(−0.043).translate(−13.1, 0.36, z)` `~solar` (nghiêng 0,12 từ tây sang đông); 2 cột `cyl(0.03,0.03,4 \| 0→y_mái(x) − 0.005 \| x, z)` `~dark`, `x ∈ {−14.2, −12.0}` (**sửa khi dựng:** cột cao 0,38 xuyên qua mái ở đầu đông, nơi mái chỉ cao 0,31) | xem cột Hình | | 68 |
| S9 | Khán đài | 3 bậc `box(x0,14.75 \| 0,y1 \| −18.0,−14.2)` với `(x0,y1) ∈ {(14.2,0.25), (14.38,0.5), (14.56,0.75)}` `lm.trim` H; mái `box(14.1,14.8 \| 1.1,1.16 \| −18.1,−14.1)` `~solar`; 3 cột `cyl(0.03,0.03,4 \| 0.75→1.1 \| 14.7, z)` `lm.wall`, `z ∈ {−17.9, −16.1, −14.3}` | xem cột Hình | | 96 |

- Mặt camera không thấy được để trơn.
- A và hai cầu kính bị khối đế tháp che phần lớn (blockout: A còn khoảng 20%). Giữ chúng vì rẻ và vì chúng lấp khoảng đất trống ngay sau tháp mà ảnh nào cũng thấy.

### 6.5 Cây công viên (`I-round`)

`TREE_INSTANCES` dựng từ ba danh sách, mỗi danh sách có loại và hệ số cỡ riêng:
- `ROUND_TREES`: `"round"`, hệ số 1;
- `CYPRESS_TREES`: `"cypress"`, hệ số 1;
- `PARK_TREES`: `"round"`, hệ số 0,55.

`scale = factor·(0.9 + 0.22·hash)`. Cây công viên đi vào cùng `InstancedMesh` cây tròn (23 → 39 instance), không cần geometry mới. Vệt tiếp đất K3 tự nhỏ theo `scale`.

Từ v0.2, loại cây đã lấy theo danh sách chứa nó, nên chỉ cần bỏ phép so `i < ROUND_TREES.length`.

---

## 7. Theme và thương hiệu

- Không có chuỗi thương hiệu trong `frontend/app`. Tên trong code đều trung tính: `BACK.hall`, `solarHall`, `westHall`, `annex`, `stand`, `GATE`, `routeTo`. Chữ trên giao diện là tiếng Việt chung, không có tên trường.
- Theme quyết định mọi khác biệt, không cần trường mới:
  - `colonnades`: cổng ba vòm + hàng rào đá-sắt, hay cổng hai trụ + hàng rào cây.
  - `archetype`: có hay không vườn mái tháp.
  - Màu phái sinh (§5.1): đường chạy đỏ gạch hay đất sét, mái vòm xanh xám hay xanh mòng két, mái phẳng H/G trắng xám hay xanh mòng két.
- Blockout town đọc ra một khu hành chính của thị trấn: mái xanh mòng két, sân thể thao màu đất sét, cổng trụ có lanh tô. Không ra "campus thứ hai".
- Bỏ nhánh mái hông theo archetype mà phương án C đề xuất. Màu phái sinh đã đủ để town đọc ra thị trấn.
- Nhà thể thao K, ký túc xá và nhánh hồ đông vẫn ngoài đế: YAGNI.

---

## 8. Ngân sách (đếm theo công thức primitive của three.js; coder đo lại bằng `sceneBudget()`)

| Nhóm | Thêm (campus) | Thêm (town) | Gồm |
|---|---|---|---|
| `G-terrain` | +2 156 | +2 156 | Lối và đèn 100, công viên 198, sân tennis 10, sân vận động 174, sân khấu 396, viền chân toà 40, đường vòng 2, toà phía sau 1 236 (A 30, cầu 48, G 138, H 146, B 650, chiller 60, bãi đỗ 68, khán đài 96) |
| `G-landmark` | +674 | +84 | Campus: cổng 402, hàng rào 240, vườn mái 32. Town: trụ cổng + lanh tô 60, hàng rào cây 24 |
| `I-round` | +1 664 | +1 664 | 16 instance × 104 |
| **Tổng thêm** | **+4 494** | **+3 904** | |
| **Tổng cảnh** | **19 248** (14 754 + 4 494), đo bằng `sceneBudget()` | **16 186** (12 282 + 3 904), đo bằng `sceneBudget()` | 13 draw call, không đổi |

- So với brief: 33% trần draw call (13/40); khoảng 32% trần tam giác (19,2k/60k).
- Bộ nhớ đỉnh tăng khoảng 4,2k × 3 × 24 B ≈ 0,3 MB.
- Vẫn 4 program shader. Không thêm bóng, không thêm postprocessing; mọi mặt tĩnh vẫn nướng sáng vào vertex colour.
- Chunk `/play`: ước thêm khoảng 3–4 kB gzip (262 → khoảng 266 kB, trần 300). Không thêm dependency.
- **Sửa khi dựng:** số gốc 16 238 / 13 768 đã cũ. Đo `sceneBudget()` trên mã v0.2 ở HEAD ra 14 754 / 12 282. Phần thêm khớp đúng bảng trên (+4 170 / +3 580 lúc dựng). **Sửa sau QA:** sân khấu thành bậc đặc thêm 324 tam giác cho cả hai theme. Đo trên trình duyệt thật (bọc lệnh vẽ WebGL): 12 lệnh vẽ mỗi khung, 19 168 / 16 106 tam giác, đúng bằng `sceneBudget()` trừ 80 tam giác của vòng tương tác đang ẩn.
- **Sửa sau QA vòng 4:** số tam giác phụ thuộc trạng thái ba khu. `sceneBudget()` ra 19 248 / 16 186 khi Thư viện mở và hai khu kia sắp mở (đúng trạng thái test dựng), 19 128 / 16 066 khi cả ba mở, 19 220 / 16 158 khi cả ba sắp mở. Ghi chú trong test ghi rõ trạng thái. Sửa vòng 4 không đổi hình học.
- `scene.test.ts`: giữ `drawCalls ≤ 16`, đổi `triangles ≤ 23 000` (số đo lớn hơn, lúc dựng 18 924, cộng khoảng 22%; sau QA là 19 248, vẫn dưới trần, theo quy tắc của v0.2 §7). Ghi chú trong test ghi số đo của từng archetype.

---

## 9. Test cần sửa hoặc thêm

| File | Thay đổi |
|---|---|
| `layout.test.ts` | Số cây 41 → 57; kiểm cây nằm trong `WORLD_BOUNDS` theo min/max. Kiểm "đĩa 0,9 quanh cây tròn" cho cả footprint `SITES` lẫn `BACK`; thêm "đĩa 0,5 quanh cây công viên không giao `BACK`". **Thêm** (đi theo `routeTo` nghĩa là gọi `step` tới từng điểm chờ, mỗi chặng phải tới trong 4 000 bước và cách đích ≤ 0,08): (1) 56 cặp phía trước đi theo `routeTo` tới nơi, đường dài dưới 1,02 lần đường thẳng (**sửa sau QA**, thay cho "`routeTo` trả về đúng `[to]`"); (2) 180 đường trước ↔ sau và 72 đường giữa các điểm phía sau, danh sách điểm như §2.5; (3) **sau QA:** quét mọi điểm đi được trên lưới 0,5 nối với `SPAWN`, đi theo đường của hàng "Các khu" (tới `BACK_SPOT` nếu đang ở trước `BACK_Z`, tới `SPAWN` nếu ở sau); (4) **sau QA vòng 3:** hai cặp QA tìm ra, `(−2.84, −17.44) → (−3.04, −0.74)` và `(0.2, −17.5) → (−4.8, −0.72)`, đi tới nơi (thay cho test "click vào đất dưới tháp `(0, −9.5)`", vốn không phải chỗ một click cao trên tháp rơi xuống; test click thật nằm ở `scene.test.ts`); (5) **sau QA:** hồ: không điểm đi được nào nằm trong elip `LAKE` thu nhỏ 0,3; (6) `GATE.back ≥ WORLD_BOUNDS.maxZ + PLAYER_RADIUS`; `BACK_SPOT` không bị chặn; (7) **sau QA vòng 4:** click vào lát đá quanh vòng giậu (cách giậu 0,02–0,8, mỗi 10°, cộng điểm `(−2.2, 3.4)` của QA) dừng trong 0,5 u quanh chỗ bấm; (8) **sau QA vòng 4:** với mọi điểm bị chặn trên lưới 0,5 phủ đế nới 1 u (hơn 2 000 điểm), `routeTo` kết thúc bằng `[điểm đứng, to]` và chặng cuối xong trong 30 khung (0,5 s ở 60 Hz); (9) **sau QA vòng 4:** quét lưới 0,5 của test "Các khu" kiểm số điểm nối với `SPAWN` bằng số điểm đi được, tức không còn ô bị bịt |
| `movement.test.ts` | `BOUNDS = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }`; kiểm `position.x ≤ BOUNDS.maxX`. **Sau QA vòng 3:** tới trong 0,08 thì `position` bằng đích; đích bị chặn thì không đặt vào. **Sau QA vòng 4:** đích bị chặn thì `targetDone` ngay khi một trục chạm tường, còn đích trống thì vẫn trượt dọc tường. Các test khác giữ |
| `store.test.ts` | Thêm: từ `SPAWN`, `walkTo(BACK_SPOT)` đặt `[target, ...route]` bằng `routeTo(SPAWN, BACK_SPOT)`, có ít nhất 2 điểm và điểm cuối là `BACK_SPOT`; `placePlayer` xoá `route` |
| `camera.test.ts` | 1280×800: overview, zoom 26,9 ±0,1. Test "chỉ trượt ngang trên điện thoại dọc" đổi thành "trượt dọc nhưng không quá model": `desiredCentre({sx: 0, sy: 0}, {sx: 0, sy: 9}, view).sy` ≈ `CONTENT.maxY − 740 / (2·zoom)` (= 2,42). "Không thấy quá mép model": so với `CONTENT.maxX` (26,03) thay cho 18,46. Thêm: 1366×657 là overview (fit 22,7); 1024×768 là follow |
| `scene.test.ts` | Trần tam giác 23 000 (§8). Test khung hình: kiểm cả bốn cạnh `CONTENT` cho `landmark` và `terrain`. **Thêm:** (1) góc HUD: chiếu đỉnh của `landmark`, `terrain` và tâm tán mọi `TREE_INSTANCES` ra pixel ở 1280×800 overview, rồi kiểm không điểm nào rơi vào hai hình chữ nhật `HUD_CORNER` ở góc trên; (2) cửa sổ kim tháp: hằng `CROWN_WINDOW = { minX: 4.4, maxX: 6.35, minY: 8.1, maxY: 11.9 }` (đơn vị màn hình, đặt trong test, ghi chú lấy từ đèn lồng và ngôi sao). Mọi tam giác của `terrain` có đỉnh cao hơn `y = 0.05` phải có hộp bao màn hình nằm ngoài cửa sổ. Mọi tán cây (tâm `(x, 1.55·scaleY, z)`, nửa cỡ `0.8·scale`) cũng vậy. Blockout cho 0 vi phạm ở cả hai theme; (3) **sau QA vòng 3:** với mỗi theme, bắn tia theo hướng camera `(−1, −1, −1)` qua các điểm trong phần cao của toà chính (spire-hall: ngôi sao, đèn lồng, tầng 4; clock-tower: đỉnh, mái và thân tháp đồng hồ) và đỉnh Tháp canh vào 5 mesh tĩnh, lấy `clickGoal`, đi theo `routeTo` từ `SPAWN` bằng `step()`. Mọi điểm chờ trừ điểm cuối và chỗ dừng phải có `z > −6`, tức trước mặt nhà chính. Bản ground-plane trước đó làm test đỏ ở cả hai theme (dừng ở `z −6,41`); (4) **sau QA vòng 4:** nhóm tĩnh trong test dựng như `CampusScene` (3 toà khu vực gắn `userData.site`, thêm 2 mesh cây instanced), và tia qua 3 điểm trên mái hiên nam và đông của Chợ phải cho cửa Chợ ở cả hai theme |
| `e2e/play.spec.ts` | **Thêm** "đi ra khuôn viên phía sau và quay về từ danh sách các khu" (`test.slow()`): mở "Các khu" → bấm "Đi tới khuôn viên phía sau" → danh sách đóng → chờ cảnh đứng yên (thêm tham số timeout cho `waitForIdleScene`, dùng 45 s) → mở lại "Các khu" thấy "Về mặt trước" → bấm → chờ đứng yên → mở lại thấy "Đi tới khuôn viên phía sau" → không có lỗi console. **Thêm**, chỉ chạy ở project desktop: hộp bao của "Về trang chủ", "Các khu" và nút đổi giao diện nằm trong `HUD_CORNER` (import từ `app/features/campus/camera.ts`), nên một thay đổi CSS sẽ làm test đỏ ngay. **Sau QA vòng 4**, chỉ chạy ở project desktop: bấm điểm ảnh của mái hiên nam Chợ (tính bằng `viewFor`, `cameraCentre`, `toScreen`) thì hiện "Chợ model · Sắp mở"; bấm nhãn "Tháp canh" thì hiện "Tháp canh · Sắp mở"; bấm dấu "!" thì mở hội thoại cô Lan. Chạy `npm run test:e2e` |

---

## 10. Việc của coder (theo thứ tự)

1. `layout.ts`: thêm `BASE`, `WORLD_BOUNDS` (min/max), `LAKE`, `LAKE_BLOCKS`, `GATE`, `BACK`, 3 cây dời, `PARK_TREES`, `TREES`, `OBSTACLES`, các hằng lối đi và `routeTo` (§2). Sửa `movement.ts` (§3) và test của hai file.
2. `palette.ts`: helper `lerp` và 8 khoá ở §5.1. `primitives.ts`: thêm cờ `haze` vào `PartStyle` và `part()` (§5.2).
3. `campus.ts`:
   - `buildTerrain` dùng `BASE` và `LAKE`, cộng §6.1 và `backCampus(pal)` (§6.4).
   - `buildLandmark` cộng cổng và hàng rào theo `colonnades` (§6.2), và vườn mái trong `spireHall()` (§6.3).
   - `TREE_INSTANCES` dựng theo §6.5.
4. `store.ts` (`route`, `walkTo`), `useHubFrame.ts` (định tuyến, hàng đợi điểm chờ, bounds), `HubTopBar.tsx` (hàng mới), theo §3.
5. `camera.ts`: `CONTENT`, ngưỡng 22, `HUD_CORNER` (§4). Sửa `camera.test.ts`.
6. `scene.test.ts`, `store.test.ts`, `e2e/play.spec.ts` theo §9.
7. `frontend-architecture.md` §3: cập nhật dòng ngân sách (13 draw call, 19 248 / 16 186 tam giác sau QA).
8. Chạy `npm run format`, `npm run check`, `npm run build`, `npm run test:e2e -- --workers=1`, rồi chụp ảnh theo §11.

---

## 11. Ảnh cần chụp (so với blockout trong `scratchpad/v03/final/`)

Dùng helper chụp của phiên (`shots-v02.mjs`, tham số `outDir port`) trên bản build. Chạy một server, chụp xong thì tắt.

| Ảnh | Viewport | Theme | So với blockout | Cần thấy |
|---|---|---|---|---|
| Overview | 1280×800 | vinuni, town | `<theme>_1280x800_overview.png` | Cả sa bàn trong một khung; hai góc HUD là trời; nhãn không chồng nhau; ba vòm đọc rõ; đường chạy đỏ (town: đất sét) ở góc phải; kim tháp đứng trên nền cỏ, không có toà nào sau nó |
| Overview | 1366×657 | vinuni | (đo `viewFor`) | Vẫn là overview, zoom ≈ 22,7 |
| Spawn | 375×812 | vinuni, town | `<theme>_375x812_spawn.png` | Như §4.4 |
| Cổng | 375×812 | vinuni, town | `<theme>_375x812_gate.png` | Đi bàn phím tới quảng trường: ba lòng vòm tối (town: hai trụ và lanh tô) |
| Phía sau | 375×812 | vinuni | `<theme>_375x812_back.png` | Sau khi bấm "Đi tới khuôn viên phía sau": B, hiên cột vàng, đường chạy, khán đài |
| Cận cổng, cận phía sau, cận kim | cắt từ ảnh 1280 | vinuni, town | `<theme>_crop_gate.png`, `_crop_back.png`, `_crop_crown.png` | |

---

## 12. Bỏ qua, rủi ro, câu hỏi mở

- **Cảnh nhỏ đi 18%** ở 1280×800 (người chơi 28 px, cửa 11 × 26 px). Zoom 1280×800 còn cách ngưỡng mới 22% (26,9 so với 22). 1366×657 chỉ cách 3%: nếu đế còn lớn thêm, máy đó sẽ rơi sang follow.
- **Phương án dự phòng:** nếu chủ dự án thấy cảnh nhỏ đi là không chấp nhận được, dùng phương án C của vòng này (scratchpad `v03/C-backdrop/`). C giữ camera và zoom v0.2, toà phía sau chỉ là phông nền không đi vào được. Cổng, màu phái sinh và các test khung hình ở file này dùng được nguyên cho C.
- **Kim tháp mất nền trời**, giờ đứng trước nền cỏ. Quy tắc cửa sổ §4.5 giữ cho nó đọc được, nhưng cũng khoá vùng `5.5 < x − z < 9.7` phía sau tháp, không được đặt toà hay cây ở đó về sau.
- **Bố cục phía sau xếp gọn**, không đúng toạ độ thật (§2.1). Chủ dự án là người gửi ảnh, có thể nhận ra sân vận động bị dời sang cạnh B.
- **Định tuyến** (§2.5, sửa sau QA): đường ngắn nhất tính theo hộp vật cản chứ không theo hình tròn của gốc cây, nên quanh cây người chơi bẻ ở góc hộp. Click vào một toà thì người chơi đứng ở mặt toà quay về phía camera, kể cả khi đang ở phía sau (đi vòng ra trước, như bản đầu). Từ QA vòng 3, "click vào toà" là tia chạm mesh của toà, kể cả phần cao (kim, đèn lồng, đỉnh Tháp canh, mái G, B, H). Click vào tán cây cũng dừng ở cây đó, không rơi xuống đất sau cây. **Sau QA vòng 4:** click vào một mái (ví dụ cánh E) vẫn có thể cho điểm đứng ở mặt mà đường chéo về phía camera gặp trước, như hốc giữa đầu đông nhà chính và lưng Tháp canh; giờ người chơi dừng ngay ở đó chứ không trượt tiếp. Click vào mái thư viện A phía sau tháp (khoảng 6 ô 16 px) vẫn đưa người chơi ra trước cánh E, chấp nhận được.
- **Nhãn thế giới "Khuôn viên phía sau"** gần đầu lối đông (phương án B gợi ý): bỏ qua. Lối có đèn và hàng trong danh sách các khu đã đủ. Thêm khi playtest cho thấy người chơi không tìm ra lối.
- **Khối lượng code:** khoảng 150 dòng hình học trong `campus.ts`, khoảng 90 dòng định tuyến (sau QA), 10 dòng store và frame loop, 1 hàng HUD, cộng test. `movement.ts` đổi kiểu bounds, và từ QA vòng 3 đặt người chơi đúng vào đích khi tới (1 dòng).

**Chủ dự án chốt (2026-10-08), theo mặc định của tài liệu:** giữ màu đường chạy như hiện tại; click vào mái thư viện A phía sau tháp cho người chơi đứng trước cánh E là chấp nhận được; giữ bố cục phía sau đã xếp gọn (toà H và sân vận động không dời về toạ độ thật). Bản công khai dùng theme town, nên các chi tiết riêng của theme campus chỉ thấy ở bản nội bộ.

---

## 13. N8 và N9 (2026-10-08): ánh sáng nướng và hậu quả trên campus

Nguồn: báo cáo "Insight edtech nâng cấp V-Game", hàng N8 và N9 của bảng "Làm ngay". Quyết định art (giờ mặc định, ngoại lệ QA, luật cửa sổ) ở art-direction §12. Mục này thay v0.2 §4.3 (ánh sáng) và bổ sung §8 (ngân sách).

### 13.1 Preset ánh sáng (dữ liệu theme)

- `campus.lights = { default: "day" | "dusk", day: Preset, dusk: Preset }` trong `manifest.json`, kiểm bằng `schema.ts`. `Preset = { sky, ground, hemisphere, sun, sunIntensity, sunDirection, rim }`: đúng tham số của `HemisphereLight` và `DirectionalLight`, cộng hệ số rim.
- `palette(campus, time)` đổi preset ra hệ số linear, `shade(n, light)` trả màu theo kênh (art §2.3). `part(geometry, style, light)` nướng; `light = null` giữ màu trơn cho Lambert (người, cây). `CampusScene` đặt hai đèn theo đúng preset, nên Lambert và hình nướng cùng tông.
- Hai theme hiện dùng cùng giá trị:

| Preset | `sky` | `ground` | `hemisphere` | `sun` | `sunIntensity` | `sunDirection` | `rim` |
|---|---|---|---|---|---|---|---|
| `day` (QA vòng 2) | `#d0e5ff` | `#bfb5a9` | 3.054 | `#ffd059` | 1.561 | `[-0.35, 1, 0.75]` | 0.25 |
| `dusk` | `#9dccff` | `#f4d9f2` | 1.262 | `#ffb736` | 2.661 | `[-0.62, 0.55, 0.6]` | 0.6 |

- Các số được giải ngược từ mục tiêu theo mặt (trên, trái `+z`, phải `+x`), rồi làm tròn về hex. Preset ngày giữ mặt trên ở `(1, 1, 1)` sau khi cắt, kể cả sai số làm tròn hex.
- Sửa sau QA vòng 2 (2026-10-08): preset ngày giải lại cho mặt bên ấm và lạnh rõ hơn: trái `(0.860, 0.795, 0.709)`, phải `(0.560, 0.605, 0.679)`, độ sáng vẫn 0.80 / 0.60 (art §2.3). Bản vòng 1 là `#eff5ff` / `#c6c5c2` / 2.572 / `#fff0d0` / 1.197, mặt bên chỉ lệch v0.3 khoảng 2 mức. Bộ giải: `scratchpad/n8/tune-r2.mjs` (ngoài repo), chạy lại với đích vòng 1 thì ra đúng preset vòng 1.
- Trời: `--vg-scene-dusk` trong `theme.css` (`#e7cfc3` cả hai theme), token `bg-scene-dusk` trong `app.css`. Khung chứa canvas tô màu này ở hoàng hôn.
- Giờ đang dùng: `hubStore.time ?? campus.lights.default`. `time` là `null` cho tới khi người chơi bấm nút "Hoàng hôn" (art §8.4); chỉ giữ trong phiên.
- Đổi giờ thì `pal` đổi, mọi nhóm dựng lại một lần, các geometry cũ được `dispose()`. Riêng phần dựng hình, đo trong Node trên máy dev: 26–34 ms (campus), 19–23 ms (town). Sửa sau QA vòng 1, đo trong trang (bản build, SwiftShader headless, 1280×800): mỗi lần bấm là một long task 51–57 ms trên luồng chính, tức khoảng 55 ms; CPU chậm 4× thì 90–528 ms, lần bấm đầu nặng nhất (vinuni 528 ms, town 210 ms), tức tới khoảng 0,5 s. Chưa đo trên GPU tích hợp. Mỗi lần bấm vẽ vài khung rồi đứng yên (3, đo lại ở QA vòng 3, xem dưới); sau 7 lần bấm số bộ đệm GL vẫn 34, không rò. Không sửa code: chỉ là một lần bấm.
- Sửa sau QA vòng 2 (2026-10-08): `CampusScene` đọc giờ qua `useDeferredValue`, nên cú bấm vẽ nút đã bấm trước rồi mới dựng lại ở lượt render nền. Event Timing của cú bấm (bản build, SwiftShader, 1280×800, 4 lần mỗi theme, `scratchpad/n8/inp-r2.mjs`): trước 24–48 ms (CPU 1×) và 112–272 ms (4×), sau 16 ms và 16–40 ms. Long task dựng lại vẫn còn, sau khung đã vẽ: 107–210 ms ở 4×. Không giữ sẵn geometry hai preset (art §12 mục 7).
- Sửa sau QA vòng 3 (2026-10-09), chỉ sửa tài liệu: mỗi lần bấm, bằng chuột hay bằng phím, vẽ 3 khung chứ không phải 1 (`scratchpad/n8/frames-r5.mjs`, bản build, hai theme, 4 lần bấm mỗi theme: lần nào cũng 3). Theo QA, khung đầu là lượt render khẩn cấp vẽ lại hình cũ trước lượt dựng lại đã hoãn, nên trung bình tam giác mỗi khung lệch về hình cũ. QA đo long task dựng lại ở CPU 1× (SwiftShader, 1280×800): vòng 3 là 97–146 ms, vòng 4 thấp nhất 88 ms, vòng 5 (2026-10-09) là 124, 94 và 82 ms; ở vòng 5 có một lần bấm ở theme town (chuyển động đầy đủ) không sinh long task nào từ 50 ms trở lên. Tóm lại khoảng 80–150 ms ở 1× SwiftShader, đổi theo từng lần chạy, cao hơn mức 51–57 ms đo ở vòng 1. INP vẫn ổn nhờ `useDeferredValue`. Không sửa code: các khung thừa chỉ có lúc bấm, sau đó cảnh lại đứng yên.

### 13.2 Bóng nắng (`buildShadows` trong `campus.ts`)

- Mỗi khối lồi là danh sách điểm 3D. `block(x0, x1, z0, z1, top)` cho hộp, còn mái chóp là các góc chân mái cộng đỉnh. Mỗi điểm chiếu xuống đất theo `p − p.y·L/L.y`. Bóng là bao lồi của các điểm chiếu (monotone chain), cắt theo `BASE` (Sutherland-Hodgman), rồi chia quạt.
- Sửa sau QA vòng 1 (2026-10-08): bóng không còn nằm trong `G-terrain`. `buildShadows(pal, archetype)` (QA vòng 2: thêm `colonnades`) trả một geometry riêng (`useCampusGeometry().shadow`), mọi đỉnh mang màu `~shadow`, là hệ số nhân `½(sky + ground) / shade(+y)` (art §2.2). `SHADOW_Y = 0.014`, trên lớp đất cao nhất (0,0135). `CampusScene` vẽ nó ngoài nhóm `statics` (không phải đích bấm) bằng `MeshBasicMaterial` với `MultiplyBlending`, `premultipliedAlpha`, `transparent`, `depthWrite: false`, cộng stencil (`stencilRef 1`, `NotEqualStencilFunc`, `ReplaceStencilOp`) và `gl.stencil: true` trên `<Canvas>`. Kết quả: cỏ dưới bóng ra đúng màu cũ (±2 do làm tròn 8 bit khi trộn), còn đường, đường chạy và mặt hồ cũng tối theo. Chỗ hai bao lồi chồng nhau chỉ tối một lần: đếm pixel trên ảnh hoàng hôn 1280×800 không thấy màu tối hai lần.
- Bản đầu tô bóng đục ở `y = 0.007` dưới lớp đường, nên đường đi cắt qua bóng thành vệt sáng. QA vòng 1 thấy rõ ở ảnh 2× hoàng hôn: lối từ cửa Thư viện tới người chơi, đường phía đông Tháp canh.
- Khe 0,2 u giữa lưng Tháp canh và chòi đông của nhà chính đã lấp: khối tháp kéo từ `z = −5.8` tới `−6.0`, chạm khối chòi. Trước đó khe để lọt một vạch nắng 1–2 px qua bóng lúc hoàng hôn. Vạch đúng hình học nhưng đọc như vết nứt render.
- Các khối:
  - Nhà chính: cánh `(−9.7, 9.7, −9.7, −6.2)` cao 2.5; khối đế tháp cao 3.02; 4 chòi cao 3.48.
  - Thư viện: một hộp cao 2.1.
  - Tháp canh: sảnh cao 1.53 và 5 tầng tới 6.19.
  - Chợ: tấm mái cao 1.95 và khối mái giữa cao 2.42.
  - Toà phía sau: A, G, H, B (thân cao 1.58 và mái vòm cao 2.7), chiller, khán đài.
  - Tháp theo archetype. `spire-hall`: tầng 2, 3, 4, đèn lồng (8.3) và kim (10.1, rộng 0.12). `clock-tower`: mái hông (chóp 4.3), thân tháp (5.9) và mái tháp (8.1).
  - Cổng trước (QA vòng 2), theo `colonnades`. Cổng ba vòm: khối giữa (2.8), attic (3.0), hai cánh (1.78). Cổng trụ: hai trụ (1.4) và dầm treo từ 1.4 tới 1.58 (`lintel`), nên nắng lọt qua lối đi dưới dầm.
  - Tán cây (QA vòng 2): `crownCasters()` lấy mọi đỉnh của tán tròn hoặc tán bách (cùng hàm `roundCrown` / `cypressCrown` mà `buildRoundTree` / `buildCypress` dùng), nhân `treeMatrix(tree)`, rồi chiếu như mọi khối. Thân cây không đổ bóng; đĩa tiếp đất vẫn ở chân cây.
- Không đổ bóng, chấp nhận: hai hàng cột cong (bao lồi của cung lấp kín lòng cung), đèn, tượng, hàng rào, người (art §2.4 mục 4).
- Không nhận bóng, chấp nhận (art §2.4 mục 4 ghi từ đầu; QA vòng 3 nêu lại, 2026-10-09): lớp bóng là mặt phẳng ở `SHADOW_Y` có kiểm depth, nên mặt phẳng nào cao hơn nó cũng vẫn sáng trong bóng: luống hoa (0,14), bậc trước và bậc hiên, các tầng quảng trường, đế các toà, vườn mái, mái nhà. Thấy rõ nhất ở vườn hoa hồng lúc hoàng hôn: bóng cây chỉ hiện ở rãnh sỏi và dừng ở mép từng luống (`scratchpad/qa-scene-r4/z-roses-day-dusk.png`); ban ngày cũng có. Cách sửa nếu cần: chiếu lại phần bóng rơi trên mỗi mặt nâng phẳng ở đúng độ cao của mặt đó (bao lồi tịnh tiến `h·L/L.y`, cắt theo hình chữ nhật của mặt) trong cùng lưới bóng, nên không thêm draw call. Luống hoa chỉ nhận bóng tán cây, mà tán nằm hẳn trên 0,14, nên phép tịnh tiến là đúng. Chưa làm vì đây là chi tiết của một giờ tuỳ chọn. Cách QA đề xuất (nướng `~shadow` vào màu đỉnh) bị loại: một mặt lớn chỉ có 4 đỉnh, nên mép bóng sẽ thành dải chuyển màu.
- Cây trong bóng toà nhà (QA vòng 3, 2026-10-09): `treesInShade(pal, archetype, colonnades)` chọn các cây có tâm tán nằm trong bóng của một khối toà nhà. Cách tính: lấy phần khối cao hơn tâm tán, chiếu theo nắng xuống mặt phẳng ngang qua tâm tán, rồi kiểm tâm tán có nằm trong bao lồi không. `CampusScene` nhân màu instance của các cây này với `~shadow`, dùng đúng `instanceColor` đang có cho độ sáng từng cây, nên không thêm draw call hay tam giác. Tán cây khác không làm tối cây. Hiện chỉ có ba cây: lúc hoàng hôn là `(11.4, −9)` và `(13.75, −7.4)` sau chòi đông nhà chính, ban ngày là cây công viên `(−2, −17.3)`. Hai cây phía đông Tháp canh trong ảnh QA, `(13.75, −4.4)` và `(13.75, −1.6)`, có chân nằm ngoài mọi bóng; cỏ tối cạnh chúng là bóng của sảnh Tháp canh và của các tán, nên chúng sáng là đúng. Ba cây có chân trong bóng toà nhà nhưng tán vẫn trong nắng lúc hoàng hôn: `(12.8, 1.3)`, `(4.3, 8.9)`, `(−12.8, −17.3)`. Người chơi và cô Lan vẫn không tối trong bóng, vì họ di chuyển nên phải kiểm lại mỗi khung (art §2.4 mục 4).
- Hình bóng không đổi theo trạng thái khu (giàn giáo và đèn lối vào không đổ bóng), nên lưới bóng chỉ dựng lại khi đổi giờ, archetype hoặc `colonnades`.
- Danh sách khối là bản chép tay, giản lược từ các hộp trong hàm dựng. `shadowCasters(archetype, colonnades)` xuất danh sách này (nhà và cổng; tán cây thì lấy từ chính hình cây nên không cần chép), và một test buộc nó vào hình thật: mỗi góc khối nằm trong 0,25 (x, z) của một đỉnh thật, và đỉnh khối nằm trong 0,05 của một đỉnh thật trong phạm vi khối. Dời hay đổi cỡ một toà mà quên khối bóng thì test đỏ (đã thử: dời khối Thư viện 1 u, nâng khán đài lên 1.5).

### 13.3 Bọt sóng

`lakeBand(pal, 1, −FOAM, 1, 0, 0.008, ~foam)` với `FOAM = 0.22`: 16 tứ giác ngay trong bờ hồ. Quạt nước giờ chỉ tới mép trong của vành bọt, nên bọt nằm cạnh nước ở cùng độ cao chứ không đè lên nước. Bản đầu đặt bọt đè lên nước ở 0,0085; ảnh 1× trên SwiftShader có răng cưa z-fighting dọc bờ.

### 13.4 Ngân sách đo được

Sau QA vòng 2 (2026-10-08):

| Trạng thái | campus ngày | campus hoàng hôn | town ngày | town hoàng hôn |
|---|---|---|---|---|
| Thư viện `open`, hai khu sắp mở (trạng thái test) | 20 097 | 20 010 | 17 020 | 16 932 |
| Thư viện `lit` (mặc định khi `STARS_SAVED = false`) | 20 185 | 20 098 | 17 108 | 17 020 |
| Cả ba khu `lit` | 20 301 | 20 214 | 17 224 | 17 136 |

- So với QA vòng 1 (19 300 / 19 388 / 19 268 ở campus ngày): đèn lối vào +88 mỗi khu mở (2 đèn × 44); đèn lồng Chợ +60; lưới bóng 108 → 817 (campus ngày), 97 → 802 (town ngày), 730 / 714 lúc hoàng hôn, do tán cây và cổng. QA vòng 3 không đổi số tam giác: đèn Thư viện chỉ dời chỗ, cây trong bóng chỉ đổi màu instance.
- Draw call: 14 theo `sceneBudget()`, vì lớp bóng nắng là một lưới riêng (+1). Trên trình duyệt thật (bọc lệnh vẽ WebGL2, bản build, 1280×800; QA vòng 3 đo lại) là 13 lệnh vẽ mỗi khung, vì vòng tương tác đang ẩn.
- Tam giác mỗi khung ở trạng thái mặc định (Thư viện `lit`, hàng hai của bảng), QA vòng 3 đo trên trình duyệt: campus 20 105 (ngày) / 20 018 (hoàng hôn), town 17 028 / 16 940 (QA vòng 4 đo lại town hoàng hôn hai lần). Đúng bằng `sceneBudget()` trừ 80 tam giác của vòng.
- So với v0.3 (19 248 / 16 186, cùng trạng thái test ở hàng một): +849 / +834. Gồm: gáy sách và thanh kệ Thư viện chờ sao −88; bọt sóng +32; hai đèn lối vào Thư viện +88; lưới bóng +817 / +802.
- Lưới bóng 817 tam giác (campus ngày) gấp khoảng 2,7 lần ước tính ~300 của báo cáo nghiên cứu, chủ yếu do tán cây: mỗi tán là một bao lồi nhiều đỉnh. Vẫn 1 draw call.
- Trần trong `scene.test.ts` giữ 16 draw call và 23 000 tam giác, chạy cho mỗi theme ở cả hai giờ. Không cần nâng trần.
- Chunk `/play`: 269,1 kB gzip sau QA vòng 3 (vòng 2: 268,9; vòng 1: 268,6; bản đầu N8/N9: 268,3; v0.3: 266,4), trần 300.
- `frameloop="demand"`, không shadow map, không postprocessing, không vòng lặp mới. Vật liệu bóng là thêm một biến thể `MeshBasicMaterial`.

### 13.5 Hậu quả trên campus (N9) và module tiến độ

**Trạng thái (QA vòng 5, 2026-10-09): N9 đã dựng nhưng đang tắt.** `STARS_SAVED = false`, và chưa có chỗ nào trong `frontend/app` gọi `recordStars`. Vì vậy mọi khu mở đều vẽ `lit`, storage có gì cũng vậy: ở `scratchpad/wt-scene-shots-r2/`, mỗi cặp ảnh có sao và không sao giống nhau từng byte (ví dụ `vinuni_1280x800_day.png` và `_day_star.png`, cùng 272 058 B); ở QA vòng 5 (`scratchpad/qa-scene-r6/shots/`) cũng vậy (`vinuni_day_2x.png` và `vinuni_day_star_2x.png`, cùng 593 826 B). Bàn giao ("Việc mở" ở dưới) chưa gửi: người điều phối gửi cho nhóm bàn thợ ở checkout chính, còn worktree cảnh không sửa phần bàn thợ. N9 chỉ thấy được khi bàn thợ gọi `recordStars(zone.id, level.id, score.stars)` lúc `run.scored` và đổi `STARS_SAVED = true` trong cùng thay đổi (việc mở ở dưới).

**Luật hình** (`siteLook` trong `sites.ts`):

| Trạng thái API | Có sao ở khu (≥ 1 sao ở bất kỳ màn nào) | Hình (`SiteLook`) |
|---|---|---|
| `coming_soon` | bất kỳ | `coming_soon`: nhạt màu, giàn giáo, cửa sổ kính tối |
| `open` | không | `open`: màu đầy đủ, không giàn giáo, hai đèn lối vào sáng (QA vòng 2), cửa chính sáng (Thư viện), cửa sổ kính tối, không gáy sách |
| `open` | có | `lit`: như `open`, cộng cửa sổ sáng `~lit` (cờ E), gáy sách và thanh kệ của Thư viện, khe sáng đỉnh Tháp canh, 5 đèn lồng dưới mép mái hiên Chợ (QA vòng 2) |

`useCampusGeometry(campus, time, library, watchtower, market)` nhận `SiteLook` của từng toà. Toà nào đổi hình thì chỉ toà đó dựng lại.

Sửa sau QA vòng 2 (2026-10-08):
- **Đèn lối vào.** `entranceLamps(pal, id, look)` đặt hai đèn (hàm `lamp` của địa hình, 44 tam giác) cách cửa 0,6 hai bên, vuông góc với hướng toà, ở mọi khu không còn `coming_soon`. Cửa Tháp canh và Chợ quay về phía tây nên camera không thấy (art §1.2 nguyên tắc 7); đèn thì thấy, nên luật "khu mở có lối vào ấm" đứng cho cả ba khu. Trước đó Tháp canh mở không có gì sáng, Chợ `lit` và `open` ra cùng một hình (đổi sao thì dựng lại vô ích).
- **Đèn lồng Chợ** khi `lit`: 3 hộp 0,16 dưới mép mái hiên nam (trên ba quầy) và 2 dưới mép mái hiên đông, cờ E. Bên trong nhà chợ bị mái che khỏi camera, nên đèn treo ở mép ngoài.
- **`STARS_SAVED`** (`progress.ts`, hiện `false`): `siteLooks(sites, progress, starsSaved = STARS_SAVED)` coi mọi khu mở là đã có sao khi chưa có gì ghi sao, nên cảnh giống v0.3. Luật N9 ở trên vẫn chạy khi `true` và có test.
- **Sửa sau QA vòng 3 (2026-10-09), đèn Thư viện.** `entranceLampSpots(id)` trả chỗ đứng của hai đèn. Thư viện đặt chúng xa cửa 2,8 dọc lối vào, qua chỗ cô Lan: `(−5.4, −2.2)` và `(−5.4, −3.4)`. Tháp canh và Chợ giữ 0,6 cạnh cửa. Trước đó, ở 0,6 cạnh lối, đèn gần đứng sát mép phải của cửa sáng trên màn hình (cách 0,9 px ở 1280×800), cùng màu `~lit` nên đọc như một phần cửa; còn đèn xa nằm sau dấu "!". Dời 1,0 dọc mặt tiền như QA gợi ý thì đèn gần lại đè lên nửa dưới cửa, vì trục z chạy chéo xuống bên trái màn hình. Test chiếu đèn, cửa và dấu "!" (28 px) ra màn hình 1280×800 overview và đòi mỗi đèn cách cửa và dấu ít nhất 8 px; hiện đèn gần cách cửa 54 px, cách dấu 9 px.
- **Sửa sau QA vòng 5 (2026-10-09), màu sáng lúc hoàng hôn.** `~lit` không nướng, nên trước đây giữ `lerpW(lm.accent, 0.2)` ở cả hai giờ. Lúc hoàng hôn, tường `+z` hứng nắng nướng ra gần đúng màu đó: trên ảnh QA (`scratchpad/qa-scene-r6/crops/vinuni_tower_slot_zoom.png`), khe sáng đỉnh Tháp canh ở mặt `+z` là `(221,186,139)` trên tường `(221,181,158)`, tương phản 1,03:1, không thấy; đèn lồng Chợ chỉ 1,44–1,83:1 với sàn và cột, đọc như hộp nhạt (`vinuni_market_lanterns_zoom.png`). Nay hoàng hôn dùng `full(lerp(lm.accent, dusk.sun, 0.5))` (`full` chia cho kênh lớn nhất): campus `#ffbc49`, town `#ffa930`, màu hổ phách đậm của đèn lúc chiều. Ban ngày giữ nguyên `#ddba8b` / `#c9937d`. Đo bằng ΔE (CIE76) với mặt nướng phía sau: tường `+z` lúc hoàng hôn từ 10–12 lên 48–57, sàn Chợ từ 9–20 lên 55–56; ban ngày vẫn 23–33. Độ sáng thì không tách được trên tường `+z` lúc hoàng hôn: ngay cả màu trắng cũng chỉ đạt khoảng 1,9:1, nên test đo khác màu chứ không đo tỉ lệ độ sáng. Test mới (`scene.test.ts`, đỏ trước khi sửa: 11,8 và 10,2 ở tường `+z` Thư viện): mỗi theme, cả hai giờ, `~lit` cách tường `+z`, `+x` của ba toà và sàn Chợ ít nhất ΔE 20. Cửa Thư viện, đèn lối vào và cửa sổ cũng đổi theo lúc hoàng hôn. Không dời khe Tháp canh sang riêng mặt `+x`: khi đó ban ngày mất một khe vẫn đọc được. Chưa chụp lại ảnh (RAM máy đang vượt ngân sách khi sửa); vòng QA sau cần chụp lại `allopen` lúc hoàng hôn. Câu hỏi mở về màu cỏ, nước và trời lúc hoàng hôn (art §12 mục 9) vẫn để chủ dự án quyết.
- **Việc mở, ghi 2026-10-08 (bàn giao cho nhóm bàn thợ):** chưa có gì gọi `recordStars`. Khi một lượt được chấm (`run.scored`, `run.ts` / `Results.tsx` đã tính `run.score.stars`), gọi `recordStars(zone.id, level.id, score.stars)` trong `try/catch` (hàm ném lỗi khi id không phải slug), và trong cùng thay đổi đổi `STARS_SAVED` thành `true`; hai e2e "re-bakes the campus at dusk and back, with a starred library, then rests" và "survives stored progress keyed by an inherited name" tự đổi kỳ vọng theo cờ. Cổng của thay đổi đó (QA vòng 4): đổi cờ, chạy lại hai e2e này, chụp lại ảnh có sao và không sao, hai ảnh phải khác nhau. Mọi id khu và màn trong `zones.json` đều khớp mẫu id của `progress.ts`, giống `SLUG_PATTERN` của backend. Chưa xong việc này thì N9 không có tác dụng thấy được (art §12 mục 6).
  - **Điều kiện thêm (QA vòng 5, 2026-10-09): sau `recordStars`, campus phải mount lại hoặc đọc lại tiến độ.** `Campus` đọc tiến độ một lần khi mount (`useState(readProgress)` trong `CampusScene.tsx`). Hôm nay vậy là đủ vì `play` và `play/:zoneId` là hai route anh em (`app/routes.ts`), nên quay về `/play` là mount lại. Nếu bàn thợ hiện đè lên `/play` đang mount (sheet, lớp phủ hay route con), sao mới chỉ thấy sau khi tải lại trang. Khi đó, thêm một số phiên bản tiến độ vào hub store, tăng nó sau `recordStars`, và cho `Campus` đọc lại theo số đó thay cho `useState(readProgress)`. Thay đổi cũng cần một e2e mới: chấm một lượt được ít nhất 1 sao, quay về `/play` không tải lại trang, rồi kiểm `data-looks` có `library:lit`. Hai e2e ở trên gọi `page.reload()`, nên không bắt được lỗi này.

**Module `frontend/app/features/progress/progress.ts`** là nơi duy nhất đọc và ghi sao. Bàn thợ ghi vào đây khi một lượt chấm xong (việc mở ở trên).

```ts
export const PROGRESS_KEY = "vg-progress-v1";
export type Stars = 0 | 1 | 2 | 3;
export type Progress = Readonly<Record<string, Readonly<Record<string, Stars>>>>; // zoneId → levelId → sao

readProgress(): Progress                                   // {} khi chưa có, storage bị chặn, hay dữ liệu hỏng
recordStars(zoneId, levelId, stars): Progress              // chỉ lưu khi tốt hơn; ném lỗi nếu id không phải slug nội dung
levelStars(progress, zoneId, levelId): Stars               // 0 khi chưa có
hasStar(progress, zoneId): boolean                         // có màn nào của khu đạt ≥ 1 sao
```

- `zoneId` và `levelId` là id trong `zones.json` (ví dụ `library` / `grounded-citation`).
- Lưu ở `localStorage["vg-progress-v1"]`, JSON `{ "library": { "grounded-citation": 2 } }`.
- Mọi lần đọc và ghi đều bọc `try/catch`. Ghi hỏng thì bỏ qua, vì ghi là best effort.
- Đọc thì bỏ từng mục sai (id không phải slug, sao ngoài 0–3, kiểu sai) chứ không xoá cả bản ghi.
- Sửa sau QA vòng 1 (2026-10-08): chỉ đọc và ghi khoá riêng. `constructor` khớp quy tắc slug, mà `{}.constructor` là hàm `Object`, nên bản đầu ghi `{"constructor": {"keys": 1}}` thẳng lên `Object` (`Object.keys` thành số 1, cảnh 3D sập ở mọi lần vào cho tới khi xoá storage). Nay `clean()` dựng map bằng `Object.create(null)`, còn `levelStars`, `hasStar`, `recordStars` đọc qua `Object.hasOwn`. Vùng hay màn tên `constructor` lưu và đọc như mọi id khác.
- Đổi cấu trúc thì dùng khoá mới `vg-progress-v2`, không sửa tại chỗ.
- Module không gọi server. Hai route chỉ chia trạng thái qua `localStorage`, đúng như N9.
- `CampusScene` đọc một lần khi mount (`useState(readProgress)`) rồi gọi `siteLooks(sites, progress)` (`sites.ts`, xem `STARS_SAVED` ở trên), hàm thuần đổi trạng thái API và sao theo id khu ra `SiteLook` của từng toà. Quay về `/play` từ bàn thợ là mount lại, nên thấy ngay sao mới (chỉ khi hai route còn là anh em, xem điều kiện thêm ở việc mở). Không nghe sự kiện `storage` giữa các tab; thêm khi cần.
- Với `?debug=frames`, cảnh ghi `data-looks` lên `<html>` (ví dụ `library:lit watchtower:coming_soon market:coming_soon`) để e2e kiểm đường dây từ storage tới hình.

### 13.6 HUD

Nút "Hoàng hôn" ở cụm trên bên trái (art §8.4). `HUD_CORNER.width` từ 320 thành 344, vì cụm trái giờ kết thúc ở `x ≈ 337` px. Test "góc HUD" (vitest và e2e) vẫn xanh: hai góc vẫn là trời.

Sửa sau QA vòng 1 (2026-10-08):
- Nút chỉ icon dưới `md` (`max-md:w-11 max-md:px-0`, nhãn `sr-only md:not-sr-only`). Trước là `sm`: ở 640 px với theme vinuni cụm trái kết thúc ở x = 329 còn "Các khu" bắt đầu ở 333, nên bốn nút trông như một thanh. Nay ở 640 px khoảng cách là 106 px (vinuni) và 191 px (town).
- Nút chỉ hiện khi cảnh đã chạy. `hubStore.sceneUp` bật khi `useHubFrame` gắn `wake` (cảnh mount) và tắt khi gỡ (`setWake(null)`), nên cảnh lỗi (không WebGL, chunk lỗi, dữ liệu hỏng) thì không còn nút bấm mà không có tác dụng.

### 13.7 Test

- `progress.test.ts`: rỗng lúc đầu; giữ kết quả tốt nhất; 0 sao không làm sáng; bỏ từng mục hỏng; JSON hỏng đọc ra rỗng; khoá `constructor` không ghi lên `Object` và đọc, ghi như id thường (QA vòng 1, đỏ trước khi sửa); storage bị chặn vẫn chạy; id sai thì ném lỗi.
- `store.test.ts`: `sceneUp` theo `setWake` (QA vòng 1).
- `scene.test.ts`:
  - Mỗi theme: ngày mặt trên `(1, 1, 1)`, trái 0.80 ấm (`r − b > 0.1`), phải 0.60 lạnh (`b − r > 0.08`; QA vòng 2, đỏ trước khi đổi preset); hoàng hôn tối và ấm; bỏ rim thì bằng công thức hai đèn viết lại trong test (kiểm công thức tự nhất quán, không chạy đường Lambert của three.js, art §2.3; tên test sửa cho khớp ở QA vòng 2); rim chỉ ở mặt nhìn nghiêng hướng nắng.
  - `siteLook`; `siteLooks` đọc sao theo id khu (không theo vị trí) và không làm sáng khu sắp mở dù có sao (QA vòng 1); khi chưa ghi sao (`starsSaved = false`) mọi khu mở là `lit` (QA vòng 2, đỏ trước khi sửa).
  - Hai đèn Thư viện cách cửa sáng và dấu "!" ít nhất 8 px ở 1280×800 (QA vòng 3, đỏ trước khi dời: 0,9 px).
  - Cây tối trong bóng toà nhà, ở cả hai giờ (QA vòng 3, đỏ trước khi thêm: cây `(13.75, −7.4)` lúc hoàng hôn). Đối chứng là tia bắn vào campus đã dựng, hướng về mặt trời, từ tâm tán và từ 4 điểm cách tâm 0,3. Năm tia đều chạm toà thì cây phải tối; không tia nào chạm thì cây phải sáng; cây có tia chạm, tia không là cây ở mép bóng, bỏ qua.
  - `~lit` cách tường `+z`, `+x` của ba toà và sàn Chợ ít nhất ΔE 20 (CIE76), mỗi theme, cả hai giờ (QA vòng 5, đỏ trước khi đổi màu hoàng hôn: 11,8 / 10,2).
  - Số đỉnh `~lit` của cả ba toà ở ba hình và hai giờ: `coming_soon` 0; `open` 102 (Thư viện: cửa + hai đèn) hoặc 72 (hai đèn); `lit` nhiều hơn `open`, Thư viện hơn 100 (QA vòng 2, đỏ trước khi thêm đèn).
  - Bóng phủ đúng chỗ sau tâm tán mọi cây và sau cổng, ở cả hai giờ (QA vòng 2, đỏ trước khi thêm khối); mọi mặt đất phẳng dưới 0.03 nằm dưới `SHADOW_Y`, trừ bậc 0,02 của sân khấu (QA vòng 2; hạ `SHADOW_Y` xuống 0,013 thì đỏ).
  - Ngân sách mỗi theme ở cả hai giờ.
  - Bóng nằm trong `BASE`; tới quá `x = 12` ban ngày và chạm mép đế lúc hoàng hôn.
  - Mỗi khối bóng khớp hình thật (góc trong 0,25, đỉnh trong 0,05; QA vòng 1).
  - Khu mở thì bỏ giàn giáo (kiểm theo vị trí giàn giáo, vì đèn lối vào làm số tam giác tăng); đổi giờ thì dựng lại mọi nhóm.
- `e2e/play.spec.ts`:
  - Chưa có sao: `data-looks` là `library:open …` khi `STARS_SAVED`, `library:lit …` khi cờ còn tắt. Ghi sao vào storage rồi tải lại: `library:lit …` (QA vòng 3). Khi cờ còn tắt, cặp kiểm này không bắt được lỗi trên đường storage → `siteLooks`; bật cờ thì bắt được cả hai chiều. Đã thử: bật cờ, build lại thì test qua; bật cờ và cho `CampusScene` bỏ qua storage thì test đỏ (`library:open`).
  - Có sao Thư viện: `data-looks` là `library:lit …`; canvas có bộ đệm stencil (`getContextAttributes().stencil`, QA vòng 2); bấm "Hoàng hôn" thì `aria-pressed` đổi, khung canvas có `bg-scene-dusk`, cảnh vẽ thêm khung rồi đứng yên; bấm lại về ngày và mất `bg-scene-dusk`; không lỗi console.
  - Storage `{"constructor": {"keys": 1}}`: cảnh chạy, Thư viện `open` (hoặc `lit` khi `STARS_SAVED = false`), không lỗi console (QA vòng 1).
  - Không có WebGL: hiện thông báo dự phòng, "Các khu" vẫn dùng được, không có nút "Hoàng hôn" (QA vòng 1).
  - Nút nằm trong `HUD_CORNER`; ở 640 px nút chỉ icon và cách "Các khu" ≥ 48 px (QA vòng 1).
- `playwright.config.ts` (QA vòng 2): cổng đọc từ `E2E_PORT` (mặc định 4173) và không bao giờ dùng lại server đang chạy. Trước đó hai checkout cùng cổng 4173 với `reuseExistingServer`, nên một lần chạy ở worktree có thể lặng lẽ test bản build của checkout chính (không có nút "Hoàng hôn", không có `data-looks`): nghi là nguyên nhân 20 lỗi một lần ở `play.spec.ts`. Nay cổng bị chiếm thì lần chạy dừng với lỗi "is already used" (đã thử). Chạy đủ bộ e2e với `E2E_PORT=4374 --workers=1`: 55 qua, 3 bỏ qua (chỉ chạy ở desktop); chạy lại sau QA vòng 3, vẫn 55 qua và 3 bỏ qua. Một worker theo luật RAM của máy (không chạy hai trình duyệt headless cùng lúc).

### 13.8 Ảnh

Nằm ngoài repo: `scratchpad/wt-scene-shots/` (bản đầu), `scratchpad/wt-scene-shots-r1/` (sau QA vòng 1, bóng phủ nhân) và `scratchpad/wt-scene-shots-r2/` (sau QA vòng 2: preset ngày ấm hơn, bóng cây và cổng, đèn lối vào; thêm `allopen_<giờ>_<market|tower>.png` khi cả ba khu mở, chụp bằng `n8/shots-r2-open.mjs`), chụp bằng `scratchpad/n8/shots-n8.mjs` trên bản build (`serve-build --port 4371`). Ảnh cận so sánh khe sau Tháp canh: `scratchpad/n8/r1-gap-old.png`, `r1-gap-new.png`. So sánh vòng 1 / vòng 2 quanh cổng: `scratchpad/n8/r2-gate-day.png`, `r2-gate-dusk.png` (trái vòng 1, phải vòng 2). Sau QA vòng 3: `scratchpad/wt-scene-shots-r3/` (đèn Thư viện dời ra lối vào, cây trong bóng toà nhà tối; ảnh 1280×800, 375×812 và ảnh cận 2×); so sánh cây vòng 2 / vòng 3 lúc hoàng hôn: `scratchpad/n8/r5-trees-vinuni-dusk.png`, `r5-trees-town-dusk.png` (trái vòng 2, phải vòng 3).
- Mỗi theme × giờ có ảnh 1280×800 và 375×812 (Thư viện chưa sao; ở vòng 2 vẫn sáng vì `STARS_SAVED = false`), 1280×800 khi Thư viện có 1 sao, và các ảnh cận 2× của Thư viện, Tháp canh, kim tháp.
- Tên file: `<theme>_<w>x<h>_<giờ>[_star][_2x_crop_<chỗ>].png`.
