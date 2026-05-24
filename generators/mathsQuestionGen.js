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

const CALC_VERBS   = ['Calculate:', 'Evaluate:', 'Find the value of:', 'Work out:', 'Determine:'];
const MULT_VERBS   = ['Calculate:', 'Evaluate:', 'Find the product of:', 'Work out:', 'Find the result of:'];
const DIV_VERBS    = ['Calculate:', 'Evaluate:', 'Find the quotient of:', 'Work out:', 'Divide:'];
const BODMAS_VERBS = ['Evaluate:', 'Calculate:', 'Apply order of operations to find:', 'Work out:', 'Simplify:'];
const SOLVE_VERBS  = ['Solve:', 'Find $x$:', 'Determine $x$:', 'Calculate $x$:', 'Find the value of $x$:', 'Solve for $x$:'];

const ALGEBRA_VARS = ['x', 'n', 'm', 'k', 'p', 't'];
function _solveVerbsFor(v) {
    return [
        `Solve:`,
        `Find $${v}$:`,
        `Determine $${v}$:`,
        `Calculate $${v}$:`,
        `Find the value of $${v}$:`,
        `Solve for $${v}$:`,
        `What is $${v}$?`,
    ];
}
// Pairs [dependent, independent] for substitution questions
const SUBST_PAIRS = [['y', 'x'], ['A', 't'], ['P', 'n'], ['C', 'm'], ['V', 'r'], ['h', 't'], ['d', 'n']];
const DATA_CONTEXTS = ['scores', 'values', 'ages', 'heights (cm)', 'temperatures (°C)', 'distances (m)', 'results', 'times (s)', 'weights (kg)', 'prices ($)', 'marks', 'lengths (cm)', 'speeds (km/h)', 'rainfall (mm)', 'test results'];

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }

// Simplify fraction; return {n, d}
function simplify(n, d) {
    const g = gcd(Math.abs(n), Math.abs(d));
    return { n: n / g, d: d / g };
}
// Render an answer fraction in the same math-mode form as the question
// (\frac{n}{d}) so HTML preview and answer key both show stacked fractions
// rather than mixing "2/5" with the question's $\frac{2}{5}$.
function fracStr(n, d) {
    const s = simplify(n, d);
    return s.d === 1 ? String(s.n) : `$\\frac{${s.n}}{${s.d}}$`;
}

// ============================================================
// SUB_OPS metadata — defines selectable sub-operations per topic.
// Each entry: { key, label, stages?, pathway? }
//   stages  - which stages include this op (default: both)
//   pathway - 'path' means Stage 5.3 Path only; omit for core
// ============================================================
export const SUB_OPS = {
    'Integers': [
        { key: 'add',      label: 'Add (+)' },
        { key: 'subtract', label: 'Subtract (−)' },
        { key: 'multiply', label: 'Multiply (×)' },
        { key: 'divide',   label: 'Divide (÷)' },
        { key: 'bodmas',   label: 'BODMAS' },
    ],
    'Decimals': [
        { key: 'add-subtract',   label: 'Add / Subtract' },
        { key: 'multiply-divide', label: 'Multiply / Divide' },
    ],
    'Rounding': [
        { key: 'nearest',        label: 'Nearest 10 / 100 / 1000' },
        { key: 'decimal-places', label: 'Decimal places' },
        { key: 'sig-figs',       label: 'Significant figures' },
    ],
    'Fractions': [
        { key: 'fraction-of',     label: 'Fraction of amount' },
        { key: 'add-subtract',    label: 'Add / Subtract' },
        { key: 'multiply-divide', label: 'Multiply / Divide' },
        { key: 'simplify-convert', label: 'Simplify / Convert' },
    ],
    'Percentages': [
        { key: 'find-pct',        label: 'Find percentage' },
        { key: 'increase-decrease', label: 'Increase / Decrease' },
        { key: 'reverse-change',  label: 'Reverse / % change' },
    ],
    'Algebra': [
        { key: 'solve',        label: 'Solve equations' },
        { key: 'substitution', label: 'Substitution' },
        // Stage 5 core
        { key: 'expand',          label: 'Expand expressions',     stages: ['Stage 5'] },
        { key: 'factorise',       label: 'Factorise expressions',  stages: ['Stage 5'] },
        { key: 'quadratic-solve', label: 'Solve quadratics',       stages: ['Stage 5'] },
        { key: 'indices-laws',    label: 'Index laws',             stages: ['Stage 5'] },
        // Stage 5.3 Path
        { key: 'simultaneous',   label: 'Simultaneous equations', stages: ['Stage 5'], pathway: 'path' },
        { key: 'surds-simplify', label: 'Simplify surds',         stages: ['Stage 5'], pathway: 'path' },
        { key: 'surds-operate',  label: 'Add / Multiply surds',   stages: ['Stage 5'], pathway: 'path' },
    ],
    'Geometry': [
        { key: 'area-perimeter', label: 'Area / Perimeter' },
        { key: 'pythagoras',     label: 'Pythagoras' },
        { key: 'angles',         label: 'Angles' },
        { key: 'circles',        label: 'Circles' },
        // Stage 5
        { key: 'surface-area',      label: 'Surface area',          stages: ['Stage 5'] },
        { key: 'composite-volume',  label: 'Composite volume',       stages: ['Stage 5'] },
        { key: 'similar-triangles', label: 'Similar triangles',      stages: ['Stage 5'] },
    ],
    'Statistics': [
        { key: 'mean-median', label: 'Mean / Median' },
        { key: 'mode-range',  label: 'Mode / Range' },
        { key: 'iqr',         label: 'Interquartile range' },
        // Stage 5
        { key: 'five-number-summary', label: 'Five-number summary', stages: ['Stage 5'] },
        { key: 'bivariate',           label: 'Bivariate data',      stages: ['Stage 5'] },
    ],
    'Financial Maths': [
        { key: 'simple-interest',   label: 'Simple interest' },
        { key: 'compound-interest', label: 'Compound interest' },
        { key: 'markup-profit',     label: 'Markup / Profit' },
        { key: 'gst',               label: 'GST' },
        // Stage 5
        { key: 'depreciation',    label: 'Depreciation',       stages: ['Stage 5'] },
        { key: 'compound-period', label: 'Compound (periods)', stages: ['Stage 5'] },
    ],
    // Stage 5 only topics
    'Trigonometry': [
        { key: 'find-side',    label: 'Find a side (SOHCAHTOA)', stages: ['Stage 5'] },
        { key: 'find-angle',   label: 'Find an angle',           stages: ['Stage 5'] },
        { key: 'applications', label: 'Real-world applications', stages: ['Stage 5'] },
        // Path
        { key: 'obtuse-angles', label: 'Obtuse angles',  stages: ['Stage 5'], pathway: 'path' },
        { key: 'bearings',      label: 'Bearings (true)', stages: ['Stage 5'], pathway: 'path' },
    ],
    'Non-linear Relationships': [
        { key: 'parabola-features', label: 'Parabola: features',    stages: ['Stage 5'] },
        // Path
        { key: 'parabola-sketch',   label: 'Parabola: sketch',      stages: ['Stage 5'], pathway: 'path' },
        { key: 'identify-graph',    label: 'Identify graph type',   stages: ['Stage 5'], pathway: 'path' },
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
    let pool = diff === 'Easy' ? ['+', '-', '×'] : diff === 'Hard' ? ['+', '-', '×', '÷', 'bodmas'] : ['+', '-', '×', '÷', 'bodmas'];
    if (allowedOps) pool = pool.filter(op => allowedOps.includes(OP_MAP[op]));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === '+') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, max);
        const clue = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
            `Find the *sum* of $${a}$ and $${b}$`,
            `What is the total of $${a}$ and $${b}$?`,
            `Add $${a}$ to $${b}$`,
            `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
        ]);
        return { clue, answer: String(a + b) };
    }
    if (op === '-') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const min = diff === 'Easy' ? 8 : 1;
        const a = ri(rng, min, max), b = ri(rng, 1, Math.max(1, a - 2));
        const clue = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
            `Find the *difference* between $${a}$ and $${b}$`,
            `Subtract $${b}$ from $${a}$`,
            `What is $${a}$ minus $${b}$?`,
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
        ]);
        return { clue, answer: String(a - b) };
    }
    if (op === '×') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 25] : [12, 50];
        // ~20% chance: square a single number instead of a × b (Medium/Hard only)
        if (diff !== 'Easy' && rng() < 0.20) {
            const base = diff === 'Medium' ? ri(rng, 4, 15) : ri(rng, 12, 30);
            const verb = rc(rng, CALC_VERBS);
            return { clue: `${verb}\n$${base}^2$`, answer: String(base * base) };
        }
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        const clue = rc(rng, [
            `${rc(rng, MULT_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `What is $${a}$ multiplied by $${b}$?`,
            `Find the *product* of $${a}$ and $${b}$`,
        ]);
        return { clue, answer: String(a * b) };
    }
    if (op === '÷') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 20] : [6, 40];
        const b = ri(rng, lo, hi), ans = ri(rng, lo, hi);
        const clue = rc(rng, [
            `${rc(rng, DIV_VERBS)} $${b * ans} \\div ${b}$`,
            `Divide $${b * ans}$ by $${b}$`,
            `What is $${b * ans}$ divided by $${b}$?`,
            `Find the *quotient* of $${b * ans}$ and $${b}$`,
        ]);
        return { clue, answer: String(ans) };
    }
    if (op === 'bodmas') {
        // Medium uses simpler 2-op forms (0–2); Hard uses all 5 forms (0–4)
        const formMax = diff === 'Medium' ? 2 : 4;
        const form = ri(rng, 0, formMax);
        const verb = rc(rng, BODMAS_VERBS);
        // Medium: smaller operands so answers stay manageable
        const [aHi, bHi, cHi] = diff === 'Medium' ? [15, 9, 8] : [25, 15, 15];
        if (form === 0) {
            const a = ri(rng, 2, aHi), b = ri(rng, 2, bHi), c = ri(rng, 2, cHi);
            return { clue: `${verb}\n$${a} + ${b} \\times ${c}$`, answer: String(a + b * c) };
        }
        if (form === 1) {
            const a = ri(rng, 2, bHi), b = ri(rng, 2, bHi), c = ri(rng, 2, cHi);
            return { clue: `${verb}\n$(${a} + ${b}) \\times ${c}$`, answer: String((a + b) * c) };
        }
        if (form === 2) {
            const a = ri(rng, 2, 9), b = ri(rng, 2, 8), c = ri(rng, 2, 9), d = ri(rng, 2, 6);
            return { clue: `${verb}\n$${a} \\times ${b} + ${c} \\times ${d}$`, answer: String(a * b + c * d) };
        }
        if (form === 3) {
            const b = ri(rng, 2, 12), c = ri(rng, 3, 10);
            const a = ri(rng, b + 1, b + 15);
            return { clue: `${verb}\n$(${a} - ${b}) \\times ${c}$`, answer: String((a - b) * c) };
        }
        const a = ri(rng, 3, 20), b = ri(rng, 2, 10), c = ri(rng, 2, 8);
        return { clue: `${verb}\n$${a} - ${b} \\times ${c}$`, answer: String(a - b * c) };
    }
}

