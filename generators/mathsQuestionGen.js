// =============================================================
// generators/mathsQuestionGen.js
// Local maths question generator — no API required.
// Produces clue bank entries for: integers, decimals, rounding,
// fractions, percentages, algebra, statistics, financial maths.
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
function rc(rng, arr)       { return arr[Math.floor(rng() * arr.length)]; }
function round(n, dp)       { const f = Math.pow(10, dp); return Math.round(n * f) / f; }

function gcd(a, b)  { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b)  { return (a * b) / gcd(a, b); }

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
// INTEGER arithmetic
// ============================================================
function genIntegers(rng, diff) {
    const ops = ['+', '-', '×', '÷'];
    const hardOps = ['+', '-', '×', '÷', 'bodmas'];
    const op  = rc(rng, diff === 'Easy' ? ['+', '-', '×'] : diff === 'Hard' ? hardOps : ops);

    if (op === '+') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, max);
        return { clue: `$${a} + ${b}$`, answer: String(a + b) };
    }
    if (op === '-') {
        const max = diff === 'Easy' ? 50 : diff === 'Medium' ? 500 : 9999;
        const a = ri(rng, 1, max), b = ri(rng, 1, a);
        return { clue: `$${a} - ${b}$`, answer: String(a - b) };
    }
    if (op === '×') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 25] : [12, 50];
        const a = ri(rng, lo, hi), b = ri(rng, lo, hi);
        return { clue: `$${a} \\times ${b}$`, answer: String(a * b) };
    }
    if (op === '÷') {
        const [lo, hi] = diff === 'Easy' ? [2, 12] : diff === 'Medium' ? [3, 20] : [6, 40];
        const b = ri(rng, lo, hi), ans = ri(rng, lo, hi);
        return { clue: `$${b * ans} \\div ${b}$`, answer: String(ans) };
    }
    if (op === 'bodmas') {
        // Order of operations — two forms for variety
        const form = ri(rng, 0, 1);
        if (form === 0) {
            // a + b × c  (must apply × before +)
            const a = ri(rng, 3, 25), b = ri(rng, 3, 15), c = ri(rng, 3, 15);
            return { clue: `$${a} + ${b} \\times ${c}$`, answer: String(a + b * c) };
        }
        // (a + b) × c  — shown with explicit parentheses so student sees the brackets
        const a = ri(rng, 2, 15), b = ri(rng, 2, 15), c = ri(rng, 3, 12);
        return { clue: `$(${a} + ${b}) \\times ${c}$`, answer: String((a + b) * c) };
    }
}

