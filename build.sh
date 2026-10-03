#!/usr/bin/env bash
# Build: bundle main.js and assemble the deployable site in dist/ (gitignored).
#
#   dist/bundle.js          esbuild output (SRI sentinel stamped)
#   dist/puzzle-suite.html  copy of the source HTML with SRI hashes + a fresh
#                           ?v=<content-hash> cache-bust stamped in
#   dist/puzzle-suite.css, dist/index.html, dist/.nojekyll   copied as-is
#
# The tracked source files (puzzle-suite.html etc.) are NEVER modified, so a
# local build leaves the working tree clean. CI deploys dist/ as-is.
#
#   bash build.sh                 full build (SRI stamping needs network)
#   SKIP_SRI=1 bash build.sh      offline build, no SRI (dev only)
#   npm start                     SKIP_SRI build, then serve dist/ on :8082
set -e

OUT=dist
rm -rf "$OUT"
mkdir -p "$OUT"

npx esbuild main.js --bundle --minify --outfile="$OUT/bundle.js"

# Runtime files that need no transformation.
cp puzzle-suite.css index.html .nojekyll "$OUT/"
cp puzzle-suite.html "$OUT/puzzle-suite.html"

# Stamp Subresource Integrity hashes for all CDN resources (HTML tags + the
# lazily-loaded jsPDF sentinel inside the bundle). Requires network; CI always
# runs it. For offline local builds: SKIP_SRI=1 bash build.sh
if [ "${SKIP_SRI:-0}" = "1" ]; then
    echo "WARNING: SKIP_SRI=1 — dist/ built WITHOUT SRI hashes (dev only)"
else
    node tools/stamp-sri.mjs "$OUT/puzzle-suite.html" "$OUT/bundle.js"
fi

# Short content hash of the freshly built bundle (taken AFTER SRI stamping,
# which may rewrite the bundle).
HASH=$(sha256sum "$OUT/bundle.js" | cut -c1-10)

# Rewrite the cache-bust query in the OUTPUT html. Match any existing value so
# this is idempotent. '|' as the sed delimiter so URLs don't need escaping.
sed -i.bak "s|bundle\.js?v=[^\"']*|bundle.js?v=${HASH}|" "$OUT/puzzle-suite.html"
rm -f "$OUT/puzzle-suite.html.bak"

echo "Build OK — $OUT/ ready  (cache-bust ?v=${HASH})"
