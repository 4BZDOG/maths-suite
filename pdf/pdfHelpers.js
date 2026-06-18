// =============================================================
// pdf/pdfHelpers.js — Shared helpers used by all PDF draw modules
// =============================================================

/**
 * Build a context object passed to all draw functions.
 */
export function buildCtx(doc, pdfFont, wmImg, scale, { PAGE_WIDTH, PAGE_HEIGHT, MARGIN }, settings = {}) {
    const mmToPt = mm => mm * 2.83465;

    const drawWatermark = () => {
        if (!wmImg) return;
        const opac = settings.wmOpacity !== undefined
            ? settings.wmOpacity
            : (parseFloat(document.documentElement.style.getPropertyValue('--wm-opacity')) || 0.15);
        doc.setGState(new doc.GState({ opacity: opac }));
        const imgRatio = wmImg.width / wmImg.height;
        let w = 150, h = w / imgRatio;
        if (h > 200) { h = 200; w = h * imgRatio; }
        doc.addImage(wmImg, 'PNG', (PAGE_WIDTH - w) / 2, (PAGE_HEIGHT - h) / 2, w, h);
        doc.setGState(new doc.GState({ opacity: 1 }));
    };

    return {
        doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, mmToPt, pdfFont, wmImg, drawWatermark,
        problemSetConfig: settings.problemSetConfig || { cols: 2, showTopic: false, shuffle: false },
        wsInternalGrid:   settings.wsInternalGrid || false,
        titleScale:       settings.titleScale || 1,
        showExportId:     settings.showExportId !== false,
    };
}

// =============================================================
// LaTeX → Unicode text conversion (for PDF rendering)
// =============================================================
// KaTeX is used in the HTML preview; here we convert common
// LaTeX commands to their Unicode equivalents so jsPDF can
// render math as plain text (no rasterisation required).

export function latexToText(str) {
    if (!str) return str;
    // Protect escaped dollar signs (\$) before splitting on $ delimiters
    let s = _protectEscapedDollars(str);
    // Replace $$...$$ and $...$ blocks with converted unicode
    s = s
        .replace(/\$\$([^$]+)\$\$/g, (_, m) => _parseLatex(_restoreDollars(m)))
        .replace(/\$([^$]+)\$/g, (_, m) => _parseLatex(_restoreDollars(m)));
    // Restore any remaining escaped dollar signs as literal $
    s = _restoreDollars(s);
    // Strip the small markdown-emphasis subset used in clue templates so
    // PDF text doesn't contain stray asterisks. (Bold/italic-aware drawing
    // is a future enhancement — for now we keep the words plain.)
    s = s
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1$2');
    // When the embedded Unicode font couldn't load and we're on the standard
    // helvetica fallback, downgrade non-WinAnsi glyphs to readable ASCII so the
    // worksheet stays correct instead of emitting garbage (π→"À", x⁶→"xv").
    if (_asciiFallback) s = _winAnsiSafe(s);
    return s;
}

// ─── Standard-font (helvetica) fallback safety ──────────────────────────────
// jsPDF's built-in fonts use WinAnsi encoding, which has no glyphs for π, √,
// Greek letters, or superscripts above ³ — so a clue like "π ≈ 3.14" or "x⁶"
// renders as mojibake. We only hit this path when the embedded Unicode font
// (Inter/Roboto/…) fails to load — e.g. a school network blocks the font CDN.
// `setLatexAsciiFallback(true)` is flipped on by the exporter in that case and
// latexToText() then maps the offending glyphs to plain ASCII.
let _asciiFallback = false;
export function setLatexAsciiFallback(on) { _asciiFallback = !!on; }

