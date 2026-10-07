import { Router } from "express";
import { getStats, getTopEarners } from "./controller";

const router = Router();

router.get("/", getStats);
router.get("/top-earners", getTopEarners);

export default router;
