import { eq, and } from "drizzle-orm";
import { db, sportMatchesTable, sportBetsTable, creditAdjustmentsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const ACTIVE_COMPETITIONS = ["WC", "BSA", "CLI"];
export const SETTLEMENT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string; crest?: string };
  awayTeam: { name: string; crest?: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
};

async function fetchFinishedMatches(apiKey: string, comp: string): Promise<ApiMatch[]> {
  try {
    const resp = await fetch(
      `https://api.football-data.org/v4/competitions/${comp}/matches?status=FINISHED`,
      { headers: { "X-Auth-Token": apiKey }, signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) {
      logger.warn({ comp, status: resp.status }, "football-data fetch non-ok");
      return [];
    }
    const data = await resp.json() as { matches?: ApiMatch[] };
    return data.matches ?? [];
  } catch (err) {
    logger.warn({ err, comp }, "football-data fetch error");
    return [];
  }
}

function determineOutcome(homeScore: number, awayScore: number): "home" | "draw" | "away" {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

export async function runSettlementJob(): Promise<{ settled: number; errors: number; skipped: number }> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    logger.warn("FOOTBALL_API_KEY not set — skipping sport settlement");
    return { settled: 0, errors: 0, skipped: 0 };
  }

  let settled = 0;
  let errors = 0;
  let skipped = 0;

  for (const comp of ACTIVE_COMPETITIONS) {
    try {
      const matches = await fetchFinishedMatches(apiKey, comp);

      // Rate-limit: free tier = 10 req/min
      await new Promise((r) => setTimeout(r, 400));

      for (const m of matches) {
        const score = m.score?.fullTime;
        if (score?.home == null || score?.away == null) { skipped++; continue; }

        const homeScore = score.home;
        const awayScore = score.away;

        // 1. Update match record to FINISHED with final score
        await db
          .update(sportMatchesTable)
          .set({ status: "FINISHED", homeScore, awayScore, fetchedAt: new Date() })
          .where(eq(sportMatchesTable.fixtureId, m.id));

        // 2. Find all still-pending bets for this fixture
        const pendingBets = await db
          .select()
          .from(sportBetsTable)
          .where(and(eq(sportBetsTable.fixtureId, m.id), eq(sportBetsTable.status, "pending")));

        if (pendingBets.length === 0) continue;

        const outcome = determineOutcome(homeScore, awayScore);

        for (const bet of pendingBets) {
          const won = bet.betType === outcome;

          // 3. Mark bet as won or lost
          await db
            .update(sportBetsTable)
            .set({ status: won ? "won" : "lost", settledAt: new Date() })
            .where(eq(sportBetsTable.id, bet.id));

          // 4. Credit winner's main FC balance (skip POS tickets)
          if (won && !bet.clerkId.startsWith("pos:")) {
            await db.insert(creditAdjustmentsTable).values({
              clerkId: bet.clerkId,
              amount: bet.potentialWin,
              reason: "sport_bet_win",
              refId: `sport_bet_${bet.id}`,
            });
          }

          settled++;
        }

        if (pendingBets.length > 0) {
          logger.info(
            { fixtureId: m.id, comp, homeScore, awayScore, outcome, pendingBets: pendingBets.length },
            "Sport bets settled",
          );
        }
      }
    } catch (err) {
      logger.error({ err, comp }, "Settlement error for competition");
      errors++;
    }
  }

  logger.info({ settled, errors, skipped }, "Sport settlement job complete");
  return { settled, errors, skipped };
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startSettlementScheduler(): void {
  if (schedulerTimer) return;

  // Run once right away (on server start), then hourly
  void runSettlementJob().catch((err) => logger.error({ err }, "Initial sport settlement failed"));

  schedulerTimer = setInterval(() => {
    void runSettlementJob().catch((err) => logger.error({ err }, "Scheduled sport settlement failed"));
  }, SETTLEMENT_INTERVAL_MS);

  logger.info({ intervalMs: SETTLEMENT_INTERVAL_MS }, "Sport settlement scheduler started");
}
