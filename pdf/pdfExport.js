// =============================================================
// pdf/pdfExport.js — PDF export orchestrator (Maths Question Sets Edition)
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';
import { generateMathsQuestions } from '../generators/mathsQuestionGen.js';
import { loadJSPDF, loadFontForPDF, aliasBoldToRegular, FONT_SELECT_MAP } from './pdfFonts.js';
import { buildCtx, drawHeader, drawExportIdFooter, makeExportId, latexToText, hasFraction, drawFractionClue, drawText, setLatexAsciiFallback, drawSup, measureSup, _winAnsiSafe } from './pdfHelpers.js';
import { detectVerb, detectMidVerb, autoBoldVerb } from '../renderers/htmlUtils.js';
// PAYMENTS: import access helpers — replace session.js backend stub when server is ready
import { clampBulkExportCount, FREE_LIMITS } from '../payments/access.js';
import { getOutcomesForTopics, getTopicOutcomeCodes } from '../core/outcomes.js';
import { drawFormulaSheet } from './pdfDrawFormulas.js';
import { drawPrimDiagramPDF } from './pdfPrims.js';
import { preferredHeightMM } from '../renderers/diagramPrims.js';

let isExporting = false;

// ─── PDF Diagram Drawing ──────────────────────────────────────────────────────
// Every diagram is built from the renderer-neutral primitives in
// renderers/diagramPrims.js and drawn by pdf/pdfPrims.js — the same primitives
// the on-screen SVG uses, so preview and print cannot drift.

function _drawDiagramInPDF(doc, diagram, x0, y0, w, h, ps, font) {
    if (!diagram) return;
    // Reset dash + line state before drawing. Rounded joins/caps mirror the
    // on-screen SVG diagrams so the two render as one consistent set.
    doc.setLineDashPattern([], 0);
    if (doc.setLineJoin) doc.setLineJoin('round');
    if (doc.setLineCap)  doc.setLineCap('round');
    drawPrimDiagramPDF(doc, diagram, x0, y0, w, h, ps, font);
    // Restore defaults
    doc.setLineDashPattern([], 0);
    if (doc.setLineJoin) doc.setLineJoin('miter');
    if (doc.setLineCap)  doc.setLineCap('butt');
    doc.setTextColor(15, 23, 42);
    doc.setDrawColor(100, 116, 139);
    doc.setFillColor(255, 255, 255);
}

const TOPIC_COLOURS_RGB = {
    'Number': [59, 130, 246], 'Algebra': [139, 92, 246], 'Geometry': [16, 185, 129],
    'Statistics': [245, 158, 11], 'Financial Maths': [239, 68, 68],
    'Trigonometry': [6, 182, 212], 'Probability': [168, 85, 247],
    'Ratios & Rates': [14, 165, 233],
    'Integers': [59, 130, 246], 'Decimals': [59, 130, 246], 'Rounding': [59, 130, 246],
    'Fractions': [59, 130, 246], 'Percentages': [59, 130, 246],
};

// Diff icons (Unicode) — emoji go via canvas fallback in drawText().
// Ordered to match the project's seedling/bolt/fire convention.
const DIFF_ICONS = { Easy: '🌱', Medium: '⚡', Hard: '🔥' };

/**
 * Draw a "Label: ___ / N = ___ %" score row.
 * Right-anchored: the % glyph ends exactly at `rightX`. The block grows leftward.
 *
 * @param {object} doc        jsPDF
 * @param {number} rightX     Right edge (where % ends)
 * @param {number} y          Baseline Y
 * @param {string} label      Label text (e.g. "Score:" or "TOTAL:")
 * @param {number} count      Total marks (the N in "/ N")
 * @param {object} opts       { fontPt, blankW, gap, color, lineColor, pdfFont }
 * @returns {number}          Left X of the drawn block
 */
function _drawScoreLine(doc, rightX, y, label, count, opts) {
    const { fontPt, blankW, gap, color, lineColor, pdfFont } = opts;
    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);

    const pctStr = '%';
    const sepStr = `/ ${count}  =`;

    // Walk right→left, drawing each piece anchored to its right edge.
    let x = rightX;
    doc.text(pctStr, x, y, { align: 'right' });
    x -= doc.getTextWidth(pctStr) + gap;

    doc.setDrawColor(...lineColor); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(x - blankW, y, x, y);
    doc.setLineDashPattern([], 0);
    x -= blankW + gap;

    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);
    doc.text(sepStr, x, y, { align: 'right' });
    x -= doc.getTextWidth(sepStr) + gap;

    doc.setDrawColor(...lineColor); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
    doc.line(x - blankW, y, x, y);
    doc.setLineDashPattern([], 0);
    x -= blankW + gap;

    doc.setFont(pdfFont, 'bold'); doc.setFontSize(fontPt); doc.setTextColor(...color);
    doc.text(label, x, y, { align: 'right' });
    return x - doc.getTextWidth(label);
}

/**
 * Draw a single answer-key clue with the same bold/italic emphasis the
 * problem-set body uses (auto-bold verb, **bold**, *italic*). Wraps within
 * `maxW`, capped at `maxLines` lines (last line ellipsised if there's more).
 * Returns the number of lines actually drawn.
 */
function _drawKeyClueRich(doc, prefix, clue, x, y, {
    maxW, lineH, fontSizePt, pdfFont, color, maxLines = 3,
}) {
    // Auto-bold the leading verb if not already marked (matches HTML key).
    let rawClue = clue || '';
    if (!rawClue.startsWith('**')) {
        const verb = detectVerb(rawClue);
        if (verb) rawClue = `**${verb}**${rawClue.slice(verb.length)}`;
    }
    // Strip newlines — the key cell is one block; show the stem only.
    rawClue = rawClue.replace(/\n+/g, ' ');

    // Convert LaTeX→unicode while preserving emphasis markers.
    const withLatex = latexToText(
        rawClue.replace(/\*\*([^*]+)\*\*/g, '\x01$1\x01')
               .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1\x02$2\x02')
    )
    .replace(/\x01([^\x01]*)\x01/g, '**$1**')
    .replace(/\x02([^\x02]*)\x02/g, '*$1*');

    const segs = _parseEmphasisSegments(withLatex);
    let curX = x, curY = y, line = 0;

    // Draw the leading "N. " prefix in normal style first.
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(fontSizePt);
    doc.setTextColor(...color);
    doc.text(prefix, curX, curY);
    curX += doc.getTextWidth(prefix);

    const advanceLine = () => {
        line++;
        if (line >= maxLines) return false;
        curY += lineH;
        curX = x;
        return true;
    };

    for (const seg of segs) {
        const isBold   = !!seg.bold;
        const isItalic = !!seg.italic;
        const useNativeItalic = isItalic && pdfFont === 'helvetica';
        const style = isBold ? 'bold' : (useNativeItalic ? 'italic' : 'normal');
        const drawColor = (isItalic && !useNativeItalic) ? [13, 148, 136] : color;
        doc.setFont(pdfFont, style);
        doc.setTextColor(...drawColor);

        const tokens = seg.t.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            const tw = measureSup(doc, token, fontSizePt);
            if (token.trim() === '') { curX += tw; continue; }
            if (curX + tw > x + maxW + 0.5 && curX > x) {
                if (!advanceLine()) {
                    // Out of lines — ellipsise on the previous line and stop.
                    doc.setFont(pdfFont, 'normal');
                    doc.setTextColor(...color);
                    doc.text('…', curX, curY);
                    return line + 1;
                }
                doc.setFont(pdfFont, style);
                doc.setTextColor(...drawColor);
            }
            curX = drawSup(doc, token, curX, curY, fontSizePt);
        }
    }
    return line + 1;
}

