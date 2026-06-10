# Maths Suite — Technical Audit & Improvement Plan

**Date:** 2026-06-10 · **Scope:** full repository at commit `51ffcc1` · **Method:** systematic read of all modules; deep review of the generator, PDF pipeline, payments layer, Stripe worker, tests, CI, and docs; `npm test` executed (54/54 pass, ~1.7 s). No code was modified.

---

## 1. Executive Summary

**Overall health: B.** This is an unusually disciplined vanilla-JS codebase for its size: the question generator is fully deterministic (seeded Mulberry32, no stray `Math.random()`), backed by 54 tests that *re-derive answers independently* rather than checking structure; CI gates deploy on lint (`--max-warnings 0`) + tests; there are zero runtime npm dependencies; no secrets are committed; and HTML escaping is consistently applied (a suspected XSS in the title field was investigated and **refuted** — see §3.3). What keeps it from an A: the entire monetization layer is client-trusted and trivially bypassable, two files (`mathsQuestionGen.js` at 5,434 lines and `pdfExport.js` at 1,792 lines) carry most of the system's complexity with no test coverage outside the generator, and all third-party code loads from CDNs without integrity hashes. **Top 3 risks:** (1) once Stripe goes live, Pro is free to anyone who types `setAdminMode(true)` in the console; (2) the renderers, PDF pipeline, state layer, and payment worker have zero tests, making the planned refactors unsafe; (3) un-pinned/un-hashed CDN assets are both a supply-chain exposure and a silent-failure mode (raw `$x=5$` in worksheets when KaTeX fails to load). **Top 3 opportunities:** split the generator monolith behind its excellent existing test suite; add a small worker/renderer test harness (the highest-leverage hour of work in the repo); fix CLAUDE.md drift, which actively misleads AI-assisted development on this project.

---

## 2. Repo Map

**Purpose:** Browser-based NESA (NSW syllabus) maths worksheet & question-set generator for teachers. Generates seeded question sets across 13 topics × Easy/Medium/Hard, renders an HTML preview, and exports print-ready PDFs with answer keys and formula sheets. Free/Pro tiering scaffolded via Stripe (not yet configured — `STRIPE_CONFIG` is empty, `payments/config.js:98-111`).

**Maturity:** Production-deployed side product (GitHub Pages, auto-deploy on `main`), pre-revenue. Single developer, AI-assisted workflow (CLAUDE.md, HANDOFF.md).

**Stack:** Vanilla ES modules bundled by esbuild; jsPDF + KaTeX + Font Awesome from CDN; Cloudflare Worker (raw `fetch` handler, no SDK) for Stripe; `node --test` harness; ESLint 10 flat config; GitHub Actions → Pages.

**Architecture sketch:**

```
puzzle-suite.html (inline on* handlers)
        │ window.fn / window._puzzleApp        (main.js — orchestrator, 1,471 ln)
        ▼
core/state.js  ◄─── syncSettingsFromDOM / applyStateToDOM ───► DOM controls
   │  └─ core/storage.js (localStorage, debounced, V63→V62→V61 migration)
   │  └─ core/history.js (undo/redo, capped 50)
   ▼
generators/mathsQuestionGen.js (5,434 ln, seeded PRNG, 20 generators)
   │
   ├─► renderers/* (HTML preview; pure-ish, escape via htmlUtils.esc)
   └─► pdf/pdfExport.js (1,792 ln) ── pdfHelpers / pdfFonts / pdfDrawFormulas
        
payments/{config,session,access,stripe}.js  ──HTTP──►  stripe-worker/index.js (526 ln)
   (tier in localStorage; client-side gates)            (checkout/verify/me/portal/webhooks,
                                                         JWT HS256, KV, manual wrangler deploy)
```

**Key directories:** see CLAUDE.md's structure table — verified accurate except line counts (§3.8).

