import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { destinationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/destinations", async (_req, res) => {
  const destinations = await db.select().from(destinationsTable).orderBy(destinationsTable.name);
  res.json(destinations.map(d => ({
    id: d.id,
    name: d.name,
    price: parseFloat(d.price),
    zone: d.zone,
  })));
});

export default router;
