import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";
import type { Request } from "express";

/** Per-user key (userId when authenticated, IP as fallback via ipKeyGenerator for IPv6 safety) */
function userKey(req: Request): string {
  try {
    const auth = getAuth(req);
    if (auth.userId) return `u:${auth.userId}`;
  } catch { /* not yet authenticated */ }
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

// ── Auth / Admin ───────────────────────────────────────────────────────────
// Anti-bruteforce — login endpoint: 8 attempts per 15 minutes per IP
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

// ── Balance / Finance ──────────────────────────────────────────────────────
// Anti-fraud enumeration — balance check: 15 per minute per user
export const balanceCheckRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Trop de vérifications de solde. Réessayez dans une minute." },
});

// Anti-abuse — withdrawal requests: 10 per hour per user
export const withdrawalRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Trop de demandes de retrait. Réessayez dans une heure." },
});

// ── Crash game ─────────────────────────────────────────────────────────────
// Key = userId + roundId so each new round resets the counter independently.
// Max 2 attempts per round (retries allowed), window long enough to cover the round.
export const crashBetRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    let uid: string;
    try {
      const auth = getAuth(req);
      if (auth.userId) uid = `u:${auth.userId}`;
      else uid = ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
    } catch {
      uid = ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
    }
    // Include roundId so each round gets its own independent counter
    const body = req.body as Record<string, unknown> | undefined;
    const roundId = body?.roundId;
    return roundId != null ? `${uid}:r${roundId}` : uid;
  },
  message: { error: "Une seule mise par round est autorisée." },
});

// Full + half cashout per round, a little slack for retries
export const cashoutRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Trop d'actions de cashout. Réessayez dans une minute." },
});

// ── Transfer ───────────────────────────────────────────────────────────────
// Max 10 transfers per hour per user — prevents balance-drain loops
export const transferRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Limite de transferts atteinte. Réessayez dans une heure." },
});

// ── Support ────────────────────────────────────────────────────────────────
// 30 messages per hour per user — prevents spam
export const supportMessageRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Trop de messages. Réessayez dans une heure." },
});

// ── KYC ───────────────────────────────────────────────────────────────────
// 5 submissions per day per user — prevents re-submission spam
export const kycSubmitRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userKey,
  message: { error: "Trop de soumissions KYC. Réessayez demain." },
});
