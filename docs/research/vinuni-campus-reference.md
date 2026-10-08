> Trạng thái: tài liệu nghiên cứu để dựng cảnh campus của theme `vinuni`. Bản đầu 2026-10-07, cập nhật 2026-10-08. Gộp ba đợt nghiên cứu: web/OSM/booklet chính thức (ký hiệu **[W]**), ảnh trên trang chủ trường (ký hiệu **[L]**), và hai ảnh chủ dự án gửi chụp phía sau trường (ký hiệu **[U]**, §2.8). Ảnh tham chiếu chỉ nằm trong scratchpad của phiên làm việc, **không** đưa vào repo.

# Tham chiếu khuôn viên VinUniversity (Gia Lâm, Hà Nội)

**Quy ước.** "Chắc chắn" nghĩa là có trong nguồn chính thức, hoặc hai nguồn độc lập khớp nhau. Mọi thứ khác nằm ở §3. Màu là hex lấy mẫu bằng Pillow từ ảnh. Dữ liệu bản đồ: © OpenStreetMap contributors, ODbL 1.0.

**Hai hệ toạ độ** (mét, cùng nguồn OSM):

- **(x, y)**: cục bộ quanh 20.9886 N, 105.9460 E; x hướng đông, y hướng bắc.
- **(c, a), hệ trục**: gốc tại tâm đài phun (trọng tâm polygon OSM, (x, y) = (−228, −135)). `a` chạy dọc trục về phía tháp (hướng 31,7°, bắc-đông bắc). `c` vuông góc với trục, dương về bên phải khi đứng ở đài phun nhìn về tháp (hướng 121,7°, đông-đông nam). Đổi hệ: `x = −228 + 0,851c + 0,526a`, `y = −135 − 0,526c + 0,851a`. Trong game: `x ≈ c`, `z ≈ −a` (tháp ở `−z`, đài phun ở `+z`).

Kích thước "c × a" là cạnh thật của footprint (ngang trục × dọc trục). Bản 2026-10-07 ghi kích thước là bbox theo x/y. Vì các tòa xoay 31,7°, bbox lớn hơn cạnh thật 20–40% (ví dụ tòa I: bbox 67 × 69, cạnh thật 49 × 55).

## 1. Tóm tắt

Campus đối xứng qua **một trục**. Trục lệch khoảng 32° về phía đông so với hướng bắc, nên mặt tiền nhìn về phía nam-tây nam. Đi dọc trục từ ngoài vào:

1. **Cổng khải hoàn ba vòm** đứng trên hàng rào ranh giới, cách tâm đài phun 55 m (§2.7).
2. Đường vòng nội bộ.
3. Quảng trường đài phun hình móng ngựa, ôm bởi hai hàng cột cong.
4. Lối đi thẳng có tượng trắng và hàng thông tháp, hai bên là cỏ.
5. Sân trước lát đá sáng, rồi bậc thềm lớn và sảnh 4 cột.
6. **Tháp bậc** (tòa I, cách đài phun khoảng 190 m), hai bên là cánh nhà dài màu trắng ngà.

Hồ chạy thành một dải hình chữ L: **phía trước cổng** (cách cổng 66 m) và **dọc suốt cạnh phía đông** (bên phải trục). Phía sau nhà chính **không có hồ** (§2.8).

Ngay sau tháp có hai tòa: thư viện A (2 tầng, vườn mái, 2 cầu kính), rồi tòa G (mái pin mặt trời). Bên trái phía sau là tòa H, trạm chiller, rồi một công viên cỏ trồng cây theo lưới. Bên phải phía sau là hội trường B (mái vòm cuốn, hiên cột có trán tường), sân khấu ngoài trời, sân tennis và bóng rổ, rồi sân vận động có đường chạy đỏ. Xa hơn về phía đông là nhà thể thao K và ký túc xá. Mép tây là bãi đỗ xe có mái pin mặt trời. Mép sau là đường Hải Đăng và dãy biệt thự.

## 2. Chắc chắn

### 2.1 Mặt bằng (OSM, booklet chính thức)

| Hạng mục | Tâm (x, y) | Tâm (c, a) | Cạnh thật c × a (m) | Ghi chú |
|---|---|---|---|---|
| Cổng ba vòm | (−257, −181) | (0, −55) | 34 × ≈11, cao ≈16 | Không có trong OSM. Vị trí và cỡ lấy từ ảnh (§2.7) |
| Hàng rào ranh giới mặt trước | (−303, −154) → (−208, −213) | a = −56, c −54 → +58 | | Cạnh trước của polygon campus, way 777888670 |
| Đài phun | (−228, −135) | (0, 0) | 44 × 40 (bể ngoài Ø ≈ 41) | `amenity=fountain`, way 1224486124 |
| "Quảng trường Trung tâm" | (−180, −54) | (−2, 94) | Quảng trường chính 1.716 m² | Cỏ cộng đài phun 1.496 m² (booklet) |
| Hai dải vườn tượng dọc trục | | (±32, 98) | 23 × 59 mỗi dải | Way 1224486089/90, mỗi dải có hồ nhỏ 6 × 11 m |
| Tòa I (tháp) | (−128, 26) | (1, 190) | **49 × 55** | Way 896414898. Mặt trước ở a = 161 |
| Cánh C, E | C (−178, 61), E (−73, 0) | (−60, 193), (61, 196) | 49 × 25 mỗi cánh | Canteen ở tòa E, quán café ở tòa I |
| Tay chữ U: D, F | D (−238, 46), F (−62, −63) | (−104, 149), (104, 148) | 24 × 54 mỗi tay | Mặt trước ở a = 122. Mép ngoài D–F rộng 233 m |
| Tòa A (thư viện) | (−102, 67) | (1, 236) | 74 × 40 | 2 tầng, 4.000 m², vườn trên mái, nằm ngay sau tháp |
| Tòa B (hội trường) | (−29, 73) | (60, 281) | 67 × 66 | Khối lớn nhất, 3.825 m², 1.500 chỗ |
| Tòa G (khu học, lab) | (−80, 106) | (−1, 283) | 49 × 54 | Sau tòa A, trên trục, mái pin mặt trời |
| Tòa H (khu học, lab) | (−125, 145) | (−59, 292) | 57 × 39 | Sau tòa C, lệch trái |
| Trạm chiller, nhà nhỏ | (−109, 196), (−135, 211) | (−73, 344), (−102, 343) | 28 × 23, 13 × 23 | Way 1224041001 và 1224041000 |
| Sân vận động (khu đất) | (32, 171) | (60, 397) | 119 × 136 | Way 1224740345, hơn 1.100 chỗ |
| Sân cỏ trong đường chạy | | (60, 398) | 50 × 71 | Way 854837614 |
| Khán đài | (74, 149) | (107, 400) | 27 × 63 | Way 854837615, nằm cạnh đông của đường chạy |
| Sân tennis, sân bóng rổ | (−17, 181), (2, 212) | (13, 379), (13, 416) | 20 × 36, 20 × 37 | Way 854837618/9. Nằm ở **phía tây** đường chạy (phía trục), không phải phía bắc |
| Nhà thể thao trong nhà (tòa K) | (154, 101) | (201, 402) | 62 × 77 | Way 881048981. 2 tầng, bể bơi 50 × 25 m |
| Ký túc xá | (257, 29) | (326, 394) | 85 × 60 (hai cánh 20 × 59) | Way 1082884764–66. 72 căn hộ, 376 giường, vườn trên mái |
| Vườn Hồng | (−305, −72) | (−99, 12) | 79 × 97 | Vườn hình học phía tây quảng trường đài phun |
| Hồ "VinUni Lake" | | xem §2.8.4 | Dải rộng 50–180 m | Way 761986889, ≈ 8,8 ha |

