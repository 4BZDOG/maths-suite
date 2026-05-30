// =============================================================
// pdf/pdfDrawFormulas.js — Formula reference sheet for PDF export
// =============================================================

const FORMULA_CONTENT = {
    'Integers': [
        { name: 'Order of Operations', formulas: ['BODMAS: Brackets, Orders, Division, Multiplication, Addition, Subtraction'] },
        { name: 'Negative Numbers', formulas: ['(−) × (−) = (+)', '(+) × (−) = (−)', '(−) ÷ (−) = (+)'] },
    ],
    'Decimals': [
        { name: 'Place Value', formulas: ['Tenths: ÷10  Hundredths: ÷100  Thousandths: ÷1000'] },
    ],
    'Rounding': [
        { name: 'Rounding Rule', formulas: ['If next digit ≥ 5, round up; otherwise round down'] },
        { name: 'Sig. Figs.', formulas: ['Count from first non-zero digit'] },
    ],
    'Fractions': [
        { name: 'Add/Subtract', formulas: ['Find LCD, then a/LCD ± b/LCD'] },
        { name: 'Multiply', formulas: ['a/b × c/d = (a×c)/(b×d)'] },
        { name: 'Divide', formulas: ['a/b ÷ c/d = a/b × d/c'] },
        { name: 'Mixed Number', formulas: ['Convert to improper fraction first'] },
    ],
    'Percentages': [
        { name: 'Percentage', formulas: ['% of x = (% ÷ 100) × x'] },
        { name: 'Percentage Increase', formulas: ['New = Original × (1 + r/100)'] },
        { name: 'Percentage Decrease', formulas: ['New = Original × (1 − r/100)'] },
        { name: 'Percentage Change', formulas: ['Change % = (change ÷ original) × 100'] },
    ],
    'Algebra': [
        { name: 'Solve Linear', formulas: ['ax + b = c  →  x = (c − b) ÷ a'] },
        { name: 'Substitution', formulas: ['Replace the variable with the given value'] },
        { name: 'Expand', formulas: ['a(b + c) = ab + ac'] },
        { name: 'Factorise', formulas: ['ab + ac = a(b + c)'] },
    ],
    'Geometry': [
        { name: 'Rectangle', formulas: ['A = l × w', 'P = 2(l + w)'] },
        { name: 'Triangle', formulas: ['A = ½ × b × h'] },
        { name: 'Parallelogram', formulas: ['A = b × h'] },
        { name: 'Trapezium', formulas: ['A = ½ × (a + b) × h'] },
        { name: 'Circle', formulas: ['A = π r²', 'C = 2π r'], hint: 'π ≈ 3.14' },
        { name: 'Pythagoras', formulas: ['a² + b² = c²'] },
        { name: 'Surface Area (Prism)', formulas: ['SA = 2(lw + lh + wh)'] },
        { name: 'Angles on a Line', formulas: ['Sum = 180°'] },
        { name: 'Angles at a Point', formulas: ['Sum = 360°'] },
        { name: 'Parallel Lines', formulas: ['Co-interior: sum = 180°', 'Alternate: equal', 'Corresponding: equal'] },
    ],
    'Statistics': [
        { name: 'Mean', formulas: ['Mean = sum ÷ count'] },
        { name: 'Median', formulas: ['Middle value when data is sorted'] },
        { name: 'Mode', formulas: ['Most frequent value'] },
        { name: 'Range', formulas: ['Range = max − min'] },
        { name: 'IQR', formulas: ['IQR = Q3 − Q1'] },
    ],
    'Financial Maths': [
        { name: 'Simple Interest', formulas: ['I = P × r × n', 'r = annual rate as a decimal, n = years'] },
        { name: 'Compound Interest', formulas: ['A = P(1 + r)ⁿ', 'r = annual rate as a decimal, n = periods'] },
        { name: 'Depreciation', formulas: ['V = P(1 − r)ⁿ', 'r = rate as a decimal'] },
    ],
    'Trigonometry': [
        { name: 'SOHCAHTOA', formulas: ['sin θ = opp/hyp', 'cos θ = adj/hyp', 'tan θ = opp/adj'] },
        { name: 'Finding an Angle', formulas: ['θ = sin⁻¹(opp/hyp)', 'θ = cos⁻¹(adj/hyp)', 'θ = tan⁻¹(opp/adj)'] },
    ],
    'Probability': [
        { name: 'Probability', formulas: ['P(event) = favourable outcomes ÷ total outcomes'] },
        { name: 'Complementary', formulas: ['P(not A) = 1 − P(A)'] },
        { name: 'Range', formulas: ['0 ≤ P(event) ≤ 1'] },
    ],
    'Ratios & Rates': [
        { name: 'Ratio', formulas: ['Simplify by dividing both parts by HCF'] },
        { name: 'Rate', formulas: ['Rate = quantity ÷ time (e.g. km/h)'] },
        { name: 'Unitary Method', formulas: ['Find value for 1 unit, then scale'] },
    ],
    'Non-linear Relationships': [
        { name: 'Parabola', formulas: ['y = ax²  (opens up if a > 0, down if a < 0)'] },
        { name: 'Exponential', formulas: ['y = aˣ  (always positive)'] },
    ],
};

