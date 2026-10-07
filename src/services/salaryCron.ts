import cron from "node-cron";
import mongoose from "mongoose";
import { User } from "../app/user/model";
import { Wallet } from "../app/wallet/model";
import { Transaction } from "../app/transaction/model";
import { Settings } from "../app/settings/model";

const SALARY_ROLES = [
  "auditor", "checker", "controller", "councilor",
  "super-admin", "lead-checker", "teacher", "accountant",
];

export const startSalaryCron = () => {
  cron.schedule("1 0 1 * *", async () => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const settings = await Settings.findOne().session(session);
      const roleSalaries = settings?.roleSalaries as Record<string, number> | undefined;
      if (!roleSalaries) {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Fetch all eligible users in one query
      const users = await User.find(
        { role: { $in: SALARY_ROLES }, isActive: true },
        { _id: 1, role: 1, name: 1 }
      ).session(session).lean();

      if (!users.length) {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      // Only process users with a salary > 0
      const eligibleUsers = users.filter((u) => (roleSalaries[u.role] ?? 0) > 0);
      if (!eligibleUsers.length) {
        await session.abortTransaction();
        session.endSession();
        return;
      }

      const userIds = eligibleUsers.map((u) => u._id);

      // Fix #2 (N+1): fetch ALL wallets in a single query
      const wallets = await Wallet.find({ userId: { $in: userIds } })
        .session(session)
        .lean();

      const walletMap = new Map(
        wallets.map((w) => [w.userId.toString(), w])
      );

      const monthLabel = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      // Build bulk operations
      const walletBulkOps: any[] = [];
      const transactions: any[] = [];

      for (const user of eligibleUsers) {
        const salary = roleSalaries[user.role] ?? 0;
        const uid = (user._id as any).toString();
        const wallet = walletMap.get(uid);
        const previousEarned = wallet?.earnedBalance ?? 0;
        const newBalance = previousEarned + salary;

        walletBulkOps.push({
          updateOne: {
            filter: { userId: user._id },
            update: { $inc: { earnedBalance: salary } },
            upsert: true,
          },
        });

        transactions.push({
          userId: user._id,
          previousAmount: previousEarned,
          recentAmount: salary,
          currentTotal: newBalance,
          description: `Monthly Salary - ${monthLabel}`,
          type: "credit",
        });
      }

      // Fix #2: single bulkWrite instead of N individual saves
      await Wallet.bulkWrite(walletBulkOps, { session });
      await Transaction.insertMany(transactions, { session });

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error distributing salaries:", error);
    }
  });
};
