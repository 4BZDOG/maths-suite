// =============================================================
// tools/stamp-sri.mjs — Subresource Integrity stamping (build step)
//
// Run by build.sh AFTER esbuild and BEFORE the cache-bust hash:
//   1. Finds every cdnjs/jsdelivr <link>/<script> tag in puzzle-suite.html,
//      downloads the exact bytes, and writes/refreshes its integrity attr.
//   2. Replaces the __JSPDF_SRI__ sentinel in bundle.js (see pdf/pdfFonts.js)
//      with the hash of the lazily-loaded jsPDF script.
//
// Hashes are computed from the live CDN at build time so they can never drift
// from the pinned URLs. Any fetch failure FAILS the build — deploying without
// SRI silently would defeat the point. For offline local builds:
//   SKIP_SRI=1 bash build.sh
// (Google Fonts CSS is UA-dependent and is intentionally skipped.)
// =============================================================
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const HTML_FILE   = 'puzzle-suite.html';
const BUNDLE_FILE = 'bundle.js';
const SRI_HOSTS   = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];
const JSPDF_SENTINEL = '__JSPDF_SRI__';

async function sha384(url) {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
    const bytes = Buffer.from(await resp.arrayBuffer());
    return 'sha384-' + createHash('sha384').update(bytes).digest('base64');
}

function isSriHost(url) {
    try { return SRI_HOSTS.includes(new URL(url).hostname); } catch { return false; }
}

// ---- 1. Stamp <link>/<script> tags in the entry HTML --------
let html = await readFile(HTML_FILE, 'utf8');
const tagRe = /<(link|script)\b[^>]*\b(?:href|src)="(https:\/\/[^"]+)"[^>]*>/g;
let stamped = 0;

for (const [tag, , url] of [...html.matchAll(tagRe)].map(m => [m[0], m[1], m[2]])) {
    if (!isSriHost(url)) continue;
    const hash = await sha384(url);
    let newTag = tag.replace(/\s+integrity="[^"]*"/, '');
    if (!/crossorigin=/.test(newTag)) {
        newTag = newTag.replace(/( \/?>|>)$/, ' crossorigin="anonymous"$1');
    }
    newTag = newTag.replace(/( \/?>|>)$/, ` integrity="${hash}"$1`);
    html = html.replace(tag, newTag);
    stamped++;
    console.log(`SRI  ${url}`);
}
if (stamped === 0) throw new Error('No CDN tags found to stamp — selector drift?');
await writeFile(HTML_FILE, html);

// ---- 2. Stamp the jsPDF sentinel in the bundle ---------------
let bundle = await readFile(BUNDLE_FILE, 'utf8');
if (bundle.includes(JSPDF_SENTINEL)) {
    const jspdfUrl = bundle.match(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[^"']+/)?.[0];
    if (!jspdfUrl) throw new Error('jsPDF CDN URL not found in bundle.js');
    const hash = await sha384(jspdfUrl);
    bundle = bundle.replaceAll(JSPDF_SENTINEL, hash);
    await writeFile(BUNDLE_FILE, bundle);
    console.log(`SRI  ${jspdfUrl} (bundle sentinel)`);
} else {
    console.warn('warn: jsPDF SRI sentinel not present in bundle.js — skipped');
}

console.log(`SRI stamping OK (${stamped} HTML tag(s) + bundle)`);
