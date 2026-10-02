import { Request, Response } from "express";
import { Wallet } from "./model";
import { Transaction } from "../transaction/model";

export const getMyWallet = async (req: Request, res: Response, next: Function) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.user?._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: req.user?._id, earnedBalance: 0 });
    }
    res.status(200).json(wallet);
  } catch (error) {
    next(error);
  }
};

export const getAdminIncome = async (req: Request, res: Response, next: Function) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.user?._id });
    res.status(200).json({ totalIncome: wallet ? wallet.earnedBalance : 0 });
  } catch (error) {
    next(error);
  }
};

export const getUserWallet = async (req: Request, res: Response, next: Function) => {
  try {
    const { userId } = req.params;
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({ userId, earnedBalance: 0 });
    }
    res.status(200).json(wallet);
  } catch (error) {
    next(error);
  }
};

export const updateBalance = async (req: Request, res: Response, next: Function) => {
  try {
    const { userId } = req.params;
    const { amount, operation, description } = req.body;

    let wallet = await Wallet.findOne({ userId });
    const previousAmount = wallet ? wallet.earnedBalance : 0;

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        earnedBalance: operation === "add" ? amount : 0,
      });
    } else {
      if (operation === "add") {
        wallet.earnedBalance += amount;
      } else if (operation === "subtract") {
        wallet.earnedBalance = Math.max(0, wallet.earnedBalance - amount);
      }
      await wallet.save();
    }

    await Transaction.create({
      userId,
      previousAmount,
      recentAmount: operation === "add" ? amount : -amount,
      currentTotal: wallet.earnedBalance,
      description: description || `Balance ${operation === "add" ? "Added" : "Subtracted"} by Admin`,
      type: operation === "add" ? "credit" : "debit",
    });

    res.status(200).json(wallet);
  } catch (error) {
    next(error);
  }
};
