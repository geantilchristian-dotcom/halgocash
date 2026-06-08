import { Router, Request, Response } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// helper — check admin session
function requireAdmin(req: Request, res: Response): boolean {
  const u = req.session as { userId?: number; role?: string };
  if (!u.userId || u.role !== "admin") {
    res.status(403).json({ error: "Accès admin requis" });
    return false;
  }
  return true;
}

// GET /api/banners/active/image — public: serve the active banner image
router.get("/banners/active/image", async (req, res): Promise<void> => {
  const [banner] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.isActive, true))
    .limit(1);

  if (!banner) {
    res.status(404).json({ error: "Pas de bannière active" });
    return;
  }

  const base64 = banner.imageData.includes(",")
    ? banner.imageData.split(",")[1]
    : banner.imageData;

  const buf = Buffer.from(base64!, "base64");
  res.setHeader("Content-Type", banner.mimeType);
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(buf);
});

// GET /api/admin/banners — list all banners (admin)
router.get("/admin/banners", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const banners = await db
    .select({ id: bannersTable.id, fileName: bannersTable.fileName, mimeType: bannersTable.mimeType, isActive: bannersTable.isActive, createdAt: bannersTable.createdAt })
    .from(bannersTable)
    .orderBy(bannersTable.createdAt);
  res.json(banners);
});

// POST /api/admin/banners — upload new banner (body: { imageData, mimeType, fileName })
router.post("/admin/banners", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const { imageData, mimeType = "image/png", fileName = "banner.png" } = req.body as { imageData?: string; mimeType?: string; fileName?: string };
  if (!imageData) { res.status(400).json({ error: "imageData requis" }); return; }

  // Deactivate all existing banners first
  await db.update(bannersTable).set({ isActive: false });

  const [banner] = await db.insert(bannersTable).values({ imageData, mimeType, fileName, isActive: true }).returning({ id: bannersTable.id });
  res.status(201).json({ id: banner!.id });
});

// PATCH /api/admin/banners/:id/activate — set one banner as active
router.patch("/admin/banners/:id/activate", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "id invalide" }); return; }

  await db.update(bannersTable).set({ isActive: false });
  await db.update(bannersTable).set({ isActive: true }).where(eq(bannersTable.id, id));
  res.json({ ok: true });
});

// DELETE /api/admin/banners/:id — delete a banner
router.delete("/admin/banners/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "id invalide" }); return; }

  await db.delete(bannersTable).where(eq(bannersTable.id, id));
  res.json({ ok: true });
});

export default router;