**Surprises found during discovery:**
- `eslint.config.mjs` exists and CI enforces it, yet CLAUDE.md lists ESLint as *unfinished roadmap* (CLAUDE.md:315).
- The `ai/aiGenerate.js` "dead code" CLAUDE.md warns about (CLAUDE.md:258) **no longer exists** — already deleted.
- `bundle.js` (296 KB minified) is committed, but CI rebuilds it before upload (`.github/workflows/deploy.yml`, build job), so the committed copy is never what deploys.
- Two gated features are sold in upgrade messaging but not implemented: `IMPORT_CSV` (`processImport()` is a "coming soon" toast, `main.js:1194-1196`) and `AI_GENERATION` (no implementation anywhere).

---

## 3. Audit Report

Severity legend: **C**ritical / **H**igh / **M**edium / **L**ow. Each finding labelled **[fact]** or **[judgment]**.

### 3.1 Architecture & design

| Sev | Finding |
|-----|---------|
| **H** | **Generator monolith.** `generators/mathsQuestionGen.js` is 5,434 lines holding 20 generator functions; largest: `genIndices` 398 ln (4112–4510), `genIntegers` 368 ln (226–594), `_genGeometryCore` 362 ln (2298–2660), `genProbability` 351 ln (3443–3794). **[fact]** Consequence: every topic change touches the same file; merge conflicts and AI-context overflow are structural. CLAUDE.md already understates it by 2× (§3.8). |
| **H** | **PDF layout god-functions.** `pdf/pdfExport.js:973-1342` `drawQuestionPage` (~370 ln) mixes measurement, pagination, diagram placement, and drawing in one loop; `exportPDF` (1545–1792, 248 ln) mixes font loading, watermark async, bulk-loop, and state mutation. **[fact]** Layout bugs here are hard to isolate, and this is the code most likely to need changes (new page types are on the roadmap). |
| **M** | **`main.js` is a controller aggregator** — ~60 functions exported twice (`window.*` and `window._puzzleApp`, main.js:1290), with `renderExportPreview` (404–514) reading 5+ DOM ids directly and writing `innerHTML`. **[fact]** No reactivity: every caller must remember which render functions to invoke. This is the accepted cost of the no-framework choice **[judgment]** — workable at current size, but new settings keep adding to it. |
| **M** | **Difficulty-band triplication.** Easy/Medium/Hard handled as three copy-paste blocks in at least four places: generation (`main.js:117-120`, hardcoded seed offsets +0/+1/+2), PDF page loop (`pdfExport.js:1704-1733`), working-line counts (`renderers/problemSet.js:83`), scale sync (`core/state.js:127-132`, `297-301`). **[fact]** Adding a band or changing band behaviour requires edits in 10+ locations. |
| **L** | Topic-id slugging regex (`replace(/\s+/g,'-')…`) duplicated 10+ times across `main.js` / `core/state.js`. **[fact]** |

No circular imports found (one intentional lazy import breaks the `session ↔ stripe` cycle, `payments/session.js:91-93`). Module boundaries (`core/`, `renderers/`, `pdf/`, `payments/`) are otherwise clean. **[fact]**

### 3.2 Code quality

| Sev | Finding |
|-----|---------|
| **M** | **Repeated generator scaffolding**: ~24 inline phrase pools, ~10 `type = ri(...)` dispatch ladders, and 50+ copies of the retry-recursion pattern `if (bad) return genX(rng, diff, ops, _depth+1)`. **[fact]** Verbose but readable; the cost is maintenance, not correctness. |
| **M** | **Silent degradation on CDN failure.** If KaTeX never loads, `renderKaTeX` is a deliberate no-op (`renderers/katexRender.js:16`) and worksheets show raw `$x = 5$` with no user warning; `loadJSPDF()` is awaited with no timeout (`pdfExport.js:1611`); custom-font failure only `console.warn`s (`pdfExport.js:1649`). **[fact]** For a teacher printing class sets, a silently degraded PDF is worse than an error. **[judgment]** |
| **L** | **Float-precision edge in percentages**: `mathsQuestionGen.js:1313/1319` computes `pct = num * (100/den)` and one path returns `String(pct)` without an integer/rounding guard — a 2/3-style input would yield `66.66666666666667` as the official answer. Currently prevented by upstream value choices and watched by tests **[fact]**; should be enforced at the source **[judgment]**. |
| **L** | Dead exports: `canUndo`/`canRedo` (`core/history.js:67-68`), `getTopicDisplayName` (`core/outcomes.js:381`); `state.settings.exportCount` is incremented (`pdfExport.js:1668`) but never read. **[fact]** |

