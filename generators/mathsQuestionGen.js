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
const DATA_CONTEXTS = ['scores', 'values', 'ages', 'heights (cm)', 'temperatures (°C)', 'distances (m)', 'results', 'times (s)'];

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
        { key: 'surface-area',      label: 'Surface area' },
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
    'Probability': [
        { key: 'theoretical',   label: 'Theoretical probability' },
        { key: 'complementary', label: 'Complementary events' },
        { key: 'multi-event',   label: 'Multi-event / Mutually exclusive' },
    ],
    'Ratios & Rates': [
        { key: 'simplify',     label: 'Simplify a ratio' },
        { key: 'divide-ratio', label: 'Divide in a ratio' },
        { key: 'equivalent',   label: 'Equivalent ratios' },
        { key: 'unit-rate',    label: 'Unit rate' },
        { key: 'speed',        label: 'Speed / Distance / Time' },
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
    let pool = diff === 'Easy' ? ['+', '-', '×'] : ['+', '-', '×', '÷', 'bodmas'];
    if (allowedOps) pool = pool.filter(op => allowedOps.includes(OP_MAP[op]));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === '+') {
        // Medium/Hard: 40% chance of a negative-integer variant
        if (diff !== 'Easy' && rng() < 0.4) {
            const lim = diff === 'Medium' ? 40 : 150;
            const a = ri(rng, 2, lim), b = ri(rng, 2, lim);
            const negA = rng() < 0.5;
            const [aa, bb] = negA ? [-a, b] : [a, -b];
            const expr = negA ? `${aa} + ${bb}` : `${aa} + (${bb})`;
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${expr}$`,
                `What is $${expr}$?`,
                `Find the value of $${expr}$`,
            ]);
            return { clue, answer: String(aa + bb) };
        }
        // Easy: 25% chance of simple negative-integer addition (e.g. −3 + 7, 5 + (−2))
        if (diff === 'Easy' && rng() < 0.25) {
            const a = ri(rng, 1, 12), b = ri(rng, 1, 12);
            const negA = rng() < 0.5;
            const [aa, bb] = negA ? [-a, b] : [a, -b];
            const expr = negA ? `${aa} + ${bb}` : `${aa} + (${bb})`;
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${expr}$`,
                `What is $${expr}$?`,
                `Find the value of $${expr}$`,
            ]);
            return { clue, answer: String(aa + bb) };
        }
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, max);
        // Easy: 30% chance of a real-world context
        if (diff === 'Easy' && rng() < 0.3) {
            const ctx = rc(rng, [
                { stem: `A shop has $${a}$ apples and receives $${b}$ more. How many apples are there in total?`, ans: a + b },
                { stem: `A student scores $${a}$ points on Monday and $${b}$ points on Tuesday. What is the total score?`, ans: a + b },
                { stem: `There are $${a}$ students in class A and $${b}$ students in class B. How many students altogether?`, ans: a + b },
            ]);
            return { clue: ctx.stem, answer: String(ctx.ans) };
        }
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
        // Medium/Hard: 40% chance of a negative-integer variant
        if (diff !== 'Easy' && rng() < 0.4) {
            const lim = diff === 'Medium' ? 40 : 150;
            const a = ri(rng, 2, lim), b = ri(rng, 2, lim);
            const form = ri(rng, 0, 1);
            if (form === 0) {
                // subtracting a negative: a − (−b) = a + b
                const clue = rc(rng, [
                    `${rc(rng, CALC_VERBS)} $${a} - (-${b})$`,
                    `What is $${a} - (-${b})$?`,
                    `Subtract $-${b}$ from $${a}$`,
                ]);
                return { clue, answer: String(a + b) };
            }
            // negative − positive: −a − b
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $-${a} - ${b}$`,
                `What is $-${a} - ${b}$?`,
                `Find $-${a} - ${b}$`,
            ]);
            return { clue, answer: String(-a - b) };
        }
        // Easy: 20% chance of crossing zero (answer is negative) — introduces negatives gently
        if (diff === 'Easy' && rng() < 0.2) {
            const a2 = ri(rng, 1, 9), b2 = ri(rng, a2 + 1, a2 + 10);
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a2} - ${b2}$`,
                `What is $${a2} - ${b2}$?`,
                `Subtract $${b2}$ from $${a2}$`,
            ]);
            return { clue, answer: String(a2 - b2) };
        }
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, a);
        if (diff === 'Easy' && rng() < 0.25) {
            const ctx = rc(rng, [
                { stem: `A baker has $${a}$ buns and sells $${b}$. How many buns remain?`, ans: a - b },
                { stem: `A class has $${a}$ students. $${b}$ are absent. How many are present?`, ans: a - b },
                { stem: `A farmer has $${a}$ eggs. $${b}$ are sold. How many are left?`, ans: a - b },
            ]);
            return { clue: ctx.stem, answer: String(ctx.ans) };
        }
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
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        // Medium/Hard: 40% chance of negative operand(s)
        if (diff !== 'Easy' && rng() < 0.4) {
            const negForm = diff === 'Hard' ? ri(rng, 0, 2) : ri(rng, 0, 1);
            if (negForm === 0) {
                const clue = rc(rng, [
                    `${rc(rng, MULT_VERBS)} $(-${a}) \\times ${b}$`,
                    `Multiply $-${a}$ by $${b}$`,
                    `What is $(-${a}) \\times ${b}$?`,
                ]);
                return { clue, answer: String(-a * b) };
            }
            if (negForm === 1) {
                const clue = rc(rng, [
                    `${rc(rng, MULT_VERBS)} $${a} \\times (-${b})$`,
                    `Multiply $${a}$ by $-${b}$`,
                    `What is $${a} \\times (-${b})$?`,
                ]);
                return { clue, answer: String(-a * b) };
            }
            // Hard only: negative × negative
            const clue = rc(rng, [
                `${rc(rng, MULT_VERBS)} $(-${a}) \\times (-${b})$`,
                `What is $(-${a}) \\times (-${b})$?`,
            ]);
            return { clue, answer: String(a * b) };
        }
        // Easy: 20% chance of negative × positive (e.g. (−3) × 4)
        if (diff === 'Easy' && rng() < 0.2) {
            const clue = rc(rng, [
                `${rc(rng, MULT_VERBS)} $(-${a}) \\times ${b}$`,
                `Multiply $-${a}$ by $${b}$`,
                `What is $(-${a}) \\times ${b}$?`,
            ]);
            return { clue, answer: String(-a * b) };
        }
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
        // Medium/Hard: 40% chance of negative dividend
        if (diff !== 'Easy' && rng() < 0.4) {
            const dividend = -(b * ans);
            const clue = rc(rng, [
                `${rc(rng, DIV_VERBS)} $${dividend} \\div ${b}$`,
                `Divide $${dividend}$ by $${b}$`,
                `What is $${dividend}$ divided by $${b}$?`,
            ]);
            return { clue, answer: String(-ans) };
        }
        const clue = rc(rng, [
            `${rc(rng, DIV_VERBS)} $${b * ans} \\div ${b}$`,
            `Divide $${b * ans}$ by $${b}$`,
            `What is $${b * ans}$ divided by $${b}$?`,
            `Find the *quotient* of $${b * ans}$ and $${b}$`,
        ]);
        return { clue, answer: String(ans) };
    }
    if (op === 'bodmas') {
        const verb = rc(rng, BODMAS_VERBS);
        // Medium: forms 0–4 (mixed ops and brackets, no exponents — Stage 4 core)
        // Hard: forms 0–10 (all including exponents and nested brackets)
        const maxForm = diff === 'Medium' ? 4 : 10;
        const form = ri(rng, 0, maxForm);

        if (form === 0) {
            const a = ri(rng, 3, 25), b = ri(rng, 3, 15), c = ri(rng, 3, 15);
            return { clue: `${verb}\n$${a} + ${b} \\times ${c}$`, answer: String(a + b * c) };
        }
        if (form === 1) {
            const a = ri(rng, 2, 15), b = ri(rng, 2, 15), c = ri(rng, 3, 12);
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
        if (form === 4) {
            const a = ri(rng, 3, 20), b = ri(rng, 2, 10), c = ri(rng, 2, 8);
            return { clue: `${verb}\n$${a} - ${b} \\times ${c}$`, answer: String(a - b * c) };
        }
        // Hard-only forms — exponents and nested brackets
        if (form === 5) {
            // a^n + b  (n = 2 or 3)
            const base = ri(rng, 2, 7), exp = ri(rng, 2, 3), add = ri(rng, 2, 20);
            return { clue: `${verb}\n$${base}^{${exp}} + ${add}$`, answer: String(base ** exp + add) };
        }
        if (form === 6) {
            // (a + b)^2
            const a = ri(rng, 2, 8), b = ri(rng, 2, 8);
            return { clue: `${verb}\n$(${a} + ${b})^2$`, answer: String((a + b) ** 2) };
        }
        if (form === 7) {
            // (a − b)^2
            const b = ri(rng, 1, 7), a = ri(rng, b + 1, b + 8);
            return { clue: `${verb}\n$(${a} - ${b})^2$`, answer: String((a - b) ** 2) };
        }
        if (form === 8) {
            // a^2 + b × c
            const a = ri(rng, 2, 9), b = ri(rng, 2, 8), c = ri(rng, 2, 7);
            return { clue: `${verb}\n$${a}^2 + ${b} \\times ${c}$`, answer: String(a ** 2 + b * c) };
        }
        if (form === 9) {
            // a × (b^2 − c)  where b^2 > c
            const b = ri(rng, 3, 7), c = ri(rng, 1, b * b - 2), a = ri(rng, 2, 8);
            return { clue: `${verb}\n$${a} \\times (${b}^2 - ${c})$`, answer: String(a * (b ** 2 - c)) };
        }
        // form === 10: (a + b)^2 − c × d
        const a = ri(rng, 2, 6), b = ri(rng, 2, 6), c = ri(rng, 2, 5), d = ri(rng, 2, 5);
        return { clue: `${verb}\n$(${a} + ${b})^2 - ${c} \\times ${d}$`, answer: String((a + b) ** 2 - c * d) };
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

    if (diff === 'Easy') {
        if (type === 0) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 1, 9) / 10;
            const ans = round(a + b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `Sarah runs $${a}$ km on Monday and $${b}$ km on Tuesday. How far did she run in total?`,
                    `A jug holds $${a}$ L of water. $${b}$ L more is added. How much water is in the jug?`,
                    `Tom spends $\\$${a}$ on a snack and $\\$${b}$ on a drink. How much did he spend altogether?`,
                ]);
                return { clue: ctx, answer: String(ans) };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        const a = ri(rng, 1, 9) / 10, b = ri(rng, 2, 9);
        const ans = round(a * b, 2);
        if (rng() < 0.25) {
            const ctx = rc(rng, [
                `A bottle holds $${a}$ L. How much do $${b}$ bottles hold?`,
                `One ribbon is $${a}$ m long. What is the total length of $${b}$ ribbons?`,
                `A snack costs $\\$${a}$. Find the cost of $${b}$ snacks.`,
            ]);
            return { clue: ctx, answer: String(ans) };
        }
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `Find the product of $${a}$ and $${b}$`,
            `What is $${a} \\times ${b}$?`,
        ]);
        return { clue: ph, answer: String(ans) };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
            const ans = round(a + b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A recipe needs $${a}$ kg of flour and $${b}$ kg of sugar. What is the total mass of ingredients?`,
                    `On Monday a shop sold $${a}$ kg of cheese and on Tuesday $${b}$ kg. Find the total sales.`,
                    `Two lengths of timber measure $${a}$ m and $${b}$ m. What is their combined length?`,
                ]);
                return { clue: ctx, answer: String(ans) };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        if (type === 1) {
            const a = ri(rng, 20, 99) / 10, b = ri(rng, 1, Math.floor(a * 10) - 1) / 10;
            const bR = round(b, 1);
            const ans = round(a - b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A water tank holds $${a}$ L. $${bR}$ L is used. How much remains?`,
                    `A plank is $${a}$ m long. A piece of $${bR}$ m is cut off. What length is left?`,
                    `A bag weighs $${a}$ kg. After removing $${bR}$ kg of contents, what is the new mass?`,
                ]);
                return { clue: ctx, answer: String(ans) };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} - ${bR}$`,
                `Subtract $${bR}$ from $${a}$`,
                `Find the difference of $${a}$ and $${bR}$`,
                `What is $${a} - ${bR}$?`,
            ]);
            return { clue: ph, answer: String(ans) };
        }
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `Find the product of $${a}$ and $${b}$`,
            `What is $${a} \\times ${b}$?`,
        ]);
        return { clue: ph, answer: String(round(a * b, 2)) };
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
    const a = ri(rng, 101, 999) / 100, b = ri(rng, 100, Math.floor(a * 100) - 1) / 100;
    const ph = rc(rng, [
        `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
        `Subtract $${b}$ from $${a}$`,
        `Find the difference of $${a}$ and $${b}$`,
        `What is $${a} - ${b}$?`,
    ]);
    return { clue: ph, answer: String(round(a - b, 2)) };
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
            // 30% chance real-world context
            if (rng() < 0.3) {
                const ctx = rc(rng, [
                    `A car park has $${n}$ spaces. Round this to the nearest $10$.`,
                    `A school has $${n}$ students. Round to the nearest $10$.`,
                    `A town has a population of $${n}$. Round to the nearest $10$.`,
                ]);
                return { clue: ctx, answer: String(ans) };
            }
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
            `Round $${n}$ to the nearest *whole number*`,
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
                `Round $${display}$ to *1 decimal place*`,
                `Write $${display}$ correct to *1 decimal place*`,
                `Express $${display}$ to *1 decimal place*`,
            ]);
            return { clue: ph, answer: String(round(n, 1)) };
        }
        const n = ri(rng, 1000, 99999) / 1000;
        const display = n.toFixed(3);
        const ph = rc(rng, [
            `Round $${display}$ to *2 decimal places*`,
            `Write $${display}$ correct to *2 decimal places*`,
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
    const orderAbove = Math.pow(10, Math.floor(Math.log10(n)) + 1);
    const edgeNote = ans >= orderAbove ? ' *Note: trailing zeros are not significant.*' : '';
    const ph = rc(rng, [
        `Round $${n}$ to ${sfLabel}${edgeNote}`,
        `Write $${n}$ correct to ${sfLabel}${edgeNote}`,
        `Express $${n}$ to ${sfLabel}${edgeNote}`,
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
            // 35% chance real-world context
            if (rng() < 0.35) {
                const ctx = rc(rng, [
                    `A class has $${whole}$ students. $\\frac{${num}}{${den}}$ of them play sport. How many students play sport?`,
                    `There are $${whole}$ lollies in a bag. Tom eats $\\frac{${num}}{${den}}$ of them. How many did Tom eat?`,
                    `A pizza was cut into $${den}$ equal slices. If $${num}$ slice${num > 1 ? 's were' : ' was'} eaten, how many pieces of a $${whole}$-slice order is that?`,
                    `A farm has $${whole}$ animals. $\\frac{${num}}{${den}}$ are cows. How many cows are there?`,
                ]);
                return { clue: ctx, answer: String(ans) };
            }
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
            const { n: sn1, d: sd1 } = simplify(n1 + n2, den);
            const ans = sd1 === 1 ? String(sn1) : `$\\frac{${sn1}}{${sd1}}$`;
            const inlineAns1 = sd1 === 1 ? String(sn1) : `\\frac{${sn1}}{${sd1}}`;
            const worked = `$\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}} = \\frac{${n1+n2}}{${den}} = ${inlineAns1}$`;
            return { clue: `${calcVerb} $\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}}$`, answer: ans, worked };
        }
        const den = rc(rng, [4, 6, 8, 10, 12]);
        const factor = rc(rng, [2, 3]);
        if (factor >= den) return genFractions(rng, diff, allowedOps, _depth + 1);
        const num = factor * ri(rng, 1, Math.floor(den / factor));
        const ans = fracStr(num, den);
        const ph = rc(rng, [
            `Simplify $\\frac{${num}}{${den}}$`,
            `Write $\\frac{${num}}{${den}}$ in its *simplest form*`,
            `Express $\\frac{${num}}{${den}}$ in *lowest terms*`,
            `Reduce $\\frac{${num}}{${den}}$ to its *simplest form*`,
        ]);
        return { clue: ph, answer: ans };
    }

    if (diff === 'Medium') {
        if (type === 0) {
            const d1 = rc(rng, [2, 3, 4, 5]), d2 = rc(rng, [3, 4, 5, 6]);
            const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
            const l = lcm(d1, d2);
            const e1 = n1 * (l / d1), e2 = n2 * (l / d2);
            const { n: sn2, d: sd2 } = simplify(e1 + e2, l);
            const ans = sd2 === 1 ? String(sn2) : `$\\frac{${sn2}}{${sd2}}$`;
            const inlineAns2 = sd2 === 1 ? String(sn2) : `\\frac{${sn2}}{${sd2}}`;
            const worked = `LCD $= ${l}$: $\\frac{${e1}}{${l}} + \\frac{${e2}}{${l}} = \\frac{${e1+e2}}{${l}} = ${inlineAns2}$`;
            return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}$`, answer: ans, worked };
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

    // Hard
    if (type === 0) {
        const d1 = ri(rng, 3, 8), n1 = ri(rng, 1, d1 - 1);
        const d2 = ri(rng, 3, 8), n2 = ri(rng, 1, d2 - 1);
        const ans = fracStr(n1 * d2, d1 * n2);
        const ph = rc(rng, [
            `${calcVerb} $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$`,
            `Divide $\\frac{${n1}}{${d1}}$ by $\\frac{${n2}}{${d2}}$`,
            `Find the quotient of $\\frac{${n1}}{${d1}}$ and $\\frac{${n2}}{${d2}}$`,
            `What is $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$?`,
        ]);
        return { clue: ph, answer: ans };
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
            `A discount of $${pct}\\%$ is applied to $\\$${whole}$. Find the discount amount.`,
            `$${pct}\\%$ of a class of $${whole}$ students passed. How many students passed?`,
        ]);
        const worked = `$\\frac{${pct}}{100} \\times ${whole} = ${ans}$`;
        return { clue: ph, answer: String(ans), answerDisplay: String(ans), worked };
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
                    const worked = `$${pct}\\% \\times ${whole} = \\frac{${pct}}{100} \\times ${whole} = ${ans}$`;
                    return { clue: ph, answer: String(ans), worked };
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
                `A ${ctx} of $${orig}$ is increased by $${pct}\\%$. Find the **new** ${ctx}.`,
                `Calculate the result of increasing $${orig}$ by $${pct}\\%$`,
                `A price of $\\$${orig}$ increases by $${pct}\\%$. Find the **new** price.`,
                `A score of $${orig}$ is raised by $${pct}\\%$. What is the **new** score?`,
            ]);
            const multiplier = 1 + pct / 100;
            const worked = `$${orig} \\times ${multiplier} = ${ans}$`;
            return { clue: ph, answer: String(ans), worked };
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
        Easy: { 'solve': [0, 1] },
        Medium: { 'solve': [0, 1], 'substitution': [2] },
        Hard: { 'solve': [0, 2], 'substitution': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : 2);
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
            const worked = `$${a}${v} = ${a * ans + b} - ${b} = ${a * ans}$, so $${v} = ${ans}$`;
            return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${a * ans + b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked };
        }
        if (type === 1) {
            const a = ri(rng, 2, 6), ans = ri(rng, 2, 10), b = ri(rng, 1, 10);
            const worked = `$${a}${v} = ${a * ans - b} + ${b} = ${a * ans}$, so $${v} = ${ans}$`;
            return { clue: `${solveVerb}\n$${a}${v} - ${b} = ${a * ans - b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked };
        }
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
        Easy: { 'mean-median': [0, 1] },
        Medium: { 'mode-range': [0, 1], 'mean-median': [2] },
        Hard: { 'iqr': [0], 'mean-median': [1] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 1 : diff === 'Medium' ? 2 : 1);
    if (type === -1) return null;

    const ctx = rc(rng, DATA_CONTEXTS);
    if (diff === 'Easy') {
        if (type === 0) {
            const n = ri(rng, 3, 5);
            const data = Array.from({ length: n }, () => ri(rng, 1, 20));
            const sum = data.reduce((a, b) => a + b, 0);
            if (sum % n !== 0) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
            const ph = rc(rng, [
                `Find the *mean* of: $${data.join(', ')}$`,
                `Calculate the *mean* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *mean* of: $${data.join(', ')}$`,
                `What is the *mean* of $${data.join(', ')}$?`,
                `The ${ctx} recorded are $${data.join(', ')}$. Find the *mean*.`,
            ]);
            return { clue: ph, answer: String(sum / n) };
        }
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
        const n = ri(rng, 4, 6);
        const data = Array.from({ length: n }, () => ri(rng, 5, 30));
        const sum = data.reduce((a, b) => a + b, 0);
        if (sum % n !== 0) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Calculate the *mean* of: $${data.join(', ')}$`,
            `Find the *mean* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *mean* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Calculate the *mean*.`,
        ]);
        return { clue: ph, answer: String(sum / n) };
    }
    // Hard
    if (type === 0) {
        const data = Array.from({ length: 8 }, () => ri(rng, 1, 20)).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        const iqr = q3 - q1;
        if (!Number.isInteger(iqr)) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `Find the *interquartile range* of: $${data.join(', ')}$`,
            `Calculate the *IQR* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *interquartile range* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Find the *IQR*.`,
        ]);
        return { clue: ph, answer: String(iqr) };
    }
    const n = rc(rng, [4, 6]);
    const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
    const med = (data[n / 2 - 1] + data[n / 2]) / 2;
    if (!Number.isInteger(med)) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1);
    const ph = rc(rng, [
        `Find the *median* of: $${data.join(', ')}$`,
        `Calculate the *median* of these ${ctx}: $${data.join(', ')}$`,
        `Determine the *median* of: $${data.join(', ')}$`,
        `The ${ctx} are $${data.join(', ')}$. Find the *median*.`,
    ]);
    return { clue: ph, answer: String(med) };
}

// ============================================================
// FINANCIAL MATHS (Stage 4 core)
// ============================================================
function _genFinancialCore(rng, diff, allowedOps, opts = {}, _depth = 0) {
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
                `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
                `Find the *simple interest* earned on $\\$${P}$ invested at $${r}\\%$ per year for ${yrs}.${pf}`,
                `Determine the interest on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
            ]);
            const worked = `$I = Prn = ${P} \\times \\frac{${r}}{100} \\times ${t} = \\$${I}$`;
            return { clue: ph, answer: String(I), answerDisplay: `$${I}`, worked };
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
            if (!Number.isInteger(sell)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
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
            `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for $${t}$ years.${pf}`,
            `Find the *simple interest* earned on a $\\$${P}$ investment at $${r}\\%$ p.a. over $${t}$ years.${pf}`,
            `Determine the interest on $\\$${P}$ at $${r}\\%$ per annum for $${t}$ years.${pf}`,
        ]);
        const workedSI = `$I = Prn = ${P} \\times \\frac{${r}}{100} \\times ${t} = \\$${I}$`;
        return { clue: ph, answer: String(I), answerDisplay: `$${I}`, worked: workedSI };
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
        Easy:   { 'area-perimeter': [0, 1], 'angles': [2] },
        Medium: { 'area-perimeter': [0], 'pythagoras': [1], 'angles': [2, 3, 4] },
        Hard:   { 'circles': [0, 2], 'pythagoras': [1], 'angles': [3, 4] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    // Medium covers types 0–4 (area, pythag, triangle-angle, co-interior, corresponding/alternate);
    // without max=4 the corresponding/alternate path was unreachable for users without a sub-op filter.
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : 4);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const shapeForm = ri(rng, 0, 2); // 0=rectangle, 1=parallelogram, 2=trapezium
            const u = diff === 'Easy' ? 'cm' : rc(rng, ['cm', 'm']);
            if (shapeForm === 1) {
                // Parallelogram: area = base × height
                const base = ri(rng, 3, 12), height = ri(rng, 2, 8);
                const ans = base * height;
                const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
                const pf = fOn ? ' Use $A = b \\times h$.' : '';
                const ph = rc(rng, [
                    `Find the *area* of a parallelogram with base $${base}$ ${u} and perpendicular height $${height}$ ${u}.${pf}`,
                    `A parallelogram has base $${base}$ ${u} and height $${height}$ ${u}. Find its area.${pf}`,
                    `Calculate the *area* of a parallelogram: base $${base}$ ${u}, height $${height}$ ${u}.${pf}`,
                ]);
                return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, unit: `${u}²`, diagram: { type: 'parallelogram', base, height, missing: 'area' } };
            }
            if (shapeForm === 2) {
                // Trapezium: area = (a + b) × h / 2
                const a = ri(rng, 2, 8) * 2, bTrap = ri(rng, a / 2 + 2, a + 6), height = ri(rng, 2, 8);
                const ans = ((a + bTrap) * height) / 2;
                if (!Number.isInteger(ans)) return _genGeometryCore(rng, diff, allowedOps, opts, _depth + 1);
                const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
                const pf = fOn ? ' Use $A = \\frac{1}{2} \\times (a+b) \\times h$.' : '';
                const ph = rc(rng, [
                    `Find the *area* of a trapezium with parallel sides $${a}$ ${u} and $${bTrap}$ ${u}, and height $${height}$ ${u}.${pf}`,
                    `A trapezium has parallel sides of $${a}$ ${u} and $${bTrap}$ ${u} with a perpendicular height of $${height}$ ${u}. Find its area.${pf}`,
                    `Calculate the *area* of a trapezium: parallel sides $${a}$ ${u} and $${bTrap}$ ${u}, height $${height}$ ${u}.${pf}`,
                ]);
                const diagA = Math.min(a, bTrap), diagB = Math.max(a, bTrap);
                return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, unit: `${u}²`, diagram: { type: 'trapezium', a: diagA, b: diagB, height, missing: 'area' } };
            }
            // shapeForm === 0: rectangle
            const l = ri(rng, 2, 15), w = ri(rng, 2, 12);
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = l \\times w$.' : '';
            const ph = rc(rng, [
                `Find the *area* of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
                `Calculate the *area* of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
                `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its area.${pf}`,
                `What is the *area* of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
            ]);
            return { clue: ph, answer: String(l * w), answerDisplay: `${l * w} ${u}²`, unit: `${u}²`, diagram: { type: 'rectangle', l, w, missing: 'area' } };
        }
        if (type === 2) {
            // angles on a straight line / vertically opposite
            const a = ri(rng, 25, 155);
            const form = ri(rng, 0, 1);
            if (form === 0) {
                const x = 180 - a;
                const ph = rc(rng, [
                    `Two angles on a straight line. One angle is $${a}$°. Find the other angle.`,
                    `Angles on a straight line sum to 180°. If one angle is $${a}$°, find the other.`,
                    `What angle is supplementary to $${a}$°?`,
                ]);
                return { clue: ph, answer: String(x), answerDisplay: `${x}°`, unit: '°', diagram: { type: 'straight-line-angles', a } };
            }
            const ph = rc(rng, [
                `Two straight lines intersect. One angle is $${a}$°. State the *vertically opposite* angle.`,
                `Find the angle *vertically opposite* to $${a}$°.`,
                `Two lines cross. One angle measures $${a}$°. What is the *vertically opposite* angle?`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, unit: '°', diagram: { type: 'vertically-opposite', a } };
        }
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
        return { clue: ph, answer: String(2 * (l + w)), answerDisplay: `${2 * (l + w)} ${u}`, unit: u, diagram: { type: 'rectangle', l, w, missing: 'perimeter' } };
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
            const worked = `$${a*scale}^2 + ${b*scale}^2 = ${(a*scale)**2} + ${(b*scale)**2} = ${(c*scale)**2}$, so $c = ${c*scale}$ ${u}`;
            return { clue: ph, answer: String(c * scale), answerDisplay: `${c * scale} ${u}`, worked, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'c' } };
        }
        if (type === 3) {
            // Co-interior (same-side interior) angles on parallel lines — sum to 180°
            const a = rc(rng, [40, 50, 55, 60, 65, 70, 80, 110, 120]);
            const x = 180 - a;
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. One *co-interior* angle is $${a}$°. Find the other co-interior angle.`,
                `Co-interior angles between parallel lines sum to 180°. One angle is $${a}$°. Find the *other*.`,
                `A transversal crosses two parallel lines. If one co-interior angle is $${a}$°, find the *missing* angle.`,
            ]);
            return { clue: ph, answer: String(x), answerDisplay: `${x}°`, diagram: { type: 'parallel-transversal', a, angleType: 'co-interior' } };
        }
        if (type === 4) {
            // Corresponding and alternate angles on parallel lines — equal
            const a = rc(rng, [40, 50, 55, 60, 65, 70, 80, 110, 120]);
            const form = ri(rng, 0, 1);
            if (form === 0) {
                const ph = rc(rng, [
                    `Two parallel lines are cut by a transversal. A *corresponding* angle is $${a}$°. Find the equal angle.`,
                    `Corresponding angles are equal. One is $${a}$°. Find the *other* corresponding angle.`,
                    `State the *corresponding* angle to $${a}$° on a pair of parallel lines.`,
                ]);
                return { clue: ph, answer: String(a), answerDisplay: `${a}°`, diagram: { type: 'parallel-transversal', a, angleType: 'corresponding' } };
            }
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. An *alternate* angle is $${a}$°. Find the equal angle.`,
                `Alternate angles are equal. One measures $${a}$°. Find its *alternate* angle.`,
                `State the *alternate* angle to $${a}$° on a pair of parallel lines.`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, diagram: { type: 'parallel-transversal', a, angleType: 'alternate' } };
        }
        // type 2 — triangle angle sum
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
        const workedCircA = `$A = \\pi r^2 \\approx 3.14 \\times ${r}^2 = 3.14 \\times ${r*r} = ${ans}$ ${u}²`;
        return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, worked: workedCircA, diagram: { type: 'circle', r, missing: 'area' } };
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
        const worked2 = `$${c*scale}^2 - ${a*scale}^2 = ${(c*scale)**2} - ${(a*scale)**2} = ${(b*scale)**2}$, so $b = ${b*scale}$ ${u}`;
        return { clue: ph, answer: String(b * scale), answerDisplay: `${b * scale} ${u}`, worked: worked2, diagram: { type: 'right-triangle', a: a * scale, b: b * scale, c: c * scale, missing: 'b' } };
    }
    if (type === 3) {
        // Co-interior angles — parallel lines, harder context
        const a = rc(rng, [35, 48, 52, 67, 73, 112, 127]);
        const x = 180 - a;
        const ph = rc(rng, [
            `Two parallel lines are cut by a transversal. The co-interior angles are $${a}$° and $x$°. Find $x$.`,
            `Find the *co-interior* angle to $${a}$° when two parallel lines are cut by a transversal.`,
            `Co-interior angles sum to 180°. One angle measures $${a}$°. Find the *other*.`,
        ]);
        return { clue: ph, answer: String(x), answerDisplay: `${x}°`, diagram: { type: 'parallel-transversal', a, angleType: 'co-interior' } };
    }
    if (type === 4) {
        // Corresponding and alternate angles — parallel lines
        const a = rc(rng, [38, 47, 53, 61, 74, 82, 119, 134]);
        const form = ri(rng, 0, 1);
        if (form === 0) {
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. A *corresponding* angle is $${a}$°. Find the equal angle.`,
                `State the *corresponding* angle to $${a}$° on a pair of parallel lines.`,
                `Corresponding angles are equal. One is $${a}$°. What is the *other* corresponding angle?`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, diagram: { type: 'parallel-transversal', a, angleType: 'corresponding' } };
        }
        const ph = rc(rng, [
            `Two parallel lines are cut by a transversal. An *alternate* angle is $${a}$°. Find the equal angle.`,
            `State the *alternate* angle to $${a}$° on a pair of parallel lines.`,
            `Alternate angles are equal. One measures $${a}$°. What is its *alternate* angle?`,
        ]);
        return { clue: ph, answer: String(a), answerDisplay: `${a}°`, diagram: { type: 'parallel-transversal', a, angleType: 'alternate' } };
    }
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
    const workedCircC = `$C = 2\\pi r \\approx 2 \\times 3.14 \\times ${r} = ${ans}$ ${u}`;
    return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}`, worked: workedCircC, diagram: { type: 'circle', r, missing: 'circumference' } };
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
            const midPart  = mid === 0 ? '' : (mid > 0 ? `+${mid}x` : `${mid}x`);
            const midDisp  = mid === 0 ? '' : (mid > 0 ? ` + ${mid}x` : ` ${mid}x`);
            const lStr = last >= 0 ? `+${last}` : `${last}`;
            const lDisp = last >= 0 ? ` + ${last}` : ` ${last}`;
            return { clue: `${verb}\n$(x + ${a})(x - ${b})$`, answer: `x²${midPart}${lStr}`, answerDisplay: `$x^2${midDisp}${lDisp}$` };
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
        // Hard: (x-a)(x+b) = 0, one negative root; mid = b-a (coeff of x in expansion)
        const a = ri(rng, 2, 6), b = ri(rng, 1, 5);
        if (a === b) return _genAlgebraOp(rng, diff, op);
        const mid = b - a, last = -a * b;
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
        const k = ri(rng, 2, 5), n = rc(rng, [2, 3, 5, 6, 7]);
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
        // Ask for one element of the five-number summary
        const n = 8;
        const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        if (!Number.isInteger(q1) || !Number.isInteger(q3)) return null;
        const choice = rc(rng, ['Q1', 'Q3', 'median', 'IQR']);
        let ans, clueQ;
        if (choice === 'Q1') { ans = q1; clueQ = 'Find **Q1** (lower quartile)'; }
        else if (choice === 'Q3') { ans = q3; clueQ = 'Find **Q3** (upper quartile)'; }
        else if (choice === 'median') {
            const med = (data[3] + data[4]) / 2;
            if (!Number.isInteger(med)) return null;
            ans = med; clueQ = 'Find the **median**';
        } else {
            ans = q3 - q1; clueQ = 'Find the **interquartile range (IQR)**';
        }
        return { clue: `${clueQ} of: $${data.join(', ')}$`, answer: String(ans) };
    }

    if (op === 'bivariate') {
        // Given a line of best fit, predict a value
        const m = ri(rng, 1, 5), c = ri(rng, 0, 10), x = ri(rng, 2, 10);
        const y = m * x + c;
        const ph = rc(rng, [
            `A line of best fit is $y = ${m}x + ${c}$. Predict $y$ when $x = ${x}$.`,
            `The equation of the line of best fit is $y = ${m}x + ${c}$. Find $y$ when $x = ${x}$.`,
            `Using $y = ${m}x + ${c}$, calculate the predicted value of $y$ for $x = ${x}$.`,
        ]);
        return { clue: ph, answer: String(y), answerDisplay: `$y = ${y}$` };
    }
    return null;
}

