import { Request, Response, NextFunction } from "express";
import { User } from "../user/model";
import { Transaction } from "../transaction/model";

// Fix #4: single $facet aggregate replaces 14 separate countDocuments queries
export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const year = req.query.year as string;

    const dateFilter: Record<string, any> = {};
    const activeDateFilter: Record<string, any> = {};

    if (year) {
      const start = new Date(parseInt(year), 0, 1);
      const end = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      dateFilter["createdAt"] = { $gte: start, $lte: end };
      activeDateFilter["activationDate"] = { $gte: start, $lte: end };
    }

    const [result] = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $match: dateFilter }, { $count: "count" }],
          activeUsers: [
            { $match: { isActive: true, ...activeDateFilter } },
            { $count: "count" },
          ],
          inactiveUsers: [
            { $match: { isActive: false, ...dateFilter } },
            { $count: "count" },
          ],
          studentCount: [
            { $match: { role: "student", ...dateFilter } },
            { $count: "count" },
          ],
          trainerCount: [
            { $match: { role: "trainer", ...dateFilter } },
            { $count: "count" },
          ],
          teacherCount: [
            { $match: { role: "teacher", ...dateFilter } },
            { $count: "count" },
          ],
          teamLeaderCount: [
            { $match: { role: "team-leader", ...dateFilter } },
            { $count: "count" },
          ],
          seniorTeamLeaderCount: [
            { $match: { role: "senior-team-leader", ...dateFilter } },
            { $count: "count" },
          ],
          superAdminCount: [
            { $match: { role: "super-admin", ...dateFilter } },
            { $count: "count" },
          ],
          councilorCount: [
            { $match: { role: "councilor", ...dateFilter } },
            { $count: "count" },
          ],
          controllerCount: [
            { $match: { role: "controller", ...dateFilter } },
            { $count: "count" },
          ],
          checkerCount: [
            { $match: { role: "checker", ...dateFilter } },
            { $count: "count" },
          ],
          auditorCount: [
            { $match: { role: "auditor", ...dateFilter } },
            { $count: "count" },
          ],
        },
      },
    ]);

    const pick = (key: string) => result?.[key]?.[0]?.count ?? 0;

    res.json({
      totalUsers: pick("totalUsers"),
      activeUsers: pick("activeUsers"),
      inactiveUsers: pick("inactiveUsers"),
      studentCount: pick("studentCount"),
      trainerCount: pick("trainerCount"),
      teacherCount: pick("teacherCount"),
      teamLeaderCount: pick("teamLeaderCount"),
      seniorTeamLeaderCount: pick("seniorTeamLeaderCount"),
      superAdminCount: pick("superAdminCount"),
      councilorCount: pick("councilorCount"),
      controllerCount: pick("controllerCount"),
      checkerCount: pick("checkerCount"),
      auditorCount: pick("auditorCount"),
    });
  } catch (error: any) {
    next(error);
  }
};

// Top Earners — daily and monthly credit totals per user
// Public endpoint (no auth required) — only exposes name, userId, and earned amounts
export const getTopEarners = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const now = new Date();

    // Daily range: today 00:00:00 → 23:59:59 (UTC)
    const dayStart = new Date(now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Monthly range: 1st of current month → last moment of current month
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Single aggregate: daily and monthly in one pass via $facet
    const [result] = await Transaction.aggregate([
      {
        $match: {
          type: "credit",
          createdAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $facet: {
          daily: [
            { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
            {
              $group: {
                _id: "$userId",
                totalEarned: { $sum: "$recentAmount" },
              },
            },
            { $sort: { totalEarned: -1 } },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: {
                _id: 0,
                name: "$user.name",
                userId: "$user.userId",
                totalEarned: 1,
              },
            },
          ],
          monthly: [
            {
              $group: {
                _id: "$userId",
                totalEarned: { $sum: "$recentAmount" },
              },
            },
            { $sort: { totalEarned: -1 } },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user",
              },
            },
            { $unwind: "$user" },
            {
              $project: {
                _id: 0,
                name: "$user.name",
                userId: "$user.userId",
                totalEarned: 1,
              },
            },
          ],
        },
      },
    ]);

    res.json({
      daily: result?.daily ?? [],
      monthly: result?.monthly ?? [],
    });
  } catch (error: any) {
    next(error);
  }
};