// ============================================================
// DECIMALS
// ============================================================
function genDecimals(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const a = ri(rng, 1, 9) / 10, b = ri(rng, 1, 9) / 10;
            return { clue: `$${a} + ${b}$`, answer: String(round(a + b, 2)) };
        }
        const a = ri(rng, 1, 9) / 10, b = ri(rng, 2, 9);
        return { clue: `$${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
            return { clue: `$${a} + ${b}$`, answer: String(round(a + b, 2)) };
        }
        if (type === 1) {
            const a = ri(rng, 20, 99) / 10, b = ri(rng, 1, Math.floor(a * 10) - 1) / 10;
            return { clue: `$${a} - ${round(b,1)}$`, answer: String(round(a - b, 2)) };
        }
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        return { clue: `$${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    // Hard
    const type = ri(rng, 0, 2);
    if (type === 0) {
        // Multiply two numbers with 2 dp — need to multiply 3dp carefully
        const a = ri(rng, 11, 99) / 10, b = ri(rng, 11, 99) / 10;
        return { clue: `$${a} \\times ${b}$`, answer: String(round(a * b, 2)) };
    }
    if (type === 1) {
        const a = ri(rng, 10, 99) / 10, b = ri(rng, 10, 99) / 10;
        const ans = round(a / b, 2);
        return { clue: `$${a} \\div ${b}$`, answer: String(ans) };
    }
    // type 2: subtract then round to 2dp
    const a = ri(rng, 100, 999) / 100, b = ri(rng, 100, Math.floor(a * 100) - 1) / 100;
    return { clue: `$${a} - ${b}$`, answer: String(round(a - b, 2)) };
}

// ============================================================
// ROUNDING
// ============================================================
function genRounding(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const n = ri(rng, 100, 9999);
            const ans = Math.round(n / 10) * 10;
            return { clue: `Round $${n}$ to the nearest $10$`, answer: String(ans) };
        }
        const n = ri(rng, 10, 999) / 10;
        return { clue: `Round $${n}$ to the nearest whole number`, answer: String(Math.round(n)) };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const n = ri(rng, 1000, 99999);
            const ans = Math.round(n / 100) * 100;
            return { clue: `Round $${n}$ to the nearest $100$`, answer: String(ans) };
        }
        if (type === 1) {
            // 2-dp input → round to 1dp (non-trivial)
            const n = ri(rng, 100, 9999) / 100;
            const display = n.toFixed(2);
            return { clue: `Round $${display}$ to 1 decimal place`, answer: String(round(n, 1)) };
        }
        // 3-dp input → round to 2dp (non-trivial)
        const n = ri(rng, 1000, 99999) / 1000;
        const display = n.toFixed(3);
        return { clue: `Round $${display}$ to 2 decimal places`, answer: String(round(n, 2)) };
    }
    // Hard
    const type = ri(rng, 0, 2);
    if (type === 0) {
        const n = ri(rng, 10000, 999999);
        const ans = Math.round(n / 1000) * 1000;
        return { clue: `Round $${n}$ to the nearest $1000$`, answer: String(ans) };
    }
    if (type === 1) {
        // Use a 4-dp number so rounding to 3dp is genuinely non-trivial
        const n = ri(rng, 10000, 999999) / 10000;
        const display = n.toFixed(4);
        return { clue: `Round $${display}$ to 3 decimal places`, answer: String(round(n, 3)) };
    }
    // significant figures — vary between 1 and 2 sig figs
    const sigFigs = rc(rng, [1, 2]);
    const n = sigFigs === 1 ? ri(rng, 100, 9999) : ri(rng, 1000, 99999);
    const factor = Math.pow(10, Math.floor(Math.log10(n)) - (sigFigs - 1));
    const ans = Math.round(n / factor) * factor;
    return { clue: `Round $${n}$ to ${sigFigs} significant figure${sigFigs > 1 ? 's' : ''}`, answer: String(ans) };
}

