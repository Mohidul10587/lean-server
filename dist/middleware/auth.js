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
exports.verifyAdminOrSuperAdmin = exports.verifySuperAdmin = exports.verifyAdmin = exports.verifyUserInactive = exports.verifyUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const model_1 = require("../app/user/model");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const verifyUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res.status(401).json({ message: "Unauthorized accessToken" });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield model_1.User.findOne({ userId: decoded.userId });
        if (!user || user.isActive == false)
            return res.status(401).json({ message: "Unauthorized isActive" });
        req.user = user;
        next();
    }
    catch (_a) {
        res.status(401).json({ message: "Token expired" });
    }
});
exports.verifyUser = verifyUser;
const verifyUserInactive = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res.status(401).json({ message: "Unauthorized" });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield model_1.User.findOne({ userId: decoded.userId });
        if (!user)
            return res.status(401).json({ message: "Unauthorized" });
        req.user = user;
        next();
    }
    catch (_a) {
        res.status(401).json({ message: "Token expired" });
    }
});
exports.verifyUserInactive = verifyUserInactive;
const verifyAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res
                .status(401)
                .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield model_1.User.findOne({ userId: decoded.userId });
        if (!user)
            return res
                .status(404)
                .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
        if (user.role !== "admin")
            return res.status(403).json({
                message: {
                    en: "Admin access required",
                    bn: "অ্যাডমিন অ্যাক্সেস প্রয়োজন",
                },
            });
        req.user = user;
        next();
    }
    catch (error) {
        res
            .status(401)
            .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
    }
});
exports.verifyAdmin = verifyAdmin;
const verifySuperAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res
                .status(401)
                .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield model_1.User.findOne({ userId: decoded.userId });
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
    }
    catch (error) {
        res
            .status(401)
            .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
    }
});
exports.verifySuperAdmin = verifySuperAdmin;
const verifyAdminOrSuperAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const token = req.cookies.accessToken;
        if (!token)
            return res
                .status(401)
                .json({ message: { en: "Unauthorized", bn: "অননুমোদিত" } });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = yield model_1.User.findOne({ userId: decoded.userId });
        if (!user)
            return res
                .status(404)
                .json({ message: { en: "User not found", bn: "ইউজার পাওয়া যায়নি" } });
        if (user.role !== "admin" && user.role !== "super-admin")
            return res
                .status(403)
                .json({
                message: {
                    en: "Admin access required",
                    bn: "অ্যাডমিন অ্যাক্সেস প্রয়োজন",
                },
            });
        req.user = user;
        next();
    }
    catch (_a) {
        res
            .status(401)
            .json({ message: { en: "Invalid token", bn: "অবৈধ টোকেন" } });
    }
});
exports.verifyAdminOrSuperAdmin = verifyAdminOrSuperAdmin;
