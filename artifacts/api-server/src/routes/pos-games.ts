import { Router, type Request, type Response } from "express";
import {
  db,
  usersTable,
  vendorsTable,
  maletteRoundsTable,
  maletteBetsTable,
  sportMatchesTable,
  sportBetsTable,
  posGameTicketsTable,
} from "@workspace/db";
import { eq, and, gte, asc, desc } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

function getSession(req: Request) {
  return req.session as typeof req.session & { userId?: number };
}

async function resolveVendorContext(req: Request) {
  const session = getSession(req);
  if (!session.userId) return null;
  const [user] = await db
    .select({ vendorId: usersTable.vendorId, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  if (!user?.vendorId) return null;
  const [vendor] = await db
    .select({ name: vendorsTable.name })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, user.vendorId))
    .limit(1);
  return {
    userId: session.userId,
    vendorId: user.vendorId,
    vendorName: vendor?.name ?? "Vendeur",
    username: user.username,
  };
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(): string {
  let code = "HG";
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = genCode();
    const [existing] = await db
      .select({ id: posGameTicketsTable.id })
      .from(posGameTicketsTable)
      .where(eq(posGameTicketsTable.ticketCode, code))
      .limit(1);
    if (!existing) return code;
  }
  return genCode();
}

// ── GET /api/vendor/pos-games/malette-round ──────────────────────────────────
router.get(
  "/vendor/pos-games/malette-round",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    let [round] = await db
      .select()
      .from(maletteRoundsTable)
      .where(eq(maletteRoundsTable.status, "betting"))
      .orderBy(desc(maletteRoundsTable.createdAt))
      .limit(1);

    if (!round || round.closesAt <= new Date()) {
      const closesAt = new Date(Date.now() + 60_000);
      const [created] = await db
        .insert(maletteRoundsTable)
        .values({ closesAt })
        .returning();
      if (!created) { res.status(500).json({ error: "Erreur serveur" }); return; }
      round = created;
    }

    res.json({
      roundId: round.id,
      closesAt: round.closesAt.toISOString(),
      timeLeft: Math.max(0, round.closesAt.getTime() - Date.now()),
    });
  },
);

// ── POST /api/vendor/pos-games/malette ───────────────────────────────────────
const MalettePOSBody = z.object({
  roundId:   z.number().int(),
  caseIndex: z.number().int().min(0).max(3),
  amountFc:  z.number().int().min(100),
  quantity:  z.number().int().min(1).max(20),
});

router.post(
  "/vendor/pos-games/malette",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    const parsed = MalettePOSBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const { roundId, caseIndex, amountFc, quantity } = parsed.data;

    const [round] = await db
      .select()
      .from(maletteRoundsTable)
      .where(and(eq(maletteRoundsTable.id, roundId), eq(maletteRoundsTable.status, "betting")))
      .limit(1);

    if (!round || round.closesAt <= new Date()) {
      res.status(400).json({ error: "Ce round est fermé, veuillez rafraîchir" });
      return;
    }

    const tickets: { ticketCode: string; caseIndex: number; amountFc: number; roundId: number }[] = [];

    for (let i = 0; i < quantity; i++) {
      const code = await uniqueCode();
      const clerkId = `pos:${code}`;

      await db.insert(maletteBetsTable).values({
        roundId,
        clerkId,
        caseIndex,
        amount: String(amountFc),
      });

      await db.insert(posGameTicketsTable).values({
        ticketCode:       code,
        vendorId:         ctx.vendorId,
        vendorUserId:     ctx.userId,
        gameType:         "malette",
        gameRefId:        roundId,
        selection:        { caseIndex },
        amountFc,
        potentialPayoutFc: Math.round(amountFc * 2.5),
        status:           "pending",
      });

      tickets.push({ ticketCode: code, caseIndex, amountFc, roundId });
    }

    req.log.info({ vendorId: ctx.vendorId, roundId, caseIndex, qty: quantity }, "POS malette tickets created");
    res.json({ ok: true, tickets });
  },
);

