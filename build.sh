#!/usr/bin/env bash
set -e
npx esbuild main.js --bundle --minify --outfile=bundle.js
echo "Build OK — bundle.js updated"
