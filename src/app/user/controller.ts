import { Request, Response, NextFunction } from "express";
import { IUser, User } from "./model";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { registerSchema, loginSchema } from "./validation";
import { Wallet } from "../wallet/model";
import { Settings } from "../settings/model";
import { Transaction } from "../transaction/model";
import mongoose from "mongoose";
declare module "express" {
  interface Request {
    user?: IUser;
  }
}
// Fix #8: Fail fast — never fall back to hardcoded secrets
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables"
  );
}

const getCookieOptions = (req: Request, maxAge?: number) => {
  const origin = req.headers.origin || "";
  const isLocalClient = origin.includes("localhost");
  const useSecure = process.env.NODE_ENV === "production" && !isLocalClient;

  return {
    httpOnly: true,
    secure: useSecure,
    sameSite: useSecure ? ("none" as const) : ("lax" as const),
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
};

// Fix #6 + #9: include role in payload; access token now 15m instead of 1y
const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, role },
    JWT_SECRET!,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    JWT_REFRESH_SECRET!,
    { expiresIn: "10y" }
  );

  return { accessToken, refreshToken };
};
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, phone, password, role, referralCode } = registerSchema.parse(
      req.body
    );

    const existing = await User.findOne({ phone });
    if (existing)
      return res.status(400).json({
        message: { en: "Already registered", bn: "ইতিমধ্যে নিবন্ধিত" },
      });

    if (!referralCode)
      return res.status(400).json({
        message: { en: "Referral code is required", bn: "রেফারেল কোড আবশ্যক" },
      });

    const referrer = await User.findOne({ userId: referralCode });
    if (!referrer)
      return res.status(400).json({
        message: { en: "Invalid referral code", bn: "অবৈধ রেফারেল কোড" },
      });

    const referrerId = referrer._id;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      role,
      referrer: referrerId,
    });

    await Wallet.create({ userId: user._id });

    // Add 1 taka to referrer's wallet
    if (referrerId) {
      const referrerWallet = await Wallet.findOne({ userId: referrerId });
      if (referrerWallet) {
        const prevBalance = referrerWallet.earnedBalance;
        referrerWallet.earnedBalance += 1;
        await referrerWallet.save();

        await Transaction.create({
          userId: referrerId,
          previousAmount: prevBalance,
          recentAmount: 1,
          currentTotal: referrerWallet.earnedBalance,
          description: `Registration bonus from ${user.name} (${user.userId})`,
          type: "credit",
        });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user.userId, user.role);

    res.cookie(
      "accessToken",
      accessToken,
      getCookieOptions(req, 15 * 60 * 1000) // 15 minutes
    );
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(req, 10 * 365 * 24 * 60 * 60 * 1000)
    );

    res.status(201).json({
      message: { en: "Registered successfully", bn: "সফলভাবে নিবন্ধিত" },
      user,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);

    const users = await User.aggregate([
      { $match: { phone } },
      {
        $lookup: {
          from: "users",
          localField: "trainer",
          foreignField: "_id",
          as: "trainer",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamLeader",
          foreignField: "_id",
          as: "teamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "seniorTeamLeader",
          foreignField: "_id",
          as: "seniorTeamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $addFields: {
          trainer: { $arrayElemAt: ["$trainer", 0] },
          teamLeader: { $arrayElemAt: ["$teamLeader", 0] },
          seniorTeamLeader: { $arrayElemAt: ["$seniorTeamLeader", 0] },
        },
      },
    ]);

    const user = users[0];
    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({
        message: { en: "Invalid password", bn: "ভুল পাসওয়ার্ড" },
      });

    // Fix #6 + #9: pass role; 15m access token
    const { accessToken, refreshToken } = generateTokens(user.userId, user.role);

    res.cookie("accessToken", accessToken, getCookieOptions(req, 15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(req, 10 * 365 * 24 * 60 * 60 * 1000)
    );

    res.json({
      message: { en: "Login successful", bn: "লগইন সফল" },
      user,
    });
  } catch (err) {
    next(err);
  }
};
// Fix #7: loginByRole — single aggregate query instead of two separate queries
const loginByRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
  allowedRoles: string[]
) => {
  try {
    const { phone, password, role } = req.body;
    loginSchema.parse({ phone, password });

    // Fix #7: single aggregate instead of findOne + aggregate
    const users = await User.aggregate([
      { $match: { phone } },
      {
        $lookup: {
          from: "users",
          localField: "trainer",
          foreignField: "_id",
          as: "trainer",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamLeader",
          foreignField: "_id",
          as: "teamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "seniorTeamLeader",
          foreignField: "_id",
          as: "seniorTeamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $addFields: {
          trainer: { $arrayElemAt: ["$trainer", 0] },
          teamLeader: { $arrayElemAt: ["$teamLeader", 0] },
          seniorTeamLeader: { $arrayElemAt: ["$seniorTeamLeader", 0] },
        },
      },
    ]);

    const user = users[0];
    if (!user)
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });

    if (!allowedRoles.includes(user.role))
      return res.status(403).json({
        message: {
          en: "Access denied for this login portal",
          bn: "এই লগইন পোর্টালে প্রবেশাধিকার নেই",
        },
      });

    if (role && user.role !== role)
      return res.status(403).json({
        message: {
          en: "Selected role does not match your account",
          bn: "নির্বাচিত রোল আপনার অ্যাকাউন্টের সাথে মেলে না",
        },
      });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ message: { en: "Invalid password", bn: "ভুল পাসওয়ার্ড" } });

    // Fix #6 + #9: pass role; 15m access token
    const { accessToken, refreshToken } = generateTokens(user.userId, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(req, 15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(req, 10 * 365 * 24 * 60 * 60 * 1000)
    );
    res.json({ message: { en: "Login successful", bn: "লগইন সফল" }, user });
  } catch (err) {
    next(err);
  }
};

export const loginStudent = (req: Request, res: Response, next: NextFunction) =>
  loginByRole(req, res, next, ["student"]);

export const loginAdmin = (req: Request, res: Response, next: NextFunction) =>
  loginByRole(req, res, next, ["admin"]);

export const loginSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => loginByRole(req, res, next, ["super-admin"]);

