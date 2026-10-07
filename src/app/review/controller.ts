import { Request, Response, NextFunction } from "express";
import { Review } from "./model";
import { IUser } from "../user/model";

// Student: submit a review (active students only)
export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { rating, comment } = req.body;
    const user = req.user as IUser;

    if (!rating || !comment) {
      return res.status(400).json({
        message: {
          en: "Rating and comment are required",
          bn: "রেটিং এবং মন্তব্য প্রয়োজন",
        },
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: {
          en: "Rating must be between 1 and 5",
          bn: "রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে",
        },
      });
    }

    // One review per student
    const existing = await Review.findOne({ studentId: user.userId });
    if (existing) {
      return res.status(409).json({
        message: {
          en: "You have already submitted a review",
          bn: "আপনি ইতিমধ্যে একটি রিভিউ দিয়েছেন",
        },
      });
    }

    const review = await Review.create({
      studentId: user.userId,
      studentName: user.name,
      studentUserId: user.userId,
      rating,
      comment: comment.trim(),
    });

    res.status(201).json({
      message: {
        en: "Review submitted successfully. Awaiting approval.",
        bn: "রিভিউ সফলভাবে জমা হয়েছে। অনুমোদনের অপেক্ষায় আছে।",
      },
      review,
    });
  } catch (error) {
    next(error);
  }
};

// Student: get their own review
export const getMyReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    const review = await Review.findOne({ studentId: user.userId });
    res.json({ review: review || null });
  } catch (error) {
    next(error);
  }
};

// Public: get all approved reviews
export const getApprovedReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const reviews = await Review.find({ status: "approved" }).sort({
      createdAt: -1,
    });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
};

// Super Admin: get all reviews (pending + approved + rejected)
export const getAllReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const reviews = await Review.find(filter).sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    next(error);
  }
};

// Super Admin: approve or reject a review
export const updateReviewStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        message: {
          en: "Status must be 'approved' or 'rejected'",
          bn: "স্ট্যাটাস 'approved' অথবা 'rejected' হতে হবে",
        },
      });
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        message: { en: "Review not found", bn: "রিভিউ পাওয়া যায়নি" },
      });
    }

    res.json({
      message: {
        en: `Review ${status} successfully`,
        bn: `রিভিউ সফলভাবে ${status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"} হয়েছে`,
      },
      review,
    });
  } catch (error) {
    next(error);
  }
};

// Super Admin: delete a review
export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      return res.status(404).json({
        message: { en: "Review not found", bn: "রিভিউ পাওয়া যায়নি" },
      });
    }
    res.json({
      message: { en: "Review deleted successfully", bn: "রিভিউ সফলভাবে মুছে ফেলা হয়েছে" },
    });
  } catch (error) {
    next(error);
  }
};
