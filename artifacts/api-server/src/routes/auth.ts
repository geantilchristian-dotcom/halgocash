import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, or, sum, and, isNotNull } from "drizzle-orm";
import { db, usersTable, ticketsTable, withdrawalsTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { getAuth } from "@clerk/express";
import { updatePresence } from "../lib/presence";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, username, password, role, vendorId } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(or(eq(usersTable.email, email), eq(usersTable.username, username)))
    .limit(1);

  if (existing.length > 0) {
    res.status(400).json({ error: "Email ou nom d'utilisateur déjà utilisé" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({ email, username, passwordHash, role: role ?? "player", vendorId: vendorId ?? null })
    .returning();

  req.session.userId = user!.id;

  req.log.info({ userId: user!.id, role: user!.role }, "User registered");

  res.status(201).json({
    id: user!.id,
    email: user!.email,
    username: user!.username,
    role: user!.role,
    vendorId: user!.vendorId,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ error: "Compte suspendu. Contactez l'administrateur." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    "unknown";

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), lastLoginIp: ip })
    .where(eq(usersTable.id, user.id));

  req.session.userId = user.id;

  req.log.info({ userId: user.id, role: user.role }, "User logged in");

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    vendorId: user.vendorId,
  });
});

// POST /api/auth/ping — player presence tracking (Clerk-authenticated)
router.post("/auth/ping", (req, res): void => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const name = ((req.body as Record<string, unknown>).name as string | undefined) ?? "Utilisateur";
  updatePresence(userId, name);
  res.json({ ok: true });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, "Session destroy failed");
    }
  });
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalide" });
    return;
  }

  if (user.isSuspended) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "Compte suspendu" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    vendorId: user.vendorId,
  });
});

// GET /api/auth/balance — available balance = wins - paid withdrawals - pending withdrawals
router.get("/auth/balance", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.json({ balance: 0 });
    return;
  }

  const [winsRow] = await db
    .select({ total: sum(ticketsTable.prizeAmount) })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.registeredByClerkId, userId),
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.prizeAmount),
      ),
    );

  const [paidRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "paid")));

  const [pendingRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, userId), eq(withdrawalsTable.status, "pending")));

  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;

  res.json({ balance: Math.max(0, wins - paid - pending) });
});

export default router;
