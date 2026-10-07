> Trạng thái: tài liệu nghiên cứu, tổng hợp bởi các agent nghiên cứu ngày 2026-10-07; số liệu đã qua một lượt kiểm chứng nguồn (xem mục Nguồn).

# Thiết kế game AI in Action: ai cũng muốn chơi, tò mò, chơi xong hiểu thật

Mọi nguyên tắc dưới đây phục vụ một vòng lặp lõi: **Đoán → Cấu hình → Chạy thật trên test set của NPC → Chẩn đoán có bằng chứng → Sửa**. Điểm khác biệt lớn nhất của ta là agent chạy thật. while True: learn() dùng ẩn dụ khối màu, còn Luden đã chuyển sang ML thật ở Learning Factory. Không đánh đổi điểm này lấy đồ hoạ.

## 1. Ai cũng muốn chơi

**1.1 Khoác vỏ câu chuyện, đừng khoác vỏ khoá học.** Theo postmortem của SpaceChem, chủ đề hoá học khiến game giống bài tập ở trường. Một đồng nghiệp cho rằng nếu đổi sang chủ đề giả kim thì doanh số có thể gấp đôi. Chỉ khoảng 2% người chơi hoàn thành chiến dịch dài hơn 40 giờ.
**Áp dụng:** UI không dùng các từ "lab", "bài tập", "lý thuyết". Mỗi zone là một người gặp chuyện thật: tiểu thương ở Model market, thủ thư ở Library, lính gác ở Watchtower. Mục tiêu luôn đo được, ví dụ "10 câu của chị bán hàng: đúng ít nhất 8, chi phí dưới ngân sách". Đội Suck Up! thấy prompt nhân vật càng đơn giản thì tính cách NPC càng ổn định. Vì vậy prompt NPC phải ngắn, tách khỏi prompt của agent đang được chấm, và chạy bằng model rẻ.

**1.2 Phút đầu không cần chữ.** Ở Mario 1-1, khối gạch được đặt để cây nấm chắc chắn chạm vào người chơi, vì người mới thường né nấm. Phòng 00 của Portal cho người chơi nhìn thấy chính mình qua cổng. Factorio thừa nhận tutorial cũ quá gò bó và mất 30-45 phút mới tới phần tự động hoá.
**Áp dụng:** Model market L1 mở đầu bằng cảnh bot quên đơn hàng hôm qua vì lịch sử bị cắt. Màn hình chỉ có thanh trượt context budget và nút Run. Người chơi gõ một câu và thấy nó vỡ thành token rơi vào thanh ngân sách, kèm chi phí thật. Họ kéo thanh trượt, chạy lại, và bot trả lời đúng. Mục tiêu thiết kế (cần đo): lần chạy thật đầu tiên diễn ra trong 3-5 phút.

**1.3 Đường chính phải dễ đi hết, phần đỉnh cao để tuỳ chọn.** Dữ liệu đo ban đầu của SpaceChem bỏ sót những người kẹt ở tutorial rồi bỏ game. Opus Magnum cố ý không thưởng gì trong game cho việc tối ưu.
**Áp dụng:** 1 sao nghĩa là qua màn và đủ để mở zone kế tiếp. Sao 2-3 là phần tối ưu chi phí và độ trễ, không bắt buộc. Không khoá đoạn kết câu chuyện sau sao 3. Gắn analytics phễu cho từng bước ngay từ Model market L1.

**1.4 Thua mà không đau.** Greg Kasavin muốn Hades lấy đi cảm giác khó chịu khi thất bại: mỗi lần chết mở thêm thoại và cốt truyện. God Mode bắt đầu ở 20% kháng sát thương và cộng thêm 2% sau mỗi lần chết, tối đa 80%. Hỗ trợ tăng dần nhưng mục tiêu không hạ xuống.
**Áp dụng:** Khi agent trượt, game không hiện màn "Thua" mà mở "Phòng hậu kiểm". Ở đó NPC bình luận đúng lỗi dựa trên trace thật, ví dụ "câu 3 bot vẫn trả lời dù retriever không trả về đoạn nào". Thêm "Chế độ Trợ lực": mỗi lần trượt mở thêm một nấc bằng chứng, lần lượt là case nào trượt, các chunk đã retrieve, rồi điểm similarity. Ngưỡng pass không bao giờ bị hạ.

