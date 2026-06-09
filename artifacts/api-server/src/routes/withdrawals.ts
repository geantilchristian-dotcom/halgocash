import { Router, type IRouter } from "express";
import { eq, desc, and, sum, isNotNull } from "drizzle-orm";
import { db, withdrawalsTable, vendorsTable, usersTable, ticketsTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { withdrawalRateLimit } from "../middlewares/rateLimiters";

const router: IRouter = Router();

/** Compute the true available balance for a Clerk user.
 *  availableBalance = sum(won prizes) - sum(paid withdrawals) - sum(pending withdrawals)
 */
async function getAvailableBalance(clerkId: string): Promise<number> {
  const [winsRow] = await db
    .select({ total: sum(ticketsTable.prizeAmount) })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.registeredByClerkId, clerkId),
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.prizeAmount),
      ),
    );

  const [paidRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "paid")));

  const [pendingRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "pending")));

  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;

  return Math.max(0, wins - paid - pending);
}

// POST /api/withdrawals — rate-limited, player creates a withdrawal request (Clerk auth required)
router.post("/withdrawals", withdrawalRateLimit, async (req, res): Promise<void> => {
  const { userId, sessionClaims } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { amount } = req.body as { amount?: number };
  if (!amount || typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "Montant invalide" });
    return;
  }

  const available = await getAvailableBalance(userId);
  if (amount > available) {
    res.status(400).json({ error: `Solde insuffisant. Solde disponible : ${available} FC` });
    return;
  }

  const clerkName =
    (sessionClaims?.["fullName"] as string | undefined) ??
    (sessionClaims?.["username"] as string | undefined) ??
    "Joueur";

  const token = crypto.randomUUID();

  const [withdrawal] = await db
    .insert(withdrawalsTable)
    .values({
      clerkId: userId,
      clerkName,
      amount: String(amount),
      token,
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: withdrawal!.id,
    token: withdrawal!.token,
    amount: parseFloat(String(withdrawal!.amount)),
    clerkName: withdrawal!.clerkName,
    status: withdrawal!.status,
    createdAt: withdrawal!.createdAt.toISOString(),
    qrValue: JSON.stringify({
      type: "halgo-retrait",
      token: withdrawal!.token,
      amount: parseFloat(String(withdrawal!.amount)),
      name: clerkName,
    }),
  });
});

// DELETE /api/withdrawals/:token — player cancels their own pending withdrawal
router.delete("/withdrawals/:token", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const token = String(req.params["token"]);
  const [w] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.token, token))
    .limit(1);

  if (!w) {
    res.status(404).json({ error: "Code de retrait introuvable" });
    return;
  }

  if (w.clerkId !== userId) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }

  if (w.status !== "pending") {
    res.status(409).json({ error: "Seuls les retraits en attente peuvent être annulés" });
    return;
  }

  await db.delete(withdrawalsTable).where(eq(withdrawalsTable.token, token));

  res.json({ success: true, cancelled: true });
});

// GET /api/withdrawals/my — player's own withdrawals
router.get("/withdrawals/my", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.clerkId, userId))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(20);

  res.json(
    rows.map((w) => ({
      id: w.id,
      amount: parseFloat(String(w.amount)),
      token: w.token,
      status: w.status,
      paidAt: w.paidAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
  );
});

// GET /api/withdrawals/:token — vendor looks up a withdrawal by token
router.get("/withdrawals/:token", async (req, res): Promise<void> => {
  const token = String(req.params["token"]);
  const vendorUserId = req.session.userId;
  if (!vendorUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [w] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.token, token))
    .limit(1);

  if (!w) {
    res.status(404).json({ error: "Code de retrait introuvable" });
    return;
  }

  res.json({
    id: w.id,
    clerkId: w.clerkId,
    clerkName: w.clerkName,
    amount: parseFloat(String(w.amount)),
    token: w.token,
    status: w.status,
    paidAt: w.paidAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
  });
});

// POST /api/withdrawals/:token/pay — vendor pays a withdrawal
router.post("/withdrawals/:token/pay", async (req, res): Promise<void> => {
  const vendorUserId = req.session.userId;
  if (!vendorUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [vendorUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, vendorUserId))
    .limit(1);

  if (!vendorUser || !vendorUser.vendorId) {
    res.status(403).json({ error: "Accès vendeur requis" });
    return;
  }

  const token = String(req.params["token"]);
  const [w] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.token, token))
    .limit(1);

  if (!w) {
    res.status(404).json({ error: "Code de retrait introuvable" });
    return;
  }

  if (w.status === "paid") {
    res.status(409).json({ error: "Ce retrait a déjà été payé" });
    return;
  }

  const [updated] = await db
    .update(withdrawalsTable)
    .set({
      status: "paid",
      paidByVendorId: vendorUser.vendorId,
      paidAt: new Date(),
    })
    .where(eq(withdrawalsTable.token, token))
    .returning();

  const [vendor] = await db
    .select({ name: vendorsTable.name })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, vendorUser.vendorId))
    .limit(1);

  res.json({
    id: updated!.id,
    clerkName: updated!.clerkName,
    amount: parseFloat(String(updated!.amount)),
    status: updated!.status,
    paidAt: updated!.paidAt?.toISOString() ?? null,
    paidByVendorName: vendor?.name ?? null,
  });
});

// GET /api/vendor/withdrawals — withdrawals paid by this vendor (vendor session)
router.get("/vendor/withdrawals", async (req, res): Promise<void> => {
  const vendorUserId = req.session.userId;
  if (!vendorUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [vendorUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, vendorUserId))
    .limit(1);

  if (!vendorUser?.vendorId) {
    res.status(403).json({ error: "Accès vendeur requis" });
    return;
  }

  const rows = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.paidByVendorId, vendorUser.vendorId))
    .orderBy(desc(withdrawalsTable.paidAt))
    .limit(50);

  res.json(
    rows.map((w) => ({
      id: w.id,
      clerkId: w.clerkId,
      clerkName: w.clerkName,
      amount: parseFloat(String(w.amount)),
      token: w.token,
      status: w.status,
      paidAt: w.paidAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
  );
});

export { getAvailableBalance };
export default router;
