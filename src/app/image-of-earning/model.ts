import mongoose, { Schema, model, Document } from "mongoose";

export interface IImageOfEarning extends Document {
  studentId: mongoose.Types.ObjectId;
  imageUrl: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  likes: string[]; // array of userId strings
}

const ImageOfEarningSchema = new Schema<IImageOfEarning>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    likes: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ImageOfEarning = model<IImageOfEarning>(
  "ImageOfEarning",
  ImageOfEarningSchema
);
