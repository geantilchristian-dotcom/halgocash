import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { drawsTable, ticketsTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { CreateDrawBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatDraw(d: typeof drawsTable.$inferSelect, ticketCount = 0) {
  return {
    id: d.id,
    drawNumber: d.drawNumber,
    status: d.status,
    jackpotAmount: parseFloat(d.jackpotAmount),
    prizePool: parseFloat(d.prizePool),
    winningTicketCode: d.winningTicketCode ?? null,
    winningNumbers: d.winningNumbers ?? null,
    scheduledAt: d.scheduledAt.toISOString(),
    drawnAt: d.drawnAt?.toISOString() ?? null,
    totalTicketsSold: ticketCount,
  };
}

router.get("/draws", async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const limit = parseInt(req.query["limit"] as string ?? "20");

  const rows = status
    ? await db.select().from(drawsTable).where(eq(drawsTable.status, status)).orderBy(desc(drawsTable.scheduledAt)).limit(limit)
    : await db.select().from(drawsTable).orderBy(desc(drawsTable.scheduledAt)).limit(limit);

  const results = await Promise.all(rows.map(async (d) => {
    const [cnt] = await db.select({ count: count() }).from(ticketsTable).where(
      and(eq(ticketsTable.drawId, d.id), eq(ticketsTable.status, "validated"))
    );
    return formatDraw(d, Number(cnt?.count ?? 0));
  }));

  res.json(results);
});

router.get("/draws/latest", async (_req, res) => {
  const [draw] = await db.select().from(drawsTable).where(eq(drawsTable.status, "completed")).orderBy(desc(drawsTable.drawnAt)).limit(1);
  if (!draw) { res.status(404).json({ error: "No completed draw found" }); return; }
  const [cnt] = await db.select({ count: count() }).from(ticketsTable).where(and(eq(ticketsTable.drawId, draw.id), eq(ticketsTable.status, "validated")));
  res.json(formatDraw(draw, Number(cnt?.count ?? 0)));
});

router.get("/draws/:id", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [draw] = await db.select().from(drawsTable).where(eq(drawsTable.id, id)).limit(1);
  if (!draw) { res.status(404).json({ error: "Draw not found" }); return; }
  const [cnt] = await db.select({ count: count() }).from(ticketsTable).where(and(eq(ticketsTable.drawId, draw.id), eq(ticketsTable.status, "validated")));
  res.json(formatDraw(draw, Number(cnt?.count ?? 0)));
});

router.post("/draws", async (req, res) => {
  const parsed = CreateDrawBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const [maxRow] = await db.select({ max: drawsTable.drawNumber }).from(drawsTable).orderBy(desc(drawsTable.drawNumber)).limit(1);
  const nextNum = (maxRow?.max ?? 0) + 1;

  const [draw] = await db.insert(drawsTable).values({
    drawNumber: nextNum,
    jackpotAmount: parsed.data.jackpotAmount.toFixed(2),
    scheduledAt: new Date(parsed.data.scheduledAt),
    status: "upcoming",
  }).returning();

  res.status(201).json(formatDraw(draw!));
});

router.post("/draws/:id/run", async (req, res) => {
  const id = parseInt(req.params["id"]!);
  const [draw] = await db.select().from(drawsTable).where(eq(drawsTable.id, id)).limit(1);

  if (!draw) { res.status(404).json({ error: "Draw not found" }); return; }
  if (draw.status === "completed") { res.status(400).json({ error: "Draw already completed" }); return; }

  const soldTickets = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.drawId, id), eq(ticketsTable.status, "validated"))
  );

  if (!soldTickets.length) { res.status(400).json({ error: "No validated tickets for this draw" }); return; }

  const winner = soldTickets[Math.floor(Math.random() * soldTickets.length)]!;
  const prizePool = soldTickets.reduce((sum, t) => sum + parseFloat(t.price), 0);
  const jackpot = parseFloat(draw.jackpotAmount);
  const prize = Math.min(jackpot, prizePool * 0.7);

  // Mark winner
  await db.update(ticketsTable).set({ isWinner: true, prizeAmount: prize.toFixed(2), status: "sold" }).where(eq(ticketsTable.id, winner.id));

  // Update draw
  const [updated] = await db.update(drawsTable).set({
    status: "completed",
    winningTicketCode: winner.code,
    winningNumbers: [Math.floor(Math.random() * 49) + 1, Math.floor(Math.random() * 49) + 1, Math.floor(Math.random() * 49) + 1, Math.floor(Math.random() * 49) + 1, Math.floor(Math.random() * 49) + 1],
    drawnAt: new Date(),
    prizePool: prizePool.toFixed(2),
  }).where(eq(drawsTable.id, id)).returning();

  res.json(formatDraw(updated!, soldTickets.length));
});

export default router;