Error handling elsewhere is notably *good*: storage quota has a two-stage fallback with user-facing toasts (`core/storage.js:31-53`), corrupted saves self-heal (`storage.js:91-95`), the generator's entry point survives unknown topics/sub-ops and throwing generators (`mathsQuestionGen.js:5374-5406`), and watermark loading has an explicit 8 s timeout. **[fact]**

### 3.3 Security

| Sev | Finding |
|-----|---------|
| **H** | **All entitlement enforcement is client-side and trivially bypassable.** `setAdminMode(true)` is intentionally console-callable (`main.js:357-363`); the tier lives in plain localStorage (`payments/session.js:18,79-81`); `FREE_LIMITS.MONTHLY_EXPORTS` is enforced nowhere server-side — `payments/config.js:68-74` itself says "backend should also enforce" / "future: tracked server-side". The Cloudflare Worker authenticates *billing* operations but nothing of value (PDF generation is 100 % client-side). **[fact]** Consequence: when Stripe goes live, every Pro feature — watermark removal, bulk export, two-page mode — is available free to anyone who opens devtools. Whether that's acceptable is a product decision (teacher audience, honor-system), but it must be a *decision*, not an accident. **[judgment]** |
| **M** | **No Subresource Integrity on any CDN asset.** Font Awesome 6.4.0, KaTeX 0.16.9 (3 tags), and dynamically-loaded jsPDF 2.5.1 are version-pinned but have no `integrity` attributes; Fontsource fonts load at **`@latest`** (`pdf/pdfFonts.js`). **[fact]** A compromised or mutated CDN asset executes in every user's browser; `@latest` additionally means unreproducible PDF output over time. |
| **L** | **Non-constant-time webhook signature comparison**: `computed !== expected` (`stripe-worker/index.js:402`). Timing-oracle risk is largely theoretical over Workers infrastructure **[judgment]**, but `crypto.subtle.verify` or a constant-time compare is a one-line fix. **[fact]** |
| **L** | Malformed JWT (bad base64/JSON in claims) makes `verifyJwt` **throw** (`index.js:429,433`) instead of returning null — caught by the router's catch-all (`index.js:72-75`) so the caller sees 500 rather than 401. Cosmetic. **[fact]** |
| **L** | **Imported `.json` config is merged without schema validation**: `Object.assign(state.settings, parsed.settings)` (`main.js:1175-1179`). Not an XSS vector (see below), but malformed values (e.g. `scales: "foo"`) can corrupt state until a hard reset; `__proto__` keys would silently swap the settings object's prototype. **[fact]** |

**Refuted finding — no XSS identified.** A sub-review flagged title/subtitle as a Critical `innerHTML` XSS sink. Verified false: `updateUI()` writes titles via `.innerText` (`main.js:524-525`); question clues pass through `formatClue()`, which calls `esc()` *before* applying its markdown subset (`renderers/htmlUtils.js:86-101`), and `$...$` segments are handled by KaTeX with default `trust: false` (`renderers/katexRender.js:18-25`); outcome chips, units, topics, and the access panel all escape via `esc()` (`problemSet.js:48,62,70,111`, `keys.js:44-59`, `accessPanel.js:140`); imported config never injects pre-generated questions — `loadConfigFromFile` immediately calls `generateAll()` (`main.js:1184`). **[fact]**

