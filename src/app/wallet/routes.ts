import { Router } from "express";
import {
  getMyWallet,
  getAdminIncome,
  getUserWallet,
  updateBalance,
} from "./controller";
import {
  verifySuperAdmin,
  verifyUser,
  verifyUserInactive,
} from "../../middleware/auth";

const router = Router();

router.get("/my-wallet", verifyUserInactive, getMyWallet);
router.get("/admin-income", verifySuperAdmin, getAdminIncome);
router.get("/user/:userId", verifySuperAdmin, getUserWallet);
router.put("/updateBalance/:userId", verifySuperAdmin, updateBalance);

export default router;
