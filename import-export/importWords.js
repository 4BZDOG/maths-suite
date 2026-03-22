// =============================================================
// import-export/importWords.js
// Clue bank import: CSV parsing, text import, file drop handling
// =============================================================
import { state, setClueBank } from '../core/state.js';
import { pushHistory } from '../core/history.js';
import { showToast } from '../ui/toast.js';
import { closeModal } from '../ui/modal.js';

// Valid topic and difficulty values
const VALID_TOPICS = ['Number', 'Algebra', 'Geometry', 'Statistics', 'Financial Maths'];
const VALID_DIFFS  = ['Easy', 'Medium', 'Hard'];

/**
 * Generate a simple unique ID for new clue bank entries.
 */
function newId() {
    return 'cb_' + Math.random().toString(36).slice(2, 10);
}

/**
 * Parse a CSV string into an array of clue bank objects.
 * Expected columns (any order, header row detected automatically):
 *   topic, difficulty, clue, answer, answerDisplay, notes
 */
export function parseCSV(csvText) {
    if (!csvText || !csvText.trim()) return [];

    const lines = csvText.split(/\r?\n/);
    if (!lines.length) return [];

    // Detect header: first row contains known column names?
    const KNOWN_COLS = ['topic', 'difficulty', 'clue', 'answer', 'answerdisplay', 'notes'];
    const firstRowLower = lines[0].toLowerCase();
    const hasHeader = KNOWN_COLS.some(c => firstRowLower.includes(c));

    let headers;
    let dataRows;

    if (hasHeader) {
        headers  = splitCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s/g, ''));
        dataRows = lines.slice(1);
    } else {
        // No header — assume: topic, difficulty, clue, answer, answerDisplay, notes
        headers  = ['topic', 'difficulty', 'clue', 'answer', 'answerdisplay', 'notes'];
        dataRows = lines;
    }

    const items = [];
    dataRows.forEach(row => {
        if (!row.trim()) return;
        const cells = splitCSVRow(row);
        if (cells.length < 2) return;

        const get = (name) => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (cells[idx] || '').trim() : '';
        };

        const answer = get('answer');
        const clue   = get('clue');
        if (!answer && !clue) return;   // skip empty rows

        const rawTopic = get('topic');
        const rawDiff  = get('difficulty');

        const topic = VALID_TOPICS.find(t => t.toLowerCase() === rawTopic.toLowerCase()) || 'Number';
        const difficulty = VALID_DIFFS.find(d => d.toLowerCase() === rawDiff.toLowerCase()) || 'Easy';

        items.push({
            id:            newId(),
            topic,
            difficulty,
            clue:          clue || answer,
            answer:        answer || clue,
            answerDisplay: get('answerdisplay') || answer,
            notes:         get('notes') || '',
        });
    });

    return items;
}

/**
 * Split a single CSV row respecting quoted commas.
 */
function splitCSVRow(row) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '"') {
            if (inQuotes && row[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

/**
 * Process CSV import from the import textarea.
 */
export function processCSVImport(onComplete) {
    const imp = document.getElementById('import-text');
    if (!imp) return;
    const text = imp.value;
    if (!text.trim()) return;

    pushHistory();
    const newItems = parseCSV(text);
    if (!newItems.length) {
        showToast('No valid clues found in CSV.', 'error');
        return;
    }

    // Merge: skip duplicates by clue+answer pair
    const existing = state.clueBank;
    const existingSet = new Set(existing.map(i => `${i.clue}|${i.answer}`));
    const toAdd = newItems.filter(i => !existingSet.has(`${i.clue}|${i.answer}`));

    setClueBank([...existing, ...toAdd]);
    closeModal();
    imp.value = '';
    showToast(`Imported ${toAdd.length} clue${toAdd.length !== 1 ? 's' : ''}.`);
    if (onComplete) onComplete();
}

/**
 * Parse and import from the import textarea (plain text format).
 * Accepts: answer TAB clue   or   answer, clue
 */
export function processImport(onComplete) {
    const imp = document.getElementById('import-text');
    if (!imp) return;
    const text = imp.value;
    if (!text.trim()) return;

    // If it looks like CSV (comma-separated with a known header), delegate
    if (text.includes(',')) {
        const firstLine = text.split('\n')[0].toLowerCase();
        if (['topic','difficulty','clue','answer'].some(k => firstLine.includes(k))) {
            return processCSVImport(onComplete);
        }
    }

    pushHistory();
    const newItems = [...state.clueBank];
    const existingSet = new Set(newItems.map(w => `${w.clue}|${w.answer}`));

    text.split('\n').forEach(l => {
        if (!l.trim()) return;
        const match = l.match(/^([^\t,]+)[\t,](.*)$/);
        let answer, clue;
        if (match) {
            answer = match[1].trim();
            clue   = match[2].trim() || answer;
        } else {
            answer = l.trim();
            clue   = answer;
        }

        if (answer && !existingSet.has(`${clue}|${answer}`)) {
            newItems.push({ id: newId(), topic: 'Number', difficulty: 'Easy', clue, answer, answerDisplay: answer, notes: '' });
            existingSet.add(`${clue}|${answer}`);
        }
    });

    setClueBank(newItems);
    closeModal();
    imp.value = '';
    showToast('Import successful');
    if (onComplete) onComplete();
}

/**
 * Handle a file dropped onto the page or selected via input.
 * .csv → CSV import  |  .json → config restore  |  .txt → text import
 */
export function handleDroppedFile(file, onApplyJSON, onTextImport) {
    const r = new FileReader();
    r.onload = e => {
        const text = e.target.result;
        if (file.name.endsWith('.json')) {
            try {
                const parsed = JSON.parse(text);
                if (onApplyJSON) onApplyJSON(parsed);
                showToast('Loaded config!');
            } catch (_) {
                showToast('Invalid JSON config', 'error');
            }
        } else if (file.name.endsWith('.csv')) {
            const items = parseCSV(text);
            if (!items.length) { showToast('No valid clues found in CSV.', 'error'); return; }
            pushHistory();
            const existing = state.clueBank;
            const existingSet = new Set(existing.map(i => `${i.clue}|${i.answer}`));
            const toAdd = items.filter(i => !existingSet.has(`${i.clue}|${i.answer}`));
            setClueBank([...existing, ...toAdd]);
            showToast(`Imported ${toAdd.length} clue${toAdd.length !== 1 ? 's' : ''}.`);
            if (onTextImport) onTextImport();
        } else {
            const imp = document.getElementById('import-text');
            if (imp) {
                imp.value = text;
                if (onTextImport) onTextImport();
                else processImport();
            }
        }
    };
    r.onerror = () => showToast('Failed to read file.', 'error');
    r.readAsText(file);
}