**1.5 Chia sẻ câu hỏi, đừng chia sẻ đáp án.** Wordle nhắm tới khoảng 3 phút mỗi ngày. Lưới emoji của nó không lộ đáp án và cố ý không kèm link. Opus Magnum coi tính năng xuất GIF là một động lực thiết kế chính. Trong khảo sát của Contexto, 90% người dùng biết tới game qua bạn bè hoặc mạng xã hội.
**Áp dụng:** Thêm chế độ "Sự cố hôm nay" chung cho cả cohort AI20K: mỗi ngày một lỗi agent nhỏ và giới hạn số lần chạy thật. Giới hạn này vừa tạo cảm giác khan hiếm vừa giữ chi phí API. Thẻ chia sẻ là một lưới: mỗi hàng là một lần chạy, mỗi ô là một test case, kèm số token. Thẻ không hiện cấu hình. Khi chọn sự cố, ưu tiên khái niệm mà người chơi đã lâu chưa gặp, theo tinh thần lịch ôn dựa trên đường quên (HLR) của Duolingo.

## 2. Kích thích tò mò

**2.1 Công khai cơ chế, giấu lời giải.** Ở Gandalf, mỗi cấp thêm một lớp phòng thủ theo thứ tự: không có gì, system prompt, kiểm tra chuỗi, LLM kiểm duyệt, rồi kết hợp tất cả. Game nói rõ lớp đó là gì, còn cách vượt qua thì người chơi tự tìm. HackAPrompt cho thấy input của người chơi bị chèn vào đâu trong template. TensorFlow Playground vẽ ra từng neuron.
**Áp dụng:** Làm một "Prompt X-ray" dùng chung cho cả 3 zone. Nó hiển thị prompt thật gửi cho Claude, tô màu theo nguồn (system, lịch sử, chunk, người dùng) và ghi số token của từng đoạn. Ở Watchtower, NPC tự khai lớp phòng thủ của mình trước mỗi cấp.

**2.2 Mỗi màn xoay quanh một sự thật phản trực giác, và người chơi phải đoán trước.** Những lúc mô hình hành xử kỳ lạ là những lúc người chơi nhớ và kể lại. Mô hình của Quick, Draw! khó nhận ra giày cao gót vì dữ liệu nghiêng về giày thể thao. Trong Tensor Trust, token hiếm "artisanlib" khiến GPT-3.5 Turbo bỏ qua chỉ dẫn.
**Áp dụng:** Nút Run luôn đi kèm một bước dự đoán bằng 1 click: "đạt mấy/10? câu nào sẽ trượt?". Chỗ chênh giữa dự đoán và kết quả thật sẽ mở ra phần chẩn đoán. Các hiểu lầm được cài sẵn: "model to luôn tốt hơn" (Model market L2), "top-k càng lớn càng chắc" (Library L2), "tài liệu chỉ là dữ liệu" (Watchtower L2).

**2.3 Phản hồi phải là độ dốc, không phải công tắc.** Contexto chỉ hiện thứ hạng chứ không hiện điểm cosine. Tác giả Semantle tiếc vì đã không dùng thang 0-100. Thử thách 10 của HackAPrompt không có ai giải được. Ta suy ra rằng một màn không cho thấy tiến bộ dần dễ trở thành ngõ cụt.
**Áp dụng:** Kết quả hiện theo từng test case (ví dụ 7/10). Mức lộ PII ở Watchtower L2 được chấm điểm 0-100. Library có mini-game "Tìm đoạn sách": người chơi thấy đoạn đúng đang đứng hạng mấy. Ở L3, họ bật BM25 rồi bật rerank và thấy thứ hạng đó nhảy lên. Telemetry cảnh báo màn nào ít lượt thử hoặc có tỷ lệ bỏ cuộc cao.

