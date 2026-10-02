import { Router } from "express";
import {
  createReport,
  getMyReports,
  updateReport,
  deleteReport,
  getReports,
  resolveReport,
} from "./controller";
import {
  verifyUser,
  verifyAdmin,
  verifyAdminOrSuperAdmin,
} from "../../middleware/auth";

const router = Router();

router.post("/", verifyUser, createReport);
router.get("/my", verifyUser, getMyReports);
router.patch("/:id", verifyUser, updateReport);
router.delete("/:id", verifyUser, deleteReport);
router.get("/", verifyAdminOrSuperAdmin, getReports);
router.patch("/:id/resolve", verifyAdminOrSuperAdmin, resolveReport);

export default router;
