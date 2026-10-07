import express from "express";
import {
  createWithdrawRequest,
  getWithdrawRequestsForAdmin,
  getMyWithdrawals,
  updateStatus,
} from "./withdraw.controller";
import {
  verifySuperAdmin,
  verifyUser,
} from "../../middleware/auth";

const router = express.Router();

router.post("/createWithdrawRequest", verifyUser, createWithdrawRequest);
router.get("/getWithdrawRequestsForAdmin", verifySuperAdmin, getWithdrawRequestsForAdmin);
router.get("/my-withdrawals", verifyUser, getMyWithdrawals);
router.put("/updateStatus/:withdrawId", verifySuperAdmin, updateStatus);

export default router;
