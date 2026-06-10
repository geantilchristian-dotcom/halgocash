import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

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

const BetBody = z.object({ amount: z.number().int().min(100).max(10_000_000) });

// POST /api/crash/bet — deduct bet from real balance
router.post("/crash/bet", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = BetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Montant invalide" }); return; }
  const { amount } = parsed.data;

  const currentBalance = await getBalance(clerkId);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Solde insuffisant", balance: currentBalance });
    return;
  }

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(-amount),
    reason: "crash_bet",
  });

  res.json({ ok: true, newBalance: Math.max(0, currentBalance - amount) });
});

const CancelBetBody = z.object({ amount: z.number().int().min(100) });

// POST /api/crash/cancel-bet — refund a cancelled bet
router.post("/crash/cancel-bet", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CancelBetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Montant invalide" }); return; }
  const { amount } = parsed.data;

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(amount),
    reason: "crash_bet_cancel",
  });

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance });
});

const CashoutBody = z.object({ wonAmount: z.number().int().min(0) });

// POST /api/crash/cashout — credit winnings (bet*multiplier) to balance
router.post("/crash/cashout", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CashoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Montant invalide" }); return; }
  const { wonAmount } = parsed.data;

  if (wonAmount > 0) {
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(wonAmount),
      reason: "crash_cashout",
    });
  }

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance });
});

export default router;
