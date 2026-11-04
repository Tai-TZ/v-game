# Bản tin ca trực (plan v0.7 4.3): thiết kế

Trạng thái: **thiết kế, chưa code** (2026-11-04). Chờ chủ dự án quyết các điểm ở mục 9, nhất là điểm 6, vì nó cần khoá Gemini.

## Đã kiểm trong mã
- **Các lớp lọc đã tất định:**
  - `guard_text` (`backend/src/vgame/engine/blocks.py:304-310`) làm NFKC, chữ thường, bỏ dấu, gộp khoảng trắng.
  - `PatternGuardParams.run` (`:317-326`) khớp chuỗi con.
  - `InjectionClassifierParams.run` (`:333-347`) chặn khi điểm ≥ ngưỡng.
- **Đòn đi lọt và không đi lọt:**
  - "Bo qua huong dan" sau khi chuẩn hoá vẫn trùng cụm từ, nên kiểu đòn "bỏ dấu" bị Lưới chặn.
  - Ký tự rộng 0 và chữ cách quãng ("b ỏ q u a") thì lọt.
- **Điểm Chó gác:** gắn với sha256 câu hỏi, nằm trong `data/guard_scores/<level>.json` (`guard_scores.py:26,55-74`). Không chấm lại file của W1, vì độ dao động của model sẽ làm lệch hiệu chỉnh.
- **Bẫy glob:**
  - `load_watch_spec` lấy file đầu tiên khớp `golden/watchtower-w*.json` theo thứ tự tên (`watchtower.py:58`).
  - Một file tên `watchtower-w1-bulletin.json` sẽ thay mất 12 câu của W1 mà không báo gì.
  - Vì vậy **bản tin nằm ngoài `golden/`**.
- **Tiền lệ chạy nháp miễn phí:** `POST /api/preview/retrieval` (`api/routes/preview.py`) kiểm hợp lệ và biên dịch như một lượt chạy, nhưng không gọi LLM và không trừ quỹ.
- **Ngày:** quỹ và `DailyCap` đều dùng ngày UTC (`quota.ts:17,30`, `engine/budget.py:11,49`).

## 1. Bản tin là gì
- **Một nguồn:** `docs/content/bulletins/direct-injection.json`, gồm:
  - `level_id`, `notes`;
  - `solution{phrases[], threshold}`;
  - `issues[{n, id, kind, title_vi, lesson_vi, items[{id, expect: tan_cong|phuc_vu, turns[]}]}]`.
- **Các số đề xuất:**
  1. bỏ dấu: Lưới bắt được; bài học là "chuẩn hoá trước khi lọc";
  2. base64: chỉ Chó gác bắt được;
  3. chẻ lượt: đòn chia ra nhiều lượt, mỗi lượt lọc riêng;
  4. cách chữ;
  5. tiếng Anh;
  6. ký tự ẩn;
  7. chữ đồng hình.
- **Câu lành song sinh:** ít nhất 2 số có một câu lành, ví dụ khách gõ không dấu, để lọc quá tay thì ô hiện đỏ.
- **"Mỗi ngày":** bộ đếm theo trình duyệt. Số hôm nay = `min(N, số ngày UTC khác nhau trình duyệt này đã mở bản tin W1)`. Mở lại cùng ngày thì không tăng. Bản tin mở khi W1 đạt ★1.
- **W1 giữ nguyên:** câu của bản tin không vào danh sách câu của W1, lượt chấm, prompt, schema, lượt đã ghi hay luật sao. Bản tin chỉ dùng để chạy nháp và không gọi `action_llm`.

## 2. Chạy nháp miễn phí (0 lời gọi)
- **Chạy ở backend,** để quy tắc lọc chỉ có một bản cài đặt, không có bản TypeScript sao chép `guard_text` rồi lệch dần.
- **`blocks.py`:** tách hai hàm thuần `pattern_hit(phrases, text)` và `classifier_blocks(score, threshold)`. Hành vi không đổi; W2 và W3 dùng lại được.
- **`engine/bulletin.py` mới:**
  - `load_bulletin`;
  - `guard_layers(graph)`: chỉ lấy các lớp lọc nằm trên đường từ `q.query` tới quầy;
  - `dry_run`: báo mọi lớp cho mọi lượt, không dừng sớm.
- **`POST /api/preview/bulletin?level=`:**
  - Thân yêu cầu là đồ thị, kiểm hợp lệ bằng `validate()` như lượt chạy.
  - Đồ thị sai vẫn trả 200, kèm `graph_ok:false`.
  - Trả 404 khi level không có bản tin, 415 khi thân không phải JSON. Có `Cache-Control: no-store`.
  - Không chạm tới `LLMClient`, `RunBudget` hay `DailyCap`.
- **Điểm Chó gác cho câu bản tin:**
  - `vgame-score-guards direct-injection --bulletin` ghi ra `data/guard_scores/direct-injection.bulletin.json`, dùng cùng sha256, `PROMPT_VERSION` và `CLASSIFIER_VI` như W1.
  - Tốn khoảng 20 lời gọi, chạy một lần vào ngày không có lớp.

