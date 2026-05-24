// =============================================================
// core/outcomes.js — NESA syllabus outcome data
//
// Structure is stage-keyed throughout so Stage 5, Early Stage 1,
// etc. can be added without touching existing Stage 4 data.
// =============================================================

// TODO: Verify Stage 5 outcome codes, labels and statements against
//       the current NESA Mathematics K–10 Syllabus PDF before release.
//       Codes follow the MA5-XXX-C-NN naming convention and are based
//       on the 2022 NESA syllabus structure but have not been formally
//       cross-checked against every sub-strand boundary.

export const DEFAULT_STAGE = 'Stage 4';

// ---- Strand organisation (NESA K–10 Mathematics) ------------
export const STRANDS = [
    'Number & Algebra',
    'Measurement & Space',
    'Statistics & Probability',
];

export const TOPIC_STRAND_MAP = {
    'Integers':                 'Number & Algebra',
    'Decimals':                 'Number & Algebra',
    'Rounding':                 'Number & Algebra',
    'Fractions':                'Number & Algebra',
    'Percentages':              'Number & Algebra',
    'Ratios & Rates':           'Number & Algebra',
    'Algebra':                  'Number & Algebra',
    'Financial Maths':          'Number & Algebra',
    'Non-linear Relationships': 'Number & Algebra',
    'Geometry':                 'Measurement & Space',
    'Trigonometry':             'Measurement & Space',
    'Statistics':               'Statistics & Probability',
    'Probability':              'Statistics & Probability',
};

// ---- Topics available per stage ----
export const STAGE_TOPICS = {
    'Stage 4': [
        'Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages',
        'Ratios & Rates', 'Algebra', 'Geometry', 'Statistics',
        'Probability', 'Financial Maths',
    ],
    'Stage 5': [
        'Integers', 'Decimals', 'Rounding', 'Fractions', 'Percentages',
        'Ratios & Rates', 'Algebra', 'Geometry', 'Statistics',
        'Probability', 'Financial Maths',
        'Trigonometry', 'Non-linear Relationships',
    ],
};

