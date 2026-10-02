// controllers/withdrawRequest.controller.ts
import { Request, Response } from "express";
import WithdrawRequest from "./withdraw.model";
import { Transaction } from "../transaction/model";
import { Wallet } from "../wallet/model";
import { User } from "../user/model";
import { Settings } from "../settings/model";
import mongoose from "mongoose";

// Create a new withdraw request
const calculateWithdraw = ({
  balance,
  amount,
  isFirstWithdraw,
  fee,
  isTeamLeader,
  minBalance,
}: {
  balance: number;
  amount: number;
  isFirstWithdraw: boolean;
  fee: number;
  isTeamLeader: boolean;
  minBalance: number;
}) => {
  const appliedFee = isFirstWithdraw ? fee : 0;

  const totalDeduction = amount + appliedFee;

  const remainingAfter = balance - totalDeduction;

  const requiredMinBalance = isTeamLeader ? minBalance : 0;

  const maxWithdrawable = Math.max(
    0,
    balance - requiredMinBalance - appliedFee
  );

  return {
    appliedFee,
    totalDeduction,
    remainingAfter,
    requiredMinBalance,
    maxWithdrawable,
    allowed: remainingAfter >= requiredMinBalance,
  };
};
export const createWithdrawRequest = async (req: Request, res: Response) => {
  try {
    const amount = Number(req.body.amount);
    const userId = req.user?._id;

    const user = await User.findById(userId);
    if (!user?.withdrawNumber?.number) {
      return res.status(400).json({
        message: "Please add withdrawal number first",
      });
    }

    // ❌ Block if there is any pending request (regardless of time)
    const pendingRequest = await WithdrawRequest.findOne({
      userId,
      status: "Pending",
    });

    if (pendingRequest) {
      return res.status(400).json({
        message: {
          en: "You already have a pending withdrawal request. Please wait for it to be processed.",
          bn: "আপনার একটি পেন্ডিং উত্তোলন অনুরোধ রয়েছে। অনুগ্রহ করে সেটি প্রসেস হওয়ার জন্য অপেক্ষা করুন।",
        },
      });
    }

    // ❌ Block if there is an approved request within the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentApprovedRequest = await WithdrawRequest.findOne({
      userId,
      status: "Approved",
      createdAt: { $gte: oneWeekAgo },
    });

    if (recentApprovedRequest) {
      const nextAllowed = new Date(
        recentApprovedRequest.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
      );

      return res.status(400).json({
        message: {
          en: `You can make a new withdrawal request after ${nextAllowed.toLocaleDateString(
            "en-GB"
          )}`,
          bn: `আপনি ${nextAllowed.toLocaleDateString(
            "bn-BD"
          )} তারিখের পরে নতুন উত্তোলন অনুরোধ করতে পারবেন`,
        },
      });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(400).json({ message: "Wallet not found" });
    }

    const settings = await Settings.findOne();

    const fee = settings?.withdrawalFee ?? 0;
    const minBalance = settings?.teamLeaderMinBalance ?? 0;

    const calc = calculateWithdraw({
      balance: wallet.earnedBalance,
      amount,
      isFirstWithdraw: !user.withdrawalFeePaid,
      fee,
      isTeamLeader: user.role === "team-leader",
      minBalance,
    });

    // ❌ Not allowed
    if (!calc.allowed) {
      return res.status(400).json({
        message: {
          en: `You can withdraw at most ৳${calc.maxWithdrawable}`,
          bn: `আপনি সর্বোচ্চ ৳${calc.maxWithdrawable} উত্তোলন করতে পারবেন`,
        },
      });
    }

    // ❌ Insufficient balance check
    if (wallet.earnedBalance < amount + calc.appliedFee) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const previousTotal = wallet.earnedBalance;

    // 💰 Deduct
    wallet.earnedBalance -= calc.totalDeduction;
    await wallet.save();

    // 💸 Fee transaction
    if (calc.appliedFee > 0) {
      user.withdrawalFeePaid = true;
      await user.save();

      await Transaction.create({
        userId,
        previousAmount: previousTotal,
        recentAmount: -calc.appliedFee,
        currentTotal: wallet.earnedBalance + amount,
        description: "One-time Withdrawal Fee",
        type: "debit",
      });
    }

    // 📤 Withdraw request
    const newWithdrawRequest = await WithdrawRequest.create({
      amount,
      accountNumber: user.withdrawNumber.number,
      withdrawalMethod: user.withdrawNumber.method,
      userId,
    });

    // 🧾 Transaction log
    await Transaction.create({
      userId,
      withdrawId: newWithdrawRequest._id,
      previousAmount: previousTotal - calc.appliedFee,
      recentAmount: -amount,
      currentTotal: wallet.earnedBalance,
      description: "Withdrawal Request",
      type: "debit",
    });

    return res.status(201).json({
      message: "Withdraw request created successfully",
      withdrawRequest: newWithdrawRequest,
      meta: {
        appliedFee: calc.appliedFee,
        maxWithdrawable: calc.maxWithdrawable,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating withdraw request",
      error,
    });
  }
};

