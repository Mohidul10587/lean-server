import { Router } from "express";
import {
  getAdminIncome,
  getUserWallet,
  updateBalance,
} from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/admin-income", verifySuperAdmin, getAdminIncome);
router.get("/user/:userId", verifySuperAdmin, getUserWallet);
router.put("/updateBalance/:userId", verifySuperAdmin, updateBalance);

export default router;
