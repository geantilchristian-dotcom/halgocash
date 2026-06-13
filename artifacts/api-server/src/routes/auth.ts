import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, or, sum, and, isNotNull, desc, count, sql } from "drizzle-orm";
import { db, usersTable, ticketsTable, withdrawalsTable, playerProfilesTable, creditAdjustmentsTable } from "@workspace/db";
import { RegisterBody } from "@workspace/api-zod";
import { z } from "zod";
import { logger } from "../lib/logger";
import { getAuth } from "@clerk/express";
import { updatePresence } from "../lib/presence";
import { loginRateLimit, balanceCheckRateLimit } from "../middlewares/rateLimiters";

function generateReferralCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const chars   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateReferralTicket(): { code: string; isWinner: boolean; prizeAmount: string | null } {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 10; i++) code += digits[Math.floor(Math.random() * 10)];
  const roll = Math.floor(Math.random() * 100);
  if (roll < 30)       return { code, isWinner: true,  prizeAmount: "100" };
  else if (roll < 50)  return { code, isWinner: true,  prizeAmount: "200" };
  else if (roll < 57)  return { code, isWinner: true,  prizeAmount: "300" };
  else if (roll < 60)  return { code, isWinner: true,  prizeAmount: "500" };
  else                 return { code, isWinner: false, prizeAmount: null  };
}

async function getOrCreateProfile(clerkId: string) {
  const [existing] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.clerkId, clerkId)).limit(1);
  if (existing) return existing;
  let referralCode = generateReferralCode();
  for (let i = 0; i < 9; i++) {
    const [clash] = await db.select({ id: playerProfilesTable.id }).from(playerProfilesTable).where(eq(playerProfilesTable.referralCode, referralCode)).limit(1);
    if (!clash) break;
    referralCode = generateReferralCode();
  }
  const [created] = await db.insert(playerProfilesTable).values({ clerkId, referralCode }).returning();
  return created!;
}

// Accept email address OR plain username
const VendorLoginBody = z.object({
  email: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
  deviceId: z.string().max(64).optional(),
});

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

// POST /api/auth/register — admin session required for ALL account creation
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const { email, username, password, role, vendorId } = parsed.data;

  // All account creation (vendor, admin, player) requires an active admin session.
  // No self-registration is allowed from any public form.
  const callerUserId = req.session.userId;
  if (!callerUserId) {
    res.status(403).json({ error: "Seul un administrateur peut créer des comptes" });
    return;
  }
  const [caller] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, callerUserId))
    .limit(1);
  if (caller?.role !== "admin") {
    res.status(403).json({ error: "Seul un administrateur peut créer des comptes" });
    return;
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

  const { email: rawIdentifier, password, deviceId } = parsed.data;
  const identifier      = rawIdentifier.trim();
  const identifierLower = identifier.toLowerCase();

  // Utilise LOWER() pour une comparaison insensible à la casse (email stocké avec n'importe quelle casse)
  // Sélection explicite des colonnes pour éviter une erreur si device_id n'existe pas encore en prod
  const [user] = await db
    .select({
      id:           usersTable.id,
      email:        usersTable.email,
      username:     usersTable.username,
      passwordHash: usersTable.passwordHash,
      role:         usersTable.role,
      vendorId:     usersTable.vendorId,
      isSuspended:  usersTable.isSuspended,
      lastLoginAt:  usersTable.lastLoginAt,
      lastLoginIp:  usersTable.lastLoginIp,
      plainPassword: usersTable.plainPassword,
      createdAt:    usersTable.createdAt,
      authorizedIp: usersTable.authorizedIp,
    })
    .from(usersTable)
    .where(or(
      sql`LOWER(${usersTable.email}) = ${identifierLower}`,
      eq(usersTable.username, identifier),
    ))
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

  // ── Verrouillage IP — comptes vendeur uniquement ──────────────────────────
  // L'admin fixe l'IP autorisée depuis le panneau "Points de vente".
  // Tant qu'aucune IP n'est définie → connexion libre.
  // Une fois l'IP définie → seul cet appareil est autorisé.
  if (user.role === "vendor") {
    try {
      const storedIp = user.authorizedIp ?? null;

      if (storedIp !== null && storedIp !== ip) {
        res.status(403).json({
          error: "Connexion refusée : cet appareil n'est pas autorisé. Contactez l'administrateur.",
        });
        return;
      }
    } catch (ipErr) {
      // Colonne pas encore en prod — on laisse passer
      logger.warn({ err: ipErr }, "IP binding skipped (column may not exist yet)");
    }
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), lastLoginIp: ip })
    .where(eq(usersTable.id, user.id));

  // Set session — regenerate first if possible (anti session-fixation)
  const setSession = () => {
    req.session.userId = user.id;
    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error({ err: saveErr }, "Session save failed");
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
  };

  req.session.regenerate((err) => {
    if (err) {
      // MemoryStore peut échouer sur regenerate — on continue directement
      logger.warn({ err }, "Session regenerate failed, setting directly");
      setSession();
      return;
    }
    setSession();
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
    .select({
      id:           usersTable.id,
      email:        usersTable.email,
      username:     usersTable.username,
      passwordHash: usersTable.passwordHash,
      role:         usersTable.role,
      vendorId:     usersTable.vendorId,
      isSuspended:  usersTable.isSuspended,
      lastLoginAt:  usersTable.lastLoginAt,
      lastLoginIp:  usersTable.lastLoginIp,
      plainPassword: usersTable.plainPassword,
      createdAt:    usersTable.createdAt,
    })
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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  const { userId: clerkUserId } = getAuth(req);
  const sessionUserId = req.session.userId;
  const effectiveUserId = clerkUserId ?? (sessionUserId ? `local:${sessionUserId}` : null);

  if (!effectiveUserId) {
    res.json({ balance: 0 });
    return;
  }

  // Ensure every Clerk-authenticated user has a player profile (for transfers)
  if (clerkUserId) {
    getOrCreateProfile(clerkUserId).catch(() => {});
  }

  const [[winsRow], [paidRow], [pendingRow], [creditsRow]] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, effectiveUserId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, effectiveUserId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, effectiveUserId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, effectiveUserId)),
  ]);

  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;
  const credits = creditsRow?.total ? parseFloat(String(creditsRow.total)) : 0;

  res.json({ balance: Math.max(0, wins + credits - paid - pending) });
});

