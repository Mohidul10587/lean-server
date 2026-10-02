import cron from "node-cron";
import { User } from "../app/user/model";
import { Wallet } from "../app/wallet/model";
import { Transaction } from "../app/transaction/model";
import { Settings } from "../app/settings/model";

const SALARY_ROLES = [
  "admin", "auditor", "checker", "controller", "councilor",
  "super-admin", "lead-checker", "teacher", "accountant",
];

export const startSalaryCron = () => {
  cron.schedule("1 0 1 * *", async () => {
    try {
      const settings = await Settings.findOne();
      const roleSalaries = settings?.roleSalaries as Record<string, number> | undefined;
      if (!roleSalaries) return;

      const users = await User.find({ role: { $in: SALARY_ROLES }, isActive: true });

      for (const user of users) {
        const salary = roleSalaries[user.role] ?? 0;
        if (salary <= 0) continue;

        let wallet = await Wallet.findOne({ userId: user._id });
        const previousEarned = wallet ? wallet.earnedBalance : 0;

        if (!wallet) {
          wallet = await Wallet.create({ userId: user._id, earnedBalance: salary });
        } else {
          wallet.earnedBalance += salary;
          await wallet.save();
        }

        await Transaction.create({
          userId: user._id,
          previousAmount: previousEarned,
          recentAmount: salary,
          currentTotal: wallet.earnedBalance,
          description: `Monthly Salary - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
          type: "credit",
        });
      }
    } catch (error) {
      console.error("Error distributing salaries:", error);
    }
  });
};
