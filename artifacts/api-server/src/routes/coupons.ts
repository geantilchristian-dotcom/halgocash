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

// POST /api/tickets/activate — reveal a ticket result and link to user
router.post("/tickets/activate", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  const { code } = req.body as { code?: string };

  if (!code || typeof code !== "string" || code.trim().length === 0) {
    res.status(400).json({ error: "Code requis" });
    return;
  }

  const trimmed = code.trim().toUpperCase();

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.code, trimmed))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Code introuvable — vérifiez les caractères" });
    return;
  }

  // Helper: build prize label
  const amount = ticket.prizeAmount ? parseFloat(ticket.prizeAmount) : 0;
  let prizeLabel = "Perdu";
  if (ticket.isWinner) {
    if (amount >= 50000)      prizeLabel = "Super Gagnant";
    else if (amount >= 25000) prizeLabel = "Très Grand Gagnant";
    else if (amount >= 10000) prizeLabel = "Grand Gagnant";
    else if (amount >= 5000)  prizeLabel = "Gagnant";
    else                      prizeLabel = "Petit Gagnant — Remboursé";
  }

  // Already activated — block completely and reveal result
  if (ticket.registeredAt) {
    const msg = ticket.isWinner
      ? `Ce ticket a déjà été gratté — Résultat : ${prizeLabel} (${amount.toLocaleString("fr-FR")} FC). Il ne peut plus être utilisé.`
      : "Ce ticket a déjà été gratté — Résultat : Perdant. Il ne peut plus être utilisé.";
    res.status(409).json({
      error: msg,
      alreadyUsed: true,
      isWinner: ticket.isWinner,
      prizeLabel,
      prizeAmount: ticket.isWinner ? amount : null,
    });
    return;
  }

  // Link to current user if logged in and not yet linked
  if (userId) {
    await db
      .update(ticketsTable)
      .set({ registeredByClerkId: userId, registeredAt: new Date() })
      .where(eq(ticketsTable.id, ticket.id));
  }

  res.json({
    code: ticket.code,
    series: ticket.series,
    isWinner: ticket.isWinner,
    prizeAmount: ticket.isWinner ? amount : null,
    prizeLabel,
    alreadyActivated: false,
  });
});

export default router;