Also clean: no secrets in the working tree (no `sk_*`, `whsec_*`, key material — scanned); the worker validates `priceId` against an allowlist (`index.js:95-98`), pins redirect URLs to the app origin (`index.js:101,506-513`), guards webhook replay with a 5-minute window (`index.js:386`), and makes `/api/verify` idempotent (`index.js:156-165`). **[fact]**

### 3.4 Testing

| Sev | Finding |
|-----|---------|
| **H** | **Coverage cliff outside the generator.** Zero tests for: renderers (incl. 671-line `diagramSVG.js`), the entire PDF pipeline, `core/state.js` sync logic, `core/storage.js` migrations, `payments/access.js` gate resolution, and — most notably — **the Stripe worker has no test harness at all** (no test files, no test script in `stripe-worker/package.json`), despite containing hand-rolled JWT signing and webhook signature verification. **[fact]** Consequence: the refactors this codebase most needs (PDF, generator split) currently have a safety net on only one of the two monoliths, and payment-security code is verified only by curl smoke tests in a README. |
| **M** | Thin sub-op coverage inside the otherwise strong suite: Rounding gets structural checks only; Properties of Geometrical Figures has one Hard variant deep-verified. **[fact]** |

Strengths: 54/54 pass in ~1.7 s; tests re-derive answers independently (substitute solutions back into equations, recompute SI/GST/Pythagoras/mean/median, `test/topics/*.test.mjs`); worked-solution self-consistency checked across 24,000 generated questions; all seeds fixed — no flaky patterns. **[fact]** This is genuinely better generator testing than most production codebases have.

### 3.5 Performance

Healthy for its scale — one sentence: generation of 90 questions is effectively instant, `_capToPages` batches DOM reads/writes to limit reflow (`problemSet.js:215-224`), history is capped at 50 snapshots, and the only unbounded-growth candidates (`exportCount`, watermark dataURLs) are respectively harmless and already quota-guarded. **[fact]**

### 3.6 Dependencies

Minimal and current: dev-only `esbuild 0.25.12`, `eslint 10.4.1`, `globals 17.6.0`; zero runtime npm deps; lockfile committed. **[fact]** The real dependency surface is the CDN set covered in §3.3 (no SRI, one `@latest`). KaTeX 0.16.9 and jsPDF 2.5.1 are behind latest but stable; no known-CVE exposure identified for this usage **[judgment — not exhaustively verified against CVE feeds]**.

### 3.7 DevEx & operations

| Sev | Finding |
|-----|---------|
| **M** | **Stripe worker is fully manual**: deployed by hand with wrangler, no CI, no lint coverage in its directory beyond the shared config, no tests (§3.4). **[fact]** The piece of the system handling money has the least automation. |
| **L** | **Committed `bundle.js` is redundant**: CI runs `bash build.sh` before packaging, so the committed 296 KB artifact never deploys; it exists only so the repo can be served without building, at the cost of binary-ish diffs on every change. **[fact]** |
| **L** | No client-side error reporting/observability — a teacher's failed export is invisible to the maintainer. Appropriate to defer at this maturity. **[judgment]** |

Strengths: CI is exemplary for the project size — lint with `--max-warnings 0` + tests gate both PRs and deploys (`.github/workflows/deploy.yml`), concurrency groups prevent deploy races, `build.sh` content-hash cache-busting eliminates a whole class of stale-bundle bugs. ESLint config is pragmatic and bug-focused (no-undef, no-dupe-keys, etc., with per-context globals for browser/worker/test). **[fact]**

### 3.8 Documentation

