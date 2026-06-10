import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, or, sql, count, sum, and, isNotNull, isNull } from "drizzle-orm";
import { db, usersTable, ticketsTable, drawsTable, vendorsTable, withdrawalsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getOnlineUsers } from "../lib/presence";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
    return;
  }
  (req as Request & { adminUser: typeof user }).adminUser = user;
  next();
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Build a prize distribution targeting 70% payout / 30% company margin.
 *
 * Fixed prizes per 1 000 tickets (scaled by N/1000):
 *   1  × 50 000 FC  (Super Gagnant)       → 50 000 FC
 *   2  × 25 000 FC  (Très Grand Gagnant)  → 50 000 FC
 *  10  × 10 000 FC  (Grand Gagnant)       → 100 000 FC
 *  10  ×  5 000 FC  (Gagnant)             → 50 000 FC
 *  Subtotal fixed: 250 000 FC per 1 000 tickets
 *
 * Variable "Remboursé" tier (= ticket price):
 *   petitCount = max(0, N × (0.70 − 250/price))
 *   This ensures total prizes ≈ 70% of revenue for price ≥ 358 FC.
 *   For cheaper tickets, fixed prizes already dominate the payout pool.
 *
 * Saturday jackpot series use JACKPOT type — handled separately.
 */
function buildPrizeDistribution(count: number, price: number): { prizeAmount: string | null; isWinner: boolean }[] {
  const r = count / 1000;

  // Fixed tiers (scaled)
  const superCount     = count >= 1000 ? Math.round(1  * r) : (count >= 500 ? 1 : 0);
  const tresGrandCount = count >= 500  ? Math.max(1, Math.round(2  * r)) : 0;
  const grandCount     = Math.max(0, Math.round(10 * r));
  const gagnantCount   = Math.max(0, Math.round(10 * r));

  // Variable "Remboursé" tier: fills up to 70% total payout.
  // Compute how much the fixed tiers already consume per ticket,
  // then fill the rest up to 70% with petit-gagnant (= ticket price) prizes.
  // This handles small lots correctly (e.g. 10 tickets where fixed tiers are 0).
  const actualFixedPrize = superCount * 50000 + tresGrandCount * 25000 + grandCount * 10000 + gagnantCount * 5000;
  const actualFixedPerTicket = count > 0 ? actualFixedPrize / count : 0;
  const petitRatio = Math.max(0, 0.70 - actualFixedPerTicket / price);
  const petitCount = Math.round(count * petitRatio);

  const totalWinners = superCount + tresGrandCount + grandCount + gagnantCount + petitCount;
  const loserCount   = Math.max(0, count - totalWinners);

  const prizes: { prizeAmount: string | null; isWinner: boolean }[] = [
    ...Array<null>(superCount).fill(null).map(() => ({ prizeAmount: "50000",       isWinner: true  })),
    ...Array<null>(tresGrandCount).fill(null).map(() => ({ prizeAmount: "25000",   isWinner: true  })),
    ...Array<null>(grandCount).fill(null).map(() => ({ prizeAmount: "10000",       isWinner: true  })),
    ...Array<null>(gagnantCount).fill(null).map(() => ({ prizeAmount: "5000",      isWinner: true  })),
    ...Array<null>(petitCount).fill(null).map(() => ({ prizeAmount: String(price), isWinner: true  })),
    ...Array<null>(loserCount).fill(null).map(() => ({ prizeAmount: null,          isWinner: false })),
  ];

  return shuffle(prizes);
}

