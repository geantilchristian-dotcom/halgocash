import { rateLimit } from "express-rate-limit";

// Anti-bruteforce — login endpoint: 8 attempts per 15 minutes per IP
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." },
});

// Anti-fraud enumeration — balance check: 15 per minute per IP
export const balanceCheckRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de vérifications de solde. Réessayez dans une minute." },
});

// Anti-abuse — withdrawal requests: 10 per hour per IP
export const withdrawalRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de demandes de retrait. Réessayez dans une heure." },
});
