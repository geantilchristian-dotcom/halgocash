#!/usr/bin/env bash
# Render build script — single-service deployment
# All 4 frontend apps are built and served by the Express API server.
set -e

echo "=== [1/6] Installing pnpm ==="
# pnpm@9: supports catalog: protocol + onlyBuiltDependencies in pnpm-workspace.yaml
npm_config_prefix=$HOME npm install -g pnpm@9
export PATH="$HOME/bin:$PATH"
pnpm --version

echo "=== [2/6] Installing dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== [3/6] Building shared libs ==="
pnpm run typecheck:libs

echo "=== [4/6] Building frontend apps ==="
# Invoke vite's JS entry point directly via node — no bin link or PATH needed.
# node-linker=hoisted places vite at root node_modules/vite/bin/vite.js.
VITE_BIN="$PWD/node_modules/vite/bin/vite.js"
echo "Using vite at: $VITE_BIN"
ls "$VITE_BIN"

(cd artifacts/halgo-app  && PORT=3001 BASE_PATH=/         NODE_ENV=production node "$VITE_BIN" build --config vite.config.ts)
(cd artifacts/admin-app  && PORT=3002 BASE_PATH=/admin/   NODE_ENV=production node "$VITE_BIN" build --config vite.config.ts)
(cd artifacts/vendor-app && PORT=3003 BASE_PATH=/vendor/  NODE_ENV=production node "$VITE_BIN" build --config vite.config.ts)
(cd artifacts/display-app && PORT=3004 BASE_PATH=/display/ NODE_ENV=production node "$VITE_BIN" build --config vite.config.ts)

echo "=== [5/6] Building API server ==="
NODE_ENV=production pnpm -C artifacts/api-server exec node build.mjs

echo "=== [6/6] Build complete ==="
echo "  halgo-app   → artifacts/halgo-app/dist/public"
echo "  admin-app   → artifacts/admin-app/dist/public"
echo "  vendor-app  → artifacts/vendor-app/dist/public"
echo "  display-app → artifacts/display-app/dist/public"
echo "  api-server  → artifacts/api-server/dist/index.mjs"
