// =============================================================
// core/storage.js — localStorage persistence (debounced)
// =============================================================
import { state, syncSettingsFromDOM } from './state.js';
import { showToast } from '../ui/toast.js';

const STORAGE_KEY     = 'puzzleSuiteV63';
const STORAGE_KEY_V62 = 'puzzleSuiteV62';
const STORAGE_KEY_OLD = 'puzzleSuiteV61';
const DEBOUNCE_MS     = 500;

let _saveTimer = null;

// Immediately save all state to localStorage
export function saveStateNow() {
    try {
        syncSettingsFromDOM();   // flush DOM → state.settings first
        const payload = {
            selectedTopics:   state.selectedTopics,
            selectedSubOps:   state.selectedSubOps,
            selectedOutcomes: state.selectedOutcomes,
            stage:            state.stage,
            includePath:      state.includePath,
            questionsPerSet:  state.questionsPerSet,
            generatedSets:    state.generatedSets,
            settings:         state.settings,
            zoom:             state.currentZoom,
            watermarkSrc:     state.watermarkSrc,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || (e.message && e.message.toLowerCase().includes('quota'))) {
            // First fallback: try saving without the watermark image
            try {
                const fallback = {
                    selectedTopics:   state.selectedTopics,
                    selectedSubOps:   state.selectedSubOps,
                    selectedOutcomes: state.selectedOutcomes,
                    questionsPerSet:  state.questionsPerSet,
                    generatedSets:    state.generatedSets,
                    settings:         state.settings,
                    zoom:             state.currentZoom,
                    watermarkSrc:     '',
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
                showToast('Storage full — watermark not saved. Remove it to free space.', 'warning');
            } catch {
                showToast('Storage full. Hard reset may be required.', 'error');
            }
        } else {
            console.error('Save failed', e);
        }
    }
}

// Debounced save — call this on every state mutation
export function saveState() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveStateNow, DEBOUNCE_MS);
}

// Load from localStorage and return raw parsed object (or null).
// Migration chain: V63 → V62 → V61 (newest wins; older keys removed after successful write).
export function loadRawState() {
    try {
        const raw63 = localStorage.getItem(STORAGE_KEY);
        if (raw63) return JSON.parse(raw63);

        // Attempt V62 migration
        const raw62 = localStorage.getItem(STORAGE_KEY_V62);
        if (raw62) {
            const parsed = JSON.parse(raw62);
            // Inject V63-specific defaults if absent
            if (!parsed.stage) parsed.stage = 'Stage 4';
            if (parsed.includePath === undefined) parsed.includePath = false;
            // Write V63 first, only remove V62 after successful write
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            localStorage.removeItem(STORAGE_KEY_V62);
            return parsed;
        }

        // Attempt V61 migration
        const raw61 = localStorage.getItem(STORAGE_KEY_OLD);
        if (!raw61) return null;
        const parsed61 = JSON.parse(raw61);
        if (!parsed61.stage) parsed61.stage = 'Stage 4';
        if (parsed61.includePath === undefined) parsed61.includePath = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed61));
        localStorage.removeItem(STORAGE_KEY_OLD);
        return parsed61;
    } catch (_e) {
        localStorage.removeItem(STORAGE_KEY);
        showToast('Saved data was corrupted and has been reset.', 'error');
        return null;
    }
}

export function hardReset() {
    if (!confirm('Reset all questions and settings? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V62);
    location.reload();
}
