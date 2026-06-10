import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, supportMessagesTable } from "@workspace/db";
import { getAuth } from "@clerk/express";
const router: IRouter = Router();

router.get("/support/messages", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const msgs = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.clerkId, userId))
    .orderBy(desc(supportMessagesTable.createdAt))
    .limit(100);
  if (msgs.length > 0) {
    await db.update(supportMessagesTable)
      .set({ isRead: true })
      .where(and(eq(supportMessagesTable.clerkId, userId), eq(supportMessagesTable.fromAdmin, true)));
  }
  res.json(msgs.reverse());
});

router.post("/support/message", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const { message, clerkName } = req.body as { message?: string; clerkName?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message vide" }); return; }
  const sessionId = userId;
  const [saved] = await db.insert(supportMessagesTable).values({
    sessionId, clerkId: userId,
    clerkName: clerkName ?? "Joueur",
    message: message.slice(0, 2000),
    fromAdmin: false,
  }).returning();
  res.status(201).json(saved);
});

router.get("/support/unread-count", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ count: 0 }); return; }
  const rows = await db.select({ id: supportMessagesTable.id }).from(supportMessagesTable)
    .where(and(eq(supportMessagesTable.clerkId, userId), eq(supportMessagesTable.fromAdmin, true), eq(supportMessagesTable.isRead, false)));
  res.json({ count: rows.length });
});

export default router;