**2.4 Dùng histogram, không dùng bảng vàng.** Zach Barth bỏ leaderboard truyền thống từ thời SpaceChem, vì không cần vinh danh top 100 người cùng chép một lời giải. Thay vào đó, ông dùng histogram cho nhiều chỉ số, cộng thêm bảng xếp hạng bạn bè.
**Áp dụng:** Cả 9 màn dùng chung 3 trục: Chất lượng (pass trên test ẩn), Chi phí (token/USD), Độ trễ. Histogram tính theo cohort và theo lớp. Câu hỏi "sao người khác rẻ hơn mình?" sẽ tự kéo người chơi quay lại.

**2.5 Cho đổi phe.** Tensor Trust cho mỗi người vừa tấn công vừa phòng thủ, và cho xem lại những đòn đã phá mình, nên các kỹ thuật lan ra thành từng đợt. Bad News cho người chơi tự tay đóng vai kẻ tung tin thao túng.
**Áp dụng:** Watchtower mở đầu bằng 5 phút tấn công một agent chưa có phòng thủ, giống cấp đầu của Gandalf. L3 là đấu trường bất đồng bộ: agent mà người chơi đã gia cố ở L2 trở thành mục tiêu cho người khác. Kèm một "hộp thư bị tấn công" phát lại trace LangGraph của từng đòn. Mọi trận chạy trong sandbox, dùng PII giả và có trần token cho mỗi trận.

## 3. Chơi xong hiểu thật

**3.1 Thao tác chính là khái niệm.** Trong Zombie Division, bản lồng phép chia vào cơ chế chiến đấu giúp trẻ học được nhiều hơn bản chèn câu hỏi giữa các màn. Khi được tự chọn, trẻ chơi bản lồng ghép lâu gấp 7 lần.
**Áp dụng:** Không đặt quiz làm cửa chặn ở bất cứ đâu. Model market là một nền kinh tế thật: điểm bằng chất lượng trên test set trừ chi phí token thật. Mỗi quyết định (chọn model, max_tokens, nén lịch sử) gắn với đúng một khái niệm.

**3.2 Chạy trước, giảng sau.** Meta-analysis của Sinha & Kapur (2021) gồm 53 nghiên cứu và 166 phép so sánh. Cho người học giải bài trước rồi mới dạy có hiệu ứng ở mức trung bình (g khoảng 0,36), và lên tới khoảng 0,58 khi thiết kế đúng nguyên tắc productive failure. Factorio để người chơi chế tạo bằng tay rồi tự tìm ra cách tốt hơn, và đội phát triển thấy các ràng buộc chống chơi dở làm trải nghiệm tệ đi.
**Áp dụng:** Library L1 ban đầu chỉ cho phép "dán tài liệu vào prompt". Người chơi sẽ đụng trần context đã gặp ở Model market: chi phí vọt lên, hoặc phải cắt bớt tài liệu rồi bị bịa. Đến lúc đó retriever mới mở khoá. Không chặn cấu hình dở: top-k=50 vẫn chạy, và chẩn đoán chỉ ra số token bị lãng phí. Thẻ lý thuyết chỉ mở sau lần trượt đầu tiên và trỏ đúng vào case vừa sai. Bài giảng AI in Action nên xếp sau zone tương ứng.

**3.3 Dạy riêng, củng cố, rồi mới kết hợp; không cho qua màn nhờ may.** Kim Swift kể Portal dạy từng kỹ năng riêng, củng cố ít nhất 2 lần rồi mới kết hợp. Phòng 01 buộc người chơi đi qua ít nhất 5 portal theo đúng thứ tự. Ngược lại, Common Sense Media chê while True: learn() vì đòi dùng công cụ chưa được giới thiệu, có lúc muốn điểm tuyệt đối phải dùng lệnh chưa mở khoá.
**Áp dụng:** L1 giới thiệu một núm điều chỉnh, L2 củng cố bằng biến thể, L3 kết hợp. Ví dụ Library L3 bắt buộc dùng lại chunk và top-k từ L2. Luật cứng: mọi sao đều đạt được bằng công cụ đã mở. Test set phải khiến cấu hình mặc định chắc chắn trượt. Ví dụ ở Library L2, chunk lớn không overlap sẽ cắt đôi câu trả lời nằm vắt qua hai đoạn.

