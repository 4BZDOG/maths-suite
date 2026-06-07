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

// Format a number as a 2-decimal-place currency string. Used in answerDisplay
// so dollar amounts always render as "$17.40" (not "$17.4").
function money(n) { return Number(n).toFixed(2); }

// Verb pools — the imperative that opens each clue. The base list matches the
// NESA Mathematics K-10 (2022) syllabus voice (Calculate / Evaluate / Find /
// Determine), broadened with the syllabus-prominent verbs Apply, Compute,
// Verify, Show so the same skill reads in a few different ways.
const CALC_VERBS   = ['Calculate:', 'Evaluate:', 'Find the value of:', 'Work out:', 'Determine:', 'Compute:'];
const MULT_VERBS   = ['Calculate:', 'Evaluate:', 'Find the product of:', 'Work out:', 'Find the result of:', 'Compute:'];
const DIV_VERBS    = ['Calculate:', 'Evaluate:', 'Find the quotient of:', 'Work out:', 'Divide:', 'Compute:'];
const BODMAS_VERBS = ['Evaluate:', 'Calculate:', 'Apply order of operations to find:', 'Work out:', 'Simplify:', 'Compute:'];
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
const DATA_CONTEXTS = ['scores', 'values', 'ages', 'heights (cm)', 'temperatures (°C)', 'distances (m)', 'results', 'times (s)', 'weights (kg)', 'prices ($)', 'marks', 'lengths (cm)', 'speeds (km/h)', 'rainfall (mm)', 'test results', 'heart rates (bpm)', 'goals scored', 'reaction times (ms)', 'quiz results', 'shoe sizes', 'sales figures', 'water usage (L)', 'step counts', 'hours slept', 'points earned'];

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
//   pathway - 'path' means Stage 5 Path only; omit for core
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
        // Stage 5 Path
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
    // ─── 2022-syllabus focus areas added as standalone topics ───────────
    // These mirror the NESA Mathematics K-10 (2022) focus areas that aren't
    // discoverable inside the Algebra / Geometry umbrellas. Existing users
    // who already had Algebra/Geometry selected keep those — the new topics
    // are purely additive.
    'Indices': [
        { key: 'indices-evaluate', label: 'Evaluate a power' },
        { key: 'indices-multiply', label: 'Multiply (same base)' },
        { key: 'indices-divide',   label: 'Divide (same base)' },
        { key: 'indices-power',    label: 'Power of a power' },
        { key: 'indices-zero',     label: 'Zero index',  stages: ['Stage 5'] },
        { key: 'indices-negative', label: 'Negative index', stages: ['Stage 5'] },
    ],
    'Linear Relationships': [
        { key: 'plot-line',         label: 'Plot points on y = mx + c' },
        { key: 'gradient-two-points', label: 'Gradient from two points' },
        { key: 'midpoint',          label: 'Midpoint of two points' },
        { key: 'intercepts',        label: 'Find intercepts' },
        { key: 'distance',          label: 'Distance between points', stages: ['Stage 5'] },
        { key: 'equation-from-gp',  label: 'Equation from gradient + point', stages: ['Stage 5'] },
    ],
    'Properties of Geometrical Figures': [
        { key: 'congruent-tests',   label: 'Congruence tests',   stages: ['Stage 5'] },
        { key: 'similar-ratio',     label: 'Similarity scale factor', stages: ['Stage 5'] },
        { key: 'quad-properties',   label: 'Quadrilateral properties', stages: ['Stage 5'] },
    ],
    'Variation & Rates of Change': [
        { key: 'direct-variation',   label: 'Direct variation  y = kx', stages: ['Stage 5'] },
        { key: 'inverse-variation',  label: 'Inverse variation  y = k/x', stages: ['Stage 5'] },
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
        // ~22% chance: missing-number (inverse) variant — □ + b = total
        if (rng() < 0.22) {
            const hi = diff === 'Easy' ? 20 : diff === 'Medium' ? 100 : 500;
            const missing = ri(rng, 1, hi), b = ri(rng, 1, hi);
            const total = missing + b;
            const left = rng() < 0.5;
            const expr = left ? `\\square + ${b} = ${total}` : `${b} + \\square = ${total}`;
            const clue = rc(rng, [
                `Find the missing number: $${expr}$`,
                `What number goes in the box? $${expr}$`,
                `Solve for the missing value: $${expr}$`,
            ]);
            return { clue, answer: String(missing), worked: `$${total} - ${b} = ${missing}$` };
        }
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
            return { clue, answer: String(aa + bb), worked: `$${expr} = ${aa + bb}$` };
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
            return { clue, answer: String(aa + bb), worked: `$${expr} = ${aa + bb}$` };
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
            return { clue: ctx.stem, answer: String(ctx.ans), worked: `$${a} + ${b} = ${ctx.ans}$` };
        }
        const clue = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
            `Find the *sum* of $${a}$ and $${b}$`,
            `What is the total of $${a}$ and $${b}$?`,
            `Add $${a}$ to $${b}$`,
            `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
        ]);
        return { clue, answer: String(a + b), worked: `$${a} + ${b} = ${a + b}$` };
    }
    if (op === '-') {
        // ~22% chance: missing-number (inverse) variant — a − □ = result
        if (rng() < 0.22) {
            const hi = diff === 'Easy' ? 20 : diff === 'Medium' ? 100 : 500;
            const missing = ri(rng, 1, hi);
            const result = ri(rng, 1, hi);
            const a = missing + result;            // a − missing = result
            const expr = rng() < 0.5
                ? `${a} - \\square = ${result}`     // missing subtrahend
                : `\\square - ${missing} = ${result}`; // missing minuend → answer a
            const isMinuend = expr.startsWith('\\square');
            const ans = isMinuend ? (missing + result) : missing;
            const clue = rc(rng, [
                `Find the missing number: $${expr}$`,
                `What number goes in the box? $${expr}$`,
                `Solve for the missing value: $${expr}$`,
            ]);
            const workedExpr = isMinuend ? `$${result} + ${missing} = ${ans}$` : `$${a} - ${result} = ${ans}$`;
            return { clue, answer: String(ans), worked: workedExpr };
        }
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
                return { clue, answer: String(a + b), worked: `$${a} - (-${b}) = ${a} + ${b} = ${a + b}$` };
            }
            // negative − positive: −a − b
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $-${a} - ${b}$`,
                `What is $-${a} - ${b}$?`,
                `Find $-${a} - ${b}$`,
            ]);
            return { clue, answer: String(-a - b), worked: `$-${a} - ${b} = ${-a - b}$` };
        }
        // Easy: 20% chance of crossing zero (answer is negative) — introduces negatives gently
        if (diff === 'Easy' && rng() < 0.2) {
            const a2 = ri(rng, 1, 9), b2 = ri(rng, a2 + 1, a2 + 10);
            const clue = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a2} - ${b2}$`,
                `What is $${a2} - ${b2}$?`,
                `Subtract $${b2}$ from $${a2}$`,
            ]);
            return { clue, answer: String(a2 - b2), worked: `$${a2} - ${b2} = ${a2 - b2}$` };
        }
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, a);
        if (diff === 'Easy' && rng() < 0.25) {
            const ctx = rc(rng, [
                { stem: `A baker has $${a}$ buns and sells $${b}$. How many buns remain?`, ans: a - b },
                { stem: `A class has $${a}$ students. $${b}$ are absent. How many are present?`, ans: a - b },
                { stem: `A farmer has $${a}$ eggs. $${b}$ are sold. How many are left?`, ans: a - b },
            ]);
            return { clue: ctx.stem, answer: String(ctx.ans), worked: `$${a} - ${b} = ${ctx.ans}$` };
        }
        const clue = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
            `Find the *difference* between $${a}$ and $${b}$`,
            `Subtract $${b}$ from $${a}$`,
            `What is $${a}$ minus $${b}$?`,
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
        ]);
        return { clue, answer: String(a - b), worked: `$${a} - ${b} = ${a - b}$` };
    }
    if (op === '×') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 30] : [12, 60];
        // ~20% chance: square a single number instead of a × b (Medium/Hard only)
        if (diff !== 'Easy' && rng() < 0.20) {
            const base = diff === 'Medium' ? ri(rng, 4, 18) : ri(rng, 12, 35);
            const verb = rc(rng, CALC_VERBS);
            return { clue: `${verb}\n$${base}^2$`, answer: String(base * base), worked: `$${base}^2 = ${base} \\times ${base} = ${base * base}$` };
        }
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        // Easy: 25% word problem
        if (diff === 'Easy' && rng() < 0.25) {
            const ctx = rc(rng, [
                { stem: `A box contains $${a}$ items. There are $${b}$ boxes. How many items altogether?`, ans: a * b },
                { stem: `Each row has $${a}$ seats and there are $${b}$ rows. How many seats in total?`, ans: a * b },
                { stem: `A pack of pencils contains $${a}$ pencils. How many pencils in $${b}$ packs?`, ans: a * b },
            ]);
            return { clue: ctx.stem, answer: String(ctx.ans), worked: `$${a} \\times ${b} = ${ctx.ans}$` };
        }
        // Medium/Hard: 40% chance of negative operand(s)
        if (diff !== 'Easy' && rng() < 0.4) {
            const negForm = diff === 'Hard' ? ri(rng, 0, 2) : ri(rng, 0, 1);
            if (negForm === 0) {
                const clue = rc(rng, [
                    `${rc(rng, MULT_VERBS)} $(-${a}) \\times ${b}$`,
                    `Multiply $-${a}$ by $${b}$`,
                    `What is $(-${a}) \\times ${b}$?`,
                ]);
                return { clue, answer: String(-a * b), worked: `$(-${a}) \\times ${b} = ${-a * b}$` };
            }
            if (negForm === 1) {
                const clue = rc(rng, [
                    `${rc(rng, MULT_VERBS)} $${a} \\times (-${b})$`,
                    `Multiply $${a}$ by $-${b}$`,
                    `What is $${a} \\times (-${b})$?`,
                ]);
                return { clue, answer: String(-a * b), worked: `$${a} \\times (-${b}) = ${-a * b}$` };
            }
            // Hard only: negative × negative
            const clue = rc(rng, [
                `${rc(rng, MULT_VERBS)} $(-${a}) \\times (-${b})$`,
                `What is $(-${a}) \\times (-${b})$?`,
            ]);
            return { clue, answer: String(a * b), worked: `$(-${a}) \\times (-${b}) = ${a * b}$` };
        }
        // Easy: 20% chance of negative × positive (e.g. (−3) × 4)
        if (diff === 'Easy' && rng() < 0.2) {
            const clue = rc(rng, [
                `${rc(rng, MULT_VERBS)} $(-${a}) \\times ${b}$`,
                `Multiply $-${a}$ by $${b}$`,
                `What is $(-${a}) \\times ${b}$?`,
            ]);
            return { clue, answer: String(-a * b), worked: `$(-${a}) \\times ${b} = ${-a * b}$` };
        }
        const clue = rc(rng, [
            `${rc(rng, MULT_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `What is $${a}$ multiplied by $${b}$?`,
            `Find the *product* of $${a}$ and $${b}$`,
        ]);
        return { clue, answer: String(a * b), worked: `$${a} \\times ${b} = ${a * b}$` };
    }
    if (op === '÷') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 25] : [8, 50];
        const b = ri(rng, lo, hi), ans = ri(rng, lo, hi);
        // Easy: 25% word problem
        if (diff === 'Easy' && rng() < 0.25) {
            const total = b * ans;
            const ctx = rc(rng, [
                { stem: `$${total}$ lollies are shared equally among $${b}$ children. How many does each child get?` },
                { stem: `A farmer packs $${total}$ eggs into boxes of $${b}$. How many boxes are needed?` },
                { stem: `$${total}$ students are split into $${b}$ equal groups. How many in each group?` },
            ]);
            return { clue: ctx.stem, answer: String(ans), worked: `$${b * ans} \\div ${b} = ${ans}$` };
        }
        // Medium/Hard: 40% chance of negative dividend
        if (diff !== 'Easy' && rng() < 0.4) {
            const dividend = -(b * ans);
            const clue = rc(rng, [
                `${rc(rng, DIV_VERBS)} $${dividend} \\div ${b}$`,
                `Divide $${dividend}$ by $${b}$`,
                `What is $${dividend}$ divided by $${b}$?`,
            ]);
            return { clue, answer: String(-ans), worked: `$${dividend} \\div ${b} = ${-ans}$` };
        }
        const clue = rc(rng, [
            `${rc(rng, DIV_VERBS)} $${b * ans} \\div ${b}$`,
            `Divide $${b * ans}$ by $${b}$`,
            `What is $${b * ans}$ divided by $${b}$?`,
            `Find the *quotient* of $${b * ans}$ and $${b}$`,
        ]);
        return { clue, answer: String(ans), worked: `$${b * ans} \\div ${b} = ${ans}$` };
    }
    if (op === 'bodmas') {
        const verb = rc(rng, BODMAS_VERBS);
        if (diff === 'Medium') {
            // Medium: forms 0–5 (mixed ops and brackets, no exponents)
            const form = ri(rng, 0, 5);
            if (form === 0) {
                const a = ri(rng, 2, 15), b = ri(rng, 2, 9), c = ri(rng, 2, 8);
                return { clue: `${verb}\n$${a} + ${b} \\times ${c}$`, answer: String(a + b * c), worked: `$${a} + ${b} \\times ${c} = ${a} + ${b * c} = ${a + b * c}$` };
            }
            if (form === 1) {
                const a = ri(rng, 2, 9), b = ri(rng, 2, 9), c = ri(rng, 2, 8);
                return { clue: `${verb}\n$(${a} + ${b}) \\times ${c}$`, answer: String((a + b) * c), worked: `$(${a} + ${b}) \\times ${c} = ${a + b} \\times ${c} = ${(a + b) * c}$` };
            }
            if (form === 2) {
                const a = ri(rng, 2, 9), b = ri(rng, 2, 8), c = ri(rng, 2, 9), d = ri(rng, 2, 6);
                return { clue: `${verb}\n$${a} \\times ${b} + ${c} \\times ${d}$`, answer: String(a * b + c * d), worked: `$${a} \\times ${b} + ${c} \\times ${d} = ${a * b} + ${c * d} = ${a * b + c * d}$` };
            }
            if (form === 3) {
                const b = ri(rng, 2, 12), c = ri(rng, 3, 10);
                const a = ri(rng, b + 1, b + 15);
                return { clue: `${verb}\n$(${a} - ${b}) \\times ${c}$`, answer: String((a - b) * c), worked: `$(${a} - ${b}) \\times ${c} = ${a - b} \\times ${c} = ${(a - b) * c}$` };
            }
            if (form === 4) {
                const a = ri(rng, 3, 20), b = ri(rng, 2, 10), c = ri(rng, 2, 8);
                return { clue: `${verb}\n$${a} - ${b} \\times ${c}$`, answer: String(a - b * c), worked: `$${a} - ${b} \\times ${c} = ${a} - ${b * c} = ${a - b * c}$` };
            }
            // form 5: division with addition/subtraction
            const a = ri(rng, 2, 8), b = ri(rng, 2, 8);
            const c = a * b;
            const d = ri(rng, 2, 15);
            return { clue: `${verb}\n$${c} \\div ${a} + ${d}$`, answer: String(b + d), worked: `$${c} \\div ${a} + ${d} = ${b} + ${d} = ${b + d}$` };
        }
        // Hard: forms 0–12 — exponents, nested brackets, larger operands, multi-step
        const form = ri(rng, 0, 12);
        if (form === 0) {
            const a = ri(rng, 5, 30), b = ri(rng, 3, 15), c = ri(rng, 3, 12);
            return { clue: `${verb}\n$${a} + ${b} \\times ${c}$`, answer: String(a + b * c) };
        }
        if (form === 1) {
            const a = ri(rng, 5, 15), b = ri(rng, 3, 12), c = ri(rng, 3, 10);
            return { clue: `${verb}\n$(${a} + ${b}) \\times ${c}$`, answer: String((a + b) * c) };
        }
        if (form === 2) {
            // a × b + c × d with larger operands
            const a = ri(rng, 3, 12), b = ri(rng, 3, 12), c = ri(rng, 3, 10), d = ri(rng, 3, 10);
            return { clue: `${verb}\n$${a} \\times ${b} + ${c} \\times ${d}$`, answer: String(a * b + c * d) };
        }
        if (form === 3) {
            // a^n + b  (n = 2 or 3)
            const base = ri(rng, 2, 7), exp = ri(rng, 2, 3), add = ri(rng, 2, 20);
            return { clue: `${verb}\n$${base}^{${exp}} + ${add}$`, answer: String(base ** exp + add) };
        }
        if (form === 4) {
            // (a + b)^2
            const a = ri(rng, 2, 8), b = ri(rng, 2, 8);
            return { clue: `${verb}\n$(${a} + ${b})^2$`, answer: String((a + b) ** 2) };
        }
        if (form === 5) {
            // (a − b)^2
            const b = ri(rng, 1, 7), a = ri(rng, b + 1, b + 8);
            return { clue: `${verb}\n$(${a} - ${b})^2$`, answer: String((a - b) ** 2) };
        }
        if (form === 6) {
            // a^2 + b × c
            const a = ri(rng, 2, 9), b = ri(rng, 2, 8), c = ri(rng, 2, 7);
            return { clue: `${verb}\n$${a}^2 + ${b} \\times ${c}$`, answer: String(a ** 2 + b * c) };
        }
        if (form === 7) {
            // a × (b^2 − c)  where b^2 > c
            const b = ri(rng, 3, 7), c = ri(rng, 1, b * b - 2), a = ri(rng, 2, 8);
            return { clue: `${verb}\n$${a} \\times (${b}^2 - ${c})$`, answer: String(a * (b ** 2 - c)) };
        }
        if (form === 8) {
            // (a + b)^2 − c × d
            const a = ri(rng, 2, 6), b = ri(rng, 2, 6), c = ri(rng, 2, 5), d = ri(rng, 2, 5);
            return { clue: `${verb}\n$(${a} + ${b})^2 - ${c} \\times ${d}$`, answer: String((a + b) ** 2 - c * d) };
        }
        if (form === 9) {
            // nested brackets: a × ((b + c) × d − e)
            const b = ri(rng, 2, 6), c = ri(rng, 2, 6), d = ri(rng, 2, 4);
            const inner = (b + c) * d;
            const e = ri(rng, 1, inner - 1);
            const a = ri(rng, 2, 5);
            return { clue: `${verb}\n$${a} \\times ((${b} + ${c}) \\times ${d} - ${e})$`, answer: String(a * (inner - e)) };
        }
        if (form === 10) {
            // division within BODMAS: (a × b + c) ÷ d
            const d = ri(rng, 2, 6), q = ri(rng, 3, 15);
            const total = d * q;
            const a = ri(rng, 2, 8), bProd = ri(rng, 2, 6);
            const c = total - a * bProd;
            if (c < 1 || c > 50) return genIntegers(rng, diff, allowedOps);
            return { clue: `${verb}\n$(${a} \\times ${bProd} + ${c}) \\div ${d}$`, answer: String(q) };
        }
        if (form === 11) {
            // a^2 − b^2 (difference of squares, larger numbers)
            const a = ri(rng, 4, 12), b = ri(rng, 1, a - 1);
            return { clue: `${verb}\n$${a}^2 - ${b}^2$`, answer: String(a ** 2 - b ** 2) };
        }
        // form 12: a^3 − b × c
        const a = ri(rng, 2, 5), b = ri(rng, 2, 8), c = ri(rng, 2, 6);
        return { clue: `${verb}\n$${a}^{3} - ${b} \\times ${c}$`, answer: String(a ** 3 - b * c) };
    }
}

