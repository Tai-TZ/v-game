> Trạng thái: tài liệu nghiên cứu để dựng cảnh campus của theme `vinuni`, 2026-10-07. Gộp hai đợt nghiên cứu: web/OSM/booklet chính thức (ký hiệu **[W]**) và ảnh trên trang chủ trường (ký hiệu **[L]**). Ảnh tham chiếu chỉ nằm trong scratchpad của phiên làm việc, **không** đưa vào repo.

# Tham chiếu khuôn viên VinUniversity (Gia Lâm, Hà Nội)

**Quy ước.** "Chắc chắn" nghĩa là có trong nguồn chính thức, hoặc hai nguồn độc lập khớp nhau. Mọi thứ khác nằm ở §3. Toạ độ tính bằng mét cục bộ quanh điểm 20.9886 N, 105.9460 E (x hướng đông, y hướng bắc), lấy từ OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0. Màu là hex lấy mẫu bằng Pillow từ ảnh marketing.

## 1. Tóm tắt

Campus đối xứng qua **một trục dài khoảng 180–200 m**. Trục lệch khoảng 30° về phía đông so với hướng bắc, nên mặt tiền nhìn về phía nam-tây nam. Đi dọc trục từ ngoài vào: cổng khải hoàn ba vòm → quảng trường đài phun hình móng ngựa, ôm bởi hai hàng cột cong → lối đi thẳng có tượng trắng và hàng thông tháp, hai bên là cỏ → sân trước lát đá sáng → bậc thềm lớn và sảnh 4 cột → **tháp bậc 108 m**, hai bên là cánh nhà dài màu trắng ngà. Hồ lớn uốn quanh mép nam và đông nam. Phía sau tháp lần lượt là thư viện, hội trường mái vòm, khu học, sân vận động, nhà thể thao và ký túc xá.

## 2. Chắc chắn

### 2.1 Mặt bằng (OSM, booklet chính thức)

| Hạng mục | Tâm (x, y) m | Kích thước | Ghi chú |
|---|---|---|---|
| Đài phun | (−224, −129) | Ø ≈ 41 m | OSM `amenity=fountain` |
| "Quảng trường Trung tâm" | (−180, −54) | quảng trường chính 1.716 m² | Cỏ cộng đài phun 1.496 m² (booklet) |
| Tòa I (tháp) | (−130, 25) | 67 × 69 m | Đài phun → tháp ≈ 178 m |
| Dãy mặt tiền D–C–I–E–F | D (−233, 57), C (−178, 63), E (−75, 2), F (−57, −58) | dài khoảng 200 m | Canteen ở tòa E, quán café ở tòa I |
| Tòa A (thư viện) | (−109, 63) | 2 tầng, 4.000 m², vườn trên mái | Nằm ngay sau tháp |
| Tòa B (hội trường) | (−32, 69) | khối lớn nhất, 3.825 m², 1.500 chỗ | Mái vòm cong xanh-xám nhạt |
| Tòa G và H (khu học, lab) | G (−82, 104), H (−128, 151) | | G nhìn ra cổng San Hô |
| Sân vận động | (34, 159) | 131 × 138 m, hơn 1.100 chỗ | Đường chạy đỏ; khán đài ở phía đông (80, 151) |
| Sân tennis, sân bóng rổ | (−17, 185), (−1, 214) | | Phía bắc sân vận động |
| Nhà thể thao trong nhà | (149, 92) | khoảng 90 × 92 m, 2 tầng | Bể bơi 50 × 25 m |
| Ký túc xá | (253, 28) | hai cánh 4 tầng nối nhau, tổng ≈ 104 × 95 m | 72 căn hộ, 376 giường, vườn trên mái |
| Vườn Hồng | (−321, −71) | khoảng 100 × 120 m | Vườn hình học ở phía tây quảng trường đài phun |
| Hồ "VinUni Lake" | (−79, −211) | ≈ 8,8 ha, bbox khoảng 825 × 443 m | Uốn quanh mép nam và đông nam |

Bối cảnh xung quanh: phía tây bắc là các tháp chung cư 25–30 tầng; phía đông bắc là dãy biệt thự thấp tầng (San Hô); bên kia hồ về phía tây nam là cao tốc Hà Nội–Hải Phòng.

### 2.2 Tháp (tòa I)

