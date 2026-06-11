import { createHash } from "crypto";
import { Router } from "express";
import { db, crashBetsTable, ticketsTable, minesGamesTable, kycTable } from "@workspace/db";
import { eq, and, desc, isNotNull, inArray, sql } from "drizzle-orm";

const router = Router();

// ── Stable display alias from clerkId (users without KYC) ────────────────────
const FIRST_NAMES = [
  "Jean", "Marie", "Pierre", "Grace", "Paul", "Ruth", "David", "Esther",
  "Moise", "Bijou", "Espoir", "Joel", "Rachel", "Samuel", "Luc",
  "Emmanuel", "Rebecca", "Isaac", "Sara", "Nathan", "Didier", "Joëlle",
];
const LAST_INITIALS = ["M","K","L","B","N","T","O","A","D","E","F","G","H","J","P","R","S","V","W","Y"];

function stableAlias(clerkId: string): string {
  const hash = createHash("md5").update(clerkId).digest("hex");
  const fi = parseInt(hash.slice(0, 4), 16) % FIRST_NAMES.length;
  const li = parseInt(hash.slice(4, 8), 16) % LAST_INITIALS.length;
  return `${FIRST_NAMES[fi]} ${LAST_INITIALS[li]}.`;
}

function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 10) + ".";
  const firstName = parts[0];
  const lastInitial = (parts[parts.length - 1][0] ?? "?").toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// ── Simulated fallback — only shown when real data is insufficient ─────────────
const SIM_WINS = [
  { name: "Jean M.",       amount: 45_000,  game: "Crash"   },
  { name: "Bijou K.",      amount: 120_000, game: "Crash"   },
  { name: "Paul T.",       amount: 8_500,   game: "Loterie" },
  { name: "Grace L.",      amount: 250_000, game: "Crash"   },
  { name: "Moise N.",      amount: 15_000,  game: "Crash"   },
  { name: "Ruth B.",       amount: 60_000,  game: "Mines"   },
  { name: "David M.",      amount: 32_000,  game: "Crash"   },
  { name: "Espérance O.",  amount: 500_000, game: "Loterie" },
  { name: "Luc S.",        amount: 7_000,   game: "Crash"   },
  { name: "Rachel A.",     amount: 95_000,  game: "Crash"   },
];

// ── GET /api/live-feed ────────────────────────────────────────────────────────
// Returns up to 20 real recent winners (crash + tickets + mines), padded with
// simulated entries if there are fewer than MIN_ENTRIES real ones.
router.get("/live-feed", async (_req, res): Promise<void> => {
  try {
    const [crashWins, ticketWins, minesWins] = await Promise.all([
      // Crash cashouts in the last 24 h
      db.select({
        clerkId:   crashBetsTable.clerkId,
        wonAmount: crashBetsTable.wonAmount,
        createdAt: crashBetsTable.createdAt,
      })
      .from(crashBetsTable)
      .where(and(
        eq(crashBetsTable.status, "cashed"),
        isNotNull(crashBetsTable.wonAmount),
        sql`${crashBetsTable.wonAmount} > 0`,
        sql`${crashBetsTable.createdAt} > now() - interval '24 hours'`,
      ))
      .orderBy(desc(crashBetsTable.createdAt))
      .limit(20),

      // Ticket lottery wins (all time, most recent first)
      db.select({
        clerkId:     ticketsTable.registeredByClerkId,
        prizeAmount: ticketsTable.prizeAmount,
        claimedAt:   ticketsTable.claimedAt,
      })
      .from(ticketsTable)
      .where(and(
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.claimedAt),
        isNotNull(ticketsTable.registeredByClerkId),
      ))
      .orderBy(desc(ticketsTable.claimedAt))
      .limit(10),

      // Mines cashouts in the last 24 h
      db.select({
        clerkId:      minesGamesTable.clerkId,
        cashoutAmount: minesGamesTable.cashoutAmount,
        createdAt:    minesGamesTable.createdAt,
      })
      .from(minesGamesTable)
      .where(and(
        eq(minesGamesTable.status, "cashed"),
        isNotNull(minesGamesTable.cashoutAmount),
        sql`${minesGamesTable.cashoutAmount} > 0`,
        sql`${minesGamesTable.createdAt} > now() - interval '24 hours'`,
      ))
      .orderBy(desc(minesGamesTable.createdAt))
      .limit(10),
    ]);

    // Fetch KYC display names for all clerk IDs in one query
    const allIds = [...new Set([
      ...crashWins.map(w => w.clerkId),
      ...ticketWins.map(w => w.clerkId).filter((id): id is string => id !== null),
      ...minesWins.map(w => w.clerkId),
    ])];

    let kycMap = new Map<string, string>();
    if (allIds.length > 0) {
      const kycs = await db
        .select({ clerkId: kycTable.clerkId, fullName: kycTable.fullName })
        .from(kycTable)
        .where(inArray(kycTable.clerkId, allIds));
      kycMap = new Map(kycs.map(k => [k.clerkId, k.fullName]));
    }

    const getName = (id: string) => {
      const kyc = kycMap.get(id);
      return kyc ? maskName(kyc) : stableAlias(id);
    };

    // Merge, sort by recency, cap at 20
    const real = [
      ...crashWins.filter(w => w.wonAmount).map(w => ({
        name: getName(w.clerkId), amount: w.wonAmount!, game: "Crash",
        ts: w.createdAt.getTime(), real: true,
      })),
      ...ticketWins.filter(w => w.clerkId && w.prizeAmount).map(w => ({
        name: getName(w.clerkId!), amount: Math.round(parseFloat(w.prizeAmount!)), game: "Loterie",
        ts: (w.claimedAt ?? new Date()).getTime(), real: true,
      })),
      ...minesWins.filter(w => w.cashoutAmount).map(w => ({
        name: getName(w.clerkId), amount: w.cashoutAmount!, game: "Mines",
        ts: w.createdAt.getTime(), real: true,
      })),
    ].sort((a, b) => b.ts - a.ts).slice(0, 20);

    // Pad with simulated if too few real entries (keeps ticker populated at launch)
    const MIN_ENTRIES = 6;
    const simNeeded = Math.max(0, MIN_ENTRIES - real.length);
    const sim = SIM_WINS.slice(0, simNeeded + 4).map(s => ({ ...s, real: false }));

    res.json([
      ...real.map(({ name, amount, game }) => ({ name, amount, game, real: true })),
      ...sim,
    ]);
  } catch {
    res.json(SIM_WINS.map(s => ({ ...s, real: false })));
  }
});

export default router;
