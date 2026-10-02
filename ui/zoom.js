// =============================================================
// ui/zoom.js — Preview zoom controls
// =============================================================
import { state, setZoom } from '../core/state.js';
import { saveState } from '../core/storage.js';

// When the preview pane is narrower than the paper (phones, narrow windows, or a
// wide sidebar) the page is scaled down to fit instead of being squashed: the
// worksheet keeps its true paper layout and the user's own zoom (state.currentZoom)
// is applied on top of that "fit" factor.
function _fitFactor() {
    const vp = document.querySelector('.viewport');
    const pg = document.querySelector('.page.visible') || document.querySelector('.page');
    if (!vp || !pg || !pg.offsetWidth) return 1;
    const cs = getComputedStyle(vp);
    const avail = vp.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    return pg.offsetWidth > avail ? Math.max(0.25, avail / pg.offsetWidth) : 1;
}

/** (Re)apply the effective zoom to every page. Safe to call any time (resize, sidebar toggle…). */
export function applyZoom() {
    const eff = state.currentZoom * _fitFactor();
    document.querySelectorAll('.page').forEach(p => {
        p.style.transform = `scale(${eff})`;
        // transform doesn't change layout size, so trim (or extend) the margins to
        // match: no dead space when scaled down, full scroll range when scaled up.
        const w = p.offsetWidth, h = p.offsetHeight;
        p.style.marginLeft = p.style.marginRight = `${(eff - 1) * w / 2}px`;
        p.style.marginBottom = `${40 + (eff - 1) * h}px`;
    });
    const disp = document.getElementById('zoom-level');
    if (disp) disp.textContent = Math.round(eff * 100) + '%';
}

let _resizeTimer = null;
/** Keep the fit factor current as the window (or sidebar) changes size. */
export function setupZoomAutoFit() {
    window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(applyZoom, 80);
    });
}

export function adjustZoom(delta) {
    setZoom(state.currentZoom + delta);
    applyZoom();
    saveState();
}

export function resetZoom() {
    setZoom(1);
    applyZoom();
    saveState();
}
