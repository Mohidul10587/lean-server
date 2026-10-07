import { Request, Response, NextFunction } from "express";
import { DailyTask, DailyTaskSubmission } from "./model";
import { Wallet } from "../wallet/model";
import { Transaction } from "../transaction/model";

// ─── Admin: Create a task ─────────────────────────────────────────────────────
export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, link, description, reward, expiresAt } = req.body;
    const task = await DailyTask.create({
      title,
      link,
      description,
      reward: reward ?? 0,
      expiresAt: expiresAt
        ? new Date(expiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
    });
    res.status(201).json({ message: "Task created", task });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all tasks (with pagination) ───────────────────────────────────
export const getAllTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tasks = await DailyTask.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Update a task ─────────────────────────────────────────────────────
export const updateTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const task = await DailyTask.findByIdAndUpdate(id, req.body, { new: true });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task updated", task });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Delete a task ─────────────────────────────────────────────────────
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await DailyTask.findByIdAndDelete(id);
    res.json({ message: "Task deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all submissions ───────────────────────────────────────────────
export const getAllSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const submissions = await DailyTaskSubmission.find(filter)
      .populate("taskId", "title reward")
      .populate("studentId", "name userId phone")
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Approve / Reject submission ───────────────────────────────────────
export const updateSubmissionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "Accepted" | "Rejected"

    const submission = await DailyTaskSubmission.findById(id).populate<{
      taskId: { reward: number; title: string };
    }>("taskId", "reward title");
    if (!submission)
      return res.status(404).json({ message: "Submission not found" });

    const previous = submission.status;
    submission.status = status;
    await submission.save();

    // Credit wallet when accepted (only if transitioning from non-Accepted)
    if (status === "Accepted" && previous !== "Accepted") {
      const reward = (submission.taskId as any)?.reward ?? 0;
      if (reward > 0) {
        let wallet = await Wallet.findOne({ userId: submission.studentId });
        if (wallet) {
          const prev = wallet.earnedBalance;
          wallet.earnedBalance += reward;
          await wallet.save();
          await Transaction.create({
            userId: submission.studentId,
            previousAmount: prev,
            recentAmount: reward,
            currentTotal: wallet.earnedBalance,
            description: `Daily task reward: ${(submission.taskId as any)?.title}`,
            type: "credit",
          });
        }
      }
    }

    res.json({ message: `Submission ${status}`, submission });
  } catch (error) {
    next(error);
  }
};

// ─── Student: Get active tasks ────────────────────────────────────────────────
export const getActiveTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const now = new Date();
    const tasks = await DailyTask.find({
      isActive: true,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

// ─── Student: Submit proof ────────────────────────────────────────────────────
export const submitTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId, imageUrls } = req.body;
    const studentId = (req as any).user._id;

    const task = await DailyTask.findById(taskId);
    if (!task || !task.isActive || task.expiresAt < new Date())
      return res.status(400).json({ message: "Task is not active or expired" });

    const existing = await DailyTaskSubmission.findOne({ taskId, studentId });
    if (existing)
      return res.status(400).json({ message: "Already submitted for this task" });

    const submission = await DailyTaskSubmission.create({
      taskId,
      studentId,
      imageUrls,
      status: "Pending",
    });
    res.status(201).json({ message: "Submission created", submission });
  } catch (error) {
    next(error);
  }
};

// ─── Student: Get my submissions ──────────────────────────────────────────────
export const getMySubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = (req as any).user._id;
    const submissions = await DailyTaskSubmission.find({ studentId }).sort({
      createdAt: -1,
    });
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};
