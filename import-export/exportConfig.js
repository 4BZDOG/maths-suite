// =============================================================
// import-export/exportConfig.js — JSON config download
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';

export function downloadConfig() {
    syncSettingsFromDOM();
    const payload = JSON.stringify({
        selectedTopics:  state.selectedTopics,
        questionsPerSet: state.questionsPerSet,
        settings:        state.settings,
        watermarkSrc:    state.watermarkSrc,
    });
    const a = document.createElement('a');
    a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(payload);
    a.download = 'maths-quiz-config.json';
    a.click();
    showToast('Configuration saved');
}
