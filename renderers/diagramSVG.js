// renderers/diagramSVG.js
// Generates inline SVG strings for geometry question diagrams.
// Colors adapt to light/dark mode via currentColor where possible.

const GC = '#10b981';  // emerald — shape outlines, arcs, dimension lines
const MC = '#ef4444';  // red — missing value highlights

function _svg(w, h, inner) {
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
        `width="${w}" height="${h}" aria-hidden="true" class="geo-diagram-svg">` +
        inner +
        `</svg>`
    );
}

// Text label — missing values render in red bold
function _t(x, y, txt, { anchor = 'middle', missing = false, size = 11, opacity = 1 } = {}) {
    const fill   = missing ? MC : 'currentColor';
    const weight = missing ? 'bold' : 'normal';
    const op     = opacity < 1 ? ` opacity="${opacity}"` : '';
    return (
        `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" ` +
        `font-size="${size}" font-weight="${weight}" font-family="Inter,sans-serif"${op}>${txt}</text>`
    );
}

// Standard right-angle square at bottom-left vertex: legs go right (+x) and up (−y)
function _rightAngleMark(vx, vy, s = 8) {
    return (
        `<polyline points="${vx + s},${vy} ${vx + s},${vy - s} ${vx},${vy - s}" ` +
        `fill="none" stroke="${GC}" stroke-width="1.5"/>`
    );
}

// General right-angle mark at vertex (vx,vy) where legs go in unit directions (ax,ay) and (bx,by)
function _rightAngleAt(vx, vy, ax, ay, bx, by, s = 7) {
    const p1x = (vx + ax * s).toFixed(1), p1y = (vy + ay * s).toFixed(1);
    const p2x = (vx + ax * s + bx * s).toFixed(1), p2y = (vy + ay * s + by * s).toFixed(1);
    const p3x = (vx + bx * s).toFixed(1), p3y = (vy + by * s).toFixed(1);
    return (
        `<polyline points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}" ` +
        `fill="none" stroke="${GC}" stroke-width="1.4"/>`
    );
}

// Angle arc at vertex (vx,vy) sweeping between adjacent vertices p1 and p2.
// Uses cross product to determine the short-arc sweep direction.
function _angleArc(vx, vy, p1x, p1y, p2x, p2y, r = 16) {
    const d1 = Math.hypot(p1x - vx, p1y - vy);
    const d2 = Math.hypot(p2x - vx, p2y - vy);
    if (d1 === 0 || d2 === 0) return '';
    const u1x = (p1x - vx) / d1, u1y = (p1y - vy) / d1;
    const u2x = (p2x - vx) / d2, u2y = (p2y - vy) / d2;
    const sx = (vx + r * u1x).toFixed(1), sy = (vy + r * u1y).toFixed(1);
    const ex = (vx + r * u2x).toFixed(1), ey = (vy + r * u2y).toFixed(1);
    // In SVG coords (y-down): cross > 0 → short arc is CW (sweep=1); cross < 0 → CCW (sweep=0)
    const cross = u1x * u2y - u1y * u2x;
    const sweep = cross > 0 ? 1 : 0;
    return `<path d="M ${sx},${sy} A ${r},${r} 0 0,${sweep} ${ex},${ey}" fill="none" stroke="${GC}" stroke-width="1.3"/>`;
}