/**
 * Parse a clue string (AFTER LaTeX→text conversion but with emphasis markers
 * still present) into an array of {t, bold, italic} segments.
 */
function _parseEmphasisSegments(text) {
    const segs = [];
    // Match ** bold ** and * italic * markers
    const re = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*)(?!\*)/g;
    let lastIdx = 0, m;
    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIdx) segs.push({ t: text.slice(lastIdx, m.index), bold: false, italic: false });
        if (m[0].startsWith('**')) segs.push({ t: m[2], bold: true,  italic: false });
        else                        segs.push({ t: m[3], bold: false, italic: true  });
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) segs.push({ t: text.slice(lastIdx), bold: false, italic: false });
    return segs;
}

/**
 * Convert every $...$ math region in a clue to unicode and wrap it in atomic
 * sentinels (open…close) so the inline renderer can keep each expression on a
 * single line instead of breaking it between operators. Bold/italic emphasis
 * markers are left intact (they live in the prose and may even surround a math
 * region, e.g. the auto-bolded verb "Find $x$:"). Escaped \$ are preserved as
 * literal dollar signs.
 */
function _convertMathAtomic(clue, open, close) {
    const safe = (clue || '').replace(/\\\$/g, '\x00');
    return safe
        .replace(/\$([^$]+)\$/g, (_, inner) =>
            open + latexToText('$' + inner.split('\x00').join('\\$') + '$') + close)
        .split('\x00').join('$');
}

/**
 * Draw clue text inline, switching font weight for **bold** and *italic* markers.
 * LaTeX is converted to unicode before rendering.
 * Returns the Y baseline of the last drawn line.
 *
 * @param {object} doc    jsPDF instance
 * @param {string} clue   Raw clue string (with LaTeX and emphasis markers)
 * @param {number} x      Left edge of text column (mm)
 * @param {number} y      Baseline Y for first line (mm)
 * @param {number} maxW   Maximum line width (mm)
 * @param {number} fontSizePt
 * @param {string} pdfFont
 * @param {number[]} color  [r, g, b]
 * @param {number} lineH  Line height (mm)
 * @returns {number}  Final baseline Y after last drawn character
 */
export function _drawClueInline(doc, clue, x, y, maxW, fontSizePt, pdfFont, color, lineH) {
    // Multi-line clues (stem\nequation[\nequation2]) — draw stem, then each
    // equation line indented on its own line with a full lineH gap.
    const nlIdx = (clue || '').indexOf('\n');
    if (nlIdx !== -1) {
        const stem = clue.slice(0, nlIdx).trim();
        const eqs  = clue.slice(nlIdx + 1).split('\n');
        let curY = _drawClueInline(doc, stem, x, y, maxW, fontSizePt, pdfFont, color, lineH);
        for (const eq of eqs) {
            const trimmed = eq.trim();
            const nextY = curY + lineH;
            if (hasFraction(trimmed)) {
                // An equation-only line carrying \frac{}{} is itself exactly the
                // single-line fraction clue drawFractionClue already stacks
                // correctly (numerator / bar / denominator) — it only stayed
                // unreached before because the *whole* "stem\nequation" clue
                // never counted as single-line at the call site, so it fell
                // through to plain text and flattened to "t/9" instead of a
                // stacked fraction. Use the real reported footprint (not the
                // fixed lineH) to place whatever comes next, or the diagram/
                // working section below would collide with the denominator.
                const r = drawFractionClue(doc, trimmed, x + 2, nextY, { fontSizePt, pdfFont, color });
                curY = nextY + r.belowBaseline;
            } else {
                curY = _drawClueInline(doc, trimmed, x + 2, nextY, maxW - 2, fontSizePt, pdfFont, color, lineH);
            }
        }
        return curY;
    }

    // Auto-bold verb prefixes (Calculate:, Find, etc.) to match HTML treatment.
    // Uses the same two-stage detector as renderers/htmlUtils.js → detectVerb.
    let rawClue = clue;
    if (!rawClue.startsWith('**')) {
        const verb = detectVerb(rawClue);
        if (verb) {
            rawClue = `**${verb}**${rawClue.slice(verb.length)}`;
        } else {
            // Try mid-sentence imperative ("A rectangle has...Determine its area.")
            const mid = detectMidVerb(rawClue);
            if (mid) {
                rawClue = rawClue.slice(0, mid.index)
                        + `**${mid.verb}**`
                        + rawClue.slice(mid.index + mid.verb.length);
            }
        }
    }

    // Convert $...$ math to unicode and mark each expression as an ATOMIC unit
    // (between \x03…\x04), keeping the **bold**/*italic* markers. Emphasis is
    // then parsed on the prepared string; a segment may interleave breakable
    // prose with atomic math runs.
    const ATOM_O = '\x03', ATOM_C = '\x04';
    const prepared = _convertMathAtomic(rawClue, ATOM_O, ATOM_C);
    const segs = _parseEmphasisSegments(prepared);
    let curX = x, curY = y;

    // Bold uses font weight (works on every font we ship). Italic: helvetica
    // supports it natively; the custom fonts (Inter/Roboto/Lora/Comic) only ship
    // normal+bold TTFs, so we substitute a teal accent colour so emphasis stays
    // visible. Re-applied after every Y advance.
    const applyStyle = (seg) => {
        const useNativeItalic = seg.italic && pdfFont === 'helvetica';
        doc.setFont(pdfFont, seg.bold ? 'bold' : (useNativeItalic ? 'italic' : 'normal'));
        doc.setFontSize(fontSizePt);
        doc.setTextColor(...((seg.italic && !useNativeItalic) ? [13, 148, 136] : color));
    };
    // Last-resort break for a token wider than the whole column (e.g. a lone
    // math expression too wide to fit) — split it character-by-character.
    const charBreak = (token, seg) => {
        let buf = '';
        for (const ch of token) {
            const next = buf + ch;
            if (curX + measureSup(doc, next, fontSizePt) > x + maxW + 0.5 && buf) {
                drawSup(doc, buf, curX, curY, fontSizePt);
                curY += lineH; curX = x; applyStyle(seg);
                buf = ch;
            } else { buf = next; }
        }
        if (buf) { curX = drawSup(doc, buf, curX, curY, fontSizePt); }
    };
    // Atomic run: keep the whole math expression on one line — wrap it as a unit
    // to the next line if it doesn't fit, and only char-break if it alone is
    // wider than the column. This stops expressions splitting between operators.
    const drawUnit = (text, seg) => {
        const w = measureSup(doc, text, fontSizePt);
        if (w > maxW + 0.5) { charBreak(text, seg); return; }
        if (curX + w > x + maxW + 0.5 && curX > x) { curY += lineH; curX = x; applyStyle(seg); }
        curX = drawSup(doc, text, curX, curY, fontSizePt);
    };
    // Prose run: wrap on word boundaries.
    const drawWrapped = (text, seg) => {
        const tokens = text.match(/\S+|\s+/g) || [];
        for (const token of tokens) {
            const tw = measureSup(doc, token, fontSizePt);
            if (token.trim() === '') { curX += tw; continue; }
            if (curX + tw > x + maxW + 0.5 && curX > x) { curY += lineH; curX = x; applyStyle(seg); }
            if (tw > maxW + 0.5) { charBreak(token, seg); continue; }
            curX = drawSup(doc, token, curX, curY, fontSizePt);
        }
    };

    for (const seg of segs) {
        applyStyle(seg);
        // A segment may interleave prose with atomic math runs (\x03…\x04).
        const parts = seg.t.split(/(\x03[^\x04]*\x04)/);
        for (const part of parts) {
            if (!part) continue;
            if (part.charCodeAt(0) === 3) drawUnit(part.slice(1, -1), seg);
            else                          drawWrapped(part, seg);
        }
    }
    return curY;
}

