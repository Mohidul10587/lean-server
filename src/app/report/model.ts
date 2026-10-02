import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
  auditorId: mongoose.Types.ObjectId;
  seniorTeamLeaderId: string;
  teamLeaderId: string;
  trainerId: string;
  description: string;
  status: "pending" | "resolved";
}

const reportSchema = new Schema<IReport>(
  {
    auditorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    seniorTeamLeaderId: { type: String },
    teamLeaderId: { type: String },
    trainerId: { type: String },
    description: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>("Report", reportSchema);
