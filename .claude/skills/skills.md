---
name: suite-projects
description: >
  Cross-project guide for working on maths-suite and puzzle-suite together.
  Both are vanilla-JS worksheet generators sharing the same architecture DNA;
  this covers what's shared, where they diverge, and which repo-specific
  guide to read next. Use when a task spans both repos or when porting a
  fix/feature from one to the other.
category: project
---

# Working with maths-suite & puzzle-suite

Two sibling repos, same architectural DNA (puzzle-suite is the ancestor;
maths-suite was forked from it and evolved). Each has a detailed `CLAUDE.md` —
read that for deep work. This file is the map between them.

## What the projects are

| | maths-suite | puzzle-suite |
|---|---|---|
| Product | NESA-aligned maths worksheet generator (Stage 4/5) | Vocabulary puzzles: word search, crossword, scramble, matching |
| Entry HTML | `puzzle-suite.html` (same name in both!) | `puzzle-suite.html` |
| localStorage key | `puzzleSuiteV63` | `puzzleSuiteV60` |
| Backend | Cloudflare Worker (`stripe-worker/`) + KV, JWT sessions | Node/Express (`server/`) + SQLite, license keys (`PSP-…`) |
| Feature gating | `payments/access.js` → `hasFeature(FEATURE.X)` | `license/licenseManager.js` → `getLimit()` / `hasFeature()` |
| Tests / lint | `npm test` (node --test), `npm run lint` — CI enforces both | none |
| Generation | Seeded PRNG (Mulberry32), sync, `generators/` | Web Worker (async), `workers/workerBridge.js` |

## Shared architecture (identical in both)

- `core/state.js` single source of truth; `syncSettingsFromDOM()` /
  `applyStateToDOM()`; `saveState()` debounced 500 ms.
- Window API: every public function exported on **both** `window.fnName`
  and `window._puzzleApp` in `main.js`.
- CSS cascade layers `base → layout → components → pages → utils`;
  dark-mode overrides go in `components` or higher.
- PDF pipeline: `pdf/pdfExport.js` orchestrator, `buildCtx()`, `drawHeader()`
  returns content-start Y, emoji via canvas fallback in `pdfHelpers.js`.
- "Adding a New Setting" is the same 7-step checklist in both CLAUDE.mds.

## Key divergence: the build

Both `bash build.sh` scripts bundle with esbuild and auto-stamp a content-hash
into `bundle.js?v=…` — no manual `?v=N` bump needed in either repo.

- **maths-suite** additionally stamps SRI hashes for CDN tags
  (`tools/stamp-sri.mjs`, needs network; `SKIP_SRI=1 bash build.sh` to skip
  offline). `bundle.js` is gitignored — not committed.
- **puzzle-suite** has no SRI stamping yet (its one CDN tag, Font Awesome, is
  unpinned — a candidate to port next). `bundle.js` **is** committed, which is
  redundant with CI rebuilding it on every deploy but currently harmless.

Serve either with `python3 -m http.server 8082` → `/puzzle-suite.html`.

## Porting between repos

Fixes often apply to both (renderers, PDF helpers, state sync, CSS layers).
When porting:

1. Check whether the target repo's copy has drifted — don't paste blindly.
   e.g. `pdfHelpers.js` and `history.js` have diverged in small ways.
2. maths-suite escapes with `esc()` (`renderers/htmlUtils.js`);
   puzzle-suite uses `escapeHTML()`. Same job, different name.
3. Payments/licensing code does **not** port — the backends are entirely
   different architectures.
4. maths-suite changes must pass `npm run lint` (zero warnings) and
   `npm test` before push; puzzle-suite has no harness, so verify in browser.

## Where things live

- Per-repo deep guides: `CLAUDE.md` at each repo root.
- Repo-specific skills: `maths-suite/.claude/skills/maths-suite-dev.md`
  (note: predates the auto cache-bust build — trust CLAUDE.md where they
  conflict) and `puzzle-suite/.claude/commands/puzzle-dev.md`.
- Both Pages deploys stage only runtime files (`puzzle-suite.html`,
  `index.html`, `puzzle-suite.css`, `bundle.js`, `.nojekyll`) into a `dist/`
  folder before publishing, so `.claude/`, `CLAUDE.md`, and other internal
  docs stay private. When adding a new runtime asset, add it to the "Stage
  deployable files" step in the relevant `deploy.yml`.

## Deployment reminders

- **maths-suite**: push to `main` triggers CI (lint + test + build + Pages
  deploy). Cloudflare Worker deploys separately via `wrangler deploy`.
- **puzzle-suite**: static site deploy; the Express server is run/hosted
  separately (`cd server && npm start`, needs `.env`).