export const loginOthers = (req: Request, res: Response, next: NextFunction) =>
  loginByRole(req, res, next, [
    "trainer",
    "team-leader",
    "senior-team-leader",
    "teacher",
    "auditor",
    "checker",
    "controller",
    "councilor",
  ]);

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET!) as { userId: string; role: string };
    const users = await User.aggregate([
      { $match: { userId: decoded.userId } },
      {
        $lookup: {
          from: "users",
          localField: "trainer",
          foreignField: "_id",
          as: "trainer",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamLeader",
          foreignField: "_id",
          as: "teamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "seniorTeamLeader",
          foreignField: "_id",
          as: "seniorTeamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $addFields: {
          trainer: { $arrayElemAt: ["$trainer", 0] },
          teamLeader: { $arrayElemAt: ["$teamLeader", 0] },
          seniorTeamLeader: { $arrayElemAt: ["$seniorTeamLeader", 0] },
        },
      },
    ]);

    const user = users[0];
    if (!user || user.isActive !== true)
      return res.status(401).json({ message: "Invalid refresh token" });

    // Fix #9: new access token also 15m, with role in payload
    const newAccessToken = jwt.sign(
      { userId: user.userId, role: user.role },
      JWT_SECRET!,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", newAccessToken, getCookieOptions(req, 15 * 60 * 1000));
    res.json({ success: true, user });
  } catch {
    res.status(401).json({ message: "Refresh failed" });
  }
};
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cookieOptions = getCookieOptions(req);
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.json({
      message: { en: "Logged out successfully", bn: "সফলভাবে লগআউট হয়েছে" },
    });
  } catch (error: any) {
    next(error);
  }
};

export const verify = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies.accessToken;
    if (!token)
      return res.status(401).json({
        message: { en: "No token provided", bn: "টোকেন প্রদান করা হয়নি" },
      });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const users = await User.aggregate([
      { $match: { userId: decoded.userId } },
      {
        $lookup: {
          from: "users",
          localField: "trainer",
          foreignField: "_id",
          as: "trainer",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamLeader",
          foreignField: "_id",
          as: "teamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "seniorTeamLeader",
          foreignField: "_id",
          as: "seniorTeamLeader",
          pipeline: [
            {
              $project: { name: 1, phone: 1, userId: 1, image: 1, whatsapp: 1 },
            },
          ],
        },
      },
      {
        $addFields: {
          trainer: { $arrayElemAt: ["$trainer", 0] },
          teamLeader: { $arrayElemAt: ["$teamLeader", 0] },
          seniorTeamLeader: { $arrayElemAt: ["$seniorTeamLeader", 0] },
        },
      },
    ]);

    const user = users[0];
    if (!user)
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });

    res.json({ user });
  } catch (error: any) {
    res
      .status(401)
      .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
  }
};