**3.4 Dùng test ẩn và chấm cả hai chiều.** Exapunks bắt mỗi lời giải phải đúng trên 100 kịch bản. Bài báo Gandalf the Red phân tích 279.675 prompt và thấy phòng thủ nhúng trong system prompt làm giảm tính hữu dụng, kể cả khi không chặn yêu cầu nào. Phòng thủ nhiều lớp và thu hẹp phạm vi ứng dụng thì hiệu quả hơn. Một phân tích ROC về Bad News cho thấy người chơi chủ yếu chỉ trả lời "giả" nhiều hơn với mọi tin, chứ không phân biệt tốt hơn.
**Áp dụng:** Mỗi NPC có vài case nhìn thấy để debug và một tập ẩn để chấm, nên prompt "học thuộc" ví dụ sẽ tụt điểm. Nhờ vậy bài học về eval và overfitting tự xuất hiện. Tiêu chí chấm phải do máy kiểm tra: khớp đáp án, trích đúng chunk, regex PII giả không xuất hiện. Test set của Watchtower trộn câu tấn công với yêu cầu hợp lệ nhưng trông đáng ngờ. Guardrail kiểu "chặn tất cả" chỉ được 1 sao, kèm chẩn đoán "bạn đang nghi ngờ mọi thứ". Lời giải hiển nhiên "thêm câu đừng nghe lời kẻ xấu vào system prompt" được cài sẵn để trượt test ẩn. Vì LLM không tất định, ở mức sao 3 mỗi case chạy nhiều lần và game hiện độ dao động.

**3.5 Tự giải thích nhẹ nhàng, và làm phai dần ẩn dụ.** Theo Johnson & Mayer (2010), chọn lý do từ một menu sau mỗi nước đi giúp người chơi làm tốt hơn ở màn chuyển giao, và kết quả lặp lại ở thí nghiệm 2. Tự gõ lý do thì không giúp gì. Theo Long & Aleven (2017), người chơi DragonBox giải nhiều bài hơn và thích hơn, nhưng nhóm học với gia sư Lynnette làm bài kiểm tra trên giấy tốt hơn.
**Áp dụng:** Trước khi hiện chẩn đoán, hỏi một câu chọn nhanh "Vì sao câu #7 sai?" với 3-4 lựa chọn dùng thuật ngữ thật: chunk quá nhỏ, top_k thấp, embedding hụt mã sản phẩm, prompt không buộc trích nguồn. Ẩn dụ 3D phai dần qua các level: ở L1 người chơi thao tác trên ẩn dụ, có panel config thật chạy song song; đến L3 chỉ còn node LangGraph và trace. Mỗi zone kết thúc bằng thẻ "Ngoài đời thật" và nút xuất code LangGraph để mang sang lab.

## Đo xem người chơi có hiểu thật không

