// renderers/problemSet.js — Renders a set of maths questions (Easy/Medium/Hard)
import { renderKaTeX } from './katexRender.js';
import { esc } from './htmlUtils.js';

const TOPIC_COLOURS = {
    'Number': '#3b82f6', 'Algebra': '#8b5cf6', 'Geometry': '#10b981',
    'Statistics': '#f59e0b', 'Financial Maths': '#ef4444',
    'Integers': '#3b82f6', 'Decimals': '#3b82f6', 'Rounding': '#3b82f6',
    'Fractions': '#3b82f6', 'Percentages': '#3b82f6',
};

export function renderProblemSet(container, questions, settings, difficultyLabel) {
    if (!container) return;

    const cols = settings.cols || 2;
    const showTopic = settings.showTopic || false;
    const capOnePage = settings.psCapOnePage || false;

    if (!questions || questions.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px;">
            No ${difficultyLabel || ''} questions generated yet.<br>
            <small>Select topics and click Generate.</small></div>`;
        return;
    }

    const colStyle = cols === 1 ? 'grid-template-columns: 1fr' : 'grid-template-columns: 1fr 1fr';

    let html = `<div class="problem-set-grid" style="display:grid; ${colStyle}; gap:14px 20px; padding:4px;">`;

    questions.forEach((item, i) => {
        const topicColor = TOPIC_COLOURS[item.topic] || '#64748b';
        const topicBadge = showTopic
            ? `<span class="problem-tag" style="background:${topicColor}18; color:${topicColor}; border:1px solid ${topicColor}35;">${esc(item.topic)}</span>`
            : '';

        // Working lines: Hard = 2, Medium = 1, Easy = 0
        const workingCount = item.difficulty === 'Hard' ? 2 : item.difficulty === 'Medium' ? 1 : 0;
        const workingHtml = workingCount > 0
            ? `<div class="problem-working-area">
                <span class="problem-working-label">Working:</span>
                ${'<span class="problem-working-line"></span>'.repeat(workingCount)}
               </div>`
            : '';

        html += `<div class="problem-item">
            <div class="problem-clue-row">
                <span class="problem-num">${i + 1}.</span>
                <div class="problem-clue katex-target">${esc(item.clue)}</div>
            </div>
            ${workingHtml}
            <div class="problem-answer-box">
                <span class="problem-answer-label">Answer:</span>
                <span class="problem-answer-line"></span>
            </div>
            ${topicBadge}
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);

    // Cap-to-one-page: hide items that overflow the page container
    if (capOnePage) {
        _capToOnePage(container);
    }
}

/**
 * After render, measure which grid items overflow the page container and
 * remove them, replacing with an overflow notice.
 */
function _capToOnePage(container) {
    // Walk up to find the .page ancestor to get its usable height
    const page = container.closest('.page');
    if (!page) return;

    // clientHeight of .page minus its own padding (15mm ≈ used via CSS)
    const pageBottom = page.getBoundingClientRect().bottom;
    const grid = container.querySelector('.problem-set-grid');
    if (!grid) return;

    const items = Array.from(grid.querySelectorAll('.problem-item'));
    let hiddenCount = 0;

    // Read all rects in one pass (single forced reflow), then write in a second pass.
    const rects = items.map(item => item.getBoundingClientRect());
    for (let i = 0; i < items.length; i++) {
        if (rects[i].bottom > pageBottom - 4) {
            hiddenCount++;
            items[i].style.display = 'none';
        }
    }

    if (hiddenCount > 0) {
        const notice = document.createElement('div');
        notice.className = 'problem-overflow-notice';
        notice.textContent = `+ ${hiddenCount} more question${hiddenCount > 1 ? 's' : ''} (not shown — cap to 1 page is on)`;
        grid.appendChild(notice);
    }
}

