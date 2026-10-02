/**
 * One-time fix: backfill activationDate for users who are isActive=true
 * but have no activationDate (activated via admin edit, not the activation flow).
 *
 * Sets activationDate to createdAt as a best-effort fallback.
 *
 * Run once: npx ts-node scripts/fixMissingActivationDate.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/app/user/model";

dotenv.config();

async function fixMissingActivationDate() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("Connected to DB");

  const affected = await User.find({
    isActive: true,
    activationDate: { $exists: false },
  }).select("_id userId name createdAt");

  console.log(`Found ${affected.length} active user(s) without activationDate`);

  let fixed = 0;
  for (const user of affected) {
    await User.updateOne(
      { _id: user._id },
      { $set: { activationDate: (user as any).createdAt } }
    );
    console.log(`✅ ${user.userId} (${user.name}) → activationDate set to createdAt`);
    fixed++;
  }

  console.log(`\nDone. Fixed ${fixed} user(s).`);
  await mongoose.disconnect();
}

fixMissingActivationDate().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
