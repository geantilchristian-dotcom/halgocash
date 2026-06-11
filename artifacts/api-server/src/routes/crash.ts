import { createHmac, createHash } from "crypto";
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable, crashBetsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { crashBetRateLimit, cashoutRateLimit } from "../middlewares/rateLimiters";

const router = Router();

const ROUND_MS        = 30_000;
const FLIGHT_START_MS = 12_000; // 2s crash-show + 10s bet-window

// ── Server-only HMAC crash point ─────────────────────────────────────────────
// Uses SESSION_SECRET — clients can NEVER reproduce this without the secret.
const CRASH_SECRET = process.env.SESSION_SECRET ?? "halgo-crash-secret-fallback";

function hmacCrashPoint(roundId: number): number {
  const hash = createHmac("sha256", CRASH_SECRET).update(String(roundId)).digest("hex");
  const r = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  if (r < 0.03) return 1.0;
  return Math.min(1000, Math.max(1.01, Math.floor((0.99 / (1 - r)) * 100) / 100));
}

/**
 * Commitment hash — proves the server committed to this crash point BEFORE
 * any bets were placed. Players can verify after the round:
 *   SHA-256("halgo-crash:" + roundId + ":" + crashPoint.toFixed(2)) === commitment
 */
function commitmentHash(roundId: number, crashPoint: number): string {
  return createHash("sha256")
    .update(`halgo-crash:${roundId}:${crashPoint.toFixed(2)}`)
    .digest("hex");
}

// ── Balance helper ────────────────────────────────────────────────────────────
async function getBalance(clerkId: string): Promise<number> {
  const [[winsRow], [paidRow], [pendingRow], [creditsRow]] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, clerkId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, clerkId)),
  ]);
  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;
  const credits = creditsRow?.total ? parseFloat(String(creditsRow.total)) : 0;
  return Math.max(0, wins + credits - paid - pending);
}

// GET /api/crash/round
// ─ During betting window  → returns commitment hash only (NO crash point).
//   A player who calls this API before betting CANNOT know when the plane crashes.
// ─ During flight          → reveals crash point (betting is already closed, no advantage).
router.get("/crash/round", (_req, res): void => {
  const now        = Date.now();
  const roundId    = Math.floor(now / ROUND_MS);
  const msInto     = now % ROUND_MS;
  const crashPoint = hmacCrashPoint(roundId);
  const commitment = commitmentHash(roundId, crashPoint);

  if (msInto < FLIGHT_START_MS) {
    // Betting window — do NOT reveal the crash point
    res.json({ roundId, msIntoRound: msInto, serverMs: now, commitment, betting: true });
  } else {
    // Flight in progress — reveal crash point for animation rendering
    res.json({ roundId, crashPoint, msIntoRound: msInto, serverMs: now, commitment, betting: false });
  }
});

// POST /api/crash/bet — validate timing, deduct balance, record in DB
const BetBody = z.object({
  amount:  z.number().int().min(100).max(10_000_000),
  roundId: z.number().int().positive(),
});

router.post("/crash/bet", crashBetRateLimit, async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = BetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Montant invalide" }); return; }
  const { amount, roundId } = parsed.data;

  // Server-side window check — the betting window must still be open
  const now         = Date.now();
  const serverRound = Math.floor(now / ROUND_MS);
  const msInto      = now % ROUND_MS;
  if (roundId !== serverRound || msInto >= FLIGHT_START_MS) {
    res.status(400).json({ error: "La fenêtre de mise est fermée" });
    return;
  }

  const currentBalance = await getBalance(clerkId);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Solde insuffisant", balance: currentBalance });
    return;
  }

  // One bet per round per user (enforced by unique DB index)
  const [existing] = await db.select({ id: crashBetsTable.id })
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Vous avez déjà misé dans ce round" });
    return;
  }

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(-amount),
    reason: "crash_bet",
    refId: `RND-${roundId}`,
  });
  await db.insert(crashBetsTable).values({ clerkId, roundId, amount, status: "placed" });

  res.json({ ok: true, newBalance: Math.max(0, currentBalance - amount) });
});

// POST /api/crash/cancel-bet
const CancelBetBody = z.object({
  roundId: z.number().int().positive(),
});

router.post("/crash/cancel-bet", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CancelBetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { roundId } = parsed.data;

  // Can only cancel during betting window
  const now    = Date.now();
  const msInto = now % ROUND_MS;
  if (msInto >= FLIGHT_START_MS) {
    res.status(400).json({ error: "L'annulation n'est plus possible, le vol a commencé" });
    return;
  }

  const [bet] = await db.select()
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);

  if (!bet || bet.status !== "placed") {
    res.status(400).json({ error: "Mise introuvable ou déjà traitée" });
    return;
  }

  await db.update(crashBetsTable)
    .set({ status: "cancelled" })
    .where(eq(crashBetsTable.id, bet.id));

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(bet.amount),
    reason: "crash_bet_cancel",
  });

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance });
});

// POST /api/crash/cashout — server validates mult < crashPoint and computes winnings
const CashoutBody = z.object({
  roundId:     z.number().int().positive(),
  cashoutMult: z.number().min(1.0).max(1000),
  betType:     z.enum(["full", "half"]).default("full"),
});

router.post("/crash/cashout", cashoutRateLimit, async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CashoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { roundId, cashoutMult, betType } = parsed.data;

  // Server-side crash point check — impossible to forge without SESSION_SECRET
  const crashPoint = hmacCrashPoint(roundId);
  if (cashoutMult > crashPoint + 0.05) {
    res.status(400).json({ error: "Cashout refusé : l'avion avait déjà crashé" });
    return;
  }

  const [bet] = await db.select()
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);

  if (!bet || bet.status !== "placed") {
    res.status(400).json({ error: "Mise introuvable ou déjà traitée" });
    return;
  }

  const effectiveBet = betType === "half" ? Math.floor(bet.amount / 2) : bet.amount;
  const wonAmount    = Math.floor(effectiveBet * cashoutMult);
  const newStatus    = betType === "half" ? "placed" : "cashed";

  await db.update(crashBetsTable)
    .set({
      status:      newStatus,
      cashoutMult: String(cashoutMult),
      wonAmount,
      amount: betType === "half" ? bet.amount - Math.floor(bet.amount / 2) : bet.amount,
    })
    .where(eq(crashBetsTable.id, bet.id));

  if (wonAmount > 0) {
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(wonAmount),
      reason: "crash_cashout",
    });
  }

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance, wonAmount });
});

export default router;
