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

// ─── public entry points ─────────────────────────────────────────────────────
const BUILDERS = { solid: solidPrims };
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
