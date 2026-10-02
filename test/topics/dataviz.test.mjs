// =============================================================
// test/topics/dataviz.test.mjs — Data Classification & Visualisation.
//
// Recomputes numeric answers (totals, mode category, fraction, tally groups,
// dot-plot mode/range/total) from the value list in the clue; for the
// fixed-string families it checks the answer is in the known valid set.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, checkStructure } from '../_helpers.mjs';

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
                const dg = q.diagram;
                const freqs = dg && dg.type === 'table' ? dg.rows.map(r => Number(r[r.length - 1])) : null;

                if (/in total in the frequency table|\*total\* number of responses/.test(c)) {
                    assert.equal(Number(a), freqs.reduce((x, y) => x + y, 0), L);
                    checked++; continue;
                }
                if (/\*mode\*|Which category is the mode/.test(c) && dg?.type === 'table') {
                    const idx = freqs.indexOf(Math.max(...freqs));
                    assert.equal(freqs.filter(f => f === freqs[idx]).length, 1, `${L}: mode not unique`);
                    assert.equal(a, dg.rows[idx][0], L);
                    checked++; continue;
                }
                if (/What fraction of the data is in the/.test(c) && dg?.type === 'table') {
                    const tot = freqs.reduce((x, y) => x + y, 0), g = gcd(freqs[0], tot);
                    assert.equal(a, `${freqs[0] / g}/${tot / g}`, L);
                    checked++; continue;
                }
                if (/tally chart shows/.test(c)) {
                    const qi = dg.rows.findIndex(r => r[2] && r[2].q);
                    assert.ok(qi >= 0, `${L}: no unknown frequency`);
                    assert.equal(Number(a), dg.rows[qi][1].tally, L);
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
                if (dg?.type === 'dot-plot') {
                    assert.ok(dg.essential, `${L}: dot plot must be essential`);
                    const vals = [];
                    for (const [v, n] of Object.entries(dg.counts)) for (let i = 0; i < n; i++) vals.push(Number(v));
                    if (/How many data values are shown in total/.test(c)) { assert.equal(Number(a), vals.length, L); checked++; continue; }
                    if (/range/.test(c)) { assert.equal(Number(a), Math.max(...vals) - Math.min(...vals), L); checked++; continue; }
                    let m2 = c.match(/equal to \$(-?\d+)\$/);
                    if (m2) { assert.equal(Number(a), vals.filter(v => v === +m2[1]).length, L); checked++; continue; }
                    m2 = c.match(/greater than\* \$(-?\d+)\$/);
                    if (m2) { assert.equal(Number(a), vals.filter(v => v > +m2[1]).length, L); checked++; continue; }
                    if (/mode/.test(c)) {
                        const counts = {};
                        for (const v of vals) counts[v] = (counts[v] || 0) + 1;
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
