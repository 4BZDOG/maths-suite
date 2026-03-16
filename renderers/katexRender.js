// =============================================================
// renderers/katexRender.js — Shared KaTeX auto-render utility
// =============================================================
// Renders all $...$ inline math inside an element using KaTeX
// auto-render. KaTeX is loaded from CDN in puzzle-suite.html;
// if it hasn't loaded yet this function is a safe no-op.

/**
 * Auto-render all $...$ math inside the given DOM element.
 * Call this after setting innerHTML on any preview container.
 * @param {HTMLElement} el
 */
export function renderKaTeX(el) {
    if (!el) return;
    // KaTeX auto-render extension exposed as window.renderMathInElement
    if (typeof window !== 'undefined' && window.renderMathInElement) {
        try {
            window.renderMathInElement(el, {
                delimiters: [
                    { left: '$$', right: '$$', display: true  },
                    { left: '$',  right: '$',  display: false },
                ],
                throwOnError: false,
                output: 'html',
            });
        } catch (e) {
            // Graceful fallback: leave raw LaTeX visible
            console.warn('KaTeX render error:', e);
        }
    }
}
