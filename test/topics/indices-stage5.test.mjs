// =============================================================
// test/topics/indices-stage5.test.mjs — Stage 5 Indices verifiers.
//
// Evaluates the index expression in the clue independently (applying the
// zero-index, negative-index and reciprocal-base rules) and compares to the
// generator's answer.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { genStage5, DIFFS, approxEqual } from '../_helpers.mjs';

function clueValue(clue) {
    const spans = [...clue.matchAll(/\$([^$]+)\$/g)].map(s => s[1]);
    let e = spans.find(s => /\^/.test(s)) || spans[0];
    e = e
        .replace(/\\left\(\\frac\{1\}\{(\d+)\}\\right\)\^\{-(\d+)\}/g, '($1**$2)') // (1/B)^(-N) → B**N
        .replace(/(\d+)\^0/g, '1')                                                 // B^0 → 1
        .replace(/(\d+)\^\{-(\d+)\}/g, '(1/($1**$2))')                             // B^(-N) → 1/B**N
        .replace(/\\times/g, '*')
        .replace(/\\div/g, '/')
        .replace(/\s+/g, '');
    if (!/^[0-9+\-*/().]+$/.test(e)) throw new Error(`unsafe expr: ${e}`);
    return Function(`"use strict"; return (${e});`)();
}
function answerValue(a) {
    const f = String(a).match(/^1\/(\d+)$/);
    return f ? 1 / Number(f[1]) : Number(a);
}

test('Indices (Stage 5) zero & negative: recomputed value matches answer', () => {
    let checked = 0;
    for (const sub of ['indices-zero', 'indices-negative']) {
        for (const diff of DIFFS) {
            for (let seed = 1; seed <= 150; seed++) {
                const qs = genStage5({ topic: 'Indices', difficulty: diff, count: 6, seed,
                    subOpsFilter: { Indices: [sub] } });
                for (const q of qs) {
                    assert.ok(approxEqual(clueValue(q.clue), answerValue(q.answer)),
                        `${sub}/${diff}/seed${seed}: "${q.clue}" → ${q.answer}`);
                    checked++;
                }
            }
        }
    }
    assert.ok(checked > 200, `only ${checked} indices questions verified`);
});
