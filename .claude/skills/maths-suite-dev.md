---
name: maths-suite-dev
description: >
  Development guide for maths-suite: a vanilla-JS, no-framework educational
  puzzle app (word search, crossword, maths problem sets, PDF export).
  Covers adding state settings, HTML renderers, PDF drawers, UI modules, and
  question generators. Use whenever making feature changes, debugging, or
  extending the app.
category: project
---

# maths-suite Development Skill

## Quick-Start Workflow

```bash
# 1. Edit source files
# 2. Rebuild bundle
bash build.sh

# 3. Bump cache-bust version in puzzle-suite.html line ~461
#    <script src="bundle.js?v=N">  →  increment N

# 4. Serve and verify
python3 -m http.server 8082
# http://localhost:8082/puzzle-suite.html
```

Always bump `?v=N` after every rebuild — `http.server` caches aggressively.

---

## Architecture at a Glance

| Layer | File(s) | Role |
|---|---|---|
| State | `core/state.js` | Single source of truth |
| Persistence | `core/storage.js` | Debounced localStorage (500 ms) |
| History | `core/history.js` | Undo/redo, max 50 snapshots |
| Renderers | `renderers/*.js` | Write HTML strings to DOM |
| PDF drawers | `pdf/pdfDraw*.js` | Imperatively draw to jsPDF |
| UI modules | `ui/*.js` | One-time setup + toggle actions |
| Generators | `generators/mathsQuestionGen.js` | Seeded PRNG, 9 topics |
| Orchestrator | `main.js` | Init, window API, routing |

---

## Checklist: Adding a New Setting

1. **`core/state.js`** — add default inside `state.settings`:
   ```js
   settings: {
     myNewSetting: 'default',
     // ...
   }
   ```

2. **`core/state.js` → `syncSettingsFromDOM()`** — read from DOM:
   ```js
   s.myNewSetting = getVal('my-new-setting-id', 'default');
   // or for checkbox: s.myNewSetting = getChk('my-new-setting-id', false);
   ```

3. **`core/state.js` → `applyStateToDOM()`** — restore on load:
   ```js
   setVal('my-new-setting-id', cfg.myNewSetting);
   ```

4. **`puzzle-suite.html`** — add the DOM control with matching `id`.

5. **`main.js`** — add an update function, then export it in **both** blocks:
   ```js
   // ~line 343 block:
   window.updateMyNewSetting = updateMyNewSetting;
   // ~line 392 window._puzzleApp block:
   window._puzzleApp = { ..., updateMyNewSetting };
   ```

6. **`main.js` init sequence** — call after `applyStateToDOM()`:
   ```js
   updateMyNewSetting();
   ```

7. **PDF**: if the setting affects PDF output, pass it via `cfg` (which is `state.settings`) or add it to `buildCtx()` in `pdf/pdfExport.js`.

---

## Checklist: Adding a New HTML Renderer

Create `renderers/myPage.js` following this pattern:

