# Engine API test data

Shared by vitest (`app/features/workbench/*.test.ts`) and Playwright (`e2e/workbench.spec.ts`).

| File                   | What                                                                                        | How it was made                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocks.json`          | `GET /api/blocks`                                                                           | `curl -s http://127.0.0.1:8000/api/blocks` against the local backend                                                                                                |
| `levels/<id>.json`     | `GET /api/levels/<id>` (PublicLevel)                                                        | `curl -s http://127.0.0.1:8000/api/levels/<id>`                                                                                                                     |
| `run-l1-reference.sse` | the real SSE stream of one L1 run of the reference graph, built on the bench through the UI | `curl -sN http://127.0.0.1:8000/api/runs/<run_id>/events` right after the run, before the backend stops (runs live only in its memory; the replay sends no AI call) |
| `run-l1-short.sse`     | hand-written: 2 cases, 6 event types, ends with `run.finished`                              | written by hand from engine-v0.2 §8; used for the reconnect, 429 and cancel tests                                                                                   |

JSON files are Prettier-formatted (`npx prettier --write e2e/data`); the content is unchanged.
Re-capture when the backend's level files, block registry or event contract change.
