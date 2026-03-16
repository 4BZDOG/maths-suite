# CLAUDE.md — Developer Notes for Claude

## Build & Run
```bash
bash build.sh                  # esbuild bundles main.js → bundle.js
python3 -m http.server 8082    # serve at http://localhost:8082/puzzle-suite.html
```
After any JS change: rebuild, then bump `?v=N` in `<script src="bundle.js?v=N">` (puzzle-suite.html line ~461) to bypass browser cache.

## Architecture

### State management (`core/state.js`)
- `state` is the single source of truth
- `syncSettingsFromDOM()` — reads all DOM control values → `state.settings` (call before using state if debounce hasn't fired)
- `applyStateToDOM()` — restores saved state to DOM controls (called once at init)
- `saveState()` — debounced 500 ms → `saveStateNow()` → `syncSettingsFromDOM()` → localStorage
- **Pattern**: when an `oninput` handler needs the current value immediately, call `syncSettingsFromDOM()` first

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

### DOM ↔ State sync
| Direction | Function | When |
|-----------|----------|------|
| DOM → state | `syncSettingsFromDOM()` | Before reading state in any immediate handler |
| State → DOM | `applyStateToDOM(saved)` | Once at init (restores saved session) |

### Window API (`main.js`)
All functions exposed both as `window.fnName` (for HTML `onclick`/`oninput`) and on `window._puzzleApp` (for programmatic use). When adding a new function, add it to BOTH export blocks (~lines 343 and 392 in main.js).

### PDF Export (`pdf/pdfExport.js`)
1. Creates jsPDF doc with paper size from `cfg.paperSize`
2. Loads custom font (Inter/Roboto/Lora/Comic) via `pdfFonts.js`
3. Builds a `ctx` context object via `buildCtx()` — carries doc, dimensions, scale, pdfFont, drawWatermark
4. Loops over sets (bulk export), then page types in `cfg.pageOrder`
5. Each page: `drawHeader(ctx, title, sub, instruction, isKey, setIndicator, pScale)` → returns Y where content starts
6. Passes layout `{ x, y, w, h }` to each `drawXxx()` function

### Emoji in PDF
PDF fonts (helvetica + custom loaded fonts) don't support emoji. The canvas fallback in `pdf/pdfHelpers.js`:
- `hasEmoji(str)` — detects emoji via Unicode property escapes
- `textToImgPDF(text, opts)` — renders to HTML canvas (system emoji font), returns PNG dataURL + mm dimensions
- `drawText()` — unified draw helper that checks `hasEmoji()` for title/subtitle/instructions; routes to canvas or `doc.text()` accordingly
- Instruction strings in `pdfExport.js` now include emoji prefixes (`📋` Notes, `🃏` Matching, `🔍` Word Search, `✏️` Crossword, `🔀` Scramble)
- `drawHeader()` uses `drawText()` for all three text elements (title, subtitle, instructions) so emoji render correctly

### Renderers (HTML preview)
`renderNotes / renderWordSearch / renderCrossword / renderScramble` write to DOM containers directly. They are called by `renderActivePage()` (main.js) which routes to the correct renderer based on `state.activePage`.

The crossword renderer auto-scales clues to fit one page via `_autoScaleCluesToFit()` after DOM insertion.

### Word List Status Coloring
`renderWordList()` and `renderStatus()` now accept an `activePage` parameter:
- **Page 2 (Word Search)**: status dots reflect WS placement only
- **Page 3 (Crossword)**: status dots reflect CW placement only
- **Page 4 (Scramble)**: status dots reflect SCR placement (all words always included)
- **Pages 1 & 5 (Notes & Key)**: status dots reflect overall placement (WS or CW)
- When switching pages, `showPage(n)` calls `_renderWordListAndStatus()` to update dots immediately

### Common Pitfalls
- **Bundle caching**: `http.server` caches aggressively. Always bump `?v=N` after `build.sh`.
- **CSS layer priority**: Adding dark-mode overrides to `@layer base` won't work if same selector is in `@layer components`. Put overrides in `@layer components`.
- **`innerText` vs `textContent`**: `innerText` returns `""` for elements inside collapsed `<details>`. Use `textContent` or call `syncSettingsFromDOM()` which uses `.value` / `.checked` (not innerText).
- **`updatePageScales()` calls `renderActivePage()`**: it only re-renders the active page. After navigation, `showPage(n)` calls `renderActivePage()` automatically.
- **`saveState()` is debounced 500 ms**: for sliders that need to immediately read state (e.g., `updateNotesStyles()`), always call `syncSettingsFromDOM()` first.
- **Stale state on toggle changes**: `renderActivePage()` calls `syncSettingsFromDOM()` at the start so toggle/checkbox changes take effect immediately without waiting for the 500ms debounce. This ensures "Show Word Bank" and similar toggles update the preview instantly.

## Adding a New Setting
1. Add default to `state.settings` in `core/state.js`
2. Add read in `syncSettingsFromDOM()`
3. Add restore in `applyStateToDOM()`
4. Add DOM control in `puzzle-suite.html`
5. Add update function in `main.js`; export on both `window` and `window._puzzleApp`
6. Call in init sequence in `main.js` (after `applyStateToDOM`)
7. If affects PDF, pass via `cfg` (which is `state.settings`) or add to `buildCtx()` return

## Recent Fixes & Improvements (Latest Session)

### 1. Word List Button Spacing (v5)
Fixed the word list reorder buttons being spaced too far from the word input. Changed the up/down button container from `flex:1` (taking up equal space as word column, ~73px) to `flex-shrink:0` (~24px natural width). The arrows now sit immediately next to each word for better visual compactness.

### 2. Emoji in PDF Instructions (v5)
PDF instruction text now displays emoji correctly:
- Instruction strings in `pdfExport.js` now include emoji prefixes matching the HTML preview (📋, 🃏, 🔍, ✏️, 🔀)
- `drawHeader()` in `pdfHelpers.js` now uses `drawText()` for instructions (was using `doc.text()` which drops emoji)
- `drawText()` routes emoji through canvas-based rendering for proper display in PDFs
- `exportPDF()` calls `syncSettingsFromDOM()` at start to ensure subtitle/title emoji are captured even if typed just before export

### 3. Color-Code Active Words (v5)
Word list status dots now reflect placement in the **currently-visible puzzle**:
- `renderWordList()` and `renderStatus()` accept `activePage` parameter
- Each page shows relevant placement: WS page shows word search placement, CW page shows crossword placement, etc.
- `showPage(n)` calls `_renderWordListAndStatus()` to update status dots when user switches pages
- Helps users quickly see which words fit in each puzzle at a glance

### 4. Stale State on Toggle Changes (v5)
Fixed issue where toggles like "Show Word Bank" didn't update preview immediately:
- `renderActivePage()` now calls `syncSettingsFromDOM()` at the very start
- Ensures DOM checkbox/slider values are synced to `state.settings` before any renderer reads them
- Toggles now take effect instantly without waiting for 500ms `saveState()` debounce
- Affects all toggles: cwShowBank, wsUseClues, wsBack, wsDiag, wsInternalGrid, notesShuffle, scrShowHint, etc.
