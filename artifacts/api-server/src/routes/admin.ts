import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, or, sql, count, sum, and, isNotNull, isNull } from "drizzle-orm";
import { db, usersTable, ticketsTable, drawsTable, vendorsTable, withdrawalsTable, playerProfilesTable, creditAdjustmentsTable, kycTable, supportMessagesTable, playerModerationTable, fcmTokensTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getOnlineUsers } from "../lib/presence";
import { loginRateLimit } from "../middlewares/rateLimiters";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const [user] = await db.select({
    id: usersTable.id, email: usersTable.email, username: usersTable.username,
    passwordHash: usersTable.passwordHash, role: usersTable.role,
    vendorId: usersTable.vendorId, isSuspended: usersTable.isSuspended,
    lastLoginAt: usersTable.lastLoginAt, lastLoginIp: usersTable.lastLoginIp,
    plainPassword: usersTable.plainPassword, createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
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

interface PrizeTiers {
  jackpot:     { count: number; prize: number };
  grand:       { count: number; prize: number };
  moyen:       { count: number; prize: number };
  petit:       { count: number; prize: number };
  rembourse:   { count: number; prize: number };
  consolation: { count: number; prize: number };
  perdant:     { count: number };
  totalWinners: number;
  prizePool:    number;
  companyRevenue: number;
  winRate:      number;
}

/**
 * Build a prize distribution with configurable company margin %.
 *
 * Rules:
 *   • losers    = round(N × margin)     — company keeps 100% of their ticket price
 *   • winners   = N − losers
 *   • prizePool = N × price × (1 − margin)
 *   • consolation floor = max(50 FC, floor(price × 10%))
 *     If budget can't afford the floor for all consolation slots, count is
 *     reduced (extras become additional losers) rather than paying below floor.
 *
 * Prize tiers per 1 000 tickets (scaled by N/1000):
 *   1  jackpot   = min(200×P, 30% prizePool)
 *   2  grand     = min(40×P,  10% prizePool)
 *   7  moyen     = min(10×P,   4% prizePool)
 *  15  petit     = min(4×P,    2% prizePool)
 *  25  remboursé = P exactly
 * rem  consolation ≥ floor per winner
 */
function buildPrizeDistribution(
  count: number,
  price: number,
  marginPercent: number,
): {
  prizes: { prizeAmount: string | null; isWinner: boolean }[];
  tiers: PrizeTiers;
} {
  const margin        = Math.max(0, Math.min(99, marginPercent)) / 100;
  const r             = count / 1000;
  const prizePool     = Math.floor(count * price * (1 - margin));
  const targetWinners = Math.round(count * (1 - margin));
  const minWin        = Math.max(50, Math.floor(price * 0.10));

  // ── Tier counts (scaled by lot size) ────────────────────────────────────
  const jackpotCount   = count >= 100 ? Math.max(1, Math.round(1  * r)) : 0;
  const grandCount     = count >= 200 ? Math.max(0, Math.round(2  * r)) : 0;
  const moyenCount     = Math.max(0, Math.round(7  * r));
  const petitCount     = Math.max(0, Math.round(15 * r));
  const rembourseCount = Math.max(0, Math.round(25 * r));

  // ── Prize amounts — multiples of price, capped as % of prize pool ────────
  const jackpotPrize   = Math.floor(Math.min(200 * price, prizePool * 0.30));
  const grandPrize     = Math.floor(Math.min(40  * price, prizePool * 0.10));
  const moyenPrize     = Math.floor(Math.min(10  * price, prizePool * 0.04));
  const petitPrize     = Math.floor(Math.min(4   * price, prizePool * 0.02));
  const remboursePrize = price;

  // ── Consolation ───────────────────────────────────────────────────────────
  const fixedSpend =
    jackpotCount * jackpotPrize + grandCount * grandPrize +
    moyenCount   * moyenPrize   + petitCount * petitPrize +
    rembourseCount * remboursePrize;
  const fixedWinners      = jackpotCount + grandCount + moyenCount + petitCount + rembourseCount;
  const consolationBudget = Math.max(0, prizePool - fixedSpend);
  let   consolationCount  = Math.max(0, targetWinners - fixedWinners);
  let   consolationPrize  = consolationCount > 0
    ? Math.floor(consolationBudget / consolationCount)
    : 0;

  // Enforce minimum — reduce count so each winner still gets at least minWin
  if (consolationPrize < minWin) {
    consolationCount = Math.floor(consolationBudget / minWin);
    consolationPrize = consolationCount > 0 ? minWin : 0;
  }

  const totalWinners  = fixedWinners + consolationCount;
  const loserCount    = count - totalWinners;
  const companyRevenue = count * price - prizePool;

  // ── Assemble and shuffle ─────────────────────────────────────────────────
  const prizes: { prizeAmount: string | null; isWinner: boolean }[] = [
    ...Array<null>(jackpotCount).fill(null).map(() => ({ prizeAmount: String(jackpotPrize),   isWinner: true })),
    ...Array<null>(grandCount).fill(null).map(() => ({ prizeAmount: String(grandPrize),        isWinner: true })),
    ...Array<null>(moyenCount).fill(null).map(() => ({ prizeAmount: String(moyenPrize),        isWinner: true })),
    ...Array<null>(petitCount).fill(null).map(() => ({ prizeAmount: String(petitPrize),        isWinner: true })),
    ...Array<null>(rembourseCount).fill(null).map(() => ({ prizeAmount: String(remboursePrize), isWinner: true })),
    ...Array<null>(consolationCount).fill(null).map(() => ({ prizeAmount: String(consolationPrize), isWinner: true })),
    ...Array<null>(loserCount).fill(null).map(() => ({ prizeAmount: null,                      isWinner: false })),
  ];

  return {
    prizes: shuffle(prizes),
    tiers: {
      jackpot:     { count: jackpotCount,   prize: jackpotPrize },
      grand:       { count: grandCount,     prize: grandPrize },
      moyen:       { count: moyenCount,     prize: moyenPrize },
      petit:       { count: petitCount,     prize: petitPrize },
      rembourse:   { count: rembourseCount, prize: remboursePrize },
      consolation: { count: consolationCount, prize: consolationPrize },
      perdant:     { count: loserCount },
      totalWinners,
      prizePool,
      companyRevenue,
      winRate: count > 0 ? Math.round((totalWinners / count) * 100) : 0,
    },
  };
}

// POST /api/admin/login — rate-limited (anti-bruteforce: 5 attempts / 15 min)
router.post("/admin/login", loginRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { identifier, password } = req.body as { identifier: string; password: string };
  if (!identifier || !password) {
    res.status(400).json({ error: "Identifiant et mot de passe requis" });
    return;
  }

  const [user] = await db
    .select({
      id:           usersTable.id,
      email:        usersTable.email,
      username:     usersTable.username,
      role:         usersTable.role,
      isSuspended:  usersTable.isSuspended,
      passwordHash: usersTable.passwordHash,
      vendorId:     usersTable.vendorId,
    })
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
  const rows = await db.execute(sql`
    SELECT id, email, username, role, is_suspended, last_login_at, last_login_ip,
           created_at, vendor_id,
           CASE WHEN device_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_device
    FROM users
    ORDER BY created_at DESC
  `);
  const users = ((rows as { rows?: Record<string, unknown>[] }).rows ?? (rows as unknown as Record<string, unknown>[]));
  const now = Date.now();
  res.json(
    users.map((u) => ({
      id: u["id"],
      email: u["email"],
      username: u["username"],
      role: u["role"],
      isSuspended: u["is_suspended"],
      hasDevice: u["has_device"],
      isOnline: u["last_login_at"] ? now - new Date(u["last_login_at"] as string).getTime() < 15 * 60 * 1000 : false,
      lastLoginAt: u["last_login_at"] ? new Date(u["last_login_at"] as string).toISOString() : null,
      lastLoginIp: u["last_login_ip"] ?? null,
      createdAt: new Date(u["created_at"] as string).toISOString(),
    })),
  );
});

// PATCH /api/admin/users/:id
router.patch("/admin/users/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]));
  const body = req.body as { isSuspended?: boolean; resetDevice?: boolean };

  if (body.resetDevice === true) {
    await db.execute(sql`UPDATE users SET device_id = NULL WHERE id = ${id}`);
    res.json({ success: true });
    return;
  }

  if (typeof body.isSuspended !== "boolean") {
    res.status(400).json({ error: "Paramètre invalide" });
    return;
  }
  await db.update(usersTable).set({ isSuspended: body.isSuspended }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

// POST /api/admin/codes/generate
router.post("/admin/codes/generate", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { count, price, series, drawId, vendorId, marginPercent } = req.body as {
    count: number;
    price: number;
    series: string;
    drawId?: number;
    vendorId?: number;
    marginPercent?: number;
  };

  const qty = Number(count);
  if (!qty || qty < 1 || qty > 5000) {
    res.status(400).json({ error: "Quantité invalide (1–5000)" });
    return;
  }

  const ticketPrice  = Number(price)        || 500;
  const marginPct    = Number(marginPercent) || 30;

  // Alphanumeric charset — no confusing chars (O/0/I/1/L)
  const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const genCode = () =>
    Array.from({ length: 10 }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join("");

  const codesSet = new Set<string>();
  while (codesSet.size < qty * 2) codesSet.add(genCode());
  const candidateCodes = Array.from(codesSet);

  // Build prize distribution with configurable margin
  const { prizes, tiers } = buildPrizeDistribution(qty, ticketPrice, marginPct);

  const assignedVendorId = vendorId ? Number(vendorId) : null;

  const insertValues = candidateCodes.slice(0, qty).map((code, i) => ({
    code,
    status: "available" as const,
    price: String(ticketPrice),
    series: series ?? "A",
    drawId: drawId ?? null,
    vendorId: assignedVendorId,
    isWinner:    prizes[i]?.isWinner    ?? false,
    prizeAmount: prizes[i]?.prizeAmount ?? null,
  }));

  const inserted = await db
    .insert(ticketsTable)
    .values(insertValues)
    .onConflictDoNothing()
    .returning({ id: ticketsTable.id, code: ticketsTable.code, isWinner: ticketsTable.isWinner, prizeAmount: ticketsTable.prizeAmount });

  const finalBatch = inserted.slice(0, qty);
  const actualWinners = finalBatch.filter((t) => t.isWinner).length;

  logger.info({ count: finalBatch.length, series, marginPct, winners: actualWinners }, "Admin generated ticket codes");

  res.json({
    generated:  finalBatch.length,
    winners:    actualWinners,
    losers:     finalBatch.filter((t) => !t.isWinner).length,
    winRate:    `${Math.round((actualWinners / finalBatch.length) * 100)}%`,
    codes:      finalBatch.map((t) => t.code),
    distribution: tiers,
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
    const [current] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, adminUser.id)).limit(1);
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
  const [updated] = await db.select({ id: usersTable.id, email: usersTable.email, username: usersTable.username, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, adminUser.id)).limit(1);
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
    .select({
      id:           usersTable.id,
      username:     usersTable.username,
      email:        usersTable.email,
      plainPassword: usersTable.plainPassword,
      isSuspended:  usersTable.isSuspended,
      vendorId:     usersTable.vendorId,
      authorizedIp: usersTable.authorizedIp,
      createdAt:    usersTable.createdAt,
    })
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
        authorizedIp: u.authorizedIp ?? null,
        createdAt: u.createdAt.toISOString(),
      };
    }),
  );

  res.json(results);
});