// GET /api/auth/notifications — wins + withdrawals for the current player
router.get("/auth/notifications", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  const sessionUserId = req.session.userId;
  const effectiveUserId = clerkUserId ?? (sessionUserId ? `local:${sessionUserId}` : null);

  if (!effectiveUserId) {
    res.set("Cache-Control", "no-store");
    res.json({ count: 0, items: [] });
    return;
  }

  // 1. Winning ticket activations
  const wins = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.registeredByClerkId, effectiveUserId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.registeredAt)))
    .orderBy(desc(ticketsTable.registeredAt))
    .limit(30);

  // 2. All withdrawals (pending, paid, cancelled)
  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.clerkId, effectiveUserId))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(20);

  type NotifItem = {
    id: string;
    type: "ticket_win" | "withdrawal_paid" | "withdrawal_pending" | "withdrawal_cancelled" | "referral_ticket";
    message: string;
    amount: number;
    date: string;
  };

  const items: NotifItem[] = [];

  for (const t of wins) {
    const prize = parseFloat(t.prizeAmount ?? "0");
    let label = "Gagnant";
    if (prize >= 50000)      label = "Jackpot 🏆";
    else if (prize >= 25000) label = "Très Grand Gagnant 💎";
    else if (prize >= 10000) label = "Grand Gagnant 🥇";
    else if (prize >= 5000)  label = "Gagnant 🎉";
    else if (prize >= 2000)  label = "Bon Gagnant ✨";
    else if (prize >= 1000)  label = "Petit Gagnant 🌟";
    else if (prize >= 500)   label = "Micro Gagnant 👍";
    else if (prize >= 200)   label = "Consolation 🎁";
    else                     label = "Remboursé 🔄";

    items.push({
      id: `t-${t.id}`,
      type: "ticket_win",
      message: `${label} — ${prize.toLocaleString("fr-FR")} FC (ticket ${t.code})`,
      amount: prize,
      date: t.registeredAt!.toISOString(),
    });
  }

  for (const w of withdrawals) {
    const amt = parseFloat(w.amount);
    if (w.status === "paid" && w.paidAt) {
      items.push({
        id: `wp-${w.id}`,
        type: "withdrawal_paid",
        message: `Retrait de ${amt.toLocaleString("fr-FR")} FC confirmé ✅`,
        amount: amt,
        date: w.paidAt.toISOString(),
      });
    } else if (w.status === "pending") {
      items.push({
        id: `ww-${w.id}`,
        type: "withdrawal_pending",
        message: `Retrait de ${amt.toLocaleString("fr-FR")} FC en attente de paiement`,
        amount: amt,
        date: w.createdAt.toISOString(),
      });
    } else if (w.status === "cancelled") {
      items.push({
        id: `wc-${w.id}`,
        type: "withdrawal_cancelled",
        message: `Retrait de ${amt.toLocaleString("fr-FR")} FC annulé`,
        amount: amt,
        date: w.createdAt.toISOString(),
      });
    }
  }

  // 3. Referral tickets received (code to scratch)
  const referralTickets = await db
    .select()
    .from(creditAdjustmentsTable)
    .where(and(eq(creditAdjustmentsTable.clerkId, effectiveUserId), eq(creditAdjustmentsTable.reason, "referral_ticket")))
    .orderBy(desc(creditAdjustmentsTable.createdAt))
    .limit(20);

  for (const b of referralTickets) {
    const code = b.refId ?? "?";
    items.push({ id: `rt-${b.id}`, type: "referral_ticket", message: `🎟️ Billet de parrainage reçu ! Code : ${code} — Grattez-le dans la barre de tickets`, amount: 0, date: b.createdAt.toISOString() });
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.set("Cache-Control", "no-store");
  res.json({ count: items.length, items });
});

