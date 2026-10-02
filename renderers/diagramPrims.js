// renderers/diagramPrims.js
// Renderer-neutral diagram builders. Each builder turns a `diagram` object into
// a list of drawing primitives in a fixed pixel space ({ w, h, items }). The
// on-screen SVG (primsToSVG, below) and the PDF (pdf/pdfPrims.js) both consume
// the SAME primitives, so a diagram can never drift between preview and export.
//
// Primitive shapes (all coordinates in the diagram's own pixel space):
//   { t:'poly',   pts, fill, stroke, sw, dash }          closed polygon
//   { t:'path',   pts, stroke, sw, dash }                open polyline
//   { t:'circle', cx, cy, r, fill, stroke, sw }
//   { t:'text',   x, y, s, p?, anchor, size, color, bold, op }
//        `p` is an ASCII-safe alternative used by the PDF (helvetica has no π/θ).
// Colour keys: g emerald (outline), m red (missing value), l label/ink, f faint.
// Fill keys:   none | tint | gtint | mtint | white | g | m

export const GC = '#10b981';
export const MC = '#ef4444';

// ─── tiny helpers ────────────────────────────────────────────────────────────
const poly   = (pts, o = {}) => ({ t: 'poly', pts, fill: 'tint', stroke: 'g', sw: 1.8, ...o });
const path   = (pts, o = {}) => ({ t: 'path', pts, stroke: 'g', sw: 1.5, ...o });
const line   = (a, b, o = {}) => path([a, b], o);
const circle = (cx, cy, r, o = {}) => ({ t: 'circle', cx, cy, r, fill: 'none', stroke: 'g', sw: 1.8, ...o });
const text   = (x, y, s, o = {}) => ({ t: 'text', x, y, s, anchor: 'middle', size: 10, color: 'l', ...o });

// Points along an ellipse arc, angles in radians (y down: a=0 right, π/2 bottom).
function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 48) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
}

// Dimension line (vertical) with end ticks and a label to its left.
function dimV(x, y1, y2, label, o = {}) {
    return [
        line([x, y1], [x, y2], { stroke: 'l', sw: 1, op: 0.7 }),
        line([x - 3, y1], [x + 3, y1], { stroke: 'l', sw: 1, op: 0.7 }),
        line([x - 3, y2], [x + 3, y2], { stroke: 'l', sw: 1, op: 0.7 }),
        text(x - 6, (y1 + y2) / 2 + 3.5, label, { anchor: 'end', ...o }),
    ];
}

// Dimension label for a measurement; the unknown one shows a red "?".
const SHOWN = { ht: 'h' };   // internal key → label shown on the diagram
const dimLabel = (key, val, unit, missing) => {
    const n = SHOWN[key] || key;
    return key === missing ? { s: `${n} = ?`, color: 'm', bold: true } : { s: `${n} = ${val} ${unit}`.trim() };
};

// Bounding box of a list of primitives (text width estimated from font size).
function bboxOf(items) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
    for (const it of items) {
        if (it.pts) it.pts.forEach(([x, y]) => add(x, y));
        else if (it.t === 'circle') { add(it.cx - it.r, it.cy - it.r); add(it.cx + it.r, it.cy + it.r); }
        else if (it.t === 'text') {
            const w = String(it.s).length * it.size * 0.55;
            const l = it.anchor === 'end' ? it.x - w : it.anchor === 'start' ? it.x : it.x - w / 2;
            add(l, it.y - it.size * 0.8); add(l + w, it.y + it.size * 0.25);
        }
    }
    return { x0, y0, x1, y1 };
}

// Crop the canvas to the drawn content (+ padding) so a diagram uses all the
// room it is given on screen and in the PDF, and nothing can ever be clipped.
function fitPrims(items, pad = 6) {
    const b = bboxOf(items);
    const dx = pad - b.x0, dy = pad - b.y0;
    for (const it of items) {
        if (it.pts) it.pts = it.pts.map(([x, y]) => [x + dx, y + dy]);
        if (it.x != null) { it.x += dx; it.y += dy; }
        if (it.cx != null) { it.cx += dx; it.cy += dy; }
    }
    return { w: Math.ceil(b.x1 - b.x0 + 2 * pad), h: Math.ceil(b.y1 - b.y0 + 2 * pad), items };
}

// ─── Solids ──────────────────────────────────────────────────────────────────
// diagram: { type:'solid', kind, dims, unit?, find?, given?, hint? }
//   kind : 'prism' | 'tri-prism' | 'cylinder' | 'cone' | 'sphere' | 'pyramid'
//   dims : prism {l,w,h}; tri-prism {b,ht,L}; cylinder/cone {r,h}; sphere {r};
//          pyramid {s,h}
//   find : 'V' | 'SA' (shown as "V = ?") — or a dimension key to show as "?"
//   given: text for a known quantity, e.g. "V = 120 cm³"

const FORMULA = {
    prism:      { V: ['V = l × w × h', 'V = l x w x h'],  SA: ['SA = 2(lw + lh + wh)', 'SA = 2(lw + lh + wh)'] },
    'tri-prism': { V: ['V = ½bh × L', 'V = 1/2 b h x L'] },
    cylinder:   { V: ['V = πr²h', 'V = pi r² h'],       SA: ['SA = 2πr² + 2πrh', 'SA = 2 pi r² + 2 pi r h'] },
    cone:       { V: ['V = 1/3 πr²h', 'V = 1/3 pi r² h'] },
    sphere:     { V: ['V = 4/3 πr³', 'V = 4/3 pi r³'] },
    pyramid:    { V: ['V = 1/3 × base × h', 'V = 1/3 x base x h'] },
};

