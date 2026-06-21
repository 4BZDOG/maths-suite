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

// Reusable WAI-ARIA roving-tabindex keyboard handling for any [role="tablist"]
// (sidebar nav-tabs and the worksheet page-tabs). Arrow/Home/End move focus to
// the sibling [role="tab"] and ACTIVATE it via .click() so the existing
// switchTab()/showPage() onclick wiring runs unchanged. Enter/Space activate.
export function setupTablistKeys() {
    document.querySelectorAll('[role="tablist"]').forEach(list => {
        list.addEventListener('keydown', e => {
            const tabs = [...list.querySelectorAll('[role="tab"]')];
            if (tabs.length === 0) return;
            const current = document.activeElement;
            const idx = tabs.indexOf(current);
            if (idx === -1) return;

            let target = null;
            switch (e.key) {
                case 'ArrowRight':
                case 'ArrowDown': target = tabs[(idx + 1) % tabs.length]; break;
                case 'ArrowLeft':
                case 'ArrowUp':   target = tabs[(idx - 1 + tabs.length) % tabs.length]; break;
                case 'Home':      target = tabs[0]; break;
                case 'End':       target = tabs[tabs.length - 1]; break;
                case 'Enter':
                case ' ':         e.preventDefault(); current.click(); return;
                default: return;
            }
            e.preventDefault();
            target.click();   // runs switchTab()/showPage(), updates aria + tabindex
            target.focus();
        });
    });
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
