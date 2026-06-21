// =============================================================
// test/topics/dataviz.test.mjs — Data Classification & Visualisation.
//
// Recomputes numeric answers (totals, mode category, fraction, tally groups,
// dot-plot mode/range/total) from the value list in the clue; for the
// fixed-string families it checks the answer is in the known valid set.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, checkStructure, parseDataList } from '../_helpers.mjs';

const TOPIC = 'Data Classification and Visualisation';
const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

test('DataViz: every question is structurally valid', () => {
    for (const diff of DIFFS) {
        let total = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const qs = gen({ topic: TOPIC, difficulty: diff, count: 6, seed });
            total += qs.length;
            for (const q of qs) checkStructure(q, `DataViz/${diff}/seed${seed}`, assert);
        }
        assert.ok(total >= 30, `DataViz/${diff}: only ${total} questions`);
    }
});

test('DataViz: recomputed answers match the generator', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: TOPIC, difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const a = String(q.answer);
                const L = `${diff}/seed${seed}: "${c.slice(0, 70)}…" → ${a}`;
                const list = parseDataList(c);

                if (/How many data values are there in total/.test(c) && list) {
                    assert.equal(Number(a), list.reduce((x, y) => x + y, 0), L);
                    checked++; continue;
                }
                if (/Which category is the mode/.test(c) && list) {
                    const idx = list.indexOf(Math.max(...list));
                    assert.equal(a, 'ABCDEF'[idx], L);
                    checked++; continue;
                }
                if (/What fraction of the data is in the first category/.test(c) && list) {
                    const tot = list.reduce((x, y) => x + y, 0), g = gcd(list[0], tot);
                    assert.equal(a, `${list[0] / g}/${tot / g}`, L);
                    checked++; continue;
                }
                let m = c.match(/frequency of \$(\d+)\$\. How many complete groups of five/);
                if (m) {
                    assert.equal(Number(a), Math.floor(Number(m[1]) / 5), L);
                    checked++; continue;
                }
                m = c.match(/(\d+) complete group\(s\) of five and (\d+) extra/);
                if (m) {
                    assert.equal(Number(a), Number(m[1]) * 5 + Number(m[2]), L);
                    checked++; continue;
                }
                if (/dot plot/.test(c) && list) {
                    if (/total/.test(c)) { assert.equal(Number(a), list.length, L); checked++; continue; }
                    if (/range/.test(c)) {
                        assert.equal(Number(a), Math.max(...list) - Math.min(...list), L);
                        checked++; continue;
                    }
                    if (/mode/.test(c)) {
                        const counts = {};
                        for (const v of list) counts[v] = (counts[v] || 0) + 1;
                        const maxC = Math.max(...Object.values(counts));
                        const modes = Object.keys(counts).filter(k => counts[k] === maxC).map(Number);
                        assert.equal(modes.length, 1, `${L}: mode not unique`);
                        assert.equal(Number(a), modes[0], L);
                        checked++; continue;
                    }
                }
                if (/Which graph best displays/.test(c)) {
                    assert.ok(['column graph', 'sector (pie) graph', 'line graph', 'dot plot'].includes(a), L);
                    checked++; continue;
                }
                if (/Classify the data/.test(c)) {
                    assert.ok(['categorical', 'numerical'].includes(a), L);
                    checked++; continue;
                }
            }
        }
    }
    assert.ok(checked > 300, `only ${checked} DataViz questions verified`);
});
