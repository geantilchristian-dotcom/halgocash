import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const SEGMENTS = [
  { label: "JACKPOT",    multiplier: 100, weight: 0.5  },
  { label: "MÉGA",       multiplier: 25,  weight: 1.5  },
  { label: "GRAND",      multiplier: 10,  weight: 3    },
  { label: "MAJEUR",     multiplier: 5,   weight: 5    },
  { label: "MINEUR",     multiplier: 2,   weight: 10   },
  { label: "PETIT",      multiplier: 1,   weight: 15   },
  { label: "TRÈS PETIT", multiplier: 0.5, weight: 20   },
  { label: "PERDU",      multiplier: 0,   weight: 45   },
] as const;

const TOTAL_WEIGHT = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

function weightedRoll(): number {
  const r = Math.random() * TOTAL_WEIGHT;
  let acc = 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    acc += SEGMENTS[i]!.weight;
    if (r < acc) return i;
  }
  return SEGMENTS.length - 1;
}

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

const SpinBody = z.object({
  amount: z.number().min(100).max(10_000_000),
});

router.post("/roulette/spin", async (req, res): Promise<void> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = SpinBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { amount } = parsed.data;

  const currentBalance = await getBalance(clerkId);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Solde insuffisant", balance: currentBalance });
    return;
  }

  const segmentIdx = weightedRoll();
  const seg = SEGMENTS[segmentIdx]!;
  const wonAmount = Math.floor(amount * seg.multiplier);
  const netChange = wonAmount - amount;

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(netChange !== 0 ? netChange : 0),
    reason: "roulette_spin",
    refId:  `${segmentIdx}:${amount}`,
  });

  const newBalance = Math.max(0, currentBalance + netChange);
  res.json({ segmentIdx, label: seg.label, multiplier: seg.multiplier, wonAmount, newBalance });
});

export default router;