// POST /api/admin/login
router.post("/admin/login", async (req: Request, res: Response): Promise<void> => {
  const { identifier, password } = req.body as { identifier: string; password: string };
  if (!identifier || !password) {
    res.status(400).json({ error: "Identifiant et mot de passe requis" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, identifier), eq(usersTable.username, identifier)))
    .limit(1);

  if (!user || user.role !== "admin") {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Compte suspendu" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  await db.update(usersTable).set({ lastLoginAt: new Date(), lastLoginIp: ip }).where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.save((err) => {
    if (err) {
      logger.error({ err }, "Session save failed");
      res.status(500).json({ error: "Erreur serveur" });
      return;
    }
    logger.info({ userId: user.id }, "Admin logged in");
    res.json({ id: user.id, email: user.email, username: user.username, role: user.role, vendorId: user.vendorId ?? null });
  });
});

// GET /api/admin/users
router.get("/admin/users", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const now = Date.now();
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      isSuspended: u.isSuspended,
      isOnline: u.lastLoginAt ? now - u.lastLoginAt.getTime() < 15 * 60 * 1000 : false,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastLoginIp: u.lastLoginIp ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  );
});

// PATCH /api/admin/users/:id
router.patch("/admin/users/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]));
  const { isSuspended } = req.body as { isSuspended: boolean };
  if (typeof isSuspended !== "boolean") {
    res.status(400).json({ error: "isSuspended doit être un booléen" });
    return;
  }
  await db.update(usersTable).set({ isSuspended }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// POST /api/admin/codes/generate
router.post("/admin/codes/generate", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { count, price, series, drawId, vendorId } = req.body as {
    count: number;
    price: number;
    series: string;
    drawId?: number;
    vendorId?: number;
  };

  const qty = Number(count);
  if (!qty || qty < 1 || qty > 5000) {
    res.status(400).json({ error: "Quantité invalide (1–5000)" });
    return;
  }

  const ticketPrice = Number(price) || 500;

  // Alphanumeric charset — no confusing chars (O/0/I/1/L)
  const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const genCode = () =>
    Array.from({ length: 10 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join("");

  const codesSet = new Set<string>();
  while (codesSet.size < qty * 2) codesSet.add(genCode());
  const candidateCodes = Array.from(codesSet);

  // Build prize distribution
  const prizes = buildPrizeDistribution(qty, ticketPrice);

  const assignedVendorId = vendorId ? Number(vendorId) : null;

  const insertValues = candidateCodes.slice(0, qty).map((code, i) => ({
    code,
    status: "available" as const,
    price: String(ticketPrice),
    series: series ?? "A",
    drawId: drawId ?? null,
    vendorId: assignedVendorId,
    isWinner: prizes[i]?.isWinner ?? false,
    prizeAmount: prizes[i]?.prizeAmount ?? null,
  }));

  const inserted = await db
    .insert(ticketsTable)
    .values(insertValues)
    .onConflictDoNothing()
    .returning({ id: ticketsTable.id, code: ticketsTable.code, isWinner: ticketsTable.isWinner, prizeAmount: ticketsTable.prizeAmount });

  const finalBatch = inserted.slice(0, qty);

  logger.info({ count: finalBatch.length, series }, "Admin generated ticket codes");

  const winners = finalBatch.filter((t) => t.isWinner).length;
  res.json({
    generated: finalBatch.length,
    winners,
    codes: finalBatch.map((t) => t.code),
    distribution: {
      super: finalBatch.filter((t) => t.prizeAmount === "50000").length,
      tresGrand: finalBatch.filter((t) => t.prizeAmount === "25000").length,
      grand: finalBatch.filter((t) => t.prizeAmount === "10000").length,
      gagnant: finalBatch.filter((t) => t.prizeAmount === "5000").length,
      petit: finalBatch.filter((t) => t.isWinner && !["50000","25000","10000","5000"].includes(t.prizeAmount ?? "")).length,
      perdant: finalBatch.filter((t) => !t.isWinner).length,
    },
  });
});

// GET /api/admin/draws
router.get("/admin/draws", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const draws = await db
    .select({ id: drawsTable.id, drawNumber: drawsTable.drawNumber, status: drawsTable.status, scheduledAt: drawsTable.scheduledAt })
    .from(drawsTable)
    .orderBy(desc(drawsTable.scheduledAt))
    .limit(20);
  res.json(draws);
});

// PUT /api/admin/credentials
router.put("/admin/credentials", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const adminUser = (req as Request & { adminUser: { id: number } }).adminUser;
  const { username, email, currentPassword, newPassword } = req.body as {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const updates: Record<string, unknown> = {};

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: "Mot de passe actuel requis" });
      return;
    }
    const [current] = await db.select().from(usersTable).where(eq(usersTable.id, adminUser.id)).limit(1);
    const valid = await bcrypt.compare(currentPassword, current!.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Mot de passe actuel incorrect" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Nouveau mot de passe trop court (8 caractères minimum)" });
      return;
    }
    updates["passwordHash"] = await bcrypt.hash(newPassword, 12);
  }

  if (username) updates["username"] = username;
  if (email) updates["email"] = email;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucun champ à mettre à jour" });
    return;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, adminUser.id));
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, adminUser.id)).limit(1);
  res.json({ id: updated!.id, email: updated!.email, username: updated!.username, role: updated!.role });
});