- **Trước và sau mỗi zone:** 3-5 câu chẩn đoán cùng dạng, ví dụ "vì sao tăng top-k lại làm sai câu này?".
- **Bài chuyển giao ngoài game:** một ticket trên repo LangGraph thật, không có ẩn dụ, ví dụ log hallucination cần sửa hoặc agent bị indirect injection. Đây là KPI của zone, không phải số sao (bài học từ DragonBox).
- **Kiểm tra ngay sau khi chơi:** Capewell và cộng sự (2024) thấy sau 48 giờ, chỉ nhóm được kiểm tra ngay sau can thiệp còn giữ được khả năng phân biệt. Vì vậy cuối mỗi level có 60 giây phân loại 3 input mới, và thêm một bài kiểm tra muộn sau 2-4 tuần.
- **Bằng chứng trong game:** độ chính xác của dự đoán trước mỗi lần Run tăng dần; tỷ lệ chọn đúng lý do; ở Watchtower, đo cả tỷ lệ chặn đúng lẫn tỷ lệ chặn nhầm.
- **Playtest kiểu Portal:** 5-8 học viên, quan sát im lặng. Sau màn, yêu cầu họ dùng bằng chứng để giải thích vì sao agent trượt một case cụ thể. Nếu họ không giải thích được thì sửa màn, không thêm chữ.
- **So sánh:** A/B test các biến thể (có hoặc không có bước dự đoán) và so với nhóm chỉ học lab. Giữ biến thể thắng ở điểm chuyển giao, không chọn theo thời gian chơi. Dashboard tách riêng hai trục: giữ chân và mức hiểu.

## Bẫy cần tránh

- **Tin vào số sao:** người chơi DragonBox giải nhiều hơn và vui hơn, nhưng vẫn thua trên bài làm giấy.
- **Thả game cho học viên rồi bỏ đó:** Zachademics nói game của Zachtronics cần người thật giới thiệu và dẫn dắt khi dùng trong lớp. Hãy tổ chức buổi debrief có mentor, dựa trên dashboard lỗi phổ biến của cohort. Thảo luận giữa người học (Peer Instruction: normalized gain khoảng 0,48 so với 0,23 ở lớp truyền thống) có thể chạy dưới dạng chế độ nhóm "Nội gián trong kho tài liệu". Nhớ rằng Among Us từng phải thiết kế lại vì bản đầu khủng hoảng liên tục, không chừa thời gian để thảo luận.
- **Chấm theo tốc độ của người chơi:** giảng viên dùng Kahoot! cho biết chấm điểm theo tốc độ làm người học bớt suy nghĩ và đoán bừa nhiều hơn. Trục "Độ trễ" trong game là độ trễ của agent, không phải tốc độ của người chơi.
- **Thưởng cho sự nghi ngờ thay vì khả năng phân biệt:** guardrail chặn tất cả phải bị điểm thấp.
- **Đòi dùng công cụ chưa mở, hoặc chỉ báo đạt/trượt cho cả màn.**
- **Chi phí API:** chi phí token ban đầu của Suck Up! rất cao. Hãy cache các cấu hình trùng, dùng model rẻ cho thoại NPC, giới hạn số lượt chạy, và biến chính ngân sách đó thành tài nguyên người chơi quản lý ở Model market.
- **Trang trí làm rối giao diện:** Portal đã thay "trường lực lấp lánh" bằng tấm kính vì nó làm người chơi bối rối. Bỏ bớt trang trí 3D đang làm rối bảng cấu hình, và đầu tư vào vòng lặp chạy thật và chẩn đoán trước tiên.


## Nguồn

