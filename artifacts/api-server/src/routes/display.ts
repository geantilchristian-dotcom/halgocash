import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { maletteRoundsTable, maletteBetsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

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

export default router;