// ============================================================
// DECIMALS
// ============================================================
function genDecimals(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    // type → sub-op mapping per difficulty
    const maps = {
        Easy:   { 'add-subtract': [0, 3], 'multiply-divide': [1, 2] },
        Medium: { 'add-subtract': [0, 1, 3], 'multiply-divide': [2] },
        Hard:   { 'multiply-divide': [1, 3, 4], 'add-subtract': [0, 2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 3 : diff === 'Medium' ? 3 : 4);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const twoDigit = rng() < 0.4;
            const a = twoDigit ? ri(rng, 11, 99) / 10 : ri(rng, 1, 9) / 10;
            const b = twoDigit ? ri(rng, 11, 99) / 10 : ri(rng, 1, 9) / 10;
            const ans = round(a + b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `Sarah runs $${a}$ km on Monday and $${b}$ km on Tuesday. How far did she run in total?`,
                    `A jug holds $${a}$ L of water. $${b}$ L more is added. How much water is in the jug?`,
                    `Tom spends $\\$${a}$ on a snack and $\\$${b}$ on a drink. How much did he spend altogether?`,
                    `A plant is $${a}$ m tall and grows another $${b}$ m. What is its new height?`,
                    `Mia walks $${a}$ km, then $${b}$ km more. How far has she walked in total?`,
                ]);
                return { clue: ctx, answer: String(ans), worked: `$${a} + ${b} = ${ans}$` };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${a} + ${b} = ${ans}$` };
        }
        // type 3: decimal subtraction
        if (type === 3) {
            const twoDigit3 = rng() < 0.4;
            const a = twoDigit3 ? ri(rng, 30, 99) / 10 : ri(rng, 3, 9) / 10;
            const b = twoDigit3 ? ri(rng, 10, Math.round(a * 10) - 1) / 10 : ri(rng, 1, Math.round(a * 10) - 1) / 10;
            const bR = round(b, 1);
            const ans = round(a - b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A bottle holds $${a}$ L of juice. $${bR}$ L is poured out. How much remains?`,
                    `A ribbon is $${a}$ m long. A piece of $${bR}$ m is cut off. What length is left?`,
                    `Sam has $\\$${a}$ and spends $\\$${bR}$. How much money is left?`,
                ]);
                return { clue: ctx, answer: String(ans), worked: `$${a} - ${bR} = ${ans}$` };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} - ${bR}$`,
                `Subtract $${bR}$ from $${a}$`,
                `Find the difference between $${a}$ and $${bR}$`,
                `What is $${a} - ${bR}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${a} - ${bR} = ${ans}$` };
        }
        if (type === 1) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 2, 9);
            const ans = round(a * b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A bottle holds $${a}$ L. How much do $${b}$ bottles hold?`,
                    `One ribbon is $${a}$ m long. What is the total length of $${b}$ ribbons?`,
                    `A snack costs $\\$${a}$. Find the cost of $${b}$ snacks.`,
                ]);
                return { clue: ctx, answer: String(ans), worked: `$${a} \\times ${b} = ${ans}$` };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
                `Multiply $${a}$ by $${b}$`,
                `Find the product of $${a}$ and $${b}$`,
                `What is $${a} \\times ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${a} \\times ${b} = ${ans}$` };
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
        return { clue: ph2, answer: String(ans2), worked: `$${dividend} \\div ${b2} = ${ans2}$` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            // two-decimal-place addition (a genuine step up from one-dp Easy)
            const a = ri(rng, 105, 999) / 100, b = ri(rng, 105, 999) / 100;
            const ans = round(a + b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A recipe needs $${a}$ kg of flour and $${b}$ kg of sugar. What is the total mass of ingredients?`,
                    `On Monday a shop sold $${a}$ kg of cheese and on Tuesday $${b}$ kg. Find the total sales.`,
                    `Two lengths of timber measure $${a}$ m and $${b}$ m. What is their combined length?`,
                ]);
                return { clue: ctx, answer: String(ans), worked: `$${a} + ${b} = ${ans}$` };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} + ${b}$`,
                `Add $${a}$ to $${b}$`,
                `Find the sum of $${a}$ and $${b}$`,
                `What is $${a} + ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${a} + ${b} = ${ans}$` };
        }
        if (type === 1) {
            // two-decimal-place subtraction
            const a = ri(rng, 205, 999) / 100, b = ri(rng, 105, Math.floor(a * 100) - 5) / 100;
            const ans = round(a - b, 2);
            if (rng() < 0.25) {
                const ctx = rc(rng, [
                    `A water tank holds $${a}$ L. $${b}$ L is used. How much remains?`,
                    `A plank is $${a}$ m long. A piece of $${b}$ m is cut off. What length is left?`,
                    `A bag weighs $${a}$ kg. After removing $${b}$ kg of contents, what is the new mass?`,
                ]);
                return { clue: ctx, answer: String(ans), worked: `$${a} - ${b} = ${ans}$` };
            }
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
                `Subtract $${b}$ from $${a}$`,
                `Find the difference of $${a}$ and $${b}$`,
                `What is $${a} - ${b}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${a} - ${b} = ${ans}$` };
        }
        if (type === 2) {
            // two-decimal-place number × small integer (exact, harder than 1dp×1dp)
            const a = ri(rng, 105, 999) / 100, b = ri(rng, 3, 12);
            const ph = rc(rng, [
                `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
                `Multiply $${a}$ by $${b}$`,
                `Find the product of $${a}$ and $${b}$`,
                `What is $${a} \\times ${b}$?`,
            ]);
            return { clue: ph, answer: String(round(a * b, 2)), worked: `$${a} \\times ${b} = ${round(a * b, 2)}$` };
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
        return { clue: ph3, answer: String(total), answerDisplay: `$${total.toFixed(2)}`, worked: `$${p1.toFixed(2)} + ${p2.toFixed(2)} = ${total.toFixed(2)}$` };
    }
    // Hard
    if (type === 0) {
        // three-number two-decimal-place addition (single span → harder mental arithmetic)
        const a = ri(rng, 105, 999) / 100, b = ri(rng, 105, 999) / 100, c = ri(rng, 105, 999) / 100;
        const ans = round(a + b + c, 2);
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} + ${b} + ${c}$`,
            `Find the sum of $${a}$, $${b}$ and $${c}$`,
            `What is $${a} + ${b} + ${c}$?`,
        ]);
        return { clue: ph, answer: String(ans), worked: `$${a} + ${b} + ${c} = ${ans}$` };
    }
    if (type === 1) {
        // division giving a non-terminating quotient — round to 2 decimal places
        const a = ri(rng, 25, 99) / 10, b = ri(rng, 12, 39) / 10;
        const ans = round(a / b, 2);
        const ph = rc(rng, [
            `Calculate $${a} \\div ${b}$, giving your answer to **2 decimal places**.`,
            `Divide $${a}$ by $${b}$ and round the answer to **2 decimal places**.`,
            `Find $${a} \\div ${b}$ correct to **2 decimal places**.`,
        ]);
        return { clue: ph, answer: String(ans), worked: `$${a} \\div ${b} = ${ans}$` };
    }
    if (type === 2) {
        const a = ri(rng, 101, 999) / 100, b = ri(rng, 100, Math.floor(a * 100) - 1) / 100;
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} - ${b}$`,
            `Subtract $${b}$ from $${a}$`,
            `Find the difference of $${a}$ and $${b}$`,
            `What is $${a} - ${b}$?`,
        ]);
        return { clue: ph, answer: String(round(a - b, 2)), worked: `$${a} - ${b} = ${round(a - b, 2)}$` };
    }
    if (type === 4) {
        // two-decimal-place number × small integer (exact, larger operands)
        const a = ri(rng, 105, 999) / 100, b = ri(rng, 4, 15);
        const ph = rc(rng, [
            `${rc(rng, CALC_VERBS)} $${a} \\times ${b}$`,
            `Multiply $${a}$ by $${b}$`,
            `Find the product of $${a}$ and $${b}$`,
            `What is $${a} \\times ${b}$?`,
        ]);
        return { clue: ph, answer: String(round(a * b, 2)), worked: `$${a} \\times ${b} = ${round(a * b, 2)}$` };
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
    return { clue: ph3h, answer: String(cost3), answerDisplay: `$${money(cost3)}`, worked: `$${len} \\times ${rate} = ${cost3}$` };
}

// ============================================================
// ROUNDING
// ============================================================
function genRounding(rng, diff, allowedOps) {
    const maps = {
        Easy:   { 'nearest': [0, 1, 2] },
        Medium: { 'nearest': [0, 3, 4, 5], 'decimal-places': [1, 2], 'sig-figs': [6] },
        Hard:   { 'nearest': [0, 4, 5], 'decimal-places': [1], 'sig-figs': [2, 3] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : diff === 'Medium' ? 6 : 5);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const n = ri(rng, 100, 9999);
            const ans = Math.round(n / 10) * 10;
            // 30% chance real-world context
            const d0 = n % 10;
            const dir0 = d0 >= 5 ? '≥ 5, round up' : '< 5, round down';
            const wk0 = `$${n} \\to ${ans}$ (ones digit ${d0} ${dir0})`;
            if (rng() < 0.3) {
                const ctx = rc(rng, [
                    `A car park has $${n}$ spaces. Round this to the nearest $10$.`,
                    `A school has $${n}$ students. Round to the nearest $10$.`,
                    `A town has a population of $${n}$. Round to the nearest $10$.`,
                ]);
                return { clue: ctx, answer: String(ans), worked: wk0 };
            }
            const ph = rc(rng, [
                `Round $${n}$ to the nearest $10$`,
                `Write $${n}$ rounded to the nearest $10$`,
                `Estimate $${n}$ to the nearest $10$`,
            ]);
            return { clue: ph, answer: String(ans), worked: wk0 };
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
            const dir1 = frac >= 5 ? '≥ 5, round up' : '< 5, round down';
            return { clue: ph, answer: String(Math.round(n)), worked: `$${n} \\to ${Math.round(n)}$ (tenths digit $${frac}$ ${dir1})` };
        }
        // type 2: nearest 100
        const n2 = ri(rng, 150, 9850);
        const ans2 = Math.round(n2 / 100) * 100;
        const ph2 = rc(rng, [
            `Round $${n2}$ to the nearest $100$`,
            `Write $${n2}$ rounded to the nearest $100$`,
            `Approximate $${n2}$ to the nearest $100$`,
        ]);
        const d2 = Math.floor(n2 / 10) % 10;
        const dir2 = d2 >= 5 ? '≥ 5, round up' : '< 5, round down';
        return { clue: ph2, answer: String(ans2), worked: `$${n2} \\to ${ans2}$ (tens digit $${d2}$ ${dir2})` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const n = ri(rng, 1000, 99999);
            const ans = Math.round(n / 100) * 100;
            const dM0 = Math.floor(n / 10) % 10;
            const dirM0 = dM0 >= 5 ? '≥ 5, round up' : '< 5, round down';
            const ph = rc(rng, [
                `Round $${n}$ to the nearest $100$`,
                `Approximate $${n}$ to the nearest $100$`,
                `Write $${n}$ correct to the nearest $100$`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${n} \\to ${ans}$ (tens digit $${dM0}$ ${dirM0})` };
        }
        if (type === 1) {
            const n = ri(rng, 100, 9999) / 100;
            const display = n.toFixed(2);
            const deciding1 = Math.floor(n * 100) % 10;
            const dir1dp = deciding1 >= 5 ? '≥ 5, round up' : '< 5, round down';
            const ph = rc(rng, [
                `Round $${display}$ to *1 decimal place*`,
                `Write $${display}$ correct to *1 decimal place*`,
                `Express $${display}$ to *1 decimal place*`,
            ]);
            return { clue: ph, answer: round(n, 1).toFixed(1), worked: `$${display} \\to ${round(n, 1).toFixed(1)}$ (2nd d.p. digit $${deciding1}$ ${dir1dp})` };
        }
        if (type === 2) {
            const n = ri(rng, 1000, 99999) / 1000;
            const display = n.toFixed(3);
            const deciding2 = Math.floor(n * 1000) % 10;
            const dir2dp = deciding2 >= 5 ? '≥ 5, round up' : '< 5, round down';
            const ph = rc(rng, [
                `Round $${display}$ to *2 decimal places*`,
                `Write $${display}$ correct to *2 decimal places*`,
                `Express $${display}$ to 2 d.p.`,
            ]);
            return { clue: ph, answer: round(n, 2).toFixed(2), worked: `$${display} \\to ${round(n, 2).toFixed(2)}$ (3rd d.p. digit $${deciding2}$ ${dir2dp})` };
        }
        if (type === 4) {
            // Estimation by rounding each factor to the nearest 10, then multiplying.
            const a = ri(rng, 11, 89), b = ri(rng, 11, 89);
            const ra = Math.round(a / 10) * 10, rb = Math.round(b / 10) * 10;
            const ans = ra * rb;
            const ph = rc(rng, [
                `*Estimate* $${a} \\times ${b}$ by rounding each number to the nearest $10$`,
                `By rounding each number to the nearest $10$, estimate $${a} \\times ${b}$`,
                `Use rounding to the nearest $10$ to *estimate* the product $${a} \\times ${b}$`,
            ]);
            const worked = `$${a} \\times ${b} \\approx ${ra} \\times ${rb} = ${ans}$`;
            return { clue: ph, answer: String(ans), worked };
        }
        if (type === 5) {
            // Round to nearest 25 (common in time / currency / measurement).
            const factor = rc(rng, [25, 50]);
            const n = ri(rng, factor * 2, factor * 80);
            const ans = Math.round(n / factor) * factor;
            const ph = rc(rng, [
                `Round $${n}$ to the nearest $${factor}$`,
                `Write $${n}$ correct to the nearest $${factor}$`,
                `Approximate $${n}$ to the nearest $${factor}$`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${n} \\to ${ans}$ (nearest $${factor}$)` };
        }
        if (type === 6) {
            // Round to 1 significant figure — bridges to the 2-3 s.f. work at Hard.
            const n = ri(rng, 100, 9999);
            const factor = Math.pow(10, Math.floor(Math.log10(n)));
            const ans = Math.round(n / factor) * factor;
            const orderAbove = Math.pow(10, Math.floor(Math.log10(n)) + 1);
            const edgeNote = ans >= orderAbove ? ' *Note: trailing zeros are not significant.*' : '';
            const ph = rc(rng, [
                `Round $${n}$ to *1 significant figure*${edgeNote}`,
                `Write $${n}$ correct to *1 significant figure*${edgeNote}`,
                `Express $${n}$ to 1 s.f.${edgeNote}`,
            ]);
            const d6 = Math.floor(n / (factor / 10)) % 10;
            const dir6 = d6 >= 5 ? '≥ 5, round up' : '< 5, round down';
            return { clue: ph, answer: String(ans), worked: `$${n} \\to ${ans}$ (2nd digit $${d6}$ ${dir6})` };
        }
        // type 3: nearest 5
        const n3 = ri(rng, 12, 295);
        const ans3 = Math.round(n3 / 5) * 5;
        const ph3 = rc(rng, [
            `Round $${n3}$ to the nearest $5$`,
            `Write $${n3}$ rounded to the nearest $5$`,
            `A crowd of $${n3}$ is reported to the nearest $5$. State the figure.`,
        ]);
        return { clue: ph3, answer: String(ans3), worked: `$${n3} \\to ${ans3}$ (nearest $5$)` };
    }
    // Hard
    if (type === 0) {
        const n = ri(rng, 10000, 999999);
        const ans = Math.round(n / 1000) * 1000;
        const dH0 = Math.floor(n / 100) % 10;
        const dirH0 = dH0 >= 5 ? '≥ 5, round up' : '< 5, round down';
        const ph = rc(rng, [
            `Round $${n}$ to the nearest $1000$`,
            `Write $${n}$ correct to the nearest $1000$`,
            `Approximate $${n}$ to the nearest $1000$`,
        ]);
        return { clue: ph, answer: String(ans), worked: `$${n} \\to ${ans}$ (hundreds digit $${dH0}$ ${dirH0})` };
    }
    if (type === 1) {
        // round to 3 or 4 decimal places (the source value carries one extra place)
        const dp = rc(rng, [3, 4]);
        const denom = Math.pow(10, dp + 1);
        const n = ri(rng, denom, denom * 100 - 1) / denom;
        const display = n.toFixed(dp + 1);
        const decidingDp = Math.floor(n * denom) % 10;
        const dirDp = decidingDp >= 5 ? '≥ 5, round up' : '< 5, round down';
        const ph = rc(rng, [
            `Round $${display}$ to ${dp} decimal places`,
            `Express $${display}$ correct to ${dp} decimal places`,
            `Write $${display}$ to ${dp} d.p.`,
        ]);
        return { clue: ph, answer: round(n, dp).toFixed(dp), worked: `$${display} \\to ${round(n, dp).toFixed(dp)}$ (${dp + 1}th d.p. $${decidingDp}$ ${dirDp})` };
    }
    if (type === 2) {
        const sigFigs = rc(rng, [1, 2]);
        const n = sigFigs === 1 ? ri(rng, 100, 9999) : ri(rng, 1000, 99999);
        const factor = Math.pow(10, Math.floor(Math.log10(n)) - (sigFigs - 1));
        const ans = Math.round(n / factor) * factor;
        const sfLabel = `${sigFigs} significant figure${sigFigs > 1 ? 's' : ''}`;
        const orderAbove = Math.pow(10, Math.floor(Math.log10(n)) + 1);
        const edgeNote = ans >= orderAbove ? ' *Note: trailing zeros are not significant.*' : '';
        const decidingSf = Math.floor(n / (factor / 10)) % 10;
        const dirSf = decidingSf >= 5 ? '≥ 5, round up' : '< 5, round down';
        const ph = rc(rng, [
            `Round $${n}$ to ${sfLabel}${edgeNote}`,
            `Write $${n}$ correct to ${sfLabel}${edgeNote}`,
            `Express $${n}$ to ${sfLabel}${edgeNote}`,
        ]);
        return { clue: ph, answer: String(ans), worked: `$${n} \\to ${ans}$ (next digit $${decidingSf}$ ${dirSf})` };
    }
    if (type === 4) {
        // Estimation: round each number to the nearest 100, then add or multiply.
        const useProduct = rng() < 0.5;
        if (useProduct) {
            const a = ri(rng, 110, 890), b = ri(rng, 11, 89);
            const ra = Math.round(a / 100) * 100, rb = Math.round(b / 10) * 10;
            const ans = ra * rb;
            const ph = rc(rng, [
                `*Estimate* $${a} \\times ${b}$ by rounding to the nearest $100$ and $10$`,
                `Use rounding to *estimate* the product $${a} \\times ${b}$`,
            ]);
            const worked = `$${a} \\times ${b} \\approx ${ra} \\times ${rb} = ${ans}$`;
            return { clue: ph, answer: String(ans), worked };
        }
        const a = ri(rng, 150, 4850), b = ri(rng, 150, 4850), c = ri(rng, 150, 4850);
        const ra = Math.round(a / 100) * 100, rb = Math.round(b / 100) * 100, rc2 = Math.round(c / 100) * 100;
        const ans = ra + rb + rc2;
        const ph = rc(rng, [
            `*Estimate* $${a} + ${b} + ${c}$ by rounding each to the nearest $100$`,
            `By rounding each number to the nearest $100$, estimate $${a} + ${b} + ${c}$`,
        ]);
        const worked = `$\\approx ${ra} + ${rb} + ${rc2} = ${ans}$`;
        return { clue: ph, answer: String(ans), worked };
    }
    if (type === 5) {
        // Estimation by division. Round dividend and divisor sensibly, then divide.
        // Pick a divisor and a dividend designed to give a clean integer ratio
        // after rounding (so the answer is a tidy number to compute mentally).
        const divisor = rc(rng, [10, 20, 25, 50, 100]);
        const quotient = ri(rng, 4, 30);
        const noise = ri(rng, -divisor / 4 | 0, divisor / 4 | 0);
        const dividend = divisor * quotient + noise;
        const roundedD = Math.round(dividend / divisor) * divisor;
        const ans = roundedD / divisor;
        const ph = rc(rng, [
            `*Estimate* $${dividend} \\div ${divisor}$ by rounding $${dividend}$ first.`,
            `Use rounding to *estimate* $${dividend} \\div ${divisor}$.`,
        ]);
        const worked = `$\\approx ${roundedD} \\div ${divisor} = ${ans}$`;
        return { clue: ph, answer: String(ans), worked };
    }
    // type 3: 3 significant figures
    const n3sf = ri(rng, 10000, 999999);
    const f3   = Math.pow(10, Math.floor(Math.log10(n3sf)) - 2);
    const ans3sf = Math.round(n3sf / f3) * f3;
    const deciding3sf = Math.floor(n3sf / (f3 / 10)) % 10;
    const dir3sf = deciding3sf >= 5 ? '≥ 5, round up' : '< 5, round down';
    const ph3sf = rc(rng, [
        `Round $${n3sf}$ to *3 significant figures*`,
        `Write $${n3sf}$ correct to *3 significant figures*`,
        `Express $${n3sf}$ to 3 s.f.`,
    ]);
    return { clue: ph3sf, answer: String(ans3sf), worked: `$${n3sf} \\to ${ans3sf}$ (4th s.f. $${deciding3sf}$ ${dir3sf})` };
}

// ============================================================
// FRACTIONS — answers are always integers or simple decimals
// ============================================================
function genFractions(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'fraction-of': [0, 3], 'add-subtract': [1], 'simplify-convert': [2] },
        Medium: { 'add-subtract': [0], 'multiply-divide': [1], 'simplify-convert': [2, 3, 4] },
        Hard:   { 'multiply-divide': [0], 'add-subtract': [1], 'simplify-convert': [2] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Hard' ? 2 : (diff === 'Medium' ? 4 : 3));
    if (type === -1) return null;

    const calcVerb = rc(rng, CALC_VERBS);
    if (diff === 'Easy') {
        if (type === 0) {
            const den = rc(rng, [2, 3, 4, 5, 6, 8, 10]);
            const num = ri(rng, 1, den - 1);
            const whole = den * ri(rng, 3, 15);
            const ans = (num * whole) / den;
            // 35% chance real-world context. Pair each clue with its noun so the
            // worksheet answer line and answer key can show the unit (e.g.
            // "12 students") instead of a bare number.
            if (rng() < 0.35) {
                const wp = rc(rng, [
                    { c: `A class has $${whole}$ students. $\\frac{${num}}{${den}}$ of them play sport. How many students play sport?`, n: 'students' },
                    { c: `There are $${whole}$ lollies in a bag. Tom eats $\\frac{${num}}{${den}}$ of them. How many lollies did Tom eat?`, n: 'lollies' },
                    { c: `A farm has $${whole}$ animals. $\\frac{${num}}{${den}}$ are cows. How many cows are there?`, n: 'cows' },
                ]);
                return { clue: wp.c, answer: String(ans), answerDisplay: `${ans} ${wp.n}`, unit: wp.n, worked: `$\\frac{${num}}{${den}} \\times ${whole} = ${ans}$` };
            }
            const ph = rc(rng, [
                `Find $\\frac{${num}}{${den}}$ of $${whole}$`,
                `Calculate $\\frac{${num}}{${den}}$ of $${whole}$`,
                `Determine $\\frac{${num}}{${den}}$ of $${whole}$`,
                `What is $\\frac{${num}}{${den}}$ of $${whole}$?`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$\\frac{${num}}{${den}} \\times ${whole} = ${ans}$` };
        }
        if (type === 1) {
            // ~40% unlike-denominator pairs where one divides the other
            if (rng() < 0.4) {
                const pairs = [[2, 4], [2, 6], [2, 8], [2, 10], [3, 6], [3, 9], [3, 12], [4, 8], [4, 12], [5, 10]];
                const [sd, ld] = rc(rng, pairs);
                const n1 = ri(rng, 1, sd - 1), n2 = ri(rng, 1, ld - 1);
                const e1 = n1 * (ld / sd), sumNum = e1 + n2;
                const { n: sn1, d: sd1 } = simplify(sumNum, ld);
                const ans = sd1 === 1 ? String(sn1) : `$\\frac{${sn1}}{${sd1}}$`;
                const inlineAns1 = sd1 === 1 ? String(sn1) : `\\frac{${sn1}}{${sd1}}`;
                const worked = `$\\frac{${e1}}{${ld}} + \\frac{${n2}}{${ld}} = \\frac{${sumNum}}{${ld}} = ${inlineAns1}$`;
                return { clue: `${calcVerb} $\\frac{${n1}}{${sd}} + \\frac{${n2}}{${ld}}$`, answer: ans, worked };
            }
            const den = rc(rng, [3, 4, 5, 6, 8, 10, 12]);
            const n1 = ri(rng, 1, den - 2), n2 = ri(rng, 1, den - n1 - 1);
            const { n: sn1, d: sd1 } = simplify(n1 + n2, den);
            const ans = sd1 === 1 ? String(sn1) : `$\\frac{${sn1}}{${sd1}}$`;
            const inlineAns1 = sd1 === 1 ? String(sn1) : `\\frac{${sn1}}{${sd1}}`;
            const worked = `$\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}} = \\frac{${n1+n2}}{${den}} = ${inlineAns1}$`;
            return { clue: `${calcVerb} $\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}}$`, answer: ans, worked };
        }
        if (type === 2) {
            const den = rc(rng, [4, 6, 8, 9, 10, 12, 14, 15, 18, 20]);
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
                `Write $\\frac{${num}}{${den}}$ in its **simplest form**`,
                `Express $\\frac{${num}}{${den}}$ in **lowest terms**`,
                `Reduce $\\frac{${num}}{${den}}$ to its *simplest form*`,
            ]);
            const g = gcd(num, den);
            const inlineSimp = (den/g) === 1 ? String(num/g) : `\\frac{${num/g}}{${den/g}}`;
            return { clue: ph, answer: ans, worked: `$\\frac{${num}}{${den}} = \\frac{${num}\\div${g}}{${den}\\div${g}} = ${inlineSimp}$` };
        }
        // type 3: fraction-of with real-world context
        const den3 = rc(rng, [2, 3, 4, 5, 6, 8, 10]);
        const num3 = ri(rng, 1, den3 - 1);
        const whole3 = den3 * ri(rng, 3, 15);
        const ans3 = (num3 * whole3) / den3;
        const ctx3 = rc(rng, [
            `$${whole3}$ students walk to school. $\\frac{${num3}}{${den3}}$ of them walk every day. How many is that?`,
            `A pizza has $${whole3}$ slices. $\\frac{${num3}}{${den3}}$ of the pizza is eaten. How many slices is that?`,
            `There are $${whole3}$ marbles in a bag. $\\frac{${num3}}{${den3}}$ are red. How many red marbles are there?`,
        ]);
        return { clue: ctx3, answer: String(ans3), worked: `$\\frac{${num3}}{${den3}} \\times ${whole3} = ${ans3}$` };
    }

    if (diff === 'Medium') {
        if (type === 0) {
            const d1 = rc(rng, [2, 3, 4, 5, 6, 7]), d2 = rc(rng, [3, 4, 5, 6, 7, 8]);
            const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
            const l = lcm(d1, d2);
            const e1 = n1 * (l / d1), e2 = n2 * (l / d2);
            // ~30% subtraction
            if (rng() < 0.3 && e1 !== e2) {
                const [bigE, smE] = e1 > e2 ? [e1, e2] : [e2, e1];
                const [bigN, bigD, smN, smD] = e1 > e2 ? [n1, d1, n2, d2] : [n2, d2, n1, d1];
                const { n: sn2, d: sd2 } = simplify(bigE - smE, l);
                const ans = sd2 === 1 ? String(sn2) : `$\\frac{${sn2}}{${sd2}}$`;
                const inlineAns2 = sd2 === 1 ? String(sn2) : `\\frac{${sn2}}{${sd2}}`;
                const worked = `LCD $= ${l}$: $\\frac{${bigE}}{${l}} - \\frac{${smE}}{${l}} = \\frac{${bigE-smE}}{${l}} = ${inlineAns2}$`;
                return { clue: `${calcVerb} $\\frac{${bigN}}{${bigD}} - \\frac{${smN}}{${smD}}$`, answer: ans, worked };
            }
            const { n: sn2, d: sd2 } = simplify(e1 + e2, l);
            const ans = sd2 === 1 ? String(sn2) : `$\\frac{${sn2}}{${sd2}}$`;
            const inlineAns2 = sd2 === 1 ? String(sn2) : `\\frac{${sn2}}{${sd2}}`;
            const worked = `LCD $= ${l}$: $\\frac{${e1}}{${l}} + \\frac{${e2}}{${l}} = \\frac{${e1+e2}}{${l}} = ${inlineAns2}$`;
            return { clue: `${calcVerb} $\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}$`, answer: ans, worked };
        }
        if (type === 1) {
            const d1 = ri(rng, 2, 10), n1 = ri(rng, 1, d1 - 1);
            const d2 = ri(rng, 2, 10), n2 = ri(rng, 1, d2 - 1);
            const ans = fracStr(n1 * n2, d1 * d2);
            const { n: _mn, d: _md } = simplify(n1 * n2, d1 * d2);
            const _inlineMul = _md === 1 ? String(_mn) : `\\frac{${_mn}}{${_md}}`;
            const ph = rc(rng, [
                `${calcVerb} $\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$`,
                `Multiply $\\frac{${n1}}{${d1}}$ by $\\frac{${n2}}{${d2}}$`,
                `Find the product of $\\frac{${n1}}{${d1}}$ and $\\frac{${n2}}{${d2}}$`,
                `What is $\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$?`,
            ]);
            return { clue: ph, answer: ans, worked: `$\\frac{${n1} \\times ${n2}}{${d1} \\times ${d2}} = \\frac{${n1*n2}}{${d1*d2}} = ${_inlineMul}$` };
        }
        if (type === 2) {
            // ~35% mixed number → improper fraction variant
            if (rng() < 0.35) {
                const denC = rc(rng, [2, 3, 4, 5, 6, 8]);
                const wholeC = ri(rng, 1, 6);
                const numC = ri(rng, 1, denC - 1);
                const improperAns = wholeC * denC + numC;
                const ph = rc(rng, [
                    `Convert $${wholeC}\\frac{${numC}}{${denC}}$ to an *improper fraction*`,
                    `Write $${wholeC}\\frac{${numC}}{${denC}}$ as an *improper fraction*`,
                    `Express $${wholeC}\\frac{${numC}}{${denC}}$ as an *improper fraction*`,
                ]);
                return { clue: ph, answer: `$\\frac{${improperAns}}{${denC}}$`, worked: `$${wholeC} \\times ${denC} + ${numC} = ${improperAns}$` };
            }
            const den = rc(rng, [2, 4, 5, 8, 10, 20, 25]);
            const num = ri(rng, 1, den - 1);
            const ans = round(num / den, 4);
            const ph = rc(rng, [
                `Convert $\\frac{${num}}{${den}}$ to a *decimal*`,
                `Express $\\frac{${num}}{${den}}$ as a *decimal*`,
                `Write $\\frac{${num}}{${den}}$ as a *decimal number*`,
            ]);
            return { clue: ph, answer: String(ans), worked: `$${num} \\div ${den} = ${ans}$` };
        }
        if (type === 4) {
            // fraction → percentage (denominators that divide 100 → clean %)
            const den = rc(rng, [2, 4, 5, 10, 20, 25, 50]);
            const num = ri(rng, 1, den - 1);
            const pct = num * (100 / den);
            const ph = rc(rng, [
                `Convert $\\frac{${num}}{${den}}$ to a *percentage*`,
                `Express $\\frac{${num}}{${den}}$ as a *percentage*`,
                `Write $\\frac{${num}}{${den}}$ as a *percentage*`,
            ]);
            return { clue: ph, answer: String(pct), answerDisplay: `${pct}%`, worked: `$\\frac{${num}}{${den}} \\times 100 = ${pct}\\%$` };
        }
        // type 3: improper fraction → mixed number
        const denM = rc(rng, [2, 3, 4, 5, 6, 7, 8, 10]);
        const wholeM = ri(rng, 2, 8);
        const numRem = ri(rng, 1, denM - 1);
        const improper = wholeM * denM + numRem;
        const { n: sn, d: sd } = simplify(numRem, denM);
        const mixedAns = sd === 1 ? `${wholeM + sn}` : `${wholeM} ${sn}/${sd}`;
        const ph3 = rc(rng, [
            `Write $\\frac{${improper}}{${denM}}$ as a *mixed number*`,
            `Convert $\\frac{${improper}}{${denM}}$ to a *mixed number*`,
            `Express $\\frac{${improper}}{${denM}}$ as a *mixed number*`,
        ]);
        return { clue: ph3, answer: mixedAns, worked: `$${improper} \\div ${denM} = ${wholeM}$ remainder $${numRem}$` };
    }

    // Hard
    if (type === 0) {
        // Build coprime fractions directly: pick d, then pick n from coprime candidates
        const d1 = ri(rng, 3, 12);
        const cops1 = Array.from({ length: d1 - 1 }, (_, i) => i + 1).filter(n => gcd(n, d1) === 1);
        const n1 = rc(rng, cops1);
        const d2 = ri(rng, 3, 12);
        const cops2 = Array.from({ length: d2 - 1 }, (_, i) => i + 1).filter(n => gcd(n, d2) === 1);
        const n2 = rc(rng, cops2);
        const ans = fracStr(n1 * d2, d1 * n2);
        const { n: _dn, d: _dd } = simplify(n1 * d2, d1 * n2);
        const _inlineDiv = _dd === 1 ? String(_dn) : `\\frac{${_dn}}{${_dd}}`;
        const ph = rc(rng, [
            `${calcVerb} $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$`,
            `Divide $\\frac{${n1}}{${d1}}$ by $\\frac{${n2}}{${d2}}$`,
            `Find the quotient of $\\frac{${n1}}{${d1}}$ and $\\frac{${n2}}{${d2}}$`,
            `What is $\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$?`,
        ]);
        return { clue: ph, answer: ans, worked: `$\\frac{${n1}}{${d1}} \\times \\frac{${d2}}{${n2}} = \\frac{${n1*d2}}{${d1*n2}} = ${_inlineDiv}$` };
    }
    if (type === 1) {
        // ~35% mixed number subtraction
        if (rng() < 0.35) {
            const denA = rc(rng, [3, 4, 5, 6, 7, 8, 9]);
            const denB = rc(rng, [3, 4, 5, 6, 7, 8, 9].filter(d => d !== denA));
            const wA = ri(rng, 2, 5), nA = ri(rng, 1, denA - 1);
            const wB = ri(rng, 1, wA - 1), nB = ri(rng, 1, denB - 1);
            const l = lcm(denA, denB);
            const totalA = (wA * denA + nA) * (l / denA);
            const totalB = (wB * denB + nB) * (l / denB);
            if (totalA <= totalB) return genFractions(rng, diff, allowedOps, _depth + 1);
            const diff_num = totalA - totalB;
            const ans = fracStr(diff_num, l);
            // If result > 1 show as mixed number
            const wholeRes = Math.floor(diff_num / l);
            const remRes = diff_num % l;
            let displayAns = ans;
            if (wholeRes > 0 && remRes > 0) {
                const { n: rn, d: rd } = simplify(remRes, l);
                displayAns = `$${wholeRes}\\frac{${rn}}{${rd}}$`;
            }
            const { n: _sn, d: _sd } = simplify(diff_num, l);
            const _inlineAns = _sd === 1 ? String(_sn) : `\\frac{${_sn}}{${_sd}}`;
            return { clue: `${calcVerb} $${wA}\\frac{${nA}}{${denA}} - ${wB}\\frac{${nB}}{${denB}}$`, answer: displayAns, worked: `LCD = $${l}$: $\\frac{${totalA}}{${l}} - \\frac{${totalB}}{${l}} = \\frac{${diff_num}}{${l}} = ${_inlineAns}$` };
        }
        const dPool = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const d1 = rc(rng, dPool);
        const d2 = rc(rng, dPool.filter(d => d !== d1));
        const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
        const l = lcm(d1, d2);
        const a = n1 * (l / d1), b = n2 * (l / d2);
        const [bigN, bigD, smN, smD] = a > b ? [n1, d1, n2, d2] : [n2, d2, n1, d1];
        const numResult = Math.abs(a - b);
        if (numResult === 0) return genFractions(rng, diff, allowedOps, _depth + 1);
        const ans = fracStr(numResult, l);
        const { n: _un, d: _ud } = simplify(numResult, l);
        const _inlineUnlike = _ud === 1 ? String(_un) : `\\frac{${_un}}{${_ud}}`;
        return { clue: `${calcVerb} $\\frac{${bigN}}{${bigD}} - \\frac{${smN}}{${smD}}$`, answer: ans, worked: `LCD = $${l}$: $\\frac{${Math.max(a,b)}}{${l}} - \\frac{${Math.min(a,b)}}{${l}} = \\frac{${numResult}}{${l}} = ${_inlineUnlike}$` };
    }
    // type 2: simplify-convert — fraction→percentage (40%), recurring decimal (25%), clean decimal (35%)
    const convRoll = rng();
    if (convRoll < 0.4) {
        const den = rc(rng, [4, 5, 8, 16, 20, 25, 40, 50, 80]);
        const num = ri(rng, 1, den - 1);
        const pct = round((num / den) * 100, 2);
        const ph = rc(rng, [
            `Convert $\\frac{${num}}{${den}}$ to a *percentage*`,
            `Express $\\frac{${num}}{${den}}$ as a *percentage*`,
            `Write $\\frac{${num}}{${den}}$ as a *percentage*`,
        ]);
        return { clue: ph, answer: String(pct), answerDisplay: `${pct}%`, worked: `$\\frac{${num}}{${den}} \\times 100 = ${pct}\\%$` };
    }
    if (convRoll < 0.65) {
        // recurring decimal: denominators that don't divide powers of 10
        const den = rc(rng, [3, 6, 7, 9, 11, 12]);
        const num = ri(rng, 1, den - 1);
        if (gcd(num, den) > 1) return genFractions(rng, diff, allowedOps, _depth + 1);
        const ans = round(num / den, 4);
        const ph = rc(rng, [
            `Convert $\\frac{${num}}{${den}}$ to a *decimal* (round to 4 d.p.)`,
            `Express $\\frac{${num}}{${den}}$ as a *decimal* (4 decimal places)`,
            `Write $\\frac{${num}}{${den}}$ as a *decimal*, rounding to 4 d.p.`,
        ]);
        return { clue: ph, answer: String(ans), worked: `$${num} \\div ${den} = ${ans}$` };
    }
    const denH = rc(rng, [2, 4, 5, 8, 10, 16, 20, 25, 40]);
    const numH = ri(rng, 1, denH - 1);
    const ansH = round(numH / denH, 4);
    const phH = rc(rng, [
        `Convert $\\frac{${numH}}{${denH}}$ to a *decimal*`,
        `Express $\\frac{${numH}}{${denH}}$ as a *decimal*`,
        `Write $\\frac{${numH}}{${denH}}$ as a *decimal number*`,
    ]);
    return { clue: phH, answer: String(ansH), worked: `$${numH} \\div ${denH} = ${ansH}$` };
}

