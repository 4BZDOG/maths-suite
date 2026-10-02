// =============================================================
// test/text-quality.test.mjs — guards the *wording* of generated questions.
// Scans a large sample of every topic/difficulty/stage for defect patterns
// (bad plurals, "1x", "0x", "+ -3", unbalanced maths delimiters, doubled words…).
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMathsQuestions, ALL_SUBTOPICS } from '../generators/mathsQuestionGen.js';

const SEEDS = 40;
function* allQuestions() {
    for (const stage of ['Stage 4', 'Stage 5']) {
        for (const subTopic of ALL_SUBTOPICS) {
            for (const difficulty of ['Easy', 'Medium', 'Hard']) {
                for (let seed = 1; seed <= SEEDS; seed++) {
                    let qs;
                    try { qs = generateMathsQuestions({ subTopic, difficulty, count: 10, seed: seed * 31 + 7, stage, includePath: true }); } catch { continue; }
                    for (const q of qs) yield { stage, subTopic, difficulty, q };
                }
            }
        }
    }
}
const ALL = [...allQuestions()];
const mathSpans = (s) => [...String(s).replace(/\\\$/g, '\u0000').matchAll(/\$([^$]*)\$/g)].map(m => m[1]);
const fields = ({ q }) => [['clue', q.clue], ['answerDisplay', q.answerDisplay], ['worked', q.worked]].filter(([, v]) => v);

function scan(label, test) {
    const hits = new Map();
    for (const item of ALL) {
        for (const [name, text] of fields(item)) {
            const why = test(String(text), name, item);
            if (why) { const key = `${item.subTopic}: ${why}`; if (!hits.has(key)) hits.set(key, text.slice(0, 110)); }
        }
    }
    assert.equal(hits.size, 0, `${label}:\n` + [...hits].slice(0, 12).map(([k, v]) => `  - ${k}  ⟶  "${v}"`).join('\n'));
}

test('Text quality: large sample generated', () => {
    assert.ok(ALL.length > 5000, `only ${ALL.length} questions sampled`);
});

test('Text quality: "1 hours", "1 days" … plural agreement', () => {
    scan('singular quantity with plural noun', (t) => {
        const m = t.match(/(?:^|[^\d.])\$?1\$? (hours|minutes|days|weeks|years|metres|litres|kilograms|students|items)\b/);
        return m ? `"1 ${m[1]}"` : null;
    });
});

test('Text quality: a quantity of 1 takes a singular verb ("1 is", "1 gets")', () => {
    scan('singular quantity with plural verb', (t) => {
        const plain = t.replace(/\\\$/g, '');
        const m = plain.match(/(?:^|[.?!]\s+)\$?1\$? (?:more (?:passenger|student|item)s? )?(are|get|leave|were)\b/);
        return m ? `"1 ${m[1]}"` : null;
    });
});

test('Text quality: plural subject takes a plural verb ("4 oranges cost")', () => {
    scan('plural subject with singular verb', (t) => {
        const m = t.match(/\$\d+\$ (?:\w+ ){0,3}(?:apples|oranges|pencils|stickers|muffins|bottles|litres|kilograms|metres)\b[^.?]*? costs\b/);
        return m ? 'plural "costs"' : null;
    });
});

test('Text quality: no leading coefficient of 1 or 0 in maths ("1x", "0x")', () => {
    scan('awkward coefficient', (t) => {
        for (const span of mathSpans(t)) {
            if (/(^|[^0-9A-Za-z.\\_^])1(?=[a-zA-Z](?![a-zA-Z])|\\(?:sqrt|pi|theta)\b)/.test(span)) return `"1x"-style coefficient in $${span}$`;
            if (/(^|[^0-9A-Za-z.\\_^])0[a-zA-Z](?![a-zA-Z])/.test(span)) return `"0x"-style term in $${span}$`;
        }
        return null;
    });
});

test('Text quality: no "+ -n" or "- -n" double signs outside brackets', () => {
    scan('double sign', (t) => {
        for (const span of mathSpans(t)) if (/[+\-]\s*[+\-]\s*\d/.test(span) && !/\(\s*[+\-]/.test(span.replace(/[+\-]\s*[+\-]\s*\d/, '')) ) return `double sign in $${span}$`;
        return null;
    });
});

test('Text quality: balanced $ delimiters and emphasis markers', () => {
    scan('unbalanced delimiter', (t, name) => {
        if (name === 'answerDisplay') return null;   // an answer may be a bare currency amount such as "$53.25"
        const noEsc = t.replace(/\\\$/g, '');
        if ((noEsc.match(/\$/g) || []).length % 2) return 'odd number of $';
        if ((t.replace(/\*\*/g, '').match(/\*/g) || []).length % 2) return 'odd number of *';
        return null;
    });
});

test('Text quality: no doubled words, double spaces or edge whitespace in clues', () => {
    scan('whitespace / repeated word', (t, name) => {
        if (name !== 'clue') return null;
        const plain = t.replace(/\$[^$]*\$/g, 'M');
        if (/\b(\w{3,}) \1\b/i.test(plain)) return `repeated word "${plain.match(/\b(\w{3,}) \1\b/i)[0]}"`;
        if (/[^\n ] {2,}[^\n ]/.test(plain)) return 'double space';
        if (t !== t.trim()) return 'leading/trailing whitespace';
        return null;
    });
});

test('Text quality: clues end like sentences or prompts', () => {
    scan('clue with no closing punctuation', (t, name) => {
        if (name !== 'clue') return null;
        const last = t.trim().split('\n').pop().trim();
        // a bare equation/expression line (after a prompt) is fine; a prose line must end in . ? : ) ! or maths
        if (/\$[.?:)]?$/.test(last)) return null;          // ends with a maths expression
        return /[.?:!)"'*]$/.test(last) ? null : `ends "…${last.slice(-18)}"`;
    });
});

test('Text quality: unit rates name the unit they are quoted in', () => {
    scan('"per item" for a measured quantity', (t) => (/(litres|kilograms|metres) of [a-z]+.*(per item|each item)/i.test(t) ? 'generic "per item"' : null));
});
