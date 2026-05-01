# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run
```bash
bash build.sh                  # esbuild bundles main.js → bundle.js
python3 -m http.server 8082    # serve at http://localhost:8082/puzzle-suite.html
```
After any JS change: rebuild, then bump `?v=N` in `<script src="bundle.js?v=N">` (puzzle-suite.html line ~461) to bypass browser cache.

> CI does **not** require a local build before pushing — GitHub Actions runs `bash build.sh` automatically on every push to `main`.

## Tech Stack
- **No framework** — vanilla JS ES modules, bundled by esbuild
- **jsPDF** — PDF generation
- **KaTeX** — Math rendering (HTML preview + PDF)
- **Font Awesome** — Icons
- **Google Fonts** — Inter, Roboto, Lora, Comic Neue (loaded lazily on PDF export)
- **localStorage key**: `puzzleSuiteV62` (v61→v62 migration in `core/storage.js`)

## Repository Structure

```
maths-suite/
├── main.js                    # Entry point, orchestration, window API (~945 lines)
├── puzzle-suite.html          # App shell, UI markup (~561 lines)
├── puzzle-suite.css           # All styles, cascade layer architecture (~60 KB)
├── index.html                 # Redirect from / → puzzle-suite.html (GitHub Pages root)
├── bundle.js                  # esbuild output (do not edit)
├── build.sh                   # esbuild build script
├── package.json               # version 60.3.0, devDep: esbuild
│
├── core/
│   ├── state.js               # Single source of truth for all app state
│   ├── storage.js             # localStorage persistence (debounced saveState)
│   ├── history.js             # Undo/redo (max 50 snapshots, Ctrl+Z/Y)
│   └── outcomes.js            # NESA syllabus outcome codes & mappings
│
├── renderers/                 # HTML preview generators (write directly to DOM)
│   ├── problemSet.js          # Maths question grid (difficulty bands, outcome chips)
│   ├── katexRender.js         # KaTeX math rendering on .katex-target elements
│   ├── htmlUtils.js           # esc() HTML escaping utility
│   ├── diagramSVG.js          # Inline SVG diagrams for geometry questions (5 shapes)
│   ├── notes.js               # Vocabulary notes/matching table
│   ├── wordSearch.js          # Word search grid + word bank
│   ├── crossword.js           # ACROSS/DOWN clue layout, auto-scales to fit page
│   ├── scramble.js            # Scrambled letters with optional first-letter hint
│   ├── wordList.js            # Sidebar word list with color-coded placement dots
│   └── keys.js                # Answer key page (4 mini-grids)
│
├── pdf/                       # PDF export pipeline
│   ├── pdfExport.js           # Orchestrator: creates doc, loops sets/pages (~918 lines)
│   ├── pdfHelpers.js          # Shared drawing utilities, emoji canvas fallback (~392 lines)
│   ├── pdfFonts.js            # Lazy font loader from CDN (~94 lines)
│   ├── pdfDrawProblemSet.js   # Problem set page drawing (~186 lines)
│   ├── pdfDrawNotes.js        # Notes/matching page drawing (~189 lines)
│   ├── pdfDrawWordSearch.js   # Word search page drawing (~108 lines)
│   ├── pdfDrawCrossword.js    # Crossword page drawing (~120 lines)
│   └── pdfDrawScramble.js     # Scramble page drawing (~94 lines)
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
│   └── mathsQuestionGen.js    # Seeded PRNG (Mulberry32), 9 topics × 3–5 ops (~1013 lines)
│
├── import-export/
│   ├── exportConfig.js        # downloadConfig() — saves state as .json
│   └── importWords.js         # CSV/JSON word list import via modal
│
├── payments/
│   ├── access.js              # hasFeature(), tier API, feature override management
│   ├── config.js              # TIER, FEATURE flags, TIER_FEATURES, GROUPS, FREE_LIMITS
│   └── session.js             # Session/auth stub (get/set/clearSession)
│
├── ai/
│   └── aiGenerate.js          # BYOK AI word generation (Gemini, Groq, OpenAI, Anthropic, OpenRouter)
│
├── workers/
│   ├── workerBridge.js        # Web Worker interface
│   └── generation.worker.js   # Background generation worker
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

### DOM ↔ State sync
| Direction | Function | When |
|-----------|----------|------|
| DOM → state | `syncSettingsFromDOM()` | Before reading state in any immediate handler |
| State → DOM | `applyStateToDOM(saved)` | Once at init (restores saved session) |

### Window API (`main.js`)
All functions exposed both as `window.fnName` (for HTML `onclick`/`oninput`) and on `window._puzzleApp` (~line 812). When adding a new function, add it to BOTH export blocks.

**Key exported functions:**
- `generateAll()` — Main generation trigger
- `toggleTopic()`, `toggleSubOp()` — Selection management
- `exportPDF()` — PDF download
- `showPage(n)`, `focusPage(n)` — Page navigation
- `undo()`, `redo()` — History management
- `toggleDarkMode()`, `adjustZoom(d)`, `switchTab(t)` — UI controls

### Initialization sequence (`main.js`, on `window.load`)
1. Load saved state from localStorage (`loadRawState()`)
2. Restore watermark images
3. Build sub-operation panels dynamically
4. Generate initial question sets (`generateAll()`)
5. Setup sidebar resize, drag-drop, keyboard shortcuts
6. Fade out loading overlay

### CSS Layer Architecture
Layers in order (higher = wins): `base` → `layout` → `components` → `pages` → `utils`

**Critical**: Dark mode overrides must be in `@layer components` or higher, NOT `@layer base`, or they lose to component rules.

CSS custom properties used throughout:
- `--global-font-scale` — set by `updateGlobalFontScale()`
- `--page-scale` — per-page var, resolved from `--scale-notes/ws/cw/scr/key`
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
- Instruction strings in `pdfExport.js` include emoji prefixes (`📋` Notes, `🃏` Matching, `🔍` Word Search, `✏️` Crossword, `🔀` Scramble)
- `drawHeader()` uses `drawText()` for all three text elements (title, subtitle, instructions) so emoji render correctly

### Renderers (HTML preview)
`renderNotes / renderWordSearch / renderCrossword / renderScramble` write to DOM containers directly. They are called by `renderActivePage()` (main.js) which routes to the correct renderer based on `state.activePage`.

The crossword renderer auto-scales clues to fit one page via `_autoScaleCluesToFit()` after DOM insertion.

### Geometry Diagrams (`renderers/diagramSVG.js`)
`renderDiagramSVG(diagram)` returns an inline SVG string for geometry questions. Supported diagram types:
- `rectangle` — labelled length/width, `?` for missing area/perimeter
- `right-triangle` — Pythagoras layout with right-angle mark, missing side shown as `?`
- `triangle-angles` — scalene triangle with two known angles, third as `?`
- `triangle-area` — triangle with dashed height line and right-angle mark
- `circle` — radius line with missing area or circumference label

Shape outlines use `#10b981` (emerald); missing values use `#ef4444` (red). Labels use `currentColor` so they adapt to light/dark mode automatically.

