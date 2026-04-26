// =============================================================
// ui/accessPanel.js — Admin access-control panel
//
// Opens a modal that lets an admin switch group presets or toggle
// individual features, then applies the result as featureOverrides
// on the current session.  Changes persist across reloads until
// cleared.
//
// Usage (from main.js):
//   openAccessPanel(() => renderTierUI());
// =============================================================
import { FEATURE, FEATURE_META, FEATURE_CATEGORIES, GROUPS } from '../payments/config.js';
import {
    getEffectiveFeatureMap,
    setFeatureOverrides,
    clearFeatureOverrides,
    getCurrentTier,
} from '../payments/access.js';
import { esc } from '../renderers/htmlUtils.js';

const OVERLAY_ID = 'access-panel-overlay';

let _onApply = null;

// ---- Public API ---------------------------------------------

export function openAccessPanel(onApply) {
    _onApply = onApply || null;
    _renderBody();
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.addEventListener('keydown', _trapFocus);
        // Close on backdrop click
        overlay.onclick = e => { if (e.target === overlay) closeAccessPanel(); };
        const firstBtn = overlay.querySelector('button');
        if (firstBtn) firstBtn.focus();
    }
}

export function closeAccessPanel() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
        overlay.style.display = 'none';
        overlay.removeEventListener('keydown', _trapFocus);
        overlay.onclick = null;
    }
    _onApply = null;
}

/**
 * Apply a named group preset: populates all feature checkboxes to match
 * the group and highlights the active button.  Does not save until "Apply".
 */
export function applyGroupPreset(groupId) {
    const group = GROUPS[groupId];
    if (!group) return;
    Object.values(FEATURE).forEach(key => {
        const el = document.getElementById('acpf-' + key);
        if (el) el.checked = group.features.has(key);
    });
    _syncGroupButtons();
}

/**
 * Called by individual feature checkboxes — updates group-preset highlights
 * to reflect whether the current checkbox state matches a known group.
 */
export function acpFeatureChange() {
    _syncGroupButtons();
}

/** Save current checkbox state as featureOverrides and close the panel. */
export function applyAccessOverrides() {
    const overrides = _readCheckboxState();
    setFeatureOverrides(overrides);
    if (_onApply) _onApply();
    closeAccessPanel();
}

/** Wipe all overrides and close the panel — reverts every feature to its tier default. */
export function resetAccessOverrides() {
    clearFeatureOverrides();
    if (_onApply) _onApply();
    closeAccessPanel();
}

// ---- Internal -----------------------------------------------

function _renderBody() {
    const body = document.getElementById('access-panel-body');
    if (!body) return;

    const effectiveMap = getEffectiveFeatureMap();
    const tier = getCurrentTier();
    const activeGroup = _detectActiveGroup(effectiveMap);

    let html = '';

    // ---- Group presets section ----
    html += `<div class="acp-section">`;
    html += `<div class="acp-label">Group Presets</div>`;
    html += `<div class="acp-desc">Switch all features at once. Fine-tune with the toggles below, then click Apply.</div>`;
    html += `<div class="acp-group-btns">`;
    for (const [id, group] of Object.entries(GROUPS)) {
        const active = activeGroup === id ? ' active' : '';
        html += `<button class="acp-group-btn${active}" data-group-id="${esc(id)}" onclick="applyGroupPreset('${esc(id)}')" title="${esc(group.description)}">${esc(group.label)}</button>`;
    }
    html += `</div>`;
    html += `</div>`;

    html += `<div class="acp-divider"></div>`;

    // ---- Individual feature toggles ----
    html += `<div class="acp-section">`;
    html += `<div class="acp-label">Individual Features`;
    html += ` <span class="acp-sublabel">base tier: <strong>${tier}</strong></span>`;
    html += `</div>`;

    for (const category of FEATURE_CATEGORIES) {
        const keys = Object.values(FEATURE).filter(k => FEATURE_META[k]?.category === category);
        if (keys.length === 0) continue;
        html += `<div class="acp-category">`;
        html += `<div class="acp-category-label">${esc(category)}</div>`;
        for (const key of keys) {
            const meta  = FEATURE_META[key];
            const entry = effectiveMap[key];
            const checked  = entry.enabled ? ' checked' : '';
            const fromOverride = entry.source === 'override';
            html += `<label class="acp-feature-row${fromOverride ? ' is-override' : ''}">`;
            html += `<input type="checkbox" id="acpf-${key}"${checked} onchange="acpFeatureChange()">`;
            html += `<div class="acp-feature-info">`;
            html += `<span class="acp-feature-name">${esc(meta.label)}`;
            if (fromOverride) html += ` <span class="acp-override-badge">overridden</span>`;
            html += `</span>`;
            html += `<span class="acp-feature-desc">${esc(meta.desc)}</span>`;
            html += `</div>`;
            html += `</label>`;
        }
        html += `</div>`;
    }
    html += `</div>`;

    body.innerHTML = html;
}

function _readCheckboxState() {
    const overrides = {};
    Object.values(FEATURE).forEach(key => {
        const el = document.getElementById('acpf-' + key);
        overrides[key] = el ? el.checked : false;
    });
    return overrides;
}

function _syncGroupButtons() {
    const current = _readCheckboxState();
    const fakeMap = {};
    Object.entries(current).forEach(([k, v]) => { fakeMap[k] = { enabled: v }; });
    const activeGroup = _detectActiveGroup(fakeMap);
    document.querySelectorAll('.acp-group-btn[data-group-id]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.groupId === activeGroup);
    });
}

function _detectActiveGroup(effectiveMap) {
    const allKeys = Object.values(FEATURE);
    for (const [id, group] of Object.entries(GROUPS)) {
        const matches = allKeys.every(key => group.features.has(key) === !!(effectiveMap[key]?.enabled));
        if (matches) return id;
    }
    return null;
}

function _trapFocus(e) {
    if (e.key === 'Escape') { closeAccessPanel(); return; }
    if (e.key !== 'Tab') return;
    const panel = document.getElementById('access-panel');
    if (!panel) return;
    const focusable = Array.from(
        panel.querySelectorAll('button:not([disabled]), input:not([disabled])')
    );
    if (focusable.length < 2) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
}