Bối cảnh xung quanh: phía tây (bên trái trục) là đường đôi có dải cây giữa, bên kia là các tháp chung cư 25–30 tầng (Sapphire S2.xx). Phía sau (mép bắc) là đường Hải Đăng, bên kia là dãy biệt thự thấp tầng (San Hô). Bên kia hồ, phía nam, là cao tốc Hà Nội–Hải Phòng.

### 2.2 Tháp (tòa I)

Kích thước tuyệt đối xem §3: chiều cao chính thức (108 m) và số đo ảnh (≈ 81 m) chưa khớp. Tỷ lệ dưới đây không phụ thuộc vào chiều cao tuyệt đối. W là bề rộng mặt trước của khối đế, H là chiều cao tới đỉnh ngôi sao. Ba ảnh khác nhau ([L] chụp thẳng, [W] chụp chéo từ trên cao, ảnh flycam ngoài cổng) đều cho H ≈ 1,65 W, sai khác trong khoảng ±3%.

| Tầng khối (dưới → trên) | Đỉnh tại (phần của H) | Rộng (phần của W) | Hình dạng |
|---|---|---|---|
| Khối đế | 0,26 | 1,00 | 4 tầng ở các khoang góc, khoảng 14 cửa sổ mỗi hàng, gờ mái nhô ra. **Mái là vườn kiểu parterre**: các lối đi chéo toả từ góc, ô cỏ hình thang viền hàng rào thấp, nền lát sáng, giữa mỗi mặt có một nửa vòng tròn lát gạch đỏ đất (ảnh [U] chụp từ trên cao) |
| Bậc 2 | 0,35 | 0,65 (gờ mái 0,67) | Khoảng 2 tầng, gờ mái nặng |
| Bậc 3 | 0,46 | 0,61 | 2 hàng cửa, sân mái có ô cỏ và giàn hoa, 4 chòi nhỏ có đỉnh thu bậc ở góc |
| Bậc 4 | 0,59 | 0,27 | Khối vuông, mỗi mặt có một cửa vòm cao |
| Đế đèn lồng | 0,62 | 0,18 → 0,27 | Bậc loe |
| Đèn lồng | 0,73 | 0,15 | Tám cạnh (hoặc tròn có 8 trụ), cột nhọn nhỏ ở góc |
| Đầu loe hình chén | 0,80 | ≈ 0,10 | |
| Kim | 0,94 | 0,035–0,04, thon dần | |
| Ngôi sao mặt trời vàng | 1,00 | 0,093 | |

Sảnh vào: mái phẳng màu xám, rộng khoảng 0,52 W, cao khoảng 1,5 tầng, có **4 cột tròn** với khoảng giữa rộng hơn. Sảnh đứng trên bậc thềm lớn, rộng bằng sảnh, khoảng 15 bậc.

### 2.3 Cánh nhà và chòi tháp

- Hai cánh dài đối xứng hai bên tháp. Mái phẳng màu xám nhạt, có lan can đá chạy dọc mép mái.
- **Gờ mái cánh cao ≈ 20 m, ngang đỉnh khối đế tháp** (0,26 H). Đo trên ảnh flycam ngoài cổng (`unicons_1`), dựng lại camera như ở §2.7. Mặt sau cánh C ([U] chụp chéo) có 5 hàng cửa sổ.
- Cửa sổ hẹp và cao, xếp thành các khoang dọc đều nhau, ngăn bởi trụ áp tường. Tầng trệt có cửa vòm hoặc hành lang vòm.
- Các chòi tháp vuông ngắt nhịp cánh nhà ở chỗ nối và ở đầu cánh. Mỗi chòi cao hơn cánh 1–2 tầng, đỉnh thu bậc 2–3 lần, trên cùng là khối nhỏ có một khe vòm hẹp. Đầu cánh hơi nhô ra, nên mặt tiền ôm quảng trường thành hình chữ U nông.
- Mái cánh E (nối với tháp) cũng là vườn: cỏ, lối đi cong, một nửa vòng tròn lát gạch (ảnh [U] chụp từ trên cao).

### 2.4 Quảng trường đài phun và hàng cột

- Hai hàng cột cong đối xứng, mỗi hàng là một cung lõm khoảng 60–80°, đồng tâm với đài phun. Mỗi cung có khoảng 8 cột Ionic trơn, thân cao khoảng 8–9 lần đường kính, tổng cao khoảng 8,5–10 m. Đầu cung phía đường kết thúc bằng một trụ khối 2×2 cột dưới khối đầu cột cao hơn. Trên đầu cột có dầm phẳng chạy liền, đặt bình hoặc tượng nhỏ cách quãng.
- Bán kính cung ≈ 1,8 lần bán kính bể ngoài. Với Ø bể 41 m (OSM), hai hàng cột cách nhau khoảng 75 m, khớp với ước lượng 70–80 m của [W]. Dựng lại camera ảnh flycam ngoài cổng (§2.7) cũng cho 78 m. Trụ khối đầu cung nằm ở a ≈ −5 đến −15.
- Đài phun tròn có nhiều tầng: bể ngoài viền đá trắng, quanh bể là vòng hoa hồng có viền hàng rào thấp; trong bể có khoảng 10–12 tượng nhỏ trên bệ. Bên trong là bể nâng cao (khoảng 45% đường kính), rồi bệ bậc, trên cùng là một tượng trắng lớn quay mặt ra đường.
- Lát nền thành các dải vòng đồng tâm: sáng, trung, sáng, rồi một dải tối mảnh hơn (rộng khoảng 1/3 dải sáng). Quảng trường nối ra đường qua 4–5 bậc cong thấp.

