import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { maletteRoundsTable, maletteBetsTable, creditAdjustmentsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

const SEGMENTS = [
  { label: "JACKPOT",    multiplier: 100, color: "#FFD700" },
  { label: "MÉGA",       multiplier: 25,  color: "#9B59B6" },
  { label: "GRAND",      multiplier: 10,  color: "#3498DB" },
  { label: "MAJEUR",     multiplier: 5,   color: "#1ABC9C" },
  { label: "MINEUR",     multiplier: 2,   color: "#27AE60" },
  { label: "PETIT",      multiplier: 1,   color: "#F1C40F" },
  { label: "TRÈS PETIT", multiplier: 0.5, color: "#E67E22" },
  { label: "PERDU",      multiplier: 0,   color: "#555555" },
];

const router: IRouter = Router();

function buildBetsPerCase(bets: Array<{ caseIndex: number; amount: string | number }>) {
  const result: number[] = [0, 0, 0, 0];
  for (const b of bets) {
    result[b.caseIndex] = (result[b.caseIndex] ?? 0) + parseFloat(String(b.amount));
  }
  return result;
}

// GET /api/display/malette — public display data (no auth)
router.get("/display/malette", async (req, res): Promise<void> => {
  try {
    const [round] = await db
      .select()
      .from(maletteRoundsTable)
      .where(eq(maletteRoundsTable.status, "betting"))
      .orderBy(desc(maletteRoundsTable.createdAt))
      .limit(1);

    if (round) {
      const bets = await db
        .select()
        .from(maletteBetsTable)
        .where(eq(maletteBetsTable.roundId, round.id));
      const betsPerCase = buildBetsPerCase(bets);
      const totalBets = betsPerCase.reduce((a, b) => a + b, 0);
      res.json({
        status: "betting",
        roundId: round.id,
        closesAt: round.closesAt.toISOString(),
        timeLeft: Math.max(0, round.closesAt.getTime() - Date.now()),
        betsPerCase,
        totalBets,
        multipliers: null,
      });
      return;
    }

    const [recent] = await db
      .select()
      .from(maletteRoundsTable)
      .where(and(
        eq(maletteRoundsTable.status, "closed"),
        sql`${maletteRoundsTable.closedAt} >= NOW() - INTERVAL '30 seconds'`,
      ))
      .orderBy(desc(maletteRoundsTable.closedAt))
      .limit(1);

    if (recent) {
      res.json({
        status: "closed",
        roundId: recent.id,
        multipliers: recent.multipliers as number[] | null,
        betsPerCase: recent.betsPerCase as number[] | null,
        totalCollected: parseFloat(String(recent.totalCollected ?? 0)),
        totalPaid: parseFloat(String(recent.totalPaid ?? 0)),
        closedAt: recent.closedAt?.toISOString() ?? null,
      });
      return;
    }

    res.json({ status: "idle" });
  } catch (err) {
    req.log.error({ err }, "GET /display/malette error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/display/roulette — public display data (no auth)
router.get("/display/roulette", async (req, res): Promise<void> => {
  try {
    const spins = await db
      .select()
      .from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.reason, "roulette_spin"))
      .orderBy(desc(creditAdjustmentsTable.createdAt))
      .limit(25);

    const parsed = spins.map(s => {
      const [idxStr, amtStr] = (s.refId ?? "").split(":");
      const segIdx = parseInt(idxStr ?? "7", 10);
      const betAmt = parseFloat(amtStr ?? "0");
      const seg = SEGMENTS[segIdx] ?? SEGMENTS[7]!;
      const netChange = parseFloat(String(s.amount));
      const wonAmount = betAmt + netChange;
      return {
        id: s.id,
        segmentIdx: segIdx,
        label: seg.label,
        multiplier: seg.multiplier,
        color: seg.color,
        betAmount: betAmt,
        wonAmount: Math.max(0, wonAmount),
        netChange,
        spinAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
      };
    });

    const lastSpin = parsed[0] ?? null;
    res.json({ lastSpin, recentSpins: parsed, segments: SEGMENTS });
  } catch (err) {
    req.log.error({ err }, "GET /display/roulette error");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
