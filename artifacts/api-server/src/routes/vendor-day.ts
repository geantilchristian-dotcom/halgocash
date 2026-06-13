import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, vendorsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

function getSession(req: Request) {
  return req.session as typeof req.session & { userId?: number };
}

async function resolveVendorContext(req: Request): Promise<{ userId: number; vendorId: number; vendorName: string; username: string } | null> {
  const session = getSession(req);
  if (!session.userId) return null;
  const [user] = await db
    .select({ vendorId: usersTable.vendorId, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  if (!user?.vendorId) return null;
  const [vendor] = await db
    .select({ name: vendorsTable.name })
    .from(vendorsTable)
    .where(eq(vendorsTable.id, user.vendorId))
    .limit(1);
  return {
    userId: session.userId,
    vendorId: user.vendorId,
    vendorName: vendor?.name ?? "Vendeur",
    username: user.username,
  };
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/vendor/daily-report — today's POS sales + closure status
router.get("/vendor/daily-report", async (req: Request, res: Response) => {
  const ctx = await resolveVendorContext(req);
  if (!ctx) return void res.status(401).json({ error: "Non authentifié" });

  const dateStr = todayDate();

  const salesRows = await db.execute(sql`
    SELECT id, unit_amount, quantity, total_amount, currency, created_at
    FROM pos_sales
    WHERE vendor_id = ${ctx.vendorId}
      AND created_at::date = ${dateStr}::date
    ORDER BY created_at ASC
  `);
  const sales = (salesRows as { rows: unknown[] }).rows ?? (salesRows as unknown as unknown[]);

  const closureRows = await db.execute(sql`
    SELECT id, day_date, total_tickets, total_amount_usd, total_amount_fc, closed_at
    FROM vendor_day_closures
    WHERE vendor_id = ${ctx.vendorId} AND day_date = ${dateStr}
    ORDER BY closed_at DESC
    LIMIT 1
  `);
  const closureArr = (closureRows as { rows: unknown[] }).rows ?? (closureRows as unknown as unknown[]);
  const closure = closureArr[0] ?? null;

  return void res.json({ sales, closure, dayDate: dateStr });
});

// POST /api/vendor/close-day
const closeDaySchema = z.object({
  message: z.string().max(200).optional(),
});

router.post("/vendor/close-day", async (req: Request, res: Response) => {
  const ctx = await resolveVendorContext(req);
  if (!ctx) return void res.status(401).json({ error: "Non authentifié" });

  const dateStr = todayDate();

  // Compute today's totals from pos_sales
  const totalsRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(quantity), 0) AS total_tickets,
      COALESCE(SUM(CASE WHEN currency = 'USD' THEN total_amount ELSE 0 END), 0) AS total_usd,
      COALESCE(SUM(CASE WHEN currency = 'FC'  THEN total_amount ELSE 0 END), 0) AS total_fc
    FROM pos_sales
    WHERE vendor_id = ${ctx.vendorId}
      AND created_at::date = ${dateStr}::date
  `);
  const totalsArr = (totalsRows as { rows: unknown[] }).rows ?? (totalsRows as unknown as unknown[]);
  const t = totalsArr[0] as { total_tickets: string; total_usd: string; total_fc: string } | undefined;

  const totalTickets = parseInt(t?.total_tickets ?? "0", 10);
  const totalUsd = parseFloat(t?.total_usd ?? "0");
  const totalFc = parseFloat(t?.total_fc ?? "0");

  await db.execute(sql`
    INSERT INTO vendor_day_closures (vendor_id, user_id, day_date, total_tickets, total_amount_usd, total_amount_fc)
    VALUES (${ctx.vendorId}, ${ctx.userId}, ${dateStr}, ${totalTickets}, ${totalUsd}, ${totalFc})
  `);

  req.log.info({ vendorId: ctx.vendorId, dateStr }, "Vendor day closed");
  return void res.json({ ok: true, totalTickets, totalUsd, totalFc, dayDate: dateStr });
});

// POST /api/vendor/alarm — vendor triggers alarm
const alarmSchema = z.object({
  message: z.string().max(300).optional(),
});

router.post("/vendor/alarm", async (req: Request, res: Response) => {
  const ctx = await resolveVendorContext(req);
  if (!ctx) return void res.status(401).json({ error: "Non authentifié" });

  const parsed = alarmSchema.safeParse(req.body);
  const message = parsed.success && parsed.data.message ? parsed.data.message : "Alarme déclenchée — besoin d'assistance";

  await db.execute(sql`
    INSERT INTO vendor_alarms (vendor_id, user_id, vendor_name, username, message, status)
    VALUES (${ctx.vendorId}, ${ctx.userId}, ${ctx.vendorName}, ${ctx.username}, ${message}, 'active')
  `);

  req.log.warn({ vendorId: ctx.vendorId }, "Vendor alarm triggered");
  return void res.json({ ok: true });
});

// GET /api/admin/vendor-daily-reports — all vendors' daily reports for today (or a date)
router.get("/admin/vendor-daily-reports", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session.userId) return void res.status(401).json({ error: "Non authentifié" });
  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (admin?.role !== "admin") return void res.status(403).json({ error: "Accès refusé" });

  const dateStr = (req.query["date"] as string) ?? todayDate();

  const rows = await db.execute(sql`
    SELECT
      v.id AS vendor_id,
      v.name AS vendor_name,
      v.location,
      u.id AS user_id,
      u.username,
      COALESCE(SUM(ps.quantity), 0) AS total_tickets,
      COALESCE(SUM(CASE WHEN ps.currency = 'USD' THEN ps.total_amount ELSE 0 END), 0) AS total_usd,
      COALESCE(SUM(CASE WHEN ps.currency = 'FC'  THEN ps.total_amount ELSE 0 END), 0) AS total_fc,
      MAX(ps.created_at) AS last_sale_at,
      (SELECT closed_at FROM vendor_day_closures dc
         WHERE dc.vendor_id = v.id AND dc.day_date = ${dateStr}
         ORDER BY closed_at DESC LIMIT 1) AS closed_at
    FROM vendors v
    JOIN users u ON u.vendor_id = v.id
    LEFT JOIN pos_sales ps ON ps.vendor_id = v.id AND ps.created_at::date = ${dateStr}::date
    WHERE v.status = 'active'
    GROUP BY v.id, v.name, v.location, u.id, u.username
    ORDER BY v.name
  `);

  const data = (rows as { rows: unknown[] }).rows ?? (rows as unknown as unknown[]);

  // Also get per-vendor sales detail for the day
  const detailRows = await db.execute(sql`
    SELECT vendor_id, unit_amount, quantity, total_amount, currency, created_at
    FROM pos_sales
    WHERE created_at::date = ${dateStr}::date
    ORDER BY created_at ASC
  `);
  const details = (detailRows as { rows: unknown[] }).rows ?? (detailRows as unknown as unknown[]);

  return void res.json({ date: dateStr, vendors: data, details });
});

// GET /api/admin/alarms — active alarms
router.get("/admin/alarms", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session.userId) return void res.status(401).json({ error: "Non authentifié" });
  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (admin?.role !== "admin") return void res.status(403).json({ error: "Accès refusé" });

  const rows = await db.execute(sql`
    SELECT id, vendor_id, vendor_name, username, message, status, triggered_at
    FROM vendor_alarms
    WHERE status = 'active'
    ORDER BY triggered_at DESC
  `);
  const data = (rows as { rows: unknown[] }).rows ?? (rows as unknown as unknown[]);
  return void res.json(data);
});

// POST /api/admin/alarms/:id/dismiss
router.post("/admin/alarms/:id/dismiss", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session.userId) return void res.status(401).json({ error: "Non authentifié" });
  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (admin?.role !== "admin") return void res.status(403).json({ error: "Accès refusé" });

  const alarmId = parseInt(req.params["id"] ?? "0", 10);
  await db.execute(sql`
    UPDATE vendor_alarms SET status = 'dismissed', dismissed_at = NOW()
    WHERE id = ${alarmId}
  `);
  return void res.json({ ok: true });
});

export default router;