// Map topic display names to FORMULA_CONTENT keys
const TOPIC_KEY_MAP = {
    'Integers':                 'Integers',
    'Decimals':                 'Decimals',
    'Rounding':                 'Rounding',
    'Fractions':                'Fractions',
    'Percentages':              'Percentages',
    'Algebra':                  'Algebra',
    'Geometry':                 'Geometry',
    'Statistics':               'Statistics',
    'Financial Maths':          'Financial Maths',
    'Trigonometry':             'Trigonometry',
    'Probability':              'Probability',
    'Ratios & Rates':           'Ratios & Rates',
    'Non-linear Relationships': 'Non-linear Relationships',
};

const _CARD_BG  = [246, 248, 252];
const _CARD_BD  = [210, 218, 230];
const _HDR_CLR  = [30,  41,  59];   // slate-800
const _FML_CLR  = [55,  65,  81];   // slate-700
const _HNT_CLR  = [100, 116, 139];  // slate-500
const _TITLE_CL = [71, 85, 105];    // slate-600
const _ACCENT   = [16, 185, 129];   // emerald

/**
 * Draw a standalone formula reference sheet page.
 * @param {object} ctx   - PDF context from buildCtx()
 * @param {string[]} activeTopics - list of currently selected topic names
 * @param {number} pScale - per-page font scale
 */
