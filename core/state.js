// =============================================================
// core/state.js — Single source of truth for all app state
// =============================================================

// Derived from the generator's GENERATORS dispatch table so the two
// can never drift out of sync when new topics are added.
import { ALL_SUBTOPICS, SUB_OPS } from '../generators/mathsQuestionGen.js';
export { ALL_SUBTOPICS, SUB_OPS };
import { STAGE_OUTCOMES } from './outcomes.js';

export const state = {
    // Which subtopics are enabled for generation
    selectedTopics: {
        'Integers': true,
        'Decimals': true,
        'Rounding': true,
        'Fractions': true,
        'Percentages': true,
        'Algebra': true,
        'Geometry': true,
        'Statistics': true,
        'Financial Maths': false,
    },

    // Granular sub-operation selection per topic (null entry or missing = all enabled)
    selectedSubOps: {},

    // Outcome filter: keyed by NESA outcome code, true = selected for generation filter.
    // Empty (all false) means no filter — all selected topics are used.
    selectedOutcomes: {},

    // Pages per difficulty level (1 or 2); questions are generated to fill these pages
    questionsPerSet: 1,

    // Generated question sets (arrays of {id,topic,difficulty,clue,answer,answerDisplay,notes})
    generatedSets: { easy: [], medium: [], hard: [] },

    // UI navigation
    activePage: 1,
    currentZoom: 1,

    // Watermark
    watermarkSrc: '',

    // Settings (mirrors sidebar controls)
    settings: {
        theme:           'light',
        title:           'Maths Quiz',
        sub:             'Stage 4 Review',
        font:            "'Inter', sans-serif",
        globalFontScale: 1,
        scales:          { easy: 1, medium: 1, hard: 1, key: 1 },
        titleScale:      1,
        paperSize:       'a4',
        showAnswerKey:   true,
        showExportId:    true,
        showTopic:             false,
        psShowOutcomesHeader:  false,
        psShowOutcomeChips:    false,
        cols:                  2,
        wmOpacity:       0.15,
        showFormulas: {
            'area-perimeter': { easy: true, medium: false, hard: false },
            'pythagoras': { easy: false, medium: false, hard: false },
            'circles': { easy: false, medium: false, hard: false },
            'simple-interest': { easy: false, medium: false, hard: false },
            'compound-interest': { easy: false, medium: false, hard: false }
        },
        opts:            { easy: true, medium: true, hard: true, key: true },
        pageOrder:       ['easy', 'medium', 'hard', 'key'],
        sidebarWidth:    '420px',
        exportCount:     0,
    },
};

// ---- Mutation helpers ----------------------------------------

export function setGeneratedSets(sets) {
    state.generatedSets = sets;
}

export function setActivePage(n) {
    state.activePage = n;
}

export function setZoom(z) {
    state.currentZoom = Math.max(0.5, Math.min(2, z));
}

export function setWatermark(src) {
    state.watermarkSrc = src;
}

export function updateSetting(key, value) {
    state.settings[key] = value;
}