### 2.5 Trục, cây và nền

- Đi từ quảng trường đài phun lên trục là các đoạn lan can trắng có bậc hai bên. Trục là lối đi thẳng rộng khoảng bằng sảnh. Mỗi bên có tượng trắng trên bệ (khoảng 5 tượng thấy được mỗi bên; booklet nói tổng cộng 12 tượng thần), tiếp theo là hàng thông tháp, rồi đến cỏ.
- Thông tháp (cypress/thuja) cao gấp 4–6 lần bề ngang, trồng hàng đơn hoặc hàng đôi so le, mỗi bên hơn 20–25 cây. Cây tán tròn (tán rộng bằng hoặc hơn chiều cao) đứng ở vùng rìa, sau hàng cột. Chân hàng cột có bụi tròn cắt tỉa.
- Sân trước bậc thềm: nền đá beige sáng, khảm các dải than tối.
- Bãi cỏ trước cánh C (giữa dải vườn tượng và tay D, quanh (c, a) = (−60, 135)): các hàng ghế hoặc bồn đá trắng xếp chéo trên cỏ. Đây là khu **phía trước** nhà chính, không phải phía sau.

### 2.6 Bảng màu (đã gộp)

| Vật liệu | Hex mẫu | Ghi chú |
|---|---|---|
| Tường trắng ngà (nắng) | `#F6F2EF`, `#F4F1EC`; ánh sáng ban ngày nhìn từ trên cao `#E4E1DA` | Đáng tin |
| Tường trong bóng (ấm / lạnh) | `#C9BCAF` / `#8D9CA5` | Bóng đổ lạnh do ánh trời |
| Đá cột, cổng trong bóng | `#A6A19A` | |
| Vàng (sao, chi tiết) | `#D9A55A` (trên mặt đất) – `#BAA262` (từ trên cao) | |
| Lát sáng / trung / dải tối | `#E5D3C3` / `#C4B4A3` / `#88857E` | Sân trước: `#D4C6B8`, dải khảm `#373A35` |
| Cỏ | `#758945`, `#708051`, `#7F8E60` | Ảnh đã chỉnh màu: nên sáng thêm 15–25% |
| Thông tháp | `#4E5333`, `#5B5D2F` | Như trên |
| Cây tán tròn | `#697756` (phần sáng), `#485538` | Như trên |
| Hồ | `#849DA7` | Xanh-xám đục. Ảnh [U] chụp chéo chỉ thấy mặt hồ phản chiếu trời mù (`#DCDDCF`), không dùng làm màu nước |
| Đường chạy | `#9D3F33` | Ảnh [U] từ trên cao cho `#A33A49`–`#B24656` (ám hồng, xem §2.8.5) |
| Mái hội trường | `#A4B1C9` | Ảnh [U] cho `#AFC1CD`–`#BECFD9`, khớp |
| Đường nhựa | `#4C4A46` – `#485B64` | |
| Trời (đỉnh / chân trời) | `#4896C0` / `#A1C3D5` | |
| Hoa hồng | `#965D4C` – `#AD7D6B` | |

Màu cho cổng: §2.7.4. Màu cho các hạng mục phía sau: §2.8.5.

### 2.7 Cổng khải hoàn ba vòm (đã xác nhận)

**Nguồn.** `ref_gate.png` (ảnh khai trương, chụp thẳng ngang mắt, qua vòm giữa thấy tháp và tượng đài phun). `unicons_1_batch-11-1.png` (flycam ngoài cổng nhìn dọc trục). `zoom_colonnade.png` (cắt từ ảnh unicons). Hai ảnh sa bàn `ref_model_overview.png` và `ref_model_night.png`. Ảnh [U] chụp chéo `user_back_oblique.webp`.

#### 2.7.1 Vị trí

- Cổng **đứng trên trục** (c = 0), **ngay trên hàng rào ranh giới** của campus, tâm ở a ≈ −55, tức (x, y) ≈ (−257, −181).
  - Cạnh trước của polygon campus trong OSM (way 777888670) là một đoạn thẳng ở a = −56, chạy từ c = −54 tới c = +58.
  - Ảnh unicons cho thấy hàng rào nối liền hai bên cổng.
  - Dựng lại camera ảnh unicons (hiệu chỉnh bằng đài phun OSM Ø 41 m, kiểm lại bằng khoảng D–F 233 m của OSM, sai 2%) cho chân cổng ở a = −49 ± 7.
  - Toạ độ tạm cũ của [W], (−264, −172), lệch khoảng 11 m.
- Thứ tự từ ngoài vào, trên trục:
  1. Sân lát beige rộng ngoài cổng, rồi dải ven hồ (OSM không vẽ). Bờ hồ gần ở a = −122.
  2. Cổng và hàng rào (a ≈ −55).
  3. Dải cỏ có hàng rào cây thấp.
  4. **Đường vòng nội bộ** chạy ngang sau cổng, ở a ≈ −39 đến −29, rộng khoảng 10 m. Đường xuyên qua vòm giữa của cổng. Hai đầu đường uốn cong vòng ngoài hai hàng cột rồi chạy lên mặt trước hai cánh nhà.
  5. Trụ khối đầu hai hàng cột (a ≈ −5 đến −15).
  6. Đài phun (a = 0).
- Ngoài hai đầu hàng rào, ranh giới rẽ hai hướng. Bên trái chạy chéo về sau tới (c, a) = (−152, −24). Bên phải chạy thẳng ra trước theo c ≈ 57 tới bờ hồ (a = −123), rồi men theo bờ hồ.
- Hàng rào: trụ đá trắng thấp xen song sắt đen trên một bệ thấp, cao khoảng 2 m, phía trong là dải hàng rào cây.
- Ảnh sa bàn (cả hai ảnh) và ảnh [U] chụp chéo đều cho thấy cổng nằm sau quảng trường đài phun, nhìn từ phía tháp, với mặt hồ ngay sau cổng. Cổng trong ảnh khai trương có chữ tên trường và nhìn thẳng ra tháp, nên đây đúng là cổng trục của campus.

#### 2.7.2 Hình dạng

Lấy theo ảnh chụp thẳng `ref_gate`. Mọi phần dưới đây tính theo bề rộng tổng Wg (gồm cả gờ mái hai cánh bên) và chiều cao tổng Hg (tới đỉnh gờ mái khối giữa).

