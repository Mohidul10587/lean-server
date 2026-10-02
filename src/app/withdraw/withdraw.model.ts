import mongoose, { model, Schema, Document, Types } from "mongoose";

// Type definition
export interface Withdraw extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  accountNumber: string;
  withdrawalMethod: string;
  status: "Pending" | "Rejected" | "Approved";
  rejectionReason?: string;
  createdAt: Date;
}
// Schema definition
const WithdrawSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    accountNumber: { type: String, required: true },
    withdrawalMethod: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Rejected", "Approved"],
      required: true,
      default: "Pending",
    },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

// Model definition
const Withdraw = model<Withdraw>("Withdraw", WithdrawSchema);

export default Withdraw;
