---
name: Lib declarations rebuild
description: Stale composite lib declarations cause false TS errors in artifacts
---

After changing files in `lib/*` packages (schemas, generated types, etc.), the `.d.ts` declarations may be stale.
Artifact typecheck errors like "Property X does not exist on type Y" when X is clearly in the OpenAPI schema often mean the lib hasn't been rebuilt.

**Why:** `tsc --build` caches declarations in `.tsbuildinfo`. Without a rebuild, artifacts see old type shapes.

**How to apply:** Run `pnpm run typecheck:libs` before running per-artifact typechecks after any lib change. This rebuilds all composite libs and freshens declarations.
