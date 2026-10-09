# V-Game frontend

React Router 8 (framework mode, `ssr: false`, `/` pre-rendered), Vite 8, React 19, TypeScript
strict, Tailwind 4 (semantic tokens only), three.js + react-three-fiber for the campus hub.
Architecture and budgets: [`docs/design/frontend-architecture.md`](../docs/design/frontend-architecture.md).

## Routes

| Path            | What                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `/`             | Landing page, pre-rendered at build time from the backend seed          |
| `/play`         | 3D campus hub (lazy scene chunk), HUD, librarian dialog, zone list      |
| `/play/:zoneId` | Zone page: levels from `GET /api/zones/:id`; locked / not found / error |

`/play?at=<library|watchtower|market>` puts the player at that building's door.
`/play?debug=frames` counts rendered frames in `<html data-frames>` and sets `<html data-scene-busy>`
while the scene still has something to move (used by e2e).

## Commands

```sh
npm run dev          # Vite dev server; /api is proxied to 127.0.0.1:8000
npm run check        # format:check + lint + typecheck + unit tests
npm run build        # build, bundle budget check, CSP headers
npm run preview      # serve the production build
npx playwright install chromium
npm run test:e2e     # Playwright on the production build, API mocked per test
E2E_PORT=4180 npm run test:e2e   # a second checkout or worktree needs its own port (default 4173)
```

E2E serves the build on port 4173 and reuses a server already there. Another checkout
running e2e at the same time would hand you its build: give each its own port, for example
`E2E_PORT=4398 npx playwright test --workers=1` (PowerShell: `$env:E2E_PORT=4398`).

Run the backend for `npm run dev`:
`cd ../backend && uv run uvicorn --factory vgame.main:create_app --reload --port 8000`.

## Rules worth knowing

- Theme packs are data in `public/themes/<id>/`; app code never names a brand.
- three.js lives only in the `/play` scene chunk; `npm run build` fails if the landing page
  would load it or if `/play` adds more than 300 kB gzip.
- No inline `style` attributes in pre-rendered HTML (CSP `style-src 'self'`).
- A non-default theme loads through an extra `<link id="vg-theme-css-saved">` appended to
  `<head>`; never rewrite the React-rendered theme link (hydration fails).
- Keep `@font-face` subsets ordered latin-ext, vietnamese, latin (the last declared wins), so
  the latin-ext file is never downloaded for Vietnamese text.
- Missing `/assets/*` and `/themes/*` files answer 404, not the SPA HTML (`_redirects`,
  `scripts/serve-build.mjs`).
