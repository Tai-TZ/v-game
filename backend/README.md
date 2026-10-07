# V-Game backend

FastAPI service serving the campus zones and levels. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).

## Run

```sh
uv sync
uv run uvicorn vgame.main:app --reload --port 8000
```

API docs (development and test only): <http://localhost:8000/docs>

| Endpoint                  | Returns                                   |
| ------------------------- | ----------------------------------------- |
| `GET /api/health`         | `{"status": "ok"}`                        |
| `GET /api/zones`          | zone summaries with `level_count`         |
| `GET /api/zones/{zone_id}` | one zone with its levels (404 if unknown) |

Content lives in `src/vgame/content/data/zones.json` and is validated at startup;
invalid content (duplicate ids, non-contiguous level orders, unknown fields) stops the app from booting.

## Test and lint

```sh
uv run ruff check
uv run ruff format --check
uv run mypy src tests
uv run pytest -q
```

## Environment variables

Read from the process environment, or from `backend/.env` (see `.env.example`).

| Variable       | Default                 | Notes                                                    |
| -------------- | ----------------------- | -------------------------------------------------------- |
| `ENV`          | `development`           | `development`, `test` or `production` (disables docs)    |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated allowed origins; `*` is rejected         |

## Docker

```sh
docker build -t v-game-backend .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=https://your-frontend.example v-game-backend
```

The image runs as a non-root user with `ENV=production`.
