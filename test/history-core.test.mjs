import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotFrom, restoreInto, snapshotsEqual, createHistory } from '../core/historyCore.js';

const mk = () => ({
    selectedTopics: { Integers: true, Fractions: false },
    selectedSubOps: { Integers: ['add'] },
    questionsPerSet: 1,
    stage: 'Stage 4',
    includePath: false,
    selectedOutcomes: {},
});

test('snapshot is a deep copy', () => {
    const st = mk();
    const snap = snapshotFrom(st);
    st.selectedTopics.Integers = false;
    st.selectedSubOps.Integers.push('sub');
    st.selectedOutcomes['MA4-1WM'] = true;
    assert.equal(snap.selectedTopics.Integers, true);
    assert.deepEqual(snap.selectedSubOps.Integers, ['add']);
    assert.deepEqual(snap.selectedOutcomes, {});
});

test('snapshot captures stage, path and outcome filter', () => {
    const st = mk();
    st.stage = 'Stage 5'; st.includePath = true; st.selectedOutcomes = { 'MA5-INT-C-01': true };
    const snap = snapshotFrom(st);
    assert.equal(snap.stage, 'Stage 5');
    assert.equal(snap.includePath, true);
    assert.deepEqual(snap.selectedOutcomes, { 'MA5-INT-C-01': true });
});

test('restoreInto replaces (not merges) maps and keeps references', () => {
    const st = mk();
    const topicsRef = st.selectedTopics;
    const snap = snapshotFrom(st);
    st.stage = 'Stage 5'; st.includePath = true;
    topicsRef.Algebra = true; delete topicsRef.Fractions;
    st.selectedOutcomes = { X: true };
    restoreInto(st, snap);
    assert.equal(st.selectedTopics, topicsRef);
    assert.deepEqual(st.selectedTopics, { Integers: true, Fractions: false });
    assert.equal(st.stage, 'Stage 4');
    assert.equal(st.includePath, false);
    assert.deepEqual(st.selectedOutcomes, {});
    assert.deepEqual(st.selectedSubOps, { Integers: ['add'] });
});

test('restoreInto tolerates legacy snapshots without stage fields', () => {
    const st = mk(); st.stage = 'Stage 5'; st.selectedOutcomes = { A: true };
    restoreInto(st, { selectedTopics: { Integers: true }, selectedSubOps: {}, questionsPerSet: 2 });
    assert.equal(st.stage, 'Stage 5');
    assert.deepEqual(st.selectedOutcomes, { A: true });
    assert.equal(st.questionsPerSet, 2);
});

test('snapshotsEqual treats false and absent outcome keys alike', () => {
    const a = snapshotFrom(mk());
    const b = snapshotFrom({ ...mk(), selectedOutcomes: { 'MA4-1WM': false } });
    assert.ok(snapshotsEqual(a, b));
    assert.ok(!snapshotsEqual(a, snapshotFrom({ ...mk(), stage: 'Stage 5' })));
});

test('history: record-after-change, undo/redo across stage + outcome changes', () => {
    const st = mk();
    const h = createHistory(50);
    h.record(snapshotFrom(st));                                                  // S0 initial
    st.selectedTopics.Fractions = true; h.record(snapshotFrom(st));              // S1
    st.stage = 'Stage 5'; st.includePath = true; h.record(snapshotFrom(st));     // S2
    st.selectedOutcomes = { 'MA5-INT-C-01': true }; h.record(snapshotFrom(st));  // S3

    restoreInto(st, h.undo());
    assert.deepEqual(st.selectedOutcomes, {});
    assert.equal(st.stage, 'Stage 5');
    restoreInto(st, h.undo());
    assert.equal(st.stage, 'Stage 4');
    assert.equal(st.includePath, false);
    assert.equal(st.selectedTopics.Fractions, true);
    restoreInto(st, h.undo());
    assert.equal(st.selectedTopics.Fractions, false);
    assert.equal(h.undo(), null);
    assert.ok(h.canRedo());
    restoreInto(st, h.redo());
    assert.equal(st.selectedTopics.Fractions, true);
});

test('history: new change after undo drops redo branch; duplicates ignored; capped', () => {
    const st = mk();
    const h = createHistory(3);
    h.record(snapshotFrom(st));
    assert.equal(h.record(snapshotFrom(st)), false);
    st.questionsPerSet = 2; h.record(snapshotFrom(st));
    h.undo();
    st.stage = 'Stage 5'; h.record(snapshotFrom(st));
    assert.ok(!h.canRedo());
    for (let i = 0; i < 5; i++) { st.includePath = !st.includePath; h.record(snapshotFrom(st)); }
    assert.equal(h.length, 3);
});
