> Trạng thái: tài liệu nghiên cứu cho lát cắt dọc Thư viện (v0.1), agent research, 2026-10-07. Bổ sung, không lặp lại [learning-game-insights.md](learning-game-insights.md) (viết tắt LGI).

# Tham khảo cho lát cắt Thư viện

**Đo cục bộ** là số agent tự đo trong repo, không lấy từ web. "(quan sát)" là nhận xét của agent, không có nguồn.

## 1. Năm phút đầu của hub

**1.1 Mốc nhìn thấy được thay cho mũi tên.** Adam Robinson-Yu đặt các mốc gây tò mò để kéo người chơi rời đường chính và coi việc đi lạc là một phần lối chơi. Nói chuyện với NPC quá lâu thì hỏng nhịp. Nguồn: https://gamedeveloper.com/business/road-to-the-igf-adam-robinson-yu-s-i-a-short-hike-i-
**Áp dụng cho v0.1:** landmark là khối cao nhất, thấy ngay từ `SPAWN`. Cửa Thư viện có điểm nhấn `accent` duy nhất. Hội thoại cô Lan giữ đúng 2 câu của brief §4.

**1.2 Trò nghịch thay cho tutorial.** House House viết từ sớm một danh sách dài các trò nghịch và quay lại nó mỗi khi cần thêm nội dung. Họ muốn xung đột luôn dễ đọc bằng mắt. Nguồn: https://www.gamedeveloper.com/game-platforms/road-to-the-igf-house-house-s-i-untitled-goose-game-i-
**Áp dụng cho v0.1:** không có màn dạy phím; prompt ngữ cảnh của brief §4 dạy điều khiển. Nếu leader duyệt, HUD có đúng một dòng việc ("Gặp cô Lan ở cửa Thư viện").

**1.3 Lựa chọn đầu tiên có xem trước, không có đáp án sai.** Đầu Animal Crossing: New Horizons, người chơi chọn một trong bốn bản đồ đảo, rồi đặt lều với ba nút: xem thử, chốt, chọn lại. Tom Nook giao ngay vài việc nhỏ. Nguồn: https://www.shacknews.com/article/117064/animal-crossing-new-horizons-walkthrough
**Áp dụng cho v0.1:** lựa chọn đầu tiên là "Vào Thư viện" hay "Để sau". Từ `SPAWN` (0, 3) tới mép vùng tương tác của `NPC_SPOT` (−5,4; 3,4; bán kính 1,7) chỉ khoảng 3,7 đơn vị, tức 0,9 s ở `WALK_SPEED` 4,2. Không intro. "Để sau" không bị phạt.

**1.4 Thiết kế cho người không chơi game, đo việc chơi hết.** Ustwo luôn hình dung game trong mắt người không chơi game, buộc mỗi màn trông như một bản thiết kế đồ hoạ, và chỉ thêm màn khi có điều mới để nói. Beta có hơn 1.000 người thử, trung bình chơi hết trong 90 phút; game được làm để đa số người chơi hoàn thành. Nguồn: https://gamedeveloper.com/design/designing-the-surprise-mobile-game-hit-i-monument-valley-i-, https://en.wikipedia.org/wiki/Monument_Valley_(video_game)
**Áp dụng cho v0.1:** poster chờ chunk 3D phải đẹp như một khung hình. Pilot đo thời gian từ lúc vào `/play` tới lúc mở hội thoại; mục tiêu đề xuất ≤60 s (chưa phải số đo).

**1.5 Đồ chơi chỉ có vài động từ.** Stålberg gọi Townscaper là đồ chơi hơn là game: chỉ đặt khối, gỡ khối và chọn màu. Game bán 380.000 bản trên Steam, trong khi ông từng nghĩ chỉ được khoảng 4.000. Nguồn: https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making, https://mcvuk.com/business-news/when-we-made-townscaper
**Áp dụng cho v0.1:** hub chỉ có ba động từ: đi, nói, vào.

