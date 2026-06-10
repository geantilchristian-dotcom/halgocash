import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Segments in the same order as the frontend wheel
const SEGMENT_LABELS = ["0","7","4","11","2","15","6","13","8","19","10","21","12","17","14","23","16","25"];
const SEG_COUNT = SEGMENT_LABELS.length;

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

function getMultiplier(betType: "rouge" | "noir" | "vert", label: string): number {
  if (betType === "vert") return label === "0" ? 14 : 0;
  const n = parseInt(label, 10);
  if (betType === "rouge") return n !== 0 && n % 2 === 1 ? 2 : 0;
  return n !== 0 && n % 2 === 0 ? 2 : 0;
}

const SpinBody = z.object({
  betType: z.enum(["rouge", "noir", "vert"]),
  amount: z.number().int().min(100).max(10_000_000),
});

// POST /api/roulette/spin — atomic: bet + roll + credit in one call
router.post("/roulette/spin", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = SpinBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { betType, amount } = parsed.data;

  const currentBalance = await getBalance(clerkId);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Solde insuffisant", balance: currentBalance });
    return;
  }

  // Server-side roll
  const segmentIdx = Math.floor(Math.random() * SEG_COUNT);
  const result = SEGMENT_LABELS[segmentIdx]!;
  const mult = getMultiplier(betType, result);
  const won = mult > 0;
  const wonAmount = won ? Math.floor(amount * mult) : 0;
  const netChange = wonAmount - amount;

  if (netChange !== 0) {
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(netChange),
      reason: "roulette_spin",
    });
  }

  const newBalance = Math.max(0, currentBalance + netChange);
  res.json({ segmentIdx, result, won, wonAmount, newBalance });
});

export default router;
