// =============================================================

// generators/mathsQuestionGen.js
// Local maths question generator — no API required.
// Produces clue bank entries for: integers, decimals, rounding,
// fractions, percentages, algebra, statistics, financial maths,
// geometry.
// =============================================================

// Seeded PRNG (Mulberry32)
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function ri(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function rc(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function round(n, dp) { const f = Math.pow(10, dp); return Math.round(n * f) / f; }

const CALC_VERBS   = ['Calculate:', 'Evaluate:', 'Find the value of:', 'Work out:'];
const MULT_VERBS   = ['Calculate:', 'Evaluate:', 'Find the product:', 'Work out:'];
const DIV_VERBS    = ['Calculate:', 'Evaluate:', 'Find the quotient:', 'Work out:'];
const BODMAS_VERBS = ['Evaluate:', 'Calculate:', 'Apply order of operations to find:'];
const SOLVE_VERBS  = ['Solve:', 'Find $x$:', 'Determine $x$:', 'Calculate $x$:', 'Find the value of $x$:'];

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }

// Simplify fraction; return {n, d}
function simplify(n, d) {
    const g = gcd(Math.abs(n), Math.abs(d));
    return { n: n / g, d: d / g };
}
function fracStr(n, d) {
    const s = simplify(n, d);
    return s.d === 1 ? String(s.n) : `${s.n}/${s.d}`;
}

// ============================================================
// SUB_OPS metadata — defines selectable sub-operations per topic.
// Each entry: { key, label }
// ============================================================
export const SUB_OPS = {
    'Integers': [
        { key: 'add', label: 'Add (+)' },
        { key: 'subtract', label: 'Subtract (−)' },
        { key: 'multiply', label: 'Multiply (×)' },
        { key: 'divide', label: 'Divide (÷)' },
        { key: 'bodmas', label: 'BODMAS' },
    ],
    'Decimals': [
        { key: 'add-subtract', label: 'Add / Subtract' },
        { key: 'multiply-divide', label: 'Multiply / Divide' },
    ],
    'Rounding': [
        { key: 'nearest', label: 'Nearest 10 / 100 / 1000' },
        { key: 'decimal-places', label: 'Decimal places' },
        { key: 'sig-figs', label: 'Significant figures' },
    ],
    'Fractions': [
        { key: 'fraction-of', label: 'Fraction of amount' },
        { key: 'add-subtract', label: 'Add / Subtract' },
        { key: 'multiply-divide', label: 'Multiply / Divide' },
        { key: 'simplify-convert', label: 'Simplify / Convert' },
    ],
    'Percentages': [
        { key: 'find-pct', label: 'Find percentage' },
        { key: 'increase-decrease', label: 'Increase / Decrease' },
        { key: 'reverse-change', label: 'Reverse / % change' },
    ],
    'Algebra': [
        { key: 'solve', label: 'Solve equations' },
        { key: 'substitution', label: 'Substitution' },
    ],
    'Geometry': [
        { key: 'area-perimeter', label: 'Area / Perimeter' },
        { key: 'pythagoras', label: 'Pythagoras' },
        { key: 'angles', label: 'Angles' },
        { key: 'circles', label: 'Circles' },
    ],
    'Statistics': [
        { key: 'mean-median', label: 'Mean / Median' },
        { key: 'mode-range', label: 'Mode / Range' },
        { key: 'iqr', label: 'Interquartile range' },
    ],
    'Financial Maths': [
        { key: 'simple-interest', label: 'Simple interest' },
        { key: 'compound-interest', label: 'Compound interest' },
        { key: 'markup-profit', label: 'Markup / Profit' },
        { key: 'gst', label: 'GST' },
    ],
};

// Helper: check if a sub-op is allowed (null = all allowed)
function _ok(allowedOps, key) { return !allowedOps || allowedOps.includes(key); }

// Helper: filter a types array.
// Returns null when no filter (use original logic),
// or an array (possibly empty) when filter is active.
function _filterTypes(typeMap, allowedOps) {
    if (!allowedOps) return null; // null = use original ri() logic
    const types = [];
    for (const [key, indices] of Object.entries(typeMap)) {
        if (allowedOps.includes(key)) types.push(...indices);
    }
    return types; // may be empty → generator should return null
}

// Helper: pick from filtered types or fall back to ri()
function _pickType(rng, filtered, max) {
    if (Array.isArray(filtered) && filtered.length === 0) return -1; // signals "nothing available"
    return filtered ? rc(rng, filtered) : ri(rng, 0, max);
}

// ============================================================
// INTEGER arithmetic
// ============================================================
function genIntegers(rng, diff, allowedOps) {
    const OP_MAP = { '+': 'add', '-': 'subtract', '×': 'multiply', '÷': 'divide', 'bodmas': 'bodmas' };
    let pool = diff === 'Easy' ? ['+', '-', '×'] : diff === 'Hard' ? ['+', '-', '×', '÷', 'bodmas'] : ['+', '-', '×', '÷'];
    if (allowedOps) pool = pool.filter(op => allowedOps.includes(OP_MAP[op]));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === '+') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, max);
        const verb = rc(rng, CALC_VERBS);
        return { clue: `${verb} $${a} + ${b}$`, answer: String(a + b) };
    }
    if (op === '-') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, a);
        const verb = rc(rng, CALC_VERBS);
        return { clue: `${verb} $${a} - ${b}$`, answer: String(a - b) };
    }
    if (op === '×') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 25] : [12, 50];
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        const verb = rc(rng, MULT_VERBS);
        return { clue: `${verb} $${a} \\times ${b}$`, answer: String(a * b) };
    }
    if (op === '÷') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 20] : [6, 40];
        const b = ri(rng, lo, hi), ans = ri(rng, lo, hi);
        const verb = rc(rng, DIV_VERBS);
        return { clue: `${verb} $${b * ans} \\div ${b}$`, answer: String(ans) };
    }
    if (op === 'bodmas') {
        const form = ri(rng, 0, 1);
        const verb = rc(rng, BODMAS_VERBS);
        if (form === 0) {
            const a = ri(rng, 3, 25), b = ri(rng, 3, 15), c = ri(rng, 3, 15);
            return { clue: `${verb} $${a} + ${b} \\times ${c}$`, answer: String(a + b * c) };
        }
        const a = ri(rng, 2, 15), b = ri(rng, 2, 15), c = ri(rng, 3, 12);
        return { clue: `${verb} $(${a} + ${b}) \\times ${c}$`, answer: String((a + b) * c) };
    }
}

