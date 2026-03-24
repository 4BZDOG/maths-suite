// core/history.js — Undo / Redo for topic selection + questionsPerSet
import { state, ALL_SUBTOPICS } from './state.js';

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

function _applySnapToDOM(snap) {
    ALL_SUBTOPICS.forEach(t => {
        const id = 'topic-' + t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const el = document.getElementById(id);
        if (el) el.checked = snap.selectedTopics[t] !== false;
    });
    const qps = document.getElementById('questionsPerSet');
    if (qps) qps.value = snap.questionsPerSet;
}

export function undo(onComplete) {
    if (historyIndex <= 0) return;
    historyIndex--;
    const snap = history[historyIndex];
    Object.assign(state.selectedTopics, snap.selectedTopics);
    state.questionsPerSet = snap.questionsPerSet;
    _applySnapToDOM(snap);
    _updateButtons();
    if (onComplete) onComplete();
}

export function redo(onComplete) {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    const snap = history[historyIndex];
    Object.assign(state.selectedTopics, snap.selectedTopics);
    state.questionsPerSet = snap.questionsPerSet;
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
