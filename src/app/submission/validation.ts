import { z } from "zod";

export const createSubmissionSchema = z.object({
  studentId: z.string().min(1, { message: JSON.stringify({ en: "Student ID is required", bn: "শিক্ষার্থী আইডি প্রয়োজন" }) }),
  courseId: z.string().min(1, { message: JSON.stringify({ en: "Course ID is required", bn: "কোর্স আইডি প্রয়োজন" }) }),
  classNumber: z.number().min(1, { message: JSON.stringify({ en: "Class number is required", bn: "ক্লাস নম্বর প্রয়োজন" }) }),
  imageUrls: z.array(z.string().url()).optional().default([]),
  videoUrl: z.string().url().optional(),
  teacherId: z.string().min(1, { message: JSON.stringify({ en: "Teacher ID is required", bn: "শিক্ষক আইডি প্রয়োজন" }) })
}).refine(data => (data.imageUrls && data.imageUrls.length > 0) || !!data.videoUrl, {
  message: JSON.stringify({ en: "At least one image or a video URL is required", bn: "কমপক্ষে একটি ছবি অথবা ভিডিও ইউআরএল প্রয়োজন" }),
  path: ["imageUrls"],
});

export const updateStatusSchema = z.object({
  status: z.enum(["Pending", "Accepted", "Rejected"])
});
