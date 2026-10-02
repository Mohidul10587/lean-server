import { Router } from "express";
import { verifyUser, verifyAdmin } from "../../middleware/auth";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  createDirectOrder,
} from "./controller";

const router = Router();

router.post("/create", createOrder);
router.post("/create-direct", createDirectOrder);
router.get("/my-orders", verifyUser, getMyOrders);
router.get("/all", verifyAdmin, getAllOrders);
router.patch("/:orderId/status", verifyAdmin, updateOrderStatus);

export default router;