// ---- Full outcome definitions per stage ---------------------
export const STAGE_OUTCOMES = {
    'Stage 4': {
        label: 'Stage 4',
        years: 'Year 7–8',
        outcomes: [
            {
                code: 'MAO-WM-01',
                contentLabel: 'Working mathematically',
                statement: 'develops understanding and fluency in mathematics through exploring and connecting mathematical concepts, choosing and applying mathematical techniques to solve problems, and communicating their thinking and reasoning coherently and clearly',
                appliesAll: true,
            },
            {
                code: 'MA4-INT-C-01',
                contentLabel: 'Computation with integers',
                statement: 'compares, orders and calculates with integers to solve problems',
            },
            {
                code: 'MA4-FRC-C-01',
                contentLabel: 'Fractions, decimals and percentages',
                statement: 'represents and operates with fractions, decimals and percentages to solve problems',
            },
            {
                code: 'MA4-ALG-C-01',
                contentLabel: 'Algebraic techniques',
                statement: 'generalises number properties to operate with algebraic expressions including expansion and factorisation',
            },
            {
                code: 'MA4-EQU-C-01',
                contentLabel: 'Equations',
                statement: 'solves linear equations of up to 2 steps and quadratic equations of the form ax² = c',
            },
            {
                code: 'MA4-LIN-C-01',
                contentLabel: 'Linear relationships',
                statement: 'creates and displays number patterns and finds graphical solutions to problems involving linear relationships',
            },
            {
                code: 'MA4-ARE-C-01',
                contentLabel: 'Area',
                statement: 'applies knowledge of area and composite area involving triangles, quadrilaterals and circles to solve problems',
            },
            {
                code: 'MA4-GEO-C-01',
                contentLabel: 'Properties of geometrical figures',
                statement: 'identifies and applies the properties of triangles and quadrilaterals to solve problems',
            },
            {
                code: 'MA4-ANG-C-01',
                contentLabel: 'Angle relationships',
                statement: 'applies angle relationships to solve problems, including those related to transversals on sets of parallel lines',
            },
            {
                code: 'MA4-PYT-C-01',
                contentLabel: "Right-angled triangles (Pythagoras' theorem)",
                statement: "applies Pythagoras' theorem to solve problems in various contexts",
            },
            {
                code: 'MA4-LEN-C-01',
                contentLabel: 'Length',
                statement: 'applies knowledge of the perimeter of plane shapes and the circumference of circles to solve problems',
            },
            {
                code: 'MA4-VOL-C-01',
                contentLabel: 'Volume',
                statement: 'applies knowledge of volume and capacity to solve problems involving right prisms and cylinders',
            },
            {
                code: 'MA4-DAT-C-01',
                contentLabel: 'Data classification and visualisation',
                statement: 'classifies and displays data using a variety of graphical representations',
            },
            {
                code: 'MA4-DAT-C-02',
                contentLabel: 'Data analysis',
                statement: 'analyses simple datasets using measures of centre, range and shape of the data',
            },
            {
                code: 'MA4-RAT-C-01',
                contentLabel: 'Ratios and rates',
                statement: 'solves problems involving ratios and rates, and analyses distance–time graphs',
            },
            {
                code: 'MA4-PRO-C-01',
                contentLabel: 'Probability',
                statement: 'solves problems involving the probabilities of simple chance experiments',
            },
            {
                code: 'MA4-IND-C-01',
                contentLabel: 'Indices',
                statement: 'operates with primes and roots, positive-integer and zero indices involving numerical bases and establishes the relevant index laws',
            },
        ],
    },

    'Stage 5': {
        label: 'Stage 5',
        years: 'Year 9–10',
        outcomes: [
            {
                code: 'MAO-WM-01',
                contentLabel: 'Working mathematically',
                statement: 'develops understanding and fluency in mathematics through exploring and connecting mathematical concepts, choosing and applying mathematical techniques to solve problems, and communicating their thinking and reasoning coherently and clearly',
                appliesAll: true,
            },
            {
                code: 'MA5-IND-C-01',
                contentLabel: 'Indices',
                statement: 'applies index laws to evaluate and simplify expressions involving integer and zero indices',
            },
            {
                code: 'MA5-FRC-C-01',
                contentLabel: 'Fractions, decimals and percentages',
                statement: 'operates with fractions, decimals, percentages and rates in a variety of contexts including multi-step problems',
            },
            {
                code: 'MA5-ALG-C-01',
                contentLabel: 'Algebraic techniques',
                statement: 'applies the distributive law and expands and factorises algebraic expressions including quadratic trinomials',
            },
            {
                code: 'MA5-EQU-C-01',
                contentLabel: 'Equations',
                statement: 'solves linear equations and pairs of simultaneous equations, and quadratic equations using a variety of methods',
            },
            {
                code: 'MA5-LIN-C-01',
                contentLabel: 'Linear relationships',
                statement: 'determines the gradient and equation of a line and graphs linear relationships on the Cartesian plane',
            },
            {
                code: 'MA5-NLR-C-01',
                contentLabel: 'Non-linear relationships',
                statement: 'graphs and interprets parabolas, exponential functions and circles on the Cartesian plane',
            },
            {
                code: 'MA5-FIN-C-01',
                contentLabel: 'Financial mathematics',
                statement: 'solves problems involving compound interest, depreciation and successive discounts or markups',
            },
            {
                code: 'MA5-TRG-C-01',
                contentLabel: 'Right-angled trigonometry',
                statement: 'applies trigonometric ratios to find sides and angles in right-angled triangles and solves related problems',
            },
            {
                code: 'MA5-GEO-C-01',
                contentLabel: 'Properties of geometrical figures',
                statement: 'proves and applies relationships in triangles and quadrilaterals using similarity and congruence',
            },
            {
                code: 'MA5-ARE-C-01',
                contentLabel: 'Area and surface area',
                statement: 'calculates the area of composite shapes and surface area of prisms, cylinders and composite solids',
            },
            {
                code: 'MA5-VOL-C-01',
                contentLabel: 'Volume',
                statement: 'calculates the volume of composite solids including prisms, cylinders and pyramids',
            },
            {
                code: 'MA5-DAT-C-01',
                contentLabel: 'Data analysis',
                statement: 'analyses and evaluates statistical datasets using measures of spread and displays data using appropriate graphical representations',
            },
            {
                code: 'MA5-PRO-C-01',
                contentLabel: 'Probability',
                statement: 'calculates the probability of compound and complementary events using various representations',
            },
            // 5.3 Path outcomes — only shown when "Include Path content" is enabled
            {
                code: 'MA5-TRG-C-02',
                contentLabel: 'Non-right-angled trigonometry',
                statement: 'applies the sine and cosine rules and trigonometric ratios to find unknown sides and angles in triangles including obtuse angles',
                pathway: 'path',
            },
            {
                code: 'MA5-SRD-C-01',
                contentLabel: 'Surds',
                statement: 'simplifies, adds, subtracts, multiplies and divides surds, and rationalises denominators',
                pathway: 'path',
            },
        ],
    },
};

