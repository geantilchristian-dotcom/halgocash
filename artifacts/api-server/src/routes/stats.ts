import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, vendorsTable } from "@workspace/db";
import { eq, count, sum, isNotNull, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
  // Tickets grattés = activés (registeredAt IS NOT NULL)
  const [scratchedRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(isNotNull(ticketsTable.registeredAt));

  // Tickets disponibles (pas encore grattés)
  const [availableRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(eq(ticketsTable.status, "available"));

  // Revenus = somme des prix des tickets grattés
  const [revenueRow] = await db
    .select({ total: sum(ticketsTable.price) })
    .from(ticketsTable)
    .where(isNotNull(ticketsTable.registeredAt));

  // Prix distribués = somme des gains des tickets gagnants grattés
  const [prizesRow] = await db
    .select({ total: sum(ticketsTable.prizeAmount) })
    .from(ticketsTable)
    .where(
      and(
        isNotNull(ticketsTable.registeredAt),
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.prizeAmount),
      ),
    );

  // Gagnants = tickets gagnants grattés
  const [winnersRow] = await db
    .select({ cnt: count() })
    .from(ticketsTable)
    .where(
      and(
        isNotNull(ticketsTable.registeredAt),
        eq(ticketsTable.isWinner, true),
      ),
    );

  // Vendeurs actifs
  const [activeVendorsRow] = await db
    .select({ cnt: count() })
    .from(vendorsTable)
    .where(eq(vendorsTable.status, "active"));

  res.json({
    totalTicketsSold: Number(scratchedRow?.cnt ?? 0),
    totalAvailable: Number(availableRow?.cnt ?? 0),
    totalRevenue: parseFloat(String(revenueRow?.total ?? "0")),
    totalPrizesPaid: parseFloat(String(prizesRow?.total ?? "0")),
    activeVendors: Number(activeVendorsRow?.cnt ?? 0),
    recentWinners: Number(winnersRow?.cnt ?? 0),
    activeDraw: null,
    completedDraws: 0,
  });
});

router.get("/winners", async (req, res) => {
  const limit = parseInt(req.query["limit"] as string ?? "10");

  const claimed = await db.select().from(ticketsTable)
    .where(eq(ticketsTable.status, "claimed"))
    .orderBy(desc(ticketsTable.claimedAt))
    .limit(limit);

  const results = await Promise.all(claimed.map(async (t) => {
    let vendorName: string | null = null;
    if (t.vendorId) {
      const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, t.vendorId)).limit(1);
      vendorName = v?.name ?? null;
    }
    let drawNumber = 0;
    if (t.drawId) {
      const [d] = await db.select().from(drawsTable).where(eq(drawsTable.id, t.drawId)).limit(1);
      drawNumber = d?.drawNumber ?? 0;
    }
    const code = t.code;
    const masked = code.slice(0, 3) + "***" + code.slice(-3);
    return {
      id: t.id,
      ticketCode: code,
      maskedCode: masked,
      prizeAmount: parseFloat(t.prizeAmount ?? "0"),
      drawNumber,
      vendorName,
      claimedAt: t.claimedAt!.toISOString(),
    };
  }));

  res.json(results);
});

export default router;