function solidPrims({ kind, dims = {}, unit = 'cm', find, given, givenP, hint = true }) {
    const items = [];
    const u = unit;
    const lab = (key) => dimLabel(key, dims[key], u, find);
    const T = (x, y, key, o = {}) => { const l = lab(key); items.push(text(x, y, l.s, { size: 10, ...l, ...o })); };

    if (kind === 'prism') {
        const { l, w, h } = dims;
        const Lp = 84, Hp = Math.max(30, Math.min(72, Lp * (h / l))), k = Math.max(0.55, Math.min(1.1, w / l));
        const dx = 30 * k, dy = 19 * k;
        const x = 26, yb = 126;
        const FTL = [x, yb - Hp], FTR = [x + Lp, yb - Hp], FBR = [x + Lp, yb], FBL = [x, yb];
        const BTL = [x + dx, yb - Hp - dy], BTR = [x + Lp + dx, yb - Hp - dy];
        const BBR = [x + Lp + dx, yb - dy], BBL = [x + dx, yb - dy];
        items.push(line(BBL, BTL, { dash: true, op: 0.55 }), line(BBL, BBR, { dash: true, op: 0.55 }), line(BBL, FBL, { dash: true, op: 0.55 }));
        items.push(poly([FTL, FTR, FBR, FBL]), poly([FTL, FTR, BTR, BTL]), poly([FTR, FBR, BBR, BTR]));
        T((FBL[0] + FBR[0]) / 2, yb + 14, 'l');
        T(x - 6, yb - Hp / 2 + 3.5, 'h', { anchor: 'end' });
        T((FBR[0] + BBR[0]) / 2 + 6, (FBR[1] + BBR[1]) / 2 + 12, 'w', { anchor: 'start' });
    } else if (kind === 'tri-prism') {
        const { b, ht } = dims;
        const bp = 84, hp = Math.max(34, Math.min(66, bp * (ht / b))), dx = 34, dy = 20;
        const x = 46, yb = 126;
        const A = [x, yb], B = [x + bp, yb], C = [x + bp / 2, yb - hp];
        const A2 = [A[0] + dx, A[1] - dy], B2 = [B[0] + dx, B[1] - dy], C2 = [C[0] + dx, C[1] - dy];
        items.push(line(A2, B2, { dash: true, op: 0.55 }));
        items.push(poly([A, C, C2, A2]), poly([B, C, C2, B2]), poly([A, B, C]));
        const foot = [C[0], yb];
        items.push(line(C, foot, { dash: true, sw: 1.2, op: 0.8 }));
        items.push(path([[foot[0] + 6, yb], [foot[0] + 6, yb - 6], [foot[0], yb - 6]], { sw: 1.2 }));
        T((A[0] + B[0]) / 2, yb + 14, 'b');
        items.push(...dimV(A[0] - 16, C[1], yb, lab('ht').s, lab('ht')));
        const L = lab('L');
        items.push(text((B[0] + B2[0]) / 2 + 6, (B[1] + B2[1]) / 2 + 12, L.s, { anchor: 'start', size: 10, ...L }));
    } else if (kind === 'cylinder') {
        const { r, h } = dims;
        const rx = 36, ry = 11, cx = 98, top = 34;
        const Hp = Math.max(46, Math.min(84, rx * 2 * (h / (2 * r)) * 0.9)), bot = top + Hp;
        items.push(poly([[cx - rx, top], [cx - rx, bot], ...ellipsePts(cx, bot, rx, ry, Math.PI, 0, 24), [cx + rx, top]], { stroke: 'none', sw: 0 }));
        items.push(path(ellipsePts(cx, bot, rx, ry, Math.PI, 2 * Math.PI, 24), { dash: true, op: 0.55 }));
        items.push(path(ellipsePts(cx, bot, rx, ry, 0, Math.PI, 24)));
        items.push(line([cx - rx, top], [cx - rx, bot]), line([cx + rx, top], [cx + rx, bot]));
        items.push(poly(ellipsePts(cx, top, rx, ry, 0, 2 * Math.PI, 40), { fill: 'gtint' }));
        items.push(line([cx, top], [cx + rx, top], { dash: true, sw: 1.2, op: 0.9 }), circle(cx, top, 1.8, { fill: 'g', stroke: 'g', sw: 0 }));
        T(cx + rx + 6, top + 3.5, 'r', { anchor: 'start' });
        items.push(...dimV(cx - rx - 14, top, bot, lab('h').s, lab('h')));
    } else if (kind === 'cone') {
        const { r, h } = dims;
        const rx = 40, ry = 12, cx = 100, top = 22;
        const Hp = Math.max(56, Math.min(96, rx * 2 * (h / (2 * r)) * 0.9)), bot = top + Hp;
        items.push(poly([[cx, top], [cx + rx, bot], ...ellipsePts(cx, bot, rx, ry, 0, Math.PI, 24).slice(1, -1), [cx - rx, bot]], { fill: 'tint', stroke: 'none', sw: 0 }));
        items.push(path(ellipsePts(cx, bot, rx, ry, Math.PI, 2 * Math.PI, 24), { dash: true, op: 0.55 }));
        items.push(path(ellipsePts(cx, bot, rx, ry, 0, Math.PI, 24)));
        items.push(line([cx, top], [cx - rx, bot]), line([cx, top], [cx + rx, bot]));
        items.push(line([cx, top], [cx, bot], { dash: true, sw: 1.2, op: 0.8 }));
        items.push(path([[cx + 6, bot], [cx + 6, bot - 6], [cx, bot - 6]], { sw: 1.2 }));
        items.push(line([cx, bot], [cx + rx, bot], { dash: true, sw: 1.2, op: 0.9 }));
        T(cx + rx / 2 + 2, bot + ry + 14, 'r');
        items.push(...dimV(cx - rx - 14, top, bot, lab('h').s, lab('h')));
    } else if (kind === 'sphere') {
        const R = 52, cx = 96, cy = 76;
        items.push(circle(cx, cy, R, { fill: 'tint' }));
        items.push(path(ellipsePts(cx, cy, R, 15, Math.PI, 2 * Math.PI, 30), { dash: true, op: 0.55, sw: 1.2 }));
        items.push(path(ellipsePts(cx, cy, R, 15, 0, Math.PI, 30), { op: 0.75, sw: 1.2 }));
        items.push(line([cx, cy], [cx + R, cy], { dash: true, sw: 1.3 }), circle(cx, cy, 2.2, { fill: 'g', stroke: 'g', sw: 0 }));
        T(cx + R / 2, cy + 15, 'r');
    } else if (kind === 'pyramid') {
        const { s } = dims;
        const bw = 86, dx = 32, dy = 20, x = 36, yb = 128;
        const Hp = Math.max(52, Math.min(92, bw * (dims.h / s) * 0.9));
        const A = [x, yb], B = [x + bw, yb], C = [x + bw + dx, yb - dy], D = [x + dx, yb - dy];
        const O = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2], P = [O[0], O[1] - Hp];
        items.push(line(P, D, { dash: true, op: 0.55 }), line(D, A, { dash: true, op: 0.55 }), line(D, C, { dash: true, op: 0.55 }));
        items.push(poly([P, A, B]), poly([P, B, C]));
        items.push(line(P, O, { dash: true, sw: 1.2, op: 0.8 }), circle(O[0], O[1], 1.6, { fill: 'g', stroke: 'g', sw: 0 }));
        T((A[0] + B[0]) / 2, yb + 14, 's');
        items.push(line([A[0] - 14, P[1]], [P[0], P[1]], { stroke: 'f', sw: 1, dash: true }), line([A[0] - 14, O[1]], [O[0], O[1]], { stroke: 'f', sw: 1, dash: true }));
        items.push(...dimV(A[0] - 14, P[1], O[1], lab('h').s, lab('h')));
    } else {
        return null;
    }

    // Right-hand block: the quantity being asked for (or the given one) + formula,
    // placed just clear of the drawn shape and centred on it vertically.
    const sb = bboxOf(items);
    const bx = sb.x1 + 18, my = (sb.y0 + sb.y1) / 2;
    const f = (FORMULA[kind] || {})[find];
    if (find === 'V' || find === 'SA') {
        items.push(text(bx, my, `${find} = ?`, { anchor: 'start', size: 17, color: 'm', bold: true }));
        if (f && hint) items.push(text(bx, my + 19, f[0], { anchor: 'start', size: 9, op: 0.75, p: f[1] }));
    } else if (given) {
        items.push(text(bx, my + 4, given, { anchor: 'start', size: 12, p: givenP }));
    }
    return fitPrims(items);

}


