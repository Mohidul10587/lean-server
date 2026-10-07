import mongoose, { Schema, model, Document } from "mongoose";

export type VideoSubmissionStatus = "Pending" | "Accepted" | "Rejected";

export interface IVideoTask extends Document {
  title: string;
  videoLink: string;
  description: string;
  reward: number;
  isActive: boolean;
}

const VideoTaskSchema = new Schema<IVideoTask>(
  {
    title: { type: String, required: true },
    videoLink: { type: String, required: true },
    description: { type: String, default: "" },
    reward: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const VideoTask = model<IVideoTask>("VideoTask", VideoTaskSchema);

// ─── Submission ───────────────────────────────────────────────────────────────

export interface IVideoTaskSubmission extends Document {
  taskId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  imageUrls: string[];
  status: VideoSubmissionStatus;
}

const VideoTaskSubmissionSchema = new Schema<IVideoTaskSubmission>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "VideoTask", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrls: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const VideoTaskSubmission = model<IVideoTaskSubmission>(
  "VideoTaskSubmission",
  VideoTaskSubmissionSchema
);