// ============================================================
// DECIMALS
// ============================================================
function genDecimals(rng, diff, allowedOps) {
    // type → sub-op mapping per difficulty
    const maps = {
        Easy: { 'add-subtract': [0], 'multiply-divide': [1] },
        Medium: { 'add-subtract': [0, 1], 'multiply-divide': [2] },
        Hard: { 'multiply-divide': [0, 1], 'add-subtract': [2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : 2);
    if (type === -1) return null;

    const verb = rc(rng, CALC_VERBS);
    if (diff === 'Easy') {
        if (type === 0) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 1, 9) / 10;
            return { clue: `${verb} $${a} + ${b}$`, answer: String(round(a + b, 2)) };
        }
        const a = ri(rng, 1, 9) / 10, b = ri(rng, 2, 9);
        return { clue: `${verb} $${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
            return { clue: `${verb} $${a} + ${b}$`, answer: String(round(a + b, 2)) };
        }
        if (type === 1) {
            const a = ri(rng, 20, 99) / 10, b = ri(rng, 1, Math.floor(a * 10) - 1) / 10;
            return { clue: `${verb} $${a} - ${round(b, 1)}$`, answer: String(round(a - b, 2)) };
        }
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        return { clue: `${verb} $${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    // Hard
    if (type === 0) {
        const a = ri(rng, 11, 99) / 10, b = ri(rng, 11, 99) / 10;
        return { clue: `${verb} $${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    if (type === 1) {
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        const ans = round(a / b, 2);
        return { clue: `${verb} $${a} \\div ${b}$`, answer: String(ans) };
    }
    const a = ri(rng, 101, 999) / 100, b = ri(rng, 100, Math.floor(a * 100) - 1) / 100;
    return { clue: `${verb} $${a} - ${b}$`, answer: String(round(a - b, 2)) };
}

// ============================================================
// ROUNDING
// ============================================================
function genRounding(rng, diff, allowedOps) {
    const maps = {
        Easy: { 'nearest': [0, 1] },
        Medium: { 'nearest': [0], 'decimal-places': [1, 2] },
        Hard: { 'nearest': [0], 'decimal-places': [1], 'sig-figs': [2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : 2);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const n = ri(rng, 100, 9999);
            const ans = Math.round(n / 10) * 10;
            const ph = rc(rng, [
                `Round $${n}$ to the nearest $10$`,
                `Write $${n}$ rounded to the nearest $10$`,
                `Estimate $${n}$ to the nearest $10$`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        // Guarantee a non-zero decimal part so the question isn't nonsensical
        // (e.g. "Write 91 as a whole number" makes no sense).
        const whole = ri(rng, 1, 99);
        const frac = ri(rng, 1, 9);
        const n = whole + frac / 10;   // e.g. 7.3, 42.8 — always has .1–.9
        const ph = rc(rng, [
            `Round $${n}$ to the nearest whole number`,
            `Write $${n}$ as a whole number (rounded)`,
        ]);
        return { clue: ph, answer: String(Math.round(n)) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const n = ri(rng, 1000, 99999);
            const ans = Math.round(n / 100) * 100;
            const ph = rc(rng, [
                `Round $${n}$ to the nearest $100$`,
                `Approximate $${n}$ to the nearest $100$`,
                `Write $${n}$ correct to the nearest $100$`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        if (type === 1) {
            const n = ri(rng, 100, 9999) / 100;
            const display = n.toFixed(2);
            const ph = rc(rng, [
                `Round $${display}$ to 1 decimal place`,
                `Write $${display}$ correct to 1 decimal place`,
                `Express $${display}$ to 1 decimal place`,
            ]);
            return { clue: ph, answer: String(round(n, 1)) };
        }
        const n = ri(rng, 1000, 99999) / 1000;
        const display = n.toFixed(3);
        const ph = rc(rng, [
            `Round $${display}$ to 2 decimal places`,
            `Write $${display}$ correct to 2 decimal places`,
            `Express $${display}$ to 2 d.p.`,
        ]);
        return { clue: ph, answer: String(round(n, 2)) };
    }
    // Hard
    if (type === 0) {
        const n = ri(rng, 10000, 999999);
        const ans = Math.round(n / 1000) * 1000;
        const ph = rc(rng, [
            `Round $${n}$ to the nearest $1000$`,
            `Write $${n}$ correct to the nearest $1000$`,
            `Approximate $${n}$ to the nearest $1000$`,
        ]);
        return { clue: ph, answer: String(ans) };
    }
    if (type === 1) {
        const n = ri(rng, 10000, 999999) / 10000;
        const display = n.toFixed(4);
        const ph = rc(rng, [
            `Round $${display}$ to 3 decimal places`,
            `Express $${display}$ correct to 3 decimal places`,
            `Write $${display}$ to 3 d.p.`,
        ]);
        return { clue: ph, answer: String(round(n, 3)) };
    }
    const sigFigs = rc(rng, [1, 2]);
    const n = sigFigs === 1 ? ri(rng, 100, 9999) : ri(rng, 1000, 99999);
    const factor = Math.pow(10, Math.floor(Math.log10(n)) - (sigFigs - 1));
    const ans = Math.round(n / factor) * factor;
    const sfLabel = `${sigFigs} significant figure${sigFigs > 1 ? 's' : ''}`;
    const ph = rc(rng, [
        `Round $${n}$ to ${sfLabel}`,
        `Write $${n}$ correct to ${sfLabel}`,
        `Express $${n}$ to ${sfLabel}`,
    ]);
    return { clue: ph, answer: String(ans) };
}

// ============================================================
// FRACTIONS — answers are always integers or simple decimals
// ============================================================
function genFractions(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy: { 'fraction-of': [0], 'add-subtract': [1], 'simplify-convert': [2] },
        Medium: { 'add-subtract': [0], 'multiply-divide': [1], 'simplify-convert': [2] },
        Hard: { 'multiply-divide': [0], 'add-subtract': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Hard' ? 1 : 2);
    if (type === -1) return null;

    const calcVerb = rc(rng, CALC_VERBS);
    if (diff === 'Easy') {
        if (type === 0) {
            const den = rc(rng, [2, 4, 5, 10]);
            const num = ri(rng, 1, den - 1);
            const whole = den * ri(rng, 2, 12);
            const ans = (num * whole) / den;
            const ph = rc(rng, [
                `Find $\\frac{${num}}{${den}}$ of $${whole}$`,
                `Calculate $\\frac{${num}}{${den}}$ of $${whole}$`,
                `Determine $\\frac{${num}}{${den}}$ of $${whole}$`,
                `What is $\\frac{${num}}{${den}}$ of $${whole}$?`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        if (type === 1) {
            const den = rc(rng, [4, 5, 6, 8, 10]);
            const n1 = ri(rng, 1, den - 2), n2 = ri(rng, 1, den - n1 - 1);
            const ans = fracStr(n1 + n2, den);
            return { clue: `${calcVerb} $\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}}$`, answer: ans };
        }
        const den = rc(rng, [4, 6, 8, 10, 12]);
        const factor = rc(rng, [2, 3]);
        if (factor >= den) return genFractions(rng, diff, allowedOps, _depth + 1);
        const num = factor * ri(rng, 1, Math.floor(den / factor));
        const ans = fracStr(num, den);
        const ph = rc(rng, [
            `Simplify $\\frac{${num}}{${den}}$`,
            `Write $\\frac{${num}}{${den}}$ in its simplest form`,
            `Express $\\frac{${num}}{${den}}$ in lowest terms`,
            `Reduce $\\frac{${num}}{${den}}$ to its simplest form`,
        ]);
        return { clue: ph, answer: ans };
    }

    if (diff === 'Medium') {
        if (type === 0) {
            const d1 = rc(rng, [2, 3, 4, 5]), d2 = rc(rng, [3, 4, 5, 6]);
            const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
            const l = lcm(d1, d2);
            const ans = fracStr(n1 * (l / d1) + n2 * (l / d2), l);
            return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}$`, answer: ans };
        }
        if (type === 1) {
            const d1 = ri(rng, 3, 7), n1 = ri(rng, 1, d1 - 1);
            const d2 = ri(rng, 3, 7), n2 = ri(rng, 1, d2 - 1);
            const ans = fracStr(n1 * n2, d1 * d2);
            return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$`, answer: ans };
        }
        const den = rc(rng, [2, 4, 5, 8, 10, 20, 25]);
        const num = ri(rng, 1, den - 1);
        const ans = round(num / den, 4);
        const ph = rc(rng, [
            `Convert $\\frac{${num}}{${den}}$ to a decimal`,
            `Express $\\frac{${num}}{${den}}$ as a decimal`,
            `Write $\\frac{${num}}{${den}}$ as a decimal number`,
        ]);
        return { clue: ph, answer: String(ans) };
    }

    // Hard
    if (type === 0) {
        const d1 = ri(rng, 3, 8), n1 = ri(rng, 1, d1 - 1);
        const d2 = ri(rng, 3, 8), n2 = ri(rng, 1, d2 - 1);
        const ans = fracStr(n1 * d2, d1 * n2);
        return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$`, answer: ans };
    }
    const d1 = rc(rng, [3, 4, 5, 6]), d2 = rc(rng, [3, 4, 5, 6]);
    if (d1 === d2) return genFractions(rng, diff, allowedOps, _depth + 1);
    const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
    const l = lcm(d1, d2);
    const numResult = n1 * (l / d1) - n2 * (l / d2);
    if (numResult <= 0) return genFractions(rng, diff, allowedOps, _depth + 1);
    const ans = fracStr(numResult, l);
    return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} - \\frac{${n2}}{${d2}}$`, answer: ans };
}

// ============================================================
// PERCENTAGES
// ============================================================
function genPercentages(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy: { 'find-pct': [0] },
        Medium: { 'find-pct': [0, 2], 'increase-decrease': [1] },
        Hard: { 'reverse-change': [0, 1, 2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);

    if (diff === 'Easy') {
        if (filtered && filtered.length === 0) return null;
        const pct = rc(rng, [10, 20, 25, 50, 75]);
        const denominators = { 10: 10, 20: 5, 25: 4, 50: 2, 75: 4 };
        const mult = denominators[pct] || 10;
        const whole = ri(rng, 1, 20) * mult;
        const ans = Math.round((pct / 100) * whole);
        const ph = rc(rng, [
            `Find $${pct}\\%$ of $${whole}$`,
            `Calculate $${pct}\\%$ of $${whole}$`,
            `Determine $${pct}\\%$ of $${whole}$`,
            `What is $${pct}\\%$ of $${whole}$?`,
        ]);
        return { clue: ph, answer: String(ans), answerDisplay: String(ans) };
    }
    if (diff === 'Medium') {
        const type = _pickType(rng, filtered, 2);
        if (type === -1) return null;
        if (type === 0) {
            const pct = rc(rng, [5, 15, 30, 40, 60, 70, 80]);
            const candidates = [20, 40, 60, 80, 100, 120, 200, 250, 400, 500];
            for (let i = 0; i < 20; i++) {
                const whole = rc(rng, candidates);
                const ans = (pct / 100) * whole;
                if (Number.isInteger(ans)) {
                    const ph = rc(rng, [
                        `Find $${pct}\\%$ of $${whole}$`,
                        `Calculate $${pct}\\%$ of $${whole}$`,
                        `Determine $${pct}\\%$ of $${whole}$`,
                    ]);
                    return { clue: ph, answer: String(ans) };
                }
            }
        }
        if (type === 1) {
            const orig = ri(rng, 2, 20) * 10;
            const pct = rc(rng, [10, 20, 25, 50]);
            const ans = Math.round(orig * (1 + pct / 100));
            if (!Number.isInteger(ans)) return genPercentages(rng, diff, allowedOps, _depth + 1);
            const ctx = rc(rng, ['a price', 'a value', 'an amount', 'a score']);
            const ph = rc(rng, [
                `Increase $${orig}$ by $${pct}\\%$`,
                `A ${ctx} of $${orig}$ is increased by $${pct}\\%$. Find the new ${ctx}.`,
                `Calculate the result of increasing $${orig}$ by $${pct}\\%$`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        const b = rc(rng, [10, 20, 25, 50, 100]);
        const a = ri(rng, 1, b - 1);
        const ans = (a / b) * 100;
        if (!Number.isInteger(ans)) return genPercentages(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Express $${a}$ out of $${b}$ as a percentage`,
            `Write $${a}$ out of $${b}$ as a percentage`,
            `$${a}$ out of $${b}$ — calculate the percentage`,
            `What percentage is $${a}$ of $${b}$?`,
        ]);
        return { clue: ph, answer: String(ans), answerDisplay: `${ans}%` };
    }
    // Hard
    const type = _pickType(rng, filtered, 2);
    if (type === -1) return null;
    if (type === 0) {
        const orig = ri(rng, 5, 20) * 20;
        const pct = rc(rng, [10, 20, 25, 50]);
        const final = round(orig * (1 + pct / 100), 2);
        const ph = rc(rng, [
            `After a $${pct}\\%$ increase the value is $${final}$. Find the original.`,
            `A quantity increases by $${pct}\\%$ to become $${final}$. Determine the original value.`,
            `The result after a $${pct}\\%$ increase is $${final}$. Calculate the original amount.`,
        ]);
        return { clue: ph, answer: String(orig) };
    }
    if (type === 1) {
        const orig = ri(rng, 4, 20) * 25;
        const pct = rc(rng, [10, 20, 25, 50]);
        const newVal = round(orig * (1 + pct / 100), 2);
        const ph = rc(rng, [
            `A price rises from $\\$${orig}$ to $\\$${newVal}$. What is the percentage increase?`,
            `Calculate the percentage increase from $\\$${orig}$ to $\\$${newVal}$.`,
            `Determine the percentage change when a value goes from $${orig}$ to $${newVal}$.`,
        ]);
        return { clue: ph, answer: String(pct), answerDisplay: `${pct}%` };
    }
    const pct1 = rc(rng, [10, 20, 25, 50]);
    const whole = ri(rng, 4, 20) * 100;
    const partial = (pct1 / 100) * whole;
    const pct2 = rc(rng, [10, 20, 25, 50]);
    const ans2 = (pct2 / 100) * partial;
    if (!Number.isInteger(ans2)) return genPercentages(rng, diff, allowedOps, _depth + 1);
    const ph = rc(rng, [
        `Find $${pct2}\\%$ of $${pct1}\\%$ of $${whole}$`,
        `Calculate $${pct2}\\%$ of $${pct1}\\%$ of $${whole}$`,
        `Determine $${pct2}\\%$ of $${pct1}\\%$ of $${whole}$`,
    ]);
    return { clue: ph, answer: String(ans2) };
}