// ─── Statistics displays ─────────────────────────────────────────────────────
// Nice axis step (1/2/5 × 10ⁿ) giving roughly `target` intervals over `span`.
function niceStep(span, target = 6) {
    const raw = span / target || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (m * mag >= raw) return m * mag;
    return 10 * mag;
}
const fmtNum = (v) => String(Math.round(v * 1000) / 1000);

// Horizontal number line from lo→hi mapped across [x0, x1] at height y.
// Majors labelled every `step`; minors every `minor` (default: each unit when
// the span is small enough to read to the nearest whole number).
function numberLine(lo, hi, x0, x1, y, { step, minor } = {}) {
    const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    const st = step || niceStep(hi - lo, 8);
    const mn = minor || (hi - lo <= 40 && st > 1 ? 1 : null);
    const items = [line([x0, y], [x1, y], { stroke: 'l', sw: 1.4, op: 0.85 })];
    if (mn) for (let v = Math.ceil(lo / mn) * mn; v <= hi + 1e-9; v += mn) items.push(line([X(v), y], [X(v), y + 3], { stroke: 'l', sw: 0.8, op: 0.6 }));
    for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) {
        items.push(line([X(v), y - 1], [X(v), y + 6], { stroke: 'l', sw: 1.1, op: 0.85 }));
        items.push(text(X(v), y + 17, fmtNum(v), { size: 9 }));
    }
    return { items, X };
}

// Cartesian axes with light grid, tick labels and axis titles (first quadrant
// or wherever the supplied window sits). Returns drawing items + mappers.
function axesFrame({ xMin, xMax, yMin, yMax, W = 250, H = 160, xTitle, yTitle, left = 34, bottom = 30, top = 14, right = 14 }) {
    const px0 = left, px1 = W - right, py0 = top, py1 = H - bottom;
    const X = (v) => px0 + ((v - xMin) / (xMax - xMin)) * (px1 - px0);
    const Y = (v) => py1 - ((v - yMin) / (yMax - yMin)) * (py1 - py0);
    const items = [];
    const xs = niceStep(xMax - xMin, 8), ys = niceStep(yMax - yMin, 6);
    for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) {
        items.push(line([X(v), py0], [X(v), py1], { stroke: 'f', sw: 0.8 }));
        items.push(text(X(v), py1 + 12, fmtNum(v), { size: 8.5, op: 0.8 }));
    }
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) {
        items.push(line([px0, Y(v)], [px1, Y(v)], { stroke: 'f', sw: 0.8 }));
        items.push(text(px0 - 5, Y(v) + 3, fmtNum(v), { size: 8.5, anchor: 'end', op: 0.8 }));
    }
    items.push(path([[px0, py0], [px0, py1], [px1, py1]], { stroke: 'l', sw: 1.4, op: 0.85 }));
    if (xTitle) items.push(text((px0 + px1) / 2, H - 4, xTitle, { size: 9.5 }));
    if (yTitle) items.push(text(px0 - 4, py0 - 5, yTitle, { size: 9.5, anchor: 'start' }));
    return { items, X, Y, px0, px1, py0, py1 };
}

// diagram: { type:'stem-leaf', rows:[{stem, leaves:[…]}], key:'2 | 1 = 21', essential:true }
function stemLeafPrims({ rows, key }) {
    const items = [];
    const rowH = 17, stemW = 30, leafGap = 13;
    const maxLeaves = Math.max(...rows.map(r => r.leaves.length));
    const x0 = 0, xDiv = x0 + stemW, xEnd = xDiv + 12 + maxLeaves * leafGap + 6;
    items.push(text(x0 + stemW - 8, 12, 'Stem', { anchor: 'end', size: 10, bold: true }));
    items.push(text(xDiv + 10, 12, 'Leaf', { anchor: 'start', size: 10, bold: true }));
    items.push(line([x0, 18], [xEnd, 18], { stroke: 'l', sw: 1.2, op: 0.8 }));
    const yEnd = 18 + rows.length * rowH + 4;
    items.push(line([xDiv, 18], [xDiv, yEnd], { stroke: 'l', sw: 1.4, op: 0.85 }));
    rows.forEach((r, i) => {
        const y = 18 + (i + 1) * rowH - 4;
        items.push(text(x0 + stemW - 8, y, String(r.stem), { anchor: 'end', size: 12 }));
        r.leaves.forEach((lf, j) => items.push(text(xDiv + 10 + j * leafGap, y, String(lf), { anchor: 'start', size: 12 })));
    });
    if (key) items.push(text(x0, yEnd + 16, `Key: ${key}`, { anchor: 'start', size: 10, op: 0.85 }));
    return fitPrims(items);
}

// diagram: { type:'box-plot', min, q1, med, q3, max, outliers?:[…], lo?, hi?, title?, essential:true }
function boxPlotPrims({ min, q1, med, q3, max, outliers = [], lo, hi, title }) {
    const all = [min, max, ...outliers];
    const span = Math.max(...all) - Math.min(...all);
    const st = niceStep(span || 10, 8);
    const a = lo != null ? lo : Math.floor((Math.min(...all) - st * 0.3) / st) * st;
    const b = hi != null ? hi : Math.ceil((Math.max(...all) + st * 0.3) / st) * st;
    const items = [];
    const nl = numberLine(a, b, 16, 296, 78, { step: st });
    const X = nl.X, cy = 44, bh = 34;
    items.push(...nl.items);
    items.push(line([X(min), cy], [X(q1), cy], { sw: 1.8 }), line([X(q3), cy], [X(max), cy], { sw: 1.8 }));
    items.push(line([X(min), cy - 9], [X(min), cy + 9], { sw: 1.8 }), line([X(max), cy - 9], [X(max), cy + 9], { sw: 1.8 }));
    items.push(poly([[X(q1), cy - bh / 2], [X(q3), cy - bh / 2], [X(q3), cy + bh / 2], [X(q1), cy + bh / 2]], { fill: 'gtint' }));
    items.push(line([X(med), cy - bh / 2], [X(med), cy + bh / 2], { sw: 2.4 }));
    for (const o of outliers) items.push(text(X(o), cy + 4, '×', { size: 15, color: 'm', bold: true }));
    if (title) items.push(text(156, 112, title, { size: 10 }));
    return fitPrims(items);
}

