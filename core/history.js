// core/history.js — Undo / Redo for generation-shaping state: topic and
// sub-op selection, questionsPerSet, the outcome filter, and stage/Path.
import { state, ALL_SUBTOPICS, SUB_OPS, topicSlug, subOpDomId } from './state.js';

const MAX_HISTORY = 50;
let history      = [];
let historyIndex = -1;

function snapshot() {
    return {
        selectedTopics:   JSON.parse(JSON.stringify(state.selectedTopics)),
        selectedSubOps:   JSON.parse(JSON.stringify(state.selectedSubOps)),
        selectedOutcomes: JSON.parse(JSON.stringify(state.selectedOutcomes)),
        stage:            state.stage,
        includePath:      state.includePath,
        questionsPerSet:  state.questionsPerSet,
    };
}

export function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot());
    if (history.length > MAX_HISTORY) history.shift();
    else historyIndex++;
    _updateButtons();
}

function _applySnapToDOM(snap) {
    ALL_SUBTOPICS.forEach(t => {
        const el = document.getElementById('topic-' + topicSlug(t));
        if (el) el.checked = snap.selectedTopics[t] !== false;

        // Restore sub-op checkboxes
        const ops = SUB_OPS[t];
        if (!ops) return;
        const enabledOps = snap.selectedSubOps?.[t];
        ops.forEach(op => {
            const subEl = document.getElementById(subOpDomId(t, op.key));
            if (subEl) subEl.checked = enabledOps ? enabledOps.includes(op.key) : true;
        });
    });
    const qps = document.getElementById('questionsPerSet');
    if (qps) qps.value = snap.questionsPerSet;

    // Stage selector + Path toggle. The stage-dependent topic list itself is
    // rebuilt by the caller's onComplete (renderTopicTogglesByStrand in
    // main.js) — history.js only owns the simple controls.
    if (snap.stage) {
        const radio = document.querySelector(`input[name="stage-selector"][value="${snap.stage}"]`);
        if (radio) radio.checked = true;
        const wrapper = document.getElementById('path-toggle-wrapper');
        if (wrapper) wrapper.style.display = snap.stage === 'Stage 5' ? 'block' : 'none';
    }
    const pathChk = document.getElementById('include-path-toggle');
    if (pathChk) pathChk.checked = !!snap.includePath;
}

function _restoreState(snap) {
    Object.assign(state.selectedTopics, snap.selectedTopics);
    state.selectedSubOps = JSON.parse(JSON.stringify(snap.selectedSubOps ?? {}));
    // Replace (don't merge) so codes selected after the snapshot don't linger.
    state.selectedOutcomes = JSON.parse(JSON.stringify(snap.selectedOutcomes ?? {}));
    if (snap.stage) state.stage = snap.stage;
    state.includePath = !!snap.includePath;
    state.questionsPerSet = snap.questionsPerSet;
}

export function undo(onComplete) {
    if (historyIndex <= 0) return;
    historyIndex--;
    const snap = history[historyIndex];
    _restoreState(snap);
    _applySnapToDOM(snap);
    _updateButtons();
    if (onComplete) onComplete();
}

export function redo(onComplete) {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    const snap = history[historyIndex];
    _restoreState(snap);
    _applySnapToDOM(snap);
    _updateButtons();
    if (onComplete) onComplete();
}

export function canUndo() { return historyIndex > 0; }
export function canRedo() { return historyIndex < history.length - 1; }

function _updateButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = !canUndo();
    if (r) r.disabled = !canRedo();
}
