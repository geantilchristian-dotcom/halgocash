import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { vendorsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import { CreateVendorBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function formatVendor(v: typeof vendorsTable.$inferSelect) {
  const [salesRow] = await db.select({ cnt: count() }).from(transactionsTable)
    .where(eq(transactionsTable.vendorId, v.id));
  const [revenueRow] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable)
    .where(eq(transactionsTable.vendorId, v.id));

  return {
    id: v.id,
    name: v.name,
    location: v.location,
    phone: v.phone ?? null,
    status: v.status,
    totalSales: Number(salesRow?.cnt ?? 0),
    totalRevenue: parseFloat(revenueRow?.total ?? "0"),
  };
}

router.get("/vendors", async (_req, res) => {
  const vendors = await db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const results = await Promise.all(vendors.map(formatVendor));
  res.json(results);
});

router.post("/vendors", async (req, res) => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [vendor] = await db.insert(vendorsTable).values({
    name: parsed.data.name,
    location: parsed.data.location,
    phone: parsed.data.phone ?? null,
    status: "active",
  }).returning();

  res.status(201).json(await formatVendor(vendor!));
});

export default router;