// diagram: { type:'dot-plot', counts:{value:count,…}, lo, hi, title?, essential:true }
function dotPlotPrims({ counts, lo, hi, title }) {
    const values = Object.keys(counts).map(Number);
    const a = lo != null ? lo : Math.min(...values), b = hi != null ? hi : Math.max(...values);
    const maxC = Math.max(...Object.values(counts));
    const r = 4.6, gap = 10.4, base = 14 + maxC * gap;
    const nl = numberLine(a, b, 16, 16 + Math.max(160, (b - a) * 26), base, { step: 1, minor: null });
    const items = [...nl.items];
    for (const v of values) for (let i = 0; i < counts[v]; i++) items.push(circle(nl.X(v), base - 8 - i * gap, r, { fill: 'g', stroke: 'g', sw: 0 }));
    if (title) items.push(text(16 + Math.max(160, (b - a) * 26) / 2, base + 34, title, { size: 10 }));
    return fitPrims(items);
}

// diagram: { type:'scatter', pts:[[x,y],…], line?:{m,c}, xMax, yMax, xTitle, yTitle }
function scatterPrims({ pts, line: ln, xMax, yMax, xTitle, yTitle }) {
    const xm = xMax || niceStep(Math.max(...pts.map(p => p[0])) * 1.1, 1) * 1, ym = yMax || Math.ceil(Math.max(...pts.map(p => p[1])) * 1.1);
    const fr = axesFrame({ xMin: 0, xMax: xm, yMin: 0, yMax: ym, xTitle, yTitle });
    const items = [...fr.items];
    if (ln) {
        const ya = ln.c, yb = ln.m * xm + ln.c;
        const t0 = ya < 0 ? -ln.c / ln.m : 0;
        const t1 = yb > ym ? (ym - ln.c) / ln.m : xm;
        items.push(line([fr.X(t0), fr.Y(ln.m * t0 + ln.c)], [fr.X(t1), fr.Y(ln.m * t1 + ln.c)], { sw: 1.8 }));
    }
    for (const [x, y] of pts) items.push(circle(fr.X(x), fr.Y(y), 3.4, { fill: 'm', stroke: 'm', sw: 0 }));
    return fitPrims(items);
}

// ─── Tables, Venn diagrams, spinners, tree diagrams ──────────────────────────
// Colour names usable in spinners etc. (fills accept any '#rrggbb' string).
export const PALETTE = {
    red: '#f87171', blue: '#60a5fa', green: '#4ade80', yellow: '#facc15',
    orange: '#fb923c', purple: '#c084fc', pink: '#f9a8d4', white: '#ffffff', grey: '#cbd5e1',
};

// diagram: { type:'table', head:[…], rows:[[cell,…]…], essential?, rowHead?:true }
//   cell: string | number | { q:true } (red "?") | { tally:n } (tally marks) | { b:true, s }
function tablePrims({ head, rows, rowHead = true }) {
    const items = [];
    const size = 11, padX = 10, rowH = 21;
    const cellW = (c) => {
        if (c && typeof c === 'object') {
            if (c.tally != null) return Math.ceil(c.tally / 5) * 24 + 8;
            if (c.q) return 14;
            return String(c.s).length * size * 0.56;
        }
        return String(c).length * size * 0.56;
    };
    const nCols = Math.max(head ? head.length : 0, ...rows.map(r => r.length));
    const colW = Array.from({ length: nCols }, (_, c) => {
        const cells = [...(head ? [head[c] ?? ''] : []), ...rows.map(r => r[c] ?? '')];
        return Math.max(38, Math.ceil(Math.max(...cells.map(cellW)) + padX * 2));
    });
    const W = colW.reduce((a, b) => a + b, 0), top = 0;
    const nR = rows.length + (head ? 1 : 0), H = nR * rowH;
    const colX = [0]; colW.forEach((w, i) => colX.push(colX[i] + w));
    if (head) items.push(poly([[0, 0], [W, 0], [W, rowH], [0, rowH]], { fill: 'gtint', stroke: 'none', sw: 0 }));
    if (rowHead) items.push(poly([[0, head ? rowH : 0], [colX[1], head ? rowH : 0], [colX[1], H], [0, H]], { fill: 'tint', stroke: 'none', sw: 0 }));
    items.push(poly([[0, top], [W, top], [W, H], [0, H]], { fill: 'none', sw: 1.6 }));
    for (let r = 1; r < nR; r++) items.push(line([0, r * rowH], [W, r * rowH], { sw: 1, op: 0.7 }));
    for (let c = 1; c < nCols; c++) items.push(line([colX[c], 0], [colX[c], H], { sw: 1, op: 0.7 }));
    const put = (c, r, v, bold) => {
        const cx = (colX[c] + colX[c + 1]) / 2, cy = r * rowH + rowH / 2;
        if (v && typeof v === 'object' && v.tally != null) {
            // tally marks: groups of four strokes crossed by a diagonal
            let gx = colX[c] + 14;
            for (let left = v.tally; left > 0; left -= 5) {
                const n = Math.min(5, left), strokes = Math.min(4, n);
                for (let i = 0; i < strokes; i++) items.push(line([gx + i * 4.5, cy - 8], [gx + i * 4.5, cy + 8], { stroke: 'l', sw: 1.6, op: 0.95 }));
                if (n === 5) items.push(line([gx - 3, cy + 5], [gx + 3 * 4.5 + 3, cy - 5], { stroke: 'l', sw: 1.6, op: 0.95 }));
                gx += 24;
            }
            return;
        }
        if (v && typeof v === 'object' && v.q) { items.push(text(cx, cy + 4.5, '?', { size: size + 3, color: 'm', bold: true })); return; }
        const str = v && typeof v === 'object' ? v.s : v;
        items.push(text(cx, cy + 4, String(str), { size, bold: bold || (v && v.b) }));
    };
    if (head) head.forEach((h, c) => put(c, 0, h, true));
    rows.forEach((row, r) => row.forEach((v, c) => put(c, r + (head ? 1 : 0), v, rowHead && c === 0)));
    return fitPrims(items, 4);
}

