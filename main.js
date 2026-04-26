// =============================================================
// main.js — Application entry point (Maths Question Sets Edition)
// =============================================================
import { state, ALL_SUBTOPICS, SUB_OPS, setGeneratedSets, setActivePage, updateSetting, applyStateToDOM, syncSettingsFromDOM } from './core/state.js';
import { getOutcomesForTopics, getTopicsForOutcomeCodes } from './core/outcomes.js';
import { pushHistory, undo, redo } from './core/history.js';
import { saveState, saveStateNow, loadRawState, hardReset } from './core/storage.js';

import { renderProblemSet } from './renderers/problemSet.js';
import { renderKeys } from './renderers/keys.js';
import { renderKaTeX } from './renderers/katexRender.js';

import { exportPDF } from './pdf/pdfExport.js';

import { showToast } from './ui/toast.js';
import { generateMathsQuestions } from './generators/mathsQuestionGen.js';
import { openModal, closeModal } from './ui/modal.js';
import { setupSidebarResize, toggleSidebar, switchTab } from './ui/sidebar.js';
import { toggleDarkMode } from './ui/darkMode.js';
import { adjustZoom } from './ui/zoom.js';
import { setupSortableList } from './ui/pageOrder.js';
import { setupDragAndDrop } from './ui/dropZone.js';

import { downloadConfig } from './import-export/exportConfig.js';
import { hasFeature, FEATURE, PRICING, TIER, GROUPS, isAdmin, enableAdminMode, disableAdminMode, getActiveGroupId } from './payments/access.js';
import { pruneExpiredSession } from './payments/session.js';
import {
    openAccessPanel, closeAccessPanel,
    applyGroupPreset, acpFeatureChange,
    applyAccessOverrides, resetAccessOverrides,
} from './ui/accessPanel.js';

// =============================================================
// Constants
// =============================================================
const WATERMARK_MAX_BYTES = 2e6;

const debounceFn = (func, wait) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => func(...args), wait); };
};

// =============================================================
// Generation
// =============================================================
function getActiveTopics() {
    const allSelected = ALL_SUBTOPICS.filter(t => state.selectedTopics[t]);
    // If any outcomes are selected as a filter, restrict to matching topics only
    const filteredCodes = Object.keys(state.selectedOutcomes).filter(c => state.selectedOutcomes[c]);
    if (filteredCodes.length === 0) return allSelected;
    const outcomeTopics = new Set(getTopicsForOutcomeCodes(filteredCodes, 'Stage 4'));
    return allSelected.filter(t => outcomeTopics.has(t));
}

function generateAll() {
    syncSettingsFromDOM();
    const topics = getActiveTopics();

    // Show loading state on generate button
    const btn = document.getElementById('btn-generate');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…'; }

    if (topics.length === 0) {
        // Distinguish: all topics unchecked vs outcome filter excluded everything
        const allSelected = ALL_SUBTOPICS.filter(t => state.selectedTopics[t]);
        const hasOutcomeFilter = Object.values(state.selectedOutcomes).some(Boolean);
        if (allSelected.length > 0 && hasOutcomeFilter) {
            showToast('Outcome filter excluded all selected topics. Clear filters or select matching topics.', 'warning');
        } else {
            showToast('Select at least one topic to generate questions.', 'warning');
        }
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Regenerate'; }
        return;
    }

    // Always generate enough questions to fill the selected number of pages
    const GENERATE_COUNT = 30;
    const seed = Date.now() + (state.settings.exportCount || 0) * 1_000_000;

    // Build sub-ops filter: only include topics where user has narrowed selection
    const subOpsFilter = Object.keys(state.selectedSubOps).length > 0 ? state.selectedSubOps : null;

    const sets = {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: GENERATE_COUNT, seed, showFormulas: state.settings.showFormulas }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: GENERATE_COUNT, seed: seed + 1, showFormulas: state.settings.showFormulas }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: GENERATE_COUNT, seed: seed + 2, showFormulas: state.settings.showFormulas }),
    };

    setGeneratedSets(sets);
    renderActivePage();
    updateStatus();
    saveState();

    const total = (sets.easy?.length || 0) + (sets.medium?.length || 0) + (sets.hard?.length || 0);
    if (total === 0) showToast('No questions generated. Enable at least one operation per topic.', 'warning');

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Regenerate'; }
}