// ============================================================
// PERCENTAGES
// ============================================================
function genPercentages(rng, diff, allowedOps, _depth = 0) {
    if (_depth > 25) return null;
    const maps = {
        Easy:   { 'find-pct': [0, 2], 'increase-decrease': [1] },
        Medium: { 'find-pct': [0, 2], 'increase-decrease': [1, 3] },
        Hard:   { 'reverse-change': [0, 1], 'find-pct': [2], 'increase-decrease': [3, 4] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);

    if (diff === 'Easy') {
        const typeE = _pickType(rng, filtered, 2);
        if (typeE === -1) return null;
        if (typeE === 2) {
            // express "a out of b" as a percentage (b divides 100 → clean %)
            const b = rc(rng, [4, 5, 10, 20, 25, 50, 100]);
            const a = ri(rng, 1, b - 1);
            const pct = a * (100 / b);
            const ph = rc(rng, [
                `What percentage is $${a}$ out of $${b}$?`,
                `Express $${a}$ out of $${b}$ as a percentage`,
                `A student scored $${a}$ out of $${b}$. What percentage is this?`,
                `In a test, $${a}$ of $${b}$ questions were correct. What percentage is that?`,
            ]);
            const worked = `$\\frac{${a}}{${b}} \\times 100 = ${pct}$`;
            return { clue: ph, answer: String(pct), answerDisplay: `${pct}%`, worked };
        }
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
            const worked = `$\\frac{${pct}}{100} \\times ${whole} = ${ans}$`;
            return { clue: ph, answer: String(ans), answerDisplay: String(ans), worked };
        }
        // typeE 1: sale-price after discount OR price increase
        if (rng() < 0.4) {
            // price increase variant (adds variety)
            const pctUp = rc(rng, [10, 20, 25, 50]);
            const denomUp = { 10: 10, 20: 5, 25: 4, 50: 2 };
            const wholeUp = ri(rng, 1, 20) * (denomUp[pctUp] || 10);
            const incAns = Math.round(wholeUp * (1 + pctUp / 100));
            const phUp = rc(rng, [
                `A $\\$${wholeUp}$ item is marked up by $${pctUp}\\%$. Find the **new** price.`,
                `Increase $\\$${wholeUp}$ by $${pctUp}\\%$.`,
                `A price of $\\$${wholeUp}$ rises by $${pctUp}\\%$. What is the **new** price?`,
            ]);
            const incAmt = Math.round(wholeUp * pctUp / 100);
            return { clue: phUp, answer: String(incAns), answerDisplay: `$${money(incAns)}`, worked: `$${wholeUp} + ${incAmt} = ${incAns}$` };
        }
        const pctD = rc(rng, [10, 20, 25, 50]);
        const denomD = { 10: 10, 20: 5, 25: 4, 50: 2 };
        const wholeD = ri(rng, 1, 20) * (denomD[pctD] || 10);
        const saleAns = Math.round(wholeD * (1 - pctD / 100));
        const phD = rc(rng, [
            `A $\\$${wholeD}$ item is reduced by $${pctD}\\%$. Find the *sale price*.`,
            `Calculate the price after a $${pctD}\\%$ discount on $\\$${wholeD}$.`,
            `A discount of $${pctD}\\%$ is applied to $\\$${wholeD}$. What is the *final price*?`,
        ]);
        const discAmtE = Math.round(wholeD * pctD / 100);
        return { clue: phD, answer: String(saleAns), answerDisplay: `$${money(saleAns)}`, worked: `$${wholeD} - ${discAmtE} = ${saleAns}$` };
    }
    if (diff === 'Medium') {
        const type = _pickType(rng, filtered, 3);
        if (type === -1) return null;
        if (type === 0) {
            const pct = rc(rng, [5, 10, 15, 20, 30, 35, 40, 60, 65, 70, 80]);
            const candidates = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 250, 300, 400, 500];
            for (let i = 0; i < 25; i++) {
                const whole = rc(rng, candidates);
                const ans = (pct / 100) * whole;
                if (Number.isInteger(ans)) {
                    const ph = rc(rng, [
                        `Find $${pct}\\%$ of $${whole}$`,
                        `Calculate $${pct}\\%$ of $${whole}$`,
                        `Determine $${pct}\\%$ of $${whole}$`,
                        `What is $${pct}\\%$ of $${whole}$?`,
                    ]);
                    const worked = `$${pct}\\% \\times ${whole} = \\frac{${pct}}{100} \\times ${whole} = ${ans}$`;
                    return { clue: ph, answer: String(ans), worked };
                }
            }
            return genPercentages(rng, diff, allowedOps, _depth + 1);
        }
        if (type === 1) {
            // multiples of 20 guarantee integer results for the percentage pool
            const orig = ri(rng, 1, 20) * 20;
            const pct = rc(rng, [5, 10, 15, 20, 25, 40, 50]);
            const ans = orig * (1 + pct / 100);
            const ctx = rc(rng, ['price', 'value', 'amount', 'score', 'population', 'membership']);
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
        if (type === 2) {
            const b = rc(rng, [8, 10, 16, 20, 25, 40, 50, 100]);
            const a = ri(rng, 1, b - 1);
            const ans = (a / b) * 100;
            if (!Number.isInteger(ans)) return genPercentages(rng, diff, allowedOps, _depth + 1);
            const ph = rc(rng, [
                `Express $${a}$ out of $${b}$ as a percentage`,
                `Write $${a}$ out of $${b}$ as a percentage`,
                `$${a}$ out of $${b}$ — calculate the percentage`,
                `What percentage is $${a}$ of $${b}$?`,
            ]);
            return { clue: ph, answer: String(ans), answerDisplay: `${ans}%`, worked: `$\\frac{${a}}{${b}} \\times 100 = ${ans}\\%$` };
        }
        // type 3: decrease/discount — multiples of 20 guarantee integer results
        const origDec = ri(rng, 1, 20) * 20;
        const pctDec = rc(rng, [5, 10, 15, 20, 25, 40, 50]);
        const ansDec = origDec * (1 - pctDec / 100);
        const ctxDec = rc(rng, ['price', 'salary', 'value', 'cost', 'attendance']);
        const phDec = rc(rng, [
            `Decrease $${origDec}$ by $${pctDec}\\%$`,
            `A ${ctxDec} of $${origDec}$ is reduced by $${pctDec}\\%$. Find the **new** ${ctxDec}.`,
            `A $\\$${origDec}$ item is discounted by $${pctDec}\\%$. Find the *sale price*.`,
            `Calculate the result of decreasing $${origDec}$ by $${pctDec}\\%$`,
        ]);
        const multDec = 1 - pctDec / 100;
        return { clue: phDec, answer: String(ansDec), worked: `$${origDec} \\times ${multDec} = ${ansDec}$` };
    }
    // Hard
    const type = _pickType(rng, filtered, 4);
    if (type === -1) return null;
    if (type === 0) {
        // reverse a percentage increase: find the original
        const orig = ri(rng, 5, 20) * 20;
        const pct = rc(rng, [10, 20, 25, 50]);
        const final = round(orig * (1 + pct / 100), 2);
        const ph = rc(rng, [
            `After a $${pct}\\%$ increase the value is $${final}$. Find the **original**.`,
            `A quantity increases by $${pct}\\%$ to become $${final}$. Determine the **original** value.`,
            `The result after a $${pct}\\%$ increase is $${final}$. Calculate the **original** amount.`,
        ]);
        const multRev = 1 + pct / 100;
        return { clue: ph, answer: String(orig), worked: `$${final} \\div ${multRev} = ${orig}$` };
    }
    if (type === 1) {
        // percentage change given before and after (increase or decrease)
        const orig = ri(rng, 4, 20) * 25;
        const pct = rc(rng, [10, 20, 25, 40, 50]);
        const goUp = rng() < 0.5;
        const newVal = round(orig * (goUp ? 1 + pct / 100 : 1 - pct / 100), 2);
        if (!Number.isInteger(newVal) || newVal <= 0) return genPercentages(rng, diff, allowedOps, _depth + 1);
        const ph = goUp
            ? rc(rng, [
                `A price rises from $\\$${orig}$ to $\\$${newVal}$. What is the *percentage increase*?`,
                `Calculate the *percentage increase* from $\\$${orig}$ to $\\$${newVal}$.`,
              ])
            : rc(rng, [
                `A price falls from $\\$${orig}$ to $\\$${newVal}$. What is the *percentage decrease*?`,
                `Calculate the *percentage decrease* from $\\$${orig}$ to $\\$${newVal}$.`,
              ]);
        const change = Math.abs(newVal - orig);
        return { clue: ph, answer: String(pct), answerDisplay: `${pct}%`, worked: `$\\frac{${change}}{${orig}} \\times 100 = ${pct}\\%$` };
    }
    if (type === 2) {
        // find an awkward percentage of a larger number (genuinely harder mental work)
        const pct = rc(rng, [5, 15, 35, 45, 55, 65, 85, 12.5, 37.5, 62.5]);
        const candidates = [80, 120, 160, 200, 240, 320, 400, 600, 800, 1000, 1200];
        for (let i = 0; i < 25; i++) {
            const whole = rc(rng, candidates);
            const ans = (pct / 100) * whole;
            if (Number.isInteger(ans)) {
                const ph = rc(rng, [
                    `Find $${pct}\\%$ of $${whole}$`,
                    `Calculate $${pct}\\%$ of $${whole}$`,
                    `Determine $${pct}\\%$ of $${whole}$`,
                ]);
                return { clue: ph, answer: String(ans), worked: `$\\frac{${pct}}{100} \\times ${whole} = ${ans}$` };
            }
        }
        return genPercentages(rng, diff, allowedOps, _depth + 1);
    }
    if (type === 3) {
        // successive percentage change — multi-step
        const orig = ri(rng, 2, 10) * 100;
        const p1 = rc(rng, [10, 20, 25, 50]);
        const p2 = rc(rng, [10, 20, 25, 50]);
        const dir1 = rng() < 0.5 ? 'increased' : 'decreased';
        const dir2 = rng() < 0.5 ? 'increased' : 'decreased';
        const afterFirst = dir1 === 'increased' ? orig * (1 + p1 / 100) : orig * (1 - p1 / 100);
        const final = dir2 === 'increased' ? afterFirst * (1 + p2 / 100) : afterFirst * (1 - p2 / 100);
        if (!Number.isInteger(final) || final <= 0) return genPercentages(rng, diff, allowedOps, _depth + 1);
        const ph = rc(rng, [
            `A value of $${orig}$ is ${dir1} by $${p1}\\%$, then ${dir2} by $${p2}\\%$. Find the **final** value.`,
            `Starting at $${orig}$, a quantity is ${dir1} by $${p1}\\%$ and then ${dir2} by $${p2}\\%$. What is the final amount?`,
        ]);
        return { clue: ph, answer: String(final), worked: `$${orig} \\to ${afterFirst} \\to ${final}$` };
    }
    // type 4: percentage of a percentage (cascading)
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
    return { clue: ph, answer: String(ans2), worked: `$${pct1}\\% \\text{ of } ${whole} = ${partial}$, then $${pct2}\\% \\text{ of } ${partial} = ${ans2}$` };
}