// ---- DOM sync helpers ----------------------------------------
export function syncSettingsFromDOM() {
    const getVal = (id, def) => { const el = document.getElementById(id); return el ? el.value : def; };
    const getChk = (id, def) => { const el = document.getElementById(id); return el ? el.checked : def; };

    const s = state.settings;
    s.theme          = document.body.getAttribute('data-theme') || 'light';
    s.title          = getVal('titleInput', s.title);
    s.sub            = getVal('subInput', s.sub);
    s.font           = getVal('fontSelect', s.font);
    s.globalFontScale= parseFloat(getVal('globalFontScale', s.globalFontScale));
    s.scales = {
        easy:   parseFloat(getVal('scaleEasyFont',   s.scales.easy)),
        medium: parseFloat(getVal('scaleMediumFont', s.scales.medium)),
        hard:   parseFloat(getVal('scaleHardFont',   s.scales.hard)),
        key:    parseFloat(getVal('scaleKeyFont',    s.scales.key)),
    };
    s.titleScale     = parseFloat(getVal('titleScale', s.titleScale));
    s.paperSize      = getVal('paperSize', s.paperSize);
    s.showAnswerKey  = getChk('showAnswerKey', s.showAnswerKey);
    s.showExportId   = getChk('showExportId', s.showExportId);
    s.showTopic             = getChk('psShowTopic',            s.showTopic);
    s.psShowOutcomeChips    = getChk('psShowOutcomeChips',     s.psShowOutcomeChips);
    s.showDiagrams          = getChk('psShowDiagrams',         s.showDiagrams);
    s.cols                  = parseInt(getVal('psCols', s.cols), 10);
    s.wmOpacity      = parseFloat(
        document.documentElement.style.getPropertyValue('--wm-opacity') || s.wmOpacity
    );
    s.opts = {
        easy:   getChk('sel-easy',   s.opts.easy),
        medium: getChk('sel-medium', s.opts.medium),
        hard:   getChk('sel-hard',   s.opts.hard),
        key:    getChk('sel-key',    s.opts.key),
    };

    // Sync formulas
    const formulaGroups = ['area-perimeter', 'pythagoras', 'circles', 'simple-interest', 'compound-interest'];
    formulaGroups.forEach(g => {
        if (!s.showFormulas[g]) s.showFormulas[g] = {};
        s.showFormulas[g].easy   = getChk(`form-${g}-easy`,   s.showFormulas[g].easy);
        s.showFormulas[g].medium = getChk(`form-${g}-medium`, s.showFormulas[g].medium);
        s.showFormulas[g].hard   = getChk(`form-${g}-hard`,   s.showFormulas[g].hard);
    });

    const pol = document.querySelectorAll('#page-order-list .sortable-item');
    if (pol.length) s.pageOrder = Array.from(pol).map(el => el.dataset.page);
    s.sidebarWidth = document.documentElement.style.getPropertyValue('--sidebar-width') || s.sidebarWidth;

    // Sync selectedTopics from checkboxes
    ALL_SUBTOPICS.forEach(t => {
        const el = document.getElementById('topic-' + t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''));
        if (el) state.selectedTopics[t] = el.checked;
    });

    // Sync selectedSubOps from checkboxes
    ALL_SUBTOPICS.forEach(t => {
        const ops = SUB_OPS[t];
        if (!ops) return;
        const enabled = [];
        ops.forEach(op => {
            const id = 'subop-' + t.replace(/\s+/g, '-') + '-' + op.key;
            const el = document.getElementById(id);
            if (el && el.checked) enabled.push(op.key);
        });
        // Only store if user has unchecked some ops (saves space)
        if (enabled.length < ops.length) {
            state.selectedSubOps[t] = enabled;
        } else {
            delete state.selectedSubOps[t]; // all enabled = default
        }
    });

    // Selected outcomes are synced purely through toggleOutcomeFilter in main.js
    // to avoid issues with duplicated checkboxes across topic accordions.

    // Sync pagesPerDifficulty (stored as questionsPerSet, value is 1 or 2)
    const qps = document.getElementById('questionsPerSet');
    if (qps) state.questionsPerSet = Math.min(2, Math.max(1, parseInt(qps.value, 10) || 1));
}

