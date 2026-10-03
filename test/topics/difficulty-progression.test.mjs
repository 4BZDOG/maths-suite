// =============================================================
// test/topics/difficulty-progression.test.mjs
//
// Easy / Medium / Hard must differ in *kind*, not just in number size.
// For every sub-op below this file
//   1. recomputes each answer independently from the numbers in the clue
//      (never from the generator's own helpers), and
//   2. asserts the characteristic question style of each difficulty.
//
// Covered: Length unit-convert, Financial commission & term-payments,
// Time 24-hour convert, Linear distance / equation-from-gp / general-form,
// Probability conditional / venn / two-way.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, genStage5, DIFFS, approxEqual, checkStructure } from '../_helpers.mjs';

function collect(fn, topic, op, diff, seeds = 150, count = 6) {
    const out = [];
    for (let seed = 1; seed <= seeds; seed++) {
        const qs = fn({ topic, difficulty: diff, count, seed, subOpsFilter: { [topic]: [op] } });
        for (const q of qs) { checkStructure(q, `${topic}/${op}/${diff}/seed${seed}`, assert); out.push({ q, seed }); }
    }
    assert.ok(out.length > 100, `${topic}/${op}/${diff}: only ${out.length} questions`);
    return out;
}
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
// numbers in a clue with money / percent / thousands-grouping markup removed
const nums = (c) => [...c.replace(/\\\$/g, '').replace(/\\,/g, '').replace(/\\%/g, '').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
const cents = (x) => Math.round(x * 100) / 100;
// answer "$\frac{n}{d}$" or an integer → [n, d]
function fracOf(ans) {
    const m = String(ans).match(/^\$\\frac\{(\d+)\}\{(\d+)\}\$$/);
    if (m) return [Number(m[1]), Number(m[2])];
    assert.match(String(ans), /^\d+$/, `not a fraction: ${ans}`);
    return [Number(ans), 1];
}
function assertFrac(q, fav, tot, label) {
    const g = gcd(fav, tot);
    const [n, d] = fracOf(q.answer);
    assert.deepEqual([n, d], [fav / g, tot / g], `${label}: ${q.clue} → ${q.answer} (expected ${fav}/${tot})`);
    assert.equal(q.answerDisplay, `$\\frac{${n}}{${d}}$`, `${label}: answerDisplay`);
    assert.ok(d > 1 && n > 0, `${label}: improper or zero probability`);
}

// ------------------------------------------------------------------
// 1. Length: unit conversion
// ------------------------------------------------------------------
const LIN_TO_M = { mm: 0.001, cm: 0.01, m: 1, km: 1000 };
const AREA_TO_M2 = { mm2: 1e-6, cm2: 1e-4, m2: 1, ha: 1e4, km2: 1e6 };
const LEN_NAMES = { millimetres: 'mm', centimetres: 'cm', metres: 'm', kilometres: 'km' };

// Parse any Length conversion clue → { kind, value, from, to } (units normalised, e.g. m2).
function parseConversion(clue) {
    const c = clue.replace(/\\,/g, '').replace(/\\ /g, '');
    let m = c.match(/^Convert \$([\d.]+)\\text\{(\w+)\}(\^2)?\$ to \$\\text\{(\w+)\}(\^2)?\$\.$/);
    if (m) return { kind: 'area', value: Number(m[1]), from: m[3] || m[2] === 'ha' ? (m[2] === 'ha' ? 'ha' : m[2] + '2') : m[2], to: m[4] === 'ha' ? 'ha' : m[4] + '2' };
    m = c.match(/^Convert \$(\d+)\\text\{ (\w+)\}(\d+)\\text\{ (\w+)\}\$ to (\w+)\.$/);
    if (m) return { kind: 'mixed', big: Number(m[1]), bigU: m[2], small: Number(m[3]), smallU: m[4], to: m[5] };
    m = c.match(/^Convert \$([\d.]+)\\text\{ (\w+)\}\$ to (\w+)\.$/);
    if (m) return { kind: 'plain', value: Number(m[1]), from: m[2], to: m[3] };
    m = c.match(/\$([\d.]+)\\text\{ (\w+)\}\$ long\. Convert this length to (\w+)\.$/);
    if (m) return { kind: 'worded', value: Number(m[1]), from: m[2], to: LEN_NAMES[m[3]] };
    return null;
}
function expectedConversion(p) {
    if (p.kind === 'area') return p.value * AREA_TO_M2[p.from] / AREA_TO_M2[p.to];
    if (p.kind === 'mixed') return (p.big * LIN_TO_M[p.bigU] + p.small * LIN_TO_M[p.smallU]) / LIN_TO_M[p.to];
    return p.value * LIN_TO_M[p.from] / LIN_TO_M[p.to];
}

test('Length unit-convert: every difficulty recomputes and differs in kind', () => {
    const kinds = {};
    for (const diff of DIFFS) {
        kinds[diff] = new Set();
        for (const { q, seed } of collect(gen, 'Length', 'unit-convert', diff, 200, 8)) {
            const p = parseConversion(q.clue);
            assert.ok(p, `${diff}/seed${seed}: unparsed clue ${q.clue}`);
            assert.ok(approxEqual(Number(q.answer), expectedConversion(p), 1e-6),
                `${diff}/seed${seed}: ${q.clue} → ${q.answer} (expected ${expectedConversion(p)})`);
            kinds[diff].add(p.kind);
            const hasDecimal = /\d\.\d/.test(q.clue);
            if (diff === 'Easy') {
                assert.equal(p.kind, 'plain', `Easy must be a plain single-step conversion: ${q.clue}`);
                assert.ok(!hasDecimal && Number.isInteger(Number(q.answer)), `Easy must use whole numbers: ${q.clue} → ${q.answer}`);
                assert.ok(['cm', 'mm', 'm', 'km'].includes(p.from) && p.from !== p.to);
            } else if (diff === 'Medium') {
                assert.notEqual(p.kind, 'area', `Medium must not use area units: ${q.clue}`);
            } else {
                assert.equal(p.kind, 'area', `Hard must be an area conversion: ${q.clue}`);
                assert.match(q.clue, /\^2|ha/, 'Hard length ops contain area units');
            }
        }
    }
    assert.deepEqual([...kinds.Easy], ['plain']);
    assert.ok(kinds.Medium.has('worded') && kinds.Medium.has('mixed') && kinds.Medium.has('plain'), `Medium kinds: ${[...kinds.Medium]}`);
});

test('Length unit-convert: Medium uses decimals; Hard covers every area factor', () => {
    const med = collect(gen, 'Length', 'unit-convert', 'Medium', 200, 8).map(x => x.q);
    assert.ok(med.some(q => /\d\.\d/.test(q.clue)), 'Medium has decimal values in the clue');
    assert.ok(med.some(q => !Number.isInteger(Number(q.answer))), 'Medium has decimal answers');
    const factors = new Set();
    for (const { q } of collect(gen, 'Length', 'unit-convert', 'Hard', 300, 8)) {
        const p = parseConversion(q.clue);
        factors.add(`${p.from}->${p.to}`);
    }
    for (const pair of ['m2->cm2', 'cm2->m2', 'mm2->cm2', 'cm2->mm2', 'm2->km2', 'km2->m2', 'ha->m2', 'm2->ha']) {
        assert.ok(factors.has(pair), `Hard never produced ${pair}; got ${[...factors]}`);
    }
});

test('Length unit-convert: the canonical area factors are exact', () => {
    // 1 m² = 10 000 cm²; 1 cm² = 100 mm²; 1 km² = 1 000 000 m²; 1 ha = 10 000 m²
    const seen = new Set();
    for (const { q } of collect(gen, 'Length', 'unit-convert', 'Hard', 300, 8)) {
        const c = q.clue.replace(/\\,/g, '').replace(/\\ /g, '');
        const m = c.match(/^Convert \$([\d.]+)\\text\{m\}\^2\$ to \$\\text\{cm\}\^2\$\.$/);
        if (m) { assert.equal(Number(q.answer), Math.round(Number(m[1]) * 10000 * 1e6) / 1e6); seen.add('m2cm2'); }
        const n = c.match(/^Convert \$([\d.]+)\\text\{ha\}\$ to \$\\text\{m\}\^2\$\.$/);
        if (n) { assert.equal(Number(q.answer), Math.round(Number(n[1]) * 10000 * 1e6) / 1e6); seen.add('ham2'); }
    }
    assert.equal(seen.size, 2);
});

// ------------------------------------------------------------------
// 2. Financial maths: commission and term payments
// ------------------------------------------------------------------
test('Financial commission: answers recompute; difficulty changes the question type', () => {
    const types = { Easy: new Set(), Medium: new Set(), Hard: new Set() };
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Financial Maths', 'commission', diff, 250, 6)) {
            const c = q.clue, n = nums(c), a = Number(q.answer), L = `${diff}/seed${seed}: ${c} → ${q.answer}`;
            let exp, type;
            if (/base salary of .* How much must they sell/.test(c)) { const [B, r, E] = n; exp = cents((E - B) * 100 / r); type = 'sales-needed'; }
            else if (/in commission on sales of/.test(c)) { const [C, S] = n; exp = cents(C / S * 100); type = 'find-rate'; }
            else if (/commission earned was/.test(c)) { const [r, T, C] = n; exp = cents(T + C * 100 / r); type = 'threshold-sales'; }
            else if (/PAYG tax/.test(c)) { const [r, S, tax] = n; exp = cents(S * r / 100 * (1 - tax / 100)); type = 'net-payg'; }
            else if (/base salary of/.test(c)) { const [B, r, S] = n; exp = cents(B + S * r / 100); type = 'base-plus'; }
            else if (/sales above/.test(c)) { const [r, T, S] = n; assert.ok(S > T, L); exp = cents((S - T) * r / 100); type = 'over-threshold'; }
            else { const [r, S] = n; exp = cents(S * r / 100); type = 'fixed-pct'; }
            assert.ok(approxEqual(a, exp, 1e-6), `${L} (expected ${exp})`);
            types[diff].add(type);
        }
    }
    assert.deepEqual([...types.Easy], ['fixed-pct']);
    assert.deepEqual([...types.Medium].sort(), ['base-plus', 'over-threshold']);
    for (const t of ['sales-needed', 'find-rate', 'threshold-sales', 'net-payg']) assert.ok(types.Hard.has(t), `Hard never produced ${t}`);
});

