# Halgo

Application mobile money et réservation de tickets de transport pour la RDC.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec (run via `node lib/api-spec/node_modules/orval/dist/bin/orval.mjs --config lib/api-spec/orval.config.ts`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TailwindCSS + shadcn/ui + React Query

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all API types)
- `lib/api-client-react/` — generated React Query hooks (from codegen)
- `lib/api-zod/` — generated Zod validation schemas (from codegen)
- `lib/db/src/schema/index.ts` — Drizzle DB schema
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/halgo-app/src/pages/home.tsx` — main UI page

## Architecture decisions

- OpenAPI-first: all endpoints defined in `openapi.yaml` before implementation
- Generated hooks include `/api` prefix already — do NOT call `setBaseUrl("/api")`
- Shared proxy routes `/api` → port 8080 (API server), `/` → port 19165 (Halgo app)
- Codegen must be run via `node lib/api-spec/node_modules/orval/dist/bin/orval.mjs` (not via pnpm script, due to Node.js 24 thread issue)

## Product

- Enter 10-digit code → check balance (reveals balance in header)
- Select destination, quantity, ticket class → Confirm Payment
- Booking creates a transaction and deducts from balance
- Recent transactions shown after code is verified
- 8 DRC destinations seeded (Kinshasa zones)

## Test accounts

- Code `1234567890` — Jean Mukeba, $1234.56 USD
- Code `0987654321` — Marie Kabila, $850.00 USD
- Code `5555555555` — Pierre Lumumba, $2500.00 USD

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm install` from workspace root before starting workflows if node_modules is missing
- The `packageManager` field must NOT be set in root package.json (causes corepack to try to install pnpm, which fails on EROFS)
- Do NOT add `setBaseUrl("/api")` — generated URLs already have `/api/` prefix

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- GitHub repo: https://github.com/geantilchristian-dotcom/halgo
