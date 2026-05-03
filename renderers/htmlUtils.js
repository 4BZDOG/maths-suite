// renderers/htmlUtils.js — Shared HTML rendering utilities
export function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Verb prefix matcher: only short, alpha-leading prefixes ending with ": ".
// Tightened so clues containing an internal "<word>: " (e.g. ratios, list-style
// prompts) don't get the wrong segment bolded.
const VERB_RE = /^([A-Za-z][^:.$]{0,40}:\s)/;

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
    const m = s.match(VERB_RE);
    if (m) {
        const verb = m[1];
        const rest = s.slice(verb.length);
        return `<strong class="clue-verb">${esc(verb)}</strong>${applyMarkdownEmphasis(esc(rest))}`;
    }
    return applyMarkdownEmphasis(esc(s));
}
