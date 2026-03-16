// renderers/problemSet.js — Renders a set of maths questions (Easy/Medium/Hard)
import { renderKaTeX } from './katexRender.js';

const TOPIC_COLOURS = {
    'Number': '#3b82f6', 'Algebra': '#8b5cf6', 'Geometry': '#10b981',
    'Statistics': '#f59e0b', 'Financial Maths': '#ef4444',
    'Integers': '#3b82f6', 'Decimals': '#3b82f6', 'Rounding': '#3b82f6',
    'Fractions': '#3b82f6', 'Percentages': '#3b82f6',
};

const DIFF_COLOURS = { Easy: '#10b981', Medium: '#f59e0b', Hard: '#ef4444' };

export function renderProblemSet(container, questions, settings, difficultyLabel) {
    if (!container) return;

    const cols = settings.cols || 2;
    const showTopic = settings.showTopic || false;

    if (!questions || questions.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:40px;">
            No ${difficultyLabel || ''} questions generated yet.<br>
            <small>Select topics and click Generate.</small></div>`;
        return;
    }

    const colStyle = cols === 1 ? 'grid-template-columns: 1fr' : 'grid-template-columns: 1fr 1fr';
    const diffColor = DIFF_COLOURS[difficultyLabel] || '#64748b';

    let html = `<div class="problem-set-grid" style="display:grid; ${colStyle}; gap:16px 24px; padding:4px;">`;

    questions.forEach((item, i) => {
        const topicColor = TOPIC_COLOURS[item.topic] || '#64748b';
        const topicBadge = showTopic
            ? `<span class="topic-badge" style="background:${topicColor}20; color:${topicColor}; border:1px solid ${topicColor}40;">${item.topic}</span>`
            : '';

        // Working lines: Medium = 1, Hard = 2, Easy = 0
        const workingCount = item.difficulty === 'Hard' ? 2 : item.difficulty === 'Medium' ? 1 : 0;
        const workingHtml = workingCount > 0
            ? `<div class="problem-working-area">
                <span class="problem-working-label">Working:</span>
                ${'<span class="problem-working-line"></span>'.repeat(workingCount)}
               </div>`
            : '';

        html += `<div class="problem-item">
            <div class="problem-header">
                <span class="problem-num">${i + 1}.</span>
                ${topicBadge}
            </div>
            <div class="problem-clue katex-target">${esc(item.clue)}</div>
            ${workingHtml}
            <div class="problem-answer-box">
                <span class="problem-answer-label">Answer:</span>
                <span class="problem-answer-line"></span>
            </div>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