const DIFF_RGB = { Easy: [16, 185, 129], Medium: [245, 158, 11], Hard: [239, 68, 68] };

/**
 * Generate a fresh set of questions for one export copy.
 */
function createQuestionSets(cfg, seed) {
    const topics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    if (topics.length === 0) return null;
    const n = 30; // always generate enough to fill the selected page count
    const subOpsFilter = Object.keys(state.selectedSubOps).length > 0 ? state.selectedSubOps : null;
    const showFormulas = state.settings.showFormulas;
    const stage        = state.stage ?? 'Stage 4';
    const includePath  = state.includePath ?? false;
    return {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: n, seed,         showFormulas, stage, includePath }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: n, seed: seed+1, showFormulas, stage, includePath }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: n, seed: seed+2, showFormulas, stage, includePath }),
    };
}

/**
 * Page-wide layout constants for a question page (pure: derived from ctx,
 * settings and the page scale).
 */
function _questionPageMetrics(ctx, pScale) {
    const { PAGE_WIDTH, PAGE_HEIGHT, MARGIN } = ctx;
    const cfg = state.settings;
    const cols = cfg.cols || 2;
    const availW = PAGE_WIDTH - MARGIN * 2;
    return {
        pScale, cols, availW, PAGE_WIDTH, PAGE_HEIGHT, MARGIN,
        colW: (availW - (cols - 1) * 8) / cols,
        showTopic:          cfg.showTopic || false,
        showOutcomeChips:   cfg.psShowOutcomeChips || false,
        showOutcomesHeader: cfg.psShowOutcomesHeader || false,
        capPages:           cfg.psCapPages || 0,
        showDiagrams:       cfg.showDiagrams !== false,   // default true
        stage:              state.stage ?? 'Stage 4',
        DIAG_H:             30 * pScale,                  // allocated height (mm) per diagram
        chipFontPt:         5.5 * pScale,
        // 5 mm working-line pitch matches standard graph paper so algebra
        // students can keep equals-signs aligned across rows.
        workingLineSpacing: 5,
        answerLineSpacing:  9 * pScale,
        itemGap:            6 * pScale,
        // Padding between major item sections (12pt ≈ 4.2mm) — gives the
        // question, working area and answer track distinct visual zones.
        SECTION_PAD:        4.2 * pScale,
        pageBottom:         PAGE_HEIGHT - MARGIN - 10,
    };
}

/**
 * Optional outcomes header strip. Returns the vertical space it consumed
 * (0 when the strip is off or there are no outcomes to list).
 */
function _drawOutcomesStrip(ctx, m, y) {
    const { doc, pdfFont } = ctx;
    const { pScale, MARGIN, availW, stage } = m;
    if (!m.showOutcomesHeader) return 0;
    const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    const outcomes = getOutcomesForTopics(activeTopics, stage);
    if (outcomes.length === 0) return 0;

    const hdr_y = y;
    const hdr_pad = 2 * pScale;
    const fontPt = 5.5 * pScale;
    const rowH = 5.2 * pScale;                       // one row of pills
    const pillH = 3.8 * pScale;
    // Baseline that centres cap-height text vertically inside a pill
    const capH = fontPt * 0.3528 * 0.72;
    const pillBaseline = (rowTop) => rowTop + (rowH - pillH) / 2 + pillH / 2 + capH / 2;
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(fontPt);
    const labelW = doc.getTextWidth('OUTCOMES') + 3 * pScale;
    // Pass 1: flow the pills onto as many rows as they need (never drop an outcome).
    const rows = [[]];
    let rx = MARGIN + hdr_pad + labelW;
    outcomes.forEach(o => {
        const codeW = doc.getTextWidth(o.code) + 3 * pScale;
        if (rx + codeW > MARGIN + availW - hdr_pad && rows[rows.length - 1].length) { rows.push([]); rx = MARGIN + hdr_pad + labelW; }
        rows[rows.length - 1].push({ o, codeW, x: rx });
        rx += codeW + 2 * pScale;
    });
    const hdr_h = rows.length * rowH + 1.6 * pScale;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, hdr_y, availW, hdr_h, 1.5, 1.5, 'FD');
    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(fontPt);
    doc.setTextColor(148, 163, 184);
    doc.text('OUTCOMES', MARGIN + hdr_pad, pillBaseline(hdr_y + 0.8 * pScale));
    // Pass 2: draw the pills
    rows.forEach((row, ri2) => {
        const rowTop = hdr_y + 0.8 * pScale + ri2 * rowH;
        row.forEach(({ o, codeW, x }) => {
            const pillColor = o.appliesAll ? [99, 102, 241] : [16, 185, 129];
            doc.setFillColor(...pillColor.map(c => Math.round(c * 0.15 + 255 * 0.85)));
            doc.setDrawColor(...pillColor.map(c => Math.round(c * 0.3 + 255 * 0.7)));
            doc.roundedRect(x, rowTop + (rowH - pillH) / 2, codeW, pillH, 1, 1, 'FD');
            doc.setTextColor(...pillColor);
            doc.text(o.code, x + 1.5 * pScale, pillBaseline(rowTop));
        });
    });
    // First question must clear the strip by a cap-height or more, and the
    // column divider should start below it rather than cut through it.
    return hdr_h + 6 * pScale;
}

/**
 * Topic pill + outcome-chip descriptors for an item's meta row, with widths
 * measured in the current font. `padW` is the horizontal padding added to the
 * measured text (the height estimate and the drawing pass historically use
 * different paddings — see _measureMetaH).
 */
function _metaPills(ctx, m, item, itemCodes, topicPad, chipPad) {
    const { doc, pdfFont } = ctx;
    const { pScale, chipFontPt } = m;
    const pills = [];
    if (m.showTopic && item.topic) {
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(6 * pScale);
        pills.push({ text: item.topic.toUpperCase(), w: doc.getTextWidth(item.topic.toUpperCase()) + topicPad, style: 'topic' });
    }
    if (itemCodes.length > 0) {
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(chipFontPt);
        itemCodes.forEach(code => pills.push({ text: code, w: doc.getTextWidth(code) + chipPad, style: 'chip' }));
    }
    return pills;
}

/** Height reserved for the combined meta row (topic pill + outcome chips on one centred line). */
function _measureMetaH(ctx, m, item, itemCodes) {
    const { pScale, colW } = m;
    const chipH  = 3.5 * pScale;
    const maxMetaW = colW - 4;
    let lineW = 0, metaRows = 1;
    // Estimate pass pads each pill by 6 mm (the draw pass uses 4 mm).
    _metaPills(ctx, m, item, itemCodes, 6, 6).forEach(p => {
        if (p.style === 'topic') { lineW += p.w; return; }
        if (lineW + p.w > maxMetaW && lineW > 0) { metaRows++; lineW = p.w; }
        else lineW += p.w;
    });
    return 4 * pScale + metaRows * (chipH + 1);
}

/**
 * Measure everything about one question that placement needs: clue lines,
 * fraction handling, working lines, meta row and diagram heights, and the
 * total estimated item height.
 */