// ============================================================
// FRACTIONS — answers are always integers or simple decimals
// ============================================================
function genFractions(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            // Fraction of a whole number → integer answer
            const den = rc(rng, [2, 4, 5, 10]);
            const num = ri(rng, 1, den - 1);
            const whole = den * ri(rng, 2, 12);
            const ans = (num * whole) / den;
            return { clue: `$\\frac{${num}}{${den}}$ of $${whole}$`, answer: String(ans) };
        }
        if (type === 1) {
            // Add fractions with same denominator
            const den = rc(rng, [4, 5, 6, 8, 10]);
            const n1 = ri(rng, 1, den - 2), n2 = ri(rng, 1, den - n1);
            const ans = fracStr(n1 + n2, den);
            return { clue: `$\\frac{${n1}}{${den}} + \\frac{${n2}}{${den}}$`, answer: ans };
        }
        // Simplify fraction
        const den = rc(rng, [4, 6, 8, 10, 12]);
        const factor = rc(rng, [2, 3]);
        if (factor >= den) return genFractions(rng, diff);
        const num = factor * ri(rng, 1, Math.floor(den / factor));
        const ans = fracStr(num, den);
        return { clue: `Simplify $\\frac{${num}}{${den}}$`, answer: ans };
    }

    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            // Add fractions with different denominators
            const d1 = rc(rng, [2, 3, 4, 5]), d2 = rc(rng, [3, 4, 5, 6]);
            const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
            const l = lcm(d1, d2);
            const ans = fracStr(n1 * (l / d1) + n2 * (l / d2), l);
            return { clue: `$\\frac{${n1}}{${d1}} + \\frac{${n2}}{${d2}}$`, answer: ans };
        }
        if (type === 1) {
            // Multiply fractions — both operands must be proper (n < d)
            const d1 = ri(rng, 3, 7),  n1 = ri(rng, 1, d1 - 1);
            const d2 = ri(rng, 3, 7),  n2 = ri(rng, 1, d2 - 1);
            const ans = fracStr(n1 * n2, d1 * d2);
            return { clue: `$\\frac{${n1}}{${d1}} \\times \\frac{${n2}}{${d2}}$`, answer: ans };
        }
        // Fraction → decimal
        const den = rc(rng, [2, 4, 5, 8, 10, 20, 25]);
        const num = ri(rng, 1, den - 1);
        const ans = round(num / den, 4);
        return { clue: `Convert $\\frac{${num}}{${den}}$ to a decimal`, answer: String(ans) };
    }

    // Hard: two types for variety
    const type = ri(rng, 0, 1);
    if (type === 0) {
        // Divide fractions — both operands must be proper (n < d)
        const d1 = ri(rng, 3, 8),  n1 = ri(rng, 1, d1 - 1);
        const d2 = ri(rng, 3, 8),  n2 = ri(rng, 1, d2 - 1);
        const ans = fracStr(n1 * d2, d1 * n2);
        return { clue: `$\\frac{${n1}}{${d1}} \\div \\frac{${n2}}{${d2}}$`, answer: ans };
    }
    // Subtract fractions with unlike denominators — ensure positive result
    const d1 = rc(rng, [3, 4, 5, 6]), d2 = rc(rng, [3, 4, 5, 6]);
    if (d1 === d2) return genFractions(rng, diff);
    const n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
    const l = lcm(d1, d2);
    const numResult = n1 * (l / d1) - n2 * (l / d2);
    if (numResult <= 0) return genFractions(rng, diff);
    const ans = fracStr(numResult, l);
    return { clue: `$\\frac{${n1}}{${d1}} - \\frac{${n2}}{${d2}}$`, answer: ans };
}

// ============================================================
// PERCENTAGES
// ============================================================
function genPercentages(rng, diff) {
    if (diff === 'Easy') {
        const pct = rc(rng, [10, 20, 25, 50, 75]);
        // Ensure 'whole' is always an integer by using multiples of the denominator
        const denominators = { 10: 10, 20: 5, 25: 4, 50: 2, 75: 4 };
        const mult = denominators[pct] || 10;
        const whole = ri(rng, 1, 20) * mult;
        const ans = Math.round((pct / 100) * whole);
        return { clue: `$${pct}\\%$ of $${whole}$`, answer: String(ans), answerDisplay: String(ans) };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const pct = rc(rng, [5, 15, 30, 40, 60, 70, 80]);
            const candidates = [20, 40, 60, 80, 100, 120, 200, 250, 400, 500];
            for (let i = 0; i < 20; i++) {
                const whole = rc(rng, candidates);
                const ans = (pct / 100) * whole;
                if (Number.isInteger(ans)) return { clue: `$${pct}\\%$ of $${whole}$`, answer: String(ans) };
            }
        }
        if (type === 1) {
            const orig = ri(rng, 2, 20) * 10;
            const pct = rc(rng, [10, 20, 25, 50]);
            const ans = Math.round(orig * (1 + pct / 100));
            if (!Number.isInteger(ans)) return genPercentages(rng, diff);
            return { clue: `Increase $${orig}$ by $${pct}\\%$`, answer: String(ans) };
        }
        const b = rc(rng, [10, 20, 25, 50, 100]);
        const a = ri(rng, 1, b - 1);
        const ans = (a / b) * 100;
        if (!Number.isInteger(ans)) return genPercentages(rng, diff);
        return { clue: `$${a}$ out of $${b}$ as a percentage`, answer: String(ans), answerDisplay: `${ans}%` };
    }
    // Hard: reverse percentages, percentage change
    const type = ri(rng, 0, 2);
    if (type === 0) {
        // Reverse percentage: given the increased value, find original
        const orig = ri(rng, 5, 20) * 20;
        const pct = rc(rng, [10, 20, 25, 50]);
        const final = orig * (1 + pct / 100);
        return { clue: `After a $${pct}\\%$ increase the value is $${final}$. Find the original.`, answer: String(orig) };
    }
    if (type === 1) {
        // Percentage change: given original and new, find % change
        const orig = ri(rng, 4, 20) * 25;
        const pct = rc(rng, [10, 20, 25, 50]);
        const newVal = orig * (1 + pct / 100);
        return { clue: `A price rises from $\\$${orig}$ to $\\$${newVal}$. What is the percentage increase?`, answer: String(pct), answerDisplay: `${pct}%` };
    }
    // type 2: percentage of percentage
    const pct1 = rc(rng, [10, 20, 25, 50]);
    const whole = ri(rng, 4, 20) * 100;
    const partial = (pct1 / 100) * whole;
    const pct2 = rc(rng, [10, 20, 25, 50]);
    const ans2 = (pct2 / 100) * partial;
    if (!Number.isInteger(ans2)) return genPercentages(rng, diff);
    return { clue: `Find $${pct2}\\%$ of $${pct1}\\%$ of $${whole}$`, answer: String(ans2) };
}