// DELETE /api/admin/workers/:userId/reset-ip — réinitialise l'IP autorisée d'un vendeur
router.delete("/admin/workers/:userId/reset-ip", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(String(req.params["userId"] ?? "0"), 10);
  if (!userId) { res.status(400).json({ error: "userId invalide" }); return; }

  await db.execute(sql`UPDATE users SET authorized_ip = NULL WHERE id = ${userId} AND vendor_id IS NOT NULL`);
  res.json({ success: true });
});

// POST /api/admin/workers/:userId/set-ip — force une IP autorisée manuellement
router.post("/admin/workers/:userId/set-ip", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(String(req.params["userId"] ?? "0"), 10);
  const { ip } = req.body as { ip?: string };
  if (!userId) { res.status(400).json({ error: "userId invalide" }); return; }
  if (!ip || typeof ip !== "string" || ip.trim().length === 0) {
    res.status(400).json({ error: "IP invalide" });
    return;
  }
  await db.execute(sql`UPDATE users SET authorized_ip = ${ip.trim()} WHERE id = ${userId} AND vendor_id IS NOT NULL`);
  res.json({ success: true, ip: ip.trim() });
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

  // Normalize email to lowercase
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim();

  // Helper: returns true if a user record is orphaned (vendor deleted but user remained)
  const isOrphan = async (vendorId: number | null): Promise<boolean> => {
    if (!vendorId) return true;
    const [v] = await db.select({ id: vendorsTable.id }).from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1);
    return !v;
  };

  // Check username uniqueness — auto-clean orphaned records
  const [existingUsername] = await db
    .select({ id: usersTable.id, vendorId: usersTable.vendorId })
    .from(usersTable)
    .where(eq(usersTable.username, normalizedUsername))
    .limit(1);
  if (existingUsername) {
    if (await isOrphan(existingUsername.vendorId ?? null)) {
      await db.delete(usersTable).where(eq(usersTable.id, existingUsername.id));
    } else {
      res.status(409).json({ error: "Nom d'utilisateur déjà pris par un compte actif." });
      return;
    }
  }

  // Check email uniqueness (case-insensitive) — auto-clean orphaned records
  const [existingEmail] = await db
    .select({ id: usersTable.id, vendorId: usersTable.vendorId })
    .from(usersTable)
    .where(sql`LOWER(${usersTable.email}) = ${normalizedEmail}`)
    .limit(1);
  if (existingEmail) {
    if (await isOrphan(existingEmail.vendorId ?? null)) {
      await db.delete(usersTable).where(eq(usersTable.id, existingEmail.id));
    } else {
      res.status(409).json({ error: "Cet email est déjà associé à un compte actif." });
      return;
    }
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
      email: normalizedEmail,
      username: username.trim(),
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

// PATCH /api/admin/workers/:userId — edit vendor worker credentials & info
router.patch("/admin/workers/:userId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const userId = parseInt(String(req.params["userId"]));
  const { username, email, password, vendorName, location, phone } = req.body as {
    username?: string; email?: string; password?: string;
    vendorName?: string; location?: string; phone?: string;
  };

  const [worker] = await db.select({
    id: usersTable.id, email: usersTable.email, username: usersTable.username,
    passwordHash: usersTable.passwordHash, role: usersTable.role,
    vendorId: usersTable.vendorId, isSuspended: usersTable.isSuspended,
    plainPassword: usersTable.plainPassword,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!worker || worker.role !== "vendor") { res.status(404).json({ error: "Vendeur introuvable" }); return; }

  // Check username/email uniqueness if changed
  if (username && username !== worker.username) {
    const [clash] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (clash) { res.status(409).json({ error: "Nom d'utilisateur déjà pris" }); return; }
  }
  const normalizedEditEmail = email ? email.toLowerCase().trim() : undefined;
  if (normalizedEditEmail && normalizedEditEmail !== worker.email) {
    const [clash] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEditEmail)).limit(1);
    if (clash) { res.status(409).json({ error: "Email déjà utilisé" }); return; }
  }

  // Update user record
  const userUpdates: Partial<typeof usersTable.$inferInsert> = {};
  if (username) userUpdates.username = username.trim();
  if (normalizedEditEmail) userUpdates.email = normalizedEditEmail;
  if (password) { userUpdates.passwordHash = await bcrypt.hash(password, 10); userUpdates.plainPassword = password; }
  if (Object.keys(userUpdates).length > 0) {
    await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, userId));
  }

  // Update vendor record
  if (worker.vendorId) {
    const vendorUpdates: Partial<typeof vendorsTable.$inferInsert> = {};
    if (vendorName) vendorUpdates.name = vendorName;
    if (location) vendorUpdates.location = location;
    if (phone !== undefined) vendorUpdates.phone = phone || null;
    if (Object.keys(vendorUpdates).length > 0) {
      await db.update(vendorsTable).set(vendorUpdates).where(eq(vendorsTable.id, worker.vendorId));
    }
  }

  res.json({ ok: true });
});

