---
name: Crash game HMAC security
description: How crash points are generated and why the old XOR hash was replaced.
---

## Rule
Crash points MUST be generated server-side via `createHmac("sha256", SESSION_SECRET).update(String(roundId)).digest("hex")`. Never use a client-computable deterministic function.

**Why:** The old `seededCrashPoint(roundId)` was identical client/server and used a public XOR seed — anyone could paste it in the browser console to know every future round's crash point, then only bet on high rounds.

**How to apply:**
- `artifacts/api-server/src/routes/crash.ts` → `hmacCrashPoint(roundId)` is the single source of truth
- `artifacts/halgo-app/src/pages/crash.tsx` → no local crash point computation; `startRound(id, ms, serverCrashPoint)` takes the value from `/api/crash/round` response
- Round transitions after crash: async `fetch("/api/crash/round")` before calling `launchFlight`
- Cashout endpoint receives `{ roundId, cashoutMult, betType }` — server validates `cashoutMult <= crashPoint + 0.05` and computes `wonAmount` itself; client cannot inflate winnings
- Bets tracked in `crash_bets` table (unique index on clerk_id + round_id = one bet per round per user)
