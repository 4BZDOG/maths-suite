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
const IMPERATIVE_RE  = /^(Approximate|Calculate|Compare|Compute|Convert|Decrease|Describe|Determine|Estimate|Evaluate|Express|Find|How many|How much|Identify|Increase|Label|List|Order|Reduce|Round|Show|Simplify|Solve|State|Substitute|Use|What is|Work out|Write)\b/;

export function detectVerb(s) {
    const m1 = s.match(VERB_PHRASE_RE);
    if (m1) return m1[1];
    const m2 = s.match(IMPERATIVE_RE);
    if (m2) return m2[1];
    return null;
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
 * Format a clue for HTML display.
 *  - Wraps a leading instruction verb (e.g. "Calculate: ") in <strong class="clue-verb">.
 *  - Supports a small markdown subset in the question body for emphasis:
 *      **word** → bold, *word* → italic.
 *  - Leaves $...$ math segments untouched so KaTeX still renders them.
 */
export function formatClue(clue) {
    if (!clue) return '';
    const s = String(clue);
    const verb = detectVerb(s);
    if (verb) {
        const rest = s.slice(verb.length);
        return `<strong class="clue-verb">${applyMarkdownEmphasis(esc(verb))}</strong>${applyMarkdownEmphasis(esc(rest))}`;
    }
    return applyMarkdownEmphasis(esc(s));
}