// ─── Rectangle ───────────────────────────────────────────────────────────────
// diagram: { type:'rectangle', l, w, missing:'area'|'perimeter' }
function _rectangle({ l, w: wv, missing }) {
    const VW = 184, VH = 112;
    const boxW = 122, boxH = 64;

    const aspect = l / wv;
    let dw = aspect >= boxW / boxH ? boxW : boxH * aspect;
    let dh = aspect >= boxW / boxH ? boxW / aspect : boxH;
    dw = Math.max(50, Math.min(boxW, dw));
    dh = Math.max(28, Math.min(boxH, dh));

    const x0 = (VW - dw) / 2;
    const y0 = (VH - dh) / 2 - 4;
    const s  = 7; // corner mark size

    const centerLabel = missing === 'area' ? 'A = ?' : 'P = ?';

    // Four corner right-angle marks (each is an L-shaped polyline pointing inward)
    const corners =
        `<polyline points="${x0+s},${y0} ${x0+s},${y0+s} ${x0},${y0+s}" fill="none" stroke="${GC}" stroke-width="1.2"/>` +
        `<polyline points="${x0+dw-s},${y0} ${x0+dw-s},${y0+s} ${x0+dw},${y0+s}" fill="none" stroke="${GC}" stroke-width="1.2"/>` +
        `<polyline points="${x0+s},${y0+dh} ${x0+s},${y0+dh-s} ${x0},${y0+dh-s}" fill="none" stroke="${GC}" stroke-width="1.2"/>` +
        `<polyline points="${x0+dw-s},${y0+dh} ${x0+dw-s},${y0+dh-s} ${x0+dw},${y0+dh-s}" fill="none" stroke="${GC}" stroke-width="1.2"/>`;

    const inner =
        // Shape
        `<rect x="${x0}" y="${y0}" width="${dw}" height="${dh}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2" rx="1"/>` +
        corners +
        // Length label below centre, with unit tick lines at ends
        `<line x1="${x0+4}" y1="${y0+dh+10}" x2="${x0+dw-4}" y2="${y0+dh+10}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${x0+4}" y1="${y0+dh+7}" x2="${x0+4}" y2="${y0+dh+13}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${x0+dw-4}" y1="${y0+dh+7}" x2="${x0+dw-4}" y2="${y0+dh+13}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(x0 + dw / 2, y0 + dh + 22, `l = ${l}`) +
        // Width label on left side, with unit tick lines
        `<line x1="${x0-10}" y1="${y0+4}" x2="${x0-10}" y2="${y0+dh-4}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${x0-13}" y1="${y0+4}" x2="${x0-7}" y2="${y0+4}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${x0-13}" y1="${y0+dh-4}" x2="${x0-7}" y2="${y0+dh-4}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(x0 - 16, y0 + dh / 2 + 4, `w = ${wv}`, { anchor: 'end' }) +
        // Missing value centred inside shape
        _t(x0 + dw / 2, y0 + dh / 2 + 5, centerLabel, { missing: true, size: 14 });

    return _svg(VW, VH, inner);
}

// ─── Right Triangle (Pythagoras) ─────────────────────────────────────────────
// diagram: { type:'right-triangle', a, b, c, missing:'a'|'b'|'c' }
// Right angle at bottom-left; a = horizontal leg, b = vertical leg, c = hyp
function _rightTriangle({ a, b, c, missing }) {
    const VW = 184, VH = 130;
    const maxW = 110, maxH = 86;

    const sc  = Math.min(maxW / a, maxH / b);
    const aPx = Math.max(46, Math.min(maxW, a * sc));
    const bPx = Math.max(32, Math.min(maxH, b * sc));

    const Ax = 34, Ay = VH - 18;
    const Bx = Ax + aPx, By = Ay;
    const Cx = Ax, Cy = Ay - bPx;

    const aLabel = missing === 'a' ? '?' : String(a);
    const bLabel = missing === 'b' ? '?' : String(b);
    const cLabel = missing === 'c' ? '?' : String(c);

    // Hypotenuse midpoint + outward normal for label placement
    const hmx = (Bx + Cx) / 2;
    const hmy = (By + Cy) / 2;
    const hdx = Bx - Cx, hdy = By - Cy;
    const hlen = Math.sqrt(hdx * hdx + hdy * hdy);
    const nx = hdy / hlen, ny = -hdx / hlen;
    const lx = hmx + nx * 30;
    const ly = hmy + ny * 30 + 5;

    const inner =
        `<polygon points="${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Right-angle mark at A (legs go right and up)
        _rightAngleMark(Ax, Ay, 10) +
        // Leg a — below baseline
        _t((Ax + Bx) / 2, Ay + 18, `a = ${aLabel}`, { missing: missing === 'a', size: 11 }) +
        // Leg b — left of vertical leg
        _t(Ax - 10, (Ay + Cy) / 2 + 4, `b = ${bLabel}`, { anchor: 'end', missing: missing === 'b', size: 11 }) +
        // Hypotenuse — offset from midpoint along outward normal
        _t(lx, ly, `c = ${cLabel}`, { anchor: 'middle', missing: missing === 'c', size: 11 });

    return _svg(VW, VH, inner);
}

// ─── Triangle with Two Known Angles (find third) ─────────────────────────────
// diagram: { type:'triangle-angles', a1, a2, a3, missing:'a3' }
function _triangleAngles({ a1, a2, a3, missing }) {
    const VW = 184, VH = 124;

    // Scalene-ish triangle with good proportions and margin for arcs + labels
    const A = { x: 20,  y: 104 };
    const B = { x: 164, y: 104 };
    const C = { x: 86,  y: 18  };

    const a3Label = missing === 'a3' ? '?' : `${a3}°`;

    // Angle arc radius — C gets slightly smaller arc (apex may be tighter)
    const arcR = 18, arcRC = 16;

    const inner =
        `<polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Arc marks at each vertex (shows which angles are labelled)
        _angleArc(A.x, A.y, B.x, B.y, C.x, C.y, arcR) +
        _angleArc(B.x, B.y, A.x, A.y, C.x, C.y, arcR) +
        _angleArc(C.x, C.y, A.x, A.y, B.x, B.y, arcRC) +
        // Angle labels — positioned just outside the arc, inside the triangle
        _t(A.x + 28, A.y - 8,  `${a1}°`, { anchor: 'start', size: 11 }) +
        _t(B.x - 28, B.y - 8,  `${a2}°`, { anchor: 'end',   size: 11 }) +
        _t(C.x,      C.y + 26, a3Label,        { anchor: 'middle', missing: missing === 'a3', size: 11 });

    return _svg(VW, VH, inner);
}