// ============================================================
// ALGEBRA
// ============================================================
function genAlgebra(rng, diff, allowedOps) {
    const maps = {
        Easy: { 'solve': [0, 1] },
        Medium: { 'solve': [0, 1], 'substitution': [2] },
        Hard: { 'solve': [0, 2], 'substitution': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : 2);
    if (type === -1) return null;

    const solveVerb = rc(rng, SOLVE_VERBS);
    if (diff === 'Easy') {
        if (type === 0) {
            const ans = ri(rng, 1, 20), a = ri(rng, 1, 20);
            return { clue: `${solveVerb} $x + ${a} = ${ans + a}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        const a = ri(rng, 2, 12), ans = ri(rng, 2, 12);
        return { clue: `${solveVerb} $${a}x = ${a * ans}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 2, 6), ans = ri(rng, 1, 10), b = ri(rng, 1, 20);
            return { clue: `${solveVerb} $${a}x + ${b} = ${a * ans + b}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        if (type === 1) {
            const a = ri(rng, 2, 6), ans = ri(rng, 2, 10), b = ri(rng, 1, 10);
            return { clue: `${solveVerb} $${a}x - ${b} = ${a * ans - b}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        const a = ri(rng, 2, 6), b = ri(rng, 1, 12), n = ri(rng, 1, 8);
        const subVerb = rc(rng, [
            `If $y = ${a}x + ${b}$, find $y$ when $x = ${n}$`,
            `Evaluate $y = ${a}x + ${b}$ when $x = ${n}$`,
            `Calculate $y$ given $y = ${a}x + ${b}$ and $x = ${n}$`,
            `Substitute $x = ${n}$ into $y = ${a}x + ${b}$`,
        ]);
        return { clue: subVerb, answer: String(a * n + b) };
    }
    // Hard
    if (type === 0) {
        const ans = ri(rng, 1, 10);
        const a = ri(rng, 3, 8), c = ri(rng, 1, a - 1), b = ri(rng, 1, 20);
        const d = (a - c) * ans + b;
        return { clue: `${solveVerb} $${a}x + ${b} = ${c}x + ${d}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
    }
    if (type === 1) {
        const a = ri(rng, 1, 4), b = ri(rng, 1, 15), n = ri(rng, 2, 6);
        const coeff = a === 1 ? '' : String(a);
        const subVerb = rc(rng, [
            `If $y = ${coeff}x^2 + ${b}$, find $y$ when $x = ${n}$`,
            `Evaluate $y = ${coeff}x^2 + ${b}$ when $x = ${n}$`,
            `Calculate $y$ given $y = ${coeff}x^2 + ${b}$ and $x = ${n}$`,
            `Substitute $x = ${n}$ into $y = ${coeff}x^2 + ${b}$`,
        ]);
        return { clue: subVerb, answer: String(a * n * n + b) };
    }
    const a = ri(rng, 2, 5), bMult = ri(rng, 1, 8);
    const ans2 = -bMult;
    return { clue: `${solveVerb} $${a}x + ${a * bMult} = 0$`, answer: String(ans2), answerDisplay: `x = ${ans2}` };
}

// ============================================================
// STATISTICS
// ============================================================
function genStatistics(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 30) return null;
    const maps = {
        Easy: { 'mean-median': [0, 1] },
        Medium: { 'mode-range': [0, 1], 'mean-median': [2] },
        Hard: { 'iqr': [0], 'mean-median': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : diff === 'Medium' ? 2 : 1);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const n = ri(rng, 3, 5);
            const data = Array.from({ length: n }, () => ri(rng, 1, 20));
            const sum = data.reduce((a, b) => a + b, 0);
            if (sum % n !== 0) return genStatistics(rng, diff, allowedOps, _depth + 1);
            const ph = rc(rng, [
                `Find the mean of $${data.join(', ')}$`,
                `Calculate the mean of $${data.join(', ')}$`,
                `Determine the mean of: $${data.join(', ')}$`,
                `What is the mean of $${data.join(', ')}$?`,
            ]);
            return { clue: ph, answer: String(sum / n) };
        }
        const n = (ri(rng, 2, 4) * 2) - 1;
        const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
        const ph = rc(rng, [
            `Find the median of $${data.join(', ')}$`,
            `State the median of $${data.join(', ')}$`,
            `Determine the median of: $${data.join(', ')}$`,
            `What is the median of $${data.join(', ')}$?`,
        ]);
        return { clue: ph, answer: String(data[Math.floor(n / 2)]) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const n = ri(rng, 4, 7);
            const data = Array.from({ length: n }, () => ri(rng, 1, 40));
            const ph = rc(rng, [
                `Find the range of $${data.join(', ')}$`,
                `Calculate the range of $${data.join(', ')}$`,
                `Determine the range of: $${data.join(', ')}$`,
                `What is the range of $${data.join(', ')}$?`,
            ]);
            return { clue: ph, answer: String(Math.max(...data) - Math.min(...data)) };
        }
        if (type === 1) {
            const mode = ri(rng, 1, 15);
            const others = Array.from({ length: 4 }, () => {
                let v; do { v = ri(rng, 1, 20); } while (v === mode); return v;
            });
            const data = [...others, mode, mode].sort((a, b) => a - b);
            const ph = rc(rng, [
                `Identify the mode of $${data.join(', ')}$`,
                `State the mode of $${data.join(', ')}$`,
                `Find the mode of $${data.join(', ')}$`,
                `What is the mode of $${data.join(', ')}$?`,
            ]);
            return { clue: ph, answer: String(mode) };
        }
        const n = ri(rng, 4, 6);
        const data = Array.from({ length: n }, () => ri(rng, 5, 30));
        const sum = data.reduce((a, b) => a + b, 0);
        if (sum % n !== 0) return genStatistics(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Calculate the mean of $${data.join(', ')}$`,
            `Find the mean of $${data.join(', ')}$`,
            `Determine the mean of: $${data.join(', ')}$`,
        ]);
        return { clue: ph, answer: String(sum / n) };
    }
    // Hard
    if (type === 0) {
        const data = Array.from({ length: 8 }, () => ri(rng, 1, 20)).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        const iqr = q3 - q1;
        if (!Number.isInteger(iqr)) return genStatistics(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Find the interquartile range of $${data.join(', ')}$`,
            `Calculate the IQR of $${data.join(', ')}$`,
            `Determine the interquartile range of: $${data.join(', ')}$`,
        ]);
        return { clue: ph, answer: String(iqr) };
    }
    const n = rc(rng, [4, 6]);
    const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
    const med = (data[n / 2 - 1] + data[n / 2]) / 2;
    if (!Number.isInteger(med)) return genStatistics(rng, diff, allowedOps, _depth + 1);
    const ph = rc(rng, [
        `Find the median of $${data.join(', ')}$`,
        `Calculate the median of $${data.join(', ')}$`,
        `Determine the median of: $${data.join(', ')}$`,
    ]);
    return { clue: ph, answer: String(med) };
}

// ============================================================
// FINANCIAL MATHS
// ============================================================
function genFinancial(rng, diff, allowedOps, opts = {}, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy: { 'simple-interest': [0], 'gst': [1] },
        Medium: { 'markup-profit': [0], 'simple-interest': [1] },
        Hard: { 'compound-interest': [0], 'markup-profit': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, 1);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const P = ri(rng, 2, 20) * 100;
            const r = rc(rng, [5, 10]);
            const t = ri(rng, 1, 3);
            const I = P * r / 100 * t;
            const yrs = `$${t}$ year${t > 1 ? 's' : ''}`;
            const fOn = opts.showFormulas?.['simple-interest']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $I = Prn$.' : '';
            const ph = rc(rng, [
                `Calculate the simple interest on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
                `Find the simple interest earned on $\\$${P}$ invested at $${r}\\%$ per year for ${yrs}.${pf}`,
                `Determine the interest on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
            ]);
            return { clue: ph, answer: String(I), answerDisplay: `$${I}` };
        }
        const price = ri(rng, 5, 50) * 10;
        const ph = rc(rng, [
            `Find the price after $10\\%$ GST is added to $\\$${price}$`,
            `Calculate the GST-inclusive price for an item costing $\\$${price}$`,
            `A product costs $\\$${price}$ before GST. Find the total price including $10\\%$ GST.`,
        ]);
        const gstTotal = round(price * 1.1, 2);
        return { clue: ph, answer: String(gstTotal), answerDisplay: `$${gstTotal}` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const cost = ri(rng, 5, 20) * 10;
            const pctProfit = rc(rng, [10, 20, 25, 50]);
            const sell = round(cost * (1 + pctProfit / 100), 2);
            if (!Number.isInteger(sell)) return genFinancial(rng, diff, allowedOps, opts, _depth + 1);
            const ph = rc(rng, [
                `Find the selling price: cost $\\$${cost}$, mark-up $${pctProfit}\\%$`,
                `An item costs $\\$${cost}$. Calculate the selling price after a $${pctProfit}\\%$ mark-up.`,
                `Determine the selling price of a $\\$${cost}$ item with a $${pctProfit}\\%$ profit margin.`,
            ]);
            return { clue: ph, answer: String(sell), answerDisplay: `$${sell}` };
        }
        const P = ri(rng, 2, 10) * 1000, r = rc(rng, [5, 10]), t = ri(rng, 1, 3);
        const I = P * r / 100 * t;
        const fOn = opts.showFormulas?.['simple-interest']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $I = Prn$.' : '';
        const ph = rc(rng, [
            `Calculate the simple interest on $\\$${P}$ at $${r}\\%$ p.a. for $${t}$ years.${pf}`,
            `Find the simple interest earned on a $\\$${P}$ investment at $${r}\\%$ p.a. over $${t}$ years.${pf}`,
            `Determine the interest on $\\$${P}$ at $${r}\\%$ per annum for $${t}$ years.${pf}`,
        ]);
        return { clue: ph, answer: String(I), answerDisplay: `$${I}` };
    }
    // Hard
    if (type === 0) {
        const P = ri(rng, 2, 8) * 1000, r = rc(rng, [5, 10]), t = ri(rng, 2, 4);
        const A = round(P * Math.pow(1 + r / 100, t), 2);
        if (!Number.isInteger(A)) {
            const P2 = ri(rng, 1, 5) * 2000, r2 = 10, t2 = ri(rng, 2, 3);
            const A2 = round(P2 * Math.pow(1 + r2 / 100, t2), 2);
            const fOn = opts.showFormulas?.['compound-interest']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = P(1+r)^n$.' : '';
            const ph = rc(rng, [
                `Calculate the total amount after compound interest: $\\$${P2}$ at $${r2}\\%$ p.a. for $${t2}$ years.${pf}`,
                `$\\$${P2}$ is invested at $${r2}\\%$ p.a. compound interest for $${t2}$ years. Find the total amount.${pf}`,
            ]);
            return { clue: ph, answer: String(A2), answerDisplay: `$${A2}` };
        }
        const fOn = opts.showFormulas?.['compound-interest']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $A = P(1+r)^n$.' : '';
        const ph = rc(rng, [
            `Calculate the total amount after compound interest: $\\$${P}$ at $${r}\\%$ p.a. for $${t}$ years.${pf}`,
            `$\\$${P}$ is invested at $${r}\\%$ p.a. compound interest for $${t}$ years. Determine the total amount.${pf}`,
            `Find the final value of $\\$${P}$ compounded at $${r}\\%$ p.a. for $${t}$ years.${pf}`,
        ]);
        return { clue: ph, answer: String(A), answerDisplay: `$${A}` };
    }
    const cost = ri(rng, 2, 15) * 100;
    const pct = rc(rng, [5, 10, 20, 25, 50]);
    const sell = round(cost + cost * pct / 100, 2);
    const ph = rc(rng, [
        `An item costs $\\$${cost}$ and sells for $\\$${sell}$. Calculate the percentage profit.`,
        `Find the percentage profit: cost $\\$${cost}$, selling price $\\$${sell}$.`,
        `Determine the profit percentage given a cost of $\\$${cost}$ and a selling price of $\\$${sell}$.`,
    ]);
    return { clue: ph, answer: String(pct), answerDisplay: `${pct}%` };
}

// ============================================================
// GEOMETRY
// ============================================================

// Pick measurement unit appropriate to the magnitude.
// val ≤ 10 → mm (tiny), ≤ 100 → cm (classroom), ≤ 1000 → m (room/field), else km
function _geoUnit(maxVal) {
    if (maxVal <= 10) return 'mm';
    if (maxVal <= 100) return 'cm';
    if (maxVal <= 999) return 'm';
    return 'km';
}

function genGeometry(rng, diff, allowedOps, opts = {}, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy: { 'area-perimeter': [0, 1] },
        Medium: { 'area-perimeter': [0], 'pythagoras': [1], 'angles': [2] },
        Hard: { 'circles': [0, 2], 'pythagoras': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : 2);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const l = ri(rng, 2, 15), w = ri(rng, 2, 12);
            const u = _geoUnit(Math.max(l, w));
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = l \\times w$.' : '';
            const ph = rc(rng, [
                `Find the area of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
                `Calculate the area of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
                `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its area.${pf}`,
                `What is the area of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
            ]);
            return { clue: ph, answer: String(l * w), answerDisplay: `${l * w} ${u}²`, diagram: { type: 'rectangle', l, w, missing: 'area' } };
        }
        const l = ri(rng, 3, 15), w = ri(rng, 2, l);
        const u = _geoUnit(Math.max(l, w));
        const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $P = 2l + 2w$.' : '';
        const ph = rc(rng, [
            `Find the perimeter of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
            `Calculate the perimeter of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
            `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its perimeter.${pf}`,
            `What is the perimeter of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
        ]);
        return { clue: ph, answer: String(2 * (l + w)), answerDisplay: `${2 * (l + w)} ${u}`, diagram: { type: 'rectangle', l, w, missing: 'perimeter' } };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const b = ri(rng, 2, 12) * 2;
            const h = ri(rng, 3, 15);
            const u = _geoUnit(Math.max(b, h));
            const ans = (b * h) / 2;
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = \\frac{1}{2}bh$.' : '';
            const ph = rc(rng, [
                `Find the area of a triangle with base $${b}$ ${u} and perpendicular height $${h}$ ${u}.${pf}`,
                `Calculate the area of a triangle: base $${b}$ ${u}, height $${h}$ ${u}.${pf}`,
                `A triangle has base $${b}$ ${u} and height $${h}$ ${u}. Determine its area.${pf}`,
            ]);
            return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, diagram: { type: 'triangle-area', base: b, height: h } };
        }
        if (type === 1) {
            const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]];
            const [a, b, c] = rc(rng, triples);
            const scale = ri(rng, 1, 3);
            const u = _geoUnit(c * scale);
            const fOn = opts.showFormulas?.['pythagoras']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $a^2 + b^2 = c^2$.' : '';
            const ph = rc(rng, [
                `A right-angled triangle has legs $${a * scale}$ ${u} and $${b * scale}$ ${u}. Find the hypotenuse.${pf}`,
                `Calculate the hypotenuse of a right triangle with legs $${a * scale}$ ${u} and $${b * scale}$ ${u}.${pf}`,
                `Determine the hypotenuse given legs of $${a * scale}$ ${u} and $${b * scale}$ ${u}.${pf}`,
            ]);
            return { clue: ph, answer: String(c * scale), answerDisplay: `${c * scale} ${u}`, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'c' } };
        }
        const angles = [30, 40, 45, 50, 60, 70, 80, 90];
        const a1 = rc(rng, angles);
        const remaining = angles.filter(a => a < 180 - a1 && a !== a1);
        if (remaining.length === 0) return genGeometry(rng, diff, allowedOps, opts, _depth + 1);
        const a2 = rc(rng, remaining);
        const a3 = 180 - a1 - a2;
        const ph = rc(rng, [
            `A triangle has angles $${a1}$° and $${a2}$°. Find the third angle.`,
            `Determine the missing angle in a triangle with angles $${a1}$° and $${a2}$°.`,
            `Calculate the third angle of a triangle given angles of $${a1}$° and $${a2}$°.`,
            `Two angles of a triangle are $${a1}$° and $${a2}$°. What is the third angle?`,
        ]);
        return { clue: ph, answer: String(a3), answerDisplay: `${a3}°`, diagram: { type: 'triangle-angles', a1, a2, a3, missing: 'a3' } };
    }
    // Hard
    if (type === 0) {
        const r = ri(rng, 2, 10);
        const u = _geoUnit(r);
        const ans = round(3.14 * r * r, 2);
        const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $A = \\pi r^2$.' : '';
        const ph = rc(rng, [
            `Find the area of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Calculate the area of a circle of radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Determine the area of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
        ]);
        return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, diagram: { type: 'circle', r, missing: 'area' } };
    }
    if (type === 1) {
        const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17]];
        const [a, b, c] = rc(rng, triples);
        const scale = ri(rng, 1, 3);
        const u = _geoUnit(c * scale);
        const fOn = opts.showFormulas?.['pythagoras']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $a^2 + b^2 = c^2$.' : '';
        const ph = rc(rng, [
            `A right triangle has hypotenuse $${c * scale}$ ${u} and one leg $${a * scale}$ ${u}. Find the other leg.${pf}`,
            `Calculate the missing leg: hypotenuse $${c * scale}$ ${u}, known leg $${a * scale}$ ${u}.${pf}`,
            `Determine the unknown side of a right triangle with hypotenuse $${c * scale}$ ${u} and leg $${a * scale}$ ${u}.${pf}`,
        ]);
        return { clue: ph, answer: String(b * scale), answerDisplay: `${b * scale} ${u}`, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'b' } };
    }
    const r = ri(rng, 2, 15);
    const u = _geoUnit(r);
    const ans = round(2 * 3.14 * r, 2);
    const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
    const pf = fOn ? ' Use $C = 2\\pi r$.' : '';
    const ph = rc(rng, [
        `Find the circumference of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
        `Calculate the circumference of a circle of radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
        `Determine the circumference of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
    ]);
    return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}`, diagram: { type: 'circle', r, missing: 'circumference' } };
}

