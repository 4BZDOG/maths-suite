// =============================================================
// ui/toast.js — Non-blocking toast notification system
// =============================================================

const TOAST_DURATION = 3000;

export function showToast(msg, type = 'success') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;

    tc.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = document.createElement('i');
    const iconMap = { success: 'check-circle', warning: 'exclamation-triangle', error: 'times-circle' };
    icon.className = `fas fa-${iconMap[type] || 'exclamation-circle'}`;
    t.appendChild(icon);
    t.appendChild(document.createTextNode(' ' + msg));
    tc.appendChild(t);

    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, TOAST_DURATION);
}
