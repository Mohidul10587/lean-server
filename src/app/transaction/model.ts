import mongoose, { Schema, model, Document } from "mongoose";

interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  depositId?: mongoose.Types.ObjectId;
  withdrawId?: mongoose.Types.ObjectId;
  previousAmount: number;
  recentAmount: number;
  currentTotal: number;
  description: string;
  type: "credit" | "debit";
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    depositId: { type: Schema.Types.ObjectId, ref: "Deposit" },
    withdrawId: { type: Schema.Types.ObjectId, ref: "Withdraw" },
    previousAmount: { type: Number, required: true },
    recentAmount: { type: Number, required: true },
    currentTotal: { type: Number, required: true },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
  },
  { timestamps: true }
);

export const Transaction = model<ITransaction>(
  "Transaction",
  TransactionSchema
);
