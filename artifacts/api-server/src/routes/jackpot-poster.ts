import { Router, Request, Response, NextFunction } from "express";
import { db, siteSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Accès admin requis" }); return; }
  next();
}

const KEY = "jackpot_poster";

async function getPoster(): Promise<{ imageData: string; mimeType: string } | null> {
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, KEY)).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as { imageData: string; mimeType: string };
  } catch {
    return null;
  }
}

// GET /api/jackpot-poster/image — public, serve the binary
router.get("/jackpot-poster/image", async (_req, res): Promise<void> => {
  const poster = await getPoster();
  if (!poster) { res.status(404).json({ error: "Pas d'affiche" }); return; }

  const base64 = poster.imageData.includes(",")
    ? poster.imageData.split(",")[1]!
    : poster.imageData;

  const buf = Buffer.from(base64, "base64");
  res.setHeader("Content-Type", poster.mimeType);
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(buf);
});

// GET /api/jackpot-poster/exists — public, returns {exists: boolean}
router.get("/jackpot-poster/exists", async (_req, res): Promise<void> => {
  const poster = await getPoster();
  res.json({ exists: !!poster });
});

// POST /api/admin/jackpot-poster — admin upload
router.post("/admin/jackpot-poster", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { imageData, mimeType = "image/jpeg" } = req.body as { imageData?: string; mimeType?: string };
  if (!imageData) { res.status(400).json({ error: "imageData requis" }); return; }

  const value = JSON.stringify({ imageData, mimeType });
  const existing = await db.select({ key: siteSettingsTable.key }).from(siteSettingsTable).where(eq(siteSettingsTable.key, KEY)).limit(1);
  if (existing.length > 0) {
    await db.update(siteSettingsTable).set({ value, updatedAt: new Date() }).where(eq(siteSettingsTable.key, KEY));
  } else {
    await db.insert(siteSettingsTable).values({ key: KEY, value });
  }
  res.json({ ok: true });
});

// DELETE /api/admin/jackpot-poster — admin delete
router.delete("/admin/jackpot-poster", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  await db.delete(siteSettingsTable).where(eq(siteSettingsTable.key, KEY));
  res.json({ ok: true });
});

export default router;