export const filterUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;

    const search = ((req.query.search as string) || "").trim();
    const status = req.query.status as string; // true | false | undefined
    const role = (req.query.role as string) || "all";

    const teamLeaderId = req.query.teamLeaderId as string;
    const trainerId = req.query.trainerId as string;
    const counselorId = req.query.counselorId as string;
    const seniorTeamLeaderId = req.query.seniorTeamLeaderId as string;

    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;
    const day = req.query.day ? Number(req.query.day) : null;

    // =========================
    // DATE RANGE (UTC SAFE)
    // =========================
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (year) {
      if (day && month) {
        startDate = new Date(Date.UTC(year, month - 1, day));
        endDate = new Date(Date.UTC(year, month - 1, day + 1));
      } else if (month) {
        startDate = new Date(Date.UTC(year, month - 1, 1));
        endDate = new Date(Date.UTC(year, month, 1));
      } else {
        startDate = new Date(Date.UTC(year, 0, 1));
        endDate = new Date(Date.UTC(year + 1, 0, 1));
      }
    }

    // =========================
    // BASE MATCH BUILDER
    // =========================
    const match: any = {};

    // role filter (IMPORTANT FIX)
    if (role && role !== "all") {
      match.role = role;
    }

    if (status === "true") match.isActive = true;
    if (status === "false") match.isActive = false;

    if (teamLeaderId) match.teamLeader = teamLeaderId;
    if (trainerId) match.trainer = trainerId;
    if (counselorId) match.councilor = counselorId;
    if (seniorTeamLeaderId) match.seniorTeamLeader = seniorTeamLeaderId;

    if (startDate && endDate) {
      match.createdAt = { $gte: startDate, $lt: endDate };
    }

    // =========================
    // SEARCH (SAFE + INDEX FRIENDLY)
    // =========================
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // =========================
    // SINGLE AGGREGATION PIPELINE
    // =========================
    const result = await User.aggregate([
      { $match: match },

      {
        $facet: {
          users: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },

            {
              $project: {
                userId: 1,
                name: 1,
                role: 1,
                phone: 1,
                image: 1,
                isActive: 1,
                trainer: 1,
                teamLeader: 1,
                seniorTeamLeader: 1,
                councilor: 1,
                createdAt: 1,
              },
            },

            {
              $lookup: {
                from: "users",
                localField: "trainer",
                foreignField: "_id",
                as: "trainer",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "teamLeader",
                foreignField: "_id",
                as: "teamLeader",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "seniorTeamLeader",
                foreignField: "_id",
                as: "seniorTeamLeader",
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "councilor",
                foreignField: "_id",
                as: "councilor",
              },
            },

            {
              $unwind: { path: "$trainer", preserveNullAndEmptyArrays: true },
            },
            {
              $unwind: {
                path: "$teamLeader",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$seniorTeamLeader",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$councilor",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],

          meta: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },

                activeCount: {
                  $sum: {
                    $cond: [{ $eq: ["$isActive", true] }, 1, 0],
                  },
                },

                inactiveCount: {
                  $sum: {
                    $cond: [{ $eq: ["$isActive", false] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    const users = result?.[0]?.users || [];
    const meta = result?.[0]?.meta?.[0] || {
      total: 0,
      activeCount: 0,
      inactiveCount: 0,
    };

    return res.json({
      users,
      total: meta.total,
      activeCount: meta.activeCount,
      inactiveCount: meta.inactiveCount,
      page,
      pages: Math.ceil(meta.total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const makeStudentTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const { studentId } = req.body;

    // Verify the student belongs to this TL (via one of TL's trainers)
    const tlTrainerIds = await User.find({
      teamLeader: teamLeaderId,
      role: "trainer",
    }).distinct("_id");

    const student = await User.findOne({
      _id: studentId,
      role: "student",
      $or: [{ trainer: { $in: tlTrainerIds } }, { teamLeader: teamLeaderId }],
    });

    if (!student)
      return res.status(404).json({
        message: {
          en: "Student not found under your team",
          bn: "স্টুডেন্ট আপনার টিমে পাওয়া যায়নি",
        },
      });

    student.role = "trainer";
    student.teamLeader = teamLeaderId as any;
    await student.save();

    res.json({
      message: {
        en: "Student promoted to trainer successfully",
        bn: "স্টুডেন্টকে সফলভাবে ট্রেইনার করা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const makeTrainerStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const { trainerId } = req.body;

    const trainer = await User.findOne({
      _id: trainerId,
      role: "trainer",
      teamLeader: teamLeaderId,
    });

    if (!trainer)
      return res.status(404).json({
        message: {
          en: "Trainer not found under your team",
          bn: "ট্রেইনার আপনার টিমে পাওয়া যায়নি",
        },
      });

    trainer.role = "student";
    await trainer.save();

    res.json({
      message: {
        en: "Trainer demoted to student successfully",
        bn: "ট্রেইনারকে সফলভাবে স্টুডেন্ট করা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getUserByIdForAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password")
      .populate("trainer", "name phone userId image")
      .populate("teamLeader", "name phone userId image")
      .populate("seniorTeamLeader", "name phone userId image")
      .lean();

    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    res.json({ user });
  } catch (error: any) {
    next(error);
  }
};

/* =========================
   OBJECTID SAFE NORMALIZER
========================= */
const toObjectIdOrNull = (v: any) => {
  if (v === undefined) return undefined; // not sent → ignore update
  if (v === "" || v === null) return null; // empty → remove relation
  if (mongoose.isValidObjectId(v)) return v; // valid → keep

  return null; // invalid garbage → null
};

/* =========================
   UPDATE USER (ADMIN)
========================= */
export const updateUserByIdByAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const {
      name,
      phone,
      email,
      whatsapp,
      country,
      language,
      role,
      isActive,
      image,
      coverImage,
      trainer,
      teamLeader,
      seniorTeamLeader,
      councilor,
      monthlySalary,
      withdrawNumber,
    } = req.body;

    const updateData: any = {};

    /* =========================
       BASIC FIELDS
    ========================= */
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (country !== undefined) updateData.country = country;
    if (language !== undefined) updateData.language = language;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (image !== undefined) updateData.image = image;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    /* =========================
       RELATION FIELDS (MAIN FIX)
    ========================= */
    const t = toObjectIdOrNull(trainer);
    const tl = toObjectIdOrNull(teamLeader);
    const stl = toObjectIdOrNull(seniorTeamLeader);
    const c = toObjectIdOrNull(councilor);

    if (t !== undefined) updateData.trainer = t;
    if (tl !== undefined) updateData.teamLeader = tl;
    if (stl !== undefined) updateData.seniorTeamLeader = stl;
    if (c !== undefined) updateData.councilor = c;

    /* =========================
       OPTIONAL FIELDS
    ========================= */
    if (monthlySalary !== undefined) {
      updateData.monthlySalary = monthlySalary;
    }

    if (withdrawNumber !== undefined) {
      updateData.withdrawNumber = withdrawNumber;
    }

    /* =========================
       ACTIVATION LOGIC
    ========================= */
    if (isActive === true) {
      const existing = await User.findById(id).select("activationDate");

      if (existing && !existing.activationDate) {
        updateData.activationDate = new Date();
      }
    }

    /* =========================
       DB UPDATE
    ========================= */
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });
    }

    return res.json({
      message: {
        en: "User updated successfully",
        bn: "ইউজার সফলভাবে আপডেট হয়েছে",
      },
      user,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    next(error);
  }
};
export const updatePasswordByAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const requester = req.user as IUser;

    if (!password) {
      return res.status(400).json({
        message: { en: "Password is required", bn: "পাসওয়ার্ড প্রয়োজন" },
      });
    }

    if (requester.role === "admin") {
      if ((requester._id as any).toString() === id) {
        return res.status(403).json({
          message: {
            en: "Admin cannot change their own password",
            bn: "অ্যাডমিন নিজের পাসওয়ার্ড পরিবর্তন করতে পারবেন না",
          },
        });
      }
      const target = await User.findById(id).select("role");
      if (target?.role === "super-admin" || target?.role === "admin") {
        return res.status(403).json({
          message: {
            en: "Admin cannot change Super Admin's and his own password",
            bn: "অ্যাডমিন সুপার অ্যাডমিনের পাসওয়ার্ড পরিবর্তন করতে পারবেন না",
          },
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { password: hashedPassword } },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });
    }

    res.json({
      message: {
        en: "Password updated successfully",
        bn: "পাসওয়ার্ড সফলভাবে আপডেট হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteUserByIdByAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("role");

    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    if (user.role === "trainer") {
      await User.updateMany({ trainer: user._id }, { $set: { trainer: null } });
    }

    await user.deleteOne();

    res.json({
      message: {
        en: "User deleted successfully",
        bn: "ইউজার সফলভাবে মুছে ফেলা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, image } = req.body;
    const userId = req.user?.userId;

    if (!userId)
      return res.status(401).json({
        message: { en: "Unauthorized", bn: "অননুমোদিত" },
      });

    const user = await User.findOneAndUpdate(
      { userId },
      { $set: { name, image } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    res.json({
      message: {
        en: "Profile updated successfully",
        bn: "প্রোফাইল সফলভাবে আপডেট হয়েছে",
      },
      user,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({
        message: {
          en: "User ID and role are required",
          bn: "ইউজার আইডি এবং রোল প্রয়োজন",
        },
      });
    }

    const validRoles = [
      "user",
      "student",
      "trainer",
      "team-leader",
      "senior-team-leader",
      "admin",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: { en: "Invalid role", bn: "অবৈধ রোল" },
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });
    }

    res.json({
      message: {
        en: "Role updated successfully",
        bn: "রোল সফলভাবে আপডেট হয়েছে",
      },
      user,
    });
  } catch (error: any) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId)
      return res.status(401).json({
        message: { en: "Unauthorized", bn: "অননুমোদিত" },
      });

    const user = await User.findOne({ userId });
    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    if (user.role === "admin")
      return res.status(403).json({
        message: {
          en: "Admin cannot change their own password",
          bn: "অ্যাডমিন নিজের পাসওয়ার্ড পরিবর্তন করতে পারবেন না",
        },
      });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      return res.status(401).json({
        message: {
          en: "Current password is incorrect",
          bn: "বর্তমান পাসওয়ার্ড ভুল",
        },
      });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      message: {
        en: "Password changed successfully",
        bn: "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, email, country, language, image, coverImage } = req.body;
    const userId = req.user?.userId;

    if (!userId)
      return res.status(401).json({
        message: { en: "Unauthorized", bn: "অননুমোদিত" },
      });

    const user = await User.findOneAndUpdate(
      { userId },
      { $set: { name, email, country, language, image, coverImage } },
      { new: true, runValidators: true }
    )
      .select("-password")
      .populate("trainer", "name phone userId image")
      .populate("teamLeader", "name phone userId image")
      .populate("seniorTeamLeader", "name phone userId image");

    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    res.json({
      message: {
        en: "Settings updated successfully",
        bn: "সেটিংস সফলভাবে আপডেট হয়েছে",
      },
      user,
    });
  } catch (error: any) {
    next(error);
  }
};

export async function activateAccount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Fix #10: wrap everything in a MongoDB transaction — if any step fails,
  // the fee deduction and all commission credits are rolled back atomically.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?._id;
    const user = await User.findById(userId)
      .populate([{ path: "referrer", select: "_id name userId" }])
      .session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
    }

    if (user.isActive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: {
          en: "Account already active",
          bn: "অ্যাকাউন্ট ইতিমধ্যে সক্রিয়",
        },
      });
    }

    // Fix #13: fetch settings once and reuse
    const settings = await Settings.findOne().session(session);
    const admissionFee = settings?.admissionFee || 0;
    const commission = settings?.activationCommission || {
      referrer: 0,
      trainer: 0,
      teamLeader: 0,
      seniorTeamLeader: 0,
      councilor: 0,
    };

    // Assign default team leader if user has none
    if (!user.teamLeader && settings?.defaultTeamLeaderId) {
      const defaultTL = await User.findOne({
        userId: settings.defaultTeamLeaderId,
      }).session(session);
      if (defaultTL) {
        user.teamLeader = defaultTL._id as any;
      }
    }

    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: { en: "Insufficient balance", bn: "অপর্যাপ্ত ব্যালেন্স" },
      });
    }

    if (wallet.earnedBalance < admissionFee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: { en: "Insufficient balance", bn: "অপর্যাপ্ত ব্যালেন্স" },
      });
    }

    // --- Deduct admission fee ---
    const previousBalance = wallet.earnedBalance;
    wallet.earnedBalance -= admissionFee;
    await wallet.save({ session });

    await Transaction.create(
      [
        {
          userId,
          previousAmount: previousBalance,
          recentAmount: -admissionFee,
          currentTotal: wallet.earnedBalance,
          description: `Account Activation Fee Deducted`,
          type: "debit",
        },
      ],
      { session }
    );

    // --- Distribute commissions ---
    // Fix #1 (N+1): fetch referrer doc + all commission wallets in parallel
    const referrer = user.referrer as any;

    if (referrer?._id) {
      const [referrerDoc, refWallet] = await Promise.all([
        User.findById(referrer._id)
          .populate([
            { path: "trainer", select: "_id name userId" },
            { path: "teamLeader", select: "_id name userId" },
            { path: "seniorTeamLeader", select: "_id name userId" },
          ])
          .session(session),
        commission.referrer > 0
          ? Wallet.findOne({ userId: referrer._id }).session(session)
          : Promise.resolve(null),
      ]);

      const trainerDoc = (referrerDoc?.trainer as any)?._id
        ? (referrerDoc?.trainer as any)
        : null;
      const teamLeaderDoc = (referrerDoc?.teamLeader as any)?._id
        ? (referrerDoc?.teamLeader as any)
        : null;

      // Fetch commission wallets in parallel
      const [trainerWallet, tlWallet] = await Promise.all([
        trainerDoc?._id && commission.trainer > 0
          ? Wallet.findOne({ userId: trainerDoc._id }).session(session)
          : Promise.resolve(null),
        teamLeaderDoc?._id && commission.teamLeader > 0
          ? Wallet.findOne({ userId: teamLeaderDoc._id }).session(session)
          : Promise.resolve(null),
      ]);

      // 1. Referrer commission
      if (refWallet && commission.referrer > 0) {
        const prevBal = refWallet.earnedBalance;
        refWallet.earnedBalance += commission.referrer;
        await refWallet.save({ session });
        await Transaction.create(
          [
            {
              userId: referrer._id,
              previousAmount: prevBal,
              recentAmount: commission.referrer,
              currentTotal: refWallet.earnedBalance,
              description: `You got ${commission.referrer} Tk as Referral Commission from ${user.name} (${user.userId}) Activation`,
              type: "credit",
            },
          ],
          { session }
        );
      }

      // 2. Referrer's trainer commission
      if (trainerWallet && commission.trainer > 0) {
        const prevBal = trainerWallet.earnedBalance;
        trainerWallet.earnedBalance += commission.trainer;
        await trainerWallet.save({ session });
        await Transaction.create(
          [
            {
              userId: trainerDoc._id,
              previousAmount: prevBal,
              recentAmount: commission.trainer,
              currentTotal: trainerWallet.earnedBalance,
              description: `Trainer Commission from ${user.name} (${user.userId}) Activation`,
              type: "credit",
            },
          ],
          { session }
        );
      }

      // 3. Referrer's team leader commission
      if (tlWallet && commission.teamLeader > 0) {
        const prevBal = tlWallet.earnedBalance;
        tlWallet.earnedBalance += commission.teamLeader;
        await tlWallet.save({ session });
        await Transaction.create(
          [
            {
              userId: teamLeaderDoc._id,
              previousAmount: prevBal,
              recentAmount: commission.teamLeader,
              currentTotal: tlWallet.earnedBalance,
              description: `Team Leader Commission from ${user.name} (${user.userId}) Activation - Student referred by ${referrer.userId}`,
              type: "credit",
            },
          ],
          { session }
        );
      }
    }

    // 4. Councilor commission
    const councilor = user.councilor as any;
    if (councilor && commission.councilor > 0) {
      const cWallet = await Wallet.findOne({ userId: councilor }).session(session);
      if (cWallet) {
        const prevBal = cWallet.earnedBalance;
        cWallet.earnedBalance += commission.councilor;
        await cWallet.save({ session });
        await Transaction.create(
          [
            {
              userId: councilor,
              previousAmount: prevBal,
              recentAmount: commission.councilor,
              currentTotal: cWallet.earnedBalance,
              description: `Councilor Commission from ${user.name} (${user.userId}) Activation`,
              type: "credit",
            },
          ],
          { session }
        );
      }
    }

    user.isActive = true;
    user.activationDate = new Date();
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: {
        en: "Account activated successfully",
        bn: "অ্যাকাউন্ট সফলভাবে সক্রিয় হয়েছে",
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

export async function addWithdrawNumber(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?._id;
    const { number, method } = req.body;

    if (!userId)
      return res.status(401).json({
        message: { en: "Unauthorized", bn: "অননুমোদিত" },
      });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    if (user.withdrawNumber?.number)
      return res.status(400).json({
        message: {
          en: "Withdrawal number already added. Contact admin to update.",
          bn: "উত্তোলন নম্বর ইতিমধ্যে যোগ করা হয়েছে। আপডেট করতে অ্যাডমিনের সাথে যোগাযোগ করুন।",
        },
      });

    user.withdrawNumber = { number, method };
    await user.save();

    res.json({
      message: {
        en: "Withdrawal number added successfully",
        bn: "উত্তোলন নম্বর সফলভাবে যোগ করা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
}

export const getTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teachers = await User.find({
      role: {
        $in: ["teacher"],
      },
    })
      .select("_id name userId role")
      .sort({ name: 1 });
    res.status(200).json(teachers);
  } catch (error: any) {
    next(error);
  }
};

export const getUsersByRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const role = req.query.role as string;
    if (!role)
      return res.status(400).json({ message: { en: "Role is required" } });
    const users = await User.find({ role })
      .select("_id name userId phone")
      .sort({ name: 1 })
      .lean();
    res.json(users);
  } catch (error: any) {
    next(error);
  }
};

function buildDateRange(
  year?: string,
  month?: string,
  day?: string
): { startDate: Date; endDate: Date } | null {
  if (!year) return null;
  const BDT_OFFSET = 6 * 60 * 60 * 1000;
  const y = parseInt(year);
  const m = month ? parseInt(month) : null;
  const d = day ? parseInt(day) : null;
  let startDate: Date;
  let endDate: Date;
  if (d && m) {
    startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - BDT_OFFSET);
    endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - BDT_OFFSET);
  } else if (m) {
    startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - BDT_OFFSET);
    endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - BDT_OFFSET);
  } else {
    startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0) - BDT_OFFSET);
    endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - BDT_OFFSET);
  }
  return { startDate, endDate };
}

