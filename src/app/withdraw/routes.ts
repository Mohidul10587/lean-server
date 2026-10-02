import express from "express";
import {
  createWithdrawRequest,
  getWithdrawRequestsForAdmin,
  getMyWithdrawals,
  updateStatus,
} from "./withdraw.controller";
import {
  verifyAdmin,
  verifyAdminOrSuperAdmin,
  verifyUser,
} from "../../middleware/auth";

const router = express.Router();

// Routes
router.post("/createWithdrawRequest", verifyUser, createWithdrawRequest); // Create a transaction
router.get(
  "/getWithdrawRequestsForAdmin",
  verifyAdmin,
  getWithdrawRequestsForAdmin
);
router.get("/my-withdrawals", verifyUser, getMyWithdrawals);
// Route to update withdrawal status
router.put("/updateStatus/:withdrawId", verifyAdminOrSuperAdmin, updateStatus);
export default router;
