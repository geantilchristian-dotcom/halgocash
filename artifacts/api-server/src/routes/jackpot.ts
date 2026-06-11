import { Router, Request } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable, siteSettingsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function resolveUserId(req: Request): string | null {
  const { userId: clerkId } = getAuth(req);
  if (clerkId) return clerkId;
  const sessionId = (req.session as unknown as Record<string, unknown>)["userId"] as string | undefined;
  return sessionId ? `local:${sessionId}` : null;
}

async function computeBalance(userId: string): Promise<number> {
  const [winsRow, paidRow, pendingRow, creditsRow] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, userId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, userId)),
  ]);
  const wins    = winsRow[0]?.total    ? parseFloat(String(winsRow[0].total))    : 0;
  const paid    = paidRow[0]?.total    ? parseFloat(String(paidRow[0].total))    : 0;
  const pending = pendingRow[0]?.total ? parseFloat(String(pendingRow[0].total)) : 0;
  const credits = creditsRow[0]?.total ? parseFloat(String(creditsRow[0].total)) : 0;
  return Math.max(0, wins + credits - paid - pending);
}

const enterSchema = z.object({
  amount: z.number().int().positive("Montant invalide"),
});

async function getMinAmount(): Promise<number> {
  try {
    const [row] = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "jackpot_config"))
      .limit(1);
    if (row) {
      const cfg = JSON.parse(row.value) as { minAmount?: number };
      if (cfg.minAmount && cfg.minAmount >= 100) return cfg.minAmount;
    }
  } catch { /* fall through */ }
  return 500;
}

// POST /api/jackpot/enter — bet from balance to participate in Saturday jackpot
router.post("/jackpot/enter", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const parsed = enterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Données invalides" });
    return;
  }

  const { amount } = parsed.data;
  const minAmount = await getMinAmount();

  if (amount < minAmount) {
    res.status(400).json({ error: `Montant minimum ${minAmount} FC` });
    return;
  }

  const balance = await computeBalance(userId);

  if (balance < amount) {
    res.status(400).json({ error: `Solde insuffisant — vous avez ${Math.floor(balance)} FC` });
    return;
  }

  // Calculate number of entries (1 per minAmount FC tranche)
  const entries = Math.floor(amount / minAmount);

  // Get current week identifier (year-week)
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  const weekId = `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;

  // Deduct from balance via credit adjustment
  await db.insert(creditAdjustmentsTable).values({
    clerkId: userId,
    amount: String(-amount),
    reason: `jackpot_entry:${weekId}:${entries}`,
    refId: `jackpot-${weekId}-${Date.now()}`,
  });

  req.log?.info({ userId, amount, entries, weekId, minAmount }, "jackpot entry recorded");

  res.json({ ok: true, entries, weekId, message: `${entries} participation${entries > 1 ? "s" : ""} enregistrée${entries > 1 ? "s" : ""} pour le jackpot du samedi` });
});

// GET /api/jackpot/my-entries — how many entries this week
router.get("/jackpot/my-entries", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) { res.json({ entries: 0 }); return; }

  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  const weekId = `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;

  const rows = await db.select().from(creditAdjustmentsTable)
    .where(and(eq(creditAdjustmentsTable.clerkId, userId)));

  const weekEntries = rows
    .filter(r => r.reason.startsWith(`jackpot_entry:${weekId}`))
    .reduce((sum, r) => {
      const parts = r.reason.split(":");
      const n = parts[2] ? parseInt(parts[2]) : 1;
      return sum + (isNaN(n) ? 1 : n);
    }, 0);

  res.json({ entries: weekEntries, weekId });
});

export default router;
