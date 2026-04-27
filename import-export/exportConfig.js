// =============================================================
// import-export/exportConfig.js — JSON config download
// =============================================================
import { state, syncSettingsFromDOM } from '../core/state.js';
import { showToast } from '../ui/toast.js';

export function downloadConfig() {
    syncSettingsFromDOM();
    const payload = JSON.stringify({
        selectedTopics:  state.selectedTopics,
        selectedSubOps:  state.selectedSubOps,
        questionsPerSet: state.questionsPerSet,
        settings:        state.settings,
        watermarkSrc:    state.watermarkSrc,
    });
    const title = (state.settings.title || 'MathsQuiz').replace(/[^a-z0-9-_\s]/gi, '').trim().replace(/\s+/g, '_').replace(/_+/g, '_').slice(0, 40) || 'MathsQuiz';
    const a = document.createElement('a');
    a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(payload);
    a.download = `${title}-config.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Configuration saved');
}