// ============================================================
// ALGEBRA (Stage 4 core)
// ============================================================
function _genAlgebraCore(rng, diff, allowedOps) {
    const maps = {
        Easy:   { 'solve': [0, 1, 2] },
        Medium: { 'solve': [0, 1, 2, 3], 'substitution': [4] },
        Hard:   { 'solve': [0, 1, 2], 'substitution': [3] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : diff === 'Medium' ? 4 : 3);
    if (type === -1) return null;

    const v = rc(rng, ALGEBRA_VARS);
    const solveVerb = rc(rng, _solveVerbsFor(v));

    if (diff === 'Easy') {
        if (type === 0) {
            const ans = ri(rng, 1, 25), a = ri(rng, 2, 30);
            // ~40% subtraction variant
            if (rng() < 0.4) {
                if (rng() < 0.35) {
                    const clue = rc(rng, [
                        `A number decreased by $${a}$ equals $${ans - a}$. Find the number.`,
                        `When $${a}$ is subtracted from a number, the result is $${ans - a}$. What is the number?`,
                        `A number minus $${a}$ gives $${ans - a}$. Find the number.`,
                    ]);
                    return { clue, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${ans - a} + ${a} = ${ans}$` };
                }
                return { clue: `${solveVerb}\n$${v} - ${a} = ${ans - a}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${ans - a} + ${a} = ${ans}$` };
            }
            if (rng() < 0.35) {
                const clue = rc(rng, [
                    `A number increased by $${a}$ equals $${ans + a}$. Find the number.`,
                    `When $${a}$ is added to a number, the result is $${ans + a}$. What is the number?`,
                    `A number plus $${a}$ gives $${ans + a}$. Find the number.`,
                    `Think of a number. Add $${a}$. The answer is $${ans + a}$. What is the number?`,
                ]);
                return { clue, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${ans + a} - ${a} = ${ans}$` };
            }
            return { clue: `${solveVerb}\n$${v} + ${a} = ${ans + a}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${ans + a} - ${a} = ${ans}$` };
        }
        if (type === 1) {
            const a = ri(rng, 2, 12), ans = ri(rng, 2, 15);
            if (rng() < 0.35) {
                const clue = rc(rng, [
                    `A number multiplied by $${a}$ gives $${a * ans}$. Find the number.`,
                    `When a number is multiplied by $${a}$, the result is $${a * ans}$. What is the number?`,
                    `$${a}$ times a number equals $${a * ans}$. Find the number.`,
                    `Think of a number. Multiply it by $${a}$. The answer is $${a * ans}$. What is the number?`,
                ]);
                return { clue, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${a * ans} \\div ${a} = ${ans}$` };
            }
            return { clue: `${solveVerb}\n$${a}${v} = ${a * ans}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${v} = ${a * ans} \\div ${a} = ${ans}$` };
        }
        // type 2: simple two-step ax + b = c
        const a2 = ri(rng, 2, 4), ans2 = ri(rng, 1, 8), b2 = ri(rng, 1, 10);
        const worked = `$${a2}${v} = ${a2 * ans2 + b2} - ${b2} = ${a2 * ans2}$, so $${v} = ${ans2}$`;
        return { clue: `${solveVerb}\n$${a2}${v} + ${b2} = ${a2 * ans2 + b2}$`, answer: String(ans2), answerDisplay: `$${v} = ${ans2}$`, worked };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const a = ri(rng, 2, 9), ans = ri(rng, 2, 18), b = ri(rng, 3, 30);
            const worked = `$${a}${v} = ${a * ans + b} - ${b} = ${a * ans}$, so $${v} = ${ans}$`;
            return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${a * ans + b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked };
        }
        if (type === 1) {
            const a = ri(rng, 2, 9), ans = ri(rng, 2, 18), b = ri(rng, 3, 20);
            const worked = `$${a}${v} = ${a * ans - b} + ${b} = ${a * ans}$, so $${v} = ${ans}$`;
            return { clue: `${solveVerb}\n$${a}${v} - ${b} = ${a * ans - b}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked };
        }
        if (type === 2) {
            // variables on both sides (moderate coefficients)
            const ans = ri(rng, 1, 10);
            const a = ri(rng, 3, 7), c = ri(rng, 1, a - 1), b = ri(rng, 2, 20);
            const d = (a - c) * ans + b;
            return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${c}${v} + ${d}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${a - c}${v} = ${d} - ${b} = ${d - b}$. $${v} = ${d - b} \\div ${a - c} = ${ans}$` };
        }
        if (type === 3) {
            // word-problem solve (linear)
            const a3 = ri(rng, 2, 8), ans3 = ri(rng, 2, 15), b3 = ri(rng, 1, 25);
            const R3 = a3 * ans3 + b3;
            const wp3 = rc(rng, [
                `A number is multiplied by $${a3}$ then $${b3}$ is added, giving $${R3}$. Find the number.`,
                `I think of a number, multiply it by $${a3}$, then add $${b3}$. The result is $${R3}$. What is the number?`,
                `When a number is multiplied by $${a3}$ and $${b3}$ is added, the answer is $${R3}$. Find the number.`,
            ]);
            return { clue: wp3, answer: String(ans3), answerDisplay: `$${v} = ${ans3}$`, worked: `$${a3}${v} + ${b3} = ${R3}$. $${a3}${v} = ${R3} - ${b3} = ${a3 * ans3}$. $${v} = ${a3 * ans3} \\div ${a3} = ${ans3}$` };
        }
        // type 4: substitution y = ax + b
        const [fv, iv] = rc(rng, SUBST_PAIRS);
        const a4 = ri(rng, 2, 8), b4 = ri(rng, 1, 15), n4 = ri(rng, 1, 10);
        const subVerb = rc(rng, [
            `If $${fv} = ${a4}${iv} + ${b4}$, find $${fv}$ when $${iv} = ${n4}$`,
            `Evaluate $${fv} = ${a4}${iv} + ${b4}$ when $${iv} = ${n4}$`,
            `Calculate $${fv}$ given $${fv} = ${a4}${iv} + ${b4}$ and $${iv} = ${n4}$`,
            `Substitute $${iv} = ${n4}$ into $${fv} = ${a4}${iv} + ${b4}$`,
            `Find the value of $${fv}$ if $${fv} = ${a4}${iv} + ${b4}$ and $${iv} = ${n4}$`,
        ]);
        return { clue: subVerb, answer: String(a4 * n4 + b4), worked: `$${fv} = ${a4}(${n4}) + ${b4} = ${a4 * n4} + ${b4} = ${a4 * n4 + b4}$` };
    }
    // Hard
    if (type === 0) {
        const ans = ri(rng, 1, 12);
        const a = ri(rng, 3, 9), c = ri(rng, 1, a - 1), b = ri(rng, 1, 30);
        const d = (a - c) * ans + b;
        // ~30% bracket form: a(v + b) = cv + d
        if (rng() < 0.3) {
            const ab = ri(rng, 1, 8);
            const db = a * ab + (a - c) * ans;
            return { clue: `${solveVerb}\n$${a}(${v} + ${ab}) = ${c}${v} + ${db}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${a}${v} + ${a * ab} = ${c}${v} + ${db}$. $${a - c}${v} = ${db} - ${a * ab} = ${db - a * ab}$. $${v} = ${db - a * ab} \\div ${a - c} = ${ans}$` };
        }
        return { clue: `${solveVerb}\n$${a}${v} + ${b} = ${c}${v} + ${d}$`, answer: String(ans), answerDisplay: `$${v} = ${ans}$`, worked: `$${a - c}${v} = ${d} - ${b} = ${d - b}$. $${v} = ${d - b} \\div ${a - c} = ${ans}$` };
    }
    if (type === 1) {
        // bracket equation: a(v + b) = c
        const a1 = ri(rng, 2, 6), ans1 = ri(rng, 1, 10), b1 = ri(rng, 1, 8);
        const rhs = a1 * (ans1 + b1);
        return { clue: `${solveVerb}\n$${a1}(${v} + ${b1}) = ${rhs}$`, answer: String(ans1), answerDisplay: `$${v} = ${ans1}$`, worked: `$${v} + ${b1} = ${rhs} \\div ${a1} = ${ans1 + b1}$. $${v} = ${ans1 + b1} - ${b1} = ${ans1}$` };
    }
    if (type === 2) {
        // negative solution: av + ab = 0
        const a2 = ri(rng, 2, 7), bMult = ri(rng, 1, 12);
        const ans2 = -bMult;
        return { clue: `${solveVerb}\n$${a2}${v} + ${a2 * bMult} = 0$`, answer: String(ans2), answerDisplay: `$${v} = ${ans2}$`, worked: `$${a2}${v} = 0 - ${a2 * bMult} = -${a2 * bMult}$. $${v} = -${a2 * bMult} \\div ${a2} = ${ans2}$` };
    }
    // type 3: quadratic substitution
    const [fv, iv] = rc(rng, SUBST_PAIRS);
    const a3 = ri(rng, 1, 4), b3 = ri(rng, 1, 15), n3 = ri(rng, 2, 6);
    const coeff = a3 === 1 ? '' : String(a3);
    const subVerb = rc(rng, [
        `If $${fv} = ${coeff}${iv}^2 + ${b3}$, find $${fv}$ when $${iv} = ${n3}$`,
        `Evaluate $${fv} = ${coeff}${iv}^2 + ${b3}$ when $${iv} = ${n3}$`,
        `Calculate $${fv}$ given $${fv} = ${coeff}${iv}^2 + ${b3}$ and $${iv} = ${n3}$`,
        `Substitute $${iv} = ${n3}$ into $${fv} = ${coeff}${iv}^2 + ${b3}$`,
    ]);
    return { clue: subVerb, answer: String(a3 * n3 * n3 + b3), worked: `$${fv} = ${coeff}(${n3})^2 + ${b3} = ${a3 * n3 * n3} + ${b3} = ${a3 * n3 * n3 + b3}$` };
}

// ============================================================
// STATISTICS (Stage 4 core)
// ============================================================
function _genStatisticsCore(rng, diff, allowedOps, _depth = 0, opts = {}) {
    if (_depth > 30) return null;
    const maps = {
        Easy:   { 'mean-median': [0, 1], 'mode-range': [2, 3] },
        Medium: { 'mode-range': [0, 1], 'mean-median': [2, 3, 4] },
        Hard:   { 'iqr': [0], 'mean-median': [1, 2, 3], 'mode-range': [4] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 3 : 4);
    if (type === -1) return null;

    const ctx = rc(rng, DATA_CONTEXTS);
    if (diff === 'Easy') {
        if (type === 0) {
            const n = ri(rng, 3, 5);
            const meanV = ri(rng, 2, 12);
            const spread = Math.max(1, meanV - 1);
            const others = Array.from({ length: n - 1 }, () => meanV + ri(rng, -spread, spread));
            const last = meanV * n - others.reduce((a, b) => a + b, 0);
            if (last < 1 || last > 25) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
            const data = [...others, last].sort((a, b) => a - b);
            const fOn = opts.showFormulas?.['mean-median']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $\\overline{x} = \\text{sum} \\div n$.' : '';
            const ph = rc(rng, [
                `Find the *mean* of: $${data.join(', ')}$${pf}`,
                `Calculate the *mean* of these ${ctx}: $${data.join(', ')}$${pf}`,
                `Determine the *mean* of: $${data.join(', ')}$${pf}`,
                `What is the *mean* of $${data.join(', ')}$?${pf}`,
                `The ${ctx} recorded are $${data.join(', ')}$. Find the *mean*.${pf}`,
            ]);
            const sum = data.reduce((a, b) => a + b, 0);
            return { clue: ph, answer: String(meanV), worked: `$\\text{mean} = (${sum}) \\div ${n} = ${meanV}$` };
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
            return { clue: ph, answer: String(data[Math.floor(n / 2)]), worked: `$\\text{median: middle of } ${n} \\text{ values} = ${data[Math.floor(n / 2)]}$` };
        }
        if (type === 2) {
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
            return { clue: ph, answer: String(mode), worked: `$\\text{mode} = ${mode} \\text{ (appears most often)}$` };
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
        return { clue: ph3, answer: String(range3), worked: `$\\text{range} = ${Math.max(...data3)} - ${Math.min(...data3)} = ${range3}$` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const n = ri(rng, 5, 8);
            const data = Array.from({ length: n }, () => ri(rng, 1, 50));
            const ph = rc(rng, [
                `Find the *range* of: $${data.join(', ')}$`,
                `Calculate the *range* of these ${ctx}: $${data.join(', ')}$`,
                `Determine the *range* of: $${data.join(', ')}$`,
                `What is the *range* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *range*.`,
            ]);
            const range = Math.max(...data) - Math.min(...data);
            return { clue: ph, answer: String(range), worked: `$\\text{range} = ${Math.max(...data)} - ${Math.min(...data)} = ${range}$` };
        }
        if (type === 1) {
            const mode = ri(rng, 1, 20);
            const usedVals = new Set([mode]);
            const nOthers = ri(rng, 4, 6);
            const others = Array.from({ length: nOthers }, () => {
                let v; do { v = ri(rng, 1, 30); } while (usedVals.has(v)); usedVals.add(v); return v;
            });
            const reps = ri(rng, 2, 3);
            const data = [...others, ...Array(reps).fill(mode)].sort((a, b) => a - b);
            const ph = rc(rng, [
                `Identify the *mode* of: $${data.join(', ')}$`,
                `State the *mode* of these ${ctx}: $${data.join(', ')}$`,
                `Find the *mode* of: $${data.join(', ')}$`,
                `What is the *mode* of $${data.join(', ')}$?`,
                `The ${ctx} are $${data.join(', ')}$. Find the *mode*.`,
            ]);
            return { clue: ph, answer: String(mode), worked: `$\\text{mode} = ${mode} \\text{ (appears most often)}$` };
        }
        if (type === 2) {
            const n = ri(rng, 5, 8);
            const meanV = ri(rng, 5, 30);
            const offset = Math.max(1, Math.floor(meanV / n));
            const others = Array.from({ length: n - 1 }, () => meanV + ri(rng, -offset, offset));
            const last = meanV * n - others.reduce((a, b) => a + b, 0);
            if (last < 1 || last > 50) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
            const data = [...others, last].sort((a, b) => a - b);
            const fOn2 = opts.showFormulas?.['mean-median']?.[diff.toLowerCase()];
            const pf2 = fOn2 ? ' Use $\\overline{x} = \\text{sum} \\div n$.' : '';
            const ph = rc(rng, [
                `Calculate the *mean* of: $${data.join(', ')}$${pf2}`,
                `Find the *mean* of these ${ctx}: $${data.join(', ')}$${pf2}`,
                `Determine the *mean* of: $${data.join(', ')}$${pf2}`,
                `The ${ctx} are $${data.join(', ')}$. Calculate the *mean*.${pf2}`,
            ]);
            const sum = data.reduce((a, b) => a + b, 0);
            return { clue: ph, answer: String(meanV), worked: `$\\text{mean} = (${sum}) \\div ${n} = ${meanV}$` };
        }
        if (type === 3) {
            // find missing value given mean
            const n3 = ri(rng, 4, 6);
            const mean3 = ri(rng, 5, 25);
            const spread3 = Math.max(2, Math.floor(mean3 * 0.5));
            const target3 = mean3 * n3;
            const known3 = Array.from({ length: n3 - 1 }, () => mean3 + ri(rng, -spread3, spread3));
            const missing3 = target3 - known3.reduce((a, b) => a + b, 0);
            if (missing3 < 1 || missing3 > 50) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
            const display3 = [...known3, '?'].join(', ');
            const fOn3 = opts.showFormulas?.['mean-median']?.[diff.toLowerCase()];
            const pf3 = fOn3 ? ' Use $\\overline{x} = \\text{sum} \\div n$.' : '';
            const ph3 = rc(rng, [
                `The *mean* of $${display3}$ is $${mean3}$. Find the missing value.${pf3}`,
                `${n3} ${ctx} have a *mean* of $${mean3}$. ${n3 - 1} are $${known3.join(', ')}$. Find the missing value.${pf3}`,
                `Find the missing number if the *mean* of $${display3}$ is $${mean3}$.${pf3}`,
                `The *mean* of these values is $${mean3}$: $${display3}$. What is the missing value?${pf3}`,
            ]);
            return { clue: ph3, answer: String(missing3), worked: `$\\text{missing} = ${mean3} \\times ${n3} - (${known3.join(' + ')}) = ${missing3}$` };
        }
        // type 4: median of even-count dataset (requires averaging middle two)
        const n4 = rc(rng, [6, 8]);
        const data4 = Array.from({ length: n4 }, () => ri(rng, 1, 20) * 2).sort((a, b) => a - b);
        const med4 = (data4[n4 / 2 - 1] + data4[n4 / 2]) / 2;
        const ph4 = rc(rng, [
            `Find the *median* of: $${data4.join(', ')}$`,
            `Calculate the *median* of these ${ctx}: $${data4.join(', ')}$`,
            `Determine the *median* of: $${data4.join(', ')}$`,
            `The ${ctx} are $${data4.join(', ')}$. Find the *median*.`,
        ]);
        return { clue: ph4, answer: String(med4), worked: `$\\text{median} = (${data4[n4/2-1]} + ${data4[n4/2]}) \\div 2 = ${med4}$` };
    }
    // Hard
    if (type === 0) {
        const n0 = rc(rng, [10, 12]);
        const data = Array.from({ length: n0 }, () => ri(rng, 1, 25) * 2).sort((a, b) => a - b);
        const half = Math.floor(n0 / 2);
        const lower = data.slice(0, half);
        const upper = data.slice(half);
        const q1 = lower.length % 2 ? lower[Math.floor(lower.length / 2)] : (lower[lower.length / 2 - 1] + lower[lower.length / 2]) / 2;
        const q3 = upper.length % 2 ? upper[Math.floor(upper.length / 2)] : (upper[upper.length / 2 - 1] + upper[upper.length / 2]) / 2;
        const iqr = q3 - q1;
        if (iqr <= 0) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
        const ph = rc(rng, [
            `Find the *interquartile range* of: $${data.join(', ')}$`,
            `Calculate the *IQR* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *interquartile range* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Find the *IQR*.`,
        ]);
        return { clue: ph, answer: String(iqr), worked: `$Q_1 = ${q1}, Q_3 = ${q3}, \\text{IQR} = ${q3} - ${q1} = ${iqr}$` };
    }
    if (type === 1) {
        const n = rc(rng, [8, 10]);
        const data = Array.from({ length: n }, () => ri(rng, 1, 25) * 2).sort((a, b) => a - b);
        const med = (data[n / 2 - 1] + data[n / 2]) / 2;
        const ph = rc(rng, [
            `Find the *median* of: $${data.join(', ')}$`,
            `Calculate the *median* of these ${ctx}: $${data.join(', ')}$`,
            `Determine the *median* of: $${data.join(', ')}$`,
            `The ${ctx} are $${data.join(', ')}$. Find the *median*.`,
        ]);
        return { clue: ph, answer: String(med), worked: `$\\text{median} = (${data[n/2-1]} + ${data[n/2]}) \\div 2 = ${med}$` };
    }
    if (type === 2) {
        // find missing value given mean (harder dataset)
        const n2 = ri(rng, 6, 8);
        const mean2 = ri(rng, 15, 40);
        const spread2 = Math.floor(mean2 * 0.5);
        const target2 = mean2 * n2;
        const known2 = Array.from({ length: n2 - 1 }, () => mean2 + ri(rng, -spread2, spread2));
        const missing2 = target2 - known2.reduce((a, b) => a + b, 0);
        if (missing2 < 1 || missing2 > 80) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
        const display2 = [...known2, '?'].join(', ');
        const ph2 = rc(rng, [
            `The *mean* of $${display2}$ is $${mean2}$. Find the missing value.`,
            `Find the missing value if the *mean* of $${display2}$ is $${mean2}$.`,
            `The *mean* of these ${ctx} is $${mean2}$: $${display2}$. What is the missing value?`,
            `Determine the missing value given that the *mean* of $${display2}$ is $${mean2}$.`,
        ]);
        return { clue: ph2, answer: String(missing2), worked: `$\\text{missing} = ${mean2} \\times ${n2} - (${known2.join(' + ')}) = ${missing2}$` };
    }
    if (type === 3) {
        // effect on mean: "a value is added, find the new mean"
        const n3 = ri(rng, 5, 7);
        const meanV = ri(rng, 8, 25);
        const spread = Math.max(2, Math.floor(meanV * 0.4));
        const others = Array.from({ length: n3 - 1 }, () => meanV + ri(rng, -spread, spread));
        const last = meanV * n3 - others.reduce((a, b) => a + b, 0);
        if (last < 1 || last > 50) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
        const data = [...others, last].sort((a, b) => a - b);
        const extra = ri(rng, meanV + 3, meanV + 15);
        const newSum = data.reduce((a, b) => a + b, 0) + extra;
        const newMean = newSum / (n3 + 1);
        if (!Number.isInteger(newMean)) return _genStatisticsCore(rng, diff, allowedOps, _depth + 1, opts);
        const ph3 = rc(rng, [
            `The ${ctx} are $${data.join(', ')}$. A new value of $${extra}$ is added. Find the new *mean*.`,
            `Given the data $${data.join(', ')}$, a value of $${extra}$ is added. Calculate the new *mean*.`,
            `The *mean* of $${data.join(', ')}$ changes when $${extra}$ is included. Find the new *mean*.`,
        ]);
        return { clue: ph3, answer: String(newMean), worked: `$\\text{new sum} = ${newSum}, \\text{new mean} = ${newSum} \\div ${n3+1} = ${newMean}$` };
    }
    // type 4: mode with larger dataset
    const mode4 = ri(rng, 5, 30);
    const usedVals4 = new Set([mode4]);
    const nOthers4 = ri(rng, 6, 8);
    const others4 = Array.from({ length: nOthers4 }, () => {
        let v; do { v = ri(rng, 1, 40); } while (usedVals4.has(v)); usedVals4.add(v); return v;
    });
    const reps4 = 3;
    const data4 = [...others4, ...Array(reps4).fill(mode4)].sort((a, b) => a - b);
    const ph4 = rc(rng, [
        `Find the *mode* of: $${data4.join(', ')}$`,
        `Identify the *mode* of these ${ctx}: $${data4.join(', ')}$`,
        `What is the *mode* of $${data4.join(', ')}$?`,
        `The ${ctx} are $${data4.join(', ')}$. Find the *mode*.`,
    ]);
    return { clue: ph4, answer: String(mode4), worked: `$\\text{mode} = ${mode4} \\text{ (appears most often)}$` };
}

// ============================================================
// FINANCIAL MATHS (Stage 4 core)
// ============================================================
function _genFinancialCore(rng, diff, allowedOps, opts = {}, _depth = 0) {
    if (_depth > 20) return null;
    const maps = {
        Easy:   { 'simple-interest': [0], 'gst': [1], 'markup-profit': [2] },
        Medium: { 'markup-profit': [0, 2], 'simple-interest': [1], 'gst': [3] },
        Hard:   { 'compound-interest': [0], 'markup-profit': [1], 'simple-interest': [2, 3] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 2 : 3);
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
            return { clue: ph, answer: String(I), answerDisplay: `$${money(I)}`, worked };
        }
        if (type === 1) {
            const price = ri(rng, 5, 50) * 10;
            const ph = rc(rng, [
                `Find the price after $10\\%$ GST is added to $\\$${price}$`,
                `Calculate the GST-inclusive price for an item costing $\\$${price}$`,
                `A product costs $\\$${price}$ before GST. Find the total price including $10\\%$ GST.`,
            ]);
            const gstTotal = round(price * 1.1, 2);
            return { clue: ph, answer: String(gstTotal), answerDisplay: `$${money(gstTotal)}`, worked: `$\\$${price} \\times 1.1 = \\$${gstTotal}$` };
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
        return { clue: ph2, answer: String(sell2), answerDisplay: `$${money(sell2)}`, worked: `$\\$${cost2} \\times ${1 + pct2 / 100} = \\$${sell2}$` };
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
            return { clue: ph, answer: String(sell), answerDisplay: `$${money(sell)}`, worked: `$\\$${cost} \\times ${1 + pctProfit / 100} = \\$${sell}$` };
        }
        if (type === 1) {
            const P = ri(rng, 2, 12) * 1000, r = rc(rng, [4, 5, 6, 8, 10]), t = ri(rng, 1, 4);
            const I = P * r / 100 * t;
            const yrs = `$${t}$ year${t > 1 ? 's' : ''}`;
            const fOn = opts.showFormulas?.['simple-interest']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $I = Prn$.' : '';
            const ph = rc(rng, [
                `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
                `Find the *simple interest* earned on a $\\$${P}$ investment at $${r}\\%$ p.a. over ${yrs}.${pf}`,
                `Determine the interest on $\\$${P}$ at $${r}\\%$ per annum for ${yrs}.${pf}`,
            ]);
            const workedSI = `$I = Prn = ${P} \\times \\frac{${r}}{100} \\times ${t} = \\$${I}$`;
            return { clue: ph, answer: String(I), answerDisplay: `$${money(I)}`, worked: workedSI };
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
            return { clue: ph, answer: String(sale), answerDisplay: `$${money(sale)}`, worked: `$\\$${orig} \\times ${1 - pctOff / 100} = \\$${sale}$` };
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
        return { clue: ph3, answer: String(preGst), answerDisplay: `$${money(preGst)}`, worked: `$\\$${gstInclusive} \\div 1.1 = \\$${preGst}$` };
    }
    // Hard
    if (type === 0) {
        // compound interest — try a wider rate pool, fall back to a clean case
        const P = ri(rng, 2, 10) * 1000, r = rc(rng, [4, 5, 8, 10]), t = ri(rng, 2, 4);
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
            return { clue: ph, answer: String(A2), answerDisplay: `$${money(A2)}`, worked: `$A = ${P2}(1 + ${r2 / 100})^{${t2}} = ${P2} \\times ${1 + r2 / 100}^{${t2}} = \\$${A2}$` };
        }
        const fOn = opts.showFormulas?.['compound-interest']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $A = P(1+r)^n$.' : '';
        const ph = rc(rng, [
            `Calculate the total amount after compound interest: $\\$${P}$ at $${r}\\%$ p.a. for $${t}$ year${t > 1 ? 's' : ''}.${pf}`,
            `$\\$${P}$ is invested at $${r}\\%$ p.a. compound interest for $${t}$ year${t > 1 ? 's' : ''}. Determine the total amount.${pf}`,
            `Find the final value of $\\$${P}$ compounded at $${r}\\%$ p.a. for $${t}$ year${t > 1 ? 's' : ''}.${pf}`,
        ]);
        return { clue: ph, answer: String(A), answerDisplay: `$${money(A)}`, worked: `$A = ${P}(1 + ${r / 100})^{${t}} = ${P} \\times ${1 + r / 100}^{${t}} = \\$${A}$` };
    }
    if (type === 1) {
        // percentage profit given cost and selling price
        const cost = ri(rng, 2, 15) * 100;
        const pct = rc(rng, [5, 10, 20, 25, 50]);
        const sell = round(cost + cost * pct / 100, 2);
        const ph = rc(rng, [
            `An item costs $\\$${cost}$ and sells for $\\$${sell}$. Calculate the *percentage profit*.`,
            `Find the *percentage profit*: cost $\\$${cost}$, selling price $\\$${sell}$.`,
            `Determine the *profit percentage* given a cost of $\\$${cost}$ and a selling price of $\\$${sell}$.`,
        ]);
        return { clue: ph, answer: String(pct), answerDisplay: `${pct}%`, worked: `$\\text{Profit} = \\$${sell} - \\$${cost} = \\$${sell - cost}$. $\\frac{${sell - cost}}{${cost}} \\times 100 = ${pct}\\%$` };
    }
    if (type === 2) {
        // simple interest with harder numbers and a wider rate pool
        const P = ri(rng, 2, 20) * 500, r = rc(rng, [4, 6, 7, 8, 12, 15]), t = ri(rng, 2, 5);
        const I = P * r / 100 * t;
        if (!Number.isInteger(I)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
        const yrs = `$${t}$ year${t > 1 ? 's' : ''}`;
        const fOn = opts.showFormulas?.['simple-interest']?.[diff.toLowerCase()];
        const pf = fOn ? ' Use $I = Prn$.' : '';
        const ph = rc(rng, [
            `Calculate the *simple interest* on $\\$${P}$ at $${r}\\%$ p.a. for ${yrs}.${pf}`,
            `Find the *simple interest* earned on a $\\$${P}$ investment at $${r}\\%$ p.a. over ${yrs}.${pf}`,
            `Determine the interest on $\\$${P}$ at $${r}\\%$ per annum for ${yrs}.${pf}`,
        ]);
        const workedSI = `$I = Prn = ${P} \\times \\frac{${r}}{100} \\times ${t} = \\$${I}$`;
        return { clue: ph, answer: String(I), answerDisplay: `$${money(I)}`, worked: workedSI };
    }
    // type 3: inverse simple interest — find the rate or the time
    {
        const P = ri(rng, 2, 16) * 500, r = rc(rng, [4, 5, 6, 8, 10]), t = ri(rng, 2, 5);
        const I = P * r / 100 * t;
        if (!Number.isInteger(I)) return _genFinancialCore(rng, diff, allowedOps, opts, _depth + 1);
        const yrs = `$${t}$ year${t > 1 ? 's' : ''}`;
        if (rng() < 0.5) {
            // find the rate — clue carries no percentage so it is unambiguous
            const ph = rc(rng, [
                `An investment of $\\$${P}$ earns $\\$${I}$ *simple interest* over ${yrs}. Find the annual interest *rate*.`,
                `$\\$${P}$ earns $\\$${I}$ in *simple interest* after ${yrs}. What is the annual *rate*?`,
            ]);
            return { clue: ph, answer: String(r), answerDisplay: `${r}%`, worked: `$r = \\frac{${I}}{${P} \\times ${t}} \\times 100 = ${r}\\%$` };
        }
        // find the time — clue carries the rate but no "for N years" phrasing
        const ph = rc(rng, [
            `How many *years* will it take for $\\$${P}$ at $${r}\\%$ p.a. *simple interest* to earn $\\$${I}$?`,
            `$\\$${P}$ is invested at $${r}\\%$ p.a. *simple interest*. Find the *time* (in years) needed to earn $\\$${I}$.`,
        ]);
        return { clue: ph, answer: String(t), answerDisplay: `${t} years`, worked: `$n = \\frac{${I}}{${P} \\times ${r / 100}} = \\frac{${I}}{${P * r / 100}} = ${t}$ years` };
    }
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
        Easy:   { 'area-perimeter': [0, 1, 3], 'angles': [2] },
        Medium: { 'area-perimeter': [0, 5, 6], 'pythagoras': [1], 'angles': [2, 3, 4] },
        Hard:   { 'circles': [0, 2, 5], 'pythagoras': [1], 'area-perimeter': [6, 7], 'angles': [3, 4] },
    };
    const filtered = _filterTypes(maps[diff], allowedOps);
    const type = _pickType(rng, filtered, diff === 'Easy' ? 3 : 7);
    if (type === -1) return null;

    if (diff === 'Easy') {
        if (type === 0) {
            const shapeForm = ri(rng, 0, 2);
            const u = 'cm';
            if (shapeForm === 1) {
                const base = ri(rng, 3, 15), height = ri(rng, 2, 10);
                const ans = base * height;
                const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
                const pf = fOn ? ' Use $A = b \\times h$.' : '';
                const ph = rc(rng, [
                    `Find the *area* of a parallelogram with base $${base}$ ${u} and perpendicular height $${height}$ ${u}.${pf}`,
                    `A parallelogram has base $${base}$ ${u} and height $${height}$ ${u}. Find its area.${pf}`,
                    `Calculate the *area* of a parallelogram: base $${base}$ ${u}, height $${height}$ ${u}.${pf}`,
                ]);
                return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, unit: `${u}²`, worked: `$A = ${base} \\times ${height} = ${ans}$ ${u}²`, diagram: { type: 'parallelogram', base, height, missing: 'area' } };
            }
            if (shapeForm === 2) {
                const a = ri(rng, 2, 10) * 2, bTrap = ri(rng, a / 2 + 2, a + 8), height = ri(rng, 2, 10);
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
                return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, unit: `${u}²`, worked: `$A = \\frac{1}{2} \\times (${a} + ${bTrap}) \\times ${height} = \\frac{1}{2} \\times ${a + bTrap} \\times ${height} = ${ans}$ ${u}²`, diagram: { type: 'trapezium', a: diagA, b: diagB, height, missing: 'area' } };
            }
            const l = ri(rng, 2, 15), w = ri(rng, 2, 12);
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = l \\times w$.' : '';
            const ph = rc(rng, [
                `Find the *area* of a rectangle with length $${l}$ ${u} and width $${w}$ ${u}.${pf}`,
                `Calculate the *area* of a rectangle: length $${l}$ ${u}, width $${w}$ ${u}.${pf}`,
                `A rectangle has length $${l}$ ${u} and width $${w}$ ${u}. Determine its area.${pf}`,
                `What is the *area* of a rectangle measuring $${l}$ ${u} by $${w}$ ${u}?${pf}`,
            ]);
            return { clue: ph, answer: String(l * w), answerDisplay: `${l * w} ${u}²`, unit: `${u}²`, worked: `$A = ${l} \\times ${w} = ${l * w}$ ${u}²`, diagram: { type: 'rectangle', l, w, missing: 'area' } };
        }
        if (type === 2) {
            const a = ri(rng, 25, 155);
            const form = ri(rng, 0, 1);
            if (form === 0) {
                const x = 180 - a;
                const ph = rc(rng, [
                    `Two angles on a straight line. One angle is $${a}$°. Find the other angle.`,
                    `Angles on a straight line sum to 180°. If one angle is $${a}$°, find the other.`,
                    `What angle is supplementary to $${a}$°?`,
                ]);
                return { clue: ph, answer: String(x), answerDisplay: `${x}°`, unit: '°', worked: `$x = 180 - ${a} = ${x}$°`, diagram: { type: 'straight-line-angles', a } };
            }
            const ph = rc(rng, [
                `Two straight lines intersect. One angle is $${a}$°. State the **vertically opposite** angle.`,
                `Find the angle **vertically opposite** to $${a}$°.`,
                `Two lines cross. One angle measures $${a}$°. What is the **vertically opposite** angle?`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, unit: '°', worked: `Vertically opposite angles are equal, so $x = ${a}$°`, diagram: { type: 'vertically-opposite', a } };
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
            return { clue: ph, answer: String(2 * (l + w)), answerDisplay: `${2 * (l + w)} ${u}`, worked: `$P = 2(${l} + ${w}) = 2 \\times ${l + w} = ${2 * (l + w)}$ ${u}`, diagram: { type: 'rectangle', l, w, missing: 'perimeter' } };
        }
        // type 3: find length given area and width (no diagram)
        const w2 = ri(rng, 2, 10), l2 = ri(rng, w2 + 1, 15);
        const area2 = l2 * w2;
        const u2 = _geoUnit(Math.max(l2, w2));
        const ph2 = rc(rng, [
            `A rectangle has area $${area2}$ ${u2}² and width $${w2}$ ${u2}. Find its length.`,
            `The area of a rectangle is $${area2}$ ${u2}² and its width is $${w2}$ ${u2}. What is the length?`,
            `Find the length of a rectangle with area $${area2}$ ${u2}² and width $${w2}$ ${u2}.`,
            `A rectangle with area $${area2}$ ${u2}² has a width of $${w2}$ ${u2}. Determine its length.`,
        ]);
        return { clue: ph2, answer: String(l2), answerDisplay: `${l2} ${u2}`, worked: `$l = ${area2} \\div ${w2} = ${l2}$ ${u2}` };
    }
    if (diff === 'Medium') {
        if (type === 0) {
            const b = ri(rng, 2, 14) * 2;
            const h = ri(rng, 3, 18);
            const u = _geoUnit(Math.max(b, h));
            const ans = (b * h) / 2;
            const fOn = opts.showFormulas?.['area-perimeter']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = \\frac{1}{2}bh$.' : '';
            const ph = rc(rng, [
                `Find the *area* of a triangle with base $${b}$ ${u} and perpendicular height $${h}$ ${u}.${pf}`,
                `Calculate the *area* of a triangle: base $${b}$ ${u}, height $${h}$ ${u}.${pf}`,
                `A triangle has base $${b}$ ${u} and height $${h}$ ${u}. Determine its area.${pf}`,
            ]);
            return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, worked: `$A = \\frac{1}{2} \\times ${b} \\times ${h} = ${ans}$ ${u}²`, diagram: { type: 'triangle-area', base: b, height: h } };
        }
        if (type === 1) {
            const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]];
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
        if (type === 2) {
            const angles = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90];
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
            return { clue: ph, answer: String(a3), answerDisplay: `${a3}°`, worked: `$x = 180 - ${a1} - ${a2} = ${a3}$°`, diagram: { type: 'triangle-angles', a1, a2, a3, missing: 'a3' } };
        }
        if (type === 3) {
            const a = rc(rng, [40, 50, 55, 60, 65, 70, 80, 110, 120]);
            const x = 180 - a;
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. One *co-interior* angle is $${a}$°. Find the other co-interior angle.`,
                `Co-interior angles between parallel lines sum to 180°. One angle is $${a}$°. Find the *other*.`,
                `A transversal crosses two parallel lines. If one co-interior angle is $${a}$°, find the *missing* angle.`,
            ]);
            return { clue: ph, answer: String(x), answerDisplay: `${x}°`, worked: `Co-interior angles sum to $180$°, so $x = 180 - ${a} = ${x}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'co-interior' } };
        }
        if (type === 4) {
            const a = rc(rng, [40, 50, 55, 60, 65, 70, 80, 110, 120]);
            const form = ri(rng, 0, 1);
            if (form === 0) {
                const ph = rc(rng, [
                    `Two parallel lines are cut by a transversal. A *corresponding* angle is $${a}$°. Find the equal angle.`,
                    `Corresponding angles are equal. One is $${a}$°. Find the *other* corresponding angle.`,
                    `State the *corresponding* angle to $${a}$° on a pair of parallel lines.`,
                ]);
                return { clue: ph, answer: String(a), answerDisplay: `${a}°`, worked: `Corresponding angles are equal, so $x = ${a}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'corresponding' } };
            }
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. An *alternate* angle is $${a}$°. Find the equal angle.`,
                `Alternate angles are equal. One measures $${a}$°. Find its *alternate* angle.`,
                `State the *alternate* angle to $${a}$° on a pair of parallel lines.`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, worked: `Alternate angles are equal, so $x = ${a}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'alternate' } };
        }
        if (type === 5) {
            // find area of rectangle given perimeter and width (no diagram)
            const w3 = ri(rng, 3, 10), l3 = ri(rng, w3 + 2, 18);
            const P3 = 2 * (l3 + w3);
            const u3 = _geoUnit(Math.max(l3, w3));
            const ph3 = rc(rng, [
                `A rectangle has perimeter $${P3}$ ${u3} and width $${w3}$ ${u3}. Find its area.`,
                `The perimeter of a rectangle is $${P3}$ ${u3} and its width is $${w3}$ ${u3}. Calculate the area.`,
                `Find the area of a rectangle with perimeter $${P3}$ ${u3} and width $${w3}$ ${u3}.`,
                `A rectangle with perimeter $${P3}$ ${u3} has a width of $${w3}$ ${u3}. What is its area?`,
            ]);
            return { clue: ph3, answer: String(l3 * w3), answerDisplay: `${l3 * w3} ${u3}²`, worked: `$l = ${P3} \\div 2 - ${w3} = ${l3}$. $A = ${l3} \\times ${w3} = ${l3 * w3}$ ${u3}²` };
        }
        // type 6: parallelogram — find base given area and height (inverse)
        const h6 = ri(rng, 3, 12), b6 = ri(rng, 4, 15);
        const area6 = b6 * h6;
        const u6 = _geoUnit(Math.max(b6, h6));
        const ph6 = rc(rng, [
            `A parallelogram has area $${area6}$ ${u6}² and perpendicular height $${h6}$ ${u6}. Find its base.`,
            `The area of a parallelogram is $${area6}$ ${u6}² and its height is $${h6}$ ${u6}. Calculate the base.`,
            `Find the base of a parallelogram with area $${area6}$ ${u6}² and height $${h6}$ ${u6}.`,
        ]);
        return { clue: ph6, answer: String(b6), answerDisplay: `${b6} ${u6}`, worked: `$b = ${area6} \\div ${h6} = ${b6}$ ${u6}` };
    }
    // Hard
    if (type === 0) {
        // circle area — including from diameter
        const fromDiam = ri(rng, 0, 1);
        if (fromDiam) {
            const d = ri(rng, 4, 20) * 2;
            const r = d / 2;
            const u = _geoUnit(d);
            const ans = round(3.14 * r * r, 2);
            const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $A = \\pi r^2$.' : '';
            const ph = rc(rng, [
                `Find the *area* of a circle with diameter $${d}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
                `Calculate the *area* of a circle of diameter $${d}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
                `A circle has diameter $${d}$ ${u}. Find its area. Use $\\pi \\approx 3.14$.${pf}`,
            ]);
            const workedCircA = `$r = ${d} \\div 2 = ${r},\\; A = \\pi r^2 \\approx 3.14 \\times ${r}^2 = ${ans}$ ${u}²`;
            return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}²`, worked: workedCircA, diagram: { type: 'circle', r, missing: 'area' } };
        }
        const r = ri(rng, 2, 12);
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
        const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 40, 41]];
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
        const a = rc(rng, [35, 48, 52, 67, 73, 112, 127]);
        const x = 180 - a;
        const ph = rc(rng, [
            `Two parallel lines are cut by a transversal. The co-interior angles are $${a}$° and $x$°. Find $x$.`,
            `Find the *co-interior* angle to $${a}$° when two parallel lines are cut by a transversal.`,
            `Co-interior angles sum to 180°. One angle measures $${a}$°. Find the *other*.`,
        ]);
        return { clue: ph, answer: String(x), answerDisplay: `${x}°`, worked: `Co-interior angles sum to $180$°, so $x = 180 - ${a} = ${x}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'co-interior' } };
    }
    if (type === 4) {
        const a = rc(rng, [38, 47, 53, 61, 74, 82, 119, 134]);
        const form = ri(rng, 0, 1);
        if (form === 0) {
            const ph = rc(rng, [
                `Two parallel lines are cut by a transversal. A *corresponding* angle is $${a}$°. Find the equal angle.`,
                `State the *corresponding* angle to $${a}$° on a pair of parallel lines.`,
                `Corresponding angles are equal. One is $${a}$°. What is the *other* corresponding angle?`,
            ]);
            return { clue: ph, answer: String(a), answerDisplay: `${a}°`, worked: `Corresponding angles are equal, so $x = ${a}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'corresponding' } };
        }
        const ph = rc(rng, [
            `Two parallel lines are cut by a transversal. An *alternate* angle is $${a}$°. Find the equal angle.`,
            `State the *alternate* angle to $${a}$° on a pair of parallel lines.`,
            `Alternate angles are equal. One measures $${a}$°. What is its *alternate* angle?`,
        ]);
        return { clue: ph, answer: String(a), answerDisplay: `${a}°`, worked: `Alternate angles are equal, so $x = ${a}$°`, diagram: { type: 'parallel-transversal', a, angleType: 'alternate' } };
    }
    if (type === 2) {
        // circumference — including from diameter
        const fromDiam = ri(rng, 0, 1);
        if (fromDiam) {
            const d = ri(rng, 4, 30) * 2;
            const r = d / 2;
            const u = _geoUnit(d);
            const ans = round(3.14 * d, 2);
            const fOn = opts.showFormulas?.['circles']?.[diff.toLowerCase()];
            const pf = fOn ? ' Use $C = \\pi d$.' : '';
            const ph = rc(rng, [
                `Find the *circumference* of a circle with diameter $${d}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
                `Calculate the *circumference* of a circle of diameter $${d}$ ${u}. Use $\\pi \\approx 3.14$.${pf}`,
                `A circle has diameter $${d}$ ${u}. Find its circumference. Use $\\pi \\approx 3.14$.${pf}`,
            ]);
            const workedCircC = `$C = \\pi d \\approx 3.14 \\times ${d} = ${ans}$ ${u}`;
            return { clue: ph, answer: String(ans), answerDisplay: `${ans} ${u}`, worked: workedCircC, diagram: { type: 'circle', r, missing: 'circumference' } };
        }
        const r = ri(rng, 2, 18);
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
    if (type === 5) {
        // find radius given area
        const r3 = ri(rng, 2, 12);
        const u3 = _geoUnit(r3);
        const area3 = round(3.14 * r3 * r3, 2);
        const ph3 = rc(rng, [
            `The *area* of a circle is $${area3}$ ${u3}². Find its radius. Use $\\pi \\approx 3.14$.`,
            `A circle has area $${area3}$ ${u3}². Calculate its radius. Use $\\pi \\approx 3.14$.`,
            `Determine the radius of a circle with area $${area3}$ ${u3}². Use $\\pi \\approx 3.14$.`,
            `Find the radius of a circle whose area is $${area3}$ ${u3}². Use $\\pi \\approx 3.14$.`,
        ]);
        return { clue: ph3, answer: String(r3), answerDisplay: `${r3} ${u3}`, worked: `$r^2 = ${area3} \\div 3.14 = ${r3 * r3}$, so $r = ${r3}$ ${u3}` };
    }
    if (type === 6) {
        // find triangle height given area and base
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
        return { clue: ph4, answer: String(h4), answerDisplay: `${h4} ${u4}`, worked: `$h = 2 \\times ${area4} \\div ${b4} = ${2 * area4} \\div ${b4} = ${h4}$ ${u4}` };
    }
    // type 7: composite shape — rectangle + triangle or two rectangles
    const compForm = ri(rng, 0, 1);
    if (compForm === 0) {
        // L-shape: two rectangles
        const w1 = ri(rng, 3, 8), h1 = ri(rng, 4, 10);
        const w2 = ri(rng, 2, w1 - 1), h2 = ri(rng, 2, 6);
        const area = w1 * h1 + w2 * h2;
        const u = _geoUnit(Math.max(w1, h1));
        const ph = rc(rng, [
            `An L-shaped figure is formed by a $${w1}$ ${u} × $${h1}$ ${u} rectangle and a $${w2}$ ${u} × $${h2}$ ${u} rectangle. Find the total area.`,
            `Find the *area* of an L-shape made from rectangles measuring $${w1}$ ${u} × $${h1}$ ${u} and $${w2}$ ${u} × $${h2}$ ${u}.`,
            `Calculate the total *area* of a composite shape: rectangle $${w1}$ × $${h1}$ ${u} joined with rectangle $${w2}$ × $${h2}$ ${u}.`,
        ]);
        return { clue: ph, answer: String(area), answerDisplay: `${area} ${u}²`, worked: `$A = ${w1} \\times ${h1} + ${w2} \\times ${h2} = ${w1 * h1} + ${w2 * h2} = ${area}$ ${u}²` };
    }
    // rectangle + right triangle on top
    const rW = ri(rng, 4, 10), rH = ri(rng, 3, 8);
    const tH = ri(rng, 2, 6);
    const area = rW * rH + (rW * tH) / 2;
    if (!Number.isInteger(area)) return _genGeometryCore(rng, diff, allowedOps, opts, _depth + 1);
    const u = _geoUnit(Math.max(rW, rH));
    const ph = rc(rng, [
        `A shape is made of a $${rW}$ ${u} × $${rH}$ ${u} rectangle with a triangle (base $${rW}$ ${u}, height $${tH}$ ${u}) on top. Find the total area.`,
        `Find the *area* of a composite figure: a $${rW}$ × $${rH}$ ${u} rectangle plus a triangle with base $${rW}$ ${u} and height $${tH}$ ${u}.`,
        `Calculate the total *area*: rectangle $${rW}$ × $${rH}$ ${u}, triangle base $${rW}$ ${u} height $${tH}$ ${u}.`,
    ]);
    return { clue: ph, answer: String(area), answerDisplay: `${area} ${u}²`, worked: `$A = ${rW} \\times ${rH} + \\frac{1}{2} \\times ${rW} \\times ${tH} = ${rW * rH} + ${(rW * tH) / 2} = ${area}$ ${u}²` };
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
        const a = ri(rng, 2, 4), b = ri(rng, 1, 6), c = ri(rng, 2, 4), d = ri(rng, 1, 6);
        const lead = a * c, mid2 = a * d + b * c, last2 = b * d;
        const m2Str = mid2 >= 0 ? `+${mid2}` : `${mid2}`;
        const expandVerb = rc(rng, ['Expand:', 'Expand and simplify:']);
        return { clue: `${expandVerb}\n$(${a}x + ${b})(${c}x + ${d})$`, answer: `${lead}x²${m2Str}x+${last2}`, answerDisplay: `$${lead}x^2 ${mid2 >= 0 ? '+' : ''}${mid2}x + ${last2}$` };
    }

    if (op === 'factorise') {
        if (diff === 'Easy') {
            const a = ri(rng, 1, 7), b = ri(rng, 1, 7);
            const mid = a + b, last = a * b;
            return { clue: `Factorise:\n$x^2 + ${mid}x + ${last}$`, answer: `(x+${a})(x+${b})`, answerDisplay: `$(x + ${a})(x + ${b})$` };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 2);
            if (type === 0) {
                // Perfect square
                const a = ri(rng, 2, 7);
                return { clue: `Factorise:\n$x^2 + ${2 * a}x + ${a * a}$`, answer: `(x+${a})²`, answerDisplay: `$(x + ${a})^2$` };
            }
            if (type === 1) {
                // Trinomial with one negative: (x+a)(x-b) = x² + (a-b)x - ab
                const a = ri(rng, 2, 7), b = ri(rng, 1, a - 1 || 1);
                const mid = a - b;
                const mStr = mid > 0 ? `+ ${mid}` : mid < 0 ? `- ${Math.abs(mid)}` : '';
                return { clue: `Factorise:\n$x^2 ${mStr}x - ${a * b}$`, answer: `(x+${a})(x-${b})`, answerDisplay: `$(x + ${a})(x - ${b})$` };
            }
            // Common factor: ax² + bx = x(ax + b)
            const cf = ri(rng, 2, 5), coeff = ri(rng, 1, 6);
            return { clue: `Factorise:\n$${cf}x^2 + ${cf * coeff}x$`, answer: `${cf}x(x+${coeff})`, answerDisplay: `$${cf}x(x + ${coeff})$` };
        }
        // Hard
        const type = ri(rng, 0, 1);
        if (type === 0) {
            // Difference of two squares with larger numbers
            const n = ri(rng, 3, 12);
            return { clue: `Factorise:\n$x^2 - ${n * n}$`, answer: `(x+${n})(x-${n})`, answerDisplay: `$(x + ${n})(x - ${n})$` };
        }
        // Trinomial with two negative roots: (x-a)(x-b) = x² - (a+b)x + ab
        const a = ri(rng, 2, 8), b = ri(rng, 1, 7);
        if (a === b) return _genAlgebraOp(rng, diff, op);
        const mid = a + b, last = a * b;
        return { clue: `Factorise:\n$x^2 - ${mid}x + ${last}$`, answer: `(x-${a})(x-${b})`, answerDisplay: `$(x - ${a})(x - ${b})$` };
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
            const base = ri(rng, 2, 6), m = ri(rng, 2, 4), n = ri(rng, 1, 3);
            const sum = m + n;
            const ans = Math.pow(base, sum);
            if (ans > 99999) return null;
            return { clue: `${sv}\n$${base}^{${m}} \\times ${base}^{${n}}$`, answer: String(ans), answerDisplay: `$${base}^{${sum}} = ${ans}$` };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 1);
            if (type === 0) {
                const base = ri(rng, 2, 6), n2 = ri(rng, 2, 4), extra = ri(rng, 2, 4);
                const m2 = n2 + extra;
                return {
                    clue: `Simplify $${base}^{${m2}} \\div ${base}^{${n2}}$, writing your answer as a power of $${base}$.`,
                    answer: `${base}^${extra}`,
                    answerDisplay: `$${base}^{${extra}}$`,
                };
            }
            const base = ri(rng, 2, 5), m = ri(rng, 2, 3), n = ri(rng, 2, 3);
            const prod = m * n;
            return {
                clue: `Simplify $(${base}^{${m}})^{${n}}$, writing your answer as a power of $${base}$.`,
                answer: `${base}^${prod}`,
                answerDisplay: `$${base}^{${prod}}$`,
            };
        }
        // Hard: combined laws — a^m × a^n ÷ a^p
        const base = ri(rng, 2, 5);
        const m = ri(rng, 2, 5), n = ri(rng, 2, 4), p = ri(rng, 1, 3);
        const total = m + n - p;
        if (total < 1) return null;
        return {
            clue: `Simplify $${base}^{${m}} \\times ${base}^{${n}} \\div ${base}^{${p}}$, writing your answer as a power of $${base}$.`,
            answer: `${base}^${total}`,
            answerDisplay: `$${base}^{${total}}$`,
            worked: `$${base}^{${m}+${n}-${p}} = ${base}^{${total}}$`,
        };
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
        if (diff === 'Easy') {
            const k1 = ri(rng, 1, 5), k2 = ri(rng, 1, 5), n = rc(rng, [2, 3, 5, 6, 7]);
            const sum = k1 + k2;
            return { clue: `${sv}\n$${k1}\\sqrt{${n}} + ${k2}\\sqrt{${n}}$`, answer: `${sum}√${n}`, answerDisplay: `$${sum}\\sqrt{${n}}$` };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 1);
            const k1 = ri(rng, 2, 6), k2 = ri(rng, 1, k1 - 1 || 1), n = rc(rng, [2, 3, 5, 6, 7]);
            if (type === 0) {
                // Subtraction
                const diff2 = k1 - k2;
                return { clue: `${sv}\n$${k1}\\sqrt{${n}} - ${k2}\\sqrt{${n}}$`, answer: `${diff2}√${n}`, answerDisplay: `$${diff2}\\sqrt{${n}}$` };
            }
            // Multiplication
            const prod = k1 * k2 * n;
            return { clue: `${sv}\n$${k1}\\sqrt{${n}} \\times ${k2}\\sqrt{${n}}$`, answer: String(prod), answerDisplay: `$${prod}$` };
        }
        // Hard: multiply surds with different radicands (simplify result)
        const k1 = ri(rng, 1, 4), k2 = ri(rng, 1, 4);
        const n1 = rc(rng, [2, 3, 5]), n2 = rc(rng, [2, 3, 5, 6]);
        const prod = k1 * k2;
        const radicand = n1 * n2;
        const sqPart = Math.floor(Math.sqrt(radicand));
        if (sqPart * sqPart === radicand) {
            return { clue: `${sv}\n$${k1}\\sqrt{${n1}} \\times ${k2}\\sqrt{${n2}}$`, answer: String(prod * sqPart), answerDisplay: `$${prod * sqPart}$` };
        }
        return { clue: `${sv}\n$${k1}\\sqrt{${n1}} \\times ${k2}\\sqrt{${n2}}$`, answer: `${prod}√${radicand}`, answerDisplay: `$${prod}\\sqrt{${radicand}}$` };
    }

    return null;
}

// ---- Statistics Stage 5 operations -------------------------
function _genStatisticsS5Op(rng, diff, op) {
    if (op === 'five-number-summary') {
        const n = diff === 'Easy' ? 8 : diff === 'Medium' ? 10 : 12;
        const hi = diff === 'Easy' ? 15 : diff === 'Medium' ? 25 : 40;
        const data = Array.from({ length: n }, () => ri(rng, 1, hi) * 2).sort((a, b) => a - b);
        const mid = Math.floor(n / 2);
        const lower = data.slice(0, mid);
        const upper = data.slice(n % 2 ? mid + 1 : mid);
        const medArr = n % 2 ? [data[mid]] : [data[mid - 1], data[mid]];
        const med = medArr.length === 1 ? medArr[0] : (medArr[0] + medArr[1]) / 2;
        const lMid = Math.floor(lower.length / 2);
        const q1 = lower.length % 2 ? lower[lMid] : (lower[lMid - 1] + lower[lMid]) / 2;
        const uMid = Math.floor(upper.length / 2);
        const q3 = upper.length % 2 ? upper[uMid] : (upper[uMid - 1] + upper[uMid]) / 2;
        const iqr = q3 - q1;
        if (iqr <= 0) return null;
        const choices = diff === 'Easy'
            ? ['Q1', 'Q3', 'median']
            : diff === 'Medium'
            ? ['Q1', 'Q3', 'median', 'IQR']
            : ['IQR', 'Q1', 'Q3', 'min', 'max', 'range'];
        const choice = rc(rng, choices);
        let ans, clueQ;
        if (choice === 'Q1') { ans = q1; clueQ = 'Find **Q1** (lower quartile)'; }
        else if (choice === 'Q3') { ans = q3; clueQ = 'Find **Q3** (upper quartile)'; }
        else if (choice === 'median') { ans = med; clueQ = 'Find the **median**'; }
        else if (choice === 'IQR') { ans = iqr; clueQ = 'Find the **interquartile range (IQR)**'; }
        else if (choice === 'min') { ans = data[0]; clueQ = 'Find the **minimum** value'; }
        else if (choice === 'max') { ans = data[n - 1]; clueQ = 'Find the **maximum** value'; }
        else { ans = data[n - 1] - data[0]; clueQ = 'Find the **range**'; }
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
        const type = diff === 'Hard' ? ri(rng, 0, 1) : 0;
        if (type === 0) {
            // Rectangular prism
            const [lHi, wHi, hHi] = diff === 'Easy' ? [6, 5, 5] : diff === 'Medium' ? [10, 8, 8] : [15, 12, 10];
            const l = ri(rng, 2, lHi), w = ri(rng, 2, wHi), h = ri(rng, 2, hHi);
            const u = _geoUnit(Math.max(l, w, h));
            const sa = 2 * (l * w + l * h + w * h);
            const ph = rc(rng, [
                `Find the *surface area* of a rectangular prism: length $${l}$ ${u}, width $${w}$ ${u}, height $${h}$ ${u}.`,
                `Calculate the *total surface area* of a rectangular box with dimensions $${l}$ ${u} × $${w}$ ${u} × $${h}$ ${u}.`,
                `A rectangular prism has dimensions $${l}$ ${u} by $${w}$ ${u} by $${h}$ ${u}. Find its surface area.`,
            ]);
            return { clue: ph, answer: String(sa), answerDisplay: `${sa} ${u}²`, worked: `$SA = 2(${l} \\times ${w} + ${l} \\times ${h} + ${w} \\times ${h}) = 2(${l*w} + ${l*h} + ${w*h}) = ${sa}$ ${u}²` };
        }
        // Cylinder: SA = 2πr² + 2πrh
        const r = ri(rng, 2, 8), h = ri(rng, 3, 12);
        const sa = round(2 * Math.PI * r * r + 2 * Math.PI * r * h, 2);
        return {
            clue: `Find the *surface area* of a cylinder with radius $${r}$ cm and height $${h}$ cm. Give your answer to 2 decimal places.`,
            answer: String(sa),
            answerDisplay: `${sa} cm²`,
            worked: `$SA = 2\\pi r^2 + 2\\pi rh = 2\\pi(${r})^2 + 2\\pi(${r})(${h}) = ${sa}$ cm²`,
        };
    }

    if (op === 'composite-volume') {
        // Two rectangular prisms joined — larger dimensions at higher difficulty
        const [l1Hi, w1Hi, h1Hi] = diff === 'Easy' ? [6, 5, 4] : diff === 'Medium' ? [10, 8, 6] : [15, 12, 8];
        const l1 = ri(rng, 3, l1Hi), w1 = ri(rng, 2, w1Hi), h1 = ri(rng, 2, h1Hi);
        const l2 = ri(rng, 2, l1), w2 = ri(rng, 2, w1), h2 = ri(rng, 2, Math.max(2, h1 - 1));
        const _u = 'm';
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
        const a = ri(rng, 3, sidesHi), b = ri(rng, 3, sidesHi);
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
        const P = ri(rng, 3, 25) * 1000, r = rc(rng, [5, 8, 10, 12, 15, 20, 25]), t = ri(rng, 1, diff === 'Hard' ? 5 : 3);
        if (diff === 'Easy') {
            // Straight-line: annual loss = P × r%
            const annualLoss = P * r / 100;
            const ph = rc(rng, [
                `A car worth $\\$${P}$ depreciates at $${r}\\%$ per year (straight-line). Find the *annual depreciation*.`,
                `Using straight-line depreciation, find the annual loss on $\\$${P}$ at $${r}\\%$ p.a.`,
            ]);
            return { clue: ph, answer: String(annualLoss), answerDisplay: `$${money(annualLoss)}` };
        }
        // Reducing balance: V = P(1-r/100)^t
        const V = round(P * Math.pow(1 - r / 100, t), 2);
        const ph = rc(rng, [
            `A machine worth $\\$${P}$ depreciates at $${r}\\%$ p.a. (reducing balance). Find its value after $${t}$ year${t > 1 ? 's' : ''}.`,
            `Using $V = P(1 - r)^n$, find the value of $\\$${P}$ after $${t}$ year${t > 1 ? 's' : ''} at $${r}\\%$ p.a. depreciation.`,
        ]);
        return { clue: ph, answer: String(V), answerDisplay: `$${money(V)}` };
    }

    // compound-period: compounding more than once per year
    const [P2Lo, P2Hi, nPerPool, t2Hi] =
        diff === 'Easy'   ? [1, 5,  [2, 4],     1] :
        diff === 'Medium' ? [2, 10, [2, 4, 12], 2] :
                            [5, 20, [4, 12],    3];
    const P2 = ri(rng, P2Lo, P2Hi) * 1000;
    const rAnnual = rc(rng, [4, 5, 6, 8, 10, 12]);
    const nPer = rc(rng, nPerPool);
    const periodLabel = nPer === 2 ? 'half-yearly' : nPer === 4 ? 'quarterly' : 'monthly';
    const t2 = ri(rng, 1, t2Hi);
    const A = round(P2 * Math.pow(1 + rAnnual / 100 / nPer, nPer * t2), 2);
    const ph = rc(rng, [
        `$\\$${P2}$ is invested at $${rAnnual}\\%$ p.a. compounded ${periodLabel} for $${t2}$ year${t2 > 1 ? 's' : ''}. Find the total amount.`,
        `Find the future value of $\\$${P2}$ compounded ${periodLabel} at $${rAnnual}\\%$ p.a. over $${t2}$ year${t2 > 1 ? 's' : ''}.`,
    ]);
    return { clue: ph, answer: String(A), answerDisplay: `$${money(A)}` };
}

// ---- Trigonometry (Stage 5 new topic) -----------------------
const TRIG_TRIPLES = [
    { a: 3, b: 4, c: 5 }, { a: 5, b: 12, c: 13 }, { a: 6, b: 8, c: 10 },
    { a: 8, b: 15, c: 17 }, { a: 9, b: 12, c: 15 }, { a: 7, b: 24, c: 25 },
    { a: 9, b: 40, c: 41 }, { a: 12, b: 35, c: 37 }, { a: 15, b: 20, c: 25 },
];

function genTrigonometry(rng, diff, allowedOps) {
    const OPS = ['find-side', 'find-angle', 'applications', 'obtuse-angles', 'bearings'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'find-side') {
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 3) : diff === 'Medium' ? ri(rng, 2, 7) : ri(rng, 3, 10);
        const angle2 = round(Math.atan2(triple.a, triple.b) * 180 / Math.PI, 1);
        // Find-hypotenuse variant (Medium/Hard, 25%)
        if (diff !== 'Easy' && rng() < 0.25) {
            const opp2 = triple.a * scale, hyp2 = triple.c * scale, adj2 = triple.b * scale;
            const u2 = _geoUnit(hyp2);
            const sinV = round(Math.sin(angle2 * Math.PI / 180), 3);
            const clue = rc(rng, [
                `Find the *hypotenuse* of a right triangle with opposite side $${opp2}$ ${u2} and angle $${angle2}$°. Use $\\sin(${angle2}°) \\approx ${sinV}$.`,
                `A right-angled triangle has opposite side $${opp2}$ ${u2} and angle $${angle2}$°. Calculate the *hypotenuse*. Use $\\sin(${angle2}°) \\approx ${sinV}$.`,
            ]);
            return {
                clue, answer: String(hyp2), answerDisplay: `${hyp2} ${u2}`,
                worked: `$\\text{hyp} = \\frac{${opp2}}{\\sin(${angle2}°)} = \\frac{${opp2}}{${sinV}} = ${hyp2}$`,
                diagram: { type: 'right-triangle-trig', opp: opp2, adj: adj2, hyp: hyp2, angle: angle2, missing: 'hyp' },
            };
        }
        const choice = rc(rng, diff === 'Easy' ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
        if (choice === 'sin') {
            const hyp2 = triple.c * scale, opp2 = triple.a * scale;
            const u2 = _geoUnit(hyp2);
            const sinV = round(Math.sin(angle2 * Math.PI / 180), 3);
            const clue = rc(rng, [
                `Find the *opposite* side of a right triangle with hypotenuse $${hyp2}$ ${u2} and angle $${angle2}$°. Use $\\sin(${angle2}°) \\approx ${sinV}$.`,
                `A right-angled triangle has hypotenuse $${hyp2}$ ${u2} and an angle of $${angle2}$°. Find the *opposite* side. Use $\\sin(${angle2}°) \\approx ${sinV}$.`,
            ]);
            return {
                clue, answer: String(opp2), answerDisplay: `${opp2} ${u2}`,
                worked: `$\\text{opp} = ${hyp2} \\times \\sin(${angle2}°) = ${hyp2} \\times ${sinV} = ${opp2}$`,
                diagram: { type: 'right-triangle-trig', opp: opp2, adj: triple.b * scale, hyp: hyp2, angle: angle2, missing: 'opp' },
            };
        }
        if (choice === 'cos') {
            const hyp2 = triple.c * scale, adj2 = triple.b * scale;
            const u2 = _geoUnit(hyp2);
            const cosV = round(Math.cos(angle2 * Math.PI / 180), 3);
            const clue = rc(rng, [
                `Find the *adjacent* side of a right triangle with hypotenuse $${hyp2}$ ${u2} and angle $${angle2}$°. Use $\\cos(${angle2}°) \\approx ${cosV}$.`,
                `A right-angled triangle has hypotenuse $${hyp2}$ ${u2} and an angle of $${angle2}$°. Calculate the *adjacent* side. Use $\\cos(${angle2}°) \\approx ${cosV}$.`,
            ]);
            return {
                clue, answer: String(adj2), answerDisplay: `${adj2} ${u2}`,
                worked: `$\\text{adj} = ${hyp2} \\times \\cos(${angle2}°) = ${hyp2} \\times ${cosV} = ${adj2}$`,
                diagram: { type: 'right-triangle-trig', opp: triple.a * scale, adj: adj2, hyp: hyp2, angle: angle2, missing: 'adj' },
            };
        }
        // tan: find opp from adj, or find adj from opp
        const opp2 = triple.a * scale, adj2 = triple.b * scale, hyp2 = triple.c * scale;
        const u2 = _geoUnit(Math.max(opp2, adj2));
        const tanV = round(Math.tan(angle2 * Math.PI / 180), 3);
        if (diff !== 'Easy' && rng() < 0.4) {
            const clue = rc(rng, [
                `Find the *adjacent* side of a right triangle with opposite $${opp2}$ ${u2} and angle $${angle2}$°. Use $\\tan(${angle2}°) \\approx ${tanV}$.`,
                `A right triangle has opposite side $${opp2}$ ${u2} and angle $${angle2}$°. Find the *adjacent* side. Use $\\tan(${angle2}°) \\approx ${tanV}$.`,
            ]);
            return {
                clue, answer: String(adj2), answerDisplay: `${adj2} ${u2}`,
                worked: `$\\text{adj} = \\frac{${opp2}}{\\tan(${angle2}°)} = \\frac{${opp2}}{${tanV}} = ${adj2}$`,
                diagram: { type: 'right-triangle-trig', opp: opp2, adj: adj2, hyp: hyp2, angle: angle2, missing: 'adj' },
            };
        }
        const clue = rc(rng, [
            `Find the *opposite* side of a right triangle with adjacent $${adj2}$ ${u2} and angle $${angle2}$°. Use $\\tan(${angle2}°) \\approx ${tanV}$.`,
            `A right triangle has adjacent side $${adj2}$ ${u2} and angle $${angle2}$°. Calculate the *opposite* side. Use $\\tan(${angle2}°) \\approx ${tanV}$.`,
        ]);
        return {
            clue, answer: String(opp2), answerDisplay: `${opp2} ${u2}`,
            worked: `$\\text{opp} = ${adj2} \\times \\tan(${angle2}°) = ${adj2} \\times ${tanV} = ${opp2}$`,
            diagram: { type: 'right-triangle-trig', opp: opp2, adj: adj2, hyp: hyp2, angle: angle2, missing: 'opp' },
        };
    }

    if (op === 'find-angle') {
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 3) : diff === 'Medium' ? ri(rng, 2, 6) : ri(rng, 3, 9);
        const opp = triple.a * scale, adj = triple.b * scale, hyp = triple.c * scale;
        const u = _geoUnit(hyp);
        const ratio = rc(rng, diff === 'Easy' ? ['tan', 'sin'] : ['tan', 'sin', 'cos']);
        let theta, ph, ratioStr;
        if (ratio === 'tan') {
            theta = round(Math.atan2(opp, adj) * 180 / Math.PI, 1);
            ratioStr = `\\frac{${opp}}{${adj}}`;
            ph = rc(rng, [
                `Find the angle $\\theta$ in a right triangle with opposite $${opp}$ ${u} and adjacent $${adj}$ ${u}.`,
                `Calculate the angle $\\theta$ given opposite $= ${opp}$ ${u} and adjacent $= ${adj}$ ${u} in a right triangle.`,
                `A right triangle has legs $${opp}$ ${u} and $${adj}$ ${u}. Find the smaller angle $\\theta$.`,
            ]);
        } else if (ratio === 'sin') {
            theta = round(Math.asin(opp / hyp) * 180 / Math.PI, 1);
            ratioStr = `\\frac{${opp}}{${hyp}}`;
            ph = rc(rng, [
                `Find angle $\\theta$ in a right triangle with opposite $${opp}$ ${u} and hypotenuse $${hyp}$ ${u}.`,
                `A right triangle has opposite side $${opp}$ ${u} and hypotenuse $${hyp}$ ${u}. Calculate $\\theta$.`,
            ]);
        } else {
            theta = round(Math.acos(adj / hyp) * 180 / Math.PI, 1);
            ratioStr = `\\frac{${adj}}{${hyp}}`;
            ph = rc(rng, [
                `Find angle $\\theta$ in a right triangle with adjacent $${adj}$ ${u} and hypotenuse $${hyp}$ ${u}.`,
                `A right triangle has adjacent side $${adj}$ ${u} and hypotenuse $${hyp}$ ${u}. Calculate $\\theta$.`,
            ]);
        }
        return {
            clue: ph, answer: `${theta}°`, answerDisplay: `$\\theta = ${theta}$°`,
            worked: `$\\${ratio}(\\theta) = ${ratioStr} \\Rightarrow \\theta = ${theta}°$`,
            diagram: { type: 'right-triangle-trig', opp, adj, hyp, angle: theta, missing: 'angle' },
        };
    }

    if (op === 'applications') {
        const triple = rc(rng, TRIG_TRIPLES);
        const scale = diff === 'Easy' ? ri(rng, 1, 4) : diff === 'Medium' ? ri(rng, 3, 8) : ri(rng, 5, 12);
        const height = triple.a * scale, dist = triple.b * scale;
        const angle = round(Math.atan2(height, dist) * 180 / Math.PI, 1);
        // Hard: sometimes ask for a side given the angle (find the height/distance)
        if (diff === 'Hard' && rng() < 0.35) {
            const tanV = round(Math.tan(angle * Math.PI / 180), 3);
            if (rng() < 0.5) {
                const ph = rc(rng, [
                    `From a point $${dist}$ m away from a tower, the *angle of elevation* to the top is $${angle}$°. Find the height of the tower. Use $\\tan(${angle}°) \\approx ${tanV}$.`,
                    `A surveyor stands $${dist}$ m from a building. The *angle of elevation* to the roof is $${angle}$°. How tall is the building? Use $\\tan(${angle}°) \\approx ${tanV}$.`,
                ]);
                return {
                    clue: ph, answer: String(height), answerDisplay: `${height} m`,
                    worked: `$h = ${dist} \\times \\tan(${angle}°) = ${dist} \\times ${tanV} = ${height}$ m`,
                };
            }
            const ph = `A tree is $${height}$ m tall. The *angle of elevation* from a point on the ground to the top is $${angle}$°. How far is the point from the base? Use $\\tan(${angle}°) \\approx ${tanV}$.`;
            return {
                clue: ph, answer: String(dist), answerDisplay: `${dist} m`,
                worked: `$d = \\frac{${height}}{\\tan(${angle}°)} = \\frac{${height}}{${tanV}} = ${dist}$ m`,
            };
        }
        const ph = rc(rng, [
            `A ladder leans against a wall. The base is $${dist}$ m from the wall and the ladder reaches $${height}$ m up the wall. Find the angle the ladder makes with the ground.`,
            `From a point $${dist}$ m away from a building, the *angle of elevation* to the top is measured. If the building is $${height}$ m tall, find the angle of elevation.`,
            `From the top of a cliff $${height}$ m high, the *angle of depression* to a boat $${dist}$ m offshore is measured. Find the angle of depression.`,
            `A drone flies at a height of $${height}$ m and spots a marker $${dist}$ m away on the ground. Find the *angle of depression* from the drone to the marker.`,
            `A ramp rises $${height}$ m over a horizontal distance of $${dist}$ m. Find the angle the ramp makes with the ground.`,
            `A guy wire supports a pole $${height}$ m tall. It is anchored $${dist}$ m from the base. Find the angle the wire makes with the ground.`,
        ]);
        return {
            clue: ph, answer: `${angle}°`, answerDisplay: `${angle}°`,
            worked: `$\\tan(\\theta) = \\frac{${height}}{${dist}} \\Rightarrow \\theta = ${angle}°$`,
        };
    }

    if (op === 'obtuse-angles') {
        const aAngles = diff === 'Easy' ? [30, 45, 60] : [25, 30, 35, 40, 45, 50, 55, 60];
        const A = rc(rng, aAngles);
        const aVal = diff === 'Easy' ? ri(rng, 4, 10) : diff === 'Medium' ? ri(rng, 5, 15) : ri(rng, 6, 20);
        // Hard: sometimes use cosine rule instead of sine rule
        if (diff === 'Hard' && rng() < 0.35) {
            const b = ri(rng, 5, 16);
            const C = rc(rng, [30, 45, 60, 90, 100, 110, 120]);
            const c2 = aVal * aVal + b * b - 2 * aVal * b * Math.cos(C * Math.PI / 180);
            if (c2 <= 0) return null;
            const c = round(Math.sqrt(c2), 1);
            if (c < 1 || c > 50) return null;
            const ph = rc(rng, [
                `In a triangle, $a = ${aVal}$ cm, $b = ${b}$ cm and the *included* angle $C = ${C}$°. Use the *cosine rule* to find side $c$.`,
                `Using the cosine rule: $a = ${aVal}$ cm, $b = ${b}$ cm, $\\angle C = ${C}$°. Find $c$.`,
            ]);
            return {
                clue: ph, answer: String(c), answerDisplay: `${c} cm`,
                worked: `$c^2 = ${aVal}^2 + ${b}^2 - 2(${aVal})(${b})\\cos(${C}°) \\Rightarrow c = ${c}$ cm`,
            };
        }
        const bAngles = diff === 'Easy' ? [20, 35, 50, 80] : [20, 25, 35, 40, 50, 55, 70, 80, 100, 110, 120, 130, 135];
        const B = rc(rng, bAngles);
        if (A + B >= 180) return null;
        const b = round(aVal * Math.sin(B * Math.PI / 180) / Math.sin(A * Math.PI / 180), 1);
        if (b < 1 || b > 40) return null;
        const ph = rc(rng, [
            `In a triangle, $a = ${aVal}$ cm, $\\angle A = ${A}$° and $\\angle B = ${B}$°. Use the *sine rule* to find side $b$.`,
            `Using the sine rule: $a = ${aVal}$ cm, $A = ${A}$°, $B = ${B}$°. Find $b$.`,
            `A triangle has $\\angle A = ${A}$°, $\\angle B = ${B}$° and side $a = ${aVal}$ cm. Calculate $b$ using the *sine rule*.`,
        ]);
        return {
            clue: ph, answer: String(b), answerDisplay: `${b} cm`,
            worked: `$\\frac{b}{\\sin(${B}°)} = \\frac{${aVal}}{\\sin(${A}°)} \\Rightarrow b = ${b}$ cm`,
        };
    }

    if (op === 'bearings') {
        const dist = diff === 'Easy' ? ri(rng, 2, 10) * 10 : diff === 'Medium' ? ri(rng, 3, 20) * 10 : ri(rng, 5, 30) * 10;
        const bearingPool = diff === 'Easy'
            ? [30, 45, 60, 120, 150, 210, 240, 300, 315, 330]
            : [20, 30, 40, 45, 55, 60, 70, 110, 120, 135, 150, 160, 200, 210, 225, 240, 250, 290, 300, 310, 315, 330, 340];
        const bearing = rc(rng, bearingPool);
        const radians = bearing * Math.PI / 180;
        const eastward = round(dist * Math.sin(radians), 1);
        const northward = round(dist * Math.cos(radians), 1);
        const bStr = String(bearing).padStart(3, '0');
        if (rng() < 0.5) {
            const ph = rc(rng, [
                `A ship travels $${dist}$ km on a bearing of $${bStr}$°T. How far *east* (or west) of its starting point is it?`,
                `From port, a vessel sails $${dist}$ km on a bearing of $${bStr}$°T. Find its *east/west* displacement.`,
                `A hiker walks $${dist}$ km on a bearing of $${bStr}$°T. Find the *east/west* distance from the start.`,
            ]);
            const absE = Math.abs(eastward);
            const dir = eastward >= 0 ? 'east' : 'west';
            return {
                clue: ph, answer: String(absE), answerDisplay: `${absE} km ${dir}`,
                worked: `$\\text{E/W} = ${dist} \\times \\sin(${bearing}°) = ${absE}$ km ${dir}`,
            };
        }
        const ph = rc(rng, [
            `A ship travels $${dist}$ km on a bearing of $${bStr}$°T. How far *north* (or south) of its starting point is it?`,
            `An aircraft flies $${dist}$ km on a bearing of $${bStr}$°T. Find its *north/south* displacement.`,
            `A cyclist rides $${dist}$ km on a bearing of $${bStr}$°T. Find the *north/south* distance from the start.`,
        ]);
        const absN = Math.abs(northward);
        const dir = northward >= 0 ? 'north' : 'south';
        return {
            clue: ph, answer: String(absN), answerDisplay: `${absN} km ${dir}`,
            worked: `$\\text{N/S} = ${dist} \\times \\cos(${bearing}°) = ${absN}$ km ${dir}`,
        };
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
        const hPool = diff === 'Easy' ? [-3, -2, -1, 1, 2, 3, 4] : [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6];
        const h = rc(rng, hPool);
        const kRange = diff === 'Easy' ? [-3, 4] : diff === 'Medium' ? [-5, 5] : [-8, 8];
        const k = ri(rng, kRange[0], kRange[1]);
        const xPart = `(x ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})`;
        const kPart = k === 0 ? '' : (k > 0 ? ` + ${k}` : ` - ${Math.abs(k)}`);
        const eq = `${xPart}^2${kPart}`;
        if (diff === 'Easy') {
            const yInt = h * h + k;
            // Alternate between vertex and y-intercept questions
            if (rng() < 0.35) {
                const ph = rc(rng, [
                    `Find the $y$-intercept of $y = ${eq}$.`,
                    `What is the $y$-intercept of the parabola $y = ${eq}$?`,
                ]);
                return {
                    clue: ph, answer: String(yInt), answerDisplay: `$y = ${yInt}$`,
                    worked: `$y\\text{-int: set } x = 0: y = (0 ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})^2${kPart} = ${h * h}${kPart} = ${yInt}$`,
                    diagram: { type: 'parabola', h, k, a: 1 },
                };
            }
            const ph = rc(rng, [
                `State the *vertex* of the parabola $y = ${eq}$.`,
                `Find the *vertex* of $y = ${eq}$.`,
                `What is the *turning point* of $y = ${eq}$?`,
            ]);
            return {
                clue: ph, answer: `(${h},${k})`, answerDisplay: `$(${h}, ${k})$`,
                worked: `$y = (x ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})^2${kPart} \\Rightarrow \\text{vertex} = (${h}, ${k})$`,
                diagram: { type: 'parabola', h, k, a: 1 },
            };
        }
        if (diff === 'Medium') {
            // Alternate between axis of symmetry, y-intercept, and x-intercepts (factored form)
            const variant = ri(rng, 0, 2);
            if (variant === 0) {
                const ph = rc(rng, [
                    `State the *axis of symmetry* of $y = ${eq}$.`,
                    `Find the *axis of symmetry* of the parabola $y = ${eq}$.`,
                ]);
                return {
                    clue: ph, answer: `x=${h}`, answerDisplay: `$x = ${h}$`,
                    worked: `$y = (x ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})^2${kPart} \\Rightarrow x = ${h}$`,
                    diagram: { type: 'parabola', h, k, a: 1 },
                };
            }
            if (variant === 1) {
                const yInt = h * h + k;
                const ph = `Find the $y$-intercept of $y = ${eq}$.`;
                return {
                    clue: ph, answer: String(yInt), answerDisplay: `$y = ${yInt}$`,
                    worked: `$y\\text{-int: } y = (0 ${h > 0 ? `- ${h}` : `+ ${Math.abs(h)}`})^2${kPart} = ${yInt}$`,
                    diagram: { type: 'parabola', h, k, a: 1 },
                };
            }
            // x-intercepts from factored form y = (x-r1)(x-r2)
            const r1 = ri(rng, -5, 5), r2 = ri(rng, -5, 5);
            if (r1 === r2) return genNonLinear(rng, diff, allowedOps);
            const r1Part = r1 > 0 ? `(x - ${r1})` : r1 < 0 ? `(x + ${Math.abs(r1)})` : 'x';
            const r2Part = r2 > 0 ? `(x - ${r2})` : r2 < 0 ? `(x + ${Math.abs(r2)})` : 'x';
            const ph = `Find the $x$-intercepts of $y = ${r1Part}${r2Part}$.`;
            const ans = r1 < r2 ? `x=${r1},x=${r2}` : `x=${r2},x=${r1}`;
            const disp = r1 < r2 ? `$x = ${r1}$ and $x = ${r2}$` : `$x = ${r2}$ and $x = ${r1}$`;
            return {
                clue: ph, answer: ans, answerDisplay: disp,
                worked: `$\\text{Set } y = 0: ${r1Part}${r2Part} = 0 \\Rightarrow x = ${r1} \\text{ or } x = ${r2}$`,
            };
        }
        // Hard: expanded form → find vertex or axis using x = -b/2a
        const a = rc(rng, [1, 1, 2, -1, -2]);
        const bCoeff = -2 * a * h, cCoeff = a * h * h + k;
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const bStr = bCoeff > 0 ? `+ ${bCoeff}x` : bCoeff < 0 ? `- ${Math.abs(bCoeff)}x` : '';
        const cStr = cCoeff === 0 ? '' : (cCoeff > 0 ? ` + ${cCoeff}` : ` - ${Math.abs(cCoeff)}`);
        if (rng() < 0.5) {
            const ph = `Find the *axis of symmetry* of $y = ${aStr}x^2 ${bStr}${cStr}$ using $x = -\\dfrac{b}{2a}$.`;
            return {
                clue: ph, answer: `x=${h}`, answerDisplay: `$x = ${h}$`,
                worked: `$x = -\\frac{${bCoeff}}{2 \\times ${a}} = -\\frac{${bCoeff}}{${2 * a}} = ${h}$`,
            };
        }
        const ph = `Find the *vertex* of $y = ${aStr}x^2 ${bStr}${cStr}$ using $x = -\\dfrac{b}{2a}$.`;
        return {
            clue: ph, answer: `(${h},${k})`, answerDisplay: `$(${h}, ${k})$`,
            worked: `$x = -\\frac{${bCoeff}}{${2 * a}} = ${h}, \\; y = ${a === 1 ? '' : a + '\\times'}${h}^2 ${bStr.replace('x', `\\times ${h}`)}${cStr} = ${k}$`,
        };
    }

    if (op === 'parabola-sketch') {
        const aPool = diff === 'Easy' ? [1, -1] : diff === 'Medium' ? [1, -1, 2, -2] : [2, -2, 3, -3, 0.5, -0.5];
        const hPool = diff === 'Easy' ? [-3, -2, -1, 0, 1, 2, 3] : [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
        const [kLo, kHi] = diff === 'Easy' ? [-3, 5] : diff === 'Medium' ? [-6, 6] : [-8, 8];
        const a = rc(rng, aPool);
        const h2 = rc(rng, hPool);
        const k2 = a < 0 ? Math.max(0, ri(rng, kLo, kHi)) : ri(rng, kLo, kHi);
        const opens = a > 0 ? 'upward' : 'downward';
        const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
        const xPart = h2 === 0 ? 'x' : `(x ${h2 > 0 ? `- ${h2}` : `+ ${Math.abs(h2)}`})`;
        const kPart = k2 === 0 ? '' : (k2 > 0 ? ` + ${k2}` : ` - ${Math.abs(k2)}`);
        const eq = `${aStr}${xPart}^2${kPart}`;
        const yIntercept = a * h2 * h2 + k2;
        if (diff === 'Hard') {
            const ph = rc(rng, [
                `For $y = ${eq}$, state the vertex, direction it opens, and $y$-intercept.`,
                `Describe the key features of $y = ${eq}$: vertex, direction, and $y$-intercept.`,
                `For $y = ${eq}$, state the vertex, whether it has a maximum or minimum, and the $y$-intercept.`,
            ]);
            const maxMin = a > 0 ? 'minimum' : 'maximum';
            const answerDisplay = `Vertex $(${h2}, ${k2})$, opens ${opens}, $y$-int $= ${yIntercept}$`;
            const answer = `(${h2},${k2})${opens[0].toUpperCase()}y=${yIntercept}`;
            return { clue: ph, answer, answerDisplay, diagram: { type: 'parabola', h: h2, k: k2, a },
                worked: `$\\text{Vertex } (${h2}, ${k2}), \\text{ opens ${opens} (${maxMin})}, y\\text{-int} = ${a === 1 ? '' : a + ' \\times '}${h2}^2${kPart} = ${yIntercept}$` };
        }
        const ph = rc(rng, [
            `For $y = ${eq}$, state the vertex and direction it opens.`,
            `State the vertex and concavity of $y = ${eq}$.`,
        ]);
        const answerDisplay = `Vertex $(${h2}, ${k2})$, opens ${opens}`;
        const answer = `(${h2},${k2})${opens[0].toUpperCase()}`;
        return { clue: ph, answer, answerDisplay, diagram: { type: 'parabola', h: h2, k: k2, a }, worked: `Vertex $= (${h2}, ${k2})$, $a ${a > 0 ? '>' : '<'} 0$ so opens ${opens}` };
    }

    if (op === 'identify-graph') {
        // Dynamic generation instead of static list
        const variant = ri(rng, 0, diff === 'Easy' ? 3 : diff === 'Medium' ? 4 : 5);
        let eq, type;
        if (variant <= 1) {
            // Parabola
            const a = rc(rng, diff === 'Easy' ? [1, -1] : [1, -1, 2, -2, 3]);
            const c = ri(rng, -5, 5);
            const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
            const cStr = c === 0 ? '' : (c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`);
            if (rng() < 0.4 && diff !== 'Easy') {
                const h = ri(rng, -3, 3);
                const hPart = h > 0 ? `(x - ${h})` : h < 0 ? `(x + ${Math.abs(h)})` : 'x';
                eq = `y = ${aStr}${hPart}^2${cStr}`;
            } else {
                eq = `y = ${aStr}x^2${cStr}`;
            }
            type = 'parabola';
        } else if (variant === 2) {
            // Exponential
            const base = rc(rng, [2, 3, 4, 5, 10]);
            const neg = rng() < 0.3;
            const coeff = diff === 'Hard' && rng() < 0.3 ? rc(rng, [-1, 2, -2]) : null;
            const expPart = neg ? `${base}^{-x}` : `${base}^x`;
            eq = coeff ? `y = ${coeff === -1 ? '-' : coeff}${expPart}` : `y = ${expPart}`;
            type = 'exponential';
        } else if (variant === 3) {
            // Hyperbola
            const k = rc(rng, diff === 'Easy' ? [1, 2, 4, 6] : [-8, -5, -3, -2, 2, 3, 5, 8, 10, 12]);
            eq = k > 0 ? `xy = ${k}` : `xy = ${k}`;
            type = 'hyperbola';
        } else if (variant === 4) {
            // Cubic (Medium+)
            const a = rc(rng, [1, -1, 2]);
            const aStr = a === 1 ? '' : a === -1 ? '-' : `${a}`;
            eq = `y = ${aStr}x^3`;
            type = 'cubic';
        } else {
            // Square root (Hard)
            eq = rc(rng, ['y = \\sqrt{x}', 'y = -\\sqrt{x}', 'y = \\sqrt{x + 1}']);
            type = 'square root';
        }
        const ph = rc(rng, [
            `Identify the type of graph represented by $${eq}$.`,
            `What type of curve does $${eq}$ represent?`,
            `Name the graph: $${eq}$.`,
            `Classify the relationship: $${eq}$.`,
        ]);
        const hints = { parabola: '$x^2$ term', exponential: '$a^x$ form', hyperbola: '$xy = k$ form', cubic: '$x^3$ term', 'square root': '$\\sqrt{x}$ form' };
        return { clue: ph, answer: type, answerDisplay: type, worked: `${hints[type]} indicates a ${type}` };
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
        if (diff === 'Easy') {
            const variant = ri(rng, 0, 2);
            if (variant === 0) {
                const fav = ri(rng, 1, 5), other = ri(rng, 2, 8);
                const total = fav + other;
                const colour = rc(rng, ['red', 'blue', 'green', 'yellow', 'purple']);
                const other_colour = rc(rng, ['blue', 'green', 'orange', 'white'].filter(c => c !== colour));
                const s = simplify(fav, total);
                const ph = rc(rng, [
                    `A bag contains $${fav}$ ${colour} and $${other}$ ${other_colour} marbles. Find the probability of picking a ${colour} marble.`,
                    `There are $${fav}$ ${colour} and $${other}$ ${other_colour} marbles in a bag. Find the probability of selecting a ${colour} marble.`,
                ]);
                return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                    worked: `$P = \\frac{${fav}}{${total}} = \\frac{${s.n}}{${s.d}}$` };
            }
            if (variant === 1) {
                const sides = rc(rng, [6, 8, 10]);
                const target = rc(rng, ['even', 'odd', 'greater than 3', 'less than 4']);
                let fav;
                if (target === 'even') fav = Math.floor(sides / 2);
                else if (target === 'odd') fav = Math.ceil(sides / 2);
                else if (target === 'greater than 3') fav = sides - 3;
                else fav = 3;
                const s = simplify(fav, sides);
                const ph = rc(rng, [
                    `A fair $${sides}$-sided die is rolled. Find P(${target}).`,
                    `A spinner has $${sides}$ equal sections numbered 1 to $${sides}$. Find P(${target}).`,
                ]);
                return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                    worked: `$P = \\frac{${fav}}{${sides}} = \\frac{${s.n}}{${s.d}}$` };
            }
            // Coin / simple spinner
            const sections = rc(rng, [4, 5, 6, 8]);
            const chosen = ri(rng, 1, sections - 1);
            const s = simplify(chosen, sections);
            const ph = rc(rng, [
                `A spinner has $${sections}$ equal sections, $${chosen}$ of which are shaded. Find the probability of landing on a shaded section.`,
                `A wheel is divided into $${sections}$ equal parts. $${chosen}$ are coloured red. What is the probability of spinning red?`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${chosen}}{${sections}} = \\frac{${s.n}}{${s.d}}$` };
        }
        if (diff === 'Medium') {
            const variant = ri(rng, 0, 2);
            if (variant <= 1) {
                const sides = rc(rng, [6, 8, 10, 12, 20]);
                const target = rc(rng, ['even', 'odd', 'greater than 4', 'a prime', 'less than 5', 'a multiple of 3', 'a multiple of 5', 'a perfect square']);
                let fav;
                const nums = Array.from({ length: sides }, (_, i) => i + 1);
                if (target === 'even') fav = nums.filter(n => n % 2 === 0).length;
                else if (target === 'odd') fav = nums.filter(n => n % 2 === 1).length;
                else if (target === 'greater than 4') fav = sides - 4;
                else if (target === 'a prime') fav = nums.filter(n => [2, 3, 5, 7, 11, 13, 17, 19].includes(n)).length;
                else if (target === 'less than 5') fav = 4;
                else if (target === 'a multiple of 3') fav = nums.filter(n => n % 3 === 0).length;
                else if (target === 'a multiple of 5') fav = nums.filter(n => n % 5 === 0).length;
                else fav = nums.filter(n => [1, 4, 9, 16].includes(n)).length;
                if (fav <= 0 || fav >= sides) return genProbability(rng, diff, allowedOps);
                const s = simplify(fav, sides);
                const ph = rc(rng, [
                    `A fair $${sides}$-sided die is rolled. Find P(${target}).`,
                    `Roll a fair $${sides}$-sided die numbered 1 to $${sides}$. What is P(${target})?`,
                    `A spinner has $${sides}$ equal sections numbered 1 to $${sides}$. Find P(${target}).`,
                ]);
                return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                    worked: `$P = \\frac{${fav}}{${sides}} = \\frac{${s.n}}{${s.d}}$` };
            }
            // 3-colour bag
            const c1 = ri(rng, 2, 7), c2 = ri(rng, 2, 7), c3 = ri(rng, 1, 6);
            const total = c1 + c2 + c3;
            const colours = ['red', 'blue', 'green', 'yellow', 'white', 'black'];
            const col = rc(rng, colours);
            const others = colours.filter(c => c !== col);
            const col2 = rc(rng, others);
            const col3 = rc(rng, others.filter(c => c !== col2));
            const target = rc(rng, [col, `not ${col2}`, `${col} or ${col3}`]);
            let fav;
            if (target === col) fav = c1;
            else if (target === `not ${col2}`) fav = total - c2;
            else fav = c1 + c3;
            const s = simplify(fav, total);
            const ph = rc(rng, [
                `A bag has $${c1}$ ${col}, $${c2}$ ${col2} and $${c3}$ ${col3} marbles. Find P(${target}).`,
                `There are $${c1}$ ${col}, $${c2}$ ${col2} and $${c3}$ ${col3} balls in a bag. What is P(${target})?`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${fav}}{${total}} = \\frac{${s.n}}{${s.d}}$` };
        }
        // Hard
        const form = ri(rng, 0, 3);
        if (form === 0) {
            const cond = rc(rng, ['a face card', 'a number card (2–10)', 'a card less than 5', 'an ace or king',
                'a red face card', 'a black number card', 'a heart', 'a card greater than 9']);
            let fav;
            if (cond === 'a face card') fav = 12;
            else if (cond === 'a number card (2–10)') fav = 36;
            else if (cond === 'a card less than 5') fav = 12;
            else if (cond === 'an ace or king') fav = 8;
            else if (cond === 'a red face card') fav = 6;
            else if (cond === 'a black number card') fav = 18;
            else if (cond === 'a heart') fav = 13;
            else fav = 16;
            const total = 52;
            const s = simplify(fav, total);
            const ph = rc(rng, [
                `A standard deck of 52 cards is shuffled. Find P(drawing ${cond}).`,
                `One card is drawn from a standard 52-card deck. What is P(${cond})?`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${fav}}{52} = \\frac{${s.n}}{${s.d}}$` };
        }
        if (form === 1) {
            const c1 = ri(rng, 2, 8), c2 = ri(rng, 2, 8), c3 = ri(rng, 2, 6), c4 = ri(rng, 1, 5);
            const total = c1 + c2 + c3 + c4;
            const colours = ['red', 'blue', 'green', 'yellow', 'white', 'black'];
            const col = rc(rng, colours), col2 = rc(rng, colours.filter(c => c !== col));
            const col3 = rc(rng, colours.filter(c => c !== col && c !== col2));
            const col4 = rc(rng, colours.filter(c => c !== col && c !== col2 && c !== col3));
            const target = rc(rng, [`not ${col}`, `${col2} or ${col3}`]);
            let fav;
            if (target === `not ${col}`) fav = total - c1;
            else fav = c2 + c3;
            const s = simplify(fav, total);
            const ph = `A bag has $${c1}$ ${col}, $${c2}$ ${col2}, $${c3}$ ${col3} and $${c4}$ ${col4} marbles. Find P(${target}).`;
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${fav}}{${total}} = \\frac{${s.n}}{${s.d}}$` };
        }
        if (form === 2) {
            const sides = rc(rng, [8, 10, 12, 20]);
            const cond = rc(rng, ['even and greater than 6', 'odd and less than 8', 'a prime greater than 5',
                'a multiple of 4', 'odd or greater than 10', 'even and a multiple of 3']);
            let fav;
            const nums = Array.from({ length: sides }, (_, i) => i + 1);
            if (cond === 'even and greater than 6') fav = nums.filter(n => n % 2 === 0 && n > 6).length;
            else if (cond === 'odd and less than 8') fav = nums.filter(n => n % 2 === 1 && n < 8).length;
            else if (cond === 'a prime greater than 5') fav = nums.filter(n => [7, 11, 13, 17, 19].includes(n)).length;
            else if (cond === 'a multiple of 4') fav = nums.filter(n => n % 4 === 0).length;
            else if (cond === 'odd or greater than 10') fav = nums.filter(n => n % 2 === 1 || n > 10).length;
            else fav = nums.filter(n => n % 2 === 0 && n % 3 === 0).length;
            if (fav <= 0 || fav >= sides) return genProbability(rng, diff, allowedOps);
            const s = simplify(fav, sides);
            const ph = rc(rng, [
                `A fair $${sides}$-sided die is rolled. Find P(${cond}).`,
                `A spinner has $${sides}$ equal sections numbered 1 to $${sides}$. Find P(${cond}).`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${fav}}{${sides}} = \\frac{${s.n}}{${s.d}}$` };
        }
        // form 3: frequency table
        const outcomes = ri(rng, 3, 5);
        const freqs = Array.from({ length: outcomes }, () => ri(rng, 3, 15));
        const total = freqs.reduce((a, b) => a + b, 0);
        const idx = ri(rng, 0, outcomes - 1);
        const labels = ['A', 'B', 'C', 'D', 'E'].slice(0, outcomes);
        const freqStr = labels.map((l, i) => `${l}: $${freqs[i]}$`).join(', ');
        const s = simplify(freqs[idx], total);
        const ph = `In an experiment, the outcomes and frequencies are: ${freqStr}. Find P(${labels[idx]}).`;
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
            worked: `$P = \\frac{${freqs[idx]}}{${total}} = \\frac{${s.n}}{${s.d}}$` };
    }

    if (op === 'complementary') {
        if (diff === 'Easy') {
            const denoms = [3, 4, 5, 6, 8, 10];
            const d = rc(rng, denoms);
            const n = ri(rng, 1, d - 1);
            const s = simplify(n, d);
            const compS = simplify(d - n, d);
            const events = ['winning', 'rain', 'rolling a 6', 'picking red'];
            const event = rc(rng, events);
            const ph = rc(rng, [
                `The probability of ${event} is $\\frac{${s.n}}{${s.d}}$. Find the probability of NOT ${event}.`,
                `If the probability of ${event} is $\\frac{${s.n}}{${s.d}}$, what is the probability that it does not happen?`,
            ]);
            return { clue: ph, answer: fracStr(compS.n, compS.d), answerDisplay: `$\\frac{${compS.n}}{${compS.d}}$`,
                worked: `$P(\\text{not}) = 1 - \\frac{${s.n}}{${s.d}} = \\frac{${compS.n}}{${compS.d}}$` };
        }
        if (diff === 'Medium') {
            const variant = ri(rng, 0, 2);
            if (variant === 0) {
                // Percentage form
                const pct = ri(rng, 5, 19) * 5;
                const compPct = 100 - pct;
                const event = rc(rng, ['rain tomorrow', 'passing the test', 'a bus arriving on time', 'winning the game', 'a defective item']);
                const ph = rc(rng, [
                    `The probability of ${event} is $${pct}$%. What is the probability it does *not* happen?`,
                    `P(${event}) $= ${pct}$%. Find P(not ${event}).`,
                ]);
                return { clue: ph, answer: `${compPct}%`, answerDisplay: `$${compPct}$%`,
                    worked: `$P(\\text{not}) = 100\\% - ${pct}\\% = ${compPct}\\%$` };
            }
            if (variant === 1) {
                // Decimal form
                const dec = ri(rng, 1, 9) / 10;
                const compDec = round(1 - dec, 1);
                const event = rc(rng, ['rain', 'winning', 'selecting a blue marble', 'a defective item']);
                const ph = rc(rng, [
                    `P(${event}) $= ${dec}$. Find P(not ${event}).`,
                    `The probability of ${event} is $${dec}$. What is the probability it does *not* occur?`,
                ]);
                return { clue: ph, answer: String(compDec), answerDisplay: `$${compDec}$`,
                    worked: `$P(\\text{not}) = 1 - ${dec} = ${compDec}$` };
            }
            // Fraction form with word problem
            const d = rc(rng, [5, 6, 8, 10, 12]);
            const n = ri(rng, 1, d - 1);
            const s = simplify(n, d);
            const compS = simplify(d - n, d);
            const ph = rc(rng, [
                `A bag has $${d}$ marbles and $${n}$ are red. A marble is drawn at random. Find the probability it is *not* red.`,
                `$${n}$ out of $${d}$ students passed. Find the probability a randomly selected student did *not* pass.`,
            ]);
            return { clue: ph, answer: fracStr(compS.n, compS.d), answerDisplay: `$\\frac{${compS.n}}{${compS.d}}$`,
                worked: `$P(\\text{not}) = 1 - \\frac{${s.n}}{${s.d}} = \\frac{${compS.n}}{${compS.d}}$` };
        }
        // Hard: "at least one" using complementary method, or two-step
        if (rng() < 0.4) {
            // "At least one" in repeated trials
            const n = rc(rng, [2, 3]);
            const d = rc(rng, [4, 5, 6]);
            const pFail = ri(rng, 1, d - 1);
            const sFail = simplify(pFail, d);
            const pNone = Math.pow(pFail / d, n);
            const pAtLeast = round(1 - pNone, 4);
            const failFrac = `\\frac{${sFail.n}}{${sFail.d}}`;
            const ph = rc(rng, [
                `A coin has P(heads) $= \\frac{${d - pFail}}{${d}}$. It is tossed $${n}$ times. Find P(*at least one* head). Round to 4 d.p.`,
                `The probability of success is $\\frac{${d - pFail}}{${d}}$ per trial. In $${n}$ trials, find P(at least one success). Round to 4 d.p.`,
            ]);
            return { clue: ph, answer: String(pAtLeast), answerDisplay: `$${pAtLeast}$`,
                worked: `$P(\\text{at least 1}) = 1 - (${failFrac})^{${n}} = 1 - ${round(pNone, 4)} = ${pAtLeast}$` };
        }
        const d = rc(rng, [10, 12, 15, 20, 25, 50, 100]);
        const n = ri(rng, 1, d - 1);
        const s = simplify(n, d);
        const compS = simplify(d - n, d);
        const events = ['winning', 'rain tomorrow', 'passing the test', 'a bus arriving on time', 'a defective item', 'selecting a green ball', 'an event occurring'];
        const event = rc(rng, events);
        const ph = rc(rng, [
            `P(${event}) $= \\frac{${s.n}}{${s.d}}$. Find P(not ${event}).`,
            `The probability of ${event} is $\\frac{${s.n}}{${s.d}}$. Find the *complementary* probability.`,
            `If $\\frac{${s.n}}{${s.d}}$ of items are defective, what fraction are *not* defective?`,
        ]);
        return { clue: ph, answer: fracStr(compS.n, compS.d), answerDisplay: `$\\frac{${compS.n}}{${compS.d}}$`,
            worked: `$P(\\text{not}) = 1 - \\frac{${s.n}}{${s.d}} = \\frac{${compS.n}}{${compS.d}}$` };
    }

    // op === 'multi-event'
    if (diff === 'Easy') {
        const variant = ri(rng, 0, 1);
        if (variant === 0) {
            const d = rc(rng, [6, 8, 10, 12]);
            const a = ri(rng, 1, 4), b = ri(rng, 1, d - a - 1);
            if (b <= 0) return genProbability(rng, diff, allowedOps);
            const s = simplify(a + b, d);
            const col1 = rc(rng, ['red', 'blue', 'green']), col2 = rc(rng, ['yellow', 'white', 'purple'].filter(c => c !== col1));
            const col3 = rc(rng, ['black', 'orange', 'pink']);
            const ph = rc(rng, [
                `A bag has $${a}$ ${col1}, $${b}$ ${col2} and $${d - a - b}$ ${col3} marbles. Find P(${col1} *or* ${col2}).`,
                `A bag has $${a}$ ${col1}, $${b}$ ${col2} and $${d - a - b}$ ${col3} marbles. One marble is drawn. What is P(${col1} or ${col2})?`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${a} + ${b}}{${d}} = \\frac{${a + b}}{${d}} = \\frac{${s.n}}{${s.d}}$` };
        }
        // Two coin flips
        const ph = rc(rng, [
            `A fair coin is tossed twice. Find the probability of getting *two heads*.`,
            `Two fair coins are tossed. What is the probability of getting a head on *both*?`,
        ]);
        return { clue: ph, answer: fracStr(1, 4), answerDisplay: `$\\frac{1}{4}$`,
            worked: `$P = \\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$` };
    }
    if (diff === 'Medium') {
        const variant = ri(rng, 0, 1);
        if (variant === 0) {
            const d1 = rc(rng, [4, 5, 6, 8]), d2 = rc(rng, [4, 5, 6, 8]);
            const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
            const numProd = n1 * n2, denProd = d1 * d2;
            const s = simplify(numProd, denProd);
            const col1 = rc(rng, ['red', 'blue', 'green']), col2 = rc(rng, ['yellow', 'white', 'purple']);
            const ph = rc(rng, [
                `A bag has $${n1}$ ${col1} out of $${d1}$ marbles and another bag has $${n2}$ ${col2} out of $${d2}$ marbles. Find P(${col1} *and* ${col2}).`,
                `P(${col1}) $= \\frac{${n1}}{${d1}}$ and P(${col2}) $= \\frac{${n2}}{${d2}}$. These are *independent*. Find P(${col1} and ${col2}).`,
            ]);
            return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
                worked: `$P = \\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}} = \\frac{${numProd}}{${denProd}} = \\frac{${s.n}}{${s.d}}$` };
        }
        // Die + coin
        const sides = rc(rng, [6, 8]);
        const target = ri(rng, 1, sides);
        const s = simplify(1, sides * 2);
        const ph = rc(rng, [
            `A fair $${sides}$-sided die is rolled and a coin is tossed. Find P(rolling a $${target}$ *and* getting heads).`,
            `A fair coin and a $${sides}$-sided die are used. What is P(heads and a $${target}$)?`,
        ]);
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
            worked: `$P = \\frac{1}{${sides}} \\times \\frac{1}{2} = \\frac{1}{${sides * 2}} = \\frac{${s.n}}{${s.d}}$` };
    }
    // Hard
    const form = ri(rng, 0, 2);
    if (form === 0) {
        const d1 = rc(rng, [6, 8, 10, 12]), d2 = rc(rng, [6, 8, 10, 12]);
        const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
        const numProd = n1 * n2, denProd = d1 * d2;
        const s = simplify(numProd, denProd);
        const col1 = rc(rng, ['red', 'blue', 'white']), col2 = rc(rng, ['green', 'yellow', 'black']);
        const ph = rc(rng, [
            `P(${col1}) $= \\frac{${n1}}{${d1}}$ and P(${col2}) $= \\frac{${n2}}{${d2}}$. The events are *independent*. Find P(${col1} and ${col2}).`,
            `A spinner shows ${col1} with probability $\\frac{${n1}}{${d1}}$ and a die shows ${col2} with probability $\\frac{${n2}}{${d2}}$. Find P(both occur).`,
        ]);
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
            worked: `$P = \\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}} = \\frac{${numProd}}{${denProd}} = \\frac{${s.n}}{${s.d}}$` };
    }
    if (form === 1) {
        // Without replacement
        const total = rc(rng, [8, 10, 12, 15]);
        const fav = ri(rng, 3, total - 2);
        const n1 = fav, d1 = total, n2 = fav - 1, d2 = total - 1;
        const numProd = n1 * n2, denProd = d1 * d2;
        const s = simplify(numProd, denProd);
        const colour = rc(rng, ['red', 'blue', 'green', 'yellow']);
        const ph = rc(rng, [
            `A bag has $${fav}$ ${colour} marbles out of $${total}$. Two are drawn *without replacement*. Find P(both ${colour}).`,
            `$${fav}$ of $${total}$ marbles are ${colour}. If two are drawn without replacement, find P(both ${colour}).`,
        ]);
        return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
            worked: `$P = \\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}} = \\frac{${numProd}}{${denProd}} = \\frac{${s.n}}{${s.d}}$` };
    }
    // Three independent events
    const d1 = rc(rng, [4, 5, 6]), d2 = rc(rng, [4, 5, 6]), d3 = rc(rng, [2, 3, 4]);
    const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1), n3 = ri(rng, 1, d3 - 1);
    const numProd = n1 * n2 * n3, denProd = d1 * d2 * d3;
    const s = simplify(numProd, denProd);
    const ph = rc(rng, [
        `Three *independent* events have probabilities $\\frac{${n1}}{${d1}}$, $\\frac{${n2}}{${d2}}$ and $\\frac{${n3}}{${d3}}$. Find P(all three occur).`,
        `P(A) $= \\frac{${n1}}{${d1}}$, P(B) $= \\frac{${n2}}{${d2}}$ and P(C) $= \\frac{${n3}}{${d3}}$. Events are *independent*. Find P(A and B and C).`,
    ]);
    return { clue: ph, answer: fracStr(s.n, s.d), answerDisplay: `$\\frac{${s.n}}{${s.d}}$`,
        worked: `$P = \\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}} \\times \\frac{${n3}}{${d3}} = \\frac{${numProd}}{${denProd}} = \\frac{${s.n}}{${s.d}}$` };
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
        if (diff === 'Hard') {
            // Three-term ratio or large two-term
            if (rng() < 0.4) {
                const factor = ri(rng, 4, 15);
                const a = ri(rng, 2, 9) * factor, b = ri(rng, 2, 9) * factor, c = ri(rng, 2, 9) * factor;
                const g = gcd(gcd(a, b), c);
                const ph = rc(rng, [`Simplify the ratio $${a} : ${b} : ${c}$.`, `Write $${a} : ${b} : ${c}$ in its **simplest form**.`]);
                return { clue: ph, answer: `${a / g} : ${b / g} : ${c / g}`, answerDisplay: `$${a / g} : ${b / g} : ${c / g}$`,
                    worked: `$\\text{GCD} = ${g}, \\; ${a / g} : ${b / g} : ${c / g}$` };
            }
            const factor = ri(rng, 5, 18);
            const a = ri(rng, 3, 15) * factor, b = ri(rng, 3, 15) * factor;
            const s = simplify(a, b);
            const ph = rc(rng, [`Simplify $${a} : ${b}$.`, `Reduce $${a} : ${b}$ to its **lowest terms**.`]);
            return { clue: ph, answer: `${s.n} : ${s.d}`, answerDisplay: `$${s.n} : ${s.d}$`,
                worked: `$\\div ${gcd(a, b)} \\Rightarrow ${s.n} : ${s.d}$` };
        }
        const factor = ri(rng, 2, diff === 'Easy' ? 6 : 10);
        const aMax = diff === 'Easy' ? 8 : 12;
        const a = ri(rng, 1, aMax) * factor, b = ri(rng, 1, aMax) * factor;
        const s = simplify(a, b);
        const ph = rc(rng, [
            `Simplify the ratio $${a} : ${b}$.`,
            `Write $${a} : ${b}$ in its **simplest form**.`,
            `Reduce $${a} : ${b}$ to its **lowest terms**.`,
        ]);
        return { clue: ph, answer: `${s.n} : ${s.d}`, answerDisplay: `$${s.n} : ${s.d}$`,
            worked: `$\\div ${gcd(a, b)} \\Rightarrow ${s.n} : ${s.d}$` };
    }

    if (op === 'divide-ratio') {
        const total = diff === 'Easy' ? rc(rng, [24, 30, 36, 40, 48, 60])
            : diff === 'Medium' ? rc(rng, [60, 80, 90, 120, 150, 180, 240])
            : rc(rng, [200, 250, 300, 400, 500, 600, 800, 1000]);
        const unit = diff === 'Easy' ? rc(rng, ['lollies', 'marbles', 'cards', 'stickers'])
            : diff === 'Medium' ? rc(rng, ['points', 'tiles', 'cm', 'mL', 'pages'])
            : rc(rng, ['dollars', 'grams', 'litres', 'kilograms', 'metres']);
        // Three-part ratio split — Medium 40%, Hard 60%
        if (diff !== 'Easy' && rng() < (diff === 'Hard' ? 0.6 : 0.4)) {
            const maxPart = diff === 'Hard' ? 8 : 5;
            const a = ri(rng, 1, maxPart), b = ri(rng, 1, maxPart), c = ri(rng, 1, maxPart);
            const denom = a + b + c;
            if (total % denom !== 0) return genRatiosRates(rng, diff, allowedOps);
            const share = total / denom;
            const A = share * a, B = share * b, C = share * c;
            if (diff === 'Hard' && rng() < 0.4) {
                // Ask for just ONE share instead of all three
                const which = rc(rng, ['first', 'second', 'third']);
                const ansVal = which === 'first' ? A : which === 'second' ? B : C;
                const ph = `$${total}$ ${unit} are shared in the ratio $${a} : ${b} : ${c}$. Find the *${which}* share.`;
                return { clue: ph, answer: String(ansVal), answerDisplay: `$${ansVal}$ ${unit}`,
                    worked: `$\\text{Total parts} = ${denom}, \\; \\text{each part} = ${share}, \\; \\text{${which}} = ${ansVal}$` };
            }
            const ph = rc(rng, [
                `Share $${total}$ ${unit} in the ratio $${a} : ${b} : ${c}$.`,
                `Divide $${total}$ ${unit} in the ratio $${a} : ${b} : ${c}$.`,
            ]);
            return { clue: ph, answer: `${A} : ${B} : ${C}`, answerDisplay: `$${A} : ${B} : ${C}$`,
                worked: `$\\text{Total parts} = ${denom}, \\; \\text{each part} = ${share}$` };
        }
        const partsA = ri(rng, 1, diff === 'Hard' ? 9 : diff === 'Medium' ? 6 : 4);
        const partsB = ri(rng, 1, diff === 'Hard' ? 9 : diff === 'Medium' ? 6 : 4);
        const denomParts = partsA + partsB;
        if (total % denomParts !== 0) return genRatiosRates(rng, diff, allowedOps);
        const shareA = (total / denomParts) * partsA;
        const shareB = total - shareA;
        const ph = rc(rng, [
            `Divide $${total}$ ${unit} in the ratio $${partsA} : ${partsB}$.`,
            `Share $${total}$ ${unit} in the ratio $${partsA} : ${partsB}$.`,
            `Split $${total}$ ${unit} between two people in the ratio $${partsA} : ${partsB}$.`,
        ]);
        return { clue: ph, answer: `${shareA} : ${shareB}`, answerDisplay: `$${shareA} : ${shareB}$`,
            worked: `$\\text{Total parts} = ${denomParts}, \\; ${shareA} : ${shareB}$` };
    }

    if (op === 'equivalent') {
        if (diff === 'Hard') {
            // Missing value on the LEFT or fractional ratio
            if (rng() < 0.4) {
                const a = ri(rng, 2, 8), b = ri(rng, 2, 8);
                const mult = ri(rng, 3, 12);
                const ph = rc(rng, [
                    `If $${a * mult} : ${b * mult} = ${a} : \\square$, find the missing value.`,
                    `$${a * mult} : \\square = ${a} : ${b}$. Find the missing value.`,
                ]);
                return { clue: ph, answer: String(b * mult), answerDisplay: `$${b * mult}$`,
                    worked: `$\\text{Scale factor} = ${mult}, \\; \\square = ${b} \\times ${mult} = ${b * mult}$` };
            }
            const a = ri(rng, 3, 12), b = ri(rng, 3, 12);
            const mult = ri(rng, 4, 15);
            const ph = rc(rng, [
                `Complete: $${a} : ${b} = \\square : ${b * mult}$.`,
                `Find $x$: $${a} : ${b} = x : ${b * mult}$.`,
            ]);
            return { clue: ph, answer: String(a * mult), answerDisplay: `$${a * mult}$`,
                worked: `$\\text{Scale} = ${b * mult} \\div ${b} = ${mult}, \\; x = ${a} \\times ${mult} = ${a * mult}$` };
        }
        const a = ri(rng, 1, diff === 'Easy' ? 5 : 8);
        const b = ri(rng, 1, diff === 'Easy' ? 5 : 8);
        const mult = ri(rng, 2, diff === 'Easy' ? 5 : 9);
        const ph = rc(rng, [
            `Complete the equivalent ratio: $${a} : ${b} = \\square : ${b * mult}$.`,
            `If $${a} : ${b}$ is equivalent to $\\square : ${b * mult}$, find the missing number.`,
        ]);
        return { clue: ph, answer: String(a * mult), answerDisplay: `$${a * mult}$`,
            worked: `$\\text{Scale} = ${b * mult} \\div ${b} = ${mult}, \\; \\square = ${a} \\times ${mult} = ${a * mult}$` };
    }

    if (op === 'unit-rate') {
        if (diff === 'Hard') {
            // 30%: best buy with three packs or larger numbers
            if (rng() < 0.3) {
                const item = rc(rng, ['cereal (g)', 'shampoo (mL)', 'rice (kg)', 'detergent (mL)', 'juice (mL)']);
                const q1 = rc(rng, [300, 500, 750, 1000, 1500]);
                const q2 = rc(rng, [200, 400, 600, 800, 1200, 2000]);
                const p1 = ri(rng, 3, 18), p2 = ri(rng, 4, 25);
                const r1 = p1 / q1, r2 = p2 / q2;
                if (r1 === r2) return genRatiosRates(rng, diff, allowedOps);
                const cheaper = r1 < r2 ? 'Pack A' : 'Pack B';
                const ph = `Pack A: $${q1}$ ${item} for $\\$${money(p1)}$. Pack B: $${q2}$ ${item} for $\\$${money(p2)}$. Which is the *better buy*?`;
                return { clue: ph, answer: cheaper, answerDisplay: cheaper,
                    worked: `$A: \\$${money(round(r1 * 1000, 2))}/\\text{kg}, B: \\$${money(round(r2 * 1000, 2))}/\\text{kg} \\Rightarrow ${cheaper}$` };
            }
            // 25%: scale drawing
            if (rng() < 0.25) {
                const scaleReal = rc(rng, [25, 50, 100, 200, 500]);
                const drawCm = ri(rng, 3, 15);
                const real = drawCm * scaleReal;
                const unit = scaleReal >= 100 ? 'km' : 'm';
                const realDisplay = scaleReal >= 100 ? real / 1000 : real;
                const ph = rc(rng, [
                    `A map uses the scale $1$ cm $= ${scaleReal}$ m. A road measures $${drawCm}$ cm on the map. What is the *actual* length in ${unit}?`,
                    `On a scale drawing $1$ cm represents $${scaleReal}$ m. A river is drawn as $${drawCm}$ cm. Find the *actual* length in ${unit}.`,
                ]);
                return { clue: ph, answer: String(scaleReal >= 100 ? realDisplay : real), answerDisplay: `${scaleReal >= 100 ? realDisplay : real} ${unit}`,
                    worked: `$${drawCm} \\times ${scaleReal} = ${real}$ m` };
            }
            // Complex unit rate
            const HARD_CONTEXTS = [
                { item: 'litres of petrol', price: ri(rng, 180, 250), qty: rc(rng, [15, 25, 30, 40, 50]) },
                { item: 'kilograms of flour', price: ri(rng, 8, 30), qty: rc(rng, [2, 4, 5, 8, 10, 12]) },
                { item: 'metres of fabric', price: ri(rng, 15, 60), qty: rc(rng, [3, 5, 6, 8, 10, 12]) },
            ];
            const ctx = rc(rng, HARD_CONTEXTS);
            const unitPrice = round(ctx.price / ctx.qty, 2);
            const ph = rc(rng, [
                `$${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$. Find the *unit rate*.`,
                `If $${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$, find the cost per unit.`,
            ]);
            return { clue: ph, answer: String(unitPrice), answerDisplay: `$\\$${money(unitPrice)}$`,
                worked: `$\\$${ctx.price} \\div ${ctx.qty} = \\$${money(unitPrice)}$` };
        }
        if (diff === 'Medium') {
            // 25%: scale drawing
            if (rng() < 0.25) {
                const scaleReal = rc(rng, [10, 20, 25, 50, 100]);
                const drawCm = ri(rng, 3, 10);
                const real = drawCm * scaleReal;
                const ph = `A map uses the scale $1$ cm $= ${scaleReal}$ m. A path measures $${drawCm}$ cm. What is the *actual* length?`;
                return { clue: ph, answer: String(real), answerDisplay: `${real} m`,
                    worked: `$${drawCm} \\times ${scaleReal} = ${real}$ m` };
            }
            // 30%: best buy
            if (rng() < 0.3) {
                const item = rc(rng, ['cereal (g)', 'shampoo (mL)', 'rice (g)', 'detergent (mL)']);
                const q1 = rc(rng, [250, 500, 750, 1000]);
                const q2 = rc(rng, [200, 400, 600, 800]);
                const p1 = ri(rng, 2, 10), p2 = ri(rng, p1 + 1, p1 + 12);
                const r1 = p1 / q1, r2 = p2 / q2;
                if (r1 === r2) return genRatiosRates(rng, diff, allowedOps);
                const cheaper = r1 < r2 ? 'Pack A' : 'Pack B';
                const ph = `Pack A: $${q1}$ ${item} for $\\$${money(p1)}$. Pack B: $${q2}$ ${item} for $\\$${money(p2)}$. Which is the *better buy*?`;
                return { clue: ph, answer: cheaper, answerDisplay: cheaper };
            }
            const MED_CONTEXTS = [
                { item: 'apples', price: ri(rng, 4, 12), qty: ri(rng, 3, 8) * rc(rng, [2, 3]) },
                { item: 'litres of petrol', price: ri(rng, 100, 200), qty: rc(rng, [10, 20, 25, 40]) },
                { item: 'bottles of water', price: ri(rng, 6, 24), qty: rc(rng, [6, 8, 12, 24]) },
                { item: 'pencils', price: ri(rng, 3, 15), qty: rc(rng, [5, 10, 12, 20]) },
            ];
            const ctx = rc(rng, MED_CONTEXTS);
            const unitPrice = round(ctx.price / ctx.qty, 2);
            const ph = rc(rng, [
                `$${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$. Find the cost per item.`,
                `If $${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$, what is the *unit rate*?`,
            ]);
            return { clue: ph, answer: String(unitPrice), answerDisplay: `$\\$${money(unitPrice)}$`,
                worked: `$\\$${ctx.price} \\div ${ctx.qty} = \\$${money(unitPrice)}$` };
        }
        // Easy
        const EASY_CONTEXTS = [
            { item: 'apples', price: ri(rng, 2, 6), qty: rc(rng, [2, 4, 5, 6]) },
            { item: 'oranges', price: ri(rng, 3, 8), qty: rc(rng, [2, 3, 4, 5]) },
            { item: 'pencils', price: ri(rng, 2, 8), qty: rc(rng, [4, 5, 8, 10]) },
        ];
        const ctx = rc(rng, EASY_CONTEXTS);
        const unitPrice = round(ctx.price / ctx.qty, 2);
        const ph = rc(rng, [
            `$${ctx.qty}$ ${ctx.item} cost $\\$${ctx.price}$. Find the cost per item.`,
            `If $${ctx.qty}$ ${ctx.item} costs $\\$${ctx.price}$, what is the *unit rate*?`,
        ]);
        return { clue: ph, answer: String(unitPrice), answerDisplay: `$\\$${money(unitPrice)}$`,
            worked: `$\\$${ctx.price} \\div ${ctx.qty} = \\$${money(unitPrice)}$` };
    }

    // op === 'speed'
    const SPEED_CONTEXTS = [
        { vehicle: 'car', unit: 'km/h' },
        { vehicle: 'train', unit: 'km/h' },
        { vehicle: 'cyclist', unit: 'km/h' },
        { vehicle: 'bus', unit: 'km/h' },
        { vehicle: 'truck', unit: 'km/h' },
        { vehicle: 'runner', unit: 'km/h' },
    ];
    const ctx = rc(rng, SPEED_CONTEXTS);
    if (diff === 'Hard') {
        // 35%: combined-speed multi-step
        if (rng() < 0.35) {
            const s1 = ri(rng, 4, 12) * 10, s2 = ri(rng, 4, 12) * 10, t = ri(rng, 2, 6);
            const opposite = rng() < 0.5;
            if (!opposite && s1 === s2) return genRatiosRates(rng, diff, allowedOps);
            const apart = opposite ? (s1 + s2) * t : Math.abs(s1 - s2) * t;
            const dirText = opposite ? 'in opposite directions' : 'in the same direction';
            const ph = rc(rng, [
                `Two trains leave the same station ${dirText} at $${s1}$ km/h and $${s2}$ km/h. How far apart are they after $${t}$ hours?`,
                `Two cars start together and travel ${dirText} at $${s1}$ km/h and $${s2}$ km/h. Find the distance between them after $${t}$ hours.`,
            ]);
            return { clue: ph, answer: String(apart), answerDisplay: `${apart} km`,
                worked: `$\\text{Relative speed} = ${opposite ? s1 + s2 : Math.abs(s1 - s2)}, \\; d = ${opposite ? s1 + s2 : Math.abs(s1 - s2)} \\times ${t} = ${apart}$ km` };
        }
        // 25%: km/h ↔ m/s
        if (rng() < 0.25) {
            const kmh = rc(rng, [18, 36, 54, 72, 90, 108, 126, 144]);
            const ms = kmh / 3.6;
            const ph = rc(rng, [
                `Convert $${kmh}$ km/h to *m/s*. ($1$ km/h $= \\frac{1}{3.6}$ m/s.)`,
                `A ${ctx.vehicle} travels at $${kmh}$ km/h. Express this speed in *m/s*.`,
            ]);
            return { clue: ph, answer: String(ms), answerDisplay: `${ms} m/s`,
                worked: `$${kmh} \\div 3.6 = ${ms}$ m/s` };
        }
        const findWhat = rc(rng, ['speed', 'distance', 'time']);
        if (findWhat === 'speed') {
            const t = rc(rng, [2, 3, 4, 5, 6, 8]);
            const s = ri(rng, 5, 15) * 10;
            const d = s * t;
            const ph = `A ${ctx.vehicle} travels $${d}$ km in $${t}$ hours. Find its speed.`;
            return { clue: ph, answer: String(s), answerDisplay: `${s} ${ctx.unit}`,
                worked: `$s = ${d} \\div ${t} = ${s}$ km/h` };
        }
        if (findWhat === 'distance') {
            const speed = ri(rng, 5, 14) * 10, time = rc(rng, [2, 3, 4, 5, 2.5, 3.5]);
            const dist = speed * time;
            const ph = `A ${ctx.vehicle} travels at $${speed}$ ${ctx.unit} for $${time}$ hours. Find the distance.`;
            return { clue: ph, answer: String(dist), answerDisplay: `${dist} km`,
                worked: `$d = ${speed} \\times ${time} = ${dist}$ km` };
        }
        const speed2 = ri(rng, 5, 14) * 10, dist2 = speed2 * ri(rng, 2, 6);
        const time2 = dist2 / speed2;
        const ph = `A ${ctx.vehicle} travels $${dist2}$ km at $${speed2}$ ${ctx.unit}. How long does the journey take?`;
        return { clue: ph, answer: String(time2), answerDisplay: `${time2} h`,
            worked: `$t = ${dist2} \\div ${speed2} = ${time2}$ h` };
    }
    // Medium: km/h ↔ m/s conversion 20%
    if (diff === 'Medium' && rng() < 0.2) {
        const kmh = rc(rng, [18, 36, 54, 72, 90, 108]);
        const ms = kmh / 3.6;
        const ph = rc(rng, [
            `Convert $${kmh}$ km/h to *m/s*. ($1$ km/h $= \\frac{1}{3.6}$ m/s.)`,
            `A ${ctx.vehicle} travels at $${kmh}$ km/h. Express this speed in *m/s*.`,
        ]);
        return { clue: ph, answer: String(ms), answerDisplay: `${ms} m/s`,
            worked: `$${kmh} \\div 3.6 = ${ms}$ m/s` };
    }
    const findWhat = rc(rng, diff === 'Easy' ? ['speed', 'distance'] : ['speed', 'distance', 'time']);
    if (findWhat === 'speed') {
        const maxDist = diff === 'Easy' ? 10 : 15;
        const d = ri(rng, 2, maxDist) * 10, t = ri(rng, 1, diff === 'Easy' ? 3 : 5);
        if (d % t !== 0) return genRatiosRates(rng, diff, allowedOps);
        const s = d / t;
        const ph = rc(rng, [
            `A ${ctx.vehicle} travels $${d}$ km in $${t}$ hour${t > 1 ? 's' : ''}. Find its speed.`,
            `Find the speed of a ${ctx.vehicle} that covers $${d}$ km in $${t}$ h.`,
        ]);
        return { clue: ph, answer: String(s), answerDisplay: `${s} ${ctx.unit}`,
            worked: `$s = ${d} \\div ${t} = ${s}$ km/h` };
    }
    if (findWhat === 'distance') {
        const speed = ri(rng, 3, diff === 'Easy' ? 8 : 12) * 10, time = ri(rng, 1, diff === 'Easy' ? 3 : 4);
        const dist = speed * time;
        const ph = rc(rng, [
            `A ${ctx.vehicle} travels at $${speed}$ ${ctx.unit} for $${time}$ hour${time > 1 ? 's' : ''}. Find the distance.`,
            `How far does a ${ctx.vehicle} travel at $${speed}$ ${ctx.unit} in $${time}$ h?`,
        ]);
        return { clue: ph, answer: String(dist), answerDisplay: `${dist} km`,
            worked: `$d = ${speed} \\times ${time} = ${dist}$ km` };
    }
    // findWhat === 'time'
    const speed2 = ri(rng, 4, 12) * 10, dist2 = speed2 * ri(rng, 1, 5);
    const time2 = dist2 / speed2;
    const ph = rc(rng, [
        `A ${ctx.vehicle} travels $${dist2}$ km at $${speed2}$ ${ctx.unit}. How long does the journey take?`,
        `Find the *time* taken for a ${ctx.vehicle} to travel $${dist2}$ km at $${speed2}$ ${ctx.unit}.`,
    ]);
    return { clue: ph, answer: String(time2), answerDisplay: `${time2} h`,
        worked: `$t = ${dist2} \\div ${speed2} = ${time2}$ h` };
}

