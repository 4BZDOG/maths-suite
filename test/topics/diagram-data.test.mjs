// =============================================================
// test/topics/diagram-data.test.mjs — questions whose data lives in a drawn
// diagram (box plots, scatter plots, Venn diagrams, spinners, tree diagrams).
// Answers are recomputed independently from the diagram object itself.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, genStage5 } from '../_helpers.mjs';

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const fracAns = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
// Answers are either "n/d" or LaTeX "\\frac{n}{d}" (or a whole number) → normalised "n/d".
const normFrac = (a) => {
    const m = String(a).match(/\\frac\{(\d+)\}\{(\d+)\}/) || String(a).match(/^(\d+)\/(\d+)$/);
    if (m) return fracAns(+m[1], +m[2]);
    return /^\d+$/.test(String(a)) ? `${a}/1` : String(a);
};

function collect(topic, op, { fn = genStage5, diffs = ['Easy', 'Medium', 'Hard'], seeds = 120 } = {}) {
    const out = [];
    for (const difficulty of diffs) for (let seed = 1; seed <= seeds; seed++) {
        for (const q of fn({ topic, difficulty, count: 6, seed, subOpsFilter: { [topic]: [op] } })) out.push(q);
    }
    return out;
}

test('Box plot reading: answers match the plotted five-number summary', () => {
    let checked = 0;
    for (const q of collect('Statistics', 'box-plot')) {
        const d = q.diagram;
        if (!d || d.type !== 'box-plot') continue;
        assert.ok(d.essential, 'box plot carries the data, so it must be essential');
        assert.ok(d.min < d.q1 && d.q1 < d.med && d.med < d.q3 && d.q3 < d.max, `not strictly ordered: ${JSON.stringify(d)}`);
        const iqr = d.q3 - d.q1;
        let exp;
        if (/\*median\*/.test(q.clue)) exp = d.med;
        else if (/\*range\*/.test(q.clue)) exp = d.max - d.min;
        else if (/interquartile range/.test(q.clue)) exp = iqr;
        else if (/upper quartile/.test(q.clue)) exp = d.q3;
        else if (/lower quartile/.test(q.clue)) exp = d.q1;
        else if (/upper outlier fence/.test(q.clue)) exp = d.q3 + 1.5 * iqr;
        else if (/lower outlier fence/.test(q.clue)) exp = d.q1 - 1.5 * iqr;
        else assert.fail(`unrecognised box-plot question: ${q.clue}`);
        assert.equal(Number(q.answer), exp, `${q.clue} → ${q.answer} (expected ${exp})`);
        checked++;
    }
    assert.ok(checked > 40, `only ${checked} box-plot reading questions verified`);
});

test('Scatter plot correlation: answer agrees with the sign of the plotted trend', () => {
    let checked = 0;
    for (const q of collect('Statistics', 'bivariate', { diffs: ['Medium', 'Hard'], seeds: 200 })) {
        if (!/correlation|relationship between/.test(q.clue)) continue;
        const pts = q.diagram.pts, n = pts.length;
        const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
        const sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
        const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0), syy = pts.reduce((a, p) => a + (p[1] - my) ** 2, 0);
        const r = sxy / Math.sqrt(sxx * syy);
        const exp = r > 0.6 ? 'positive' : r < -0.6 ? 'negative' : 'none';
        assert.equal(q.answer, exp, `r=${r.toFixed(2)} but answer ${q.answer}: ${JSON.stringify(pts)}`);
        checked++;
    }
    assert.ok(checked > 20, `only ${checked} correlation questions verified`);
});

test('Venn diagram questions: regions are consistent and answers match', () => {
    let checked = 0;
    for (const q of collect('Probability', 'venn', { fn: genStage5 })) {
        const d = q.diagram;
        if (!d || d.type !== 'venn' || !d.essential) continue;
        const { a, ab, b, out } = d.regions;
        assert.equal(a + ab + b + out, d.total, `regions don't sum to the total: ${JSON.stringify(d)}`);
        const [la, lb] = d.labels.map(x => x.toLowerCase());
        let k;
        if (/likes \*both\*/.test(q.clue)) k = ab;
        else if (/likes \*neither\*/.test(q.clue)) k = out;
        else if (new RegExp(`likes ${la} \\*only\\*`).test(q.clue)) k = a;
        else if (new RegExp(`likes ${lb} \\*only\\*`).test(q.clue)) k = b;
        else if (new RegExp(`likes ${la} \\(in total\\)`).test(q.clue)) k = a + ab;
        else if (new RegExp(`likes ${la} \\*or\\* ${lb}`).test(q.clue)) k = a + ab + b;
        else assert.fail(`unrecognised Venn question: ${q.clue}`);
        assert.equal(normFrac(q.answer), fracAns(k, d.total), `${q.clue} → ${q.answer}`);
        checked++;
    }
    assert.ok(checked > 15, `only ${checked} full-Venn questions verified`);
});

test('Spinner diagrams: sector counts agree with the question', () => {
    let checked = 0;
    for (const q of collect('Probability', 'theoretical', { diffs: ['Easy', 'Medium'], seeds: 200 })) {
        const d = q.diagram;
        if (!d || d.type !== 'spinner') continue;
        const m = q.clue.match(/\$(\d+)\$ (?:equal sections|equal parts)/);
        assert.ok(m, `spinner diagram without a section count: ${q.clue}`);
        assert.equal(d.sectors.length, Number(m[1]), q.clue);
        const shaded = q.clue.match(/\$(\d+)\$ (?:of which are shaded|are coloured red)/);
        if (shaded) {
            const coloured = d.sectors.filter(s => s.color && s.color !== 'white').length;
            assert.equal(coloured, Number(shaded[1]), q.clue);
            assert.equal(normFrac(q.answer), fracAns(coloured, d.sectors.length), q.clue);
        }
        checked++;
    }
    assert.ok(checked > 20, `only ${checked} spinner questions verified`);
});

test('Tree diagrams: branch probabilities sum to 1 and multiply to the answer', () => {
    const val = (p) => { const [n, d] = String(p).split('/').map(Number); return n / d; };
    let checked = 0;
    const qs = [...collect('Probability', 'multi-event', { fn: gen }), ...collect('Probability', 'multi-event', { fn: genStage5 })];
    for (const q of qs) {
        const d = q.diagram;
        if (!d || d.type !== 'tree') continue;
        assert.ok(Math.abs(d.first.reduce((a, b) => a + val(b.p), 0) - 1) < 1e-9, 'first-stage probabilities must sum to 1');
        d.second.forEach(br => assert.ok(Math.abs(br.reduce((a, b) => a + val(b.p), 0) - 1) < 1e-9, 'second-stage probabilities must sum to 1'));
        // "both X" / "two heads" → the first-first leaf
        const exp = val(d.first[0].p) * val(d.second[0][0].p);
        const [n, dd] = normFrac(q.answer).split('/').map(Number);
        assert.ok(Math.abs(n / dd - exp) < 1e-9, `${q.clue} → ${q.answer}, tree gives ${exp}`);
        checked++;
    }
    assert.ok(checked > 10, `only ${checked} tree questions verified`);
});
