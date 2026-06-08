import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CheckBalanceBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/balance/check", async (req, res) => {
  const parsed = CheckBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code } = parsed.data;
  const account = await db.select().from(accountsTable).where(eq(accountsTable.code, code)).limit(1);

  if (!account.length) {
    res.status(404).json({ error: "Code not found" });
    return;
  }

  const a = account[0]!;
  res.json({
    code: a.code,
    balance: parseFloat(a.balance),
    currency: a.currency,
    ownerName: a.ownerName,
  });
});

export default router;
