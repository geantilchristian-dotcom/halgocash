import { Router, Request } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable, minesGamesTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const GRID_SIZE = 25;
const HOUSE_EDGE = 0.97;

function resolveUserId(req: Request): string | null {
  const { userId: clerkId } = getAuth(req);
  if (clerkId) return clerkId;
  const sessionId = (req.session as unknown as Record<string, unknown>)["userId"] as string | undefined;
  return sessionId ? `local:${sessionId}` : null;
}

function calcMultiplier(mineCount: number, safeRevealed: number): number {
  if (safeRevealed === 0) return 1.0;
  let m = 1.0;
  for (let i = 0; i < safeRevealed; i++) {
    m *= (GRID_SIZE - i) / (GRID_SIZE - mineCount - i);
  }
  return Math.round(m * HOUSE_EDGE * 100) / 100;
}

function pickMines(count: number): number[] {
  const positions = Array.from({ length: GRID_SIZE }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j]!, positions[i]!];
  }
  return positions.slice(0, count).sort((a, b) => a - b);
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

// GET /api/mines/active — returns the active game for the player (if any)
router.get("/mines/active", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const [game] = await db.select().from(minesGamesTable)
    .where(and(eq(minesGamesTable.clerkId, clerkId), eq(minesGamesTable.status, "active")))
    .limit(1);

  if (!game) { res.json(null); return; }

  const revealedCells = (game.revealedCells as number[]) ?? [];
  const mult = calcMultiplier(game.mineCount, revealedCells.length);
  res.json({
    gameId: game.id,
    betAmount: game.betAmount,
    mineCount: game.mineCount,
    revealedCells,
    multiplier: mult,
    cashoutAmount: Math.floor(game.betAmount * mult),
  });
});

// POST /api/mines/start
const StartBody = z.object({
  betAmount: z.number().int().min(100).max(5_000_000),
  mineCount: z.number().int().min(1).max(24),
});

router.post("/mines/start", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = StartBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Paramètres invalides" }); return; }
  const { betAmount, mineCount } = parsed.data;

  // Cancel any previous active game for this user (forfeit bet, already deducted)
  await db.update(minesGamesTable)
    .set({ status: "lost", endedAt: new Date() })
    .where(and(eq(minesGamesTable.clerkId, clerkId), eq(minesGamesTable.status, "active")));

  const balance = await getBalance(clerkId);
  if (balance < betAmount) {
    res.status(400).json({ error: "Solde insuffisant" });
    return;
  }

  const minePositions = pickMines(mineCount);

  // Deduct bet
  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(-betAmount),
    reason: "mines_bet",
    refId: null,
  });

  const [game] = await db.insert(minesGamesTable).values({
    clerkId,
    betAmount,
    mineCount,
    minePositions,
    revealedCells: [],
    status: "active",
  }).returning();

  res.json({
    gameId: game!.id,
    betAmount,
    mineCount,
    revealedCells: [],
    multiplier: 1.0,
    cashoutAmount: betAmount,
  });
});

// POST /api/mines/reveal
const RevealBody = z.object({
  gameId: z.number().int().positive(),
  cellIndex: z.number().int().min(0).max(24),
});

router.post("/mines/reveal", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = RevealBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Paramètres invalides" }); return; }
  const { gameId, cellIndex } = parsed.data;

  const [game] = await db.select().from(minesGamesTable)
    .where(and(eq(minesGamesTable.id, gameId), eq(minesGamesTable.clerkId, clerkId), eq(minesGamesTable.status, "active")))
    .limit(1);

  if (!game) { res.status(404).json({ error: "Partie introuvable" }); return; }

  const revealedCells = (game.revealedCells as number[]) ?? [];
  const minePositions = game.minePositions as number[];

  if (revealedCells.includes(cellIndex)) {
    res.status(400).json({ error: "Case déjà révélée" });
    return;
  }

  const isMine = minePositions.includes(cellIndex);

  if (isMine) {
    await db.update(minesGamesTable)
      .set({ status: "lost", endedAt: new Date(), revealedCells: [...revealedCells, cellIndex] })
      .where(eq(minesGamesTable.id, gameId));

    res.json({ safe: false, minePositions, revealedCells: [...revealedCells, cellIndex], multiplier: 0 });
    return;
  }

  const newRevealed = [...revealedCells, cellIndex];
  const safeCells = GRID_SIZE - game.mineCount;
  const allSafe = newRevealed.length >= safeCells;

  if (allSafe) {
    // Auto-cashout: revealed all safe cells
    const multiplier = calcMultiplier(game.mineCount, newRevealed.length);
    const cashoutAmount = Math.floor(game.betAmount * multiplier);
    await db.update(minesGamesTable)
      .set({ status: "cashed_out", endedAt: new Date(), revealedCells: newRevealed, cashoutAmount })
      .where(eq(minesGamesTable.id, gameId));
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(cashoutAmount),
      reason: "mines_cashout",
      refId: String(gameId),
    });
    res.json({ safe: true, allRevealed: true, multiplier, cashoutAmount, minePositions, revealedCells: newRevealed });
    return;
  }

  const multiplier = calcMultiplier(game.mineCount, newRevealed.length);
  await db.update(minesGamesTable)
    .set({ revealedCells: newRevealed })
    .where(eq(minesGamesTable.id, gameId));

  res.json({
    safe: true,
    allRevealed: false,
    multiplier,
    cashoutAmount: Math.floor(game.betAmount * multiplier),
    revealedCells: newRevealed,
  });
});

// POST /api/mines/cashout
const CashoutBody = z.object({
  gameId: z.number().int().positive(),
});

router.post("/mines/cashout", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CashoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Paramètres invalides" }); return; }
  const { gameId } = parsed.data;

  const [game] = await db.select().from(minesGamesTable)
    .where(and(eq(minesGamesTable.id, gameId), eq(minesGamesTable.clerkId, clerkId), eq(minesGamesTable.status, "active")))
    .limit(1);

  if (!game) { res.status(404).json({ error: "Partie introuvable" }); return; }

  const revealedCells = (game.revealedCells as number[]) ?? [];
  if (revealedCells.length === 0) {
    res.status(400).json({ error: "Révélez au moins une case avant d'encaisser" });
    return;
  }

  const multiplier = calcMultiplier(game.mineCount, revealedCells.length);
  const cashoutAmount = Math.floor(game.betAmount * multiplier);

  await db.update(minesGamesTable)
    .set({ status: "cashed_out", endedAt: new Date(), cashoutAmount })
    .where(eq(minesGamesTable.id, gameId));

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(cashoutAmount),
    reason: "mines_cashout",
    refId: String(gameId),
  });

  res.json({
    cashoutAmount,
    multiplier,
    minePositions: game.minePositions,
    revealedCells,
  });
});

export default router;