- **3 vòm.** Vòm giữa cao và rộng hơn hẳn hai vòm bên. Ba vòm đều là bán nguyệt trên hai trụ có gờ chân vòm.
- **Khối giữa:** thân rộng 0,55 Wg, gờ mái đỉnh rộng 0,65 Wg (nhô mạnh ra hai bên), cao 1,00 Hg.
  - Vòm giữa: lòng rộng 0,23 Wg, chân vòm ở 0,33 Hg, đỉnh vòm ở 0,68 Hg. Mặt trong vòm có ô trần (caisson), màu tối hơn vì nằm trong bóng.
  - Hai trụ hai bên vòm giữa, mỗi trụ rộng 0,16 Wg. Mỗi trụ mang **một cặp cột Ionic** áp tường, thân trơn, đứng trên bệ có dải vàng. Cột (gồm đế và đầu cột) cao 0,73 Hg, đường kính khoảng 0,035 Wg. Đầu cột ở 0,79 Hg.
  - Phía trên đầu cột là attic: mặt phẳng có dải chữ (tên trường, chữ vàng), trên cùng là gờ mái nặng có một dải vàng mảnh. Ngay dưới attic, ngang đầu cột, có **dải hoa văn vàng** kiểu vòng hoa rủ, giữa là một huy hiệu (cartouche) vàng trên đỉnh vòm.
  - Nhìn từ trên cao (unicons, zoom_colonnade), mái khối giữa là một sân phẳng. Trên sân có một khối attic nâng nhỏ hơn, rộng khoảng 0,75 bề rộng khối giữa, lùi khỏi mép trước, mặt trên chia ô.
- **Hai cánh bên:** mỗi cánh thân rộng 0,20 Wg (cộng gờ nhô 0,04 Wg ở mép ngoài), cao 0,63 Hg, mái phẳng có gờ và dải vàng mảnh.
  - Mỗi cánh có 1 vòm nhỏ: lòng rộng 0,12 Wg, chân vòm ở 0,26 Hg, đỉnh vòm ở 0,41 Hg. Viên khoá vòm là một mặt nạ hoặc huy hiệu nhỏ.
  - Trụ ngoài rộng 0,05 Wg, có một khe vòm nhỏ.
- **Cánh cổng:** sắt rèn màu đen, có hoa văn tròn mạ vàng ở giữa, đỉnh có chóp nhọn. Cánh cổng ở vòm giữa cao khoảng 0,25 Hg. Hai vòm bên cũng có cánh cổng sắt.
- **Chân cổng:** bệ đá cao khoảng 0,04 Hg, có dải vàng-vàng chanh quanh bệ cột.

#### 2.7.3 Kích thước (m)

| | Giá trị | Sai số | Cách đo |
|---|---|---|---|
| Rộng tổng Wg (gồm gờ hai cánh) | **34** | ±15% | Ảnh unicons sau khi dựng camera: 9,95 px/m ở chân cổng, cổng rộng 340 px |
| Cao tổng Hg (đỉnh gờ khối giữa) | **16** (thêm khoảng 1,5–2 m attic nâng, lùi vào trong) | ±15% | Tỷ lệ Wg/Hg = 2,1 trong `ref_gate`. Dựng camera ảnh unicons độc lập cho 15 m |
| Sâu (trước → sau) | ≈ 10–12 | ±25% | Mặt mái nhìn từ trên cao trong ảnh unicons |
| Lòng vòm giữa | rộng ≈ 7,7, đỉnh ≈ 11 | | Theo tỷ lệ §2.7.2 |
| Lòng vòm bên | rộng ≈ 4, đỉnh ≈ 6,6 | | |
| Cột Ionic | cao ≈ 11,7, Ø ≈ 1,2 | | |
| Hàng rào | cao ≈ 2 | | |

Kiểm chéo:

- Ảnh [U] chụp chéo nhìn cổng từ sau-trái. Cổng rộng 83 px, cao 37 px. Hai cung hàng cột (cách nhau 74 m) cách nhau 140 px theo cùng hướng nhìn. Số đo này khớp với Wg ≈ 34 m nếu cổng sâu ≈ 12 m, và cho Hg ≈ 14 m. Vì bề rộng và chiều sâu bù trừ nhau trong góc nhìn chéo, đây chỉ là kiểm khớp, không phải phép đo độc lập.
- Ảnh `ref_gate` không cho được thước độc lập. Camera ở tầm mắt (đường chân trời ngang đầu người đứng), nhưng chân cổng bị đám đông che. Ảnh này chỉ dùng cho tỷ lệ (Wg/Hg = 2,1).
- So với tháp: Wg ≈ 0,7 W, Hg ≈ 0,2 H, thấp hơn đỉnh khối đế. Cổng cao khoảng 1,7 lần hàng cột quanh đài phun.
- Ước lượng cũ "40 × 18–20 m" và một lần dựng camera tạm ra "48 × 23 m" đều giả định tháp cao 108 m. Hai số đó không khớp với kích thước đài phun trong OSM, nên bỏ.

#### 2.7.4 Màu cổng

| Phần | Hex mẫu | Nguồn |
|---|---|---|
| Đá trắng (nắng) | `#E8E9E9`, `#F5F3EF` (từ trên cao `#F9F8F5`) | `ref_gate`, unicons |
| Đá trong bóng, lòng vòm | `#A3A5A1` – `#C0C1BE` | `ref_gate` |
| Vàng của vòng hoa và huy hiệu | `#C4B27C`, đậm `#968455`; chỗ bão hoà nhất (huy hiệu) `#DFBB31` | `ref_gate` |
| Dải vàng ở chân bệ cột | `#C5AC71` – `#E9C36D` | `ref_gate` |
| Dải vàng mảnh ở gờ mái | trông như `#776C4F` vì quá mảnh; dùng chung màu vàng nhấn | `ref_gate` |
| Cánh cổng sắt | than đen, mẫu lẫn trời `#717679`; nên dùng khoảng `#3A3D40` | `ref_gate` |
| Sân lát ngoài cổng | `#CABBAF` | unicons |
| Đường vòng sau cổng | `#3A3D32` – `#55573C` (ảnh ám xanh) | unicons |

### 2.8 Phía sau nhà chính

#### 2.8.1 Hai ảnh [U] nhìn về đâu

Camera của từng ảnh được dựng lại bằng cách khớp các footprint OSM rồi phủ toàn bộ footprint lên ảnh để kiểm. Script và ảnh phủ nằm ở scratchpad `v03/`.

