// =============================================================
// core/storage.js — localStorage persistence (debounced)
// =============================================================
import { state, syncSettingsFromDOM } from './state.js';
import { showToast } from '../ui/toast.js';

const STORAGE_KEY     = 'puzzleSuiteV62';
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

// Load from localStorage and return raw parsed object (or null)
export function loadRawState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
        const oldRaw = localStorage.getItem(STORAGE_KEY_OLD);
        if (!oldRaw) return null;
        // Migrate from previous key: persist under new key and remove old
        localStorage.setItem(STORAGE_KEY, oldRaw);
        localStorage.removeItem(STORAGE_KEY_OLD);
        return JSON.parse(oldRaw);
    } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        showToast('Saved data was corrupted and has been reset.', 'error');
        return null;
    }
}

export function hardReset() {
    if (!confirm('Reset all questions and settings? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
}
