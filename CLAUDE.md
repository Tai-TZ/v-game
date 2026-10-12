# V-Game — agent notes

Read `docs/README.md` first; the spec is `docs/specs/2026-10-07-v-game-design.md`.
The user writes Vietnamese; UI copy is Vietnamese, sentence case, verb-first buttons.

## Hard rules
- Brand names (e.g. the campus theme) live only in `frontend/public/themes/<id>/`. Core code reads
  theme data through `app/features/theme`; CI fails if a brand name appears in `frontend/app` or `backend/src`.
- Performance budget: 60 FPS on integrated-GPU laptops, < 80 draw calls in the campus scene,
  three.js only in the `/play` route chunk, `frameloop="demand"`, no per-frame React state.
- Pre-rendered HTML must not contain inline `style` attributes (CSP is `style-src 'self'`).
- Zone content has one source: `backend/src/vgame/content/data/zones.json`.

## Frontend
- Use only the semantic Tailwind tokens from `app/app.css` (default palette is removed).
- Never: purple-blue gradients, glassmorphism, emoji as icons, heavy shadows.
- After a UI change: check 375px and 1280px before calling it done.

## Backend
- Every endpoint validates input at the boundary; errors never include stack traces.
- Bug fix = a failing test that reproduces it first.

## Commands
- Frontend: `npm run check`, `npm run build`, `npm run test:e2e` (in `frontend/`).
- Backend: `uv run ruff check`, `uv run mypy src tests`, `uv run pytest` (in `backend/`).

## Run the CI gates locally before pushing
Three CI rounds were spent in one day on things a local run answers in seconds.
- `semgrep scan --config p/default --error --metrics=off --exclude-rule python.lang.compatibility.python37.python37-compatibility-importlib2`
  from the repo root — the same scan the Security workflow runs. It blocks
  `detect-non-literal-regexp`, among others.
- `axe-core` ships with `@axe-core/playwright`, so jsdom tests can run it without a browser:
  see `frontend/app/features/workbench/toys.a11y.test.tsx`. Its structural rules (roles,
  required parents, allowed roles) catch what the Playwright a11y suite would, nine minutes
  earlier. Contrast, touch targets and horizontal scroll still need the real suite.
- The pre-commit hook fails the commit, it does not stop a `&&` chain that follows a `grep`.
  Check `git log -1` actually moved before assuming a push carried your work.

## Prove a test bites before trusting it
A green test is not evidence; a test that fails when you break the code is.
- Re-break the thing on purpose and re-run. An audit found five mutations surviving 720 tests --
  drawing no cuts, one stamp for a ten-sentence answer, a fabricated citation with a sourced
  one's border -- because the tests asserted the `aria-label` and never the drawn output. Give
  the drawn part a stable `data-*` hook and assert that.
- Watch for assertions that cannot fail: an `axe.run` over an `aria-hidden` subtree reports every
  rule inapplicable, which reads exactly like a pass (`expect(result.passes.length)` guards it);
  a `toEqual([])` on a field the payload has no key for; a fixture whose values make the bug
  invisible. Delete a test you cannot make fail, or fix it -- it is worse than no test, because
  it reads as coverage.
- Mutation-test your own fix the same way, including the branch you think is obvious. One
  "clear the cache on failure" line turned out to be both unreachable and harmful.

## Do not copy deploy constants into config.py
`Settings` validators run on every instance, including a dev box with no class and no projector.
Adding daily-shift §3.1's projector pool and incident run to one refused every cap below 48
regardless of P and R, so `cap=10, P=1, R=1` stopped booting. Those constants belong in
`tests/test_deploy_config.py`, which re-derives P and R from `render.yaml`'s own cap.

## Secrets
Never read, print or commit `.env` files, keys or tokens.
