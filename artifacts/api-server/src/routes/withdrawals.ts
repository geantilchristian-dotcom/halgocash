import { Router, type IRouter } from "express";
import { eq, desc, and, sum, isNotNull, sql } from "drizzle-orm";
import { db, withdrawalsTable, vendorsTable, usersTable, ticketsTable, creditAdjustmentsTable } from "@workspace/db";
import { getAuth, clerkClient } from "@clerk/express";
import { withdrawalRateLimit } from "../middlewares/rateLimiters";

const router: IRouter = Router();

/** Compute the true available balance for a Clerk user.
 *  availableBalance = sum(won prizes) + sum(credit_adjustments) - sum(paid withdrawals) - sum(pending withdrawals)
 */
async function getAvailableBalance(clerkId: string): Promise<number> {
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
  if (amount < 500) {
    res.status(400).json({ error: "Retrait minimum : 500 FC" });
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

  // Fetch live Clerk profile for fresh data
  let clientPostNom: string | null = w.clientPostNom ?? null;
  let clientPhone: string | null = w.clientPhone ?? null;
  let clientAge: string | null = w.clientAge ?? null;
  let clientAddress: string | null = w.clientAddress ?? null;
  let clientFirstName: string | null = null;
  let clientLastName: string | null = null;

  try {
    const clerkUser = await clerkClient.users.getUser(w.clerkId);
    clientFirstName = clerkUser.firstName ?? null;
    clientLastName = clerkUser.lastName ?? null;
    const meta = clerkUser.unsafeMetadata as Record<string, string | undefined>;
    clientPostNom = meta?.postNom ?? clientPostNom ?? null;
    clientPhone = meta?.telephone ?? clientPhone ?? null;
    clientAge = meta?.age ?? clientAge ?? null;
    clientAddress = meta?.adresse ?? clientAddress ?? null;
  } catch { /* ignore — use stored snapshot if Clerk unavailable */ }

  res.json({
    id: w.id,
    clerkId: w.clerkId,
    clerkName: w.clerkName,
    amount: parseFloat(String(w.amount)),
    token: w.token,
    status: w.status,
    paidAt: w.paidAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    clientFirstName,
    clientLastName,
    clientPostNom,
    clientPhone,
    clientAge,
    clientAddress,
  });
});

// POST /api/withdrawals/:token/pay — vendor pays a withdrawal
// Uses a PostgreSQL advisory lock (pg_advisory_xact_lock) to prevent race conditions:
// concurrent pay requests for the same token queue up instead of double-paying.
router.post("/withdrawals/:token/pay", async (req, res): Promise<void> => {
  const vendorUserId = req.session.userId;
  if (!vendorUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [vendorUser] = await db
    .select({ id: usersTable.id, vendorId: usersTable.vendorId })
    .from(usersTable)
    .where(eq(usersTable.id, vendorUserId))
    .limit(1);

  if (!vendorUser || !vendorUser.vendorId) {
    res.status(403).json({ error: "Accès vendeur requis" });
    return;
  }

  const token = String(req.params["token"]);

  // Fetch Clerk profile snapshot outside the transaction (network call, no lock needed)
  let clientPostNom: string | null = null;
  let clientPhone: string | null = null;
  let clientAge: string | null = null;
  let clientAddress: string | null = null;

  let result: { id: number; clerkName: string; amount: string; status: string; paidAt: Date | null } | null = null;
  let alreadyPaid = false;
  let notFound = false;

  try {
    await db.transaction(async (tx) => {
      // Advisory lock keyed to token hash — serialises concurrent pay attempts
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${token}))`);

      const [w] = await tx
        .select()
        .from(withdrawalsTable)
        .where(eq(withdrawalsTable.token, token))
        .limit(1);

      if (!w) { notFound = true; return; }
      if (w.status === "paid") { alreadyPaid = true; return; }

      // Fetch Clerk profile (outside lock scope is fine — read-only external call)
      try {
        const clerkUser = await clerkClient.users.getUser(w.clerkId);
        const meta = clerkUser.unsafeMetadata as Record<string, string | undefined>;
        clientPostNom = meta?.postNom ?? null;
        clientPhone = meta?.telephone ?? null;
        clientAge = meta?.age ?? null;
        clientAddress = meta?.adresse ?? null;
      } catch { /* ignore — proceed without profile snapshot */ }

      const [updated] = await tx
        .update(withdrawalsTable)
        .set({
          status: "paid",
          paidByVendorId: vendorUser.vendorId,
          paidAt: new Date(),
          clientPostNom,
          clientPhone,
          clientAge,
          clientAddress,
        })
        .where(eq(withdrawalsTable.token, token))
        .returning();

      result = updated ?? null;
    });
  } catch (err) {
    req.log.error({ err }, "Withdrawal pay transaction failed");
    res.status(500).json({ error: "Erreur serveur lors du paiement" });
    return;
  }

  if (notFound) { res.status(404).json({ error: "Code de retrait introuvable" }); return; }
  if (alreadyPaid) { res.status(409).json({ error: "Ce retrait a déjà été payé" }); return; }
  if (!result) { res.status(500).json({ error: "Erreur lors de la mise à jour" }); return; }

  const [vendor] = await db
    .select({ name: vendorsTable.name })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, vendorUser.vendorId!))
    .limit(1);

  const r = result as { id: number; clerkName: string; amount: string; status: string; paidAt: Date | null };
  res.json({
    id: r.id,
    clerkName: r.clerkName,
    amount: parseFloat(r.amount),
    status: r.status,
    paidAt: r.paidAt?.toISOString() ?? null,
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
    .select({ vendorId: usersTable.vendorId })
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
      clientPostNom: w.clientPostNom ?? null,
      clientPhone: w.clientPhone ?? null,
      clientAge: w.clientAge ?? null,
      clientAddress: w.clientAddress ?? null,
    })),
  );
});

export { getAvailableBalance };
export default router;
