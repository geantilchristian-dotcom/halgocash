import { Router, type IRouter } from "express";

const router: IRouter = Router();

const TEST_ACCOUNTS: Record<string, { ownerName: string; balance: number; currency: string }> = {
  "1234567890": { ownerName: "Jean Mukeba", balance: 125000, currency: "XAF" },
  "0987654321": { ownerName: "Marie Kabila", balance: 85000, currency: "XAF" },
  "5555555555": { ownerName: "Pierre Lumumba", balance: 250000, currency: "XAF" },
};

router.post("/balance/check", async (req, res) => {
  req.log.info({ body: req.body }, "POST /balance/check");

  const code = req.body?.code;
  if (!code || typeof code !== "string" || code.length !== 10) {
    res.status(400).json({ error: "Code invalide (10 chiffres requis)" });
    return;
  }

  const account = TEST_ACCOUNTS[code];
  if (!account) {
    res.status(404).json({ error: "Code introuvable" });
    return;
  }

  res.json({
    code,
    balance: account.balance,
    currency: account.currency,
    ownerName: account.ownerName,
  });
});

export default router;
