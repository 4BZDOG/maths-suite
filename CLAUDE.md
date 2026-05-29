# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run
```bash
bash build.sh                  # esbuild bundles main.js → bundle.js
npm run start                  # python3 -m http.server 8082
# open http://localhost:8082/puzzle-suite.html
npm test                       # node --test — generator correctness harness (test/*.mjs)
```
After any JS change: rebuild, then bump `?v=N` in `<script src="bundle.js?v=N">` (puzzle-suite.html line ~525) to bypass browser cache.

> CI does **not** require a local build before pushing — GitHub Actions runs `bash build.sh` automatically on every push to `main`.

## Tech Stack
- **No framework** — vanilla JS ES modules, bundled by esbuild
- **jsPDF** — PDF generation
- **KaTeX** — Math rendering (HTML preview + PDF)
- **Font Awesome** — Icons
- **Google Fonts** — Inter, Roboto, Lora, Comic Neue (loaded lazily on PDF export)
- **localStorage key**: `puzzleSuiteV63` (migration chain V63→V62→V61 in `core/storage.js`)

## Repository Structure

> ⚠️ **Legacy files** marked `[dead]` below are leftovers from the app's
> earlier vocabulary-puzzle incarnation. They are **not imported** by any live
> entry point (`main.js`, `pdf/pdfExport.js`) and are tree-shaken out of the
> bundle. They are slated for removal (see "Roadmap" at the end). Do not extend
> them.

```
maths-suite/
├── main.js                    # Entry point, orchestration, window API (~1376 lines)
├── puzzle-suite.html          # App shell, UI markup (~527 lines)
├── puzzle-suite.css           # All styles, cascade layer architecture (~3950 lines / ~90 KB)
├── index.html                 # Redirect from / → puzzle-suite.html (GitHub Pages root)
├── bundle.js                  # esbuild output (do not edit)
├── build.sh                   # esbuild build script
├── package.json               # version 60.3.0, devDep: esbuild
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
│   ├── keys.js                # Answer key page renderer
│   ├── notes.js               # [dead] Vocabulary notes/matching table
│   ├── wordSearch.js          # [dead] Word search grid + word bank
│   ├── crossword.js           # [dead] ACROSS/DOWN clue layout
│   ├── scramble.js            # [dead] Scrambled letters
│   └── wordList.js            # [dead] Sidebar word list with placement dots
│
├── pdf/                       # PDF export pipeline
│   ├── pdfExport.js           # Orchestrator: creates doc, loops sets/pages (~1657 lines)
│   ├── pdfHelpers.js          # Shared drawing utilities, emoji canvas fallback (~413 lines)
│   ├── pdfFonts.js            # Lazy font loader from CDN (~94 lines)
│   ├── pdfDrawFormulas.js     # Formula sheet page drawing (~270 lines) — LIVE
│   ├── pdfDrawNotes.js        # [dead] Notes/matching page drawing
│   ├── pdfDrawWordSearch.js   # [dead] Word search page drawing
│   ├── pdfDrawCrossword.js    # [dead] Crossword page drawing
│   └── pdfDrawScramble.js     # [dead] Scramble page drawing
│
├── ui/
│   ├── sidebar.js             # Resizable sidebar (300–650 px), tab switching
│   ├── darkMode.js            # Sets data-theme="dark" on body
│   ├── modal.js               # Generic modal overlay
│   ├── toast.js               # showToast(msg, type) — transient notifications
│   ├── zoom.js                # Preview zoom 0.5x–2x
│   ├── pageOrder.js           # Sortable page ordering via drag handles
│   ├── accessPanel.js         # Admin feature-flag override panel (modal)
│   └── dropZone.js            # Drag-and-drop .json/.csv/.txt config import
│
├── generators/
│   └── mathsQuestionGen.js    # Seeded PRNG (Mulberry32), 13 topics × 2–8 sub-ops (~2691 lines)
│
├── import-export/
│   ├── exportConfig.js        # downloadConfig() — saves state as .json
│   └── importWords.js         # [dead] CSV/JSON word list import via modal
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
├── ai/
│   └── aiGenerate.js          # [dead] BYOK AI word generation (Gemini, Groq, OpenAI, Anthropic, OpenRouter)
│
├── workers/
│   ├── workerBridge.js        # [dead] Web Worker interface
│   └── generation.worker.js   # [dead] Background generation worker
│
└── .github/workflows/deploy.yml  # GitHub Actions → GitHub Pages (triggers on push to main)
```

## Architecture

