#!/usr/bin/env bash
# Render build script — single-service deployment
# All 4 frontend apps are built and served by the Express API server.
set -e

echo "=== [1/6] Installing pnpm ==="
# Use pnpm@latest (v10) — same major as used to generate the lockfile
npm_config_prefix=$HOME npm install -g pnpm@latest
export PATH="$HOME/bin:$PATH"
pnpm --version

echo "=== [2/6] Installing dependencies ==="
pnpm install --no-frozen-lockfile

echo "=== [3/6] Building shared libs ==="
pnpm run typecheck:libs

echo "=== [4/6] Building frontend apps ==="
# pnpm exec finds the binary via the workspace package's node_modules chain,
# bypassing PATH issues caused by pnpm subprocess isolation.
PORT=3001 BASE_PATH=/         NODE_ENV=production pnpm -C artifacts/halgo-app  exec vite build --config vite.config.ts
PORT=3002 BASE_PATH=/admin/   NODE_ENV=production pnpm -C artifacts/admin-app  exec vite build --config vite.config.ts
PORT=3003 BASE_PATH=/vendor/  NODE_ENV=production pnpm -C artifacts/vendor-app exec vite build --config vite.config.ts
PORT=3004 BASE_PATH=/display/ NODE_ENV=production pnpm -C artifacts/display-app exec vite build --config vite.config.ts

echo "=== [5/6] Building API server ==="
NODE_ENV=production pnpm -C artifacts/api-server exec node build.mjs

echo "=== [6/6] Build complete ==="
echo "  halgo-app   → artifacts/halgo-app/dist/public"
echo "  admin-app   → artifacts/admin-app/dist/public"
echo "  vendor-app  → artifacts/vendor-app/dist/public"
echo "  display-app → artifacts/display-app/dist/public"
echo "  api-server  → artifacts/api-server/dist/index.mjs"
