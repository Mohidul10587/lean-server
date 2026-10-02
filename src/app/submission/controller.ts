import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Submission as Model } from "./model";
import { User } from "../user/model";
import { Settings } from "../settings/model";
import { Wallet } from "../wallet/model";
import { Transaction } from "../transaction/model";

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId, courseId, classNumber, imageUrls, videoUrl, teacherId } = req.body;

    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({
        message: { en: "Settings not found", bn: "সেটিংস পাওয়া যায়নি" },
      });
    }

    const courseIndex = settings.courses.findIndex(
      (c) => c._id.toString() === courseId.toString()
    );
    if (courseIndex === -1) {
      return res.status(404).json({
        message: { en: "Course not found", bn: "কোর্স পাওয়া যায়নি" },
      });
    }

    if (courseIndex > 0) {
      const previousCourse = settings.courses[courseIndex - 1];
      const acceptedCount = await Model.countDocuments({
        studentId,
        courseId: previousCourse._id,
        status: "Accepted",
      });

      if (acceptedCount < 10) {
        return res.status(400).json({
          message: {
            en: `You must complete 10 accepted submissions in "${previousCourse.title}" before starting "${courseId}"`,
            bn: `"${courseId}" শুরু করার আগে "${previousCourse.title}" এ ১০টি গৃহীত সাবমিশন সম্পূর্ণ করতে হবে`,
          },
        });
      }
    }

    const student = await User.findById(studentId);
    if (!student)
      return res.status(404).json({
        message: {
          en: "Student not found.",
          bn: "শিক্ষার্থী পাওয়া যায়নি।",
        },
      });

    // Block submission if previous class is not yet accepted
    if (classNumber > 1) {
      const prevClassAccepted = await Model.findOne({
        studentId,
        courseId,
        classNumber: classNumber - 1,
        status: "Accepted",
      });
      if (!prevClassAccepted) {
        return res.status(400).json({
          message: {
            en: `Class ${classNumber - 1} must be accepted before submitting class ${classNumber}.`,
            bn: `ক্লাস ${classNumber} জমা দেওয়ার আগে ক্লাস ${classNumber - 1} গৃহীত হতে হবে।`,
          },
        });
      }
    }

    if (classNumber > 10) {
      return res.status(400).json({
        message: {
          en: "You cannot submit more than 10 classes per course.",
          bn: "প্রতিটি কোর্সে সর্বোচ্চ ১০টি ক্লাস সাবমিট করা যাবে।",
        },
      });
    }

    const totalSubmissions = await Model.countDocuments({ studentId, courseId });
    if (totalSubmissions >= 10) {
      return res.status(400).json({
        message: {
          en: "You have already submitted all 10 classes for this course.",
          bn: "আপনি এই কোর্সে ইতিমধ্যে ১০টি ক্লাস সাবমিট করে ফেলেছেন।",
        },
      });
    }

    const duplicate = await Model.findOne({ studentId, courseId, classNumber });
    if (duplicate)
      return res.status(400).json({
        message: {
          en: `Class ${classNumber} has already been submitted.`,
          bn: `ক্লাস ${classNumber} ইতিমধ্যে জমা দেওয়া হয়েছে।`,
        },
      });

    // Enforce 24-hour gap between consecutive class submissions
    if (classNumber > 1) {
      const prevSubmission = await Model.findOne({
        studentId,
        courseId,
        classNumber: classNumber - 1,
      });
      if (prevSubmission) {
        const hoursSincePrev =
          (Date.now() - new Date(prevSubmission.createdAt).getTime()) / 36e5;
        if (hoursSincePrev < 24)
          return res.status(400).json({
            message: {
              en: `You must wait 24 hours after submitting class ${classNumber - 1} before submitting class ${classNumber}.`,
              bn: `ক্লাস ${classNumber} জমা দেওয়ার আগে ক্লাস ${classNumber - 1} জমা দেওয়ার ২৪ ঘণ্টা অপেক্ষা করতে হবে।`,
            },
          });
      }
    }

    const item = await Model.create({
      studentId,
      courseId,
      classNumber,
      imageUrls,
      videoUrl,
      teacherId,
      trainerId: student.trainer,
      teamLeaderId: student.teamLeader,
      seniorTeamLeaderId: student.seniorTeamLeader,
      status: "Pending",
    });
    res.status(201).json({
      message: {
        en: "Submission created successfully!",
        bn: "সাবমিশন সফলভাবে তৈরি হয়েছে!",
      },
      item,
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const item = await Model.findById(id);
    if (!item)
      return res.status(404).json({
        message: {
          en: "Submission not found.",
          bn: "সাবমিশন পাওয়া যায়নি।",
        },
      });

    const previousStatus = item.status;
    item.status = status;
    await item.save();

    // Award system: Add award when status changes to Accepted
    if (status === "Accepted" && previousStatus !== "Accepted") {
      const settings = await Settings.findOne();
      if (settings) {
        const course = settings.courses.find(
          (c: any) => c._id?.toString() === item.courseId.toString()
        );

        if (course?.isAwardEnabled && course.awardValue > 0) {
          const wallet = await Wallet.findOne({ userId: item.studentId });
          if (wallet) {
            const prevBalance = wallet.earnedBalance;
            wallet.earnedBalance += course.awardValue;
            await wallet.save();

            await Transaction.create({
              userId: item.studentId,
              previousAmount: prevBalance,
              recentAmount: course.awardValue,
              currentTotal: wallet.earnedBalance,
              description: `Class ${item.classNumber} award for ${course.title}`,
              type: "credit",
            });
          }
        }
      }
    }

    res.status(200).json({
      message: {
        en: "Status updated successfully!",
        bn: "স্ট্যাটাস আপডেট হয়েছে!",
      },
      item,
    });
  } catch (error: any) {
    next(error);
  }
};

export const resubmit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { imageUrls } = req.body;
    const item = await Model.findById(id);

    if (!item)
      return res.status(404).json({
        message: {
          en: "Submission not found.",
          bn: "সাবমিশন পাওয়া যায়নি।",
        },
      });
    if (item.status !== "Rejected") {
      return res.status(400).json({
        message: {
          en: "Only rejected submissions can be resubmitted.",
          bn: "শুধুমাত্র প্রত্যাখ্যাত সাবমিশন পুনরায় জমা দেওয়া যায়।",
        },
      });
    }

    item.imageUrls = imageUrls;
    item.status = "Pending";
    await item.save();

    res.status(200).json({
      message: {
        en: "Resubmitted successfully!",
        bn: "পুনরায় জমা দেওয়া হয়েছে!",
      },
      item,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getStudentSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const { courseId } = req.query;
    const filter: any = { studentId };
    if (courseId) filter.courseId = courseId;
    const items = await Model.find(filter).sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error: any) {
    next(error);
  }
};

export const getTeacherSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teacherId } = req.params;
    const items = await Model.find({
      $or: [
        { teacherId },
        { trainerId: teacherId },
        { teamLeaderId: teacherId },
        { seniorTeamLeaderId: teacherId },
      ],
    })
      .populate("studentId", "name userId phone image")
      .sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error: any) {
    next(error);
  }
};

export const getSubmissionProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studentId } = req.params;
    const progress = await Model.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: "$courseId",
          total: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.status(200).json(progress);
  } catch (error: any) {
    next(error);
  }
};
