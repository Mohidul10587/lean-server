import { Request, Response, NextFunction } from "express";
import { VideoTask, VideoTaskSubmission } from "./model";
import { Wallet } from "../wallet/model";
import { Transaction } from "../transaction/model";

// ─── Admin: Create ────────────────────────────────────────────────────────────
export const createVideoTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, videoLink, description, reward } = req.body;
    const task = await VideoTask.create({ title, videoLink, description, reward: reward ?? 0 });
    res.status(201).json({ message: "Video task created", task });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all ───────────────────────────────────────────────────────────
export const getAllVideoTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tasks = await VideoTask.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Update ────────────────────────────────────────────────────────────
export const updateVideoTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const task = await VideoTask.findByIdAndUpdate(id, req.body, { new: true });
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task updated", task });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Delete ────────────────────────────────────────────────────────────
export const deleteVideoTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await VideoTask.findByIdAndDelete(id);
    res.json({ message: "Task deleted" });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all submissions ───────────────────────────────────────────────
export const getAllVideoSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const submissions = await VideoTaskSubmission.find(filter)
      .populate("taskId", "title reward")
      .populate("studentId", "name userId phone")
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Update submission status ─────────────────────────────────────────
export const updateVideoSubmissionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const submission = await VideoTaskSubmission.findById(id).populate<{
      taskId: { reward: number; title: string };
    }>("taskId", "reward title");
    if (!submission)
      return res.status(404).json({ message: "Submission not found" });

    const previous = submission.status;
    submission.status = status;
    await submission.save();

    if (status === "Accepted" && previous !== "Accepted") {
      const reward = (submission.taskId as any)?.reward ?? 0;
      if (reward > 0) {
        const wallet = await Wallet.findOne({ userId: submission.studentId });
        if (wallet) {
          const prev = wallet.earnedBalance;
          wallet.earnedBalance += reward;
          await wallet.save();
          await Transaction.create({
            userId: submission.studentId,
            previousAmount: prev,
            recentAmount: reward,
            currentTotal: wallet.earnedBalance,
            description: `Video task reward: ${(submission.taskId as any)?.title}`,
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

// ─── Student: Get active video tasks ─────────────────────────────────────────
export const getActiveVideoTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tasks = await VideoTask.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

// ─── Student: Submit proof ────────────────────────────────────────────────────
export const submitVideoTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId, imageUrls } = req.body;
    const studentId = (req as any).user._id;

    const task = await VideoTask.findById(taskId);
    if (!task || !task.isActive)
      return res.status(400).json({ message: "Task not found or inactive" });

    const existing = await VideoTaskSubmission.findOne({ taskId, studentId });
    if (existing)
      return res.status(400).json({ message: "Already submitted for this task" });

    const submission = await VideoTaskSubmission.create({
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

// ─── Student: My submissions ──────────────────────────────────────────────────
export const getMyVideoSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = (req as any).user._id;
    const submissions = await VideoTaskSubmission.find({ studentId }).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};