// ============================================================
// ALGEBRA
// ============================================================
function genAlgebra(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const ans = ri(rng, 1, 20), a = ri(rng, 1, 20);
            return { clue: `Solve: $x + ${a} = ${ans + a}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        const a = ri(rng, 2, 12), ans = ri(rng, 2, 12);
        return { clue: `Solve: $${a}x = ${a * ans}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const a = ri(rng, 2, 6), ans = ri(rng, 1, 10), b = ri(rng, 1, 20);
            return { clue: `Solve: $${a}x + ${b} = ${a * ans + b}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        if (type === 1) {
            const a = ri(rng, 2, 6), ans = ri(rng, 2, 10), b = ri(rng, 1, 10);
            return { clue: `Solve: $${a}x - ${b} = ${a * ans - b}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
        }
        // Substitution: y = ax + b, find y when x = n
        const a = ri(rng, 2, 6), b = ri(rng, 1, 12), n = ri(rng, 1, 8);
        return { clue: `If $y = ${a}x + ${b}$, find $y$ when $x = ${n}$`, answer: String(a * n + b) };
    }
    // Hard
    const type = ri(rng, 0, 2);
    if (type === 0) {
        // Variables both sides
        const ans = ri(rng, 1, 10);
        const a = ri(rng, 3, 8), c = ri(rng, 1, a - 1), b = ri(rng, 1, 20);
        const d = (a - c) * ans + b;
        return { clue: `Solve: $${a}x + ${b} = ${c}x + ${d}$`, answer: String(ans), answerDisplay: `x = ${ans}` };
    }
    if (type === 1) {
        // Quadratic substitution: y = ax² + b
        const a = ri(rng, 1, 4), b = ri(rng, 1, 15), n = ri(rng, 2, 6);
        const coeff = a === 1 ? '' : String(a);
        const clue = `If $y = ${coeff}x^2 + ${b}$, find $y$ when $x = ${n}$`;
        return { clue, answer: String(a * n * n + b) };
    }
    // Solve ax + b = 0 → negative answer
    const a = ri(rng, 2, 5), bMult = ri(rng, 1, 8);
    const ans2 = -bMult;
    return { clue: `Solve: $${a}x + ${a * bMult} = 0$`, answer: String(ans2), answerDisplay: `x = ${ans2}` };
}

