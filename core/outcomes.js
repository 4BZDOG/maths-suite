// =============================================================
// core/outcomes.js — NESA syllabus outcome data
//
// Structure is stage-keyed throughout so Stage 5, Early Stage 1,
// etc. can be added without touching existing Stage 4 data.
// =============================================================

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
                appliesAll: true,   // present regardless of topic selection
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

    // Add Stage 3, Stage 5, etc. here when needed.
    // Each entry follows the same { label, years, outcomes: [...] } shape.
};

// ---- Topic key → display name + outcome codes ---------------
// Keys match exactly the generator's GENERATORS dict keys (for backwards compat).
// outcomes is stage-keyed so the same map works for multiple stages.
export const TOPIC_OUTCOME_MAP = {
    'Integers': {
        displayName: 'Computation with Integers',
        outcomes: { 'Stage 4': ['MA4-INT-C-01'] },
    },
    'Decimals': {
        displayName: 'Decimals',
        outcomes: { 'Stage 4': ['MA4-FRC-C-01'] },
    },
    'Rounding': {
        displayName: 'Rounding',
        outcomes: { 'Stage 4': ['MA4-FRC-C-01'] },
    },
    'Fractions': {
        displayName: 'Fractions',
        outcomes: { 'Stage 4': ['MA4-FRC-C-01'] },
    },
    'Percentages': {
        displayName: 'Percentages',
        outcomes: { 'Stage 4': ['MA4-FRC-C-01'] },
    },
    'Algebra': {
        displayName: 'Algebraic Techniques',
        outcomes: { 'Stage 4': ['MA4-ALG-C-01', 'MA4-EQU-C-01', 'MA4-LIN-C-01'] },
    },
    'Geometry': {
        displayName: 'Measurement & Geometry',
        outcomes: { 'Stage 4': ['MA4-ARE-C-01', 'MA4-GEO-C-01', 'MA4-ANG-C-01', 'MA4-PYT-C-01', 'MA4-LEN-C-01'] },
    },
    'Statistics': {
        displayName: 'Data Analysis',
        outcomes: { 'Stage 4': ['MA4-DAT-C-01', 'MA4-DAT-C-02'] },
    },
    'Financial Maths': {
        displayName: 'Financial Mathematics',
        outcomes: { 'Stage 4': ['MA4-RAT-C-01'] },
    },
};

// ---- Helper functions ----------------------------------------

/** Returns the UI display name for a topic key, or the key itself as fallback. */
export function getTopicDisplayName(topicKey) {
    return TOPIC_OUTCOME_MAP[topicKey]?.displayName ?? topicKey;
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
 * Returns all unique outcome objects (from STAGE_OUTCOMES) that are covered
 * by the given active topic keys.  Always includes appliesAll outcomes.
 *
 * @param {string[]} activeTopicKeys - e.g. ['Integers', 'Algebra']
 * @param {string}   stage           - e.g. 'Stage 4'
 * @returns {{ code, contentLabel, statement, appliesAll? }[]}
 */
export function getOutcomesForTopics(activeTopicKeys, stage = 'Stage 4') {
    const stageData = STAGE_OUTCOMES[stage];
    if (!stageData) return [];

    const coveredCodes = new Set();
    for (const key of activeTopicKeys) {
        for (const code of getTopicOutcomeCodes(key, stage)) {
            coveredCodes.add(code);
        }
    }

    return stageData.outcomes.filter(o => o.appliesAll || coveredCodes.has(o.code));
}
