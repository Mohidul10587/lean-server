import { Router } from "express";
import {
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
  getAllSubmissions,
  updateSubmissionStatus,
  getActiveTasks,
  submitTask,
  getMySubmissions,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

// ── Student routes ──────────────────────────────────────────────────
router.get("/active", verifyUser, getActiveTasks);
router.post("/submit", verifyUser, submitTask);
router.get("/my-submissions", verifyUser, getMySubmissions);

// ── Admin routes ────────────────────────────────────────────────────
router.post("/", verifyUser, createTask);
router.get("/", verifyUser, getAllTasks);
router.put("/:id", verifyUser, updateTask);
router.delete("/:id", verifyUser, deleteTask);
router.get("/submissions", verifyUser, getAllSubmissions);
router.patch("/submissions/:id/status", verifyUser, updateSubmissionStatus);

export default router;