Cao 108 m (nguồn chính thức), trên đỉnh có biểu tượng mặt trời. W là bề rộng mặt trước của khối đế. Chiều cao H ≈ 1,65 W, tức W ≈ 65 m, khớp với footprint OSM 67 m. Số đo dưới đây lấy từ ảnh chụp thẳng mặt [L]. Đo trên ảnh chụp chéo từ trên cao [W] cho kết quả khớp trong khoảng ±3%.

| Tầng khối (dưới → trên) | Đỉnh tại (phần của H) | Rộng (phần của W) | Hình dạng |
|---|---|---|---|
| Khối đế | 0,26 | 1,00 | 4 tầng ở các khoang góc, khoảng 14 cửa sổ mỗi hàng, gờ mái nhô ra |
| Bậc 2 | 0,35 | 0,65 (gờ mái 0,67) | Khoảng 2 tầng, gờ mái nặng |
| Bậc 3 | 0,46 | 0,61 | 2 hàng cửa, sân mái có cây xanh, 4 chòi nhỏ ở góc |
| Bậc 4 | 0,59 | 0,27 | Khối vuông, mỗi mặt có một cửa vòm cao |
| Đế đèn lồng | 0,62 | 0,18 → 0,27 | Bậc loe |
| Đèn lồng | 0,73 | 0,15 | Tám cạnh (hoặc tròn có 8 trụ), cột nhọn nhỏ ở góc |
| Đầu loe hình chén | 0,80 | ≈ 0,10 | |
| Kim | 0,94 | 0,035–0,04, thon dần | |
| Ngôi sao mặt trời vàng | 1,00 | 0,093 | |

Sảnh vào: mái phẳng, rộng khoảng 0,52 W, cao khoảng 1,5 tầng, có **4 cột tròn** với khoảng giữa rộng hơn. Sảnh đứng trên bậc thềm lớn, rộng bằng sảnh, khoảng 15 bậc.

### 2.3 Cánh nhà và chòi tháp

- Hai cánh dài đối xứng hai bên tháp. Mái phẳng màu xám nhạt, có lan can đá chạy dọc mép mái.
- Cửa sổ hẹp và cao, xếp thành các khoang dọc đều nhau, ngăn bởi trụ áp tường. Tầng trệt có cửa vòm hoặc hành lang vòm.
- Các chòi tháp vuông ngắt nhịp cánh nhà ở chỗ nối và ở đầu cánh. Mỗi chòi cao hơn cánh 1–2 tầng, đỉnh thu bậc 2–3 lần, trên cùng là khối nhỏ có một khe vòm hẹp. Đầu cánh hơi nhô ra, nên mặt tiền ôm quảng trường thành hình chữ U nông.

### 2.4 Quảng trường đài phun và hàng cột

- Hai hàng cột cong đối xứng, mỗi hàng là một cung lõm khoảng 60–80°, đồng tâm với đài phun. Mỗi cung có khoảng 8 cột Ionic trơn, thân cao khoảng 8–9 lần đường kính. Đầu cung phía đường kết thúc bằng một trụ khối 2×2 cột dưới khối đầu cột cao hơn. Trên đầu cột có dầm phẳng chạy liền, đặt bình hoặc tượng nhỏ cách quãng.
- Bán kính cung ≈ 1,8 lần bán kính bể ngoài. Với Ø bể 41 m (OSM), hai hàng cột cách nhau khoảng 75 m, khớp với ước lượng 70–80 m của [W].
- Đài phun tròn có nhiều tầng: bể ngoài viền đá trắng, quanh bể là vòng hoa hồng có viền hàng rào thấp; trong bể có khoảng 10–12 tượng nhỏ trên bệ. Bên trong là bể nâng cao (khoảng 45% đường kính), rồi bệ bậc, trên cùng là một tượng trắng lớn quay mặt ra đường.
- Lát nền thành các dải vòng đồng tâm: sáng, trung, sáng, rồi một dải tối mảnh hơn (rộng khoảng 1/3 dải sáng). Quảng trường nối ra đường qua 4–5 bậc cong thấp.

### 2.5 Trục, cây và nền