// ============================================================
// DECIMALS
// ============================================================
function genDecimals(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    // type → sub-op mapping per difficulty
    const maps = {
        Easy:   { 'add-subtract': [0], 'multiply-divide': [1, 2] },
        Medium: { 'add-subtract': [0, 1, 3], 'multiply-divide': [2] },
        Hard:   { 'multiply-divide': [0, 1, 3], 'add-subtract': [2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : 3);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 1, 9) / 10;
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(round(a + b, 2)) };
        }
        if (type === 1) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 2, 9);
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
                `Multiply $${a}$ by $${b}$`,
                `Find the product of $${a}$ and $${b}$`,
                `What is $${a} \\times ${b}$?`,
            ]);
            return { clue: ph, answer: String(round(a * b, 2)) };
        }
        // type 2: simple division (whole ÷ integer → 1-dp result)
        const b2 = ri(rng, 2, 9);
        const ans2 = ri(rng, 1, 9) / 10;
        const dividend = round(b2 * ans2, 2);
        const ph2 = rc(rng, [
            `${rc(rng, DIV_VERBS)} $${dividend} \\div ${b2}$`,
            `Divide $${dividend}$ by $${b2}$`,
            `What is $${dividend}$ divided by $${b2}$?`,
            `Find the *quotient* of $${dividend}$ and $${b2}$`,
        ]);
        return { clue: ph2, answer: String(ans2) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(round(a + b, 2)) };
        }
        if (type === 1) {
            const a = ri(rng, 20, 99) / 10, b = ri(rng, 1, Math.floor(a * 10) - 1) / 10;
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} - ${round(b, 1)}$`,
                `Subtract $${round(b, 1)}$ from $${a}$`,
                `Find the difference of $${a}$ and $${round(b, 1)}$`,
                `What is $${a} - ${round(b, 1)}$?`,
            ]);
            return { clue: ph, answer: String(round(a - b, 2)) };
        }
        if (type === 2) {
            const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
                `Multiply $${a}$ by $${b}$`,
                `Find the product of $${a}$ and $${b}$`,
                `What is $${a} \\times ${b}$?`,
            ]);
            return { clue: ph, answer: String(round(a * b, 2)) };
        }
        // type 3: money-context addition
        const dollars1 = ri(rng, 1, 49);
        const cents1   = rc(rng, [25, 50, 75, 0]);
        const dollars2 = ri(rng, 1, 49);
        const cents2   = rc(rng, [25, 50, 75, 0]);
        const p1 = dollars1 + cents1 / 100;
        const p2 = dollars2 + cents2 / 100;
        const total = round(p1 + p2, 2);
        const ph3 = rc(rng, [
            `A shopper buys items costing $\\$${p1.toFixed(2)}$ and $\\$${p2.toFixed(2)}$. Find the *total*.`,
            `Add $\\$${p1.toFixed(2)}$ and $\\$${p2.toFixed(2)}$`,
            `What is the total cost of items priced $\\$${p1.toFixed(2)}$ and $\\$${p2.toFixed(2)}$?`,
        ]);
        return { clue: ph3, answer: String(total), answerDisplay: `$${total.toFixed(2)}` };
    }
    // Hard
    if (type === 0) {
        const a = ri(rng, 11, 99) / 10, b = ri(rng, 11, 99) / 10;
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `Find the product of $${a}$ and $${b}$`,
            `What is $${a} \\times ${b}$?`,
        ]);
        return { clue: ph, answer: String(round(a * b, 2)) };
    }
    if (type === 1) {
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        const ans = round(a / b, 2);
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} \\div ${b}$`,
            `Divide $${a}$ by $${b}$`,
            `Find the quotient of $${a}$ and $${b}$`,
            `What is $${a} \\div ${b}$?`,
        ]);
        return { clue: ph, answer: String(ans) };
    }
    if (type === 2) {
        const a = ri(rng, 101, 999) / 100, b = ri(rng, 100, Math.floor(a * 100) - 1) / 100;
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
            `Subtract $${b}$ from $${a}$`,
            `Find the difference of $${a}$ and $${b}$`,
            `What is $${a} - ${b}$?`,
        ]);
        return { clue: ph, answer: String(round(a - b, 2)) };
    }
    // type 3: measurement-cost multiply — ensure len has a decimal part
    const lenTenths = ri(rng, 11, 99);
    if (lenTenths % 10 === 0) return genDecimals(rng, diff, allowedOps, _depth + 1);
    const len = lenTenths / 10;
    const rate = ri(rng, 2, 15);
    const cost3 = round(len * rate, 2);
    const { unit: unit3, item: item3 } = rc(rng, [
        { unit: 'metre', item: 'fabric' },
        { unit: 'kilogram', item: 'fruit' },
        { unit: 'litre', item: 'paint' },
    ]);
    const ph3h = rc(rng, [
        `$${len}$ ${unit3}s of ${item3} cost $\\$${rate}$ per ${unit3}. Find the *total cost*.`,
        `Calculate the cost of $${len}$ ${unit3}s of ${item3} at $\\$${rate}$ per ${unit3}.`,
        `A length of $${len}$ ${unit3}s at $\\$${rate}$ per ${unit3}. Find the *total cost*.`,
    ]);
    return { clue: ph3h, answer: String(cost3), answerDisplay: `$${cost3}` };
}

// ============================================================
// ROUNDING
// ============================================================
function genRounding(rng, diff, allowedOps) {
    const maps = {
        Easy:   { 'nearest': [0, 1, 2] },
        Medium: { 'nearest': [0, 3], 'decimal-places': [1, 2] },
        Hard:   { 'nearest': [0], 'decimal-places': [1], 'sig-figs': [2, 3] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : 3);
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
        if (type === 1) {
            // Guarantee a non-zero decimal part so the question isn't nonsensical
            const whole = ri(rng, 1, 99);
            const frac = ri(rng, 1, 9);
            const n = whole + frac / 10;   // e.g. 7.3, 42.8 — always has .1–.9
            const ph = rc(rng, [
                `Round $${n}$ to the nearest *whole number*`,
                `Write $${n}$ as a whole number (rounded)`,
            ]);
            return { clue: ph, answer: String(Math.round(n)) };
        }
        // type 2: nearest 100
        const n2 = ri(rng, 150, 9850);
        const ans2 = Math.round(n2 / 100) * 100;
        const ph2 = rc(rng, [
            `Round $${n2}$ to the nearest $100$`,
            `Write $${n2}$ rounded to the nearest $100$`,
            `Approximate $${n2}$ to the nearest $100$`,
        ]);
        return { clue: ph2, answer: String(ans2) };
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
                `Round $${display}$ to *1 decimal place*`,
                `Write $${display}$ correct to *1 decimal place*`,
                `Express $${display}$ to *1 decimal place*`,
            ]);
            return { clue: ph, answer: round(n, 1).toFixed(1) };
        }
        if (type === 2) {
            const n = ri(rng, 1000, 99999) / 1000;
            const display = n.toFixed(3);
            const ph = rc(rng, [
                `Round $${display}$ to *2 decimal places*`,
                `Write $${display}$ correct to *2 decimal places*`,
                `Express $${display}$ to 2 d.p.`,
            ]);
            return { clue: ph, answer: round(n, 2).toFixed(2) };
        }
        // type 3: nearest 5
        const n3 = ri(rng, 12, 295);
        const ans3 = Math.round(n3 / 5) * 5;
        const ph3 = rc(rng, [
            `Round $${n3}$ to the nearest $5$`,
            `Write $${n3}$ rounded to the nearest $5$`,
            `A crowd of $${n3}$ is reported to the nearest $5$. State the figure.`,
        ]);
        return { clue: ph3, answer: String(ans3) };
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
        return { clue: ph, answer: round(n, 3).toFixed(3) };
    }
    if (type === 2) {
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
    // type 3: 3 significant figures
    const n3sf = ri(rng, 10000, 999999);
    const f3   = Math.pow(10, Math.floor(Math.log10(n3sf)) - 2);
    const ans3sf = Math.round(n3sf / f3) * f3;
    const ph3sf = rc(rng, [
        `Round $${n3sf}$ to *3 significant figures*`,
        `Write $${n3sf}$ correct to *3 significant figures*`,
        `Express $${n3sf}$ to 3 s.f.`,
    ]);
    return { clue: ph3sf, answer: String(ans3sf) };
}

