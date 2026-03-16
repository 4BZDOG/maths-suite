// =============================================================
// renderers/wordList.js — Sidebar clue bank list & status badge
// (Updated for maths clue/answer schema)
// =============================================================
import { renderKaTeX } from './katexRender.js';

const TOPIC_COLOURS = {
    'Number':     '#3b82f6',
    'Algebra':    '#8b5cf6',
    'Geometry':   '#10b981',
    'Statistics': '#f59e0b',
    'Financial Maths': '#ef4444',
};

const escapeHTML = str => String(str || '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[tag]));

/**
 * Render the interactive clue-bank rows in the sidebar.
 * @param {HTMLElement} container
 * @param {Array}       clueBank     - state.clueBank
 * @param {Object}      puzzleData   - state.puzzleData
 * @param {number}      activePage   - state.activePage (1-5)
 * @param {Function}    onUpdate(index, field, value)
 * @param {Function}    onDelete(index)
 */
export function renderWordList(container, clueBank, puzzleData, activePage, onUpdate, onDelete) {
    if (!container) return;
    container.innerHTML = '';

    if (!clueBank || clueBank.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calculator"></i><br>No clues yet. Add some or import a CSV!</div>';
        return;
    }

    const TOPICS = ['Number', 'Algebra', 'Geometry', 'Statistics', 'Financial Maths'];
    const DIFFS  = ['Easy', 'Medium', 'Hard'];

    let htmlStr = '';
    clueBank.forEach((item, i) => {
        // Determine placement status based on active page
        const ans = (item.answer || '').replace(/\s/g, '');
        const normAns = ans.toUpperCase();

        const pWS  = puzzleData.ws?.placed?.some(p => (p.answer || p.token || p) === item.answer || (typeof p === 'string' && p === item.answer));
        const pCW  = puzzleData.cw?.placed?.some(x => x.answer === item.answer || x.word === normAns);
        const pSCR = puzzleData.scr?.some(x => x.original === item.answer);

        let statusClass;
        if (activePage === 2) {
            statusClass = pWS ? 'placed' : 'failed';
        } else if (activePage === 3) {
            statusClass = pCW ? 'placed' : 'failed';
        } else if (activePage === 4) {
            statusClass = pSCR ? 'placed' : 'failed';
        } else {
            statusClass = (pWS || pCW) ? 'placed' : 'failed';
        }

        const topicColor = TOPIC_COLOURS[item.topic] || '#64748b';
        const topicOptions = TOPICS.map(t =>
            `<option value="${t}" ${item.topic === t ? 'selected' : ''}>${t}</option>`
        ).join('');
        const diffOptions = DIFFS.map(d =>
            `<option value="${d}" ${item.difficulty === d ? 'selected' : ''}>${d}</option>`
        ).join('');

        htmlStr += `<div class="wm-row clue-row">
            <div class="wm-status ${statusClass}"></div>
            <div style="display:flex; flex-direction:column; gap:2px; flex-shrink:0; padding-right:2px;">
                <button class="wm-btn" style="height:16px; width:16px; font-size:10px; padding:0" onclick="window._puzzleApp.moveWordUp(${i})" ${i === 0 ? 'disabled' : ''} aria-label="Move Up">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="wm-btn" style="height:16px; width:16px; font-size:10px; padding:0" onclick="window._puzzleApp.moveWordDown(${i})" ${i === clueBank.length - 1 ? 'disabled' : ''} aria-label="Move Down">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
            <div class="clue-inputs">
                <div class="clue-row-top">
                    <input class="wm-input wm-word" value="${escapeHTML(item.answer)}"
                        onchange="window._puzzleApp.updateWord(${i},'answer',this.value)"
                        placeholder="Answer" aria-label="Answer ${i + 1}" title="Answer token placed in grid">
                    <select class="wm-select topic-select" style="color:${topicColor}; border-color:${topicColor}40;"
                        onchange="window._puzzleApp.updateWord(${i},'topic',this.value)"
                        aria-label="Topic">
                        ${topicOptions}
                    </select>
                    <select class="wm-select diff-select"
                        onchange="window._puzzleApp.updateWord(${i},'difficulty',this.value)"
                        aria-label="Difficulty">
                        ${diffOptions}
                    </select>
                </div>
                <input class="wm-input wm-clue" value="${escapeHTML(item.clue)}"
                    onkeyup="window._puzzleApp.updateWord(${i},'clue',this.value)"
                    placeholder="Clue (use $...$ for maths)" aria-label="Clue for item ${i + 1}">
                ${item.clue && item.clue.includes('$')
                    ? `<div class="clue-katex-preview katex-target">${escapeHTMLButDollar(item.clue)}</div>`
                    : ''}
            </div>
            <button class="wm-btn" onclick="window._puzzleApp.delWord(${i})"
                aria-label="Delete clue ${i + 1}">
                <i class="fas fa-times"></i>
            </button>
        </div>`;
    });
    container.innerHTML = htmlStr;
    renderKaTeX(container);
}

function escapeHTMLButDollar(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    // Leave $ intact so KaTeX can process $...$ delimiters
}

/**
 * Update the placed-count badge and status icon.
 */
export function renderStatus(clueBank, puzzleData, activePage) {
    let placed = 0;
    (clueBank || []).forEach(item => {
        const normAns = (item.answer || '').toUpperCase().replace(/\s/g, '');
        if (activePage === 2) {
            if (puzzleData.ws?.placed?.some(p => (p.answer || p.token || p) === item.answer)) placed++;
        } else if (activePage === 3) {
            if (puzzleData.cw?.placed?.some(x => x.answer === item.answer || x.word === normAns)) placed++;
        } else if (activePage === 4) {
            if (puzzleData.scr?.some(x => x.original === item.answer)) placed++;
        } else {
            if (
                puzzleData.ws?.placed?.some(p => (p.answer || p.token || p) === item.answer) ||
                puzzleData.cw?.placed?.some(x => x.answer === item.answer || x.word === normAns)
            ) placed++;
        }
    });

    const total = (clueBank || []).length;
    const pc = document.getElementById('placed-count');
    if (pc) pc.innerText = `${placed}/${total}`;

    const icon = document.getElementById('status-icon');
    if (icon) {
        if (placed === total && total > 0) {
            icon.className = 'status-icon icon-success';
            icon.innerHTML = '<i class="fas fa-check"></i>';
        } else {
            icon.className = 'status-icon icon-warning';
            icon.innerHTML = '<i class="fas fa-exclamation"></i>';
        }
    }
}

export function renderStatusGenerating() {
    const icon = document.getElementById('status-icon');
    if (icon) {
        icon.className = 'status-icon icon-generating';
        icon.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
    }
}