function buildDateQuery(
  status: string,
  year?: string,
  month?: string,
  day?: string
) {
  const range = buildDateRange(year, month, day);
  if (!range) return {};
  const { startDate, endDate } = range;
  return status === "true"
    ? { activationDate: { $gte: startDate, $lte: endDate } }
    : { createdAt: { $gte: startDate, $lte: endDate } };
}

export const listForTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const trainerId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const exactUserId = (req.query.exactUserId as string) || "";
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const query: any = { trainer: trainerId, role: "student" };

    if (exactUserId) {
      query.userId = exactUserId;
    } else if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") query.isActive = status === "true";
    Object.assign(query, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(query)
        .select("userId name role phone image isActive activationDate referrer")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const teamLeadersForSTL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stlId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const baseQuery: any = { seniorTeamLeader: stlId, role: "team-leader" };
    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") baseQuery.isActive = status === "true";
    Object.assign(baseQuery, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(baseQuery)
        .select("userId name role phone image isActive activationDate referrer")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const trainersForSTL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stlId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const teamLeaderIds = await User.distinct("_id", {
      seniorTeamLeader: stlId,
      role: "team-leader",
    });

    const baseQuery: any = {
      teamLeader: { $in: teamLeaderIds },
      role: "trainer",
    };
    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") baseQuery.isActive = status === "true";
    Object.assign(baseQuery, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(baseQuery)
        .select(
          "userId name role phone image isActive activationDate teamLeader referrer"
        )
        .populate("teamLeader", "userId name")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const trainersForTL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const baseQuery: any = { teamLeader: teamLeaderId, role: "trainer" };
    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") baseQuery.isActive = status === "true";
    Object.assign(baseQuery, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(baseQuery)
        .select("userId name role phone image isActive activationDate referrer")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const listForSeniorTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stlId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const exactUserId = (req.query.exactUserId as string) || "";
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    // Resolve hierarchy: STL → team leaders → trainers → students
    const teamLeaderIds = await User.distinct("_id", {
      seniorTeamLeader: stlId,
      role: "team-leader",
    });
    const trainerIds = await User.distinct("_id", {
      teamLeader: { $in: teamLeaderIds },
      role: "trainer",
    });

    const baseQuery: any = { trainer: { $in: trainerIds }, role: "student" };
    if (exactUserId) {
      baseQuery.userId = exactUserId;
    } else if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") baseQuery.isActive = status === "true";
    Object.assign(baseQuery, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(baseQuery)
        .select(
          "userId name role phone image isActive activationDate trainer teamLeader referrer"
        )
        .populate("trainer", "userId name")
        .populate("teamLeader", "userId name")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    // Hierarchy: team leaders → trainers (with student counts)
    const teamLeaders = await User.find({
      seniorTeamLeader: stlId,
      role: "team-leader",
    })
      .select("_id userId name phone image isActive")
      .lean();

    const tlIds = teamLeaders.map((tl: any) => tl._id);

    const trainersForHierarchy = await User.find({
      teamLeader: { $in: tlIds },
      role: "trainer",
    })
      .select("_id userId name phone image isActive teamLeader")
      .lean();

    const trainerIdsForCount = trainersForHierarchy.map((t: any) => t._id);
    const studentCounts = await User.aggregate([
      { $match: { trainer: { $in: trainerIdsForCount }, role: "student" } },
      { $group: { _id: "$trainer", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    studentCounts.forEach((s: any) => {
      countMap[s._id.toString()] = s.count;
    });

    const tlMap: Record<string, any> = {};
    teamLeaders.forEach((tl: any) => {
      tlMap[tl._id.toString()] = { ...tl, trainers: [] };
    });
    trainersForHierarchy.forEach((t: any) => {
      const tlId = t.teamLeader?.toString();
      if (tlId && tlMap[tlId]) {
        tlMap[tlId].trainers.push({
          ...t,
          studentCount: countMap[t._id.toString()] || 0,
        });
      }
    });

    res.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      hierarchy: Object.values(tlMap),
    });
  } catch (error: any) {
    next(error);
  }
};

export const myTeamForTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;

    const trainers = await User.find({
      teamLeader: teamLeaderId,
      role: "trainer",
    })
      .select("_id userId name phone image isActive")
      .lean();

    const trainerIds = trainers.map((t: any) => t._id);

    const studentQuery: any = { trainer: { $in: trainerIds }, role: "student" };
    if (status !== "all") studentQuery.isActive = status === "true";
    Object.assign(studentQuery, buildDateQuery(status, year, month, day));

    const studentCounts = await User.aggregate([
      { $match: studentQuery },
      { $group: { _id: "$trainer", count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    studentCounts.forEach((s: any) => {
      countMap[s._id.toString()] = s.count;
    });

    const trainersWithCount = trainers.map((t: any) => ({
      ...t,
      studentCount: countMap[t._id.toString()] || 0,
    }));

    res.json({ trainers: trainersWithCount });
  } catch (error: any) {
    next(error);
  }
};

export const myTeamForSeniorTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stlId = req.user?._id;
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;

    const statusQuery = status !== "all" ? { isActive: status === "true" } : {};
    const dateQuery = buildDateQuery(status, year, month, day);

    const teamLeaders = await User.find({
      seniorTeamLeader: stlId,
      role: "team-leader",
    })
      .select("_id userId name phone image isActive")
      .lean();

    const tlIds = teamLeaders.map((tl: any) => tl._id);
    const trainers = await User.find({
      teamLeader: { $in: tlIds },
      role: "trainer",
    })
      .select("_id userId name phone image isActive teamLeader")
      .lean();

    const trainerIds = trainers.map((t: any) => t._id);

    const studentQuery: any = {
      trainer: { $in: trainerIds },
      role: "student",
      ...statusQuery,
      ...dateQuery,
    };

    const studentCounts = await User.aggregate([
      { $match: studentQuery },
      { $group: { _id: "$trainer", count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    studentCounts.forEach((s: any) => {
      countMap[s._id.toString()] = s.count;
    });

    const tlMap: Record<string, any> = {};
    teamLeaders.forEach((tl: any) => {
      tlMap[tl._id.toString()] = { ...tl, trainers: [] };
    });

    trainers.forEach((t: any) => {
      const tlId = t.teamLeader?.toString();
      if (tlId && tlMap[tlId]) {
        tlMap[tlId].trainers.push({
          ...t,
          studentCount: countMap[t._id.toString()] || 0,
        });
      }
    });

    res.json({ hierarchy: Object.values(tlMap) });
  } catch (error: any) {
    next(error);
  }
};

export const studentsOfTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { trainerId } = req.params;
    const requesterId = req.user?._id;

    const trainer = (await User.findById(trainerId).lean()) as any;
    if (!trainer) {
      return res
        .status(403)
        .json({ message: { en: "Forbidden", bn: "অননুমোদিত" } });
    }

    const students = await User.find({ trainer: trainerId, role: "student" })
      .select("userId name role phone image isActive activationDate")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ users: students });
  } catch (error: any) {
    next(error);
  }
};

export const unassignedStudentsForTL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const status = (req.query.status as string) || "all";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const baseQuery: any = {
      teamLeader: teamLeaderId,
      role: "student",
      trainer: null,
    };
    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (status !== "all") baseQuery.isActive = status === "true";
    Object.assign(baseQuery, buildDateQuery(status, year, month, day));

    const [users, total] = await Promise.all([
      User.find(baseQuery)
        .select(
          "userId name phone image isActive activationDate createdAt role"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const getInactiveStudentsForController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const exactUserId = (req.query.exactUserId as string) || "";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const matchStage: any = { role: "student", isActive: false };
    if (exactUserId) {
      matchStage.userId = exactUserId;
    } else if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) : null;
      const d = day ? parseInt(day) : null;
      if (d && m) {
        matchStage.createdAt = {
          $gte: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
        };
      } else if (m) {
        matchStage.createdAt = {
          $gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
        };
      } else {
        matchStage.createdAt = {
          $gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
        };
      }
    }

    const pipeline: any[] = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "councilor",
          foreignField: "_id",
          as: "councilor",
          pipeline: [{ $project: { userId: 1, name: 1, image: 1 } }],
        },
      },
      { $unwind: { path: "$councilor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "referrer",
          foreignField: "_id",
          as: "_referrerDoc",
          pipeline: [{ $project: { teamLeader: 1 } }],
        },
      },
      { $unwind: { path: "$_referrerDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "_referrerDoc.teamLeader",
          foreignField: "_id",
          as: "teamLeader",
          pipeline: [{ $project: { userId: 1, name: 1, image: 1 } }],
        },
      },
      { $unwind: { path: "$teamLeader", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "referrer",
          foreignField: "_id",
          as: "referrer",
          pipeline: [{ $project: { userId: 1, name: 1 } }],
        },
      },
      { $unwind: { path: "$referrer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: 1,
          name: 1,
          phone: 1,
          image: 1,
          isActive: 1,
          createdAt: 1,
          councilor: 1,
          teamLeader: 1,
          referrer: 1,
        },
      },
    ];

    const [users, total] = await Promise.all([
      User.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
      User.aggregate([...pipeline, { $count: "total" }]).then(
        (r) => r[0]?.total ?? 0
      ),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    next(error);
  }
};

export const getCounselors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const counselors = await User.find({ role: "councilor" })
      .select("_id userId name image")
      .lean();
    res.json({ counselors });
  } catch (error: any) {
    next(error);
  }
};

export const assignCounselor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, counselorId } = req.body;
    const student = await User.findByIdAndUpdate(
      studentId,
      { councilor: counselorId },
      { new: true }
    ).select("userId name councilor");
    if (!student)
      return res.status(404).json({
        message: { en: "Student not found", bn: "স্টুডেন্ট পাওয়া যায়নি" },
      });
    res.json({
      message: { en: "Counselor assigned", bn: "কাউন্সেলর অ্যাসাইন হয়েছে" },
      student,
    });
  } catch (error: any) {
    next(error);
  }
};

