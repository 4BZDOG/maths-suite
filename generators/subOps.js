// ============================================================
// SUB_OPS metadata — the selectable sub-operations of each topic.
//
// Each entry: { key, label, group?, stages?, pathway? }
//   key     - stable id persisted in localStorage / exported .json configs
//             and consumed by the generators. NEVER rename a key.
//   label   - text shown in the sidebar (safe to reword).
//   group   - optional sub-heading shown in the sidebar panel. Members of a
//             group must be contiguous within their topic's list.
//   stages  - which stages include this op (default: both)
//   pathway - 'path' means Stage 5.3 Path only; omit for core
//
// ORDER IS MEANINGFUL: within each topic, ops follow the NSW NESA Mathematics
// K-10 teaching sequence — foundational → advanced, Stage 4 before Stage 5,
// 5.1 → 5.2 core content before the 5.3 Path ops (which the sidebar renders
// under their own divider). Topic (object-key) order is unchanged; the
// generator's ALL_SUBTOPICS comes from its own GENERATORS table.
//
// Note: generateMathsQuestions() hands each generator the stage-permitted keys
// in this order, and Algebra builds its pick pool from that list. Reordering
// therefore changes which question a given seed yields for Algebra only (see
// test/subops.test.mjs, which pins correctness rather than seed output).
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
        { key: 'sci-notation',     label: 'Scientific notation',  stages: ['Stage 5'] },
        { key: 'measurement-error', label: 'Measurement error / limits', stages: ['Stage 5'] },
    ],
    'Fractions': [
        { key: 'simplify-convert', label: 'Simplify / Convert' },
        { key: 'fraction-of',     label: 'Fraction of amount' },
        { key: 'add-subtract',    label: 'Add / Subtract' },
        { key: 'multiply-divide', label: 'Multiply / Divide' },
    ],
    'Percentages': [
        { key: 'find-pct',        label: 'Find percentage' },
        { key: 'increase-decrease', label: 'Increase / Decrease' },
        { key: 'reverse-change',  label: 'Reverse / % change' },
    ],
    'Algebra': [
        { key: 'word-expression', label: 'Expression from words',  group: 'Forming and evaluating' },
        { key: 'substitution',    label: 'Substitution',           group: 'Forming and evaluating' },
        { key: 'like-terms',      label: 'Add / subtract like terms', group: 'Simplifying' },
        { key: 'indices-laws',    label: 'Index laws',             group: 'Simplifying', stages: ['Stage 5'] },
        { key: 'expand-simplify', label: 'Expand and simplify',    group: 'Expanding' },
        { key: 'expand',          label: 'Expand expressions',     group: 'Expanding', stages: ['Stage 5'] },
        { key: 'factorise-hcf',   label: 'Factorise (HCF)',        group: 'Factorising' },
        { key: 'factorise-bracket', label: 'Factorise (common bracket)', group: 'Factorising', stages: ['Stage 5'] },
        { key: 'factorise-grouping', label: 'Factorise (grouping)', group: 'Factorising', stages: ['Stage 5'] },
        { key: 'factorise',       label: 'Factorise (monic quadratics)', group: 'Factorising', stages: ['Stage 5'] },
        { key: 'factorise-nonmonic', label: 'Factorise (non-monic)', group: 'Factorising', stages: ['Stage 5'] },
        { key: 'alg-fractions',   label: 'Algebraic fractions',    group: 'Algebraic fractions', stages: ['Stage 5'] },
        { key: 'solve',           label: 'Solve equations',        group: 'Equations' },
        { key: 'quadratic-solve', label: 'Solve quadratics',       group: 'Equations', stages: ['Stage 5'] },
        // Stage 5 Path
        { key: 'simultaneous',   label: 'Simultaneous equations', group: 'Equations', stages: ['Stage 5'], pathway: 'path' },
        { key: 'surds-simplify', label: 'Simplify surds',         group: 'Surds', stages: ['Stage 5'], pathway: 'path' },
        { key: 'surds-operate',  label: 'Add / Multiply surds',   group: 'Surds', stages: ['Stage 5'], pathway: 'path' },
    ],
    'Geometry': [
        { key: 'angles',            label: 'Angles' },
        { key: 'area-perimeter',    label: 'Area / Perimeter' },
        { key: 'circles',           label: 'Circles' },
        { key: 'pythagoras',        label: 'Pythagoras' },
        { key: 'surface-area',      label: 'Surface area' },
        { key: 'composite-volume',  label: 'Composite volume',       stages: ['Stage 5'] },
        { key: 'similar-triangles', label: 'Similar triangles',      stages: ['Stage 5'] },
    ],
    'Statistics': [
        { key: 'mode-range',  label: 'Mode / Range',        group: 'Centre and display' },
        { key: 'mean-median', label: 'Mean / Median',       group: 'Centre and display' },
        { key: 'stem-leaf',   label: 'Stem-and-leaf plot',  group: 'Centre and display' },
        { key: 'iqr',         label: 'Interquartile range', group: 'Spread and quartiles' },
        // Stage 5
        { key: 'five-number-summary', label: 'Five-number summary', group: 'Spread and quartiles', stages: ['Stage 5'] },
        { key: 'box-plot',            label: 'Box plots / outliers', group: 'Spread and quartiles', stages: ['Stage 5'] },
        { key: 'std-dev',             label: 'Standard deviation',  group: 'Spread and quartiles', stages: ['Stage 5'] },
        { key: 'bivariate',           label: 'Bivariate data',      group: 'Bivariate data', stages: ['Stage 5'] },
    ],
    'Financial Maths': [
        { key: 'markup-profit',     label: 'Markup / Discount / Profit', group: 'Buying and selling' },
        { key: 'gst',               label: 'GST',                        group: 'Buying and selling' },
        { key: 'wages',           label: 'Wages / overtime / loading', group: 'Earning', stages: ['Stage 5'] },
        { key: 'commission',      label: 'Commission / PAYG tax',      group: 'Earning', stages: ['Stage 5'] },
        { key: 'simple-interest',   label: 'Simple interest',          group: 'Interest' },
        { key: 'compound-interest', label: 'Compound interest',        group: 'Interest' },
        { key: 'compound-period', label: 'Compound (periods)',         group: 'Interest', stages: ['Stage 5'] },
        { key: 'depreciation',    label: 'Depreciation',               group: 'Depreciation and loans', stages: ['Stage 5'] },
        { key: 'term-payments',   label: 'Term payments',              group: 'Depreciation and loans', stages: ['Stage 5'] },
    ],
    // Right-Angled Triangles — trig intro (Stage 4) extending to applications
    // (angles of elevation/depression) and non-right triangles (Stage 5 Path)
    'Trigonometry': [
        { key: 'find-side',    label: 'Find a side (SOHCAHTOA)', group: 'Right-angled triangles' },
        { key: 'find-angle',   label: 'Find an angle',           group: 'Right-angled triangles' },
        { key: 'applications', label: 'Elevation / depression',  group: 'Right-angled triangles', stages: ['Stage 5'] },
        { key: 'exact-values', label: 'Exact values',            group: 'Right-angled triangles', stages: ['Stage 5'] },
        { key: 'sine-rule',    label: 'Sine rule',               group: 'Non-right-angled triangles', stages: ['Stage 5'] },
        { key: 'cosine-rule',  label: 'Cosine rule',             group: 'Non-right-angled triangles', stages: ['Stage 5'] },
        { key: 'area-rule',    label: 'Area (½ab sinC)',         group: 'Non-right-angled triangles', stages: ['Stage 5'] },
        // Path
        { key: 'bearings',      label: 'Bearings (true)',   group: 'Applications', stages: ['Stage 5'], pathway: 'path' },
        { key: 'trig-3d',       label: '3D trigonometry',   group: 'Applications', stages: ['Stage 5'], pathway: 'path' },
        { key: 'obtuse-angles', label: 'Obtuse angles',     group: 'Trigonometric functions', stages: ['Stage 5'], pathway: 'path' },
        { key: 'trig-equations', label: 'Trig equations',   group: 'Trigonometric functions', stages: ['Stage 5'], pathway: 'path' },
    ],
    'Non-linear Relationships': [
        { key: 'parabola-features', label: 'Parabola: features',    stages: ['Stage 5'] },
        // Path
        { key: 'identify-graph',    label: 'Identify graph type',   stages: ['Stage 5'], pathway: 'path' },
        { key: 'parabola-sketch',   label: 'Parabola: sketch',      stages: ['Stage 5'], pathway: 'path' },
    ],
    'Probability': [
        { key: 'theoretical',   label: 'Theoretical probability' },
        { key: 'experimental',  label: 'Experimental / relative frequency' },
        { key: 'complementary', label: 'Complementary events' },
        { key: 'multi-event',   label: 'Multi-event / Mutually exclusive' },
        { key: 'venn',          label: 'Venn diagrams',           stages: ['Stage 5'] },
        { key: 'two-way',       label: 'Two-way tables',          stages: ['Stage 5'] },
        { key: 'conditional',   label: 'Conditional probability', stages: ['Stage 5'] },
    ],
    'Ratios & Rates': [
        { key: 'simplify',     label: 'Simplify a ratio',            group: 'Ratios' },
        { key: 'equivalent',   label: 'Equivalent ratios',           group: 'Ratios' },
        { key: 'unit-ratio',   label: 'Ratios with unit conversion', group: 'Ratios' },
        { key: 'divide-ratio', label: 'Divide in a ratio',           group: 'Ratios' },
        { key: 'unit-rate',    label: 'Unit rate',                   group: 'Rates' },
        { key: 'speed',        label: 'Speed / Distance / Time',     group: 'Rates' },
    ],
    // ─── 2022-syllabus focus areas added as standalone topics ───────────
    // These mirror the NESA Mathematics K-10 (2022) focus areas that aren't
    // discoverable inside the Algebra / Geometry umbrellas. Existing users
    // who already had Algebra/Geometry selected keep those — the new topics
    // are purely additive.
    'Indices': [
        { key: 'divisibility',     label: 'Divisibility tests',           group: 'Factors and primes' },
        { key: 'primes',           label: 'Primes / prime factorisation', group: 'Factors and primes' },
        { key: 'hcf-lcm',          label: 'HCF and LCM',                  group: 'Factors and primes' },
        { key: 'indices-evaluate', label: 'Evaluate a power',             group: 'Index notation and laws' },
        { key: 'indices-multiply', label: 'Multiply (same base)',         group: 'Index notation and laws' },
        { key: 'indices-divide',   label: 'Divide (same base)',           group: 'Index notation and laws' },
        { key: 'indices-power',    label: 'Power of a power',             group: 'Index notation and laws' },
        { key: 'indices-zero',     label: 'Zero index',       group: 'Extended indices', stages: ['Stage 5'] },
        { key: 'indices-negative', label: 'Negative index',   group: 'Extended indices', stages: ['Stage 5'] },
        { key: 'indices-fraction', label: 'Fractional index', group: 'Extended indices', stages: ['Stage 5'] },
    ],
    'Algebraic Indices': [
        { key: 'alg-multiply',     label: 'Multiply (same base)' },
        { key: 'alg-divide',       label: 'Divide (same base)' },
        { key: 'alg-power',        label: 'Power of a power' },
        { key: 'alg-coefficients', label: 'With coefficients' },
        { key: 'alg-zero',         label: 'Zero index',     stages: ['Stage 5'] },
        { key: 'alg-negative',     label: 'Negative index', stages: ['Stage 5'] },
        { key: 'alg-fraction',     label: 'Fractional index', stages: ['Stage 5'] },
    ],
    'Equations': [
        { key: 'one-step',     label: 'One-step',                group: 'Linear equations' },
        { key: 'two-step',     label: 'Two-step',                group: 'Linear equations' },
        { key: 'brackets',     label: 'With brackets',           group: 'Linear equations' },
        { key: 'both-sides',   label: 'Variables on both sides', group: 'Linear equations' },
        { key: 'fractions',    label: 'With fractions',          group: 'Linear equations' },
        { key: 'substitution', label: 'With substitution',       group: 'Linear equations' },
        // Stage 5: Equations and Inequalities
        { key: 'inequalities', label: 'Linear inequalities',     group: 'Inequalities', stages: ['Stage 5'] },
        { key: 'simultaneous', label: 'Simultaneous equations',  group: 'Simultaneous equations', stages: ['Stage 5'] },
        { key: 'quadratic-square', label: 'Solve x² = a',        group: 'Quadratic equations' },
        { key: 'complete-square', label: 'Completing the square', group: 'Quadratic equations', stages: ['Stage 5'] },
        { key: 'quad-formula',    label: 'Quadratic formula',     group: 'Quadratic equations', stages: ['Stage 5'] },
        { key: 'simultaneous-nonlinear', label: 'Simultaneous (line & curve)', group: 'Line and curve', stages: ['Stage 5'] },
    ],
    'Linear Relationships': [
        { key: 'pattern-rule',      label: 'Number pattern rule',        group: 'Graphing lines' },
        { key: 'plot-line',         label: 'Plot points on y = mx + c',  group: 'Graphing lines' },
        { key: 'intercepts',        label: 'Find intercepts',            group: 'Graphing lines' },
        { key: 'gradient-two-points', label: 'Gradient from two points', group: 'Coordinate geometry' },
        { key: 'midpoint',          label: 'Midpoint of two points',     group: 'Coordinate geometry' },
        { key: 'distance',          label: 'Distance between points',    group: 'Coordinate geometry', stages: ['Stage 5'] },
        { key: 'equation-from-gp',  label: 'Equation from gradient + point', group: 'Equations of lines', stages: ['Stage 5'] },
        { key: 'general-form',      label: 'General form & intercepts',  group: 'Equations of lines', stages: ['Stage 5'] },
        { key: 'parallel-perp',     label: 'Parallel / perpendicular lines', group: 'Equations of lines', stages: ['Stage 5'] },
    ],
    'Properties of Geometrical Figures': [
        { key: 'angles',            label: 'Angle relationships' },
        { key: 'quad-properties',   label: 'Quadrilateral properties', stages: ['Stage 5'] },
        { key: 'congruent-tests',   label: 'Congruence tests',   stages: ['Stage 5'] },
        { key: 'similar-ratio',     label: 'Similarity scale factor', stages: ['Stage 5'] },
    ],
    'Variation & Rates of Change': [
        { key: 'direct-variation',   label: 'Direct variation  y = kx', stages: ['Stage 5'] },
        { key: 'inverse-variation',  label: 'Inverse variation  y = k/x', stages: ['Stage 5'] },
    ],
    // ─── Measurement & Space focus areas (NESA structure) ───────────────
    'Length': [
        { key: 'unit-convert',  label: 'Unit conversion' },
        { key: 'perimeter',     label: 'Perimeter' },
        { key: 'circumference', label: 'Circumference' },
    ],
    'Area': [
        { key: 'area-perimeter', label: 'Area of plane shapes' },
        { key: 'circles',        label: 'Area of circles' },
        { key: 'surface-area',   label: 'Surface area', stages: ['Stage 5'] },
    ],
    'Volume': [
        { key: 'prism',    label: 'Prisms' },
        { key: 'capacity', label: 'Volume / Capacity' },
        { key: 'cylinder', label: 'Cylinders' },
        { key: 'pyramid',  label: 'Pyramids',         stages: ['Stage 5'] },
        { key: 'cone',     label: 'Cones',            stages: ['Stage 5'] },
        { key: 'sphere',   label: 'Spheres',          stages: ['Stage 5'] },
    ],
    'Time': [
        { key: 'convert',  label: '24-hour time' },
        { key: 'duration', label: 'Elapsed time' },
        { key: 'zones',    label: 'Time zones' },
    ],
    "Pythagoras' Theorem": [
        { key: 'identify',    label: 'Identify & define the theorem' },
        { key: 'hypotenuse',  label: 'Finding the Hypotenuse' },
        { key: 'short-side',  label: 'Finding a short side' },
        { key: 'triads',      label: 'Prove Pythagorean triads' },
    ],
    // ─── Statistics & Probability focus areas (NESA structure) ──────────
    'Data Classification and Visualisation': [
        { key: 'data-type',       label: 'Categorical / numerical' },
        { key: 'tally',           label: 'Tally charts' },
        { key: 'frequency-total', label: 'Frequency tables' },
        { key: 'dot-plot-read',   label: 'Read a dot plot' },
        { key: 'graph-choice',    label: 'Choosing a display' },
    ],
    // ─── Stage 5 Path new topics (all pathway:'path') ──────────────────
    'Networks': [
        { key: 'degree-sum',  label: 'Degree / edges',   stages: ['Stage 5'], pathway: 'path' },
        { key: 'euler-trail', label: 'Eulerian trails',  stages: ['Stage 5'], pathway: 'path' },
        { key: 'euler',       label: "Euler's formula",  stages: ['Stage 5'], pathway: 'path' },
    ],
    'Polynomials': [
        { key: 'degree',         label: 'Degree / coefficients', stages: ['Stage 5'], pathway: 'path' },
        { key: 'remainder',      label: 'Remainder theorem',     stages: ['Stage 5'], pathway: 'path' },
        { key: 'factor-theorem', label: 'Factor theorem',        stages: ['Stage 5'], pathway: 'path' },
    ],
    'Logarithms': [
        { key: 'evaluate', label: 'Evaluate logarithms', stages: ['Stage 5'], pathway: 'path' },
        { key: 'laws',     label: 'Logarithm laws',      stages: ['Stage 5'], pathway: 'path' },
        { key: 'solve',    label: 'Solve log / index equations', stages: ['Stage 5'], pathway: 'path' },
    ],
    'Functions': [
        { key: 'evaluate',     label: 'Function notation',   stages: ['Stage 5'], pathway: 'path' },
        { key: 'domain-range', label: 'Domain & range',      stages: ['Stage 5'], pathway: 'path' },
        { key: 'hyperbola',    label: 'Hyperbola asymptotes', stages: ['Stage 5'], pathway: 'path' },
        { key: 'circle',       label: 'Circle (complete square)', stages: ['Stage 5'], pathway: 'path' },
    ],
};

/** True when `op` is offered for the given stage / Path setting. */
export function isSubOpActive(op, stage, includePath) {
    return (!op.stages || op.stages.includes(stage)) &&
           (op.pathway !== 'path' || !!includePath);
}

/** The ops of `topic` available for the stage / Path setting, in teaching order. */
export function activeSubOps(topic, stage, includePath) {
    return (SUB_OPS[topic] || []).filter(op => isSubOpActive(op, stage, includePath));
}

/**
 * Split an ordered op list into consecutive runs sharing a `group`.
 * Returns [{ group: string|null, ops: [...] }]. Ungrouped ops form
 * `group: null` runs, so a topic with no group metadata yields one run.
 */
export function groupSubOps(ops) {
    const runs = [];
    for (const op of ops) {
        const g = op.group || null;
        const last = runs[runs.length - 1];
        if (last && last.group === g) last.ops.push(op);
        else runs.push({ group: g, ops: [op] });
    }
    return runs;
}