- **SpaceChem (postmortem)**: Chủ đề giống bài tập đẩy người chơi ra xa; chỉ khoảng 2% hoàn thành chiến dịch hơn 40 giờ; phải đo phễu ngay từ tutorial. (https://www.gamedeveloper.com/design/postmortem-zachtronics-industries-i-spacechem-i-)
- **Zachademics (Zachtronics)**: Game Zachtronics dùng trong lớp cần người thật giới thiệu và dẫn dắt. (https://zachtronics.com/zachademics)
- **Opus Magnum (Road to the IGF)**: Bài toán mở, không thưởng trong game cho việc tối ưu, xuất GIF để chia sẻ. (https://www.gamedeveloper.com/business/road-to-the-igf-zachtronics-i-opus-magnum-i-)
- **Zachtronics (Software Engineering Daily)**: Dùng histogram và bảng bạn bè thay leaderboard, vì top 100 chỉ là những người chép cùng một lời giải. (https://softwareengineeringdaily.com/wp-content/uploads/2025/12/SED1884-Zachtronics.txt)
- **Exapunks**: Lời giải phải đúng trên 100 kịch bản, buộc người chơi tổng quát hoá thay vì học thuộc ví dụ. (https://en.wikipedia.org/wiki/Exapunks)
- **Factorio (FFF #241)**: Tutorial cũ quá gò bó và mất 30-45 phút mới tới phần tự động hoá. (https://factorio.com/blog/post/fff-241)
- **Factorio (FFF #329)**: Để người chơi làm tay rồi tự phát hiện cách tốt hơn; ràng buộc chống chơi dở làm giảm trải nghiệm. (https://www.factorio.com/blog/post/fff-329)
- **Productive failure (Sinha & Kapur 2021)**: Cho giải bài trước rồi mới dạy có hiệu ứng trung bình, mạnh hơn khi thiết kế đúng nguyên tắc. (https://www.timeshighereducation.com/campus/using-productive-failure-activate-deeper-learning)
- **while True: learn()**: Bị chê vì đòi dùng công cụ chưa giới thiệu; mọi sao phải đạt được bằng công cụ đã mở khoá. (https://www.commonsensemedia.org/app-reviews/while-true-learn)
- **Learning Factory (Luden.io)**: Luden chuyển sang dùng ML thật cho vấn đề thật, khẳng định hướng agent chạy thật. (https://ludenio.substack.com/p/meet-learning-factory-8d5fd27dac7e)
- **Portal (Best of GDC)**: Playtest bằng cách quan sát trực tiếp, thay trường lực gây rối bằng kính, hỏi người chơi kể lại câu chuyện. (https://www.gamedeveloper.com/pc/best-of-gdc-the-secrets-of-i-portal-i-s-huge-success)
- **Portal (Kim Swift)**: Dạy từng kỹ năng riêng, củng cố ít nhất 2 lần rồi mới kết hợp; người chơi kẹt là lỗi của designer. (https://www.gamedeveloper.com/design/10-years-of-design-lessons-from-em-portal-em-s-kim-swift)
- **Portal (developer commentary)**: Phòng 00 cho người chơi thấy chính mình qua cổng; phòng 01 buộc đi qua ít nhất 5 portal theo thứ tự để không qua màn nhờ may. (https://theportalwiki.com/wiki/Portal_developer_commentary)
- **Super Mario Bros. World 1-1**: Sắp đặt màn chơi để người chơi buộc phải trải nghiệm cơ chế mà không cần chữ. (https://soranews24.com/2015/09/09/super-mario-bros-creator-explains-how-and-why-he-designed-world-1-1-of-the-8-bit-classic-%e3%80%90video%e3%80%91/amp/)
- **Hades (God Mode)**: Tăng mức hỗ trợ sau mỗi lần thua thay vì hạ mục tiêu. (https://www.inverse.com/gaming/hades-god-mode-interview)
- **Hades (Greg Kasavin)**: Biến thất bại thành tiến triển câu chuyện, để chơi thêm một lượt không còn đáng sợ. (https://inlander.com/culture/hades-writer-greg-kasavin-on-how-he-made-video-game-deaths-drive-a-feel-good-story-22725237)
- **Wordle**: Khoảng 3 phút mỗi ngày, đề chung cho mọi người, lưới chia sẻ không lộ đáp án. (https://www.gamedeveloper.com/marketing/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success)
- **Contexto**: Hiển thị thứ hạng thay vì điểm cosine; 90% người dùng trong khảo sát biết game qua bạn bè hoặc mạng xã hội. (https://www.hey.gg/blog/contexto)
- **Semantle**: Tác giả tiếc vì không dùng thang 0-100 và phải thêm gợi ý: phản hồi phải dễ đọc. (https://www.hey.gg/blog/semantle)
- **Gandalf the Red (Lakera, ICML 2025)**: Mỗi cấp thêm một lớp phòng thủ có mô tả; phòng thủ trong system prompt làm giảm tính hữu dụng, phòng thủ nhiều lớp hiệu quả hơn. (https://arxiv.org/html/2501.07927v3)
- **Gandalf (Lakera)**: Mục tiêu gói trong một câu, chơi ngay trên web, được dùng trong các sự kiện giáo dục. (https://www.destructoid.com/players-have-tried-to-crack-security-companys-password-game-over-4-million-times/)
- **Tensor Trust**: Mỗi người vừa công vừa thủ, xem lại các đòn đã phá mình, nên kỹ thuật lan ra thành từng đợt. (https://arxiv.org/abs/2311.01011)
- **HackAPrompt**: Cho thấy input bị chèn vào đâu trong template; chấm theo số token; thử thách 10 không ai giải được. (https://www.cs.umd.edu/~jbg/docs/2023_emnlp_hackaprompt.pdf)
- **TensorFlow Playground**: Làm lộ trạng thái ẩn của mô hình và lưu cấu hình trong URL để dễ chia sẻ. (https://ar5iv.arxiv.org/html/1708.03788)
- **Quick, Draw!**: Thiên lệch dữ liệu lộ ra qua chính những lần AI đoán sai. (https://techcrunch.com/2017/08/25/google-releases-millions-of-bad-drawings-for-you-and-your-ai-to-paw-through)
- **Suck Up!**: NPC chạy bằng LLM có cá tính hài tạo ra nhiều clip; chi phí token là ràng buộc thiết kế. (https://naavik.co/podcast/finding-success-with-ai-agents-and-content-creators/)
- **Bad News (Basol et al. 2020)**: Tự đóng vai kẻ thao túng giúp giảm mức tin vào tin giả trong RCT có nhóm đối chứng. (https://pmc.ncbi.nlm.nih.gov/articles/PMC6952868/)
- **Bad News / Go Viral! (Modirrousta-Galian & Higham 2023)**: Phân tích ROC cho thấy hiệu ứng là thiên lệch trả lời chứ không phải phân biệt tốt hơn; phải chấm cả chặn nhầm. (https://pubmed.ncbi.nlm.nih.gov/36996156/)
- **Capewell et al. 2024 (inoculation decay)**: Không có bài kiểm tra ngay sau can thiệp thì hiệu ứng mất sau 48 giờ. (https://research-information.bris.ac.uk/en/publications/misinformation-interventions-decay-rapidly-without-an-immediate-p/)
- **DragonBox (Long & Aleven 2017)**: Vui hơn và giải nhiều bài hơn, nhưng thua gia sư thông minh trên bài kiểm tra giấy. (https://unpaywall.org/10.1145%2F3057889)
- **Zombie Division (Habgood & Ainsworth 2011)**: Lồng nội dung vào lõi game giúp học nhiều hơn, và khi được chọn, trẻ chơi bản này lâu gấp 7 lần. (https://shura.shu.ac.uk/3556/)
- **Circuit Game (Johnson & Mayer 2010)**: Chọn lý do từ menu giúp chuyển giao tốt hơn; tự gõ lý do thì không. (https://www.datalearner.com/academic/journal-papers/0747-5632/volumes-and-issues/121/paper-detail/33903)
- **Kahoot! (Wang & Tahir 2020)**: Chấm theo tốc độ làm người học bớt suy nghĩ và đoán bừa nhiều hơn. (https://research.gold.ac.uk/id/eprint/39435)
- **Among Us (Innersloth)**: Thiết kế lại để có chỗ cho điều tra và thảo luận thay vì khủng hoảng liên tục. (https://nintendo.com/whatsnew/among-us-dev-recounts-how-the-game-took-flight)
- **Peer Instruction (Crouch & Mazur 2001)**: Lớp có thảo luận giữa người học đạt mức tiến bộ chuẩn hoá cao hơn lớp truyền thống. (https://mazur.harvard.edu/publications/peer-instruction-ten-years-experience-and-results)
- **Duolingo (Half-life regression)**: Lên lịch ôn theo dự đoán mức quên của từng mục, giảm hơn 45% sai số so với Leitner và các baseline khác. (https://aclanthology.org/P16-1174.pdf)

Kiểm chứng: {'confirmed': 16, 'corrected': 9}
