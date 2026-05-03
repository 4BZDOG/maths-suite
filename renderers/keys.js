// renderers/keys.js — Answer Key: lists all questions with answers across 3 difficulty sets
import { renderKaTeX } from './katexRender.js';
import { esc, formatClue } from './htmlUtils.js';
import { getOutcomesForTopics, DEFAULT_STAGE } from '../core/outcomes.js';

export function renderKeys(container, generatedSets, settings) {
    if (!container) return;

    const showOutcomesHeader = settings?.psShowOutcomesHeader || false;
    const activeTopics       = settings?.activeTopics         || [];
    const stage              = settings?.stage                || DEFAULT_STAGE;

    const sets = [
        { label: 'EASY',   icon: 'fa-seedling', color: '#10b981', questions: generatedSets.easy   || [] },
        { label: 'MEDIUM', icon: 'fa-bolt',     color: '#f59e0b', questions: generatedSets.medium || [] },
        { label: 'HARD',   icon: 'fa-fire',     color: '#ef4444', questions: generatedSets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sets.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No questions generated yet.</div>';
        return;
    }

    let html = '';

    // ── Outcomes summary header (key page only) ──────────────
    if (showOutcomesHeader && activeTopics.length > 0) {
        const outcomes = getOutcomesForTopics(activeTopics, stage);
        if (outcomes.length > 0) {
            const isLong = outcomes.length > 4;
            html += `<details class="outcomes-ws-header outcomes-ws-collapsible"${isLong ? '' : ' open'}>
                <summary class="outcomes-ws-summary">
                    <span class="outcomes-ws-title">NESA ${esc(stage)} Outcomes</span>
                    <span class="outcomes-ws-count">${outcomes.length}</span>
                </summary>
                <div class="outcomes-ws-list">${outcomes.map(o => `
                    <div class="outcomes-ws-row${o.appliesAll ? ' outcomes-ws-row--wm' : ''}">
                        <span class="outcomes-ws-pill">${esc(o.code)}</span>
                        <span class="outcomes-ws-desc"><strong>${esc(o.contentLabel)}</strong> — ${esc(o.statement)}</span>
                    </div>`).join('')}
                </div>
            </details>`;
        }
    }

    html += '<div class="key-sets-grid">';

    sets.forEach(set => {
        html += `<div class="key-section">
            <div class="key-section-title" style="color:${set.color}; border-bottom: 2px solid ${set.color}40;"><i class="fas ${set.icon}" style="margin-right:5px; opacity:.85;"></i>${set.label}</div>
            <ol class="key-list">`;
        set.questions.forEach((q, i) => {
            const ans = esc(q.answerDisplay || q.answer || '');
            html += `<li class="key-item">
                <div class="key-item-row">
                    <span class="key-num">${i + 1}.</span>
                    <span class="key-clue katex-target">${formatClue(q.clue)}</span>
                    <span class="key-answer">${ans}</span>
                </div>
            </li>`;
        });
        html += '</ol></div>';
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);
}