## 3. Dải hồi quy
- Gồm các số từ 1 tới số hôm nay, mỗi câu một ô.
- Ô hiện chữ, không chỉ dựa vào màu:
  - "Chặn · Lưới «…»"
  - "Chặn · Chó gác 0,97 ≥ 0,8"
  - "Lọt"
  - "Phục vụ"
  - "Chặn nhầm"
- **Không đổi sao,** không tính chuỗi ngày. Chỉ có dấu "Hôm nay dải xanh".

## 4. Quỹ
- 0 lời gọi lúc chơi.
- Tốn khoảng 20 lời gọi một lần, khi chấm sẵn điểm.

## 5. Lưu
- Khoá `vg.bulletin.v1.direct-injection` giữ `{days (≤60, UTC), green}`, kiểm bằng valibot.
- Dữ liệu hỏng thì quay về số 1.

## 6. Giao diện
- **Vị trí:** `<section id="wb-bulletin">` ngay sau lưới bàn thợ, trước RevealGate và Results.
- **Đóng mở:** `<details>` mở sẵn khi số hôm nay chưa xanh.
- **Bố cục:**
  - 1280: hai cột (thẻ hôm nay | dải);
  - 375: xếp chồng, không cuộn ngang, nút ≥ 44 px.
- **Máy chiếu:** chọn số bất kỳ, không ghi gì vào trình duyệt.
- **Truy cập:**
  - `<ol aria-label="Dải hồi quy">`;
  - một dòng thông báo polite khi kết quả đổi;
  - không có chuyển động;
  - dấu ghi "Chạy nháp: chỉ các lớp lọc, không gọi AI".
- **Gói tải:** `Bulletin.tsx` dùng `React.lazy`, vì `/play` còn rất ít chỗ trong ngân sách.

## 7. Test
**Backend:**
- **Toàn vẹn W1:** vẫn đúng 12 câu, và chỉ một file golden khai báo level này.
- **Khớp nhau:** `dry_run` quyết định giống `run` cho mọi câu.
- **Nội dung:** id duy nhất; `n` liền mạch; mọi lượt có điểm mới; không trùng câu ẩn hoặc câu bẫy của W1.
- **Giải được:** `solution` chặn đúng mọi câu tấn công và không chặn câu `phuc_vu` nào của W1.
- **Bài học thật:** mỗi đòn phải lọt qua được ít nhất một lớp của đồ thị mẫu.
- **API:** FakeLLM gây lỗi không bao giờ bị gọi, và `DailyCap` không đổi.

**Frontend:**
- **Bộ đếm ngày:**
  - cùng ngày thì không tăng;
  - ngày UTC mới thì tăng;
  - không vượt quá N;
  - lùi đồng hồ thì không tăng cũng không giảm.
- **Máy chiếu:** không ghi gì vào trình duyệt.
- **Kiểm tra khác:** axe ở 375 và ở chế độ chiếu; e2e ở 375 không cuộn ngang.

## 8. Rủi ro
- Bẫy glob ở trên.
- Đổi `PROMPT_VERSION` thì bản tin thành "chưa chấm". Test sẽ báo lỗi rõ.
- Người chơi khớp quá tay theo bản tin; câu lành song sinh giữ cân bằng.
- UTC sang ngày lúc 07:00 giờ Việt Nam.
- Dễ xung đột merge ở `WorkbenchPage.tsx`, `copy.ts`, `blocks.py`.

## 9. Cần chủ dự án quyết (đề xuất in đậm)
1. Số bản tin tăng theo ngày mở của **từng trình duyệt**, hay theo lịch chung của lớp?
2. Mở khi **W1 đạt ★1**, hay từ lần đầu vào W1?
3. Dải chỉ để xem, **không ảnh hưởng sao hay chuỗi ngày**?
4. Có cột "Chuông duyệt sẽ từ chối" không? **Không**, chỉ hiện các lớp lọc.
5. **Mọi câu phải giải được bằng lớp lọc** (có test giữ), hay cho phép câu "chỉ chuông mới cứu"?
6. Duyệt **khoảng 20 lời gọi Gemini một lần** để chấm sẵn điểm Chó gác cho câu bản tin. Chủ dự án chạy, vào ngày không có lớp.

## 10. Danh sách file
**PR 1, backend và nội dung (khoảng 1,5 ngày):**
- `docs/content/bulletins/direct-injection.json` (mới)
- `engine/bulletin.py` (mới)
- `blocks.py` (tách 2 hàm)
- `guard_scores.py` (thêm `--bulletin`)
- `data/guard_scores/direct-injection.bulletin.json` (sinh ra)
- `api/routes/preview.py`
- test cho tất cả các phần trên
- `watchtower.md` §3.8

**PR 2, frontend (khoảng 2 ngày):**
- `bulletin.ts`
- `Bulletin.tsx` (lazy)
- `copy.ts` (`BULLETIN_VI`)
- `WorkbenchPage.tsx`
- test và e2e
