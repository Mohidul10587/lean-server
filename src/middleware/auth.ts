import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../app/user/model";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res.status(401).json({ message: "Unauthorized accessToken" });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user || user.isActive == false)
      return res.status(401).json({ message: "Unauthorized isActive" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Token expired" });
  }
};
export const verifyUserInactive = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Token expired" });
  }
};

export const verifyAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res
        .status(401)
        .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user)
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
    if (user.role !== "admin" && user.role !== "super-admin") {
      return res.status(403).json({
        message: {
          en: "Admin access required",
          bn: "অ্যাডমিন অ্যাক্সেস প্রয়োজন",
        },
      });
    }

    req.user = user;
    next();
  } catch (error: any) {
    res
      .status(401)
      .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
  }
};

export const verifySuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res
        .status(401)
        .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user)
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
    if (user.role !== "super-admin")
      return res.status(403).json({
        message: {
          en: "Super Admin access required",
          bn: "সুপার অ্যাডমিন অ্যাক্সেস প্রয়োজন",
        },
      });

    req.user = user;
    next();
  } catch (error: any) {
    res
      .status(401)
      .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
  }
};

export const verifyAdminOrSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res
        .status(401)
        .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user)
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
    if (user.role !== "admin" && user.role !== "super-admin")
      return res.status(403).json({
        message: {
          en: "Admin access required",
          bn: "অ্যাডমিন অ্যাক্সেস প্রয়োজন",
        },
      });

    req.user = user;
    next();
  } catch {
    res
      .status(401)
      .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
  }
};
