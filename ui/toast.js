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
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    tc.appendChild(t);

    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
    }, TOAST_DURATION);
}
