// =============================================================
// renderers/scramble.js — Page 4: Expression Scramble preview
// (Replaces Word Scramble for the maths edition)
// =============================================================
import { renderKaTeX } from './katexRender.js';

/**
 * Render the Expression Scramble page.
 * Shows the scrambled answer token plus the KaTeX-rendered clue below it.
 *
 * @param {HTMLElement} container
 * @param {Array}       scrData    - puzzleData.scr (array of {original, scrambled, clue, answerDisplay})
 * @param {Object}      settings   - state.settings
 */
export function renderScramble(container, scrData, settings) {
    if (!container) return;

    if (!scrData || !scrData.length) {
        container.innerHTML = '<div style="color:var(--text-muted)">No Data</div>';
        return;
    }

    const showHint = settings.scrShowHint;
    let htmlStr = '<div class="scramble-container">';

    scrData.forEach(item => {
        const scrambled = item.scrambled || '';
        const original  = item.original  || '';
        const clue      = item.clue      || '';

        htmlStr += `<div class="scramble-item">
            <div class="scramble-text">${esc(scrambled)}</div>
            <div class="scramble-line"></div>
            ${showHint ? `<div class="scramble-hint">(starts with: ${esc(original[0] || '')})</div>` : ''}
            ${clue ? `<div class="scramble-clue katex-target">${esc(clue)}</div>` : ''}
        </div>`;
    });

    htmlStr += '</div>';
    container.innerHTML = htmlStr;

    renderKaTeX(container);
}

function esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
