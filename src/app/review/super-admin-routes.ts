import { Router } from "express";
import {
  getAllReviews,
  updateReviewStatus,
  deleteReview,
} from "./controller";
import { verifySuperAdmin } from "../../middleware/auth";

const router = Router();

router.get("/", verifySuperAdmin, getAllReviews);
router.patch("/:id/status", verifySuperAdmin, updateReviewStatus);
router.delete("/:id", verifySuperAdmin, deleteReview);

export default router;
