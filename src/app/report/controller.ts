import { Request, Response, NextFunction } from "express";
import { Report } from "./model";
import { User } from "../user/model";

export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auditorId = req.user?._id;
    const { seniorTeamLeaderId, teamLeaderId, trainerId, description } = req.body;
    await Report.create({ auditorId, seniorTeamLeaderId, teamLeaderId, trainerId, description });
    res.status(201).json({ message: { en: "Report submitted successfully", bn: "রিপোর্ট সফলভাবে জমা হয়েছে" } });
  } catch (error) {
    next(error);
  }
};

export const getMyReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await Report.find({ auditorId: req.user?._id }).sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (error) {
    next(error);
  }
};

export const updateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, auditorId: req.user?._id });
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (report.status === "resolved") return res.status(400).json({ message: "Cannot edit a resolved report" });
    const { seniorTeamLeaderId, teamLeaderId, trainerId, description } = req.body;
    await Report.findByIdAndUpdate(req.params.id, { seniorTeamLeaderId, teamLeaderId, trainerId, description });
    res.json({ message: { en: "Report updated successfully" } });
  } catch (error) {
    next(error);
  }
};

export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const query: any = {};
    if (status) query.status = status;
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("auditorId", "userId name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments(query),
    ]);

    // collect all userIds to look up names
    const userIds = [...new Set(reports.flatMap((r) => [r.seniorTeamLeaderId, r.teamLeaderId, r.trainerId].filter(Boolean)))];
    const users = await User.find({ userId: { $in: userIds } }, "userId name").lean();
    const nameMap = Object.fromEntries(users.map((u) => [u.userId, u.name]));

    const enriched = reports.map((r) => ({
      ...r,
      seniorTeamLeaderName: nameMap[r.seniorTeamLeaderId] || null,
      teamLeaderName: nameMap[r.teamLeaderId] || null,
      trainerName: nameMap[r.trainerId] || null,
    }));

    res.json({ reports: enriched, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

export const deleteReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, auditorId: req.user?._id });
    if (!report) return res.status(404).json({ message: "Report not found" });
    if (report.status === "resolved") return res.status(400).json({ message: "Cannot delete a resolved report" });
    await Report.findByIdAndDelete(req.params.id);
    res.json({ message: "Report deleted" });
  } catch (error) {
    next(error);
  }
};

export const resolveReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Report.findByIdAndUpdate(req.params.id, { status: "resolved" });
    res.json({ message: { en: "Report resolved", bn: "রিপোর্ট সমাধান হয়েছে" } });
  } catch (error) {
    next(error);
  }
};
