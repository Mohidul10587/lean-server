import { Request, Response, NextFunction } from "express";
import { Transaction as Model } from "./model";
import { User } from "../user/model";

export const myTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string;
    const skip = (page - 1) * limit;

    const query: any = { userId: req.user?._id };
    if (type && type !== "all") {
      query.type = type;
    }

    const [items, total] = await Promise.all([
      Model.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Model.countDocuments(query),
    ]);

    res.status(200).json({
      transactions: items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    next(error);
  }
};

export const getTransactionsByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const type = req.query.type as string;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ userId }).select("_id");
    if (!user) {
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });
    }

    const query: any = { userId: user._id };
    if (type && type !== "all") query.type = type;

    const [items, total] = await Promise.all([
      Model.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Model.countDocuments(query),
    ]);

    res.status(200).json({
      transactions: items,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    next(error);
  }
};