function _measureQuestion(ctx, m, item) {
    const { doc, pdfFont } = ctx;
    const { pScale, colW, stage, SECTION_PAD, workingLineSpacing, answerLineSpacing, itemGap } = m;

    // Fraction clues need 3 line-heights (numerator + bar + denominator),
    // but ONLY when the clue is short enough to sit on one line.
    // Long narrative clues that happen to contain \frac (e.g. probability
    // questions) must be word-wrapped normally to avoid column overflow.
    // Reset clue font before splitTextToSize — prior iterations change doc
    // font state, which would cause width calculation to use wrong metrics.
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);
    const clueText   = latexToText(item.clue || '');
    const clueLines  = doc.splitTextToSize(clueText, colW - 14);
    const isFraction = hasFraction(item.clue) && clueLines.length === 1;
    // Multi-line clues (e.g. "Solve:\n$\dfrac{t}{9}=12$") can't take the
    // single-line isFraction path above, but _drawClueInline still stacks
    // any fraction-bearing equation line — each such line needs ~3
    // line-heights (numerator+bar+denominator) instead of 1, same as the
    // single-line case, or the diagram/working section below would
    // overlap the denominator.
    const extraFractionLines = isFraction ? 0
        : (item.clue || '').split('\n').filter(l => hasFraction(l)).length;
    const clueBlockH = isFraction
        ? 3 * 4.5 * pScale
        : (clueLines.length + extraFractionLines * 2) * 4.5 * pScale;

    const workingCount = item.difficulty === 'Hard' ? 3 : item.difficulty === 'Medium' ? 2 : 1;
    // Use item.notes (specific sub-topic key) for outcome lookup — item.topic is broad category
    const itemCodes = m.showOutcomeChips && item.notes ? getTopicOutcomeCodes(item.notes, stage) : [];
    const hasMeta = (m.showTopic && item.topic) || itemCodes.length > 0;
    const metaH = hasMeta ? _measureMetaH(ctx, m, item, itemCodes) : 0;

    const hasDiagram = (m.showDiagrams || !!item.diagram?.essential) && !!item.diagram;
    const diagH = !hasDiagram ? 0
        : preferredHeightMM(item.diagram, colW - 13, pScale, m.DIAG_H);
    const itemH = clueBlockH
        + (hasDiagram ? diagH + SECTION_PAD : 0)
        + (workingCount > 0 ? SECTION_PAD + workingCount * workingLineSpacing + SECTION_PAD : 0)
        + answerLineSpacing + SECTION_PAD + 6 * pScale
        + metaH + itemGap;

    return { isFraction, clueBlockH, workingCount, itemCodes, hasMeta, hasDiagram, diagH, itemH };
}

/** Draw the clue text; returns the Y just below it. */
function _drawClue(ctx, m, q, item, clueX, drawY) {
    const { doc, pdfFont } = ctx;
    const { pScale, colW } = m;
    // isFraction is true only when the clue fits on a single line AND
    // contains \frac — so long narrative fraction clues (e.g. probability
    // complementary questions) use the inline renderer which wraps text
    // and handles *emphasis* markers correctly.
    if (q.isFraction) {
        // Auto-bold the leading verb so fraction clues emphasise it the same
        // way the inline renderer does (drawFractionClue honours ** markers).
        const r = drawFractionClue(doc, autoBoldVerb(item.clue || ''), clueX, drawY, {
            fontSizePt: 9 * pScale, pdfFont, color: [15, 23, 42],
        });
        return drawY + r.belowBaseline + 1;
    }
    // Inline renderer: switches to bold/italic for **word** / *word* markers
    const lastLineY = _drawClueInline(doc, item.clue || '', clueX, drawY,
        colW - 14, 9 * pScale, pdfFont, [15, 23, 42], 4.5 * pScale);
    return lastLineY + 1.5 * pScale;  // small cap-height clearance
}

/** Dotted working lines on a 5 mm pitch; returns the Y below the area. */
function _drawWorkingArea(ctx, m, q, clueX, itemX, y) {
    const { doc, pdfFont } = ctx;
    const { pScale, SECTION_PAD, workingLineSpacing, colW } = m;
    let nextY = y;
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(6.5 * pScale);
    doc.setTextColor(160, 170, 185);
    doc.text('Working', clueX, nextY);
    nextY += SECTION_PAD;
    for (let wl = 0; wl < q.workingCount; wl++) {
        nextY += workingLineSpacing;
        doc.setDrawColor(215, 222, 235);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([0.5, 1.5], 0);
        doc.line(clueX, nextY, itemX + colW - 4, nextY);
        doc.setLineDashPattern([], 0);
    }
    return nextY + SECTION_PAD;
}

/** Right-aligned "Answer: ____ unit" marking track; returns the Y below it. */
function _drawAnswerTrack(ctx, m, item, itemX, y) {
    const { doc, pdfFont } = ctx;
    const { pScale, colW, answerLineSpacing, SECTION_PAD } = m;
    const lineY = y + answerLineSpacing;
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8 * pScale);
    doc.setTextColor(100, 116, 139);
    // item.unit is only populated for Easy measurement questions in
    // the generator; printing it as a hint after the answer line tells
    // students whether to write cm² / m / ° / etc.
    const unitText  = item.unit ? ` ${latexToText(item.unit)}` : '';
    const unitW     = unitText ? measureSup(doc, unitText, 8 * pScale) + 1 : 0;
    // Right edge of the line is the column edge; label sits to the
    // left of a fixed-length track so teachers can scan answers in a
    // consistent vertical "rail" down the page.
    const rightEdge   = itemX + colW - 4 - unitW;
    const trackLength = Math.min(46 * pScale, colW - 26 - unitW);
    const trackStart  = rightEdge - trackLength;
    doc.text('Answer:', trackStart - 2, lineY, { align: 'right' });
    doc.setDrawColor(150, 160, 180);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([0.8, 1.2], 0);
    doc.line(trackStart, lineY, rightEdge, lineY);
    doc.setLineDashPattern([], 0);
    if (unitText) {
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(8 * pScale);
        doc.setTextColor(100, 116, 139);
        drawSup(doc, unitText.trim(), rightEdge + 1.5, lineY, 8 * pScale);
    }
    return lineY + SECTION_PAD;
}

/**
 * Meta row: topic pill + outcome chips, centred in the column. Muted
 * styling — these chips are administrative metadata and should not compete
 * with the question text. Returns the Y below the row(s).
 */
