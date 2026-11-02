# Engine API test data

Shared by vitest (`app/features/workbench/*.test.ts`) and Playwright (`e2e/workbench.spec.ts`).

| File                              | What                                                                                        | How it was made                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `blocks.json`                     | `GET /api/blocks`                                                                           | `curl -s http://127.0.0.1:8000/api/blocks` against the local backend                                                                                                     |
| `levels/<id>.json`                | `GET /api/levels/<id>` (PublicLevel)                                                        | `curl -s http://127.0.0.1:8000/api/levels/<id>`                                                                                                                          |
| `run-l1-reference.sse`            | the real SSE stream of one L1 run of the reference graph, built on the bench through the UI | `curl -sN http://127.0.0.1:8000/api/runs/<run_id>/events` right after the run, before the backend stops (runs live only in its memory; the replay sends no AI call)      |
| `run-w1-<starter\|reference>.sse` | W1's starter and reference graph, run by the engine in process (no server, no AI call)      | the scripted model of `backend/tests/engine/test_watchtower.py`: `run(graph)` for each, every event written as one SSE frame with the fixed run id of `run-l1-short.sse` |
| `run-l1-short.sse`                | hand-written: 2 cases, 6 event types, ends with `run.finished`                              | written by hand from engine-v0.2 §8; used for the reconnect, 429 and cancel tests                                                                                        |

JSON files are Prettier-formatted (`npx prettier --write e2e/data`); the content is unchanged.
Re-capture when the backend's level files, block registry or event contract change.
Without a running backend, the JSON files can be captured from the same app with FastAPI's
`TestClient` (no index or Gemini key needed for these GET routes): `GET` each path from
`create_app(Settings(_env_file=None, gemini_api_key=None))`, write `json.dumps(body,
ensure_ascii=False, indent=2)`, then run Prettier. Last capture: 2026-10-09.

`blocks.json` holds every block, the unreleased Watchtower ones included (`registry_json(include_unreleased=True)`):
the W1 specs need them. The live server hides them until W1 ships; `api.test.ts` covers a library
level loading against that shorter list.
