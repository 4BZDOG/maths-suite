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

// Exact half-up rounding of a decimal written as a string, avoiding the binary
// float error the generator itself used to hit (Math.floor(40.358 * 10000) % 10
// is 9, not 0; Math.round(2.0115 * 1000) rounds a deciding 5 down).
function roundDecimalStr(src, dp) {
    const scaled = BigInt(src.replace('.', ''));
    const deciding = Number(scaled % 10n);
    const rounded = scaled / 10n + (deciding >= 5 ? 1n : 0n);
    return { deciding, answer: (Number(rounded) / 10 ** dp).toFixed(dp) };
}

test('Rounding decimal places: answer and deciding-digit note agree with the value', () => {
    // Regression: "Round 40.3580 to 3 decimal places" printed the correct answer
    // 40.358 but explained it as "(4th d.p. 9 ≥ 5, round up)" — the deciding digit
    // was read off a float. The same float also rounded a deciding 5 *down*
    // (2.0115 → 2.011), contradicting the note next to it.
    let checked = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Rounding', difficulty: diff, count: 8, seed,
                subOpsFilter: { Rounding: ['decimal-places'] } });
            for (const q of qs) {
                const vm = q.clue.match(/\$(\d+\.\d+)\$/);
                const dm = q.clue.match(/(\d+) (?:decimal place|d\.p\.)/);
                if (!vm || !dm) continue;
                const src = vm[1], dp = Number(dm[1]);
                if (src.split('.')[1].length !== dp + 1) continue;
                const { deciding, answer } = roundDecimalStr(src, dp);
                const label = `${diff}/seed${seed}: "${q.clue}" → ${q.answer} / ${q.worked}`;
                assert.equal(q.answer, answer, `wrong answer — ${label}`);
                const note = q.worked.match(/d\.p\. digit \$(\d)\$ (≥ 5, round up|< 5, round down)/);
                assert.ok(note, `no deciding-digit note — ${label}`);
                assert.equal(Number(note[1]), deciding, `wrong deciding digit — ${label}`);
                assert.equal(note[2] === '≥ 5, round up', deciding >= 5, `wrong direction — ${label}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 100, `only ${checked} decimal-place questions verified`);
});