function _drawMetaRow(ctx, m, item, q, itemX, y) {
    const { doc, pdfFont } = ctx;
    const { pScale, colW, chipFontPt } = m;
    let nextY = y + 2 * pScale;
    const chipH = 3.5 * pScale;
    const gap   = 2;
    // Ordered pill list: topic first, then outcome chips
    const pills = _metaPills(ctx, m, item, q.itemCodes, 4, 4);
    pills.forEach(p => { if (p.style === 'topic') p.rgb = TOPIC_COLOURS_RGB[item.topic] || [100, 116, 139]; });
    // Wrap pills into rows, then centre each row in the column
    const colCenterX = itemX + colW / 2;
    const maxRowW    = colW - 4;
    const pillRows = [];
    let curRow = [], curRowW = 0;
    for (const p of pills) {
        const needed = curRowW > 0 ? gap + p.w : p.w;
        if (curRowW > 0 && curRowW + gap + p.w > maxRowW) {
            pillRows.push(curRow);
            curRow  = [p];
            curRowW = p.w;
        } else {
            curRow.push(p);
            curRowW += needed;
        }
    }
    if (curRow.length > 0) pillRows.push(curRow);
    for (const r of pillRows) {
        const totalW = r.reduce((s, p) => s + p.w, 0) + gap * (r.length - 1);
        let px = colCenterX - totalW / 2;
        for (const p of r) {
            const pillTop = nextY - 2.5 * pScale;
            if (p.style === 'topic') {
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(6 * pScale);
                doc.setFillColor(
                    Math.round(255 * 0.88 + p.rgb[0] * 0.12),
                    Math.round(255 * 0.88 + p.rgb[1] * 0.12),
                    Math.round(255 * 0.88 + p.rgb[2] * 0.12)
                );
                doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'F');
                doc.setDrawColor(...p.rgb);
                doc.setLineWidth(0.2);
                doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'S');
                doc.setTextColor(...p.rgb);
                doc.text(p.text, px + 2, nextY);
            } else {
                // Outcome code chip — neutral slate so it reads as
                // metadata, not a coloured callout.
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(chipFontPt);
                doc.setFillColor(243, 245, 250);
                doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'F');
                doc.setDrawColor(210, 218, 230);
                doc.setLineWidth(0.15);
                doc.roundedRect(px, pillTop, p.w, chipH, 1, 1, 'S');
                doc.setTextColor(120, 130, 150);
                doc.text(p.text, px + 2, nextY);
            }
            px += p.w + gap;
        }
        nextY += chipH + 1;
    }
    return nextY - 1;  // remove trailing inter-row gap
}

/**
 * Placement. COLUMN-MAJOR fill (newspaper style): stack items down the
 * current column until one won't fit, then move to the next column; when the
 * last column on the page is full, break to a new page. This keeps the
 * question numbers continuous down a column and then down the next — unlike
 * shortest-column balancing, which interleaves 1,3,5 / 2,4,6.
 *
 * `flow` carries { cy, col, colY, pagesUsed, pageStartY }. Returns false when
 * the page cap stops further questions, true when the item can be drawn.
 */
function _placeItem(ctx, m, flow, itemH, exportId) {
    const { doc, drawWatermark, scale } = ctx;
    const { cols, MARGIN, colW, pageBottom, capPages } = m;
    const breakToNewPage = () => {
        flow.pagesUsed++;
        if (cols === 2) {
            _drawColumnDivider(doc, MARGIN, colW, flow.pageStartY, Math.max(flow.colY[0], flow.colY[1]));
        }
        drawExportIdFooter(ctx, exportId, m.pScale);
        doc.addPage();
        drawWatermark();
        flow.pageStartY = MARGIN + 15 * scale;
        flow.cy         = flow.pageStartY;
        flow.colY       = [flow.pageStartY, flow.pageStartY];
        flow.col        = 0;
    };

    if (cols === 2) {
        if (flow.colY[flow.col] + itemH > pageBottom) {
            if (flow.col === 0) {
                // Left column full → continue at the top of the right column.
                flow.col = 1;
            } else {
                // Both columns full → next page (subject to the page cap).
                if (capPages > 0 && flow.pagesUsed >= capPages) return false;
                breakToNewPage();
            }
        }
    } else if (flow.cy + itemH > pageBottom) {
        if (capPages > 0 && flow.pagesUsed >= capPages) return false;
        breakToNewPage();
    }
    return true;
}

/**
 * Draw a question page (Easy / Medium / Hard) in PDF.
 * Returns the number of questions that did NOT fit (overflow count).
 */
function drawQuestionPage(ctx, questions, startY, pScale, exportId, startNum = 1) {
    if (!questions || !questions.length) return 0;
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;
    const m = _questionPageMetrics(ctx, pScale);
    const { cols, colW, itemGap } = m;

    // Per-column Y trackers (2-column mode); cy tracks the single column / deepest extent.
    const flow = { cy: startY, col: 0, colY: [startY, startY], pagesUsed: 1, pageStartY: startY };

    const strip = _drawOutcomesStrip(ctx, m, flow.cy);
    if (strip > 0) {
        flow.cy += strip;
        flow.colY = [flow.cy, flow.cy];   // header consumed space; reset both column trackers
        flow.pageStartY = flow.cy;        // content begins below the outcomes strip
    }
    let overflowCount = 0;

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(9 * pScale);

    for (let i = 0; i < questions.length; i++) {
        const item = questions[i];
        const q = _measureQuestion(ctx, m, item);

        if (!_placeItem(ctx, m, flow, q.itemH, exportId)) {
            overflowCount = questions.length - i;
            break;
        }

        const itemX = flow.col === 0 ? MARGIN : MARGIN + colW + 8;
        const drawY = cols === 2 ? flow.colY[flow.col] : flow.cy;

        // ── Question number (inline with clue) ───────────────────────
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(9 * pScale);
        doc.setTextColor(100, 116, 139);
        doc.text(`${startNum + i}.`, itemX, drawY);

        const clueX = itemX + 9;
        let nextY = _drawClue(ctx, m, q, item, clueX, drawY) + m.SECTION_PAD;

        // ── Geometry diagram ─────────────────────────────────────────
        if (q.hasDiagram) {
            _drawDiagramInPDF(doc, item.diagram, itemX + 9, nextY, colW - 13, q.diagH, pScale, pdfFont);
            nextY += q.diagH + m.SECTION_PAD;
        }

        // ── Working area: 5 mm grid pitch for algebra alignment ─────
        if (q.workingCount > 0) nextY = _drawWorkingArea(ctx, m, q, clueX, itemX, nextY);

        // ── Answer line: right-aligned marking track ─────────────────
        nextY = _drawAnswerTrack(ctx, m, item, itemX, nextY);

        // ── Meta row ─────────────────────────────────────────────────
        if (q.hasMeta) nextY = _drawMetaRow(ctx, m, item, q, itemX, nextY);

        const actualItemH = nextY - drawY + itemGap;

        if (cols === 2) {
            flow.colY[flow.col] += actualItemH;
            // Track the deepest column for divider/page-break geometry.
            flow.cy = Math.max(flow.colY[0], flow.colY[1]);
        } else {
            flow.cy += actualItemH;
        }
    }

    // Final page: draw the divider down to the deepest column extent.
    if (cols === 2) {
        _drawColumnDivider(doc, MARGIN, colW, flow.pageStartY, Math.max(flow.colY[0], flow.colY[1]));
    }

    // Score footer — right-aligned "Score: ___ / N = ___ %"
    const placedCount = questions.length - overflowCount;
    _drawScoreLine(doc, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 3 * pScale,
        'Score:', placedCount, {
            fontPt:    7.5 * pScale,
            blankW:    18 * pScale,
            gap:        3 * pScale,
            color:     [120, 130, 150],
            lineColor: [150, 160, 180],
            pdfFont,
        });

    drawExportIdFooter(ctx, exportId, pScale);
    return overflowCount;
}

function _drawColumnDivider(doc, MARGIN, colW, fromY, toY) {
    doc.setDrawColor(200, 205, 220);
    doc.setLineWidth(0.6);
    doc.setLineDashPattern([], 0);
    doc.line(MARGIN + colW + 4, fromY, MARGIN + colW + 4, toY);
}


/**
 * Draw the answer key page showing all 3 difficulty sets.
 */