// diagram: { type:'venn', labels:[A,B], universe?:'ξ', total?, regions:{a,ab,b,out} }
//   region values: number | '?' (red) | null (blank). `sets:{a,b}` print a set total beside its name.
function vennPrims({ labels, regions = {}, total, sets }) {
    const items = [];
    const W = 270, H = 150;
    items.push(poly([[0, 0], [W, 0], [W, H], [0, H]], { fill: 'none', sw: 1.6 }));
    items.push(text(8, H - 8, total != null ? `Total = ${total}` : 'ξ', { anchor: 'start', size: 10, op: 0.9, p: total != null ? `Total = ${total}` : 'U' }));
    const R = 50, cy = 78, ax = 98, bx = 172;
    items.push(circle(ax, cy, R, { fill: 'gtint', sw: 1.8 }), circle(bx, cy, R, { fill: 'mtint', stroke: 'm', sw: 1.8 }));
    const nameA = sets && sets.a != null ? `${labels[0]} (${sets.a})` : labels[0];
    const nameB = sets && sets.b != null ? `${labels[1]} (${sets.b})` : labels[1];
    items.push(text(ax - 14, 20, nameA, { size: 10, bold: true }), text(bx + 14, 20, nameB, { size: 10, bold: true }));
    const reg = (x, y, v) => {
        if (v == null || v === '') return;
        if (v === '?') items.push(text(x, y, '?', { size: 15, color: 'm', bold: true }));
        else items.push(text(x, y, String(v), { size: 14 }));
    };
    reg(ax - 26, cy + 5, regions.a); reg((ax + bx) / 2, cy + 5, regions.ab); reg(bx + 26, cy + 5, regions.b);
    reg(W - 24, H - 12, regions.out);
    return fitPrims(items, 4);
}

// diagram: { type:'spinner', sectors:[{label, color}], essential:true }
function spinnerPrims({ sectors }) {
    const n = sectors.length, R = 52, cx = R + 8, cy = R + 16;
    const items = [];
    sectors.forEach((sec, i) => {
        const a0 = -Math.PI / 2 + (2 * Math.PI * i) / n, a1 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / n;
        items.push(poly([[cx, cy], ...ellipsePts(cx, cy, R, R, a0, a1, 16)], { fill: PALETTE[sec.color] || (i % 2 ? 'tint' : 'gtint'), sw: 1.6 }));
        const am = (a0 + a1) / 2;
        if (sec.label != null && sec.label !== '') items.push(text(cx + R * 0.62 * Math.cos(am), cy + R * 0.62 * Math.sin(am) + 4, String(sec.label), { size: n > 6 ? 11 : 14, bold: true }));
    });
    items.push(circle(cx, cy, 3, { fill: 'white', stroke: 'l', sw: 1 }));
    // pointer
    items.push(poly([[cx - 6, 2], [cx + 6, 2], [cx, 14]], { fill: 'l', stroke: 'l', sw: 1 }));
    return fitPrims(items, 5);
}

// diagram: { type:'tree', first:[{l,p}], second:[[{l,p}…] per first branch], essential? }
//   p: string like '1/2' or '?'  (rendered red when '?'). Leaves show combined outcome.
function treePrims({ first, second }) {
    const items = [];
    const R = 11, x0 = 10, x1 = 130, x2 = 250, dy = 26;
    const leaves = second.flat().length;
    let leafIdx = 0;
    const rootY = (leaves - 1) * dy / 2 + 12;
    const edge = (ax, ay, bx, by, p) => {
        const dxx = bx - ax, dyy = by - ay, len = Math.hypot(dxx, dyy), ux = dxx / len, uy = dyy / len;
        const sx = ax + ux * (ax === x0 ? 4 : R), sy = ay + uy * (ax === x0 ? 4 : R);
        const ex = bx - ux * R, ey = by - uy * R;
        items.push(line([sx, sy], [ex, ey], { sw: 1.6 }));
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;
        const isQ = p === '?';
        items.push(text(mx - 2, my + (uy < -0.05 ? -5 : uy > 0.05 ? 13 : -5), String(p), { size: 10, color: isQ ? 'm' : 'l', bold: isQ }));
    };
    items.push(circle(x0, rootY, 3.2, { fill: 'g', stroke: 'g', sw: 0 }));
    first.forEach((b1, i) => {
        const kids = second[i];
        const ys = kids.map(() => 12 + (leafIdx++) * dy);
        const y1 = (ys[0] + ys[ys.length - 1]) / 2;
        edge(x0, rootY, x1, y1, b1.p);
        items.push(circle(x1, y1, R, { fill: 'gtint', sw: 1.6 }), text(x1, y1 + 4, b1.l, { size: 11, bold: true }));
        kids.forEach((b2, j) => {
            edge(x1, y1, x2, ys[j], b2.p);
            items.push(circle(x2, ys[j], R, { fill: 'gtint', sw: 1.6 }), text(x2, ys[j] + 4, b2.l, { size: 11, bold: true }));
            items.push(text(x2 + R + 8, ys[j] + 4, `${b1.l}${b2.l}`, { anchor: 'start', size: 10, op: 0.8 }));
        });
    });
    return fitPrims(items, 6);
}

// ─── Trigonometry: applications scenes, bearings, cuboid diagonals ───────────
// Angle arc at (vx,vy) from direction dirA to dirB (screen vectors), shorter way.
function angArc(vx, vy, r, dirA, dirB) {
    const a0 = Math.atan2(dirA[1], dirA[0]);
    let d = Math.atan2(dirB[1], dirB[0]) - a0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d <= -Math.PI) d += 2 * Math.PI;
    return { pts: ellipsePts(vx, vy, r, r, a0, a0 + d, 18), mid: a0 + d / 2 };
}
const rightMark = (vx, vy, ax, ay, bx, by, s = 7) =>
    path([[vx + ax * s, vy + ay * s], [vx + (ax + bx) * s, vy + (ay + by) * s], [vx + bx * s, vy + by * s]], { sw: 1.2 });