test('Financial term-payments: answers recompute; difficulty changes the question type', () => {
    const types = { Easy: new Set(), Medium: new Set(), Hard: new Set() };
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Financial Maths', 'term-payments', diff, 250, 6)) {
            const c = q.clue, n = nums(c), a = Number(q.answer), L = `${diff}/seed${seed}: ${c} → ${q.answer}`;
            let exp, type;
            if (/equivalent \*flat interest rate\*/.test(c)) {
                const [C, p, mths, m] = n; const dep = C * p / 100, bal = C - dep;
                const interest = dep + m * mths - C; assert.ok(interest > 0, `${L}: terms must cost more than cash`);
                exp = cents(interest / bal / (mths / 12) * 100); type = 'flat-rate';
            } else if (/simple interest at/.test(c)) {
                const [C, p, r, y] = n; const bal = C - C * p / 100;
                exp = cents(bal * (1 + r * y / 100) / (12 * y)); type = 'simple-interest-instalment';
            } else if (/deposit as a percentage of the cash price/.test(c)) {
                const [C, cnt, m, T] = n; exp = cents((T - cnt * m) / C * 100); type = 'deposit-pct';
            } else if (/how much more the buyer pays/.test(c)) {
                const [C, p, cnt, m] = n; exp = cents(C * p / 100 + cnt * m - C); assert.ok(exp > 0, L); type = 'extra-cost';
            } else if (/equal (monthly|weekly) instalments/.test(c)) {
                const [T, D, cnt] = n; exp = cents((T - D) / cnt); type = 'find-instalment';
            } else {
                const [D, cnt, m] = n; exp = cents(D + cnt * m); type = 'total-cost';
                assert.ok(!/%/.test(c), `Easy total-cost uses a dollar deposit: ${c}`);
            }
            assert.ok(approxEqual(a, exp, 1e-6), `${L} (expected ${exp})`);
            types[diff].add(type);
        }
    }
    assert.deepEqual([...types.Easy], ['total-cost']);
    assert.deepEqual([...types.Medium].sort(), ['extra-cost', 'find-instalment']);
    for (const t of ['flat-rate', 'simple-interest-instalment', 'deposit-pct']) assert.ok(types.Hard.has(t), `Hard never produced ${t}`);
});

