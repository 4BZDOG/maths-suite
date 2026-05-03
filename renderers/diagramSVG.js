// renderers/diagramSVG.js
// Generates inline SVG strings for geometry question diagrams.
// Colors adapt to light/dark mode via currentColor where possible.

const GC  = '#10b981';   // geometry emerald (shape outlines, dashes)
const MC  = '#ef4444';   // missing value red
const MCL = '#f87171';   // lighter red for dark mode (unused in SVG attrs; handled via CSS)

// Wrap content in a sized SVG element
function _svg(w, h, inner) {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
        `width="${w}" height="${h}" aria-hidden="true" class="geo-diagram-svg">` +
        inner +
        `</svg>`
    );
}

// Text helper — uses currentColor for regular labels, hardcoded red for missing
function _t(x, y, txt, { anchor = 'middle', missing = false, size = 11, transform = '' } = {}) {
    const fill   = missing ? MC : 'currentColor';
    const weight = missing ? 'bold' : 'normal';
    const xf     = transform ? ` transform="${transform}"` : '';
    return (
        `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" ` +
        `font-size="${size}" font-weight="${weight}" font-family="Inter,sans-serif"${xf}>${txt}</text>`
    );
}

// Small right-angle square marker at vertex (vx,vy) pointing right and up
function _rightAngleMark(vx, vy, size = 8) {
    const s = size;
    return (
        `<polyline points="${vx + s},${vy} ${vx + s},${vy - s} ${vx},${vy - s}" ` +
        `fill="none" stroke="${GC}" stroke-width="1.5"/>`
    );
}

// ─── Rectangle ───────────────────────────────────────────────────────────────
// diagram: { type:'rectangle', l, w, missing:'area'|'perimeter' }
function _rectangle({ l, w: wv }) {
    const VW = 168, VH = 98;
    const boxW = 118, boxH = 58;

    // Scale to maintain aspect ratio, clamped to box
    const aspect = l / wv;
    let dw = aspect >= boxW / boxH ? boxW : boxH * aspect;
    let dh = aspect >= boxW / boxH ? boxW / aspect : boxH;
    dw = Math.max(46, Math.min(boxW, dw));
    dh = Math.max(26, Math.min(boxH, dh));

    const x0 = (VW - dw) / 2;
    const y0 = (VH - dh) / 2 - 3;

    // Tick marks on opposite sides to indicate equal dims (not needed here)
    const inner =
        // Shape
        `<rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2" rx="1"/>` +
        // Length label below (centred) — clear of bottom edge
        _t(x0 + dw / 2, y0 + dh + 18, String(l)) +
        // Width label left (oriented normally) — clear of left edge
        _t(x0 - 12, y0 + dh / 2 + 4, String(wv), { anchor: 'end' }) +
        // Missing "?" centred in shape
        _t(x0 + dw / 2, y0 + dh / 2 + 5, '?', { missing: true, size: 14 });

    return _svg(VW, VH, inner);
}

// ─── Right Triangle (Pythagoras) ─────────────────────────────────────────────
// diagram: { type:'right-triangle', a, b, c, missing:'a'|'b'|'c' }
// Right angle at bottom-left; a = horizontal leg, b = vertical leg, c = hyp
function _rightTriangle({ a, b, c, missing }) {
    const VW = 172, VH = 118;
    const maxW = 104, maxH = 82;

    const sc  = Math.min(maxW / a, maxH / b);
    const aPx = Math.max(42, Math.min(maxW, a * sc));
    const bPx = Math.max(30, Math.min(maxH, b * sc));

    const Ax = 30, Ay = VH - 16;
    const Bx = Ax + aPx, By = Ay;
    const Cx = Ax, Cy = Ay - bPx;

    const aLabel = missing === 'a' ? '?' : String(a);
    const bLabel = missing === 'b' ? '?' : String(b);
    const cLabel = missing === 'c' ? '?' : String(c);

    // Hypotenuse midpoint with perpendicular offset for label
    const hmx = (Bx + Cx) / 2;
    const hmy = (By + Cy) / 2;
    // Normal to hypotenuse pointing up-right, away from right-angle vertex
    const dx = Bx - Cx, dy = By - Cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dy / len, ny = -dx / len;
    const lx = hmx + nx * 29;
    const ly = hmy + ny * 29 + 5;

    const inner =
        // Triangle fill + outline
        `<polygon points="${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Right-angle mark
        _rightAngleMark(Ax, Ay, 9) +
        // Leg a (below baseline) — clear of bottom edge
        _t((Ax + Bx) / 2, Ay + 18, aLabel, { missing: missing === 'a' }) +
        // Leg b (left side, oriented normally) — clear of left edge
        _t(Ax - 12, (Ay + Cy) / 2 + 4, bLabel, { anchor: 'end', missing: missing === 'b' }) +
        // Hypotenuse label at midpoint (points up-right)
        _t(lx, ly, `c\u202F=\u202F${cLabel}`, { anchor: 'middle', missing: missing === 'c', size: 11 });

    return _svg(VW, VH, inner);
}

// ─── Triangle with Two Known Angles (find third) ─────────────────────────────
// diagram: { type:'triangle-angles', a1, a2, a3, missing:'a3' }
function _triangleAngles({ a1, a2, a3, missing }) {
    const VW = 168, VH = 110;

    // Nicely proportioned scalene-ish triangle
    const A = { x: 16,  y: 92 };
    const B = { x: 152, y: 92 };
    const C = { x: 76,  y: 16 };

    const a3Label = missing === 'a3' ? '?' : `${a3}\u00B0`;

    const inner =
        // Triangle
        `<polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Angle labels — inside each vertex
        _t(A.x + 18, A.y - 5, `${a1}\u00B0`, { anchor: 'start' }) +
        _t(B.x - 18, B.y - 5, `${a2}\u00B0`, { anchor: 'end' }) +
        _t(C.x, C.y + 20, a3Label, { anchor: 'middle', missing: missing === 'a3' });

    return _svg(VW, VH, inner);
}

