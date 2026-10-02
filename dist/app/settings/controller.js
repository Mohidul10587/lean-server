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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCourseLink = exports.updateSettings = exports.getSettings = void 0;
const model_1 = require("./model");
const getSettings = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let settings = yield model_1.Settings.findOne();
        if (!settings) {
            settings = yield model_1.Settings.create({});
        }
        res.json(settings.toObject());
    }
    catch (error) {
        next(error);
    }
});
exports.getSettings = getSettings;
const updateSettings = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { siteName, logo, metaTitle, metaDescription, metaKeywords, paymentMethods, depositRules, withdrawRules, admissionFee, withdrawalFee, activationCommission, supportMeetingLink, supportWhatsAppLink, helpLink, courses, } = req.body;
        let settings = yield model_1.Settings.findOne();
        if (!settings) {
            settings = yield model_1.Settings.create(req.body);
        }
        else {
            settings.courses = courses || settings.courses;
            settings.siteName = siteName || settings.siteName;
            settings.logo = logo || settings.logo;
            settings.metaTitle = metaTitle || settings.metaTitle;
            settings.metaDescription = metaDescription || settings.metaDescription;
            settings.metaKeywords = metaKeywords || settings.metaKeywords;
            if (paymentMethods !== undefined) {
                settings.paymentMethods = paymentMethods;
            }
            if (depositRules) {
                settings.depositRules = depositRules;
            }
            if (withdrawRules) {
                settings.withdrawRules = withdrawRules;
            }
            if (admissionFee !== undefined) {
                settings.admissionFee = admissionFee;
            }
            if (withdrawalFee !== undefined) {
                settings.withdrawalFee = withdrawalFee;
            }
            if (req.body.teamLeaderMinBalance !== undefined) {
                settings.teamLeaderMinBalance = req.body.teamLeaderMinBalance;
            }
            if (activationCommission !== undefined) {
                settings.activationCommission = activationCommission;
            }
            if (supportMeetingLink !== undefined) {
                settings.supportMeetingLink = supportMeetingLink;
            }
            if (supportWhatsAppLink !== undefined) {
                settings.supportWhatsAppLink = supportWhatsAppLink;
            }
            if (helpLink !== undefined) {
                settings.helpLink = helpLink;
            }
            if (req.body.deliveryChargeInsideDhaka !== undefined) {
                settings.deliveryChargeInsideDhaka = req.body.deliveryChargeInsideDhaka;
            }
            if (req.body.deliveryChargeOutsideDhaka !== undefined) {
                settings.deliveryChargeOutsideDhaka = req.body.deliveryChargeOutsideDhaka;
            }
            if (req.body.defaultTeamLeaderId !== undefined) {
                settings.defaultTeamLeaderId = req.body.defaultTeamLeaderId;
            }
            if (req.body.classStartTime !== undefined) {
                settings.classStartTime = req.body.classStartTime;
            }
            if (req.body.classEndTime !== undefined) {
                settings.classEndTime = req.body.classEndTime;
            }
            if (req.body.roleSalaries !== undefined) {
                settings.roleSalaries = req.body.roleSalaries;
            }
            if (req.body.banners !== undefined) {
                settings.banners = req.body.banners;
            }
            yield settings.save();
        }
        res.json({
            message: {
                en: "Settings updated successfully",
                bn: "সেটিংস সফলভাবে আপডেট হয়েছে",
            },
            settings,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateSettings = updateSettings;
const updateCourseLink = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { teacherId, courseTitle, link } = req.body;
        const settings = yield model_1.Settings.findOne();
        if (!settings) {
            return res.status(404).json({ message: { en: "Settings not found", bn: "সেটিংস পাওয়া যায়নি" } });
        }
        const course = settings.courses.find(c => c.teacherId === teacherId && c.title === courseTitle);
        if (!course) {
            return res.status(404).json({ message: { en: "Course not found or you are not assigned to this course", bn: "কোর্স পাওয়া যায়নি বা আপনি এই কোর্সে নিয়োগ নন" } });
        }
        course.link = link;
        yield settings.save();
        res.json({
            message: {
                en: "Course link updated successfully",
                bn: "কোর্স লিংক সফলভাবে আপডেট হয়েছে",
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateCourseLink = updateCourseLink;