// ---- Geometry Stage 5 operations ----------------------------
function _genGeometryS5Op(rng, diff, op) {
    if (op === 'surface-area') {
        const l = ri(rng, 2, 10), w = ri(rng, 2, 8), h = ri(rng, 2, 8);
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
        // Two rectangular prisms joined
        const l1 = ri(rng, 3, 10), w1 = ri(rng, 2, 8), h1 = ri(rng, 2, 6);
        const l2 = ri(rng, 2, l1), w2 = ri(rng, 2, w1), h2 = ri(rng, 2, 5);
        const u = 'm';
        const v = l1 * w1 * h1 + l2 * w2 * h2;
        const ph = rc(rng, [
            `A composite solid consists of two rectangular prisms. Prism A: $${l1}$ m × $${w1}$ m × $${h1}$ m. Prism B: $${l2}$ m × $${w2}$ m × $${h2}$ m. Find the *total volume*.`,
            `Find the *combined volume* of two rectangular prisms: Prism 1 has dimensions $${l1}\\times${w1}\\times${h1}$ m and Prism 2 has dimensions $${l2}\\times${w2}\\times${h2}$ m.`,
        ]);
        return { clue: ph, answer: String(v), answerDisplay: `${v} m³` };
    }

    if (op === 'similar-triangles') {
        // Two similar triangles; find a missing side
        const scale = ri(rng, 2, 4);
        const a = ri(rng, 3, 8), b = ri(rng, 3, 8), c = ri(rng, 3, 8);
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
    const P2 = ri(rng, 2, 10) * 1000;
    const rAnnual = rc(rng, [6, 8, 12]);
    const nPer = rc(rng, [2, 4, 12]); // half-yearly, quarterly, monthly
    const periodLabel = nPer === 2 ? 'half-yearly' : nPer === 4 ? 'quarterly' : 'monthly';
    const t2 = ri(rng, 1, 2);
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
        const scale = ri(rng, 1, 3);
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
        const scale = ri(rng, 1, 3);
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
        const scale = ri(rng, 2, 5);
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
        // A + B must be < 180 for a valid triangle (third angle C = 180 - A - B > 0)
        if (A + B >= 180) return null;
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
        const h = rc(rng, [-2, -1, 1, 2, 3, 4]);
        const k = ri(rng, -2, 3);
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
        const a = rc(rng, [1, -1, 2, -2]);
        const h2 = rc(rng, [-2, -1, 0, 1, 2]);
        // Downward parabolae must have +k so the vertex and arms stay in-frame
        const k2 = a > 0 ? ri(rng, -1, 2) : ri(rng, 0, 3);
        const opens = a > 0 ? 'upward' : 'downward';
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const xPart = h2 === 0 ? 'x' : `(x ${h2 > 0 ? `- ${h2}` : `+ ${Math.abs(h2)}`})`;
        const kPart = k2 === 0 ? '' : (k2 > 0 ? ` + ${k2}` : ` - ${Math.abs(k2)}`);
        const eq = `${aStr}${xPart}^2${kPart}`;
        const ph = `For $y = ${eq}$, state the vertex and direction it opens.`;
        return { clue: ph, answer: `(${h2},${k2})${opens[0].toUpperCase()}`, answerDisplay: `Vertex $(${h2}, ${k2})$, opens ${opens}`, diagram: { type: 'parabola', h: h2, k: k2, a } };
    }

    if (op === 'identify-graph') {
        const graphs = [
            { eq: 'y = x²', type: 'parabola' },
            { eq: 'y = 2^x', type: 'exponential' },
            { eq: 'xy = 4', type: 'hyperbola' },
            { eq: 'y = -x²', type: 'parabola' },
            { eq: 'y = 3^x', type: 'exponential' },
        ];
        const g = rc(rng, graphs);
        const ph = rc(rng, [
            `Identify the type of graph represented by $${g.eq}$.`,
            `What type of curve does $${g.eq}$ represent?`,
            `Name the graph: $${g.eq}$.`,
        ]);
        return { clue: ph, answer: g.type, answerDisplay: g.type };
    }

    return null;
}