// ============================================================
// STATISTICS
// ============================================================
function genStatistics(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const n = ri(rng, 3, 5);
            const data = Array.from({ length: n }, () => ri(rng, 1, 20));
            const sum = data.reduce((a, b) => a + b, 0);
            if (sum % n !== 0) return genStatistics(rng, diff);
            return { clue: `Mean of $${data.join(', ')}$`, answer: String(sum / n) };
        }
        const n = (ri(rng, 2, 4) * 2) - 1; // odd count 3,5,7
        const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
        return { clue: `Median of $${data.join(', ')}$`, answer: String(data[Math.floor(n / 2)]) };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            const n = ri(rng, 4, 7);
            const data = Array.from({ length: n }, () => ri(rng, 1, 40));
            return { clue: `Range of $${data.join(', ')}$`, answer: String(Math.max(...data) - Math.min(...data)) };
        }
        if (type === 1) {
            const mode = ri(rng, 1, 15);
            const others = Array.from({ length: 4 }, () => {
                let v; do { v = ri(rng, 1, 20); } while (v === mode); return v;
            });
            const data = [...others, mode, mode].sort((a, b) => a - b);
            return { clue: `Mode of $${data.join(', ')}$`, answer: String(mode) };
        }
        const n = ri(rng, 4, 6);
        const data = Array.from({ length: n }, () => ri(rng, 5, 30));
        const sum = data.reduce((a, b) => a + b, 0);
        if (sum % n !== 0) return genStatistics(rng, diff);
        return { clue: `Mean of $${data.join(', ')}$`, answer: String(sum / n) };
    }
    // Hard: two types for variety
    const type = ri(rng, 0, 1);
    if (type === 0) {
        // Interquartile range of 8 values
        const data = Array.from({ length: 8 }, () => ri(rng, 1, 20)).sort((a, b) => a - b);
        const q1 = (data[1] + data[2]) / 2;
        const q3 = (data[5] + data[6]) / 2;
        const iqr = q3 - q1;
        if (!Number.isInteger(iqr)) return genStatistics(rng, diff);
        return { clue: `Find the interquartile range of $${data.join(', ')}$`, answer: String(iqr) };
    }
    // Median of an even-count dataset — middle two must sum to even for integer answer
    const n = rc(rng, [4, 6]);
    const data = Array.from({ length: n }, () => ri(rng, 1, 30)).sort((a, b) => a - b);
    const med = (data[n / 2 - 1] + data[n / 2]) / 2;
    if (!Number.isInteger(med)) return genStatistics(rng, diff);
    return { clue: `Find the median of $${data.join(', ')}$`, answer: String(med) };
}

