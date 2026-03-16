// core/history.js — Undo / Redo for topic selection + questionsPerSet
import { state } from './state.js';

const MAX_HISTORY = 50;
let history      = [];
let historyIndex = -1;

function snapshot() {
    return {
        selectedTopics: JSON.parse(JSON.stringify(state.selectedTopics)),
        questionsPerSet: state.questionsPerSet,
    };
}

export function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(snapshot());
    if (history.length > MAX_HISTORY) history.shift();
    else historyIndex++;
    _updateButtons();
}

export function undo(onComplete) {
    if (historyIndex <= 0) return;
    historyIndex--;
    const snap = history[historyIndex];
    Object.assign(state.selectedTopics, snap.selectedTopics);
    state.questionsPerSet = snap.questionsPerSet;
    _updateButtons();
    if (onComplete) onComplete();
}

export function redo(onComplete) {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    const snap = history[historyIndex];
    Object.assign(state.selectedTopics, snap.selectedTopics);
    state.questionsPerSet = snap.questionsPerSet;
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
