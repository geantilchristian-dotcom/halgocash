import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, kycTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { kycSubmitRateLimit } from "../middlewares/rateLimiters";

const router: IRouter = Router();

router.get("/kyc", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [kyc] = await db.select().from(kycTable).where(eq(kycTable.clerkId, userId)).limit(1);
  if (!kyc) { res.json({ status: "not_submitted" }); return; }
  res.json({
    status: kyc.status,
    fullName: kyc.fullName,
    birthDate: kyc.birthDate,
    idType: kyc.idType,
    adminNote: kyc.adminNote ?? null,
    submittedAt: kyc.submittedAt.toISOString(),
    reviewedAt: kyc.reviewedAt?.toISOString() ?? null,
  });
});

router.post("/kyc", kycSubmitRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const { fullName, birthDate, idType, idNumber } = req.body as {
    fullName?: string; birthDate?: string; idType?: string; idNumber?: string;
  };
  if (!fullName || !birthDate || !idType || !idNumber) {
    res.status(400).json({ error: "Tous les champs sont obligatoires" }); return;
  }
  const birth = new Date(birthDate);
  const now = new Date();
  const age = now.getFullYear() - birth.getFullYear() -
    (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (isNaN(age) || age < 18) { res.status(400).json({ error: "Vous devez avoir au moins 18 ans pour vous inscrire" }); return; }

  const [existing] = await db.select({ id: kycTable.id, status: kycTable.status }).from(kycTable).where(eq(kycTable.clerkId, userId)).limit(1);
  if (existing) {
    if (existing.status === "approved") { res.status(409).json({ error: "Votre identité a déjà été vérifiée" }); return; }
    if (existing.status === "pending") { res.status(409).json({ error: "Votre dossier est déjà en cours d'examen" }); return; }
    await db.update(kycTable).set({ fullName, birthDate, idType, idNumber, status: "pending", adminNote: null, submittedAt: new Date(), reviewedAt: null }).where(eq(kycTable.clerkId, userId));
  } else {
    await db.insert(kycTable).values({ clerkId: userId, fullName, birthDate, idType, idNumber, status: "pending" });
  }
  res.json({ ok: true, status: "pending" });
});

export default router;