| Ảnh | Vị trí camera | Hướng nhìn | Thấy gì |
|---|---|---|---|
| `user_back_aerial.webp` (flycam gần như nhìn xuống) | Cách tâm tháp khoảng 58 m về phía nam-đông nam, ngay trên chỗ tháp nối cánh E. (c, a) ≈ (49, 157), cao ≈ 130 m | Bắc-tây bắc (≈ 347°), tức lệch 45° sang trái so với hướng ra sau trục; chúc 52° | Dưới cùng là **phía trước và bên phải** khối tháp: mái sảnh (dưới-trái), mép sân trước, vườn mái cánh E (dưới-phải). Giữa ảnh là các bậc tháp. Nửa trên là **phía sau**: A và 2 cầu kính, G mái pin, H, trạm chiller, công viên cây lưới, sân tennis và bóng rổ, sân vận động (trên-phải). Bên phải là B, hiên cột, sân trước của B và sân khấu ngoài trời. Trên-trái là bãi đỗ xe mái pin, đường phía tây và chung cư |
| `user_back_oblique.webp` (flycam chụp chéo) | Cách tháp khoảng 340 m về phía bắc-tây bắc, ngoài góc sau-trái của campus. (c, a) ≈ (−239, 426), cao ≈ 95 m | Nam-đông nam (≈ 166°), tức nhìn từ sau ra trước; chúc 12° | Gần nhất là mặt sau campus: trạm chiller (dưới-trái), H (dưới-giữa), bãi đỗ xe mái pin (dưới-phải). Giữa ảnh: G, B (trái, mái vòm), vườn mái A, tháp, lưng hai cánh C/D. Xa nhất là phần **phía trước** campus: thảm cỏ trục, đài phun, hàng cột và **cổng ba vòm** (phải). Sau cùng là hồ và cao tốc |

Đọc đúng hai ảnh này:

- Mặt hồ thấy "sau tháp" trong ảnh chụp chéo thực ra là **nhánh hồ phía đông** (bên trái ảnh) và **nhánh hồ phía trước cổng** (bên phải ảnh). Lý do: ảnh nhìn từ sau ra trước. Chiếu ngược bờ hồ gần ra mặt đất cho (c, a) ≈ (194, −3) và (73, −96), khớp OSM.
- Các sân mái bậc thang ở gần camera trong ảnh từ trên cao là **mặt trước và mặt phải** của mái khối đế tháp, vì camera đứng trước tháp. Vườn parterre chạy quanh cả bốn mặt (§2.2).
- "Nhà có hiên cột cổ điển" trong hai ảnh là **hội trường B**, không phải nhà thể thao. Nhà thể thao K và ký túc xá nằm ngoài khung của cả hai ảnh. K chỉ thấy trong `ref_campusmap_render.png`, ở đó nó được ghi nhãn "K".

#### 2.8.2 Thứ tự từ tháp ra sau

- **Trên trục:**
  1. Tháp I (mặt sau ở a = 216).
  2. Thư viện A (a 216–256).
  3. Tòa G (a 256–310).
  4. Sân kỹ thuật.
  5. Đường nội bộ chạy tiếp theo trục, lệch trái khoảng 8 m (c ≈ −8, từ a ≈ 330 tới 480), ra cổng sau trên đường Hải Đăng. Bến xe buýt "Đại học VinUni" của OSM nằm ở (−57, 475).
- **Bên trái trục:**
  1. H (a 273–312).
  2. Trạm chiller và nhà nhỏ (a 332–356).
  3. **Công viên cỏ trồng cây theo lưới**, có lối đi chéo và lối đi thẳng góc (c ≈ −160 tới −15, a ≈ 330 tới 470).
- **Bên phải trục:**
  1. Sân trước của B (lát nhựa tối).
  2. Hội trường B (a 245–311).
  3. Sân khấu ngoài trời (c ≈ 111).
  4. Sân tennis và bóng rổ (c 3–23, a 362–435).
  5. Sân vận động: đường chạy hình bầu dục c ≈ 22–97, a ≈ 330–466; khán đài ở cạnh đông.
  6. Nhà thể thao K (c 170–232).
  7. Ký túc xá (c 284–369).
  8. Nhánh hồ phía đông.
- **Mép tây:** bãi đỗ xe mái pin mặt trời (c ≈ −165 tới −120, a ≈ 180 tới 265), sau lưng hai tòa C và D. Bên ngoài là đường đôi phía tây (c ≈ −165 tới −200).
- **Mép sau:** đường Hải Đăng (a ≈ 478–492), bên kia là biệt thự San Hô.

#### 2.8.3 Từng hạng mục

Hạng mục có way OSM: toạ độ lấy từ OSM. Hạng mục "chỉ có trong ảnh": toạ độ chiếu ngược từ ảnh [U] từ trên cao, sai số khoảng ±10–15 m. Chiều cao là ước lượng từ ảnh (số tầng), trừ B và cánh nhà đã đo bằng camera dựng lại.