// ── GET /api/vendor/pos-games/sport-matches ───────────────────────────────────
router.get(
  "/vendor/pos-games/sport-matches",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    const matches = await db
      .select({
        id:              sportMatchesTable.id,
        fixtureId:       sportMatchesTable.fixtureId,
        competition:     sportMatchesTable.competition,
        competitionName: sportMatchesTable.competitionName,
        homeTeam:        sportMatchesTable.homeTeam,
        awayTeam:        sportMatchesTable.awayTeam,
        matchDate:       sportMatchesTable.matchDate,
        oddsHome:        sportMatchesTable.oddsHome,
        oddsDraw:        sportMatchesTable.oddsDraw,
        oddsAway:        sportMatchesTable.oddsAway,
      })
      .from(sportMatchesTable)
      .where(
        and(
          eq(sportMatchesTable.status, "SCHEDULED"),
          gte(sportMatchesTable.matchDate, new Date()),
        ),
      )
      .orderBy(asc(sportMatchesTable.matchDate))
      .limit(30);

    res.json(matches);
  },
);

// ── POST /api/vendor/pos-games/sport ─────────────────────────────────────────
const SportPOSBody = z.object({
  matchId:  z.number().int(),
  betType:  z.enum(["home", "draw", "away"]),
  amountFc: z.number().int().min(100),
  quantity: z.number().int().min(1).max(20),
});

router.post(
  "/vendor/pos-games/sport",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    const parsed = SportPOSBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
    const { matchId, betType, amountFc, quantity } = parsed.data;

    const [match] = await db
      .select()
      .from(sportMatchesTable)
      .where(
        and(
          eq(sportMatchesTable.id, matchId),
          eq(sportMatchesTable.status, "SCHEDULED"),
        ),
      )
      .limit(1);

    if (!match) {
      res.status(400).json({ error: "Match introuvable ou déjà clôturé" });
      return;
    }

    const oddsMap = {
      home: parseFloat(String(match.oddsHome)),
      draw: parseFloat(String(match.oddsDraw)),
      away: parseFloat(String(match.oddsAway)),
    };
    const odds = oddsMap[betType];
    const potentialPayoutFc = Math.round(amountFc * odds);

    const tickets: {
      ticketCode: string;
      betType: string;
      amountFc: number;
      odds: number;
      potentialPayoutFc: number;
    }[] = [];

    for (let i = 0; i < quantity; i++) {
      const code = await uniqueCode();
      const clerkId = `pos:${code}`;

      await db.insert(sportBetsTable).values({
        clerkId,
        matchId:      match.id,
        fixtureId:    match.fixtureId,
        homeTeam:     match.homeTeam,
        awayTeam:     match.awayTeam,
        matchDate:    match.matchDate,
        betType,
        amount:       String(amountFc),
        odds:         String(odds),
        potentialWin: String(potentialPayoutFc),
        status:       "pending",
      });

      await db.insert(posGameTicketsTable).values({
        ticketCode:       code,
        vendorId:         ctx.vendorId,
        vendorUserId:     ctx.userId,
        gameType:         "sport",
        gameRefId:        match.id,
        selection:        { betType, fixtureId: match.fixtureId },
        homeTeam:         match.homeTeam,
        awayTeam:         match.awayTeam,
        matchDate:        match.matchDate,
        amountFc,
        potentialPayoutFc,
        status:           "pending",
      });

      tickets.push({ ticketCode: code, betType, amountFc, odds, potentialPayoutFc });
    }

    req.log.info({ vendorId: ctx.vendorId, matchId, betType, qty: quantity }, "POS sport tickets created");
    res.json({ ok: true, tickets });
  },
);

