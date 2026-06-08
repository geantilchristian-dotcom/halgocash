import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  const code = req.query["code"] as string | undefined;

  const query = db.select().from(transactionsTable).orderBy(desc(transactionsTable.date)).limit(20);
  const transactions = code
    ? await db.select().from(transactionsTable).where(eq(transactionsTable.accountCode, code)).orderBy(desc(transactionsTable.date)).limit(20)
    : await query;

  res.json(transactions.map(t => ({
    id: t.id,
    type: t.type,
    amount: parseFloat(t.amount),
    date: t.date.toISOString(),
    description: t.description,
    iconType: t.iconType,
  })));
});

export default router;