// GET /api/admin/online-users — players seen in last 5 minutes
router.get("/admin/online-users", requireAdmin, (_req: Request, res: Response): void => {
  res.json(getOnlineUsers());
});

// GET /api/admin/batches — summary of all ticket batches grouped by series
router.get("/admin/batches", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      series: ticketsTable.series,
      generatedAt: sql<string>`MIN(${ticketsTable.createdAt})`.as("generated_at"),
      total: count(ticketsTable.id).as("total"),
      scratched: sql<number>`COUNT(*) FILTER (WHERE ${ticketsTable.registeredAt} IS NOT NULL)`.as("scratched"),
      winners: sql<number>`COUNT(*) FILTER (WHERE ${ticketsTable.registeredAt} IS NOT NULL AND ${ticketsTable.isWinner} = TRUE)`.as("winners"),
      available: sql<number>`COUNT(*) FILTER (WHERE ${ticketsTable.registeredAt} IS NULL)`.as("available"),
    })
    .from(ticketsTable)
    .groupBy(ticketsTable.series)
    .orderBy(sql`MIN(${ticketsTable.createdAt}) DESC`);

  res.json(rows.map((r) => ({
    series: r.series,
    generatedAt: r.generatedAt,
    total: Number(r.total),
    scratched: Number(r.scratched),
    winners: Number(r.winners),
    available: Number(r.available),
  })));
});

// DELETE /api/admin/batches/:series — delete all tickets in a series (admin only)
router.delete("/admin/batches/:series", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const series = String(req.params["series"]);

  // Safety: refuse to delete series that have scratched tickets
  const [row] = await db
    .select({ cnt: sql<number>`COUNT(*) FILTER (WHERE ${ticketsTable.registeredAt} IS NOT NULL)` })
    .from(ticketsTable)
    .where(eq(ticketsTable.series, series));

  const scratched = Number(row?.cnt ?? 0);
  if (scratched > 0) {
    res.status(409).json({ error: `Impossible de supprimer: ${scratched} billet(s) de ce lot ont déjà été grattés.` });
    return;
  }

  const result = await db.delete(ticketsTable).where(eq(ticketsTable.series, series)).returning({ id: ticketsTable.id });
  logger.info({ series, deleted: result.length }, "Admin deleted ticket batch");
  res.json({ deleted: result.length });
});

// GET /api/admin/batches/:series — all tickets in a specific series
router.get("/admin/batches/:series", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const series = String(req.params["series"]);
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.series, series))
    .orderBy(ticketsTable.id);

  res.json(rows.map((t) => ({
    id: t.id,
    code: t.code,
    status: t.status,
    price: parseFloat(t.price),
    series: t.series,
    isWinner: t.isWinner,
    prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : null,
    registeredAt: t.registeredAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  })));
});

