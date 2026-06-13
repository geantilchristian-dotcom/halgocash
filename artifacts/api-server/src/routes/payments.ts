import { Router, type IRouter, type Request, type Response } from "express";
import { Malipo } from "malipo-node";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

const NETWORKS = ["VODACOM_MPESA", "AIRTEL_MONEY", "ORANGE_MONEY"] as const;
type Network = (typeof NETWORKS)[number];

function getMalipo() {
  const key = process.env.MALIPO_SECRET_KEY;
  if (!key) throw new Error("MALIPO_SECRET_KEY non configurée");
  return new Malipo({ apiKey: key });
}

// ── POST /payments/mobile-money/initiate ─────────────────────────────────────
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
  if (!phone || !/^\+2438\d{8}$|^\+2439\d{8}$|^\+2437\d{8}$/.test(phone)) {
    res.status(400).json({ error: "Numéro invalide. Format : +243XXXXXXXXX" });
    return;
  }
  if (!network || !NETWORKS.includes(network as Network)) {
    res.status(400).json({ error: `Réseau invalide. Choisissez parmi : ${NETWORKS.join(", ")}` });
    return;
  }

  try {
    const malipo = getMalipo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = await (malipo.charges.create as (opts: any) => Promise<any>)({
      amount,
      currency,
      phone,
      network,
    }) as { id?: string; chargeId?: string; status?: string; message?: string };

    const chargeId = charge.id ?? charge.chargeId;
    req.log.info({ chargeId, userId, amount, currency, network }, "Malipo charge created");

    res.json({
      chargeId,
      status: charge.status ?? "pending",
      message: charge.message ?? "Confirmez le paiement sur votre téléphone.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    req.log.error({ err }, "Malipo charge error");
    res.status(e.status ?? 502).json({ error: e.message ?? "Erreur Malipo" });
  }
});

// ── POST /payments/mobile-money/vendor ───────────────────────────────────────
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
  if (!network || !NETWORKS.includes(network as Network)) {
    res.status(400).json({ error: `Réseau invalide. Choisissez parmi : ${NETWORKS.join(", ")}` });
    return;
  }

  try {
    const malipo = getMalipo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = await (malipo.charges.create as (opts: any) => Promise<any>)({
      amount,
      currency,
      phone,
      network,
    }) as { id?: string; chargeId?: string; status?: string; message?: string };

    const chargeId = charge.id ?? charge.chargeId;
    req.log.info({ chargeId, vendorUserId: sess.userId, amount, currency, network, customerName }, "Malipo vendor charge created");

    res.json({
      chargeId,
      status: charge.status ?? "pending",
      message: charge.message ?? "Demande envoyée. Le client doit confirmer sur son téléphone.",
    });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    req.log.error({ err }, "Malipo vendor charge error");
    res.status(e.status ?? 502).json({ error: e.message ?? "Erreur Malipo" });
  }
});

// ── GET /payments/mobile-money/status/:chargeId ──────────────────────────────
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = await (malipo.transactions.retrieve as (id: string) => Promise<any>)(chargeId) as {
      status?: string;
      id?: string;
      amount?: number;
      currency?: string;
    };

    res.json({
      chargeId,
      status: tx.status ?? "pending",
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
