import { Router, type IRouter } from "express";
import { eq, count, sum, isNotNull, isNull, and, desc } from "drizzle-orm";
import { db, usersTable, ticketsTable, vendorsTable, withdrawalsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/vendor/stats — stats for the logged-in vendor
router.get("/vendor/stats", async (req, res): Promise<void> => {
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

  const vid = vendorUser.vendorId;

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, vid))
    .limit(1);

  const [totalRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(eq(ticketsTable.vendorId, vid));

  const [scratchedRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNotNull(ticketsTable.registeredAt)));

  const [availableRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNull(ticketsTable.registeredAt)));

  // Tickets assigned but not yet acknowledged by the vendor
  const [pendingReceptionRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNull(ticketsTable.receivedByVendorAt)));

  const [expectedRow] = await db
    .select({ total: sum(ticketsTable.price) })
    .from(ticketsTable)
    .where(eq(ticketsTable.vendorId, vid));

  const [collectedRow] = await db
    .select({ total: sum(ticketsTable.price) })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNotNull(ticketsTable.registeredAt)));

  // Withdrawals paid BY this vendor
  const [paidRow] = await db
    .select({ cnt: count(), total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.paidByVendorId, vid), eq(withdrawalsTable.status, "paid")));

  // Withdrawals pending (system-wide pending, not vendor-specific)
  const [pendingRow] = await db
    .select({ cnt: count(), total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));

  res.json({
    vendorId: vid,
    vendorName: vendor?.name ?? "Vendeur",
    location: vendor?.location ?? "",
    totalTickets: Number(totalRow?.cnt ?? 0),
    soldTickets: Number(scratchedRow?.cnt ?? 0),
    availableTickets: Number(availableRow?.cnt ?? 0),
    scratchedTickets: Number(scratchedRow?.cnt ?? 0),
    pendingReceptionTickets: Number(pendingReceptionRow?.cnt ?? 0),
    expectedRevenue: parseFloat(String(expectedRow?.total ?? "0")),
    collectedRevenue: parseFloat(String(collectedRow?.total ?? "0")),
    paidWithdrawals: Number(paidRow?.cnt ?? 0),
    paidAmount: parseFloat(String(paidRow?.total ?? "0")),
    pendingWithdrawals: Number(pendingRow?.cnt ?? 0),
    pendingAmount: parseFloat(String(pendingRow?.total ?? "0")),
  });
});

// GET /api/vendor/tickets — list tickets assigned to the logged-in vendor
router.get("/vendor/tickets", async (req, res): Promise<void> => {
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

  const vid = vendorUser.vendorId;
  const filter = String(req.query["filter"] ?? "all");

  const baseWhere = eq(ticketsTable.vendorId, vid);
  const whereClause =
    filter === "available" ? and(baseWhere, isNull(ticketsTable.registeredAt)) :
    filter === "scratched" ? and(baseWhere, isNotNull(ticketsTable.registeredAt)) :
    filter === "winners"   ? and(baseWhere, isNotNull(ticketsTable.registeredAt), eq(ticketsTable.isWinner, true)) :
    baseWhere;

  // True totals (used for summary cards — independent of pagination)
  const [cntAvailable] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNull(ticketsTable.registeredAt)));

  const [cntScratched] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNotNull(ticketsTable.registeredAt)));

  const [cntWinners] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.vendorId, vid), isNotNull(ticketsTable.registeredAt), eq(ticketsTable.isWinner, true)));

  const rows = await db
    .select({
      id: ticketsTable.id,
      code: ticketsTable.code,
      series: ticketsTable.series,
      price: ticketsTable.price,
      isWinner: ticketsTable.isWinner,
      prizeAmount: ticketsTable.prizeAmount,
      registeredAt: ticketsTable.registeredAt,
      createdAt: ticketsTable.createdAt,
    })
    .from(ticketsTable)
    .where(whereClause)
    .orderBy(desc(ticketsTable.registeredAt), desc(ticketsTable.createdAt))
    .limit(500);

  // Never reveal winner status before a customer has scratched the ticket
  const tickets = rows.map((t) => ({
    ...t,
    isWinner:    t.registeredAt ? t.isWinner    : false,
    prizeAmount: t.registeredAt ? t.prizeAmount : null,
  }));

  res.json({
    tickets,
    totalAvailable: Number(cntAvailable?.cnt ?? 0),
    totalScratched: Number(cntScratched?.cnt ?? 0),
    totalWinners:   Number(cntWinners?.cnt   ?? 0),
  });
});

// GET /api/vendor/rapport — list of clients this vendor has paid withdrawals to
router.get("/vendor/rapport", async (req, res): Promise<void> => {
  const vendorUserId = req.session.userId;
  if (!vendorUserId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const [vendorUser] = await db.select({ vendorId: usersTable.vendorId }).from(usersTable).where(eq(usersTable.id, vendorUserId)).limit(1);
  if (!vendorUser?.vendorId) { res.status(403).json({ error: "Accès vendeur requis" }); return; }

  const vid = vendorUser.vendorId;

  const paid = await db
    .select()
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.paidByVendorId, vid), eq(withdrawalsTable.status, "paid")))
    .orderBy(desc(withdrawalsTable.paidAt));

  // Group by clerkId
  const map = new Map<string, { name: string; withdrawals: typeof paid; totalPaid: number; lastPaidAt: string | null }>();
  for (const w of paid) {
    const entry = map.get(w.clerkId) ?? { name: w.clerkName, withdrawals: [], totalPaid: 0, lastPaidAt: null };
    entry.withdrawals.push(w);
    entry.totalPaid += parseFloat(w.amount);
    if (w.paidAt && (!entry.lastPaidAt || w.paidAt > new Date(entry.lastPaidAt))) {
      entry.lastPaidAt = w.paidAt.toISOString();
    }
    map.set(w.clerkId, entry);
  }

  const clients = Array.from(map.entries()).map(([clerkId, e]) => ({
    clerkId,
    name: e.name,
    totalWithdrawals: e.withdrawals.length,
    totalPaid: e.totalPaid,
    lastPaidAt: e.lastPaidAt,
  }));

  res.json(clients);
});

// GET /api/vendor/rapport/:clerkId — withdrawal history for one client (paid by this vendor)
router.get("/vendor/rapport/:clerkId", async (req, res): Promise<void> => {
  const vendorUserId = req.session.userId;
  if (!vendorUserId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const [vendorUser] = await db.select({ vendorId: usersTable.vendorId }).from(usersTable).where(eq(usersTable.id, vendorUserId)).limit(1);
  if (!vendorUser?.vendorId) { res.status(403).json({ error: "Accès vendeur requis" }); return; }

  const clerkId = String(req.params["clerkId"] ?? "");
  if (!clerkId) { res.status(400).json({ error: "clerkId requis" }); return; }

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.paidByVendorId, vendorUser.vendorId)))
    .orderBy(desc(withdrawalsTable.createdAt));

  const name = withdrawals[0]?.clerkName ?? clerkId;
  res.json({ clerkId, name, withdrawals });
});

// POST /api/vendor/receive-tickets — acknowledge all pending tickets as received
router.post("/vendor/receive-tickets", async (req, res): Promise<void> => {
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

  const vid = vendorUser.vendorId;

  const updated = await db
    .update(ticketsTable)
    .set({ receivedByVendorAt: sql`now()` })
    .where(and(eq(ticketsTable.vendorId, vid), isNull(ticketsTable.receivedByVendorAt)))
    .returning({ id: ticketsTable.id });

  res.json({ received: updated.length });
});

export default router;