// diagram: { type:'scene', kind:'elevation'|'depression'|'drone'|'ladder'|'wire'|'ramp',
//            height, dist, angle?, missing:'angle'|'height'|'dist', unit? }
function scenePrims({ kind, height, dist, angle, missing, unit = 'm' }) {
    const items = [];
    const W = 150, gy = 118, x0 = 44;
    const Hp = Math.max(40, Math.min(96, W * (height / dist)));
    const hLab = missing === 'height' ? { s: 'h = ?', color: 'm', bold: true } : { s: `h = ${height} ${unit}` };
    const dLab = missing === 'dist' ? { s: 'd = ?', color: 'm', bold: true } : { s: `d = ${dist} ${unit}` };
    const aLab = missing === 'angle' ? { s: '?', color: 'm', bold: true, size: 14 } : { s: `${angle}°` };
    const ground = (xa, xb) => items.push(line([xa, gy], [xb, gy], { stroke: 'l', sw: 1.4, op: 0.8 }));
    const angle_at = (vx, vy, dirA, dirB, r = 26) => {
        const arc = angArc(vx, vy, r, dirA, dirB);
        items.push(path(arc.pts, { sw: 1.5 }));
        items.push(text(vx + (r + 12) * Math.cos(arc.mid), vy + (r + 12) * Math.sin(arc.mid) + 4, aLab.s, { size: 11, ...aLab }));
    };
    const distLabel = (xa, xb) => items.push(text((xa + xb) / 2, gy + 16, dLab.s, { size: 10, ...dLab }));

    if (kind === 'elevation' || kind === 'ladder' || kind === 'ramp') {
        const O = [x0, gy], B = [x0 + W, gy], T = [x0 + W, gy - Hp];
        if (kind === 'ramp') items.push(poly([O, B, T], { fill: 'gtint', sw: 0 , stroke: 'none' }));
        if (kind === 'elevation') items.push(poly([[B[0], gy], [B[0] + 18, gy], [B[0] + 18, T[1]], [B[0], T[1]]], { fill: 'tint' }));
        if (kind === 'ladder') items.push(poly([[B[0], gy], [B[0] + 12, gy], [B[0] + 12, T[1] - 8], [B[0], T[1] - 8]], { fill: 'tint' }));
        ground(x0 - 14, B[0] + (kind === 'ramp' ? 14 : 34));
        items.push(line(O, T, { sw: kind === 'ladder' ? 3 : 2.2 }));
        if (kind === 'ladder') for (const f of [0.25, 0.5, 0.75]) {
            const px = O[0] + (T[0] - O[0]) * f, py = O[1] + (T[1] - O[1]) * f, L = Math.hypot(T[0] - O[0], T[1] - O[1]);
            const nx = -(T[1] - O[1]) / L * 5, ny = (T[0] - O[0]) / L * 5;
            items.push(line([px - nx, py - ny], [px + nx, py + ny], { sw: 1.2 }));
        }
        if (kind === 'elevation') {   // observer
            items.push(circle(x0 - 9, gy - 17, 3.2, { fill: 'tint', sw: 1.4 }), line([x0 - 9, gy - 13.6], [x0 - 9, gy - 4], { sw: 1.5 }), line([x0 - 9, gy - 4], [x0 - 13, gy], { sw: 1.5 }), line([x0 - 9, gy - 4], [x0 - 5, gy], { sw: 1.5 }));
        }
        items.push(rightMark(B[0], gy, -1, 0, 0, -1));
        angle_at(O[0], O[1], [1, 0], [T[0] - O[0], T[1] - O[1]]);
        distLabel(O[0], B[0]);
        items.push(text(B[0] + (kind === 'ladder' ? 18 : 24), (gy + T[1]) / 2 + 4, hLab.s, { anchor: 'start', size: 10, ...hLab }));
    } else if (kind === 'wire') {
        const T = [x0, gy - Hp], A = [x0 + W, gy];
        items.push(poly([[x0 - 4, gy], [x0 + 4, gy], [x0 + 4, T[1]], [x0 - 4, T[1]]], { fill: 'tint' }));
        ground(x0 - 20, A[0] + 16);
        items.push(line(T, A, { sw: 1.8 }), circle(A[0], A[1], 2.6, { fill: 'g', stroke: 'g', sw: 0 }));
        items.push(rightMark(x0 + 4, gy, 1, 0, 0, -1));
        angle_at(A[0], A[1], [-1, 0], [T[0] - A[0], T[1] - A[1]]);
        distLabel(x0, A[0]);
        items.push(text(x0 - 12, (gy + T[1]) / 2 + 4, hLab.s, { anchor: 'end', size: 10, ...hLab }));
    } else {   // depression / drone
        const T = [x0, gy - Hp], P = [x0 + W, gy];
        if (kind === 'depression') {
            items.push(poly([[x0 - 20, gy], [x0, gy], [x0, T[1]], [x0 - 20, T[1]]], { fill: 'tint' }));
        } else {
            items.push(line(T, [x0, gy], { dash: true, sw: 1.2, op: 0.8 }));
            items.push(line([T[0] - 9, T[1] - 4], [T[0] + 9, T[1] - 4], { sw: 1.8 }), circle(T[0], T[1], 4, { fill: 'tint', sw: 1.6 }), line([T[0] - 9, T[1] - 4], [T[0] - 9, T[1] - 8], { sw: 1.4 }), line([T[0] + 9, T[1] - 4], [T[0] + 9, T[1] - 8], { sw: 1.4 }));
        }
        ground(x0 - (kind === 'depression' ? 20 : 14), P[0] + 26);
        items.push(line([T[0], T[1]], [P[0] + 24, T[1]], { dash: true, sw: 1.2, op: 0.8 }));
        items.push(line(T, P, { sw: 2.2 }));
        if (kind === 'depression') {   // boat
            items.push(poly([[P[0] - 10, gy - 6], [P[0] + 10, gy - 6], [P[0] + 6, gy], [P[0] - 6, gy]], { fill: 'gtint' }), line([P[0], gy - 6], [P[0], gy - 15], { sw: 1.4 }));
        } else {
            items.push(circle(P[0], gy, 2.8, { fill: 'm', stroke: 'm', sw: 0 }));
        }
        items.push(rightMark(x0, gy, 1, 0, 0, -1));
        angle_at(T[0], T[1], [1, 0], [P[0] - T[0], P[1] - T[1]], 30);
        distLabel(x0, P[0]);
        items.push(text(x0 - (kind === 'depression' ? 26 : 8), (gy + T[1]) / 2 + 4, hLab.s, { anchor: 'end', size: 10, ...hLab }));
    }
    return fitPrims(items, 6);
}

const arrowUp = (x, y, len = 26) => [
    line([x, y], [x, y - len], { stroke: 'l', sw: 1.6, op: 0.9 }),
    poly([[x - 3.5, y - len + 6], [x + 3.5, y - len + 6], [x, y - len - 1]], { fill: 'l', stroke: 'l', sw: 1 }),
    text(x, y - len - 6, 'N', { size: 10, bold: true }),
];

