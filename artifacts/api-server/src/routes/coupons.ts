import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, ticketsTable, drawsTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

function formatTicket(t: typeof ticketsTable.$inferSelect, drawNumber?: number | null) {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    price: parseFloat(t.price),
    series: t.series,
    drawId: t.drawId ?? null,
    drawNumber: drawNumber ?? null,
    isWinner: t.isWinner,
    prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : null,
    registeredAt: t.registeredAt?.toISOString() ?? null,
    soldAt: t.soldAt?.toISOString() ?? null,
  };
}

// GET /api/coupons — list registered tickets for current Clerk user
router.get("/coupons", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.registeredByClerkId, userId))
    .orderBy(desc(ticketsTable.registeredAt));

  const enriched = await Promise.all(
    tickets.map(async (t) => {
      let drawNumber: number | null = null;
      if (t.drawId) {
        const [draw] = await db
          .select({ drawNumber: drawsTable.drawNumber })
          .from(drawsTable)
          .where(eq(drawsTable.id, t.drawId))
          .limit(1);
        drawNumber = draw?.drawNumber ?? null;
      }
      return formatTicket(t, drawNumber);
    }),
  );

  res.json(enriched);
});

// POST /api/coupons/register — register a ticket code to current user
router.post("/coupons/register", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const { code } = req.body as { code: string };
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Code requis" });
    return;
  }

  const trimmed = code.trim();

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.code, trimmed))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Code de coupon introuvable" });
    return;
  }

  if (ticket.registeredByClerkId) {
    if (ticket.registeredByClerkId === userId) {
      res.status(400).json({ error: "Vous avez déjà enregistré ce coupon" });
    } else {
      res.status(400).json({ error: "Ce coupon a déjà été utilisé par quelqu'un d'autre" });
    }
    return;
  }

  await db
    .update(ticketsTable)
    .set({ registeredByClerkId: userId, registeredAt: new Date() })
    .where(eq(ticketsTable.id, ticket.id));

  let drawNumber: number | null = null;
  if (ticket.drawId) {
    const [draw] = await db
      .select({ drawNumber: drawsTable.drawNumber })
      .from(drawsTable)
      .where(eq(drawsTable.id, ticket.drawId))
      .limit(1);
    drawNumber = draw?.drawNumber ?? null;
  }

  res.status(201).json(formatTicket({ ...ticket, registeredByClerkId: userId, registeredAt: new Date() }, drawNumber));
});

export default router;