| Hạng mục | Tâm (c, a) | Cỡ c × a (m) | Cao | Hình dạng, cách nhận ra |
|---|---|---|---|---|
| Vườn mái tháp | trên khối đế I | 49 × 55 | mái ≈ 20 m | Parterre: ô cỏ hình thang, lối chéo, nửa vòng tròn gạch đỏ đất giữa mỗi mặt, 4 chòi góc ở bậc 3 (§2.2) |
| Thư viện A, vườn mái | (1, 236) | 74 × 40 | 2 tầng, ≈ 10 m | Mái là sân lát gạch nâu-đỏ đất nhạt, có bồn cỏ viền đá, bụi tròn cắt tỉa, ghế; dọc mép là hành lang cột kiểu Tuscan và một giàn hoa (`ref_library_roofgarden`). Chia hai sân bởi cầu kính |
| 2 cầu kính / hành lang kính | c ≈ −30 và c ≈ +10, chạy dọc trục từ a ≈ 225 tới 248 | mỗi cái ≈ 5 × 23 | ≈ 12 m | Chỉ có trong ảnh. Hành lang mái kính xanh-xám nhạt, nối mặt sau tháp với hành lang trước của G, bắc ngang qua mái A. Có thêm một hành lang kính ngắn ở c ≈ 23, a ≈ 206–229, nối tháp với cánh E |
| Tòa G | (−1, 283) | 49 × 54 | 3 tầng, ≈ 15 m | Mái phẳng, **2 mảng pin mặt trời lớn** (trái, phải), giữa là một hộp mái nâng (cửa trời) màu xám. Mặt trước có hành lang |
| Tòa H | (−59, 292) | 57 × 39 | 2 tầng cao, ≈ 12 m | Mái phẳng xám rất nhạt. Tầng trên cửa vòm cao, tầng dưới cửa chữ nhật, giữa các khoang là trụ áp tường |
| Trạm chiller, nhà nhỏ | (−73, 344), (−102, 343) | 28 × 23, 13 × 23 | 1 tầng, ≈ 6 m | Mái kín tháp giải nhiệt và chiller màu xanh-xám |
| Hội trường B | (60, 278) | 67 × 66 | đỉnh vòm ≈ 22 m (±4) | Mái **vòm cuốn** (barrel vault), sống mái chạy ngang trục (theo c), màu xanh-xám rất nhạt. Mặt trước (hướng −a, cùng hướng mặt tiền chính) có **hiên cột có trán tường tam giác**: khoảng 6 cột lớn, đầu cột và một vòng giữa thân mạ vàng (`ref_courtyard`), tâm ở c ≈ 60, nhô ra tới a ≈ 235–240. Hai bên hiên là hai chòi vuông có đỉnh thu bậc, mỗi góc khối có chòi nhỏ. Mặt sau có hàng cột lớn. Từ mặt đất nhìn ra, đỉnh vòm nhô lên sau cánh E |
| Sân trước của B | (72, 226) | ≈ 33 × 31 | mặt đất | Chỉ có trong ảnh. Sân nhựa tối cho xe đón trả, nằm giữa cánh E và B |
| Sân khấu ngoài trời | (111, 258) | Ø ≈ 25 | bậc thấp | Chỉ có trong ảnh. Bậc ngồi hình bán nguyệt, đá sáng xen cỏ, nằm ở góc trước-phải của B |
| Sân tennis | (13, 379) | 20 × 36 | mặt đất | Mặt sân xanh lam, viền xanh lá, có hàng rào cây |
| Sân bóng rổ / đa năng | (13, 416) | 20 × 37 | mặt đất | Mặt sân xanh ngọc và xanh lam, có ô đỏ-cam |
| Sân vận động | đường chạy (60, 398) | bầu dục ≈ 75 × 136; sân cỏ 50 × 71 | khán đài ≈ 8–10 m | Đường chạy **đỏ**, khoảng 6–8 làn, ôm một sân bóng kẻ vạch trắng. Đầu gần trục (a nhỏ) có một vùng cát beige hình bán nguyệt. Khán đài dài 63 m ở cạnh đông (c 95–122). Dài 136 m theo trục, nên đây không phải đường chạy 400 m tiêu chuẩn (vòng ≈ 300 m) |
| Nhà thể thao K | (201, 402) | 62 × 77 | 2 tầng, ≈ 12–15 m | Không có trong hai ảnh [U]. Ảnh render bản đồ campus vẽ khối hộp mái hông xám, mặt trước có trán tường |
| Ký túc xá | (326, 394) | 85 × 60 | 4 tầng, ≈ 15 m | Hai cánh dài 20 × 59 nối nhau, vườn trên mái |
| Công viên cây lưới | (−88, 400) | ≈ 145 × 140 | mặt đất | Chỉ có trong ảnh. Cỏ màu ô liu; cây nhỏ tán tròn trồng theo lưới đều khoảng 10–12 m; lối đi trắng chạy thẳng góc và chéo |
| Bãi đỗ xe mái pin | (−142, 222) | ≈ 45 × 85 | mái ≈ 3–4 m | Hai ảnh [U] cùng chiếu ra một chỗ. Nhiều dãy mái pin nghiêng, xanh than. OSM có trạm sạc 8 ổ ở (−137, 230) nằm trong khu này |
| Đường nội bộ sau | c ≈ −8, a 330 → 480 | rộng ≈ 8 | mặt đất | Chỉ có trong ảnh. Nằm giữa công viên cây lưới và sân tennis |

#### 2.8.4 Hồ: nằm ở đâu

OSM way 761986889 là **một** polygon hình chữ L. Bản 2026-10-07 ghi "uốn quanh mép nam và đông nam", như vậy là chưa đủ.

- **Nhánh trước:** bắt đầu từ thùy phía tây, trước Vườn Hồng (c ≈ −150, a ≈ −75 đến −95). Chạy ngang trước cổng: trên trục, bờ gần ở a = −122 (cách cổng 66 m), bờ xa ở a = −184. Bên kia bờ xa là đường Lê Trần Cẩn và cao tốc.
- **Nhánh đông:** chạy dọc suốt cạnh phải của campus, từ trước ra tới đường Hải Đăng ở phía sau (a ≈ 473). Bờ gần ở c ≈ 192 (khi a = 0), c ≈ 300 (a = 100), c ≈ 369 (a = 200), c ≈ 396 (a = 300), c ≈ 412 (a = 400). Nhánh rộng 50–180 m, nằm sau lưng nhà thể thao và ký túc xá.
- Phía sau tháp, trên trục và bên trái, **không có hồ**.
- Mặt nước xa thấy trong ảnh unicons (sau campus, bên phải) là một hồ khác của khu đô thị, nằm ngoài đường Hải Đăng (OSM way 777888669 và xa hơn).

Bằng chứng:

- Chiếu ngược bờ hồ trong ảnh [U] chụp chéo khớp với OSM: (194, −3) so với OSM c = 192 khi a = 0.
- Cả hai ảnh sa bàn đều có mặt nước ngay sau cổng.
- Ảnh render bản đồ campus cho thấy hồ cong ôm mép trước và mép phải.

Hệ quả cho game: hồ ở góc trước-phải của sa bàn v0.2 là một khung cắt đúng của thực tế. Nếu kéo dài cảnh ra sau, hồ chỉ nên tiếp tục ở mép phải (+x).

#### 2.8.5 Màu các hạng mục phía sau

Ảnh [U] từ trên cao được chỉnh màu mạnh: cỏ ngả xanh ngọc, đỏ ngả hồng. Cột "Gợi ý cho game" là màu đã kéo về cùng hệ với bảng §2.6. Đây là đề xuất, quyết định cuối cùng thuộc về designer.

