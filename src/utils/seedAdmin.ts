import { User } from "../app/user/model";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const seedAdmin = async () => {
  try {
    // Seed Super Admin (only one allowed)
    let superAdmin = await User.findOne({ role: "super-admin" });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("Nadim123@#", 10);
      superAdmin = await User.create({
        name: "Super Admin",
        phone: "+8801714651617",
        password: hashedPassword,
        role: "super-admin",
        referrer: new mongoose.Types.ObjectId(),
        isActive: true,
      });
      // Self-referential: referrer points to itself
      await User.findByIdAndUpdate(superAdmin._id, { referrer: superAdmin._id });
    }

    // Seed Admin (only one allowed)
    const adminExists = await User.findOne({ role: "admin" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("Nadim@123", 10);
      const admin = await User.create({
        name: "Admin",
        phone: "+8801722790326",
        password: hashedPassword,
        role: "admin",
        referrer: superAdmin._id,
        isActive: true,
      });
      await User.findByIdAndUpdate(admin._id, { referrer: superAdmin._id });
    }
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  }
};
