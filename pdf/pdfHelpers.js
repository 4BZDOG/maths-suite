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
    // Replace $$...$$ and $...$ blocks with converted unicode
    return str
        .replace(/\$\$([^$]+)\$\$/g, (_, m) => _parseLatex(m))
        .replace(/\$([^$]+)\$/g, (_, m) => _parseLatex(m));
}

function _parseLatex(s) {
    return s
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
        // Square root: \sqrt{x} → √(x)
        .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt\s+(\S+)/g,    '√$1')
        // Fractions: \frac{a}{b} → a/b
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
        // Superscripts: ^2 → ²  ^3 → ³  ^n → ^(n)
        .replace(/\^2\b/g,          '²')
        .replace(/\^3\b/g,          '³')
        .replace(/\^\{([^}]+)\}/g,  '^($1)')
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
 * Returns true if the text contains a LaTeX \frac{}{} command.
 */
export function hasFraction(str) {
    return /\\frac\{/.test(str || '');
}

/**
 * Parse a mixed LaTeX clue string into renderable segments.
 * Returns array of:
 *   { type: 'plain', value }   — literal text outside $...$
 *   { type: 'math',  value }   — converted math token (no fraction)
 *   { type: 'frac',  num, den} — a stacked fraction
 */
function _parseClueSegments(text) {
    const result = [];
    const mathRe = /\$([^$]+)\$/g;
    let lastIdx = 0, m;

    while ((m = mathRe.exec(text)) !== null) {
        if (m.index > lastIdx) {
            result.push({ type: 'plain', value: text.slice(lastIdx, m.index) });
        }
        // Inside $...$, split on \frac{n}{d}
        const mathStr = m[1];
        const fracRe = /\\frac\{([^}]+)\}\{([^}]+)\}/g;
        let ml = 0, fm;
        while ((fm = fracRe.exec(mathStr)) !== null) {
            if (fm.index > ml) {
                const v = _parseLatex(mathStr.slice(ml, fm.index));
                if (v.trim()) result.push({ type: 'math', value: v });
            }
            result.push({ type: 'frac', num: fm[1], den: fm[2] });
            ml = fm.index + fm[0].length;
        }
        if (ml < mathStr.length) {
            const v = _parseLatex(mathStr.slice(ml));
            if (v.trim()) result.push({ type: 'math', value: v });
        }
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) {
        result.push({ type: 'plain', value: text.slice(lastIdx) });
    }
    return result;
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
        if (seg.type === 'plain' || seg.type === 'math') {
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(fontSizePt);
            doc.setTextColor(...color);
            if (seg.value) {
                doc.text(seg.value, curX, y);
                curX += doc.getTextWidth(seg.value);
            }
        } else {   // frac
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(fracPt);
            doc.setTextColor(...color);

            const nW = doc.getTextWidth(seg.num);
            const dW = doc.getTextWidth(seg.den);
            const fw = Math.max(nW, dW) + 1.5;

            // Numerator — baseline just above bar
            doc.text(seg.num, curX + (fw - nW) / 2, barY - 0.8);

            // Fraction bar
            doc.setDrawColor(...color);
            doc.setLineWidth(0.3);
            doc.line(curX, barY, curX + fw, barY);

            // Denominator — baseline below bar
            doc.text(seg.den, curX + (fw - dW) / 2, barY + fracH + 0.5);

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
        doc.setFont(pdfFont, italic ? (bold ? 'bolditalic' : 'italic') : (bold ? 'bold' : 'normal'));
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...color);
        doc.text(renderText, x, y, { align });
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
    const { doc, PAGE_WIDTH, MARGIN, scale, pdfFont, showExportId } = ctx;
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
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(8.5 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text('NAME:', PAGE_WIDTH - 72, MARGIN + 8 * pScale);
        doc.setDrawColor(190, 200, 220);
        doc.setLineWidth(0.4);
        doc.setLineDashPattern([1, 1.5], 0);
        doc.line(PAGE_WIDTH - 57, MARGIN + 8 * pScale, PAGE_WIDTH - MARGIN, MARGIN + 8 * pScale);
        doc.text('DATE:', PAGE_WIDTH - 72, MARGIN + 16 * pScale);
        doc.line(PAGE_WIDTH - 57, MARGIN + 16 * pScale, PAGE_WIDTH - MARGIN, MARGIN + 16 * pScale);
        doc.setLineDashPattern([], 0);
    }

    // Divider line — placed at a fixed offset from margin using base scale
    const dividerY = MARGIN + 22 * scale;
    doc.setDrawColor(220, 225, 235);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, dividerY, PAGE_WIDTH - MARGIN, dividerY);

    // Instruction bar with coloured left accent — always starts BELOW the divider
    const iColor   = instrColor || [100, 116, 139];
    const instrH   = 5.5 * pScale;           // height of the coloured accent bar
    const instrBarY = dividerY + 3;          // top of bar: 3 mm gap after divider
    const instrTextY = instrBarY + instrH;   // text baseline at bottom of bar

    doc.setFillColor(...iColor);
    doc.rect(MARGIN, instrBarY, 2, instrH, 'F');

    drawText(doc, instructions.toUpperCase(), MARGIN + 5, instrTextY, {
        fontSizePt: 8 * pScale,
        bold: true,
        color: iColor,
        pdfFont,
    });

    return instrTextY + 5 * scale;
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
    doc.text(`ID: ${exportId}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5, { align: 'right' });
}