// ============================================================
// FINANCIAL MATHS
// ============================================================
function genFinancial(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const P = ri(rng, 2, 20) * 100;
            const r = rc(rng, [5, 10]);
            const t = ri(rng, 1, 3);
            const I = P * r / 100 * t;
            return { clue: `Simple interest on $\\$${P}$ at $${r}\\%$ per year for $${t}$ year${t > 1 ? 's' : ''}`, answer: String(I), answerDisplay: `$${I}` };
        }
        const price = ri(rng, 5, 50) * 10;
        return { clue: `Price with $10\\%$ GST added to $\\$${price}$`, answer: String(price * 1.1), answerDisplay: `$${price * 1.1}` };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            const cost = ri(rng, 5, 20) * 10;
            const pctProfit = rc(rng, [10, 20, 25, 50]);
            const sell = cost * (1 + pctProfit / 100);
            if (!Number.isInteger(sell)) return genFinancial(rng, diff);
            return { clue: `Selling price: cost $\\$${cost}$, mark-up $${pctProfit}\\%$`, answer: String(sell), answerDisplay: `$${sell}` };
        }
        const P = ri(rng, 2, 10) * 1000, r = rc(rng, [5, 10]), t = ri(rng, 1, 3);
        const I = P * r / 100 * t;
        return { clue: `Simple interest on $\\$${P}$ at $${r}\\%$ per year for $${t}$ years`, answer: String(I), answerDisplay: `$${I}` };
    }
    // Hard: compound interest (2-4 years) or finding simple interest rate
    const type = ri(rng, 0, 1);
    if (type === 0) {
        const P = ri(rng, 2, 8) * 1000, r = rc(rng, [5, 10]), t = ri(rng, 2, 4);
        const A = round(P * Math.pow(1 + r / 100, t), 2);
        if (!Number.isInteger(A)) {
            // try alternate
            const P2 = ri(rng, 1, 5) * 2000, r2 = 10, t2 = ri(rng, 2, 3);
            const A2 = round(P2 * Math.pow(1 + r2 / 100, t2), 2);
            return { clue: `Compound interest: $\\$${P2}$ at $${r2}\\%$ per year for $${t2}$ years. What is the total amount?`, answer: String(A2), answerDisplay: `$${A2}` };
        }
        return { clue: `Compound interest: $\\$${P}$ at $${r}\\%$ per year for $${t}$ years. What is the total amount?`, answer: String(A), answerDisplay: `$${A}` };
    }
    // type 1: find the percentage profit — choose pct first so result is always a whole number
    const cost = ri(rng, 2, 15) * 100;
    const pct  = rc(rng, [5, 10, 20, 25, 50]);
    const sell = cost + cost * pct / 100;
    return { clue: `Cost price $\\$${cost}$, selling price $\\$${sell}$. Find the percentage profit.`, answer: String(pct), answerDisplay: `${pct}%` };
}

// ============================================================
// GEOMETRY
// ============================================================
function genGeometry(rng, diff) {
    if (diff === 'Easy') {
        const type = ri(rng, 0, 1);
        if (type === 0) {
            // Area of rectangle
            const l = ri(rng, 2, 15), w = ri(rng, 2, 12);
            return { clue: `Area of rectangle: length $${l}$, width $${w}$`, answer: String(l * w), answerDisplay: `${l * w} units²` };
        }
        // Perimeter of rectangle
        const l = ri(rng, 3, 15), w = ri(rng, 2, l);
        return { clue: `Perimeter of rectangle: length $${l}$, width $${w}$`, answer: String(2 * (l + w)), answerDisplay: `${2 * (l + w)} units` };
    }
    if (diff === 'Medium') {
        const type = ri(rng, 0, 2);
        if (type === 0) {
            // Area of triangle — even base ensures integer answer
            const b = ri(rng, 2, 12) * 2;
            const h = ri(rng, 3, 15);
            const ans = (b * h) / 2;
            return { clue: `Area of triangle: base $${b}$, height $${h}$`, answer: String(ans), answerDisplay: `${ans} units²` };
        }
        if (type === 1) {
            // Pythagoras — find hypotenuse using scaled common triples
            const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]];
            const [a, b, c] = rc(rng, triples);
            const scale = ri(rng, 1, 3);
            return { clue: `Right triangle with legs $${a * scale}$ and $${b * scale}$. Find the hypotenuse.`, answer: String(c * scale), answerDisplay: `${c * scale} units` };
        }
        // Missing angle in triangle — angles sum to 180°
        const angles = [30, 40, 45, 50, 60, 70, 80, 90];
        const a1 = rc(rng, angles);
        const remaining = angles.filter(a => a < 180 - a1 && a !== a1);
        if (remaining.length === 0) return genGeometry(rng, diff);
        const a2 = rc(rng, remaining);
        const a3 = 180 - a1 - a2;
        return { clue: `A triangle has angles $${a1}°$ and $${a2}°$. Find the third angle.`, answer: String(a3), answerDisplay: `${a3}°` };
    }
    // Hard
    const type = ri(rng, 0, 2);
    if (type === 0) {
        // Area of circle (π ≈ 3.14)
        const r = ri(rng, 2, 10);
        const ans = round(3.14 * r * r, 2);
        return { clue: `Area of circle, radius $${r}$ (use $\\pi \\approx 3.14$)`, answer: String(ans), answerDisplay: `${ans} units²` };
    }
    if (type === 1) {
        // Find a leg using Pythagoras — give hypotenuse and one leg
        const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17]];
        const [a, b, c] = rc(rng, triples);
        const scale = ri(rng, 1, 3);
        return { clue: `Right triangle: hypotenuse $${c * scale}$, one leg $${a * scale}$. Find the other leg.`, answer: String(b * scale), answerDisplay: `${b * scale} units` };
    }
    // Circumference of circle (C = 2πr, π ≈ 3.14)
    const r = ri(rng, 2, 15);
    const ans = round(2 * 3.14 * r, 2);
    return { clue: `Circumference of circle, radius $${r}$ (use $\\pi \\approx 3.14$)`, answer: String(ans), answerDisplay: `${ans} units` };
}

