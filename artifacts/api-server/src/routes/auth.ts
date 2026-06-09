import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, or, sum, and, isNotNull, desc } from "drizzle-orm";
import { db, usersTable, ticketsTable, withdrawalsTable } from "@workspace/db";
import { RegisterBody } from "@workspace/api-zod";
import { z } from "zod";
import { logger } from "../lib/logger";
import { getAuth } from "@clerk/express";
import { updatePresence } from "../lib/presence";
import { loginRateLimit, balanceCheckRateLimit } from "../middlewares/rateLimiters";

// Accept email address OR plain username
const VendorLoginBody = z.object({
  email: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

// POST /api/auth/register — only admin can create vendor/admin accounts
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const { email, username, password, role, vendorId } = parsed.data;

  // Block self-registration as admin or vendor — must be done by an admin session
  if (role === "admin" || role === "vendor") {
    const callerUserId = req.session.userId;
    if (!callerUserId) {
      res.status(403).json({ error: "Seul un administrateur peut créer ce type de compte" });
      return;
    }
    const [caller] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, callerUserId))
      .limit(1);
    if (caller?.role !== "admin") {
      res.status(403).json({ error: "Seul un administrateur peut créer ce type de compte" });
      return;
    }
  }

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
  req.session.save((saveErr) => {
    if (saveErr) {
      req.log.error({ err: saveErr }, "Session save failed");
      res.status(500).json({ error: "Erreur serveur" });
      return;
    }
    req.log.info({ userId: user!.id, role: user!.role }, "User registered");
    res.status(201).json({
      id: user!.id,
      email: user!.email,
      username: user!.username,
      role: user!.role,
      vendorId: user!.vendorId,
    });
  });
});

// POST /api/auth/login — rate-limited (anti-bruteforce)
router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = VendorLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Identifiants invalides" });
    return;
  }

  const { email: identifier, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.email, identifier), eq(usersTable.username, identifier)))
    .limit(1);

  if (!user) {
    // Constant-time response to prevent user enumeration
    await bcrypt.compare(password, "$2b$12$invalidhashfortimingprotection000000000000000000000000");
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

  // Regenerate session to prevent session fixation attacks
  req.session.regenerate((err) => {
    if (err) {
      logger.error({ err }, "Session regeneration failed");
      res.status(500).json({ error: "Erreur serveur" });
      return;
    }
    req.session.userId = user.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        req.log.error({ err: saveErr }, "Session save failed");
        res.status(500).json({ error: "Erreur serveur" });
        return;
      }
      req.log.info({ userId: user.id, role: user.role }, "User logged in");
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        vendorId: user.vendorId,
      });
    });
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
  res.clearCookie("halgosid");
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

// GET /api/auth/balance — rate-limited (anti-enumeration)
router.get("/auth/balance", balanceCheckRateLimit, async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  const sessionUserId = req.session.userId;
  const effectiveUserId = clerkUserId ?? (sessionUserId ? `local:${sessionUserId}` : null);

  if (!effectiveUserId) {
    res.json({ balance: 0 });
    return;
  }

  const [winsRow] = await db
    .select({ total: sum(ticketsTable.prizeAmount) })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.registeredByClerkId, effectiveUserId),
        eq(ticketsTable.isWinner, true),
        isNotNull(ticketsTable.prizeAmount),
      ),
    );

  const [paidRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, effectiveUserId), eq(withdrawalsTable.status, "paid")));

  const [pendingRow] = await db
    .select({ total: sum(withdrawalsTable.amount) })
    .from(withdrawalsTable)
    .where(and(eq(withdrawalsTable.clerkId, effectiveUserId), eq(withdrawalsTable.status, "pending")));

  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;

  res.json({ balance: Math.max(0, wins - paid - pending) });
});

// GET /api/auth/history — activated tickets for the current user
router.get("/auth/history", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  const sessionUserId = req.session.userId;
  const effectiveUserId = clerkUserId ?? (sessionUserId ? `local:${sessionUserId}` : null);

  if (!effectiveUserId) {
    res.json([]);
    return;
  }

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
    .where(eq(ticketsTable.registeredByClerkId, effectiveUserId))
    .orderBy(desc(ticketsTable.registeredAt))
    .limit(50);

  res.json(tickets.map((t) => ({
    ...t,
    prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : null,
    registeredAt: t.registeredAt?.toISOString() ?? null,
  })));
});

export default router;
