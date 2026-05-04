// =============================================================
// main.js — Application entry point (Maths Question Sets Edition)
// =============================================================
import { state, ALL_SUBTOPICS, SUB_OPS, setGeneratedSets, setActivePage, updateSetting, applyStateToDOM, syncSettingsFromDOM } from './core/state.js';
import { getOutcomesForTopics, getTopicsForOutcomeCodes, DEFAULT_STAGE } from './core/outcomes.js';
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
import { adjustZoom, resetZoom } from './ui/zoom.js';
import { setupSortableList } from './ui/pageOrder.js';
import { setupDragAndDrop } from './ui/dropZone.js';

import { downloadConfig } from './import-export/exportConfig.js';
import { hasFeature, FEATURE, PRICING, TIER, GROUPS, FREE_LIMITS, isAdmin, enableAdminMode, disableAdminMode, getActiveGroupId, getBulkExportLimit } from './payments/access.js';
import { pruneExpiredSession } from './payments/session.js';
import { handleCheckoutReturn, initiateCheckout, openCustomerPortal, isStripeConfigured, refreshSession } from './payments/stripe.js';
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
    const outcomeTopics = new Set(getTopicsForOutcomeCodes(filteredCodes, DEFAULT_STAGE));
    return allSelected.filter(t => outcomeTopics.has(t));
}

function generateAll() {
    syncSettingsFromDOM();
    const topics = getActiveTopics();

    if (topics.length === 0) {
        const allSelected = ALL_SUBTOPICS.filter(t => state.selectedTopics[t]);
        const hasOutcomeFilter = Object.values(state.selectedOutcomes).some(Boolean);
        if (allSelected.length > 0 && hasOutcomeFilter) {
            showToast('Outcome filter excluded all selected topics. Clear filters or select matching topics.', 'warning');
        } else {
            showToast('Select at least one topic to generate questions.', 'warning');
        }
        return;
    }

    // Show loading state only when we will actually generate
    const btn = document.getElementById('btn-generate');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…'; }

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
    saveState();

    const total = (sets.easy?.length || 0) + (sets.medium?.length || 0) + (sets.hard?.length || 0);
    if (total === 0) showToast('No questions generated. Enable at least one operation per topic.', 'warning');

    _pendingTopicChange = false;
    _updateGenerateButtonState(getActiveTopics().length);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Regenerate'; }
}

const debouncedGenerate = debounceFn(generateAll, 300);
const debouncedUpdateUI = debounceFn(() => { saveState(); updateUI(); }, 500);

// Stores the last rendered visible question counts; read by renderExportPreview()
let _lastRenderedCounts = { easy: 0, medium: 0, hard: 0 };
// Tracks whether topic/sub-op changes have been made since the last generateAll()
let _pendingTopicChange = false;