const debouncedGenerate = debounceFn(generateAll, 300);
const debouncedUpdateUI = debounceFn(() => { saveState(); updateUI(); }, 500);

// Stores the last rendered visible question counts; read by renderExportPreview()
let _lastRenderedCounts = { easy: 0, medium: 0, hard: 0 };

// =============================================================
// Status badge
// =============================================================
function updateStatus() {
    const sets = state.generatedSets;
    const total = (sets.easy?.length || 0) + (sets.medium?.length || 0) + (sets.hard?.length || 0);
    const pc = document.getElementById('placed-count');
    if (pc) pc.innerText = `${total} questions`;

    const icon = document.getElementById('status-icon');
    if (icon) {
        if (total > 0) {
            icon.className = 'status-icon icon-success';
            icon.innerHTML = '<i class="fas fa-check"></i>';
        } else {
            icon.className = 'status-icon icon-warning';
            icon.innerHTML = '<i class="fas fa-exclamation"></i>';
        }
    }
}

// =============================================================
// Rendering
// =============================================================
function renderActivePage() {
    syncSettingsFromDOM();
    const sets = state.generatedSets;
    const s    = state.settings;

    // Always cap to the selected number of pages (1 or 2)
    const pages = state.questionsPerSet || 1;
    const sWithTopics = { ...s, activeTopics: Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]), stage: 'Stage 4', psCapPages: pages };

    const nEasy   = renderProblemSet(document.getElementById('p1-area'), sets.easy,   sWithTopics, 'Easy');
    const nMedium = renderProblemSet(document.getElementById('p2-area'), sets.medium, sWithTopics, 'Medium');
    const nHard   = renderProblemSet(document.getElementById('p3-area'), sets.hard,   sWithTopics, 'Hard');

    // Answer key always shows only the questions visible in the preview
    const keySets = {
        easy:   (sets.easy   || []).slice(0, nEasy),
        medium: (sets.medium || []).slice(0, nMedium),
        hard:   (sets.hard   || []).slice(0, nHard),
    };
    renderKeys(document.getElementById('key-container'), keySets, sWithTopics);

    _lastRenderedCounts = { easy: nEasy, medium: nMedium, hard: nHard };
    _updateQuestionsPerPageSummary(nEasy, nMedium, nHard, pages);
    _updatePageButtonLabels(nEasy, nMedium, nHard);
    renderExportPreview();
}

function _updateQuestionsPerPageSummary(nEasy, nMedium, nHard, pages) {
    const el = document.getElementById('questions-per-page-summary');
    if (!el) return;
    const pageLabel = pages === 1 ? '1 page' : '2 pages';
    const perPage = (n) => pages > 1 ? `~${Math.ceil(n / pages)}/page` : '';
    const rows = [
        { label: 'Easy',   n: nEasy,   color: '#10b981' },
        { label: 'Medium', n: nMedium, color: '#f59e0b' },
        { label: 'Hard',   n: nHard,   color: '#ef4444' },
    ].filter(r => r.n > 0);
    if (rows.length === 0) { el.innerHTML = '<span style="opacity:.6;">Click Regenerate to see question counts.</span>'; return; }
    el.innerHTML = rows.map(r => {
        const sub = pages > 1 ? ` <span style="opacity:0.65;">(${perPage(r.n)})</span>` : '';
        return `<span style="color:${r.color}; font-weight:600;">${r.label}:</span> ${r.n} question${r.n !== 1 ? 's' : ''} across ${pageLabel}${sub}`;
    }).join('<br>');
}

function _updatePageButtonLabels(nEasy, nMedium, nHard) {
    const btns = document.querySelectorAll('.page-btn');
    if (btns.length < 4) return;
    btns[0].textContent = nEasy   > 0 ? `Easy (${nEasy})`     : 'Easy';
    btns[1].textContent = nMedium > 0 ? `Medium (${nMedium})` : 'Medium';
    btns[2].textContent = nHard   > 0 ? `Hard (${nHard})`     : 'Hard';
    // btns[3] is the Key button — no count needed
}