// ============================================================
// DISPATCH table
// ============================================================
const GENERATORS = {
    'Integers':       genIntegers,
    'Decimals':       genDecimals,
    'Rounding':       genRounding,
    'Fractions':      genFractions,
    'Percentages':    genPercentages,
    'Algebra':        genAlgebra,
    'Geometry':       genGeometry,
    'Statistics':     genStatistics,
    'Financial Maths': genFinancial,
};

// Map generator sub-topic → clue bank topic field
const TOPIC_MAP = {
    'Integers':       'Number',
    'Decimals':       'Number',
    'Rounding':       'Number',
    'Fractions':      'Number',
    'Percentages':    'Number',
    'Algebra':        'Algebra',
    'Geometry':       'Geometry',
    'Statistics':     'Statistics',
    'Financial Maths': 'Financial Maths',
};

const ALL_SUBTOPICS = Object.keys(GENERATORS);

/**
 * Generate maths questions.
 * @param {object} opts
 * @param {string}  opts.subTopic   - 'All' | any key of GENERATORS
 * @param {string}  opts.difficulty - 'All' | 'Easy' | 'Medium' | 'Hard'
 * @param {number}  opts.count      - number of questions to generate
 * @param {number}  [opts.seed]     - optional seed (uses Date.now() if omitted)
 * @returns {Array} clue bank items
 */
export function generateMathsQuestions({ subTopic = 'All', subTopics = null, difficulty = 'All', count = 10, seed } = {}) {
    const rng = mulberry32(seed != null ? seed : Date.now());

    // subTopics array takes priority over subTopic string
    let subtopics;
    if (subTopics && subTopics.length > 0) {
        subtopics = subTopics.filter(t => GENERATORS[t]);
        if (subtopics.length === 0) subtopics = ALL_SUBTOPICS;
    } else {
        subtopics = subTopic === 'All' ? ALL_SUBTOPICS : [subTopic];
    }
    const diffs      = difficulty === 'All' ? ['Easy', 'Medium', 'Hard'] : [difficulty];

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
    let attempts  = 0;
    const maxAttempts = count * 20;

    while (results.length < count && attempts < maxAttempts) {
        attempts++;
        // Use the pre-planned topic for this slot; fall back to random if exhausted
        const st   = topicPlan[results.length] ?? rc(rng, subtopics);
        const diff = rc(rng, diffs);
        const gen  = GENERATORS[st];
        if (!gen) continue;

        let q;
        try { q = gen(rng, diff); } catch (_) { continue; }
        if (!q) continue;

        const ans = String(q.answer);
        // Skip if answer is too long (won't fit in grid) or contains invalid chars
        if (!ans || ans.length > 10) continue;

        results.push({
            id:            'gen_' + results.length + '_' + (seed || Date.now()),
            topic:         TOPIC_MAP[st] || 'Number',
            difficulty:    diff,
            clue:          q.clue || '',
            answer:        ans,
            answerDisplay: q.answerDisplay || ans,
            notes:         st,    // store sub-topic in notes for reference
        });
    }

    return results;
}

export { ALL_SUBTOPICS };