function drawKeyPage(ctx, sets, startY, pScale, exportId, startNums = {}) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, scale, pdfFont } = ctx;
    pScale = pScale || scale;

    const cfg              = state.settings;
    const showOutcomesHdr  = cfg.psShowOutcomesHeader  || false;
    const stage            = state.stage ?? 'Stage 4';
    const availW           = PAGE_WIDTH - MARGIN * 2;

    let cy = startY;

    // ── Outcomes summary header (only on key page) ────────────
    if (showOutcomesHdr) {
        const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
        const outcomes = getOutcomesForTopics(activeTopics, stage);
        if (outcomes.length > 0) {
            const headerPad  = 2.5 * pScale;
            const lineH      = 4.2 * pScale;
            const titleH     = 5 * pScale;
            const descFontPt = 6 * pScale;

            // Pass 1: pre-compute per-row data so we can size the border rect correctly
            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(descFontPt);
            const rows = outcomes.map(o => {
                const codeW    = doc.getTextWidth(o.code) + 4;
                const descText = `${o.contentLabel} — ${o.statement}`;
                const descW    = availW - headerPad * 2 - codeW - 3;
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(descFontPt);
                const lines = doc.splitTextToSize(descText, descW);
                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(descFontPt);
                return { o, codeW, descText, descW, lines };
            });
            const totalH = titleH + rows.reduce((s, r) => s + r.lines.length * lineH, 0) + headerPad * 2;

            doc.setDrawColor(99, 102, 241);
            doc.setLineWidth(0.3);
            doc.roundedRect(MARGIN, cy, availW, totalH, 2, 2, 'S');

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(6.5 * pScale);
            doc.setTextColor(99, 102, 241);
            doc.text(`NESA ${stage} Outcomes`, MARGIN + headerPad, cy + headerPad + 3.5 * pScale);

            // Pass 2: draw each row
            let oy = cy + headerPad + titleH;
            rows.forEach(({ o, codeW, lines }) => {
                const isWM      = o.appliesAll;
                const pillColor = isWM ? [22, 163, 74] : [99, 102, 241];

                doc.setFont(pdfFont, 'bold');
                doc.setFontSize(descFontPt);
                doc.setFillColor(isWM ? 240 : 239, isWM ? 253 : 238, isWM ? 244 : 255);
                doc.roundedRect(MARGIN + headerPad, oy - 2.8 * pScale, codeW, 3.5 * pScale, 1, 1, 'F');
                doc.setTextColor(...pillColor);
                doc.text(o.code, MARGIN + headerPad + 1.5, oy);

                const descX = MARGIN + headerPad + codeW + 3;
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(descFontPt);
                doc.setTextColor(80, 90, 110);
                lines.forEach((line, li) => doc.text(line, descX, oy + li * lineH));

                oy += lines.length * lineH;
            });

            cy += totalH + 5 * pScale;
        }
    }

    const sections = [
        { key: 'Easy',   rgb: DIFF_RGB.Easy,   questions: sets.easy   || [] },
        { key: 'Medium', rgb: DIFF_RGB.Medium,  questions: sets.medium || [] },
        { key: 'Hard',   rgb: DIFF_RGB.Hard,    questions: sets.hard   || [] },
    ].filter(s => s.questions.length > 0);

    if (sections.length === 0) { drawExportIdFooter(ctx, exportId, pScale); return; }

    const colW = (availW - (sections.length - 1) * 6) / sections.length;

    sections.forEach((sec, si) => {
        const cx = MARGIN + si * (colW + 6);

        // Section title — use drawText() so emoji renders via canvas fallback
        const icon  = DIFF_ICONS[sec.key] || '';
        const label = `${icon} ${sec.key.toUpperCase()}`;
        drawText(doc, label, cx, cy, {
            fontSizePt: 9 * pScale, bold: true, color: sec.rgb, pdfFont,
        });
        doc.setDrawColor(...sec.rgb);
        doc.setLineWidth(0.4);
        doc.line(cx, cy + 2 * scale, cx + colW, cy + 2 * scale);

        let ky = cy + 8 * pScale;

        const showWorkedPDF = cfg.keyShowWorked || false;
        // Reserve a fixed right-hand strip for the answer so all answers
        // align in a vertical "marking rail" and clue text wraps cleanly
        // to the left of it instead of being truncated with an ellipsis.
        const ansStripW = Math.max(18 * pScale, colW * 0.32);
        const clueW     = colW - ansStripW - 3;
        const lineH     = 3.4 * pScale;
        // First question number for this section — keeps the key's numbering
        // continuous across difficulties, matching the worksheet pages.
        const secStart  = startNums[sec.key] || 1;

        // Let clues wrap onto as many lines as the page can afford: when a key
        // is sparse (the usual case) nothing is truncated; when it is dense the
        // allowance shrinks so every answer still fits on the page.
        const keyBottom  = PAGE_HEIGHT - MARGIN - 12 * pScale;
        const perRowMM   = (keyBottom - ky) / Math.max(1, sec.questions.length);
        const keyMaxLines = Math.max(2, Math.min(6, Math.floor((perRowMM - 1.4 * pScale - (showWorkedPDF ? 7 * pScale : 0)) / lineH)));

        sec.questions.forEach((q, i) => {
            if (ky + 6 * pScale > keyBottom) return;

            const ansText  = latexToText(String(q.answerDisplay || q.answer || ''));
            const qNum = secStart + i;

            // Bold verb + *italic* emphasis + **bold** — matches the HTML answer key
            // and the PDF problem-set body. Returns how many lines it really drew,
            // which (not a plain-text estimate) decides the row height below.
            const linesDrawn = _drawKeyClueRich(doc, `${qNum}. `, q.clue || '', cx, ky, {
                maxW: clueW, lineH, fontSizePt: 7 * pScale, pdfFont,
                color: [100, 116, 139], maxLines: keyMaxLines,
            });

            doc.setFont(pdfFont, 'bold');
            doc.setFontSize(8 * pScale);
            doc.setTextColor(...sec.rgb);
            // Right-align manually so superscript exponents (drawn smaller/raised
            // to survive the font subset) still sit flush to the marking rail.
            const ansW = measureSup(doc, ansText, 8 * pScale);
            let blockH = Math.max(linesDrawn * lineH, 5 * pScale);
            if (ansW > ansStripW - 1) {
                // Too wide for the marking rail: give the answer its own line under the clue
                // instead of letting it run over the clue text.
                drawSup(doc, ansText, cx + colW - ansW, ky + linesDrawn * lineH + 0.6 * pScale, 8 * pScale);
                blockH += lineH + 0.6 * pScale;
            } else {
                drawSup(doc, ansText, cx + colW - ansW, ky, 8 * pScale);
            }

            // Worked solution — shown when "Show worked" is toggled on.
            // Normal weight (not italic): the custom fonts ship only normal+bold,
            // so italic would fall back inconsistently — distinction comes from
            // the slate colour and indent instead.
            if (showWorkedPDF && q.worked) {
                const workedText = latexToText(q.worked);
                doc.setFont(pdfFont, 'normal');
                doc.setFontSize(6.5 * pScale);
                doc.setTextColor(71, 85, 105);          // slate-600 — legible
                const workedLines = doc.splitTextToSize(workedText, colW - 4).slice(0, 2);
                workedLines.forEach((line, li) => drawSup(doc, line, cx + 2, ky + blockH + li * 3.3 * pScale, 6.5 * pScale));
                blockH += workedLines.length * 3.3 * pScale + 1;
            }

            // Separator sits just below the last baseline of this row (clear of its
            // descenders) and the next row starts a cap-height + padding below it, so
            // the rule never cuts through either row's text.
            const lastBaseline = ky + blockH - lineH;
            const sepY = lastBaseline + 1.9 * pScale;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.1);
            doc.line(cx, sepY, cx + colW, sepY);

            ky = sepY + 3.6 * pScale;
        });

        // Per-section score sits directly under the last question in this
        // column so each "/ N" reads as the marker for the column above it.
        // Clamp so it can't collide with the centered TOTAL row at the very
        // bottom of the page.
        const secTotal     = sec.questions.length;
        const scoreFontPt  = 7   * pScale;
        const scoreBlankW  = 14  * pScale;
        const maxScoreY    = PAGE_HEIGHT - MARGIN - 9 * pScale;
        const sectionRowY  = Math.min(ky + 3 * pScale, maxScoreY);
        doc.setDrawColor(...sec.rgb); doc.setLineWidth(0.3); doc.setLineDashPattern([0.5, 1], 0);
        doc.line(cx, sectionRowY, cx + scoreBlankW, sectionRowY);
        doc.setLineDashPattern([], 0);
        doc.setFont(pdfFont, 'bold'); doc.setFontSize(scoreFontPt); doc.setTextColor(...sec.rgb);
        doc.text(`/ ${secTotal}`, cx + scoreBlankW + 2, sectionRowY);
    });

    // Overall total: "TOTAL: ___ / N = ___ %", right-aligned to the page edge
    const totalQ = sections.reduce((s, sec) => s + sec.questions.length, 0);
    _drawScoreLine(doc, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - 3 * pScale,
        'TOTAL:', totalQ, {
            fontPt:    8 * pScale,
            blankW:   18 * pScale,
            gap:       3 * pScale,
            color:     [80, 90, 110],
            lineColor: [120, 130, 150],
            pdfFont,
        });

    drawExportIdFooter(ctx, exportId, pScale);
}

