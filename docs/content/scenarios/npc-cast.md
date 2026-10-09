> **Trạng thái:** v0.1. Mọi nhân vật đều hư cấu, không dựa trên người thật, kể cả giảng viên của chương trình. Không tên trường thật nào xuất hiện; trường trong truyện là **Trường Đại học Sao Mai** (D6), nơi chốn gọi chung là "khuôn viên".
> **Liên quan:** [Thư viện](library.md) · [Sáu level còn lại](other-levels-outline.md) · [Phòng chấm](grading-room.md) · [Giờ cao điểm](rush-hour.md)

# Dàn nhân vật

## Luật chung cho mọi lời thoại

- **Ngắn:** mỗi lượt thoại tối đa 2 câu. Không giảng quá 2 câu liền.
- **Từ cấm:** ba từ gợi không khí lớp học mà research §1.1 cấm trong UI không được xuất hiện trong lời của người chơi hay NPC. Không nói "bạn đã thua"; thất bại là bằng chứng.
- **Thuật ngữ thật xuất hiện dần.** Ở L1, NPC dùng tên đồ chơi và UI ghi tên thật nhỏ bên cạnh. Từ L2, NPC nói cả hai ("Móc kéo, tức top_k"). Ở L3, NPC chủ yếu dùng tên thật.
- **Đùa không bao giờ nhắm vào người chơi.** Mục tiêu của câu đùa là Bống, trợ lý, hoặc chính người nói.
- **Không bịa về AI.** Mọi câu NPC nói về hành vi của model phải khớp slide hoặc Phần 3. Dặn dò kiểu "model to hơn sẽ hết bịa" chỉ được xuất hiện như một hiểu lầm để sửa.
- **Prompt NPC (nếu sau này dùng LLM):** ngắn, tách hẳn khỏi agent được chấm (research §1.1). v0.1 dùng lời thoại viết sẵn.

## Thư viện

### Cô Lan: thủ thư ca tối (NPC chính)

- **Vai:** người giao việc, người chẩn đoán, người hỏi vặn ở Phòng ý tưởng. Quầy tra cứu là của cô, trợ lý là "đứa học trò cơ khí" của cô.
- **Giọng:** ấm, khô hài, chính xác. Xưng "mình", gọi "bạn". Thích con số cụ thể hơn tính từ. Không bao giờ nói "sai rồi"; cô chỉ vào bằng chứng.
- **Tật:** hay so mọi thứ với chuyện thư viện (bảng tin, giấy vàng, lịch thi). Có một hộp bánh không bao giờ chia cho Bống.
- **Câu mẫu theo tình huống:**

| Tình huống | Câu mẫu |
|---|---|
| Mở cảnh | "Sáng nay bảng tin có thêm mười hai tờ y hệt nhau. Cái Điều 47 này nổi tiếng nhanh hơn cả lịch thi." |
| Trước khi chạy | "Đoán trước rồi hẵng mở ca. Đoán sai cũng được, miễn là có đoán." |
| Sau thất bại | "Không phải nó dốt đâu, nó chưa được mở sách." |
| Chỉ bằng chứng | "Đoạn đúng của câu #{n} đứng hạng {rank}, mà Móc kéo chỉ kéo {k}." |
| Thành công | "Biết nói 'không có' đúng lúc, đó là kỹ năng mình quý nhất ở một thủ thư." |
| Vặn ý tưởng | "Bạn sẽ biết nó tốt lên bằng con số nào? 'Thấy ổn' thì không tính nhé." |

- **Không nói:** khen chung chung ("tuyệt vời!"), lời giảng dài, hay câu đổ lỗi cho người hỏi.
- **Gợi ý cho art** (art quyết định cuối): áo len màu trung tính, kính đeo dây, luôn cầm bút chì; đèn bàn là "dụng cụ chẩn đoán" của cô.

### Bống: học việc ca tối

