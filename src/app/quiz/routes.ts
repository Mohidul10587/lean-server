import { Router } from "express";
import {
  createQuiz,
  getAllQuizzes,
  updateQuiz,
  deleteQuiz,
  getAllQuizSubmissions,
  getActiveQuiz,
  submitQuiz,
  getMyQuizStatus,
} from "./controller";
import { verifyUser } from "../../middleware/auth";

const router = Router();

// ── Student routes ──────────────────────────────────────────────────
router.get("/active", verifyUser, getActiveQuiz);
router.post("/submit", verifyUser, submitQuiz);
router.get("/status/:quizId", verifyUser, getMyQuizStatus);

// ── Admin routes ────────────────────────────────────────────────────
router.post("/", verifyUser, createQuiz);
router.get("/", verifyUser, getAllQuizzes);
router.put("/:id", verifyUser, updateQuiz);
router.delete("/:id", verifyUser, deleteQuiz);
router.get("/submissions", verifyUser, getAllQuizSubmissions);

export default router;
