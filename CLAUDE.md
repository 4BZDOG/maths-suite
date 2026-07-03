# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run
```bash
bash build.sh                  # esbuild bundle + SRI stamp + cache-bust stamp
SKIP_SRI=1 bash build.sh       # offline build (skips SRI stamping — dev only)
npm run start                  # python3 -m http.server 8082
# open http://localhost:8082/puzzle-suite.html
npm test                       # node --test — generator correctness harness (test/*.mjs)
npm run lint                   # eslint (CI runs with --max-warnings 0)
```
After any JS change just rerun `bash build.sh` — it runs `tools/stamp-sri.mjs`
(computes Subresource Integrity hashes for every CDN tag and the jsPDF sentinel
in the bundle; needs network) and stamps a fresh content-hash into the
`<script src="bundle.js?v=…">` tag automatically. No manual bump needed.
`bundle.js` is **not committed** — build it locally after cloning.

> CI does **not** require a local build before pushing — GitHub Actions runs `bash build.sh` automatically on every push to `main`.

## Tech Stack
- **No framework** — vanilla JS ES modules, bundled by esbuild
- **jsPDF** — PDF generation
- **KaTeX** — Math rendering (HTML preview + PDF)
- **Font Awesome** — Icons
- **Google Fonts** — Inter, Roboto, Lora, Comic Neue (loaded lazily on PDF export)
- **localStorage key**: `puzzleSuiteV63` (migration chain V63→V62→V61 in `core/storage.js`)

## Repository Structure

```
maths-suite/
├── main.js                    # Entry point, orchestration, window API (~1470 lines)
├── puzzle-suite.html          # App shell, UI markup
├── puzzle-suite.css           # All styles, cascade layer architecture (~3950 lines / ~90 KB)
├── index.html                 # Redirect from / → puzzle-suite.html (GitHub Pages root)
├── bundle.js                  # esbuild output (gitignored — run build.sh to create)
├── build.sh                   # build: esbuild → SRI stamp → cache-bust stamp
├── package.json               # version 1.0.0, devDeps: esbuild, eslint, globals
│
├── tools/
│   └── stamp-sri.mjs          # Build step: stamps SRI hashes into HTML + bundle
│
├── core/
│   ├── state.js               # Single source of truth for all app state (~366 lines)
│   ├── storage.js             # localStorage persistence (debounced saveState)
│   ├── history.js             # Undo/redo (max 50 snapshots, Ctrl+Z/Y)
│   └── outcomes.js            # NESA Stage 4 & Stage 5 outcome codes & mappings (~401 lines)
│
├── renderers/                 # HTML preview generators (write directly to DOM)
│   ├── problemSet.js          # Maths question grid (difficulty bands, outcome chips)
│   ├── katexRender.js         # KaTeX math rendering on .katex-target elements
│   ├── htmlUtils.js           # esc() HTML escaping utility
│   ├── diagramSVG.js          # Inline SVG diagrams for geometry questions (12 shapes, ~646 lines)
│   └── keys.js                # Answer key page renderer
│
├── pdf/                       # PDF export pipeline
│   ├── pdfExport.js           # Orchestrator: creates doc, loops sets/pages (~1657 lines)
│   ├── pdfHelpers.js          # Shared drawing utilities, emoji canvas fallback (~413 lines)
│   ├── pdfFonts.js            # Lazy font loader from CDN (~94 lines)
│   └── pdfDrawFormulas.js     # Formula sheet page drawing (~270 lines)
│
├── ui/
│   ├── sidebar.js             # Resizable sidebar (300–650 px), tab switching
│   ├── darkMode.js            # Sets data-theme="dark" on body
│   ├── modal.js               # Generic modal overlay
│   ├── toast.js               # showToast(msg, type) — transient notifications
│   ├── zoom.js                # Preview zoom 0.5x–2x
│   ├── pageOrder.js           # Sortable page ordering via drag handles
│   ├── accessPanel.js         # Admin feature-flag override panel (modal)
│   └── dropZone.js            # Drag-and-drop .json config import
│
├── generators/
│   └── mathsQuestionGen.js    # Seeded PRNG (Mulberry32), 13 topics × 2–8 sub-ops (~8270 lines)
│
├── import-export/
│   └── exportConfig.js        # downloadConfig() — saves state as .json
│
├── payments/
│   ├── access.js              # hasFeature(), tier API, feature override management
│   ├── config.js              # TIER, FEATURE flags, TIER_FEATURES, GROUPS, FREE_LIMITS, STRIPE_CONFIG
│   ├── session.js             # Session/auth stub (get/set/clearSession)
│   └── stripe.js              # Client-side Stripe flow: initiateCheckout, handleCheckoutReturn, refreshSession
│
├── stripe-worker/             # Cloudflare Worker — server-side Stripe proxy (deployed via wrangler)
│   ├── index.js               # Routes: /api/checkout, /api/verify, /api/me, /api/portal, /api/webhooks
│   ├── wrangler.toml          # Worker name, APP_URL var, KV namespace bindings
│   ├── README.md              # Worker setup (KV, secrets, webhook registration)
│   └── package.json
│
├── test/                      # node --test correctness harness (60+ tests)
│   ├── _helpers.mjs           # Shared utilities (gen, evaluator, structural checks)
│   ├── generator.test.mjs     # Core Number topics + cross-topic invariants
│   ├── pdf-latex.test.mjs     # latexToText PDF text conversion
│   ├── state-import.test.mjs  # topicSlug + sanitizeImportedState (config imports)
│   └── topics/*.test.mjs      # Per-topic verifiers (algebra, statistics, geometry, focus areas, etc.)
│
└── .github/workflows/deploy.yml  # GitHub Actions: lint+test → build → deploy dist/ to Pages
```

