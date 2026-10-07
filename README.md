# V-Game

Trò chơi học tập cho chương trình AI 20K: người học đi trong một khuôn viên 3D thu nhỏ, lắp agent
từ các khối, chạy thật trên câu hỏi của NPC rồi lần theo dấu vết để hiểu vì sao agent đúng hay sai.

> Trạng thái: v0.1 đang phát triển (khu Thư viện / RAG). Engine chạy agent chưa được xây.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `frontend/` | React Router 8 (SPA, trang chủ pre-render), React 19, Tailwind 4, three.js qua react-three-fiber |
| `backend/` | FastAPI, Pydantic, nội dung khu học (`src/vgame/content/data/zones.json`) |
| `docs/` | Spec, ADR, thiết kế, nghiên cứu, kịch bản — bắt đầu từ [docs/README.md](docs/README.md) |
| `.github/` | CI (lint, type, test, build, e2e) và quét bảo mật (Gitleaks, Semgrep, OSV-Scanner) |

## Chạy local

Cần Node ≥ 22.22, Python 3.12 và [uv](https://docs.astral.sh/uv/).

```bash
cd backend && uv sync && uv run uvicorn vgame.main:app --port 8000
```

```bash
cd frontend && npm ci && npm run dev
```

Frontend chạy ở http://localhost:5173 và proxy `/api` sang backend.

## Kiểm tra chất lượng

```bash
cd frontend && npm run check && npm run build && npm run test:e2e
```

```bash
cd backend && uv run ruff check && uv run ruff format --check && uv run mypy src tests && uv run pytest
```

Git hook (Gitleaks + lint file đã stage): `lefthook install` sau mỗi lần clone.

## Giao diện theo bối cảnh (theme pack)

Theme pack chỉ là dữ liệu trong `frontend/public/themes/<id>/` (manifest, CSS token, font, ảnh), liệt kê ở
`index.json`. Người xem đổi bằng nút giao diện; theme không dùng thì không bị tải.

- `VITE_DEFAULT_THEME` chọn theme mặc định (không đặt thì lấy mục đầu tiên trong `index.json`).
- Bỏ một theme: xoá thư mục của nó và mục tương ứng trong `index.json`. Không cần sửa code.
- Theme lấy cảm hứng VinUni dùng ảnh và token không chính thức, chỉ cho bản nội bộ; xem
  `frontend/public/themes/vinuni/README.md` trước khi triển khai công khai.

## Bảo mật

Không commit `.env`, khoá hay token (đã có `.gitignore`, Gitleaks trong hook và CI). Bản build tĩnh
sinh `_headers` với CSP chặt (hash cho script inline) — xem `frontend/scripts/postbuild-csp.mjs`.