// GET /api/admin/players — list all Clerk players with referral stats
router.get("/admin/players", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const profiles = await db.select().from(playerProfilesTable).orderBy(desc(playerProfilesTable.createdAt));

  const results = await Promise.all(profiles.map(async (p) => {
    const [referralCountRow] = await db.select({ total: count() }).from(playerProfilesTable)
      .where(eq(playerProfilesTable.referredByCode, p.referralCode));
    const [ticketsCountRow] = await db.select({ total: count() }).from(creditAdjustmentsTable)
      .where(and(eq(creditAdjustmentsTable.clerkId, p.clerkId), eq(creditAdjustmentsTable.reason, "referral_ticket")));
    const [activatedRow] = await db.select({ total: count() }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, p.clerkId), isNotNull(ticketsTable.registeredAt)));
    const [winningsRow] = await db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, p.clerkId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.registeredAt)));

    const referralCount = Number(referralCountRow?.total ?? 0);
    const level = referralCount === 0 ? "Débutant" : referralCount <= 2 ? "Bronze" : referralCount <= 9 ? "Argent" : referralCount <= 24 ? "Or" : "Platine";

    return {
      clerkId: p.clerkId,
      playerId: p.referralCode.slice(0, 3) + "-" + p.referralCode.slice(3),
      referralCode: p.referralCode,
      referredByCode: p.referredByCode ?? null,
      referralCount,
      referralLevel: level,
      referralTickets: Number(ticketsCountRow?.total ?? 0),
      activatedTickets: Number(activatedRow?.total ?? 0),
      totalWinnings: parseFloat(String(winningsRow?.total ?? "0")),
      createdAt: p.createdAt.toISOString(),
    };
  }));

  res.json(results);
});