| Vật liệu | Hex mẫu (nguồn) | Gợi ý cho game |
|---|---|---|
| Đường chạy | `#A33A49`, `#B24656` ([U] từ trên cao); `#9D3F33` (§2.6) | `#A5443F` |
| Sân cỏ sân vận động (sọc sáng, tối) | `#06674C`, `#035B44` | `#5E9A4E` / `#558E46` (sọc) |
| Vùng cát đầu đường chạy | `#B9AB99`, `#B1A996` | `#C9B9A0` |
| Sân tennis, viền | `#089DC1`, `#068AAC`; viền `#318872` | `#3F93B5`, viền `#4F8A5A` |
| Sân đa năng | `#3F869F`, `#44AAB6`, xen ô đỏ-cam | `#4A9AAE` |
| Mái vòm B | `#AFC1CD`, `#BECFD9` (từ trên cao); `#AEBFC5` (chụp chéo) | `#B4C3CF` |
| Mái hiên B, trán tường | `#B2C0CB`, `#CDDBE3` | như mái vòm |
| Cột B: thân, vàng đầu cột và vòng giữa | `#CED6DC`; `#C4A576`, đậm `#A37D45` (`ref_courtyard`) | trắng, nhấn `lm.accent` |
| Sân trước B (nhựa) | `#5D6D76`, `#374C55` | `#5A6268` |
| Sân khấu ngoài trời | đá `#A7C7C3`; cỏ `#325D41` | đá như `path` |
| Pin mặt trời (G, bãi đỗ) | `#2C4B6B`, `#1E3F59`, khung `#ADBAC8`; chụp chéo phản trời `#5687BB` | `#2E4A68`, vạch khung `#9FB0C2` |
| Màng mái G, hộp cửa trời | `#A8B0BD`, `#A9B2BE` | `#B0B6BF` |
| Mái phẳng H | `#CDD1D7` (từ trên cao); `#F9F1E8` (chụp chéo, nắng mù) | `#D3D5D8` (như `lm.roof`) |
| Mái sảnh tháp | `#8893A4` | `#9AA2AE` |
| Sân lát mái A | `#9B8983` (từ trên cao); `#CABEB7` (mặt đất) | `#BDAFA6` |
| Cỏ vườn mái (A, E, tháp) | `#738660`, `#475829`; mặt đất `#7F8924` | dùng `ground` / `~hedge` |
| Nửa vòng tròn gạch trên mái tháp | `#A88A7D`, `#805047` | `#A9705F` |
| Cầu kính | `#A0BABA`, `#8D908D` | `~glass` sáng hơn khoảng 20% |
| Cỏ công viên cây lưới | `#7A793C`, `#878950` (ô liu) | `#93A160` |
| Tường trắng các tòa phía sau | như §2.6 | |

## 3. Chưa chắc

- **Chiều cao tháp.** Nguồn chính thức nói 108 m. Đo ảnh lại cho khoảng 81 m (±8):
  - Dựng camera ảnh unicons bằng đài phun OSM Ø 41 m và kiểm lại bằng khoảng D–F 233 m (sai 2%). Ra khối đế rộng 49 m, khớp footprint OSM 49 m. Ra đỉnh ngôi sao cao ≈ 81 m.
  - Số 81 m cho khoảng 5 m mỗi tầng ở khối đế. Số 108 m cho 7 m mỗi tầng.
  - Có thể 108 m là số của phối cảnh 2018. Cũng có thể footprint OSM nhỏ hơn thật (nhưng ba footprint OSM độc lập khớp nhau).
  - Chuyện này không ảnh hưởng tới game, vì cảnh chỉ dùng tỷ lệ ở §2.2.
  - Bản 2026-10-07 viết "W ≈ 65 m, khớp footprint OSM 67 m". Câu đó sai: 67 m là bbox theo x/y, không phải cạnh thật.
