// =============================================================
// ui/toast.js — Non-blocking toast notification system
// =============================================================

// Warnings and errors carry information the user needs to act on, so they
// linger longer than transient success/info confirmations.
const TOAST_DURATION = { success: 3000, info: 3500, warning: 5500, error: 6500 };

export function showToast(msg, type = 'success') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;

    tc.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = document.createElement('i');
    const iconMap = { success: 'check-circle', warning: 'exclamation-triangle', error: 'times-circle', info: 'info-circle' };
    icon.className = `fas fa-${iconMap[type] || 'exclamation-circle'}`;
    t.appendChild(icon);
    t.appendChild(document.createTextNode(' ' + msg));
    tc.appendChild(t);

    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, TOAST_DURATION[type] || 3000);
}
