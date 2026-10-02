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
        const shaded = q.clue.match(/\$(\d+)\$ (?:of which (?:is|are) shaded|(?:is|are) coloured red)/);
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

test('Trig applications: scene diagrams carry the numbers the answer is built from', () => {
    let checked = 0;
    for (const q of collect('Trigonometry', 'applications')) {
        const d = q.diagram;
        assert.equal(d?.type, 'scene', `no scene diagram: ${q.clue}`);
        assert.ok(['elevation', 'depression', 'drone', 'ladder', 'wire', 'ramp'].includes(d.kind), d.kind);
        // every number quoted in the clue appears in the diagram (and vice versa)
        const nums = [...q.clue.matchAll(/\$(\d+(?:\.\d+)?)\$/g)].map(m => Number(m[1]));
        assert.ok(nums.includes(d.height) || d.missing === 'height', `${q.clue}: height ${d.height} not in clue`);
        assert.ok(nums.includes(d.dist) || d.missing === 'dist', `${q.clue}: dist ${d.dist} not in clue`);
        const deg = Math.atan2(d.height, d.dist) * 180 / Math.PI;
        if (d.missing === 'angle') assert.ok(Math.abs(parseFloat(q.answer) - deg) < 0.06, `${q.clue} → ${q.answer} (expected ${deg.toFixed(1)})`);
        if (d.missing === 'height') assert.ok(Math.abs(Number(q.answer) - d.height) < 1e-9, q.clue);
        if (d.missing === 'dist') assert.ok(Math.abs(Number(q.answer) - d.dist) < 1e-9, q.clue);
        checked++;
    }
    assert.ok(checked > 60, `only ${checked} application scenes verified`);
});

test('3D trigonometry: cuboid diagram matches the clue and the answer', () => {
    let checked = 0;
    for (const q of collect('Trigonometry', 'trig-3d')) {
        const d = q.diagram;
        assert.equal(d?.type, 'cuboid-diag', q.clue);
        const base = Math.hypot(d.l, d.w);
        assert.equal(Number(q.answer), Math.round(Math.atan2(d.h, base) * 180 / Math.PI), q.clue);
        checked++;
    }
    assert.ok(checked > 10, `only ${checked} 3D questions verified`);
});

test('Bearings: back bearings, perpendicular legs and components match their diagrams', () => {
    const pad3 = (n) => String(n).padStart(3, '0');
    let back = 0, perp = 0, comp = 0;
    for (const q of collect('Trigonometry', 'bearings', { seeds: 200 })) {
        const d = q.diagram;
        assert.equal(d?.type, 'bearing', `no bearing diagram: ${q.clue}`);
        if (d.back) {
            assert.equal(q.answer, `${pad3((d.legs[0].bearing + 180) % 360)}°`, q.clue);
            back++;
        } else if (d.closing) {
            const [l1, l2] = d.legs;
            assert.equal(Math.abs(l2.bearing - l1.bearing) % 180, 90, `legs not perpendicular: ${q.clue}`);
            assert.ok(Math.abs(Number(q.answer) - Math.hypot(l1.dist, l2.dist)) < 1e-9, q.clue);
            assert.ok(Number.isInteger(Number(q.answer)), 'exact (Pythagorean) distance expected');
            perp++;
        } else {
            const { bearing, dist } = d.legs[0];
            const exp = d.ask === 'east' ? Math.abs(dist * Math.sin(bearing * Math.PI / 180)) : Math.abs(dist * Math.cos(bearing * Math.PI / 180));
            assert.ok(Math.abs(Number(q.answer) - exp) < 0.06, `${q.clue} → ${q.answer} (expected ${exp.toFixed(2)})`);
            comp++;
        }
    }
    assert.ok(back > 10 && perp > 10 && comp > 20, `coverage too thin: back ${back}, perp ${perp}, comp ${comp}`);
});

const frac = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };

test('Line graphs: gradient / intercept / reading / equation answers match the drawn line', () => {
    let checked = 0;
    for (const q of collect('Linear Relationships', 'plot-line', { fn: gen, seeds: 150 })) {
        const d = q.diagram;
        if (!d || d.type !== 'line-graph') continue;
        assert.ok(d.essential, 'graph carries the data, so it must be essential');
        const { m, c } = d.lines[0];
        if (/gradient/.test(q.clue)) assert.equal(Number(q.answer), m, q.clue);
        else if (/y-intercept|cross the \$y\$-axis/.test(q.clue)) assert.equal(Number(q.answer), c, q.clue);
        else if (/value of \$y\$ when/.test(q.clue)) { const [x] = d.points[0]; assert.equal(Number(q.answer), m * x + c, q.clue); }
        else if (/equation/.test(q.clue)) assert.equal(q.answer, `y=${m === 1 ? 'x' : m === -1 ? '-x' : m + 'x'}${c === 0 ? '' : c > 0 ? ` + ${c}` : ` - ${-c}`}`, q.clue);
        else assert.fail(`unrecognised graph question: ${q.clue}`);
        // marked points lie on the line
        for (const [x, y] of d.points) assert.equal(y, m * x + c, 'marked point is off the line');
        checked++;
    }
    assert.ok(checked > 40, `only ${checked} line-graph questions verified`);
});