// ------------------------------------------------------------------
// 3. Time: 24-hour conversion
// ------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');
const norm = (m) => ((m % 1440) + 1440) % 1440;
const hm24 = (m) => `${pad2(Math.floor(norm(m) / 60))}:${pad2(norm(m) % 60)}`;
const hm12 = (m) => { const h = Math.floor(norm(m) / 60); return `${h % 12 || 12}:${pad2(norm(m) % 60)} ${h < 12 ? 'am' : 'pm'}`; };
const t12 = (c) => [...c.matchAll(/\$(\d{1,2})\{:\}(\d{2})\\text\{ (am|pm)\}\$/g)].map(m => ((+m[1] % 12) + (m[3] === 'pm' ? 12 : 0)) * 60 + +m[2]);
const t24 = (c) => [...c.matchAll(/\$(\d{1,2})\{:\}(\d{2})\$/g)].map(m => +m[1] * 60 + +m[2]);
const durMin = (c) => {
    const h = c.match(/takes \$(\d+)\$ hours?/), m = c.match(/hours? \$(\d+)\$ minutes?|takes \$(\d+)\$ minutes/);
    return (h ? +h[1] * 60 : 0) + (m ? +(m[1] || m[2]) : 0);
};

test('Time convert: every variant recomputes (12 am = 00:00, 12 pm = 12:00, 24:00 = 00:00)', () => {
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(gen, 'Time', 'convert', diff, 250, 6)) {
            const c = q.clue, a = String(q.answer), L = `${diff}/seed${seed}: ${c} → ${a}`;
            if (/The clock shows/.test(c)) continue;                         // analogue-clock reading (Easy only)
            if (/Write \$(\d{1,2})\{:\}(\d{2})\\text\{ (am|pm)\}\$ in 24-hour time/.test(c)) {
                assert.equal(a, hm24(t12(c)[0]), L);
            } else if (/Write \$24\{:\}00\$ as 12-hour/.test(c)) {
                assert.equal(a, '12:00 am', L);
            } else if (/^Write \$\d{1,2}\{:\}\d{2}\$ as 12-hour time/.test(c)) {
                assert.equal(a, hm12(t24(c)[0]), L);
            } else if (/leaves at .* trip takes .* 24-hour time/.test(c)) {
                assert.equal(a, hm24(t12(c)[0] + durMin(c)), L);
            } else if (/departs at .* journey takes .* 12-hour time/.test(c)) {
                assert.equal(a, hm12(t24(c)[0] + durMin(c)), L);
            } else if (/shift starts at .* finishes at/.test(c)) {
                const [s, e] = t12(c);
                assert.equal(Number(a), norm(e - s), L);
                assert.equal(/the next day/.test(c), e < s, `${L}: "next day" wording must match crossing midnight`);
            } else assert.fail(`unrecognised Time convert clue: ${c}`);
        }
    }
});

