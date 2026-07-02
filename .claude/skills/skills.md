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

- **maths-suite**: `bash build.sh` does everything — esbuild + SRI stamping +
  automatic cache-bust into `bundle.js?v=…`. **No manual `?v=N` bump.**
  `bundle.js` is gitignored. Offline: `SKIP_SRI=1 bash build.sh`.
- **puzzle-suite**: `bash build.sh` only bundles. You **must manually bump**
  `?v=N` in the last `<script>` tag of `puzzle-suite.html`. `bundle.js` is
  committed.

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
- Neither repo's docs are ever published: both GitHub Pages deploys stage
  only runtime files (`*.html`, `*.css`, `bundle.js`), so `.claude/`,
  `CLAUDE.md`, and internal notes stay private.

## Deployment reminders

- **maths-suite**: push to `main` triggers CI (lint + test + build + Pages
  deploy). Cloudflare Worker deploys separately via `wrangler deploy`.
- **puzzle-suite**: static site deploy; the Express server is run/hosted
  separately (`cd server && npm start`, needs `.env`).
