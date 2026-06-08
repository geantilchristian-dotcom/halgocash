import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DESTINATIONS = [
  { id: 1, name: "Kinshasa - Gombe", price: 500, zone: "A" },
  { id: 2, name: "Kinshasa - Lingwala", price: 500, zone: "A" },
  { id: 3, name: "Kinshasa - Barumbu", price: 500, zone: "A" },
  { id: 4, name: "Kinshasa - Kasa-Vubu", price: 750, zone: "B" },
  { id: 5, name: "Kinshasa - Ngiri-Ngiri", price: 750, zone: "B" },
  { id: 6, name: "Kinshasa - Kalamu", price: 750, zone: "B" },
  { id: 7, name: "Kinshasa - Lemba", price: 1000, zone: "C" },
  { id: 8, name: "Kinshasa - Ndjili", price: 1000, zone: "C" },
];

router.get("/destinations", (_req, res) => {
  res.json(DESTINATIONS);
});

export default router;