test('Graphical simultaneous equations: the lines really cross at the answer', () => {
    let checked = 0;
    for (const q of collect('Equations', 'simultaneous', { seeds: 200 })) {
        const d = q.diagram;
        if (!d || d.type !== 'line-graph') continue;
        const [l1, l2] = d.lines;
        const m = q.answer.match(/^x=(-?\d+),y=(-?\d+)$/);
        assert.ok(m, `bad answer ${q.answer}`);
        const x = +m[1], y = +m[2];
        assert.equal(l1.m * x + l1.c, y); assert.equal(l2.m * x + l2.c, y);
        assert.notEqual(l1.m, l2.m, 'parallel lines have no solution');
        checked++;
    }
    assert.ok(checked > 20, `only ${checked} graphical simultaneous questions verified`);
});

test('Clock questions: answers follow from the clock faces', () => {
    const pad = (n) => String(n).padStart(2, '0');
    let conv = 0, dur = 0;
    for (const q of collect('Time', 'convert', { fn: gen, seeds: 100 })) {
        if (q.diagram?.type !== 'clock') continue;
        const { h, m } = q.diagram.faces[0];
        const pm = /afternoon/.test(q.clue);
        assert.equal(q.answer, `${pad(pm ? h + 12 : h)}:${pad(m)}`, q.clue);
        conv++;
    }
    for (const q of collect('Time', 'duration', { fn: gen, seeds: 100 })) {
        if (q.diagram?.type !== 'clock') continue;
        const [a, b] = q.diagram.faces;
        const mins = ((b.h % 12) * 60 + b.m) - ((a.h % 12) * 60 + a.m);
        assert.equal(Number(q.answer), ((mins % 720) + 720) % 720 || 720, q.clue);
        dur++;
    }
    assert.ok(conv > 15 && dur > 15, `coverage too thin: convert ${conv}, duration ${dur}`);
});

test('Fraction & percentage models: shaded counts match the answer', () => {
    let fr = 0, pc = 0;
    for (const q of collect('Fractions', 'simplify-convert', { fn: gen, diffs: ['Easy'], seeds: 200 })) {
        const d = q.diagram;
        if (d?.type !== 'fraction') continue;
        assert.ok(d.shaded > 0 && d.shaded < d.parts && d.essential);
        const a = String(q.answer);
        const m = a.match(/\\frac\{(\d+)\}\{(\d+)\}/) || a.match(/^(\d+)\/(\d+)$/);
        assert.ok(m, `unparseable answer ${a}`);
        assert.equal(`${m[1]}/${m[2]}`, frac(d.shaded, d.parts), `${d.shaded}/${d.parts} → ${a}`);
        fr++;
    }
    for (const q of collect('Percentages', 'find-pct', { fn: gen, diffs: ['Easy'], seeds: 200 })) {
        const d = q.diagram;
        if (d?.type !== 'fraction') continue;
        assert.equal(d.kind, 'grid');
        assert.equal(Number(q.answer), d.shaded, q.clue);
        pc++;
    }
    assert.ok(fr > 10 && pc > 10, `coverage too thin: fractions ${fr}, percentages ${pc}`);
});

test('Similar & congruent triangles: labels, scale factor and test names agree', () => {
    let sim = 0, con = 0, quad = 0;
    for (const q of [...collect('Geometry', 'similar-triangles'), ...collect('Properties of Geometrical Figures', 'similar-ratio')]) {
        const d = q.diagram;
        if (d?.type !== 'similar') continue;
        const num = (t) => parseFloat(t);
        // the first labelled pair fixes the scale factor; every other numeric pair obeys it, and the '?' side is the answer
        const pairs = d.small.map((s, i) => [s, d.big[i]]).filter(([s, b]) => s && b);
        const known = pairs.find(([s, b]) => !/\?/.test(b));
        const k = known ? num(known[1]) / num(known[0]) : null;
        const unknown = pairs.find(([, b]) => /\?/.test(b));
        if (k && unknown) assert.ok(Math.abs(Number(q.answer) - num(unknown[0]) * k) < 1e-9, `${q.clue} → ${q.answer}`);
        else if (!k && unknown) {   // "scale factor k" question: answer = side × k
            const kk = Number((q.clue.match(/scale factor \$(\d+(?:\.\d+)?)\$/) || [])[1]);
            assert.ok(Math.abs(Number(q.answer) - num(unknown[0]) * kk) < 1e-9, `${q.clue} → ${q.answer}`);
        }
        sim++;
    }
    for (const diff of ['Easy', 'Medium']) for (let seed = 1; seed <= 120; seed++) {
        for (const q of genStage5({ topic: 'Properties of Geometrical Figures', difficulty: diff, count: 6, seed, subOpsFilter: { 'Properties of Geometrical Figures': ['congruent-tests'] } })) {
            assert.equal(q.diagram?.type, 'congruent', q.clue);
            assert.equal(q.diagram.test, q.answer, `${q.clue}`);
            con++;
        }
    }
    for (const q of collect('Properties of Geometrical Figures', 'quad-properties', { diffs: ['Hard'] })) {
        if (q.diagram?.type !== 'quad-angles') continue;
        const known = q.diagram.angles.filter(a => a !== '?').reduce((a, b) => a + b, 0);
        assert.equal(Number(q.answer), 360 - known, q.clue);
        quad++;
    }
    assert.ok(sim > 30 && con > 100 && quad > 20, `coverage too thin: similar ${sim}, congruent ${con}, quad ${quad}`);
});
