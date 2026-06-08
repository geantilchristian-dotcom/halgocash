import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ticketsTable, vendorsTable, drawsTable, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ValidateTicketBody, ClaimPrizeBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function formatTicket(t: typeof ticketsTable.$inferSelect) {
  let vendorName: string | null = null;
  let drawNumber: number | null = null;

  if (t.vendorId) {
    const [v] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, t.vendorId)).limit(1);
    vendorName = v?.name ?? null;
  }
  if (t.drawId) {
    const [d] = await db.select().from(drawsTable).where(eq(drawsTable.id, t.drawId)).limit(1);
    drawNumber = d?.drawNumber ?? null;
  }

  return {
    id: t.id,
    code: t.code,
    status: t.status,
    price: parseFloat(t.price),
    series: t.series,
    drawId: t.drawId ?? null,
    drawNumber,
    isWinner: t.isWinner,
    prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : null,
    vendorId: t.vendorId ?? null,
    vendorName,
    soldAt: t.soldAt?.toISOString() ?? null,
    validatedAt: t.validatedAt?.toISOString() ?? null,
    claimedAt: t.claimedAt?.toISOString() ?? null,
  };
}

router.get("/tickets", async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const limit = parseInt(req.query["limit"] as string ?? "50");

  const rows = status
    ? await db.select().from(ticketsTable).where(eq(ticketsTable.status, status)).limit(limit)
    : await db.select().from(ticketsTable).limit(limit);

  const results = await Promise.all(rows.map(formatTicket));
  res.json(results);
});

router.get("/tickets/:code", async (req, res) => {
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.code, req.params["code"]!)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  res.json(await formatTicket(ticket));
});

router.post("/tickets/:code/validate", async (req, res) => {
  const parsed = ValidateTicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.code, req.params["code"]!)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (ticket.status !== "available") { res.status(400).json({ error: `Ticket is already ${ticket.status}` }); return; }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, parsed.data.vendorId)).limit(1);
  if (!vendor) { res.status(400).json({ error: "Vendor not found" }); return; }

  // Assign to the active draw
  const [activeDraw] = await db.select().from(drawsTable).where(eq(drawsTable.status, "active")).limit(1);

  const [updated] = await db.update(ticketsTable).set({
    status: "validated",
    vendorId: parsed.data.vendorId,
    drawId: activeDraw?.id ?? null,
    validatedAt: new Date(),
    soldAt: new Date(),
  }).where(eq(ticketsTable.id, ticket.id)).returning();

  // Record transaction
  await db.insert(transactionsTable).values({
    type: "sale",
    ticketId: ticket.id,
    ticketCode: ticket.code,
    vendorId: parsed.data.vendorId,
    drawId: activeDraw?.id ?? null,
    amount: ticket.price,
    note: `Ticket sold by ${vendor.name}`,
  });

  // Update prize pool on active draw
  if (activeDraw) {
    const newPool = parseFloat(activeDraw.prizePool) + parseFloat(ticket.price);
    await db.update(drawsTable).set({ prizePool: newPool.toFixed(2) }).where(eq(drawsTable.id, activeDraw.id));
  }

  res.json(await formatTicket(updated!));
});

router.post("/tickets/:code/claim", async (req, res) => {
  const parsed = ClaimPrizeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.code, req.params["code"]!)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  if (!ticket.isWinner) { res.status(400).json({ error: "Ticket is not a winner" }); return; }
  if (ticket.claimedAt) { res.status(400).json({ error: "Prize already claimed" }); return; }

  const prize = parseFloat(ticket.prizeAmount ?? "0");
  const [updated] = await db.update(ticketsTable).set({
    status: "claimed",
    claimedAt: new Date(),
    vendorId: parsed.data.vendorId,
  }).where(eq(ticketsTable.id, ticket.id)).returning();

  await db.insert(transactionsTable).values({
    type: "prize_payout",
    ticketId: ticket.id,
    ticketCode: ticket.code,
    vendorId: parsed.data.vendorId,
    drawId: ticket.drawId ?? null,
    amount: (-prize).toFixed(2),
    note: `Prize paid out`,
  });

  res.json({
    ticket: await formatTicket(updated!),
    prizeAmount: prize,
    message: `Congratulations! Prize of $${prize.toFixed(2)} has been paid out.`,
  });
});

export default router;