// ============================================================
// PROBABILITY
// ============================================================
function genProbability(rng, diff, allowedOps) {
    const OPS = ['theoretical', 'complementary', 'multi-event'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'theoretical') {
        const CONTEXTS = [
            { label: 'red', bag: 'bag of marbles', totalLabel: 'marbles' },
            { label: 'hearts', bag: 'deck of cards', totalLabel: 'cards' },
            { label: 'heads', bag: 'coin toss', totalLabel: 'sides' },
            { label: 'sixes', bag: 'die roll', totalLabel: 'sides' },
        ];
        if (diff === 'Easy') {
            // Simple spinner / bag: fav/total with small numbers
            const fav = ri(rng, 1, 4), other = ri(rng, 2, 6);
            const total = fav + other;
            const colour = rc(rng, ['red', 'blue', 'green', 'yellow']);
            const other_colour = rc(rng, ['blue', 'green', 'orange'].filter(c => c !== colour));
            const s = simplify(fav, total);
            const ph = rc(rng, [
                `A bag contains $${fav}$ ${colour} and $${other}$ ${other_colour} marbles. Find P(${colour}).`,
                `A bag has $${fav}$ ${colour} marbles and $${other}$ ${other_colour} marbles. What is the probability of picking a ${colour} marble?`,
                `There are $${fav}$ ${colour} and $${other}$ ${other_colour} marbles in a bag. Find the probability of selecting a ${colour} marble.`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$` };
        }
        if (diff === 'Medium') {
            // Die or spinner with larger total
            const sides = rc(rng, [6, 8, 10, 12]);
            const target = rc(rng, ['even', 'greater than 4', 'a prime', 'less than 3']);
            let fav;
            if (target === 'even') fav = Math.floor(sides / 2);
            else if (target === 'greater than 4') fav = sides - 4;
            else if (target === 'a prime') {
                const primes = [2, 3, 5, 7, 11].filter(p => p <= sides);
                fav = primes.length;
            } else fav = 2; // less than 3: 1, 2
            if (fav <= 0 || fav >= sides) return genProbability(rng, diff, allowedOps);
            const s = simplify(fav, sides);
            const ph = rc(rng, [
                `A fair $${sides}$-sided die is rolled. Find P(${target}).`,
                `Roll a fair $${sides}$-sided die numbered 1 to $${sides}$. What is P(${target})?`,
                `A spinner has $${sides}$ equal sections numbered 1 to $${sides}$. Find P(${target}).`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$` };
        }
        // Hard: cards or frequency table
        const suit = rc(rng, ['hearts', 'spades', 'diamonds', 'clubs']);
        const fav = 13, total = 52;
        const s = simplify(fav, total);
        const ph = rc(rng, [
            `A standard deck of 52 cards is shuffled. Find P(${suit}).`,
            `One card is drawn from a standard 52-card deck. What is P(drawing a ${suit})?`,
            `What is the probability of drawing a ${suit} from a shuffled 52-card deck?`,
        ]);
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$` };
    }

    if (op === 'complementary') {
        // P(event) given, find P(not event)
        const denoms = diff === 'Easy' ? [4, 5, 6, 8] : diff === 'Medium' ? [5, 6, 8, 10, 12] : [10, 12, 20, 100];
        const d = rc(rng, denoms);
        const n = ri(rng, 1, d - 1);
        const s = simplify(n, d);
        const compS = simplify(d - n, d);
        const event = rc(rng, ['winning', 'rain tomorrow', 'selecting a red card', 'rolling a 6']);
        const ph = rc(rng, [
            `P(${event}) $= \\frac{${s.n}}{${s.d}}$. Find P(not ${event}).`,
            `If the probability of ${event} is $\\frac{${s.n}}{${s.d}}$, what is the probability of NOT ${event}?`,
            `The probability of ${event} is $\\frac{${s.n}}{${s.d}}$. Find the *complementary* probability.`,
        ]);
        return { clue: ph, answer: fracStr(compS.n, compS.d), answerDisplay: `$\\frac{${compS.n}}{${compS.d}}$` };
    }

    // op === 'multi-event'
    if (diff === 'Easy') {
        // Mutually exclusive: P(A) + P(B)
        const d = rc(rng, [6, 8, 10]);
        const a = ri(rng, 1, 3), b = ri(rng, 1, d - a - 1);
        const s = simplify(a + b, d);
        const ph = rc(rng, [
            `A bag has $${a}$ red, $${b}$ blue and $${d - a - b}$ green marbles. Find P(red *or* blue).`,
            `P(red) $= \\frac{${a}}{${d}}$ and P(blue) $= \\frac{${b}}{${d}}$. Find P(red or blue).`,
        ]);
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$` };
    }
    // Medium/Hard: two independent events (with replacement)
    const d1 = rc(rng, [4, 6]), d2 = rc(rng, [4, 6]);
    const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
    const numProd = n1 * n2, denProd = d1 * d2;
    const s = simplify(numProd, denProd);
    const col1 = rc(rng, ['red', 'blue']), col2 = rc(rng, ['green', 'yellow']);
    const ph = rc(rng, [
        `A bag has $${n1}$ ${col1} out of $${d1}$ marbles and another bag has $${n2}$ ${col2} out of $${d2}$ marbles. Find P(${col1} *and* ${col2}) if one marble is drawn from each bag.`,
        `P(${col1}) $= \\frac{${n1}}{${d1}}$ and P(${col2}) $= \\frac{${n2}}{${d2}}$. These are *independent* events. Find P(${col1} and ${col2}).`,
    ]);
    return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$` };
}

// ============================================================
// RATIOS & RATES
// ============================================================
function genRatiosRates(rng, diff, allowedOps) {
    const OPS = ['simplify', 'divide-ratio', 'equivalent', 'unit-rate', 'speed'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'simplify') {
        const factor = ri(rng, 2, diff === 'Easy' ? 5 : 10);
        const a = ri(rng, 1, 8) * factor, b = ri(rng, 1, 8) * factor;
        const s = simplify(a, b);
        const ph = rc(rng, [
            `Simplify the ratio $${a} : ${b}$.`,
            `Write $${a} : ${b}$ in its simplest form.`,
            `Reduce $${a} : ${b}$ to its lowest terms.`,
        ]);
        return { clue: ph, answer: `${s.n} : ${s.d}`, answerDisplay: `$${s.n} : ${s.d}$` };
    }

    if (op === 'divide-ratio') {
        const total = diff === 'Easy' ? rc(rng, [24, 30, 36, 48]) : diff === 'Medium' ? rc(rng, [60, 90, 120, 150]) : rc(rng, [200, 300, 500, 1000]);
        const partsA = ri(rng, 1, 5), partsB = ri(rng, 1, 5);
        const denomParts = partsA + partsB;
        if (total % denomParts !== 0) return genRatiosRates(rng, diff, allowedOps);
        const shareA = (total / denomParts) * partsA;
        const shareB = total - shareA;
        const unit = diff === 'Hard' ? 'dollars' : rc(rng, ['lollies', 'points', 'tiles', 'cm']);
        const ph = rc(rng, [
            `Divide $${total}$ ${unit} in the ratio $${partsA} : ${partsB}$.`,
            `Share $${total}$ ${unit} in the ratio $${partsA} : ${partsB}$.`,
            `Split $${total}$ ${unit} between two people in the ratio $${partsA} : ${partsB}$.`,
        ]);
        return { clue: ph, answer: `${shareA} : ${shareB}`, answerDisplay: `$${shareA} : ${shareB}$` };
    }

    if (op === 'equivalent') {
        const a = ri(rng, 1, 6), b = ri(rng, 1, 6);
        const mult = ri(rng, 2, diff === 'Easy' ? 4 : 8);
        const ph = rc(rng, [
            `Find the missing value: $${a} : ${b} = ? : ${b * mult}$.`,
            `Complete the equivalent ratio: $${a} : ${b} = \\square : ${b * mult}$.`,
            `If $${a} : ${b}$ is equivalent to $\\square : ${b * mult}$, find the missing number.`,
        ]);
        return { clue: ph, answer: String(a * mult), answerDisplay: `$${a * mult}$` };
    }

    if (op === 'unit-rate') {
        const UNIT_CONTEXTS = [
            { item: 'apples', price: ri(rng, 2, 8), qty: ri(rng, 2, 6) * rc(rng, [2, 3, 4]) },
            { item: 'litres of petrol', price: ri(rng, 150, 210), qty: rc(rng, [10, 20, 40, 50]) },
            { item: 'bottles of water', price: ri(rng, 5, 20), qty: rc(rng, [6, 10, 12, 24]) },
        ];
        const ctx = rc(rng, UNIT_CONTEXTS);
        const unitPrice = round(ctx.price / ctx.qty, 2);
        const ph = rc(rng, [
            `$${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$. Find the cost per item (unit rate).`,
            `If $${ctx.qty}$ ${ctx.item} costs $\\$${ctx.price}$, what is the *unit rate* (cost per ${ctx.item})?`,
        ]);
        return { clue: ph, answer: String(unitPrice), answerDisplay: `$\\$${unitPrice}$` };
    }

    // op === 'speed'
    const SPEED_CONTEXTS = [
        { vehicle: 'car', unit: 'km/h' },
        { vehicle: 'train', unit: 'km/h' },
        { vehicle: 'cyclist', unit: 'km/h' },
    ];
    const ctx = rc(rng, SPEED_CONTEXTS);
    const findWhat = rc(rng, diff === 'Easy' ? ['speed', 'distance'] : ['speed', 'distance', 'time']);
    if (findWhat === 'speed') {
        const d = ri(rng, 2, 15) * 10, t = ri(rng, 1, 4);
        if (d % t !== 0) return genRatiosRates(rng, diff, allowedOps);
        const s = d / t;
        const ph = rc(rng, [
            `A ${ctx.vehicle} travels $${d}$ km in $${t}$ hour${t > 1 ? 's' : ''}. Find its speed.`,
            `Find the speed of a ${ctx.vehicle} that covers $${d}$ km in $${t}$ h.`,
        ]);
        return { clue: ph, answer: String(s), answerDisplay: `${s} ${ctx.unit}` };
    }
    if (findWhat === 'distance') {
        const speed = ri(rng, 3, 12) * 10, time = ri(rng, 1, 4);
        const dist = speed * time;
        const ph = rc(rng, [
            `A ${ctx.vehicle} travels at $${speed}$ ${ctx.unit} for $${time}$ hour${time > 1 ? 's' : ''}. Find the distance.`,
            `How far does a ${ctx.vehicle} travel at $${speed}$ ${ctx.unit} in $${time}$ h?`,
        ]);
        return { clue: ph, answer: String(dist), answerDisplay: `${dist} km` };
    }
    // findWhat === 'time'
    const speed2 = ri(rng, 4, 12) * 10, dist2 = speed2 * ri(rng, 1, 5);
    const time2 = dist2 / speed2;
    const ph = rc(rng, [
        `A ${ctx.vehicle} travels $${dist2}$ km at $${speed2}$ ${ctx.unit}. How long does the journey take?`,
        `Find the *time* taken for a ${ctx.vehicle} to travel $${dist2}$ km at $${speed2}$ ${ctx.unit}.`,
    ]);
    return { clue: ph, answer: String(time2), answerDisplay: `${time2} h` };
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
    // surface-area is Stage 4+5; composite-volume and similar-triangles are Stage 5 only
    const S5_ONLY = ['composite-volume', 'similar-triangles'];
    const EXTENDED = ['surface-area'];  // available to all stages via _genGeometryS5Op
    const s5Active  = S5_ONLY.filter(k => allowedOps && allowedOps.includes(k));
    const extActive = EXTENDED.filter(k => allowedOps && allowedOps.includes(k));
    const s4Active  = ['area-perimeter', 'pythagoras', 'angles', 'circles'].filter(k => !allowedOps || allowedOps.includes(k));
    const extPool   = [...s5Active, ...extActive];
    if (extPool.length > 0 && (!s4Active.length || rng() < 0.4)) {
        return _genGeometryS5Op(rng, diff, rc(rng, extPool));
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
    'Probability':              genProbability,
    'Ratios & Rates':           genRatiosRates,
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
    'Probability':              'Probability',
    'Ratios & Rates':           'Number',
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
    const seenClues = new Set();
    let attempts = 0;
    let planIdx = 0;
    const maxAttempts = count * 20;

    while (results.length < count && attempts < maxAttempts) {
        attempts++;
        // Advance planIdx on every attempt so a failing topic doesn't block the whole run
        const st = topicPlan[planIdx % topicPlan.length];
        planIdx++;
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
        const displayStr = String(q.answerDisplay || ans);
        if (!ans || displayStr.length > 60 || ans === 'NaN' || ans === 'Infinity' || ans === '-Infinity') continue;

        if (seenClues.has(q.clue)) continue;

        seenClues.add(q.clue);
        results.push({
            id: 'gen_' + results.length + '_' + (seed || Date.now()),
            topic: TOPIC_MAP[st] || 'Number',
            difficulty: diff,
            clue: q.clue || '',
            answer: ans,
            answerDisplay: displayStr,
            notes: st,
            diagram: q.diagram || null,
            worked: q.worked || null,
            unit: q.unit || null,
        });
    }

    results._requested = count;
    results._failCount = count - results.length;
    return results;
}

export { ALL_SUBTOPICS };
