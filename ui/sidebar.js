// =============================================================
// ui/sidebar.js — Sidebar resize handle & tab switching
// =============================================================
import { saveState } from '../core/storage.js';

export function setupSidebarResize() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor     = 'col-resize';
        resizer.classList.add('active');
    });

    document.addEventListener('mousemove', e => {
        if (!isResizing) return;
        const newWidth = Math.max(300, Math.min(650, e.clientX));
        document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.userSelect = '';
            document.body.style.cursor     = '';
            resizer.classList.remove('active');
            saveState();
        }
    });
}

export function toggleSidebar() {
    document.body.classList.toggle('sidebar-closed');
}

export function switchTab(t) {
    ['content', 'design', 'export'].forEach(x => {
        const el = document.getElementById('panel-' + x);
        if (el) el.style.display = 'none';
    });
    const pnl = document.getElementById('panel-' + t);
    if (pnl) pnl.style.display = 'block';

    document.querySelectorAll('.nav-tab').forEach(el => {
        const isActive = el.dataset.tab === t;
        el.classList.toggle('active', isActive);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
        el.setAttribute('tabindex', isActive ? '0' : '-1');
    });
}