// GET /api/admin/workers — list all vendor users with their stats
router.get("/admin/workers", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const vendorUsers = await db
    .select()
    .from(usersTable)
    .where(isNotNull(usersTable.vendorId))
    .orderBy(usersTable.createdAt);

  const results = await Promise.all(
    vendorUsers.map(async (u) => {
      const [vendor] = await db
        .select()
        .from(vendorsTable)
        .where(eq(vendorsTable.id, u.vendorId!))
        .limit(1);

      const [tRow] = await db
        .select({ total: count(), scratched: count() })
        .from(ticketsTable)
        .where(eq(ticketsTable.vendorId, u.vendorId!));

      const [scratchedRow] = await db
        .select({ cnt: count() })
        .from(ticketsTable)
        .where(and(eq(ticketsTable.vendorId, u.vendorId!), isNotNull(ticketsTable.registeredAt)));

      const [revenueRow] = await db
        .select({ total: sum(ticketsTable.price) })
        .from(ticketsTable)
        .where(eq(ticketsTable.vendorId, u.vendorId!));

      return {
        userId: u.id,
        username: u.username,
        email: u.email,
        plainPassword: u.plainPassword ?? null,
        isSuspended: u.isSuspended,
        vendorId: u.vendorId,
        vendorName: vendor?.name ?? "—",
        vendorLocation: vendor?.location ?? "—",
        vendorPhone: vendor?.phone ?? null,
        vendorStatus: vendor?.status ?? "active",
        totalTickets: Number(tRow?.total ?? 0),
        totalScratched: Number(scratchedRow?.cnt ?? 0),
        totalRevenue: parseFloat(String(revenueRow?.total ?? "0")),
        createdAt: u.createdAt.toISOString(),
      };
    }),
  );

  res.json(results);
});

// POST /api/admin/workers — create vendor + user account
router.post("/admin/workers", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { vendorName, location, phone, username, email, password } = req.body as {
    vendorName: string; location: string; phone?: string;
    username: string; email: string; password: string;
  };

  if (!vendorName || !location || !username || !email || !password) {
    res.status(400).json({ error: "Tous les champs sont obligatoires" });
    return;
  }

  // Check uniqueness
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Nom d'utilisateur ou email déjà utilisé" });
    return;
  }

  // Create vendor record
  const [vendor] = await db
    .insert(vendorsTable)
    .values({ name: vendorName, location, phone: phone ?? null, status: "active" })
    .returning();

  // Create user account
  const passwordHash = await bcrypt.hash(password, 10);
  const [newUser] = await db
    .insert(usersTable)
    .values({
      email,
      username,
      passwordHash,
      plainPassword: password,
      role: "vendor",
      vendorId: vendor!.id,
    })
    .returning();

  res.status(201).json({
    userId: newUser!.id,
    username: newUser!.username,
    email: newUser!.email,
    password, // shown once to admin
    vendorId: vendor!.id,
    vendorName: vendor!.name,
    vendorLocation: vendor!.location,
    createdAt: newUser!.createdAt.toISOString(),
  });
});

// DELETE /api/admin/reset — wipe ALL tickets and ALL pending withdrawals
router.delete("/admin/reset", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const deletedTickets = await db.delete(ticketsTable).returning({ id: ticketsTable.id });
  const deletedWithdrawals = await db.delete(withdrawalsTable).returning({ id: withdrawalsTable.id });

  logger.info(
    { tickets: deletedTickets.length, withdrawals: deletedWithdrawals.length },
    "Admin performed full stock reset",
  );

  res.json({
    deletedTickets: deletedTickets.length,
    deletedWithdrawals: deletedWithdrawals.length,
  });
});