function renderTierUI() {
    const isPro   = hasFeature(FEATURE.TWO_PAGE_MODE);
    const adminOn = isAdmin();

    // Admin indicator banner
    const adminBanner = document.getElementById('admin-mode-banner');
    if (adminBanner) {
        adminBanner.style.display = adminOn ? '' : 'none';
        const bannerBody = adminBanner.querySelector('.admin-banner-body');
        if (bannerBody) {
            const groupId = getActiveGroupId();
            if (!groupId) {
                bannerBody.textContent = 'All Pro features unlocked. Use Access Control to test different user groups.';
            } else if (groupId === 'custom') {
                bannerBody.textContent = 'Custom feature overrides active.';
            } else {
                bannerBody.textContent = `Simulating: ${GROUPS[groupId]?.label ?? groupId}.`;
            }
        }
    }

    // PRO badge next to the pages-per-difficulty selector
    const badge = document.getElementById('two-page-pro-badge');
    if (badge) badge.style.display = isPro ? 'none' : '';

    // Disable the "2 pages" option for free users; reset if it was somehow selected
    const qpsEl = document.getElementById('questionsPerSet');
    if (qpsEl) {
        const opt2 = qpsEl.querySelector('option[value="2"]');
        if (opt2) opt2.disabled = !isPro;
        if (!isPro && qpsEl.value === '2') {
            qpsEl.value = '1';
            setPagesPerDifficulty(1);
        }
    }

    // Upsell strip — shown only on free tier, never when admin mode is active
    const strip = document.getElementById('upsell-strip');
    if (strip) strip.style.display = (isPro || adminOn) ? 'none' : '';

    // Bulk export tier note
    const bulkNote = document.getElementById('bulk-tier-note');
    if (bulkNote) bulkNote.style.display = (isPro || adminOn) ? 'none' : '';

    // Wire CTA button href when a Stripe checkout URL is configured
    const ctaBtn = document.getElementById('upsell-cta-btn');
    if (ctaBtn) {
        const url = PRICING?.[TIER.PRO]?.checkoutUrl;
        if (url) { ctaBtn.href = url; ctaBtn.onclick = null; }
    }

    renderExportPreview();
}

/**
 * Toggle admin mode on/off. Persists across reloads.
 * Call from the browser console: setAdminMode(true) / setAdminMode(false)
 */
function setAdminMode(on) {
    if (on) enableAdminMode(); else disableAdminMode();
    renderTierUI();
    showToast(on ? 'Admin mode enabled — all features unlocked.' : 'Admin mode disabled — reverted to free tier.', on ? 'success' : 'info');
}

/** Open the access-control panel (admin only). */
function openAccessPanelUI() {
    openAccessPanel(() => renderTierUI());
}

