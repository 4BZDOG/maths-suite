// =============================================================
// renderers/wordSearch.js — Page 2: Number Search preview
// (Replaces Word Search for the maths edition)
// =============================================================
import { renderKaTeX } from './katexRender.js';
import { esc } from './htmlUtils.js';

const CELL_SIZE_MIN = 15, CELL_SIZE_MAX = 60;

export function calcWSScale(wsData, isPrint = false) {
    const w = isPrint ? 750 : 640, h = 680;
    const sz = Math.max(1, wsData?.size || 1);
    return Math.min(CELL_SIZE_MAX, Math.max(CELL_SIZE_MIN, Math.floor(Math.min(w / sz, h / sz))));
}

/**
 * Render the Number Search grid and clue list (KaTeX-rendered).
 * @param {HTMLElement} gridArea    - .p2-area container
 * @param {HTMLElement} footerArea  - .p2-footer container
 * @param {Object}      wsData      - puzzleData.ws (Number Search data)
 * @param {Array}       clueBank    - state.clueBank (for clue lookups)
 * @param {Object}      settings    - state.settings
 * @param {boolean}     preview     - true = use sidebar scale slider
 */
export function renderWordSearch(gridArea, footerArea, wsData, clueBank, settings, preview = true) {
    const z = preview
        ? (() => { const el = document.getElementById('scaleSearch'); return el ? parseInt(el.value, 10) : calcWSScale(wsData); })()
        : calcWSScale(wsData);

    if (gridArea) {
        gridArea.innerHTML = '';
        if (!wsData) { gridArea.innerHTML = '<div style="color:var(--text-muted)">No Data</div>'; return; }

        const showGrid = settings.wsInternalGrid;

        let htmlStr = `<div class="grid mode-search ${showGrid ? 'with-internal-grid' : ''}" style="grid-template-columns: repeat(${wsData.size}, ${z}px); grid-template-rows: repeat(${wsData.size}, ${z}px);">`;

        for (let y = 0; y < wsData.size; y++) {
            for (let x = 0; x < wsData.size; x++) {
                htmlStr += `<div class="cell" style="--cell-size: ${z}px;">${esc(wsData.grid[y][x])}</div>`;
            }
        }
        htmlStr += `</div>`;
        gridArea.innerHTML = htmlStr;
    }

    if (footerArea && wsData) {
        const placedItems = wsData.placed || [];
        const gridPx = wsData.size * z;

        // Number Search always shows math clues — student evaluates to find what to look for
        const count = placedItems.length;
        const cols = count <= 6 ? 2 : 3;

        const rows = placedItems.map((item, i) => {
            // item may be an object { answer, clue, ... } or a legacy string
            const clue = (typeof item === 'object') ? (item.clue || '') : '';
            const ans  = (typeof item === 'object') ? (item.answer || item.token || '') : item;
            const len  = String(ans).length;
            const clueHtml = clue
                ? `<span class="katex-target">${esc(clue)}</span> <span class="notes-clue-length">(${len})</span>`
                : `<code class="answer-token">${esc(String(ans))}</code>`;
            return `<div class="wb-item" style="margin-bottom:8px; break-inside:avoid;"><span class="wb-check"></span><div>${i + 1}. ${clueHtml}</div></div>`;
        });

        footerArea.innerHTML = `<div style="width:${gridPx}px; margin:0 auto;">
            <div class="ns-clue-label">Evaluate each expression, then find the answer in the grid:</div>
            <div class="word-bank-styled" style="column-count:${cols}; display:block; column-gap:20px;">
                ${rows.join('')}
            </div>
        </div>`;

        renderKaTeX(footerArea);
    }
}

