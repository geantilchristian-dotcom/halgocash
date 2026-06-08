import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, withdrawalsTable, vendorsTable, usersTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

// POST /api/withdrawals — player creates a withdrawal request (Clerk auth required)
router.post("/withdrawals", async (req, res): Promise<void> => {
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

  // Check balance (sum of all winning tickets for this user)
  const { sum, isNotNull } = await import("drizzle-orm");
  const { ticketsTable } = await import("@workspace/db");
  const [balRow] = await db
    .select({ total: sum(ticketsTable.prizeAmount) })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.registeredByClerkId, userId),
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.prizeAmount),
      ),
    );
  const balance = balRow?.total ? parseFloat(String(balRow.total)) : 0;

  if (amount > balance) {
    res.status(400).json({ error: `Solde insuffisant. Solde disponible : ${balance} FC` });
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
  const { token } = req.params;
  const vendorUserId = req.session.userId;
  if (!vendorUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [w] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.token, token!))
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

  const { token } = req.params;
  const [w] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.token, token!))
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
    .where(eq(withdrawalsTable.token, token!))
    .returning();

  // Fetch vendor name for response
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

export default router;
