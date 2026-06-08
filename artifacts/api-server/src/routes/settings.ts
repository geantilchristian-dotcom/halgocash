import { Router, Request, Response } from "express";
import { db, siteSettingsTable } from "@workspace/db";
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

export interface PromoBannerConfig {
  bgColor1: string;
  bgColor2: string;
  bgColor3: string;
  line1Text: string;
  line1Color: string;
  line1Font: string;
  line2Text: string;
  line2Color: string;
  line2Font: string;
  line2Suffix: string;
  line2SuffixColor: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  animation: "slide" | "glow" | "pulse" | "shimmer";
}

const DEFAULT_PROMO: PromoBannerConfig = {
  bgColor1: "#1a5c2a",
  bgColor2: "#22c55e",
  bgColor3: "#F5C518",
  line1Text: "GAGNEZ JUSQU'À",
  line1Color: "rgba(255,255,255,0.85)",
  line1Font: "Plus Jakarta Sans",
  line2Text: "1.000.000",
  line2Color: "#ffffff",
  line2Font: "Oswald",
  line2Suffix: "CDF",
  line2SuffixColor: "#F5C518",
  badgeText: "CHAQUE SAMEDI",
  badgeColor: "#ffffff",
  badgeBg: "rgba(0,0,0,0.30)",
  animation: "slide",
};

async function getPromoBanner(): Promise<PromoBannerConfig> {
  const [row] = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "promo_banner"))
    .limit(1);
  if (!row) return DEFAULT_PROMO;
  try {
    return JSON.parse(row.value) as PromoBannerConfig;
  } catch {
    return DEFAULT_PROMO;
  }
}

router.get("/promo-banner", async (_req, res): Promise<void> => {
  res.json(await getPromoBanner());
});

router.get("/admin/promo-banner", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  res.json(await getPromoBanner());
});

router.put("/admin/promo-banner", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const config = req.body as PromoBannerConfig;
  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "Config invalide" });
    return;
  }
  const jsonStr = JSON.stringify(config);
  const existing = await db
    .select({ key: siteSettingsTable.key })
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, "promo_banner"))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(siteSettingsTable)
      .set({ value: jsonStr, updatedAt: new Date() })
      .where(eq(siteSettingsTable.key, "promo_banner"));
  } else {
    await db.insert(siteSettingsTable).values({ key: "promo_banner", value: jsonStr });
  }
  res.json({ ok: true });
});

export default router;
