import { createHmac, createHash } from "crypto";
import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { db, creditAdjustmentsTable, ticketsTable, withdrawalsTable, crashBetsTable } from "@workspace/db";
import { eq, and, sum, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { crashBetRateLimit, cashoutRateLimit } from "../middlewares/rateLimiters";

/** Resolve userId from Clerk token or Express session (10-digit code flow) */
function resolveUserId(req: Request): string | null {
  const { userId: clerkId } = getAuth(req);
  if (clerkId) return clerkId;
  const sessionId = (req.session as unknown as Record<string, unknown>)["userId"] as string | undefined;
  return sessionId ? `local:${sessionId}` : null;
}

const router = Router();

const CRASH_SHOW_MS  = 2_000;
const BET_WINDOW_MS  = 15_000;
const FLIGHT_START_MS = CRASH_SHOW_MS + BET_WINDOW_MS; // 17 000 ms

// ── HMAC crash point (server-secret, unpredictable by clients) ───────────────
const CRASH_SECRET = process.env.SESSION_SECRET ?? "halgo-crash-secret-fallback";

function hmacCrashPoint(cycleId: number): number {
  const hash = createHmac("sha256", CRASH_SECRET).update(String(cycleId)).digest("hex");
  const r = parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  if (r < 0.03) return 1.0;
  return Math.min(1000, Math.max(1.01, Math.floor((0.99 / (1 - r)) * 100) / 100));
}

function commitmentHash(cycleId: number, crashPoint: number): string {
  return createHash("sha256")
    .update(`halgo-crash:${cycleId}:${crashPoint.toFixed(2)}`)
    .digest("hex");
}

// ── Flight physics (mirror of client) ────────────────────────────────────────
const K = 0.07;
function mToT(m: number): number { return Math.log(Math.max(1, m)) / K; }

// ── Server-side cycle management ──────────────────────────────────────────────
// One cycle per game round. Cycles advance automatically when the flight would
// have crashed. Cycle ID = floor(startedAt / 1000) — seconds-precision.
// Minimum cycle duration is 12s so IDs never collide.

interface Cycle {
  id: number;        // seconds-timestamp of cycle start — stored as roundId in DB
  startedAt: number; // ms timestamp
  crashPoint: number;
}

let activeCycle: Cycle = { id: 0, startedAt: 0, crashPoint: 2.0 };
let cycleTimer: ReturnType<typeof setTimeout> | null = null;
let lastCrashedPoint = 2.0; // saved when each cycle ends — shown during the 2s crash display

// Rolling crash history — last 30 results, newest first
const crashHistory: number[] = [];

// Declared here (before startCycle boot call) so broadcastCrashState can reference it at startup
const sseClients = new Set<Response>();

function startCycle(): void {
  // Save crash point from the cycle that just ended
  if (activeCycle.id !== 0) {
    lastCrashedPoint = activeCycle.crashPoint;
    crashHistory.unshift(parseFloat(activeCycle.crashPoint.toFixed(2)));
    if (crashHistory.length > 30) crashHistory.pop();
  }

  const startedAt = Date.now();
  const id = Math.floor(startedAt / 1000);
  const crashPoint = hmacCrashPoint(id);
  activeCycle = { id, startedAt, crashPoint };

  // Schedule next cycle: flight starts at FLIGHT_START_MS, then lasts mToT(cp)*1000 ms
  const flightMs = mToT(crashPoint) * 1000;
  const cycleMs  = FLIGHT_START_MS + flightMs;

  if (cycleTimer) clearTimeout(cycleTimer);
  cycleTimer = setTimeout(startCycle, cycleMs);

  // Broadcast new state immediately to all SSE clients
  broadcastCrashState();
}

// Pre-seed history with estimated past rounds (HMAC is deterministic)
// Average cycle ≈ 30s — good enough to show plausible recent history at startup
;(function preSeedHistory() {
  const nowS = Math.floor(Date.now() / 1000);
  const AVG_CYCLE_S = 30;
  for (let i = 1; i <= 25; i++) {
    const estId = nowS - i * AVG_CYCLE_S;
    crashHistory.push(parseFloat(hmacCrashPoint(estId).toFixed(2)));
  }
})();

startCycle(); // boot

function msIntoCycle(): number {
  return Date.now() - activeCycle.startedAt;
}

// ── SSE: real-time game state broadcaster ─────────────────────────────────────
// All connected clients receive the same server state every 500ms, ensuring
// identical crash points, phases, and timing across all accounts.
function buildCrashState() {
  const ms = msIntoCycle();
  const { id, crashPoint } = activeCycle;
  if (ms < CRASH_SHOW_MS) {
    // Show phase: reveal the PREVIOUS round's crash point for the display
    return { phase: "show" as const, roundId: id, msIntoRound: ms, serverMs: Date.now(), prevCrashPoint: lastCrashedPoint };
  } else if (ms < FLIGHT_START_MS) {
    // Betting window: crash point is hidden until flight starts
    return { phase: "betting" as const, roundId: id, msIntoRound: ms, serverMs: Date.now() };
  }
  // Flying: reveal crash point so all clients animate the same curve
  return { phase: "flying" as const, roundId: id, msIntoRound: ms, serverMs: Date.now(), crashPoint };
}

function broadcastCrashState() {
  if (sseClients.size === 0) return;
  const data = `data: ${JSON.stringify(buildCrashState())}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}

// Broadcast every 500ms so all clients stay in sync
setInterval(broadcastCrashState, 500);

// ── Public export for display route ───────────────────────────────────────────
export function getCrashDisplayState() {
  return { ...buildCrashState(), history: crashHistory.slice(0, 25) };
}

// ── GET /api/crash/stream ─────────────────────────────────────────────────────
router.get("/crash/stream", (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering in production
  res.flushHeaders();

  // Send current state immediately so the client doesn't wait up to 500ms
  res.write(`data: ${JSON.stringify(buildCrashState())}\n\n`);
  sseClients.add(res);

  req.on("close", () => sseClients.delete(res));
});

// ── Balance helper ────────────────────────────────────────────────────────────
async function getBalance(userId: string): Promise<number> {
  const [[winsRow], [paidRow], [pendingRow], [creditsRow]] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, userId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, userId)),
  ]);
  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;
  const credits = creditsRow?.total ? parseFloat(String(creditsRow.total)) : 0;
  return Math.max(0, wins + credits - paid - pending);
}

// ── GET /api/crash/history ────────────────────────────────────────────────────
router.get("/crash/history", (_req, res): void => {
  res.json({ history: crashHistory.slice(0, 25) });
});

// ── GET /api/crash/round ──────────────────────────────────────────────────────
// During betting window  → returns commitment (NO crash point — can't be predicted)
// During flight / crash  → reveals crash point for animation
router.get("/crash/round", (_req, res): void => {
  const { id, crashPoint } = activeCycle;
  const ms         = msIntoCycle();
  const commitment = commitmentHash(id, crashPoint);

  if (ms < FLIGHT_START_MS) {
    res.json({ roundId: id, msIntoRound: ms, serverMs: Date.now(), commitment, betting: true });
  } else {
    res.json({ roundId: id, crashPoint, msIntoRound: ms, serverMs: Date.now(), commitment, betting: false });
  }
});

// ── POST /api/crash/bet ───────────────────────────────────────────────────────
const BetBody = z.object({
  amount:  z.number().int().min(100).max(10_000),
  roundId: z.number().int().positive(),
});

router.post("/crash/bet", crashBetRateLimit, async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = BetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Montant invalide" }); return; }
  const { amount, roundId } = parsed.data;

  // Validate against the current server cycle
  const ms = msIntoCycle();
  if (roundId !== activeCycle.id) {
    res.status(400).json({ error: "La fenêtre de mise est fermée" });
    return;
  }
  if (ms < CRASH_SHOW_MS || ms >= FLIGHT_START_MS) {
    res.status(400).json({ error: "La fenêtre de mise est fermée" });
    return;
  }

  const currentBalance = await getBalance(clerkId);
  if (amount > currentBalance) {
    res.status(400).json({ error: "Solde insuffisant", balance: currentBalance });
    return;
  }

  // One bet per cycle per user
  const [existing] = await db.select({ id: crashBetsTable.id })
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Vous avez déjà misé dans ce cycle" });
    return;
  }

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(-amount),
    reason: "crash_bet",
    refId: `CYC-${roundId}`,
  });
  await db.insert(crashBetsTable).values({ clerkId, roundId, amount, status: "placed" });

  res.json({ ok: true, newBalance: Math.max(0, currentBalance - amount) });
});

// ── POST /api/crash/cancel-bet ────────────────────────────────────────────────
const CancelBetBody = z.object({
  roundId: z.number().int().positive(),
});

router.post("/crash/cancel-bet", async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CancelBetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { roundId } = parsed.data;

  // Only cancellable if still in betting window of the active cycle
  const ms = msIntoCycle();
  if (roundId !== activeCycle.id || ms >= FLIGHT_START_MS) {
    res.status(400).json({ error: "L'annulation n'est plus possible, le vol a commencé" });
    return;
  }

  const [bet] = await db.select()
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);

  if (!bet || bet.status !== "placed") {
    res.status(400).json({ error: "Mise introuvable ou déjà traitée" });
    return;
  }

  await db.update(crashBetsTable)
    .set({ status: "cancelled" })
    .where(eq(crashBetsTable.id, bet.id));

  await db.insert(creditAdjustmentsTable).values({
    clerkId,
    amount: String(bet.amount),
    reason: "crash_bet_cancel",
  });

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance });
});

// ── POST /api/crash/cashout ───────────────────────────────────────────────────
const CashoutBody = z.object({
  roundId:     z.number().int().positive(),
  cashoutMult: z.number().min(1.0).max(1000),
  betType:     z.enum(["full", "half"]).default("full"),
});

router.post("/crash/cashout", cashoutRateLimit, async (req, res): Promise<void> => {
  const clerkId = resolveUserId(req);
  if (!clerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = CashoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }
  const { roundId, cashoutMult, betType } = parsed.data;

  // The crash point for this cycle is deterministic via HMAC
  const crashPoint = hmacCrashPoint(roundId);
  if (cashoutMult > crashPoint + 0.05) {
    res.status(400).json({ error: "Cashout refusé : l'avion avait déjà crashé" });
    return;
  }

  const [bet] = await db.select()
    .from(crashBetsTable)
    .where(and(eq(crashBetsTable.clerkId, clerkId), eq(crashBetsTable.roundId, roundId)))
    .limit(1);

  if (!bet || bet.status !== "placed") {
    res.status(400).json({ error: "Mise introuvable ou déjà traitée" });
    return;
  }

  const effectiveBet = betType === "half" ? Math.floor(bet.amount / 2) : bet.amount;
  const wonAmount    = Math.floor(effectiveBet * cashoutMult);
  const newStatus    = betType === "half" ? "placed" : "cashed";

  await db.update(crashBetsTable)
    .set({
      status:      newStatus,
      cashoutMult: String(cashoutMult),
      wonAmount,
      amount: betType === "half" ? bet.amount - Math.floor(bet.amount / 2) : bet.amount,
    })
    .where(eq(crashBetsTable.id, bet.id));

  if (wonAmount > 0) {
    await db.insert(creditAdjustmentsTable).values({
      clerkId,
      amount: String(wonAmount),
      reason: "crash_cashout",
    });
  }

  const newBalance = await getBalance(clerkId);
  res.json({ ok: true, newBalance, wonAmount });
});

export default router;