const _SUP_REV = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ˣ':'x','⁺':'+','⁻':'-' };
const _WINANSI_MAP = {
    'π':'pi', '≈':'~', '≤':'<=', '≥':'>=', '≠':'!=', '√':'sqrt', '∞':'inf',
    'θ':'theta', 'α':'alpha', 'β':'beta', 'γ':'gamma', '∠':'angle',
    '−':'-',    // U+2212 minus sign → ASCII hyphen
    '→':'->',   // U+2192 rightwards arrow
    '□':'[ ]',  // U+25A1 fill-in-the-box placeholder
    '̄':'',   // combining macron (overline, e.g. x̄) — drop, keep the base letter
};
export function _winAnsiSafe(s) {
    if (!s) return s;
    // Collapse runs of superscript characters into caret notation: x⁴→x^4, 2¹²→2^12
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣ⁺⁻]+/g, run => '^' + [...run].map(c => _SUP_REV[c] || '').join(''));
    return s.replace(/[π≈≤≥≠√∞θαβγ∠−→□]/g, c => (c in _WINANSI_MAP ? _WINANSI_MAP[c] : c)).replace(/\u0304/g, '');
}

const _SUP_MAP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','x':'ˣ','+':'⁺','-':'⁻'};
function _toSuperscript(s) {
    const result = [...s].map(c => _SUP_MAP[c] || c).join('');
    // If every char was mapped cleanly, use it; else fall back to ^(s)
    return result === s && !_SUP_MAP[s[0]] ? `^(${s})` : result;
}

// ─── True superscript rendering (font-subset-proof) ─────────────────────────
// latexToText emits Unicode superscript glyphs (x⁶, 5⁰). The fontsource "latin"
// TTF subset we embed (pdfFonts.js → latin-*.ttf) only covers ¹²³ (Latin-1
// Supplement, U+00B9/B2/B3) — the U+2070 block (⁰⁴⁵⁶⁷⁸⁹ⁿ) is absent, so those
// exponents silently vanish in the PDF (an answer key showed "125x" for 125x⁶,
// "5" for 5⁰). To render every exponent reliably we draw the superscript run as
// a smaller, raised glyph using ASCII digits (always present in the subset)
// rather than trusting the superscript codepoints to exist in the font.
const _SUP_DOWN = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','ⁿ':'n','ˣ':'x','⁺':'+','⁻':'-' };
const _SUP_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿˣ⁺⁻]/;
// _toSuperscript() can't map an exponent that has no Unicode superscript glyph
// (the "find the missing index" placeholder, e.g. $3^{?}$) and falls back to
// caret notation "^(?)". Treat that as a superscript run too so it renders as a
// raised "?" instead of a literal "^(?)".
const _CARET_RE = /\^\(/;
// The same "latin" subset is also missing every non-Latin-1 math symbol
// latexToText can emit — √ π θ ∠ ≈ ≤ ≥ ≠ ∞ → and the fill-in box □ — so they
// vanish too (an answer of 2√(3) printed as "2(3)", marking students wrong).
// drawSup() remaps those to the ASCII spellings in _WINANSI_MAP as it draws, so
// every symbol prints as something correct instead of disappearing. (The
// superscript glyphs are handled separately above — they stay raised, not ASCII.)
const _SYMBOL_RE = /[π≈≤≥≠√∞θαβγ∠→□]/;
const _needsRich = s => _SUP_RE.test(s || '') || _CARET_RE.test(s || '') || _SYMBOL_RE.test(s || '');

/** True when the string contains a superscript glyph or a "^(…)" caret run. */
export function hasSuperscript(s) { return _SUP_RE.test(s || '') || _CARET_RE.test(s || ''); }

// Split a string into consecutive { sup, text } runs: Unicode superscript glyphs
// are de-superscripted back to ASCII, "^(inner)" caret fallbacks contribute their
// inner text as a superscript run, and out-of-subset symbols are remapped to
// their ASCII spelling so they survive the font subset.
function _superscriptRuns(s) {
    const runs = [];
    let buf = '', sup = false;
    const push = (isSup, text) => {
        if (isSup === sup) { buf += text; }
        else { if (buf) runs.push({ sup, text: buf }); buf = text; sup = isSup; }
    };
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '^' && s[i + 1] === '(') {
            const close = s.indexOf(')', i + 2);
            if (close !== -1) { push(true, s.slice(i + 2, close)); i = close; continue; }
        }
        const isSup = _SUP_RE.test(ch);
        if (isSup) { push(true, _SUP_DOWN[ch] || ch); }
        else       { push(false, ch in _WINANSI_MAP ? _WINANSI_MAP[ch] : ch); }
    }
    if (buf) runs.push({ sup, text: buf });
    return runs;
}

