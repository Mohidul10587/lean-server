import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, { message: JSON.stringify({ en: "Name is required", bn: "নাম প্রয়োজন" }) }),
  phone: z.string().min(10, { message: JSON.stringify({ en: "Phone must be at least 10 digits", bn: "ফোন কমপক্ষে ১০ সংখ্যা হতে হবে" }) }),
  password: z.string().min(6, { message: JSON.stringify({ en: "Password must be at least 6 characters", bn: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে" }) }),
  role: z.enum(["user", "admin"]).optional(),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  phone: z.string().min(1, { message: JSON.stringify({ en: "Phone is required", bn: "ফোন প্রয়োজন" }) }),
  password: z.string().min(1, { message: JSON.stringify({ en: "Password is required", bn: "পাসওয়ার্ড প্রয়োজন" }) }),
});