| Sev | Finding |
|-----|---------|
| **M** | **CLAUDE.md has drifted from reality in 6 places** — and because it steers AI-assisted development, drift here propagates into wrong decisions: (1) `mathsQuestionGen.js "~2691 lines"` → actually 5,434 (CLAUDE.md:66); (2) ESLint listed as missing roadmap item → fully implemented and CI-gated (CLAUDE.md:315); (3) `ai/aiGenerate.js` dead-code section → directory no longer exists (CLAUDE.md:258); (4) `main.js "~1376 lines"` → 1,471; (5) `window._puzzleApp "~line 1214"` → line 1290; (6) "~36 tests" → 54. **[fact]** |
| **L** | Feature flags promise unimplemented features: `IMPORT_CSV` is in the free tier and upsell copy but `processImport()` is a "coming soon" toast (`main.js:1194-1196`); `AI_GENERATION` has an upgrade message (`access.js:166`) and no implementation. **[fact]** |

All other docs verified accurate: README, DEPLOY.md, HANDOFF.md ("All 54 tests pass" — confirmed), STRIPE_INTEGRATION.md, monetisation.md, stripe-worker/README.md. **[fact]**

### 3.9 Strengths (what to preserve)

1. **Deterministic generation** — seeded Mulberry32 everywhere, `Math.random()` nowhere; reproducible worksheets are the product's backbone.
2. **Behavioral test philosophy** — tests recompute mathematics independently; keep this bar for all new tests.
3. **Escaping discipline** — `esc()`-before-markup is consistently applied; the audit found no exploitable injection.
4. **Defensive persistence** — quota fallbacks, versioned migrations, corruption self-healing in `core/storage.js`.
5. **Worker security posture** — price allowlist, origin-pinned redirects, signed+replay-guarded webhooks, idempotent verify, secrets only in wrangler.
6. **CI that actually gates** — lint and tests block both PRs and deploys; zero-warning policy.
7. **Zero runtime npm dependencies** — small attack/maintenance surface by design.

---

## 4. Improvement Strategy

### Theme 1 — The trust boundary doesn't match the business model *(explains the H security finding)*
**Target state:** an explicit, documented entitlement stance before Stripe go-live. Realistic options: (a) **accept the honor system** for the teacher audience and enforce only what's cheap (worker-verified tier check at export time for watermark removal), or (b) move *one* high-value capability server-side as the paywall anchor. Full server-side enforcement would mean server-side PDF generation — wrong trade for this product. **Principle:** enforce entitlements where value is delivered, or consciously decide not to.
**Done when:** a decision is recorded in monetisation.md, and whatever is decided is reflected in code before `STRIPE_CONFIG` is populated.

### Theme 2 — The safety net covers only one of the two monoliths *(explains the testing findings and blocks Theme 3)*
**Target state:** smoke/unit coverage for renderers (HTML output sanity per topic/diagram type), the PDF pipeline (export completes, page counts match config), state round-trips (save → load → identical), access-gate resolution, and the worker's crypto (JWT sign/verify, webhook signature accept/reject vectors). Not 80 % line coverage — *behavioral coverage of what refactors could break*. **Principle:** tests precede refactors.
**Done when:** `node --test` covers worker + renderers + state; worker tests run in CI.

### Theme 3 — Complexity is concentrated in two files *(explains the architecture findings)*
**Target state:** `mathsQuestionGen.js` split into per-domain modules (≤ ~800 lines each) re-exported through an unchanged public API, with shared scaffolding (retry wrapper, variant picker) extracted; `drawQuestionPage` separated into measure vs. draw phases. **Principle:** the existing test suite is the contract — every split lands with all 54+ tests green and identical seeded output.
**Done when:** no JS source file exceeds ~1,000 lines except `main.js`; seeded output byte-identical pre/post split (snapshot test).

### Theme 4 — Third-party code is taken on faith *(explains the CDN findings)*
**Target state:** every CDN `<script>`/`<link>` carries an `integrity` hash; Fontsource pinned to exact versions; user-visible toast when KaTeX/jsPDF fail to load. **Principle:** pin and verify everything that executes in users' browsers; never degrade silently on a printing path.
**Done when:** zero un-hashed external scripts; export path surfaces load failures.