// ============================================================
// INDICES (Stage 4 introduces; Stage 5 adds zero + negative)
// ============================================================
function genIndices(rng, diff, allowedOps) {
    const OPS = ['indices-evaluate', 'indices-multiply', 'indices-divide', 'indices-power',
                 'indices-zero', 'indices-negative'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);
    const verb = rc(rng, CALC_VERBS);

    if (op === 'indices-evaluate') {
        if (diff === 'Easy') {
            const base = ri(rng, 2, 5), exp = ri(rng, 2, 4);
            const ans = Math.pow(base, exp);
            const expanded = Array(exp).fill(base).join(' \\times ');
            return {
                clue: `${verb}\n$${base}^{${exp}}$`,
                answer: String(ans),
                answerDisplay: `$${ans}$`,
                worked: `$${base}^{${exp}} = ${expanded} = ${ans}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 2);
            if (type === 0) {
                const base = ri(rng, 3, 12), exp = ri(rng, 2, 3);
                const ans = Math.pow(base, exp);
                return {
                    clue: `${verb}\n$${base}^{${exp}}$`,
                    answer: String(ans),
                    answerDisplay: `$${ans}$`,
                    worked: `$${base}^{${exp}} = ${ans}$`,
                };
            }
            if (type === 1) {
                const n = ri(rng, 5, 15);
                return {
                    clue: `What is the *square* of $${n}$?`,
                    answer: String(n * n),
                    answerDisplay: `$${n * n}$`,
                    worked: `$${n}^2 = ${n} \\times ${n} = ${n * n}$`,
                };
            }
            const n = ri(rng, 3, 8);
            return {
                clue: `What is the *cube* of $${n}$?`,
                answer: String(n * n * n),
                answerDisplay: `$${n * n * n}$`,
                worked: `$${n}^3 = ${n} \\times ${n} \\times ${n} = ${n * n * n}$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const b1 = ri(rng, 2, 5), e1 = ri(rng, 2, 4);
            let b2 = ri(rng, 2, 5);
            if (b2 === b1) b2 = b1 < 5 ? b1 + 1 : 2;
            const e2 = ri(rng, 2, 3);
            const v1 = Math.pow(b1, e1), v2 = Math.pow(b2, e2);
            const ans = v1 * v2;
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${b1}^{${e1}} \\times ${b2}^{${e2}}$`,
                answer: String(ans),
                answerDisplay: `$${ans}$`,
                worked: `$${b1}^{${e1}} \\times ${b2}^{${e2}} = ${v1} \\times ${v2} = ${ans}$`,
            };
        }
        if (type === 1) {
            const root = ri(rng, 4, 20);
            const sq = root * root;
            return {
                clue: `Find $\\sqrt{${sq}}$`,
                answer: String(root),
                answerDisplay: `$${root}$`,
                worked: `$\\sqrt{${sq}} = ${root}$ because $${root}^2 = ${sq}$`,
            };
        }
        const root = ri(rng, 2, 8);
        const cube = root * root * root;
        return {
            clue: `Find $\\sqrt[3]{${cube}}$`,
            answer: String(root),
            answerDisplay: `$${root}$`,
            worked: `$\\sqrt[3]{${cube}} = ${root}$ because $${root}^3 = ${cube}$`,
        };
    }

    if (op === 'indices-multiply') {
        if (diff === 'Easy') {
            const base = ri(rng, 2, 5);
            const m = ri(rng, 2, 3), n = ri(rng, 1, 2);
            const sum = m + n;
            const ans = Math.pow(base, sum);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${base}^{${m}} \\times ${base}^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${sum}} = ${ans}$`,
                worked: `$${base}^{${m}} \\times ${base}^{${n}} = ${base}^{${m}+${n}} = ${base}^{${sum}} = ${ans}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 2);
            if (type === 0) {
                const base = ri(rng, 2, 7);
                const m = ri(rng, 2, 5), n = ri(rng, 2, 4);
                const sum = m + n;
                const ans = Math.pow(base, sum);
                if (ans > 999999) return null;
                return {
                    clue: `${verb}\n$${base}^{${m}} \\times ${base}^{${n}}$`,
                    answer: String(ans),
                    answerDisplay: `$${base}^{${sum}} = ${ans}$`,
                    worked: `$${base}^{${m}} \\times ${base}^{${n}} = ${base}^{${m}+${n}} = ${base}^{${sum}} = ${ans}$`,
                };
            }
            if (type === 1) {
                const base = ri(rng, 2, 8);
                const m = ri(rng, 2, 5), n = ri(rng, 2, 4);
                const sum = m + n;
                return {
                    clue: `Simplify $${base}^{${m}} \\times ${base}^{${n}}$, writing your answer as a power of $${base}$.`,
                    answer: `${base}^${sum}`,
                    answerDisplay: `$${base}^{${sum}}$`,
                    worked: `$${base}^{${m}} \\times ${base}^{${n}} = ${base}^{${m}+${n}} = ${base}^{${sum}}$`,
                };
            }
            const base = ri(rng, 2, 5);
            const m = ri(rng, 1, 3), n = ri(rng, 1, 3), p = ri(rng, 1, 3);
            const sum = m + n + p;
            const ans = Math.pow(base, sum);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${base}^{${m}} \\times ${base}^{${n}} \\times ${base}^{${p}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${sum}} = ${ans}$`,
                worked: `$${base}^{${m}} \\times ${base}^{${n}} \\times ${base}^{${p}} = ${base}^{${m}+${n}+${p}} = ${base}^{${sum}} = ${ans}$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const base = ri(rng, 2, 9);
            const m = ri(rng, 2, 6), n = ri(rng, 2, 5);
            const sum = m + n;
            const ans = Math.pow(base, sum);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${base}^{${m}} \\times ${base}^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${sum}} = ${ans}$`,
                worked: `$${base}^{${m}} \\times ${base}^{${n}} = ${base}^{${m}+${n}} = ${base}^{${sum}} = ${ans}$`,
            };
        }
        if (type === 1) {
            const base = ri(rng, 2, 6);
            const missing = ri(rng, 2, 5), n = ri(rng, 2, 5);
            const total = missing + n;
            return {
                clue: `Find the missing index: $${base}^{?} \\times ${base}^{${n}} = ${base}^{${total}}$`,
                answer: String(missing),
                answerDisplay: `$${missing}$`,
                worked: `$? + ${n} = ${total}$, so $? = ${total} - ${n} = ${missing}$`,
            };
        }
        const base = ri(rng, 2, 7);
        const m = ri(rng, 3, 7), n = ri(rng, 3, 6);
        const sum = m + n;
        return {
            clue: `Simplify $${base}^{${m}} \\times ${base}^{${n}}$, writing your answer as a power of $${base}$.`,
            answer: `${base}^${sum}`,
            answerDisplay: `$${base}^{${sum}}$`,
            worked: `$${base}^{${m}} \\times ${base}^{${n}} = ${base}^{${m}+${n}} = ${base}^{${sum}}$`,
        };
    }

    if (op === 'indices-divide') {
        if (diff === 'Easy') {
            const base = ri(rng, 2, 5);
            const n = ri(rng, 1, 2), extra = ri(rng, 1, 2);
            const m = n + extra;
            const ans = Math.pow(base, extra);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${base}^{${m}} \\div ${base}^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${extra}} = ${ans}$`,
                worked: `$${base}^{${m}} \\div ${base}^{${n}} = ${base}^{${m}-${n}} = ${base}^{${extra}} = ${ans}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 1);
            const base = ri(rng, 2, 7);
            const n = ri(rng, 2, 4), extra = ri(rng, 2, 4);
            const m = n + extra;
            if (type === 0) {
                const ans = Math.pow(base, extra);
                if (ans > 999999) return null;
                return {
                    clue: `${verb}\n$${base}^{${m}} \\div ${base}^{${n}}$`,
                    answer: String(ans),
                    answerDisplay: `$${base}^{${extra}} = ${ans}$`,
                    worked: `$${base}^{${m}} \\div ${base}^{${n}} = ${base}^{${m}-${n}} = ${base}^{${extra}} = ${ans}$`,
                };
            }
            return {
                clue: `Simplify $${base}^{${m}} \\div ${base}^{${n}}$, writing your answer as a power of $${base}$.`,
                answer: `${base}^${extra}`,
                answerDisplay: `$${base}^{${extra}}$`,
                worked: `$${base}^{${m}} \\div ${base}^{${n}} = ${base}^{${m}-${n}} = ${base}^{${extra}}$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const base = ri(rng, 2, 9);
            const n = ri(rng, 2, 5), extra = ri(rng, 2, 5);
            const m = n + extra;
            const ans = Math.pow(base, extra);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$${base}^{${m}} \\div ${base}^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${extra}} = ${ans}$`,
                worked: `$${base}^{${m}} \\div ${base}^{${n}} = ${base}^{${m}-${n}} = ${base}^{${extra}} = ${ans}$`,
            };
        }
        if (type === 1) {
            const base = ri(rng, 2, 6);
            const result = ri(rng, 1, 4), miss = ri(rng, 2, 5);
            const m = miss + result;
            return {
                clue: `Find the missing index: $${base}^{${m}} \\div ${base}^{?} = ${base}^{${result}}$`,
                answer: String(miss),
                answerDisplay: `$${miss}$`,
                worked: `$${m} - ? = ${result}$, so $? = ${m} - ${result} = ${miss}$`,
            };
        }
        // Combined multiply + divide
        const base = ri(rng, 2, 5);
        const m = ri(rng, 2, 4), n = ri(rng, 2, 4), p = ri(rng, 1, 3);
        const total = m + n - p;
        if (total < 1) return null;
        const ans = Math.pow(base, total);
        if (ans > 999999) return null;
        return {
            clue: `${verb}\n$${base}^{${m}} \\times ${base}^{${n}} \\div ${base}^{${p}}$`,
            answer: String(ans),
            answerDisplay: `$${base}^{${total}} = ${ans}$`,
            worked: `$${base}^{${m}+${n}-${p}} = ${base}^{${total}} = ${ans}$`,
        };
    }

    if (op === 'indices-power') {
        if (diff === 'Easy') {
            const base = ri(rng, 2, 3);
            const m = ri(rng, 2, 3), n = 2;
            const prod = m * n;
            const ans = Math.pow(base, prod);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$(${base}^{${m}})^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${prod}} = ${ans}$`,
                worked: `$(${base}^{${m}})^{${n}} = ${base}^{${m} \\times ${n}} = ${base}^{${prod}} = ${ans}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 1);
            const base = ri(rng, 2, 5);
            const m = ri(rng, 2, 3), n = ri(rng, 2, 3);
            const prod = m * n;
            if (type === 0) {
                const ans = Math.pow(base, prod);
                if (ans > 999999) return null;
                return {
                    clue: `${verb}\n$(${base}^{${m}})^{${n}}$`,
                    answer: String(ans),
                    answerDisplay: `$${base}^{${prod}} = ${ans}$`,
                    worked: `$(${base}^{${m}})^{${n}} = ${base}^{${m} \\times ${n}} = ${base}^{${prod}} = ${ans}$`,
                };
            }
            return {
                clue: `Simplify $(${base}^{${m}})^{${n}}$, writing your answer as a power of $${base}$.`,
                answer: `${base}^${prod}`,
                answerDisplay: `$${base}^{${prod}}$`,
                worked: `$(${base}^{${m}})^{${n}} = ${base}^{${m} \\times ${n}} = ${base}^{${prod}}$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const base = ri(rng, 2, 5);
            const m = ri(rng, 2, 4), n = ri(rng, 2, 3);
            const prod = m * n;
            const ans = Math.pow(base, prod);
            if (ans > 999999) return null;
            return {
                clue: `${verb}\n$(${base}^{${m}})^{${n}}$`,
                answer: String(ans),
                answerDisplay: `$${base}^{${prod}} = ${ans}$`,
                worked: `$(${base}^{${m}})^{${n}} = ${base}^{${m} \\times ${n}} = ${base}^{${prod}} = ${ans}$`,
            };
        }
        if (type === 1) {
            const base = ri(rng, 2, 5);
            const missing = ri(rng, 2, 4), n = ri(rng, 2, 3);
            const prod = missing * n;
            return {
                clue: `Find the missing index: $(${base}^{?})^{${n}} = ${base}^{${prod}}$`,
                answer: String(missing),
                answerDisplay: `$${missing}$`,
                worked: `$? \\times ${n} = ${prod}$, so $? = ${prod} \\div ${n} = ${missing}$`,
            };
        }
        // Combined: (a^m)^n × a^p
        const base = ri(rng, 2, 4);
        const m = ri(rng, 2, 3), n = ri(rng, 2, 3), p = ri(rng, 1, 3);
        const total = m * n + p;
        const ans = Math.pow(base, total);
        if (ans > 999999) return null;
        return {
            clue: `${verb}\n$(${base}^{${m}})^{${n}} \\times ${base}^{${p}}$`,
            answer: String(ans),
            answerDisplay: `$${base}^{${total}} = ${ans}$`,
            worked: `$(${base}^{${m}})^{${n}} \\times ${base}^{${p}} = ${base}^{${m * n}} \\times ${base}^{${p}} = ${base}^{${m * n}+${p}} = ${base}^{${total}} = ${ans}$`,
        };
    }

    if (op === 'indices-zero') {
        if (diff === 'Easy') {
            const base = ri(rng, 2, 10);
            return {
                clue: `${verb}\n$${base}^0$`,
                answer: '1',
                answerDisplay: '$1$',
                worked: `Any non-zero number to the power $0$ equals $1$.`,
            };
        }
        if (diff === 'Medium') {
            const base = ri(rng, 2, 20);
            const extra = ri(rng, 1, 5);
            const ans = Math.pow(base, 0) + extra;
            return {
                clue: `${verb}\n$${base}^0 + ${extra}$`,
                answer: String(ans),
                answerDisplay: `$${ans}$`,
                worked: `$${base}^0 + ${extra} = 1 + ${extra} = ${ans}$`,
            };
        }
        // Hard
        const base = ri(rng, 2, 10);
        const k = ri(rng, 2, 6);
        const ans = k;
        return {
            clue: `${verb}\n$${k} \\times ${base}^0$`,
            answer: String(ans),
            answerDisplay: `$${ans}$`,
            worked: `$${k} \\times ${base}^0 = ${k} \\times 1 = ${ans}$`,
        };
    }

    // indices-negative: a^(-n) = 1/a^n
    if (diff === 'Easy') {
        const base = ri(rng, 2, 4), n = 1;
        const denom = Math.pow(base, n);
        return {
            clue: `${verb}\n$${base}^{-${n}}$`,
            answer: `1/${denom}`,
            answerDisplay: `$\\frac{1}{${denom}}$`,
            worked: `$${base}^{-${n}} = \\frac{1}{${base}^${n}} = \\frac{1}{${denom}}$`,
        };
    }
    if (diff === 'Medium') {
        const base = ri(rng, 2, 5), n = ri(rng, 1, 3);
        const denom = Math.pow(base, n);
        return {
            clue: `${verb}\n$${base}^{-${n}}$`,
            answer: `1/${denom}`,
            answerDisplay: `$\\frac{1}{${denom}}$`,
            worked: `$${base}^{-${n}} = \\frac{1}{${base}^${n}} = \\frac{1}{${denom}}$`,
        };
    }
    // Hard: express as fraction and evaluate
    const base = ri(rng, 2, 6), n = ri(rng, 2, 3);
    const denom = Math.pow(base, n);
    const k = ri(rng, 2, 5);
    const ans = k * denom;
    return {
        clue: `Find the value of $${k} \\div ${base}^{-${n}}$`,
        answer: String(ans),
        answerDisplay: `$${ans}$`,
        worked: `$${k} \\div ${base}^{-${n}} = ${k} \\times ${base}^{${n}} = ${k} \\times ${denom} = ${ans}$`,
    };
}

// ============================================================
// LINEAR RELATIONSHIPS (Cartesian-plane work)
// ============================================================
function _linEqStr(m, c) {
    const mStr = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`;
    const cStr = c === 0 ? '' : (c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`);
    return { mStr, cStr, full: `${mStr}${cStr}` };
}

function genLinear(rng, diff, allowedOps) {
    const OPS = ['plot-line', 'gradient-two-points', 'midpoint', 'intercepts',
                 'distance', 'equation-from-gp'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'plot-line') {
        if (diff === 'Easy') {
            const m = ri(rng, 1, 3);
            const c = ri(rng, 0, 6);
            const x = ri(rng, 1, 5);
            const y = m * x + c;
            const { cStr, full } = _linEqStr(m, c);
            return {
                clue: `Find $y$ when $x = ${x}$ for $y = ${full}$.`,
                answer: String(y),
                answerDisplay: `$y = ${y}$`,
                worked: `$y = ${m}(${x})${cStr} = ${y}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 1);
            const m = ri(rng, 1, 5) * (rng() < 0.4 ? -1 : 1);
            const c = ri(rng, -8, 8);
            const { cStr, full } = _linEqStr(m, c);
            if (type === 0) {
                const x = ri(rng, -4, 6);
                const y = m * x + c;
                return {
                    clue: `Find $y$ when $x = ${x}$ for $y = ${full}$.`,
                    answer: String(y),
                    answerDisplay: `$y = ${y}$`,
                    worked: `$y = ${m}(${x})${cStr} = ${y}$`,
                };
            }
            // Inverse: find x given y
            const ans = ri(rng, -3, 5);
            const y = m * ans + c;
            return {
                clue: `Find $x$ when $y = ${y}$ for $y = ${full}$.`,
                answer: String(ans),
                answerDisplay: `$x = ${ans}$`,
                worked: `$${y} = ${m}x${cStr}$, so $x = ${ans}$`,
            };
        }
        // Hard: does point lie on line?
        const type = ri(rng, 0, 1);
        const m = ri(rng, 1, 6) * (rng() < 0.5 ? -1 : 1);
        const c = ri(rng, -10, 10);
        const { full } = _linEqStr(m, c);
        if (type === 0) {
            const x = ri(rng, -5, 8);
            const y = m * x + c;
            return {
                clue: `Find $y$ when $x = ${x}$ for $y = ${full}$.`,
                answer: String(y),
                answerDisplay: `$y = ${y}$`,
                worked: `$y = ${m}(${x}) + ${c} = ${y}$`,
            };
        }
        // Check if point lies on line
        const px = ri(rng, -4, 6);
        const onLine = rng() < 0.5;
        const py = onLine ? (m * px + c) : (m * px + c + ri(rng, 1, 4));
        return {
            clue: `Does the point $(${px}, ${py})$ lie on the line $y = ${full}$? Answer *Yes* or *No*.`,
            answer: onLine ? 'Yes' : 'No',
            answerDisplay: onLine ? 'Yes' : 'No',
            worked: `$y = ${m}(${px}) + ${c} = ${m * px + c}$. Since $${m * px + c} ${onLine ? '=' : '\\neq'} ${py}$, the answer is ${onLine ? 'Yes' : 'No'}.`,
        };
    }

    if (op === 'gradient-two-points') {
        if (diff === 'Easy') {
            const x1 = ri(rng, 0, 5), y1 = ri(rng, 0, 5);
            const dx = ri(rng, 1, 4);
            const m = ri(rng, 1, 4);
            const x2 = x1 + dx, y2 = y1 + m * dx;
            return {
                clue: `Find the *gradient* of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
                answer: String(m),
                answerDisplay: `$m = ${m}$`,
                worked: `$m = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = \\frac{${y2 - y1}}{${dx}} = ${m}$`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 2);
            if (type <= 1) {
                const x1 = ri(rng, -6, 6), y1 = ri(rng, -6, 6);
                const dx = ri(rng, 1, 6);
                const m = ri(rng, -4, 4) || 1;
                const x2 = x1 + dx, y2 = y1 + m * dx;
                if (type === 0) {
                    return {
                        clue: `Find the *gradient* of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
                        answer: String(m),
                        answerDisplay: `$m = ${m}$`,
                        worked: `$m = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = \\frac{${y2 - y1}}{${dx}} = ${m}$`,
                    };
                }
                // Parallel: what gradient is parallel?
                return {
                    clue: `A line passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is the gradient of any line *parallel* to it?`,
                    answer: String(m),
                    answerDisplay: `$m = ${m}$`,
                    worked: `Gradient $= \\frac{${y2 - y1}}{${dx}} = ${m}$. Parallel lines have equal gradients.`,
                };
            }
            // Horizontal line (gradient 0)
            const y1 = ri(rng, -6, 6);
            const x1 = ri(rng, -5, 5), x2 = ri(rng, x1 + 1, x1 + 6);
            return {
                clue: `Find the *gradient* of the line through $(${x1}, ${y1})$ and $(${x2}, ${y1})$.`,
                answer: '0',
                answerDisplay: `$m = 0$`,
                worked: `$m = \\frac{${y1} - ${y1}}{${x2} - ${x1}} = \\frac{0}{${x2 - x1}} = 0$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 1);
        if (type === 0) {
            // Steep/negative gradient with larger coords
            const x1 = ri(rng, -8, 8), y1 = ri(rng, -8, 8);
            const dx = ri(rng, 1, 6);
            const m = ri(rng, -5, 5) || -2;
            const x2 = x1 + dx, y2 = y1 + m * dx;
            return {
                clue: `Find the *gradient* of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
                answer: String(m),
                answerDisplay: `$m = ${m}$`,
                worked: `$m = \\frac{${y2} - ${y1}}{${x2} - ${x1}} = \\frac{${y2 - y1}}{${dx}} = ${m}$`,
            };
        }
        // Perpendicular gradient
        const x1 = ri(rng, -5, 5), y1 = ri(rng, -5, 5);
        const dx = ri(rng, 1, 4);
        const m = ri(rng, 1, 4) * (rng() < 0.5 ? -1 : 1);
        const x2 = x1 + dx, y2 = y1 + m * dx;
        const perpM = m === 1 ? -1 : m === -1 ? 1 : (Number.isInteger(-1 / m) ? -1 / m : null);
        if (perpM === null) {
            return {
                clue: `Find the *gradient* of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
                answer: String(m),
                answerDisplay: `$m = ${m}$`,
                worked: `$m = \\frac{${y2 - y1}}{${dx}} = ${m}$`,
            };
        }
        return {
            clue: `A line passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Find the gradient of a line *perpendicular* to it.`,
            answer: String(perpM),
            answerDisplay: `$m = ${perpM}$`,
            worked: `Original gradient $= ${m}$. Perpendicular gradient $= -\\frac{1}{${m}} = ${perpM}$.`,
        };
    }

    if (op === 'midpoint') {
        if (diff === 'Easy') {
            const x1 = ri(rng, 0, 8) * 2, y1 = ri(rng, 0, 8) * 2;
            const x2 = ri(rng, 0, 8) * 2, y2 = ri(rng, 0, 8) * 2;
            if (x1 === x2 && y1 === y2) return genLinear(rng, diff, allowedOps);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            return {
                clue: `Find the *midpoint* of the segment from $(${x1}, ${y1})$ to $(${x2}, ${y2})$.`,
                answer: `(${mx},${my})`,
                answerDisplay: `$(${mx}, ${my})$`,
                worked: `$M = \\left(\\frac{${x1} + ${x2}}{2}, \\frac{${y1} + ${y2}}{2}\\right) = (${mx}, ${my})$`,
            };
        }
        if (diff === 'Medium') {
            const x1 = ri(rng, -6, 6) * 2, y1 = ri(rng, -6, 6) * 2;
            const x2 = ri(rng, -6, 6) * 2, y2 = ri(rng, -6, 6) * 2;
            if (x1 === x2 && y1 === y2) return genLinear(rng, diff, allowedOps);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            return {
                clue: `Find the *midpoint* of the segment from $(${x1}, ${y1})$ to $(${x2}, ${y2})$.`,
                answer: `(${mx},${my})`,
                answerDisplay: `$(${mx}, ${my})$`,
                worked: `$M = \\left(\\frac{${x1} + ${x2}}{2}, \\frac{${y1} + ${y2}}{2}\\right) = (${mx}, ${my})$`,
            };
        }
        // Hard: find the other endpoint given midpoint and one endpoint
        const ax = ri(rng, -6, 6), ay = ri(rng, -6, 6);
        const mx = ri(rng, -4, 4), my = ri(rng, -4, 4);
        const bx = 2 * mx - ax, by = 2 * my - ay;
        return {
            clue: `The *midpoint* of $AB$ is $(${mx}, ${my})$. If $A = (${ax}, ${ay})$, find $B$.`,
            answer: `(${bx},${by})`,
            answerDisplay: `$(${bx}, ${by})$`,
            worked: `$B_x = 2(${mx}) - ${ax} = ${bx}$, $B_y = 2(${my}) - ${ay} = ${by}$`,
        };
    }

    if (op === 'intercepts') {
        if (diff === 'Easy') {
            const m = ri(rng, 1, 4) * (rng() < 0.3 ? -1 : 1);
            const c = ri(rng, -6, 8);
            const { full } = _linEqStr(m, c);
            return {
                clue: `What is the *y-intercept* of the line $y = ${full}$?`,
                answer: String(c),
                answerDisplay: `$${c}$`,
                worked: `The y-intercept is the constant term: $c = ${c}$`,
            };
        }
        if (diff === 'Medium') {
            // x-intercept: 0 = mx + c → x = −c/m. Ensure integer answer.
            const m = rc(rng, [1, -1, 2, -2, 3, -3, 4, -4, 5]);
            const ans = ri(rng, -5, 5) || 1;
            const c = -m * ans;
            const { full } = _linEqStr(m, c);
            return {
                clue: `Find the *x-intercept* of the line $y = ${full}$.`,
                answer: String(ans),
                answerDisplay: `$x = ${ans}$`,
                worked: `Set $y = 0$: $0 = ${m}x + ${c > 0 ? c : `(${c})`}$, so $x = ${ans}$`,
            };
        }
        // Hard: both intercepts, area of triangle with axes
        const m = rc(rng, [1, -1, 2, -2, 3, -3, 4, -4]);
        const xInt = ri(rng, 1, 6) * (rng() < 0.5 ? -1 : 1);
        const c = -m * xInt;
        const yInt = c;
        const area = Math.abs(xInt * yInt) / 2;
        const { full } = _linEqStr(m, c);
        return {
            clue: `The line $y = ${full}$ forms a triangle with the coordinate axes. Find the *area* of this triangle.`,
            answer: String(area),
            answerDisplay: `$${area}$ square units`,
            worked: `x-intercept $= ${xInt}$, y-intercept $= ${yInt}$. Area $= \\frac{1}{2} \\times |${xInt}| \\times |${yInt}| = ${area}$`,
        };
    }

    if (op === 'distance') {
        const triples = diff === 'Hard'
            ? [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25]]
            : [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]];
        const [a, b, c] = rc(rng, triples);
        const x1 = ri(rng, -5, 5), y1 = ri(rng, -5, 5);
        const x2 = x1 + a, y2 = y1 + b;
        return {
            clue: `Find the *distance* between $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
            answer: String(c),
            answerDisplay: `$d = ${c}$ units`,
            worked: `$d = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$`,
        };
    }

    // equation-from-gp
    const m = ri(rng, 1, diff === 'Easy' ? 3 : 5) * (rng() < 0.5 ? -1 : 1);
    const x1 = ri(rng, -4, 4), y1 = ri(rng, -6, 6);
    const c = y1 - m * x1;
    const { mStr, full } = _linEqStr(m, c);
    return {
        clue: `Find the equation of the line with gradient $${m}$ passing through $(${x1}, ${y1})$.`,
        answer: `y=${mStr}${c >= 0 ? '+' : ''}${c}`,
        answerDisplay: `$y = ${full}$`,
        worked: `$y - ${y1} = ${m}(x - ${x1})$, so $y = ${full}$`,
    };
}

