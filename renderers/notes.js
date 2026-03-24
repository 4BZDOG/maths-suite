// =============================================================
// renderers/notes.js — Page 1: Notes/vocabulary page preview
// =============================================================

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} container
 * @param {Object}      puzzleData  - state.puzzleData (notes may be null before gen)
 * @param {Array}       words       - state.words
 * @param {Object}      settings    - state.settings
 * @param {Function}    onUpdateWord(index, field, value)
 */
export function renderNotes(container, puzzleData, words, settings, onUpdateWord) {
    if (!container) return;
    _updateNotesStyles(settings);

    const targetData = puzzleData.notes || words.map(w => ({ term: w.word, clue: w.clue }));
    if (targetData.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:40px;">No words added yet.</div>';
        return;
    }

    const isMatching = settings.notesConfig.shuffle;
    let cls = 'notes-table';
    if (!settings.notesConfig.showTerm) cls += ' hide-term';
    if (!settings.notesConfig.showDef) cls += ' hide-def';

    let htmlStr = `<div class="${cls}">
        <div class="notes-header">
            <span class="notes-num" style="${isMatching ? 'width:60px' : ''}">#</span>
            <span class="notes-word-header">TERM</span>
            <span class="notes-clue-header">DEFINITION</span>
        </div>`;

    targetData.forEach((w, i) => {
        htmlStr += '<div class="notes-row">';
        htmlStr += isMatching
            ? `<span class="notes-num" style="width:60px">${i + 1}. ____</span>`
            : `<span class="notes-num">${i + 1}.</span>`;
        htmlStr += `<div class="notes-word"><div class="notes-editable" ${!isMatching ? 'contenteditable="true"' : ''} ${!isMatching ? `onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" onblur="window._puzzleApp.updateWord(${i}, 'word', this.innerText)"` : ''}>${esc(w.term)}</div></div>`;
        htmlStr += '<div class="notes-clue">';

        if (isMatching) {
            htmlStr += `<div class="notes-editable">${esc(w.matchLetter)}. ${esc(w.clue)}</div>`;
            htmlStr += `<span class="notes-clue-length">(${w.clueTermLength ?? w.term.length})</span>`;
        } else {
            htmlStr += `<div class="notes-editable" contenteditable="true" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}" onblur="window._puzzleApp.updateWord(${i}, 'clue', this.innerText)">${esc(w.clue)}</div>`;
            htmlStr += `<span class="notes-clue-length">(${w.term.length})</span>`;
        }

        htmlStr += '</div></div>';
    });

    htmlStr += '</div>';
    container.innerHTML = htmlStr;
}

/**
 * Apply CSS variables and classes that control notes column visibility.
 */
export function updateNotesStyles(settings) {
    _updateNotesStyles(settings);
}

function _updateNotesStyles(settings) {
    const cfg = settings.notesConfig;
    const tw = cfg.termWidth;
    const wVal = document.getElementById('notesWidthVal');
    if (wVal) wVal.innerText = tw + '%';
    document.documentElement.style.setProperty('--notes-term-width', tw + '%');

    const table = document.querySelector('.notes-table');
    if (table) {
        table.classList.toggle('hide-term', !cfg.showTerm);
        table.classList.toggle('hide-def', !cfg.showDef);
    }
}