// ── GET /api/vendor/pos-games/ticket/:code ────────────────────────────────────
router.get(
  "/vendor/pos-games/ticket/:code",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    const raw = req.params["code"];
    const code = (Array.isArray(raw) ? raw[0] : raw ?? "").toUpperCase();
    const [ticket] = await db
      .select()
      .from(posGameTicketsTable)
      .where(
        and(
          eq(posGameTicketsTable.ticketCode, code),
          eq(posGameTicketsTable.vendorId, ctx.vendorId),
        ),
      )
      .limit(1);

    if (!ticket) { res.status(404).json({ error: "Ticket introuvable" }); return; }

    let status = ticket.status;
    let actualPayoutFc = ticket.actualPayoutFc;

    if (status === "pending") {
      if (ticket.gameType === "malette" && ticket.gameRefId) {
        const [bet] = await db
          .select({ payout: maletteBetsTable.payout })
          .from(maletteBetsTable)
          .where(
            and(
              eq(maletteBetsTable.roundId, ticket.gameRefId),
              eq(maletteBetsTable.clerkId, `pos:${code}`),
            ),
          )
          .limit(1);

        if (bet?.payout != null) {
          const payout = Math.round(parseFloat(String(bet.payout)));
          status = payout > 0 ? "won" : "lost";
          actualPayoutFc = payout;
          await db
            .update(posGameTicketsTable)
            .set({ status, actualPayoutFc: payout, settledAt: new Date() })
            .where(eq(posGameTicketsTable.ticketCode, code));
        }
      } else if (ticket.gameType === "sport") {
        const [bet] = await db
          .select({ status: sportBetsTable.status, potentialWin: sportBetsTable.potentialWin })
          .from(sportBetsTable)
          .where(eq(sportBetsTable.clerkId, `pos:${code}`))
          .limit(1);

        if (bet && bet.status !== "pending") {
          const payout = bet.status === "won"
            ? Math.round(parseFloat(String(bet.potentialWin)))
            : 0;
          status = bet.status === "won" ? "won" : "lost";
          actualPayoutFc = payout;
          await db
            .update(posGameTicketsTable)
            .set({ status, actualPayoutFc: payout, settledAt: new Date() })
            .where(eq(posGameTicketsTable.ticketCode, code));
        }
      }
    }

    res.json({
      ticketCode:       ticket.ticketCode,
      gameType:         ticket.gameType,
      gameRefId:        ticket.gameRefId,
      selection:        ticket.selection,
      homeTeam:         ticket.homeTeam,
      awayTeam:         ticket.awayTeam,
      matchDate:        ticket.matchDate,
      amountFc:         ticket.amountFc,
      potentialPayoutFc: ticket.potentialPayoutFc,
      status,
      actualPayoutFc,
      createdAt:        ticket.createdAt,
      paidAt:           ticket.paidAt,
    });
  },
);

// ── POST /api/vendor/pos-games/ticket/:code/pay ───────────────────────────────
router.post(
  "/vendor/pos-games/ticket/:code/pay",
  async (req: Request, res: Response): Promise<void> => {
    const ctx = await resolveVendorContext(req);
    if (!ctx) { res.status(401).json({ error: "Non authentifié" }); return; }

    const rawPay = req.params["code"];
    const code = (Array.isArray(rawPay) ? rawPay[0] : rawPay ?? "").toUpperCase();
    const [ticket] = await db
      .select()
      .from(posGameTicketsTable)
      .where(
        and(
          eq(posGameTicketsTable.ticketCode, code),
          eq(posGameTicketsTable.vendorId, ctx.vendorId),
        ),
      )
      .limit(1);

    if (!ticket) { res.status(404).json({ error: "Ticket introuvable" }); return; }
    if (ticket.status !== "won") {
      res.status(400).json({ error: "Ce ticket n'est pas gagnant" });
      return;
    }
    if (ticket.paidAt) {
      res.status(400).json({ error: "Ticket déjà payé" });
      return;
    }

    await db
      .update(posGameTicketsTable)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(posGameTicketsTable.ticketCode, code));

    req.log.info(
      { ticketCode: code, vendorId: ctx.vendorId, amount: ticket.actualPayoutFc },
      "POS game ticket paid out",
    );
    res.json({ ok: true, paidAmount: ticket.actualPayoutFc });
  },
);

export default router;