test('Time convert: Easy is plain am/pm, Medium crosses noon/midnight, Hard is noon/midnight edge cases', () => {
    const isEdge = (c) => /\$12\{:\}\d{2}(\\text\{ (am|pm)\})?\$|\$00\{:\}\d{2}\$|\$24\{:\}00\$/.test(c);
    let hardKinds = new Set(), mediumCross = 0, sawNoon = false, sawMidnight = false, saw2400 = false, saw0030 = false;
    for (const { q } of collect(gen, 'Time', 'convert', 'Easy', 200, 8)) {
        assert.ok(!isEdge(q.clue), `Easy must avoid 12 am / 12 pm / 00:xx: ${q.clue}`);
        assert.ok(!/shift|journey|trip/.test(q.clue), `Easy has no duration working: ${q.clue}`);
    }
    for (const { q } of collect(gen, 'Time', 'convert', 'Medium', 200, 8)) {
        assert.ok(/shift|journey|trip/.test(q.clue), `Medium is about durations: ${q.clue}`);
        assert.ok(!isEdge(q.clue), `Medium avoids the 12 edge in the given times: ${q.clue}`);
        assert.ok(!/^(00|12):|^12:/.test(String(q.answer)) || /^\d+$/.test(q.answer), `Medium answer avoids 12/00 hour: ${q.answer}`);
        if (/the next day|next day/.test(q.clue) || (/(leaves|departs)/.test(q.clue) && /^0|am$/.test(q.answer))) mediumCross++;
    }
    assert.ok(mediumCross > 20, `Medium rarely crosses midnight (${mediumCross})`);
    for (const { q } of collect(gen, 'Time', 'convert', 'Hard', 300, 8)) {
        assert.ok(isEdge(q.clue), `Hard must be a noon/midnight edge case: ${q.clue}`);
        const c = q.clue;
        if (/^Write \$12\{:\}\d{2}\\text\{ am\}\$/.test(c)) { hardKinds.add('12am'); assert.match(q.answer, /^00:/); sawMidnight = true; if (/12\{:\}30\\text\{ am/.test(c)) { assert.equal(q.answer, '00:30'); saw0030 = true; } }
        else if (/^Write \$12\{:\}\d{2}\\text\{ pm\}\$/.test(c)) { hardKinds.add('12pm'); assert.match(q.answer, /^12:/); sawNoon = true; }
        else if (/24\{:\}00\$ as 12-hour/.test(c)) { hardKinds.add('2400'); saw2400 = true; }
        else if (/^Write \$00\{:\}/.test(c)) { hardKinds.add('0000to12'); assert.match(q.answer, /^12:\d{2} am$/); }
        else if (/^Write \$12\{:\}\d{2}\$ as 12-hour/.test(c)) { hardKinds.add('1200to12'); assert.match(q.answer, /^12:\d{2} pm$/); }
        else hardKinds.add('elapsed');
    }
    assert.ok(sawNoon && sawMidnight && saw2400 && saw0030, 'Hard covers 12 pm, 12 am, 24:00 and 12:30 am');
    assert.equal(hardKinds.size, 6, `Hard kinds: ${[...hardKinds]}`);
});

// ------------------------------------------------------------------
// 4. Linear relationships: distance, equation from gradient + point, general form
// ------------------------------------------------------------------
const pts = (c) => [...c.matchAll(/\$\((-?\d+), (-?\d+)\)\$/g)].map(m => [Number(m[1]), Number(m[2])]);
const squareFree = (n) => { for (let f = 2; f * f <= n; f++) if (n % (f * f) === 0) return false; return true; };

test('Linear distance: recomputes; Easy axis-parallel, Medium integer, Hard surd or decimal', () => {
    const hard = new Set();
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Linear Relationships', 'distance', diff, 200, 6)) {
            const [[x1, y1], [x2, y2]] = pts(q.clue);
            const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1), n = dx * dx + dy * dy, L = `${diff}/seed${seed}: ${q.clue} → ${q.answer}`;
            assert.deepEqual(q.diagram.pts, [[x1, y1], [x2, y2]], `${L}: diagram points`);
            if (diff === 'Easy') {
                assert.ok(dx === 0 || dy === 0, `${L}: Easy must be horizontal or vertical`);
                assert.equal(Number(q.answer), dx + dy, L);
            } else if (diff === 'Medium') {
                assert.ok(dx > 0 && dy > 0 && Number.isInteger(Math.sqrt(n)), `${L}: Medium is an integer (Pythagorean) distance`);
                assert.equal(Number(q.answer), Math.sqrt(n), L);
            } else {
                assert.ok(dx > 0 && dy > 0 && !Number.isInteger(Math.sqrt(n)), `${L}: Hard is irrational`);
                const sm = String(q.answer).match(/^(\d*)√(\d+)$/);
                if (sm) {
                    const k = sm[1] === '' ? 1 : Number(sm[1]), rad = Number(sm[2]);
                    assert.equal(k * k * rad, n, `${L}: surd must equal √${n}`);
                    assert.ok(squareFree(rad), `${L}: surd not in simplest form`);
                    assert.match(q.clue, /simplest surd form/);
                    assert.ok(q.answerDisplay.includes('\\sqrt'), `${L}: display`);
                    hard.add('surd');
                } else {
                    assert.equal(Number(q.answer), Math.round(Math.sqrt(n) * 10) / 10, L);
                    assert.match(q.clue, /1 decimal place/);
                    hard.add('decimal');
                }
            }
        }
    }
    assert.deepEqual([...hard].sort(), ['decimal', 'surd']);
});

