# Nâng cấp đồ hoạ: bàn thợ và kết quả (B), rồi sa bàn 3D (A)

- **Ngày:** 2026-11-28 · **Trạng thái:** chủ dự án đã duyệt 2026-11-28 ("Approve, 40k cap").
- **Yêu cầu của chủ dự án:**
  - "tôi muốn nâng cấp và làm đồ hoạ đẹp hơn"
  - "bạn tự xem và đề xuất luôn đi, research nhiều vào"
  - Chọn hướng **"B first, then A"**.
- **Bằng chứng:**
  - 27 ảnh chụp bản production (375 và 1280, ngày và đêm), trong `scratchpad/gfx/shots/` của phiên, không nằm trong repo.
  - Hai báo cáo nghiên cứu: cảnh sa bàn 3D, và ngôn ngữ hình cho giao diện/SVG. Nguồn được trích ở từng mục bên dưới.
- **Ràng buộc gốc:**
  - `CLAUDE.md`;
  - `docs/design/art-direction.md` §1.2–1.3 (maquette, danh sách chống "AI slop");
  - quy tắc máy chiếu R1–R10;
  - CSP `style-src 'self'` và `font-src 'self'`.

## 1. Vì sao, và thế nào là thành công

Học viên ở bàn thợ và trang kết quả gần như suốt buổi, và cả lớp nhìn chúng trên máy chiếu. Hiện các trang này sạch nhưng đọc như tài liệu hay biểu mẫu:
- các thẻ viền xám mỏng nặng nhẹ như nhau;
- ba ngôi sao chỉ là viền mảnh;
- cỗ máy có cá tính nhưng chỉ có một độ dày nét (1–1,6 px).

Khuôn viên 3D ban ngày đã đẹp, nhưng vẫn lộ ba dấu "đồ hoạ lập trình viên": cạnh hộp sắc, bóng nắng cứng, đế lơ lửng.

**Thành công nghĩa là:**
- Đặt ảnh trước và sau cạnh nhau ở 375 và 1280, người xem chọn ngay bản sau.
- Ở máy chiếu, trạng thái của từng món đọc được từ hàng cuối lớp mà không cần màu.
- Không ngân sách, test truy cập hay quy tắc art bible nào bị nới, trừ một ngoại lệ nói rõ ở §4.4.

## 2. Mục tiêu, không làm, phản mục tiêu

**Mục tiêu:**
- B1: cỗ máy có hệ nét, trạng thái hiện bằng hình, và trạng thái "đang tập trung" khi bấm bước.
- B2: kết quả có trọng lượng, gồm sao, dấu đóng và chữ mono; có ngữ pháp chuyển động chung.
- A: vát cạnh, bóng có vùng mờ, AO bổ sung, đế tiếp đất, cây bớt giống nhau.

**Không làm trong đợt này** (hướng C, để sau):
- tranh toà nhà cho trang khu;
- bộ tượng người SVG;
- hero landing mới;
- đổi bảng màu hay hex của theme;
- đổi bố cục trang.

**Phản mục tiêu** (làm xong mà dính một điều dưới đây là hỏng):
- bloom, glow, gradient, kính mờ, bóng dày;
- bất kỳ vòng lặp chuyển động nào;
- chữ hay nét mất tương phản trên máy chiếu;
- thông tin chỉ nằm trong chuyển động;
- `style` inline trong HTML pre-render;
- tone mapping hay post-processing trong cảnh 3D.

## 3. Các hướng đã cân nhắc

| Hướng | Được | Mất |
|---|---|---|
| **A. Đánh bóng sa bàn 3D** | Ấn tượng đầu đẹp hơn, rẻ (dưới 3 kB, 0 draw call) | Không chạm vào chỗ học viên ở lâu nhất |
| **B. Ngôn ngữ hình cho bàn thợ và kết quả** | Cải thiện đúng chỗ học và máy chiếu | 2 PR, cỡ M–L; thêm khoảng 15–30 kB font |
| **C. Nối hai thế giới** (tranh toà nhà, tượng người, hero) | Đẹp và gắn kết nhất | Tốn công vẽ nhất, cỡ L |

**Đã chọn:** B trước, rồi A; C để sau. Lý do: B ăn vào chỗ có nhiều thời gian nhìn nhất, A rẻ và an toàn, còn C nên làm khi hai phần kia đã ổn.

