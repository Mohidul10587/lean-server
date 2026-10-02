import { Router } from "express";
import { getAllOrders, updateOrderStatus } from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/all", verifySuperAdmin, getAllOrders);
router.patch("/:orderId/status", verifySuperAdmin, updateOrderStatus);

export default router;
