import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  studentId: string;
  studentName: string;
  studentUserId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  status: "pending" | "approved" | "rejected";
}

const reviewSchema = new Schema<IReview>(
  {
    studentId: { type: String, required: true, ref: "User" },
    studentName: { type: String, required: true },
    studentUserId: { type: String, required: true },
    rating: { type: Number, enum: [1, 2, 3, 4, 5], required: true },
    comment: { type: String, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>("Review", reviewSchema);
