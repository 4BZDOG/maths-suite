// =============================================================
// renderers/katexRender.js — Shared KaTeX auto-render utility
// =============================================================
// Renders all $...$ inline math inside an element using KaTeX
// auto-render. KaTeX is loaded from CDN in puzzle-suite.html. When it is not
// available (school networks that block the CDN, offline use) the maths falls
// back to the same plain-Unicode text the PDF uses, so the worksheet stays
// readable instead of showing raw LaTeX such as "$\\frac{3}{4}$".
import { latexToText } from '../pdf/pdfHelpers.js';

function _plainTextFallback(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.includes('$')) nodes.push(n);
    for (const n of nodes) n.nodeValue = latexToText(n.nodeValue);
    el.classList.add('katex-fallback');
}

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
            // Graceful fallback: readable plain text rather than raw LaTeX
            console.warn('KaTeX render error:', e);
            _plainTextFallback(el);
        }
    } else if (typeof document !== 'undefined') {
        _plainTextFallback(el);
    }
}
