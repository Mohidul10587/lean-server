import { NextFunction, Request, Response } from "express";
import { User } from "./../model";
import { buildDateRange } from "./utils/dateRange";

/* =========================
   NORMALIZE DATE INPUT
========================= */
function normalizeDateInput(value?: string) {
  if (!value) return null;

  const parsed = parseInt(value);

  if (isNaN(parsed)) return null;

  return parsed;
}

/* =========================
   SEARCH BUILDER
========================= */
function buildSearch(search?: string) {
  if (!search) return {};

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
export const getUsersAll = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
    const status = (req.query.status as string) || "all";

    const role = req.query.role as string;

    const search = buildSearch(req.query.search as string);

    const range = buildDateRange(
      req.query.year as string,
      req.query.month as string,
      req.query.day as string
    );

    /* =========================
       MAIN QUERY
    ========================= */
    const query: any = {
      ...search,
    };

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
    const activeQuery: any = {
      ...search,
      isActive: true,
    };

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
    const inactiveQuery: any = {
      ...search,
      isActive: false,
    };

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
    const [result, activeResult, inactiveResult] = await Promise.all([
      User.aggregate([
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

      User.aggregate([
        {
          $match: activeQuery,
        },
        {
          $count: "count",
        },
      ]),

      User.aggregate([
        {
          $match: inactiveQuery,
        },
        {
          $count: "count",
        },
      ]),
    ]);

    const users = result[0]?.users || [];

    const total = result[0]?.total[0]?.count || 0;

    const activeCount = activeResult[0]?.count || 0;

    const inactiveCount = inactiveResult[0]?.count || 0;
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
  } catch (error) {
    next(error);
  }
};
