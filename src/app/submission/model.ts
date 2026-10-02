import mongoose, { Schema, model, Document, ObjectId } from "mongoose";

interface ISubmission extends Document {
  studentId: ObjectId;
  courseId: ObjectId;
  classNumber: number;
  imageUrl?: string;   // legacy single-image field
  imageUrls: string[];
  videoUrl?: string;
  teacherId: ObjectId;
  trainerId: ObjectId;
  teamLeaderId: ObjectId;
  seniorTeamLeaderId: ObjectId;
  status: "Pending" | "Accepted" | "Rejected";
  createdAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId },
    classNumber: { type: Number, required: true },
    imageUrl: { type: String },          // legacy — kept for old documents
    imageUrls: { type: [String], default: [] },
    videoUrl: { type: String },
    teacherId: { type: Schema.Types.ObjectId, ref: "User" },
    trainerId: { type: Schema.Types.ObjectId, ref: "User" },
    teamLeaderId: { type: Schema.Types.ObjectId, ref: "User" },
    seniorTeamLeaderId: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const Submission = model<ISubmission>("Submission", SubmissionSchema);