### State management (`core/state.js`)
- `state` is the single source of truth
- `syncSettingsFromDOM()` — reads all DOM control values → `state.settings` (call before using state if debounce hasn't fired)
- `applyStateToDOM()` — restores saved state to DOM controls (called once at init)
- `saveState()` — debounced 500 ms → `saveStateNow()` → `syncSettingsFromDOM()` → localStorage
- **Pattern**: when an `oninput` handler needs the current value immediately, call `syncSettingsFromDOM()` first

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
All functions exposed both as `window.fnName` (for HTML `onclick`/`oninput`) and on `window._puzzleApp` (~line 1214). When adding a new function, add it to BOTH export blocks.

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

> The `renderers/{notes,wordSearch,crossword,scramble,wordList}.js` files are
> dead (legacy puzzle product) — not imported anywhere. Ignore them.

### Geometry Diagrams (`renderers/diagramSVG.js`)
`renderDiagramSVG(diagram)` returns an inline SVG string for geometry questions.
Dispatch lives in the `switch` near the bottom of the file. Supported types:
- `rectangle`, `parallelogram`, `trapezium` — labelled dimensions, `?` for the missing measure
- `right-triangle` — Pythagoras layout with right-angle mark, missing side as `?`
- `right-triangle-trig` — labelled angle/side for trig ratios
- `triangle-angles` — two known angles, third as `?`
- `triangle-area` — dashed height line and right-angle mark
- `circle` — radius line with missing area or circumference label
- `parabola` — non-linear relationships plot
- `parallel-transversal`, `straight-line-angles`, `vertically-opposite` — angle configurations

Shape outlines use `#10b981` (emerald, `GC`); missing values use `#ef4444` (red,
`MC`). Labels use `currentColor` so they adapt to light/dark mode automatically.

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

### AI Word Generation (`ai/aiGenerate.js`) — DEAD CODE
This BYOK module (Gemini/Groq/OpenAI/Anthropic/OpenRouter) is a leftover from the
vocabulary-puzzle product. It is **not imported** by any live entry point and is
slated for removal. Do not extend it; if AI question generation is wanted, design
it fresh against the maths generator.

## Common Pitfalls
- **Bundle caching**: `http.server` caches aggressively. Always bump `?v=N` after `build.sh`.
- **CSS layer priority**: Adding dark-mode overrides to `@layer base` won't work if same selector is in `@layer components`. Put overrides in `@layer components`.
- **`innerText` vs `textContent`**: `innerText` returns `""` for elements inside collapsed `<details>`. Use `textContent` or call `syncSettingsFromDOM()` which uses `.value` / `.checked` (not innerText).
- **`updatePageScales()` calls `renderActivePage()`**: it only re-renders the active page. After navigation, `showPage(n)` calls `renderActivePage()` automatically.
- **`saveState()` is debounced 500 ms**: for sliders that need to immediately read state (e.g., `updatePageScales()`), always call `syncSettingsFromDOM()` first.
- **Stale state on toggle changes**: `renderActivePage()` calls `syncSettingsFromDOM()` at the start so toggle/checkbox changes take effect immediately without waiting for the 500ms debounce.
- **Both window export blocks**: any new function in `main.js` must be added to BOTH the `window.fnName` block and the `window._puzzleApp` object (~line 1214).
- **Answer key cap**: answer key trims to only the cap-to-1-page visible questions. Do not pass the full question list to the key renderer.

## Adding a New Setting
1. Add default to `state.settings` in `core/state.js`
2. Add read in `syncSettingsFromDOM()`
3. Add restore in `applyStateToDOM()`
4. Add DOM control in `puzzle-suite.html`
5. Add update function in `main.js`; export on both `window` and `window._puzzleApp`
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
1. `npm ci` → `bash build.sh` → upload artifact → deploy to GitHub Pages
2. Approx. 90s end-to-end
3. `index.html` at the repo root redirects `/` → `puzzle-suite.html` for a clean entry URL

The Cloudflare Worker (`stripe-worker/`) is **not** deployed by GitHub Actions — deploy it manually with `wrangler`. See `stripe-worker/README.md` for the full setup (KV namespace, secrets, webhook registration).

## Roadmap / Known Tech Debt
These are recommended follow-ups, not yet done. See
`/root/.claude/plans/review-this-project-and-streamed-donut.md` for the full review.

- **Remove dead vocabulary-puzzle code** (all files marked `[dead]` above:
  5 renderers, 4 `pdfDraw*` drawers, `import-export/importWords.js`,
  `workers/*`, `ai/aiGenerate.js`). They are tree-shaken out of the bundle but
  mislead readers. ~1500+ lines.
- **Generator correctness tests** (~36 tests, `npm test`): structural sweep across
  all 13 topics; deep arithmetic checks for the core Number topics; per-topic
  verifiers in `test/topics/*.test.mjs` for Algebra (solve + substitution),
  Statistics (mean/median/mode/range/IQR/missing-value), Geometry (areas /
  perimeters / Pythagoras / angle sums / parallel-line angles), Financial Maths
  (SI / GST / markup / discount / compound), Ratios & Rates (simplify / speed
  triangle / equivalent), Probability (theoretical / complementary),
  Trigonometry (find-angle / applications), and Non-linear (identify-graph /
  parabola features). Plus `worked`-field consistency, missing-number equation
  solver, fraction↔percentage conversion checks, sub-op-filter leak guard, and
  a per-topic distinct-shape variety floor.
- **CI quality gate**: add ESLint + `node --test` as a job in `deploy.yml`
  before the deploy job.
- **Automate cache-busting**: have `build.sh` stamp `?v=<hash>` into
  `puzzle-suite.html` rather than the manual `?v=N` bump.
- **`package.json` version** (60.3.0) is decoupled from the bundle cache-bust
  (`?v=162`) and the product name; consider realigning.
