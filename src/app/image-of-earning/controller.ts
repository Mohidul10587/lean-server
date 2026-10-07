import { Request, Response, NextFunction } from "express";
import { ImageOfEarning } from "./model";

// ─── Student: Submit image ────────────────────────────────────────────────────
export const submitImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { imageUrl, description } = req.body;
    const studentId = (req as any).user._id;

    const post = await ImageOfEarning.create({
      studentId,
      imageUrl,
      description,
      status: "pending",
    });
    res.status(201).json({ message: "Image submitted for review", post });
  } catch (error) {
    next(error);
  }
};

// ─── Student: Get my posts ────────────────────────────────────────────────────
export const getMyPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studentId = (req as any).user._id;
    const posts = await ImageOfEarning.find({ studentId }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

// ─── Public: Get approved posts (Home Page) ───────────────────────────────────
export const getApprovedPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const posts = await ImageOfEarning.find({ status: "approved" })
      .populate("studentId", "name userId image")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

// ─── Public: Like / Unlike a post ────────────────────────────────────────────
export const toggleLike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // pass userId from client

    const post = await ImageOfEarning.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.status !== "approved")
      return res.status(403).json({ message: "Post not approved" });

    const idx = post.likes.indexOf(userId);
    if (idx === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(idx, 1);
    }
    await post.save();

    res.json({ likes: post.likes.length, liked: idx === -1 });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Get all posts ─────────────────────────────────────────────────────
export const getAllPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status) filter.status = status;
    const posts = await ImageOfEarning.find(filter)
      .populate("studentId", "name userId phone")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Update status (approve / reject) ──────────────────────────────────
export const updatePostStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const post = await ImageOfEarning.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json({ message: `Post ${status}`, post });
  } catch (error) {
    next(error);
  }
};

// ─── Admin: Delete post ───────────────────────────────────────────────────────
export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await ImageOfEarning.findByIdAndDelete(id);
    res.json({ message: "Post deleted" });
  } catch (error) {
    next(error);
  }
};