// GET /api/admin/winners/leaderboard — top players ranked by total winnings
router.get("/admin/winners/leaderboard", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  // Aggregate winning tickets per Clerk player
  const rows = await db
    .select({
      clerkId: ticketsTable.registeredByClerkId,
      totalWinnings: sum(ticketsTable.prizeAmount),
      winningTickets: count(),
    })
    .from(ticketsTable)
    .where(and(
      eq(ticketsTable.isWinner, true),
      isNotNull(ticketsTable.registeredAt),
      isNotNull(ticketsTable.registeredByClerkId),
    ))
    .groupBy(ticketsTable.registeredByClerkId)
    .orderBy(desc(sum(ticketsTable.prizeAmount)))
    .limit(100);

  const results = await Promise.all(rows.map(async (r, idx) => {
    const [profile] = await db.select().from(playerProfilesTable)
      .where(eq(playerProfilesTable.clerkId, r.clerkId!)).limit(1);
    const playerId = profile
      ? profile.referralCode.slice(0, 3) + "-" + profile.referralCode.slice(3)
      : r.clerkId!.slice(0, 8) + "…";

    // Best single prize
    const [bestRow] = await db.select({ best: ticketsTable.prizeAmount })
      .from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, r.clerkId!), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.registeredAt)))
      .orderBy(desc(ticketsTable.prizeAmount)).limit(1);

    return {
      rank: idx + 1,
      clerkId: r.clerkId,
      playerId,
      totalWinnings: parseFloat(String(r.totalWinnings ?? "0")),
      winningTickets: Number(r.winningTickets ?? 0),
      bestPrize: parseFloat(String(bestRow?.best ?? "0")),
    };
  }));

  res.json(results);
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