export const removeCounselor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const student = await User.findByIdAndUpdate(
      studentId,
      { $unset: { councilor: "" } },
      { new: true }
    ).select("userId name councilor");
    if (!student)
      return res.status(404).json({
        message: { en: "Student not found", bn: "স্টুডেন্ট পাওয়া যায়নি" },
      });
    res.json({
      message: { en: "Counselor removed", bn: "কাউন্সেলর সরানো হয়েছে" },
      student,
    });
  } catch (error: any) {
    next(error);
  }
};

export const removeTrainerFromStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    await User.findByIdAndUpdate(studentId, { trainer: null });
    res.json({
      message: {
        en: "Trainer removed successfully",
        bn: "ট্রেইনার সফলভাবে সরানো হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const assignTrainerToStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const { studentId, trainerId } = req.body;

    // Verify trainer belongs to this TL
    const trainer = await User.findOne({
      _id: trainerId,
      teamLeader: teamLeaderId,
      role: "trainer",
    });
    if (!trainer)
      return res.status(403).json({
        message: {
          en: "Trainer not under your team",
          bn: "এই ট্রেইনার আপনার টিমে নেই",
        },
      });

    const student = await User.findOneAndUpdate(
      {
        _id: studentId,
        teamLeader: teamLeaderId,
        role: "student",
        trainer: null,
      },
      { trainer: trainerId },
      { new: true }
    );
    if (!student)
      return res.status(404).json({
        message: {
          en: "Student not found or already assigned",
          bn: "স্টুডেন্ট পাওয়া যায়নি বা ইতিমধ্যে অ্যাসাইন করা হয়েছে",
        },
      });

    res.json({
      message: {
        en: "Trainer assigned successfully",
        bn: "ট্রেইনার সফলভাবে অ্যাসাইন করা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const changeStudentTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;
    const { studentId, trainerId } = req.body;

    // Verify trainer belongs to this TL
    const trainer = await User.findOne({
      _id: trainerId,
      teamLeader: teamLeaderId,
      role: "trainer",
      isActive: true,
    });
    if (!trainer)
      return res.status(403).json({
        message: {
          en: "Trainer not found or not active under your team",
          bn: "ট্রেইনার পাওয়া যায়নি বা আপনার টিমে সক্রিয় নেই",
        },
      });

    // Verify student belongs to this TL (via any of TL's trainers)
    const tlTrainerIds = await User.find({
      teamLeader: teamLeaderId,
      role: "trainer",
    }).distinct("_id");

    const student = await User.findOneAndUpdate(
      { _id: studentId, teamLeader: teamLeaderId, role: "student" },
      { trainer: trainerId },
      { new: true }
    ).select("name userId trainer");

    if (!student)
      return res.status(404).json({
        message: {
          en: "Student not found under your team",
          bn: "স্টুডেন্ট আপনার টিমে পাওয়া যায়নি",
        },
      });

    res.json({
      message: {
        en: "Trainer changed successfully",
        bn: "ট্রেইনার সফলভাবে পরিবর্তন করা হয়েছে",
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const myReferralsForTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const trainerId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = ((req.query.search as string) || "").replace(/^\+/, "");
    const exactUserId = (req.query.exactUserId as string) || "";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const directStudentIds = await User.distinct("_id", {
      trainer: trainerId,
      role: "student",
    });

    const baseQuery: any = {
      role: "student",
      referrer: { $in: directStudentIds },
    };

    if (exactUserId) {
      baseQuery.userId = exactUserId;
    } else if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) : null;
      const d = day ? parseInt(day) : null;
      let startDate: Date;
      let endDate: Date;
      if (d && m) {
        startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      } else if (m) {
        startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      } else {
        startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
      }
      baseQuery.$or = [
        { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
        { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
      ];
    }

    const countQuery = { ...baseQuery };

    const [users, total, activeCount, inactiveCount] = await Promise.all([
      User.find(baseQuery)
        .select(
          "userId name phone image isActive createdAt referrer role messagedBy"
        )
        .populate("referrer", "userId name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
      User.countDocuments({ ...countQuery, isActive: true }),
      User.countDocuments({ ...countQuery, isActive: false }),
    ]);

    res.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      activeCount,
      inactiveCount,
    });
  } catch (error: any) {
    next(error);
  }
};
export const myReferralsForSTL = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stlId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const tlIds = await User.distinct("_id", {
      seniorTeamLeader: stlId,
      role: "team-leader",
    });
    const trainerIds = await User.distinct("_id", {
      teamLeader: { $in: tlIds },
      role: "trainer",
    });
    const directStudentIds = await User.distinct("_id", {
      trainer: { $in: trainerIds },
      role: "student",
    });

    const baseQuery: any = {
      role: "student",
      referrer: { $in: directStudentIds },
    };

    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) : null;
      const d = day ? parseInt(day) : null;
      let startDate: Date;
      let endDate: Date;
      if (d && m) {
        startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      } else if (m) {
        startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      } else {
        startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
      }
      baseQuery.$or = [
        { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
        { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
      ];
    }

    const countQuery = { ...baseQuery };

    const [users, total, activeCount, inactiveCount] = await Promise.all([
      User.find(baseQuery)
        .select("userId name phone image isActive createdAt referrer role")
        .populate("referrer", "userId name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
      User.countDocuments({ ...countQuery, isActive: true }),
      User.countDocuments({ ...countQuery, isActive: false }),
    ]);

    res.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      activeCount,
      inactiveCount,
    });
  } catch (error: any) {
    next(error);
  }
};
export const getTrainersAndTeamLeaders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const [trainers, teamLeaders] = await Promise.all([
      User.find({ role: "trainer" })
        .select("_id userId name image teamLeader")
        .sort({ name: 1 })
        .lean(),
      User.find({ role: "team-leader" })
        .select("_id userId name image")
        .sort({ name: 1 })
        .lean(),
    ]);
    res.json({ trainers, teamLeaders });
  } catch (error: any) {
    next(error);
  }
};

export const getMyStudentsForCounselor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const counselorId = req.user?._id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const exactUserId = (req.query.exactUserId as string) || "";
    const year = req.query.year as string;
    const month = req.query.month as string;
    const day = req.query.day as string;
    const skip = (page - 1) * limit;

    const baseQuery: any = { councilor: counselorId, role: "student" };

    if (exactUserId) {
      baseQuery.userId = exactUserId;
    } else if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) : null;
      const d = day ? parseInt(day) : null;
      let startDate: Date;
      let endDate: Date;
      if (d && m) {
        startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
      } else if (m) {
        startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      } else {
        startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
      }
      baseQuery.$or = [
        { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
        { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
      ];
    }

    const countQuery = { ...baseQuery };

    const [users, total, activeCount, inactiveCount] = await Promise.all([
      User.find(baseQuery)
        .select("userId name phone image isActive role createdAt referrer")
        .populate("referrer", "userId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(baseQuery),
      User.countDocuments({ ...countQuery, isActive: true }),
      User.countDocuments({ ...countQuery, isActive: false }),
    ]);

    res.json({
      users,
      total,
      page,
      pages: Math.ceil(total / limit),
      activeCount,
      inactiveCount,
    });
  } catch (error: any) {
    next(error);
  }
};

