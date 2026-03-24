// =============================================================
// main.js — Application entry point (Maths Question Sets Edition)
// =============================================================
import { state, ALL_SUBTOPICS, SUB_OPS, setGeneratedSets, setActivePage, updateSetting, applyStateToDOM, syncSettingsFromDOM } from './core/state.js';
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
    return ALL_SUBTOPICS.filter(t => state.selectedTopics[t]);
}

function generateAll() {
    syncSettingsFromDOM();
    const topics = getActiveTopics();

    // Show loading state on generate button
    const btn = document.getElementById('btn-generate');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating…'; }

    if (topics.length === 0) {
        showToast('Select at least one topic to generate questions.', 'warning');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-bolt"></i> Regenerate'; }
        return;
    }

    const n    = state.questionsPerSet || 10;
    const seed = Date.now() + (state.settings.exportCount || 0) * 1_000_000;

    // Build sub-ops filter: only include topics where user has narrowed selection
    const subOpsFilter = Object.keys(state.selectedSubOps).length > 0 ? state.selectedSubOps : null;

    const sets = {
        easy:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Easy',   count: n, seed }),
        medium: generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Medium', count: n, seed: seed + 1 }),
        hard:   generateMathsQuestions({ subTopics: topics, subOpsFilter, difficulty: 'Hard',   count: n, seed: seed + 2 }),
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

    renderProblemSet(document.getElementById('p1-area'), sets.easy,   s, 'Easy');
    renderProblemSet(document.getElementById('p2-area'), sets.medium, s, 'Medium');
    renderProblemSet(document.getElementById('p3-area'), sets.hard,   s, 'Hard');
    renderKeys(document.getElementById('key-container'), sets, s);
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
    saveState();
}

function updateTopicCount() {
    const count = getActiveTopics().length;
    const el = document.getElementById('topic-count');
    if (el) el.textContent = `${count} of ${ALL_SUBTOPICS.length} selected`;
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
        if (!ops || ops.length === 0) return;
        const topicId = t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const container = document.getElementById('subs-' + topicId);
        if (!container) return;
        const enabledOps = state.selectedSubOps[t];
        container.innerHTML = ops.map(op => {
            const checked = enabledOps ? enabledOps.includes(op.key) : true;
            return `<label class="sub-op-row">
                <input type="checkbox" id="subop-${topicId}-${op.key}" ${checked ? 'checked' : ''}
                       onchange="toggleSubOp('${t}', '${op.key}')">
                <span class="sub-op-name">${op.label}</span>
            </label>`;
        }).join('');
    });
}

function setQuestionsPerSet(n) {
    state.questionsPerSet = Math.min(50, Math.max(1, parseInt(n, 10) || 10));
    saveState();
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
    setQuestionsPerSet,
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
    updateGlobalFontScale,
    updateTitleScale,
    updatePaperSize,
    updatePageScales,
    handleImage,
    updateOpacity,
    clearWatermark,
    hardReset: () => hardReset(),
    undo: () => undo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }),
    redo: () => redo(() => { _updateAllParentCheckboxes(); updateTopicCount(); saveState(); generateAll(); }),
    debouncedGenerate,
    renderActivePage,
    debouncedUpdateUI,
    saveState,
};

Object.assign(window, window._puzzleApp);

// =============================================================
// Initialisation
// =============================================================
window.addEventListener('load', async () => {
    const overlay = document.getElementById('loading-overlay');
    try {
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
        generateAll();
        updatePageScales();
        updateGlobalFontScale();
        updateTitleScale();
        updatePaperSize();
        updateUI();
        updateTopicCount();

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
