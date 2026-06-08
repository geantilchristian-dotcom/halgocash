import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, or } from "drizzle-orm";
import { db, usersTable, ticketsTable, drawsTable } from "@workspace/db";
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
 * Build a prize distribution for N tickets.
 * Structure per 1000 codes:
 *   1  × 50 000 FC  (Super Gagnant)
 *   2  × 25 000 FC  (Très Grand Gagnant)
 *  10  × 10 000 FC  (Grand Gagnant)
 *  10  ×  5 000 FC  (Gagnant)
 * 100  ×   price FC  (Remboursé)
 * 877 ×       0  FC  (Perdant)
 */
function buildPrizeDistribution(count: number, price: number): { prizeAmount: string | null; isWinner: boolean }[] {
  const r = count / 1000;

  const superCount      = Math.max(count >= 1000 ? 1 : 0, Math.round(1   * r));
  const tresGrandCount  = Math.max(count >= 500  ? 1 : 0, Math.round(2   * r));
  const grandCount      = Math.round(10  * r);
  const gagnantCount    = Math.round(10  * r);
  const petitCount      = Math.round(100 * r);

  const totalWinners = superCount + tresGrandCount + grandCount + gagnantCount + petitCount;
  const loserCount   = Math.max(0, count - totalWinners);

  const prizes: { prizeAmount: string | null; isWinner: boolean }[] = [
    ...Array<null>(superCount).fill(null).map(() => ({ prizeAmount: "50000",        isWinner: true  })),
    ...Array<null>(tresGrandCount).fill(null).map(() => ({ prizeAmount: "25000",    isWinner: true  })),
    ...Array<null>(grandCount).fill(null).map(() => ({ prizeAmount: "10000",        isWinner: true  })),
    ...Array<null>(gagnantCount).fill(null).map(() => ({ prizeAmount: "5000",       isWinner: true  })),
    ...Array<null>(petitCount).fill(null).map(() => ({ prizeAmount: String(price),  isWinner: true  })),
    ...Array<null>(loserCount).fill(null).map(() => ({ prizeAmount: null,           isWinner: false })),
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
  logger.info({ userId: user.id }, "Admin logged in");

  res.json({ id: user.id, email: user.email, username: user.username, role: user.role, vendorId: user.vendorId ?? null });
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
  const { count, price, series, drawId } = req.body as {
    count: number;
    price: number;
    series: string;
    drawId?: number;
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

  const insertValues = candidateCodes.slice(0, qty * 2).map((code, i) => ({
    code,
    status: "available" as const,
    price: String(ticketPrice),
    series: series ?? "A",
    drawId: drawId ?? null,
    vendorId: null,
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

export default router;
