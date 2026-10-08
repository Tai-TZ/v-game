# V-Game backend

FastAPI service serving the campus zones, the Library levels and the engine that runs a
player's block graph against them. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).
Engine design: [`docs/design/engine-v0.2.md`](../docs/design/engine-v0.2.md).

## Run

```sh
uv sync
uv run vgame-build-index        # once: downloads the models and precomputes the index
uv run uvicorn --factory vgame.main:create_app --reload --port 8000
```

API docs (development and test only): <http://localhost:8000/docs>

The app always starts. Without an index or a Gemini key it serves zones, levels and blocks, and
`POST /api/runs` answers `503` with a Vietnamese message (`llm_not_configured`, `index_missing`
or `rerank_unavailable`).

### Build the index

`uv run vgame-build-index` downloads `EMBED_MODEL` (multilingual-e5-large, about 2.2 GB) and
`RERANK_MODEL` into `ENGINE_CACHE_DIR/models`, then precomputes the 24 chunker variants and the
embeddings of every golden question into `ENGINE_CACHE_DIR/index`. Runs only ask the
golden questions, so nothing is embedded at run time. Rerun it after editing `docs/content`
(the server does not detect a stale index). `--variant theo_dieu-512-10` builds one variant.

### Gemini key

Put `GEMINI_API_KEY=...` in `backend/.env` (gitignored; tests never read it). One run is at most
13 cases, one LLM call each: at most 13 LLM calls per run; at most 26 network attempts against
`DAILY_LLM_CALL_CAP` when 5xx retries fire (one retry on 500/502/503 only; 429 and 504 are not
retried). Answers are cached in `ENGINE_CACHE_DIR/replay.sqlite3`, so
rerunning an identical graph costs no call, and `DAILY_LLM_CALL_CAP` limits real calls per UTC
day across the server. Rotate the key after a trial.

## Endpoints

| Endpoint                           | Returns                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/health`                  | `{"status": "ok"}`                                                      |
| `GET /api/zones`                   | zone summaries with `level_count`                                       |
| `GET /api/zones/{zone_id}`         | one zone with its levels (404 if unknown)                               |
| `GET /api/blocks`                  | the 10 blocks: ports, params JSON Schema, LLM calls, concepts           |
| `GET /api/levels/{level_id}`       | public level: starter graph, limits, prompt cards, visible questions    |
| `POST /api/runs?level={level_id}`  | body = graph JSON; `202 {run_id, created, issues}`                      |
| `GET /api/runs/{run_id}/events`    | SSE stream; send `Last-Event-ID: n` to replay events after `n`          |
| `POST /api/runs/{run_id}/cancel`   | `202`; the run ends with `run.failed` (`cancelled`)                     |

`POST /api/runs` needs `Content-Type: application/json` (415 otherwise) and accepts an optional
`Idempotency-Key` header, 16-64 chars of `[A-Za-z0-9_-]` (same key, level and graph returns the
same run with `200`; the same key with another graph is a `409`). Errors: `404` unknown level,
`422 {detail, issues[]}` with every graph error in Vietnamese (a malformed header, query or path
gets `422 {detail, fields[]}` without echoing the input), `429` too many concurrent runs, `503`
engine not set up. A run whose every LLM call failed (provider outage or daily cap) ends with
`run.failed` (`llm_unavailable`) instead of a 0-star score. SSE events, in order: `run.started`, pairs of
`step.started`/`step.finished`, `case.graded` per case, `run.scored`, then `run.finished`
(with gold and diagnosis) or `run.failed`.

Content: zones in `src/vgame/content/data/zones.json`, levels in `src/vgame/engine/levels/*.json`
(validated at load), corpus and golden cases in `docs/content`.

## Test and lint

```sh
uv run ruff check
uv run ruff format --check
uv run mypy src tests
uv run pytest -q              # offline: fake models and a fake LLM, no network
uv run pytest -m slow         # real models; needs `uv run vgame-build-index` first
```

## Environment variables

Read from the process environment, or from `backend/.env` (see `.env.example`).

| Variable              | Default                                     | Notes                                                 |
| --------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `ENV`                 | `development`                               | `development`, `test` or `production` (disables docs) |
| `CORS_ORIGINS`        | `http://localhost:5173`                     | comma-separated allowed origins; `*` is rejected      |
| `GEMINI_API_KEY`      | unset                                       | without it runs answer 503 `llm_not_configured`       |
| `GEMINI_MODEL`        | `gemini-3.8-flash`                          | profiles map to thinking LOW/MEDIUM/HIGH              |
| `DAILY_LLM_CALL_CAP`  | `500`                                       | real Gemini calls per UTC day, whole server           |
| `MAX_CONCURRENT_RUNS` | `1`                                         | more answers 429; 3 x this = Gemini calls in flight   |
| `ENGINE_CACHE_DIR`    | `backend/.cache/engine`                     | models, index, replay cache (gitignored)              |
| `CONTENT_DIR`         | `<repo>/docs/content`                       | corpus and golden files                               |
| `EMBED_MODEL`         | `intfloat/multilingual-e5-large`            | rebuild the index after changing it                   |
| `RERANK_MODEL`        | `jinaai/jina-reranker-v2-base-multilingual` | CC-BY-NC-4.0 licence                                  |

## Docker

```sh
docker build -t v-game-backend .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=https://your-frontend.example v-game-backend
```

The image runs as a non-root user with `ENV=production`. It does not ship `docs/content` or the
engine cache yet, so runs need both mounted (`CONTENT_DIR`, `ENGINE_CACHE_DIR`); v0.2 targets
local runs.
