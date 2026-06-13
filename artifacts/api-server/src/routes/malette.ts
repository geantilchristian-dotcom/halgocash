import { Router, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  creditAdjustmentsTable,
  withdrawalsTable,
  maletteRoundsTable,
  maletteBetsTable,
  type MaletteBet,
} from "@workspace/db";
import { eq, and, sum, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

// ── Constantes ────────────────────────────────────────────────────────────────
const N_CASES           = 4;
const MULT_POOL         = [0, 0, 1.1, 2.5];  // pool pour 4 malettes
const ROUND_DURATION_MS = 60_000;             // fenêtre de paris : 60 secondes
const RISK_THRESHOLD    = 0.40;               // ratio de concentration → protection caisse

// ── Helpers auth / balance ────────────────────────────────────────────────────
function resolveClerkId(req: Request): string | null {
  const { userId } = getAuth(req);
  return userId ?? null;
}

async function getBalance(clerkId: string): Promise<number> {
  const [[credRow], [paidRow], [pendRow]] = await Promise.all([
    db.select({ t: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, clerkId)),
    db.select({ t: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "paid"))),
    db.select({ t: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "pending"))),
  ]);
  const credits = credRow?.t ? parseFloat(String(credRow.t)) : 0;
  const paid    = paidRow?.t ? parseFloat(String(paidRow.t)) : 0;
  const pending = pendRow?.t ? parseFloat(String(pendRow.t)) : 0;
  return Math.max(0, credits - paid - pending);
}

