// =============================================================
// ui/modal.js — Import modal: open, close, focus trap
// =============================================================

let _modalTrigger = null;

function _trapModalFocus(e) {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('.modal');
    if (!modal) return;
    const focusable = Array.from(
        modal.querySelectorAll('button, textarea, input, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.disabled);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
}

export function openModal(triggerEl) {
    _modalTrigger = triggerEl || document.activeElement;
    const mo  = document.getElementById('modal-overlay');
    const imp = document.getElementById('import-text');
    if (mo)  { mo.style.display = 'flex'; mo.removeEventListener('keydown', _trapModalFocus); mo.addEventListener('keydown', _trapModalFocus); }
    if (imp) imp.focus();
}

export function closeModal() {
    const mo = document.getElementById('modal-overlay');
    if (mo)  { mo.style.display = 'none'; mo.removeEventListener('keydown', _trapModalFocus); }
    if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
}