```js
import { esc } from './htmlUtils.js';
import { renderKaTeX } from './katexRender.js';

export function renderMyPage(container, data, settings) {
  if (!container) return;

  const { someOption, cols } = settings;

  let html = `<div class="my-page-wrapper">`;
  for (const item of data) {
    html += `<div class="my-item">${esc(item.text)}</div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
  renderKaTeX(container);   // only if content has LaTeX $...$
}
```

**Rules:**
- Always use `esc()` for any user-supplied text injected into HTML.
- Use `$...$` (inline) for LaTeX — never `$$` display mode.
- Call `renderKaTeX(container)` *after* setting `innerHTML`.
- Return a value (e.g. visible item count) only when the caller needs it.

Register in `main.js` → `renderActivePage()` routing switch.

---

## Checklist: Adding a New PDF Drawer

Create `pdf/pdfDrawMyPage.js`:

```js
export function drawMyPage(ctx, data, startY, pScale, exportId) {
  const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark } = ctx;

  let cy = startY;

  for (const item of data) {
    // Page overflow guard — always include this
    if (cy + 10 * scale > PAGE_HEIGHT - MARGIN - 10) {
      drawExportIdFooter(ctx, exportId, pScale);
      doc.addPage();
      drawWatermark();           // must redraw on every new page
      cy = MARGIN + 15 * scale;
    }

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(10 * pScale);
    doc.text(item.text, MARGIN, cy);
    cy += 7 * scale;
  }
}
```

**Rules:**
- `pScale` is the per-page font scale; `scale` is the global jsPDF unit scale.
- Call `drawWatermark()` immediately after every `doc.addPage()`.
- Call `drawExportIdFooter(ctx, exportId, pScale)` before adding a new page.
- No return value — mutates `ctx.doc` in place.
- Register the drawer in `pdf/pdfExport.js` page loop and add a `pageOrder` entry in `ui/pageOrder.js`.

---

## Checklist: Adding a New Question Generator (Topic)

1. Add the topic to `SUB_OPS` in `generators/mathsQuestionGen.js`:
   ```js
   'MyTopic': [
     { key: 'add', label: 'Add (+)' },
     { key: 'subtract', label: 'Subtract (−)' },
   ],
   ```

2. Write the generator function:
   ```js
   function genMyTopic(rng, diff, allowedOps) {
     const OP_MAP = { '+': 'add', '-': 'subtract' };
     let pool = diff === 'Easy' ? ['+'] : ['+', '-'];
     if (allowedOps) pool = pool.filter(op => allowedOps.includes(OP_MAP[op]));
     if (pool.length === 0) return null;

     const op = rc(rng, pool);
     const a = ri(rng, 1, 20);
     const b = ri(rng, 1, 20);
     const verb = rc(rng, CALC_VERBS);

     return {
       clue: `${verb} $${a} ${op} ${b}$`,
       answer: String(op === '+' ? a + b : a - b),
     };
   }
   ```

3. Register in the dispatch table inside `generateMathsQuestions()`:
   ```js
   'MyTopic': genMyTopic,
   ```

4. Add the NESA outcome mapping in `core/outcomes.js` if applicable.

**PRNG helpers available:** `ri(rng, min, max)` → random int; `rc(rng, arr)` → random choice; `rf(rng)` → random float 0–1.

---

## DOM ↔ State Sync — When to Call What

| Situation | Call |
|---|---|
| Slider/input `oninput` needs current value immediately | `syncSettingsFromDOM()` then read `state.settings` |
| Page load — restore saved session | `applyStateToDOM(saved)` |
| User changes a setting → persist | `saveState()` (debounced 500 ms) |
| Need to persist immediately (e.g. before PDF export) | `saveStateNow()` |
| Reading state inside a render function | Pass `settings` as a parameter — never import `state` directly |

---

## CSS Layer Rules

Layers in ascending specificity: `base → layout → components → pages → utils`

- **Dark-mode overrides** must be in `@layer components` or higher.  
  Putting them in `@layer base` loses to component rules — they silently do nothing.
- **CSS custom properties** are declared in `@layer base` on `:root`.  
  Update them from JS with `document.documentElement.style.setProperty('--my-var', value)`.
- **Dark mode** is driven by `data-theme="dark"` on `<body>` (not a class).

---

## Common Gotchas

| Gotcha | Fix |
|---|---|
| Old bundle after JS change | Rebuild (`bash build.sh`) **and** bump `?v=N` in `puzzle-suite.html` |
| Setting not persisted on refresh | Ensure `syncSettingsFromDOM()` reads it and `applyStateToDOM()` restores it |
| New function works in console but not HTML `onclick` | Add to **both** `window.fnName` and `window._puzzleApp` in `main.js` |
| Dark-mode override not applying | Move CSS rule to `@layer components`, not `@layer base` |
| Toggle change ignored in preview | `renderActivePage()` calls `syncSettingsFromDOM()` first — confirm the toggle's `id` matches `syncSettingsFromDOM()` read |
| `innerText` returns `""` inside `<details>` | Use `.value` / `.checked` (as `syncSettingsFromDOM()` does) |
| PDF emoji garbled | Wrap text with `drawText()` helper (canvas fallback in `pdfHelpers.js`) |
| Watermark missing on extra PDF pages | Call `drawWatermark()` after every `doc.addPage()` |
| Answer key shows too many questions | Pass the trimmed (cap-to-1-page) question list, not the full array |
| Sub-ops filter has no effect | Check `state.selectedSubOps[topic]` — `null` means all enabled, empty array means all disabled |

---

## Key File Reference

| Task | File | Lines (approx.) |
|---|---|---|
| Add state setting | `core/state.js` | 11–74 (defaults), 99–177 (sync), 179–325 (restore) |
| Export new function | `main.js` | ~343 (window), ~392 (_puzzleApp) |
| Init sequence | `main.js` | 865–945 |
| PDF orchestration | `pdf/pdfExport.js` | full file |
| PDF context object | `pdf/pdfExport.js` | `buildCtx()` |
| PDF shared utils | `pdf/pdfHelpers.js` | `drawText()`, `hasEmoji()`, `drawHeader()` |
| Page order config | `ui/pageOrder.js` | full file |
| NESA outcomes | `core/outcomes.js` | `STAGE_OUTCOMES`, `getOutcomesForTopics()` |
| Access control | `payments/access.js` | `FREE_LIMITS`, `clampBulkExportCount()` |

---

## Example Commands

```bash
# Full dev cycle after a JS edit
bash build.sh && echo "Bump ?v=N in puzzle-suite.html"

# Check bundle size
ls -lh bundle.js

# Find all usages of a setting key
grep -rn "myNewSetting" --include="*.js" .

# Verify both window export blocks have a function
grep -n "updateMyNewSetting" main.js

# Check localStorage key name (for migration notes)
grep -n "puzzleSuiteV" core/storage.js
```