// ============================================================
// FRACTIONS — answers are always integers or simple decimals
// ============================================================
function genFractions(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'fraction-of': [0, 3], 'add-subtract': [1], 'simplify-convert': [2] },
        Medium: { 'add-subtract': [0], 'multiply-divide': [1], 'simplify-convert': [2, 3] },
        Hard:   { 'multiply-divide': [0], 'add-subtract': [1], 'simplify-convert': [2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Hard' ? 2 : 3);
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
        if (type === 2) {
            const den = rc(rng, [4, 6, 8, 9, 10, 12, 15]);
            // Pick a factor that truly divides den (guarantees GCD > 1 after reduction)
            const divisors = [];
            for (let f = 2; f <= den / 2; f++) { if (den % f === 0) divisors.push(f); }
            if (divisors.length === 0) return genFractions(rng, diff, allowedOps, _depth + 1);
            const factor = rc(rng, divisors);
            const maxMult = den / factor;
            if (maxMult < 2) return genFractions(rng, diff, allowedOps, _depth + 1);
            // k in [1, maxMult-1] ensures num < den (no n/n trivial case)
            const num = factor * ri(rng, 1, maxMult - 1);
            const ans = fracStr(num, den);
            const ph = rc(rng, [
                `Simplify $\\frac{${num}}{${den}}$`,
                `Write $\\frac{${num}}{${den}}$ in its *simplest form*`,
                `Express $\\frac{${num}}{${den}}$ in *lowest terms*`,
                `Reduce $\\frac{${num}}{${den}}$ to its *simplest form*`,
            ]);
            return { clue: ph, answer: ans };
        }
        // type 3: fraction-of with real-world context
        const den3 = rc(rng, [2, 4, 5, 10]);
        const num3 = ri(rng, 1, den3 - 1);
        const whole3 = den3 * ri(rng, 2, 12);
        const ans3 = (num3 * whole3) / den3;
        const ctx3 = rc(rng, [
            `$${whole3}$ students walk to school. $\\frac{${num3}}{${den3}}$ of them walk every day. How many is that?`,
            `A pizza has $${whole3}$ slices. $\\frac{${num3}}{${den3}}$ of the pizza is eaten. How many slices is that?`,
            `There are $${whole3}$ marbles in a bag. $\\frac{${num3}}{${den3}}$ are red. How many red marbles are there?`,
        ]);
        return { clue: ctx3, answer: String(ans3) };
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
            const ph = rc(rng, [
                `${calcVerb} $\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$`,
                `Multiply $\\frac{${n1}}{${d1}}$ by $\\frac{${n2}}{${d2}}$`,
                `Find the product of $\\frac{${n1}}{${d1}}$ and $\\frac{${n2}}{${d2}}$`,
                `What is $\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$?`,
            ]);
            return { clue: ph, answer: ans };
        }
        if (type === 2) {
            const den = rc(rng, [2, 4, 5, 8, 10, 20, 25]);
            const num = ri(rng, 1, den - 1);
            const ans = round(num / den, 4);
            const ph = rc(rng, [
                `Convert $\\frac{${num}}{${den}}$ to a *decimal*`,
                `Express $\\frac{${num}}{${den}}$ as a *decimal*`,
                `Write $\\frac{${num}}{${den}}$ as a *decimal number*`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        // type 3: improper fraction → mixed number
        const denM = rc(rng, [2, 3, 4, 5, 6, 8]);
        const wholeM = ri(rng, 1, 5);
        const numRem = ri(rng, 1, denM - 1);
        const improper = wholeM * denM + numRem;
        const { n: sn, d: sd } = simplify(numRem, denM);
        const mixedAns = sd === 1 ? `${wholeM + sn}` : `${wholeM} ${sn}/${sd}`;
        const ph3 = rc(rng, [
            `Write $\\frac{${improper}}{${denM}}$ as a *mixed number*`,
            `Convert $\\frac{${improper}}{${denM}}$ to a *mixed number*`,
            `Express $\\frac{${improper}}{${denM}}$ as a *mixed number*`,
        ]);
        return { clue: ph3, answer: mixedAns };
    }

    // Hard
    if (type === 0) {
        // Build coprime fractions directly: pick d, then pick n from coprime candidates
        const d1 = ri(rng, 3, 8);
        const cops1 = Array.from({ length: d1 - 1 }, (_, i) => i + 1).filter(n => gcd(n, d1) === 1);
        const n1 = rc(rng, cops1);
        const d2 = ri(rng, 3, 8);
        const cops2 = Array.from({ length: d2 - 1 }, (_, i) => i + 1).filter(n => gcd(n, d2) === 1);
        const n2 = rc(rng, cops2);
        const ans = fracStr(n1 * d2, d1 * n2);
        const ph = rc(rng, [
            `${calcVerb} $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$`,
            `Divide $\\frac{${n1}}{${d1}}$ by $\\frac{${n2}}{${d2}}$`,
            `Find the quotient of $\\frac{${n1}}{${d1}}$ and $\\frac{${n2}}{${d2}}$`,
            `What is $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$?`,
        ]);
        return { clue: ph, answer: ans };
    }
    if (type === 1) {
        // Avoid d1===d2 directly; ensure result is positive by ordering fractions
        const dPool = [3, 4, 5, 6];
        const d1 = rc(rng, dPool);
        const d2 = rc(rng, dPool.filter(d => d !== d1));
        const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
        const l = lcm(d1, d2);
        const a = n1 * (l / d1), b = n2 * (l / d2);
        // Use larger minus smaller so result is always positive
        const [bigN, bigD, smN, smD] = a > b ? [n1, d1, n2, d2] : [n2, d2, n1, d1];
        const numResult = Math.abs(a - b);
        if (numResult === 0) return genFractions(rng, diff, allowedOps, _depth + 1);
        const ans = fracStr(numResult, l);
        return { clue: `${calcVerb} $\\frac{${bigN}}{${bigD}} - \\frac{${smN}}{${smD}}$`, answer: ans };
    }
    // type 2: simplify-convert — fraction→decimal (fixes wiring gap)
    const denH = rc(rng, [2, 4, 5, 8, 10, 20, 25]);
    const numH = ri(rng, 1, denH - 1);
    const ansH = round(numH / denH, 4);
    const phH = rc(rng, [
        `Convert $\\frac{${numH}}{${denH}}$ to a *decimal*`,
        `Express $\\frac{${numH}}{${denH}}$ as a *decimal*`,
        `Write $\\frac{${numH}}{${denH}}$ as a *decimal number*`,
    ]);
    return { clue: phH, answer: String(ansH) };
}

// ============================================================
// PERCENTAGES
// ============================================================
function genPercentages(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'find-pct': [0], 'increase-decrease': [1] },
        Medium: { 'find-pct': [0, 2], 'increase-decrease': [1, 3] },
        Hard:   { 'reverse-change': [0, 1, 2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);

    if (diff === 'Easy') {
        const typeE = _pickType(rng, filtered, 1);
        if (typeE === -1) return null;
        if (typeE === 0) {
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
                `A discount of $${pct}\\%$ is applied to $\\$${whole}$. Find the discount amount.`,
                `$${pct}\\%$ of a class of $${whole}$ students passed. How many students passed?`,
            ]);
            return { clue: ph, answer: String(ans), answerDisplay: String(ans) };
        }
        // typeE 1: sale-price after discount
        const pctD = rc(rng, [10, 20, 25, 50]);
        const denomD = { 10: 10, 20: 5, 25: 4, 50: 2 };
        const wholeD = ri(rng, 1, 20) * (denomD[pctD] || 10);
        const saleAns = Math.round(wholeD * (1 - pctD / 100));
        const phD = rc(rng, [
            `A $\\$${wholeD}$ item is reduced by $${pctD}\\%$. Find the *sale price*.`,
            `Calculate the price after a $${pctD}\\%$ discount on $\\$${wholeD}$.`,
            `A discount of $${pctD}\\%$ is applied to $\\$${wholeD}$. What is the *final price*?`,
        ]);
        return { clue: phD, answer: String(saleAns), answerDisplay: `$${saleAns}` };
    }
    if (diff === 'Medium') {
        const type = _pickType(rng, filtered, 3);
        if (type === -1) return null;
        if (type === 0) {
            const pct = rc(rng, [5, 10, 15, 20, 30, 40, 60, 70, 80]);
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
            // multiples of 20 guarantee integer results for all pct in [5,10,20,25,50]
            const orig = ri(rng, 1, 10) * 20;
            const pct = rc(rng, [5, 10, 20, 25, 50]);
            const ans = orig * (1 + pct / 100);
            const ctx = rc(rng, ['price', 'value', 'amount', 'score']);
            const ph = rc(rng, [
                `Increase $${orig}$ by $${pct}\\%$`,
                `A ${ctx} of $${orig}$ is increased by $${pct}\\%$. Find the **new** ${ctx}.`,
                `Calculate the result of increasing $${orig}$ by $${pct}\\%$`,
                `A price of $\\$${orig}$ increases by $${pct}\\%$. Find the **new** price.`,
                `A score of $${orig}$ is raised by $${pct}\\%$. What is the **new** score?`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        if (type === 2) {
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
        // type 3: decrease/discount — multiples of 20 guarantee integer results
        const origDec = ri(rng, 1, 10) * 20;
        const pctDec = rc(rng, [5, 10, 20, 25, 50]);
        const ansDec = origDec * (1 - pctDec / 100);
        const ctxDec = rc(rng, ['price', 'salary', 'value', 'cost']);
        const phDec = rc(rng, [
            `Decrease $${origDec}$ by $${pctDec}\\%$`,
            `A ${ctxDec} of $${origDec}$ is reduced by $${pctDec}\\%$. Find the **new** ${ctxDec}.`,
            `A $\\$${origDec}$ item is discounted by $${pctDec}\\%$. Find the *sale price*.`,
            `Calculate the result of decreasing $${origDec}$ by $${pctDec}\\%$`,
        ]);
        return { clue: phDec, answer: String(ansDec) };
    }
    // Hard
    const type = _pickType(rng, filtered, 2);
    if (type === -1) return null;
    if (type === 0) {
        const orig = ri(rng, 5, 20) * 20;
        const pct = rc(rng, [10, 20, 25, 50]);
        const final = round(orig * (1 + pct / 100), 2);
        const ph = rc(rng, [
            `After a $${pct}\\%$ increase the value is $${final}$. Find the **original**.`,
            `A quantity increases by $${pct}\\%$ to become $${final}$. Determine the **original** value.`,
            `The result after a $${pct}\\%$ increase is $${final}$. Calculate the **original** amount.`,
        ]);
        return { clue: ph, answer: String(orig) };
    }
    if (type === 1) {
        const orig = ri(rng, 4, 20) * 25;
        const pct = rc(rng, [10, 20, 25, 50]);
        const newVal = round(orig * (1 + pct / 100), 2);
        if (!Number.isInteger(newVal)) return genPercentages(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `A price rises from $\\$${orig}$ to $\\$${newVal}$. What is the *percentage increase*?`,
            `Calculate the *percentage increase* from $\\$${orig}$ to $\\$${newVal}$.`,
            `Determine the *percentage change* when a value goes from $${orig}$ to $${newVal}$.`,
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
// ALGEBRA (Stage 4 core)
// ============================================================
function _genAlgebraCore(rng, diff, allowedOps) {
    const maps = {
        Easy:   { 'solve': [0, 1] },
        Medium: { 'solve': [0, 1, 3, 4], 'substitution': [2] },
        Hard:   { 'solve': [0, 2], 'substitution': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : diff === 'Medium' ? 4 : 2);
    if (type === -1) return null;

    const v = rc(rng, ALGEBRA_VARS);
    const solveVerb = rc(rng, _solveVerbsFor(v));

    if (diff === 'Easy') {
        if (type === 0) {
            const ans = ri(rng, 1, 20), a = ri(rng, 1, 20);
            if (rng() < 0.35) {
                const clue = rc(rng, [
                    `A number increased by $${a}$ equals $${ans + a}$. Find the number.`,
                    `When $${a}$ is added to a number, the result is $${ans + a}$. What is the number?`,
                    `A number plus $${a}$ gives $${ans + a}$. Find the number.`,
                    `Think of a number. Add $${a}$. The answer is $${ans + a}$. What is the number?`,
                ]);
                return { clue, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
            }
            return { clue: `${solveVerb}\n$${v} + ${a} = ${ans + a}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
        }
        const a = ri(rng, 2, 12), ans = ri(rng, 2, 12);
        if (rng() < 0.35) {
            const clue = rc(rng, [
                `A number multiplied by $${a}$ gives $${a * ans}$. Find the number.`,
                `When a number is multiplied by $${a}$, the result is $${a * ans}$. What is the number?`,
                `$${a}$ times a number equals $${a * ans}$. Find the number.`,
                `Think of a number. Multiply it by $${a}$. The answer is $${a * ans}$. What is the number?`,
            ]);
            return { clue, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
        }
        return { clue: `${solveVerb}\n$${a}${v} = ${a * ans}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 2, 6), ans = ri(rng, 1, 10), b = ri(rng, 1, 20);
            return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${a * ans + b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
        }
        if (type === 1) {
            const a = ri(rng, 2, 6), ans = ri(rng, 2, 10), b = ri(rng, 1, 10);
            return { clue: `${solveVerb}\n$${a}${v} - ${b} = ${a * ans - b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
        }
        if (type === 2) {
            const [fv, iv] = rc(rng, SUBST_PAIRS);
            const a = ri(rng, 2, 6), b = ri(rng, 1, 12), n = ri(rng, 1, 8);
            const subVerb = rc(rng, [
                `If $${fv} = ${a}${iv} + ${b}$, find $${fv}$ when $${iv} = ${n}$`,
                `Evaluate $${fv} = ${a}${iv} + ${b}$ when $${iv} = ${n}$`,
                `Calculate $${fv}$ given $${fv} = ${a}${iv} + ${b}$ and $${iv} = ${n}$`,
                `Substitute $${iv} = ${n}$ into $${fv} = ${a}${iv} + ${b}$`,
                `Find the value of $${fv}$ if $${fv} = ${a}${iv} + ${b}$ and $${iv} = ${n}$`,
            ]);
            return { clue: subVerb, answer: String(a * n + b) };
        }
        if (type === 3) {
            // word-problem solve (linear)
            const a3 = ri(rng, 2, 6), ans3 = ri(rng, 2, 12), b3 = ri(rng, 1, 20);
            const R3 = a3 * ans3 + b3;
            const wp3 = rc(rng, [
                `A number is multiplied by $${a3}$ then $${b3}$ is added, giving $${R3}$. Find the number.`,
                `I think of a number, multiply it by $${a3}$, then add $${b3}$. The result is $${R3}$. What is the number?`,
                `When a number is multiplied by $${a3}$ and $${b3}$ is added, the answer is $${R3}$. Find the number.`,
            ]);
            return { clue: wp3, answer: String(ans3), answerDisplay: `$${v} = ${ans3}$` };
        }
        // type 4: division equation x/a = c
        const a4 = ri(rng, 2, 9), ans4 = ri(rng, 2, 12);
        return { clue: `${solveVerb}\n$\\frac{${v}}{${a4}} = ${ans4}$`, answer: String(a4 * ans4), answerDisplay: `$${v} = ${a4 * ans4}$` };
    }
    // Hard
    if (type === 0) {
        const ans = ri(rng, 1, 10);
        const a = ri(rng, 3, 8), c = ri(rng, 1, a - 1), b = ri(rng, 1, 20);
        const d = (a - c) * ans + b;
        return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${c}${v} + ${d}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$` };
    }
    if (type === 1) {
        const [fv, iv] = rc(rng, SUBST_PAIRS);
        const a = ri(rng, 1, 4), b = ri(rng, 1, 15), n = ri(rng, 2, 6);
        const coeff = a === 1 ? '' : String(a);
        const subVerb = rc(rng, [
            `If $${fv} = ${coeff}${iv}^2 + ${b}$, find $${fv}$ when $${iv} = ${n}$`,
            `Evaluate $${fv} = ${coeff}${iv}^2 + ${b}$ when $${iv} = ${n}$`,
            `Calculate $${fv}$ given $${fv} = ${coeff}${iv}^2 + ${b}$ and $${iv} = ${n}$`,
            `Substitute $${iv} = ${n}$ into $${fv} = ${coeff}${iv}^2 + ${b}$`,
        ]);
        return { clue: subVerb, answer: String(a * n * n + b) };
    }
    const a = ri(rng, 2, 5), bMult = ri(rng, 1, 8);
    const ans2 = -bMult;
    return { clue: `${solveVerb}\n$${a}${v} + ${a * bMult} = 0$`, answer: String(ans2), answerDisplay: `$${v} = ${ans2}$` };
}

// ============================================================
// STATISTICS (Stage 4 core)
// ============================================================
function _genStatisticsCore(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 30) return null;
    const maps = {
        Easy:   { 'mean-median': [0, 1], 'mode-range': [2, 3] },
        Medium: { 'mode-range': [0, 1], 'mean-median': [2, 3] },
        Hard:   { 'iqr': [0], 'mean-median': [1, 2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 3 : diff === 'Medium' ? 3 : 2);
    if (type === -1) return null;

    const ctx = rc(rng, DATA_CONTEXTS);
    if (diff === 'Easy') {
        if (type === 0) {
            // Construct dataset so mean is always a whole number
            const n = ri(rng, 3, 5);
            const meanV = ri(rng, 2, 12);
            const spread = Math.max(1, meanV - 1);
            const others = Array.from({ length: n - 1 }, () => meanV + ri(rng, -spread, spread));
            const last = meanV * n - others.reduce((a, b) => a + b, 0);
            if (last < 1 || last > 25) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
            const data = [...others, last].sort((a, b) => a - b);
            const ph = rc(rng, [
                `Find the *mean* of: $${data.join(', ')}$`,
                `Calculate the *mean* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *mean* of: $${data.join(', ')}$`,
                `What is the *mean* of $${data.join(', ')}$?`,
                `The ${ctx} recorded are $${data.join(', ')}$. Find the *mean*.`,
            ]);
            return { clue: ph, answer: String(meanV) };
        }
        if (type === 1) {
            const n = (ri(rng, 2, 4) * 2) - 1;
            const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
            const ph = rc(rng, [
                `Find the *median* of: $${data.join(', ')}$`,
                `State the *median* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *median* of: $${data.join(', ')}$`,
                `What is the *median* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *median*.`,
            ]);
            return { clue: ph, answer: String(data[Math.floor(n / 2)]) };
        }
        if (type === 2) {
            // mode: 5 values with one value appearing twice, rest distinct
            const mode = ri(rng, 1, 10);
            const others = [];
            while (others.length < 3) {
                const v = ri(rng, 1, 15);
                if (v !== mode && !others.includes(v)) others.push(v);
            }
            const data = [...others, mode, mode].sort((a, b) => a - b);
            const ph = rc(rng, [
                `Find the *mode* of: $${data.join(', ')}$`,
                `State the *mode* of these ${ctx}: $${data.join(', ')}$`,
                `Identify the *mode* of: $${data.join(', ')}$`,
                `What is the *mode* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *mode*.`,
            ]);
            return { clue: ph, answer: String(mode) };
        }
        // type 3: range — small integer dataset
        const n3 = ri(rng, 4, 6);
        const data3 = Array.from({ length: n3 }, () => ri(rng, 1, 20));
        const range3 = Math.max(...data3) - Math.min(...data3);
        const ph3 = rc(rng, [
            `Find the *range* of: $${data3.join(', ')}$`,
            `Calculate the *range* of these ${ctx}: $${data3.join(', ')}$`,
            `What is the *range* of $${data3.join(', ')}$?`,
            `The ${ctx} are $${data3.join(', ')}$. Find the *range*.`,
        ]);
        return { clue: ph3, answer: String(range3) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const n = ri(rng, 4, 7);
            const data = Array.from({ length: n }, () => ri(rng, 1, 40));
            const ph = rc(rng, [
                `Find the *range* of: $${data.join(', ')}$`,
                `Calculate the *range* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *range* of: $${data.join(', ')}$`,
                `What is the *range* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *range*.`,
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
                `Identify the *mode* of: $${data.join(', ')}$`,
                `State the *mode* of these ${ctx}: $${data.join(', ')}$`,
                `Find the *mode* of: $${data.join(', ')}$`,
                `What is the *mode* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *mode*.`,
            ]);
            return { clue: ph, answer: String(mode) };
        }
        if (type === 2) {
            const n = ri(rng, 4, 6);
            const meanV = ri(rng, 5, 25);
            const offset = Math.max(1, Math.floor(meanV / n));
            const others = Array.from({ length: n - 1 }, () => meanV + ri(rng, -offset, offset));
            const last = meanV * n - others.reduce((a, b) => a + b, 0);
            if (last < 1 || last > 40) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
            const data = [...others, last].sort((a, b) => a - b);
            const ph = rc(rng, [
                `Calculate the *mean* of: $${data.join(', ')}$`,
                `Find the *mean* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *mean* of: $${data.join(', ')}$`,
                `The ${ctx} are $${data.join(', ')}$. Calculate the *mean*.`,
            ]);
            return { clue: ph, answer: String(meanV) };
        }
        // type 3: find missing value given mean
        const n3 = ri(rng, 4, 5);
        const mean3 = ri(rng, 5, 20);
        const spread3 = Math.max(2, Math.floor(mean3 * 0.5));
        const target3 = mean3 * n3;
        const known3 = Array.from({ length: n3 - 1 }, () => mean3 + ri(rng, -spread3, spread3));
        const missing3 = target3 - known3.reduce((a, b) => a + b, 0);
        if (missing3 < 1 || missing3 > 50) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
        const display3 = [...known3, '?'].join(', ');
        const ph3 = rc(rng, [
            `The *mean* of $${display3}$ is $${mean3}$. Find the missing value.`,
            `${n3} ${ctx} have a *mean* of $${mean3}$. ${n3 - 1} are $${known3.join(', ')}$. Find the missing value.`,
            `Find the missing number if the *mean* of $${display3}$ is $${mean3}$.`,
            `The *mean* of these values is $${mean3}$: $${display3}$. What is the missing value?`,
        ]);
        return { clue: ph3, answer: String(missing3) };
    }
    // Hard
    if (type === 0) {
        // Use even numbers so adjacent pairs always sum to even → integer quartiles
        const data = Array.from({ length: 8 }, () => ri(rng, 1, 10) * 2).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        const iqr = q3 - q1;
        if (iqr <= 0) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Find the *interquartile range* of: $${data.join(', ')}$`,
            `Calculate the *IQR* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *interquartile range* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Find the *IQR*.`,
        ]);
        return { clue: ph, answer: String(iqr) };
    }
    if (type === 1) {
        const n = rc(rng, [4, 6]);
        // Even-count dataset: ensure middle two values sum to even → integer median
        const data = Array.from({ length: n }, () => ri(rng, 1, 15) * 2).sort((a, b) => a - b);
        const med = (data[n / 2 - 1] + data[n / 2]) / 2;
        const ph = rc(rng, [
            `Find the *median* of: $${data.join(', ')}$`,
            `Calculate the *median* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *median* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Find the *median*.`,
        ]);
        return { clue: ph, answer: String(med) };
    }
    // type 2: find missing value given mean (harder dataset)
    const n2 = ri(rng, 5, 7);
    const mean2 = ri(rng, 10, 30);
    const spread2 = Math.floor(mean2 * 0.5);
    const target2 = mean2 * n2;
    const known2 = Array.from({ length: n2 - 1 }, () => mean2 + ri(rng, -spread2, spread2));
    const missing2 = target2 - known2.reduce((a, b) => a + b, 0);
    if (missing2 < 1 || missing2 > 70) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
    const display2 = [...known2, '?'].join(', ');
    const ph2 = rc(rng, [
        `The *mean* of $${display2}$ is $${mean2}$. Find the missing value.`,
        `Find the missing value if the *mean* of $${display2}$ is $${mean2}$.`,
        `The *mean* of these ${ctx} is $${mean2}$: $${display2}$. What is the missing value?`,
        `Determine the missing value given that the *mean* of $${display2}$ is $${mean2}$.`,
    ]);
    return { clue: ph2, answer: String(missing2) };
}

// ============================================================
// FINANCIAL MATHS (Stage 4 core)
// ============================================================
function _genFinancialCore(rng, diff, allowedOps, opts = {}, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'simple-interest': [0], 'gst': [1], 'markup-profit': [2] },
        Medium: { 'markup-profit': [0, 2], 'simple-interest': [1], 'gst': [3] },
        Hard:   { 'compound-interest': [0], 'markup-profit': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : diff === 'Medium' ? 3 : 1);
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
                `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
                `Find the *simple interest* earned on $\\$${P}$ invested at $${r}\\%$ per year for ${yrs}.${pf}`,
                `Determine the interest on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
            ]);
            return { clue: ph, answer: String(I), answerDisplay: `$${I}` };
        }
        if (type === 1) {
            const price = ri(rng, 5, 50) * 10;
            const ph = rc(rng, [
                `Find the price after $10\\%$ GST is added to $\\$${price}$`,
                `Calculate the GST-inclusive price for an item costing $\\$${price}$`,
                `A product costs $\\$${price}$ before GST. Find the total price including $10\\%$ GST.`,
            ]);
            const gstTotal = round(price * 1.1, 2);
            return { clue: ph, answer: String(gstTotal), answerDisplay: `$${gstTotal}` };
        }
        // type 2: markup → selling price (easy numbers)
        const cost2 = ri(rng, 2, 10) * 10;
        const pct2 = rc(rng, [10, 20, 25, 50]);
        const sell2 = cost2 + cost2 * pct2 / 100;
        const ph2 = rc(rng, [
            `An item costs $\\$${cost2}$. It is marked up by $${pct2}\\%$. Find the selling price.`,
            `Find the selling price of a $\\$${cost2}$ item after a $${pct2}\\%$ mark-up.`,
            `A shopkeeper buys an item for $\\$${cost2}$ and adds $${pct2}\\%$ profit. What is the selling price?`,
        ]);
        return { clue: ph2, answer: String(sell2), answerDisplay: `$${sell2}` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const cost = ri(rng, 5, 20) * 10;
            const pctProfit = rc(rng, [10, 20, 25, 50]);
            const sell = round(cost * (1 + pctProfit / 100), 2);
            if (!Number.isInteger(sell)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
            const ph = rc(rng, [
                `Find the selling price: cost $\\$${cost}$, mark-up $${pctProfit}\\%$`,
                `An item costs $\\$${cost}$. Calculate the selling price after a $${pctProfit}\\%$ mark-up.`,
                `Determine the selling price of a $\\$${cost}$ item with a $${pctProfit}\\%$ profit margin.`,
            ]);
            return { clue: ph, answer: String(sell), answerDisplay: `$${sell}` };
        }
        if (type === 1) {
            const P = ri(rng, 2, 10) * 1000, r = rc(rng, [5, 10]), t = ri(rng, 1, 3);
            const I = P * r / 100 * t;
            const yrs = `$${t}$ year${t > 1 ? 's' : ''}`;
            const fOn = opts.showFormulas?.['simple-interest']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $I = Prn$.' : '';
            const ph = rc(rng, [
                `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
                `Find the *simple interest* earned on a $\\$${P}$ investment at $${r}\\%$ p.a. over ${yrs}.${pf}`,
                `Determine the interest on $\\$${P}$ at $${r}\\%$ per annum for ${yrs}.${pf}`,
            ]);
            return { clue: ph, answer: String(I), answerDisplay: `$${I}` };
        }
        if (type === 2) {
            // discount → sale price
            const orig = ri(rng, 4, 20) * 25;
            const pctOff = rc(rng, [10, 15, 20, 25, 30, 50]);
            const sale = round(orig * (1 - pctOff / 100), 2);
            if (!Number.isInteger(sale)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
            const ph = rc(rng, [
                `A $\\$${orig}$ item is discounted by $${pctOff}\\%$. Find the *sale price*.`,
                `An item originally priced at $\\$${orig}$ is on sale at $${pctOff}\\%$ off. What is the sale price?`,
                `Calculate the sale price of a $\\$${orig}$ item after a $${pctOff}\\%$ discount.`,
            ]);
            return { clue: ph, answer: String(sale), answerDisplay: `$${sale}` };
        }
        // type 3: GST-exclusive — find pre-GST price
        const gstInclusive = ri(rng, 5, 30) * 11;
        const preGst = round(gstInclusive / 1.1, 2);
        if (!Number.isInteger(preGst)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
        const ph3 = rc(rng, [
            `A price including $10\\%$ GST is $\\$${gstInclusive}$. Find the *pre-GST* price.`,
            `An item costs $\\$${gstInclusive}$ including GST. What was the price *before* GST?`,
            `The GST-inclusive price is $\\$${gstInclusive}$. Calculate the pre-GST price.`,
        ]);
        return { clue: ph3, answer: String(preGst), answerDisplay: `$${preGst}` };
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
                `Calculate the total amount after compound interest: $\\$${P2}$ at $${r2}\\%$ p.a. for $${t2}$ year${t2 > 1 ? 's' : ''}.${pf}`,
                `$\\$${P2}$ is invested at $${r2}\\%$ p.a. compound interest for $${t2}$ year${t2 > 1 ? 's' : ''}. Find the total amount.${pf}`,
            ]);
            return { clue: ph, answer: String(A2), answerDisplay: `$${A2}` };
        }
        const fOn = opts.showFormulas?.['compound-interest']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $A = P(1+r)^n$.' : '';
        const ph = rc(rng, [
            `Calculate the total amount after compound interest: $\\$${P}$ at $${r}\\%$ p.a. for $${t}$ year${t > 1 ? 's' : ''}.${pf}`,
            `$\\$${P}$ is invested at $${r}\\%$ p.a. compound interest for $${t}$ year${t > 1 ? 's' : ''}. Determine the total amount.${pf}`,
            `Find the final value of $\\$${P}$ compounded at $${r}\\%$ p.a. for $${t}$ year${t > 1 ? 's' : ''}.${pf}`,
        ]);
        return { clue: ph, answer: String(A), answerDisplay: `$${A}` };
    }
    const cost = ri(rng, 2, 15) * 100;
    const pct = rc(rng, [5, 10, 20, 25, 50]);
    const sell = round(cost + cost * pct / 100, 2);
    const ph = rc(rng, [
        `An item costs $\\$${cost}$ and sells for $\\$${sell}$. Calculate the *percentage profit*.`,
        `Find the *percentage profit*: cost $\\$${cost}$, selling price $\\$${sell}$.`,
        `Determine the *profit percentage* given a cost of $\\$${cost}$ and a selling price of $\\$${sell}$.`,
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

function _genGeometryCore(rng, diff, allowedOps, opts = {}, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'area-perimeter': [0, 1, 2] },
        Medium: { 'area-perimeter': [0, 3], 'pythagoras': [1], 'angles': [2] },
        Hard:   { 'circles': [0, 2, 3], 'pythagoras': [1], 'area-perimeter': [4] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : diff === 'Hard' ? 4 : 3);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const l = ri(rng, 2, 15), w = ri(rng, 2, 12);
            const u = _geoUnit(Math.max(l, w));
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = l \\times w$.' : '';
            const ph = rc(rng, [
                `Find the *area* of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
                `Calculate the *area* of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
                `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its area.${pf}`,
                `What is the *area* of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
            ]);
            return { clue: ph, answer: String(l * w), answerDisplay: `${l * w} ${u}²`, diagram: { type: 'rectangle', l, w, missing: 'area' } };
        }
        if (type === 1) {
            const l = ri(rng, 3, 15), w = ri(rng, 2, l);
            const u = _geoUnit(Math.max(l, w));
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $P = 2l + 2w$.' : '';
            const ph = rc(rng, [
                `Find the *perimeter* of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
                `Calculate the *perimeter* of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
                `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its perimeter.${pf}`,
                `What is the *perimeter* of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
            ]);
            return { clue: ph, answer: String(2 * (l + w)), answerDisplay: `${2 * (l + w)} ${u}`, diagram: { type: 'rectangle', l, w, missing: 'perimeter' } };
        }
        // type 2: find length given area and width (no diagram)
        const w2 = ri(rng, 2, 10), l2 = ri(rng, w2 + 1, 15);
        const area2 = l2 * w2;
        const u2 = _geoUnit(Math.max(l2, w2));
        const ph2 = rc(rng, [
            `A rectangle has area $${area2}$ ${u2}² and width $${w2}$ ${u2}. Find its length.`,
            `The area of a rectangle is $${area2}$ ${u2}² and its width is $${w2}$ ${u2}. What is the length?`,
            `Find the length of a rectangle with area $${area2}$ ${u2}² and width $${w2}$ ${u2}.`,
            `A rectangle with area $${area2}$ ${u2}² has a width of $${w2}$ ${u2}. Determine its length.`,
        ]);
        return { clue: ph2, answer: String(l2), answerDisplay: `${l2} ${u2}` };
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
                `Find the *area* of a triangle with base $${b}$ ${u} and perpendicular height $${h}$ ${u}.${pf}`,
                `Calculate the *area* of a triangle: base $${b}$ ${u}, height $${h}$ ${u}.${pf}`,
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
                `A right-angled triangle has legs $${a * scale}$ ${u} and $${b * scale}$ ${u}. Find the *hypotenuse*.${pf}`,
                `Calculate the *hypotenuse* of a right triangle with legs $${a * scale}$ ${u} and $${b * scale}$ ${u}.${pf}`,
                `Determine the *hypotenuse* given legs of $${a * scale}$ ${u} and $${b * scale}$ ${u}.${pf}`,
            ]);
            return { clue: ph, answer: String(c * scale), answerDisplay: `${c * scale} ${u}`, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'c' } };
        }
        if (type === 2) {
            const angles = [30, 40, 45, 50, 60, 70, 80, 90];
            const a1 = rc(rng, angles);
            const remaining = angles.filter(a => a < 180 - a1 && a !== a1);
            if (remaining.length === 0) return _genGeometryCore(rng, diff, allowedOps, opts, _depth + 1);
            const a2 = rc(rng, remaining);
            const a3 = 180 - a1 - a2;
            const ph = rc(rng, [
                `A triangle has angles $${a1}$° and $${a2}$°. Find the **third** angle.`,
                `Determine the **missing** angle in a triangle with angles $${a1}$° and $${a2}$°.`,
                `Calculate the **third** angle of a triangle given angles of $${a1}$° and $${a2}$°.`,
                `Two angles of a triangle are $${a1}$° and $${a2}$°. What is the **third** angle?`,
            ]);
            return { clue: ph, answer: String(a3), answerDisplay: `${a3}°`, diagram: { type: 'triangle-angles', a1, a2, a3, missing: 'a3' } };
        }
        // type 3: find area of rectangle given perimeter and width (no diagram)
        const w3 = ri(rng, 3, 10), l3 = ri(rng, w3 + 2, 18);
        const P3 = 2 * (l3 + w3);
        const u3 = _geoUnit(Math.max(l3, w3));
        const ph3 = rc(rng, [
            `A rectangle has perimeter $${P3}$ ${u3} and width $${w3}$ ${u3}. Find its area.`,
            `The perimeter of a rectangle is $${P3}$ ${u3} and its width is $${w3}$ ${u3}. Calculate the area.`,
            `Find the area of a rectangle with perimeter $${P3}$ ${u3} and width $${w3}$ ${u3}.`,
            `A rectangle with perimeter $${P3}$ ${u3} has a width of $${w3}$ ${u3}. What is its area?`,
        ]);
        return { clue: ph3, answer: String(l3 * w3), answerDisplay: `${l3 * w3} ${u3}²` };
    }
    // Hard
    if (type === 0) {
        const r = ri(rng, 2, 10);
        const u = _geoUnit(r);
        const ans = round(3.14 * r * r, 2);
        const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $A = \\pi r^2$.' : '';
        const ph = rc(rng, [
            `Find the *area* of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Calculate the *area* of a circle of radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Determine the *area* of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
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
            `Calculate the **missing** leg: hypotenuse $${c * scale}$ ${u}, known leg $${a * scale}$ ${u}.${pf}`,
            `Determine the **unknown** side of a right triangle with hypotenuse $${c * scale}$ ${u} and leg $${a * scale}$ ${u}.${pf}`,
        ]);
        return { clue: ph, answer: String(b * scale), answerDisplay: `${b * scale} ${u}`, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'b' } };
    }
    if (type === 2) {
        const r = ri(rng, 2, 15);
        const u = _geoUnit(r);
        const ans = round(2 * 3.14 * r, 2);
        const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $C = 2\\pi r$.' : '';
        const ph = rc(rng, [
            `Find the *circumference* of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Calculate the *circumference* of a circle of radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
            `Determine the *circumference* of a circle with radius $${r}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
        ]);
        return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}`, diagram: { type: 'circle', r, missing: 'circumference' } };
    }
    // type 3: find radius given area (no diagram — avoids mislabelling diagram center)
    if (type === 3) {
        const r3 = ri(rng, 2, 9);
        const u3 = _geoUnit(r3);
        const area3 = round(3.14 * r3 * r3, 2);
        const ph3 = rc(rng, [
            `The *area* of a circle is $${area3}$ ${u3}². Find its radius. Use $\\pi \\approx 3.14$.`,
            `A circle has area $${area3}$ ${u3}². Calculate its radius. Use $\\pi \\approx 3.14$.`,
            `Determine the radius of a circle with area $${area3}$ ${u3}². Use $\\pi \\approx 3.14$.`,
            `Find the radius of a circle whose area is $${area3}$ ${u3}². Use $\\pi \\approx 3.14$.`,
        ]);
        return { clue: ph3, answer: String(r3), answerDisplay: `${r3} ${u3}` };
    }
    // type 4: find triangle height given area and base (no diagram)
    const b4 = ri(rng, 2, 14) * 2;
    const h4 = ri(rng, 3, 18);
    const area4 = (b4 * h4) / 2;
    const u4 = _geoUnit(Math.max(b4, h4));
    const fOn4 = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
    const pf4 = fOn4 ? ' Use $A = \\frac{1}{2}bh$.' : '';
    const ph4 = rc(rng, [
        `A triangle has area $${area4}$ ${u4}² and base $${b4}$ ${u4}. Find its *perpendicular height*.${pf4}`,
        `The area of a triangle is $${area4}$ ${u4}² and its base is $${b4}$ ${u4}. Calculate the *height*.${pf4}`,
        `Find the *height* of a triangle with area $${area4}$ ${u4}² and base $${b4}$ ${u4}.${pf4}`,
        `A triangle with base $${b4}$ ${u4} has area $${area4}$ ${u4}². Determine the *perpendicular height*.${pf4}`,
    ]);
    return { clue: ph4, answer: String(h4), answerDisplay: `${h4} ${u4}` };
}

// ============================================================
// === STAGE 5 GENERATORS ===
// ============================================================

// ---- Algebra Stage 5 operations ----------------------------
function _genAlgebraOp(rng, diff, op) {
    const verb = rc(rng, ['Expand:', 'Expand and simplify:']);

    if (op === 'expand') {
        if (diff === 'Easy') {
            const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
            const mid = a + b, last = a * b;
            return { clue: `${verb}\n$(x + ${a})(x + ${b})$`, answer: `x²+${mid}x+${last}`, answerDisplay: `$x^2 + ${mid}x + ${last}$` };
        }
        if (diff === 'Medium') {
            const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
            const mid = a - b, last = -a * b;
            const mStr = mid >= 0 ? `+${mid}` : `${mid}`;
            const lStr = last >= 0 ? `+${last}` : `${last}`;
            return { clue: `${verb}\n$(x + ${a})(x - ${b})$`, answer: `x²${mStr}x${lStr}`, answerDisplay: `$x^2 ${mid >= 0 ? '+' : ''}${mid}x ${last >= 0 ? '+' : ''}${last}$` };
        }
        // Hard: (ax + b)(cx + d)
        const a = ri(rng, 2, 3), b = ri(rng, 1, 5), c = ri(rng, 2, 3), d = ri(rng, 1, 5);
        const lead = a * c, mid2 = a * d + b * c, last2 = b * d;
        const m2Str = mid2 >= 0 ? `+${mid2}` : `${mid2}`;
        const expandVerb = rc(rng, ['Expand:', 'Expand and simplify:']);
        return { clue: `${expandVerb}\n$(${a}x + ${b})(${c}x + ${d})$`, answer: `${lead}x²${m2Str}x+${last2}`, answerDisplay: `$${lead}x^2 ${mid2 >= 0 ? '+' : ''}${mid2}x + ${last2}$` };
    }

    if (op === 'factorise') {
        if (diff === 'Easy') {
            // x² + (a+b)x + ab = (x+a)(x+b), a,b ∈ [1,7] so answer fits ≤10 chars
            const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
            const mid = a + b, last = a * b;
            return { clue: `Factorise:\n$x^2 + ${mid}x + ${last}$`, answer: `(x+${a})(x+${b})`, answerDisplay: `$(x + ${a})(x + ${b})$` };
        }
        if (diff === 'Medium') {
            // Perfect square: (x+a)² = x² + 2ax + a²
            const a = ri(rng, 2, 6);
            return { clue: `Factorise:\n$x^2 + ${2 * a}x + ${a * a}$`, answer: `(x+${a})²`, answerDisplay: `$(x + ${a})^2$` };
        }
        // Hard: difference of two squares
        const n = ri(rng, 2, 7);
        return { clue: `Factorise:\n$x^2 - ${n * n}$`, answer: `(x+${n})(x-${n})`, answerDisplay: `$(x + ${n})(x - ${n})$` };
    }

    if (op === 'quadratic-solve') {
        const sv = rc(rng, SOLVE_VERBS);
        if (diff === 'Easy') {
            // x² = c → x = ±√c, use perfect squares
            const n = ri(rng, 2, 9);
            return { clue: `${sv}\n$x^2 = ${n * n}$`, answer: `±${n}`, answerDisplay: `$x = \\pm ${n}$` };
        }
        if (diff === 'Medium') {
            // (x-a)(x-b) = 0 where a,b > 0, a ≠ b
            const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
            if (a === b) {
                const b2 = a + 1;
                const mid = -(a + b2), last = a * b2;
                return { clue: `${sv}\n$x^2 ${mid}x + ${last} = 0$`, answer: `x=${a},${b2}`, answerDisplay: `$x = ${a}$ or $x = ${b2}$` };
            }
            const mid = -(a + b), last = a * b;
            const mStr = mid >= 0 ? `+ ${mid}` : `- ${Math.abs(mid)}`;
            return { clue: `${sv}\n$x^2 ${mStr}x + ${last} = 0$`, answer: `x=${a},${b}`, answerDisplay: `$x = ${a}$ or $x = ${b}$` };
        }
        // Hard: (x-a)(x+b) = 0, one negative root
        const a = ri(rng, 2, 6), b = ri(rng, 1, 5);
        const mid = a - b, last = -a * b;
        const mStr = mid >= 0 ? `+ ${mid}` : `- ${Math.abs(mid)}`;
        const lStr = last >= 0 ? `+ ${last}` : `- ${Math.abs(last)}`;
        return { clue: `${sv}\n$x^2 ${mStr}x ${lStr} = 0$`, answer: `x=${a},-${b}`, answerDisplay: `$x = ${a}$ or $x = -${b}$` };
    }

    if (op === 'indices-laws') {
        const sv = rc(rng, CALC_VERBS);
        if (diff === 'Easy') {
            const base = ri(rng, 2, 4), m = ri(rng, 1, 3), n = ri(rng, 1, 3);
            const ans = Math.pow(base, m + n);
            if (ans > 9999) return null;
            return { clue: `${sv}\n$${base}^${m} \\times ${base}^${n}$`, answer: String(ans), answerDisplay: `$${ans}$` };
        }
        if (diff === 'Medium') {
            const base = ri(rng, 2, 4), n2 = ri(rng, 1, 2), extra = ri(rng, 1, 2);
            const m2 = n2 + extra;
            const ans = Math.pow(base, extra);
            return { clue: `${sv}\n$${base}^${m2} \\div ${base}^${n2}$`, answer: String(ans), answerDisplay: `$${ans}$` };
        }
        // Hard: (a^m)^n = a^(mn)
        const base = ri(rng, 2, 3), m3 = ri(rng, 2, 3), n3 = ri(rng, 2, 3);
        const ans3 = Math.pow(base, m3 * n3);
        if (ans3 > 9999) return null;
        return { clue: `${sv}\n$(${base}^${m3})^${n3}$`, answer: String(ans3), answerDisplay: `$${ans3}$` };
    }

    if (op === 'simultaneous') {
        const x = ri(rng, 1, 8), y = ri(rng, 1, 8);
        if (diff === 'Easy') {
            const a = x + y, b = x - y;
            return { clue: `Solve:\n$x + y = ${a}$\n$x - y = ${b}$`, answer: `x=${x},y=${y}`, answerDisplay: `$x = ${x},\\ y = ${y}$` };
        }
        if (diff === 'Medium') {
            const c1 = ri(rng, 2, 4);
            const a2 = c1 * x + y, b2 = x + y;
            return { clue: `Solve:\n$${c1}x + y = ${a2}$\n$x + y = ${b2}$`, answer: `x=${x},y=${y}`, answerDisplay: `$x = ${x},\\ y = ${y}$` };
        }
        const c1 = ri(rng, 2, 3), c2 = ri(rng, 2, 3);
        const a3 = c1 * x + c2 * y, b3 = x + c2 * y;
        return { clue: `Solve:\n$${c1}x + ${c2}y = ${a3}$\n$x + ${c2}y = ${b3}$`, answer: `x=${x},y=${y}`, answerDisplay: `$x = ${x},\\ y = ${y}$` };
    }

    if (op === 'surds-simplify') {
        const sv = rc(rng, ['Simplify:', 'Simplify the surd:']);
        // Difficulty scaling: Easy k=2-3, Medium k=2-5, Hard k=3-7
        const [kLo, kHi, nPool] = diff === 'Easy'
            ? [2, 3, [2, 3, 5]]
            : diff === 'Medium'
            ? [2, 5, [2, 3, 5, 6, 7]]
            : [3, 7, [2, 3, 5, 6, 7, 10, 11]];
        const k = ri(rng, kLo, kHi), n = rc(rng, nPool);
        const radicand = k * k * n;
        return { clue: `${sv}\n$\\sqrt{${radicand}}$`, answer: `${k}√${n}`, answerDisplay: `$${k}\\sqrt{${n}}$` };
    }

    if (op === 'surds-operate') {
        const sv = rc(rng, ['Simplify:', 'Evaluate:']);
        const k1 = ri(rng, 1, 4), k2 = ri(rng, 1, 4), n = rc(rng, [2, 3, 5, 6]);
        if (diff === 'Easy') {
            const sum = k1 + k2;
            return { clue: `${sv}\n$${k1}\\sqrt{${n}} + ${k2}\\sqrt{${n}}$`, answer: `${sum}√${n}`, answerDisplay: `$${sum}\\sqrt{${n}}$` };
        }
        const prod = k1 * k2 * n;
        return { clue: `${sv}\n$${k1}\\sqrt{${n}} \\times ${k2}\\sqrt{${n}}$`, answer: String(prod), answerDisplay: `$${prod}$` };
    }

    return null;
}

// ---- Statistics Stage 5 operations -------------------------
function _genStatisticsS5Op(rng, diff, op) {
    if (op === 'five-number-summary') {
        // Use even numbers so all adjacent-pair averages are integers
        const n = 8;
        const data = Array.from({ length: n }, () => ri(rng, 1, 15) * 2).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        const med = (data[3] + data[4]) / 2;
        const iqr = q3 - q1;
        if (iqr <= 0) return null;
        const choice = rc(rng, ['Q1', 'Q3', 'median', 'IQR']);
        let ans, clueQ;
        if (choice === 'Q1') { ans = q1; clueQ = 'Find **Q1** (lower quartile)'; }
        else if (choice === 'Q3') { ans = q3; clueQ = 'Find **Q3** (upper quartile)'; }
        else if (choice === 'median') { ans = med; clueQ = 'Find the **median**'; }
        else { ans = iqr; clueQ = 'Find the **interquartile range (IQR)**'; }
        return { clue: `${clueQ} of: $${data.join(', ')}$`, answer: String(ans) };
    }

    if (op === 'bivariate') {
        // Given a line of best fit, predict a value — operand ranges scale with difficulty
        const [mHi, cLo, cHi, xHi] = diff === 'Easy'   ? [3, 0,   8,  6]
                                    : diff === 'Medium'  ? [5, -5, 12, 12]
                                    :                      [8, -10, 20, 20];
        const m = ri(rng, 1, mHi), c = ri(rng, cLo, cHi), x = ri(rng, 2, xHi);
        const y = m * x + c;
        const cStr = c === 0 ? '' : (c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`);
        const ph = rc(rng, [
            `A line of best fit is $y = ${m}x${cStr}$. Predict $y$ when $x = ${x}$.`,
            `The equation of the line of best fit is $y = ${m}x${cStr}$. Find $y$ when $x = ${x}$.`,
            `Using $y = ${m}x${cStr}$, calculate the predicted value of $y$ for $x = ${x}$.`,
        ]);
        return { clue: ph, answer: String(y), answerDisplay: `$y = ${y}$` };
    }
    return null;
}

// ---- Geometry Stage 5 operations ----------------------------
function _genGeometryS5Op(rng, diff, op) {
    if (op === 'surface-area') {
        const [lHi, wHi, hHi] = diff === 'Easy' ? [6, 5, 5] : diff === 'Medium' ? [10, 8, 8] : [15, 12, 10];
        const l = ri(rng, 2, lHi), w = ri(rng, 2, wHi), h = ri(rng, 2, hHi);
        const u = _geoUnit(Math.max(l, w, h));
        const sa = 2 * (l * w + l * h + w * h);
        const ph = rc(rng, [
            `Find the *surface area* of a rectangular prism: length $${l}$ ${u}, width $${w}$ ${u}, height $${h}$ ${u}.`,
            `Calculate the *total surface area* of a rectangular box with dimensions $${l}$ ${u} × $${w}$ ${u} × $${h}$ ${u}.`,
            `A rectangular prism has dimensions $${l}$ ${u} by $${w}$ ${u} by $${h}$ ${u}. Find its surface area.`,
        ]);
        return { clue: ph, answer: String(sa), answerDisplay: `${sa} ${u}²` };
    }

    if (op === 'composite-volume') {
        // Two rectangular prisms joined — larger dimensions at higher difficulty
        const [l1Hi, w1Hi, h1Hi] = diff === 'Easy' ? [6, 5, 4] : diff === 'Medium' ? [10, 8, 6] : [15, 12, 8];
        const l1 = ri(rng, 3, l1Hi), w1 = ri(rng, 2, w1Hi), h1 = ri(rng, 2, h1Hi);
        const l2 = ri(rng, 2, l1), w2 = ri(rng, 2, w1), h2 = ri(rng, 2, Math.max(2, h1 - 1));
        const u = 'm';
        const v = l1 * w1 * h1 + l2 * w2 * h2;
        const ph = rc(rng, [
            `A composite solid consists of two rectangular prisms. Prism A: $${l1}$ m × $${w1}$ m × $${h1}$ m. Prism B: $${l2}$ m × $${w2}$ m × $${h2}$ m. Find the *total volume*.`,
            `Find the *combined volume* of two rectangular prisms: Prism 1 has dimensions $${l1}\\times${w1}\\times${h1}$ m and Prism 2 has dimensions $${l2}\\times${w2}\\times${h2}$ m.`,
        ]);
        return { clue: ph, answer: String(v), answerDisplay: `${v} m³` };
    }

    if (op === 'similar-triangles') {
        // Two similar triangles; find a missing side — scale and side range increase with difficulty
        const [scaleHi, sidesHi] = diff === 'Easy' ? [3, 6] : diff === 'Medium' ? [4, 9] : [6, 14];
        const scale = ri(rng, 2, scaleHi);
        const a = ri(rng, 3, sidesHi), b = ri(rng, 3, sidesHi), c = ri(rng, 3, sidesHi);
        const u = 'cm';
        const ph = rc(rng, [
            `Two similar triangles have corresponding sides. If one triangle has a side of $${a}$ ${u} and the *corresponding* side of the larger triangle is $${a * scale}$ ${u}, find the side corresponding to $${b}$ ${u}.`,
            `A triangle with a side of $${a}$ ${u} is similar to a larger triangle with a corresponding side of $${a * scale}$ ${u}. Find the length of the side that corresponds to $${b}$ ${u}.`,
        ]);
        return { clue: ph, answer: String(b * scale), answerDisplay: `${b * scale} ${u}` };
    }
    return null;
}

// ---- Financial Stage 5 operations ---------------------------
function _genFinancialS5Op(rng, diff, op) {
    if (!op) op = diff === 'Hard' ? 'compound-period' : 'depreciation';

    if (op === 'depreciation') {
        const P = ri(rng, 3, 20) * 1000, r = rc(rng, [5, 10, 15, 20]), t = ri(rng, 1, 3);
        if (diff === 'Easy') {
            // Straight-line: annual loss = P × r%
            const annualLoss = P * r / 100;
            const ph = rc(rng, [
                `A car worth $\\$${P}$ depreciates at $${r}\\%$ per year (straight-line). Find the *annual depreciation*.`,
                `Using straight-line depreciation, find the annual loss on $\\$${P}$ at $${r}\\%$ p.a.`,
            ]);
            return { clue: ph, answer: String(annualLoss), answerDisplay: `$${annualLoss}` };
        }
        // Reducing balance: V = P(1-r/100)^t
        const V = round(P * Math.pow(1 - r / 100, t), 2);
        const ph = rc(rng, [
            `A machine worth $\\$${P}$ depreciates at $${r}\\%$ p.a. (reducing balance). Find its value after $${t}$ year${t > 1 ? 's' : ''}.`,
            `Using $V = P(1 - r)^n$, find the value of $\\$${P}$ after $${t}$ year${t > 1 ? 's' : ''} at $${r}\\%$ p.a. depreciation.`,
        ]);
        return { clue: ph, answer: String(V), answerDisplay: `$${V}` };
    }

    // compound-period: compounding more than once per year
    const [P2Lo, P2Hi, nPerPool, t2Hi] =
        diff === 'Easy'   ? [1, 5,  [2, 4],     1] :
        diff === 'Medium' ? [2, 10, [2, 4, 12], 2] :
                            [5, 20, [4, 12],    3];
    const P2 = ri(rng, P2Lo, P2Hi) * 1000;
    const rAnnual = rc(rng, [6, 8, 12]);
    const nPer = rc(rng, nPerPool);
    const periodLabel = nPer === 2 ? 'half-yearly' : nPer === 4 ? 'quarterly' : 'monthly';
    const t2 = ri(rng, 1, t2Hi);
    const A = round(P2 * Math.pow(1 + rAnnual / 100 / nPer, nPer * t2), 2);
    const ph = rc(rng, [
        `$\\$${P2}$ is invested at $${rAnnual}\\%$ p.a. compounded ${periodLabel} for $${t2}$ year${t2 > 1 ? 's' : ''}. Find the total amount.`,
        `Find the future value of $\\$${P2}$ compounded ${periodLabel} at $${rAnnual}\\%$ p.a. over $${t2}$ year${t2 > 1 ? 's' : ''}.`,
    ]);
    return { clue: ph, answer: String(A), answerDisplay: `$${A}` };
}

// ---- Trigonometry (Stage 5 new topic) -----------------------
const TRIG_TRIPLES = [
    { a: 3, b: 4, c: 5 }, { a: 5, b: 12, c: 13 }, { a: 6, b: 8, c: 10 },
    { a: 8, b: 15, c: 17 }, { a: 9, b: 12, c: 15 }, { a: 7, b: 24, c: 25 },
];

function genTrigonometry(rng, diff, allowedOps) {
    const OPS = ['find-side', 'find-angle', 'applications', 'obtuse-angles', 'bearings'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'find-side') {
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 2) : diff === 'Medium' ? ri(rng, 2, 5) : ri(rng, 3, 8);
        const opp = triple.a * scale, adj = triple.b * scale, hyp = triple.c * scale;
        const u = _geoUnit(hyp);
        const angleA = round(Math.atan2(opp, adj) * 180 / Math.PI, 1);
        const choice = rc(rng, diff === 'Easy' ? ['sin'] : ['sin', 'cos', 'tan']);
        let clue, answer, answerDisplay, diagramAngle, diagramFind;
        if (choice === 'sin') {
            // sin(A) = opp/hyp → find opp given hyp and angle
            const scale2 = ri(rng, 3, 8);
            const hyp2 = triple.c * scale2;
            const opp2 = triple.a * scale2;
            const u2 = _geoUnit(hyp2);
            const angle2 = round(Math.atan2(triple.a, triple.b) * 180 / Math.PI, 1);
            clue = rc(rng, [
                `Find the *opposite* side of a right triangle with hypotenuse $${hyp2}$ ${u2} and angle $${angle2}$°. Use $\\sin(${angle2}°) \\approx ${round(Math.sin(angle2 * Math.PI / 180), 3)}$.`,
                `A right-angled triangle has hypotenuse $${hyp2}$ ${u2} and an angle of $${angle2}$°. Find the *opposite* side. Use $\\sin(${angle2}°) \\approx ${round(Math.sin(angle2 * Math.PI / 180), 3)}$.`,
            ]);
            answer = String(opp2);
            answerDisplay = `${opp2} ${u2}`;
            diagramAngle = angle2; diagramFind = 'opp';
            return { clue, answer, answerDisplay, diagram: { type: 'right-triangle-trig', opp: opp2, adj: triple.b * scale2, hyp: hyp2, angle: angle2, missing: 'opp' } };
        }
        if (choice === 'cos') {
            const scale2 = ri(rng, 3, 8);
            const hyp2 = triple.c * scale2;
            const adj2 = triple.b * scale2;
            const u2 = _geoUnit(hyp2);
            const angle2 = round(Math.atan2(triple.a, triple.b) * 180 / Math.PI, 1);
            clue = rc(rng, [
                `Find the *adjacent* side of a right triangle with hypotenuse $${hyp2}$ ${u2} and angle $${angle2}$°. Use $\\cos(${angle2}°) \\approx ${round(Math.cos(angle2 * Math.PI / 180), 3)}$.`,
            ]);
            answer = String(adj2);
            answerDisplay = `${adj2} ${u2}`;
            return { clue, answer, answerDisplay, diagram: { type: 'right-triangle-trig', opp: triple.a * scale2, adj: adj2, hyp: hyp2, angle: angle2, missing: 'adj' } };
        }
        // tan
        const angle2 = round(Math.atan2(triple.a, triple.b) * 180 / Math.PI, 1);
        const adj2 = adj, opp2 = opp;
        const u2 = _geoUnit(Math.max(opp2, adj2));
        clue = rc(rng, [
            `Find the *opposite* side of a right triangle with adjacent $${adj2}$ ${u2} and angle $${angle2}$°. Use $\\tan(${angle2}°) \\approx ${round(Math.tan(angle2 * Math.PI / 180), 3)}$.`,
        ]);
        return { clue, answer: String(opp2), answerDisplay: `${opp2} ${u2}`, diagram: { type: 'right-triangle-trig', opp: opp2, adj: adj2, hyp: hyp, angle: angle2, missing: 'opp' } };
    }

    if (op === 'find-angle') {
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 2) : diff === 'Medium' ? ri(rng, 2, 4) : ri(rng, 3, 7);
        const opp = triple.a * scale, adj = triple.b * scale, hyp = triple.c * scale;
        const u = _geoUnit(hyp);
        const ratio = rc(rng, ['tan', 'sin', 'cos']);
        let theta;
        if (ratio === 'tan') theta = round(Math.atan2(opp, adj) * 180 / Math.PI, 1);
        else if (ratio === 'sin') theta = round(Math.asin(opp / hyp) * 180 / Math.PI, 1);
        else theta = round(Math.acos(adj / hyp) * 180 / Math.PI, 1);
        const ph = rc(rng, [
            `Find the angle $\\theta$ in a right triangle with opposite $${opp}$ ${u} and adjacent $${adj}$ ${u}.`,
            `Calculate the angle $\\theta$ given opposite $= ${opp}$ ${u} and adjacent $= ${adj}$ ${u} in a right triangle.`,
            `A right triangle has legs $${opp}$ ${u} and $${adj}$ ${u}. Find the smaller angle $\\theta$.`,
        ]);
        return { clue: ph, answer: `${theta}°`, answerDisplay: `$\\theta = ${theta}$°`, diagram: { type: 'right-triangle-trig', opp, adj, hyp, angle: theta, missing: 'angle' } };
    }

    if (op === 'applications') {
        // Real-world: angle of elevation
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 3) : diff === 'Medium' ? ri(rng, 2, 6) : ri(rng, 4, 10);
        const height = triple.a * scale, dist = triple.b * scale;
        const angle = round(Math.atan2(height, dist) * 180 / Math.PI, 1);
        const ph = rc(rng, [
            `A ladder leans against a wall. The base is $${dist}$ m from the wall and the ladder reaches $${height}$ m up the wall. Find the angle the ladder makes with the ground.`,
            `From a point $${dist}$ m away from a building, the *angle of elevation* to the top is measured. If the building is $${height}$ m tall, find the angle of elevation.`,
        ]);
        return { clue: ph, answer: `${angle}°`, answerDisplay: `${angle}°` };
    }

    if (op === 'obtuse-angles') {
        // Sine rule: a/sin A = b/sin B
        const A = rc(rng, [30, 45, 60]), a = ri(rng, 4, 10);
        const B = rc(rng, [20, 35, 50, 120, 135]);
        const b = round(a * Math.sin(B * Math.PI / 180) / Math.sin(A * Math.PI / 180), 1);
        if (b < 1 || b > 30) return null;
        const ph = rc(rng, [
            `In a triangle, $a = ${a}$ cm, $\\angle A = ${A}$° and $\\angle B = ${B}$°. Use the *sine rule* to find side $b$.`,
            `Using the sine rule: $a = ${a}$ cm, $A = ${A}$°, $B = ${B}$°. Find $b$.`,
        ]);
        return { clue: ph, answer: String(b), answerDisplay: `${b} cm` };
    }

    if (op === 'bearings') {
        const dist = ri(rng, 2, 15) * 10;
        const bearing = rc(rng, [30, 45, 60, 120, 150, 210, 240, 300, 315, 330]);
        const radians = bearing * Math.PI / 180;
        const eastward = round(dist * Math.sin(radians), 1);
        const northward = round(dist * Math.cos(radians), 1);
        const ph = `A ship travels $${dist}$ km on a bearing of $${String(bearing).padStart(3,'0')}$°T. How far *east* (or west) of its starting point is it?`;
        const absE = Math.abs(eastward);
        const dir = eastward >= 0 ? 'east' : 'west';
        return { clue: ph, answer: String(absE), answerDisplay: `${absE} km ${dir}` };
    }

    return null;
}

// ---- Non-linear Relationships (Stage 5 new topic) -----------
function genNonLinear(rng, diff, allowedOps) {
    const OPS = ['parabola-features', 'parabola-sketch', 'identify-graph'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'parabola-features') {
        // y = (x - h)² + k → vertex (h, k); avoid h = 0 to keep formatting tidy
        const h = rc(rng, [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6]);
        const k = ri(rng, -4, 6);
        const xPart = `(x ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})`;
        const kPart = k === 0 ? '' : (k > 0 ? ` + ${k}` : ` - ${Math.abs(k)}`);
        const eq = `${xPart}^2${kPart}`;
        if (diff === 'Easy') {
            const ph = rc(rng, [
                `State the *vertex* of the parabola $y = ${eq}$.`,
                `Find the *vertex* of $y = ${eq}$.`,
                `What is the *turning point* of $y = ${eq}$?`,
            ]);
            return { clue: ph, answer: `(${h},${k})`, answerDisplay: `$(${h}, ${k})$`, diagram: { type: 'parabola', h, k, a: 1 } };
        }
        if (diff === 'Medium') {
            const ph = `State the *axis of symmetry* of $y = ${eq}$.`;
            return { clue: ph, answer: `x=${h}`, answerDisplay: `$x = ${h}$`, diagram: { type: 'parabola', h, k, a: 1 } };
        }
        // Hard: expanded form → find axis of symmetry using x = -b/2a
        const b = -2 * h, c = h * h + k;
        const bStr = b > 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
        const cStr = c === 0 ? '' : (c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`);
        const ph = `Find the *axis of symmetry* of $y = x^2 ${bStr}${cStr}$ using $x = -\\dfrac{b}{2a}$.`;
        return { clue: ph, answer: `x=${h}`, answerDisplay: `$x = ${h}$` };
    }

    if (op === 'parabola-sketch') {
        const aPool = diff === 'Easy' ? [1, -1] : diff === 'Medium' ? [1, -1, 2, -2] : [2, -2, 3, -3];
        const hPool = diff === 'Easy' ? [-2, -1, 1, 2] : [-4, -3, -2, -1, 1, 2, 3, 4];
        const [kLo, kHi] = diff === 'Easy' ? [-2, 4] : [-5, 5];
        const a = rc(rng, aPool);
        const h2 = rc(rng, hPool);
        const k2 = ri(rng, kLo, kHi);
        const opens = a > 0 ? 'upward' : 'downward';
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const xPart = `(x ${h2 > 0 ? `- ${h2}` : `+ ${Math.abs(h2)}`})`;
        const kPart = k2 === 0 ? '' : (k2 > 0 ? ` + ${k2}` : ` - ${Math.abs(k2)}`);
        const eq = `${aStr}${xPart}^2${kPart}`;
        const ph = diff === 'Hard'
            ? rc(rng, [
                `For $y = ${eq}$, state the vertex, direction it opens, and $y$-intercept.`,
                `Describe the key features of $y = ${eq}$: vertex, direction, and $y$-intercept.`,
              ])
            : `For $y = ${eq}$, state the vertex and direction it opens.`;
        const yIntercept = a * h2 * h2 + k2;
        const answerDisplay = diff === 'Hard'
            ? `Vertex $(${h2}, ${k2})$, opens ${opens}, $y$-int $= ${yIntercept}$`
            : `Vertex $(${h2}, ${k2})$, opens ${opens}`;
        const answer = diff === 'Hard'
            ? `(${h2},${k2})${opens[0].toUpperCase()}y=${yIntercept}`
            : `(${h2},${k2})${opens[0].toUpperCase()}`;
        return { clue: ph, answer, answerDisplay, diagram: { type: 'parabola', h: h2, k: k2, a } };
    }

    if (op === 'identify-graph') {
        const graphs = [
            { eq: 'y = x^2', type: 'parabola' },
            { eq: 'y = 2^x', type: 'exponential' },
            { eq: 'xy = 4', type: 'hyperbola' },
            { eq: 'y = -x^2', type: 'parabola' },
            { eq: 'y = 3^x', type: 'exponential' },
            { eq: 'y = x^2 - 4', type: 'parabola' },
            { eq: 'y = 5^x', type: 'exponential' },
            { eq: 'xy = -3', type: 'hyperbola' },
            { eq: 'y = 2^{-x}', type: 'exponential' },
            { eq: 'y = (x+1)^2', type: 'parabola' },
            { eq: 'xy = 6', type: 'hyperbola' },
            { eq: 'y = -2^x', type: 'exponential' },
        ];
        const g = rc(rng, graphs);
        const ph = rc(rng, [
            `Identify the type of graph represented by $${g.eq}$.`,
            `What type of curve does $${g.eq}$ represent?`,
            `Name the graph: $${g.eq}$.`,
            `Classify the relationship: $${g.eq}$.`,
        ]);
        return { clue: ph, answer: g.type, answerDisplay: g.type };
    }

    return null;
}

// ---- Stage 5 wrappers for existing generators ---------------
// Each public function delegates S5-only ops to the Stage 5 helper,
// falling back to the original Stage 4 core for S4 ops.
function genAlgebra(rng, diff, allowedOps, opts = {}) {
    const S5_KEYS = ['expand', 'factorise', 'quadratic-solve', 'indices-laws', 'simultaneous', 'surds-simplify', 'surds-operate'];
    const s5Active = S5_KEYS.filter(k => allowedOps && allowedOps.includes(k));
    const s4Active = ['solve', 'substitution'].filter(k => !allowedOps || allowedOps.includes(k));
    if (s5Active.length > 0 && (!s4Active.length || rng() < 0.5)) {
        return _genAlgebraOp(rng, diff, rc(rng, s5Active));
    }
    return _genAlgebraCore(rng, diff, allowedOps, opts);
}

function genStatistics(rng, diff, allowedOps, opts = {}, _depth = 0) {
    const S5_KEYS = ['five-number-summary', 'bivariate'];
    const s5Active = S5_KEYS.filter(k => allowedOps && allowedOps.includes(k));
    const s4Active = ['mean-median', 'mode-range', 'iqr'].filter(k => !allowedOps || allowedOps.includes(k));
    if (s5Active.length > 0 && (!s4Active.length || rng() < 0.5)) {
        return _genStatisticsS5Op(rng, diff, rc(rng, s5Active));
    }
    return _genStatisticsCore(rng, diff, allowedOps, _depth);
}

function genGeometry(rng, diff, allowedOps, opts = {}, _depth = 0) {
    const S5_KEYS = ['surface-area', 'composite-volume', 'similar-triangles'];
    const s5Active = S5_KEYS.filter(k => allowedOps && allowedOps.includes(k));
    const s4Active = ['area-perimeter', 'pythagoras', 'angles', 'circles'].filter(k => !allowedOps || allowedOps.includes(k));
    if (s5Active.length > 0 && (!s4Active.length || rng() < 0.5)) {
        return _genGeometryS5Op(rng, diff, rc(rng, s5Active));
    }
    return _genGeometryCore(rng, diff, allowedOps, opts, _depth);
}

function genFinancial(rng, diff, allowedOps, opts = {}, _depth = 0) {
    const S5_KEYS = ['depreciation', 'compound-period'];
    const s5Active = S5_KEYS.filter(k => allowedOps && allowedOps.includes(k));
    const s4Active = ['simple-interest', 'compound-interest', 'markup-profit', 'gst'].filter(k => !allowedOps || allowedOps.includes(k));
    if (s5Active.length > 0 && (!s4Active.length || rng() < 0.5)) {
        return _genFinancialS5Op(rng, diff, rc(rng, s5Active));
    }
    return _genFinancialCore(rng, diff, allowedOps, opts, _depth);
}

// ============================================================
// DISPATCH table
// ============================================================
const GENERATORS = {
    'Integers':                 genIntegers,
    'Decimals':                 genDecimals,
    'Rounding':                 genRounding,
    'Fractions':                genFractions,
    'Percentages':              genPercentages,
    'Algebra':                  genAlgebra,
    'Geometry':                 genGeometry,
    'Statistics':               genStatistics,
    'Financial Maths':          genFinancial,
    'Trigonometry':             genTrigonometry,
    'Non-linear Relationships': genNonLinear,
};

// Map generator sub-topic → clue bank topic field
const TOPIC_MAP = {
    'Integers':                 'Number',
    'Decimals':                 'Number',
    'Rounding':                 'Number',
    'Fractions':                'Number',
    'Percentages':              'Number',
    'Algebra':                  'Algebra',
    'Geometry':                 'Geometry',
    'Statistics':               'Statistics',
    'Financial Maths':          'Financial Maths',
    'Trigonometry':             'Trigonometry',
    'Non-linear Relationships': 'Algebra',
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
 * @param {string}  [opts.stage]     - 'Stage 4' | 'Stage 5' (default 'Stage 4')
 * @param {boolean} [opts.includePath] - include Stage 5.3 Path ops (default false)
 * @returns {Array} clue bank items
 */
export function generateMathsQuestions({ subTopic = 'All', subTopics = null, subOpsFilter = null, difficulty = 'All', count = 10, seed, showFormulas, stage = 'Stage 4', includePath = false } = {}) {
    const rng = mulberry32(seed != null ? seed : Date.now());

    // subTopics array takes priority over subTopic string
    let subtopics;
    if (subTopics && subTopics.length > 0) {
        subtopics = subTopics.filter(t => GENERATORS[t]);
        if (subtopics.length === 0) subtopics = ALL_SUBTOPICS;
    } else {
        subtopics = subTopic === 'All' ? ALL_SUBTOPICS : [subTopic];
    }

    // Filter to topics that have at least one op available for the current stage
    subtopics = subtopics.filter(t => {
        const ops = SUB_OPS[t];
        if (!ops) return false;
        return ops.some(op =>
            (!op.stages || op.stages.includes(stage)) &&
            (op.pathway !== 'path' || includePath)
        );
    });

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

        // Compute stage-allowed keys for this topic
        const stageAllowedKeys = (SUB_OPS[st] || [])
            .filter(op =>
                (!op.stages || op.stages.includes(stage)) &&
                (op.pathway !== 'path' || includePath)
            )
            .map(op => op.key);

        // Intersect with user's sub-op filter if present.
        // Always pass an explicit list (never null) so wrappers don't
        // mis-detect "no filter" as "S4-only" for Stage 5 topics.
        const userFilter = subOpsFilter?.[st] || null;
        const allowedOps = userFilter
            ? userFilter.filter(k => stageAllowedKeys.includes(k))
            : stageAllowedKeys;
        if (allowedOps.length === 0) continue;

        let q;
        try { q = gen(rng, diff, allowedOps, { showFormulas, stage, includePath }); } catch (e) { console.error(e); continue; }
        if (!q) continue;

        const ans = String(q.answer);
        // Skip empty, over-length, or numerically invalid answers (limit raised to 20 for algebraic/Stage 5 answers)
        if (!ans || ans.length > 20 || ans === 'NaN' || ans === 'Infinity' || ans === '-Infinity') continue;

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