// ── KYC Admin ──────────────────────────────────────────────────────────────

router.get("/admin/kyc", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query as { status?: string };
  const rows = await db.select().from(kycTable)
    .where(status && status !== "all" ? eq(kycTable.status, status) : undefined)
    .orderBy(desc(kycTable.submittedAt));
  res.json(rows.map(r => ({ ...r, submittedAt: r.submittedAt.toISOString(), reviewedAt: r.reviewedAt?.toISOString() ?? null })));
});

router.patch("/admin/kyc/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id ?? "0"), 10);
  if (!id) { res.status(400).json({ error: "ID invalide" }); return; }
  const { status, adminNote } = req.body as { status?: string; adminNote?: string };
  if (!status || !["approved", "rejected"].includes(status)) { res.status(400).json({ error: "Statut invalide" }); return; }
  const [updated] = await db.update(kycTable).set({ status, adminNote: adminNote ?? null, reviewedAt: new Date() }).where(eq(kycTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Dossier introuvable" }); return; }
  res.json({ ok: true, status: updated.status });
});

// ── Support Admin ──────────────────────────────────────────────────────────

router.get("/admin/support", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(supportMessagesTable).orderBy(desc(supportMessagesTable.createdAt));
  const sessionsMap = new Map<string, { sessionId: string; clerkId: string; clerkName: string; lastMessage: string; lastAt: string; unread: number }>();
  for (const row of rows) {
    if (!sessionsMap.has(row.sessionId)) {
      sessionsMap.set(row.sessionId, { sessionId: row.sessionId, clerkId: row.clerkId, clerkName: row.clerkName, lastMessage: row.message, lastAt: row.createdAt.toISOString(), unread: 0 });
    }
    if (!row.fromAdmin && !row.isRead) {
      sessionsMap.get(row.sessionId)!.unread++;
    }
  }
  res.json(Array.from(sessionsMap.values()));
});

