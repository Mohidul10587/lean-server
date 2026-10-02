"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleMessaged = exports.bulkReassignTeamLeader = exports.getOrphanedUsersByTeamLeader = exports.getAllTeamLeaders = exports.specialUsers = exports.toggleUserStatus = exports.getMyStudentsForCounselor = exports.getTrainersAndTeamLeaders = exports.myReferralsForSTL = exports.myReferralsForTrainer = exports.changeStudentTrainer = exports.assignTrainerToStudent = exports.removeTrainerFromStudent = exports.removeCounselor = exports.assignCounselor = exports.getCounselors = exports.getInactiveStudentsForController = exports.unassignedStudentsForTL = exports.studentsOfTrainer = exports.myTeamForSeniorTeamLeader = exports.myTeamForTeamLeader = exports.listForSeniorTeamLeader = exports.trainersForTL = exports.trainersForSTL = exports.teamLeadersForSTL = exports.listForTrainer = exports.getUsersByRole = exports.getTeachers = exports.updateSettings = exports.changePassword = exports.updateUserRole = exports.updateProfile = exports.deleteUserByIdByAdmin = exports.updatePasswordByAdmin = exports.updateUserByIdByAdmin = exports.getUserByIdForAdmin = exports.makeTrainerStudent = exports.makeStudentTrainer = exports.filterUsers = exports.verify = exports.logout = exports.refresh = exports.loginOthers = exports.loginSuperAdmin = exports.loginAdmin = exports.loginStudent = exports.login = exports.register = void 0;
exports.activateAccount = activateAccount;
exports.addWithdrawNumber = addWithdrawNumber;
const model_1 = require("./model");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const validation_1 = require("./validation");
const model_2 = require("../wallet/model");
const model_3 = require("../settings/model");
const model_4 = require("../transaction/model");
const mongoose_1 = __importDefault(require("mongoose"));
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const generateTokens = (userId) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: "1y" } // short lived
    );
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "10y" } // jwt expiry only
    );
    return { accessToken, refreshToken };
};
const register = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, phone, password, role, referralCode } = validation_1.registerSchema.parse(req.body);
        const existing = yield model_1.User.findOne({ phone });
        if (existing)
            return res.status(400).json({
                message: { en: "Already registered", bn: "ইতিমধ্যে নিবন্ধিত" },
            });
        if (!referralCode)
            return res.status(400).json({
                message: { en: "Referral code is required", bn: "রেফারেল কোড আবশ্যক" },
            });
        const referrer = yield model_1.User.findOne({ userId: referralCode });
        if (!referrer)
            return res.status(400).json({
                message: { en: "Invalid referral code", bn: "অবৈধ রেফারেল কোড" },
            });
        const referrerId = referrer._id;
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield model_1.User.create({
            name,
            phone,
            password: hashedPassword,
            role,
            referrer: referrerId,
        });
        yield model_2.Wallet.create({ userId: user._id });
        // Add 1 taka to referrer's wallet
        if (referrerId) {
            const referrerWallet = yield model_2.Wallet.findOne({ userId: referrerId });
            if (referrerWallet) {
                const prevBalance = referrerWallet.earnedBalance;
                referrerWallet.earnedBalance += 1;
                yield referrerWallet.save();
                yield model_4.Transaction.create({
                    userId: referrerId,
                    previousAmount: prevBalance,
                    recentAmount: 1,
                    currentTotal: referrerWallet.earnedBalance,
                    description: `Registration bonus from ${user.name} (${user.userId})`,
                    type: "credit",
                });
            }
        }
        const { accessToken, refreshToken } = generateTokens(user.userId);
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 1 * 365 * 24 * 60 * 60 * 1000, // 10 years
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
        });
        res.status(201).json({
            message: { en: "Registered successfully", bn: "সফলভাবে নিবন্ধিত" },
            user,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.register = register;
const login = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone, password } = validation_1.loginSchema.parse(req.body);
        const users = yield model_1.User.aggregate([
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
        const isValid = yield bcryptjs_1.default.compare(password, user.password);
        if (!isValid)
            return res.status(401).json({
                message: { en: "Invalid password", bn: "ভুল পাসওয়ার্ড" },
            });
        const { accessToken, refreshToken } = generateTokens(user.userId);
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 1 * 365 * 24 * 60 * 60 * 1000, // 10 years
        });
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
        });
        res.json({
            message: { en: "Login successful", bn: "লগইন সফল" },
            user,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.login = login;
const loginByRole = (req, res, next, allowedRoles) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone, password, role } = req.body;
        validation_1.loginSchema.parse({ phone, password });
        const rawUser = yield model_1.User.findOne({ phone });
        if (!rawUser)
            return res
                .status(404)
                .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
        if (!allowedRoles.includes(rawUser.role))
            return res.status(403).json({
                message: {
                    en: "Access denied for this login portal",
                    bn: "এই লগইন পোর্টালে প্রবেশাধিকার নেই",
                },
            });
        if (role && rawUser.role !== role)
            return res.status(403).json({
                message: {
                    en: "Selected role does not match your account",
                    bn: "নির্বাচিত রোল আপনার অ্যাকাউন্টের সাথে মেলে না",
                },
            });
        const isValid = yield bcryptjs_1.default.compare(password, rawUser.password);
        if (!isValid)
            return res
                .status(401)
                .json({ message: { en: "Invalid password", bn: "ভুল পাসওয়ার্ড" } });
        const users = yield model_1.User.aggregate([
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
        const { accessToken, refreshToken } = generateTokens(user.userId);
        const cookieOpts = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        };
        res.cookie("accessToken", accessToken, cookieOpts);
        res.cookie("refreshToken", refreshToken, cookieOpts);
        res.json({ message: { en: "Login successful", bn: "লগইন সফল" }, user });
    }
    catch (err) {
        next(err);
    }
});
const loginStudent = (req, res, next) => loginByRole(req, res, next, ["student"]);
exports.loginStudent = loginStudent;
const loginAdmin = (req, res, next) => loginByRole(req, res, next, ["admin"]);
exports.loginAdmin = loginAdmin;
const loginSuperAdmin = (req, res, next) => loginByRole(req, res, next, ["super-admin"]);
exports.loginSuperAdmin = loginSuperAdmin;
const loginOthers = (req, res, next) => loginByRole(req, res, next, [
    "trainer",
    "team-leader",
    "senior-team-leader",
    "teacher",
    "auditor",
    "checker",
    "controller",
    "councilor",
]);
exports.loginOthers = loginOthers;
const refresh = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.refreshToken;
        if (!token)
            return res.status(401).json({ message: "No refresh token" });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
        const users = yield model_1.User.aggregate([
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
        if (!user || user.isActive === false)
            return res.status(401).json({ message: "Invalid refresh token" });
        // generate new access token
        const newAccessToken = jsonwebtoken_1.default.sign({ userId: user.userId }, JWT_SECRET, {
            expiresIn: "1y",
        });
        // set cookie
        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        });
        // ✅ return user data directly
        res.json({ success: true, user });
    }
    catch (_a) {
        res.status(401).json({ message: "Refresh failed" });
    }
});
exports.refresh = refresh;
const logout = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        };
        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
        res.json({
            message: { en: "Logged out successfully", bn: "সফলভাবে লগআউট হয়েছে" },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.logout = logout;
const verify = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res.status(401).json({
                message: { en: "No token provided", bn: "টোকেন প্রদান করা হয়নি" },
            });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const users = yield model_1.User.aggregate([
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
    }
    catch (error) {
        res
            .status(401)
            .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
    }
});
exports.verify = verify;
const filterUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;
        const search = (req.query.search || "").trim();
        const status = req.query.status; // true | false | undefined
        const role = req.query.role || "all";
        const teamLeaderId = req.query.teamLeaderId;
        const trainerId = req.query.trainerId;
        const counselorId = req.query.counselorId;
        const seniorTeamLeaderId = req.query.seniorTeamLeaderId;
        const year = req.query.year ? Number(req.query.year) : null;
        const month = req.query.month ? Number(req.query.month) : null;
        const day = req.query.day ? Number(req.query.day) : null;
        // =========================
        // DATE RANGE (UTC SAFE)
        // =========================
        let startDate = null;
        let endDate = null;
        if (year) {
            if (day && month) {
                startDate = new Date(Date.UTC(year, month - 1, day));
                endDate = new Date(Date.UTC(year, month - 1, day + 1));
            }
            else if (month) {
                startDate = new Date(Date.UTC(year, month - 1, 1));
                endDate = new Date(Date.UTC(year, month, 1));
            }
            else {
                startDate = new Date(Date.UTC(year, 0, 1));
                endDate = new Date(Date.UTC(year + 1, 0, 1));
            }
        }
        // =========================
        // BASE MATCH BUILDER
        // =========================
        const match = {};
        // role filter (IMPORTANT FIX)
        if (role && role !== "all") {
            match.role = role;
        }
        if (status === "true")
            match.isActive = true;
        if (status === "false")
            match.isActive = false;
        if (teamLeaderId)
            match.teamLeader = teamLeaderId;
        if (trainerId)
            match.trainer = trainerId;
        if (counselorId)
            match.councilor = counselorId;
        if (seniorTeamLeaderId)
            match.seniorTeamLeader = seniorTeamLeaderId;
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
        const result = yield model_1.User.aggregate([
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
        const users = ((_a = result === null || result === void 0 ? void 0 : result[0]) === null || _a === void 0 ? void 0 : _a.users) || [];
        const meta = ((_c = (_b = result === null || result === void 0 ? void 0 : result[0]) === null || _b === void 0 ? void 0 : _b.meta) === null || _c === void 0 ? void 0 : _c[0]) || {
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
    }
    catch (error) {
        next(error);
    }
});
exports.filterUsers = filterUsers;
const makeStudentTrainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { studentId } = req.body;
        // Verify the student belongs to this TL (via one of TL's trainers)
        const tlTrainerIds = yield model_1.User.find({
            teamLeader: teamLeaderId,
            role: "trainer",
        }).distinct("_id");
        const student = yield model_1.User.findOne({
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
        student.teamLeader = teamLeaderId;
        yield student.save();
        res.json({
            message: {
                en: "Student promoted to trainer successfully",
                bn: "স্টুডেন্টকে সফলভাবে ট্রেইনার করা হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.makeStudentTrainer = makeStudentTrainer;
const makeTrainerStudent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { trainerId } = req.body;
        const trainer = yield model_1.User.findOne({
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
        yield trainer.save();
        res.json({
            message: {
                en: "Trainer demoted to student successfully",
                bn: "ট্রেইনারকে সফলভাবে স্টুডেন্ট করা হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.makeTrainerStudent = makeTrainerStudent;
const getUserByIdForAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield model_1.User.findById(id)
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
    }
    catch (error) {
        next(error);
    }
});
exports.getUserByIdForAdmin = getUserByIdForAdmin;
/* =========================
   OBJECTID SAFE NORMALIZER
========================= */
const toObjectIdOrNull = (v) => {
    if (v === undefined)
        return undefined; // not sent → ignore update
    if (v === "" || v === null)
        return null; // empty → remove relation
    if (mongoose_1.default.isValidObjectId(v))
        return v; // valid → keep
    return null; // invalid garbage → null
};
/* =========================
   UPDATE USER (ADMIN)
========================= */
const updateUserByIdByAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { userId, name, phone, email, whatsapp, country, language, role, isActive, image, coverImage, trainer, teamLeader, seniorTeamLeader, councilor, monthlySalary, withdrawNumber, } = req.body;
        const updateData = {};
        /* =========================
           BASIC FIELDS
        ========================= */
        if (userId !== undefined)
            updateData.userId = userId;
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        if (email !== undefined)
            updateData.email = email;
        if (whatsapp !== undefined)
            updateData.whatsapp = whatsapp;
        if (country !== undefined)
            updateData.country = country;
        if (language !== undefined)
            updateData.language = language;
        if (role !== undefined)
            updateData.role = role;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (image !== undefined)
            updateData.image = image;
        if (coverImage !== undefined)
            updateData.coverImage = coverImage;
        /* =========================
           RELATION FIELDS (MAIN FIX)
        ========================= */
        const t = toObjectIdOrNull(trainer);
        const tl = toObjectIdOrNull(teamLeader);
        const stl = toObjectIdOrNull(seniorTeamLeader);
        const c = toObjectIdOrNull(councilor);
        if (t !== undefined)
            updateData.trainer = t;
        if (tl !== undefined)
            updateData.teamLeader = tl;
        if (stl !== undefined)
            updateData.seniorTeamLeader = stl;
        if (c !== undefined)
            updateData.councilor = c;
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
            const existing = yield model_1.User.findById(id).select("activationDate");
            if (existing && !existing.activationDate) {
                updateData.activationDate = new Date();
            }
        }
        /* =========================
           DB UPDATE
        ========================= */
        const user = yield model_1.User.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true }).select("-password");
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
    }
    catch (error) {
        console.error("UPDATE USER ERROR:", error);
        next(error);
    }
});
exports.updateUserByIdByAdmin = updateUserByIdByAdmin;
const updatePasswordByAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { password } = req.body;
        const requester = req.user;
        if (!password) {
            return res.status(400).json({
                message: { en: "Password is required", bn: "পাসওয়ার্ড প্রয়োজন" },
            });
        }
        if (requester.role === "admin") {
            if (requester._id.toString() === id) {
                return res.status(403).json({
                    message: {
                        en: "Admin cannot change their own password",
                        bn: "অ্যাডমিন নিজের পাসওয়ার্ড পরিবর্তন করতে পারবেন না",
                    },
                });
            }
            const target = yield model_1.User.findById(id).select("role");
            if ((target === null || target === void 0 ? void 0 : target.role) === "super-admin" || (target === null || target === void 0 ? void 0 : target.role) === "admin") {
                return res.status(403).json({
                    message: {
                        en: "Admin cannot change Super Admin's and his own password",
                        bn: "অ্যাডমিন সুপার অ্যাডমিনের পাসওয়ার্ড পরিবর্তন করতে পারবেন না",
                    },
                });
            }
        }
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const user = yield model_1.User.findByIdAndUpdate(id, { $set: { password: hashedPassword } }, { new: true }).select("-password");
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
    }
    catch (error) {
        next(error);
    }
});
exports.updatePasswordByAdmin = updatePasswordByAdmin;
const deleteUserByIdByAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield model_1.User.findById(id).select("role");
        if (!user)
            return res.status(404).json({
                message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
            });
        if (user.role === "trainer") {
            yield model_1.User.updateMany({ trainer: user._id }, { $set: { trainer: null } });
        }
        yield user.deleteOne();
        res.json({
            message: {
                en: "User deleted successfully",
                bn: "ইউজার সফলভাবে মুছে ফেলা হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteUserByIdByAdmin = deleteUserByIdByAdmin;
const updateProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, image } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({
                message: { en: "Unauthorized", bn: "অননুমোদিত" },
            });
        const user = yield model_1.User.findOneAndUpdate({ userId }, { $set: { name, image } }, { new: true, runValidators: true }).select("-password");
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
    }
    catch (error) {
        next(error);
    }
});
exports.updateProfile = updateProfile;
const updateUserRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        const user = yield model_1.User.findByIdAndUpdate(userId, { $set: { role } }, { new: true, runValidators: true }).select("-password");
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
    }
    catch (error) {
        next(error);
    }
});
exports.updateUserRole = updateUserRole;
const changePassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({
                message: { en: "Unauthorized", bn: "অননুমোদিত" },
            });
        const user = yield model_1.User.findOne({ userId });
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
        const isValid = yield bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValid)
            return res.status(401).json({
                message: {
                    en: "Current password is incorrect",
                    bn: "বর্তমান পাসওয়ার্ড ভুল",
                },
            });
        const hashedPassword = yield bcryptjs_1.default.hash(newPassword, 10);
        user.password = hashedPassword;
        yield user.save();
        res.json({
            message: {
                en: "Password changed successfully",
                bn: "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.changePassword = changePassword;
const updateSettings = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { name, email, country, language, image, coverImage } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId)
            return res.status(401).json({
                message: { en: "Unauthorized", bn: "অননুমোদিত" },
            });
        const user = yield model_1.User.findOneAndUpdate({ userId }, { $set: { name, email, country, language, image, coverImage } }, { new: true, runValidators: true })
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
    }
    catch (error) {
        next(error);
    }
});
exports.updateSettings = updateSettings;
function activateAccount(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            const user = yield model_1.User.findById(userId).populate([
                { path: "referrer", select: "_id name userId" },
            ]);
            if (!user)
                return res
                    .status(404)
                    .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
            if (user.isActive)
                return res.status(400).json({
                    message: {
                        en: "Account already active",
                        bn: "অ্যাকাউন্ট ইতিমধ্যে সক্রিয়",
                    },
                });
            const settings = yield model_3.Settings.findOne();
            const admissionFee = (settings === null || settings === void 0 ? void 0 : settings.admissionFee) || 0;
            const commission = (settings === null || settings === void 0 ? void 0 : settings.activationCommission) || {
                referrer: 0,
                trainer: 0,
                teamLeader: 0,
                seniorTeamLeader: 0,
                councilor: 0,
            };
            // Assign default team leader if user has none
            if (!user.teamLeader && (settings === null || settings === void 0 ? void 0 : settings.defaultTeamLeaderId)) {
                const defaultTL = yield model_1.User.findOne({
                    userId: settings.defaultTeamLeaderId,
                });
                if (defaultTL) {
                    user.teamLeader = defaultTL._id;
                }
            }
            let wallet = yield model_2.Wallet.findOne({ userId });
            if (!wallet)
                return res.status(400).json({
                    message: { en: "Insufficient balance", bn: "অপর্যাপ্ত ব্যালেন্স" },
                });
            if (wallet.earnedBalance < admissionFee)
                return res.status(400).json({
                    message: { en: "Insufficient balance", bn: "অপর্যাপ্ত ব্যালেন্স" },
                });
            const previousBalance = wallet.earnedBalance;
            wallet.earnedBalance -= admissionFee;
            yield wallet.save();
            yield model_4.Transaction.create({
                userId,
                previousAmount: previousBalance,
                recentAmount: -admissionFee,
                currentTotal: wallet.earnedBalance,
                description: `Account Activation Fee Deducted`,
                type: "debit",
            });
            // Distribute commissions up the chain: referrer → referrer's trainer → trainer's teamLeader → teamLeader's seniorTeamLeader
            const referrer = user.referrer;
            if (referrer === null || referrer === void 0 ? void 0 : referrer._id) {
                const referrerDoc = yield model_1.User.findById(referrer._id).populate([
                    { path: "trainer", select: "_id name userId" },
                    { path: "teamLeader", select: "_id name userId" },
                    { path: "seniorTeamLeader", select: "_id name userId" },
                ]);
                // 1. Referrer commission
                if (commission.referrer > 0) {
                    const refWallet = yield model_2.Wallet.findOne({ userId: referrer._id });
                    if (refWallet) {
                        const prevBal = refWallet.earnedBalance;
                        refWallet.earnedBalance += commission.referrer;
                        yield refWallet.save();
                        yield model_4.Transaction.create({
                            userId: referrer._id,
                            previousAmount: prevBal,
                            recentAmount: commission.referrer,
                            currentTotal: refWallet.earnedBalance,
                            description: `You got ${commission.referrer} Tk as Referral Commission from ${user.name} (${user.userId}) Activation`,
                            type: "credit",
                        });
                    }
                }
                // 2. Referrer's trainer commission
                const trainerDoc = referrerDoc === null || referrerDoc === void 0 ? void 0 : referrerDoc.trainer;
                if ((trainerDoc === null || trainerDoc === void 0 ? void 0 : trainerDoc._id) && commission.trainer > 0) {
                    const trainerWallet = yield model_2.Wallet.findOne({ userId: trainerDoc._id });
                    if (trainerWallet) {
                        const prevBal = trainerWallet.earnedBalance;
                        trainerWallet.earnedBalance += commission.trainer;
                        yield trainerWallet.save();
                        yield model_4.Transaction.create({
                            userId: trainerDoc._id,
                            previousAmount: prevBal,
                            recentAmount: commission.trainer,
                            currentTotal: trainerWallet.earnedBalance,
                            description: `Trainer Commission from ${user.name} (${user.userId}) Activation`,
                            type: "credit",
                        });
                    }
                }
                // 3. Referrer's team leader commission
                const teamLeaderDoc = referrerDoc === null || referrerDoc === void 0 ? void 0 : referrerDoc.teamLeader;
                if ((teamLeaderDoc === null || teamLeaderDoc === void 0 ? void 0 : teamLeaderDoc._id) && commission.teamLeader > 0) {
                    const tlWallet = yield model_2.Wallet.findOne({ userId: teamLeaderDoc._id });
                    if (tlWallet) {
                        const prevBal = tlWallet.earnedBalance;
                        tlWallet.earnedBalance += commission.teamLeader;
                        yield tlWallet.save();
                        yield model_4.Transaction.create({
                            userId: teamLeaderDoc._id,
                            previousAmount: prevBal,
                            recentAmount: commission.teamLeader,
                            currentTotal: tlWallet.earnedBalance,
                            description: `Team Leader Commission from ${user.name} (${user.userId}) Activation - Student referred by ${referrer.userId}`,
                            type: "credit",
                        });
                    }
                }
            }
            // 5. Councilor commission
            const councilor = user.councilor;
            if (councilor && commission.councilor > 0) {
                const cWallet = yield model_2.Wallet.findOne({ userId: councilor });
                if (cWallet) {
                    const prevBal = cWallet.earnedBalance;
                    cWallet.earnedBalance += commission.councilor;
                    yield cWallet.save();
                    yield model_4.Transaction.create({
                        userId: councilor,
                        previousAmount: prevBal,
                        recentAmount: commission.councilor,
                        currentTotal: cWallet.earnedBalance,
                        description: `Councilor Commission from ${user.name} (${user.userId}) Activation`,
                        type: "credit",
                    });
                }
            }
            user.isActive = true;
            user.activationDate = new Date();
            yield user.save();
            res.json({
                message: {
                    en: "Account activated successfully",
                    bn: "অ্যাকাউন্ট সফলভাবে সক্রিয় হয়েছে",
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
function addWithdrawNumber(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
            const { number, method } = req.body;
            if (!userId)
                return res.status(401).json({
                    message: { en: "Unauthorized", bn: "অননুমোদিত" },
                });
            const user = yield model_1.User.findById(userId);
            if (!user)
                return res.status(404).json({
                    message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
                });
            if ((_b = user.withdrawNumber) === null || _b === void 0 ? void 0 : _b.number)
                return res.status(400).json({
                    message: {
                        en: "Withdrawal number already added. Contact admin to update.",
                        bn: "উত্তোলন নম্বর ইতিমধ্যে যোগ করা হয়েছে। আপডেট করতে অ্যাডমিনের সাথে যোগাযোগ করুন।",
                    },
                });
            user.withdrawNumber = { number, method };
            yield user.save();
            res.json({
                message: {
                    en: "Withdrawal number added successfully",
                    bn: "উত্তোলন নম্বর সফলভাবে যোগ করা হয়েছে",
                },
            });
        }
        catch (error) {
            next(error);
        }
    });
}
const getTeachers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teachers = yield model_1.User.find({
            role: {
                $in: ["teacher"],
            },
        })
            .select("_id name userId role")
            .sort({ name: 1 });
        res.status(200).json(teachers);
    }
    catch (error) {
        next(error);
    }
});
exports.getTeachers = getTeachers;
const getUsersByRole = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const role = req.query.role;
        if (!role)
            return res.status(400).json({ message: { en: "Role is required" } });
        const users = yield model_1.User.find({ role })
            .select("_id name userId phone")
            .sort({ name: 1 })
            .lean();
        res.json(users);
    }
    catch (error) {
        next(error);
    }
});
exports.getUsersByRole = getUsersByRole;
function buildDateRange(year, month, day) {
    if (!year)
        return null;
    const BDT_OFFSET = 6 * 60 * 60 * 1000;
    const y = parseInt(year);
    const m = month ? parseInt(month) : null;
    const d = day ? parseInt(day) : null;
    let startDate;
    let endDate;
    if (d && m) {
        startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - BDT_OFFSET);
        endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - BDT_OFFSET);
    }
    else if (m) {
        startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - BDT_OFFSET);
        endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - BDT_OFFSET);
    }
    else {
        startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0) - BDT_OFFSET);
        endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999) - BDT_OFFSET);
    }
    return { startDate, endDate };
}
function buildDateQuery(status, year, month, day) {
    const range = buildDateRange(year, month, day);
    if (!range)
        return {};
    const { startDate, endDate } = range;
    return status === "true"
        ? { activationDate: { $gte: startDate, $lte: endDate } }
        : { createdAt: { $gte: startDate, $lte: endDate } };
}
const listForTrainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const trainerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const exactUserId = req.query.exactUserId || "";
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const query = { trainer: trainerId, role: "student" };
        if (exactUserId) {
            query.userId = exactUserId;
        }
        else if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { userId: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }
        if (status !== "all")
            query.isActive = status === "true";
        Object.assign(query, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(query)
                .select("userId name role phone image isActive activationDate referrer")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(query),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.listForTrainer = listForTrainer;
const teamLeadersForSTL = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const stlId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const baseQuery = { seniorTeamLeader: stlId, role: "team-leader" };
        if (search) {
            baseQuery.$or = [
                { name: { $regex: search, $options: "i" } },
                { userId: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }
        if (status !== "all")
            baseQuery.isActive = status === "true";
        Object.assign(baseQuery, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name role phone image isActive activationDate referrer")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.teamLeadersForSTL = teamLeadersForSTL;
const trainersForSTL = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const stlId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const teamLeaderIds = yield model_1.User.distinct("_id", {
            seniorTeamLeader: stlId,
            role: "team-leader",
        });
        const baseQuery = {
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
        if (status !== "all")
            baseQuery.isActive = status === "true";
        Object.assign(baseQuery, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name role phone image isActive activationDate teamLeader referrer")
                .populate("teamLeader", "userId name")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.trainersForSTL = trainersForSTL;
const trainersForTL = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const baseQuery = { teamLeader: teamLeaderId, role: "trainer" };
        if (search) {
            baseQuery.$or = [
                { name: { $regex: search, $options: "i" } },
                { userId: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }
        if (status !== "all")
            baseQuery.isActive = status === "true";
        Object.assign(baseQuery, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name role phone image isActive activationDate referrer")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.trainersForTL = trainersForTL;
const listForSeniorTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const stlId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const exactUserId = req.query.exactUserId || "";
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        // Resolve hierarchy: STL → team leaders → trainers → students
        const teamLeaderIds = yield model_1.User.distinct("_id", {
            seniorTeamLeader: stlId,
            role: "team-leader",
        });
        const trainerIds = yield model_1.User.distinct("_id", {
            teamLeader: { $in: teamLeaderIds },
            role: "trainer",
        });
        const baseQuery = { trainer: { $in: trainerIds }, role: "student" };
        if (exactUserId) {
            baseQuery.userId = exactUserId;
        }
        else if (search) {
            baseQuery.$or = [
                { name: { $regex: search, $options: "i" } },
                { userId: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }
        if (status !== "all")
            baseQuery.isActive = status === "true";
        Object.assign(baseQuery, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name role phone image isActive activationDate trainer teamLeader referrer")
                .populate("trainer", "userId name")
                .populate("teamLeader", "userId name")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
        ]);
        // Hierarchy: team leaders → trainers (with student counts)
        const teamLeaders = yield model_1.User.find({
            seniorTeamLeader: stlId,
            role: "team-leader",
        })
            .select("_id userId name phone image isActive")
            .lean();
        const tlIds = teamLeaders.map((tl) => tl._id);
        const trainersForHierarchy = yield model_1.User.find({
            teamLeader: { $in: tlIds },
            role: "trainer",
        })
            .select("_id userId name phone image isActive teamLeader")
            .lean();
        const trainerIdsForCount = trainersForHierarchy.map((t) => t._id);
        const studentCounts = yield model_1.User.aggregate([
            { $match: { trainer: { $in: trainerIdsForCount }, role: "student" } },
            { $group: { _id: "$trainer", count: { $sum: 1 } } },
        ]);
        const countMap = {};
        studentCounts.forEach((s) => {
            countMap[s._id.toString()] = s.count;
        });
        const tlMap = {};
        teamLeaders.forEach((tl) => {
            tlMap[tl._id.toString()] = Object.assign(Object.assign({}, tl), { trainers: [] });
        });
        trainersForHierarchy.forEach((t) => {
            var _a;
            const tlId = (_a = t.teamLeader) === null || _a === void 0 ? void 0 : _a.toString();
            if (tlId && tlMap[tlId]) {
                tlMap[tlId].trainers.push(Object.assign(Object.assign({}, t), { studentCount: countMap[t._id.toString()] || 0 }));
            }
        });
        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit),
            hierarchy: Object.values(tlMap),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.listForSeniorTeamLeader = listForSeniorTeamLeader;
const myTeamForTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const trainers = yield model_1.User.find({
            teamLeader: teamLeaderId,
            role: "trainer",
        })
            .select("_id userId name phone image isActive")
            .lean();
        const trainerIds = trainers.map((t) => t._id);
        const studentQuery = { trainer: { $in: trainerIds }, role: "student" };
        if (status !== "all")
            studentQuery.isActive = status === "true";
        Object.assign(studentQuery, buildDateQuery(status, year, month, day));
        const studentCounts = yield model_1.User.aggregate([
            { $match: studentQuery },
            { $group: { _id: "$trainer", count: { $sum: 1 } } },
        ]);
        const countMap = {};
        studentCounts.forEach((s) => {
            countMap[s._id.toString()] = s.count;
        });
        const trainersWithCount = trainers.map((t) => (Object.assign(Object.assign({}, t), { studentCount: countMap[t._id.toString()] || 0 })));
        res.json({ trainers: trainersWithCount });
    }
    catch (error) {
        next(error);
    }
});
exports.myTeamForTeamLeader = myTeamForTeamLeader;
const myTeamForSeniorTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const stlId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const statusQuery = status !== "all" ? { isActive: status === "true" } : {};
        const dateQuery = buildDateQuery(status, year, month, day);
        const teamLeaders = yield model_1.User.find({
            seniorTeamLeader: stlId,
            role: "team-leader",
        })
            .select("_id userId name phone image isActive")
            .lean();
        const tlIds = teamLeaders.map((tl) => tl._id);
        const trainers = yield model_1.User.find({
            teamLeader: { $in: tlIds },
            role: "trainer",
        })
            .select("_id userId name phone image isActive teamLeader")
            .lean();
        const trainerIds = trainers.map((t) => t._id);
        const studentQuery = Object.assign(Object.assign({ trainer: { $in: trainerIds }, role: "student" }, statusQuery), dateQuery);
        const studentCounts = yield model_1.User.aggregate([
            { $match: studentQuery },
            { $group: { _id: "$trainer", count: { $sum: 1 } } },
        ]);
        const countMap = {};
        studentCounts.forEach((s) => {
            countMap[s._id.toString()] = s.count;
        });
        const tlMap = {};
        teamLeaders.forEach((tl) => {
            tlMap[tl._id.toString()] = Object.assign(Object.assign({}, tl), { trainers: [] });
        });
        trainers.forEach((t) => {
            var _a;
            const tlId = (_a = t.teamLeader) === null || _a === void 0 ? void 0 : _a.toString();
            if (tlId && tlMap[tlId]) {
                tlMap[tlId].trainers.push(Object.assign(Object.assign({}, t), { studentCount: countMap[t._id.toString()] || 0 }));
            }
        });
        res.json({ hierarchy: Object.values(tlMap) });
    }
    catch (error) {
        next(error);
    }
});
exports.myTeamForSeniorTeamLeader = myTeamForSeniorTeamLeader;
const studentsOfTrainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { trainerId } = req.params;
        const requesterId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const trainer = (yield model_1.User.findById(trainerId).lean());
        if (!trainer) {
            return res
                .status(403)
                .json({ message: { en: "Forbidden", bn: "অননুমোদিত" } });
        }
        const students = yield model_1.User.find({ trainer: trainerId, role: "student" })
            .select("userId name role phone image isActive activationDate")
            .sort({ createdAt: -1 })
            .lean();
        res.json({ users: students });
    }
    catch (error) {
        next(error);
    }
});
exports.studentsOfTrainer = studentsOfTrainer;
const unassignedStudentsForTL = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const status = req.query.status || "all";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const baseQuery = {
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
        if (status !== "all")
            baseQuery.isActive = status === "true";
        Object.assign(baseQuery, buildDateQuery(status, year, month, day));
        const [users, total] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name phone image isActive activationDate createdAt role")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.unassignedStudentsForTL = unassignedStudentsForTL;
const getInactiveStudentsForController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const exactUserId = req.query.exactUserId || "";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const matchStage = { role: "student", isActive: false };
        if (exactUserId) {
            matchStage.userId = exactUserId;
        }
        else if (search) {
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
            }
            else if (m) {
                matchStage.createdAt = {
                    $gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
                    $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
                };
            }
            else {
                matchStage.createdAt = {
                    $gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
                    $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
                };
            }
        }
        const pipeline = [
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
        const [users, total] = yield Promise.all([
            model_1.User.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
            model_1.User.aggregate([...pipeline, { $count: "total" }]).then((r) => { var _a, _b; return (_b = (_a = r[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0; }),
        ]);
        res.json({ users, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        next(error);
    }
});
exports.getInactiveStudentsForController = getInactiveStudentsForController;
const getCounselors = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const counselors = yield model_1.User.find({ role: "councilor" })
            .select("_id userId name image")
            .lean();
        res.json({ counselors });
    }
    catch (error) {
        next(error);
    }
});
exports.getCounselors = getCounselors;
const assignCounselor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { studentId, counselorId } = req.body;
        const student = yield model_1.User.findByIdAndUpdate(studentId, { councilor: counselorId }, { new: true }).select("userId name councilor");
        if (!student)
            return res.status(404).json({
                message: { en: "Student not found", bn: "স্টুডেন্ট পাওয়া যায়নি" },
            });
        res.json({
            message: { en: "Counselor assigned", bn: "কাউন্সেলর অ্যাসাইন হয়েছে" },
            student,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.assignCounselor = assignCounselor;
const removeCounselor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { studentId } = req.params;
        const student = yield model_1.User.findByIdAndUpdate(studentId, { $unset: { councilor: "" } }, { new: true }).select("userId name councilor");
        if (!student)
            return res.status(404).json({
                message: { en: "Student not found", bn: "স্টুডেন্ট পাওয়া যায়নি" },
            });
        res.json({
            message: { en: "Counselor removed", bn: "কাউন্সেলর সরানো হয়েছে" },
            student,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.removeCounselor = removeCounselor;
const removeTrainerFromStudent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { studentId } = req.params;
        yield model_1.User.findByIdAndUpdate(studentId, { trainer: null });
        res.json({
            message: {
                en: "Trainer removed successfully",
                bn: "ট্রেইনার সফলভাবে সরানো হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.removeTrainerFromStudent = removeTrainerFromStudent;
const assignTrainerToStudent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { studentId, trainerId } = req.body;
        // Verify trainer belongs to this TL
        const trainer = yield model_1.User.findOne({
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
        const student = yield model_1.User.findOneAndUpdate({
            _id: studentId,
            teamLeader: teamLeaderId,
            role: "student",
            trainer: null,
        }, { trainer: trainerId }, { new: true });
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
    }
    catch (error) {
        next(error);
    }
});
exports.assignTrainerToStudent = assignTrainerToStudent;
const changeStudentTrainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const { studentId, trainerId } = req.body;
        // Verify trainer belongs to this TL
        const trainer = yield model_1.User.findOne({
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
        const tlTrainerIds = yield model_1.User.find({
            teamLeader: teamLeaderId,
            role: "trainer",
        }).distinct("_id");
        const student = yield model_1.User.findOneAndUpdate({ _id: studentId, teamLeader: teamLeaderId, role: "student" }, { trainer: trainerId }, { new: true }).select("name userId trainer");
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
    }
    catch (error) {
        next(error);
    }
});
exports.changeStudentTrainer = changeStudentTrainer;
const myReferralsForTrainer = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const trainerId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = (req.query.search || "").replace(/^\+/, "");
        const exactUserId = req.query.exactUserId || "";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const directStudentIds = yield model_1.User.distinct("_id", {
            trainer: trainerId,
            role: "student",
        });
        const baseQuery = {
            role: "student",
            referrer: { $in: directStudentIds },
        };
        if (exactUserId) {
            baseQuery.userId = exactUserId;
        }
        else if (search) {
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
            let startDate;
            let endDate;
            if (d && m) {
                startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            }
            else if (m) {
                startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            }
            else {
                startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            }
            baseQuery.$or = [
                { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
                { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
            ];
        }
        const countQuery = Object.assign({}, baseQuery);
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name phone image isActive createdAt referrer role messagedBy")
                .populate("referrer", "userId name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: true })),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: false })),
        ]);
        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit),
            activeCount,
            inactiveCount,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.myReferralsForTrainer = myReferralsForTrainer;
const myReferralsForSTL = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const stlId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const tlIds = yield model_1.User.distinct("_id", {
            seniorTeamLeader: stlId,
            role: "team-leader",
        });
        const trainerIds = yield model_1.User.distinct("_id", {
            teamLeader: { $in: tlIds },
            role: "trainer",
        });
        const directStudentIds = yield model_1.User.distinct("_id", {
            trainer: { $in: trainerIds },
            role: "student",
        });
        const baseQuery = {
            role: "student",
            referrer: { $in: directStudentIds },
        };
        if (year) {
            const y = parseInt(year);
            const m = month ? parseInt(month) : null;
            const d = day ? parseInt(day) : null;
            let startDate;
            let endDate;
            if (d && m) {
                startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            }
            else if (m) {
                startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            }
            else {
                startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            }
            baseQuery.$or = [
                { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
                { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
            ];
        }
        const countQuery = Object.assign({}, baseQuery);
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name phone image isActive createdAt referrer role")
                .populate("referrer", "userId name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: true })),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: false })),
        ]);
        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit),
            activeCount,
            inactiveCount,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.myReferralsForSTL = myReferralsForSTL;
const getTrainersAndTeamLeaders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [trainers, teamLeaders] = yield Promise.all([
            model_1.User.find({ role: "trainer" })
                .select("_id userId name image teamLeader")
                .sort({ name: 1 })
                .lean(),
            model_1.User.find({ role: "team-leader" })
                .select("_id userId name image")
                .sort({ name: 1 })
                .lean(),
        ]);
        res.json({ trainers, teamLeaders });
    }
    catch (error) {
        next(error);
    }
});
exports.getTrainersAndTeamLeaders = getTrainersAndTeamLeaders;
const getMyStudentsForCounselor = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const counselorId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const exactUserId = req.query.exactUserId || "";
        const year = req.query.year;
        const month = req.query.month;
        const day = req.query.day;
        const skip = (page - 1) * limit;
        const baseQuery = { councilor: counselorId, role: "student" };
        if (exactUserId) {
            baseQuery.userId = exactUserId;
        }
        else if (year) {
            const y = parseInt(year);
            const m = month ? parseInt(month) : null;
            const d = day ? parseInt(day) : null;
            let startDate;
            let endDate;
            if (d && m) {
                startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            }
            else if (m) {
                startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            }
            else {
                startDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
                endDate = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
            }
            baseQuery.$or = [
                { isActive: true, activationDate: { $gte: startDate, $lte: endDate } },
                { isActive: false, createdAt: { $gte: startDate, $lte: endDate } },
            ];
        }
        const countQuery = Object.assign({}, baseQuery);
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(baseQuery)
                .select("userId name phone image isActive role createdAt referrer")
                .populate("referrer", "userId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(baseQuery),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: true })),
            model_1.User.countDocuments(Object.assign(Object.assign({}, countQuery), { isActive: false })),
        ]);
        res.json({
            users,
            total,
            page,
            pages: Math.ceil(total / limit),
            activeCount,
            inactiveCount,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyStudentsForCounselor = getMyStudentsForCounselor;
const toggleUserStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const user = yield model_1.User.findById(id).select("isActive role");
        if (!user)
            return res.status(404).json({
                message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" },
            });
        user.isActive = !user.isActive;
        yield user.save();
        if (!user.isActive && user.role === "trainer") {
            yield model_1.User.updateMany({ trainer: user._id }, { $set: { trainer: null } });
        }
        res.json({
            message: {
                en: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
                bn: `ইউজার সফলভাবে ${user.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"} করা হয়েছে`,
            },
            isActive: user.isActive,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.toggleUserStatus = toggleUserStatus;
const specialUsers = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { role, teamLeaderId, limit = "1000" } = req.query;
        const query = { isActive: true };
        if (role)
            query.role = role;
        if (teamLeaderId)
            query.teamLeader = teamLeaderId;
        const users = yield model_1.User.find(query)
            .select("_id userId name role phone")
            .limit(Number(limit));
        res.json({ users });
    }
    catch (error) {
        next(error);
    }
});
exports.specialUsers = specialUsers;
const getAllTeamLeaders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const teamLeaders = yield model_1.User.find({ role: "team-leader" }, { name: 1, userId: 1, _id: 0 }).sort({ name: 1 });
        res.status(200).json({
            success: true,
            count: teamLeaders.length,
            data: teamLeaders,
        });
    }
    catch (error) {
        console.error("Error fetching team leaders:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch team leaders",
        });
    }
});
exports.getAllTeamLeaders = getAllTeamLeaders;
// Get users grouped by their deactivated/deleted team leaders
const getOrphanedUsersByTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        // Users whose teamLeader is set but that TL is either deactivated or deleted
        const orphanedUsers = yield model_1.User.aggregate([
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
        const groupedMap = {};
        for (const user of orphanedUsers) {
            const tlId = ((_a = user.teamLeader) === null || _a === void 0 ? void 0 : _a.toString()) || "deleted";
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
    }
    catch (error) {
        next(error);
    }
});
exports.getOrphanedUsersByTeamLeader = getOrphanedUsersByTeamLeader;
// Bulk reassign team leader for a list of users
const bulkReassignTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userIds, newTeamLeaderId } = req.body;
        if (!Array.isArray(userIds) || !userIds.length || !newTeamLeaderId) {
            return res.status(400).json({
                message: { en: "userIds and newTeamLeaderId are required", bn: "userIds এবং newTeamLeaderId আবশ্যক" },
            });
        }
        const newTL = yield model_1.User.findById(newTeamLeaderId).select("role");
        if (!newTL || newTL.role !== "team-leader") {
            return res.status(400).json({
                message: { en: "Invalid team leader", bn: "অবৈধ টিম লিডার" },
            });
        }
        yield model_1.User.updateMany({ _id: { $in: userIds } }, { $set: { teamLeader: newTeamLeaderId } });
        res.json({
            message: {
                en: "Team leader reassigned successfully",
                bn: "টিম লিডার সফলভাবে পুনরায় নির্ধারণ করা হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.bulkReassignTeamLeader = bulkReassignTeamLeader;
const toggleMessaged = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const sender = req.user;
        const senderId = sender === null || sender === void 0 ? void 0 : sender._id;
        const { userId } = req.params;
        const target = yield model_1.User.findOne({ userId });
        if (!target)
            return res.status(404).json({ message: "User not found" });
        const alreadyMessaged = (_a = target.messagedBy) === null || _a === void 0 ? void 0 : _a.some((entry) => { var _a; return ((_a = entry.by) === null || _a === void 0 ? void 0 : _a.toString()) === (senderId === null || senderId === void 0 ? void 0 : senderId.toString()); });
        if (alreadyMessaged) {
            yield model_1.User.updateOne({ userId }, { $pull: { messagedBy: { by: senderId } } });
            return res.json({ messaged: false });
        }
        else {
            yield model_1.User.updateOne({ userId }, {
                $push: {
                    messagedBy: {
                        by: senderId,
                        byName: (sender === null || sender === void 0 ? void 0 : sender.name) || "",
                        byRole: (sender === null || sender === void 0 ? void 0 : sender.role) || "",
                        at: new Date(),
                    },
                },
            });
            return res.json({ messaged: true });
        }
    }
    catch (error) {
        next(error);
    }
});
exports.toggleMessaged = toggleMessaged;