// GET /api/auth/profile — player referral profile (creates if not exists)
router.get("/auth/profile", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const profile = await getOrCreateProfile(clerkUserId);

  const [referralCountRow] = await db
    .select({ total: count() })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.referredByCode, profile.referralCode));

  const [ticketsCountRow] = await db
    .select({ total: count() })
    .from(creditAdjustmentsTable)
    .where(and(eq(creditAdjustmentsTable.clerkId, clerkUserId), eq(creditAdjustmentsTable.reason, "referral_ticket")));

  res.json({
    referralCode: profile.referralCode,
    referredByCode: profile.referredByCode ?? null,
    referralCount: referralCountRow?.total ?? 0,
    referralTickets: ticketsCountRow?.total ?? 0,
  });
});

// POST /api/auth/referral/use — claim a referral code after sign-up
router.post("/auth/referral/use", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "Code requis" }); return; }

  const normalizedCode = code.trim().toUpperCase();

  const profile = await getOrCreateProfile(clerkUserId);

  if (profile.referredByCode) { res.status(400).json({ error: "Vous avez déjà utilisé un code de parrainage" }); return; }
  if (profile.referralCode === normalizedCode) { res.status(400).json({ error: "Vous ne pouvez pas utiliser votre propre code" }); return; }

  const [referrer] = await db.select().from(playerProfilesTable).where(eq(playerProfilesTable.referralCode, normalizedCode)).limit(1);
  if (!referrer) { res.status(404).json({ error: "Code de parrainage introuvable" }); return; }

  await db.update(playerProfilesTable).set({ referredByCode: normalizedCode }).where(eq(playerProfilesTable.clerkId, clerkUserId));

  // Generate a free referral ticket for the referrer
  let ticketInfo = generateReferralTicket();
  for (let attempt = 0; attempt < 8; attempt++) {
    const [clash] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(eq(ticketsTable.code, ticketInfo.code)).limit(1);
    if (!clash) break;
    ticketInfo = generateReferralTicket();
  }
  await db.insert(ticketsTable).values({
    code: ticketInfo.code,
    series: "REF",
    status: "available",
    price: "0",
    isWinner: ticketInfo.isWinner,
    prizeAmount: ticketInfo.prizeAmount,
  });
  // Notification record for referrer (amount = 0, ticket prize counted on activation)
  await db.insert(creditAdjustmentsTable).values({
    clerkId: referrer.clerkId,
    amount: "0",
    reason: "referral_ticket",
    refId: ticketInfo.code,
  });

  req.log.info({ clerkUserId, normalizedCode, ticketCode: ticketInfo.code }, "Referral code claimed");
  res.json({ ok: true });
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

// GET /api/auth/tickets — same as history but includes price
router.get("/auth/tickets", async (req, res): Promise<void> => {
  const { userId: clerkUserId } = getAuth(req);
  const sessionUserId = req.session.userId;
  const effectiveUserId = clerkUserId ?? (sessionUserId ? `local:${sessionUserId}` : null);
  if (!effectiveUserId) { res.json([]); return; }
  const tickets = await db
    .select({
      id: ticketsTable.id,
      code: ticketsTable.code,
      series: ticketsTable.series,
      price: ticketsTable.price,
      isWinner: ticketsTable.isWinner,
      prizeAmount: ticketsTable.prizeAmount,
      registeredAt: ticketsTable.registeredAt,
    })
    .from(ticketsTable)
    .where(eq(ticketsTable.registeredByClerkId, effectiveUserId))
    .orderBy(desc(ticketsTable.registeredAt))
    .limit(200);
  res.json(tickets.map((t) => ({
    ...t,
    price: t.price ? parseFloat(t.price) : 0,
    prizeAmount: t.prizeAmount ? parseFloat(t.prizeAmount) : null,
    registeredAt: t.registeredAt?.toISOString() ?? null,
  })));
});

export default router;
