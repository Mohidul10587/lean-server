import { Router } from "express";
import { getReports, resolveReport } from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/", verifySuperAdmin, getReports);
router.patch("/:id/resolve", verifySuperAdmin, resolveReport);

export default router;
