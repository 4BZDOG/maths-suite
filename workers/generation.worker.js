// =============================================================
// workers/generation.worker.js
// Pure generation logic — NO DOM access, runs in a Worker.
// Extracted from the inline workerScript template literal.
// =============================================================

const PROFANITY = ["FUCK", "SHIT", "BITCH", "ASS", "CUNT", "DICK", "COCK", "PUSSY", "SLUT", "WHORE", "CRAP", "PISS", "CUM", "TWAT", "TIT", "CLIT"];
const WS_MAX_ATTEMPTS = 2000;

// ---- Word Search ---------------------------------------------

function generateWS(sz, wordList, useDiag, useBack, useHard, customFillers) {
    let g = Array(sz).fill(null).map(() => Array(sz).fill(''));
    let solArray = [];
    let p = [];
    let l = JSON.parse(JSON.stringify(wordList))
        .filter(w => w.word && w.word.length <= sz)
        .sort((a, b) => b.word.length - a.word.length);

    const dirs = [[1, 0], [0, 1]];
    if (useDiag) dirs.push([1, 1]);
    if (useBack) dirs.push([-1, 0], [0, -1]);
    if (useDiag && useBack) dirs.push([-1, -1], [1, -1], [-1, 1]);

    l.forEach(o => {
        let w = o.word, fit = false, t = 0;
        while (!fit && t < WS_MAX_ATTEMPTS) {
            const d = dirs[Math.floor(Math.random() * dirs.length)];
            const x = Math.floor(Math.random() * sz);
            const y = Math.floor(Math.random() * sz);
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
                    p.push(w);
                    fit = true;
                }
            }
            t++;
        }
    });

    let pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (useHard) {
        const j = wordList.map(x => x.word).join('');
        if (j.length >= 5) pool = j;
    }
    if (customFillers && customFillers.trim().length > 0) {
        pool = customFillers.toUpperCase().replace(/\s/g, '');
        if (pool.length === 0) pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    }

    for (let y = 0; y < sz; y++) {
        for (let x = 0; x < sz; x++) {
            if (g[y][x] === '') g[y][x] = pool[Math.floor(Math.random() * pool.length)];
        }
    }
    return { grid: g, size: sz, solutionArray: solArray, placed: p.sort() };
}

// ---- Crossword -----------------------------------------------

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

function generateCW(wordList, seedIndex) {
    seedIndex = seedIndex || 0;
    let l = JSON.parse(JSON.stringify(wordList)).filter(w => w.word && w.word.length > 1);
    if (!l.length) return { grid: [], rows: 0, cols: 0, placed: [] };

    l.sort(() => Math.random() - 0.5);
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
                            const sy = (pl.y + (ia ? 0 : k)) - (nd === 'down' ? j : 0);

                            if (checkCW(g, w, sx, sy, nd)) {
                                let intersections = 0;
                                for (let z = 0; z < w.length; z++) {
                                    if (g[sy + (nd === 'down' ? z : 0)][sx + (nd === 'across' ? z : 0)] !== null) intersections++;
                                }
                                let minX = MAX, maxX = 0, minY = MAX, maxY = 0;
                                for (const existing of p) {
                                    minX = Math.min(minX, existing.x); minY = Math.min(minY, existing.y);
                                    maxX = Math.max(maxX, existing.x + (existing.dir === 'across' ? existing.word.length - 1 : 0));
                                    maxY = Math.max(maxY, existing.y + (existing.dir === 'down' ? existing.word.length - 1 : 0));
                                }
                                minX = Math.min(minX, sx); minY = Math.min(minY, sy);
                                maxX = Math.max(maxX, sx + (nd === 'across' ? w.length - 1 : 0));
                                maxY = Math.max(maxY, sy + (nd === 'down' ? w.length - 1 : 0));

                                const area = (maxX - minX + 1) * (maxY - minY + 1);
                                const aspect = Math.abs((maxX - minX) - (maxY - minY));
                                const score = (intersections * 1000) - area - (aspect * 10);
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

// ---- Scramble ------------------------------------------------

function generateScramble(wordList) {
    return wordList.map(w => {
        let arr = w.word.split('');
        let tries = 0, scrambled;
        do {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            scrambled = arr.join('');
            tries++;
        } while (
            (scrambled === w.word || PROFANITY.some(bw => scrambled.includes(bw))) &&
            tries < 50 &&
            w.word.length > 1
        );
        return { original: w.word, scrambled };
    });
}

// ---- Message handler -----------------------------------------

self.onmessage = function (e) {
    const { id, words, wsSize, wsDiag, wsBack, wsHard, wsCustomFillers } = e.data;

    const ws = generateWS(wsSize, words, wsDiag, wsBack, wsHard, wsCustomFillers);

    let bestCW = null, bestScore = Infinity;
    const cwWords = words.filter(w => w.word && w.word.length > 1);
    for (let i = 0; i < Math.min(5, cwWords.length); i++) {
        const attempt = generateCW(words, i);
        const area = attempt.cols * attempt.rows;
        const aspect = Math.abs(attempt.cols - attempt.rows) * 10;
        const unplaced = words.length - attempt.placed.length;
        const score = (unplaced * 10000) + area + aspect;
        if (score < bestScore) { bestCW = attempt; bestScore = score; }
    }
    if (!bestCW) bestCW = { grid: [], rows: 0, cols: 0, placed: [] };

    const scr = generateScramble(words);

    self.postMessage({ id, result: { ws, cw: bestCW, scr } });
};
