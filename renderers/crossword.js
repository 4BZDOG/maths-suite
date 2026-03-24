// =============================================================
// renderers/crossword.js — Page 3: Maths Crossword preview
// =============================================================
import { renderKaTeX } from './katexRender.js';

const CELL_SIZE_MIN = 15, CELL_SIZE_MAX = 60;

export function calcCWScale(cwData, isPrint = false) {
    const w = isPrint ? 750 : 640, h = 500;
    const cols = Math.max(1, cwData?.cols || 1);
    const rows = Math.max(1, cwData?.rows || 1);
    return Math.min(CELL_SIZE_MAX, Math.max(CELL_SIZE_MIN, Math.floor(Math.min(w / cols, h / rows))));
}

/**
 * @param {HTMLElement} gridArea
 * @param {HTMLElement} footerArea
 * @param {Object}      cwData     - puzzleData.cw
 * @param {Object}      settings   - state.settings
 * @param {boolean}     preview
 */
export function renderCrossword(gridArea, footerArea, cwData, settings, preview = true) {
    const z = preview
        ? (() => { const el = document.getElementById('scaleCrossword'); return el ? parseInt(el.value, 10) : calcCWScale(cwData); })()
        : calcCWScale(cwData);

    if (gridArea) {
        gridArea.innerHTML = '';
        if (!cwData || cwData.placed.length === 0) {
            gridArea.innerHTML = `<div style="color:var(--danger); text-align:center; padding:40px;">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:12px; display:block;"></i>
                <h3 style="margin:0 0 8px 0;">Crossword Generation Incomplete</h3>
                <p style="color:var(--text-muted); margin:0;">Answers could not connect. Try adding more clues with longer answers, or mix topics.</p>
            </div>`;
            if (footerArea) footerArea.innerHTML = '';
            return;
        }

        let htmlStr = `<table class="mode-cw" style="--cell-size: ${z}px;">`;

        for (let y = 0; y < cwData.rows; y++) {
            htmlStr += `<tr>`;
            for (let x = 0; x < cwData.cols; x++) {
                const v = cwData.grid[y][x];
                if (v) {
                    htmlStr += `<td class="cell" style="width: ${z}px; height: ${z}px;"><span class="cell-num">${v.num || ''}</span></td>`;
                } else {
                    htmlStr += `<td class="cell empty" style="width: ${z}px; height: ${z}px;"></td>`;
                }
            }
            htmlStr += `</tr>`;
        }
        htmlStr += `</table>`;
        gridArea.innerHTML = htmlStr;
    }

    if (footerArea && cwData && cwData.placed.length) {
        const ac = cwData.placed.filter(w => w.dir === 'across').sort((a, b) => a.num - b.num);
        const dn = cwData.placed.filter(w => w.dir === 'down').sort((a, b) => a.num - b.num);

        // Clue uses item.clue (math expression); word length shown in chars
        const makeClueRows = (list) =>
            list.map(w => {
                const clue = w.clue || w.word;
                return `<div class="clue-row"><span class="clue-num-bold">${w.num}.</span><span class="katex-target">${esc(clue)} <span class="notes-clue-length">(${w.word.length})</span></span></div>`;
            }).join('');

        let html = '<div class="clues-two-col">';
        if (ac.length) html += `<div class="clue-col"><div class="clue-group-title first">ACROSS</div>${makeClueRows(ac)}</div>`;
        if (dn.length) html += `<div class="clue-col"><div class="clue-group-title first">DOWN</div>${makeClueRows(dn)}</div>`;
        html += '</div>';

        if (settings.cwShowBank) {
            const bk = cwData.placed.map(x => x.answerDisplay || x.word).sort();
            const ml = bk.reduce((m, w) => Math.max(m, w.length), 0);
            let c = 4;
            if (ml > 10) c = 3;
            if (ml > 15) c = 2;
            html += `<div style="border-top:1px solid #cbd5e1; margin-top:20px; padding-top:20px;">
                <div class="word-bank-label">Answer Bank:</div>
                <div class="word-bank-styled" style="column-count:${c}; display:block; column-gap:20px;">
                    ${bk.map(w => `<div class="wb-item" style="margin-bottom:6px"><span class="wb-check"></span> ${esc(w)}</div>`).join('')}
                </div>
            </div>`;
        }
        footerArea.innerHTML = html;
        renderKaTeX(footerArea);
        if (preview) _autoScaleCluesToFit(footerArea);
    }
}

function _autoScaleCluesToFit(footerEl) {
    const pageEl = footerEl.closest('.page');
    if (!pageEl) return;
    const container = footerEl.querySelector('.clues-two-col');
    if (!container) return;
    container.style.fontSize = '';
    const minH = parseFloat(getComputedStyle(pageEl).minHeight);
    if (pageEl.scrollHeight <= minH + 2) return;
    const curFontPx = parseFloat(getComputedStyle(container).fontSize);
    const MIN_PT = 5.5;
    let pt = curFontPx * 0.75;
    while (pageEl.scrollHeight > minH + 2 && pt > MIN_PT) {
        pt = Math.max(MIN_PT, pt - 0.25);
        container.style.fontSize = pt + 'pt';
    }
}

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