- Đi từ quảng trường đài phun lên trục là các đoạn lan can trắng có bậc hai bên. Trục là lối đi thẳng rộng khoảng bằng sảnh. Mỗi bên có tượng trắng trên bệ (khoảng 5 tượng thấy được mỗi bên; booklet nói tổng cộng 12 tượng thần), tiếp theo là hàng thông tháp, rồi đến cỏ.
- Thông tháp (cypress/thuja) cao gấp 4–6 lần bề ngang, trồng hàng đơn hoặc hàng đôi so le, mỗi bên hơn 20–25 cây. Cây tán tròn (tán rộng bằng hoặc hơn chiều cao) đứng ở vùng rìa, sau hàng cột. Chân hàng cột có bụi tròn cắt tỉa.
- Sân trước bậc thềm: nền đá beige sáng, khảm các dải than tối.

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
| Hồ | `#849DA7` | Xanh-xám đục |
| Đường chạy | `#9D3F33` | |
| Mái hội trường | `#A4B1C9` | |
| Đường nhựa | `#4C4A46` – `#485B64` | |
| Trời (đỉnh / chân trời) | `#4896C0` / `#A1C3D5` | |
| Hoa hồng | `#965D4C` – `#AD7D6B` | |

## 3. Chưa chắc

- **Chiều cao cánh nhà.** Các nguồn không thống nhất: OSM ghi 2–4 tầng, nguồn chính thức nói nhà chính 10 tầng, [W] ước 5–6 tầng, [L] ước khoảng 4 tầng. Ảnh chụp chéo từ trên cao cho thấy mái cánh ngang đỉnh khối đế (≈ 0,26 H). Ảnh chụp từ mặt đất lại cho thấy mái cánh chỉ cao khoảng 0,65–0,7 khối đế, có thể do phối cảnh.
- **Màu kính cửa sổ.** Ảnh chụp từ trên cao cho `#8AA6B3` (xanh-xám, phản chiếu trời). Ảnh mặt đất cho `#614D40` (nâu-xám tối). Art cần chọn một màu.
- **Mặt cắt quảng trường đài phun.** [W] mô tả các bậc đá lượn đồng tâm đi xuống như khán đài. [L] thấy nền phẳng lát dải đồng tâm, chỉ có 4–5 bậc ở mép đường, và một thềm bậc có thác nước ở phía sau đài phun. Nghiêng về cách đọc của [L].
- **Thứ tự cỏ trên trục.** Chưa rõ cỏ nằm giữa trục (có lối đi ở giữa) hay chỉ ở hai bên lối đi.
- **Hoa văn sân trước.** [W] thấy ô cờ hoặc lưới sáng. [L] thấy các chevron và hình thoi tối hội tụ về phía bậc thềm.
- **Cổng khải hoàn.** Chắc chắn có cổng: ảnh khai trương chính thức, 3 vòm, cặp cột, diềm vàng. Nhưng vị trí chưa rõ: OSM không đánh dấu, [W] đặt tạm gần (−264, −172). Kích thước khoảng 40 × 18–20 m là ước lượng. Ảnh banner lại cho thấy giữa quảng trường và cổng có một con đường. Cổng trong hình footer của trang trường có thể là một landmark của Vinhomes chứ không phải cổng trường.
- **Tỷ lệ bề rộng bậc tháp.** [W] ước bậc 2 ≈ 0,75 W và bậc vuông ≈ 0,45 W, khác số đo chụp thẳng ở §2.2. Ưu tiên §2.2.
- **Danh tính tượng đỉnh đài phun.** Booklet gọi là "đài phun Apollo"; ảnh [L] trông như một tượng nữ mặc áo choàng. Không ảnh hưởng tới cảnh low-poly.
- **Mặt bằng.** Dãy D–C–I–E–F trên OSM lệch về một phía (chỉ F nhô ra), trong khi ảnh cho thấy hai đầu đối xứng; ưu tiên ảnh. Chưa rõ tòa "K" là tòa nào. Hình mặt bằng các cánh (chữ U, chữ E hay có sân trong) chưa thấy rõ.
- **Nhà thể thao.** Chỉ có ảnh bên trong, chưa biết hình khối bên ngoài.
- **Nguồn không dùng cho chi tiết.** Ảnh phối cảnh năm 2018 (báo SGGP) khác công trình đã xây; chỉ dùng để tham khảo khúc cong của hồ. Chưa xem tour ảo 360° (https://vinuni.edu.vn/vi/visit-2/).

## 4. Đề xuất cho game (chưa phải quyết định)

- **Rút gọn hình khối:** một thanh trắng mái phẳng cho mỗi cánh, các dải tối cho khoang cửa, các hộp cao hơn cho chòi tháp; tháp là 4 hộp thu nhỏ dần + đèn lồng tám cạnh + nón kim + quả cầu hoặc sao vàng. Hai cung cột cong dùng cột trụ mảnh instanced dưới một dầm cong. Đài phun là bể tròn + bệ. Thông tháp là các nón cao instanced. Sân lát bằng các dải vòng. Hồ là một mesh phẳng cong ở một mép. Tất cả đều dựng được bằng primitive, mesh tĩnh merge và instance.
- **Archetype chung trong core** (theme chọn qua manifest): `tiered-spire-hall` (tháp), `arched-colonnade` (hàng cột và cổng), `dormitory-block`.
- **Đặt zone:** Thư viện ngay sau tháp, giống tòa A. Chợ thay chỗ canteen (tòa E) hoặc nhà thể thao. Tháp canh dùng lại tháp hoặc khán đài sân vận động.
- **Nhận diện thương hiệu:** chữ "VINUNIVERSITY" trên cổng và biểu tượng mặt trời vàng là dấu hiệu thương hiệu. Nếu dùng thì chỉ đặt trong theme pack (`public/themes/vinuni/`), không đặt trong `frontend/app`.
- **Bản quyền OSM:** dùng tỷ lệ gần đúng là đủ. Nếu mã hoá toạ độ hoặc footprint OSM vào repo thì phải ghi "© OpenStreetMap contributors (ODbL)".

## 5. Nguồn

- https://vinuni.edu.vn/campus-en/ : trang campus chính thức (thông số thư viện, giảng đường, hội trường, sân vận động, nhà thể thao, ký túc xá; ảnh chụp từ trên cao có hồ, sân điền kinh và thư viện).
- https://vinuni.edu.vn/wp-content/uploads/2020/07/VinUnis-Facility.pdf : booklet cơ sở vật chất (ký hiệu các tòa, diện tích quảng trường, đài phun Apollo và 12 tượng, tháp 108 m, thư viện ở tòa A, phong cách tân cổ điển).
- https://unicons.vn/en/project/vinuni-vin-university/ : trang dự án của nhà thầu (thi công 9/2018–12/2019, khoảng 23 ha). Ảnh từ trên cao chụp dọc trục là tham chiếu tổng thể tốt nhất.
- https://vinuni.edu.vn/?p=6705 : bài khai trương campus (15/01/2020): cổng chính, mô hình campus, sân trong, mặt đứng tháp.
- https://vinuni.edu.vn/wp-content/uploads/2024/03/Banner-1-2.jpg : ảnh toàn cảnh quảng trường đài phun, hàng cột, trục và tháp.
- https://vinuni.edu.vn/wp-content/uploads/2024/02/LF_07127-scaled.jpg : ảnh chụp thẳng tháp từ bãi cỏ; nguồn chính cho tỷ lệ ở §2.2.
- https://vinuni.edu.vn/wp-content/themes/vinuni2023/assets/images/footer_bg.png và https://vinuni.edu.vn/wp-content/uploads/2023/12/bg-video-2-e1711078971335.png : bóng skyline (cổng vòm, tháp).
- https://vinuni.edu.vn/wp-content/uploads/2024/02/HNE-4824-scaled.jpg : bên trong nhà thể thao.
- https://www.sggp.org.vn/xem-phoi-canh-dai-hoc-vinuni-rong-23ha-10-tang-voi-thap-cao-108m-post499524.html : phối cảnh năm 2018 (10 tầng, tháp 108 m); khác công trình thực tế.
- https://www.vingroup.net/en/news/detail/1952/vinuni-groundbreaking-ceremony-not-for-profit-university-with-international-standard : khởi công; mặt tiền tân cổ điển, thiết kế bởi AECOM và HBA (qua đoạn trích tìm kiếm).
- https://en.wikipedia.org/wiki/VinUniversity : campus 230.000 m² trong Vinhomes Ocean Park.
- https://nominatim.openstreetmap.org/search?q=VinUniversity&format=json và Overpass API (`overpass.private.coffee`) : polygon campus (way 777888670), các tòa, hồ, sân. © OpenStreetMap contributors, ODbL 1.0.