// Get all withdraw requests for a seller
export const getWithdrawRequestsForAdmin = async (
  req: Request,
  res: Response
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [withdrawRequests, total] = await Promise.all([
      WithdrawRequest.find()
        .populate({
          path: "userId",
          model: "User",
          select: "name userId email phone username image",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      WithdrawRequest.countDocuments(),
    ]);

    res.status(200).json({
      message: "Withdraw requests fetched successfully",
      withdrawRequests,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching withdraw requests", error });
  }
};

// Get my withdrawals
export const getMyWithdrawals = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const withdrawals = await WithdrawRequest.find({ userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: "Error fetching withdrawals", error });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  const { withdrawId } = req.params;
  const { status, rejectionReason } = req.body;

  if (!["Rejected", "Approved"].includes(status)) {
    return res.status(400).json({
      message: {
        en: "Invalid status provided",
        bn: "অবৈধ স্ট্যাটাস প্রদান করা হয়েছে",
      },
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawRequest = await WithdrawRequest.findById(withdrawId).session(
      session
    );

    if (!withdrawRequest) {
      await session.abortTransaction();
      return res.status(404).json({
        message: {
          en: "Withdraw request not found",
          bn: "উত্তোলন অনুরোধ পাওয়া যায়নি",
        },
      });
    }

    // ✅ Prevent double processing
    if (withdrawRequest.status !== "Pending") {
      await session.abortTransaction();
      return res.status(400).json({
        message: {
          en: "Withdraw already processed",
          bn: "এই উত্তোলন ইতিমধ্যে প্রসেস করা হয়েছে",
        },
      });
    }

    // ✅ Update status
    withdrawRequest.status = status;
    if (status === "Rejected" && rejectionReason) {
      withdrawRequest.rejectionReason = rejectionReason;
    }

    await withdrawRequest.save({ session });

    const wallet = await Wallet.findOne({
      userId: withdrawRequest.userId,
    }).session(session);

    if (!wallet) {
      await session.abortTransaction();
      return res.status(404).json({
        message: {
          en: "Wallet not found",
          bn: "ওয়ালেট পাওয়া যায়নি",
        },
      });
    }

    // =========================
    // ✅ REJECTED (REFUND)
    // =========================
    if (status === "Rejected") {
      const previousTotal = wallet.earnedBalance;

      wallet.earnedBalance += withdrawRequest.amount;
      await wallet.save({ session });

      await Transaction.create(
        [
          {
            userId: withdrawRequest.userId,
            withdrawId: withdrawRequest._id,
            previousAmount: previousTotal,
            recentAmount: withdrawRequest.amount,
            currentTotal: wallet.earnedBalance,
            description: "Withdrawal Rejected - Refund",
            type: "credit",
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: {
        en: `Withdrawal ${status.toLowerCase()} successfully`,
        bn:
          status === "Approved"
            ? "উত্তোলন অনুমোদিত হয়েছে"
            : status === "Rejected"
            ? "উত্তোলন প্রত্যাখ্যাত হয়েছে"
            : "স্ট্যাটাস আপডেট হয়েছে",
      },
      withdrawRequest,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error updating withdraw status:", error);

    return res.status(500).json({
      message: {
        en: "Server error",
        bn: "সার্ভার ত্রুটি",
      },
    });
  }
};