## Architecture

### State management (`core/state.js`)
- `state` is the single source of truth
- `syncSettingsFromDOM()` — reads all DOM control values → `state.settings` (call before using state if debounce hasn't fired)
- `applyStateToDOM()` — restores saved state to DOM controls (called once at init)
- `saveState()` — debounced 500 ms → `saveStateNow()` → `syncSettingsFromDOM()` → localStorage
- **Pattern**: when an `oninput` handler needs the current value immediately, call `syncSettingsFromDOM()` first
- `topicSlug(t)` / `subOpDomId(t, key)` — the ONLY way to derive DOM ids from
  topic names (`topic-…`, `subop-…`, `subs-…`, `outcomes-for-…`). Never inline
  the regex; a divergent copy once broke undo for "Ratios & Rates".
- `sanitizeImportedState(parsed)` — key-allowlist + watermark-MIME validation
  for imported `.json` configs. Both import paths (file input + drop zone) MUST
  pass parsed JSON through it before `applyStateToDOM()`. Unit-tested in
  `test/state-import.test.mjs`.
- `FORMULA_GROUPS` — the formula-sheet group ids (used by both sync functions)

**Top-level state keys** (outside `settings`): `selectedTopics`, `selectedSubOps`,
`stage` (`'Stage 4'`/`'Stage 5'`), `includePath` (5.3 Path), `selectedOutcomes`
(outcome filter), `questionsPerSet` (pages per band, 1 or 2), `generatedSets`,
`activePage`, `currentZoom`, `watermarkSrc`.

**`state.settings` keys**: `theme`, `title`, `sub`, `font`, `globalFontScale`,
`scales` (`{easy,medium,hard,key}`), `titleScale`, `paperSize`, `cols`,
`showAnswerKey`, `showExportId`, `showTopic`, `showDiagrams`,
`psShowOutcomesHeader`, `psShowOutcomeChips`, `keyShowWorked`, `showFormulaSheet`,
`showFormulas` (per-group `{easy,medium,hard}` map), `opts`
(`{easy,medium,hard,key}` page enable), `pageOrder`, `wmOpacity`, `sidebarWidth`,
`exportCount`, `previewSeed`. When adding one, update both `syncSettingsFromDOM()`
and `applyStateToDOM()` (see "Adding a New Setting").

### DOM ↔ State sync
| Direction | Function | When |
|-----------|----------|------|
| DOM → state | `syncSettingsFromDOM()` | Before reading state in any immediate handler |
| State → DOM | `applyStateToDOM(saved)` | Once at init (restores saved session) |

### Window API (`main.js`)
All public functions are added to the `window._puzzleApp` object (~line 1404); a single `Object.assign(window, window._puzzleApp)` (~line 1471) right after it copies every entry onto `window.fnName` too, so HTML `onclick`/`oninput` handlers and programmatic access both work from one export point. When adding a new function, add it only to the `window._puzzleApp` object.

**Key exported functions:**
- `generateAll()` — Main generation trigger
- `toggleTopic()`, `toggleSubOp()` — Selection management
- `exportPDF()` — PDF download
- `showPage(n)`, `focusPage(n)` — Page navigation
- `undo()`, `redo()` — History management
- `toggleDarkMode()`, `adjustZoom(d)`, `switchTab(t)` — UI controls

### Initialization sequence (`main.js`, on `window.load`)
1. Handle Stripe checkout return (`handleCheckoutReturn()`) — consumes `?stripe_session=` before any state restore
2. Refresh session tier from worker (`refreshSession()`) — silently updates stored JWT
3. Load saved state from localStorage (`loadRawState()`)
4. Restore watermark images
5. Build sub-operation panels dynamically
6. Generate initial question sets (`generateAll()`)
7. Setup sidebar resize, drag-drop, keyboard shortcuts
8. Fade out loading overlay

### CSS Layer Architecture
Layers in order (higher = wins): `base` → `layout` → `components` → `pages` → `utils`

**Critical**: Dark mode overrides must be in `@layer components` or higher, NOT `@layer base`, or they lose to component rules.

CSS custom properties used throughout:
- `--global-font-scale` — set by `updateGlobalFontScale()`
- `--page-scale` — per-page var, resolved from `--scale-easy/medium/hard/key` (set by `updatePageScales()`)
- `--title-scale` — set by `updateTitleScale()`
- `--page-width` / `--page-height` — set by `updatePaperSize()`, drives `.page` dimensions
- `--user-font` — the selected font family string
- `--wm-opacity` — watermark opacity
- `--scale-easy/medium/hard/key` — per-page difficulty scales

### PDF Export (`pdf/pdfExport.js`)
1. Calls `syncSettingsFromDOM()` to capture any unsaved changes
2. Creates jsPDF doc with paper size from `cfg.paperSize`
3. Loads custom font (Inter/Roboto/Lora/Comic) via `pdfFonts.js` (lazy, CDN)
4. Builds a `ctx` context object via `buildCtx()` — carries doc, dimensions, scale, pdfFont, drawWatermark
5. Loops over sets (bulk export, clamped by `getBulkExportLimit()`), then page types in `cfg.pageOrder`
6. Each page: `drawHeader(ctx, title, sub, instruction, isKey, setIndicator, pScale)` → returns Y where content starts
7. Passes layout `{ x, y, w, h }` to each `drawXxx()` function

### Emoji in PDF
PDF fonts (helvetica + custom loaded fonts) don't support emoji. The canvas fallback in `pdf/pdfHelpers.js`:
- `hasEmoji(str)` — detects emoji via Unicode property escapes
- `textToImgPDF(text, opts)` — renders to HTML canvas (system emoji font), returns PNG dataURL + mm dimensions
- `drawText()` — unified draw helper that checks `hasEmoji()` for title/subtitle/instructions; routes to canvas or `doc.text()` accordingly
- `drawHeader()` uses `drawText()` for all three text elements (title, subtitle, instructions) so emoji render correctly

### Renderers (HTML preview)
The live renderers are `renderProblemSet` (`renderers/problemSet.js`) and
`renderKeys` (`renderers/keys.js`). `renderActivePage()` (main.js ~line 229)
calls `syncSettingsFromDOM()`, then renders all three difficulty bands
(`p1-area`/`p2-area`/`p3-area`) plus the answer key (`key-container`) in one pass
— it does **not** branch on `state.activePage`. Each `renderProblemSet()` call
returns the number of questions that fit; the key is then sliced to only those
visible questions (see "Answer key cap" pitfall).

### Geometry Diagrams (`renderers/diagramSVG.js`)
`renderDiagramSVG(diagram)` returns an inline SVG string for geometry questions.
Dispatch lives in the `switch` near the bottom of the file. Supported types:
- `rectangle`, `parallelogram`, `trapezium` — labelled dimensions, `?` for the missing measure
- `right-triangle` — Pythagoras layout with right-angle mark, missing side as `?`
- `right-triangle-trig` — labelled angle/side for trig ratios
- `triangle-angles` — two known angles, third as `?`
- `general-triangle` — non-right (scalene) triangle for the sine/cosine rule and
  ½·ab·sinC area; `{sides:{a,b,c}, angles:{A,B,C}, missing}` labels only the
  given parts (sides a/b/c opposite A/B/C), missing side shown as `?` (not to scale)
- `composite-prism` — two labelled oblique (cabinet-projection) cuboids for
  combined-volume questions; `{a:{l,w,h}, b:{l,w,h}}`, hidden edges dashed (not to scale)
- `triangle-area` — dashed height line and right-angle mark
- `circle` — radius line with missing area or circumference label
- `parabola` — non-linear plot; the viewing window **auto-frames the vertex**
  (vertex can be far from the origin) with gridlines + axes drawn where in view
- `number-plane` — two plotted points + segment for coordinate geometry
  (gradient / midpoint / distance); auto-frames the points at equal x/y scale
- `parallel-transversal`, `straight-line-angles`, `vertically-opposite` — angle configurations

Shape outlines use `#10b981` (emerald, `GC`); missing values use `#ef4444` (red,
`MC`). Labels use `currentColor` so they adapt to light/dark mode automatically.
The auto-framing graph diagrams (`parabola`, `number-plane`) share a `_niceStep`
tick helper (one copy in `diagramSVG.js`, one `_niceStepPDF` in `pdfExport.js`).

A dev-only gallery (`node tools/diagram-gallery.mjs` → gitignored
`tools/diagram-gallery.html`) renders every diagram type across light/dark
themes for visual QA.

### Question Generation (`generators/mathsQuestionGen.js`)
- **Seeded PRNG**: Mulberry32 — deterministic and reproducible
- **13 topics**: Integers, Decimals, Rounding, Fractions, Percentages, Ratios & Rates, Algebra, Geometry, Statistics, Probability, Financial Maths, Trigonometry, Non-linear Relationships
- **2–8 sub-operations per topic** defined in the exported `SUB_OPS` table; some are gated by `stages: ['Stage 5']` or `pathway: 'path'` (Stage 5.3)
- Each question: `{id, topic, difficulty, clue, answer, answerDisplay, notes, diagram?}`
- Difficulty controls working lines: Easy=0, Medium=1, Hard=2
- NESA-aligned language using `CALC_VERBS`/`MULT_VERBS`/`DIV_VERBS`/`BODMAS_VERBS`/`SOLVE_VERBS` constants
- Geometry questions may include a `diagram` object consumed by `renderDiagramSVG()`
- `ALL_SUBTOPICS` and `SUB_OPS` are re-exported through `core/state.js` so the
  topic list can never drift between the generator and state

### NESA Outcomes (`core/outcomes.js`)
- Stage-keyed structure (`DEFAULT_STAGE = 'Stage 4'`); holds both Stage 4
  (MA4-* , ~28 codes) and Stage 5 (MA5-*) outcomes so more stages can be added
  without touching existing data
- `getOutcomesForTopics()`, `getTopicsForOutcomeCodes()`, `getTopicsForStage()` — lookups
- `STRANDS` / `TOPIC_STRAND_MAP` group topics by syllabus strand
- The outcome filter in the sidebar reduces which topics/questions are generated;
  `state.includePath` toggles Stage 5.3 *Path* content

### Feature Flag System (`payments/config.js` + `payments/access.js`)
Features are gated by tier (`free`, `pro`, `admin`) and can be overridden per-session by an admin.

```js
// Check a feature anywhere in the app:
if (!hasFeature(FEATURE.BULK_EXPORT)) { showToast('Pro only', 'warning'); return; }
```

Key constants in `payments/config.js`:
- `TIER` — `{ FREE, PRO, ADMIN }`
- `FEATURE` — enum of all feature keys (e.g. `BULK_EXPORT`, `AI_GENERATION`, `TWO_PAGE_MODE`)
- `TIER_FEATURES` — maps each tier to a `Set` of enabled features
- `FREE_LIMITS` — `{ BULK_EXPORT_MAX: 50, MONTHLY_EXPORTS: 10 }`
- `GROUPS` — named feature bundles for the access panel (free, teacher_trial, school, pro, admin)

Key functions in `payments/access.js`:
- `hasFeature(key)` — checks overrides first, then tier defaults
- `getCurrentTier()` — returns current session tier string
- `setFeatureOverrides(map)` / `clearFeatureOverrides()` — admin override management
- `getEffectiveFeatureMap()` — full map with source (`'tier'` or `'override'`) per feature
- `getBulkExportLimit()` — returns the active bulk export ceiling for the current session

### Admin Access Panel (`ui/accessPanel.js`)
`openAccessPanel(onApply)` opens a modal letting an admin switch between group presets or toggle individual features. Changes are applied via `setFeatureOverrides()` and persist across reloads in the session. Functions exported to `window`:
- `openAccessPanel`, `closeAccessPanel`
- `applyGroupPreset(groupId)` — populates checkboxes from a named group
- `acpFeatureChange()` — syncs group-preset button highlights after a checkbox change
- `applyAccessOverrides()`, `resetAccessOverrides()`

**Entering admin mode:** `promptAdminKey()` (bound to **Ctrl/Cmd+Shift+A**, also on
`window`) prompts for `ADMIN_KEY` (`payments/config.js`) and, if correct, calls
`enableAdminMode()` to unlock every option for testing. A `?admin=<key>` URL
parameter does the same silently at load (`_checkAdminKeyParam()`). This is a
convenience gate for local testing, **not** a security boundary — all tier logic
is client-side. `setAdminMode(true/false)` from the console still works too.

### Stripe Payments (`payments/stripe.js` + `stripe-worker/`)
Architecture: Browser → Cloudflare Worker (`stripe-worker/`) → Stripe API. The browser never holds a Stripe secret key.

Key client functions in `payments/stripe.js`:
- `initiateCheckout(tier, interval)` — POSTs to `/api/checkout`, redirects to Stripe-hosted Checkout
- `handleCheckoutReturn()` — detects `?stripe_session=`, POSTs to `/api/verify`, stores JWT; call **before** restoring app state
- `refreshSession()` — GETs `/api/me` to re-validate stored JWT; no-op if unconfigured
- `openCustomerPortal()` — POSTs to `/api/portal`, redirects to Stripe billing portal
- `isStripeConfigured()` — returns `true` only when `STRIPE_CONFIG.workerUrl` and a price ID are set

`STRIPE_CONFIG` in `payments/config.js` holds `publishableKey`, `workerUrl`, and `prices.{proMonthly,proYearly}` — all empty by default. Fill before going live (see `STRIPE_INTEGRATION.md`).

To deploy the worker: `cd stripe-worker && npm install && wrangler deploy`, then set secrets via `wrangler secret put STRIPE_SECRET_KEY` etc.

### AI Question Generation — PLANNED (not yet implemented)
The legacy BYOK module from the vocabulary-puzzle product has been removed. AI
question generation remains on the roadmap (see `monetisation.md`); the
`FEATURE.AI_GENERATION` flag in `payments/config.js` is kept for it. When built,
design it fresh against the maths generator's question shape.

### CDN dependencies & SRI
All CDN resources (KaTeX, Font Awesome in `puzzle-suite.html`; jsPDF lazily in
`pdf/pdfFonts.js`) are version-pinned and carry Subresource Integrity hashes
stamped by `tools/stamp-sri.mjs` during `bash build.sh`. When bumping a CDN
version, just change the URL — the next build recomputes the hash. Google Fonts
CSS is UA-dependent and intentionally has no SRI. PDF TTFs from fontsource use
`@latest` deliberately (per-font versions break when pinned stale); a TTF
signature check in `pdfFonts.js` guards what gets registered.

## Common Pitfalls
- **Bundle caching**: `http.server` caches aggressively. `build.sh` stamps a fresh content-hash into `<script src="bundle.js?v=…">` automatically — no manual bump needed.
- **CSS layer priority**: Adding dark-mode overrides to `@layer base` won't work if same selector is in `@layer components`. Put overrides in `@layer components`.
- **`innerText` vs `textContent`**: `innerText` returns `""` for elements inside collapsed `<details>`. Use `textContent` or call `syncSettingsFromDOM()` which uses `.value` / `.checked` (not innerText).
- **`updatePageScales()` calls `renderActivePage()`**: it only re-renders the active page. After navigation, `showPage(n)` calls `renderActivePage()` automatically.
- **`saveState()` is debounced 500 ms**: for sliders that need to immediately read state (e.g., `updatePageScales()`), always call `syncSettingsFromDOM()` first.
- **Stale state on toggle changes**: `renderActivePage()` calls `syncSettingsFromDOM()` at the start so toggle/checkbox changes take effect immediately without waiting for the 500ms debounce.
- **Window export**: any new public function in `main.js` must be added to the `window._puzzleApp` object (~line 1404) — `Object.assign(window, window._puzzleApp)` right after it (~line 1471) propagates it to `window.fnName` automatically. No separate block to update.
- **Answer key cap**: answer key trims to only the cap-to-1-page visible questions. Do not pass the full question list to the key renderer.

## Adding a New Setting
1. Add default to `state.settings` in `core/state.js`
2. Add read in `syncSettingsFromDOM()`
3. Add restore in `applyStateToDOM()`
4. Add DOM control in `puzzle-suite.html`
5. Add update function in `main.js`; add it to the `window._puzzleApp` object (propagates to `window.fnName` automatically)
6. Call in init sequence in `main.js` (after `applyStateToDOM`)
7. If affects PDF, pass via `cfg` (which is `state.settings`) or add to `buildCtx()` return

## Adding a New PDF Page Type
The live page types are the three difficulty bands, the answer key, and the
optional formula sheet. To add another:
1. Add/extend a renderer in `renderers/` for the HTML preview
2. Add a drawer in `pdf/pdfDrawXxx.js` (see `pdfDrawFormulas.js` as the model)
3. Register it in the `pdfExport.js` page loop
4. Add it to the page-order list in `ui/pageOrder.js`
5. Add any instruction string (with emoji) in `pdfExport.js`

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys on every push to `main`:
1. lint + `node --test` → `bash build.sh` → stage `dist/` → deploy to GitHub Pages
2. **Only runtime files are published** (`puzzle-suite.html`, `index.html`,
   `puzzle-suite.css`, `bundle.js`, `.nojekyll`). Internal docs, source modules,
   tests, and `stripe-worker/` are deliberately NOT deployed — when adding a new
   runtime asset, add it to the "Stage deployable files" step in `deploy.yml`.
3. `index.html` redirects `/` → `puzzle-suite.html` for a clean entry URL

The Cloudflare Worker (`stripe-worker/`) is **not** deployed by GitHub Actions — deploy it manually with `wrangler`. See `stripe-worker/README.md` for the full setup (KV namespace, secrets, webhook registration).

## Roadmap / Known Tech Debt
Recommended follow-ups from the 2026-06 technical audit, not yet done:

- **PDF layout tests**: `drawQuestionPage()` (`pdf/pdfExport.js`, ~370 lines) is
  the largest untested function. Extract the per-set drawing loop so it can run
  DOM-free under Node jsPDF, then golden-test page counts for fixed seeds.
- **Decompose `drawQuestionPage()`** into header/measure/placement/meta-row
  helpers once the tests above exist.
- **Answer-recomputation gaps**: Rounding significant-figures, Fractions Hard
  multiply-divide, and Percentages increase-decrease are structure-tested only.
- **Undo/redo scope**: history snapshots only topics/sub-ops/questionsPerSet —
  outcome-filter and stage changes are not undoable (`core/history.js`).
- **Stripe pre-launch hardening** (before any live key is configured): bind
  `/api/checkout` userId to a server-issued identity instead of trusting client
  input (`stripe-worker/index.js` handleCheckout/handleVerify), and enforce
  `FREE_LIMITS.MONTHLY_EXPORTS` server-side. Webhook signature comparison is
  already constant-time.