// ============================================================
// PROPERTIES OF GEOMETRICAL FIGURES (Stage 5)
// Congruence tests, similarity ratio, quadrilateral properties
// ============================================================
function genPropsOfFigures(rng, diff, allowedOps) {
    const OPS = ['congruent-tests', 'similar-ratio', 'quad-properties'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'congruent-tests') {
        const tests = [
            { name: 'SSS', desc: 'three pairs of equal sides' },
            { name: 'SAS', desc: 'two equal sides and the included angle' },
            { name: 'AAS', desc: 'two equal angles and one corresponding side' },
            { name: 'RHS', desc: 'right angle, equal hypotenuse and one equal side' },
        ];
        if (diff === 'Easy') {
            const t = rc(rng, tests);
            return {
                clue: `Two triangles share ${t.desc}. State the *congruence test* that applies.`,
                answer: t.name,
                answerDisplay: t.name,
                worked: `${t.desc} → ${t.name}`,
            };
        }
        if (diff === 'Medium') {
            const t = rc(rng, tests);
            return {
                clue: `To prove two triangles congruent using *${t.name}*, what information do you need? Answer: ${t.desc}.
How many pieces of information does ${t.name} require?`,
                answer: t.name === 'SSS' ? '3' : t.name === 'RHS' ? '3' : '3',
                answerDisplay: '3 pieces',
                worked: `${t.name} requires ${t.desc} — that is 3 independent measurements.`,
            };
        }
        // Hard: given measurements, identify the test and find a missing value
        const a = ri(rng, 5, 12), b = ri(rng, 5, 12);
        const c = Math.round(Math.sqrt(a * a + b * b) * 100) / 100;
        const isClean = Number.isInteger(c);
        if (isClean) {
            return {
                clue: `Triangle PQR has a right angle at Q, with $PQ = ${a}$ cm and $QR = ${b}$ cm. Triangle XYZ has a right angle at Y with $XY = ${a}$ cm and hypotenuse $XZ = ${c}$ cm. Are these triangles congruent? State the test.`,
                answer: 'RHS',
                answerDisplay: 'RHS',
                worked: `Both have a right angle, equal side ($${a}$ cm) and equal hypotenuse ($${c}$ cm) → RHS.`,
            };
        }
        const ang = ri(rng, 30, 80);
        return {
            clue: `Two triangles both have sides $${a}$ cm and $${b}$ cm with an included angle of $${ang}°$. Are they congruent? State the test.`,
            answer: 'SAS',
            answerDisplay: 'SAS',
            worked: `Two equal sides ($${a}$ cm, $${b}$ cm) and the included angle ($${ang}°$) → SAS.`,
        };
    }

    if (op === 'similar-ratio') {
        if (diff === 'Easy') {
            const k = rc(rng, [2, 3, 4, 5]);
            const orig = ri(rng, 3, 10);
            const image = orig * k;
            return {
                clue: `Two triangles are *similar* with scale factor $${k}$. A side on the smaller triangle is $${orig}$ cm. Find the matching side on the larger triangle.`,
                answer: String(image),
                answerDisplay: `${image} cm`,
                worked: `Scaled side $= ${orig} \\times ${k} = ${image}$ cm`,
            };
        }
        if (diff === 'Medium') {
            // Find the scale factor, then a missing side
            const k = rc(rng, [2, 3, 4, 1.5, 2.5]);
            const a = ri(rng, 4, 10);
            const aImg = a * k;
            if (!Number.isInteger(aImg)) return genPropsOfFigures(rng, diff, allowedOps);
            const b = ri(rng, 3, 8);
            const bImg = b * k;
            if (!Number.isInteger(bImg)) return genPropsOfFigures(rng, diff, allowedOps);
            return {
                clue: `Two similar triangles have corresponding sides $${a}$ cm and $${aImg}$ cm. Find the side corresponding to $${b}$ cm.`,
                answer: String(bImg),
                answerDisplay: `${bImg} cm`,
                worked: `Scale factor $= \\frac{${aImg}}{${a}} = ${k}$. Missing side $= ${b} \\times ${k} = ${bImg}$ cm.`,
            };
        }
        // Hard: area ratio = k²
        const k = rc(rng, [2, 3, 4, 5]);
        const areaSmall = ri(rng, 5, 20);
        const areaLarge = areaSmall * k * k;
        return {
            clue: `Two similar figures have a scale factor of $${k}$. The area of the smaller figure is $${areaSmall}$ cm². Find the area of the larger figure.`,
            answer: String(areaLarge),
            answerDisplay: `$${areaLarge}$ cm²`,
            worked: `Area ratio $= ${k}^2 = ${k * k}$. Larger area $= ${areaSmall} \\times ${k * k} = ${areaLarge}$ cm².`,
        };
    }

    // quad-properties
    const quads = [
        { name: 'square',         desc: 'four equal sides and four right angles', sym: 4, diag: 'equal and bisect at right angles' },
        { name: 'rectangle',      desc: 'opposite sides equal and four right angles', sym: 2, diag: 'equal and bisect each other' },
        { name: 'rhombus',        desc: 'four equal sides and opposite angles equal', sym: 2, diag: 'bisect each other at right angles' },
        { name: 'parallelogram',  desc: 'opposite sides parallel and equal, opposite angles equal', sym: 0, diag: 'bisect each other' },
        { name: 'trapezium',      desc: 'exactly one pair of parallel sides', sym: 0, diag: 'do not bisect each other' },
        { name: 'kite',           desc: 'two pairs of adjacent equal sides', sym: 1, diag: 'one bisects the other at right angles' },
    ];
    if (diff === 'Easy') {
        const q = rc(rng, quads);
        return { clue: `Name the quadrilateral with ${q.desc}.`, answer: q.name, answerDisplay: q.name, worked: `${q.desc} → ${q.name}` };
    }
    if (diff === 'Medium') {
        const q = rc(rng, quads);
        return {
            clue: `How many lines of *symmetry* does a **${q.name}** have?`,
            answer: String(q.sym),
            answerDisplay: `${q.sym}`,
            worked: `A ${q.name} has ${q.sym} line${q.sym !== 1 ? 's' : ''} of symmetry.`,
        };
    }
    // Hard: find missing angle in a quadrilateral
    const a1 = ri(rng, 60, 110), a2 = ri(rng, 60, 110), a3 = ri(rng, 50, 100);
    const a4 = 360 - a1 - a2 - a3;
    if (a4 < 30 || a4 > 170) return genPropsOfFigures(rng, diff, allowedOps);
    return {
        clue: `A quadrilateral has angles $${a1}°$, $${a2}°$, and $${a3}°$. Find the *fourth angle*.`,
        answer: String(a4),
        answerDisplay: `$${a4}°$`,
        worked: `Angle sum $= 360°$. Fourth angle $= 360 - ${a1} - ${a2} - ${a3} = ${a4}°$.`,
    };
}