router.get("/admin/support/:sessionId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId ?? "");
  const msgs = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.sessionId, sessionId))
    .orderBy(supportMessagesTable.createdAt);
  await db.update(supportMessagesTable).set({ isRead: true }).where(and(eq(supportMessagesTable.sessionId, sessionId), eq(supportMessagesTable.fromAdmin, false)));
  res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/admin/support/reply/:sessionId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const sessionId = String(req.params.sessionId ?? "");
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message vide" }); return; }
  const [first] = await db.select({ clerkId: supportMessagesTable.clerkId }).from(supportMessagesTable).where(eq(supportMessagesTable.sessionId, sessionId)).limit(1);
  const clerkId = first?.clerkId ?? sessionId;
  const [saved] = await db.insert(supportMessagesTable).values({ sessionId, clerkId, clerkName: "Admin", message: message.slice(0, 2000), fromAdmin: true, isRead: false }).returning();
  res.status(201).json({ ...saved, createdAt: saved!.createdAt.toISOString() });
});

// ── Player Detail + Moderation ─────────────────────────────────────────────

async function upsertModeration(clerkId: string, data: Partial<{ status: string; blockedEmail: string | null; blockedIp: string | null; warnCount: number; adminNotes: string | null }>): Promise<void> {
  const [existing] = await db.select({ clerkId: playerModerationTable.clerkId }).from(playerModerationTable).where(eq(playerModerationTable.clerkId, clerkId)).limit(1);
  if (existing) {
    await db.update(playerModerationTable).set({ ...data, updatedAt: new Date() }).where(eq(playerModerationTable.clerkId, clerkId));
  } else {
    await db.insert(playerModerationTable).values({ clerkId, status: "active", warnCount: 0, ...data });
  }
}

async function sendAdminMsg(clerkId: string, message: string): Promise<void> {
  await db.insert(supportMessagesTable).values({
    sessionId: clerkId,
    clerkId,
    clerkName: "Admin Halgo",
    message: message.slice(0, 2000),
    fromAdmin: true,
    isRead: false,
  });
}