**1.6 Trải nghiệm trước, cam kết sau (ví dụ web/giáo dục).** Duolingo dời màn đăng ký ra sau vài bước, cho học một bài trước, và DAU tăng khoảng 20%. Khoảng ba năm sau, tối ưu "tường mềm" và "tường cứng" mang thêm 8,2% DAU. Nguồn: https://review.firstround.com/the-tenets-of-a-b-testing-from-duolingos-master-growth-hacker/
**Áp dụng cho v0.1:** `/play` không hỏi gì trước khi cho đi; ThemeToggle nằm góc, không chặn. **Áp dụng sau:** chỉ mời đăng ký sau L1.

## 2. Cô Lan và ẩn dụ RAG trung thực

**2.1 Phép thử bóng đen.** Chín lớp nhân vật TF2 được thiết kế để chỉ nhìn bóng đen vẫn nhận ra, và Valve dùng phép thử này từ giai đoạn concept. Màu trầm chiếm phần lớn, chỉ vài mảng nhỏ bão hoà. Nguồn: https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf
**Áp dụng cho v0.1:** cô Lan khác người chơi ở hình khối, không chỉ ở màu (ví dụ chồng sách ôm trước ngực; art chốt). Kiểm bằng ảnh một màu ở 375 px. `npc` là mảng bão hoà duy nhất gần cửa Thư viện.

**2.2 Báo hiệu "tương tác được".** Game Accessibility Guidelines: báo rõ phần tử nào tương tác được (trung cấp); phần tử tương tác to và cách xa nhau, nhất là trên màn cảm ứng (cơ bản). Nguồn: https://gameaccessibilityguidelines.com/full-list/
**Áp dụng cho v0.1:** trên đầu cô Lan có một dấu hiệu nhỏ, đứng yên khi reduced motion. Vào `INTERACT_RADIUS` thì hiện prompt DOM đúng chữ brief §4. Vùng chạm NPC trên canvas rộng ≥44 px CSS, luôn có nút DOM tương đương.

**2.3 Hạng #1 là gần nhất.** LGI §2.3 đã chốt "hạng thay cho cosine". Bổ sung: Contexto đảo thang của Semantle để từ đích là số 1, khỏi phải làm phép trừ. Semantle (word2vec) chỉ báo độ gần khi từ đoán đã lọt vào 1.000 từ gần nhất. Nguồn: https://www.hey.gg/blog/contexto, https://semantle.com/faq
**Áp dụng cho v0.1:** kịch bản và content viết hạng theo quy ước "#1 = gần nhất"; chunk ngoài danh sách ghi "ngoài top-k". **Áp dụng sau:** cosine chỉ hiện trong Kính Số Liệu.

**2.4 Hình chiếu luôn đi kèm danh sách chữ.** Embedding Projector chiếu bằng PCA, t-SNE (chạy phía client) hoặc phép chiếu tuyến tính tự định nghĩa. Click một điểm thì khung bên phải liệt kê láng giềng gần nhất bằng chữ kèm khoảng cách, đồng thời tô sáng chúng trên hình chiếu. Nguồn: https://arxiv.org/abs/1611.05469
**Áp dụng sau (Vòm Sao):** bảng top-k bằng chữ là nguồn sự thật, bầu sao chỉ minh hoạ. **v0.1:** art-direction và kịch bản ghi rõ "vị trí sao là hình chiếu".

**2.5 Hình chiếu 2D có thể nói dối.** Distill chỉ ra rằng trên t-SNE, kích thước cụm và khoảng cách giữa các cụm có thể không mang nghĩa, nhiễu ngẫu nhiên có thể trông như cụm, và đổi perplexity thì hình đổi hẳn. Pinecone: vector database trả kết quả gần đúng, đổi độ chính xác lấy tốc độ. Nguồn: https://distill.pub/2016/misread-tsne/, https://www.pinecone.io/learn/vector-database/
**Áp dụng sau:** Vòm Sao có nhãn cố định "Hình chiếu 2D: khoảng cách trên màn hình chỉ gần đúng. Hạng và cosine là số thật."

**2.6 Tìm kiếm chính là cơ chế.** Her Story dùng một cỗ máy tìm kiếm cố ý cũ kỹ trên bản chép lời các đoạn phỏng vấn: kết quả xếp theo thời gian, chỉ xem được năm kết quả đầu. Người chơi phải đổi cách hỏi. Nguồn: https://www.bfi.org.uk/features/her-story-10-years
**Áp dụng sau (L3):** `top_k` (1–20, Phần 3) thể hiện như "chỉ xem được k kết quả đầu". "Điều 47 khoản 2 quy định gì?" là bài học khớp từ khoá (BM25); `lib-l3-t01` là bài học diễn đạt lại.

