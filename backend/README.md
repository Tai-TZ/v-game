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
`POST /api/runs` answers `503` with a Vietnamese message (`llm_not_configured`, `index_missing`,
`index_stale` or `rerank_unavailable`).

### Build the index

`uv run vgame-build-index` downloads `EMBED_MODEL` (multilingual-e5-large, about 2.2 GB) and
`RERANK_MODEL` into `ENGINE_CACHE_DIR/models`, then precomputes the 24 chunker variants and the
embeddings of every golden question into `ENGINE_CACHE_DIR/index`. Runs only ask the
golden questions, so nothing is embedded at run time. Rerun it after editing `docs/content`:
at startup the server compares the index with the corpus (`corpus_sha256` of the manifest) and the
golden questions, and a stale index answers `503 index_stale` until it is rebuilt. A rebuild
reuses the vectors already on disk (same embed model and fastembed version) and embeds only new
passages and questions, so a question edit takes seconds plus the model load.
`--variant theo_dieu-512-10` builds one variant.

The API process loads the index and the reranker (~2.1 GB committed at startup). Reranking runs
on the CPU, pairs cut at 512 tokens, batches of 2: about 3.2 GB committed with 3 L3 cases at once,
even for the heaviest legal graph, and 2-6 s per case on an idle dev laptop
(`docs/design/engine-spike-report.md` §3.3).

### Gemini key

Put `GEMINI_API_KEY=...` in `backend/.env` (gitignored; tests never read it). One run is at most
13 cases, one LLM call each. Calls go through a model chain: `GEMINI_MODEL`
(`gemini-3.5-flash-lite`), then `GEMINI_FALLBACK_MODELS` in order. A per-model limiter keeps
each model under its requests per minute (`GEMINI_RPM`, defaults = the free-tier table in
`engine/llm.py`, counted over 62 s for margin); a model busy past the case deadline hands the
call to the next one. A call is sent only if its model can still finish before the case deadline
(4 s for `gemini-3.5-flash-lite`, 15 s for `gemini-3.1-flash-lite` and unmeasured models);
otherwise the case ends as `timeout` with no network call. Each request's server timeout is what
is left of its case, so the provider stops when the case gives up. A `429` or `503` puts that
model in cooldown (the provider's retry delay, 60 s without one; a per-day quota until the next
Pacific midnight) and the same call moves to the next model. `500`/`502` are retried once on the
same model; `504` and other errors are not retried. When every model is cooling down the call
fails and a run with no answered call ends `run.failed` (`llm_unavailable`). Every network
attempt counts against `DAILY_LLM_CALL_CAP` (real calls per UTC day across the server). Capacity
with the defaults: an L3 run uses 13 of the primary's 15 requests per minute, so about one run per
minute stays on the primary, and the cap allows about 38 fresh L3 runs a day. Answers are cached
in `ENGINE_CACHE_DIR/replay.sqlite3`, keyed by the model that served them, so rerunning an
identical graph costs no call. `step.finished` facts and `run.finished.models` show which model
answered. Star 2 budgets are calibrated on the primary model only. Rotate the key after a trial.

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
gets `422 {detail, fields[]}` without echoing the input; an unknown path or method gets a
Vietnamese `404`/`405`), `429` too many concurrent runs, `503` engine not set up or index stale. A
run whose every LLM call failed (provider outage or daily cap) ends with `run.failed`
(`llm_unavailable`) instead of a 0-star score; a case that fails in the index ends the run with
`run.failed` (`index_stale`). SSE events, in order: `run.started`, pairs of
`step.started`/`step.finished`, `case.graded` per case, `run.scored`, then `run.finished`
(with gold, diagnosis and LLM calls per model) or `run.failed`. After 15 s without an event the
stream sends a `: ping` comment line so proxies keep it open.

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
| `GEMINI_MODEL`        | `gemini-3.5-flash-lite`                     | primary model; profiles map to thinking LOW/MEDIUM/HIGH |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.1-flash-lite,gemini-3.5-flash` | tried in order on 429/503 or when busy; empty = none; each must accept `thinking_level` (not `gemini-2.5-flash`) |
| `GEMINI_RPM`          | free-tier table in `engine/llm.py`          | `model=rpm,...` overrides; unknown models get 5       |
| `DAILY_LLM_CALL_CAP`  | `500`                                       | real Gemini calls per UTC day, whole server           |
| `MAX_CONCURRENT_RUNS` | `1`                                         | more answers 429; 3 x this = Gemini calls and CPU reranks in flight |
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