// Superscript glyphs render at 70% size; the raised runs sit ~32% of the cap
// height above the baseline (pt → mm via 0.352778).
const _SUP_SCALE = 0.7;
const _SUP_RISE  = 0.352778 * 0.32;

/**
 * Measure the rendered width (mm) of a string that drawSup() would draw — the
 * superscript runs are measured at the reduced size so callers laying out or
 * right-aligning text get the true advance. `fontSizePt` is the base size; the
 * doc's current font family/style must already be set.
 */
export function measureSup(doc, text, fontSizePt) {
    if (!_needsRich(text)) return doc.getTextWidth(text);
    let w = 0;
    for (const run of _superscriptRuns(text)) {
        if (run.sup) {
            doc.setFontSize(fontSizePt * _SUP_SCALE);
            w += doc.getTextWidth(run.text);
            doc.setFontSize(fontSizePt);
        } else {
            w += doc.getTextWidth(run.text);
        }
    }
    return w;
}

/**
 * Draw `text` at baseline (x, y), rendering superscript runs as smaller, raised
 * glyphs so exponents survive even when the embedded font subset lacks the
 * superscript codepoints. The caller must set font family, style, colour and
 * base size first; the size is restored to `fontSizePt` on return.
 * @returns {number} the X position after the last glyph.
 */
export function drawSup(doc, text, x, y, fontSizePt) {
    if (!_needsRich(text)) { doc.text(text, x, y); return x + doc.getTextWidth(text); }
    const rise = fontSizePt * _SUP_RISE;
    let cx = x;
    for (const run of _superscriptRuns(text)) {
        if (run.sup) {
            doc.setFontSize(fontSizePt * _SUP_SCALE);
            doc.text(run.text, cx, y - rise);
            cx += doc.getTextWidth(run.text);
            doc.setFontSize(fontSizePt);
        } else {
            doc.text(run.text, cx, y);
            cx += doc.getTextWidth(run.text);
        }
    }
    return cx;
}