### Explicitly NOT recommended (effort vs. payoff at this maturity)
- **No framework migration / reactive rewrite** of main.js — the imperative sync pattern is documented, working, and tested by usage.
- **No server-side export-quota tracking** (`MONTHLY_EXPORTS`) unless Theme 1 chooses strict enforcement.
- **No CSS restructure** of the 4,133-line stylesheet — the layer architecture is sound.
- **No client error-reporting service** yet — revisit if/when paying users exist.
- **No coverage targets for `main.js` UI glue** — smoke-level is enough.

---

## 5. Task Plan

### Milestone 0 — Safety net (do before any refactor)

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|------|-------|---------------------|--------|------|------|
| T1 | **Worker test harness**: unit tests for `signJwt`/`verifyJwt` (round-trip, expiry, tampered sig, malformed token → null not throw), `verifyWebhookSignature` (valid/invalid/stale timestamp), `_tierFromSubscription`, `_isAllowedUrl`. Wire into CI test job. | `stripe-worker/`, `.github/workflows/deploy.yml` | Tests run in CI; tampered-JWT and bad-signature vectors rejected | **M** | Low | — |
| T2 | **Renderer + generator snapshot smoke tests**: for fixed seeds, assert `renderProblemSet`/`renderKeys`/`renderDiagramSVG` produce parseable HTML/SVG containing expected question count, escaped content, and a valid diagram per geometry sub-op; snapshot seeded generator output (guards Theme-3 splits). | `test/` | `node --test` covers every diagram type; snapshot file committed | **M** | Low | — |
| T3 | **State/storage round-trip tests**: save → load → deep-equal; V62/V61 migration fixtures; corrupted-JSON recovery. | `test/`, `core/storage.js` (test seams only) | Migration chain covered by fixtures | **S** | Low | — |

### Milestone 1 — Critical & correctness fixes

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|------|-------|---------------------|--------|------|------|
| T4 | **Add SRI hashes + pin Fontsource**: `integrity`+`crossorigin` on FA/KaTeX tags; pin jsPDF and Fontsource URLs to exact versions (jsdelivr serves SRI-stable artifacts). | `puzzle-suite.html`, `pdf/pdfFonts.js` | No external script/style without `integrity`; no `@latest` URLs | **S** | Low — wrong hash fails closed, test locally | — |
| T5 | **Worker hardening**: constant-time signature compare (use `crypto.subtle.verify` for the HMAC instead of hex `!==`); wrap `verifyJwt` decode in try/catch → return null (401 not 500). | `stripe-worker/index.js:402,422-436` | T1 vectors pass; malformed token → 401 | **S** | Low | T1 |
| T6 | **Record entitlement-enforcement decision** (Theme 1) and implement the chosen minimum (e.g. watermark removal requires a live `/api/me` pro response when Stripe is configured). | `monetisation.md`, `payments/`, `pdf/pdfExport.js` | Decision documented; go-live checklist updated | **S**–**M** | Medium if enforcement added | Owner input (§7 Q1) |
| T7 | **CDN failure UX**: timeout (~10 s) + error toast around `loadJSPDF()`; one-time warning toast when `renderMathInElement` is absent at first render. | `pdf/pdfExport.js:1611`, `renderers/katexRender.js`, `main.js` | Blocking jsPDF CDN shows an error, button re-enables; missing KaTeX warns user | **S** | Low | — |
| T8 | **Harden percentage path**: guard `mathsQuestionGen.js:1313-1319` with integer/`round(…,1)` validation + regen-on-fail, matching the file's own retry idiom. | `generators/mathsQuestionGen.js` | New test proves non-terminating fractions never surface as answers | **S** | Low | — |

