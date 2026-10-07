import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../app/user/model";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Fail fast if secrets are missing — never fall back to hardcoded strings
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables"
  );
}

// JWT payload carries role — role-check middlewares skip DB entirely
interface JwtPayload {
  userId: string;
  role: string;
}

// Shared token verifier — always fetches the full user document
async function resolveUser(token: string) {
  const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;
  const user = await User.findOne({ userId: decoded.userId });
  return user;
}

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res.status(401).json({ message: "Unauthorized accessToken" });

    const user = await resolveUser(token);

    if (!user || user.isActive !== true)
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

    const user = await resolveUser(token);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Token expired" });
  }
};

export const verifySuperAdmin = (
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

    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

    if (decoded.role !== "super-admin")
      return res.status(403).json({
        message: {
          en: "Super Admin access required",
          bn: "সুপার অ্যাডমিন অ্যাক্সেস প্রয়োজন",
        },
      });

    User.findOne({ userId: decoded.userId })
      .then((user) => {
        if (!user)
          return res.status(404).json({
            message: {
              en: "User not found",
              bn: "ইউজার পাওয়া যায়নি",
            },
          });
        req.user = user;
        next();
      })
      .catch(() =>
        res
          .status(401)
          .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } })
      );
  } catch {
    res
      .status(401)
      .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
  }
};
