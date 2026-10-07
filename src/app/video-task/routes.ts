import { Router } from "express";
import {
  createVideoTask,
  getAllVideoTasks,
  updateVideoTask,
  deleteVideoTask,
  getAllVideoSubmissions,
  updateVideoSubmissionStatus,
  getActiveVideoTasks,
  submitVideoTask,
  getMyVideoSubmissions,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

// ── Student routes ──────────────────────────────────────────────────
router.get("/active", verifyUser, getActiveVideoTasks);
router.post("/submit", verifyUser, submitVideoTask);
router.get("/my-submissions", verifyUser, getMyVideoSubmissions);

// ── Admin routes ────────────────────────────────────────────────────
router.post("/", verifyUser, createVideoTask);
router.get("/", verifyUser, getAllVideoTasks);
router.put("/:id", verifyUser, updateVideoTask);
router.delete("/:id", verifyUser, deleteVideoTask);
router.get("/submissions", verifyUser, getAllVideoSubmissions);
router.patch("/submissions/:id/status", verifyUser, updateVideoSubmissionStatus);

export default router;
