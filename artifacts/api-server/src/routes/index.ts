import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kakaoRouter from "./kakao";
import adminRouter from "./admin";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/kakao", kakaoRouter);
router.use("/profile", profileRouter);
router.use(adminRouter);

export default router;