// ─── Triangle Area (base × height / 2) ───────────────────────────────────────
// diagram: { type:'triangle-area', base, height }
function _triangleArea({ base, height }) {
    const VW = 220, VH = 124;
    const bPx = 128;
    const ratio = height / base;
    const hPx = Math.max(38, Math.min(76, bPx * ratio * 0.68));

    // Shift triangle slightly left so the external "h = X" label has room
    // to sit clear of the right-hand triangle side.
    const cx = VW / 2 - 16;
    const y0 = VH - 18;
    const bl = { x: cx - bPx / 2, y: y0 };
    const br = { x: cx + bPx / 2, y: y0 };
    const ap = { x: cx,           y: y0 - hPx };

    // External vertical guide for the height label, parallel to the dashed
    // height line but placed past the triangle's right edge so the label
    // can't overlap the side.
    const labelX = br.x + 18;

    const inner =
        `<polygon points="${bl.x},${bl.y} ${br.x},${br.y} ${ap.x},${ap.y}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Dashed height line from apex to base
        `<line x1="${ap.x}" y1="${ap.y}" x2="${ap.x}" y2="${y0}" ` +
        `stroke="${GC}" stroke-width="1.3" stroke-dasharray="4,3" opacity="0.8"/>` +
        // Right-angle mark at foot of height (height meets base perpendicularly)
        `<polyline points="${ap.x+7},${y0} ${ap.x+7},${y0-7} ${ap.x},${y0-7}" ` +
        `fill="none" stroke="${GC}" stroke-width="1.3"/>` +
        // External tick markers showing the height span to the right of the triangle
        `<line x1="${labelX - 4}" y1="${ap.y}" x2="${labelX + 4}" y2="${ap.y}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${labelX - 4}" y1="${y0}" x2="${labelX + 4}" y2="${y0}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${labelX}" y1="${ap.y}" x2="${labelX}" y2="${y0}" stroke="${GC}" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>` +
        // Base label below (b = X)
        _t(cx, y0 + 17, `b = ${base}`, { size: 11 }) +
        // Height label to the right of the external guide
        _t(labelX + 6, (ap.y + y0) / 2 + 4, `h = ${height}`, { anchor: 'start', size: 11 }) +
        // Missing area label inside triangle (left of height line)
        _t(cx - 22, (ap.y + y0) / 2 + 5, 'A = ?', { missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Circle (area or circumference) ──────────────────────────────────────────
// diagram: { type:'circle', r, missing:'area'|'circumference' }
function _circle({ r, missing }) {
    const VW = 216, VH = 130;
    const cx = 74, cy = 66;
    const rPx = Math.min(56, Math.max(38, r * 4.5));

    const missText = missing === 'area' ? 'A = ?' : 'C = ?';
    const hintText = missing === 'area' ? 'A = πr²' : 'C = 2πr';

    const inner =
        // Circle
        `<circle cx="${cx}" cy="${cy}" r="${rPx}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Dashed radius line from centre to edge
        `<line x1="${cx}" y1="${cy}" x2="${cx + rPx}" y2="${cy}" ` +
        `stroke="${GC}" stroke-width="1.5" stroke-dasharray="4,3"/>` +
        // Centre dot
        `<circle cx="${cx}" cy="${cy}" r="2.8" fill="${GC}"/>` +
        // Centre label "O"
        _t(cx - 7, cy + 13, 'O', { size: 10 }) +
        // Radius label centred above the radius line
        _t(cx + rPx / 2, cy - 8, `r = ${r}`, { size: 11 }) +
        // Missing value (right of circle, prominent)
        _t(cx + rPx + 18, cy - 7, missText, { anchor: 'start', missing: true, size: 14 }) +
        // Formula hint (right of circle, smaller)
        _t(cx + rPx + 18, cy + 11, hintText, { anchor: 'start', size: 9, opacity: 0.7 });

    return _svg(VW, VH, inner);
}

