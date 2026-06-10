import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, fcmTokensTable } from "@workspace/db";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();

router.post("/notifications/register", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token) { res.status(400).json({ error: "Token manquant" }); return; }
  await db.insert(fcmTokensTable)
    .values({ clerkId: userId, token, platform: platform ?? "web" })
    .onConflictDoUpdate({ target: fcmTokensTable.token, set: { clerkId: userId, platform: platform ?? "web", createdAt: new Date() } });
  res.json({ ok: true });
});

router.delete("/notifications/unregister", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "Token manquant" }); return; }
  await db.delete(fcmTokensTable).where(and(eq(fcmTokensTable.clerkId, userId), eq(fcmTokensTable.token, token)));
  res.json({ ok: true });
});

export default router;