// "y=mx+c" answer key → { mn, md, c }
function parseLineAnswer(a) {
    const m = a.match(/^y=(?:\((-?\d+)\/(\d+)\)|(-?\d*))x(?:([+-]\d+))?$/);
    assert.ok(m, `unparsable line answer ${a}`);
    if (m[1] !== undefined) return { mn: +m[1], md: +m[2], c: m[4] ? +m[4] : 0 };
    const mn = m[3] === '' ? 1 : m[3] === '-' ? -1 : +m[3];
    return { mn, md: 1, c: m[4] ? +m[4] : 0 };
}

test('Linear equation-from-gp: every answer passes through the point with the stated gradient', () => {
    const grad = (c) => {
        const f = c.match(/gradient \$(-?)\\frac\{(\d+)\}\{(\d+)\}\$/);
        if (f) return { n: (f[1] ? -1 : 1) * +f[2], d: +f[3] };
        const i = c.match(/gradient \$(-?\d+)\$/);
        return { n: +i[1], d: 1 };
    };
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Linear Relationships', 'equation-from-gp', diff, 200, 6)) {
            const c = q.clue, g = grad(c), line = parseLineAnswer(q.answer), L = `${diff}/seed${seed}: ${c} → ${q.answer}`;
            assert.equal(line.mn * g.d, g.n * line.md, `${L}: gradient`);          // equal rationals
            if (diff === 'Easy') {
                const ic = c.match(/\$y\$-intercept \$(-?\d+)\$/);
                assert.ok(ic, `${L}: Easy states the y-intercept`);
                assert.equal(line.c, +ic[1], L);
                assert.equal(g.d, 1);
            } else {
                const [[x1, y1]] = pts(c);
                assert.ok(x1 !== 0, `${L}: Medium/Hard use a point that is not the y-intercept`);
                assert.equal(y1 * line.md, line.mn * x1 + line.c * line.md, `${L}: passes through (${x1}, ${y1})`);
                if (diff === 'Medium') assert.equal(g.d, 1, `${L}: Medium gradient is an integer`);
                else { assert.ok(g.d > 1 && gcd(Math.abs(g.n), g.d) === 1, `${L}: Hard gradient is a proper fraction`); assert.ok(/y = mx \+ c/.test(c)); }
            }
        }
    }
    const neg = collect(genStage5, 'Linear Relationships', 'equation-from-gp', 'Hard', 200, 6).filter(x => /gradient \$-\\frac/.test(x.q.clue));
    assert.ok(neg.length > 20, 'Hard includes negative fractional gradients');
});

