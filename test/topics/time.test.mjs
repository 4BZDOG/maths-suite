// =============================================================
// test/topics/time.test.mjs — Time verifiers (convert / duration / zones).
//
// Recomputes the answer with independent total-minute arithmetic for each
// template family and compares to the generator.
// =============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { gen, DIFFS, checkStructure } from '../_helpers.mjs';

const pad = (n) => String(n).padStart(2, '0');
const norm = (m) => ((m % 1440) + 1440) % 1440;
const hm = (m) => { m = norm(m); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
// All "$HH{:}MM$" times in the clue → minutes-since-midnight.
const times = (c) => [...c.matchAll(/\$(\d{1,2})\{:\}(\d{2})/g)].map(m => Number(m[1]) * 60 + Number(m[2]));

// offset "$N$ hours|minutes ahead|behind" → signed minutes (null if absent).
function offset(c) {
    const m = c.match(/\$(\d+)\$ (hours|minutes) (ahead|behind)/);
    if (!m) return null;
    const mins = m[2] === 'hours' ? Number(m[1]) * 60 : Number(m[1]);
    return m[3] === 'ahead' ? mins : -mins;
}

test('Time: every question is structurally valid', () => {
    for (const diff of DIFFS) {
        let total = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const qs = gen({ topic: 'Time', difficulty: diff, count: 6, seed });
            total += qs.length;
            for (const q of qs) checkStructure(q, `Time/${diff}/seed${seed}`, assert);
        }
        assert.ok(total >= 30, `Time/${diff}: only ${total} questions`);
    }
});

test('Time: recomputed answers match the generator', () => {
    let checked = 0;
    for (const diff of DIFFS) {
        for (let seed = 1; seed <= 250; seed++) {
            const qs = gen({ topic: 'Time', difficulty: diff, count: 8, seed });
            for (const q of qs) {
                const c = q.clue;
                const a = String(q.answer);
                const L = `${diff}/seed${seed}: "${c.slice(0, 70)}…" → ${a}`;

                // convert 12h → 24h
                let m = c.match(/\$(\d{1,2})\{:\}(\d{2})\\text\{ (am|pm)\}\$ in 24-hour/);
                if (m) {
                    const h12 = +m[1], min = +m[2], h24 = m[3] === 'pm' ? h12 + 12 : h12;
                    assert.equal(a, `${pad(h24)}:${pad(min)}`, L);
                    checked++; continue;
                }
                // convert 24h → 12h
                if (/as 12-hour time/.test(c)) {
                    const [t] = times(c);
                    assert.equal(a, `${Math.floor(t / 60) - 12}:${pad(t % 60)} pm`, L);
                    checked++; continue;
                }
                // duration: timetable (latest departure)
                m = c.match(/takes \$(\d+)\$ minutes\. To arrive by/);
                if (m) {
                    const arr = times(c)[0];
                    assert.equal(a, hm(arr - Number(m[1])), L);
                    checked++; continue;
                }
                // duration: finish time
                if (/runs for/.test(c) && /finish/.test(c)) {
                    const start = times(c)[0];
                    const hrs = c.match(/runs for \$(\d+)\$ hours/);
                    const mins = c.match(/\$(\d+)\$ minutes/);
                    const add = (hrs ? Number(hrs[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
                    assert.equal(a, hm(start + add), L);
                    checked++; continue;
                }
                // duration: elapsed minutes
                if (/How many minutes are there from/.test(c)) {
                    const [s, e] = times(c);
                    assert.equal(Number(a), norm(e - s), L);
                    checked++; continue;
                }
                // zones: flight arrival
                if (/A flight leaves/.test(c)) {
                    const base = times(c)[0];
                    const D = Number(c.match(/lasts \$(\d+)\$ hours/)[1]);
                    assert.equal(a, hm(base + D * 60 + offset(c)), L);
                    checked++; continue;
                }
                // zones: simple offset
                if (/When it is .* what is the time in/.test(c)) {
                    const base = times(c)[0];
                    assert.equal(a, hm(base + offset(c)), L);
                    checked++; continue;
                }
            }
        }
    }
    assert.ok(checked > 200, `only ${checked} Time questions verified`);
});
