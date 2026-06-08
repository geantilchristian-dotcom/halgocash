import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { bookingsTable, destinationsTable, transactionsTable, accountsTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import { CreateBookingBody } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/bookings", async (req, res) => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { code, destinationId, quantity, ticketType } = parsed.data;

  const dest = await db.select().from(destinationsTable).where(eq(destinationsTable.id, destinationId)).limit(1);
  if (!dest.length) {
    res.status(400).json({ error: "Destination not found" });
    return;
  }

  const destination = dest[0]!;
  const totalAmount = parseFloat(destination.price) * quantity;

  const [booking] = await db.insert(bookingsTable).values({
    accountCode: code,
    destinationId,
    quantity,
    ticketType,
    totalAmount: totalAmount.toFixed(2),
    status: "confirmed",
  }).returning();

  await db.insert(transactionsTable).values({
    accountCode: code,
    type: "Ticket Booking",
    amount: (-totalAmount).toFixed(2),
    description: `${destination.name} x${quantity}`,
    iconType: "ticket",
    date: new Date(),
  });

  if (code) {
    await db.update(accountsTable)
      .set({ balance: sql`balance - ${totalAmount.toFixed(2)}` })
      .where(eq(accountsTable.code, code));
  }

  res.status(201).json({
    id: booking!.id,
    destinationId: booking!.destinationId,
    destinationName: destination.name,
    quantity: booking!.quantity,
    ticketType: booking!.ticketType,
    totalAmount: parseFloat(booking!.totalAmount),
    status: booking!.status,
    createdAt: booking!.createdAt.toISOString(),
  });
});

router.get("/bookings/summary", async (_req, res) => {
  const [totalResult] = await db.select({ total: count() }).from(bookingsTable);
  const [revenueResult] = await db.select({ total: sum(bookingsTable.totalAmount) }).from(bookingsTable);

  const popularResult = await db
    .select({ destinationId: bookingsTable.destinationId, cnt: count() })
    .from(bookingsTable)
    .groupBy(bookingsTable.destinationId)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  let popularDestination: string | null = null;
  if (popularResult.length) {
    const dest = await db.select().from(destinationsTable).where(eq(destinationsTable.id, popularResult[0]!.destinationId)).limit(1);
    popularDestination = dest.length ? dest[0]!.name : null;
  }

  res.json({
    totalBookings: totalResult?.total ?? 0,
    totalRevenue: parseFloat(revenueResult?.total ?? "0"),
    popularDestination,
  });
});

export default router;
