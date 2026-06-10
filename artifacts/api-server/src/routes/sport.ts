import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, gte, inArray } from "drizzle-orm";
import { db, sportMatchesTable, sportBetsTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

const ACTIVE_COMPETITIONS = ["WC", "BSA", "CLI"];
const SPORTS_STARTING_BALANCE = 50000;

function seedOdds(fixtureId: number): { home: number; draw: number; away: number } {
  const rng = (seed: number) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const r1 = rng(fixtureId);
  const r2 = rng(fixtureId + 1);
  const home = parseFloat((1.5 + r1 * 2.5).toFixed(2));
  const draw = parseFloat((2.8 + r2 * 1.5).toFixed(2));
  const away = parseFloat((1.5 + rng(fixtureId + 2) * 3.0).toFixed(2));
  return { home, draw, away };
}

type ApiMatch = {
  id: number;
  competition: { code: string; name: string };
  utcDate: string;
  status: string;
  homeTeam: { name: string; crest?: string };
  awayTeam: { name: string; crest?: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
};

async function fetchCompetitionMatches(apiKey: string, comp: string): Promise<ApiMatch[]> {
  const resp = await fetch(
    `https://api.football-data.org/v4/competitions/${comp}/matches?status=TIMED,SCHEDULED`,
    { headers: { "X-Auth-Token": apiKey } },
  );
  if (!resp.ok) return [];
  const data = await resp.json() as { matches?: ApiMatch[] };
  return (data.matches ?? []).slice(0, 20);
}

async function fetchAndCacheMatches() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) throw new Error("FOOTBALL_API_KEY not set");

  const allMatches: ApiMatch[] = [];
  for (const comp of ACTIVE_COMPETITIONS) {
    const matches = await fetchCompetitionMatches(apiKey, comp);
    allMatches.push(...matches);
    // Small delay to respect rate limit (10 req/min free tier)
    await new Promise((r) => setTimeout(r, 400));
  }

  const validMatches = allMatches.filter(
    (m) => m.homeTeam?.name && m.awayTeam?.name,
  );

  for (const m of validMatches) {
    const odds = seedOdds(m.id);
    const score = m.score?.fullTime;
    await db
      .insert(sportMatchesTable)
      .values({
        fixtureId: m.id,
        competition: m.competition.code,
        competitionName: m.competition.name,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeTeamCrest: m.homeTeam.crest ?? null,
        awayTeamCrest: m.awayTeam.crest ?? null,
        matchDate: new Date(m.utcDate),
        status: m.status,
        homeScore: score?.home ?? null,
        awayScore: score?.away ?? null,
        oddsHome: String(odds.home),
        oddsDraw: String(odds.draw),
        oddsAway: String(odds.away),
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: sportMatchesTable.fixtureId,
        set: {
          status: m.status,
          homeScore: score?.home ?? null,
          awayScore: score?.away ?? null,
          fetchedAt: new Date(),
        },
      });
  }

  return allMatches.length;
}

router.get("/sport/matches", async (req: Request, res: Response): Promise<void> => {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const cached = await db
      .select()
      .from(sportMatchesTable)
      .where(and(
        inArray(sportMatchesTable.status, ["SCHEDULED", "TIMED"]),
        gte(sportMatchesTable.fetchedAt, fiveMinAgo)
      ))
      .orderBy(sportMatchesTable.matchDate)
      .limit(40);

    if (cached.length === 0) {
      await fetchAndCacheMatches();
      const fresh = await db
        .select()
        .from(sportMatchesTable)
        .where(inArray(sportMatchesTable.status, ["SCHEDULED", "TIMED"]))
        .orderBy(sportMatchesTable.matchDate)
        .limit(40);
      res.json({ matches: fresh });
      return;
    }

    res.json({ matches: cached });
  } catch (err) {
    req.log.error({ err }, "GET /sport/matches error");
    res.status(500).json({ error: "Impossible de charger les matchs" });
  }
});

router.get("/sport/bets/my", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const bets = await db
    .select()
    .from(sportBetsTable)
    .where(eq(sportBetsTable.clerkId, userId))
    .orderBy(desc(sportBetsTable.createdAt))
    .limit(50);

  const totalSpent = bets
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalWon = bets
    .filter(b => b.status === "won")
    .reduce((s, b) => s + parseFloat(b.potentialWin), 0);
  const balance = SPORTS_STARTING_BALANCE - totalSpent + totalWon;

  res.json({ bets, balance });
});

router.post("/sport/bets", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const { matchId, betType, amount } = req.body as {
    matchId?: number; betType?: string; amount?: number;
  };

  if (!matchId || !betType || !amount) {
    res.status(400).json({ error: "matchId, betType et amount requis" });
    return;
  }
  if (!["home", "draw", "away"].includes(betType)) {
    res.status(400).json({ error: "betType invalide (home | draw | away)" });
    return;
  }
  if (amount < 100 || amount > 500000) {
    res.status(400).json({ error: "Mise entre 100 FC et 500 000 FC" });
    return;
  }

  const [match] = await db
    .select()
    .from(sportMatchesTable)
    .where(eq(sportMatchesTable.id, matchId))
    .limit(1);

  if (!match) { res.status(404).json({ error: "Match introuvable" }); return; }
  if (match.status !== "SCHEDULED") {
    res.status(400).json({ error: "Ce match n'accepte plus de paris" });
    return;
  }

  const existingBets = await db
    .select()
    .from(sportBetsTable)
    .where(eq(sportBetsTable.clerkId, userId));

  const totalSpent = existingBets
    .filter(b => b.status !== "cancelled")
    .reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalWon = existingBets
    .filter(b => b.status === "won")
    .reduce((s, b) => s + parseFloat(b.potentialWin), 0);
  const balance = SPORTS_STARTING_BALANCE - totalSpent + totalWon;

  if (amount > balance) {
    res.status(400).json({ error: "Solde insuffisant" });
    return;
  }

  const oddsMap = { home: match.oddsHome, draw: match.oddsDraw, away: match.oddsAway };
  const chosenOdds = parseFloat(oddsMap[betType as "home" | "draw" | "away"]);
  const potentialWin = parseFloat((amount * chosenOdds).toFixed(2));

  const [bet] = await db
    .insert(sportBetsTable)
    .values({
      clerkId: userId,
      matchId: match.id,
      fixtureId: match.fixtureId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      matchDate: match.matchDate,
      betType,
      amount: String(amount),
      odds: String(chosenOdds),
      potentialWin: String(potentialWin),
    })
    .returning();

  res.json({ bet, newBalance: balance - amount });
});

export default router;