// diagram: { type:'bearing', legs:[{bearing, dist?, missingBearing?, missingDist?}], names?:['A','B',…],
//            unit?:'km', ask?:'east'|'north' (single leg: draw & label that component),
//            closing?:true (dashed return leg with "?" distance), back?:true (mark bearing of start from last point) }
function bearingPrims({ legs, names = ['A', 'B', 'C', 'D'], unit = 'km', ask, closing, back }) {
    const items = [];
    const rad = (b) => (b * Math.PI) / 180;
    const P = [[0, 0]];
    for (const l of legs) {
        const d = l.dist || 60;
        const q = P[P.length - 1];
        P.push([q[0] + d * Math.sin(rad(l.bearing)), q[1] - d * Math.cos(rad(l.bearing))]);
    }
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const sc = Math.min(w > 1e-6 ? 150 / w : Infinity, h > 1e-6 ? 76 / h : Infinity, 3);
    const ox = -Math.min(...xs) * sc + 50, oy = -Math.min(...ys) * sc + 56;
    const Q = P.map(([x, y]) => [x * sc + ox, y * sc + oy]);
    const nm = (i) => names[i] || String.fromCharCode(65 + i);
    const cen = [Q.reduce((a, q) => a + q[0], 0) / Q.length, Q.reduce((a, q) => a + q[1], 0) / Q.length];

    // Obstacles (sampled points) that name labels should keep clear of.
    const obstacles = [];
    const sample = (a, b) => { for (let t = 0; t <= 1; t += 0.08) obstacles.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); };
    for (let i = 0; i < legs.length; i++) {
        sample(Q[i], Q[i + 1]);
        for (let t = 0; t <= 36; t += 4) obstacles.push([Q[i][0], Q[i][1] - t]);                       // north arrow
        const am = -Math.PI / 2 + rad(legs[i].bearing) / 2;
        obstacles.push([Q[i][0] + 33 * Math.cos(am), Q[i][1] + 33 * Math.sin(am)]);                   // bearing label
        for (let t = 0; t <= 1.0001; t += 0.1) {                                                       // bearing arc
            const aa = -Math.PI / 2 + rad(legs[i].bearing) * t;
            obstacles.push([Q[i][0] + 17 * Math.cos(aa), Q[i][1] + 17 * Math.sin(aa)]);
        }
    }
    if (back || closing) sample(Q[Q.length - 1], Q[0]);
    if (back) for (let t = 0; t <= 36; t += 4) obstacles.push([Q[Q.length - 1][0], Q[Q.length - 1][1] - t]);

    if (ask) {   // right-triangle components of a single leg
        const [a, b] = [Q[0], Q[1]];
        const corner = [a[0], b[1]];
        items.push(line(a, corner, { dash: true, sw: 1.3, op: 0.8 }), line(corner, b, { dash: true, sw: 1.3, op: 0.8 }));
        sample(a, corner); sample(corner, b);
        const lbl = (x, y, anchor) => items.push(text(x, y, '? ' + unit, { size: 10, color: 'm', bold: true, anchor }));
        if (ask === 'east') lbl((corner[0] + b[0]) / 2, a[1] < b[1] ? corner[1] + 14 : corner[1] - 6, 'middle');
        else lbl(b[0] < a[0] ? a[0] + 6 : a[0] - 6, (a[1] + corner[1]) / 2 + 4, b[0] < a[0] ? 'start' : 'end');
    }
    for (let i = 0; i < legs.length; i++) {
        const a = Q[i], b = Q[i + 1];
        items.push(line(a, b, { sw: 2.2 }));
        items.push(...arrowUp(a[0], a[1], 28));
        const arc = ellipsePts(a[0], a[1], 17, 17, -Math.PI / 2, -Math.PI / 2 + rad(legs[i].bearing), 22);
        items.push(path(arc, { sw: 1.4 }));
        const am = -Math.PI / 2 + rad(legs[i].bearing) / 2;
        const bl = legs[i].missingBearing ? { s: '?', color: 'm', bold: true } : { s: `${String(legs[i].bearing).padStart(3, '0')}°` };
        items.push(text(a[0] + 33 * Math.cos(am), a[1] + 33 * Math.sin(am) + 4, bl.s, { size: 10, ...bl }));
        if (legs[i].dist != null || legs[i].missingDist) {
            const dl = legs[i].missingDist ? { s: '? ' + unit, color: 'm', bold: true } : { s: `${legs[i].dist} ${unit}` };
            const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;     // left normal
            // put the distance on whichever side of the leg has more free space
            const off = Math.abs(nx) > 0.5 ? 22 : 14;
            const clear = (sd) => {
                const px = mx + nx * off * sd, py = my + ny * off * sd;
                return Math.min(...obstacles.filter(o => Math.hypot(o[0] - mx, o[1] - my) > 3 && Math.abs((o[0] - mx) * ny - (o[1] - my) * nx) > 3).map(o => Math.hypot(o[0] - px, o[1] - py)), 99);
            };
            const side = clear(1) >= clear(-1) ? 1 : -1;
            const off2 = side * off;
            items.push(text(mx + nx * off2, my + ny * off2 + 4, dl.s, { size: 10, ...dl }));
        }
    }
    if (closing) {
        const a = Q[Q.length - 1], b = Q[0];
        items.push(line(a, b, { dash: true, sw: 1.6, op: 0.9 }));
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        items.push(text(mx, my + (my >= cen[1] ? 14 : -6), '? ' + unit, { size: 10, color: 'm', bold: true }));
    }
    if (back) {   // "bearing of the start from the end": North arrow + unknown arc at the last point
        const a = Q[Q.length - 1], b = Q[0];
        items.push(...arrowUp(a[0], a[1], 28));
        items.push(line(a, b, { dash: true, sw: 1.6, op: 0.9 }));
        const ang = Math.atan2(b[0] - a[0], -(b[1] - a[1]));   // clockwise from north
        const bt = ((ang % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        items.push(path(ellipsePts(a[0], a[1], 17, 17, -Math.PI / 2, -Math.PI / 2 + bt, 26), { sw: 1.4, stroke: 'm' }));
        const am = -Math.PI / 2 + bt / 2;
        items.push(text(a[0] + 33 * Math.cos(am), a[1] + 33 * Math.sin(am) + 4, '?', { size: 12, color: 'm', bold: true }));
        obstacles.push([a[0] + 33 * Math.cos(am), a[1] + 33 * Math.sin(am)]);
        for (let t = 0; t <= 2 * Math.PI; t += 0.3) if (t <= bt) obstacles.push([a[0] + 17 * Math.cos(-Math.PI / 2 + t), a[1] + 17 * Math.sin(-Math.PI / 2 + t)]);
    }
    // Vertex dots and names; each name takes the free spot (of 8) furthest from lines, arrows and labels.
    const CAND = Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4), Math.sin((k * Math.PI) / 4)]);
    Q.forEach((q, i) => {
        items.push(circle(q[0], q[1], 3.2, { fill: 'g', stroke: 'g', sw: 0 }));
        let best = null, bestScore = -1;
        for (const [cx, cy] of CAND) {
            const px = q[0] + cx * 17, py = q[1] + cy * 17;
            const score = Math.min(...obstacles.filter(o => Math.hypot(o[0] - q[0], o[1] - q[1]) > 4).map(o => Math.hypot(o[0] - px, o[1] - py)), 99);
            if (score > bestScore) { bestScore = score; best = [px, py]; }
        }
        items.push(text(best[0], best[1] + 4.5, nm(i), { size: 12, bold: true }));
    });
    return fitPrims(items, 6);
}