### Milestone 2 — High-leverage improvements

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|------|-------|---------------------|--------|------|------|
| T9 | **Split the generator monolith** (sketch in §6). | `generators/` | Public API unchanged; all tests + T2 snapshots green; no module > ~800 ln | **XL** (broken into per-domain S/M steps) | Medium | T2 |
| T10 | **Extract generator scaffolding**: `withRetry(genFn)`, `pickVariant(rng, table)`, shared phrase-pool helper; adopt in 3–4 generators as the pattern, migrate the rest opportunistically. | `generators/` | Retry recursion boilerplate gone from converted generators; tests green | **M** | Low | T9 (or first step of it) |
| T11 | **Decompose `drawQuestionPage`**: pure measurement pass (layout plan) separated from drawing pass; extract diagram/chips/formula-hint sub-drawers. | `pdf/pdfExport.js:973-1342` | Function ≤ ~120 ln; PDF page counts/order unchanged (T2 smoke) | **L** | Medium — visual regressions; diff sample PDFs | T2 |
| T12 | **CLAUDE.md refresh**: fix all six §3.8 drifts; remove dead `ai/` section; replace hand-maintained line counts with `wc -l` note or drop them. | `CLAUDE.md` | Every verifiable claim matches the tree | **S** | None | — |
| T13 | **Single `DIFFICULTIES` descriptor** (label, icon, seed-offset, working-lines, scale-key) consumed by `main.js`, `pdfExport.js`, `problemSet.js`, `state.js`. | 4 files | Band properties defined once; tests green | **M** | Medium — touches generation seed offsets; keep offsets identical | T2 |

### Milestone 3 — Quality & polish

| # | Task | Files | Acceptance criteria | Effort | Risk | Deps |
|---|------|-------|---------------------|--------|------|------|
| T14 | Remove dead exports (`canUndo`/`canRedo`, `getTopicDisplayName`) and unused `exportCount`, or wire them up deliberately. | `core/history.js`, `core/outcomes.js`, `core/state.js`, `pdf/pdfExport.js` | ESLint no-unused passes; no dangling references | **S** | Low | — |
| T15 | Validate imported config: allowlist known keys, type-check values, reject `__proto__`/`constructor` keys before merge. | `main.js:1163-1192` | Malformed config → toast, state untouched | **S** | Low | — |
| T16 | Reconcile feature flags with reality: hide or implement `IMPORT_CSV`; remove `AI_GENERATION` from upsell copy until built. | `payments/config.js`, `main.js` | No gated feature without an implementation behind it | **S** | Low | Owner input (§7 Q3) |
| T17 | Extract `toTopicId()` utility; replace 10+ inline slug regexes. | `main.js`, `core/state.js` | Single definition; tests green | **S** | Low | — |
| T18 | Decide on committed `bundle.js`: either stop committing it (add to .gitignore, document `bash build.sh` for local serving) or add a CI check that it's fresh. | `.gitignore`, docs | No silent stale-bundle state possible | **S** | Low | Owner input (§7 Q4) |

### Quick wins (high impact, ≤ 2 h each — do immediately)
**T4** (SRI + pinning), **T5** (worker hardening), **T7** (CDN failure UX), **T8** (percentage guard), **T12** (CLAUDE.md refresh), **T14** (dead code).

---

## 6. Implementation Sketches (top 3)

### T9 — Split `mathsQuestionGen.js`
**Approach:** mechanical extraction behind a frozen public API; the test suite + T2 snapshots are the contract.
1. Create `generators/_shared.js`: `mulberry32`, `ri`, `rc`, `round`, `money`, `gcd`, `lcm`, `simplify`, `fracStr`, verb constants (currently lines 10–68 + verb tables).
2. Move generators by domain: `number.js` (Integers/Decimals/Rounding/Fractions/Percentages), `algebra.js` (+indices, linear, variation), `geometry.js` (+props of figures, trig), `statistics.js` (+probability), `financial.js`, `ratios.js`, `nonlinear.js`.
3. Keep `mathsQuestionGen.js` as the façade: imports all domains, owns `SUB_OPS`, `ALL_SUBTOPICS`, `GENERATORS` dispatch, and `generateMathsQuestions` — **zero import changes** for `core/state.js`, `main.js`, and all tests.
4. One domain per commit; run `npm test` + snapshot diff each time.
**Gotchas:** seed-consumption order must not change — moving code is safe, but do not reorder `rng()` calls inside any generator (snapshots catch this). `SUB_OPS` stage/pathway gating must stay in the façade so `core/state.js` re-exports keep working. Watch for module-level mutable state (there is none today — keep it that way).

