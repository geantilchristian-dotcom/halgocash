#!/usr/bin/env bash
# Render build script — single-service deployment
# All 4 frontend apps are built and served by the Express API server.
set -e

echo "=== [1/6] Installing pnpm ==="
# pnpm 9+ is required for catalog: protocol support
npm_config_prefix=$HOME npm install -g pnpm@9
export PATH="$HOME/bin:$PATH"
pnpm --version

echo "=== [2/6] Installing dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== [3/6] Building shared libs ==="
pnpm run typecheck:libs

echo "=== [4/6] Building frontend apps ==="
# Call vite directly — pnpm resets PATH when spawning scripts so pnpm run build
# cannot find binaries hoisted to root node_modules/.bin. Using the full path bypasses this.
VITE="$PWD/node_modules/.bin/vite"

(cd artifacts/halgo-app  && PORT=3001 BASE_PATH=/         NODE_ENV=production "$VITE" build --config vite.config.ts)
(cd artifacts/admin-app  && PORT=3002 BASE_PATH=/admin/   NODE_ENV=production "$VITE" build --config vite.config.ts)
(cd artifacts/vendor-app && PORT=3003 BASE_PATH=/vendor/  NODE_ENV=production "$VITE" build --config vite.config.ts)
(cd artifacts/display-app && PORT=3004 BASE_PATH=/display/ NODE_ENV=production "$VITE" build --config vite.config.ts)

echo "=== [5/6] Building API server ==="
# api-server build uses node directly (esbuild) — no PATH issue
NODE_ENV=production pnpm --filter @workspace/api-server run build

echo "=== [6/6] Build complete ==="
echo "  halgo-app   → artifacts/halgo-app/dist/public"
echo "  admin-app   → artifacts/admin-app/dist/public"
echo "  vendor-app  → artifacts/vendor-app/dist/public"
echo "  display-app → artifacts/display-app/dist/public"
echo "  api-server  → artifacts/api-server/dist/index.mjs"