function _parseLatex(s) {
    return s
        // Normalise display-fraction to inline-fraction before other rules
        .replace(/\\dfrac/g, '\\frac')
        // Escaped special chars (must come first)
        .replace(/\\\$/g,     '$')   // \$ → literal dollar sign
        .replace(/\\%/g,      '%')   // \% → literal percent sign
        // Common symbols
        .replace(/\\times/g,  '×')
        .replace(/\\div/g,    '÷')
        .replace(/\\pm/g,     '±')
        .replace(/\\approx/g, '≈')
        .replace(/\\neq/g,    '≠')
        .replace(/\\leq/g,    '≤')
        .replace(/\\geq/g,    '≥')
        .replace(/\\pi/g,     'π')
        .replace(/\\infty/g,  '∞')
        .replace(/\\degree/g, '°')
        .replace(/°/g,        '°')
        // Fill-in-the-box placeholder for missing-number questions (□).
        // Must come before the catch-all \command strip below, or the box
        // vanishes and the question reads "  - 48 = 92".
        .replace(/\\square/g, '□')
        // Greek letters and angle marks — needed by Trigonometry answer keys
        // ("\theta = 22.6°") and obtuse-angle clues ("\angle A = 60°").
        .replace(/\\theta/g, 'θ')
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g,  'β')
        .replace(/\\gamma/g, 'γ')
        .replace(/\\angle/g, '∠')
        // \overline{x} → x̄ (combining macron). Used in stats formula hints.
        .replace(/\\overline\{([^}]+)\}/g, (_, x) => x + '̄')
        // \text{...} → ... (plain text inside math mode). Used in stats: "\text{sum}".
        .replace(/\\text\{([^}]+)\}/g, '$1')
        // Square root: \sqrt{x} → √(x)
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt\s+(\S+)/g,    '√$1')
        // Fractions: \frac{a}{b} → a/b. The numerator/denominator may themselves
        // contain a braced group (an exponent, e.g. \frac{d^{8}}{d^{5}}), so the
        // capture must allow one level of nesting — a plain [^}]+ stops at the
        // first inner "}" and the whole \frac then fails to match, silently
        // dropping the bar and printing "d⁸d⁵" with no division sign.
        .replace(/\\frac\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g, '$1/$2')
        // Superscripts: convert to Unicode superscript characters
        .replace(/\^\{([^}]+)\}/g,  (_, inner) => _toSuperscript(inner))
        .replace(/\^(\w+)/g,        (_, exp)   => _toSuperscript(exp))
        // Subscripts: _n → (n)
        .replace(/\_\{([^}]+)\}/g,  '($1)')
        // Trig functions: keep as-is but remove backslash
        .replace(/\\sin/g, 'sin')
        .replace(/\\cos/g, 'cos')
        .replace(/\\tan/g, 'tan')
        .replace(/\\log/g, 'log')
        .replace(/\\ln/g,  'ln')
        // Strip remaining \commands
        .replace(/\\[a-zA-Z]+/g, '')
        // Remove LaTeX braces
        .replace(/[{}]/g, '')
        // Clean up double backslashes
        .replace(/\\\\/g, ' ');
}

// =============================================================
// Inline fraction rendering — stacked numerator/bar/denominator
// =============================================================

/**
 * Returns true if the text contains a LaTeX \frac{}{} or \dfrac{}{} command.
 */
export function hasFraction(str) {
    return /\\d?frac\{/.test(str || '');
}

/**
 * Parse a mixed LaTeX clue string into renderable segments.
 * Returns array of:
 *   { type: 'plain', value }   — literal text outside $...$
 *   { type: 'math',  value }   — converted math token (no fraction)
 *   { type: 'frac',  num, den} — a stacked fraction
 */
const DOLLAR_PLACEHOLDER = '\x00DOLLAR\x00';

function _protectEscapedDollars(s) { return (s || '').replace(/\\\$/g, DOLLAR_PLACEHOLDER); }
function _restoreDollars(s)        { return (s || '').replace(/\x00DOLLAR\x00/g, '$'); }

function _parseClueSegments(text) {
    const result = [];
    // Protect \$ before splitting on $ delimiters
    const safeText = _protectEscapedDollars(text);
    const mathRe = /\$([^$]+)\$/g;
    let lastIdx = 0, m;

    while ((m = mathRe.exec(safeText)) !== null) {
        if (m.index > lastIdx) {
            result.push({ type: 'plain', value: _restoreDollars(safeText.slice(lastIdx, m.index)) });
        }
        // Inside $...$, split on \frac{n}{d} / \dfrac{n}{d}. The capture allows
        // one level of nested braces so a numerator/denominator carrying an
        // exponent (\dfrac{d^{8}}{d^{5}}) is matched whole instead of slipping
        // through as plain text. num/den are run through _parseLatex so their
        // exponents become superscripts before the stacked drawer renders them.
        const mathStr = _restoreDollars(m[1]);
        const fracRe = /\\d?frac\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
        let ml = 0, fm;
        while ((fm = fracRe.exec(mathStr)) !== null) {
            if (fm.index > ml) {
                const v = _parseLatex(mathStr.slice(ml, fm.index));
                if (v.trim()) result.push({ type: 'math', value: v });
            }
            result.push({ type: 'frac', num: _parseLatex(fm[1]), den: _parseLatex(fm[2]) });
            ml = fm.index + fm[0].length;
        }
        if (ml < mathStr.length) {
            const v = _parseLatex(mathStr.slice(ml));
            if (v.trim()) result.push({ type: 'math', value: v });
        }
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < safeText.length) {
        result.push({ type: 'plain', value: _restoreDollars(safeText.slice(lastIdx)) });
    }
    return result;
}

/**
 * Draw a run of plain text at baseline y, honouring **bold** / *italic*
 * markers. Italics fall back to a teal accent colour for the custom fonts
 * (which ship normal+bold only), matching _drawClueInline in pdfExport.js.
 * Returns the X position after the last glyph. Single-line only (no wrapping)
 * — fraction clues are only drawn this way when they fit on one line.
 */
function _drawEmphasisTokens(doc, value, x, y, fontSizePt, pdfFont, color) {
    if (!value) return x;
    let curX = x;
    const re = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*)(?!\*)/g;
    let lastIdx = 0, m;
    const draw = (t, bold, italic) => {
        if (!t) return;
        const useNativeItalic = italic && pdfFont === 'helvetica';
        doc.setFont(pdfFont, bold ? 'bold' : (useNativeItalic ? 'italic' : 'normal'));
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...((italic && !useNativeItalic) ? [13, 148, 136] : color));
        curX = drawSup(doc, t, curX, y, fontSizePt);
    };
    while ((m = re.exec(value)) !== null) {
        if (m.index > lastIdx) draw(value.slice(lastIdx, m.index), false, false);
        if (m[0].startsWith('**')) draw(m[2], true, false);
        else                        draw(m[3], false, true);
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < value.length) draw(value.slice(lastIdx), false, false);
    return curX;
}

