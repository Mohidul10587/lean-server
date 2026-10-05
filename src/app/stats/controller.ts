import { Request, Response, NextFunction } from "express";
import { User } from "../user/model";

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
          adminCount: [
            { $match: { role: "admin", ...dateFilter } },
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
      adminCount: pick("adminCount"),
    });
  } catch (error: any) {
    next(error);
  }
};
