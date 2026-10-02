import { Router } from "express";
import {
  getWithdrawRequestsForAdmin,
  updateStatus,
} from "./withdraw.controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get(
  "/getWithdrawRequestsForAdmin",
  verifySuperAdmin,
  getWithdrawRequestsForAdmin
);
router.put("/updateStatus/:withdrawId", verifySuperAdmin, updateStatus);

export default router;
