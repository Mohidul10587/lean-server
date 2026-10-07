import { Router } from "express";
import {
  createReview,
  getMyReview,
  getApprovedReviews,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

// Public — anyone can see approved reviews
router.get("/approved", getApprovedReviews);

// Student — submit or view own review (active student required)
router.post("/", verifyUser, createReview);
router.get("/my", verifyUser, getMyReview);

export default router;
