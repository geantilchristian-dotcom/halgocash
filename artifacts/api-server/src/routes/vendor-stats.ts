import { Router, type IRouter } from "express";
import { eq, count, sum, isNotNull, isNull, and } from "drizzle-orm";
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
