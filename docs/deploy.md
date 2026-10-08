# Deploy: Vercel (frontend) + Render (backend), gói miễn phí

Bản công khai chỉ có theme **town**. Theme khuôn viên lấy cảm hứng từ trường thật không được đưa lên
cho tới khi có phép của chủ thương hiệu (`frontend/scripts/build-vercel.mjs` mặc định
`VITE_THEME_PACKS=town`).

```text
Trình duyệt ──> vgame.ai20k.cloud (Vercel, trang tĩnh)
                   │  /api/*  (proxy, cùng origin)
                   └──> v-game-api.onrender.com (Render free, FastAPI)
```

## 1. Backend trên Render

1. Đăng nhập [render.com](https://render.com) bằng GitHub, cho Render quyền đọc repo `v-game`.
2. **New → Blueprint** → chọn repo. Render đọc `render.yaml` và tạo service `v-game-api`
   (gói free, vùng Singapore, health check `/api/health`).
3. Trong tab **Environment** của service, thêm `GEMINI_API_KEY` (key ở project Gemini không bật
   billing). Chỉ cần khi chạy agent thật; trang web hiện tại chạy được không cần key.
4. Đợi deploy xong, mở `https://<tên-service>.onrender.com/api/health`, thấy `{"status":"ok"}` là được.

Ghi chú gói free: 512 MB RAM (API dùng khoảng 110 MB), ngủ sau 15 phút không có truy cập, thức dậy
khoảng một phút. Trang chủ tự gọi `/api/health` để đánh thức API sớm. Muốn API không ngủ thì tạo một
monitor HTTP 5 phút trên [UptimeRobot](https://uptimerobot.com) trỏ vào `/api/health` (một service
chạy cả tháng vẫn nằm trong 750 giờ miễn phí).

## 2. Frontend trên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) bằng GitHub → **Add New → Project** → import `v-game`.
2. **Root Directory**: `frontend`. Framework preset: **Other** (đã khai báo trong `frontend/vercel.json`).
3. **Environment Variables**: `VG_API_ORIGIN` = `https://<tên-service>.onrender.com` (không có `/`
   ở cuối). Không cần đặt biến theme: mặc định chỉ build theme town.
4. Deploy. Build chạy `npm run build:vercel`: build như thường, rồi ghi `.vercel/output` với header
   bảo mật (CSP theo hash của từng bản build), proxy `/api/*` sang Render và SPA fallback.

## 3. Tên miền `vgame.ai20k.cloud`

1. Vercel → Project → **Settings → Domains** → thêm `vgame.ai20k.cloud`.
2. Ở nơi quản lý DNS của `ai20k.cloud`, tạo bản ghi **CNAME**: tên `vgame`, giá trị đúng như Vercel
   hiển thị (thường là `cname.vercel-dns.com` hoặc một địa chỉ riêng của project).
3. Đợi Vercel báo "Valid Configuration"; chứng chỉ HTTPS được cấp tự động.

Không cần đổi CORS ở backend: trình duyệt chỉ gọi `vgame.ai20k.cloud/api/*`, Vercel chuyển tiếp
phía máy chủ.

## Cập nhật

Merge vào `main` là cả hai tự deploy lại. Thử bản Vercel trên máy:

```bash
cd frontend && VG_API_ORIGIN=https://example.onrender.com npm run build:vercel
```
