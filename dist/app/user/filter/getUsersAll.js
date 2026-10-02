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
exports.getUsersAll = void 0;
const model_1 = require("./../model");
const dateRange_1 = require("./utils/dateRange");
/* =========================
   NORMALIZE DATE INPUT
========================= */
function normalizeDateInput(value) {
    if (!value)
        return null;
    const parsed = parseInt(value);
    if (isNaN(parsed))
        return null;
    return parsed;
}
/* =========================
   SEARCH BUILDER
========================= */
function buildSearch(search) {
    if (!search)
        return {};
    const clean = search.replace(/^\+/, "");
    return {
        $or: [
            {
                name: {
                    $regex: clean,
                    $options: "i",
                },
            },
            {
                userId: {
                    $regex: clean,
                    $options: "i",
                },
            },
            {
                phone: {
                    $regex: clean,
                    $options: "i",
                },
            },
        ],
    };
}
/* =========================
   GET ALL USERS
========================= */
const getUsersAll = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        /* =========================
           PAGINATION
        ========================= */
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Number(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;
        /* =========================
           FILTERS
        ========================= */
        const status = req.query.status || "all";
        const role = req.query.role;
        const search = buildSearch(req.query.search);
        const range = (0, dateRange_1.buildDateRange)(req.query.year, req.query.month, req.query.day);
        /* =========================
           MAIN QUERY
        ========================= */
        const query = Object.assign({}, search);
        // Role Filter
        if (role && role !== "all") {
            query.role = role;
        }
        // Team Leader Filter
        if (req.query.teamLeaderId) {
            query.teamLeader = req.query.teamLeaderId;
        }
        // Exact User ID
        if (req.query.exactUserId) {
            query.userId = req.query.exactUserId;
        }
        // Status Filter
        if (status === "true") {
            query.isActive = true;
        }
        if (status === "false") {
            query.isActive = false;
        }
        /* =========================
           DATE FILTER
        ========================= */
        if (range) {
            const dateFilter = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
            // Active users -> activationDate
            if (status === "true") {
                query.activationDate = dateFilter;
            }
            // Inactive users -> createdAt
            else if (status === "false") {
                query.createdAt = dateFilter;
            }
            // All users -> createdAt
            else {
                query.createdAt = dateFilter;
            }
        }
        /* =========================
           ACTIVE COUNT QUERY
        ========================= */
        const activeQuery = Object.assign(Object.assign({}, search), { isActive: true });
        if (role && role !== "all") {
            activeQuery.role = role;
        }
        if (req.query.teamLeaderId) {
            activeQuery.teamLeader = req.query.teamLeaderId;
        }
        if (req.query.exactUserId) {
            activeQuery.userId = req.query.exactUserId;
        }
        if (range) {
            activeQuery.activationDate = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        /* =========================
           INACTIVE COUNT QUERY
        ========================= */
        const inactiveQuery = Object.assign(Object.assign({}, search), { isActive: false });
        if (role && role !== "all") {
            inactiveQuery.role = role;
        }
        if (req.query.teamLeaderId) {
            inactiveQuery.teamLeader = req.query.teamLeaderId;
        }
        if (req.query.exactUserId) {
            inactiveQuery.userId = req.query.exactUserId;
        }
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
                    $match: query,
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
                    $unwind: { path: "$teamLeader", preserveNullAndEmptyArrays: true },
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
                        users: [
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
        const users = ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.users) || [];
        const total = ((_c = (_b = result[0]) === null || _b === void 0 ? void 0 : _b.total[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
        const activeCount = ((_d = activeResult[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
        const inactiveCount = ((_e = inactiveResult[0]) === null || _e === void 0 ? void 0 : _e.count) || 0;
        /* =========================
           RESPONSE
        ========================= */
        return res.json({
            users,
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
exports.getUsersAll = getUsersAll;
