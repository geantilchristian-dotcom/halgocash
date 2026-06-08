import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";

const router: IRouter = Router();

router.get("/bookings/summary", async (_req, res) => {
  const [totalResult] = await db.select({ total: count() }).from(ticketsTable).where(eq(ticketsTable.status, "sold"));
  const [revenueResult] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable);

  res.json({
    totalBookings: totalResult?.total ?? 0,
    totalRevenue: parseFloat(revenueResult?.total ?? "0"),
  });
});

export default router;
