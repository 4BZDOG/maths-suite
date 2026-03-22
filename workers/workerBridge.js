// =============================================================
// workers/workerBridge.js
// Manages the generation Worker: lifecycle, sequencing,
// stale-result rejection, and the public generateAllAsync() API.
// =============================================================
import { state, getFilteredClues } from '../core/state.js';

// ---- Worker setup --------------------------------------------
// Worker code is inlined as a Blob URL so it works everywhere:
// file://, http://, bundled IIFE — no external file needed.

const _workerScript = `
// ---- Seeded PRNG (Mulberry32) --------------------------------
// Produces deterministic sequences from a numeric seed, ensuring
// every export is unique yet reproducible from its seed value.
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ---- Number Search (replaces Word Search) --------------------
// Grid contains digits (0-9), '.', and '-' as valid characters.
// Answers (numeric/algebraic tokens) are hidden in the grid;
// filler is pure digits so answers stand out.
const NS_MAX_ATTEMPTS = 2000;

function generateNS(sz, clueItems, useDiag, useBack, useHard, customFillers, rand) {
    let g = Array(sz).fill(null).map(() => Array(sz).fill(''));
    let solArray = [];
    let placed = [];

    // Normalise each answer: keep digits, letters, '.', '-', '+'
    let items = JSON.parse(JSON.stringify(clueItems))
        .map(item => ({ ...item, token: (item.answer || '').replace(/\\s/g,'') }))
        .filter(item => item.token.length >= 1 && item.token.length <= sz)
        .sort((a, b) => b.token.length - a.token.length);

    const dirs = [[1, 0], [0, 1]];
    if (useDiag) dirs.push([1, 1]);
    if (useBack) dirs.push([-1, 0], [0, -1]);
    if (useDiag && useBack) dirs.push([-1, -1], [1, -1], [-1, 1]);

    items.forEach(item => {
        const w = item.token;
        let fit = false, t = 0;
        while (!fit && t < NS_MAX_ATTEMPTS) {
            const d = dirs[Math.floor(rand() * dirs.length)];
            const x = Math.floor(rand() * sz);
            const y = Math.floor(rand() * sz);
            if (
                x + (w.length - 1) * d[0] >= 0 && x + (w.length - 1) * d[0] < sz &&
                y + (w.length - 1) * d[1] >= 0 && y + (w.length - 1) * d[1] < sz
            ) {
                let ok = true;
                for (let i = 0; i < w.length; i++) {
                    const cell = g[y + i * d[1]][x + i * d[0]];
                    if (cell !== '' && cell !== w[i]) ok = false;
                }
                if (ok) {
                    for (let i = 0; i < w.length; i++) {
                        g[y + i * d[1]][x + i * d[0]] = w[i];
                        solArray.push((x + i * d[0]) + ',' + (y + i * d[1]));
                    }
                    placed.push(item);
                    fit = true;
                }
            }
            t++;
        }
    });

    // Build filler pool — digits by default
    let pool = '0123456789';
    if (useHard) {
        const allChars = clueItems.map(x => x.answer || '').join('').replace(/\\s/g,'');
        if (allChars.length >= 3) pool = allChars;
    }
    if (customFillers && customFillers.trim().length > 0) {
        const cf = customFillers.replace(/\\s/g, '');
        if (cf.length > 0) pool = cf;
    }

    for (let y = 0; y < sz; y++) {
        for (let x = 0; x < sz; x++) {
            if (g[y][x] === '') g[y][x] = pool[Math.floor(rand() * pool.length)];
        }
    }

    // Sort placed by answer for stable display
    placed.sort((a, b) => a.answer < b.answer ? -1 : 1);
    return { grid: g, size: sz, solutionArray: solArray, placed };
}

// ---- Maths Crossword (replaces Crossword) --------------------
// Accepts alphanumeric answer tokens (e.g. '144', '3.14', '2x+3').
// Normalise token: uppercase letters, keep digits + safe symbols.

function normaliseToken(answer) {
    return (answer || '').toUpperCase().replace(/\\s/g, '');
}

function checkCW(g, w, x, y, d) {
    const dx = d === 'across' ? 1 : 0, dy = d === 'across' ? 0 : 1;
    if (x < 0 || y < 0 || x + w.length * dx > g[0].length || y + w.length * dy > g.length) return false;
    for (let i = 0; i < w.length; i++) {
        const c = g[y + i * dy][x + i * dx];
        if (c !== null && c !== w[i]) return false;
        if (c === null) {
            if (
                (g[y + i * dy + dx] && g[y + i * dy + dx][x + i * dx + dy] !== null) ||
                (g[y + i * dy - dx] && g[y + i * dy - dx][x + i * dx - dy] !== null)
            ) return false;
        }
    }
    if (x - dx >= 0 && y - dy >= 0 && g[y - dy][x - dx] !== null) return false;
    if (
        x + w.length * dx < g[0].length &&
        y + w.length * dy < g.length &&
        g[y + w.length * dy][x + w.length * dx] !== null
    ) return false;
    return true;
}

function generateCW(clueItems, seedIndex, rand) {
    seedIndex = seedIndex || 0;
    // Normalise tokens; require length > 1
    let l = JSON.parse(JSON.stringify(clueItems))
        .map(item => ({ ...item, word: normaliseToken(item.answer) }))
        .filter(item => item.word && item.word.length > 1);
    if (!l.length) return { grid: [], rows: 0, cols: 0, placed: [] };

    // Shuffle then sort longest-first
    l.sort(() => rand() - 0.5);
    l.sort((a, b) => b.word.length - a.word.length);

    if (seedIndex > 0 && seedIndex < l.length) {
        const seedWord = l.splice(seedIndex, 1)[0];
        l.unshift(seedWord);
    }

    const MAX = 150, MID = 75;
    let g = Array(MAX).fill(null).map(() => Array(MAX).fill(null));
    let p = [];

    const f = l.shift();
    const fc = MID - Math.floor(f.word.length / 2);
    for (let i = 0; i < f.word.length; i++) g[MID][fc + i] = f.word[i];
    p.push({ ...f, x: fc, y: MID, dir: 'across' });

    let placedCount;
    const startTime = Date.now();

    do {
        if (Date.now() - startTime > 1500) break;
        placedCount = 0;
        let bestMove = null, bestScore = -Infinity, bestWordIdx = -1;

        for (let i = 0; i < l.length; i++) {
            const w = l[i].word;
            let possiblePlacements = [];

            for (const pl of p) {
                for (let j = 0; j < w.length; j++) {
                    for (let k = 0; k < pl.word.length; k++) {
                        if (w[j] === pl.word[k]) {
                            const ia = pl.dir === 'across', nd = ia ? 'down' : 'across';
                            const sx = (pl.x + (ia ? k : 0)) - (nd === 'across' ? j : 0);
                            const sy = (pl.y + (ia ? 0 : k)) - (nd === 'down'   ? j : 0);

                            if (checkCW(g, w, sx, sy, nd)) {
                                let intersections = 0;
                                for (let z = 0; z < w.length; z++) {
                                    if (g[sy + (nd === 'down' ? z : 0)][sx + (nd === 'across' ? z : 0)] !== null) intersections++;
                                }
                                let minX = MAX, maxX = 0, minY = MAX, maxY = 0;
                                for (const existing of p) {
                                    minX = Math.min(minX, existing.x); minY = Math.min(minY, existing.y);
                                    maxX = Math.max(maxX, existing.x + (existing.dir === 'across' ? existing.word.length - 1 : 0));
                                    maxY = Math.max(maxY, existing.y + (existing.dir === 'down'   ? existing.word.length - 1 : 0));
                                }
                                minX = Math.min(minX, sx); minY = Math.min(minY, sy);
                                maxX = Math.max(maxX, sx + (nd === 'across' ? w.length - 1 : 0));
                                maxY = Math.max(maxY, sy + (nd === 'down'   ? w.length - 1 : 0));

                                const area   = (maxX - minX + 1) * (maxY - minY + 1);
                                const aspect = Math.abs((maxX - minX) - (maxY - minY));
                                const score  = (intersections * 1000) - area - (aspect * 10);
                                possiblePlacements.push({ x: sx, y: sy, dir: nd, score, wordIdx: i });
                            }
                        }
                    }
                }
            }

            if (possiblePlacements.length > 0) {
                possiblePlacements.sort((a, b) => b.score - a.score);
                const top = possiblePlacements[0];
                if (top.score > bestScore) { bestScore = top.score; bestMove = top; bestWordIdx = i; }
            }
        }

        if (bestMove) {
            const wObj = l.splice(bestWordIdx, 1)[0];
            const dx = bestMove.dir === 'across' ? 1 : 0, dy = bestMove.dir === 'across' ? 0 : 1;
            for (let z = 0; z < wObj.word.length; z++) {
                g[bestMove.y + z * dy][bestMove.x + z * dx] = wObj.word[z];
            }
            p.push({ ...wObj, x: bestMove.x, y: bestMove.y, dir: bestMove.dir });
            placedCount++;
        }
    } while (placedCount > 0 && l.length > 0);

    if (!p.length) return { grid: [], rows: 0, cols: 0, placed: [] };

    let mx = MAX, Mx = 0, my = MAX, My = 0;
    p.forEach(z => {
        const len = z.word.length, isa = z.dir === 'across';
        mx = Math.min(mx, z.x); my = Math.min(my, z.y);
        Mx = Math.max(Mx, z.x + (isa ? len - 1 : 0));
        My = Math.max(My, z.y + (isa ? 0 : len - 1));
    });

    const w = Mx - mx + 1, h = My - my + 1;
    const fg = Array(h).fill(null).map(() => Array(w).fill(null));
    p.forEach(z => { z.x -= mx; z.y -= my; });

    p.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    let n = 1;
    p.forEach((z, idx) => {
        const ex = p.slice(0, idx).find(e => e.x === z.x && e.y === z.y);
        z.num = ex ? ex.num : n++;
        const dx = z.dir === 'across' ? 1 : 0, dy = z.dir === 'across' ? 0 : 1;
        for (let i = 0; i < z.word.length; i++) {
            const r = z.y + i * dy, c = z.x + i * dx;
            if (!fg[r][c]) fg[r][c] = { char: z.word[i], num: null };
            if (i === 0) fg[r][c].num = z.num;
        }
    });

    return { grid: fg, rows: h, cols: w, placed: p };
}

// ---- Expression Scramble (replaces Word Scramble) ------------
// Scrambles the characters of the answer token. For tokens
// starting with '-' or '.', preserves that leading character
// to avoid creating ambiguous negative or decimal strings.

function generateScramble(clueItems, rand) {
    return clueItems.map(item => {
        const answer = item.answer || '';
        if (answer.length <= 1) return { ...item, original: answer, scrambled: answer };

        // Preserve leading '-' or '.' for numeric answers
        const preserveFirst = answer[0] === '-' || answer[0] === '.';
        const fixedPrefix = preserveFirst ? answer[0] : '';
        let arr = (preserveFirst ? answer.slice(1) : answer).split('');

        let tries = 0, scrambled;
        do {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            scrambled = fixedPrefix + arr.join('');
            tries++;
        } while (scrambled === answer && tries < 50 && answer.length > 1);

        return { ...item, original: answer, scrambled };
    });
}

// ---- Worker message handler ----------------------------------
self.onmessage = function (e) {
    const { id, clueItems, wsSize, wsDiag, wsBack, wsHard, wsCustomFillers, seed } = e.data;

    // Create a seeded PRNG for this generation run
    const rand = mulberry32(seed || Date.now());

    const ws = generateNS(wsSize, clueItems, wsDiag, wsBack, wsHard, wsCustomFillers, rand);

    // Try up to 5 seed-word variations and pick the best crossword
    let bestCW = null, bestScore = Infinity;
    const cwItems = clueItems.filter(item => (item.answer || '').replace(/\\s/g,'').length > 1);
    for (let i = 0; i < Math.min(5, cwItems.length); i++) {
        const attempt = generateCW(clueItems, i, mulberry32(seed ? seed + i * 997 : Date.now() + i));
        const area    = attempt.cols * attempt.rows;
        const aspect  = Math.abs(attempt.cols - attempt.rows) * 10;
        const unplaced = clueItems.length - attempt.placed.length;
        const score   = (unplaced * 10000) + area + aspect;
        if (score < bestScore) { bestCW = attempt; bestScore = score; }
    }
    if (!bestCW) bestCW = { grid: [], rows: 0, cols: 0, placed: [] };

    const scr = generateScramble(clueItems, mulberry32(seed ? seed + 12345 : Date.now()));

    self.postMessage({ id, result: { ws, cw: bestCW, scr } });
};
`;