// ─── Right Triangle — Trigonometry (SOHCAHTOA) ───────────────────────────────
// diagram: { type:'right-triangle-trig', opp, adj, hyp, angle, missing:'opp'|'adj'|'hyp'|'angle' }
// Layout: right-angle at bottom-left (A), theta at bottom-right (B), apex at top-left (C)
function _rightTriangleTrig({ opp, adj, hyp, angle, missing }) {
    const VW = 214, VH = 142;
    const adjPx = 106, oppPx = 78;

    const Ax = 32, Ay = VH - 20;  // right-angle (bottom-left)
    const Bx = Ax + adjPx, By = Ay;  // theta (bottom-right)
    const Cx = Ax, Cy = Ay - oppPx;  // apex (top-left)

    const adjLabel = missing === 'adj'   ? '?' : String(adj);
    const oppLabel = missing === 'opp'   ? '?' : String(opp);
    const hypLabel = missing === 'hyp'   ? '?' : String(hyp);
    const angLabel = missing === 'angle' ? '?' : `${angle}°`;

    // Hyp midpoint + outward normal for label
    const hmx = (Bx + Cx) / 2, hmy = (By + Cy) / 2;
    const hdx = Bx - Cx, hdy = By - Cy;
    const hlen = Math.hypot(hdx, hdy);
    const nx = hdy / hlen, ny = -hdx / hlen;
    const lx = hmx + nx * 26, ly = hmy + ny * 26 + 4;

    // Theta arc at B between legs BA and BC
    const arcR = 22;

    const inner =
        `<polygon points="${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}" ` +
        `fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // Right-angle mark at A
        _rightAngleMark(Ax, Ay, 10) +
        // Angle arc at B (between adj leg and hypotenuse)
        _angleArc(Bx, By, Ax, Ay, Cx, Cy, arcR) +
        // θ label inside the arc
        _t(Bx - 34, By - 16, `θ = ${angLabel}`,
            { anchor: 'end', missing: missing === 'angle', size: 10 }) +
        // adj label below the baseline
        _t((Ax + Bx) / 2, Ay + 17, `adj = ${adjLabel}`,
            { anchor: 'middle', missing: missing === 'adj', size: 10 }) +
        // opp label left of the vertical leg
        _t(Ax - 8, (Ay + Cy) / 2 + 4, `opp = ${oppLabel}`,
            { anchor: 'end', missing: missing === 'opp', size: 10 }) +
        // hyp label along the hypotenuse
        _t(lx, ly, `hyp = ${hypLabel}`,
            { anchor: 'middle', missing: missing === 'hyp', size: 10 });

    return _svg(VW, VH, inner);
}

// ─── Parabola y = a(x−h)² + k ────────────────────────────────────────────────
// diagram: { type:'parabola', h, k, a }
function _parabola({ h, k, a }) {
    const VW = 190, VH = 142;
    const ox = 68, oy = 84;   // SVG-pixel origin of the coordinate system
    const scaleX = 25, scaleY = 22;

    // Build curve points, clipped to viewBox interior
    const xMin = -2.3, xMax = 2.3, numPts = 48;
    const pts = [];
    for (let i = 0; i <= numPts; i++) {
        const xc = xMin + (xMax - xMin) * (i / numPts);
        const yc = a * (xc - h) * (xc - h) + k;
        const px = ox + xc * scaleX;
        const py = oy - yc * scaleY;
        if (px > 4 && px < VW - 4 && py > 4 && py < VH - 4)
            pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }

    const axL = 6, axR = VW - 10, axT = 6, axB = VH - 8;

    // Vertex in SVG coordinates
    const vx = ox + h * scaleX;
    const vy = oy - k * scaleY;
    const vertexVisible = vx > 10 && vx < VW - 10 && vy > 10 && vy < VH - 10;

    // Axis tick marks and labels at integers −2 … 2
    let ticks = '';
    for (let i = -2; i <= 2; i++) {
        // X-axis ticks
        const tx = ox + i * scaleX;
        if (tx > axL + 4 && tx < axR - 4) {
            ticks +=
                `<line x1="${tx}" y1="${oy - 3}" x2="${tx}" y2="${oy + 3}" ` +
                `stroke="currentColor" stroke-width="0.9" opacity="0.4"/>`;
            if (i !== 0)
                ticks += _t(tx, oy + 12, String(i), { size: 8, opacity: 0.6 });
        }
        // Y-axis ticks
        const ty = oy - i * scaleY;
        if (i !== 0 && ty > axT + 4 && ty < axB - 4) {
            ticks +=
                `<line x1="${ox - 3}" y1="${ty}" x2="${ox + 3}" y2="${ty}" ` +
                `stroke="currentColor" stroke-width="0.9" opacity="0.4"/>`;
            ticks += _t(ox - 5, ty + 3, String(i), { anchor: 'end', size: 8, opacity: 0.6 });
        }
    }
    // Origin label
    ticks += _t(ox - 5, oy + 12, '0', { anchor: 'end', size: 8, opacity: 0.6 });

    const inner =
        // X-axis
        `<line x1="${axL}" y1="${oy}" x2="${axR}" y2="${oy}" ` +
        `stroke="currentColor" stroke-width="1.3" opacity="0.45"/>` +
        // X-axis arrowhead
        `<polygon points="${axR},${oy} ${axR - 5},${oy - 3} ${axR - 5},${oy + 3}" ` +
        `fill="currentColor" opacity="0.45"/>` +
        // Y-axis
        `<line x1="${ox}" y1="${axB}" x2="${ox}" y2="${axT}" ` +
        `stroke="currentColor" stroke-width="1.3" opacity="0.45"/>` +
        // Y-axis arrowhead
        `<polygon points="${ox},${axT} ${ox - 3},${axT + 5} ${ox + 3},${axT + 5}" ` +
        `fill="currentColor" opacity="0.45"/>` +
        // Axis labels
        _t(axR - 4, oy - 7, 'x', { anchor: 'end', size: 10, opacity: 0.7 }) +
        _t(ox + 7, axT + 9,  'y', { anchor: 'start', size: 10, opacity: 0.7 }) +
        // Tick marks and number labels
        ticks +
        // Parabola curve
        (pts.length > 1
            ? `<polyline points="${pts.join(' ')}" fill="none" stroke="${GC}" stroke-width="2.2" stroke-linejoin="round"/>`
            : '') +
        // Vertex: dot + coordinate label
        (vertexVisible
            ? `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="3.8" fill="${MC}"/>` +
              _t(vx + 10, vy - 5, `(${h}, ${k})`, { anchor: 'start', missing: true, size: 9 })
            : '');

    return _svg(VW, VH, inner);
}

// ─── Parallelogram ───────────────────────────────────────────────────────────
// diagram: { type:'parallelogram', base, height, missing:'area'|'perimeter' }
function _parallelogram({ base, height, missing }) {
    const VW = 220, VH = 120;
    const bPx = Math.max(70, Math.min(130, base * 7));
    const hPx = Math.max(30, Math.min(65, height * 6));
    const skew = 20; // horizontal offset for the slant

    // Leave 28px on the right for the external height label
    const x0 = (VW - bPx - skew - 28) / 2;
    const y0 = (VH - hPx) / 2 - 4;

    // 4 vertices: bottom-left, bottom-right, top-right, top-left
    const pts = [
        [x0, y0 + hPx],
        [x0 + bPx, y0 + hPx],
        [x0 + bPx + skew, y0],
        [x0 + skew, y0],
    ].map(([x, y]) => `${x},${y}`).join(' ');

    const label = missing === 'area' ? 'A = ?' : 'P = ?';
    const cx = x0 + bPx / 2 + skew / 2;
    const cy = y0 + hPx / 2 + 5;

    // Dashed height indicator line, positioned just OUTSIDE the right edge of
    // the parallelogram so the label doesn't collide with the slant.
    const hx = x0 + bPx + skew + 12;
    const heightLine =
        `<line x1="${hx}" y1="${y0}" x2="${hx}" y2="${y0 + hPx}" stroke="${GC}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>` +
        // Small horizontal connector ticks at top and bottom of the height line
        `<line x1="${hx - 3}" y1="${y0}" x2="${hx + 3}" y2="${y0}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${hx - 3}" y1="${y0 + hPx}" x2="${hx + 3}" y2="${y0 + hPx}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(hx + 6, y0 + hPx / 2 + 4, `h = ${height}`, { anchor: 'start', size: 10 });

    const inner =
        `<polygon points="${pts}" fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // base label
        `<line x1="${x0+4}" y1="${y0+hPx+10}" x2="${x0+bPx-4}" y2="${y0+hPx+10}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(x0 + bPx / 2, y0 + hPx + 22, `b = ${base}`) +
        heightLine +
        _t(cx, cy, label, { missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Trapezium ────────────────────────────────────────────────────────────────
// diagram: { type:'trapezium', a, b, height, missing:'area' }
// a = top (shorter) parallel side, b = bottom (longer) parallel side
function _trapezium({ a, b, height, missing }) {
    const VW = 220, VH = 120;
    const bPx = Math.max(80, Math.min(130, b * 7));
    const hPx = Math.max(32, Math.min(62, height * 6));
    const aPx = Math.max(30, Math.min(bPx - 10, a * 7));

    // Leave 28px on the right for the external height label
    const x0 = (VW - bPx - 28) / 2;
    const y0 = (VH - hPx) / 2 - 2;
    const offset = (bPx - aPx) / 2; // indent for top edge

    // 4 vertices: bottom-left, bottom-right, top-right, top-left
    const pts = [
        [x0, y0 + hPx],
        [x0 + bPx, y0 + hPx],
        [x0 + bPx - offset, y0],
        [x0 + offset, y0],
    ].map(([x, y]) => `${x},${y}`).join(' ');

    const cx = x0 + bPx / 2;
    const cy = y0 + hPx / 2 + 5;

    // Dashed height indicator outside the right edge of the trapezium, so the
    // label does not collide with the shape's diagonal side.
    const hx = x0 + bPx + 12;
    const heightLine =
        `<line x1="${hx}" y1="${y0}" x2="${hx}" y2="${y0 + hPx}" stroke="${GC}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>` +
        `<line x1="${hx - 3}" y1="${y0}" x2="${hx + 3}" y2="${y0}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${hx - 3}" y1="${y0 + hPx}" x2="${hx + 3}" y2="${y0 + hPx}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(hx + 6, y0 + hPx / 2 + 4, `h = ${height}`, { anchor: 'start', size: 10 });

    const inner =
        `<polygon points="${pts}" fill="currentColor" fill-opacity="0.07" stroke="${GC}" stroke-width="2"/>` +
        // bottom label
        `<line x1="${x0+4}" y1="${y0+hPx+10}" x2="${x0+bPx-4}" y2="${y0+hPx+10}" stroke="${GC}" stroke-width="1" opacity="0.5"/>` +
        _t(cx, y0 + hPx + 22, `b = ${b}`) +
        // top label
        _t(cx, y0 - 6, `a = ${a}`) +
        heightLine +
        _t(cx, cy, missing === 'area' ? 'A = ?' : '?', { missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Parallel Lines with Transversal ─────────────────────────────────────────
// diagram: { type:'parallel-transversal', a, angleType:'co-interior'|'corresponding'|'alternate' }
function _parallelTransversal({ a, angleType }) {
    const VW = 220, VH = 140;

    // Two horizontal parallel lines
    const y1 = 40, y2 = 100;
    const xL = 15, xR = 205;

    // Transversal: from (55, 120) to (165, 20)
    // Intersection with y1=40: t=0.8 → x=143; with y2=100: t=0.2 → x=77
    const P1 = { x: 143, y: y1 };
    const P2 = { x: 77,  y: y2 };
    const txBot = { x: 55,  y: 120 };  // transversal extended below
    const txTop = { x: 165, y: 20  };  // transversal extended above

    // Parallel-line tick marks (two short chevrons) away from transversal
    const parallelTick = (x, y) =>
        `<line x1="${x-5}" y1="${y-6}" x2="${x+1}" y2="${y}" stroke="${GC}" stroke-width="1.2" opacity="0.6"/>` +
        `<line x1="${x-5}" y1="${y+6}" x2="${x+1}" y2="${y}" stroke="${GC}" stroke-width="1.2" opacity="0.6"/>`;
    const tickMarks =
        parallelTick(48, y1) + parallelTick(54, y1) +
        parallelTick(48, y2) + parallelTick(54, y2);

    // Arc and label positions per angle type
    // All arcs use _angleArc(vx, vy, p1x, p1y, p2x, p2y, r)
    // p1/p2 are points on the two rays forming the labelled angle
    let arc1, arc2, lx1, ly1, lx2, ly2;
    const r = 17;

    if (angleType === 'co-interior') {
        // Between the parallel lines, same side (right of transversal)
        // P1: horiz-right & transversal-going-down
        arc1 = _angleArc(P1.x, P1.y, xR, y1, txBot.x, txBot.y, r);
        lx1 = P1.x + r + 6; ly1 = P1.y + 14;
        // P2: transversal-going-up & horiz-right
        arc2 = _angleArc(P2.x, P2.y, txTop.x, txTop.y, xR, y2, r);
        lx2 = P2.x + r + 6; ly2 = P2.y - 6;
    } else if (angleType === 'corresponding') {
        // Same position at each intersection: both above-right (NE quadrant)
        arc1 = _angleArc(P1.x, P1.y, xR, y1, txTop.x, txTop.y, r);
        lx1 = P1.x + r + 6; ly1 = P1.y - 6;
        arc2 = _angleArc(P2.x, P2.y, xR, y2, txTop.x, txTop.y, r);
        lx2 = P2.x + r + 6; ly2 = P2.y - 6;
    } else {
        // alternate — opposite sides between lines
        // P1: below-left (horiz-left & transversal-going-down)
        arc1 = _angleArc(P1.x, P1.y, xL, y1, txBot.x, txBot.y, r);
        lx1 = P1.x - r - 12; ly1 = P1.y + 14;
        // P2: above-right (horiz-right & transversal-going-up)
        arc2 = _angleArc(P2.x, P2.y, xR, y2, txTop.x, txTop.y, r);
        lx2 = P2.x + r + 6; ly2 = P2.y - 6;
    }

    const inner =
        // Parallel lines
        `<line x1="${xL}" y1="${y1}" x2="${xR}" y2="${y1}" stroke="${GC}" stroke-width="1.8"/>` +
        `<line x1="${xL}" y1="${y2}" x2="${xR}" y2="${y2}" stroke="${GC}" stroke-width="1.8"/>` +
        // Parallel tick marks
        tickMarks +
        // Transversal (extends beyond both lines)
        `<line x1="${txBot.x}" y1="${txBot.y}" x2="${txTop.x}" y2="${txTop.y}" stroke="currentColor" stroke-width="1.6" opacity="0.75"/>` +
        // Angle arcs
        arc1 + arc2 +
        // Labels: known angle at P1, missing at P2
        _t(lx1, ly1, `${a}°`, { anchor: 'start', size: 11 }) +
        _t(lx2, ly2, '?', { anchor: 'start', missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Straight-line angles (supplementary) ────────────────────────────────────
// diagram: { type:'straight-line-angles', a }  — known angle a°, other is (180−a)°
function _straightLineAngles({ a }) {
    const VW = 184, VH = 100;
    const lx = 16, rx = 168, py = 68;   // baseline endpoints and pivot x
    const px = 84;
    const r = 22;

    // Ray from pivot going up at angle (180−a)° from positive-x (SVG y-down)
    // The ray divides the straight line into two angles: a° on the left, (180−a)° on the right
    const rayAngleDeg = 180 - a;   // angle from +x axis (measured CCW in maths = CW in SVG)
    const rayRad = rayAngleDeg * Math.PI / 180;
    const rayLen = 52;
    const rayX = px + rayLen * Math.cos(rayRad);
    const rayY = py - rayLen * Math.sin(rayRad);   // y-down: subtract

    // Angle arcs
    // Arc 1 — left of ray: from ray back to horizontal-left (px direction toward lx)
    const arc1 = _angleArc(px, py, lx, py, rayX, rayY, r);
    // Arc 2 — right of ray: from ray to horizontal-right
    const arc2 = _angleArc(px, py, rayX, rayY, rx, py, r);

    // Label positions
    const midAng1Rad = ((180 - a / 2) * Math.PI) / 180;
    const lbl1X = px + (r + 14) * Math.cos(midAng1Rad);
    const lbl1Y = py - (r + 14) * Math.sin(midAng1Rad);
    const midAng2Rad = ((180 - a) / 2) * Math.PI / 180;
    const lbl2X = px + (r + 14) * Math.cos(midAng2Rad);
    const lbl2Y = py - (r + 14) * Math.sin(midAng2Rad);

    const inner =
        `<line x1="${lx}" y1="${py}" x2="${rx}" y2="${py}" stroke="${GC}" stroke-width="1.8"/>` +
        `<line x1="${px}" y1="${py}" x2="${rayX.toFixed(1)}" y2="${rayY.toFixed(1)}" stroke="currentColor" stroke-width="1.6" opacity="0.8"/>` +
        arc1 + arc2 +
        _t(lbl1X, lbl1Y, `${a}°`, { anchor: 'middle', size: 11 }) +
        _t(lbl2X, lbl2Y, '?', { anchor: 'middle', missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Vertically opposite angles ──────────────────────────────────────────────
// diagram: { type:'vertically-opposite', a }
function _verticallyOpposite({ a }) {
    const VW = 184, VH = 120;
    const cx = 92, cy = 60;
    const r = 20;
    const len = 70;

    // Two lines through (cx,cy): line 1 horizontal (0°/180°), line 2 at angle a° from horizontal
    // so the arc between line 1 (right) and line 2 (top) measures exactly a°.
    const angRad = a * Math.PI / 180;
    const p1x = cx + len, p1y = cy;                                      // right end of line 1
    const p2x = cx - len, p2y = cy;                                      // left end of line 1
    const p3x = cx + len * Math.cos(angRad), p3y = cy - len * Math.sin(angRad);  // upper end of line 2
    const p4x = cx - len * Math.cos(angRad), p4y = cy + len * Math.sin(angRad);  // lower end of line 2

    // Arc at (cx,cy) between line 1 right and line 2 top-right — this is angle a
    const arc1 = _angleArc(cx, cy, p1x, p1y, p3x, p3y, r);
    // Vertically opposite arc (same angle) at the other pair — from left to bottom-left
    const arc2 = _angleArc(cx, cy, p2x, p2y, p4x, p4y, r);

    // Label midpoints
    const midA = (a / 2) * Math.PI / 180;
    const lbl1X = cx + (r + 12) * Math.cos(midA);
    const lbl1Y = cy - (r + 12) * Math.sin(midA);
    const lbl2X = cx - (r + 12) * Math.cos(midA);
    const lbl2Y = cy + (r + 12) * Math.sin(midA);

    const inner =
        `<line x1="${p2x}" y1="${p2y}" x2="${p1x}" y2="${p1y}" stroke="${GC}" stroke-width="1.8"/>` +
        `<line x1="${p4x.toFixed(1)}" y1="${p4y.toFixed(1)}" x2="${p3x.toFixed(1)}" y2="${p3y.toFixed(1)}" stroke="${GC}" stroke-width="1.8"/>` +
        arc1 + arc2 +
        _t(lbl1X, lbl1Y, `${a}°`, { anchor: 'middle', size: 11 }) +
        _t(lbl2X, lbl2Y, '?', { anchor: 'middle', missing: true, size: 13 });

    return _svg(VW, VH, inner);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function renderDiagramSVG(diagram) {
    if (!diagram) return '';
    switch (diagram.type) {
        case 'rectangle':           return _rectangle(diagram);
        case 'right-triangle':      return _rightTriangle(diagram);
        case 'triangle-angles':     return _triangleAngles(diagram);
        case 'triangle-area':       return _triangleArea(diagram);
        case 'circle':              return _circle(diagram);
        case 'right-triangle-trig': return _rightTriangleTrig(diagram);
        case 'parabola':            return _parabola(diagram);
        case 'parallelogram':            return _parallelogram(diagram);
        case 'trapezium':               return _trapezium(diagram);
        case 'parallel-transversal':    return _parallelTransversal(diagram);
        case 'straight-line-angles':    return _straightLineAngles(diagram);
        case 'vertically-opposite':     return _verticallyOpposite(diagram);
        default: return '';
    }
}
