import { Router, type IRouter } from "express";
import { eq, sum, and, isNotNull } from "drizzle-orm";
import { db, playerProfilesTable, creditAdjustmentsTable, ticketsTable, withdrawalsTable, supportMessagesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { transferRateLimit } from "../middlewares/rateLimiters";

const router: IRouter = Router();

async function getBalance(clerkId: string): Promise<number> {
  const [[winsRow], [paidRow], [pendingRow], [creditsRow]] = await Promise.all([
    db.select({ total: sum(ticketsTable.prizeAmount) }).from(ticketsTable)
      .where(and(eq(ticketsTable.registeredByClerkId, clerkId), eq(ticketsTable.isWinner, true), isNotNull(ticketsTable.prizeAmount))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "paid"))),
    db.select({ total: sum(withdrawalsTable.amount) }).from(withdrawalsTable)
      .where(and(eq(withdrawalsTable.clerkId, clerkId), eq(withdrawalsTable.status, "pending"))),
    db.select({ total: sum(creditAdjustmentsTable.amount) }).from(creditAdjustmentsTable)
      .where(eq(creditAdjustmentsTable.clerkId, clerkId)),
  ]);
  const wins    = winsRow?.total    ? parseFloat(String(winsRow.total))    : 0;
  const paid    = paidRow?.total    ? parseFloat(String(paidRow.total))    : 0;
  const pending = pendingRow?.total ? parseFloat(String(pendingRow.total)) : 0;
  const credits = creditsRow?.total ? parseFloat(String(creditsRow.total)) : 0;
  return Math.max(0, wins + credits - paid - pending);
}

const SendBody = z.object({
  recipientCode: z.string().min(3).max(20),
  amount: z.number().positive().max(10_000_000),
});

router.get("/transfer/validate/:code", async (req, res): Promise<void> => {
  const code = (req.params.code ?? "").trim().toUpperCase().replace(/-/g, "");
  if (!code) { res.status(400).json({ error: "Code requis" }); return; }

  const [profile] = await db
    .select({ id: playerProfilesTable.id, referralCode: playerProfilesTable.referralCode })
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.referralCode, code))
    .limit(1);

  if (!profile) { res.json({ exists: false }); return; }
  res.json({ exists: true });
});

router.post("/transfer/send", transferRateLimit, async (req, res): Promise<void> => {
  const { userId: senderClerkId } = getAuth(req);
  if (!senderClerkId) { res.status(401).json({ error: "Non authentifié" }); return; }

  const parsed = SendBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Données invalides" }); return; }

  const { recipientCode, amount } = parsed.data;
  const normalizedCode = recipientCode.trim().toUpperCase().replace(/-/g, "");

  const [senderProfile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.clerkId, senderClerkId))
    .limit(1);

  if (!senderProfile) { res.status(400).json({ error: "Profil expéditeur introuvable" }); return; }
  if (senderProfile.referralCode === normalizedCode) {
    res.status(400).json({ error: "Vous ne pouvez pas vous envoyer de l'argent à vous-même" });
    return;
  }

  const [recipientProfile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.referralCode, normalizedCode))
    .limit(1);

  if (!recipientProfile) { res.status(404).json({ error: "Aucun compte trouvé avec cet identifiant" }); return; }

  const senderBalance = await getBalance(senderClerkId);
  if (senderBalance < amount) {
    res.status(400).json({ error: `Solde insuffisant. Vous avez ${Math.round(senderBalance).toLocaleString("fr-FR")} FC disponibles` });
    return;
  }

  const refId = `TRF-${Date.now()}`;

  await db.insert(creditAdjustmentsTable).values([
    {
      clerkId: senderClerkId,
      amount: String(-amount),
      reason: "transfer_sent",
      refId,
    },
    {
      clerkId: recipientProfile.clerkId,
      amount: String(amount),
      reason: "transfer_received",
      refId,
    },
  ]);

  // Notify the recipient via support messages so they see it instantly
  const amountFormatted = new Intl.NumberFormat("fr-FR").format(Math.round(amount)).replace(/\s/g, ".");
  const senderCode = senderProfile.referralCode.slice(0, 3) + "-" + senderProfile.referralCode.slice(3);
  await db.insert(supportMessagesTable).values({
    sessionId: recipientProfile.clerkId,
    clerkId: recipientProfile.clerkId,
    clerkName: "Halgo Cash",
    message: `💸 Vous avez reçu ${amountFormatted} FC de ${senderCode}. Votre solde a été crédité instantanément.`,
    fromAdmin: true,
    isRead: false,
  });

  req.log.info({ senderClerkId, recipientClerkId: recipientProfile.clerkId, amount, refId }, "Transfer completed");
  res.json({ ok: true, refId });
});

export default router;
