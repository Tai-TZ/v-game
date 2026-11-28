# Graphics Upgrade (B then A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the workbench machine and results page a crafted visual language (B), then polish the 3D campus maquette (A), without loosening any budget, accessibility or art-bible rule except the approved 40k triangle cap.

**Architecture:** Three PRs on three branches from `main`:
- PR 1 `feat/machine-ink`: ink weights, state marks, focus and fault in `MachineMap.tsx`, plus the shared motion tokens in `app.css`.
- PR 2 `feat/results-stamp`: Plex Mono, `Stamp`, stars, the answer-board seal, the results band and chip borders.
- PR 3 `feat/campus-polish`: chamfer, shadow penumbra, extra baked AO, plinth foot band and tree value jitter in `features/campus/scene/`.

**Tech Stack:** React 19, React Router 7, Tailwind v4 semantic tokens, SVG, three.js / react-three-fiber (baked vertex colours, `MeshBasicMaterial`), vitest + Testing Library + axe-core, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-28-graphics-upgrade-design.md` (approved 2026-11-28, 40k cap)

## Global Constraints

- Each PR adds no bloom, glow, gradient, glassmorphism or heavy shadow. It adds no `infinite` animation, no tone mapping or post-processing, and no `castShadow` or `receiveShadow` in `app/features/campus`.
- No inline `style` attribute in pre-rendered HTML (CSP `style-src 'self'`). `font-src 'self'`: fonts are self-hosted.
- Use semantic Tailwind tokens only (`app/app.css`). Vietnamese UI copy is sentence case.
- Machine drawing scale stays at 1 unit = 1 px (`e2e/workbench.spec.ts:1199`). The viewBox, tag positions and every existing `data-*` hook stay unchanged.
- Projector mode (`?chieu=1`): text in `Stamp` ≥ 24 px, no motion repeats, R1–R10 still pass (`e2e/projector.spec.ts`).
- Information is never carried by motion or colour alone. A dimmed outline keeps ≥ 3:1 contrast against its background (WCAG 1.4.11) in both themes.
- Reduced motion: the global rule at `app.css:164` stays. Every animated element must end in its correct final state when durations are 0.01 ms.
- Campus scene: draw calls stay at exactly 15/16/18/19 (`scene.test.ts:750-785`). The triangle cap becomes **40,000**. Top faces keep the manifest hex (existing ±1 tests). `check-bundle.mjs` passes, with `/play` ≤ 300,000 B gzip and the workbench ≤ 120,000 B.
- Every new test must fail when its feature is broken on purpose. Break it, run it, restore it (CLAUDE.md "Prove a test bites").
- Before each PR, from `frontend/`, run:
  - `npm ci` (deps changed on 2026-11-28) and `npx playwright install chromium`;
  - `npm run check`, `npm run build`, `E2E_PORT=<free port> npx playwright test --retries=0`;
  - from the repo root, `semgrep scan --config p/default --error --metrics=off --exclude-rule python.lang.compatibility.python37.python37-compatibility-importlib2`.
- Before opening each PR, take before and after screenshots at 375×812 and 1280×800 (PR 1–2: L1, W1, W1 results and W1 `?chieu=1` at 1280×720; PR 3: hub by day and by night, both themes).
- Commit message trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR body ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

## Review Focus

1. **Both themes.** Town (Be Vietnam Pro, teal and orange) and the campus theme (Montserrat) must both keep the 3:1 dimmed outline and their stamp tones. Pinned in Task 3 and Task 7, which loop over `THEMES`.
2. **Reduced motion plus a failed run.** The shake and the stamp must end visible and in place with no animation. Pinned in Task 4 and Task 7.
3. **See-through ("Nhìn xuyên") on a glass box.** The outline must not hide the toy's insides, and the glass fill opacity is unchanged. Pinned in Task 1.
4. **A beat pressed on a level with a branch (W1 tool branch).** The active column, the branch belt to it and the slip stay undimmed. Pinned in Task 3.
5. **Night and overcast presets.** The penumbra is absent when there are no shadows, and the plinth foot band and chamfer must not break the night window-lit counts. Pinned in Task 11 and Task 12.

---

## PR 1: `feat/machine-ink`

### Task 1: Ink weights and the toy silhouette

**Files:**
- Modify: `frontend/app/features/workbench/MachineMap.tsx`:
  - `Box` at :398-445;
  - the stroke literals listed in the spec §4.1 (:423, :744, :833, :860, :984, :1266-1344, :1519, :1570, :1620).
- Test: `frontend/app/features/workbench/MachineMap.test.tsx`, `frontend/e2e/workbench.spec.ts`

**Interfaces:**
- Produces: `export const INK = { outline: 2.4, edge: 1, fine: 1, mark: 2.5 } as const` in `MachineMap.tsx`.
- `Box` keeps its props and renders the three faces with `strokeWidth={INK.edge}`. It then renders one `<polygon data-outline fill="none">`: the hexagon silhouette of the box, with `strokeWidth={INK.outline}`, the same `stroke` class, and `strokeLinejoin="round"`.

- [ ] **Step 1: Write the failing unit test** `"draws each toy with a heavy silhouette over thin face edges"` in `MachineMap.test.tsx`. For every `[data-tile="on"]`:
  - exactly one `[data-outline]` with `stroke-width="2.4"` and `fill="none"`;
  - every other `polygon` in its box has `stroke-width="1"`;
  - with see-through on, the `[data-outline]` still has `fill="none"`, and `[data-glass]` polygons keep `[fill-opacity:0.28]`.
- [ ] **Step 2:** Run `npx vitest run app/features/workbench/MachineMap.test.tsx`. Expect FAIL (no `[data-outline]`).
- [ ] **Step 3:** Implement `INK`, the outline polygon in `Box`, and replace the listed literals with `INK.*`:
  - slab base and belts use `outline`;
  - dressings and callout leaders use `edge` or `fine`;
  - tick and cross use `mark`.

  The silhouette points are the six outer corners: `iso(x,y,t)`, `iso(x+w,y,t)`, `iso(x+w,y,z)`, `iso(x+w,y+d,z)`, `iso(x,y+d,z)`, `iso(x,y+d,t)`.
- [ ] **Step 4:** Run the unit test. Expect PASS.
- [ ] **Step 5: Add the e2e** `"draws toy outlines heavier than their face edges"` in `workbench.spec.ts`. On L1 and W1, for each `[data-tile="on"]`, the rendered `getComputedStyle(outline).strokeWidth` must be ≥ 2 × that of a face polygon.
- [ ] **Step 6:** Rebuild and run e2e, then mutate by setting the outline to `INK.edge`. Both tests must fail. Restore.
- [ ] **Step 7:** Commit: `feat(workbench): draw the machine with two ink weights`.

### Task 2: State marks

**Files:**
- Modify: `MachineMap.tsx`:
  - `TONE` :447-454;
  - the attached-toy render near :1144-1160 (where `data-tile-state` is set).
- Test: `MachineMap.test.tsx`

**Interfaces:**
- Consumes: `INK` (Task 1).
- Produces:
  - `const DASH: Partial<Record<BlockState, string>> = { error: "6 4", stale: "2 3" }`, applied as `strokeDasharray` on `[data-outline]` only;
  - `data-tile-mark="pass" | "fail"` on a badge `<g>` at the top-front corner. `pass` is a circle containing a tick; `fail` is a square containing a cross. Both use `INK.mark` and the `TONE` stroke class.

- [ ] **Step 1: Write the failing test** `"shows each toy's state by shape, not colour alone"`. Render with `states` set to `passed`, `error`, `stale`, `running` and `idle`. Assert:
  - `passed` → `[data-tile-mark="pass"]` containing a `circle`;
  - `error` → `[data-tile-mark="fail"]` containing a `rect`, and outline `stroke-dasharray="6 4"`;
  - `stale` → no mark, and dasharray `"2 3"`;
  - `running` and `idle` → no mark and no dasharray.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement `DASH` and the badge. The badge sits inside the toy's `<g>`, so it lifts with `lit`.
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5:** Mutate: drop the badge for `error`, then swap the dash patterns. The test must fail each time. Restore.
- [ ] **Step 6:** Commit: `feat(workbench): give every machine state a shape`.

### Task 3: Focus on the pressed step

**Files:**
- Modify: `MachineMap.tsx`:
  - the beat/`active` logic at :500 and :565-569;
  - the toy render near :1151;
  - belts at :818-870.
- Test: `MachineMap.test.tsx`, `frontend/e2e/workbench.spec.ts`

**Interfaces:**
- Produces:
  - `data-dimmed` on every toy `<g>` and belt segment that is not on the active beat's path, while a beat is set;
  - class `opacity-45 transition-opacity duration-150 motion-reduce:transition-none` on dimmed items;
  - no `data-dimmed` anywhere when no beat is pressed.
- The active path is: the active column's toy, the belt segment(s) into it (including a branch belt for a branch column), the slip and the bubble.

- [ ] **Step 1: Write the failing unit test** `"dims everything but the pressed step's part"`:
  - L1 with no beat: no `[data-dimmed]`.
  - L1, beat 3 pressed: the active toy lacks `data-dimmed` and every other `[data-tile]` has it.
  - W1, branch beat pressed: the branch toy and `[data-pipe-branch]` lack `data-dimmed`.
  - Pressing the beat again clears it.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement. Pick the lowest opacity in the 0.35–0.6 range that passes Step 5 in both themes, and record the value in a comment.
- [ ] **Step 4:** Run the unit test. Expect PASS.
- [ ] **Step 5: Add the e2e** `"keeps a dimmed toy's outline at 3:1 against the frame"`, looping over `THEMES` (read as in `projector.spec.ts:13`).
  - Press a beat.
  - For one dimmed toy, compute the effective outline colour: its computed `stroke` blended at the group's computed `opacity` over the frame's computed background.
  - Compute the WCAG contrast ratio and expect it ≥ 3.
  - Helper: a local `contrast(a, b)` in the spec file, using sRGB relative luminance.
- [ ] **Step 6:** Mutate: opacity 0.15. The e2e must fail. Restore.
- [ ] **Step 7:** Commit: `feat(workbench): dim the machine around the pressed step`.

### Task 4: Motion tokens, the fault shake and the broken belt

**Files:**
- Modify: `frontend/app/app.css` (`@theme` block :31-76).
- Modify: `MachineMap.tsx` (toy render, belts), `BenchView.tsx:244-246` (what it passes as `states`).
- Test: `MachineMap.test.tsx`, `frontend/e2e/workbench.spec.ts`

**Interfaces:**
- Produces (in `@theme`, used by Task 7 too):
  - `--ease-emph-out: cubic-bezier(0.05,0.7,0.1,1)`;
  - `--ease-emph-in: cubic-bezier(0.3,0,0.8,0.15)`;
  - `--animate-stamp: vg-stamp 180ms var(--ease-emph-out) both` (keyframes: scale 1.15→1, opacity 0→1);
  - `--animate-shake: vg-shake 150ms var(--ease-emph-in) 1` (keyframes: translateX 0, 2px, -2px, 0).
- In `MachineMap.tsx`:
  - `data-fault` on a toy whose state is `error`, or that holds `[data-gauge-stop]` for the followed case. Its `<g>` gets `motion-safe:animate-shake`.
  - Every belt segment downstream of a faulted toy gets `data-pipe-fault`, drawn dashed with `stroke-danger`, until `states` changes.

- [ ] **Step 1: Write the failing unit test** `"marks the faulted toy and the belt after it"`. Set an `error` state on L1's chunker. Expect:
  - `[data-fault]` on that tile only;
  - `[data-pipe-fault]` on every downstream segment and on none upstream;
  - after re-rendering with all states `idle`, neither attribute remains.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement the tokens and the attributes.
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5: Add the e2e** `"shakes a faulted toy once, and not with reduced motion"`, modelled on the `vg-flip` test at `workbench.spec.ts:915/957`. On W1's recorded run:
  - `animationName` of `[data-fault]` is `vg-shake` and `animationIterationCount` is `1`;
  - under `reducedMotion: "reduce"` it is `none`, and `[data-pipe-fault]` is still present.
- [ ] **Step 6:** Mutate: `infinite`, and drop the reduced-motion guard. Both checks must fail. Restore.
- [ ] **Step 7:** Commit: `feat(workbench): show a fault in the machine itself`.

### Task 5: Projector ink and PR 1

**Files:**
- Modify: `MachineMap.tsx` (`[data-outline]` class)
- Test: `frontend/e2e/projector.spec.ts`

**Interfaces:**
- `[data-outline]` gets class `chieu:[stroke-width:3]`. CSS overrides the presentation attribute, so no inline style is needed.

- [ ] **Step 1: Write the failing e2e** `"draws the machine's outlines at 3 on the projector (R2)"`. On W1 `?chieu=1` at 1280×720, the computed `strokeWidth` of a `[data-outline]` is `"3px"`. Without `chieu` it is `"2.4px"`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Add the class.
- [ ] **Step 4:** Run the full gates from Global Constraints. Expect all green.
- [ ] **Step 5:** Take the before and after screenshots and attach them to the PR.
- [ ] **Step 6:** Commit, push `feat/machine-ink`, and open PR 1. Its body is in Vietnamese, covering what changed, the screenshots and the gates.

---

## PR 2: `feat/results-stamp` (branch from `main` after PR 1 merges)

### Task 6: IBM Plex Mono, self-hosted

**Files:**
- Modify: `frontend/package.json` (dependency `@fontsource/ibm-plex-mono`), `frontend/app/app.css`
- Test: `frontend/e2e/a11y.spec.ts` or a new `frontend/e2e/type.spec.ts`

**Interfaces:**
- `app.css` imports `@fontsource/ibm-plex-mono/400.css` and `600.css`. Vite emits the woff2 files as hashed same-origin assets, so `font-src 'self'` holds.
- `@font-face { font-family: "Plex Mono Fallback"; src: local("Menlo"), local("Consolas"), local("DejaVu Sans Mono"); size-adjust: <measured>; ascent-override: <measured>; }`
- `@theme { --font-mono: "IBM Plex Mono", "Plex Mono Fallback", ui-monospace, monospace; }`

- [ ] **Step 1: Write the failing e2e** `"sets captions in Plex Mono with every Vietnamese mark"`. On W1, after `document.fonts.ready`:
  - `document.fonts.check('600 12px "IBM Plex Mono"', "Ắ Ặ Ừ Ở ỹ")` is `true`;
  - the computed `fontFamily` of `[data-beat-readout]` starts with `"IBM Plex Mono"`.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Run `npm i @fontsource/ibm-plex-mono`, then add the imports, the fallback face and the token. Measure `size-adjust` against Menlo at 16 px so the line widths of `[data-beat-readout]` match within 2%.
- [ ] **Step 4:** Run e2e. Expect PASS. Run `npm run build` and record the added font kB (spec: about 14–28 kB on first use).
- [ ] **Step 5:** Check that the build's CSP output still reports no external font origin: grep `build/client` for `fonts.googleapis`, expecting none.
- [ ] **Step 6:** Commit: `feat(type): set captions and callouts in IBM Plex Mono`.

### Task 7: `Stamp` and the stars

**Files:**
- Create: `frontend/app/components/ui/Stamp.tsx`, `frontend/app/components/ui/Stamp.test.tsx`
- Modify: `frontend/app/features/workbench/Results.tsx:231-268`
- Test: `frontend/app/features/workbench/watchtower.results.test.tsx`, `frontend/e2e/watchtower.spec.ts`, `frontend/e2e/projector.spec.ts`

**Interfaces:**
- Consumes: `--animate-stamp` (Task 4), `--font-mono` (Task 6).
- Produces: `export function Stamp({ tone, children, delay = 0 }: { tone: "pass" | "fail" | "muted"; children: ReactNode; delay?: 0 | 1 | 2 }): ReactElement`.
  - Renders `<span data-stamp={tone}>` with:
    - mono, uppercase, 600 weight;
    - a double border (`border-double border-4`) in the tone's colour;
    - tilt class `-rotate-3`;
    - `motion-safe:animate-stamp`;
    - an animation delay class from `delay`: `[animation-delay:0ms|60ms|120ms]`;
    - `chieu:text-2xl` (at least 24 px).
  - Tones: `pass` = `text-success border-success`, `fail` = `text-danger border-danger`, `muted` = `text-fg-muted border-line-strong`.
- Stars:
  - each `StarIcon` is `size-10 chieu:size-14`;
  - an earned star has `data-star="earned"`, `fill-accent stroke-accent motion-safe:animate-stamp` and a delay from its index;
  - an unearned star has `data-star="empty"`, `fill-none stroke-line-strong [stroke-dasharray:3_2]`;
  - the "n/3 sao" line moves up one size step (`text-xl` → `text-2xl`).
- The per-condition "Đạt"/"Chưa đạt" becomes `<Stamp tone={met ? "pass" : "muted"}>`. The copy is unchanged.

- [ ] **Step 1: Write the failing unit tests:**
  - `Stamp.test.tsx`: each tone sets `data-stamp`, the colour classes and `-rotate-3`; `delay={2}` gives the 120 ms class; axe structural rules pass (pattern from `toys.a11y.test.tsx`).
  - In `watchtower.results.test.tsx`: `"draws earned stars solid and stamped, the rest dashed"`. On the W1 starter run (0 stars) there are 3 `[data-star="empty"]`, each with a dasharray. On a 2-star fixture there are 2 `earned` and 1 `empty`, and each condition row holds one `[data-stamp]`.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement `Stamp` and the Results changes.
- [ ] **Step 4:** Run them. Expect PASS.
- [ ] **Step 5: Add the e2e checks:**
  - `watchtower.spec.ts`: an earned star's `animationName` is `vg-stamp`, or `none` under reduced motion, where its computed opacity is `1`.
  - `projector.spec.ts`: the font size of `[data-stamp]` is ≥ 24.
- [ ] **Step 6:** Mutate: unearned stars without dasharray, then `Stamp` without `chieu:text-2xl`. The tests must fail. Restore.
- [ ] **Step 7:** Commit: `feat(results): stamp the stars and every star condition`.

### Task 8: The answer board's seal

**Files:**
- Modify: `MachineMap.tsx:1836-1877` (the output toy's answer board)
- Test: `MachineMap.test.tsx`

**Interfaces:**
- Inside `[data-verdict]`, wrap the tick or cross in `<g data-board-seal transform="rotate(-3 cx cy)">` with two concentric `rect` frames (outer `INK.edge`, inner `INK.fine`, 2 units apart) in the verdict's stroke tone. There is **no text**.
- The board size, its position, `data-verdict` and the tick and cross geometry are unchanged.

- [ ] **Step 1: Write the failing test** `"seals the answer board like a stamp, without words"`: `[data-board-seal]` exists with exactly 2 `rect` children and a `rotate(-3` transform, and has no `text` descendant. The board's own `rect` width is unchanged at 30.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expect PASS. Run the 3.4 frame e2e (`workbench.spec.ts` "the machine's frame"). Expect PASS, since nothing moved.
- [ ] **Step 5:** Commit: `feat(workbench): seal the answer board`.

### Task 9: Results band, diagnosis rule and chip borders, and PR 2

**Files:**
- Modify: `Results.tsx` (results heading area near :225, diagnosis cards :339-399), `BenchView.tsx:370-396` (`STATE_LOOK`, `StateChip`)
- Test: `watchtower.results.test.tsx`, `frontend/app/features/workbench/BenchView.test.tsx` (or the existing chip test file)

**Interfaces:**
- The results band is a `<div data-results-band>` holding the stars block and the total-token line, with `rounded-md bg-subtle p-4`. It is the only `bg-subtle` block in `#wb-results`. It has **no buttons**, and `data-after-run-actions` stays where plan v0.7 3.2 put it.
- Each diagnosis card adds `border-l-[3px] border-l-brand`, and its heading uses `font-semibold`.
- `StateChip`: `error` adds `border-dashed`, `stale` adds `border-dotted`. Icons are unchanged.

- [ ] **Step 1: Write the failing tests:**
  - `"gives the results one band and keeps the re-run where it was"`: exactly one `[data-results-band]`; no `button` inside it; `[data-after-run-actions]` is still after the diagnosis in DOM order.
  - `"rules every diagnosis card in one tone"`: every card has `border-l-brand`.
  - `"draws an error chip dashed and a stale chip dotted"`.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expect PASS. Then run the full gates, take the screenshots, push `feat/results-stamp` and open PR 2.
- [ ] **Step 5:** Commit (before pushing): `feat(results): one band for the score, one rule for the diagnosis`.

---

## PR 3: `feat/campus-polish` (branch from `main` after PR 2 merges)

### Task 10: Chamfered boxes and the 40k cap

**Files:**
- Modify: `frontend/app/features/campus/scene/primitives.ts` (next to `box` at :30)
- Modify: the landmark and three zone builders in `frontend/app/features/campus/scene/campus.ts`: the main wall volumes, tower plinths and parapets of `landmark`, `library`, `watchtower` and `market`.
- Modify: `frontend/app/features/campus/scene/scene.test.ts:750-785` (cap 35,500 → 40,000)
- Test: `frontend/app/features/campus/scene/primitives.test.ts` (create if absent), `scene.test.ts`

**Interfaces:**
- Produces: `export function chamferBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c = 0.04): BufferGeometry`, non-indexed, 44 triangles:
  - the 4 top edges are bevelled at 45° with width `c`;
  - the 4 vertical corner edges are bevelled at 45°;
  - the bottom is unbevelled.

  It is a drop-in replacement for `box()` in `part()`.

- [ ] **Step 1: Write the failing tests:**
  - `"chamferBox has 44 triangles and the box's outer bounds"`.
  - `"a chamfer bakes between top and side"`: `part(chamferBox(...), style, dayLight)`. The luminance of a bevel vertex lies strictly between the top-face and +x side-face luminances. The top face is still exactly the manifest colour (±1 per channel).
  - In `scene.test.ts`: the cap is 40,000, and the existing draw-call pins are unchanged.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement `chamferBox`, then swap it in for the listed volumes only. Keep the current `n.y > 0.5` top/side rule. If a bevel gets the top colour, the baked `shade()` still darkens it at 45°; confirm the luminance test passes.
- [ ] **Step 4:** Run `npx vitest run app/features/campus`. Expect PASS. Record the new peak triangle count, which must be ≤ 40,000.
- [ ] **Step 5:** Mutate with `c = 0`. The bevel-luminance test must fail. Restore.
- [ ] **Step 6:** Commit: `feat(campus): chamfer the buildings' top and corner edges`.

### Task 11: Shadow penumbra

**Files:**
- Modify: `frontend/app/features/campus/scene/campus.ts` (`buildShadows` :801-826; hull and clip helpers :675, :692)
- Modify: `frontend/app/features/campus/scene/CampusScene.tsx:200-206` (only if the band needs its own stencil handling)
- Test: `scene.test.ts`

**Interfaces:**
- For each projected hull, `buildShadows` also emits an outward band whose width is `min(0.3, 0.12 * h)`, where `h` is the hull's tallest caster height.
- Vertex colours run from `pal.shadow` on the inner ring to white `(1,1,1)` on the outer ring. The band is clipped to the base like the core.
- It stays in the same draw call: either one geometry with a `color` attribute, with the material switched to `vertexColors`, or the band in the stencil pass. The builder picks, under the rule that overlaps never show a dark double seam.

- [ ] **Step 1: Write the failing tests:**
  - `"fades every sun shadow out from its edge"`: along each band, outer-ring vertices are white and inner-ring vertices equal `pal.shadow`; a taller caster gives a wider band, capped at 0.3.
  - `"draws no penumbra under overcast skies"`: the geometry is empty, as today.
  - `"two overlapping shadows darken once"`: rasterise two overlapping hulls with the existing stencil semantics, or assert the band sits in the stencil pass. The builder picks whichever test fits the chosen approach.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expect PASS. Check the draw-call pins (15/16/18/19) still pass.
- [ ] **Step 5:** Commit: `feat(campus): soften sun shadows away from their casters`.

### Task 12: Extra baked AO and the plinth foot band

**Files:**
- Modify: `primitives.ts` (`PartStyle`, `part()` at :195-232); the call sites in `campus.ts` for eaves, colonnade beams and inner corners; `buildTerrain` (`campus.ts:892+`, `STRATA`)
- Test: `scene.test.ts`

**Interfaces:**
- `PartStyle` gains `aoUnder?: number`, a world y. Side-face vertices at or below this y and within 0.25 u under it are multiplied by `0.87` (inside the spec's 0.85–0.9 range).
- `aoFoot` keeps today's `ao` behaviour (×0.82 at the foot).
- Top faces are never touched.
- The plinth foot band: the lowest stratum's side faces get a 1-triangle-tall band at y ∈ [−0.8, −0.74], multiplied by `0.8`.

- [ ] **Step 1: Write the failing tests:**
  - `"darkens wall just under an eave, never a top face"`: one vertex under the eave is ×0.87 (±0.01) and the top faces are unchanged.
  - `"sets the plinth on the table"`: the band vertices are darker than the stratum side above them.
  - `"keeps the night's lit windows"`: the existing window-lit count tests still pass at night.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expect PASS.
- [ ] **Step 5:** Mutate with a factor of 1. The first two tests must fail. Restore.
- [ ] **Step 6:** Commit: `feat(campus): bake shade under eaves and at the plinth's foot`.

### Task 13: Tree value jitter, bundle check and PR 3

**Files:**
- Modify: `campus.ts:114-152` (`TREE_INSTANCES` and `treeMatrix`), `CampusScene.tsx:361-376` (`instanceColor`)
- Test: `scene.test.ts`

**Interfaces:**
- `export const treeValue = (i: number): number`, deterministic, in [0.96, 1.04], from a fixed hash of `i` (no `Math.random`).
- Each tree instance colour is `base × treeValue(i)` on all three channels, combined with the existing in-shade tint (`treesInShade` :765).

- [ ] **Step 1: Write the failing tests** `"varies each tree's value by at most 4% and never its hue"`:
  - every value is in [0.96, 1.04];
  - not all values are equal;
  - `treeValue(7)` is stable across calls;
  - instance colour channel ratios equal the base's within 1e-6.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5:** Run `npm run build`. `check-bundle.mjs` must pass with `/play` ≤ 300,000 B. If it fails, move the static scene builders (`campus.ts` geometry code) behind a dynamic `import()` from `CampusScene.tsx`, so the `/play` closure measured by `check-bundle.mjs` stays under budget. Rebuild until it passes.
- [ ] **Step 6:** Run the full gates. Take the screenshots for the hub by day and by night, both themes, 375 and 1280.
- [ ] **Step 7:** Commit: `feat(campus): vary tree values`. Push `feat/campus-polish` and open PR 3.