// GET /api/admin/players/:clerkId — full player detail
router.get("/admin/players/:clerkId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  if (!clerkId) { res.status(400).json({ error: "clerkId requis" }); return; }

  const [profile, credits, tickets, withdrawals, kyc, messages, moderation] = await Promise.all([
    db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkId, clerkId)).limit(1),
    db.select().from(creditAdjustmentsTable).where(eq(creditAdjustmentsTable.clerkId, clerkId)).orderBy(desc(creditAdjustmentsTable.createdAt)).limit(200),
    db.select().from(ticketsTable).where(eq(ticketsTable.registeredByClerkId, clerkId)).orderBy(desc(ticketsTable.registeredAt)).limit(100),
    db.select().from(withdrawalsTable).where(eq(withdrawalsTable.clerkId, clerkId)).orderBy(desc(withdrawalsTable.createdAt)).limit(100),
    db.select().from(kycTable).where(eq(kycTable.clerkId, clerkId)).limit(1),
    db.select().from(supportMessagesTable).where(eq(supportMessagesTable.clerkId, clerkId)).orderBy(supportMessagesTable.createdAt).limit(100),
    db.select().from(playerModerationTable).where(eq(playerModerationTable.clerkId, clerkId)).limit(1),
  ]);

  const balance = credits.reduce((s, c) => s + parseFloat(String(c.amount)), 0);
  const clerkName = messages[0]?.clerkName ?? kyc[0]?.fullName ?? clerkId.slice(-8).toUpperCase();

  res.json({
    clerkId,
    clerkName,
    profile: profile[0] ? {
      referralCode: profile[0].referralCode,
      referredByCode: profile[0].referredByCode ?? null,
      createdAt: profile[0].createdAt.toISOString(),
    } : null,
    balance: Math.max(0, balance),
    credits: credits.map(c => ({ id: c.id, amount: parseFloat(String(c.amount)), reason: c.reason, refId: c.refId ?? null, createdAt: c.createdAt.toISOString() })),
    tickets: tickets.map(t => ({ id: t.id, code: t.code, status: t.status, isWinner: t.isWinner, prizeAmount: t.prizeAmount ? parseFloat(String(t.prizeAmount)) : null, registeredAt: t.registeredAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    withdrawals: withdrawals.map(w => ({ id: w.id, amount: parseFloat(String(w.amount)), status: w.status, paidAt: w.paidAt?.toISOString() ?? null, createdAt: w.createdAt.toISOString() })),
    kyc: kyc[0] ? { status: kyc[0].status, fullName: kyc[0].fullName, adminNote: kyc[0].adminNote ?? null, submittedAt: kyc[0].submittedAt.toISOString() } : null,
    messages: messages.map(m => ({ id: m.id, message: m.message, fromAdmin: m.fromAdmin, createdAt: m.createdAt.toISOString() })),
    moderation: moderation[0] ? {
      status: moderation[0].status,
      blockedEmail: moderation[0].blockedEmail ?? null,
      blockedIp: moderation[0].blockedIp ?? null,
      warnCount: moderation[0].warnCount,
      adminNotes: moderation[0].adminNotes ?? null,
    } : { status: "active", blockedEmail: null, blockedIp: null, warnCount: 0, adminNotes: null },
  });
});

// POST /api/admin/players/:clerkId/pause
router.post("/admin/players/:clerkId/pause", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  await upsertModeration(clerkId, { status: "paused" });
  await sendAdminMsg(clerkId, "⏸️ Votre compte a été temporairement suspendu par l'administration. Contactez le support pour plus d'informations.");
  res.json({ ok: true });
});

// POST /api/admin/players/:clerkId/resume
router.post("/admin/players/:clerkId/resume", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  await upsertModeration(clerkId, { status: "active" });
  await sendAdminMsg(clerkId, "✅ Votre compte a été réactivé. Vous pouvez maintenant utiliser toutes les fonctionnalités normalement.");
  res.json({ ok: true });
});

// POST /api/admin/players/:clerkId/warn
router.post("/admin/players/:clerkId/warn", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  const { message, notes } = req.body as { message?: string; notes?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message requis" }); return; }
  const [existing] = await db.select({ warnCount: playerModerationTable.warnCount }).from(playerModerationTable).where(eq(playerModerationTable.clerkId, clerkId)).limit(1);
  const newCount = (existing?.warnCount ?? 0) + 1;
  await upsertModeration(clerkId, { warnCount: newCount, adminNotes: notes?.trim() || undefined });
  await sendAdminMsg(clerkId, `⚠️ AVERTISSEMENT #${newCount} : ${message.trim()}`);
  res.json({ ok: true, warnCount: newCount });
});