// =============================================================
// Status badge
// =============================================================
function updateStatus() {
    const { easy = 0, medium = 0, hard = 0 } = _lastRenderedCounts;
    const visible = easy + medium + hard;
    const sets = state.generatedSets;
    const generated = (sets.easy?.length || 0) + (sets.medium?.length || 0) + (sets.hard?.length || 0);

    const pc = document.getElementById('placed-count');
    if (pc) {
        if (visible > 0) {
            pc.innerText = `${visible} question${visible !== 1 ? 's' : ''} on page`;
        } else if (generated > 0) {
            pc.innerText = `0 fit — adjust font/paper`;
        } else {
            pc.innerText = `0 questions`;
        }
    }

    const icon = document.getElementById('status-icon');
    if (icon) {
        if (visible > 0) {
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
    const activeTopics = Object.keys(state.selectedTopics).filter(t => state.selectedTopics[t]);
    const sWithTopics = { ...s, activeTopics, stage: DEFAULT_STAGE, psCapPages: pages };

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
    updateStatus();
    renderExportPreview();
}

function _updateQuestionsPerPageSummary(nEasy, nMedium, nHard, pages) {
    const el = document.getElementById('questions-per-page-summary');
    if (!el) return;
    const pageLabel = pages === 1 ? '1 page' : '2 pages';
    const perPage = (n) => pages > 1 ? `~${Math.ceil(n / pages)}/page` : '';
    const rows = [
        { label: 'Easy',   icon: 'fa-seedling', n: nEasy,   color: '#10b981' },
        { label: 'Medium', icon: 'fa-bolt',     n: nMedium, color: '#f59e0b' },
        { label: 'Hard',   icon: 'fa-fire',     n: nHard,   color: '#ef4444' },
    ].filter(r => r.n > 0);
    if (rows.length === 0) {
        const generated = (state.generatedSets.easy?.length || 0) + (state.generatedSets.medium?.length || 0) + (state.generatedSets.hard?.length || 0);
        if (generated > 0) {
            el.innerHTML = '<span style="color:#d97706;"><i class="fas fa-exclamation-triangle" style="margin-right:3px;"></i>None fit — reduce font scale or switch to larger paper.</span>';
        } else {
            el.innerHTML = '<span style="opacity:.6;">Click Regenerate to see question counts.</span>';
        }
        return;
    }
    el.innerHTML = rows.map(r => {
        const sub = pages > 1 ? ` <span style="opacity:0.65;">(${perPage(r.n)})</span>` : '';
        return `<i class="fas ${r.icon}" style="color:${r.color}; font-size:9px; margin-right:4px;"></i><span style="color:${r.color}; font-weight:600;">${r.label}:</span> ${r.n} question${r.n !== 1 ? 's' : ''} across ${pageLabel}${sub}`;
    }).join('<br>');
}

function _updatePageButtonLabels(nEasy, nMedium, nHard) {
    const btns = document.querySelectorAll('.page-btn');
    if (btns.length < 4) return;
    const ICONS  = ['fa-seedling', 'fa-bolt', 'fa-fire', 'fa-key'];
    const labels = [
        nEasy   > 0 ? `Easy (${nEasy})`     : 'Easy',
        nMedium > 0 ? `Medium (${nMedium})` : 'Medium',
        nHard   > 0 ? `Hard (${nHard})`     : 'Hard',
        'Key',
    ];
    btns.forEach((btn, i) => {
        btn.innerHTML = `<i class="fas ${ICONS[i]}"></i> ${labels[i]}`;
    });
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

/**
 * Called by the "Upgrade to Pro" button in the upsell strip.
 * If Stripe is configured, starts the checkout flow.
 * Otherwise falls back to the static checkout URL (if set) or shows a toast.
 */
async function _handleUpgradeClick(btn) {
    if (isStripeConfigured()) {
        const label = btn.textContent;
        btn.disabled    = true;
        btn.textContent = 'Loading…';
        try {
            await initiateCheckout('pro', 'monthly');
        } catch (e) {
            showToast('Could not start checkout. Please try again.', 'error');
            btn.disabled    = false;
            btn.textContent = label;
        }
        return;
    }
    // Fallback: static Stripe Payment Link (set PRICING[TIER.PRO].checkoutUrl in config.js)
    const url = PRICING?.[TIER.PRO]?.checkoutUrl;
    if (url) { window.open(url, '_blank', 'noopener'); return; }
    showToast('Payment not yet configured — check back soon!', 'info');
}

function _setExportEnabled(enabled, reason) {
    const btn = document.getElementById('export-btn-main');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.title = enabled ? 'Export Vector PDF' : (reason || '');
    btn.style.cursor = enabled ? '' : 'not-allowed';
    btn.style.opacity = enabled ? '' : '0.55';
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
        _setExportEnabled(false, 'Generate questions before exporting');
        return;
    }

    const selEasy   = document.getElementById('sel-easy')?.checked   ?? true;
    const selMedium = document.getElementById('sel-medium')?.checked ?? true;
    const selHard   = document.getElementById('sel-hard')?.checked   ?? true;
    const selKey    = document.getElementById('sel-key')?.checked    ?? true;
    const tierLimit = getBulkExportLimit();
    const requestedCopies = Math.max(1, parseInt(document.getElementById('bulkCount')?.value, 10) || 1);
    const copies = Math.min(requestedCopies, tierLimit, FREE_LIMITS.BULK_EXPORT_MAX);
    const wasClamped = copies < requestedCopies;
    const pages     = state.questionsPerSet || 1;
    const isPro     = hasFeature(FEATURE.TWO_PAGE_MODE);

    const diffRows = [
        { label: 'Easy',   icon: 'fa-seedling', n: easy,   color: '#10b981', sel: selEasy   },
        { label: 'Medium', icon: 'fa-bolt',     n: medium, color: '#f59e0b', sel: selMedium },
        { label: 'Hard',   icon: 'fa-fire',     n: hard,   color: '#ef4444', sel: selHard   },
    ].filter(r => r.sel && r.n > 0);

    if (diffRows.length === 0 && !selKey) {
        body.innerHTML = '<span style="opacity:.7;">No pages selected. Tick at least one row in <em>Page Selection &amp; Order</em> to enable export.</span>';
        _setExportEnabled(false, 'Select at least one page to export');
        return;
    }

    let pageCount = 0;
    let questionCount = 0;
    let html = '';

    for (const r of diffRows) {
        pageCount += pages;
        questionCount += r.n;
        const perPage = Math.max(1, Math.round(r.n / pages));
        const pageStr = pages === 1 ? '1 page' : `2 pages · ~${perPage}/page`;
        html += `<div class="ep-row">
            <span><i class="fas ${r.icon}" style="color:${r.color}; margin-right:5px; font-size:10px;"></i><span style="color:${r.color}; font-weight:700;">${r.label}</span> · ${r.n} question${r.n !== 1 ? 's' : ''}</span>
            <span style="opacity:.7;">${pageStr}</span>
        </div>`;
    }

    if (selKey) {
        pageCount += 1;
        const keyTotal = (selEasy ? easy : 0) + (selMedium ? medium : 0) + (selHard ? hard : 0);
        html += `<div class="ep-row">
            <span style="font-weight:600;"><i class="fas fa-key" style="color:#6366f1; margin-right:5px; font-size:10px;"></i>Answer Key</span>
            <span style="opacity:.7;">${keyTotal} answer${keyTotal !== 1 ? 's' : ''} · 1 page</span>
        </div>`;
    }

    html += `<hr class="ep-divider">`;
    if (copies > 1) {
        const qPerCopy = questionCount;
        html += `<div class="ep-row" style="font-weight:600;">
            <span>Per copy</span>
            <span>${pageCount} page${pageCount !== 1 ? 's' : ''} · ${qPerCopy} question${qPerCopy !== 1 ? 's' : ''}</span>
        </div>`;
        html += `<div class="ep-row" style="font-weight:700;">
            <span>Total</span>
            <span>${pageCount * copies}&thinsp;pages (${copies}&thinsp;copies)</span>
        </div>`;
    } else {
        html += `<div class="ep-row" style="font-weight:700;">
            <span>Total</span>
            <span>${pageCount} page${pageCount !== 1 ? 's' : ''} · ${questionCount} question${questionCount !== 1 ? 's' : ''}</span>
        </div>`;
    }

    if (wasClamped) {
        html += `<div class="ep-note" style="color:#d97706;"><i class="fas fa-exclamation-triangle" style="margin-right:3px;"></i> Capped from ${requestedCopies} to ${copies} copies (max for current plan).</div>`;
    }

    html += `<div class="ep-note" style="margin-top:6px;"><i class="fas fa-info-circle" style="color:#64748b; margin-right:3px;"></i> Counts auto-fit your current paper size, font scale, and zoom. Adjust those to fit more/fewer per page.</div>`;

    if (!isPro) {
        html += `<hr class="ep-divider">
        <div class="ep-note"><i class="fas fa-tint" style="color:#6366f1; margin-right:3px;"></i> Free plan: watermark on every page</div>`;
    }

    body.innerHTML = html;

    if (pageCount === 0) {
        _setExportEnabled(false, 'Select at least one page to export');
    } else {
        _setExportEnabled(true);
    }
}

function _titleToFilename(t) {
    return (t || 'MathsQuiz').replace(/[^a-z0-9-_\s]/gi, '').trim().replace(/\s+/g, '_').replace(/_+/g, '_').slice(0, 40) || 'MathsQuiz';
}

function updateUI() {
    const fsEl = document.getElementById('fontSelect');
    if (fsEl) document.documentElement.style.setProperty('--user-font', fsEl.value);
    const t = document.getElementById('titleInput')?.value || 'Maths Quiz';
    const sub = document.getElementById('subInput')?.value || 'Stage 4 Review';
    document.querySelectorAll('.disp-title').forEach(el => el.innerText = t);
    document.querySelectorAll('.disp-sub').forEach(el => el.innerText = sub);
    const filenameEl = document.getElementById('exportFilename');
    if (filenameEl) filenameEl.value = _titleToFilename(t);
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
        renderActivePage();
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
    renderActivePage();
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

const _PAGE_CRUMBS = [
    { icon: 'fa-seedling', color: '#10b981', label: 'Easy Questions'   },
    { icon: 'fa-bolt',     color: '#f59e0b', label: 'Medium Questions' },
    { icon: 'fa-fire',     color: '#ef4444', label: 'Hard Questions'   },
    { icon: 'fa-key',      color: '#6366f1', label: 'Answer Key'       },
];

function showPage(n) {
    setActivePage(n);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('visible'));
    const pEl = document.getElementById('page' + n);
    if (pEl) pEl.classList.add('visible');
    document.querySelectorAll('.page-btn').forEach((b, i) => b.classList.toggle('active', i + 1 === n));
    const c = _PAGE_CRUMBS[n - 1];
    const crumb = document.getElementById('page-crumb');
    if (crumb && c) crumb.innerHTML = `<i class="fas ${c.icon}" style="color:${c.color};"></i> ${c.label}`;
    renderActivePage();
    document.querySelector('.viewport')?.scrollTo({ top: 0, behavior: 'smooth' });
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
    _pendingTopicChange = true;
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
    _pendingTopicChange = true;
    updateTopicCount();
    renderOutcomes();
    saveState();
}

function updateTopicCount() {
    const rawSelected = ALL_SUBTOPICS.filter(t => state.selectedTopics[t]).length;
    const active = getActiveTopics().length;
    const el = document.getElementById('topic-count');
    if (el) {
        const filtered = rawSelected - active;
        if (filtered > 0 && active === 0) {
            el.innerHTML = `<span style="color:#d97706;" title="${rawSelected} topic${rawSelected !== 1 ? 's' : ''} selected, all excluded by outcome filter">none active (all filtered)</span>`;
        } else if (filtered > 0) {
            el.innerHTML = `${active} active <span style="color:#d97706; font-size:10px;" title="${rawSelected} selected · ${filtered} excluded by outcome filter">(${filtered} filtered)</span>`;
        } else if (rawSelected === 0) {
            el.innerHTML = `<span style="color:#d97706;">none selected</span>`;
        } else {
            el.textContent = `${rawSelected} of ${ALL_SUBTOPICS.length} selected`;
        }
    }
    _updateGenerateButtonState(active);
}

function _updateGenerateButtonState(active) {
    const btn = document.getElementById('btn-generate');
    if (!btn) return;
    btn.classList.toggle('no-topics', active === 0);
    btn.classList.toggle('pending', active > 0 && _pendingTopicChange);
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
        const pillsHtml = activeFilterCodes.map(c =>
            `<span style="background:rgba(99,102,241,0.12);color:#6366f1;border:1px solid rgba(99,102,241,0.3);border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700;white-space:nowrap;">${c}</span>`
        ).join(' ');
        noticeContainer.innerHTML = `<div class="outcome-filter-notice" style="margin-top:8px; flex-wrap:wrap; gap:4px;">
            <i class="fas fa-filter" style="font-size:10px; flex-shrink:0;"></i>
            <span style="flex-shrink:0;">Filtering by:</span>${pillsHtml}
            <button class="outcome-filter-clear" onclick="clearOutcomeFilter()"><i class="fas fa-xmark" style="margin-right:3px; font-size:9px;"></i>Clear</button>
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
    renderOutcomes();
    updateTopicCount();
    debouncedGenerate();
    saveState();
}

function clearOutcomeFilter() {
    Object.keys(state.selectedOutcomes).forEach(k => { state.selectedOutcomes[k] = false; });
    renderOutcomes();
    updateTopicCount();
    debouncedGenerate();
    saveState();
}

function toggleSubOp(topic, opKey) {
    syncSettingsFromDOM();
    _updateParentCheckbox(topic);
    _pendingTopicChange = true;
    updateTopicCount();
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
                    <span class="sub-op-name"><i class="fas fa-angle-right sub-op-icon"></i>${op.label}</span>
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
function _updateWatermarkUI() {
    const wrapper = document.querySelector('.file-upload-wrapper');
    const icon    = wrapper?.querySelector('.file-upload-icon');
    const subtext = wrapper?.querySelector('.file-upload-subtext');
    if (!wrapper) return;
    if (state.watermarkSrc) {
        wrapper.classList.add('has-watermark');
        if (icon)    icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        if (subtext) subtext.textContent = 'Watermark active · Click to replace';
    } else {
        wrapper.classList.remove('has-watermark');
        if (icon)    icon.innerHTML = '<i class="fas fa-cloud-upload-alt"></i>';
        if (subtext) subtext.textContent = 'Click to upload (Max 2MB)';
    }
}

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
        _updateWatermarkUI();
        showToast('Watermark added');
    };
    r.onerror = () => { showToast('Failed to read image file.', 'error'); inp.value = ''; };
    r.readAsDataURL(inp.files[0]);
}

function updateOpacity(v) {
    document.documentElement.style.setProperty('--wm-opacity', v);
    const disp = document.getElementById('wmOpacityVal');
    if (disp) disp.innerText = parseFloat(v).toFixed(2);
    saveState();
}

function clearWatermark() {
    state.watermarkSrc = '';
    document.querySelectorAll('.watermark-img').forEach(i => i.style.display = 'none');
    const bgU = document.getElementById('bgUpload');
    if (bgU) bgU.value = '';
    saveState();
    _updateWatermarkUI();
    showToast('Watermark removed');
}

function loadConfigFromFile(input) {
    const f = input.files?.[0];
    if (!f) return;
    input.value = '';
    if (!f.name.toLowerCase().endsWith('.json')) {
        showToast('Only .json config files are supported.', 'error');
        return;
    }
    const r = new FileReader();
    r.onload = e => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.settings)        Object.assign(state.settings, parsed.settings);
            if (parsed.selectedTopics)  Object.assign(state.selectedTopics, parsed.selectedTopics);
            if (parsed.selectedSubOps)  Object.assign(state.selectedSubOps, parsed.selectedSubOps);
            if (parsed.questionsPerSet) state.questionsPerSet = parsed.questionsPerSet;
            if (parsed.watermarkSrc)    state.watermarkSrc = parsed.watermarkSrc;
            applyStateToDOM(state);
            updateUI();
            updateTopicCount();
            renderOutcomes();
            generateAll();
            showToast(`Config loaded from ${f.name}`);
        } catch {
            showToast('Invalid JSON — not a valid config file.', 'error');
        }
    };
    r.onerror = () => showToast('Failed to read file.', 'error');
    r.readAsText(f);
}

function processImport() {
    showToast('Custom question import coming soon.', 'info');
}

// =============================================================
// Formula hints bulk toggles
// =============================================================
const FORMULA_GROUPS = ['area-perimeter', 'pythagoras', 'circles', 'simple-interest', 'compound-interest'];
const FORMULA_DIFFS  = ['easy', 'medium', 'hard'];

function _setFormulaCheckbox(group, diff, val) {
    const el = document.getElementById(`form-${group}-${diff}`);
    if (el) el.checked = !!val;
}

function setAllFormulaHints(scope, val) {
    if (scope === 'all') {
        FORMULA_GROUPS.forEach(g => FORMULA_DIFFS.forEach(d => _setFormulaCheckbox(g, d, val)));
    } else if (FORMULA_DIFFS.includes(scope)) {
        FORMULA_GROUPS.forEach(g => _setFormulaCheckbox(g, scope, val));
    }
    saveState();
    renderActivePage();
}

function toggleFormulaHintColumn(diff) {
    if (!FORMULA_DIFFS.includes(diff)) return;
    // If any in this column is unchecked, turn them all on; otherwise turn all off
    const anyUnchecked = FORMULA_GROUPS.some(g => {
        const el = document.getElementById(`form-${g}-${diff}`);
        return el && !el.checked;
    });
    setAllFormulaHints(diff, anyUnchecked);
}

// =============================================================
// Expose public API on window
// =============================================================
window._puzzleApp = {
    generateAll,
    processImport,
    loadConfigFromFile,
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
    resetZoom,
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
    initiateCheckout,
    openCustomerPortal,
    _handleUpgradeClick,
    setAllFormulaHints,
    toggleFormulaHintColumn,
};

Object.assign(window, window._puzzleApp);

// =============================================================
// Initialisation
// =============================================================
window.addEventListener('load', async () => {
    const overlay  = document.getElementById('loading-overlay');
    const loadText = document.getElementById('loading-text');
    const loadBar  = document.getElementById('loading-progress');
    const _step = (msg, pct) => {
        if (loadText) loadText.textContent = msg;
        if (loadBar)  loadBar.style.width  = pct + '%';
    };
    try {
        _step('Restoring saved state…', 15);
        pruneExpiredSession();

        // Handle Stripe Checkout return (?stripe_session=...) before restoring state
        // so renderTierUI() below reflects the newly-purchased tier immediately.
        const didCheckout = await handleCheckoutReturn();
        if (didCheckout) {
            showToast('Subscription activated — welcome to Pro!', 'success');
        } else {
            // Re-validate the stored JWT in the background so subscription
            // cancellations or renewals (processed server-side via webhooks)
            // are reflected on next page load without blocking the UI.
            refreshSession().then(() => renderTierUI()).catch(() => {});
        }

        const saved = loadRawState();
        if (saved) applyStateToDOM(saved);

        _step('Loading watermark…', 30);
        if (state.watermarkSrc) {
            document.querySelectorAll('.watermark-img').forEach(img => {
                if (!img.closest('#page4')) { img.src = state.watermarkSrc; img.style.display = 'block'; }
            });
        }
        _updateWatermarkUI();

        _step('Building topic panels…', 45);
        _buildSubOpsPanels();
        _updateAllParentCheckboxes();
        pushHistory();
        renderTierUI();

        _step('Generating questions…', 65);
        generateAll();
        updatePageScales();
        updateGlobalFontScale();
        updateTitleScale();
        updatePaperSize();
        updateUI();
        updateTopicCount();
        renderOutcomes();
        adjustZoom(0); // sync zoom display with restored state

        _step('Setting up…', 90);
        setupSidebarResize();
        setupSortableList('#page-order-list', () => saveState());
        setupDragAndDrop((f) => {
            if (!f.name.toLowerCase().endsWith('.json')) {
                showToast('Only .json config files are supported. Drop a file saved via Export Config.', 'error');
                return;
            }
            const r = new FileReader();
            r.onload = e => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    applyStateToDOM(parsed);
                    updateUI();
                    updateTopicCount();
                    renderOutcomes();
                    generateAll();
                    showToast(`Config loaded from ${f.name}`);
                } catch { showToast('Invalid JSON — not a valid config file.', 'error'); }
            };
            r.onerror = () => showToast('Failed to read file.', 'error');
            r.readAsText(f);
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeModal();
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }); }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }); }
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); downloadConfig(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generateAll(); }
        });

        _step('Ready!', 100);
        await new Promise(r => setTimeout(r, 250));
        if (overlay) overlay.style.opacity = '0';
        setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);

    } catch (err) {
        console.error('Init error', err);
        if (overlay) overlay.style.display = 'none';
    }
});
