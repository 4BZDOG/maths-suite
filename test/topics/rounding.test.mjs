// =============================================================
// test/topics/rounding.test.mjs — Rounding verifiers.
//
// Closes the documented answer-recomputation gap for significant figures
// (CLAUDE.md Roadmap): independently rounds the clue value to the requested
// number of significant figures and compares to the generator's answer.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen } from '../_helpers.mjs';

// Standard significant-figure rounding of a positive integer.
function roundSigFigs(n, k) {
    const factor = Math.pow(10, Math.floor(Math.log10(n)) - (k - 1));
    return Math.round(n / factor) * factor;
}

test('Rounding significant figures: recomputed answer matches', () => {
    let checked = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Rounding', difficulty: diff, count: 8, seed,
                subOpsFilter: { Rounding: ['sig-figs'] } });
            for (const q of qs) {
                const c = q.clue;
                const km = c.match(/(\d+) significant figure/) || c.match(/(\d+) s\.f\./);
                const vm = c.match(/\$(\d+)\$/);
                if (!km || !vm) continue;
                const k = Number(km[1]), n = Number(vm[1]);
                assert.equal(Number(q.answer), roundSigFigs(n, k),
                    `${diff}/seed${seed}: "${c.slice(0, 70)}…" → ${q.answer} (expected ${roundSigFigs(n, k)})`);
                checked++;
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} significant-figure questions verified`);
});