// ============================================================
// VARIATION & RATES OF CHANGE (Stage 5)
// Direct: y = kx ; Inverse: y = k/x
// ============================================================
function genVariation(rng, diff, allowedOps) {
    const OPS = ['direct-variation', 'inverse-variation'];
    const pool = OPS.filter(k => !allowedOps || allowedOps.includes(k));
    if (pool.length === 0) return null;
    const op = rc(rng, pool);

    if (op === 'direct-variation') {
        if (diff === 'Easy') {
            const type = ri(rng, 0, 2);
            if (type === 0) {
                const k = ri(rng, 2, 6);
                const x1 = ri(rng, 2, 5), y1 = k * x1;
                const x2 = ri(rng, 2, 8);
                const y2 = k * x2;
                return {
                    clue: rc(rng, [
                        `$y$ is **directly proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                        `$y$ varies **directly** with $x$. Given that $x = ${x1}$ when $y = ${y1}$, find $y$ when $x = ${x2}$.`,
                        `If $y \\propto x$ and $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
                    ]),
                    answer: String(y2),
                    answerDisplay: `$y = ${y2}$`,
                    worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. $y = ${k} \\times ${x2} = ${y2}$`,
                };
            }
            if (type === 1) {
                const k = ri(rng, 2, 6);
                const x1 = ri(rng, 2, 6), y1 = k * x1;
                const x2f = ri(rng, 2, 8);
                const y2 = k * x2f;
                return {
                    clue: rc(rng, [
                        `$y$ is **directly proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${y2}$.`,
                        `$y \\propto x$. If $y = ${y1}$ when $x = ${x1}$, what is $x$ when $y = ${y2}$?`,
                    ]),
                    answer: String(x2f),
                    answerDisplay: `$x = ${x2f}$`,
                    worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. $x = \\frac{${y2}}{${k}} = ${x2f}$`,
                };
            }
            const rate = ri(rng, 5, 12);
            const litres = ri(rng, 2, 8);
            const dist = rate * litres;
            return {
                clue: `A car uses fuel at a constant rate. It travels $${rate}$ km per litre. How far can it travel on $${litres}$ litres?`,
                answer: String(dist),
                answerDisplay: `$${dist}$ km`,
                worked: `$\\text{distance} = ${rate} \\times ${litres} = ${dist}$ km`,
            };
        }
        if (diff === 'Medium') {
            const type = ri(rng, 0, 3);
            if (type === 0) {
                const k = ri(rng, 3, 10);
                const x1 = ri(rng, 2, 8), y1 = k * x1;
                const x2 = ri(rng, 3, 12);
                const y2 = k * x2;
                return {
                    clue: rc(rng, [
                        `$y$ is **directly proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                        `$y \\propto x$. Given $y = ${y1}$ when $x = ${x1}$, calculate $y$ when $x = ${x2}$.`,
                    ]),
                    answer: String(y2),
                    answerDisplay: `$y = ${y2}$`,
                    worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. $y = ${k} \\times ${x2} = ${y2}$`,
                };
            }
            if (type === 1) {
                const k = ri(rng, 3, 8);
                const x1 = ri(rng, 2, 6), y1 = k * x1;
                const x2 = ri(rng, 3, 10);
                const y2 = k * x2;
                return {
                    clue: `The cost $C$ varies directly with the number of items $n$. $${x1}$ items cost $\\$${y1}$. Find the cost of $${x2}$ items.`,
                    answer: String(y2),
                    answerDisplay: `$\\$${y2}$`,
                    worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. Cost $= ${k} \\times ${x2} = \\$${y2}$`,
                };
            }
            if (type === 2) {
                const k = ri(rng, 2, 5);
                const w1 = ri(rng, 3, 8), ext1 = k * w1;
                const w2 = ri(rng, 4, 12);
                const ext2 = k * w2;
                return {
                    clue: `A spring stretches in **direct proportion** to the weight applied. A $${w1}$ kg weight stretches it $${ext1}$ cm. How far does a $${w2}$ kg weight stretch it?`,
                    answer: String(ext2),
                    answerDisplay: `$${ext2}$ cm`,
                    worked: `$k = \\frac{${ext1}}{${w1}} = ${k}$. Extension $= ${k} \\times ${w2} = ${ext2}$ cm`,
                };
            }
            const k = ri(rng, 3, 10);
            const x1 = ri(rng, 2, 6), y1 = k * x1;
            const x2f = ri(rng, 3, 10);
            const y2 = k * x2f;
            return {
                clue: `$y$ is **directly proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${y2}$.`,
                answer: String(x2f),
                answerDisplay: `$x = ${x2f}$`,
                worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. $x = \\frac{${y2}}{${k}} = ${x2f}$`,
            };
        }
        // Hard
        const type = ri(rng, 0, 3);
        if (type === 0) {
            const k = ri(rng, 2, 8);
            const x1 = ri(rng, 2, 5), y1 = k * x1 * x1;
            const x2 = ri(rng, 2, 6);
            const y2 = k * x2 * x2;
            return {
                clue: rc(rng, [
                    `$y$ is **directly proportional** to $x^2$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                    `$y \\propto x^2$. Given $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
                ]),
                answer: String(y2),
                answerDisplay: `$y = ${y2}$`,
                worked: `$y = kx^2$. $k = \\frac{${y1}}{${x1}^2} = \\frac{${y1}}{${x1 * x1}} = ${k}$. $y = ${k} \\times ${x2}^2 = ${k} \\times ${x2 * x2} = ${y2}$`,
            };
        }
        if (type === 1) {
            const k = ri(rng, 4, 15);
            const x1 = ri(rng, 2, 6), y1 = k * x1;
            const x2 = ri(rng, 3, 10);
            const y2 = k * x2;
            return {
                clue: `$y \\propto x$. When $x = ${x1}$, $y = ${y1}$. Find the *constant of proportionality* $k$, then find $y$ when $x = ${x2}$.`,
                answer: String(y2),
                answerDisplay: `$k = ${k},\\ y = ${y2}$`,
                worked: `$k = \\frac{${y1}}{${x1}} = ${k}$. $y = ${k} \\times ${x2} = ${y2}$`,
            };
        }
        if (type === 2) {
            const k = ri(rng, 1, 4);
            const x1 = ri(rng, 2, 4), y1 = k * x1 * x1 * x1;
            const x2 = ri(rng, 2, 5);
            const y2 = k * x2 * x2 * x2;
            return {
                clue: rc(rng, [
                    `$y$ is **directly proportional** to $x^3$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                    `$y \\propto x^3$. Given $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
                ]),
                answer: String(y2),
                answerDisplay: `$y = ${y2}$`,
                worked: `$y = kx^3$. $k = \\frac{${y1}}{${x1}^3} = \\frac{${y1}}{${x1 * x1 * x1}} = ${k}$. $y = ${k} \\times ${x2}^3 = ${k} \\times ${x2 * x2 * x2} = ${y2}$`,
            };
        }
        // type 3: y ∝ √x
        const k = rc(rng, [1, 4, 9, 16, 25]);
        const bases = [4, 9, 16, 25, 36, 49];
        const x1 = rc(rng, bases), y1 = k * Math.sqrt(x1);
        const x2 = rc(rng, bases.filter(b => b !== x1));
        const y2 = k * Math.sqrt(x2);
        if (!Number.isInteger(y1) || !Number.isInteger(y2)) return genVariation(rng, diff, allowedOps);
        return {
            clue: rc(rng, [
                `$y$ is **directly proportional** to $\\sqrt{x}$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                `$y \\propto \\sqrt{x}$. Given $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
            ]),
            answer: String(y2),
            answerDisplay: `$y = ${y2}$`,
            worked: `$y = k\\sqrt{x}$. $k = \\frac{${y1}}{\\sqrt{${x1}}} = \\frac{${y1}}{${Math.sqrt(x1)}} = ${k}$. $y = ${k} \\times \\sqrt{${x2}} = ${k} \\times ${Math.sqrt(x2)} = ${y2}$`,
        };
    }

    // inverse-variation
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        const x1 = ri(rng, 2, 6), y1 = ri(rng, 2, 6);
        const k = x1 * y1;
        const divisors = [];
        for (let d = 2; d <= k; d++) if (k % d === 0 && d !== x1) divisors.push(d);
        if (divisors.length === 0) return genVariation(rng, diff, allowedOps);
        const x2 = rc(rng, divisors);
        const y2 = k / x2;
        if (type === 0) {
            return {
                clue: rc(rng, [
                    `$y$ is **inversely proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                    `$y$ varies **inversely** with $x$. Given that $x = ${x1}$ when $y = ${y1}$, find $y$ when $x = ${x2}$.`,
                    `If $y \\propto \\frac{1}{x}$ and $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
                ]),
                answer: String(y2),
                answerDisplay: `$y = ${y2}$`,
                worked: `$k = ${x1} \\times ${y1} = ${k}$. $y = \\frac{${k}}{${x2}} = ${y2}$`,
            };
        }
        const speed = ri(rng, 40, 80);
        const time = ri(rng, 2, 6);
        const dist = speed * time;
        const speed2Arr = [50, 60, 70, 80, 100].filter(s => s !== speed && dist % s === 0);
        if (speed2Arr.length === 0) return genVariation(rng, diff, allowedOps);
        const speed2 = rc(rng, speed2Arr);
        const time2 = dist / speed2;
        return {
            clue: `A car travelling at $${speed}$ km/h takes $${time}$ hours for a journey. How long would the journey take at $${speed2}$ km/h?`,
            answer: String(time2),
            answerDisplay: `$${time2}$ hours`,
            worked: `$\\text{distance} = ${speed} \\times ${time} = ${dist}$ km. $\\text{time} = \\frac{${dist}}{${speed2}} = ${time2}$ hours`,
        };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 3);
        if (type <= 1) {
            const x1 = ri(rng, 2, 8), y1 = ri(rng, 2, 8);
            const k = x1 * y1;
            const divisors = [];
            for (let d = 2; d <= k; d++) if (k % d === 0 && d !== x1) divisors.push(d);
            if (divisors.length === 0) return genVariation(rng, diff, allowedOps);
            const x2 = rc(rng, divisors);
            const y2 = k / x2;
            if (type === 0) {
                return {
                    clue: rc(rng, [
                        `$y$ is **inversely proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
                        `$y \\propto \\frac{1}{x}$. Given $y = ${y1}$ when $x = ${x1}$, calculate $y$ when $x = ${x2}$.`,
                    ]),
                    answer: String(y2),
                    answerDisplay: `$y = ${y2}$`,
                    worked: `$k = ${x1} \\times ${y1} = ${k}$. $y = \\frac{${k}}{${x2}} = ${y2}$`,
                };
            }
            return {
                clue: `$${x1}$ workers can complete a job in $${y1}$ days. How many days would $${x2}$ workers take?`,
                answer: String(y2),
                answerDisplay: `${y2} days`,
                worked: `$k = ${x1} \\times ${y1} = ${k}$. Days $= \\frac{${k}}{${x2}} = ${y2}$`,
            };
        }
        if (type === 2) {
            const speed1 = rc(rng, [40, 50, 60, 70, 80]);
            const time1 = ri(rng, 3, 8);
            const dist = speed1 * time1;
            const speed2Arr = [40, 50, 60, 80, 100, 120].filter(s => s !== speed1 && dist % s === 0);
            if (speed2Arr.length === 0) return genVariation(rng, diff, allowedOps);
            const speed2 = rc(rng, speed2Arr);
            const time2 = dist / speed2;
            return {
                clue: `A train travelling at $${speed1}$ km/h takes $${time1}$ hours. If the train travels at $${speed2}$ km/h instead, how long would the journey take?`,
                answer: String(time2),
                answerDisplay: `$${time2}$ hours`,
                worked: `$\\text{distance} = ${speed1} \\times ${time1} = ${dist}$ km. $\\text{time} = \\frac{${dist}}{${speed2}} = ${time2}$ hours`,
            };
        }
        // type 3: find x given y
        const x1 = ri(rng, 2, 8), y1 = ri(rng, 2, 8);
        const k = x1 * y1;
        const y2 = ri(rng, 2, 8);
        if (k % y2 !== 0 || y2 === y1) return genVariation(rng, diff, allowedOps);
        const x2 = k / y2;
        return {
            clue: `$y$ is **inversely proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${y2}$.`,
            answer: String(x2),
            answerDisplay: `$x = ${x2}$`,
            worked: `$k = ${x1} \\times ${y1} = ${k}$. $x = \\frac{${k}}{${y2}} = ${x2}$`,
        };
    }
    // Hard
    const hType = ri(rng, 0, 2);
    if (hType === 0) {
        const x1 = ri(rng, 2, 10), y1 = ri(rng, 2, 10);
        const k = x1 * y1;
        const y2 = ri(rng, 2, 8);
        if (k % y2 !== 0) return genVariation(rng, diff, allowedOps);
        const x2 = k / y2;
        return {
            clue: rc(rng, [
                `$y$ is **inversely proportional** to $x$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${y2}$.`,
                `$y \\propto \\frac{1}{x}$. Given $y = ${y1}$ when $x = ${x1}$, find $x$ when $y = ${y2}$.`,
            ]),
            answer: String(x2),
            answerDisplay: `$x = ${x2}$`,
            worked: `$k = ${x1} \\times ${y1} = ${k}$. $x = \\frac{${k}}{${y2}} = ${x2}$`,
        };
    }
    if (hType === 1) {
        const k = ri(rng, 2, 6);
        const x1 = ri(rng, 2, 5), y1 = k * x1 * x1;
        const x2v = ri(rng, 2, 6);
        const y2 = k * x2v * x2v;
        return {
            clue: rc(rng, [
                `$y$ is **directly proportional** to $x^2$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${y2}$.`,
                `$y \\propto x^2$. Given $y = ${y1}$ when $x = ${x1}$, find $x$ when $y = ${y2}$.`,
            ]),
            answer: String(x2v),
            answerDisplay: `$x = ${x2v}$`,
            worked: `$k = \\frac{${y1}}{${x1}^2} = ${k}$. $x^2 = \\frac{${y2}}{${k}} = ${x2v * x2v}$. $x = \\sqrt{${x2v * x2v}} = ${x2v}$`,
        };
    }
    // hType 2: y ∝ 1/x²
    const k = ri(rng, 10, 50);
    const x1Arr = [2, 3, 4, 5].filter(x => Number.isInteger(k / (x * x)));
    if (x1Arr.length === 0) return genVariation(rng, diff, allowedOps);
    const x1 = rc(rng, x1Arr);
    const y1 = k / (x1 * x1);
    const x2Arr = [2, 3, 4, 5, 6].filter(x => x !== x1 && Number.isInteger(k / (x * x)));
    if (x2Arr.length === 0) return genVariation(rng, diff, allowedOps);
    const x2 = rc(rng, x2Arr);
    const y2 = k / (x2 * x2);
    return {
        clue: rc(rng, [
            `$y$ is **inversely proportional** to $x^2$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
            `$y \\propto \\frac{1}{x^2}$. Given $y = ${y1}$ when $x = ${x1}$, find $y$ when $x = ${x2}$.`,
        ]),
        answer: String(y2),
        answerDisplay: `$y = ${y2}$`,
        worked: `$y = \\frac{k}{x^2}$. $k = ${y1} \\times ${x1}^2 = ${y1} \\times ${x1 * x1} = ${k}$. $y = \\frac{${k}}{${x2}^2} = \\frac{${k}}{${x2 * x2}} = ${y2}$`,
    };
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
    return _genStatisticsCore(rng, diff, allowedOps, _depth, opts);
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
    // 2022-syllabus focus areas (additive — see comment near SUB_OPS)
    'Indices':                          genIndices,
    'Linear Relationships':             genLinear,
    'Properties of Geometrical Figures': genPropsOfFigures,
    'Variation & Rates of Change':      genVariation,
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
    'Indices':                          'Algebra',
    'Linear Relationships':             'Algebra',
    'Properties of Geometrical Figures': 'Geometry',
    'Variation & Rates of Change':      'Algebra',
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
 * @param {boolean} [opts.includePath] - include Stage 5 Path ops (default false)
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
    if (subtopics.length === 0) return [];
    while (topicPlan.length < count) topicPlan.push(...shuffled(subtopics));

    const results = [];
    const seenClues = new Set();
    const shapeCount = {};
    const MAX_SAME_SHAPE = 3;
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

        const shape = q.clue.replace(/\d+(\.\d+)?/g, '#').replace(/\\square/g, '□');
        shapeCount[shape] = (shapeCount[shape] || 0) + 1;
        if (shapeCount[shape] > MAX_SAME_SHAPE) continue;

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
