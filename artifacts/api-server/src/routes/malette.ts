import { Router, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable, maletteGamesTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();
const HOUSE_EDGE = 0.97;

// 6 prizes shuffled each round — 2 losses, 1 break-even, 1 small win, 1 medium win, 1 jackpot
const PRIZE_POOL = [0, 0, 1, 1.5, 3, 5];

function resolveUserId(req: Request): string | null {
  const { userId: clerkId } = getAuth(req);
  if (clerkId) return clerkId;
  const sessionId = (req.session as unknown as Record<string, unknown>)["userId"] as string | undefined;
  return sessionId ? `local:${sessionId}` : null;
}

async function getBalance(userId: string): Promise<number> {
  const [[winsRow], [paidRow], [pendingRow], [creditsRow]] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, userId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, userId)),
  ]);
  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;
  const credits = creditsRow?.total ? parseFloat(String(creditsRow.total)) : 0;
  return Math.max(0, wins + credits - paid - pending);
}

function shufflePrizes(): number[] {
  const prizes = [...PRIZE_POOL];
  for (let i = prizes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [prizes[i], prizes[j]] = [prizes[j]!, prizes[i]!];
  }
  return prizes;
}

// ── GET /api/malette/active ───────────────────────────────────────────────────
router.get("/malette/active", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const [game] = await db.select()
    .from(maletteGamesTable)
    .where(and(eq(maletteGamesTable.clerkId, clerkId), eq(maletteGamesTable.status, "active")))
    .limit(1);

  res.json(game ? { gameId: game.id, betAmount: game.betAmount } : null);
});

// ── POST /api/malette/start ───────────────────────────────────────────────────
const StartBody = z.object({ betAmount: z.number().int().min(100).max(5_000_000) });

router.post("/malette/start", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { betAmount } = parsed.data;

  const [existing] = await db.select({ id: maletteGamesTable.id })
    .from(maletteGamesTable)
    .where(and(eq(maletteGamesTable.clerkId, clerkId), eq(maletteGamesTable.status, "active")))
    .limit(1);
  if (existing) { res.status(400).json({ error: "Partie déjà en cours" }); return; }

  const balance = await getBalance(clerkId);
  if (balance < betAmount) { res.status(400).json({ error: "Solde insuffisant" }); return; }

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(-betAmount),
    reason: "malette_bet",
    refId: null,
  });

  const prizes = shufflePrizes();
  const [game] = await db.insert(maletteGamesTable).values({
    clerkId,
    betAmount,
    prizePositions: prizes,
    status: "active",
  }).returning();

  if (!game) { res.status(500).json({ error: "Erreur serveur" }); return; }

  res.json({ gameId: game.id, betAmount });
});

// ── POST /api/malette/pick ────────────────────────────────────────────────────
const PickBody = z.object({
  gameId: z.number().int(),
  index: z.number().int().min(0).max(5),
});

router.post("/malette/pick", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = PickBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { gameId, index } = parsed.data;

  const [game] = await db.select()
    .from(maletteGamesTable)
    .where(and(
      eq(maletteGamesTable.id, gameId),
      eq(maletteGamesTable.clerkId, clerkId),
      eq(maletteGamesTable.status, "active"),
    ))
    .limit(1);

  if (!game) { res.status(404).json({ error: "Partie introuvable" }); return; }

  const prizes = game.prizePositions as number[];
  const rawMult = prizes[index] ?? 0;
  const wonMult = Math.round(rawMult * HOUSE_EDGE * 100) / 100;
  const wonAmount = Math.floor(game.betAmount * wonMult);

  if (wonAmount > 0) {
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(wonAmount),
      reason: "malette_win",
      refId: String(gameId),
    });
  }

  await db.update(maletteGamesTable)
    .set({
      chosenIndex: index,
      wonMult: String(wonMult),
      wonAmount,
      status: "resolved",
      resolvedAt: new Date(),
    })
    .where(eq(maletteGamesTable.id, gameId));

  res.json({ prizes, chosenIndex: index, wonMult, wonAmount, win: wonAmount > 0 });
});

export default router;
