// Regenerates test/fixtures/pdf-golden-questions.json — a frozen snapshot of
// generator output used by test/pdf-golden.test.mjs, so the PDF layout goldens
// do not shift whenever question wording changes. Only rerun this (and then
// re-record the goldens) when you *intend* to change the fixture content.
//   node tools/make-pdf-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';

const SELECTIONS = {
    core:   { topics: ['Integers', 'Fractions', 'Percentages', 'Algebra'], stage: 'Stage 4', seeds: [101, 5101] },
    geom:   { topics: ['Geometry', "Pythagoras' Theorem", 'Area', 'Volume'], stage: 'Stage 4', seeds: [202] },
    stats:  { topics: ['Statistics', 'Probability', 'Data Classification and Visualisation'], stage: 'Stage 4', seeds: [303] },
    stage5: { topics: ['Trigonometry', 'Non-linear Relationships', 'Algebra', 'Geometry'], stage: 'Stage 5', seeds: [404] },
};
const N = 24;
const out = {};
for (const [key, sel] of Object.entries(SELECTIONS)) {
    const gen = (difficulty, seed) => generateMathsQuestions({
        subTopics: sel.topics, subOpsFilter: null, difficulty, count: N, seed, stage: sel.stage, includePath: false,
    });
    out[key] = {
        topics: sel.topics,
        stage: sel.stage,
        groups: sel.seeds.map(seed => ({ easy: gen('Easy', seed), medium: gen('Medium', seed + 1), hard: gen('Hard', seed + 2) })),
    };
}
mkdirSync(new URL('../test/fixtures/', import.meta.url), { recursive: true });
writeFileSync(new URL('../test/fixtures/pdf-golden-questions.json', import.meta.url), JSON.stringify(out));
console.log('written');