let _worker = null;
let _msgId = 0;
const _pendingPromises = {};

function getWorker() {
    if (_worker) return _worker;

    try {
        const blob = new Blob([_workerScript], { type: 'application/javascript' });
        _worker = new Worker(URL.createObjectURL(blob));
    } catch (_) {
        console.warn('Worker creation failed — running without generation worker.');
        _worker = null;
        return null;
    }

    _worker.onmessage = (e) => {
        const { id, result } = e.data;
        if (result && result.ws) result.ws.solution = new Set(result.ws.solutionArray);
        if (_pendingPromises[id]) {
            _pendingPromises[id](result);
            delete _pendingPromises[id];
        }
    };

    _worker.onerror = (err) => {
        console.error('Worker error:', err);
        for (const id in _pendingPromises) {
            _pendingPromises[id](null);
            delete _pendingPromises[id];
        }
    };

    return _worker;
}

// ---- Public API ----------------------------------------------

/**
 * Dispatch a generation request to the worker.
 * Returns a Promise that resolves to { ws, cw, scr } or null.
 * clueItems is the filtered subset of state.clueBank.
 */
export function generateAllAsync(settings) {
    const worker = getWorker();
    if (!worker) return Promise.resolve(null);

    // Cancel any pending stale requests before issuing the new one
    for (const oldId in _pendingPromises) {
        _pendingPromises[oldId](null);
        delete _pendingPromises[oldId];
    }

    return new Promise(resolve => {
        const id = ++_msgId;
        _pendingPromises[id] = resolve;

        const s = settings || state.settings;

        // Apply topic + difficulty filters
        const clueItems = getFilteredClues();

        // Unique seed: timestamp offset by export count
        const seed = Date.now() + (s.exportCount || 0) * 1_000_000;

        worker.postMessage({
            id,
            clueItems,
            wsSize: s.wsSize || 15,
            wsDiag: s.wsDiag ?? true,
            wsBack: s.wsBack ?? false,
            wsHard: s.wsHardFiller || false,
            wsCustomFillers: s.wsCustomFillers || '',
            seed,
        });
    });
}

/**
 * Terminate the worker and reset state.
 */
export function terminateWorker() {
    if (_worker) {
        _worker.terminate();
        _worker = null;
    }
    _msgId = 0;
    for (const id in _pendingPromises) {
        _pendingPromises[id](null);
        delete _pendingPromises[id];
    }
}