export const toggleUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("isActive role");
    if (!user)
      return res.status(404).json({
        message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
      });

    user.isActive = !user.isActive;
    await user.save();

    if (!user.isActive && user.role === "trainer") {
      await User.updateMany({ trainer: user._id }, { $set: { trainer: null } });
    }

    res.json({
      message: {
        en: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
        bn: `ইউজার সফলভাবে ${
          user.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"
        } করা হয়েছে`,
      },
      isActive: user.isActive,
    });
  } catch (error: any) {
    next(error);
  }
};

export const specialUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, teamLeaderId, limit = "1000" } = req.query;

    const query: any = { isActive: true };
    if (role) query.role = role;
    if (teamLeaderId) query.teamLeader = teamLeaderId;

    const users = await User.find(query)
      .select("_id userId name role phone")
      .limit(Number(limit));

    res.json({ users });
  } catch (error: any) {
    next(error);
  }
};

export const getAllTeamLeaders = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const teamLeaders = await User.find(
      { role: "team-leader" },
      { name: 1, userId: 1, _id: 0 }
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: teamLeaders.length,
      data: teamLeaders,
    });
  } catch (error) {
    console.error("Error fetching team leaders:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch team leaders",
    });
  }
};

// Get users grouped by their deactivated/deleted team leaders
export const getOrphanedUsersByTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Users whose teamLeader is set but that TL is either deactivated or deleted
    const orphanedUsers = await User.aggregate([
      {
        $match: {
          teamLeader: { $ne: null },
          role: { $in: ["student", "trainer"] },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "teamLeader",
          foreignField: "_id",
          as: "tlData",
        },
      },
      {
        $match: {
          $or: [
            { tlData: { $size: 0 } }, // TL deleted
            { "tlData.0.isActive": false }, // TL deactivated
          ],
        },
      },
      {
        $addFields: {
          tlInfo: { $arrayElemAt: ["$tlData", 0] },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          userId: 1,
          phone: 1,
          role: 1,
          isActive: 1,
          teamLeader: 1,
          "tlInfo._id": 1,
          "tlInfo.name": 1,
          "tlInfo.userId": 1,
          "tlInfo.isActive": 1,
        },
      },
    ]);

    // Group by TL (use teamLeader id as key; for deleted TL, tlInfo will be null)
    const groupedMap: Record<
      string,
      {
        tl: {
          _id: string;
          name: string;
          userId: string;
          isActive?: boolean;
        } | null;
        users: any[];
      }
    > = {};

    for (const user of orphanedUsers) {
      const tlId = user.teamLeader?.toString() || "deleted";
      if (!groupedMap[tlId]) {
        groupedMap[tlId] = {
          tl: user.tlInfo
            ? {
                _id: user.tlInfo._id,
                name: user.tlInfo.name,
                userId: user.tlInfo.userId,
                isActive: user.tlInfo.isActive,
              }
            : null,
          users: [],
        };
      }
      groupedMap[tlId].users.push({
        _id: user._id,
        name: user.name,
        userId: user.userId,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      });
    }

    const groups = Object.entries(groupedMap).map(([tlId, data]) => ({
      tlId,
      tl: data.tl,
      users: data.users,
    }));

    res.json({ groups });
  } catch (error) {
    next(error);
  }
};

