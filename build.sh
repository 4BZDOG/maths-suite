#!/usr/bin/env bash
# Build & cache-bust: bundle main.js -> bundle.js, then stamp the bundle's
# short content hash into puzzle-suite.html so browsers always pick up a
# fresh bundle on deploy (no manual ?v=N bump needed).
set -e

npx esbuild main.js --bundle --minify --outfile=bundle.js

# Short content hash of the freshly built bundle.
HASH=$(sha256sum bundle.js | cut -c1-10)

# Rewrite the cache-bust query in the entry HTML. Match any existing value
# ('162', '167', 'abc123...') so this is idempotent across runs.
# Uses '|' as the sed delimiter so URLs (with '/') don't need escaping.
sed -i.bak "s|bundle\.js?v=[^\"']*|bundle.js?v=${HASH}|" puzzle-suite.html
rm -f puzzle-suite.html.bak

echo "Build OK — bundle.js updated  (cache-bust ?v=${HASH})"
