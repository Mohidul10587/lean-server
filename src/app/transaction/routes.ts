import { Router } from "express";
import { myTransactions, getTransactionsByUserId } from "./controller";
import { verifyUser, verifyAdminOrSuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/my", verifyUser, myTransactions);
router.get("/user/:userId", verifyAdminOrSuperAdmin, getTransactionsByUserId);

export default router;
