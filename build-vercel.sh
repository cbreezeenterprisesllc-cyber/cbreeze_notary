#!/usr/bin/env bash
# Produce a Vercel Build Output API bundle (.vercel/output) for this site.
# Invoked by `vercel.json` (buildCommand) on a Vercel Git import, and usable by
# hand:  bun run build:vercel   then   bunx vercel deploy --prebuilt
#
# Why Build Output API instead of Vercel's Vite/framework detection:
#  - The installed TanStack Start (1.168) has no Vercel/Nitro preset — it emits a
#    host-agnostic fetch handler (dist/server/server.js) that dynamic-imports its
#    own ./assets chunks and externalizes node deps. Letting Vercel trace/detect
#    that is fragile.
#  - Bundling it into one self-contained file (deps + dynamic chunks inlined) in a
#    single render.func removes all tracing/detection risk. vercel-entry.ts adapts
#    the Node (req,res) launcher to the web fetch handler.
#
# This script only writes dist/ + .vercel/output; it does NOT touch the port-3000
# preview server (`bun run publish` / serve.ts), so both build paths coexist.
set -euo pipefail
cd "$(dirname "$0")"
umask 002

echo "[1/3] vite build"
# Vercel runs the install step itself; only install when node_modules is absent
# (e.g. a fresh clone built locally).
if [ ! -d node_modules ]; then
  bun install
fi
bun run build

echo "[2/3] assemble .vercel/output (Build Output API v3)"
rm -rf .vercel/output
mkdir -p .vercel/output/functions/render.func
cp -R dist/client .vercel/output/static
rm -f .vercel/output/static/index.html   # SSR owns "/", not a static shell

echo "[3/3] bundle SSR handler + deps into the render function"
bun build vercel-entry.ts --target node \
  --outfile .vercel/output/functions/render.func/index.mjs

cat > .vercel/output/functions/render.func/.vc-config.json <<'JSON'
{ "runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs", "supportsResponseStreaming": true }
JSON
cat > .vercel/output/config.json <<'JSON'
{ "version": 3, "routes": [ { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/render" } ] }
JSON

echo "done -> .vercel/output ready for: bunx vercel deploy --prebuilt"
