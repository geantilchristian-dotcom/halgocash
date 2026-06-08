import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, or } from "drizzle-orm";
import { db, usersTable, ticketsTable, drawsTable } from "@workspace/db";
import { logger } from "../lib/logger";

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

// POST /api/admin/login — accepts identifier (username OR email) + password
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

  if (!user) {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "Accès réservé aux administrateurs" });
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

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    vendorId: user.vendorId ?? null,
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
  const { count, price, series, drawId } = req.body as {
    count: number;
    price: number;
    series: string;
    drawId?: number;
  };

  const qty = Number(count);
  if (!qty || qty < 1 || qty > 500) {
    res.status(400).json({ error: "Quantité invalide (1–500)" });
    return;
  }

  // Generate unique 10-digit codes
  const codes: string[] = [];
  while (codes.length < qty * 2) {
    const code = String(Math.floor(Math.random() * 10_000_000_000)).padStart(10, "0");
    if (!codes.includes(code)) codes.push(code);
  }

  const insertValues = codes.map((code) => ({
    code,
    status: "available" as const,
    price: String(price ?? "500"),
    series: series ?? "A",
    drawId: drawId ?? null,
    vendorId: null,
  }));

  const inserted = await db
    .insert(ticketsTable)
    .values(insertValues)
    .onConflictDoNothing()
    .returning({ id: ticketsTable.id, code: ticketsTable.code });

  const finalCodes = inserted.slice(0, qty);

  logger.info({ count: finalCodes.length }, "Admin generated ticket codes");

  res.json({
    generated: finalCodes.length,
    codes: finalCodes.map((t) => t.code),
  });
});

// GET /api/admin/draws (for code generation dropdown)
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

export default router;
