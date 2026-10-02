import { Router } from "express";
import {
  getMyWallet,
  getAdminIncome,
  getUserWallet,
  updateBalance,
} from "./controller";
import {
  verifyAdmin,
  verifyUser,
  verifyUserInactive,
} from "../../middleware/auth";

const router = Router();

router.get("/my-wallet", verifyUserInactive, getMyWallet);
router.get("/admin-income", verifyAdmin, getAdminIncome);
router.get("/user/:userId", verifyAdmin, getUserWallet);
router.put("/updateBalance/:userId", verifyAdmin, updateBalance);

export default router;
