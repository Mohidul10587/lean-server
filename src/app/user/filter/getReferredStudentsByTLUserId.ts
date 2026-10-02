import { NextFunction, Request, Response } from "express";
import { User } from "./../model";
import { buildDateRange } from "./utils/dateRange";

/* =========================
   SEARCH
========================= */
function buildSearch(search?: string) {
  if (!search) return {};

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
   MAIN CONTROLLER (FIXED)
========================= */
export const getReferredStudentsByTLUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamLeaderId = req.user?._id;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const status = (req.query.status as string) || "all";
    const search = buildSearch(req.query.search as string);
    const range = buildDateRange(
      req.query.year as string,
      req.query.month as string,
      req.query.day as string
    );

    /* =========================
       TL STUDENTS
    ========================= */
    const tlStudentIds = await User.distinct("_id", {
      role: "student",
      teamLeader: teamLeaderId,
    });

    /* =========================
       BASE QUERY
    ========================= */
    const query: any = {
      role: "student",
      referrer: { $in: tlStudentIds },
      ...search,
    };

    if (status === "true") query.isActive = true;
    if (status === "false") query.isActive = false;

    if (range) {
      const dateFilter = {
        $gte: range.startDate,
        $lte: range.endDate,
      };

      if (status === "true") {
        query.activationDate = dateFilter;
      } else if (status === "false") {
        query.createdAt = dateFilter;
      } else {
        query.createdAt = dateFilter;
      }
    }

    /* =========================
       ACTIVE COUNT (REFERENCE MATCHED)
    ========================= */
    const activeQuery: any = {
      role: "student",
      referrer: { $in: tlStudentIds },
      isActive: true,
      ...search,
    };

    if (range) {
      activeQuery.activationDate = {
        $gte: range.startDate,
        $lte: range.endDate,
      };
    }

    /* =========================
       INACTIVE COUNT (REFERENCE MATCHED)
    ========================= */
    const inactiveQuery: any = {
      role: "student",
      referrer: { $in: tlStudentIds },
      isActive: false,
      ...search,
    };

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
            isMessaged: {
              $gt: [{ $size: { $ifNull: ["$messagedBy", []] } }, 0],
            },
            messagedBy: {
              $map: {
                input: { $ifNull: ["$messagedBy", []] },
                as: "m",
                in: {
                  byName: "$$m.byName",
                  byRole: "$$m.byRole",
                  at: "$$m.at",
                },
              },
            },
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
