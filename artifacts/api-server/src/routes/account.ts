import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, playerProfilesTable, creditAdjustmentsTable, supportMessagesTable, kycTable, playerModerationTable, fcmTokensTable } from "@workspace/db";

const router: IRouter = Router();

// GET /api/player/status — check if current player is paused or blocked
router.get("/player/status", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.json({ status: "active" }); return; }
  const [mod] = await db
    .select({ status: playerModerationTable.status, warnCount: playerModerationTable.warnCount })
    .from(playerModerationTable)
    .where(eq(playerModerationTable.clerkId, userId))
    .limit(1);
  res.json({ status: mod?.status ?? "active", warnCount: mod?.warnCount ?? 0 });
});

// DELETE /api/players/me — user deletes their own Halgo account data
router.delete("/players/me", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  await Promise.all([
    db.delete(playerProfilesTable).where(eq(playerProfilesTable.clerkId, userId)),
    db.delete(creditAdjustmentsTable).where(eq(creditAdjustmentsTable.clerkId, userId)),
    db.delete(supportMessagesTable).where(eq(supportMessagesTable.clerkId, userId)),
    db.delete(playerModerationTable).where(eq(playerModerationTable.clerkId, userId)),
    db.delete(kycTable).where(eq(kycTable.clerkId, userId)),
    db.delete(fcmTokensTable).where(eq(fcmTokensTable.clerkId, userId)),
  ]);
  res.json({ ok: true, message: "Vos données ont été supprimées de Halgo Cash." });
});

export default router;