**2.7 Xác nhận theo lô, mỗi lần một luật mới.** Return of the Obra Dinn chỉ xác nhận số phận theo bộ ba, để người chơi không thể thử từng tổ hợp. Lucas Pope tránh ra luật mới trên bảng tin vào ngày có nhân vật nói chuyện với người chơi buổi sáng. Nguồn: https://en.wikipedia.org/wiki/Return_of_the_Obra_Dinn, https://filmstories.co.uk/?p=83249, https://www.gamedeveloper.com/design/designing-the-bleak-genius-of-i-papers-please-i-
**Áp dụng cho v0.1 (kịch bản):** phiếu đoán chấm theo nhóm case sau khi run kết thúc (D4). Mỗi level mở một núm mới, không mở cùng lúc với một đoạn thoại dài.

## 3. Tham khảo mỹ thuật isometric low-poly

| Tham khảo | Bảng màu | Ánh sáng, chiều sâu (không shadow map) | Nên lấy | Nên tránh |
|---|---|---|---|---|
| Monument Valley ([wiki](https://en.wikipedia.org/wiki/Monument_Valley_(video_game)), [three.js](https://threejs.org/manual/pages/shadows.html)) | Màu dẫn lối | Mỗi mặt một tông (quan sát); có vẻ dùng bóng giả dưới nhân vật chính | Mỗi khung là một poster | Hình học bất khả |
| Townscaper ([MCV](https://mcvuk.com/business-news/when-we-made-townscaper)) | Cầu vồng, thêm hai xám và trắng | Tường trắng tối dần ở chân và góc (quan sát) | Tường trắng, mái màu tạo nhịp | Chi tiết thủ tục dày |
| Islanders ([GWO](https://gameworldobserver.com/2019/06/14/islanders)) | Ít màu | Khối rõ; 3 người, 4 tháng | Luôn hỏi "đơn giản hơn được không?" | Thêm chi tiết khi khối đã đủ đọc |
| A Short Hike ([PS Blog](https://blog.playstation.com/2021/08/05/crafting-a-tiny-open-world-a-look-behind-the-scenes-at-the-creation-of-a-short-hike/)) | Ấm, nhất quán | Shading phẳng nhất quán, không khử răng cưa, viền mềm giúp dễ đọc | Shading phẳng | Pixel hoá, viền: cần pass hậu kỳ |
| Bruno Simon ([Mux](https://www.mux.com/blog/3d-web-development-and-beyond-a-chat-with-bruno-simon)) | Theo matcap | Không có đèn, chỉ matcap | Ánh sáng giả giá rẻ | Matcap cần texture |
| TF2 ([bài báo](https://www.cs.princeton.edu/courses/archive/fall07/cos597B/papers/mitchell-team-fortress.pdf)) | Trầm chủ đạo, mảng bão hoà nhỏ | Bóng ngả lạnh, không về đen; rim light | Bóng ấm sang lạnh; ít lặp | Nét đen dày |
| Mô hình khối kiến trúc ([Whiteclouds](https://www.whiteclouds.com/blog/architectural-massing-models/), [QZY](https://www.qzymodels.com/how-to-photograph-miniature-models-professionally/)) | Một màu; chi tiết vừa đủ cho quyết định | Đèn chính 30–45°, đèn phụ đối diện yếu hơn, đèn sau tách khỏi nền | Khối, chiều cao, hướng là chính | Chi tiết mặt tiền khi chưa cần |

**Mặt tiền tân cổ điển trắng dưới ánh sáng phẳng** (đề xuất, art chốt bằng số):
- **Nền tối hơn toà.** Manifest theme campus có tường landmark `#f7f6f2` trên quảng trường `#f2efe8`, gần như cùng độ sáng. Mặt ngang hứng nhiều sáng hơn tường đứng, toà dễ tan vào nền. Hạ quảng trường và đường đi một bậc, hoặc để toà nổi trên cỏ.
- **Ba mặt, ba tông.** Chốt tỉ lệ độ sáng cố định cho mặt trên, mặt sáng, mặt tối; mặt tối ngả lạnh chứ không xám (TF2). `HemisphereLight` (trời lạnh, đất ấm) cộng một `DirectionalLight` chéo 30–45°.
- **Không cháy sáng.** Cường độ chiếu lên mặt sáng nhất không đẩy màu vượt 1,0; Canvas bật `flat` (4.2).
- **Phào chỉ thay texture.** `trim` cho gờ mái, chân tường, hàng cột; nhịp cột colonnade cho chiều sâu mà không cần bóng.
- **AO đỉnh.** Làm tối 15–25% đỉnh ở chân tường, dưới mái hiên, trong lòng colonnade (4.5); số đề xuất, chưa đo.

## 4. Hiệu năng web 3D (three r0.186, R3F 9, drei 10)

**4.1 Draw call trước, tam giác sau.** Manual three.js: khoảng 19.000 hộp, mỗi hộp một mesh, chạy dưới 20 fps. Gộp bằng `mergeGeometries`, phân màu bằng vertex colour: 60 fps, đổi lại không di chuyển riêng từng hộp được. R3F khuyên tối đa 1.000 draw call, lý tưởng vài trăm. Nguồn: https://threejs.org/manual/pages/optimize-lots-of-objects.html, https://r3f.docs.pmnd.rs/advanced/scaling-performance
**Áp dụng cho v0.1:** mỗi nhóm vật liệu tĩnh là một mesh gộp (địa hình, toà nhà, cây, cột, đường); player, NPC, marker đứng riêng. Cây tĩnh: gộp, không cần instancing.

**4.2 Vật liệu và tone mapping.** Tài liệu three.js: `MeshLambertMaterial` tính sáng theo fragment, nhanh hơn Phong, Standard, Physical; `MeshStandardMaterial` đắt hơn và nên có environment map; `MeshToonMaterial` cần `gradientMap` lọc Nearest. R3F mặc định ACESFilmic; prop `flat` chuyển sang NoToneMapping. Nguồn: https://threejs.org/docs/#api/en/materials/MeshLambertMaterial (khớp JSDoc của bản 0.186.1), https://r3f.docs.pmnd.rs/api/canvas
**Áp dụng cho v0.1:** `MeshLambertMaterial({ vertexColors: true })` + Hemisphere + 1 Directional; Canvas `flat` để hex manifest không bị ACES nén vùng sáng (quan sát: trắng sẽ xỉn).

**4.3 Vòng lặp khung hình.** `invalidate()` không vẽ ngay mà chỉ xin một khung; nên xin trước khi bắt đầu hoạt cảnh để tránh giật. Không `setState` trong `useFrame`: đổi trực tiếp qua ref, dùng `delta`. Zustand có "transient updates": subscribe vào ref, không re-render. Nguồn: https://r3f.docs.pmnd.rs/advanced/scaling-performance, https://r3f.docs.pmnd.rs/advanced/pitfalls, https://github.com/pmndrs/zustand
**Áp dụng cho v0.1:** vị trí player nằm trong ref; `useFrame` gọi `invalidate()` khi còn di chuyển. Store chỉ giữ `nearbyTarget`, `dialogueOpen`, `met`, và chỉ `set` khi giá trị đổi. Test hook đếm frame chứng minh đứng yên thì không có frame.

**4.4 DPR và theo dõi hiệu năng có bẫy.** R3F mặc định `dpr [1, 2]`; DPR 2 vẽ gấp 4 lần số pixel của DPR 1. `PerformanceMonitor` mặc định `ms` 250, `iterations` 10, `threshold` 0,75; ngưỡng fps mặc định lệch giữa tài liệu ([50, 60]) và mã drei 10.7.9 ([40, 60]). Mã tính fps từ mốc thời gian của các khung *đã vẽ*, nên với `demand`, khoảng đứng yên bị tính thành fps thấp và gây `onDecline` giả. `AdaptiveDpr` chỉ hạ DPR khi có `regress()`. Nguồn: https://drei.docs.pmnd.rs/performances/performance-monitor, https://drei.docs.pmnd.rs/performances/adaptive-dpr
**Áp dụng cho v0.1:** `dpr={[1, mobile ? 1.5 : 2]}`; `bounds` tường minh; chỉ mount `PerformanceMonitor` khi đang di chuyển; `onDecline` hạ DPR từng bậc, `flipflops` nhỏ. Bỏ `AdaptiveDpr` nếu không gọi `regress()`.

**4.5 Bóng giả và AO đỉnh.** Shadow map vẽ lại các vật đổ bóng từ góc nhìn của từng đèn; đèn point phải vẽ cảnh 6 lần. Bóng giả chỉ là một mặt phẳng `MeshBasicMaterial` trong suốt, `depthWrite: false`, nhích trên mặt đất. 0fps tính AO cho từng đỉnh với 4 mức (từ hai cạnh kề và góc), nội suy trên mặt, lật quad để tránh lệch hướng. Nguồn: https://threejs.org/manual/pages/shadows.html, https://0fps.net/2013/07/03/ambient-occlusion-for-minecraft-like-worlds/
**Áp dụng cho v0.1:** bóng dưới cây, NPC, player là đĩa có alpha theo đỉnh, gộp 1 draw call, không texture. AO nướng vào vertex colour lúc build geometry, runtime không tốn gì.

**4.6 Bundle và tách chunk.** React Router framework mode tự tách chunk theo route, và mặc định tách `clientLoader`, `HydrateFallback` ra chunk riêng. Nguồn: https://reactrouter.com/explanation/code-splitting
**Đo cục bộ** (rolldown 1.2.12, minify, gzip -9, gói trong `frontend/node_modules`):

| Nhập | gzip |
|---|---|
| `three`, cả namespace | 181 KB |
| `three`, import theo tên | 126 KB |
| react + react-dom | 66 KB |
| react + r3f (`Canvas`, `useFrame`) | 300 KB, tức r3f + three ≈ 234 KB |
| thêm drei `PerformanceMonitor`, `AdaptiveDpr` | +0 KB |
| thêm drei `Text` | +41 KB |

R3F import cả namespace three, nên tree-shake three vô ích. **Áp dụng cho v0.1:** `/play` còn khoảng 60 KB cho code cảnh và drei. Cấm `Text`. Canvas `React.lazy` trong `play.tsx` để HUD hiện trước three.

**4.7 Chỉ raycast một mặt phẳng.** R3F chỉ raycast khi người dùng tương tác với canvas, và mã fiber 9.8.1 chỉ đưa vào danh sách tương tác những object có handler. `Ray.intersectPlane` là phép tính giải tích. Nguồn: https://r3f.docs.pmnd.rs/api/events
**Áp dụng cho v0.1:** không gắn handler vào mesh gộp. Trên `pointerdown`, chiếu tia xuống mặt y = 0 lấy điểm đích; click NPC = điểm chạm nằm trong bán kính quanh `NPC_SPOT`. Không `onPointerMove`.

**4.8 Chữ: DOM overlay, không troika.** `Text` của drei dựa trên troika: font mặc định Roboto tải từ Google Fonts, font dự phòng Unicode tải từ jsDelivr, và CSP chặt chặn cách nó tạo worker (phải đặt `useWorker: false`). Nguồn: https://github.com/protectwise/troika/tree/main/packages/troika-three-text
**Áp dụng cho v0.1:** CSP dự án có `font-src 'self'` và `script-src 'self'` + hash, nên troika sẽ hỏng hoặc chạy trên main thread, lại thêm 41 KB. Mọi chữ tiếng Việt là DOM, dùng font tự host có subset tiếng Việt; toạ độ nhãn chỉ tính lại khi camera đổi.

## 5. Hub 3D tiếp cận được (WCAG 2.2)

**5.1 Canvas câm, DOM nói.** MDN: canvas cần nội dung thay thế; canvas thuần trình diễn dùng `role="presentation"`. Game Accessibility Guidelines: mọi phần UI dùng được bằng cùng cách nhập liệu với lối chơi (cơ bản); hỗ trợ trình đọc màn hình (nâng cao). Nguồn: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage, https://gameaccessibilityguidelines.com/full-list/
**Áp dụng cho v0.1:** canvas `aria-hidden`. Danh sách "Đi nhanh": Cô Lan (nói chuyện), Thư viện (vào), Tháp canh và Chợ model ("Sắp mở" bằng chữ, không chỉ bằng màu xám); mỗi mục làm đúng hành động như trên canvas. Prompt §4 đi qua live region `polite`, mỗi lần vào vùng đọc một lần.

**5.2 Hội thoại theo APG Dialog (Modal).** Mở thì focus vào trong hộp; Tab và Shift+Tab xoay vòng bên trong; Esc đóng; đóng thì focus về phần tử đã mở hộp. Có `aria-modal="true"`, `aria-labelledby`; `aria-describedby` tuỳ chọn. Nguồn: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
**Áp dụng cho v0.1:** `aria-describedby` trỏ tới 2 câu thoại; focus đầu vào "Vào Thư viện". Mở từ canvas thì focus trả về mục "Cô Lan" trong Đi nhanh.

**5.3 Giảm chuyển động.** WCAG 2.3.3 (AAA): chuyển động do tương tác kích hoạt phải tắt được, trừ khi thiết yếu. MDN: phóng to thu nhỏ hoặc lia vật lớn có thể kích hoạt rối loạn tiền đình. Nguồn: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html, https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
**Áp dụng cho v0.1:** khi `reduce`, camera nhảy thẳng (không easing, không lia), marker và NPC đứng yên; người chơi vẫn đi được vì đó là chức năng. Nghe sự kiện `change` của `matchMedia` để đổi ngay.

**5.4 Tương phản trên nền 3D.** Chữ cần 4,5:1; chữ lớn (từ 18 pt, hoặc 14 pt đậm) cần 3:1. Thành phần UI và vòng focus cần 3:1 so với màu kề bên; nền nhiều màu thì đo ở chỗ tương phản thấp nhất. Nguồn: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
**Áp dụng cho v0.1:** chữ HUD luôn trên panel `surface` đặc, không đặt thẳng lên canvas. Vòng focus đạt 3:1 trên cả `surface` lẫn màu sáng nhất của cảnh. axe không đọc pixel canvas: kiểm tay.

**5.5 Vùng chạm và focus không bị che.** WCAG 2.5.8 (AA): tối thiểu 24×24 px CSS, có ngoại lệ khoảng cách; nên nhắm 2.5.5 (AAA, 44×44) cho nút quan trọng. WCAG 2.4.11 (AA): phần tử đang focus không bị nội dung của tác giả che hoàn toàn; kỹ thuật C43 dùng `scroll-padding`. Nguồn: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html, https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
**Áp dụng cho v0.1:** nút HUD ≥44 px. Ở 375 px, panel cố định không che mục đang focus (`scroll-padding`).

## Top 10 việc nên làm cho v0.1

1. **[coder]** Chữ chỉ ở DOM, không drei `Text` (4.8).
2. **[coder]** `frameloop="demand"` + test hook đếm frame; DPR trần 2/1,5; `PerformanceMonitor` chỉ chạy khi di chuyển, `bounds` tường minh (4.3, 4.4).
3. **[art]** Lambert + vertex colour + Hemisphere + 1 Directional, Canvas `flat`; nền tối hơn mặt tiền trắng; mặt tối ngả lạnh (mục 3, 4.2).
4. **[coder]** Một mesh gộp cho mỗi nhóm vật liệu tĩnh, AO nướng vào đỉnh, bóng đĩa 1 draw call; test ngân sách (4.1, 4.5).
5. **[coder]** Canvas `aria-hidden`, danh sách Đi nhanh, hộp thoại theo APG, nút ≥44 px, chữ HUD trên panel đặc (mục 5).
6. **[art]** Cô Lan qua phép thử bóng đen ở 375 px; `npc` là mảng bão hoà duy nhất gần cửa Thư viện; landmark thấy từ `SPAWN` (2.1, 1.1).
7. **[coder]** Canvas lazy; kiểm tra build "trang chủ không có three"; giữ ≈60 KB dư của `/play` (4.6).
8. **[coder]** Raycast giải tích xuống y = 0; không handler trên mesh, không `onPointerMove` (4.7).
9. **[scenario]** "#1 = gần nhất", nhãn "hình chiếu", phiếu đoán chấm theo nhóm sau run (D4), mỗi level một núm mới (2.3–2.7).
10. **[scenario]** Không intro; lựa chọn đầu tiên trong 10–20 s; pilot đo thời gian tới hội thoại (1.3, 1.4).

Kiểm chứng: {'confirmed': 39, 'corrected': 6}