/**
 * Draw a clue inline, rendering \frac{n}{d} as a stacked fraction.
 * All plain/math text baselines are at y.
 * The fraction bar sits at y − 40% of the main font height, so fractions
 * straddle the text baseline the same way they do in KaTeX.
 *
 * @returns {{ height, belowBaseline }}
 *   height        — total vertical span (mm), for itemH row calculation
 *   belowBaseline — mm below y used, for positioning the next element
 */
export function drawFractionClue(doc, text, x, y, {
    fontSizePt = 9,
    pdfFont    = 'helvetica',
    color      = [15, 23, 42],
} = {}) {
    const pt2mm  = p => p * 0.352778;
    const fracPt = fontSizePt * 0.86;          // fraction numerals — 86% of main for readability
    const fracH  = pt2mm(fracPt);              // mm height of fraction font
    const barY   = y - pt2mm(fontSizePt) * 0.40; // bar above baseline

    let curX = x;

    for (const seg of _parseClueSegments(text)) {
        if (seg.type === 'plain') {
            // Plain text may carry **bold** / *italic* emphasis markers (incl.
            // the auto-bolded leading verb). Render each run in its own weight so
            // fraction-bearing clues bold their key words like every other clue.
            curX = _drawEmphasisTokens(doc, seg.value, curX, y, fontSizePt, pdfFont, color);
        } else if (seg.type === 'math') {
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(fontSizePt);
            doc.setTextColor(...color);
            if (seg.value) {
                curX = drawSup(doc, seg.value, curX, y, fontSizePt);
            }
        } else {   // frac
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(fracPt);
            doc.setTextColor(...color);

            const nW = measureSup(doc, seg.num, fracPt);
            const dW = measureSup(doc, seg.den, fracPt);
            const fw = Math.max(nW, dW) + 1.5;

            // Numerator — baseline just above bar
            drawSup(doc, seg.num, curX + (fw - nW) / 2, barY - 0.8, fracPt);

            // Fraction bar
            doc.setDrawColor(...color);
            doc.setLineWidth(0.3);
            doc.line(curX, barY, curX + fw, barY);

            // Denominator — baseline below bar
            drawSup(doc, seg.den, curX + (fw - dW) / 2, barY + fracH + 0.5, fracPt);

            curX += fw + 1.0;
        }
    }

    const topExt = pt2mm(fontSizePt) * 0.40 + 0.8 + fracH;  // above baseline
    const botExt = fracH + 0.5;                               // below baseline
    return { height: topExt + botExt, belowBaseline: botExt };
}

