import mongoose, { Schema, model, Document } from "mongoose";

export interface IDailyTask extends Document {
  title: string;
  link: string;
  description: string;
  reward: number;
  expiresAt: Date;
  isActive: boolean;
}

const DailyTaskSchema = new Schema<IDailyTask>(
  {
    title: { type: String, required: true },
    link: { type: String, required: true },
    description: { type: String, required: true },
    reward: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const DailyTask = model<IDailyTask>("DailyTask", DailyTaskSchema);

// ─── Submission ───────────────────────────────────────────────────────────────

export type SubmissionStatus = "Pending" | "Accepted" | "Rejected";

export interface IDailyTaskSubmission extends Document {
  taskId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  imageUrls: string[];
  status: SubmissionStatus;
}

const DailyTaskSubmissionSchema = new Schema<IDailyTaskSubmission>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "DailyTask", required: true },
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

export const DailyTaskSubmission = model<IDailyTaskSubmission>(
  "DailyTaskSubmission",
  DailyTaskSubmissionSchema
);
