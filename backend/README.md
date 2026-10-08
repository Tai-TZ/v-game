# V-Game backend

FastAPI service serving the campus zones, the Library levels and the engine that runs a
player's block graph against them. Python 3.12, managed with [uv](https://docs.astral.sh/uv/).
Engine design: [`docs/design/engine-v0.2.md`](../docs/design/engine-v0.2.md).

## Run

```sh
uv sync
uv run uvicorn --factory vgame.main:create_app --reload --port 8000
```

API docs (development and test only): <http://localhost:8000/docs>

The app always starts. Without a Gemini key it serves zones, levels and blocks, and
`POST /api/runs` answers `503` with a Vietnamese message (`llm_not_configured`; `index_stale` or
`index_missing` if the shipped index does not match `docs/content`).

### The shipped index (no ML model at run time)

Runs only ask the golden questions, so everything model-dependent is computed offline and
committed in `src/vgame/engine/data/index` (~6.7 MB): the chunks of the 24 chunker variants, one
float32 e5 vector per distinct passage text (shared by every variant), the vector of every golden
question, and a float32 table of jina rerank scores for every (question, passage) pair a legal
graph can rerank (the L3 questions x every `qcdt-2024` passage). The API process loads no model:
about 120 MB of RAM after startup, about 160 MB once its 200-run store is full. A pair missing from the table is an `index_error` (`run.failed`
`index_stale`), never a silent fallback.

`uv run vgame-build-index` (needs the `models` dependency group, included in `uv sync`) downloads
`EMBED_MODEL` (multilingual-e5-large, about 2.2 GB) and `RERANK_MODEL` into
`ENGINE_CACHE_DIR/models` and rewrites `INDEX_DIR` (default: the shipped folder). Rerun it after
editing `docs/content` or a level's `allowed_blocks`, then commit the folder: at startup the server
compares the index with the corpus (`corpus_sha256`), the golden questions and the rerank pairs,
and a stale index answers `503 index_stale`; the fast test `test_shipped_index_is_fresh_and_complete`
fails in CI too. A rebuild reuses the vectors and scores already there (same models) and computes
only new passages, questions and pairs: a question edit takes about 2 minutes plus the model load,
a full rebuild 1-1.5 hours (~5 GB of RAM). `--variant theo_dieu-512-10` adds one variant to the index already in `INDEX_DIR` (it never
shrinks it). Scores are reused only when the model, `RERANK_MAX_TOKENS`, fastembed and
onnxruntime versions match (`rerank.json` `regime`).

### Replay seed

`src/vgame/engine/data/replay-seed.json` holds real Gemini answers (`gemini-3.5-flash-lite`) for
the reference and the starter graph of each Library level, only the fields the replay cache keeps
(text, stop reason, token usage, model). Startup merges it into the replay cache (rows already
there win), so those runs cost no Gemini call. A change to one of those graphs, the prompt frame,
the packer, the corpus or the index makes `tests/engine/test_replay_seed.py` fail until the seed
is regenerated (command in `scripts/spike_llm.py`, at most 72 calls; replayed answers cost none).

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
| `GET /api/weather`                 | `{condition, temperature_c, updated_at}` (UTC) from Open-Meteo; max-age 300 (60 when stale); 503 + `Retry-After: 120` when nothing is cached |

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
uv run pytest -q              # offline: fake models, the shipped index and a fake LLM
uv run pytest -m slow         # real models (downloaded by `uv run vgame-build-index`)
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
| `DAILY_LLM_CALL_CAP`  | `500`                                       | real Gemini calls per UTC day, whole server (Render: 200) |
| `MAX_CONCURRENT_RUNS` | `1`                                         | more answers 429; 3 x this = Gemini calls in flight   |
| `INDEX_DIR`           | `src/vgame/engine/data/index`               | shipped index, vectors and rerank table (committed)   |
| `ENGINE_CACHE_DIR`    | `backend/.cache/engine`                     | model files (build tool only), replay cache (gitignored) |
| `CONTENT_DIR`         | `<repo>/docs/content`                       | corpus and golden files                               |
| `EMBED_MODEL`         | `intfloat/multilingual-e5-large`            | rebuild the index after changing it                   |
| `RERANK_MODEL`        | `jinaai/jina-reranker-v2-base-multilingual` | CC-BY-NC-4.0 licence                                  |
| `WEATHER_LATITUDE`    | `21.0285`                                   | campus place; change together with the theme `place`  |
| `WEATHER_LONGITUDE`   | `105.8542`                                  | campus place; change together with the theme `place`  |

## Docker

```sh
docker build -t v-game-backend .
docker run --rm -p 8000:8000 -e CORS_ORIGINS=https://your-frontend.example v-game-backend
```

The image runs as a non-root user with `ENV=production` and ships the index and the replay seed
(they live in the package). It does not ship `docs/content` yet, so runs need it mounted
(`CONTENT_DIR`).