function renderExportPreview() {
    const panel = document.getElementById('export-preview-panel');
    const body  = document.getElementById('export-preview-body');
    if (!panel || !body) return;

    // Always show the panel — hide only the content, not the panel itself
    panel.style.display = '';

    const { easy, medium, hard } = _lastRenderedCounts;
    const total = easy + medium + hard;

    if (total === 0) {
        body.innerHTML = '<span style="opacity:.6;">Click Regenerate to see export details.</span>';
        return;
    }

    const selEasy   = document.getElementById('sel-easy')?.checked   ?? true;
    const selMedium = document.getElementById('sel-medium')?.checked ?? true;
    const selHard   = document.getElementById('sel-hard')?.checked   ?? true;
    const selKey    = document.getElementById('sel-key')?.checked    ?? true;
    const copies    = Math.max(1, parseInt(document.getElementById('bulkCount')?.value, 10) || 1);
    const pages     = state.questionsPerSet || 1;
    const pageLabel = pages === 1 ? '1 page' : '2 pages';
    const isPro     = hasFeature(FEATURE.TWO_PAGE_MODE);

    const diffRows = [
        { label: 'Easy',   n: easy,   color: '#10b981', sel: selEasy   },
        { label: 'Medium', n: medium, color: '#f59e0b', sel: selMedium },
        { label: 'Hard',   n: hard,   color: '#ef4444', sel: selHard   },
    ].filter(r => r.sel && r.n > 0);

    let pageCount = 0;
    let html = '';

    for (const r of diffRows) {
        pageCount += pages;
        html += `<div class="ep-row">
            <span><span style="color:${r.color}; font-weight:700;">${r.label}</span>&nbsp;${r.n} question${r.n !== 1 ? 's' : ''}</span>
            <span style="opacity:.7;">${pageLabel}</span>
        </div>`;
    }

    if (selKey) {
        pageCount += 1;
        const keyTotal = (selEasy ? easy : 0) + (selMedium ? medium : 0) + (selHard ? hard : 0);
        html += `<div class="ep-row">
            <span style="font-weight:600;">Answer Key</span>
            <span style="opacity:.7;">${keyTotal} answer${keyTotal !== 1 ? 's' : ''}</span>
        </div>`;
    }

    html += `<hr class="ep-divider">`;
    if (copies > 1) {
        html += `<div class="ep-row" style="font-weight:600;">
            <span>Total</span>
            <span>${pageCount}&thinsp;pages &times;&thinsp;${copies}&thinsp;copies&nbsp;=&nbsp;${pageCount * copies}&thinsp;pages</span>
        </div>`;
    } else {
        html += `<div class="ep-row" style="font-weight:600;">
            <span>Total</span>
            <span>${pageCount} page${pageCount !== 1 ? 's' : ''}</span>
        </div>`;
    }

    if (!isPro) {
        html += `<hr class="ep-divider">
        <div class="ep-note"><i class="fas fa-tint" style="color:#6366f1; margin-right:3px;"></i> Free plan: watermark on every page</div>
        <div class="ep-note"><i class="fas fa-font" style="color:#6366f1; margin-right:3px;"></i> Free plan: system font (Inter)</div>`;
    }

    body.innerHTML = html;
}

function updateUI() {
    const fsEl = document.getElementById('fontSelect');
    if (fsEl) document.documentElement.style.setProperty('--user-font', fsEl.value);
    const t = document.getElementById('titleInput')?.value || 'Maths Quiz';
    const sub = document.getElementById('subInput')?.value || 'Stage 4 Review';
    document.querySelectorAll('.disp-title').forEach(el => el.innerText = t);
    document.querySelectorAll('.disp-sub').forEach(el => el.innerText = sub);
}

function updateGlobalFontScale() {
    const el = document.getElementById('globalFontScale');
    if (el) {
        const v = parseFloat(el.value);
        if (isNaN(v)) return;
        const valDisp = document.getElementById('globalFontScaleVal');
        if (valDisp) valDisp.innerText = v.toFixed(2) + 'x';
        document.documentElement.style.setProperty('--global-font-scale', v);
        saveState();
    }
}

function updateTitleScale() {
    const el = document.getElementById('titleScale');
    if (!el) return;
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    const disp = document.getElementById('titleScaleVal');
    if (disp) disp.innerText = v.toFixed(2) + 'x';
    document.documentElement.style.setProperty('--title-scale', v);
    saveState();
}

function updatePaperSize() {
    const v = document.getElementById('paperSize')?.value || 'a4';
    const isLetter = v === 'letter';
    document.documentElement.style.setProperty('--page-width',  isLetter ? '215.9mm' : '210mm');
    document.documentElement.style.setProperty('--page-height', isLetter ? '279.4mm' : '297mm');
    saveState();
}

function updatePageScales() {
    [['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard'], ['Key', 'key']].forEach(([suffix, cssKey]) => {
        const el = document.getElementById('scale' + suffix + 'Font');
        if (el) {
            const v = parseFloat(el.value);
            if (isNaN(v)) return;
            const dispEl = document.getElementById('scale' + suffix + 'FontVal');
            if (dispEl) dispEl.innerText = v.toFixed(2) + 'x';
            document.documentElement.style.setProperty('--scale-' + cssKey, v.toFixed(2));
        }
    });
    saveState();
    renderActivePage();
}

function showPage(n) {
    setActivePage(n);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));
    const pEl = document.getElementById('page' + n);
    if (pEl) pEl.classList.add('visible');
    document.querySelectorAll('.page-btn').forEach((b, i) => b.classList.toggle('active', i + 1 === n));
    renderActivePage();
}