- **Vai:** sinh viên làm thêm, phụ cô Lan. Người gây ra sự cố nhỏ (chỉnh Lược về 128, tháo tem "cho đỡ rối") và là người người chơi dạy lại.
- **Giọng:** nhiệt tình, lễ phép (xưng "em", gọi "anh chị", hay thêm "ạ"), mê mẹo tắt, hỏi thẳng. Sai nhưng không ngốc: mỗi mẹo của Bống đều có một lý do nghe hợp lý, vì đó chính là hiểu lầm cần sửa.
- **Câu mẫu:** "Em tưởng cắt nhỏ thì tìm cho chuẩn ạ." · "Sao Vòm Sao giỏi thế mà lại thua cái tủ ngăn kéo ạ?" · "Em hiểu rồi! Ca sáng mà hỏi là em kể lại y như anh chị."
- **Phát triển:** ở L1 Bống hỏi "vì sao", ở L2 hỏi "nên chỉnh thế nào", ở L3 hỏi "bỏ hẳn được không", tức là hỏi về giới hạn. Câu hỏi của Bống lớn dần theo người chơi.

### Chú Bảy: lao công

- **Vai:** "cờ thế giới" biết đi. Chú dán, gỡ, quét theo hậu quả của các lần chạy. Gần như không nói.
- **Câu duy nhất** (khi số áp phích vượt 20): "Lại dán nữa à…"
- Cô Lan hay nói thay chú: "Chú Bảy dặn lần sau in ít thôi."

### Sinh viên hỏi (mỗi người một câu, không lặp vai)

| Tên | Level | Vai | Câu |
|---|---|---|---|
| Minh, năm hai | L1 | người hỏi câu `lib-l1-v01`, chụp áp phích | (không thoại; câu hỏi của Minh là câu của ca v01) |
| Hà, năm ba | L2 | bị trả đơn "QUÁ HẠN", từng nằm viện | (không thoại; cô Lan kể chuyện của Hà) |
| Khang, năm nhất | L3 | đứng đầu hàng người ở quầy | "Em hỏi Điều 47 mà nó đọc cho em Điều 74!" |

### Trợ lý tra cứu

- **Không phải một nhân vật.** Đây là thứ người chơi lắp: một cỗ máy đồng nhỏ đặt ở quầy, không có tên riêng, không có tính cách.
- Nó chỉ "nói" đúng đầu ra thật của lần chạy, không có lời thoại viết sẵn. Như vậy mọi chữ nó nói đều lần ngược được về một event thật.

## Chợ model

### Chị Hạnh: chủ quầy chợ phiên cuối tuần

- **Giọng:** nói nhanh, tính nhẩm giỏi, ghét lãng phí; đơn vị yêu thích là "token" và "đồng".
- **Câu mẫu:** "Thùng có ba nghìn chỗ thôi em, đừng nhét cả cuốn danh bạ vào." · "Đơn này tính được bằng bàn tính thì đừng gọi thầy bói."

## Tháp canh

### Anh Quân: bảo vệ ca đêm

- **Giọng:** ít lời, kỹ tính, ghét báo động giả ngang với ghét kẻ gian.
- **Câu mẫu:** "Chặn hết thì dễ. Chặn đúng mới khó." · "Một lưới thì thủng một chỗ. Ba lưới thì phải thủng ba chỗ cùng lúc."

### Chị Vy: trưởng nhóm tấn công thử (W3)

- **Giọng:** vui tính, kỷ luật, coi tấn công thử là việc có trách nhiệm (Ngày 11).
- **Câu mẫu:** "Ghi lại mọi phát, kể cả phát trượt." · "Phá được là xong một nửa. Nửa còn lại là chỉ ra lớp nào thủng."

## Phòng chấm (khu 4, thêm 2026-10-08)

### Chị Nhi: cán bộ khảo thí

- **Vai:** chủ Phòng chấm ([grading-room.md](grading-room.md)); người giữ nhãn người và nghi ngờ mọi con số chưa được kiểm.
- **Giọng:** tỉ mỉ, bình tĩnh, mê bảng đếm. Xưng "chị", gọi "em". Không bao giờ nói một con số mà không kèm "trên bao nhiêu câu".
- **Câu mẫu:** "Bảng nói 4,1 điểm. Hòm thư góp ý nói khác, và mình chưa biết tin bên nào." · "Giám khảo cũng phải thi, em ạ. Chị chưa thấy ai được miễn." · "Hai mươi trace thật nói nhiều hơn một điểm trung bình."
- **Không nói:** khen chung chung; "con số này chắc đúng".

