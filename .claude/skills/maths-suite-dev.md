---
name: maths-suite-dev
description: >
  Development guide for maths-suite: a vanilla-JS, no-framework educational
  puzzle app (word search, crossword, maths problem sets, PDF export) with a
  Stripe + Cloudflare Worker payments backend.
  Covers adding state settings, HTML renderers, PDF drawers, UI modules,
  question generators, feature flags, and Stripe integration.
  Use whenever making feature changes, debugging, or extending the app.
category: project
---

# maths-suite Development Skill

## Quick-Start Workflow

```bash
# 1. Edit source files
# 2. Rebuild bundle (also stamps SRI hashes + a fresh cache-bust hash automatically)
bash build.sh
# offline: SKIP_SRI=1 bash build.sh

# 3. Serve and verify
python3 -m http.server 8082
# http://localhost:8082/puzzle-suite.html
```

No manual `?v=N` bump needed — `build.sh` stamps `<script src="bundle.js?v=…">`
with a content hash on every run.

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
| Generators | `generators/mathsQuestionGen.js` | Seeded PRNG, 13 topics |
| Orchestrator | `main.js` | Init, window API, routing |
| Feature gates | `payments/access.js` + `payments/config.js` | `hasFeature()`, tier/group system |
| Payments | `payments/stripe.js` + `stripe-worker/index.js` | Stripe Checkout + Cloudflare Worker |

---

## Checklist: Adding a New Setting

1. **`core/state.js`** — add default inside `state.settings`:
   ```js
   settings: {
     myNewSetting: 'default',
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

5. **`main.js`** — add an update function, then add it to the `window._puzzleApp`
   object (~line 1404):
   ```js
   window._puzzleApp = { ..., updateMyNewSetting };
   ```
   `Object.assign(window, window._puzzleApp)` right after that object
   (~line 1471) propagates every entry onto `window.fnName` automatically —
   nothing else to export.

6. **`main.js` init sequence** — call after `applyStateToDOM()`.

7. **PDF**: if the setting affects PDF output, pass it via `cfg` (which is `state.settings`) or add it to `buildCtx()` in `pdf/pdfExport.js`.

---

## Checklist: Adding a New Feature Flag

1. **`payments/config.js` → `FEATURE`** — add a new key:
   ```js
   export const FEATURE = Object.freeze({
     MY_FEATURE: 'my_feature',
     // ...
   });
   ```

2. **`payments/config.js` → `TIER_FEATURES`** — decide which tier unlocks it:
   ```js
   [TIER.PRO]: new Set([
     // existing features...
     FEATURE.MY_FEATURE,
   ]),
   ```

3. **`payments/config.js` → `FEATURE_META`** — add display metadata:
   ```js
   [FEATURE.MY_FEATURE]: { label: 'My Feature', desc: 'What it does', category: 'Content' },
   ```
   Valid categories: `'PDF / Export'`, `'Content'`, `'Config'`, `'Layout'`

4. **Gate the feature wherever needed** using `hasFeature()`:
   ```js
   import { hasFeature, FEATURE } from './payments/access.js';

   if (!hasFeature(FEATURE.MY_FEATURE)) {
     showToast('My feature requires a Pro subscription.', 'warning');
     return;
   }
   ```
   Or use `requireFeature()` which calls showToast automatically:
   ```js
   if (!requireFeature(FEATURE.MY_FEATURE, showToast)) return;
   ```

5. **`payments/access.js` → `_upgradeMessage()`** — add an upgrade message for the feature.

6. **`payments/config.js` → `GROUPS`** — add the feature to any relevant group presets (e.g. `teacher_trial`, `school`).

The admin access panel (`ui/accessPanel.js`) picks up the new feature automatically from `FEATURE_META`.

---

## Checklist: Adding a New HTML Renderer

Create `renderers/myPage.js` following this pattern:

```js
import { esc } from './htmlUtils.js';
import { renderKaTeX } from './katexRender.js';