function focusPage(n) {
    if (state.activePage !== n) showPage(n);
}

// =============================================================
// Topic toggles
// =============================================================
function toggleTopic(topicName) {
    pushHistory();
    const newVal = !state.selectedTopics[topicName];
    state.selectedTopics[topicName] = newVal;
    // When toggling the parent checkbox, set ALL sub-ops to match
    const ops = SUB_OPS[topicName];
    if (ops) {
        const topicId = topicName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        ops.forEach(op => {
            const el = document.getElementById('subop-' + topicId + '-' + op.key);
            if (el) el.checked = newVal;
        });
        if (newVal) {
            delete state.selectedSubOps[topicName]; // all enabled = default
        } else {
            state.selectedSubOps[topicName] = []; // none enabled
        }
        // Reset indeterminate state
        const parentEl = document.getElementById('topic-' + topicId);
        if (parentEl) parentEl.indeterminate = false;
    }
    saveState();
    // Don't auto-regenerate — user clicks Regenerate explicitly
    updateTopicCount();
    renderOutcomes();
}

function setTopicsAll(enabled) {
    pushHistory();
    ALL_SUBTOPICS.forEach(t => {
        state.selectedTopics[t] = enabled;
        const id = 'topic-' + t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const el = document.getElementById(id);
        if (el) { el.checked = enabled; el.indeterminate = false; }
        // Also set all sub-op checkboxes to match
        const ops = SUB_OPS[t];
        if (ops) {
            ops.forEach(op => {
                const subEl = document.getElementById('subop-' + id.replace('topic-', '') + '-' + op.key);
                if (subEl) subEl.checked = enabled;
            });
            if (enabled) {
                delete state.selectedSubOps[t]; // all enabled = default
            } else {
                state.selectedSubOps[t] = []; // none enabled
            }
        }
    });
    updateTopicCount();
    renderOutcomes();
    saveState();
}

function updateTopicCount() {
    const count = getActiveTopics().length;
    const el = document.getElementById('topic-count');
    if (el) el.textContent = `${count} of ${ALL_SUBTOPICS.length} selected`;
}

/**
 * Re-render the NESA outcomes panel to reflect the currently active topics.
 * Each row includes a filter checkbox so the user can target specific outcomes.
 * Reads `state.selectedTopics` / `state.selectedOutcomes` directly.
 */
function renderOutcomes() {
    // Clear all existing outcome containers
    ALL_SUBTOPICS.forEach(t => {
        const topicId = t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const container = document.getElementById('outcomes-for-' + topicId);
        if (container) container.innerHTML = '';
    });

    const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);

    // Global filter notice under the topic toggles
    let noticeContainer = document.getElementById('global-outcome-notice');
    if (!noticeContainer) {
        noticeContainer = document.createElement('div');
        noticeContainer.id = 'global-outcome-notice';
        const toggles = document.getElementById('topic-toggles');
        if (toggles) toggles.parentNode.insertBefore(noticeContainer, toggles.nextSibling);
    }
    
    const activeFilterCodes = Object.keys(state.selectedOutcomes).filter(c => state.selectedOutcomes[c]);
    if (activeFilterCodes.length > 0) {
        noticeContainer.innerHTML = `<div class="outcome-filter-notice" style="margin-top:8px;">
            Generating questions for <strong>${activeFilterCodes.length}</strong> selected outcome${activeFilterCodes.length > 1 ? 's' : ''}.
            <button class="outcome-filter-clear" onclick="clearOutcomeFilter()">Clear filter</button>
        </div>`;
    } else {
        noticeContainer.innerHTML = '';
    }

    if (activeTopics.length === 0) return;

    // Render per-topic outcomes
    activeTopics.forEach(t => {
        const topicId = t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const container = document.getElementById('outcomes-for-' + topicId);
        if (!container) return;
        
        const outcomes = getOutcomesForTopics([t], 'Stage 4');
        if (outcomes.length === 0) return;

        let html = '<div style="margin-top:12px; margin-bottom: 6px; font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;"><i class="fas fa-graduation-cap"></i> STAGE 4 OUTCOMES</div>';
        
        html += outcomes.map(o => {
            const isSelected = !!state.selectedOutcomes[o.code];
            const cls = o.appliesAll ? 'outcome-row outcome-wm' : 'outcome-row';
            const chkHtml = o.appliesAll ? '<span class="outcome-filter-spacer"></span>' : `<input
                type="checkbox"
                class="outcome-filter-chk"
                title="Filter generation to this outcome"
                ${isSelected ? 'checked' : ''}
                onchange="toggleOutcomeFilter('${o.code}', this.checked)">`;
            return `<div class="${cls}">
                ${chkHtml}
                <span class="outcome-code-pill">${o.code}</span>
                <div class="outcome-text">
                    <div class="outcome-content-label">${o.contentLabel}</div>
                    <div class="outcome-statement">${o.statement}</div>
                </div>
            </div>`;
        }).join('');
        
        container.innerHTML = html;
    });
}