// ============================================================
// DISPATCH table
// ============================================================
const GENERATORS = {
    'Integers': genIntegers,
    'Decimals': genDecimals,
    'Rounding': genRounding,
    'Fractions': genFractions,
    'Percentages': genPercentages,
    'Algebra': genAlgebra,
    'Geometry': genGeometry,
    'Statistics': genStatistics,
    'Financial Maths': genFinancial,
};

// Map generator sub-topic → clue bank topic field
const TOPIC_MAP = {
    'Integers': 'Number',
    'Decimals': 'Number',
    'Rounding': 'Number',
    'Fractions': 'Number',
    'Percentages': 'Number',
    'Algebra': 'Algebra',
    'Geometry': 'Geometry',
    'Statistics': 'Statistics',
    'Financial Maths': 'Financial Maths',
};

const ALL_SUBTOPICS = Object.keys(GENERATORS);

/**
 * Generate maths questions.
 * @param {object} opts
 * @param {string}  opts.subTopic    - 'All' | any key of GENERATORS
 * @param {string}  opts.difficulty  - 'All' | 'Easy' | 'Medium' | 'Hard'
 * @param {number}  opts.count       - number of questions to generate
 * @param {number}  [opts.seed]      - optional seed (uses Date.now() if omitted)
 * @param {object}  [opts.subOpsFilter] - { topic: [allowedOpKeys] } or null for all
 * @returns {Array} clue bank items
 */
