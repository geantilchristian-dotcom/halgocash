import { Router, Request, Response, NextFunction } from "express";
import { db, siteSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const VALID_KEYS = new Set([
  "halgo_cover_crash",
  "halgo_cover_roulette",
  "halgo_cover_mines",
  "halgo_cover_sport",
]);

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Accès admin requis" }); return; }
  next();
}

async function getCover(key: string): Promise<{ imageData: string; mimeType: string } | null> {
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, key)).limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as { imageData: string; mimeType: string };
  } catch {
    return null;
  }
}

// GET /api/game-covers/:key/image — public, serve the binary
router.get("/game-covers/:key/image", async (req, res): Promise<void> => {
  const { key } = req.params;
  if (!VALID_KEYS.has(key)) { res.status(404).json({ error: "Clé invalide" }); return; }

  const cover = await getCover(key);
  if (!cover) { res.status(404).json({ error: "Pas de pochette" }); return; }

  const base64 = cover.imageData.includes(",") ? cover.imageData.split(",")[1]! : cover.imageData;
  const buf = Buffer.from(base64, "base64");
  res.setHeader("Content-Type", cover.mimeType);
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(buf);
});

// GET /api/game-covers — public, returns {key: boolean} existence map for all covers
router.get("/game-covers", async (_req, res): Promise<void> => {
  const rows = await db.select({ key: siteSettingsTable.key }).from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "halgo_cover_crash"));
  const all = await db.select({ key: siteSettingsTable.key, value: siteSettingsTable.value })
    .from(siteSettingsTable);
  const map: Record<string, boolean> = {};
  for (const k of VALID_KEYS) {
    map[k] = all.some(r => r.key === k && r.value);
  }
  void rows;
  res.json(map);
});

// POST /api/admin/game-covers/:key — admin upload
router.post("/admin/game-covers/:key", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const key = String(req.params["key"] ?? "");
  if (!VALID_KEYS.has(key)) { res.status(400).json({ error: "Clé invalide" }); return; }

  const { imageData, mimeType = "image/jpeg" } = req.body as { imageData?: string; mimeType?: string };
  if (!imageData) { res.status(400).json({ error: "imageData requis" }); return; }

  const value = JSON.stringify({ imageData, mimeType });
  const existing = await db.select({ key: siteSettingsTable.key }).from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(siteSettingsTable).set({ value, updatedAt: new Date() }).where(eq(siteSettingsTable.key, key));
  } else {
    await db.insert(siteSettingsTable).values({ key, value });
  }
  res.json({ ok: true });
});

// DELETE /api/admin/game-covers/:key — admin delete
router.delete("/admin/game-covers/:key", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const key = String(req.params["key"] ?? "");
  if (!VALID_KEYS.has(key)) { res.status(400).json({ error: "Clé invalide" }); return; }
  await db.delete(siteSettingsTable).where(eq(siteSettingsTable.key, key));
  res.json({ ok: true });
});

export default router;