// GET /api/admin/rapport — list all player accounts that have scanned tickets
router.get("/admin/rapport", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  // Distinct clerkIds from scanned tickets, with name from withdrawals if available
  const rows = await db
    .selectDistinct({ clerkId: ticketsTable.registeredByClerkId })
    .from(ticketsTable)
    .where(isNotNull(ticketsTable.registeredByClerkId));

  const accounts = await Promise.all(
    rows
      .filter((r) => r.clerkId)
      .map(async ({ clerkId }) => {
        const id = clerkId!;

        // Ticket stats for this clerkId
        const [ticketStats] = await db
          .select({
            total: sql<number>`COUNT(*)`.as("total"),
            winners: sql<number>`COUNT(*) FILTER (WHERE ${ticketsTable.isWinner} = TRUE AND ${ticketsTable.registeredAt} IS NOT NULL)`.as("winners"),
            lastActivity: sql<string>`MAX(${ticketsTable.registeredAt})`.as("lastActivity"),
          })
          .from(ticketsTable)
          .where(and(eq(ticketsTable.registeredByClerkId, id), isNotNull(ticketsTable.registeredAt)));

        // Withdrawal stats
        const [wStats] = await db
          .select({
            total: sql<number>`COUNT(*)`.as("total"),
            name: sql<string>`MAX(${withdrawalsTable.clerkName})`.as("name"),
            paidAmount: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}) FILTER (WHERE ${withdrawalsTable.status} = 'paid'), 0)`.as("paidAmount"),
            pendingAmount: sql<string>`COALESCE(SUM(${withdrawalsTable.amount}) FILTER (WHERE ${withdrawalsTable.status} = 'pending'), 0)`.as("pendingAmount"),
          })
          .from(withdrawalsTable)
          .where(eq(withdrawalsTable.clerkId, id));

        return {
          clerkId: id,
          name: wStats?.name ?? id,
          totalTickets: Number(ticketStats?.total ?? 0),
          winnerTickets: Number(ticketStats?.winners ?? 0),
          totalWithdrawals: Number(wStats?.total ?? 0),
          paidAmount: parseFloat(wStats?.paidAmount ?? "0"),
          pendingAmount: parseFloat(wStats?.pendingAmount ?? "0"),
          lastActivity: ticketStats?.lastActivity ?? null,
        };
      }),
  );

  // Sort by last activity desc
  accounts.sort((a, b) => {
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  res.json(accounts);
});

// GET /api/admin/rapport/:clerkId — withdrawal history for one player
router.get("/admin/rapport/:clerkId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  if (!clerkId) { res.status(400).json({ error: "clerkId requis" }); return; }

  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.clerkId, clerkId))
    .orderBy(desc(withdrawalsTable.createdAt));

  const tickets = await db
    .select({
      id: ticketsTable.id,
      code: ticketsTable.code,
      series: ticketsTable.series,
      isWinner: ticketsTable.isWinner,
      prizeAmount: ticketsTable.prizeAmount,
      registeredAt: ticketsTable.registeredAt,
    })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.registeredByClerkId, clerkId), isNotNull(ticketsTable.registeredAt)))
    .orderBy(desc(ticketsTable.registeredAt));

  const name = withdrawals[0]?.clerkName ?? clerkId;

  res.json({ clerkId, name, withdrawals, tickets });
});

// GET /api/admin/withdrawals — all withdrawals
router.get("/admin/withdrawals", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(withdrawalsTable)
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(200);

  const results = await Promise.all(
    rows.map(async (w) => {
      let paidByVendorName: string | null = null;
      if (w.paidByVendorId) {
        const [v] = await db
          .select({ name: vendorsTable.name })
          .from(vendorsTable)
          .where(eq(vendorsTable.id, w.paidByVendorId))
          .limit(1);
        paidByVendorName = v?.name ?? null;
      }
      return {
        id: w.id,
        clerkId: w.clerkId,
        clerkName: w.clerkName,
        amount: parseFloat(String(w.amount)),
        token: w.token,
        status: w.status,
        paidByVendorId: w.paidByVendorId,
        paidByVendorName,
        paidAt: w.paidAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
      };
    }),
  );

  res.json(results);
});

export default router;