// ---- Topic key → display name + outcome codes ---------------
// Keys match exactly the generator's GENERATORS dict keys.
// outcomes is stage-keyed so the same map works for multiple stages.
export const TOPIC_OUTCOME_MAP = {
    'Integers': {
        displayName: 'Computation with Integers',
        outcomes: {
            'Stage 4': ['MA4-INT-C-01'],
            'Stage 5': ['MA5-IND-C-01'],
        },
    },
    'Decimals': {
        displayName: 'Decimals',
        outcomes: {
            'Stage 4': ['MA4-FRC-C-01'],
            'Stage 5': ['MA5-FRC-C-01'],
        },
    },
    'Rounding': {
        displayName: 'Rounding',
        outcomes: {
            'Stage 4': ['MA4-FRC-C-01'],
            'Stage 5': ['MA5-FRC-C-01'],
        },
    },
    'Fractions': {
        displayName: 'Fractions',
        outcomes: {
            'Stage 4': ['MA4-FRC-C-01'],
            'Stage 5': ['MA5-FRC-C-01'],
        },
    },
    'Percentages': {
        displayName: 'Percentages',
        outcomes: {
            'Stage 4': ['MA4-FRC-C-01'],
            'Stage 5': ['MA5-FRC-C-01'],
        },
    },
    'Algebra': {
        displayName: 'Algebraic Techniques',
        outcomes: {
            'Stage 4': ['MA4-ALG-C-01', 'MA4-EQU-C-01', 'MA4-LIN-C-01'],
            'Stage 5': ['MA5-ALG-C-01', 'MA5-EQU-C-01', 'MA5-LIN-C-01', 'MA5-IND-C-01'],
        },
    },
    'Geometry': {
        displayName: 'Measurement & Geometry',
        outcomes: {
            'Stage 4': ['MA4-ARE-C-01', 'MA4-GEO-C-01', 'MA4-ANG-C-01', 'MA4-PYT-C-01', 'MA4-LEN-C-01'],
            'Stage 5': ['MA5-ARE-C-01', 'MA5-GEO-C-01', 'MA5-VOL-C-01'],
        },
    },
    'Statistics': {
        displayName: 'Data Analysis',
        outcomes: {
            'Stage 4': ['MA4-DAT-C-01', 'MA4-DAT-C-02'],
            'Stage 5': ['MA5-DAT-C-01'],
        },
    },
    'Financial Maths': {
        displayName: 'Financial Mathematics',
        outcomes: {
            'Stage 4': ['MA4-RAT-C-01'],
            'Stage 5': ['MA5-FIN-C-01'],
        },
    },
    'Probability': {
        displayName: 'Probability',
        outcomes: {
            'Stage 4': ['MA4-PRO-C-01'],
            'Stage 5': ['MA5-PRO-C-01'],
        },
    },
    'Ratios & Rates': {
        displayName: 'Ratios & Rates',
        outcomes: {
            'Stage 4': ['MA4-RAT-C-01'],
            'Stage 5': ['MA5-FRC-C-01'],
        },
    },
    // Stage 5 only topics
    'Trigonometry': {
        displayName: 'Trigonometry',
        outcomes: {
            'Stage 5': ['MA5-TRG-C-01', 'MA5-TRG-C-02'],
        },
    },
    'Non-linear Relationships': {
        displayName: 'Non-linear Relationships',
        outcomes: {
            'Stage 5': ['MA5-NLR-C-01'],
        },
    },
};

