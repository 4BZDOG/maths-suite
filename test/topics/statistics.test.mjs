// =============================================================
// test/topics/statistics.test.mjs — Statistics verifiers.
//
// Re-derive mean/median/mode/range from the dataset embedded in the clue
// and confirm the answer matches. For "missing value given mean" we
// reconstruct: missing = mean × n − sum(known).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual, parseDataList } from '../_helpers.mjs';

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const n = s.length, mid = Math.floor(n / 2);
    return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function mode(arr) {
    const counts = new Map();
    for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
    let best = -1, bestVal = null;
    for (const [v, c] of counts) if (c > best) { best = c; bestVal = v; }
    return bestVal;
}
function range(arr) { return Math.max(...arr) - Math.min(...arr); }
function quartiles(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const n = s.length;
    const lower = s.slice(0, Math.floor(n / 2));
    const upper = s.slice(Math.ceil(n / 2));
    return [median(lower), median(upper)];
}

test('Statistics: mean/median/mode/range answers match recomputed values', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({ topic: 'Statistics', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                // Frequency-table mean is a weighted mean over two lists — it has
                // its own test below; skip it here so parseDataList doesn't treat
                // the (unweighted) value list as a plain dataset.
                if (/frequenc/i.test(q.clue)) continue;
                const data = parseDataList(q.clue);
                if (!data) continue;
                let expected = null;
                if (/interquartile|\bIQR\b/i.test(q.clue)) {
                    const [q1, q3] = quartiles(data);
                    expected = q3 - q1;
                }
                else if (/\bmean\b|\\overline\{x\}/i.test(q.clue) && !/missing/i.test(q.clue)) {
                    if (/added|included/i.test(q.clue)) {
                        const em = q.clue.match(/value of \$(\d+)\$/i) || q.clue.match(/when \$(\d+)\$/i);
                        if (em) {
                            const extra = Number(em[1]);
                            expected = (data.reduce((a, b) => a + b, 0) + extra) / (data.length + 1);
                        }
                    } else {
                        expected = mean(data);
                    }
                }
                else if (/\bmedian\b/i.test(q.clue)) expected = median(data);
                else if (/\bmode\b/i.test(q.clue)) expected = mode(data);
                else if (/\brange\b/i.test(q.clue)) expected = range(data);
                if (expected === null) continue;
                assert.ok(approxEqual(Number(q.answer), expected),
                    `${diff}/seed${seed}: ${q.clue.slice(0, 70)}… → answer ${q.answer}, recomputed ${expected}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 80, `only ${checked} stat questions verified`);
});

test('Statistics "missing value given mean": missing = mean·n − sum(known)', () => {
    let checked = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({ topic: 'Statistics', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                if (!/missing/i.test(q.clue)) continue;
                // List with "?" — find the inline span containing both digits and '?'.
                const span = [...q.clue.matchAll(/\$([^$]+)\$/g)]
                    .map(m => m[1])
                    .find(s => /\?/.test(s) && /,/.test(s));
                if (!span) continue;
                const items = span.split(',').map(t => t.trim());
                const known = items.filter(t => t !== '?').map(Number);
                if (known.length === 0 || known.some(n => !Number.isFinite(n))) continue;
                const n = items.length;
                // Find the stated mean: "mean of ... is $N$" or "mean ... $N$:"
                const mm = q.clue.match(/mean[^$]*\$([\d.]+)\$/i);
                if (!mm) continue;
                const meanV = Number(mm[1]);
                const expected = meanV * n - known.reduce((a, b) => a + b, 0);
                assert.ok(approxEqual(Number(q.answer), expected),
                    `${diff}/seed${seed}: missing-value answer ${q.answer} ≠ recomputed ${expected} | "${q.clue.slice(0, 80)}…"`);
                checked++;
            }
        }
    }
    assert.ok(checked > 10, `only ${checked} missing-value questions exercised`);
});

test('Statistics frequency-table mean: mean = Σfx ÷ Σf', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = gen({ topic: 'Statistics', difficulty: 'Hard', count: 8, seed });
        for (const q of qs) {
            const m = q.clue.match(/values \$([^$]+)\$ occurring with frequencies \$([^$]+)\$/);
            if (!m) continue;
            const vals = m[1].split(',').map(Number);
            const freqs = m[2].split(',').map(Number);
            const sumF = freqs.reduce((a, b) => a + b, 0);
            const sumFX = vals.reduce((s, v, i) => s + v * freqs[i], 0);
            assert.ok(approxEqual(Number(q.answer), sumFX / sumF),
                `seed${seed}: freq-mean answer ${q.answer} ≠ ${sumFX / sumF} | "${q.clue.slice(0, 80)}…"`);
            checked++;
        }
    }
    assert.ok(checked > 30, `only ${checked} frequency-table-mean questions verified`);
});
