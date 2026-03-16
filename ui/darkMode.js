// =============================================================
// ui/darkMode.js — Dark/Light theme toggle
// =============================================================
import { saveState } from '../core/storage.js';

export function toggleDarkMode() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    const btn = document.getElementById('btn-dark');
    if (btn) btn.innerHTML = isDark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    saveState();
}
