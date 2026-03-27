// renderers/keys.js — Answer Key: lists all questions with answers across 3 difficulty sets
import { renderKaTeX } from './katexRender.js';
import { esc } from './htmlUtils.js';
import { getOutcomesForTopics, getTopicOutcomeCodes } from '../core/outcomes.js';

export function renderKeys(container, generatedSets, settings) {
    if (!container) return;

    const showOutcomesHeader = settings?.psShowOutcomesHeader || false;
    const showOutcomeChips   = settings?.psShowOutcomeChips   || false;
    const activeTopics       = settings?.activeTopics         || [];
    const stage              = settings?.stage                || 'Stage 4';

    const sets = [
        { label: 'EASY',   color: '#10b981', questions: generatedSets.easy   || [] },
        { label: 'MEDIUM', color: '#f59e0b', questions: generatedSets.medium || [] },
        { label: 'HARD',   color: '#ef4444', questions: generatedSets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sets.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">No questions generated yet.</div>';
        return;
    }

    let html = '';

    // ── Outcomes summary header (key page only) ──────────────
    if (showOutcomesHeader && activeTopics.length > 0) {
        const outcomes = getOutcomesForTopics(activeTopics, stage);
        html += `<div class="outcomes-ws-header">
            <div class="outcomes-ws-title">NESA ${esc(stage)} Outcomes</div>
            <div class="outcomes-ws-list">${outcomes.map(o => `
                <div class="outcomes-ws-row${o.appliesAll ? ' outcomes-ws-row--wm' : ''}">
                    <span class="outcomes-ws-pill">${esc(o.code)}</span>
                    <span class="outcomes-ws-desc"><strong>${esc(o.contentLabel)}</strong> — ${esc(o.statement)}</span>
                </div>`).join('')}
            </div>
        </div>`;
    }

    html += '<div class="key-sets-grid">';

    sets.forEach(set => {
        html += `<div class="key-section">
            <div class="key-section-title" style="color:${set.color}; border-bottom: 2px solid ${set.color}40;">${set.label}</div>
            <ol class="key-list">`;
        set.questions.forEach((q, i) => {
            const clue  = esc(q.clue || '');
            const ans   = esc(q.answerDisplay || q.answer || '');
            // Use q.notes (sub-topic key e.g. 'Integers') for outcome lookup;
            // q.topic is the mapped display category ('Number') which has no TOPIC_OUTCOME_MAP entry.
            const chips = showOutcomeChips && q.notes
                ? getTopicOutcomeCodes(q.notes, stage)
                    .map(c => `<span class="q-outcome-chip">${esc(c)}</span>`).join('')
                : '';
            html += `<li class="key-item">
                <span class="key-clue katex-target">${clue}</span>
                <span class="key-answer">${ans}</span>
                ${chips ? `<div class="q-outcome-chips" style="margin-top:2px;">${chips}</div>` : ''}
            </li>`;
        });
        html += '</ol></div>';
    });

    html += '</div>';
    container.innerHTML = html;
    renderKaTeX(container);
}

