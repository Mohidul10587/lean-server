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
exports.listForTeamLeader = exports.getMyReferralsNetwork = exports.getUsersAll = exports.getReferredStudentsByTLUserId = void 0;
exports.buildDateRange = buildDateRange;
exports.buildSearch = buildSearch;
const model_1 = require("./model");
function normalizeDateInput(value) {
    if (!value)
        return null;
    const parsed = parseInt(value);
    if (isNaN(parsed))
        return null;
    return parsed;
}
/* =========================
   DATE RANGE BUILDER
========================= */
function buildDateRange(year, month, day) {
    const y = normalizeDateInput(year);
    const m = normalizeDateInput(month);
    const d = normalizeDateInput(day);
    if (!y)
        return null;
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
    let start;
    let end;
    // DAY
    if (d && m) {
        start = new Date(y, m - 1, d, 0, 0, 0, 0);
        end = new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    // MONTH
    else if (m) {
        start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        end = new Date(y, m, 0, 23, 59, 59, 999);
    }
    // YEAR
    else {
        start = new Date(y, 0, 1, 0, 0, 0, 0);
        end = new Date(y + 1, 0, 1, 0, 0, 0, 0);
    }
    return {
        startDate: new Date(start.getTime() - BD_OFFSET_MS),
        endDate: new Date(end.getTime() - BD_OFFSET_MS),
    };
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
            { name: { $regex: clean, $options: "i" } },
            { userId: { $regex: clean, $options: "i" } },
            { phone: { $regex: clean, $options: "i" } },
        ],
    };
}
/* =========================
   CORE QUERY BUILDER (FIXED)
========================= */
function buildUserQuery(params) {
    const { scope = {}, search = {}, status = "all", range } = params;
    const base = Object.assign(Object.assign({}, scope), search);
    // STATUS FILTER
    if (status === "true")
        base.isActive = true;
    if (status === "false")
        base.isActive = false;
    // DATE FILTER
    if (range) {
        if (status === "true") {
            base.activationDate = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        else if (status === "false") {
            base.createdAt = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        else {
            // 🚀 FIX: clean $or (NO $and wrapper)
            base.$or = [
                {
                    isActive: true,
                    activationDate: {
                        $gte: range.startDate,
                        $lte: range.endDate,
                    },
                },
                {
                    isActive: false,
                    createdAt: {
                        $gte: range.startDate,
                        $lte: range.endDate,
                    },
                },
            ];
        }
    }
    return base;
}
/* =========================
   REUSABLE EXEC FUNCTION
========================= */
function getPaginatedUsers(_a) {
    return __awaiter(this, arguments, void 0, function* ({ query, page, limit, populate = false, }) {
        const skip = (page - 1) * limit;
        let baseQuery = model_1.User.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        if (populate) {
            baseQuery = baseQuery.populate("referrer", "userId name");
        }
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            baseQuery,
            model_1.User.countDocuments(query),
            // 🔥 FIX: separate real counts (WITHOUT union complexity)
            model_1.User.countDocuments(Object.assign(Object.assign({}, query), { isActive: true })),
            model_1.User.countDocuments(Object.assign(Object.assign({}, query), { isActive: false })),
        ]);
        return {
            users,
            total,
            activeCount,
            inactiveCount,
        };
    });
}
function getStatusFilterQuery(status, base) {
    if (status === "true") {
        return Object.assign(Object.assign({}, base), { isActive: true });
    }
    if (status === "false") {
        return Object.assign(Object.assign({}, base), { isActive: false });
    }
    return base; // all
}
function getCountQuery(status, base) {
    if (status === "true") {
        return Object.assign(Object.assign({}, base), { isActive: true });
    }
    if (status === "false") {
        return Object.assign(Object.assign({}, base), { isActive: false });
    }
    return base; // all
}
/* =========================
   CONTROLLERS
========================= */
/* ---------- REFFERED STUDENTS TL (FIXED) ---------- */
const getReferredStudentsByTLUserId = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status || "all";
        const searchCondition = buildSearch(req.query.search);
        const range = buildDateRange(req.query.year, req.query.month, req.query.day);
        // =========================
        // STEP 1: BASE SCOPE
        // =========================
        const tlStudentIds = yield model_1.User.distinct("_id", {
            role: "student",
            teamLeader: teamLeaderId,
        });
        const baseScope = {
            role: "student",
            referrer: { $in: tlStudentIds },
        };
        // =========================
        // STEP 2: LIST QUERY (UNION SAFE)
        // =========================
        const query = buildUserQuery({
            scope: baseScope,
            search: searchCondition,
            range,
            status,
        });
        // =========================
        // STEP 3: COUNT QUERIES (FIXED - SEPARATE & SAFE)
        // =========================
        const activeQuery = Object.assign(Object.assign(Object.assign({}, baseScope), { isActive: true }), (searchCondition || {}));
        const inactiveQuery = Object.assign(Object.assign(Object.assign({}, baseScope), { isActive: false }), (searchCondition || {}));
        // apply range separately
        if (range) {
            activeQuery.activationDate = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
            inactiveQuery.createdAt = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        // =========================
        // STEP 4: EXECUTE
        // =========================
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(query)
                .select("userId name phone image isActive createdAt activationDate referrer")
                .populate("referrer", "userId name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(query),
            model_1.User.countDocuments(activeQuery),
            model_1.User.countDocuments(inactiveQuery),
        ]);
        // =========================
        // RESPONSE
        // =========================
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
exports.getReferredStudentsByTLUserId = getReferredStudentsByTLUserId;
/* ---------- ALL USERS FOR ADMIN AND SUPER ADMIN---------- */
const getUsersAll = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Number(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;
        const status = req.query.status || "all";
        const search = buildSearch(req.query.search);
        const range = buildDateRange(req.query.year, req.query.month, req.query.day);
        const base = Object.assign(Object.assign(Object.assign(Object.assign({}, (req.query.role !== "all" && { role: req.query.role })), (req.query.teamLeaderId && { teamLeader: req.query.teamLeaderId })), (req.query.exactUserId && { userId: req.query.exactUserId })), search);
        // DATE FILTER (COMMON)
        if (range) {
            // @ts-ignore
            base.createdAt = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        // =========================
        // LIST QUERY
        // =========================
        const listQuery = getStatusFilterQuery(status, base);
        // =========================
        // COUNT QUERY
        // =========================
        const countQuery = getCountQuery(status, base);
        const activeQuery = Object.assign(Object.assign({}, base), { isActive: true });
        const inactiveQuery = Object.assign(Object.assign({}, base), { isActive: false });
        const [users, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(listQuery)
                .populate("referrer", "userId name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(countQuery),
            model_1.User.countDocuments(activeQuery),
            model_1.User.countDocuments(inactiveQuery),
        ]);
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
/* ---------- MY REFERRALS OF A STUDENT ---------- */
const getMyReferralsNetwork = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const status = req.query.status || "all";
        const searchCondition = buildSearch(req.query.search);
        const range = buildDateRange(req.query.year, req.query.month, req.query.day);
        // =========================
        // BASE SCOPE
        // =========================
        const baseScope = { referrer: userId };
        // =========================
        // LIST QUERY (SAFE)
        // =========================
        const query = buildUserQuery({
            scope: baseScope,
            search: searchCondition,
            range,
            status,
        });
        // =========================
        // CLEAN COUNT QUERIES (FIXED)
        // =========================
        const activeQuery = Object.assign(Object.assign(Object.assign({}, baseScope), { isActive: true }), (searchCondition || {}));
        const inactiveQuery = Object.assign(Object.assign(Object.assign({}, baseScope), { isActive: false }), (searchCondition || {}));
        if (range) {
            activeQuery.activationDate = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
            inactiveQuery.createdAt = {
                $gte: range.startDate,
                $lte: range.endDate,
            };
        }
        // =========================
        // EXECUTION
        // =========================
        const [referrals, total, activeCount, inactiveCount] = yield Promise.all([
            model_1.User.find(query)
                .select("userId name phone isActive createdAt referrer")
                .populate("referrer", "userId name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            model_1.User.countDocuments(query),
            model_1.User.countDocuments(activeQuery),
            model_1.User.countDocuments(inactiveQuery),
        ]);
        // =========================
        // RESPONSE
        // =========================
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
/* ---------- TEAM LEADER LIST ---------- */
const listForTeamLeader = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const teamLeaderId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const search = buildSearch(req.query.search);
        const range = buildDateRange(req.query.year, req.query.month, req.query.day);
        const scope = {
            teamLeader: teamLeaderId,
            role: "student",
        };
        const query = buildUserQuery({
            scope,
            search,
            range,
            status: req.query.status || "all",
        });
        const { users, total, activeCount, inactiveCount } = yield getPaginatedUsers({
            query,
            page,
            limit,
            populate: true,
        });
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
exports.listForTeamLeader = listForTeamLeader;
