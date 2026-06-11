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
# NODE_ENV=production (set in Render env vars) causes pnpm to skip devDependencies.
# Override to ensure vite and all build tools are installed.
NODE_ENV=development pnpm install --no-frozen-lockfile

echo "=== [3/6] Building shared libs ==="
pnpm run typecheck:libs

echo "=== [4/6] Building frontend apps ==="
# Vite embeds VITE_* vars at build time.
# VITE_CLERK_PUBLISHABLE_KEY and VITE_CLERK_PROXY_URL must be set in Render env vars.
echo "  VITE_CLERK_PUBLISHABLE_KEY set: $([ -n "$VITE_CLERK_PUBLISHABLE_KEY" ] && echo yes || echo 'NO — MISSING! Set it in Render dashboard')"
echo "  VITE_CLERK_PROXY_URL set: $([ -n "$VITE_CLERK_PROXY_URL" ] && echo "$VITE_CLERK_PROXY_URL" || echo 'NO — MISSING!')"

# Find vite in pnpm's virtual store — works regardless of hoisting/linker config
VITE_BIN=$(find node_modules -name "vite.js" -path "*/vite/bin/vite.js" 2>/dev/null | head -1)
if [ -z "$VITE_BIN" ]; then
  echo "ERROR: vite not found in node_modules. Contents:"
  ls node_modules/ | head -20
  exit 1
fi
echo "Found vite at: $VITE_BIN"

(cd artifacts/halgo-app  && PORT=3001 BASE_PATH=/ NODE_ENV=production node "$OLDPWD/$VITE_BIN" build --config vite.config.ts)
(cd artifacts/admin-app  && PORT=3002 BASE_PATH=/admin/   NODE_ENV=production node "$OLDPWD/$VITE_BIN" build --config vite.config.ts)
(cd artifacts/vendor-app && PORT=3003 BASE_PATH=/vendor/  NODE_ENV=production node "$OLDPWD/$VITE_BIN" build --config vite.config.ts)
(cd artifacts/display-app && PORT=3004 BASE_PATH=/display/ NODE_ENV=production node "$OLDPWD/$VITE_BIN" build --config vite.config.ts)

echo "=== [5/6] Building API server ==="
NODE_ENV=production node artifacts/api-server/build.mjs

echo "=== [6/6] Build complete ==="
echo "  halgo-app   → artifacts/halgo-app/dist/public"
echo "  admin-app   → artifacts/admin-app/dist/public"
echo "  vendor-app  → artifacts/vendor-app/dist/public"
echo "  display-app → artifacts/display-app/dist/public"
echo "  api-server  → artifacts/api-server/dist/index.mjs"