// Bulk reassign team leader for a list of users
export const bulkReassignTeamLeader = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userIds, newTeamLeaderId } = req.body;

    if (!Array.isArray(userIds) || !userIds.length || !newTeamLeaderId) {
      return res.status(400).json({
        message: {
          en: "userIds and newTeamLeaderId are required",
          bn: "userIds এবং newTeamLeaderId আবশ্যক",
        },
      });
    }

    const newTL = await User.findById(newTeamLeaderId).select("role");
    if (!newTL || newTL.role !== "team-leader") {
      return res.status(400).json({
        message: { en: "Invalid team leader", bn: "অবৈধ টিম লিডার" },
      });
    }

    await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { teamLeader: newTeamLeaderId } }
    );

    res.json({
      message: {
        en: "Team leader reassigned successfully",
        bn: "টিম লিডার সফলভাবে পুনরায় নির্ধারণ করা হয়েছে",
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleMessaged = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sender = req.user;
    const senderId = sender?._id;
    const { userId } = req.params;

    const target = await User.findOne({ userId });
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyMessaged = target.messagedBy?.some(
      (entry) => entry.by?.toString() === senderId?.toString()
    );

    if (alreadyMessaged) {
      await User.updateOne(
        { userId },
        { $pull: { messagedBy: { by: senderId } } }
      );
      return res.json({ messaged: false });
    } else {
      await User.updateOne(
        { userId },
        {
          $push: {
            messagedBy: {
              by: senderId,
              byName: sender?.name || "",
              byRole: sender?.role || "",
              at: new Date(),
            },
          },
        }
      );
      return res.json({ messaged: true });
    }
  } catch (error) {
    next(error);
  }
};
