import { Router } from "express";
import { myTransactions, getTransactionsByUserId } from "./controller";
import { verifyUser, verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/my", verifyUser, myTransactions);
router.get("/user/:userId", verifySuperAdmin, getTransactionsByUserId);

export default router;