// ---- Helper functions ----------------------------------------

/** Returns the UI display name for a topic key, or the key itself as fallback. */
export function getTopicDisplayName(topicKey) {
    return TOPIC_OUTCOME_MAP[topicKey]?.displayName ?? topicKey;
}

/** Returns topic keys available for a given stage. */
export function getTopicsForStage(stage) {
    return STAGE_TOPICS[stage] ?? [];
}

/**
 * Returns the array of outcome code strings for a topic key in a given stage.
 * @param {string} topicKey
 * @param {string} stage  - e.g. 'Stage 4'
 * @returns {string[]}
 */
export function getTopicOutcomeCodes(topicKey, stage = 'Stage 4') {
    return TOPIC_OUTCOME_MAP[topicKey]?.outcomes?.[stage] ?? [];
}

/**
 * Returns topic keys (from TOPIC_OUTCOME_MAP) that are covered by any of
 * the given outcome codes. Used to derive active topics from outcome selection.
 *
 * @param {string[]} outcomeCodes - e.g. ['MA4-INT-C-01', 'MA4-FRC-C-01']
 * @param {string}   stage        - e.g. 'Stage 4'
 * @returns {string[]} topic keys, e.g. ['Integers', 'Decimals', 'Fractions', ...]
 */
export function getTopicsForOutcomeCodes(outcomeCodes, stage = 'Stage 4') {
    if (!outcomeCodes || outcomeCodes.length === 0) return [];
    const codeSet = new Set(outcomeCodes);
    return Object.keys(TOPIC_OUTCOME_MAP).filter(topicKey => {
        const codes = TOPIC_OUTCOME_MAP[topicKey]?.outcomes?.[stage] ?? [];
        return codes.some(c => codeSet.has(c));
    });
}

/**
 * Returns all unique outcome objects (from STAGE_OUTCOMES) that are covered
 * by the given active topic keys.  Always includes appliesAll outcomes.
 * Path-only outcomes are excluded unless includePath is true.
 *
 * @param {string[]} activeTopicKeys - e.g. ['Integers', 'Algebra']
 * @param {string}   stage           - e.g. 'Stage 4'
 * @param {boolean}  includePath     - whether to include 5.3 Path outcomes
 * @returns {{ code, contentLabel, statement, appliesAll?, pathway? }[]}
 */
export function getOutcomesForTopics(activeTopicKeys, stage = 'Stage 4', includePath = false) {
    const stageData = STAGE_OUTCOMES[stage];
    if (!stageData) return [];

    const coveredCodes = new Set();
    for (const key of activeTopicKeys) {
        for (const code of getTopicOutcomeCodes(key, stage)) {
            coveredCodes.add(code);
        }
    }

    return stageData.outcomes.filter(o =>
        (o.appliesAll || coveredCodes.has(o.code)) &&
        (o.pathway !== 'path' || includePath)
    );
}
