// core/history.js — Undo / Redo for topic selection, sub-ops, pages-per-band,
// NESA stage, 5.3 Path and the outcome filter. Pure logic lives in
// historyCore.js (unit-tested); this file only wires it to state + DOM.
//
// Call pushHistory() AFTER a mutation (and once at init) — it records the
// state as it is now; undo() then steps back to the previously recorded one.
import { state } from './state.js';
import { snapshotFrom, restoreInto, createHistory } from './historyCore.js';

const hist = createHistory(50);

export function pushHistory() {
    hist.record(snapshotFrom(state));
    _updateButtons();
}

// Restore the controls that main.js does not rebuild itself. The caller's
// onComplete re-renders topic/sub-op/outcome panels and regenerates.
function _applySnapToDOM(snap) {
    const radio = document.querySelector(`input[name="stage-selector"][value="${snap.stage}"]`);
    if (radio) radio.checked = true;
    const pathChk = document.getElementById('include-path-toggle');
    if (pathChk) pathChk.checked = !!snap.includePath;
    const pathWrapper = document.getElementById('path-toggle-wrapper');
    if (pathWrapper) pathWrapper.style.display = snap.stage === 'Stage 5' ? 'block' : 'none';
    const qps = document.getElementById('questionsPerSet');
    if (qps) qps.value = snap.questionsPerSet;
}

function _restore(snap, onComplete) {
    if (!snap) return;
    restoreInto(state, snap);
    _applySnapToDOM(snap);
    _updateButtons();
    if (onComplete) onComplete();
}

export function undo(onComplete) { _restore(hist.undo(), onComplete); }
export function redo(onComplete) { _restore(hist.redo(), onComplete); }

export function canUndo() { return hist.canUndo(); }
export function canRedo() { return hist.canRedo(); }

function _updateButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = !canUndo();
    if (r) r.disabled = !canRedo();
}