export function generateMathsQuestions({ subTopic = 'All', subTopics = null, subOpsFilter = null, difficulty = 'All', count = 10, seed, showFormulas } = {}) {
    const rng = mulberry32(seed != null ? seed : Date.now());

    // subTopics array takes priority over subTopic string
    let subtopics;
    if (subTopics && subTopics.length > 0) {
        subtopics = subTopics.filter(t => GENERATORS[t]);
        if (subtopics.length === 0) subtopics = ALL_SUBTOPICS;
    } else {
        subtopics = subTopic === 'All' ? ALL_SUBTOPICS : [subTopic];
    }
    const diffs = difficulty === 'All' ? ['Easy', 'Medium', 'Hard'] : [difficulty];

    // Build a balanced topic plan: cycle through shuffled topics so every
    // topic appears roughly equally — avoids 4× rounding with 0× algebra.
    function shuffled(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    const topicPlan = [];
    while (topicPlan.length < count) topicPlan.push(...shuffled(subtopics));

    const results = [];
    let attempts = 0;
    const maxAttempts = count * 20;

    while (results.length < count && attempts < maxAttempts) {
        attempts++;
        // Use the pre-planned topic for this slot; fall back to random if exhausted
        const st = topicPlan[results.length] ?? rc(rng, subtopics);
        const diff = rc(rng, diffs);
        const gen = GENERATORS[st];
        if (!gen) continue;

        // Pass the allowed sub-ops for this topic (null = all allowed)
        const allowedOps = subOpsFilter?.[st] || null;

        let q;
        try { q = gen(rng, diff, allowedOps, { showFormulas }); } catch (e) { console.error(e); continue; }
        if (!q) continue;

        const ans = String(q.answer);
        // Skip empty, over-length, or numerically invalid answers
        if (!ans || ans.length > 10 || ans === 'NaN' || ans === 'Infinity' || ans === '-Infinity') continue;

        // Prevent duplicate questions
        if (results.some(r => r.clue === q.clue)) continue;

        results.push({
            id: 'gen_' + results.length + '_' + (seed || Date.now()),
            topic: TOPIC_MAP[st] || 'Number',
            difficulty: diff,
            clue: q.clue || '',
            answer: ans,
            answerDisplay: q.answerDisplay || ans,
            notes: st,    // store sub-topic in notes for reference
            diagram: q.diagram || null,
        });
    }

    return results;
}

export { ALL_SUBTOPICS };