// =============================================================
// DOM-free export core
//
// Everything below touches only a jsPDF document, `state` and the generators,
// so the same code path runs in the browser (exportPDF) and under Node
// (test/pdf-golden.test.mjs).
// =============================================================

/** Create the jsPDF document for the configured paper size. */
export function createExportDoc(jsPDF, cfg) {
    const paperSize = cfg.paperSize || 'a4';
    return new jsPDF({ unit: 'mm', format: paperSize, orientation: 'portrait' });
}

/**
 * Bundle everything a set needs to be drawn: the document, drawing context,
 * page selection and per-page font scales. `env.setFont()` rebuilds the
 * context after a custom font has been registered.
 */
export function createExportEnv(doc, { cfg = state.settings, pdfFont = 'helvetica', wmImg = null, activeTopics = null, selectedPages = null } = {}) {
    const isLetter    = (cfg.paperSize || 'a4') === 'letter';
    const dims = { PAGE_WIDTH: isLetter ? 215.9 : 210, PAGE_HEIGHT: isLetter ? 279.4 : 297, MARGIN: 15 };
    const scale = parseFloat(cfg.globalFontScale) || 1;
    const getPScale = (key) => {
        const val = cfg.scales?.[key];
        return scale * (val !== undefined ? parseFloat(val) || 1 : 1);
    };
    const pageOrder = cfg.pageOrder || ['easy', 'medium', 'hard', 'key'];
    const env = {
        doc, cfg, dims, scale, getPScale, wmImg,
        activeTopics: activeTopics || Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]),
        selectedPages: selectedPages || pageOrder.filter(p => cfg.opts?.[p]),
        isFirstPage: true,
        ctx: null,
        setFont(font) {
            env.ctx = buildCtx(doc, font, wmImg, scale, dims, cfg);
        },
    };
    env.setFont(pdfFont);
    // Derive cap from pages-per-difficulty selector (state.questionsPerSet is 1 or 2)
    cfg.psCapPages = state.questionsPerSet || 1;
    return env;
}

/**
 * Draw one export copy (set number i of count) into env.doc: the optional
 * formula sheet, each selected page in order, and any duplex padding page.
 */
