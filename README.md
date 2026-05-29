# Maths Suite

A browser-based worksheet generator that produces differentiated **NESA-aligned
maths question sets** (Stage 4 & Stage 5) and exports them to a single vector PDF.
Questions are generated locally from a seeded PRNG — no API or account required.

## Quick Start

```bash
# Serve locally (required — ES modules don't load from file://)
python3 -m http.server 8082
# then open http://localhost:8082/puzzle-suite.html
```

## Build

```bash
bash build.sh
# Bundles all JS via esbuild → bundle.js (minified)
```

After rebuilding, bump the cache-bust query param in `puzzle-suite.html`
(the `python3 -m http.server` dev server caches aggressively):

```html
<script src="bundle.js?v=N"></script>
```

> CI does **not** require a local build before pushing — GitHub Actions runs
> `bash build.sh` automatically on every push to `main` and deploys to Pages.

## Pages

Each export contains up to four pages, reorderable in the sidebar:

| Page | Description |
|------|-------------|
| **Easy** | A grid of easy-band questions (0 working lines). |
| **Medium** | Medium-band questions (1 working line). |
| **Hard** | Hard-band questions (2 working lines). |
| **Answer Key** | Compact key for all visible questions; optional worked solutions. |

An optional **Formula Sheet** can be appended, with formula groups shown
per difficulty band.

## Topics

Thirteen topics span NESA Stage 4 and Stage 5 (with optional 5.3 *Path* content):

Computation with Integers · Decimals · Rounding · Fractions · Percentages ·
Ratios & Rates · Algebraic Techniques · Measurement & Geometry · Data Analysis ·
Probability · Financial Mathematics · Trigonometry · Non-linear Relationships

Each topic exposes selectable **sub-operations** (e.g. Integers → add / subtract /
multiply / divide / BODMAS). Stage 5 unlocks additional sub-operations such as
expand, factorise, solve quadratics, index laws, and (under *Path*) simultaneous
equations and surds.

## Features

- **Stage selector** — Stage 4 or Stage 5; a *Path* toggle adds 5.3 content.
- **NESA outcome filter** — restrict generation to selected syllabus outcome
  codes (MA4-* / MA5-*); the question header can show outcomes and per-question
  outcome chips.
- **Geometry diagrams** — inline SVG figures for rectangles, triangles
  (right-angle / angles / area), circles, parallelograms, trapezia, parabolas,
  angle configurations, and right-triangle trig.
- **Seeded & reproducible** — the same seed regenerates the identical set, so a
  worksheet can be shared or re-exported deterministically.
- **PDF export** — single vector PDF via jsPDF; KaTeX-rendered maths; emoji
  supported via a canvas fallback.
- **Watermark** — upload a PNG/JPG logo and set its opacity.
- **Fonts** — Inter, Roboto, Lora, Comic Neue (loaded lazily on export).
- **Paper size** — A4 (210 × 297 mm) or US Letter (215.9 × 279.4 mm).
- **Typography controls** — global font scale, per-page scales, title scale,
  column count.
- **Bulk export** — generate N unique sets in one PDF (gated by tier).

Settings persist to `localStorage` (key `puzzleSuiteV63`) and restore on reload.
Undo/redo (Ctrl+Z / Ctrl+Y) covers the last 50 changes.

## Project Structure

See [`CLAUDE.md`](CLAUDE.md) for the full repository map and architecture notes.
Key entry points:

```
puzzle-suite.html   App shell & settings sidebar
puzzle-suite.css    All styles (CSS @layer: base › layout › components › pages › utils)
main.js             Entry point; wires events; exposes the window API
bundle.js           Minified esbuild output (do not edit by hand)

core/               state, storage, history (undo/redo), NESA outcomes
generators/         mathsQuestionGen.js — seeded question generator
renderers/          HTML preview (problemSet, keys, diagramSVG, KaTeX)
pdf/                PDF export pipeline (orchestrator, helpers, drawers)
ui/                 sidebar, dark mode, modal, toast, zoom, page order, access panel
payments/           tier/feature gating + Stripe client
stripe-worker/      Cloudflare Worker (server-side Stripe proxy)
```

## Payments (optional)

Pro features are gated by a tier system (`payments/`). The Stripe integration is
served by a Cloudflare Worker (`stripe-worker/`) so the browser never holds a
secret key. Both are inert until configured — see
[`STRIPE_INTEGRATION.md`](STRIPE_INTEGRATION.md).