### Question Generation (`generators/mathsQuestionGen.js`)
- **Seeded PRNG**: Mulberry32 — deterministic and reproducible
- **9 topics**: Integers, Decimals, Rounding, Fractions, Percentages, Algebra, Geometry, Statistics, Financial Maths
- **3–5 operations per topic** (add, subtract, multiply, divide, BODMAS, simplify, etc.)
- Each question: `{id, topic, difficulty, clue, answer, answerDisplay, notes, diagram?}`
- Difficulty controls working lines: Easy=0, Medium=1, Hard=2
- NESA-aligned language using `CALC_VERBS` constant and keyword variety
- Geometry questions may include a `diagram` object consumed by `renderDiagramSVG()`

### NESA Outcomes (`core/outcomes.js`)
- `STAGE_OUTCOMES` — 16 outcome codes for Stage 4 (Year 7–8): MA4-INT-C-01, MA4-FRC-C-01, etc.
- `getOutcomesForTopics()`, `getTopicsForOutcomeCodes()` — bidirectional lookup
- Outcome filter in sidebar reduces which topics/questions are shown

### Word List Status Coloring
`renderWordList()` and `renderStatus()` accept an `activePage` parameter:
- **Page 2 (Word Search)**: status dots reflect WS placement only
- **Page 3 (Crossword)**: status dots reflect CW placement only
- **Page 4 (Scramble)**: status dots reflect SCR placement (all words always included)
- **Pages 1 & 5 (Notes & Key)**: status dots reflect overall placement (WS or CW)
- When switching pages, `showPage(n)` calls `_renderWordListAndStatus()` to update dots immediately

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

### AI Word Generation (`ai/aiGenerate.js`)
- BYOK (bring your own key): user supplies API key for Gemini, Groq, OpenAI, Anthropic, or OpenRouter
- Planned: managed proxy via Cloudflare Worker for Pro tier (no key required)
- Generates term/definition pairs for vocabulary puzzles

## Common Pitfalls
- **Bundle caching**: `http.server` caches aggressively. Always bump `?v=N` after `build.sh`.
- **CSS layer priority**: Adding dark-mode overrides to `@layer base` won't work if same selector is in `@layer components`. Put overrides in `@layer components`.
- **`innerText` vs `textContent`**: `innerText` returns `""` for elements inside collapsed `<details>`. Use `textContent` or call `syncSettingsFromDOM()` which uses `.value` / `.checked` (not innerText).
- **`updatePageScales()` calls `renderActivePage()`**: it only re-renders the active page. After navigation, `showPage(n)` calls `renderActivePage()` automatically.
- **`saveState()` is debounced 500 ms**: for sliders that need to immediately read state (e.g., `updateNotesStyles()`), always call `syncSettingsFromDOM()` first.
- **Stale state on toggle changes**: `renderActivePage()` calls `syncSettingsFromDOM()` at the start so toggle/checkbox changes take effect immediately without waiting for the 500ms debounce.
- **Both window export blocks**: any new function in `main.js` must be added to BOTH the `window.fnName` block and the `window._puzzleApp` object (~line 812).
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
1. Add renderer in `renderers/` (HTML preview)
2. Add drawer in `pdf/pdfDrawXxx.js`
3. Register in `pdfExport.js` page loop
4. Add to page order list in `ui/pageOrder.js`
5. Add instruction string (with emoji) in `pdfExport.js`

## Deployment
GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys on every push to `main`:
1. `npm ci` → `bash build.sh` → upload artifact → deploy to GitHub Pages
2. Approx. 90s end-to-end
3. `index.html` at the repo root redirects `/` → `puzzle-suite.html` for a clean entry URL
