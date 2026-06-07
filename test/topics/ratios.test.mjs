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

test('Ratios & Rates: scale-drawing answer = drawn-cm × (real-per-cm)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Ratios & Rates', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { 'Ratios & Rates': ['unit-rate'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$?1\$?\s*cm\s*(?:\$?\s*=\s*\$?\s*|represents\s*\$?)(\d+)\$?\s*m.*?\$?(\d+)\$?\s*cm/i);
            if (!m) continue;
            const per = +m[1], drawn = +m[2];
            assert.equal(Number(q.answer), per * drawn,
                `seed${seed}: scale 1 cm = ${per} m × ${drawn} cm → "${q.answer}" (expected ${per * drawn})`);
            checked++;
        }
    }
    assert.ok(checked > 5, `only ${checked} scale-drawing questions verified`);
});

test('Ratios & Rates: km/h → m/s conversion (÷ 3.6)', () => {
    let checked = 0;
    for (let seed = 1; seed <= 200; seed++) {
        const qs = gen({
            topic: 'Ratios & Rates', difficulty: 'Medium', count: 8, seed,
            subOpsFilter: { 'Ratios & Rates': ['speed'] },
        });
        for (const q of qs) {
            const m = q.clue.match(/\$(\d+)\$\s*km\/h.*\bm\/s\b/);
            if (!m) continue;
            const kmh = +m[1];
            assert.ok(Math.abs(Number(q.answer) - kmh / 3.6) < 1e-9,
                `seed${seed}: ${kmh} km/h → "${q.answer}" m/s (expected ${kmh / 3.6})`);
            checked++;
        }
    }
    assert.ok(checked > 5, `only ${checked} km/h→m/s conversions verified`);
});

test('Ratios & Rates: three-part ratio split sums to the total', () => {
    let checked = 0;
    for (const diff of ['Medium', 'Hard']) {
        for (let seed = 1; seed <= 200; seed++) {
            const qs = gen({
                topic: 'Ratios & Rates', difficulty: diff, count: 8, seed,
                subOpsFilter: { 'Ratios & Rates': ['divide-ratio'] },
            });
            for (const q of qs) {
                // Three-part answer is "A : B : C" (vs two-part "A : B")
                const parts = q.answer.split(':').map(s => Number(s.trim()));
                if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) continue;
                // Stated total in clue: "Share $T$ <unit>"
                const tm = q.clue.match(/\$(\d+)\$\s+\w+/);
                if (!tm) continue;
                const total = +tm[1];
                assert.equal(parts.reduce((a, b) => a + b, 0), total,
                    `${diff}/seed${seed}: ${q.answer} sum ≠ ${total} | "${q.clue}"`);
                checked++;
            }
        }
    }
    assert.ok(checked > 5, `only ${checked} three-part ratio splits verified`);
});

test('Ratios & Rates (Hard): combined-speed separation = (sum or diff) × time', () => {
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
        const qs = gen({
            topic: 'Ratios & Rates', difficulty: 'Hard', count: 8, seed,
            subOpsFilter: { 'Ratios & Rates': ['speed'] },
        });
        for (const q of qs) {
            const c = q.clue;
            if (!/opposite directions|same direction/i.test(c)) continue;
            const speeds = [...c.matchAll(/\$(\d+)\$\s*km\/h/g)].map(m => +m[1]);
            const tm = c.match(/\$(\d+)\$\s*hours/);
            if (speeds.length < 2 || !tm) continue;
            const [s1, s2] = speeds, t = +tm[1];
            const exp = /opposite directions/i.test(c) ? (s1 + s2) * t : Math.abs(s1 - s2) * t;
            assert.equal(Number(q.answer), exp,
                `seed${seed}: combined-speed "${c.slice(0,80)}…" → ${q.answer} (expected ${exp})`);
            checked++;
        }
    }
    assert.ok(checked > 5, `only ${checked} combined-speed questions verified`);
});

test('Ratios & Rates: speed / distance / time, simplify, equivalent answers match', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Ratios & Rates', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;


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
                    const m = c.match(/\$(\d+)\$ km in \$(\d+(?:\.\d+)?)\$/);
                    if (m) {
                        const d = +m[1], t = +m[2];
                        const exp = d / t;
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: speed → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Distance: speed × time (not combined-speed)
                if (/Find the distance|How far/i.test(c) && !/opposite|same direction/i.test(c)) {
                    const m = c.match(/at \$(\d+)\$.*?for \$(\d+(?:\.\d+)?)\$/);
                    if (m) {
                        const speed = +m[1], time = +m[2];
                        const exp = speed * time;
                        assert.ok(approxEqual(Number(q.answer), exp),
                            `${diff}/seed${seed}: distance → ${q.answer} (expected ${exp})`);
                        checked++; continue;
                    }
                }
                // --- Time: distance / speed
                if (/How long|Find the.*time|time taken/i.test(c)) {
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