// parse "Ax + By + C = 0" (as printed) → [A, B, C]
function parseGeneral(tex) {
    const m = tex.replace(/\s/g, '').match(/^(-?\d*)x([+-]\d*)y(?:([+-]\d+))?=0$/);
    assert.ok(m, `unparsable general form ${tex}`);
    const co = (s) => (s === '' || s === '+' ? 1 : s === '-' ? -1 : Number(s));
    return [co(m[1]), co(m[2]), m[3] ? Number(m[3]) : 0];
}
// parse "y = mx + c" as printed (m, c rational) → {mn, md, cn, cd}
function parseYForm(tex) {
    const m = tex.replace(/\s/g, '').match(/^y=(-?)(?:\\frac\{(\d+)\}\{(\d+)\}|(\d*))x(?:([+-])(?:\\frac\{(\d+)\}\{(\d+)\}|(\d+)))?$/);
    assert.ok(m, `unparsable line ${tex}`);
    const sg = m[1] ? -1 : 1;
    const mn = m[2] ? sg * +m[2] : sg * (m[4] === '' ? 1 : +m[4]), md = m[3] ? +m[3] : 1;
    const cs = m[5] === '-' ? -1 : 1;
    const cn = m[5] ? cs * (m[6] ? +m[6] : +m[8]) : 0, cd = m[7] ? +m[7] : 1;
    return { mn, md, cn, cd };
}
// does (x, y) satisfy Ax + By + C = 0 where y = (mn x cd + cn md) / (md cd)?
function lineSatisfies(gen3, y) {
    const [A, B, C] = gen3;
    for (const x of [-2, 0, 1, 3]) {
        const den = y.md * y.cd, num = y.mn * x * y.cd + y.cn * y.md;
        if ((A * x + C) * den + B * num !== 0) return false;
    }
    return true;
}

test('Linear general-form: conversions are equivalent lines; difficulty changes the direction and numbers', () => {
    const kinds = { Easy: new Set(), Medium: new Set(), Hard: new Set() };
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Linear Relationships', 'general-form', diff, 250, 6)) {
            const c = q.clue, L = `${diff}/seed${seed}: ${c} → ${q.answer}`;
            const spans = [...c.matchAll(/\$([^$]+)\$/g)].map(m => m[1]);
            if (/^Rewrite \$y = .*\$ in the general form/.test(c)) {
                const y = parseYForm(spans[0]);
                const ans = parseGeneral(q.answer);
                assert.ok(lineSatisfies(ans, y), `${L}: not the same line`);
                assert.equal(q.answerDisplay.replace(/\s/g, '').replace(/\$/g, ''), q.answer, `${L}: display ≠ key`);
                if (diff !== 'Medium') {
                    assert.ok(ans[0] > 0 && gcd(gcd(Math.abs(ans[0]), Math.abs(ans[1])), Math.abs(ans[2])) === 1, `${L}: integer, simplest, a > 0`);
                }
                kinds[diff].add(y.md > 1 || y.cd > 1 ? 'frac-to-general' : 'int-to-general');
                if (diff === 'Easy') { assert.equal(y.md, 1); assert.ok(y.mn > 0 && y.cd === 1); }
                if (diff === 'Hard') assert.ok(y.md > 1, `${L}: Hard has a fractional gradient`);
            } else if (/^Rewrite \$.*= 0\$ in the form/.test(c)) {
                const gnl = parseGeneral(spans[0]);
                const y = parseLineAnswer(q.answer);
                assert.ok(lineSatisfies(gnl, { mn: y.mn, md: y.md, cn: y.c, cd: 1 }), `${L}: not the same line`);
                assert.ok(y.mn !== 0);
                kinds[diff].add(y.md > 1 ? 'general-to-frac' : 'general-to-int');
                if (diff === 'Medium') assert.equal(y.md, 1);
                if (diff === 'Hard') assert.ok(y.md > 1, `${L}: Hard has a fractional gradient`);
            } else {
                // Medium intercepts
                const [A, B, C] = parseGeneral(spans[0]);
                if (/x-intercept/.test(c)) assert.equal(Number(q.answer), -C / A, L);
                else assert.equal(Number(q.answer), -C / B, L);
                kinds[diff].add('intercept');
            }
        }
    }
    assert.deepEqual([...kinds.Easy], ['int-to-general']);
    assert.deepEqual([...kinds.Medium].sort(), ['general-to-int', 'intercept']);
    assert.deepEqual([...kinds.Hard].sort(), ['frac-to-general', 'general-to-frac']);
});