// ─── Triangle Area (base × height / 2) ───────────────────────────────────────
// diagram: { type:'triangle-area', base, height }
function _triangleArea({ base, height }) {
    const VW = 168, VH = 110;
    const bPx = 118;
    const ratio = height / base;
    const hPx = Math.max(36, Math.min(70, bPx * ratio * 0.68));

    const cx = VW / 2;
    const y0 = VH - 14;
    const bl = { x: cx - bPx / 2, y: y0 };
    const br = { x: cx + bPx / 2, y: y0 };
    const ap = { x: cx, y: y0 - hPx };

    const inner =
        // Triangle
        `<polygon points="${bl.x},${bl.y} ${br.x},${br.y} ${ap.x},${ap.y}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Dashed height line
        `<line x1="${ap.x}" y1="${ap.y}" x2="${ap.x}" y2="${y0}" ` +
        `stroke="${GC}" stroke-width="1.2" stroke-dasharray="4,3" opacity="0.75"/>` +
        // Right-angle mark at foot of height
        `<polyline points="${ap.x + 6},${y0} ${ap.x + 6},${y0 - 6} ${ap.x},${y0 - 6}" ` +
        `fill="none" stroke="${GC}" stroke-width="1.2"/>` +
        // Base label \u2014 clear of bottom edge
        _t(cx, y0 + 18, String(base)) +
        // Height label (right of dashed line) \u2014 generous clearance
        _t(ap.x + 24, (ap.y + y0) / 2 + 4, `h\u202F=\u202F${height}`, { anchor: 'start', size: 11 }) +
        // Missing "?" for area (left of height line)
        _t(cx - 24, (ap.y + y0) / 2 + 5, '?', { missing: true, size: 14 });

    return _svg(VW, VH, inner);
}

// ─── Circle (area or circumference) ──────────────────────────────────────────
// diagram: { type:'circle', r, missing:'area'|'circumference' }
function _circle({ r, missing }) {
    const VW = 200, VH = 120;
    const cx = 70, cy = 64;
    const rPx = Math.min(54, Math.max(38, r * 4.5));

    const missText = missing === 'area' ? 'A\u202F=\u202F?' : 'C\u202F=\u202F?';

    const inner =
        // Circle fill + outline
        `<circle cx="${cx}" cy="${cy}" r="${rPx}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Dashed radius line
        `<line x1="${cx}" y1="${cy}" x2="${cx + rPx}" y2="${cy}" ` +
        `stroke="${GC}" stroke-width="1.4" stroke-dasharray="4,3"/>` +
        // Centre dot
        `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${GC}"/>` +
        // r label — normally oriented, centred just above the radius line
        _t(cx + rPx / 2, cy - 6, `r\u202F=\u202F${r}`, { size: 11 }) +
        // Missing label to the right with generous clearance
        _t(cx + rPx + 14, cy + 6, missText, { anchor: 'start', missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function renderDiagramSVG(diagram) {
    if (!diagram) return '';
    switch (diagram.type) {
        case 'rectangle':        return _rectangle(diagram);
        case 'right-triangle':   return _rightTriangle(diagram);
        case 'triangle-angles':  return _triangleAngles(diagram);
        case 'triangle-area':    return _triangleArea(diagram);
        case 'circle':           return _circle(diagram);
        default: return '';
    }
}
