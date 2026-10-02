import { Router } from "express";

import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

router.get("/", verifyUser, getCart);
router.post("/add", verifyUser, addToCart);
router.put("/update", verifyUser, updateCartItem);
router.delete("/remove/:productId", verifyUser, removeFromCart);
router.delete("/clear", verifyUser, clearCart);

export default router;