function toggleOutcomeFilter(code, checked) {
    state.selectedOutcomes[code] = checked;
    renderOutcomes();    // re-render to update notice
    debouncedGenerate();
    saveState();
}

function clearOutcomeFilter() {
    Object.keys(state.selectedOutcomes).forEach(k => { state.selectedOutcomes[k] = false; });
    renderOutcomes();
    debouncedGenerate();
    saveState();
}

function toggleSubOp(topic, opKey) {
    syncSettingsFromDOM();
    // Update parent checkbox indeterminate state
    _updateParentCheckbox(topic);
    saveState();
}

function toggleTopicExpand(topicName) {
    const panel = document.getElementById('subs-' + topicName.replace(/\s+/g, '-'));
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    // Accordion: close all others
    document.querySelectorAll('.topic-subtypes').forEach(p => { p.style.display = 'none'; });
    document.querySelectorAll('.topic-expand-btn').forEach(b => { b.classList.remove('open'); });
    if (!isOpen) {
        panel.style.display = 'block';
        const btn = panel.previousElementSibling?.querySelector('.topic-expand-btn');
        if (btn) btn.classList.add('open');
    }
}

function _updateParentCheckbox(topicName) {
    const ops = SUB_OPS[topicName];
    if (!ops) return;
    const id = 'topic-' + topicName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
    const parentEl = document.getElementById(id);
    if (!parentEl) return;
    let checked = 0;
    ops.forEach(op => {
        const el = document.getElementById('subop-' + topicName.replace(/\s+/g, '-') + '-' + op.key);
        if (el && el.checked) checked++;
    });
    parentEl.checked = checked > 0;
    parentEl.indeterminate = checked > 0 && checked < ops.length;
    state.selectedTopics[topicName] = checked > 0;
}

function _updateAllParentCheckboxes() {
    ALL_SUBTOPICS.forEach(t => _updateParentCheckbox(t));
}

function _buildSubOpsPanels() {
    ALL_SUBTOPICS.forEach(t => {
        const ops = SUB_OPS[t];
        const topicId = t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const container = document.getElementById('subs-' + topicId);
        if (!container) return;
        
        let html = '';
        if (ops && ops.length > 0) {
            const enabledOps = state.selectedSubOps[t];
            html += ops.map(op => {
                const checked = enabledOps ? enabledOps.includes(op.key) : true;
                return `<label class="sub-op-row">
                    <input type="checkbox" id="subop-${topicId}-${op.key}" ${checked ? 'checked' : ''}
                           onchange="toggleSubOp('${t}', '${op.key}')">
                    <span class="sub-op-name">${op.label}</span>
                </label>`;
            }).join('');
        }
        
        html += `<div id="outcomes-for-${topicId}" class="topic-outcomes-wrapper" style="padding: 0 4px 6px;"></div>`;
        container.innerHTML = html;
    });
}

function setPagesPerDifficulty(n) {
    let pages = (parseInt(n, 10) === 2) ? 2 : 1;
    if (pages === 2 && !hasFeature(FEATURE.TWO_PAGE_MODE)) pages = 1;
    state.questionsPerSet = pages;
    saveState();
    generateAll();
}

