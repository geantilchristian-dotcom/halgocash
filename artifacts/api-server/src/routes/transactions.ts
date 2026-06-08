import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  req.log.info({ query: req.query }, "GET /transactions");

  const transactions = await db
    .select()
    .from(transactionsTable)
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);

  res.json(
    transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      date: t.createdAt.toISOString(),
      description: t.note ?? t.type,
      ticketCode: t.ticketCode,
    })),
  );
});

export default router;
