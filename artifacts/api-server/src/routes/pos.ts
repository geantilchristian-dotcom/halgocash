import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

function getSession(req: Request) {
  return req.session as typeof req.session & { userId?: number };
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

function generateCode(): string {
  let code = "HLG-";
  for (let i = 0; i < 8; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

const generateSchema = z.object({
  unitAmount: z.number().positive().max(100_000),
  quantity: z.number().int().min(1).max(50),
  currency: z.enum(["USD", "FC"]).default("USD"),
});

async function resolveVendorId(req: Request): Promise<number | null> {
  const session = getSession(req);
  if (!session.userId) return null;
  const [user] = await db.select({ vendorId: usersTable.vendorId })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  return user?.vendorId ?? null;
}

// POST /api/vendor/pos/generate
router.post("/vendor/pos/generate", async (req: Request, res: Response) => {
  const vendorId = await resolveVendorId(req);
  if (!vendorId) return void res.status(vendorId === null ? 401 : 403).json({ error: "Accès non autorisé" });

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Données invalides" });

  const { unitAmount, quantity, currency } = parsed.data;
  const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
  const codes = Array.from({ length: quantity }, () => generateCode());

  // Build a PostgreSQL array literal
  const arrayLiteral = `{${codes.map((c) => `"${c}"`).join(",")}}`;

  const rows = await db.execute(sql`
    INSERT INTO pos_sales (vendor_id, unit_amount, quantity, total_amount, codes, currency)
    VALUES (${vendorId}, ${unitAmount}, ${quantity}, ${totalAmount}, ${arrayLiteral}::text[], ${currency})
    RETURNING id, created_at
  `);

  const rowsAny = rows as unknown as { rows?: { id: number; created_at: Date }[] };
  const row = rowsAny.rows?.[0] ?? (rows as unknown as { id: number; created_at: Date }[])[0];

  return void res.json({
    saleId: row?.id,
    codes,
    unitAmount,
    quantity,
    totalAmount,
    currency,
    createdAt: row?.created_at ?? new Date().toISOString(),
  });
});

// GET /api/vendor/pos/history
router.get("/vendor/pos/history", async (req: Request, res: Response) => {
  const vendorId = await resolveVendorId(req);
  if (!vendorId) return void res.status(401).json({ error: "Non authentifié" });

  const rows = await db.execute(sql`
    SELECT id, unit_amount, quantity, total_amount, codes, currency, created_at
    FROM pos_sales
    WHERE vendor_id = ${vendorId}
    ORDER BY created_at DESC
    LIMIT 100
  `);

  const data = (rows as { rows: unknown[] }).rows ?? (rows as unknown as unknown[]);
  return void res.json(data);
});

export default router;
