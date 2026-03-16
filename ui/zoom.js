// =============================================================
// ui/zoom.js — Preview zoom controls
// =============================================================
import { state, setZoom } from '../core/state.js';
import { saveState } from '../core/storage.js';

export function adjustZoom(delta) {
    setZoom(state.currentZoom + delta);
    document.querySelectorAll('.page').forEach(p => {
        p.style.transform = `scale(${state.currentZoom})`;
    });
    saveState();
}
