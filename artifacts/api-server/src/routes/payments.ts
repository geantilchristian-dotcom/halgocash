import { Router, type IRouter, type Request, type Response } from "express";
import { Malipo, type MalipoNetwork } from "malipo-node";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { malipoChargesTable } from "@workspace/db/schema";

const router: IRouter = Router();

const VALID_NETWORKS: MalipoNetwork[] = ["VODACOM_MPESA", "AIRTEL_MONEY", "ORANGE_MONEY"];

function isValidNetwork(n: string): n is MalipoNetwork {
  return (VALID_NETWORKS as string[]).includes(n);
}

// Malipo SDK expects MSISDN format without leading "+" (e.g. "243810000000")
function toMsisdn(phone: string): string {
  return phone.startsWith("+") ? phone.slice(1) : phone;
}

function getMalipo() {
  const key = process.env.MALIPO_SECRET_KEY;
  if (!key) throw new Error("MALIPO_SECRET_KEY non configurée");
  return new Malipo({ apiKey: key });
}

// ── POST /api/payments/mobile-money/initiate ──────────────────────────────────
// Joueur : recharge son portefeuille via mobile money (requiert Clerk auth)
router.post("/payments/mobile-money/initiate", async (req: Request, res: Response) => {
  req.log.info({ body: req.body }, "POST /payments/mobile-money/initiate");

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentification requise" });
    return;
  }

  const { amount, currency, phone, network } = req.body as {
    amount?: number;
    currency?: string;
    phone?: string;
    network?: string;
  };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Montant invalide" });
    return;
  }
  if (!currency || !["USD", "CDF"].includes(currency)) {
    res.status(400).json({ error: "Devise invalide (USD ou CDF)" });
    return;
  }
  if (!phone || !/^\+243\d{9}$/.test(phone)) {
    res.status(400).json({ error: "Numéro invalide. Format : +243XXXXXXXXX" });
    return;
  }
  if (!network || !isValidNetwork(network)) {
    res.status(400).json({ error: `Réseau invalide. Choisissez parmi : ${VALID_NETWORKS.join(", ")}` });
    return;
  }

  try {
    const malipo = getMalipo();
    const charge = await malipo.charges.create({
      amount,
      currency,
      phone: toMsisdn(phone),
      network,
      description: `Recharge Halgo Cash — ${userId}`,
    });

    const chargeId = charge.id;
    req.log.info({ chargeId, userId, amount, currency, network }, "Malipo charge created");

    if (chargeId) {
      await db.insert(malipoChargesTable).values({
        chargeId,
        clerkId: userId,
        amount: String(amount),
        currency,
        type: "player_recharge",
      }).onConflictDoNothing();
    }

    res.json({
      chargeId,
      status: charge.status,
      message: "Confirmez le paiement sur votre téléphone.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    req.log.error({ err }, "Malipo charge error");
    res.status(e.status ?? 502).json({ error: e.message ?? "Erreur Malipo" });
  }
});

// ── POST /api/payments/mobile-money/vendor ────────────────────────────────────
// Vendeur : encaisser un paiement mobile money client (requiert session vendeur)
router.post("/payments/mobile-money/vendor", async (req: Request, res: Response) => {
  req.log.info({ body: req.body }, "POST /payments/mobile-money/vendor");

  const sess = req.session as typeof req.session & { userId?: number };
  if (!sess.userId) {
    res.status(401).json({ error: "Session vendeur expirée. Reconnectez-vous." });
    return;
  }

  const { amount, currency, phone, network, customerName } = req.body as {
    amount?: number;
    currency?: string;
    phone?: string;
    network?: string;
    customerName?: string;
  };

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Montant invalide" });
    return;
  }
  if (!currency || !["USD", "CDF"].includes(currency)) {
    res.status(400).json({ error: "Devise invalide (USD ou CDF)" });
    return;
  }
  if (!phone || !/^\+243\d{9}$/.test(phone)) {
    res.status(400).json({ error: "Numéro invalide. Format : +243XXXXXXXXX" });
    return;
  }
  if (!network || !isValidNetwork(network)) {
    res.status(400).json({ error: `Réseau invalide. Choisissez parmi : ${VALID_NETWORKS.join(", ")}` });
    return;
  }

  try {
    const malipo = getMalipo();
    const charge = await malipo.charges.create({
      amount,
      currency,
      phone: toMsisdn(phone),
      network,
      description: customerName ? `Encaissement Halgo — ${customerName}` : "Encaissement Halgo Cash",
    });

    const chargeId = charge.id;
    req.log.info({ chargeId, vendorUserId: sess.userId, amount, currency, network, customerName }, "Malipo vendor charge created");

    if (chargeId) {
      await db.insert(malipoChargesTable).values({
        chargeId,
        vendorUserId: sess.userId,
        amount: String(amount),
        currency,
        type: "vendor_collection",
      }).onConflictDoNothing();
    }

    res.json({
      chargeId,
      status: charge.status,
      message: "Demande envoyée. Le client doit confirmer sur son téléphone.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    req.log.error({ err }, "Malipo vendor charge error");
    res.status(e.status ?? 502).json({ error: e.message ?? "Erreur Malipo" });
  }
});

// ── GET /api/payments/mobile-money/status/:chargeId ──────────────────────────
// Vérifier le statut d'un paiement (polling côté client)
router.get("/payments/mobile-money/status/:chargeId", async (req: Request, res: Response) => {
  req.log.info({ params: req.params }, "GET /payments/mobile-money/status");

  const chargeId = req.params.chargeId as string;
  if (!chargeId) {
    res.status(400).json({ error: "chargeId requis" });
    return;
  }

  try {
    const malipo = getMalipo();
    const tx = await malipo.transactions.retrieve(chargeId);

    res.json({
      chargeId,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    req.log.error({ err, chargeId }, "Malipo status check error");
    res.status(e.status ?? 502).json({ error: e.message ?? "Erreur Malipo" });
  }
});

export default router;