// POST /api/admin/players/:clerkId/block
router.post("/admin/players/:clerkId/block", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  const { blockedEmail, blockedIp, notes } = req.body as { blockedEmail?: string; blockedIp?: string; notes?: string };
  await upsertModeration(clerkId, {
    status: "blocked",
    blockedEmail: blockedEmail?.trim() || null,
    blockedIp: blockedIp?.trim() || null,
    adminNotes: notes?.trim() || null,
  });
  await sendAdminMsg(clerkId, "🚫 Votre compte a été bloqué. Pour tout recours, veuillez contacter notre support.");
  res.json({ ok: true });
});

// POST /api/admin/players/:clerkId/message — send custom alert
router.post("/admin/players/:clerkId/message", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message requis" }); return; }
  await sendAdminMsg(clerkId, message.trim());
  res.json({ ok: true });
});

// GET /api/admin/pending-counts — lightweight endpoint for sidebar badges
router.get("/admin/pending-counts", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const [wRow] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.status, "pending"));

  const [kRow] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(kycTable)
    .where(eq(kycTable.status, "pending"));

  const [sRow] = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(supportMessagesTable)
    .where(and(eq(supportMessagesTable.fromAdmin, false), eq(supportMessagesTable.isRead, false)));

  const [aRow] = await db.execute(sql`SELECT COUNT(*) AS cnt FROM vendor_alarms WHERE status = 'active'`);
  const alarmsArr = (aRow as unknown as { rows?: { cnt: string }[] })?.rows ?? [aRow as unknown as { cnt: string }];
  const activeAlarms = Number((alarmsArr[0] as { cnt: string })?.cnt ?? 0);

  res.json({
    pendingWithdrawals: Number(wRow?.cnt ?? 0),
    pendingKyc: Number(kRow?.cnt ?? 0),
    unreadSupport: Number(sRow?.cnt ?? 0),
    activeAlarms,
  });
});

// DELETE /api/admin/players/:clerkId — admin deletes player account data
router.delete("/admin/players/:clerkId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const clerkId = String(req.params["clerkId"] ?? "");
  if (!clerkId) { res.status(400).json({ error: "clerkId requis" }); return; }
  await Promise.all([
    db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkId, clerkId)),
    db.delete(creditAdjustmentsTable).where(eq(creditAdjustmentsTable.clerkId, clerkId)),
    db.delete(supportMessagesTable).where(eq(supportMessagesTable.clerkId, clerkId)),
    db.delete(playerModerationTable).where(eq(playerModerationTable.clerkId, clerkId)),
    db.delete(kycTable).where(eq(kycTable.clerkId, clerkId)),
    db.delete(fcmTokensTable).where(eq(fcmTokensTable.clerkId, clerkId)),
  ]);
  res.json({ ok: true });
});

// ── DELETE /api/admin/vendors/:vendorId ───────────────────────────────────────
// Supprime un point de vente et détache ses comptes workers.
// Refuse la suppression si des tickets non-écoulés sont encore assignés.
router.delete("/admin/vendors/:vendorId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const vendorId = parseInt(String(req.params["vendorId"] ?? ""), 10);
  if (!vendorId || isNaN(vendorId)) {
    res.status(400).json({ error: "vendorId invalide" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorId)).limit(1);
  if (!vendor) {
    res.status(404).json({ error: "Vendeur introuvable" });
    return;
  }

  // Annuler les tickets non-écoulés encore liés à ce vendeur
  const cancelResult = await db
    .update(ticketsTable)
    .set({ status: "cancelled", vendorId: null })
    .where(and(
      eq(ticketsTable.vendorId, vendorId),
      or(
        sql`${ticketsTable.status} = 'available'`,
        sql`${ticketsTable.status} = 'assigned'`,
      ),
    ))
    .returning({ id: ticketsTable.id });

  const cancelledCount = cancelResult.length;

  // Supprimer les comptes users liés à ce vendeur
  await db
    .delete(usersTable)
    .where(eq(usersTable.vendorId, vendorId));

  // Supprimer le vendeur
  await db.delete(vendorsTable).where(eq(vendorsTable.id, vendorId));

  logger.info({ vendorId, vendorName: vendor.name, cancelledCount }, "Admin deleted vendor, cancelled remaining tickets and removed user accounts");
  res.json({ ok: true, deleted: vendor.name, cancelledTickets: cancelledCount });
});

export default router;
