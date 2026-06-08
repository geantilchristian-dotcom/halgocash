import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import balanceRouter from "./balance";
import adminRouter from "./admin";
import couponsRouter from "./coupons";
import drawsRouter from "./draws";
import ticketsRouter from "./tickets";
import vendorsRouter from "./vendors";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(balanceRouter);
router.use(adminRouter);
router.use(couponsRouter);
router.use(drawsRouter);
router.use(ticketsRouter);
router.use(vendorsRouter);
router.use(statsRouter);

export default router;