// =============================================================
// Watermark
// =============================================================
function handleImage(inp) {
    if (!inp.files[0]) return;
    if (inp.files[0].size > WATERMARK_MAX_BYTES) {
        showToast('Image must be smaller than 2MB.', 'error');
        inp.value = ''; return;
    }
    const r = new FileReader();
    r.onload = e => {
        state.watermarkSrc = '';
        document.querySelectorAll('.watermark-img').forEach(img => { img.src = ''; img.style.display = 'none'; });
        state.watermarkSrc = e.target.result;
        document.querySelectorAll('.watermark-img').forEach(img => {
            if (!img.closest('#page4')) { img.src = state.watermarkSrc; img.style.display = 'block'; }
        });
        saveState();
        showToast('Watermark added');
    };
    r.onerror = () => { showToast('Failed to read image file.', 'error'); inp.value = ''; };
    r.readAsDataURL(inp.files[0]);
}

function updateOpacity(v) {
    document.documentElement.style.setProperty('--wm-opacity', v);
    saveState();
}

function clearWatermark() {
    state.watermarkSrc = '';
    document.querySelectorAll('.watermark-img').forEach(i => i.style.display = 'none');
    const bgU = document.getElementById('bgUpload');
    if (bgU) bgU.value = '';
    saveState();
    showToast('Watermark removed');
}

// =============================================================
// Expose public API on window
// =============================================================
window._puzzleApp = {
    generateAll,
    toggleTopic,
    toggleSubOp,
    toggleTopicExpand,
    setTopicsAll,
    setPagesPerDifficulty,
    openModal: (el) => openModal(el),
    closeModal,
    downloadConfig,
    exportPDF,
    toggleDarkMode,
    toggleSidebar,
    switchTab,
    adjustZoom: (d) => adjustZoom(d),
    showPage,
    focusPage,
    updateUI,
    renderTierUI,
    renderExportPreview,
    updateGlobalFontScale,
    updateTitleScale,
    updatePaperSize,
    updatePageScales,
    handleImage,
    updateOpacity,
    clearWatermark,
    toggleOutcomeFilter,
    clearOutcomeFilter,
    hardReset: () => hardReset(),
    undo: () => undo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }),
    redo: () => redo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }),
    debouncedGenerate,
    renderActivePage,
    debouncedUpdateUI,
    saveState,
    renderOutcomes,
    setAdminMode,
    openAccessPanel: openAccessPanelUI,
    closeAccessPanel,
    applyGroupPreset,
    acpFeatureChange,
    applyAccessOverrides,
    resetAccessOverrides,
};

Object.assign(window, window._puzzleApp);

// =============================================================
// Initialisation
// =============================================================
window.addEventListener('load', async () => {
    const overlay = document.getElementById('loading-overlay');
    try {
        pruneExpiredSession();
        const saved = loadRawState();
        if (saved) applyStateToDOM(saved);

        if (state.watermarkSrc) {
            document.querySelectorAll('.watermark-img').forEach(img => {
                if (!img.closest('#page4')) { img.src = state.watermarkSrc; img.style.display = 'block'; }
            });
        }

        _buildSubOpsPanels();
        _updateAllParentCheckboxes();
        pushHistory();
        renderTierUI();
        generateAll();
        updatePageScales();
        updateGlobalFontScale();
        updateTitleScale();
        updatePaperSize();
        updateUI();
        updateTopicCount();
        renderOutcomes();

        setupSidebarResize();
        setupSortableList('#page-order-list', () => saveState());
        setupDragAndDrop((f) => {
            // JSON config restore only (no CSV import needed anymore)
            const r = new FileReader();
            r.onload = e => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    applyStateToDOM(parsed);
                    generateAll();
                    showToast('Config loaded');
                } catch { showToast('Invalid JSON file', 'error'); }
            };
            r.onerror = () => showToast('Failed to read file.', 'error');
            r.readAsText(f);
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeModal();
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }); }
        });

        await new Promise(r => setTimeout(r, 300));
        if (overlay) overlay.style.opacity = '0';
        setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);

    } catch (err) {
        console.error('Init error', err);
        if (overlay) overlay.style.display = 'none';
    }
});
