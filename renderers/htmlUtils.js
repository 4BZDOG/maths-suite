// renderers/htmlUtils.js — Shared HTML rendering utilities
export function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Format a clue for HTML display. HTML-escapes the text and wraps any
 * leading instruction verb (text ending with ': ') in <strong> so it
 * renders bold — e.g. "Calculate: $2x+3$" or "Find $x$: $3x=9$".
 * The wrapped element keeps the katex-target class on the parent so
 * LaTeX inside the verb (like $x$) still renders correctly.
 */
export function formatClue(clue) {
    if (!clue) return '';
    const m = String(clue).match(/^(.+?:\s)/);
    if (m) {
        return `<strong class="clue-verb">${esc(m[1])}</strong>${esc(clue.slice(m[1].length))}`;
    }
    return esc(clue);
}