export function applyStateToDOM(s) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    // Restore selectedTopics
    if (s.selectedTopics) {
        Object.assign(state.selectedTopics, s.selectedTopics);
        ALL_SUBTOPICS.forEach(t => {
            const id = 'topic-' + t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            const el = document.getElementById(id);
            if (el) el.checked = state.selectedTopics[t] !== false;
        });
    }

    // Restore selectedSubOps
    if (s.selectedSubOps) {
        state.selectedSubOps = { ...s.selectedSubOps };
        ALL_SUBTOPICS.forEach(t => {
            const ops = SUB_OPS[t];
            if (!ops) return;
            const enabledOps = state.selectedSubOps[t];
            ops.forEach(op => {
                const id = 'subop-' + t.replace(/\s+/g, '-') + '-' + op.key;
                const el = document.getElementById(id);
                if (el) el.checked = enabledOps ? enabledOps.includes(op.key) : true;
            });
        });
    }

    if (s.questionsPerSet !== undefined) {
        // Legacy: old saves stored a question count (5-30); treat only exact 1/2 as valid page counts
        const rawVal = parseInt(s.questionsPerSet, 10);
        state.questionsPerSet = (rawVal === 1 || rawVal === 2) ? rawVal : 1;
        setVal('questionsPerSet', state.questionsPerSet);
    }

    if (s.generatedSets) state.generatedSets = s.generatedSets;

    // Restore selectedOutcomes (checkbox elements may not exist yet; renderOutcomes() re-applies)
    if (s.selectedOutcomes) Object.assign(state.selectedOutcomes, s.selectedOutcomes);

    // Restore watermark
    const wSrc = s.watermarkSrc || s.settings?.watermarkSrc;
    if (wSrc !== undefined) state.watermarkSrc = wSrc;

    // Merge settings
    if (s.settings || s) {
        const src = s.settings || s;
        Object.assign(state.settings, src);
        if (src.scales) Object.assign(state.settings.scales, src.scales);
        if (src.opts)   Object.assign(state.settings.opts, src.opts);
        // Legacy: map old puzzle-page opts
        if (src.opts?.ps !== undefined && state.settings.opts.easy === undefined) {
            state.settings.opts.easy = state.settings.opts.medium = state.settings.opts.hard = true;
        }
        if (state.settings.pageOrder) {
            // migrate old page names
            state.settings.pageOrder = state.settings.pageOrder
                .map(p => ({ ps:'easy', ws:'medium', cw:'hard', scr:null, notes:'easy' }[p] || p)
                ).filter(Boolean);
            const validPages = ['easy','medium','hard','key'];
            state.settings.pageOrder = validPages.filter(p => state.settings.pageOrder.includes(p));
            if (state.settings.pageOrder.length === 0) state.settings.pageOrder = validPages;
        }
    }

    const cfg = state.settings;

    if (cfg.theme) {
        document.body.setAttribute('data-theme', cfg.theme);
        const bd = document.getElementById('btn-dark');
        if (bd) bd.innerHTML = cfg.theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }

    setVal('titleInput',      cfg.title);
    setVal('subInput',        cfg.sub);
    setVal('fontSelect',      cfg.font);
    setVal('globalFontScale', cfg.globalFontScale);

    if (cfg.scales) {
        setVal('scaleEasyFont',   cfg.scales.easy);
        setVal('scaleMediumFont', cfg.scales.medium);
        setVal('scaleHardFont',   cfg.scales.hard);
        setVal('scaleKeyFont',    cfg.scales.key);
    }

    setVal('titleScale',  cfg.titleScale);
    setVal('paperSize',   cfg.paperSize);
    setChk('showAnswerKey', cfg.showAnswerKey);
    setChk('showExportId',  cfg.showExportId);

    if (cfg.showFormulas) {
        const formulaGroups = ['area-perimeter', 'pythagoras', 'circles', 'simple-interest', 'compound-interest'];
        formulaGroups.forEach(g => {
            if (cfg.showFormulas[g]) {
                setChk(`form-${g}-easy`,   cfg.showFormulas[g].easy);
                setChk(`form-${g}-medium`, cfg.showFormulas[g].medium);
                setChk(`form-${g}-hard`,   cfg.showFormulas[g].hard);
            }
        });
    }
    setChk('psShowTopic',           cfg.showTopic);
    setChk('psShowOutcomesHeader',  cfg.psShowOutcomesHeader);
    setChk('psShowOutcomeChips',    cfg.psShowOutcomeChips);
    setChk('psShowDiagrams',        cfg.showDiagrams);
    setVal('psCols',                cfg.cols);

    if (cfg.wmOpacity !== undefined) {
        document.documentElement.style.setProperty('--wm-opacity', cfg.wmOpacity);
    }

    if (cfg.opts) {
        setChk('sel-easy',   cfg.opts.easy);
        setChk('sel-medium', cfg.opts.medium);
        setChk('sel-hard',   cfg.opts.hard);
        setChk('sel-key',    cfg.opts.key);
    }

    if (cfg.pageOrder && cfg.pageOrder.length > 0) {
        const list = document.getElementById('page-order-list');
        if (list) {
            const itemMap = {};
            Array.from(list.children).forEach(el => { itemMap[el.dataset.page] = el; });
            list.innerHTML = '';
            cfg.pageOrder.forEach(page => { if (itemMap[page]) list.appendChild(itemMap[page]); });
            Object.keys(itemMap).forEach(page => {
                if (!cfg.pageOrder.includes(page)) list.appendChild(itemMap[page]);
            });
        }
    }

    if (cfg.sidebarWidth) {
        document.documentElement.style.setProperty('--sidebar-width', cfg.sidebarWidth);
    }

    if (s.zoom !== undefined || cfg.zoom !== undefined) {
        const z = s.zoom ?? cfg.zoom;
        state.currentZoom = Math.max(0.5, Math.min(2, parseFloat(z) || 1));
        document.querySelectorAll('.page').forEach(p => {
            p.style.transform = `scale(${state.currentZoom})`;
        });
    }
}
