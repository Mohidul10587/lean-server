
import mongoose, { Schema, model, Document } from "mongoose";

interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  earnedBalance: number;
}

const WalletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  earnedBalance: { type: Number, default: 0 },
}, { timestamps: true });

export const Wallet = model<IWallet>("Wallet", WalletSchema);
