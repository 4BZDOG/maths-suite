// renderers/problemSet.js — Renders a set of maths questions (Easy/Medium/Hard)
import { renderKaTeX } from './katexRender.js';
import { esc, formatClue } from './htmlUtils.js';
import { getTopicOutcomeCodes, DEFAULT_STAGE } from '../core/outcomes.js';
import { renderDiagramSVG } from './diagramSVG.js';

const TOPIC_COLOURS = {
    'Number': '#3b82f6', 'Algebra': '#8b5cf6', 'Geometry': '#10b981',
    'Statistics': '#f59e0b', 'Financial Maths': '#ef4444',
    'Integers': '#3b82f6', 'Decimals': '#3b82f6', 'Rounding': '#3b82f6',
    'Fractions': '#3b82f6', 'Percentages': '#3b82f6',
};

export function renderProblemSet(container, questions, settings, difficultyLabel) {
    if (!container) return;

    const cols             = settings.cols || 2;
    const showTopic        = settings.showTopic || false;
    const showOutcomeChips = settings.psShowOutcomeChips || false;
    const capPages         = settings.psCapPages || 0;
    const showDiagrams     = settings.showDiagrams !== false;   // default true
    const stage            = settings.stage || DEFAULT_STAGE;

    if (!questions || questions.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px;">
            No ${difficultyLabel || ''} questions generated yet.<br>
            <small>Select topics and click Generate.</small></div>`;
        return;
    }

    const colStyle = cols === 1 ? 'grid-template-columns: 1fr' : 'grid-template-columns: 1fr 1fr';

    let html = `<div class="problem-set-grid" style="display:grid; ${colStyle}; gap:18px 20px; padding:4px;">`;

    questions.forEach((item, i) => {
        const topicColor = TOPIC_COLOURS[item.topic] || '#64748b';
        const topicBadge = showTopic
            ? `<span class="problem-tag" style="background:${topicColor}18; color:${topicColor}; border:1px solid ${topicColor}35;">${esc(item.topic)}</span>`
            : '';

        // item.notes holds the specific sub-topic key (e.g. 'Integers') which maps to outcomes;
        // item.topic is the display category ('Number') which does not match TOPIC_OUTCOME_MAP keys.
        const outcomeCodes = showOutcomeChips && item.notes
            ? getTopicOutcomeCodes(item.notes, stage)
            : [];
        const outcomeChipsHtml = outcomeCodes.map(c => `<span class="q-outcome-chip">${esc(c)}</span>`).join('');

        // Topic badge and outcome chips share one centered row beneath the answer line
        const metaRowHtml = (topicBadge || outcomeChipsHtml)
            ? `<div class="problem-meta-row">${topicBadge}${outcomeChipsHtml}</div>`
            : '';

        // Diagram (geometry questions only, when enabled)
        const diagramHtml = showDiagrams && item.diagram
            ? `<div class="problem-diagram">${renderDiagramSVG(item.diagram)}</div>`
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
                <div class="problem-clue katex-target">${formatClue(item.clue)}</div>
            </div>
            ${diagramHtml}
            ${workingHtml}
            <div class="problem-answer-box">
                <span class="problem-answer-label">Answer:</span>
                <span class="problem-answer-line"></span>
            </div>
            ${metaRowHtml}
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);

    // Cap-to-N-pages: hide items that overflow the specific page container amount
    if (capPages > 0) {
        return _capToPages(container, questions.length, capPages);
    }
    return questions.length;
}

/**
 * After render, measure which grid items overflow the page container and
 * remove them, replacing with an overflow notice.
 */
function _capToPages(container, total, capPages) {
    const page = container.closest('.page');
    if (!page) return total;

    const wasHidden = !page.classList.contains('visible');
    
    // Temporarily show the page to measure rects accurately if it is hidden
    if (wasHidden) {
        page.style.display = 'block';
        page.style.visibility = 'hidden';
        page.style.position = 'absolute';
        page.style.zIndex = '-9999';
    }

    const pageTop = page.getBoundingClientRect().top;
    const pageBottom = page.getBoundingClientRect().bottom;
    const pageHeight = pageBottom - pageTop;
    const limitBottom = pageTop + (pageHeight * capPages);

    const grid = container.querySelector('.problem-set-grid');
    if (!grid) {
        if (wasHidden) {
            page.style.display = '';
            page.style.visibility = '';
            page.style.position = '';
            page.style.zIndex = '';
        }
        return total;
    }

    const items = Array.from(grid.querySelectorAll('.problem-item'));
    let hiddenCount = 0;

    // Read all rects in one pass (single forced reflow), then write in a second pass.
    const rects = items.map(item => item.getBoundingClientRect());
    for (let i = 0; i < items.length; i++) {
        if (rects[i].bottom > limitBottom - 4) {
            hiddenCount++;
            items[i].style.display = 'none';
        }
    }

    if (hiddenCount > 0) {
        const notice = document.createElement('div');
        notice.className = 'problem-overflow-notice';
        notice.textContent = `+ ${hiddenCount} more question${hiddenCount > 1 ? 's' : ''} (not shown)`;
        grid.appendChild(notice);
    }

    if (wasHidden) {
        page.style.display = '';
        page.style.visibility = '';
        page.style.position = '';
        page.style.zIndex = '';
    }

    return total - hiddenCount;
}