- **Màu kính cửa sổ.** Ảnh chụp từ trên cao cho `#8AA6B3` (xanh-xám, phản chiếu trời), ảnh [U] từ trên cao cho `#456A86`. Ảnh mặt đất cho `#614D40` (nâu-xám tối). Nghiêng về xanh-xám.
- **Mặt cắt quảng trường đài phun.** [W] mô tả các bậc đá lượn đồng tâm đi xuống như khán đài. [L] thấy nền phẳng lát dải đồng tâm, chỉ có 4–5 bậc ở mép đường, và một thềm bậc có thác nước ở phía sau đài phun. Ảnh unicons phóng to cho thấy giữa đài phun và chân hàng cột có các bậc đá xám toả tròn. Nghiêng về cách đọc của [L], cộng thêm bậc toả tròn ở hai bên.
- **Thứ tự cỏ trên trục.** Chưa rõ cỏ nằm giữa trục (có lối đi ở giữa) hay chỉ ở hai bên lối đi.
- **Hoa văn sân trước.** [W] thấy ô cờ hoặc lưới sáng. [L] thấy các chevron và hình thoi tối hội tụ về phía bậc thềm. Ảnh [U] từ trên cao thấy các tia hội tụ về sảnh, gần với [L].
- **Tỷ lệ bề rộng bậc tháp.** [W] ước bậc 2 ≈ 0,75 W và bậc vuông ≈ 0,45 W, khác số đo chụp thẳng ở §2.2. Ưu tiên §2.2.
- **Danh tính tượng đỉnh đài phun.** Booklet gọi là "đài phun Apollo"; ảnh [L] trông như một tượng nữ mặc áo choàng. Không ảnh hưởng tới cảnh low-poly.
- **Mặt bằng.** Dãy D–C–I–E–F trên OSM lệch về một phía (chỉ F nhô ra), trong khi ảnh cho thấy hai đầu đối xứng; ưu tiên ảnh. Tòa "K" chính là nhà thể thao trong nhà (`ref_campusmap_render`, đánh dấu đúng chỗ của way 881048981).
- **Hình khối nhà thể thao K.** Chỉ có ảnh bên trong và hình render (hộp mái hông, trán tường). Chưa có ảnh thật bên ngoài.
- **Hội trường B.** Chưa chắc số cột hiên (đếm được khoảng 6) và chiều sâu hiên. Đỉnh vòm ≈ 22 m đo trên ảnh unicons, sai số khoảng ±4 m.
- **Hạng mục chỉ có trong ảnh** (§2.8.3: cầu kính, sân khấu ngoài trời, sân trước B, công viên cây lưới, đường nội bộ sau): sai số vị trí khoảng ±10–15 m. Riêng bãi đỗ xe mái pin đã được hai ảnh cùng xác nhận.
- **Nguồn không dùng cho chi tiết.** Ảnh phối cảnh năm 2018 (báo SGGP) khác công trình đã xây; chỉ dùng để tham khảo khúc cong của hồ. Chưa xem tour ảo 360° (https://vinuni.edu.vn/vi/visit-2/).

## 4. Đề xuất cho game (chưa phải quyết định)

- **Rút gọn hình khối:** một thanh trắng mái phẳng cho mỗi cánh, các dải tối cho khoang cửa, các hộp cao hơn cho chòi tháp; tháp là 4 hộp thu nhỏ dần + đèn lồng tám cạnh + nón kim + quả cầu hoặc sao vàng. Hai cung cột cong dùng cột trụ mảnh instanced dưới một dầm cong. Đài phun là bể tròn + bệ. Thông tháp là các nón cao instanced. Sân lát bằng các dải vòng. Hồ là một mesh phẳng cong ở một mép. Tất cả đều dựng được bằng primitive, mesh tĩnh merge và instance.
- **Cổng ba vòm.** Dựng 3 hộp: khối giữa và hai cánh thấp hơn (0,63 Hg). Mỗi lòng vòm là một hộp tối kèm nửa trụ đứng làm đỉnh vòm. Thêm 4 cột tròn mảnh (2 cặp) ở hai trụ giữa, một dải vàng ngang đầu cột và một dải vàng mảnh dưới gờ mái. Hai đoạn hàng rào thấp chạy ngang hai bên. Theo tỷ lệ tháp game hiện tại (W = 6 u, H = 10 u), cổng rộng khoảng 4,2 u và cao khoảng 2 u. Vị trí: trên trục, phía trước đài phun, cách đài phun khoảng 1,5 lần bán kính hàng cột. Giữa cổng và hàng cột là một dải đường vòng. Chữ tên trường trên attic là dấu hiệu thương hiệu, nên chỉ đặt trong theme pack. Core chỉ có dải vàng trơn.
- **Phía sau nhà chính**, theo thứ tự đáng dựng nhất, vì đọc tốt từ camera isometric và rẻ tam giác:
  1. Sân vận động: đường chạy đỏ, sân cỏ, cát. Gần như chỉ là mặt phẳng.
  2. Mái vòm B và hiên trán tường. Đây là hình dễ nhận nhất sau tháp.
  3. G mái pin: hộp phẳng với hai tấm xanh than.
  4. Sân tennis và bóng rổ: mặt phẳng màu.
  5. Hai cầu kính trên mái A.
  6. Công viên cây lưới: cây instanced theo lưới.

  Mọi thứ phía sau đều thấp hơn đỉnh khối đế tháp (≤ 22 m ≈ 0,26 H), nên có thể đặt sau tháp mà không đẩy khung hình lên. Hồ nếu kéo ra sau chỉ nằm ở mép phải.
- **Archetype chung trong core** (theme chọn qua manifest): `tiered-spire-hall` (tháp), `arched-colonnade` (hàng cột và cổng), `dormitory-block`.
- **Đặt zone:** Thư viện ngay sau tháp, giống tòa A. Chợ thay chỗ canteen (tòa E) hoặc nhà thể thao. Tháp canh dùng lại tháp hoặc khán đài sân vận động.
- **Nhận diện thương hiệu:** chữ "VINUNIVERSITY" trên cổng và biểu tượng mặt trời vàng là dấu hiệu thương hiệu. Nếu dùng thì chỉ đặt trong theme pack (`public/themes/vinuni/`), không đặt trong `frontend/app`.
- **Bản quyền OSM:** dùng tỷ lệ gần đúng là đủ. Nếu mã hoá toạ độ hoặc footprint OSM vào repo thì phải ghi "© OpenStreetMap contributors (ODbL)".

## 5. Nguồn

- https://vinuni.edu.vn/campus-en/ : trang campus chính thức (thông số thư viện, giảng đường, hội trường, sân vận động, nhà thể thao, ký túc xá; ảnh chụp từ trên cao có hồ, sân điền kinh và thư viện).
- https://vinuni.edu.vn/wp-content/uploads/2020/07/VinUnis-Facility.pdf : booklet cơ sở vật chất (ký hiệu các tòa, diện tích quảng trường, đài phun Apollo và 12 tượng, tháp 108 m, thư viện ở tòa A, phong cách tân cổ điển).
- https://unicons.vn/en/project/vinuni-vin-university/ : trang dự án của nhà thầu (thi công 9/2018–12/2019, khoảng 23 ha). Ảnh flycam ngoài cổng nhìn dọc trục (`unicons_1_batch-11-1.png`) là tham chiếu tổng thể tốt nhất, và là ảnh chính để định vị và đo cổng (§2.7).
- https://vinuni.edu.vn/?p=6705 : bài khai trương campus (15/01/2020): cổng chính (`ref_gate.png`), mô hình campus, sân trong, mặt đứng tháp.
- https://vinuni.edu.vn/wp-content/uploads/2024/03/Banner-1-2.jpg : ảnh toàn cảnh quảng trường đài phun, hàng cột, trục và tháp.
- https://vinuni.edu.vn/wp-content/uploads/2024/02/LF_07127-scaled.jpg : ảnh chụp thẳng tháp từ bãi cỏ; nguồn chính cho tỷ lệ ở §2.2.
- https://vinuni.edu.vn/wp-content/themes/vinuni2023/assets/images/footer_bg.png và https://vinuni.edu.vn/wp-content/uploads/2023/12/bg-video-2-e1711078971335.png : bóng skyline (cổng vòm, tháp).
- https://vinuni.edu.vn/wp-content/uploads/2024/02/HNE-4824-scaled.jpg : bên trong nhà thể thao.
- https://www.sggp.org.vn/xem-phoi-canh-dai-hoc-vinuni-rong-23ha-10-tang-voi-thap-cao-108m-post499524.html : phối cảnh năm 2018 (10 tầng, tháp 108 m); khác công trình thực tế.
- https://www.vingroup.net/en/news/detail/1952/vinuni-groundbreaking-ceremony-not-for-profit-university-with-international-standard : khởi công; mặt tiền tân cổ điển, thiết kế bởi AECOM và HBA (qua đoạn trích tìm kiếm).
- https://en.wikipedia.org/wiki/VinUniversity : campus 230.000 m² trong Vinhomes Ocean Park.
- **[U]** Hai ảnh chủ dự án gửi ngày 2026-10-08, chỉ nằm trong scratchpad: `user_back_aerial.webp` (flycam gần như nhìn xuống, từ trước-phải tháp nhìn ra sau) và `user_back_oblique.webp` (flycam chụp chéo, từ sau-trái nhìn ra trước). Camera dựng lại bằng script trong scratchpad `v03/` (`fit_aerial.py`, `fit_obl3.py`, `ov.py`, `my_uni2.py`–`my_uni4.py`).
- https://nominatim.openstreetmap.org/search?q=VinUniversity&format=json và Overpass API (`overpass.private.coffee`) : polygon campus (way 777888670), các tòa, hồ (way 761986889), sân, nút trạm sạc và bến xe buýt. © OpenStreetMap contributors, ODbL 1.0.
