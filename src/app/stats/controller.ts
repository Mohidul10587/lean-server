import { Request, Response, NextFunction } from "express";
import { User } from "../user/model";

export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const year = req.query.year as string;

    let dateFilter: Record<string, any> = {};
    let activeDateFilter: Record<string, any> = {};

    if (year) {
      const start = new Date(parseInt(year), 0, 1);
      const end = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      dateFilter = { createdAt: { $gte: start, $lte: end } };
      activeDateFilter = { activationDate: { $gte: start, $lte: end } };
    }

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      studentCount,
      trainerCount,
      teacherCount,
      teamLeaderCount,
      seniorTeamLeaderCount,
      superAdminCount,
      councilorCount,
      controllerCount,
      checkerCount,
      auditorCount,
      adminCount,
    ] = await Promise.all([
      User.countDocuments(dateFilter),
      User.countDocuments({ isActive: true, ...activeDateFilter }),
      User.countDocuments({ isActive: false, ...dateFilter }),
      User.countDocuments({ role: "student", ...dateFilter }),
      User.countDocuments({ role: "trainer", ...dateFilter }),
      User.countDocuments({ role: "teacher", ...dateFilter }),
      User.countDocuments({ role: "team-leader", ...dateFilter }),
      User.countDocuments({ role: "senior-team-leader", ...dateFilter }),
      User.countDocuments({ role: "super-admin", ...dateFilter }),
      User.countDocuments({ role: "councilor", ...dateFilter }),
      User.countDocuments({ role: "controller", ...dateFilter }),
      User.countDocuments({ role: "checker", ...dateFilter }),
      User.countDocuments({ role: "auditor", ...dateFilter }),
      User.countDocuments({ role: "admin", ...dateFilter }),
    ]);

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      studentCount,
      trainerCount,
      teacherCount,
      teamLeaderCount,
      seniorTeamLeaderCount,
      superAdminCount,
      councilorCount,
      controllerCount,
      checkerCount,
      auditorCount,
      adminCount,
    });
  } catch (error: any) {
    next(error);
  }
};