// diagram: { type:'cuboid-diag', l, w, h, unit?, find:'angle', angle? }
function cuboidDiagPrims({ l, w, h, unit = 'cm', angle }) {
    const items = [];
    const Lp = 96, Hp = Math.max(40, Math.min(80, Lp * (h / l))), k = Math.max(0.6, Math.min(1.1, w / l));
    const dx = 36 * k, dy = 22 * k, x = 16, yb = 128;
    const FTL = [x, yb - Hp], FTR = [x + Lp, yb - Hp], FBR = [x + Lp, yb], FBL = [x, yb];
    const BTL = [x + dx, yb - Hp - dy], BTR = [x + Lp + dx, yb - Hp - dy];
    const BBR = [x + Lp + dx, yb - dy], BBL = [x + dx, yb - dy];
    items.push(line(BBL, BTL, { dash: true, op: 0.5 }), line(BBL, BBR, { dash: true, op: 0.5 }), line(BBL, FBL, { dash: true, op: 0.5 }));
    items.push(poly([FTL, FTR, FBR, FBL]), poly([FTL, FTR, BTR, BTL]), poly([FTR, FBR, BBR, BTR]));
    // base diagonal and body diagonal from the front-bottom-left corner
    items.push(line(FBL, BBR, { dash: true, sw: 1.6, stroke: 'l', op: 0.8 }));
    items.push(line(BBR, BTR, { dash: true, sw: 1.6, stroke: 'l', op: 0.8 }));
    items.push(line(FBL, BTR, { sw: 2.4, stroke: 'm' }));
    const arc = angArc(FBL[0], FBL[1], 26, [BBR[0] - FBL[0], BBR[1] - FBL[1]], [BTR[0] - FBL[0], BTR[1] - FBL[1]]);
    items.push(path(arc.pts, { sw: 1.6, stroke: 'm' }));
    const al = angle != null ? { s: `${angle}°` } : { s: '?', color: 'm', bold: true };
    items.push(text(FBL[0] + 44 * Math.cos(arc.mid) + 4, FBL[1] + 44 * Math.sin(arc.mid) + 4, al.s, { size: 11, ...al }));
    items.push(text((FBL[0] + FBR[0]) / 2, yb + 14, `${l} ${unit}`, { size: 10 }));
    items.push(text(x - 6, yb - Hp / 2 + 4, `${h} ${unit}`, { anchor: 'end', size: 10 }));
    items.push(text((FBR[0] + BBR[0]) / 2 + 8, (FBR[1] + BBR[1]) / 2 + 14, `${w} ${unit}`, { anchor: 'start', size: 10 }));
    return fitPrims(items, 6);
}

// ─── public entry points ─────────────────────────────────────────────────────
const BUILDERS = { scene: scenePrims, bearing: bearingPrims, 'cuboid-diag': cuboidDiagPrims, table: tablePrims, venn: vennPrims, spinner: spinnerPrims, tree: treePrims, solid: solidPrims, 'stem-leaf': stemLeafPrims, 'box-plot': boxPlotPrims, 'dot-plot': dotPlotPrims, scatter: scatterPrims };
/** Height (mm) a primitive diagram wants in a PDF column `wMM` wide. */
export function preferredHeightMM(diagram, wMM, ps, base) {
    const p = buildPrims(diagram);
    if (!p) return base;
    const k = Math.min(diagram.essential ? 0.30 : 0.24, wMM / p.w);
    return Math.min(56 * ps, Math.max(base, p.h * k + 2));
}
export const isPrimDiagram = (d) => !!d && d.type in BUILDERS;
export function buildPrims(diagram) {
    const b = diagram && BUILDERS[diagram.type];
    return b ? b(diagram) : null;
}

// ─── SVG adapter ─────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STROKE = { g: GC, m: MC, l: 'currentColor', f: 'currentColor', none: 'none' };
function strokeAttr(o) {
    const col = STROKE[o.stroke] || 'currentColor';
    const op = o.op != null ? o.op : (o.stroke === 'l' ? 0.6 : o.stroke === 'f' ? 0.18 : null);
    return `stroke="${col}" stroke-width="${o.sw ?? 1.5}"` + (op != null ? ` stroke-opacity="${op}"` : '') +
        (o.dash ? ' stroke-dasharray="4 3"' : '') + ' stroke-linejoin="round" stroke-linecap="round"';
}
function fillAttr(f) {
    if (typeof f === 'string' && f[0] === '#') return `fill="${f}" fill-opacity="0.85"`;
    switch (f) {
        case 'tint':  return 'fill="currentColor" fill-opacity="0.07"';
        case 'gtint': return `fill="${GC}" fill-opacity="0.13"`;
        case 'mtint': return `fill="${MC}" fill-opacity="0.12"`;
        case 'white': return 'fill="white"';
        case 'g':     return `fill="${GC}"`;
        case 'm':     return `fill="${MC}"`;
        default:      return 'fill="none"';
    }
}
const pts2s = (pts) => pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

export function primsToSVG(prims) {
    let inner = '';
    for (const it of prims.items) {
        if (it.t === 'poly')        inner += `<polygon points="${pts2s(it.pts)}" ${fillAttr(it.fill)} ${strokeAttr(it)}/>`;
        else if (it.t === 'path')   inner += `<polyline points="${pts2s(it.pts)}" fill="none" ${strokeAttr(it)}/>`;
        else if (it.t === 'circle') inner += `<circle cx="${it.cx.toFixed(1)}" cy="${it.cy.toFixed(1)}" r="${it.r}" ${fillAttr(it.fill)} ${strokeAttr(it)}/>`;
        else if (it.t === 'text') {
            const fill = it.color === 'm' ? MC : 'currentColor';
            inner += `<text x="${it.x.toFixed(1)}" y="${it.y.toFixed(1)}" text-anchor="${it.anchor}" fill="${fill}" ` +
                `font-size="${it.size}" font-weight="${it.bold || it.color === 'm' ? 'bold' : 'normal'}" font-family="Inter,sans-serif"` +
                (it.op != null && it.op < 1 ? ` opacity="${it.op}"` : '') + `>${esc(it.s)}</text>`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${prims.w} ${prims.h}" ` +
        `width="${prims.w}" height="${prims.h}" aria-hidden="true" class="geo-diagram-svg">${inner}</svg>`;
}
