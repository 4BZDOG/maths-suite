// renderers/htmlUtils.js — Shared HTML rendering utilities
export function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Two-stage verb detection so emphasis is consistent across clue styles:
//   1. VERB_PHRASE_RE — short prefix terminated by ": " (e.g. "Calculate:",
//      "Find $x$:"). Excludes '*' so we never collide with inline italics.
//   2. IMPERATIVE_RE  — fallback: the leading imperative word alone
//      (e.g. "Find the area of a rectangle..." → bold just "Find").
const VERB_PHRASE_RE = /^([A-Za-z][^:.*]{0,50}:\s)/;
const IMPERATIVE_LIST = 'Approximate|Calculate|Compare|Compute|Convert|Decrease|Describe|Determine|Divide|Estimate|Evaluate|Expand|Express|Factorise|Find|How many|How much|Identify|Increase|Label|List|Order|Reduce|Round|Share|Show|Simplify|Solve|Split|State|Substitute|Use|What is|Work out|Write';
const IMPERATIVE_RE  = new RegExp(`^(${IMPERATIVE_LIST})\\b`);
// Mid-sentence imperative: catches clues like "A rectangle has...Determine its
// area." (verb after ". ") and "If y = 2x + 5, find y when x = 3" (lowercase
// verb after ", "). Allows either case so both styles are picked up.
const MID_IMPERATIVE_RE = new RegExp(
    `([.,]\\s+)(${IMPERATIVE_LIST}|${IMPERATIVE_LIST.toLowerCase()})\\b`
);

export function detectVerb(s) {
    const m1 = s.match(VERB_PHRASE_RE);
    // Reject a match that splits a $...$ math region (odd count of $ in prefix),
    // e.g. "Write $20 : 10$ ..." — bolding that prefix would break KaTeX.
    if (m1 && (m1[1].match(/\$/g) || []).length % 2 === 0) return m1[1];
    const m2 = s.match(IMPERATIVE_RE);
    if (m2) return m2[1];
    return null;
}

/** Find a mid-sentence imperative verb (after a "." sentence break).
 *  Returns { index, verb } where index is the start of the verb word
 *  in the original string, or null. */
export function detectMidVerb(s) {
    const m = s.match(MID_IMPERATIVE_RE);
    if (!m) return null;
    return { index: m.index + m[1].length, verb: m[2] };
}

// Apply our small markdown subset (**bold**, *italic*) to an already
// HTML-escaped string, while leaving any KaTeX math regions ($...$) untouched.
function applyMarkdownEmphasis(escaped) {
    // Split on math regions (preserves them as separate segments).
    const parts = escaped.split(/(\$[^$]+\$)/g);
    return parts.map(seg => {
        if (seg.startsWith('$') && seg.endsWith('$')) return seg;
        return seg
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    }).join('');
}

/**
 * Format a single line of clue text (no \n handling).
 * Internal helper used by formatClue.
 */
function _formatOneLine(s) {
    const verb = detectVerb(s);
    if (verb) {
        const rest = s.slice(verb.length);
        return `<strong class="clue-verb">${applyMarkdownEmphasis(esc(verb))}</strong>${applyMarkdownEmphasis(esc(rest))}`;
    }
    const mid = detectMidVerb(s);
    if (mid) {
        const before = s.slice(0, mid.index);
        const after  = s.slice(mid.index + mid.verb.length);
        return applyMarkdownEmphasis(esc(before))
            + `<strong class="clue-verb">${esc(mid.verb)}</strong>`
            + applyMarkdownEmphasis(esc(after));
    }
    return applyMarkdownEmphasis(esc(s));
}

/**
 * Format a clue for HTML display.
 *  - Wraps a leading instruction verb (e.g. "Calculate: ") in <strong class="clue-verb">.
 *  - Supports a small markdown subset in the question body for emphasis:
 *      **word** → bold, *word* → italic.
 *  - Leaves $...$ math segments untouched so KaTeX still renders them.
 *  - Lines separated by \n render as block elements (equation on new line).
 */
export function formatClue(clue) {
    if (!clue) return '';
    const s = String(clue);
    const nlIdx = s.indexOf('\n');
    if (nlIdx !== -1) {
        const stem = s.slice(0, nlIdx);
        const eqs  = s.slice(nlIdx + 1).split('\n');
        return _formatOneLine(stem)
            + eqs.map(eq => `<span class="clue-newline">${applyMarkdownEmphasis(esc(eq.trim()))}</span>`).join('');
    }
    return _formatOneLine(s);
}
