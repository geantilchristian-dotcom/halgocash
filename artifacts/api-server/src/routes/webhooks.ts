import { createHmac, timingSafeEqual } from "crypto";
import { type Request, type Response } from "express";
import { db } from "@workspace/db";
import { malipoChargesTable, creditAdjustmentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── HMAC-SHA256 signature verification ───────────────────────────────────────
// Malipo signs webhooks with HMAC-SHA256 of the raw body.
// The header may arrive as "sha256=<hex>" or just "<hex>".
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const sig = signature.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

// ── Webhook event shape ───────────────────────────────────────────────────────
interface MalipoWebhookEvent {
  type: string;
  data: {
    object: {
      id?: string;
      chargeId?: string;
      amount?: number;
      currency?: string;
      status?: string;
      phone?: string;
      network?: string;
    };
  };
}

// ── POST /api/webhooks/malipo ─────────────────────────────────────────────────
// Enregistré dans app.ts AVANT express.json() pour préserver le raw body.
export async function malipoWebhookHandler(req: Request, res: Response): Promise<void> {
  const signature = req.headers["x-webhook-signature"] as string | undefined;
  const secret = process.env.MALIPO_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("MALIPO_WEBHOOK_SECRET non configurée — webhook ignoré");
    res.status(500).json({ error: "Configuration manquante" });
    return;
  }

  if (!signature) {
    logger.warn("Webhook Malipo reçu sans signature — rejeté");
    res.status(400).json({ error: "Signature manquante" });
    return;
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : String(req.body);

  if (!verifySignature(rawBody, signature, secret)) {
    logger.warn({ signature }, "Webhook Malipo — signature HMAC invalide");
    res.status(400).json({ error: "Signature invalide" });
    return;
  }

  let event: MalipoWebhookEvent;
  try {
    event = JSON.parse(rawBody) as MalipoWebhookEvent;
  } catch {
    res.status(400).json({ error: "JSON invalide" });
    return;
  }

  logger.info({ type: event.type }, "Webhook Malipo reçu");

  try {
    if (event.type === "charge.succeeded") {
      await handleChargeSucceeded(event.data.object);
    } else {
      logger.info({ type: event.type }, "Webhook Malipo — type non géré, ignoré");
    }
  } catch (err: unknown) {
    logger.error({ err, eventType: event.type }, "Erreur traitement webhook Malipo");
    // Retourner 200 pour éviter que Malipo re-tente à l'infini
    res.status(200).json({ received: true, warning: "Traitement partiel" });
    return;
  }

  res.status(200).json({ received: true });
}

async function handleChargeSucceeded(
  charge: MalipoWebhookEvent["data"]["object"],
): Promise<void> {
  const rawId = charge.id ?? charge.chargeId;
  if (!rawId) {
    logger.warn({ charge }, "charge.succeeded sans chargeId — ignoré");
    return;
  }

  const [row] = await db
    .select()
    .from(malipoChargesTable)
    .where(eq(malipoChargesTable.chargeId, rawId))
    .limit(1);

  if (!row) {
    logger.warn({ chargeId: rawId }, "charge.succeeded — charge introuvable en DB, ignoré");
    return;
  }

  // Idempotence : ne pas créditer deux fois
  if (row.status === "settled") {
    logger.info({ chargeId: rawId }, "charge.succeeded — déjà traité, ignoré");
    return;
  }

  await db
    .update(malipoChargesTable)
    .set({ status: "settled", settledAt: new Date() })
    .where(eq(malipoChargesTable.chargeId, rawId));

  if (row.clerkId && row.type === "player_recharge") {
    await db.insert(creditAdjustmentsTable).values({
      clerkId: row.clerkId,
      amount: row.amount,
      reason: `Recharge Mobile Money (${row.currency}) via Malipo`,
      refId: rawId,
    });

    logger.info(
      { chargeId: rawId, clerkId: row.clerkId, amount: row.amount, currency: row.currency },
      "Portefeuille joueur crédité via webhook Malipo",
    );
  } else if (row.vendorUserId && row.type === "vendor_collection") {
    logger.info(
      { chargeId: rawId, vendorUserId: row.vendorUserId, amount: row.amount },
      "Encaissement vendeur confirmé via webhook Malipo",
    );
  }
}