export function renderMyPage(container, data, settings) {
  if (!container) return;
  let html = `<div class="my-page-wrapper">`;
  for (const item of data) {
    html += `<div class="my-item">${esc(item.text)}</div>`;
  }
  html += `</div>`;
  container.innerHTML = html;
  renderKaTeX(container);   // only if content has LaTeX $...$
}
```

- Always use `esc()` for any user-supplied text injected into HTML.
- Call `renderKaTeX(container)` *after* setting `innerHTML`.
- Register in `main.js` → `renderActivePage()` routing switch.

---

## Checklist: Adding a New PDF Drawer

Create `pdf/pdfDrawMyPage.js`:

```js
export function drawMyPage(ctx, data, startY, pScale, exportId) {
  const { doc, PAGE_HEIGHT, MARGIN, scale, pdfFont, drawWatermark } = ctx;
  let cy = startY;

  for (const item of data) {
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

- `pScale` = per-page font scale; `scale` = global jsPDF unit scale.
- Call `drawWatermark()` immediately after every `doc.addPage()`.
- Call `drawExportIdFooter(ctx, exportId, pScale)` before adding a new page.
- Register the drawer in `pdf/pdfExport.js` page loop.
- Add a `pageOrder` entry in `ui/pageOrder.js`.

---

## Checklist: Adding a New Question Generator (Topic)

1. Add the topic to `SUB_OPS` in `generators/mathsQuestionGen.js`.
2. Write the generator function using `ri()`, `rc()`, `rf()` PRNG helpers.
3. Register in the dispatch table inside `generateMathsQuestions()`.
4. Add the NESA outcome mapping in `core/outcomes.js` if applicable.

**PRNG helpers:** `ri(rng, min, max)` → random int; `rc(rng, arr)` → random choice; `rf(rng)` → random float 0–1.

---

## Payments & Stripe — Architecture

```
Browser                     Cloudflare Worker              Stripe
──────────                  ─────────────────              ──────
initiateCheckout()  ──POST /api/checkout──►  POST /v1/checkout/sessions
                    ◄── { url } ──────────   ◄── { url }
window.location = url ──────────────────────────────────► Stripe Checkout
                                                           (user pays)
Stripe redirects to ?stripe_session=cs_xxx
handleCheckoutReturn() ─POST /api/verify──►  GET /v1/checkout/sessions/cs_xxx
                       ◄── { tier, token } ──────────────
setSession(token) → localStorage

(background on startup)
refreshSession() ──GET /api/me──►  verify JWT, read KV
                 ◄── { tier } ───  (updated by webhooks)

(user manages billing)
openCustomerPortal() ─POST /api/portal──►  POST /v1/billing_portal/sessions
                     ◄── { url } ─────────
window.location = url ─────────────────────────────────► Stripe Portal
```

**KV schema** (`SUBSCRIPTIONS` namespace):

| Key | Value | TTL |
|---|---|---|
| `customer:{cid}` | `{ userId, tier, subscriptionId, status }` | none |
| `user:{uid}` | `{ customerId, tier }` | none |
| `verified:{cs_...}` | `{ token, tier, userId, expiresAt }` | 24 h |

---

## Checklist: Activating Stripe (when account details arrive)

1. Fill in `payments/config.js` → `STRIPE_CONFIG`:
   ```js
   publishableKey: 'pk_live_...',
   workerUrl:      'https://maths-suite-payments.YOUR.workers.dev',
   prices: {
     proMonthly: 'price_1ABC...',
     proYearly:  'price_1XYZ...',
   },
   ```

2. Create a KV namespace and deploy the worker:
   ```bash
   cd stripe-worker
   npm install
   wrangler kv:namespace create SUBSCRIPTIONS   # copy the ID into wrangler.toml
   # edit wrangler.toml: set APP_URL
   wrangler deploy
   ```

3. Set secrets (never commit these):
   ```bash
   wrangler secret put STRIPE_SECRET_KEY      # sk_live_...
   wrangler secret put STRIPE_WEBHOOK_SECRET  # whsec_... from Stripe Dashboard
   wrangler secret put JWT_SECRET             # openssl rand -base64 32
   wrangler secret put PRICE_PRO_MONTHLY      # price_1ABC...
   wrangler secret put PRICE_PRO_YEARLY       # price_1XYZ... (or leave blank)
   ```

4. Register `https://<worker-url>/api/webhooks` as a Stripe webhook endpoint.
   Listen for: `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_succeeded`, `invoice.payment_failed`.

5. Rebuild — `build.sh` stamps the cache-bust hash automatically:
   ```bash
   bash build.sh
   ```

---

## Checklist: Testing Stripe Locally

```bash
# 1. Start local app
python3 -m http.server 8082

# 2. Run worker locally (in stripe-worker/)
wrangler dev --local

# 3. Use Stripe CLI to forward webhooks to local worker
stripe listen --forward-to http://localhost:8787/api/webhooks

# 4. Trigger a test event
stripe trigger customer.subscription.updated

# 5. Test checkout flow with Stripe test card: 4242 4242 4242 4242
```

To simulate an active Pro session without going through checkout (for UI testing):
```js
// In browser console:
setAdminMode(true)     // unlock all features
setAdminMode(false)    // revert to free
```

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
- **CSS custom properties** declared in `@layer base` on `:root`.
- **Dark mode** driven by `data-theme="dark"` on `<body>` (not a class).

---

## Common Gotchas

| Gotcha | Fix |
|---|---|
| Old bundle after JS change | Rebuild (`bash build.sh`) — it stamps `?v=` automatically |
| Setting not persisted on refresh | Ensure `syncSettingsFromDOM()` reads it and `applyStateToDOM()` restores it |
| New function works in console but not HTML `onclick` | Not added to the `window._puzzleApp` object in `main.js` — `Object.assign` won't propagate what isn't there |
| Dark-mode override not applying | Move CSS rule to `@layer components`, not `@layer base` |
| Toggle change ignored in preview | Confirm the toggle's `id` matches the `syncSettingsFromDOM()` read |
| `innerText` returns `""` inside `<details>` | Use `.value` / `.checked` (as `syncSettingsFromDOM()` does) |
| PDF emoji garbled | Wrap text with `drawText()` helper (canvas fallback in `pdfHelpers.js`) |
| Watermark missing on extra PDF pages | Call `drawWatermark()` after every `doc.addPage()` |
| Answer key shows too many questions | Pass the trimmed (cap-to-1-page) question list, not the full array |
| Feature gate not enforcing | Check `hasFeature(FEATURE.X)` — override panel may be active (check `getActiveGroupId()`) |
| Pro tier not showing after checkout | Ensure `handleCheckoutReturn()` runs before `renderTierUI()` in init |
| Session not refreshing after cancellation | `refreshSession()` runs in background at startup; tier updates on next load |

---

## Key File Reference

| Task | File |
|---|---|
| Add state setting | `core/state.js` — defaults, `syncSettingsFromDOM()`, `applyStateToDOM()` |
| Export new function | `main.js` — `window._puzzleApp` object (~line 1404); `Object.assign(window, ...)` (~line 1471) propagates it automatically |
| Init sequence | `main.js` — `window.addEventListener('load', ...)` (~line 1476) |
| PDF orchestration | `pdf/pdfExport.js` |
| PDF context object | `pdf/pdfExport.js` → `buildCtx()` |
| PDF shared utils | `pdf/pdfHelpers.js` → `drawText()`, `hasEmoji()`, `drawHeader()` |
| Page order config | `ui/pageOrder.js` |
| NESA outcomes | `core/outcomes.js` → `STAGE_OUTCOMES`, `getOutcomesForTopics()` |
| Feature flags | `payments/config.js` → `FEATURE`, `TIER_FEATURES`, `FEATURE_META`, `GROUPS` |
| Feature gate API | `payments/access.js` → `hasFeature()`, `requireFeature()`, `getBulkExportLimit()` |
| Session management | `payments/session.js` → `getSession()`, `setSession()`, `pruneExpiredSession()` |
| Stripe client hooks | `payments/stripe.js` → `initiateCheckout()`, `handleCheckoutReturn()`, `refreshSession()` |
| Stripe backend | `stripe-worker/index.js` → `/api/checkout`, `/api/verify`, `/api/me`, `/api/portal`, `/api/webhooks` |
| Worker config | `stripe-worker/wrangler.toml` |

---

## Useful Commands

```bash
# Full dev cycle after a JS edit
bash build.sh && echo "Bump ?v=N in puzzle-suite.html"

# Check bundle size
ls -lh bundle.js

# Find all usages of a setting key
grep -rn "myNewSetting" --include="*.js" .

# Verify both window export blocks have a function
grep -n "myFunction" main.js

# Check localStorage key name (for migration notes)
grep -n "puzzleSuiteV" core/storage.js

# List all feature flag keys
grep -A1 "FEATURE = " payments/config.js

# Check which features a tier has
node -e "const {TIER_FEATURES,TIER}=require('./payments/config.js'); console.log([...TIER_FEATURES[TIER.PRO]])"

# Deploy Cloudflare Worker
cd stripe-worker && wrangler deploy

# Tail worker logs in real-time
cd stripe-worker && wrangler tail
```
