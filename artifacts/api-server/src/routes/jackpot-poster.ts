import { Router, Request, Response } from "express";
import { db, siteSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const u = req.session as { userId?: number; role?: string };
  if (!u.userId || u.role !== "admin") {
    res.status(403).json({ error: "Accès admin requis" });
    return false;
  }
  return true;
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
router.post("/admin/jackpot-poster", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
router.delete("/admin/jackpot-poster", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  await db.delete(siteSettingsTable).where(eq(siteSettingsTable.key, KEY));
  res.json({ ok: true });
});

export default router;
