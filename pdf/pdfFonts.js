// =============================================================
// pdf/pdfFonts.js — Font loading for jsPDF
// =============================================================

const pdfFontCache = {};

export const PDF_FONT_CDN = {
    ComicNeue: 'comic-neue',
    Lora:      'lora',
    Roboto:    'roboto',
    Inter:     'inter',
};

// Map CSS font-family strings → jsPDF font names
export const FONT_SELECT_MAP = {
    "'Comic Neue', cursive": 'ComicNeue',
    "'Lora', serif":         'Lora',
    "'Roboto', sans-serif":  'Roboto',
    "'Inter', sans-serif":   'Inter',
};

/**
 * Lazy-load jsPDF from CDN.
 * Returns the jspdf module (window.jspdf).
 */
export async function loadJSPDF() {
    if (window.jspdf) return window.jspdf;
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload  = () => resolve(window.jspdf);
        s.onerror = () => {
            reject(new Error('PDF engine failed to load'));
        };
        document.head.appendChild(s);
    });
}

/**
 * Load a TTF font from jsDelivr and register it with jsPDF.
 * Caches base64 data in memory to avoid re-fetching across exports.
 *
 * @returns {boolean} true if font loaded & registered successfully
 */
export async function loadFontForPDF(doc, jsPDFFontName, weight) {
    const cacheKey = `${jsPDFFontName}:${weight}`;
    const styleName = weight >= 700 ? 'bold' : 'normal';
    const filename  = `${jsPDFFontName}-${styleName}.ttf`;

    if (pdfFontCache[cacheKey]) {
        doc.addFileToVFS(filename, pdfFontCache[cacheKey]);
        doc.addFont(filename, jsPDFFontName, styleName);
        return !!(doc.getFontList()[jsPDFFontName]);
    }

    const fontId = PDF_FONT_CDN[jsPDFFontName];
    if (!fontId) return false;

    const url = `https://cdn.jsdelivr.net/fontsource/fonts/${fontId}@latest/latin-${weight}-normal.ttf`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        let resp;
        try {
            resp = await fetch(url, { signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const bytes = new Uint8Array(await resp.arrayBuffer());
        const sig = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
        if (sig !== 0x00010000 && sig !== 0x4F54544F && sig !== 0x74727565) {
            throw new Error('Not a valid TTF');
        }

        let b64 = '';
        const CHUNK = 8190;
        for (let i = 0; i < bytes.length; i += CHUNK) {
            b64 += btoa(String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
        }

        doc.addFileToVFS(filename, b64);
        doc.addFont(filename, jsPDFFontName, styleName);
        if (!doc.getFontList()[jsPDFFontName]) throw new Error('jsPDF font registration failed');

        pdfFontCache[cacheKey] = b64;
        return true;
    } catch (e) {
        console.warn(`PDF font load failed (${jsPDFFontName} ${weight}):`, e.message);
        return false;
    }
}
