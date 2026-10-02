/**
 * Migration Script: messagedBy ObjectId[] → { by, byName, byRole, at }[]
 *
 * পুরনো schema: messagedBy: [ObjectId]
 * নতুন schema:  messagedBy: [{ by: ObjectId, byName: string, byRole: string, at: Date }]
 *
 * Run: npx ts-node src/utils/migrateMessagedBy.ts
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI as string;

async function migrate() {
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db!;
  const usersCollection = db.collection("users");

  // যেসব document-এ messagedBy array আছে এবং সেগুলোর element ObjectId (পুরনো format)
  // পুরনো format: messagedBy: [ ObjectId("...") ]
  // নতুন format:  messagedBy: [ { by: ObjectId, byName: string, byRole: string, at: Date } ]
  //
  // পুরনো element detect করার উপায়:
  // element যদি ObjectId হয় (object হবে না, $type: "objectId" হবে)

  const staleUsers = await usersCollection
    .find({
      messagedBy: { $exists: true, $not: { $size: 0 } },
      "messagedBy.by": { $exists: false }, // নতুন format এ .by থাকবে
    })
    .toArray();

  console.log(`📋 পুরনো format-এ messagedBy আছে এমন users: ${staleUsers.length}`);

  if (staleUsers.length === 0) {
    console.log("✅ কোনো migration দরকার নেই।");
    await mongoose.disconnect();
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const user of staleUsers) {
    try {
      const oldMessagedBy: mongoose.Types.ObjectId[] = user.messagedBy;

      // প্রতিটি পুরনো ObjectId-এর জন্য sender user খুঁজে নাও
      const newMessagedBy: {
        by: mongoose.Types.ObjectId;
        byName: string;
        byRole: string;
        at: Date;
      }[] = [];

      for (const senderId of oldMessagedBy) {
        // sender-কে lookup করো
        const sender = await usersCollection.findOne({
          _id: senderId,
        });

        newMessagedBy.push({
          by: senderId,
          byName: sender?.name || "Unknown",
          byRole: sender?.role || "unknown",
          at: user.updatedAt || user.createdAt || new Date(),
        });
      }

      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { messagedBy: newMessagedBy } }
      );

      successCount++;
      console.log(
        `  ✅ Migrated: ${user.name} (${user.userId}) — ${newMessagedBy.length} entry`
      );
    } catch (err) {
      errorCount++;
      console.error(`  ❌ Error migrating user ${user._id}:`, err);
    }
  }

  console.log(`\n📊 Migration শেষ:`);
  console.log(`   ✅ সফল: ${successCount}`);
  console.log(`   ❌ ব্যর্থ: ${errorCount}`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
