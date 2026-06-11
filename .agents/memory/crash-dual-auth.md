---
name: Crash dual-auth pattern
description: How crash game routes resolve userId from Clerk OR session, and ipKeyGenerator fix
---

## Rule
All crash game bet/cashout/cancel-bet routes use `resolveUserId(req)` defined in `crash.ts`. This function:
1. Tries Clerk's `getAuth(req).userId` first
2. Falls back to `req.session["userId"]` (from 10-digit code flow), prefixing it with `local:`
3. Returns null if neither is present → 401

`getBalance(userId)` accepts either format because `creditAdjustmentsTable.clerkId` stores both Clerk IDs and `local:${sessionId}` strings.

## Why
Users who authenticated via 10-digit code have a session but no Clerk token. Without the fallback, their balance loaded fine (auth/balance already had this pattern) but bets returned 401 silently.

## Session cast
`req.session` must be cast through `unknown` first:
```typescript
const sessionId = (req.session as unknown as Record<string, unknown>)["userId"] as string | undefined;
```
Direct cast to `Record<string, unknown>` fails TS because `Session & Partial<SessionData>` lacks an index signature.

## ipKeyGenerator
`ipKeyGenerator` from `express-rate-limit` expects a `string` (the raw IP), NOT a `Request` object:
```typescript
return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
```