// ------------------------------------------------------------------
// 5. Probability: conditional, Venn, two-way tables
// ------------------------------------------------------------------
test('Probability conditional: both P(A|B) and P(B|A); "given that" wording at every difficulty', () => {
    const dirs = { Easy: new Set(), Medium: new Set() }, hardKinds = new Set();
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Probability', 'conditional', diff, 250, 6)) {
            const c = q.clue, L = `${diff}/seed${seed}: ${c} → ${q.answer}`;
            assert.match(c, /[Gg]iven that/, `${L}: needs 'given that' wording`);
            if (diff === 'Easy') {
                const m = c.match(/play (\w+) and (\w+)\. Given that a student plays (\w+), find the probability that they also play (\w+)\./);
                assert.ok(m, L);
                assert.equal(q.diagram.type, 'table');
                const rows = q.diagram.rows, [A, B] = [m[1], m[2]];
                assert.equal(rows[0][0].toLowerCase(), A); assert.equal(q.diagram.head[1].toLowerCase(), B);
                const both = rows[0][1], onlyA = rows[0][2], onlyB = rows[1][1];
                assert.equal(rows[0][3], both + onlyA); assert.equal(rows[2][1], both + onlyB);
                const given = m[3], find = m[4];
                assert.deepEqual([given, find].sort(), [A, B].sort());
                assertFrac(q, both, given === A ? both + onlyA : both + onlyB, L);
                dirs.Easy.add(given === A ? 'B|A' : 'A|B');
            } else if (diff === 'Medium') {
                const m = c.match(/group of \$(\d+)\$ students, \$(\d+)\$ study (\w+), \$(\d+)\$ study (\w+), and \$(\d+)\$ study both\. Given that a student studies (\w+), find the probability that they also study (\w+)\./);
                assert.ok(m, L);
                const [nA, A, nB, B, both, given, find] = [+m[2], m[3], +m[4], m[5], +m[6], m[7], m[8]];
                assert.deepEqual([given, find].sort(), [A, B].sort());
                assertFrac(q, both, given === A ? nA : nB, L);
                dirs.Medium.add(given === A ? 'B|A' : 'A|B');
            } else if (/does \*not\* study/.test(c)) {
                const m = c.match(/group of \$(\d+)\$ students, \$(\d+)\$ study (\w+), \$(\d+)\$ study (\w+), and \$(\d+)\$ study both\. Given that a student does \*not\* study (\w+), find the probability that they study (\w+)\./);
                assert.ok(m, L);
                const [T, nA, A, nB, B, both, given, find] = [+m[1], +m[2], m[3], +m[4], m[5], +m[6], m[7], m[8]];
                assert.deepEqual([given, find].sort(), [A, B].sort());
                const [nGiven, nFind] = given === A ? [nA, nB] : [nB, nA];
                assertFrac(q, nFind - both, T - nGiven, L);
                hardKinds.add(given === A ? 'A-complement' : 'B-complement');
            } else {
                const m = c.match(/P\(A\) = ([\d.]+)\$, \$P\(B\) = ([\d.]+)\$ and \$P\(A \\cap B\) = ([\d.]+)\$\. Given that \$(\w)\$ has occurred, find the probability that \$(\w)\$ also occurs\./);
                assert.ok(m, L);
                const [pa, pb, pab] = [m[1], m[2], m[3]].map(v => Math.round(Number(v) * 100));
                assert.ok(pab < pa && pab < pb && pa + pb - pab <= 100, `${L}: probabilities must be consistent`);
                assert.notEqual(m[4], m[5]);
                assertFrac(q, pab, m[4] === 'A' ? pa : pb, L);
                hardKinds.add(m[4] === 'A' ? 'P(B|A)' : 'P(A|B)');
            }
        }
    }
    assert.deepEqual([...dirs.Easy].sort(), ['A|B', 'B|A']);
    assert.deepEqual([...dirs.Medium].sort(), ['A|B', 'B|A']);
    assert.ok(hardKinds.has('P(B|A)') && hardKinds.has('P(A|B)') && hardKinds.size >= 4, `Hard kinds: ${[...hardKinds]}`);
});

// Evaluate a Venn clue against the four regions; returns [favourable, total].
function vennFav(clue, [la, lb], { a, ab, b, out }) {
    const total = a + ab + b + out, nA = a + ab, nB = b + ab;
    const has = (re) => re.test(clue);
    if (has(new RegExp(`Given that a person likes ${la}, find the probability that they also like ${lb}`))) return [ab, nA];
    if (has(new RegExp(`Given that a person likes ${lb}, find the probability that they also like ${la}`))) return [ab, nB];
    if (has(new RegExp(`Given that a person does \\*not\\* like ${lb}, find the probability that they like ${la}`))) return [a, a + out];
    if (has(new RegExp(`Given that a person does \\*not\\* like ${la}, find the probability that they like ${lb}`))) return [b, b + out];
    if (has(new RegExp(`likes ${la} \\*only\\*`))) return [a, total];
    if (has(new RegExp(`likes ${lb} \\*only\\*`))) return [b, total];
    if (has(/likes \*both\*/)) return [ab, total];
    if (has(/likes \*neither\*/)) return [out, total];
    if (has(new RegExp(`likes ${la} \\(in total\\)`))) return [nA, total];
    if (has(new RegExp(`likes ${la} \\*or\\* ${lb}`))) return [a + ab + b, total];
    if (has(new RegExp(`does \\*not\\* like ${la}`))) return [total - nA, total];
    if (has(new RegExp(`likes ${lb} but \\*not\\* ${la}`))) return [b, total];
    assert.fail(`unrecognised Venn clue: ${clue}`);
}

