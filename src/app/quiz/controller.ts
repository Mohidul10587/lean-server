import { Request, Response, NextFunction } from "express";
import { Quiz, QuizSubmission } from "./model";

// ─── Admin: Publish quiz ──────────────────────────────────────────────────────
export const createQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { questions, rules, reward } = req.body;
    // Deactivate any currently active quiz
    await Quiz.updateMany({ isActive: true }, { isActive: false });
    const quiz = await Quiz.create({ questions, rules, reward: reward ?? 0, isActive: true });
    res.status(201).json({ message: "Quiz published", quiz });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all quizzes ───────────────────────────────────────────────────
export const getAllQuizzes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const quizzes = await Quiz.find().sort({ createdAt: -1 });
    res.json(quizzes);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Update quiz ───────────────────────────────────────────────────────
export const updateQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findByIdAndUpdate(id, req.body, { new: true });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json({ message: "Quiz updated", quiz });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Delete quiz ───────────────────────────────────────────────────────
export const deleteQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await Quiz.findByIdAndDelete(id);
    res.json({ message: "Quiz deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all submissions ───────────────────────────────────────────────
export const getAllQuizSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { quizId } = req.query;
    const filter: any = {};
    if (quizId) filter.quizId = quizId;
    const submissions = await QuizSubmission.find(filter)
      .populate("quizId", "questions")
      .populate("studentId", "name userId phone")
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

// ─── Student: Get active quiz ─────────────────────────────────────────────────
export const getActiveQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const quiz = await Quiz.findOne({ isActive: true });
    if (!quiz) return res.status(404).json({ message: "No active quiz" });

    // Strip correct answers before sending to student
    const safeQuiz = {
      _id: quiz._id,
      rules: quiz.rules,
      reward: quiz.reward,
      createdAt: quiz.createdAt,
      questions: quiz.questions.map((q) => ({
        question: q.question,
        options: q.options,
      })),
    };
    res.json(safeQuiz);
  } catch (error) {
    next(error);
  }
};

// ─── Student: Submit quiz ─────────────────────────────────────────────────────
export const submitQuiz = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { quizId, name, idNumber, whatsappNumber, answers } = req.body;
    const studentId = (req as any).user._id;

    const quiz = await Quiz.findById(quizId);
    if (!quiz || !quiz.isActive)
      return res.status(400).json({ message: "Quiz not found or inactive" });

    // 7-day restriction: check last submission for this quiz
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await QuizSubmission.findOne({
      quizId,
      studentId,
      submittedAt: { $gte: sevenDaysAgo },
    });
    if (recent)
      return res.status(400).json({
        message: "You can only submit this quiz once every 7 days",
      });

    const submission = await QuizSubmission.create({
      quizId,
      studentId,
      name,
      idNumber,
      whatsappNumber,
      answers,
      submittedAt: new Date(),
    });
    res.status(201).json({ message: "Quiz submitted successfully", submission });
  } catch (error) {
    next(error);
  }
};

// ─── Student: Check if already submitted (within 7 days) ─────────────────────
export const getMyQuizStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = (req as any).user._id;
    const { quizId } = req.params;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const submission = await QuizSubmission.findOne({
      quizId,
      studentId,
      submittedAt: { $gte: sevenDaysAgo },
    });
    res.json({ submitted: !!submission, submission: submission || null });
  } catch (error) {
    next(error);
  }
};
