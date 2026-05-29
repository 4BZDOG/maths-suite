// =============================================================
// test/topics/ratios.test.mjs — Ratios & Rates verifiers.
//
// Speed = distance / time; distance = speed × time; time = distance / speed.
// Simplify ratio: divide both terms by gcd. Equivalent ratios: cross-multiply.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, approxEqual } from '../_helpers.mjs';

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function nums(clue) {
    return [...clue.matchAll(/\$\\?\$?(-?\d+(?:\.\d+)?)\\?%?\$/g)].map(m => Number(m[1]));
}

test('Ratios & Rates: speed / distance / time, simplify, equivalent answers match', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Ratios & Rates', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const ns = nums(c);

                // --- Simplify ratio "$a : b$" → "n : d" in lowest terms
                const sm = /Simplify the ratio|simplest form|lowest terms/i.test(c);
                if (sm) {
                    const r = c.match(/\$(\d+)\s*:\s*(\d+)\$/);
                    if (r) {
                        const a = +r[1], b = +r[2];
                        const g = gcd(a, b);
                        const exp = `${a / g} : ${b / g}`;
                        assert.equal(q.answer, exp,
                            `${diff}/seed${seed}: simplify ${a}:${b} → "${q.answer}" (expected "${exp}")`);
                        checked++; continue;
                    }
                }
                // --- Speed: "$d$ km in $t$ hours" → d/t
                if (/Find its speed|Find the speed|covers|travels/i.test(c)
                    && /Find (?:its )?speed/i.test(c)) {
                    const m = c.match(/\$(\d+)\$ km in \$(\d+)\$/);
                    if (m) {
                        const d = +m[1], t = +m[2];
                        const exp = d / t;
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: speed → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Distance: speed × time
                if (/Find the distance|How far/i.test(c) && /at \$(\d+)\$.*for \$(\d+)\$|at \$(\d+)\$.*in \$(\d+)\$/i.test(c)) {
                    const m = c.match(/at \$(\d+)\$.*?\$(\d+)\$/);
                    if (m) {
                        const speed = +m[1], time = +m[2];
                        const exp = speed * time;
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: distance → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Time: distance / speed
                if (/How long|Find the.*time|time taken/i.test(c) && /travels?.*\$(\d+)\$ km at \$(\d+)\$/i.test(c)) {
                    const m = c.match(/\$(\d+)\$ km at \$(\d+)\$/);
                    if (m) {
                        const dist = +m[1], speed = +m[2];
                        const exp = dist / speed;
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: time → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Equivalent ratio: a:b = ?:c2  → ans = a * (c2 / b)
                if (/equivalent ratio|missing value/i.test(c)) {
                    const m = c.match(/\$(\d+)\s*:\s*(\d+)\s*=\s*(?:\?|\\square)\s*:\s*(\d+)\$/);
                    if (m) {
                        const a = +m[1], b = +m[2], c2 = +m[3];
                        const exp = a * (c2 / b);
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: equiv ratio → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
            }
        }
    }
    assert.ok(checked > 40, `only ${checked} ratio/rate questions verified`);
});