export function drawFormulaSheet(ctx, activeTopics, pScale) {
    const { doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, pdfFont } = ctx;

    pScale = pScale || 1;
    const availW = PAGE_WIDTH - MARGIN * 2;
    const _availH = PAGE_HEIGHT - MARGIN * 2;

    // Collect all formula cards for active topics first — bail out before
    // drawing anything if there's nothing to show.
    const cards = [];
    activeTopics.forEach(topic => {
        const key = TOPIC_KEY_MAP[topic];
        if (!key || !FORMULA_CONTENT[key]) return;
        FORMULA_CONTENT[key].forEach(card => cards.push(card));
    });

    if (cards.length === 0) return;

    // Page header
    const headerH = 14 * pScale;
    doc.setFillColor(..._ACCENT);
    doc.rect(MARGIN, MARGIN, availW, headerH, 'F');

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(11 * pScale);
    doc.setTextColor(255, 255, 255);
    doc.text('Formula Reference Sheet', MARGIN + 4, MARGIN + 9 * pScale);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(7 * pScale);
    doc.setTextColor(255, 255, 255);
    doc.text('Keep this sheet for reference during the assessment.', PAGE_WIDTH - MARGIN - 4, MARGIN + 9 * pScale, { align: 'right' });

    // Two-column grid layout
    const cols       = 2;
    const gutter     = 4 * pScale;
    const colW       = (availW - gutter) / cols;
    const startY     = MARGIN + headerH + 4 * pScale;
    const maxY       = PAGE_HEIGHT - MARGIN - 6 * pScale;

    const colX = [MARGIN, MARGIN + colW + gutter];
    const colY = [startY, startY];

    const titleFontPt   = 7.5 * pScale;
    const formulaFontPt = 6.8 * pScale;
    const hintFontPt    = 6   * pScale;
    const lineH         = 4.8 * pScale;
    const cardPad       = 3   * pScale;
    const cardGap       = 2.5 * pScale;

    // Pre-measure each card height so we can flow them into columns
    function measureCard(card) {
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(titleFontPt);
        const titleH = 5 * pScale;

        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(formulaFontPt);
        const totalLines = card.formulas.reduce((sum, f) => {
            return sum + doc.splitTextToSize(f, colW - cardPad * 2).length;
        }, 0);

        const hintH = card.hint ? lineH : 0;
        return cardPad + titleH + totalLines * lineH + hintH + cardPad;
    }

    // Draw a single formula card. Caller must verify the card fits before calling.
    function drawCard(card, cx, cy, cw, cardH) {
        // Card background
        doc.setFillColor(..._CARD_BG);
        doc.setDrawColor(..._CARD_BD);
        doc.setLineWidth(0.25);
        doc.roundedRect(cx, cy, cw, cardH, 1.5, 1.5, 'FD');

        // Accent bar on left edge
        doc.setFillColor(..._ACCENT);
        doc.roundedRect(cx, cy, 1.2, cardH, 0.6, 0.6, 'F');

        let iy = cy + cardPad + 4.5 * pScale;

        // Card title
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(titleFontPt);
        doc.setTextColor(..._HDR_CLR);
        doc.text(card.name, cx + cardPad + 1.5, iy);
        iy += lineH * 0.2;

        // Formula lines
        doc.setFont(pdfFont, 'normal');
        doc.setFontSize(formulaFontPt);
        doc.setTextColor(..._FML_CLR);
        card.formulas.forEach(f => {
            const fLines = doc.splitTextToSize(f, cw - cardPad * 2 - 1.5);
            fLines.forEach(line => {
                iy += lineH;
                doc.text(line, cx + cardPad + 1.5, iy);
            });
        });

        // Optional hint line
        if (card.hint) {
            iy += lineH;
            doc.setFont(pdfFont, 'italic');
            doc.setFontSize(hintFontPt);
            doc.setTextColor(..._HNT_CLR);
            doc.text(card.hint, cx + cardPad + 1.5, iy);
        }
    }

    // Place cards into columns. If a card doesn't fit in the shorter column,
    // try the other one; if neither fits, return remaining cards for next page.
    function placeCards(remaining) {
        const overflow = [];
        for (const card of remaining) {
            const cardH = measureCard(card);
            // Prefer the shorter column for balance
            const tryOrder = colY[0] <= colY[1] ? [0, 1] : [1, 0];
            let placed = false;
            for (const col of tryOrder) {
                if (colY[col] + cardH <= maxY) {
                    drawCard(card, colX[col], colY[col], colW, cardH);
                    colY[col] += cardH + cardGap;
                    placed = true;
                    break;
                }
            }
            if (!placed) overflow.push(card);
        }
        return overflow;
    }

    function drawFooter() {
        doc.setFont(pdfFont, 'italic');
        doc.setFontSize(6 * pScale);
        doc.setTextColor(..._HNT_CLR);
        doc.text('Formulas shown are for topics selected in this assessment only.', PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN - 2 * pScale, { align: 'center' });
    }

    // First page: header is already drawn above
    let remaining = placeCards(cards);
    drawFooter();

    // Continuation pages — header repeats so the sheet is self-explanatory
    while (remaining.length > 0) {
        doc.addPage();
        if (ctx.drawWatermark) ctx.drawWatermark();

        // Repeat compact header
        doc.setFillColor(..._ACCENT);
        doc.rect(MARGIN, MARGIN, availW, headerH, 'F');
        doc.setFont(pdfFont, 'bold');
        doc.setFontSize(11 * pScale);
        doc.setTextColor(255, 255, 255);
        doc.text('Formula Reference Sheet (continued)', MARGIN + 4, MARGIN + 9 * pScale);

        colY[0] = startY;
        colY[1] = startY;
        remaining = placeCards(remaining);
        drawFooter();
    }
}
