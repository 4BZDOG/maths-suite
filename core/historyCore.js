// core/historyCore.js — DOM-free undo/redo logic (snapshot, restore, stack).
// Kept free of imports so it can be unit-tested under plain Node
// (test/history-core.test.mjs). core/history.js wires it to the DOM.

/**
 * Deep-copy the undoable slice of app state: topic/sub-op selection,
 * pages-per-band, NESA stage, 5.3 Path flag and the outcome filter.
 */
export function snapshotFrom(st) {
    return {
        selectedTopics:  { ...(st.selectedTopics  ?? {}) },
        selectedSubOps:  JSON.parse(JSON.stringify(st.selectedSubOps ?? {})),
        questionsPerSet: st.questionsPerSet,
        stage:           st.stage,
        includePath:     !!st.includePath,
        selectedOutcomes: { ...(st.selectedOutcomes ?? {}) },
    };
}

function _replace(target, source) {
    Object.keys(target).forEach(k => { delete target[k]; });
    Object.assign(target, source);
}

/**
 * Write a snapshot back into `st` (mutating it in place so existing
 * references stay valid). Fields absent from older snapshots are left alone.
 */
export function restoreInto(st, snap) {
    _replace(st.selectedTopics, snap.selectedTopics ?? {});
    st.selectedSubOps = JSON.parse(JSON.stringify(snap.selectedSubOps ?? {}));
    if (snap.questionsPerSet !== undefined) st.questionsPerSet = snap.questionsPerSet;
    if (snap.stage !== undefined)           st.stage = snap.stage;
    if (snap.includePath !== undefined)     st.includePath = !!snap.includePath;
    if (snap.selectedOutcomes) {
        if (!st.selectedOutcomes) st.selectedOutcomes = {};
        _replace(st.selectedOutcomes, snap.selectedOutcomes);
    }
}

// Treat `false` and absent keys as equal for boolean maps so a "cleared"
// outcome filter is not seen as a change.
function _truthyKeys(o) {
    return Object.keys(o ?? {}).filter(k => o[k]).sort();
}

export function snapshotsEqual(a, b) {
    if (!a || !b) return false;
    return a.questionsPerSet === b.questionsPerSet
        && a.stage === b.stage
        && a.includePath === b.includePath
        && JSON.stringify(_truthyKeys(a.selectedOutcomes)) === JSON.stringify(_truthyKeys(b.selectedOutcomes))
        && JSON.stringify(Object.keys(a.selectedTopics).sort().map(k => [k, !!a.selectedTopics[k]]))
            === JSON.stringify(Object.keys(b.selectedTopics).sort().map(k => [k, !!b.selectedTopics[k]]))
        && JSON.stringify(Object.keys(a.selectedSubOps).sort().map(k => [k, a.selectedSubOps[k]]))
            === JSON.stringify(Object.keys(b.selectedSubOps).sort().map(k => [k, b.selectedSubOps[k]]));
}

/**
 * History stack. `record(snap)` stores the state AFTER a change (the first
 * record is the initial state), so undo() returns the previous state and
 * redo() the next. Recording an unchanged state is a no-op.
 */
export function createHistory(max = 50) {
    let stack = [];
    let idx = -1;
    return {
        record(snap) {
            if (idx >= 0 && snapshotsEqual(stack[idx], snap)) return false;
            stack = stack.slice(0, idx + 1);
            stack.push(snap);
            if (stack.length > max) stack.shift();
            else idx++;
            return true;
        },
        undo() { return idx > 0 ? stack[--idx] : null; },
        redo() { return idx < stack.length - 1 ? stack[++idx] : null; },
        canUndo: () => idx > 0,
        canRedo: () => idx < stack.length - 1,
        get length() { return stack.length; },
    };
}
