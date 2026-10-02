import { ClientSession } from "mongoose";

export const deductWalletBalance = async (
  wallet: any,
  amount: number,
  session?: ClientSession
) => {
  if (wallet.earnedBalance < amount) {
    throw new Error("Insufficient balance");
  }

  const previousTotal = wallet.earnedBalance;
  wallet.earnedBalance -= amount;
  await wallet.save({ session });

  return {
    previousTotal,
    currentTotal: wallet.earnedBalance,
  };
};
