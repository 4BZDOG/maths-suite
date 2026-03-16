// renderers/keys.js — Answer Key: lists all questions with answers across 3 difficulty sets
import { renderKaTeX } from './katexRender.js';

export function renderKeys(container, generatedSets, settings) {
    if (!container) return;

    const sets = [
        { label: 'EASY',   color: '#10b981', questions: generatedSets.easy   || [] },
        { label: 'MEDIUM', color: '#f59e0b', questions: generatedSets.medium || [] },
        { label: 'HARD',   color: '#ef4444', questions: generatedSets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sets.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No questions generated yet.</div>';
        return;
    }

    let html = '<div class="key-sets-grid">';

    sets.forEach(set => {
        html += `<div class="key-section">
            <div class="key-section-title" style="color:${set.color}; border-bottom: 2px solid ${set.color}40;">${set.label}</div>
            <ol class="key-list">`;
        set.questions.forEach((q, i) => {
            const clue = esc(q.clue || '');
            const ans  = esc(q.answerDisplay || q.answer || '');
            html += `<li class="key-item">
                <span class="key-clue katex-target">${clue}</span>
                <span class="key-answer">${ans}</span>
            </li>`;
        });
        html += '</ol></div>';
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);
}

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
