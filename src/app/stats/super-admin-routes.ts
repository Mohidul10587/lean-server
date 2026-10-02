import { Router } from "express";
import { getStats } from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/", verifySuperAdmin, getStats);

export default router;