## Trạm vận hành (ứng viên khu 5, thêm 2026-10-08)

### Anh Tùng: trực vận hành

- **Vai:** chủ Trạm vận hành ([rush-hour.md](rush-hour.md)); người đọc bảng đèn.
- **Giọng:** bình thản, nói bằng giây và phần trăm, ghét "bấm lại cho chắc". Xưng "anh", gọi "em".
- **Câu mẫu:** "Máy không sập vì đông người. Máy sập vì ai cũng bấm lại cùng một lúc." · "Chậm mà trả lời còn hơn nhanh mà im." · "Trung bình đẹp không cứu được người chờ lâu nhất."
- **Không nói:** đổ lỗi cho người dùng; "cứ thử lại là được".

## Khuôn viên (hub `/play`, thêm 2026-10-09)

Bốn người đứng trong khuôn viên, nói được ngay cả khi khu của họ chưa mở. Code chỉ dùng mã vai; tên hiển thị và màu áo nằm trong `campus.npcs` của manifest theme (cả hai gói dùng cùng bộ tên hư cấu dưới đây). Lời thoại nguyên văn ở `frontend/app/features/campus/npcs.ts`: lần đầu hai lượt chào, các lần sau một lượt theo trạng thái khu.

### Chú bảo vệ (`guard`): bảo vệ cổng chính, ca ngày

- **Vai:** gác cổng ba vòm, 18:00 bàn giao cho anh Quân bên Tháp canh; dẫn vào Tháp canh. Không có tên riêng.
- **Giọng:** ít lời, chậm, ấm. Xưng "chú", gọi "cháu". Không nói "cấm"; nói "ghi sổ", "để người duyệt".
- **Áo:** sơ mi trắng, quần đen, mũ lưỡi trai tối màu.

### Chị Diệp (`registrar`): phụ trách văn phòng một cửa

- **Vai:** nhận mọi giấy tờ vào khuôn viên; structured output và tool (ô không biết thì để trống). Đứng ở chân bậc thềm nhà chính.
- **Giọng:** nhanh, chỉn chu, đếm ô trống trên phiếu. Xưng "chị", gọi "em".
- **Áo:** vest đỏ, quần tối.

### Cô Thục (`operator`): trực trạm vận hành

- **Vai:** trực trạm chiller sau nhà chính; chi phí, độ trễ theo phân vị, báo động, che PII trong log.
- **Giọng:** điềm tĩnh, nói bằng xác suất và phân vị, không thích chữ "trung bình". Xưng "cô", gọi "em".
- **Áo:** áo khoác mỏng xanh xô thơm, quần tối.

### Thầy Khải (`examiner`): trông phòng chấm

- **Vai:** sân trước hội trường mái vòm B; đo lường: đọc lỗi trước khi đếm, giám khảo cũng phải qua kiểm tra.
- **Giọng:** chậm rãi, hài hước khô, nghiêm về cách đo. Xưng "thầy", gọi "em".
- **Áo:** sơ mi xanh xám nhạt, quần xám tối. Không kính.

## Kiểm tra tên

- Tên dùng chung kiểu Việt phổ biến, không trùng tên giảng viên hay nhân vật có thật được nêu trong slide của chương trình.
- Đã đối chiếu với slide hiện có (2026-10-07): sinh viên L3 đổi từ "Tuấn" thành "Khang" vì trùng tên một giảng viên.
- Đối chiếu 2026-10-08: "Nhi" và "Tùng" không xuất hiện trong bản trích slide của 15 ngày.
- Đối chiếu 2026-10-08: "Diệp", "Thục", "Khải" không có trong slide của khoá và không trùng dàn nhân vật ở trên.
- Trước mỗi lần phát hành, QA grep danh sách tên giảng viên trong slide để chắc không trùng.
