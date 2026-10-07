import { User } from "../app/user/model";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export const seedAdmin = async () => {
  try {
    // Seed Super Admin (only one allowed)
    let superAdmin = await User.findOne({ role: "super-admin" });
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("+8801700000000", 10);
      superAdmin = await User.create({
        name: "Super Admin",
        phone: "+8801700000000",
        password: hashedPassword,
        role: "super-admin",
        referrer: new mongoose.Types.ObjectId(),
        isActive: true,
      });
      // Self-referential: referrer points to itself
      await User.findByIdAndUpdate(superAdmin._id, { referrer: superAdmin._id });
    }
  } catch (error) {
    console.error("❌ Error seeding admin:", error);
  }
};
