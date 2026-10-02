"use strict";
/**
 * Migration Script: messagedBy ObjectId[] → { by, byName, byRole, at }[]
 *
 * পুরনো schema: messagedBy: [ObjectId]
 * নতুন schema:  messagedBy: [{ by: ObjectId, byName: string, byRole: string, at: Date }]
 *
 * Run: npx ts-node src/utils/migrateMessagedBy.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const mongoUri = process.env.MONGODB_URI;
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(mongoUri);
        console.log("✅ Connected to MongoDB");
        const db = mongoose_1.default.connection.db;
        const usersCollection = db.collection("users");
        // যেসব document-এ messagedBy array আছে এবং সেগুলোর element ObjectId (পুরনো format)
        // পুরনো format: messagedBy: [ ObjectId("...") ]
        // নতুন format:  messagedBy: [ { by: ObjectId, byName: string, byRole: string, at: Date } ]
        //
        // পুরনো element detect করার উপায়:
        // element যদি ObjectId হয় (object হবে না, $type: "objectId" হবে)
        const staleUsers = yield usersCollection
            .find({
            messagedBy: { $exists: true, $not: { $size: 0 } },
            "messagedBy.by": { $exists: false }, // নতুন format এ .by থাকবে
        })
            .toArray();
        console.log(`📋 পুরনো format-এ messagedBy আছে এমন users: ${staleUsers.length}`);
        if (staleUsers.length === 0) {
            console.log("✅ কোনো migration দরকার নেই।");
            yield mongoose_1.default.disconnect();
            return;
        }
        let successCount = 0;
        let errorCount = 0;
        for (const user of staleUsers) {
            try {
                const oldMessagedBy = user.messagedBy;
                // প্রতিটি পুরনো ObjectId-এর জন্য sender user খুঁজে নাও
                const newMessagedBy = [];
                for (const senderId of oldMessagedBy) {
                    // sender-কে lookup করো
                    const sender = yield usersCollection.findOne({
                        _id: senderId,
                    });
                    newMessagedBy.push({
                        by: senderId,
                        byName: (sender === null || sender === void 0 ? void 0 : sender.name) || "Unknown",
                        byRole: (sender === null || sender === void 0 ? void 0 : sender.role) || "unknown",
                        at: user.updatedAt || user.createdAt || new Date(),
                    });
                }
                yield usersCollection.updateOne({ _id: user._id }, { $set: { messagedBy: newMessagedBy } });
                successCount++;
                console.log(`  ✅ Migrated: ${user.name} (${user.userId}) — ${newMessagedBy.length} entry`);
            }
            catch (err) {
                errorCount++;
                console.error(`  ❌ Error migrating user ${user._id}:`, err);
            }
        }
        console.log(`\n📊 Migration শেষ:`);
        console.log(`   ✅ সফল: ${successCount}`);
        console.log(`   ❌ ব্যর্থ: ${errorCount}`);
        yield mongoose_1.default.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    });
}
migrate().catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
});
