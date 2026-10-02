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
exports.getMyReferralsNetwork = void 0;
const model_1 = require("./../model");
const dateRange_1 = require("./utils/dateRange");
/* =========================
   SEARCH
========================= */
function buildSearch(search) {
    if (!search)
        return {};
    const clean = search.replace(/^\+/, "");
    return {
        $or: [
            { name: { $regex: clean, $options: "i" } },
            { userId: { $regex: clean, $options: "i" } },
            { phone: { $regex: clean, $options: "i" } },
        ],
    };
}
/* =========================
   CONTROLLER
========================= */
const getMyReferralsNetwork = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Number(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;
        const status = req.query.status || "all";
        const search = buildSearch(req.query.search);
        const range = (0, dateRange_1.buildDateRange)(req.query.year, req.query.month, req.query.day);
        /* =========================
           BASE FILTER
        ========================= */
        const baseFilter = Object.assign({ referrer: userId }, search);
        if (status === "true")
            baseFilter.isActive = true;
        if (status === "false")
            baseFilter.isActive = false;
        /* =========================
           DATE FILTER (FIXED LOGIC)
        ========================= */
        if (range) {
            if (status === "true") {
                baseFilter.activationDate = {
                    $gte: range.startDate,
                    $lte: range.endDate,
                };
            }
            else {
                baseFilter.createdAt = {
                    $gte: range.startDate,
                    $lte: range.endDate,
                };
            }
        }
        /* =========================
           ACTIVE COUNT
        ========================= */
        const activeQuery = Object.assign({ referrer: userId, isActive: true }, search);
        if (range) {
            activeQuery.activationDate = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        /* =========================
           INACTIVE COUNT
        ========================= */
        const inactiveQuery = Object.assign({ referrer: userId, isActive: false }, search);
        if (range) {
            inactiveQuery.createdAt = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        /* =========================
           EXECUTE
        ========================= */
        const [result, activeResult, inactiveResult] = yield Promise.all([
            model_1.User.aggregate([
                {
                    $match: baseFilter,
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "referrer",
                        foreignField: "_id",
                        as: "referrer",
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
                        localField: "trainer",
                        foreignField: "_id",
                        as: "trainer",
                    },
                },
                {
                    $unwind: {
                        path: "$trainer",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$referrer",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $unwind: {
                        path: "$teamLeader",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $project: {
                        userId: 1,
                        name: 1,
                        phone: 1,
                        isActive: 1,
                        createdAt: 1,
                        activationDate: 1,
                        role: 1,
                        referrer: {
                            userId: "$referrer.userId",
                            name: "$referrer.name",
                        },
                        teamLeader: {
                            userId: "$teamLeader.userId",
                            name: "$teamLeader.name",
                        },
                        trainer: {
                            userId: "$trainer.userId",
                            name: "$trainer.name",
                        },
                    },
                },
                {
                    $sort: {
                        createdAt: -1,
                    },
                },
                {
                    $facet: {
                        referrals: [
                            {
                                $skip: skip,
                            },
                            {
                                $limit: limit,
                            },
                        ],
                        total: [
                            {
                                $count: "count",
                            },
                        ],
                    },
                },
            ]),
            model_1.User.aggregate([
                {
                    $match: activeQuery,
                },
                {
                    $count: "count",
                },
            ]),
            model_1.User.aggregate([
                {
                    $match: inactiveQuery,
                },
                {
                    $count: "count",
                },
            ]),
        ]);
        const referrals = ((_b = result[0]) === null || _b === void 0 ? void 0 : _b.referrals) || [];
        const total = ((_d = (_c = result[0]) === null || _c === void 0 ? void 0 : _c.total[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
        const activeCount = ((_e = activeResult[0]) === null || _e === void 0 ? void 0 : _e.count) || 0;
        const inactiveCount = ((_f = inactiveResult[0]) === null || _f === void 0 ? void 0 : _f.count) || 0;
        return res.json({
            referrals,
            total,
            activeCount,
            inactiveCount,
            page,
            pages: Math.ceil(total / limit),
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyReferralsNetwork = getMyReferralsNetwork;