// ── Mélange cryptographique (Fisher-Yates + crypto.getRandomValues) ───────────
function cryptoShuffle<T>(arr: T[]): T[] {
  const a   = [...arr];
  const buf = new Uint32Array(a.length);
  crypto.getRandomValues(buf);
  for (let i = a.length - 1; i > 0; i--) {
    const j = buf[i]! % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ── Assignation des multiplicateurs (gestion du risque) ───────────────────────
//
// Scénario 1 — mises équilibrées (ratio max ≤ RISK_THRESHOLD) :
//   Le risque est faible et bien réparti → hasard pur (crypto.getRandomValues)
//
// Scénario risky — une malette concentre > 40 % des mises :
//   Cette malette est forcée à ×0 pour protéger la caisse.
//   Les 3 autres multiplicateurs sont redistribués aléatoirement.
//
function assignMultipliers(betsPerCase: number[]): number[] {
  const total = betsPerCase.reduce((a, b) => a + b, 0);
  if (total === 0) return cryptoShuffle([...MULT_POOL]);

  const maxBets = Math.max(...betsPerCase);
  const hotIdx  = betsPerCase.indexOf(maxBets);
  const ratio   = maxBets / total;

  if (ratio <= RISK_THRESHOLD) {
    // Mises bien réparties → hasard pur
    return cryptoShuffle([...MULT_POOL]);
  }

  // Case "chaude" → forcer ×0, redistribuer le reste
  const pool = [...MULT_POOL] as number[];
  pool.splice(pool.indexOf(0), 1);          // retire un ×0 pour la case chaude
  const rest   = cryptoShuffle(pool);
  const result = new Array<number>(N_CASES).fill(0);
  result[hotIdx] = 0;
  let ri = 0;
  for (let i = 0; i < N_CASES; i++) {
    if (i !== hotIdx) result[i] = rest[ri++]!;
  }
  return result;
}

// ── Utilitaire : total des mises par case ─────────────────────────────────────
function buildBetsPerCase(bets: MaletteBet[]): number[] {
  const arr = Array<number>(N_CASES).fill(0);
  for (const b of bets) {
    arr[b.caseIndex] = (arr[b.caseIndex] ?? 0) + parseFloat(String(b.amount));
  }
  return arr;
}

// ── Payload pour un round fermé ───────────────────────────────────────────────
function buildClosedPayload(
  round: typeof maletteRoundsTable.$inferSelect,
  myBetRows: MaletteBet[],
) {
  const myBets = myBetRows.map(b => ({
    caseIndex:  b.caseIndex,
    amount:     parseFloat(String(b.amount)),
    multiplier: b.multiplier != null ? parseFloat(String(b.multiplier)) : null,
    payout:     b.payout     != null ? parseFloat(String(b.payout))     : null,
  }));
  return {
    roundId:        round.id,
    status:         "closed" as const,
    multipliers:    round.multipliers  as number[] | null,
    betsPerCase:    round.betsPerCase  as number[] | null,
    totalCollected: parseFloat(String(round.totalCollected ?? 0)),
    totalPaid:      parseFloat(String(round.totalPaid      ?? 0)),
    closedAt:       round.closedAt?.toISOString() ?? null,
    myBets,
    // Compatibilité : premier ticket (ancien champ)
    myBet: myBets[0] ?? null,
  };
}

// ── Scheduler : fermeture automatique des rounds expirés ─────────────────────
async function processExpiredRounds(): Promise<void> {
  const expired = await db
    .select()
    .from(maletteRoundsTable)
    .where(and(
      eq(maletteRoundsTable.status, "betting"),
      sql`${maletteRoundsTable.closesAt} <= NOW()`,
    ));

  for (const round of expired) {
    try {
      const bets        = await db.select().from(maletteBetsTable).where(eq(maletteBetsTable.roundId, round.id));
      const betsPerCase = buildBetsPerCase(bets);
      const mults       = assignMultipliers(betsPerCase);
      const totalCollected = betsPerCase.reduce((a, b) => a + b, 0);
      let   totalPaid   = 0;

      // Créditer chaque gagnant (mises × multiplicateur)
      for (const bet of bets) {
        const mult   = mults[bet.caseIndex] ?? 0;
        const payout = Math.round(parseFloat(String(bet.amount)) * mult);
        totalPaid   += payout;

        await db.update(maletteBetsTable)
          .set({ multiplier: String(mult), payout: String(payout) })
          .where(eq(maletteBetsTable.id, bet.id));

        if (payout > 0 && !bet.clerkId.startsWith("pos:")) {
          await db.insert(creditAdjustmentsTable).values({
            clerkId: bet.clerkId,
            amount:  String(payout),
            reason:  "malette_win",
            refId:   String(round.id),
          });
        }
      }

      await db.update(maletteRoundsTable)
        .set({
          status:         "closed",
          multipliers:    mults,
          betsPerCase,
          totalCollected: String(totalCollected),
          totalPaid:      String(totalPaid),
          closedAt:       new Date(),
        })
        .where(eq(maletteRoundsTable.id, round.id));

      logger.info(
        { roundId: round.id, totalCollected, totalPaid, profit: totalCollected - totalPaid, mults },
        "Malette round closed",
      );
    } catch (err) {
      logger.error({ err, roundId: round.id }, "Failed to close malette round");
    }
  }
}

let _schedulerStarted = false;
export function startMaletteScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;
  setInterval(() => { void processExpiredRounds(); }, 5_000);
  logger.info("Malette round scheduler started (check every 5s)");
}

// ── GET /api/malette/round/current ────────────────────────────────────────────
router.get("/malette/round/current", async (req, res): Promise<void> => {
  const clerkId = resolveClerkId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  // 1. Chercher un round ouvert
  let [round] = await db
    .select()
    .from(maletteRoundsTable)
    .where(eq(maletteRoundsTable.status, "betting"))
    .orderBy(desc(maletteRoundsTable.createdAt))
    .limit(1);

  if (!round) {
    // 2. Round fermé récemment (≤ 15s) → afficher les résultats
    const [recent] = await db
      .select()
      .from(maletteRoundsTable)
      .where(and(
        eq(maletteRoundsTable.status, "closed"),
        sql`${maletteRoundsTable.closedAt} >= NOW() - INTERVAL '15 seconds'`,
      ))
      .orderBy(desc(maletteRoundsTable.closedAt))
      .limit(1);

    if (recent) {
      const myBetRows = await db.select().from(maletteBetsTable)
        .where(and(eq(maletteBetsTable.roundId, recent.id), eq(maletteBetsTable.clerkId, clerkId)));
      res.json(buildClosedPayload(recent, myBetRows));
      return;
    }

    // 3. Aucun round actif → créer automatiquement
    const closesAt = new Date(Date.now() + ROUND_DURATION_MS);
    [round] = await db.insert(maletteRoundsTable).values({ closesAt }).returning();
  }

  if (!round) { res.status(500).json({ error: "Erreur serveur" }); return; }

  const bets        = await db.select().from(maletteBetsTable).where(eq(maletteBetsTable.roundId, round.id));
  const betsPerCase = buildBetsPerCase(bets);
  const myBetRows   = bets.filter(b => b.clerkId === clerkId);
  const myBets      = myBetRows.map(b => ({ caseIndex: b.caseIndex, amount: parseFloat(String(b.amount)) }));
  const timeLeft    = Math.max(0, round.closesAt.getTime() - Date.now());

  res.json({
    roundId:    round.id,
    status:     "betting" as const,
    betsPerCase,
    timeLeft,
    closesAt:   round.closesAt.toISOString(),
    myBets,
    myBet:      myBets[0] ?? null,
  });
});

// ── POST /api/malette/bet ─────────────────────────────────────────────────────
const BetBody = z.object({
  roundId:   z.number().int(),
  caseIndex: z.number().int().min(0).max(N_CASES - 1),
  amount:    z.number().int().min(100).max(10_000_000),
});

router.post("/malette/bet", async (req, res): Promise<void> => {
  const clerkId = resolveClerkId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = BetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { roundId, caseIndex, amount } = parsed.data;

  // Vérifier que le round est ouvert et non expiré
  const [round] = await db.select().from(maletteRoundsTable)
    .where(and(eq(maletteRoundsTable.id, roundId), eq(maletteRoundsTable.status, "betting")))
    .limit(1);
  if (!round || round.closesAt <= new Date()) {
    res.status(400).json({ error: "Ce round est fermé" }); return;
  }
  // Les paris se ferment automatiquement 2 secondes avant la clôture
  if (round.closesAt.getTime() - Date.now() < 2_000) {
    res.status(400).json({ error: "Tirage imminent — les paris sont fermés" }); return;
  }

  // Vérification du solde
  const balance = await getBalance(clerkId);
  if (balance < amount) { res.status(400).json({ error: "Solde insuffisant" }); return; }

  // Débiter la mise
  await db.insert(creditAdjustmentsTable).values({
    clerkId, amount: String(-amount), reason: "malette_bet", refId: String(roundId),
  });

  // Enregistrer le pari
  await db.insert(maletteBetsTable).values({ roundId, clerkId, caseIndex, amount: String(amount) });

  res.json({ ok: true });
});

// ── GET /api/malette/round/:id ────────────────────────────────────────────────
router.get("/malette/round/:id", async (req, res): Promise<void> => {
  const clerkId = resolveClerkId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const roundId = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(roundId)) { res.status(400).json({ error: "roundId invalide" }); return; }

  const [round] = await db.select().from(maletteRoundsTable).where(eq(maletteRoundsTable.id, roundId)).limit(1);
  if (!round) { res.status(404).json({ error: "Round introuvable" }); return; }

  if (round.status === "closed") {
    const myBetRows = await db.select().from(maletteBetsTable)
      .where(and(eq(maletteBetsTable.roundId, roundId), eq(maletteBetsTable.clerkId, clerkId)));
    res.json(buildClosedPayload(round, myBetRows));
    return;
  }

  const [bets, myBetRows] = await Promise.all([
    db.select().from(maletteBetsTable).where(eq(maletteBetsTable.roundId, roundId)),
    db.select().from(maletteBetsTable)
      .where(and(eq(maletteBetsTable.roundId, roundId), eq(maletteBetsTable.clerkId, clerkId))),
  ]);
  const myBets = myBetRows.map(b => ({ caseIndex: b.caseIndex, amount: parseFloat(String(b.amount)) }));
  res.json({
    roundId:     round.id,
    status:      "betting" as const,
    betsPerCase: buildBetsPerCase(bets),
    timeLeft:    Math.max(0, round.closesAt.getTime() - Date.now()),
    closesAt:    round.closesAt.toISOString(),
    myBets,
    myBet:       myBets[0] ?? null,
  });
});

// ── GET /api/malette/history — 20 derniers rounds fermés ─────────────────────
router.get("/malette/history", async (_req, res): Promise<void> => {
  try {
    const rounds = await db
      .select({
        id:          maletteRoundsTable.id,
        multipliers: maletteRoundsTable.multipliers,
        closedAt:    maletteRoundsTable.closedAt,
      })
      .from(maletteRoundsTable)
      .where(eq(maletteRoundsTable.status, "closed"))
      .orderBy(desc(maletteRoundsTable.closedAt))
      .limit(20);
    res.json(rounds.map(r => ({
      roundId:     r.id,
      multipliers: r.multipliers,
      closedAt:    r.closedAt,
    })));
  } catch {
    res.status(500).json({ error: "Erreur" });
  }
});

export default router;
