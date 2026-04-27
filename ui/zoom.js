// =============================================================
// ui/zoom.js — Preview zoom controls
// =============================================================
import { state, setZoom } from '../core/state.js';
import { saveState } from '../core/storage.js';

function _applyZoom() {
    document.querySelectorAll('.page').forEach(p => {
        p.style.transform = `scale(${state.currentZoom})`;
    });
    const disp = document.getElementById('zoom-level');
    if (disp) disp.textContent = Math.round(state.currentZoom * 100) + '%';
}

export function adjustZoom(delta) {
    setZoom(state.currentZoom + delta);
    _applyZoom();
    saveState();
}

export function resetZoom() {
    setZoom(1);
    _applyZoom();
    saveState();
}