export function drawExportSet(env, i, count, exportBase, { title = 'Maths Quiz', sub = '', makeSets = createQuestionSets } = {}) {
    const { doc, cfg, dims, getPScale, activeTopics, selectedPages, ctx } = env;
    const { PAGE_WIDTH, PAGE_HEIGHT, MARGIN } = dims;
    const pv = state.generatedSets;
    const havePreview = pv && (pv.easy?.length || pv.medium?.length || pv.hard?.length);

    cfg.exportCount = (cfg.exportCount || 0) + 1;
    // Set #1 reuses the on-screen preview questions exactly (incl. rerolls
    // and locked slots); alternates are reproducible offsets of its seed.
    let sets, seed;
    if (i === 0 && havePreview) {
        sets = pv;
        seed = exportBase;
    } else {
        seed = exportBase + i * 1_000_000;
        sets = makeSets(cfg, seed);
    }
    const exportId = makeExportId(seed);
    if (!sets) return;

    const setIndicator = count > 1 ? `SET ${i + 1}` : '';
    const pagesBeforeSet = env.isFirstPage ? 0 : doc.getNumberOfPages();

    const addPage = () => {
        if (!env.isFirstPage) doc.addPage();
        env.isFirstPage = false;
        ctx.drawWatermark();
    };

    // Optional formula reference sheet — one page per set, prepended before question pages
    if (cfg.showFormulaSheet) {
        addPage();
        drawFormulaSheet(ctx, activeTopics, getPScale('easy'));
    }

    // Track visible question counts per difficulty.
    // Pages not in selectedPages default to 0 so their answers are excluded from the key.
    const visibleCounts = {
        easy:   selectedPages.includes('easy')   ? null : 0,
        medium: selectedPages.includes('medium') ? null : 0,
        hard:   selectedPages.includes('hard')   ? null : 0,
    };

    // Continuous numbering across difficulties (Easy 1.., Medium n+1..,
    // Hard ..). Computed canonically (easy→medium→hard) from visible
    // counts; falls back to full length for a difficulty not yet drawn
    // (only matters under a non-default page order). The answer key
    // uses the same helper so its numbers match the worksheet.
    const startNumFor = (diff) => {
        const cnt = (k) => visibleCounts[k] ?? (sets[k] || []).length;
        if (diff === 'easy')   return 1;
        if (diff === 'medium') return 1 + cnt('easy');
        return 1 + cnt('easy') + cnt('medium');   // hard
    };

    const BANDS = {
        easy:   { instr: '🌱 EASY — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.',   rgb: [16, 185, 129] },
        medium: { instr: '⚡ MEDIUM — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.', rgb: [245, 158, 11] },
        hard:   { instr: '🔥 HARD — SOLVE EACH PROBLEM AND WRITE YOUR ANSWER.',   rgb: [239, 68, 68] },
    };

    for (const pType of selectedPages) {
        if (BANDS[pType]) {
            addPage();
            const ps = getPScale(pType);
            const sy = drawHeader(ctx, title, sub, BANDS[pType].instr, false, setIndicator, ps, exportId, BANDS[pType].rgb);
            const overflow = drawQuestionPage(ctx, sets[pType], sy, ps, exportId, startNumFor(pType));
            visibleCounts[pType] = (sets[pType] || []).length - overflow;

        } else if (pType === 'key') {
            addPage();
            const ps = getPScale('key');
            const sy = drawHeader(ctx, title, sub, 'ANSWER KEY', true, setIndicator, ps, exportId);
            // Always trim answer key to only questions that were rendered on question pages
            const keySets = {
                easy:   (sets.easy   || []).slice(0, visibleCounts.easy   ?? (sets.easy   || []).length),
                medium: (sets.medium || []).slice(0, visibleCounts.medium ?? (sets.medium || []).length),
                hard:   (sets.hard   || []).slice(0, visibleCounts.hard   ?? (sets.hard   || []).length),
            };
            const keyStartNums = {
                Easy:   startNumFor('easy'),
                Medium: startNumFor('medium'),
                Hard:   startNumFor('hard'),
            };
            drawKeyPage(ctx, keySets, sy, ps, exportId, keyStartNums);
        }
    }

    // Back-to-back printing: a blank page keeps the next set on a fresh sheet.
    // 'odd' pads only sets with an odd page count; 'always' adds one after every set.
    // Never after the final set (nothing follows it).
    if (i < count - 1 && !env.isFirstPage) {
        const setPages = doc.getNumberOfPages() - pagesBeforeSet;
        const mode = cfg.blankPageMode || 'off';
        if (mode === 'always' || (mode === 'odd' && setPages % 2 === 1)) {
            doc.addPage();
            // "Leave blank pages fully empty" omits the faint footer line.
            if (!cfg.blankPageEmpty) {
                doc.setFont(ctx.pdfFont || 'helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(200, 200, 200);
                doc.text('This page is intentionally left blank', PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN, { align: 'center' });
            }
        }
    }
}

/** Synchronous whole-export driver (used by tests; the UI loops itself to show progress). */
export function drawExportSync(doc, { count = 1, exportBase = 1, title = 'Maths Quiz', sub = '', pdfFont = 'helvetica', makeSets } = {}) {
    const env = createExportEnv(doc, { pdfFont });
    for (let i = 0; i < count; i++) drawExportSet(env, i, count, exportBase, { title, sub, makeSets });
    return env;
}

export async function exportPDF() {
    if (isExporting) return;

    syncSettingsFromDOM();

    const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    if (activeTopics.length === 0) {
        showToast('Select at least one topic to export.', 'error');
        return;
    }

    isExporting = true;
    const exportBtn = document.getElementById('export-btn-main');
    const exportBtnOrigHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';
    }

    const cfg = state.settings;
    const pageOrder   = cfg.pageOrder || ['easy', 'medium', 'hard', 'key'];
    const selections  = cfg.opts;
    const selectedPages = pageOrder.filter(p => selections[p]);

    if (selectedPages.length === 0) {
        showToast('Select at least one page.', 'error');
        isExporting = false;
        if (exportBtn) { exportBtn.disabled = false; exportBtn.innerHTML = exportBtnOrigHTML; }
        return;
    }

    const diffInPDF = ['easy', 'medium', 'hard'].filter(p => selectedPages.includes(p));
    if (diffInPDF.length < 3) {
        const skipped = ['Easy', 'Medium', 'Hard'].filter((_, i) => !diffInPDF.includes(['easy', 'medium', 'hard'][i]));
        showToast(`PDF will only include ${diffInPDF.map(d => d[0].toUpperCase() + d.slice(1)).join(' + ')} difficulty. Uncheck fix: Page Order → tick ${skipped.join(', ')}.`, 'warning');
    }

    const L = document.getElementById('loading-overlay');
    const T = document.getElementById('loading-text');
    const B = document.getElementById('loading-progress');

    const title    = cfg.title || 'Maths Quiz';
    const sub      = cfg.sub   || '';
    // Clamp the requested bulk count to the universal hard ceiling and tier limit.
    const count    = (() => {
        const el = document.getElementById('bulkCount');
        const raw = el ? Math.max(1, parseInt(el.value, 10) || 1) : 1;
        const ceiling = Math.min(raw, FREE_LIMITS.BULK_EXPORT_MAX);
        const clamped = clampBulkExportCount(ceiling);
        if (clamped < raw) {
            const msg = clamped < ceiling
                ? `Bulk export limited to ${clamped} on the free plan.`
                : `Bulk export capped at ${FREE_LIMITS.BULK_EXPORT_MAX} copies.`;
            showToast(msg, 'warning');
        }
        return clamped;
    })();
    const filename = (() => { const el = document.getElementById('exportFilename'); return el ? el.value : 'MathsQuiz'; })()
        .replace(/[^a-z0-9-_]/gi, '_');

    if (L) { L.style.display = 'flex'; L.style.opacity = '1'; }
    if (T) T.innerText = 'Starting Export...';
    if (B) B.style.width = '0%';

    try {
        if (T) T.innerText = 'Loading PDF Engine...';
        const jspdfModule = await loadJSPDF();
        const { jsPDF } = jspdfModule;

        const doc = createExportDoc(jsPDF, cfg);
        let pdfFont = 'helvetica';

        let wmImg = null;
        if (state.watermarkSrc) {
            wmImg = await new Promise(res => {
                const img = new Image();
                const timeout = setTimeout(() => res(null), 8000);
                img.onload  = () => { clearTimeout(timeout); res(img); };
                img.onerror = () => { clearTimeout(timeout); res(null); };
                img.src = state.watermarkSrc;
            });
        }

        const env = createExportEnv(doc, { cfg, pdfFont, wmImg, activeTopics, selectedPages });

        const fontSelectVal = cfg.font || "'Inter', sans-serif";
        const fontName = FONT_SELECT_MAP[fontSelectVal];
        if (fontName) {
            if (T) T.innerText = 'Loading fonts...';
            try {
                // One retry each: a single CDN hiccup shouldn't silently downgrade the export.
                const ok = (await loadFontForPDF(doc, fontName, 400)) || (await loadFontForPDF(doc, fontName, 400));
                if (ok) {
                    pdfFont = fontName;
                    const okBold = (await loadFontForPDF(doc, fontName, 700)) || (await loadFontForPDF(doc, fontName, 700));
                    // No bold face? Alias the regular face as bold. Without this jsPDF falls
                    // back to a serif font for every bold run (title, verbs, headings).
                    if (!okBold) aliasBoldToRegular(doc, fontName);
                }
            } catch (e) { console.warn('Unexpected font load error:', e); }
            if (pdfFont === 'helvetica') {
                showToast(`Couldn't load the "${fontName}" font — exporting with the standard PDF font instead.`, 'warning');
            }
        }
        env.setFont(pdfFont);

        // If we fell back to the standard (helvetica) font — e.g. the font CDN
        // was blocked — switch latexToText to ASCII-safe output so π, √ and
        // superscripts don't render as mojibake.
        setLatexAsciiFallback(pdfFont === 'helvetica');

        // Capture the base seed once so all alternate sets are consistent
        // offsets of it, even if the loop yields to the event loop between iterations.
        const exportBase = cfg.previewSeed ?? Date.now();

        for (let i = 0; i < count; i++) {
            if (T) T.innerText = `Generating Set ${i + 1}/${count}`;
            if (B) B.style.width = Math.round((i / count) * 100) + '%';
            await new Promise(r => setTimeout(r, 10));
            drawExportSet(env, i, count, exportBase, { title, sub });
        }

        if (T) T.innerText = 'Saving PDF...';
        if (B) B.style.width = '100%';
        await new Promise(r => setTimeout(r, 100));

        doc.save(filename + '.pdf');

        const totalPages = doc.getNumberOfPages();
        const copyMsg = count === 1 ? '1 copy' : `${count} copies`;
        const pageMsg = totalPages === 1 ? '1 page' : `${totalPages} pages`;
        showToast(`Exported ${copyMsg} · ${pageMsg}`, 'success');

    } catch (e) {
        console.error(e);
        const detail = (e && e.message) ? `: ${e.message}` : '';
        showToast(`PDF export failed${detail}`, 'error');
    } finally {
        isExporting = false;
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = exportBtnOrigHTML;
        }
        if (L) { L.style.opacity = '0'; setTimeout(() => L.style.display = 'none', 300); }
    }
}