**Đã loại:**
- **SSAO/N8AO:** khoảng 107 kB cộng 113 kB postprocessing, không chạy được với MSAA, tốn GPU mỗi khung hình ([N8AO README](https://github.com/N8python/n8ao)).
- **Tone mapping ACES, AgX, Neutral:** làm trắng ngả xám và lệch hex ([Khronos Neutral](https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md)).
- **Shadow map PCSS:** test cấm `castShadow`, và mount sẽ biên dịch lại mọi shader.
- **`RoundedBox` mặc định:** 300 tam giác mỗi khối.

## 4. Thiết kế

### 4.1 B1: cỗ máy (PR 1, `MachineMap.tsx`)

**1. Hệ nét hai cấp** (lý do: [line weights trong minh hoạ kỹ thuật](https://users.cs.northwestern.edu/~bgooch/ITI/node4.html), viền ngoài dày khoảng 2,5 lần nét trong).
- Gom các số `strokeWidth` rời rạc vào một bảng hằng (ví dụ `INK`) trong file. Bốn cấp:
  - `outline` = 2,4: bóng ngoài của món, đế, băng chuyền;
  - `edge` = 1: cạnh giữa các mặt, đồ trang trí;
  - `fine` = 1: dây chú thích, ruột khi "Nhìn xuyên";
  - `mark` = 2,5: dấu tích, dấu chéo.
- `Box` (:398–445) hiện tô ba mặt với cùng một nét, nên cạnh chung bị vẽ hai lần. Sửa thành:
  - ba mặt tô nét `edge`;
  - thêm một đường bao lục giác ngoài cùng với nét `outline`.
- Thang vẽ vẫn 1 đơn vị = 1 px (test `workbench.spec.ts:1199`), nên 2,4 đơn vị là 2,4 px.

**2. Trạng thái bằng hình, không chỉ bằng màu.** Hiện trạng thái chỉ đổi màu nét (`TONE` :447). Thêm hình cho từng trạng thái (cách của Mini Metro: [Game Developer](https://gamedeveloper.com/audio/-i-mini-motorways-i-and-the-delicate-art-of-marrying-complexity-and-minimalism); WCAG 1.4.1):

| Trạng thái | Đường bao | Huy hiệu ở góc trên mặt trước |
|---|---|---|
| `passed` | liền | ô tròn có dấu tích |
| `error` | đứt `6 4` | ô vuông có dấu chéo |
| `stale` | chấm `2 3` | không có |
| `running` | liền, màu brand | không có |
| `idle` | liền | không có |

- Hook cho test: `data-tile-mark="pass|fail"`.
- Ổ trống giữ nét đứt đỏ và dấu cộng như hiện tại.

**3. Tập trung khi bấm bước** (cách của Ciechanowski: chỉ phần đang làm việc rõ nét, [Mechanical Watch](https://ciechanow.ski/mechanical-watch/)).
- Khi có `beat`, món đang chạy, băng chuyền tới nó và tờ phiếu giữ 100%. Các món khác giảm xuống khoảng 45% độ đậm.
- Cách làm: lớp `opacity` trên nhóm, chuyển 150 ms, có `motion-reduce`.
- Điều kiện: nét `outline` của món bị làm mờ vẫn phải đạt tương phản 3:1 với nền (WCAG 1.4.11). Builder đo ở cả hai theme và chọn mức mờ thấp nhất đạt chuẩn.
- Hook cho test: `data-dimmed`.

**4. Lỗi hiện ngay trong máy.**
- Khi lượt đang theo dõi có món `error`, hoặc guard chặn ca (`data-gauge-stop`), món đó rung một lần: 2 px, 150 ms, khi kết quả hiện ra.
- Đoạn băng chuyền sau món đó chuyển sang nét đứt màu danger cho tới khi người chơi đổi cấu hình.
- Giảm chuyển động: không rung, chỉ đổi nét.

**5. Giữ nguyên:**
- toàn bộ hook `data-*` mà test đang dùng;
- vị trí nhãn và viewBox (test 3.4);
- filter rung nét tay `feTurbulence`;
- bóng phẳng dưới đế.

### 4.2 B2: kết quả, chữ, chuyển động (PR 2)

**1. Chữ mono cho chú thích.**
- Tự host IBM Plex Mono 400 và 600, bộ chữ latin và vietnamese, khoảng 14–28 kB (đo trên Google Fonts).
- Đặt ở `public/fonts/plex-mono/`. Đây là font của lõi, không phải của theme: không mang tên thương hiệu và dùng chung cho cả hai theme.
- Khai báo `--font-mono` trong `app.css`, dùng `unicode-range`. Thêm một `@font-face` dự phòng có `size-adjust` để giảm nhảy bố cục ([web.dev](https://web.dev/articles/css-size-adjust)).
- Hiện `font-mono` đang rơi về font hệ thống ở 9 file; tất cả sẽ tự đổi sang Plex Mono.
- Kiểm dấu tiếng Việt bằng chuỗi "Ắ Ặ Ừ Ở ỹ" ở 10 px trong SVG và ở chế độ chiếu.

**2. Ngữ pháp chuyển động** (thêm vào `app.css`; nguồn: [NN/g](https://www.nngroup.com/articles/animation-duration/), [Material motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)).
- Token easing:
  - `--ease-emph-out: cubic-bezier(0.05,0.7,0.1,1)`
  - `--ease-emph-in: cubic-bezier(0.3,0,0.8,0.15)`
- Keyframes mới:
  - `vg-stamp`: phóng 1,15 → 1, cộng opacity, 180 ms;
  - `vg-shake`: 2 px, 150 ms;
  - nhịp so le 60 ms mỗi mục, tổng không quá 500 ms.
- Không có `infinite`.
- Giảm chuyển động: luật toàn cục ở :164 đã rút mọi thời lượng về 0,01 ms. Chỉ cần kiểm rằng trạng thái cuối vẫn đúng, kể cả opacity.

**3. Sao và dấu đóng** (`Results.tsx:231–268`).
- **Ngôi sao:**
  - lớn hơn (`size-10`, chế độ chiếu `size-14`);
  - sao đạt tô đặc, có `vg-stamp` lần lượt từng sao;
  - sao chưa đạt là viền đứt, để đọc được khi không có màu.
- **Dòng "n/3 sao":** tăng một bậc chữ.
- **Mỗi điều kiện sao:** "Đạt"/"Chưa đạt" thành một component `Stamp`:
  - chữ mono in hoa, viền đôi, nghiêng −3°;
  - tông success hoặc fg-muted;
  - có `vg-stamp`;
  - nghiêng bằng class, không dùng `style`.
- **Bảng trả lời của cỗ máy:** dùng cùng ngôn ngữ dấu (viền đôi, nghiêng −3°, dấu tích hoặc chéo), nhưng vẽ bằng SVG và **không có chữ**.
  - Bảng chỉ rộng khoảng 30 đơn vị, nên chữ 24 px không vừa.
  - Kích thước bảng, nhãn và viewBox giữ nguyên.
  - Luật 24 px chỉ áp cho `Stamp` dạng chữ ở DOM.
  - *(Quyết định của người viết thiết kế, sau vòng rà của builder.)*

**4. Bậc thị giác của trang kết quả.**
- Thẻ chẩn đoán (:339–399) có vạch trái 3 px **cùng một tông `brand`** cho mọi thẻ. Tiêu đề thẻ đậm hơn.
  - Các thẻ đều là lời chẩn đoán của NPC chứ không phải mức độ lỗi, nên nhiều tông sẽ thành nhiễu màu trên máy chiếu.
  - *(Quyết định của người viết thiết kế.)*
- Phần "Kết quả ca tối nay" có dải đầu: số sao và tổng token. Đây là khối duy nhất có nền `subtle`, để mắt đi thẳng tới nó.
  - **Dải này không có nút.** "Chỉnh rồi chạy lại" vẫn nằm dưới phần chẩn đoán như quyết định 3.2.
  - *(Quyết định của người viết thiết kế.)*
- Thẻ câu: hình đã có (biểu tượng cộng chữ), giữ nguyên.

**5. Chip trạng thái ở bàn thợ** (`BenchView.tsx` `StateChip`, :382).
- Biểu tượng trước chữ đã có sẵn.
- Chỉ thêm kiểu viền giống cỗ máy: `error` viền đứt, `stale` viền chấm. Không thêm huy hiệu.
- *(Quyết định của người viết thiết kế.)*

### 4.3 Máy chiếu cho B

- Nét `outline` ở chế độ chiếu tăng lên khoảng 3. Builder chọn cách: class `chieu:` trên nhóm, hoặc biến CSS (`stroke-width` là thuộc tính trình bày nên CSS ghi đè được, không cần `style` inline).
- Chữ của `Stamp` phải đạt ít nhất 24 px.
- Không chuyển động nào lặp (đã có giới hạn `html.chieu *`).

### 4.4 A: sa bàn 3D (PR 3)

**1. Vát cạnh 45°, rộng 0,04 u,** chỉ cho mép trên và các góc đứng của khối tường chính, đế tháp và lan can. Áp cho landmark và ba toà khu.
- Thêm helper `chamferBox()` cạnh `box()` trong `primitives.ts:30`. Mỗi khối có 44 tam giác thay vì 12.
- Mặt vát nghiêng nên `shade()` nướng ra một độ sáng ở giữa, thành một đường sáng mảnh. Không thêm material.
- Mặt trên vẫn đúng hex: mặt vát có n.y khoảng 0,7, vượt ngưỡng 0,5 nên được tính là `top`. Builder kiểm xem dải này nên nhận màu `top` hay một màu riêng nằm giữa, và chọn cái cho ra đường sáng mà test hex của mặt trên vẫn qua.

**2. Bóng nắng có vùng mờ.**
- Trong `buildShadows` (`campus.ts:801`), quanh mỗi bao lồi thêm một dải mở ra ngoài. Màu đỉnh chuyển từ `pal.shadow` ở mép trong sang trắng ở mép ngoài; trắng khi nhân thì không làm tối.
- Bề rộng dải tỉ lệ với độ cao của điểm đổ bóng (bóng sắc ở chân vật, mềm ở xa), trần 0,3 u.
- Dải có stencil riêng hoặc dùng chung với lõi. Builder chọn, với điều kiện chỗ hai bóng chồng nhau không có đường viền tối kép.
- Trời u ám vẫn không có bóng, như hiện tại.

**3. AO bổ sung, nướng sẵn.**
- Thêm vào `part()`/`paint()` theo cờ cho từng phần: mặt đứng ngay dưới mái hiên, dưới dầm hàng cột, góc lõm giữa hai khối.
- Nhân 0,85–0,9 ở các đỉnh liên quan.
- Mặt trên không đổi, để giữ luật hex.

**4. Đế tiếp đất.**
- Thêm một dải tối mảnh ở chân các mặt bên của tầng đất (nướng vào màu đỉnh). Đế đọc như một vật đặt trên bàn.
- **Không** vẽ khung mờ ngoài mép đế:
  - canvas trong suốt trên nền trời CSS, nên lớp nhân `G-ao` không có gì để làm tối;
  - một lớp alpha riêng thì tốn thêm một draw call.
- Vì vậy không cần ngoại lệ art bible nào.
- *(Quyết định của người viết thiết kế, sau vòng rà của builder.)*

**5. Cây bớt giống nhau.**
- `instanceColor` lệch độ sáng ±4%, tất định theo chỉ số cây. Chỉ đổi độ sáng, không đổi sắc.
- Người không đổi.

**6. Ngân sách:**
- **Draw call:** không đổi. Test cố định 15/16/18/19.
- **Tam giác:**
  - đỉnh hiện tại là 34.986, trần test là 35.500;
  - vát cạnh thêm khoảng 1,5–3k;
  - **đề xuất nâng trần test lên 40.000**, vẫn dưới mức 60k ghi ở `campus-scene-v0.3.md` §1.7.
  - Đây là ngoại lệ duy nhất, nêu ở §1.
  - **Chủ dự án đã duyệt trần 40.000** (2026-11-28).
- **Gói tải:**
  - `/play` còn khoảng 4,45 kB;
  - phần A dự kiến thêm 2–3 kB;
  - nếu vượt, tách phần dựng hình tĩnh khỏi chunk `CampusScene` trước, như `upgrade-plan-v0.7.md:79` đã dặn.
  - `check-bundle.mjs` phải qua; không nới trần 300 kB.

## 5. Kiểm chứng (mỗi PR)

- **Ảnh trước và sau** ở 375 và 1280:
  - B: L1, W1, trang kết quả W1, chế độ chiếu 1280×720;
  - A: khuôn viên ban ngày và ban đêm, cả hai theme.
- **Test bám vào hình được vẽ ra** (`data-*`), không bám `aria-label`. Mỗi test phải được kiểm bằng cách cố tình làm hỏng mã (CLAUDE.md):
  - B1: `data-tile-mark` đúng với trạng thái; `data-dimmed` chỉ có trên món không chạy;
  - B1: một e2e đo độ dày nét bao lớn hơn 2 lần nét cạnh;
  - B1: tương phản 3:1 của món bị làm mờ;
  - B2: sao đạt có `animationName` là `vg-stamp`, hoặc `none` khi giảm chuyển động (như test `vg-flip` hiện có);
  - B2: Plex Mono tải được và hiện đủ dấu (`document.fonts.check`);
  - A: số tam giác không quá 40.000; draw call không đổi; hex mặt trên không đổi;
  - A: dải mờ của bóng có độ sáng tăng dần ra ngoài; mặt vát có độ sáng nằm giữa mặt trên và mặt bên.
- **Cổng chung:** axe, máy chiếu R1–R10, không cuộn ngang, semgrep, `check-bundle`.

## 6. Để builder quyết

- Tên hằng và nơi đặt bảng nét.
- Mức mờ cụ thể khi tập trung, trong giới hạn 3:1.
- Cách tăng nét ở chế độ chiếu.
- Hình học cụ thể của dải mờ bóng và cách xử lý stencil.
- Hệ số AO chính xác trong khoảng 0,85–0,9.
- Có tách chunk 3D hay không, tuỳ số đo thật.
- Chia PR 1 và PR 2 khác đi nếu diff quá lớn; tổng vẫn tối đa 3 PR.