test('Probability venn: Easy reads a region, Medium union/complement, Hard conditional from the diagram', () => {
    const seen = { Easy: new Set(), Medium: new Set(), Hard: new Set() };
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Probability', 'venn', diff, 250, 6)) {
            const c = q.clue, L = `${diff}/seed${seed}: ${c} → ${q.answer}`, d = q.diagram;
            assert.equal(d.type, 'venn');
            let regions, labels;
            if (d.essential) {
                regions = d.regions; labels = d.labels.map(x => x.toLowerCase());
            } else {
                // Medium text-only form: rebuild the regions from the counts in the clue
                const m = c.match(/survey of \$(\d+)\$ people, \$(\d+)\$ like (\w+), \$(\d+)\$ like (\w+), and \$(\d+)\$ like both/);
                assert.ok(m, L);
                const [T, nA, nB, both] = [+m[1], +m[2], +m[4], +m[6]];
                regions = { a: nA - both, ab: both, b: nB - both, out: T - (nA + nB - both) };
                labels = [m[3], m[5]];
                assert.deepEqual(d.labels.map(x => x.toLowerCase()), labels);
            }
            assert.equal(regions.a + regions.ab + regions.b + regions.out, d.total, `${L}: regions sum`);
            assert.ok(regions.out > 0 && regions.a > 0 && regions.b > 0 && regions.ab > 0, `${L}: all regions non-empty`);
            const [fav, tot] = vennFav(c, labels, regions);
            assertFrac(q, fav, tot, L);
            const kind = /Given that/.test(c) ? 'conditional' : /\*or\*|does \*not\*|but \*not\*|\*nor\*/.test(c) ? 'union-complement' : 'read';
            seen[diff].add(kind);
        }
    }
    assert.deepEqual([...seen.Easy], ['read']);
    assert.deepEqual([...seen.Medium], ['union-complement']);
    assert.deepEqual([...seen.Hard], ['conditional']);
});

test('Probability two-way: Easy single cell, Medium "or" / complement, Hard "given that" (both directions)', () => {
    const seen = { Easy: new Set(), Medium: new Set(), Hard: new Set() }, hardDirs = new Set();
    for (const diff of DIFFS) {
        for (const { q, seed } of collect(genStage5, 'Probability', 'two-way', diff, 250, 6)) {
            const c = q.clue, L = `${diff}/seed${seed}: ${c} → ${q.answer}`, [boys, girls, totals] = q.diagram.rows;
            const [bt, bn, gt, gn] = [boys[1], boys[2], girls[1], girls[2]], T = bt + bn + gt + gn;
            assert.equal(totals[3], T, `${L}: table grand total`);
            assert.equal(totals[1], bt + gt); assert.equal(totals[2], bn + gn);
            const table = {
                'a *boy who plays tennis*': [bt, T], 'a *girl who plays tennis*': [gt, T],
                'a *boy who does not play tennis*': [bn, T], 'a student who *plays tennis*': [bt + gt, T],
                'a student who is a *boy or plays tennis*': [bt + bn + gt, T],
                'a student who is a *girl or does not play tennis*': [gt + gn + bn, T],
                'a student who does *not* play tennis': [bn + gn, T], 'a *girl*': [gt + gn, T],
            };
            let fav, tot, kind;
            const pick = Object.keys(table).find(k => c.endsWith(`choosing ${k}.`));
            if (pick) {
                [fav, tot] = table[pick];
                kind = diff === 'Easy' ? 'cell' : 'or-complement';
            } else {
                const g = {
                    'plays tennis, find the probability that the student is a girl': [gt, bt + gt, 'girl|plays'],
                    'is a girl, find the probability that the student plays tennis': [gt, gt + gn, 'plays|girl'],
                    'is a boy, find the probability that the student does not play tennis': [bn, bt + bn, 'not-play|boy'],
                    'does not play tennis, find the probability that the student is a boy': [bn, bn + gn, 'boy|not-play'],
                };
                const key = Object.keys(g).find(k => c.endsWith(`Given that a student ${k}.`));
                assert.ok(key, `${L}: unrecognised`);
                [fav, tot] = [g[key][0], g[key][1]]; hardDirs.add(g[key][2]); kind = 'conditional';
            }
            assertFrac(q, fav, tot, L);
            seen[diff].add(kind);
        }
    }
    assert.deepEqual([...seen.Easy], ['cell']);
    assert.deepEqual([...seen.Medium], ['or-complement']);
    assert.deepEqual([...seen.Hard], ['conditional']);
    assert.equal(hardDirs.size, 4, `Hard directions: ${[...hardDirs]}`);
});