// =============================================================
// Export ID — unique 8-char hex derived from seed
// =============================================================

export function makeExportId(seed) {
    // Simple hash of seed value → 8-char hex string
    let h = (seed | 0) ^ 0xDEADBEEF;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = h ^ (h >>> 16);
    return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// =============================================================
// Emoji helpers
// =============================================================

function hasEmoji(str) {
    return /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(str);
}

function textToImgPDF(text, { fontSizePt, bold = false, italic = false, color = [0, 0, 0] }) {
    const SCALE = 3;
    const ptToPx = 96 / 72;
    const pxSize = fontSizePt * ptToPx * SCALE;
    const lineH = Math.ceil(pxSize * 1.4);

    const canvas = document.createElement('canvas');
    canvas.width = 3000;
    canvas.height = lineH;
    const ctx = canvas.getContext('2d');

    const weight = bold ? 'bold' : 'normal';
    const style  = italic ? 'italic' : 'normal';
    ctx.font = `${style} ${weight} ${pxSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = `rgb(${color.join(',')})`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, 0, lineH);

    const w = Math.min(Math.ceil(ctx.measureText(text).width) + 4, 3000);

    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = lineH;
    crop.getContext('2d').drawImage(canvas, 0, 0);

    const mmPerPx = 25.4 / (96 * SCALE);
    return {
        url: crop.toDataURL('image/png'),
        widthMm: w * mmPerPx,
        heightMm: lineH * mmPerPx,
    };
}

/**
 * Draw text at (x, y) where y is the baseline.
 * - Converts $...$ LaTeX to Unicode before rendering.
 * - Falls back to canvas image if text contains emoji.
 */
export function drawText(doc, text, x, y, { fontSizePt, bold = false, italic = false, color = [0, 0, 0], pdfFont = 'helvetica', align = 'left' }) {
    if (!text) return;

    // Convert LaTeX math to unicode text for PDF rendering
    const renderText = latexToText(text);

    if (hasEmoji(renderText)) {
        const img = textToImgPDF(renderText, { fontSizePt, bold, italic, color });
        const imgX = align === 'right' ? x - img.widthMm : x;
        doc.addImage(img.url, 'PNG', imgX, y - img.heightMm, img.widthMm, img.heightMm);
    } else {
        // jsPDF only natively supports italic for helvetica; 
        // custom fonts are only loaded as normal/bold TTFs
        const style = (pdfFont === 'helvetica' && italic)
            ? (bold ? 'bolditalic' : 'italic')
            : (bold ? 'bold' : 'normal');

        doc.setFont(pdfFont, style);
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...color);
        if (_needsRich(renderText)) {
            // Resolve alignment to a left edge, then draw runs with raised
            // superscripts and ASCII-remapped symbols (the font subset lacks
            // both the U+2070 glyphs and √ π θ ∠ ≈ …).
            const w = measureSup(doc, renderText, fontSizePt);
            const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
            drawSup(doc, renderText, left, y, fontSizePt);
        } else {
            doc.text(renderText, x, y, { align });
        }
    }
}

// =============================================================
// Page header
// =============================================================

/**
 * Draw the standard page header.
 * @returns {number} Y position where content should start (below header)
 */
export function drawHeader(ctx, fullTitle, subText, instructions, isKey, setIndicator = '', pScale, exportId = '', instrColor = null) {
    const { doc, PAGE_WIDTH, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;
    const titleScale = ctx.titleScale || 1;

    // Title
    drawText(doc, fullTitle.toUpperCase(), MARGIN, MARGIN + 10 * pScale, {
        fontSizePt: 24 * pScale * titleScale,
        bold: true,
        color: [15, 23, 42],
        pdfFont,
    });

    // Subtitle
    drawText(doc, subText, MARGIN, MARGIN + 17 * pScale, {
        fontSizePt: 10 * pScale * titleScale,
        italic: true,
        color: [100, 116, 139],
        pdfFont,
    });

    // Right-side metadata
    if (isKey) {
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(11 * pScale);
        doc.setTextColor(220, 20, 60);
        doc.text('TEACHER ANSWER KEY', PAGE_WIDTH - MARGIN, MARGIN + 10 * pScale, { align: 'right' });
    } else {
        if (setIndicator) {
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(9 * pScale);
            doc.setTextColor(99, 102, 241);
            doc.text(setIndicator, PAGE_WIDTH - MARGIN, MARGIN + 4 * pScale, { align: 'right' });
        }
        // Name / Class / Date fields in the top-right corner
        const fieldX    = PAGE_WIDTH - 72;
        const lineStart = PAGE_WIDTH - 57;
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(7.5 * pScale);
        doc.setTextColor(120, 130, 150);
        doc.setDrawColor(200, 210, 230);
        doc.setLineWidth(0.5);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.text('NAME:', fieldX, MARGIN + 6 * pScale);
        doc.line(lineStart, MARGIN + 7 * pScale, PAGE_WIDTH - MARGIN, MARGIN + 7 * pScale);
        doc.text('CLASS:', fieldX, MARGIN + 12 * pScale);
        doc.line(lineStart, MARGIN + 13 * pScale, fieldX + 26 * pScale, MARGIN + 13 * pScale);
        doc.text('DATE:', fieldX + 29 * pScale, MARGIN + 12 * pScale);
        doc.line(fieldX + 29 * pScale + doc.getTextWidth('DATE:') + 1.5, MARGIN + 13 * pScale, PAGE_WIDTH - MARGIN, MARGIN + 13 * pScale);
        doc.setLineDashPattern([], 0);
    }

    // Divider line — placed at a fixed offset from margin using base scale
    const dividerY = MARGIN + 22 * scale;
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, dividerY, PAGE_WIDTH - MARGIN, dividerY);

    // Instruction bar with coloured left accent — always starts BELOW the divider
    // Derive bar height from text cap-height so block and text align vertically.
    const iColor      = instrColor || [100, 116, 139];
    const fontSizePt  = 8 * pScale;
    // cap-height ≈ 72% of em; 1 pt = 0.3528 mm
    const capHeightMm = fontSizePt * 0.3528 * 0.72;
    // Descent ≈ 20% of em below baseline
    const descentMm   = fontSizePt * 0.3528 * 0.20;
    // Bar top aligns with text cap top; bar bottom aligns with text baseline
    const instrTextY  = dividerY + 5 * pScale;          // baseline: 5mm gap after divider
    const instrBarTop = instrTextY - capHeightMm;
    const instrH      = capHeightMm + descentMm;         // matches full text body height

    doc.setFillColor(...iColor);
    doc.rect(MARGIN, instrBarTop, 2.5, instrH, 'F');

    drawText(doc, instructions.toUpperCase(), MARGIN + 5.5, instrTextY, {
        fontSizePt,
        bold: true,
        color: iColor,
        pdfFont,
    });

    return instrTextY + 8 * scale;  // generous spacing before first question
}

/**
 * Draw the export ID in the page footer.
 */
export function drawExportIdFooter(ctx, exportId, pScale) {
    if (!ctx.showExportId || !exportId) return;
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, pdfFont } = ctx;
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(180, 180, 180);
    const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.text(`ID: ${exportId}  |  ${today}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5, { align: 'right' });
}
