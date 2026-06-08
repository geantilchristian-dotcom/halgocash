import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { drawsTable, ticketsTable, vendorsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum, desc, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (_req, res) => {
  const [ticketsSoldRow] = await db.select({ cnt: count() }).from(ticketsTable).where(eq(ticketsTable.status, "validated"));
  const [claimedRow] = await db.select({ cnt: count() }).from(ticketsTable).where(eq(ticketsTable.status, "claimed"));
  const [revenueRow] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable).where(eq(transactionsTable.type, "sale"));
  const [prizesRow] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable).where(eq(transactionsTable.type, "prize_payout"));
  const [completedRow] = await db.select({ cnt: count() }).from(drawsTable).where(eq(drawsTable.status, "completed"));
  const [activeVendorsRow] = await db.select({ cnt: count() }).from(vendorsTable).where(eq(vendorsTable.status, "active"));

  const [activeDraw] = await db.select().from(drawsTable).where(eq(drawsTable.status, "active")).limit(1);
  let activeDrawFormatted = null;
  if (activeDraw) {
    const [cnt] = await db.select({ count: count() }).from(ticketsTable).where(and(eq(ticketsTable.drawId, activeDraw.id), eq(ticketsTable.status, "validated")));
    activeDrawFormatted = {
      id: activeDraw.id,
      drawNumber: activeDraw.drawNumber,
      status: activeDraw.status,
      jackpotAmount: parseFloat(activeDraw.jackpotAmount),
      prizePool: parseFloat(activeDraw.prizePool),
      winningTicketCode: activeDraw.winningTicketCode ?? null,
      winningNumbers: activeDraw.winningNumbers ?? null,
      scheduledAt: activeDraw.scheduledAt.toISOString(),
      drawnAt: activeDraw.drawnAt?.toISOString() ?? null,
      totalTicketsSold: Number(cnt?.count ?? 0),
    };
  }

  res.json({
    totalTicketsSold: Number(ticketsSoldRow?.cnt ?? 0) + Number(claimedRow?.cnt ?? 0),
    totalRevenue: parseFloat(revenueRow?.total ?? "0"),
    totalPrizesPaid: Math.abs(parseFloat(prizesRow?.total ?? "0")),
    activeDraw: activeDrawFormatted,
    completedDraws: Number(completedRow?.cnt ?? 0),
    activeVendors: Number(activeVendorsRow?.cnt ?? 0),
    recentWinners: Number(claimedRow?.cnt ?? 0),
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