### T1 — Worker test harness
**Approach:** the worker is dependency-free Web-Crypto code; Node ≥ 20 provides `crypto.subtle`, `btoa`/`atob`, `fetch` natively, so `node --test` works directly.
1. Export the pure helpers (`signJwt`, `verifyJwt`, `verifyWebhookSignature`, `_tierFromSubscription`, `_isAllowedUrl`) — either named exports from `index.js` or a `lib.js` the handler imports.
2. Vectors: JWT round-trip; expired `exp`; signature tampered (flip one char); **malformed claims/base64 → expect `null`, not throw** (fails today — fix in T5); webhook: valid HMAC, wrong secret, timestamp 6 min old, header missing `v1`.
3. Route-level tests by calling `worker.fetch(new Request(...), envStub)` with a stubbed KV (`Map`-backed) and a stubbed `fetch` for Stripe.
4. Add `stripe-worker` test invocation to the CI test job (`node --test stripe-worker/`).
**Gotchas:** keep the export surface additive so `wrangler deploy` is unaffected; don't import `wrangler` in tests — stub `env` as a plain object.

### T4 — SRI + version pinning
**Approach:**
1. For each CDN tag in `puzzle-suite.html` (FA 6.4.0 CSS, KaTeX 0.16.9 CSS/JS/auto-render), compute `sha384` (`curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`), add `integrity` + `crossorigin="anonymous"`.
2. jsPDF loads dynamically in `pdf/pdfFonts.js` — set `script.integrity`/`script.crossOrigin` on the created element.
3. Replace Fontsource `@latest` URLs with exact pinned versions; fonts fetched as binary for jsPDF can't use SRI attributes, so pinning + the existing helvetica fallback is the control there.
4. Verify: load app with devtools network tab; corrupt one hash deliberately to confirm fail-closed + T7 toast.
**Gotchas:** Google Fonts CSS is *not* SRI-compatible (responses vary by UA) — pin and accept, or self-host those four families later; jsdelivr URLs must include the full version (`katex@0.16.9`) for hashes to be stable.

---

## 7. Open Questions (need a human decision)

1. **Entitlement stance (drives T6):** When Stripe goes live, is the honor system acceptable for the teacher audience, or should watermark removal (the most visible Pro feature) require a live server-verified tier? Full enforcement isn't feasible without server-side PDF generation.
2. **Stripe timeline:** Is go-live imminent? That decides whether Milestone 1's T5/T6 outrank Milestone 0 in calendar order.
3. **Feature-flag debt (T16):** Are `IMPORT_CSV` and `AI_GENERATION` planned for delivery, or should they be removed from tier definitions and upsell copy until built?
4. **Committed `bundle.js` (T18):** Is "clone-and-serve without building" a workflow you actually use? If not, ignoring it removes diff noise; if yes, a CI freshness check prevents silent drift.
5. **Deprecation candidates:** `exportCount` was presumably intended for the `MONTHLY_EXPORTS` cap — should it become a real (client-side) soft limit, or be deleted?
6. **Lighter-review disclosure:** `puzzle-suite.css` (4,133 ln) and the 13 individual SVG diagram functions received structural review only, not line-by-line audit; per-sub-op mathematical review relied on the existing test suite plus spot checks.
