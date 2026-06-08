import { Router, type IRouter } from "express";
import healthRouter from "./health";
import balanceRouter from "./balance";
import destinationsRouter from "./destinations";
import transactionsRouter from "./transactions";
import bookingsRouter from "./bookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(balanceRouter);
router.use(destinationsRouter);
router.use(transactionsRouter);
router.use(bookingsRouter);

export default router;
