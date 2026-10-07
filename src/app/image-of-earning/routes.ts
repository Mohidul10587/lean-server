import { Router } from "express";
import {
  submitImage,
  getMyPosts,
  getApprovedPosts,
  toggleLike,
  getAllPosts,
  updatePostStatus,
  deletePost,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

// ── Public ──────────────────────────────────────────────────────────
router.get("/approved", getApprovedPosts);
router.patch("/:id/like", toggleLike);

// ── Student ─────────────────────────────────────────────────────────
router.post("/", verifyUser, submitImage);
router.get("/my", verifyUser, getMyPosts);

// ── Admin ───────────────────────────────────────────────────────────
router.get("/", verifyUser, getAllPosts);
router.patch("/:id/status", verifyUser, updatePostStatus);
router.delete("/:id", verifyUser, deletePost);

export default router;
